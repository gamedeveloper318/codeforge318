import { runCommandForPath } from "@shared/languages";
import type { Settings } from "@shared/settings";
import { api, errorMessage } from "../lib/bridge";
import * as paths from "../lib/paths";
import { isDirty } from "../monaco/models";
import { getState, setState } from "../state/store";
import { saveTab } from "./editor";
import { reportError, toast } from "./notify";
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
    const response = await api.invoke("search:find", {
      pattern: search.pattern,
      isRegex: search.isRegex,
      caseSensitive: search.caseSensitive,
      wholeWord: search.wholeWord,
      include: search.include,
      exclude: search.exclude,
    });
    if (response.cancelled) return;
    setState({ search: { ...getState().search, running: false, response } });
  } catch (error) {
    setState({
      search: { ...getState().search, running: false, response: null, error: errorMessage(error) },
    });
  }
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
