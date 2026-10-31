import type { WorkspaceInfo } from "@shared/ipc";
import type { Settings } from "@shared/settings";
import { api } from "../lib/bridge";
import { monaco } from "../monaco/setup";
import { getState, setState } from "../state/store";
import { applyXtermSettings } from "../terminal/xterm-manager";
import { confirmUnsavedChanges, openFile, reloadChangedFiles, resetTabs } from "./editor";
import { loadDir, refreshForChanges } from "./explorer";
import { refreshGit } from "./git";
import { logOutput, reportError } from "./notify";
import { handleTerminalData, handleTerminalExit } from "./terminal";
import { handleUpdateStatus } from "./update";
import { setupPythonLanguageServer } from "../lsp/python";
import { startCustomDiagnostics } from "../diagnostics/custom-diagnostics";
import { registerLanguageCompletions } from "../monaco/language-completions";
import {
  loadProjectSources,
  refreshProjectSources,
  watchEditorModels,
} from "../monaco/project-intellisense";
import { registerSemanticHighlighting } from "../monaco/semantic-highlighting";

export function applySettings(settings: Settings): void {
  const light = settings["workbench.colorTheme"] === "codeforge-light";
  document.documentElement.dataset.theme = light ? "light" : "dark";
  monaco.editor.setTheme(light ? "codeforge-light" : "codeforge-dark");
  applyXtermSettings(settings);
  setState({ settings });
}

async function enterWorkspace(info: WorkspaceInfo | null): Promise<void> {
  resetTabs();
  setState({
    workspace: info,
    dirChildren: {},
    expanded: {},
    selectedPath: null,
    explorerEdit: null,
    git: null,
    commits: [],
    search: { ...getState().search, response: null, error: null },
  });
  document.title = info ? `${info.name} — CodeForge` : "CodeForge";
  if (info) {
    logOutput(`Opened folder ${info.root}`);
    await loadDir(info.root);
  }
  // In the background: lets JavaScript/TypeScript IntelliSense see every project file.
  void loadProjectSources();
  void refreshGit();
  setState({ recent: await api.invoke("workspace:recent").catch(() => getState().recent) });
}

export async function openFolder(): Promise<void> {
  if (!(await confirmUnsavedChanges())) return;
  try {
    const info = await api.invoke("workspace:open-dialog");
    if (info) await enterWorkspace(info);
  } catch (error) {
    reportError("Could not open the folder", error);
  }
}

export async function openRecent(root: string): Promise<void> {
  if (!(await confirmUnsavedChanges())) return;
  try {
    await enterWorkspace(await api.invoke("workspace:open-recent", root));
  } catch (error) {
    reportError("Could not open the folder", error);
    setState({ recent: await api.invoke("workspace:recent").catch(() => getState().recent) });
  }
}

export async function removeRecent(root: string): Promise<void> {
  setState({ recent: await api.invoke("workspace:remove-recent", root) });
}

export async function closeFolder(): Promise<void> {
  if (!getState().workspace || !(await confirmUnsavedChanges())) return;
  await api.invoke("workspace:close");
  await enterWorkspace(null);
}

export async function openFiles(): Promise<void> {
  const files = await api.invoke("dialog:open-files").catch((error) => {
    reportError("Could not open files", error);
    return [] as string[];
  });
  for (const file of files) await openFile(file);
}

/** File > Exit. Closing goes through the same unsaved-changes check as the close button. */
export async function quitApp(): Promise<void> {
  await api.invoke("app:quit").catch((error) => reportError("Could not exit", error));
}

/** Loads state from the main process and subscribes to its events. Runs once. */
export async function initialize(): Promise<void> {
  const [appInfo, settings, workspace, updateStatus] = await Promise.all([
    api.invoke("app:info"),
    api.invoke("settings:get"),
    api.invoke("workspace:current"),
    api.invoke("update:status"),
  ]);
  applySettings(settings);
  setState({ appInfo, updateStatus });
  setupPythonLanguageServer();
  startCustomDiagnostics();
  registerSemanticHighlighting();
  registerLanguageCompletions();
  watchEditorModels();

  api.on("settings:changed", applySettings);
  api.on("fs:changed", ({ paths }) => {
    void refreshForChanges(paths);
    void reloadChangedFiles(paths);
    void refreshProjectSources(paths);
  });
  api.on("git:changed", () => void refreshGit());
  api.on("terminal:data", ({ id, data }) => handleTerminalData(id, data));
  api.on("terminal:exit", ({ id, exitCode }) => handleTerminalExit(id, exitCode));
  api.on("update:status", handleUpdateStatus);
  api.on("window:close-requested", () => {
    void confirmUnsavedChanges().then((ok) => {
      if (ok) void api.invoke("window:confirm-close");
    });
  });

  await enterWorkspace(workspace);
  setState({ ready: true });
}
