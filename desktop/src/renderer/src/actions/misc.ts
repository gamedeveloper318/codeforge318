import { GlobSet, splitPatterns } from "@shared/glob";
import type { SearchQuery, SearchResponse } from "@shared/ipc";
import { runCommandForPath } from "@shared/languages";
import { buildMatcher, findMatches, replaceInText } from "@shared/search-matcher";
import type { Settings } from "@shared/settings";
import { api, errorMessage } from "../lib/bridge";
import * as paths from "../lib/paths";
import { getEntry, isDirty } from "../monaco/models";
import { getState, setState, type SearchState } from "../state/store";
import { findFileTab, saveTab } from "./editor";
import { logOutput, reportError, toast } from "./notify";
import { createTerminal } from "./terminal";

// ---------- Settings ----------

export async function updateSettings(patch: Partial<Settings>): Promise<void> {
  try {
    // The main process validates and broadcasts the result (settings:changed).
    await api.invoke("settings:update", patch);
  } catch (error) {
    reportError("Could not update settings", error);
  }
}

export async function resetSettings(): Promise<void> {
  const choice = await api.invoke("app:confirm", {
    type: "question",
    message: "Reset all settings to their defaults?",
    buttons: ["Reset", "Cancel"],
    defaultId: 1,
    cancelId: 1,
  });
  if (choice === 0)
    await api
      .invoke("settings:reset")
      .catch((error) => reportError("Could not reset settings", error));
}

export function toggleTheme(): void {
  const dark = getState().settings["workbench.colorTheme"] !== "codeforge-light";
  void updateSettings({ "workbench.colorTheme": dark ? "codeforge-light" : "codeforge-dark" });
}

// ---------- Search ----------

let searchTimer: number | undefined;

export async function runSearch(): Promise<void> {
  const { search, workspace } = getState();
  if (!workspace || !search.pattern) {
    setState({ search: { ...search, running: false, response: null, error: null } });
    return;
  }
  setState({ search: { ...search, running: true, error: null } });
  try {
    const response = await api.invoke("search:find", searchQuery(search));
    if (response.cancelled) return;
    setState({
      search: {
        ...getState().search,
        running: false,
        response: withUnsavedEdits(response, search),
      },
    });
  } catch (error) {
    setState({
      search: { ...getState().search, running: false, response: null, error: errorMessage(error) },
    });
  }
}

/**
 * Search runs on the files on disk; for files with unsaved changes the
 * editor's text is what counts, so their results are recomputed from it.
 */
function withUnsavedEdits(response: SearchResponse, search: SearchState): SearchResponse {
  const { tabs, settings, workspace } = getState();
  if (!workspace) return response;
  const matcher = buildMatcher(search);
  const exclude = new GlobSet([
    ...settings["files.exclude"],
    ...settings["search.exclude"],
    ...splitPatterns(search.exclude),
  ]);
  const include = new GlobSet(splitPatterns(search.include));
  let results = response.results;
  for (const tab of tabs) {
    if (tab.kind !== "file" || !tab.path || !isDirty(tab.id)) continue;
    const relativePath = paths.relative(workspace.root, tab.path);
    if (relativePath === tab.path || exclude.matchesFileOrAncestor(relativePath)) continue;
    if (!include.isEmpty && !include.matchesFileOrAncestor(relativePath)) continue;
    const text = getEntry(tab.id)?.model.getValue() ?? "";
    const matches = findMatches(text, new RegExp(matcher), 5000);
    const index = results.findIndex((r) => paths.samePath(r.path, tab.path!));
    const updated = { path: tab.path, relativePath, matches };
    if (index !== -1) {
      results = matches.length
        ? results.map((r, i) => (i === index ? updated : r))
        : results.filter((_, i) => i !== index);
    } else if (matches.length) {
      results = [...results, updated];
    }
  }
  if (results === response.results) return response;
  return { ...response, results, matchCount: results.reduce((n, r) => n + r.matches.length, 0) };
}

function searchQuery(search: SearchState): SearchQuery {
  return {
    pattern: search.pattern,
    isRegex: search.isRegex,
    caseSensitive: search.caseSensitive,
    wholeWord: search.wholeWord,
    include: search.include,
    exclude: search.exclude,
  };
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/**
 * Replaces the current search results (all files, or one). Files open in the
 * editor are changed there (undo works, saving is up to the user); other files
 * are changed on disk. Asks first.
 */
export async function replaceResults(onlyFile?: string): Promise<void> {
  const { search, workspace } = getState();
  if (!workspace || !search.pattern || !search.response) return;
  const files = search.response.results.filter(
    (r) => !onlyFile || paths.samePath(r.path, onlyFile),
  );
  const occurrences = files.reduce((total, file) => total + file.matches.length, 0);
  if (!occurrences) return;
  const choice = await api.invoke("app:confirm", {
    type: "warning",
    message: `Replace ${plural(occurrences, "occurrence")} in ${plural(files.length, "file")} with “${search.replacement}”?`,
    detail:
      "Files open in the editor are changed there, so you can undo and choose when to save. Other files are changed on disk.",
    buttons: ["Replace", "Cancel"],
    defaultId: 0,
    cancelId: 1,
  });
  if (choice !== 0) return;

  let replacements = 0;
  let filesChanged = 0;
  const onDisk: string[] = [];
  try {
    const matcher = buildMatcher(search);
    for (const file of files) {
      const tab = findFileTab(file.path);
      const entry = tab ? getEntry(tab.id) : undefined;
      if (!entry) {
        onDisk.push(file.path);
        continue;
      }
      const model = entry.model;
      const { text, count } = replaceInText(
        model.getValue(),
        new RegExp(matcher),
        search.replacement,
        search.isRegex,
      );
      if (!count) continue;
      model.pushEditOperations([], [{ range: model.getFullModelRange(), text }], () => null);
      replacements += count;
      filesChanged++;
    }
    if (onDisk.length) {
      const result = await api.invoke(
        "search:replace",
        searchQuery(search),
        search.replacement,
        onDisk,
      );
      replacements += result.replacements;
      filesChanged += result.filesChanged;
      for (const failure of result.failed)
        logOutput(`Replace failed in ${failure.path}: ${failure.message}`, "error");
      if (result.failed.length) {
        toast(
          "error",
          `Could not replace in ${plural(result.failed.length, "file")}`,
          result.failed.map((f) => f.message).join("\n"),
        );
      }
    }
  } catch (error) {
    reportError("Replace failed", error);
  }
  logOutput(
    `Replaced ${plural(replacements, "occurrence")} of "${search.pattern}" in ${plural(filesChanged, "file")}`,
  );
  if (replacements)
    toast(
      "success",
      `Replaced ${plural(replacements, "occurrence")} in ${plural(filesChanged, "file")}`,
    );
  await runSearch();
}

export function scheduleSearch(): void {
  window.clearTimeout(searchTimer);
  searchTimer = window.setTimeout(() => void runSearch(), 300);
}

// ---------- Run & preview ----------

const SAFE_SCRIPT_NAME = /^[\w:.@/+-]+$/;

function activeFilePath(): string | null {
  const { tabs, activeTabId } = getState();
  const tab = tabs.find((t) => t.id === activeTabId);
  return tab?.kind === "file" ? tab.path : null;
}

export async function runActiveFile(): Promise<void> {
  let file = activeFilePath();
  const { activeTabId } = getState();
  if (!file || !activeTabId) {
    toast("info", "Open a saved file to run it.");
    return;
  }
  const runner = runCommandForPath(file);
  if (!runner) {
    toast(
      "info",
      `CodeForge doesn't know how to run "${paths.basename(file)}"`,
      "Supported: JavaScript, TypeScript, Python, PowerShell, shell scripts, Ruby, PHP, Go, Lua and Dart.",
    );
    return;
  }
  if (isDirty(activeTabId)) {
    const saved = await saveTab(activeTabId);
    if (!saved) return;
    file = saved;
  }
  await createTerminal({
    cwd: paths.dirname(file),
    command: `${runner.program} "${file}"`,
    name: `Run ${paths.basename(file)}`,
  });
}

export async function readPackageScripts(): Promise<Record<string, string> | null> {
  const root = getState().workspace?.root;
  if (!root) return null;
  try {
    const file = await api.invoke("fs:read-file", paths.join(root, "package.json"));
    const pkg = JSON.parse(file.content) as { scripts?: Record<string, unknown> };
    const scripts: Record<string, string> = {};
    for (const [name, command] of Object.entries(pkg.scripts ?? {})) {
      if (typeof command === "string") scripts[name] = command;
    }
    return scripts;
  } catch {
    return null;
  }
}

export async function runScript(name: string): Promise<void> {
  const root = getState().workspace?.root;
  if (!root) return;
  if (!SAFE_SCRIPT_NAME.test(name)) {
    toast(
      "error",
      `The script name "${name}" contains unusual characters`,
      "Run it from the terminal instead.",
    );
    return;
  }
  await createTerminal({ cwd: root, command: `npm run ${name}`, name: `npm: ${name}` });
}

export async function previewActiveHtml(): Promise<void> {
  const file = activeFilePath();
  if (!file || !/\.html?$/i.test(file)) {
    toast("info", "Open an .html file to preview it.");
    return;
  }
  await api
    .invoke("preview:open-file", file)
    .catch((error) => reportError("Preview failed", error));
}

export function promptLocalhostPreview(): void {
  setState({
    quickPick: {
      kind: "input",
      prompt: "Local development server URL to preview",
      value: "http://localhost:3000",
      validate: (value) =>
        /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?(\/.*)?$/i.test(value.trim())
          ? null
          : "Only localhost / 127.0.0.1 addresses can be previewed.",
      onAccept: (value) =>
        void api
          .invoke("preview:open-url", value.trim())
          .catch((error) => reportError("Preview failed", error)),
    },
  });
}

// ---------- About ----------

export async function showAbout(): Promise<void> {
  const info = getState().appInfo;
  if (!info) return;
  await api.invoke("app:confirm", {
    type: "info",
    message: `CodeForge ${info.version}`,
    detail: [
      "Your Code. Your Workspace. Your Power.",
      "",
      `Electron: ${info.electron}`,
      `Chromium: ${info.chrome}`,
      `Node.js: ${info.node}`,
      `OS: ${info.platform} ${info.arch}`,
    ].join("\n"),
    buttons: ["OK"],
  });
}
