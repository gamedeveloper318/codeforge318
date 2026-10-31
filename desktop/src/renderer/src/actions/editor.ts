import { AutoSaveScheduler, type AutoSaveResult } from "@shared/autosave";
import { api, errorMessage } from "../lib/bridge";
import * as paths from "../lib/paths";
import { getActiveEditor } from "../monaco/editor-ref";
import {
  allEntries,
  createFileModel,
  createUntitledModel,
  disposeEntry,
  getEntry,
  isDirty,
  markSaved,
  onModelContentChange,
  rekeyEntry,
  reloadContent,
} from "../monaco/models";
import { getState, setState, useStore, type Tab, type WorkbenchState } from "../state/store";
import { logOutput, reportError, toast } from "./notify";

type FileTab = Extract<Tab, { kind: "file" }>;

export interface PendingReveal {
  line: number;
  column: number;
  endLine?: number;
  endColumn?: number;
}
const pendingReveals = new Map<string, PendingReveal>();
const preserveFocus = new Set<string>();
/** Why the last save of a file failed (shown in the status bar tooltip). */
const saveErrors = new Map<string, string>();

function fileTab(tabId: string): FileTab | undefined {
  const tab = getState().tabs.find((t) => t.id === tabId);
  return tab?.kind === "file" ? tab : undefined;
}

function setSaveState(tabId: string, value: WorkbenchState["saveState"][string] | null): void {
  const { saveState } = getState();
  if (saveState[tabId] === value) return;
  const { [tabId]: _old, ...rest } = saveState;
  setState({ saveState: value ? { ...rest, [tabId]: value } : rest });
}

export function lastSaveError(tabId: string): string | undefined {
  return saveErrors.get(tabId);
}

const autoSave = new AutoSaveScheduler({
  enabled: () => getState().settings["files.autoSave"] === "afterDelay",
  delay: () => getState().settings["files.autoSaveDelay"],
  canAutoSave: (tabId) => Boolean(fileTab(tabId)?.path),
  isDirty,
  version: (tabId) => getEntry(tabId)?.model.getAlternativeVersionId() ?? -1,
  save: autoSaveTab,
  failed: (tabId, result) => {
    const tab = fileTab(tabId);
    if (!tab) return;
    toast(
      "error",
      `Auto Save couldn't save ${tab.title}`,
      result === "conflict"
        ? `${tab.title} was changed by another program after you opened it, so it wasn't overwritten. Your changes are still in the editor: press Ctrl+S to overwrite the file with them.`
        : `${saveErrors.get(tabId) ?? "The file could not be written."} Your changes are still in the editor; Auto Save tries again after your next edit.`,
      [{ label: "Retry", run: () => void saveTab(tabId) }],
    );
  },
  setTimer: (callback, ms) => window.setTimeout(callback, ms),
  clearTimer: (handle) => window.clearTimeout(handle as number),
});

/**
 * Writes a file for Auto Save. Unlike a manual save it never asks anything:
 * no formatting (it would move the cursor while typing) and no overwrite
 * prompt when the file changed on disk (that is reported as a conflict).
 */
async function autoSaveTab(tabId: string): Promise<AutoSaveResult> {
  const tab = fileTab(tabId);
  const entry = getEntry(tabId);
  if (!tab?.path || !entry) return "skipped";
  const version = entry.model.getAlternativeVersionId();
  const text = entry.model.getValue();
  setSaveState(tabId, "saving");
  try {
    if (entry.mtimeMs) {
      const onDisk = await api.invoke("fs:stat", tab.path).catch(() => null);
      if (onDisk && onDisk.mtimeMs > entry.mtimeMs + 1) {
        saveErrors.set(tabId, "The file was changed on disk by another program.");
        setSaveState(tabId, "failed");
        return "conflict";
      }
    }
    const result = await api.invoke("fs:write-file", tab.path, text, entry.bom);
    // The tab may have been closed or renamed while the file was being written.
    if (getEntry(tabId) !== entry || entry.model.isDisposed()) return "saved";
    markSaved(tabId, result, version);
    saveErrors.delete(tabId);
    setDirtyFlag(tabId, isDirty(tabId));
    setSaveState(tabId, "saved");
    return "saved";
  } catch (error) {
    saveErrors.set(tabId, errorMessage(error));
    if (getEntry(tabId) === entry) setSaveState(tabId, "failed");
    logOutput(`Auto Save failed for ${tab.path}: ${errorMessage(error)}`, "error");
    return "failed";
  }
}

/** Saves every file Auto Save is waiting for (before closing a tab or the window). */
async function flushAutoSave(tabIds: string[]): Promise<void> {
  if (getState().settings["files.autoSave"] !== "afterDelay") return;
  for (const tabId of tabIds) {
    autoSave.cancel(tabId);
    await autoSave.flush(tabId);
  }
}

// Turning Auto Save on saves files that already have changes; turning it off stops pending saves.
useStore.subscribe((state, previous) => {
  const on = state.settings["files.autoSave"] === "afterDelay";
  if (on === (previous.settings["files.autoSave"] === "afterDelay")) return;
  if (!on) autoSave.cancelAll();
  else for (const tab of state.tabs) if (isDirty(tab.id)) autoSave.changed(tab.id);
});

/** Called by the editor component after it switches to a tab's model. */
export function takePendingReveal(tabId: string): PendingReveal | undefined {
  const reveal = pendingReveals.get(tabId);
  pendingReveals.delete(tabId);
  return reveal;
}

/** True when the tab was opened without moving keyboard focus (explorer single-click). */
export function takePreserveFocus(tabId: string): boolean {
  return preserveFocus.delete(tabId);
}

export function findFileTab(path: string): FileTab | undefined {
  return getState().tabs.find(
    (t): t is FileTab => t.kind === "file" && !!t.path && paths.samePath(t.path, path),
  );
}

function insertTab(tab: Tab): void {
  const { tabs, activeTabId } = getState();
  const index = tabs.findIndex((t) => t.id === activeTabId);
  const next = [...tabs];
  next.splice(index === -1 ? next.length : index + 1, 0, tab);
  setState({ tabs: next, activeTabId: tab.id });
}

export function activateTab(id: string): void {
  setState({ activeTabId: id });
}

export function cycleTab(direction: 1 | -1): void {
  const { tabs, activeTabId } = getState();
  if (tabs.length < 2) return;
  const index = tabs.findIndex((t) => t.id === activeTabId);
  setState({ activeTabId: tabs[(index + direction + tabs.length) % tabs.length].id });
}

function reveal(tabId: string, target: PendingReveal): void {
  const editor = getActiveEditor();
  const entry = getEntry(tabId);
  if (editor && entry && editor.getModel() === entry.model) {
    editor.setSelection({
      startLineNumber: target.line,
      startColumn: target.column,
      endLineNumber: target.endLine ?? target.line,
      endColumn: target.endColumn ?? target.column,
    });
    editor.revealLineInCenterIfOutsideViewport(target.line);
    editor.focus();
  } else {
    pendingReveals.set(tabId, target);
  }
}

export async function openFile(
  path: string,
  position?: PendingReveal,
  options: { preserveFocus?: boolean } = {},
): Promise<void> {
  const existing = findFileTab(path);
  if (existing) {
    if (options.preserveFocus && getState().activeTabId !== existing.id)
      preserveFocus.add(existing.id);
    setState({ activeTabId: existing.id });
    if (position) reveal(existing.id, position);
    return;
  }
  try {
    const file = await api.invoke("fs:read-file", path);
    if (file.binary) {
      toast(
        "info",
        `"${paths.basename(path)}" is a binary file`,
        "Binary files can't be opened in the text editor.",
      );
      return;
    }
    // The file may have been opened by another click while we were reading it.
    const raced = findFileTab(path);
    if (raced) {
      setState({ activeTabId: raced.id });
      return;
    }
    createFileModel(file.path, file.path, file.content, { bom: file.bom, mtimeMs: file.mtimeMs });
    if (position) pendingReveals.set(file.path, position);
    if (options.preserveFocus) preserveFocus.add(file.path);
    insertTab({ kind: "file", id: file.path, path: file.path, title: paths.basename(file.path) });
  } catch (error) {
    reportError(`Could not open ${paths.basename(path)}`, error);
  }
}

export function newUntitledFile(): void {
  const { tabId, title } = createUntitledModel();
  insertTab({ kind: "file", id: tabId, path: null, title });
}

export function openSettingsTab(): void {
  if (getState().tabs.some((t) => t.id === "settings")) setState({ activeTabId: "settings" });
  else insertTab({ kind: "settings", id: "settings", title: "Settings" });
}

/** Help > Keyboard Shortcuts: every command with its shortcut, searchable. */
export function openShortcutsTab(): void {
  if (getState().tabs.some((t) => t.id === "shortcuts")) setState({ activeTabId: "shortcuts" });
  else insertTab({ kind: "shortcuts", id: "shortcuts", title: "Keyboard Shortcuts" });
}

export function openDiff(path: string, staged: boolean): void {
  const id = `diff:${staged ? "index" : "working"}:${path}`;
  if (getState().tabs.some((t) => t.id === id)) {
    setState({ activeTabId: id });
    return;
  }
  const title = `${paths.basename(path)} (${staged ? "Staged" : "Working Tree"})`;
  insertTab({ kind: "diff", id, path, staged, title });
}

function setDirtyFlag(tabId: string, value: boolean): void {
  const { dirty } = getState();
  if (Boolean(dirty[tabId]) === value) return;
  setState({ dirty: { ...dirty, [tabId]: value } });
}

onModelContentChange((tabId) => {
  setDirtyFlag(tabId, isDirty(tabId));
  autoSave.changed(tabId);
});

/** Saves a file tab. Returns the tab's (possibly new) id, or null if not saved. */
export async function saveTab(tabId: string, saveAs = false): Promise<string | null> {
  const tab = getState().tabs.find((t) => t.id === tabId);
  const entry = getEntry(tabId);
  if (!tab || tab.kind !== "file" || !entry) return null;

  let target = tab.path;
  if (!target || saveAs) {
    target = await api.invoke(
      "dialog:save-as",
      tab.path ? paths.basename(tab.path) : `${tab.title}.txt`,
    );
    if (!target) return null;
  }

  const editor = getActiveEditor();
  if (getState().settings["editor.formatOnSave"] && editor?.getModel() === entry.model) {
    await editor
      .getAction("editor.action.formatDocument")
      ?.run()
      .catch(() => undefined);
  }

  autoSave.cancel(tabId);
  try {
    if (tab.path && paths.samePath(target, tab.path) && entry.mtimeMs) {
      // Don't silently overwrite edits made outside CodeForge.
      const onDisk = await api.invoke("fs:stat", target).catch(() => null);
      if (onDisk && onDisk.mtimeMs > entry.mtimeMs + 1) {
        const choice = await api.invoke("app:confirm", {
          type: "warning",
          message: `"${tab.title}" was changed on disk after you opened it.`,
          detail: "Saving will overwrite the version on disk with your changes.",
          buttons: ["Overwrite", "Cancel"],
          defaultId: 1,
          cancelId: 1,
        });
        if (choice !== 0) return null;
      }
    }

    setSaveState(tabId, "saving");
    const version = entry.model.getAlternativeVersionId();
    const result = await api.invoke("fs:write-file", target, entry.model.getValue(), entry.bom);
    logOutput(`Saved ${target}`);
    saveErrors.delete(tabId);
    autoSave.savedManually(tabId);

    if (tab.path && paths.samePath(target, tab.path)) {
      markSaved(tabId, result, version);
      setDirtyFlag(tabId, isDirty(tabId));
      setSaveState(tabId, "saved");
      return tabId;
    }

    // Untitled -> file, or Save As to a different path: the tab moves to the new path.
    const other = findFileTab(target);
    if (other && other.id !== tabId) forceRemoveTab(other.id);
    autoSave.forget(tabId);
    setSaveState(tabId, null);
    rekeyEntry(tabId, target, target, false);
    markSaved(target, result);
    const { tabs, activeTabId, dirty } = getState();
    const { [tabId]: _removed, ...restDirty } = dirty;
    setState({
      tabs: tabs.map((t) =>
        t.id === tabId
          ? { kind: "file", id: target, path: target, title: paths.basename(target) }
          : t,
      ),
      activeTabId: activeTabId === tabId ? target : activeTabId,
      dirty: { ...restDirty, [target]: false },
    });
    setSaveState(target, "saved");
    return target;
  } catch (error) {
    saveErrors.set(tabId, errorMessage(error));
    setSaveState(tabId, "failed");
    reportError(`Could not save ${tab.title}`, error);
    return null;
  }
}

export async function saveActive(saveAs = false): Promise<void> {
  const { activeTabId, tabs } = getState();
  const tab = tabs.find((t) => t.id === activeTabId);
  if (tab?.kind !== "file") {
    toast(
      "info",
      saveAs ? "Save As needs an open file" : "There is no open file to save",
      "Open or create a file in the editor first.",
    );
    return;
  }
  await saveTab(tab.id, saveAs);
}

export async function saveAll(): Promise<boolean> {
  for (const tab of getState().tabs) {
    if (tab.kind === "file" && isDirty(tab.id) && !(await saveTab(tab.id))) return false;
  }
  return true;
}

function forceRemoveTab(tabId: string): void {
  const { tabs, activeTabId, dirty } = getState();
  const index = tabs.findIndex((t) => t.id === tabId);
  if (index === -1) return;
  const tab = tabs[index];
  const next = tabs.filter((t) => t.id !== tabId);
  const active =
    activeTabId === tabId ? (next[Math.min(index, next.length - 1)]?.id ?? null) : activeTabId;
  if (tab.kind === "file") disposeEntry(tabId);
  autoSave.forget(tabId);
  saveErrors.delete(tabId);
  const { [tabId]: _removed, ...restDirty } = dirty;
  const { [tabId]: _state, ...restSaveState } = getState().saveState;
  setState({ tabs: next, activeTabId: active, dirty: restDirty, saveState: restSaveState });
}

/**
 * Closes a tab. With Auto Save on, its changes are saved first (like VS Code);
 * otherwise, or if that fails, it asks. Returns false if cancelled.
 */
export async function closeTab(tabId: string): Promise<boolean> {
  const tab = getState().tabs.find((t) => t.id === tabId);
  if (!tab) return true;
  let currentId = tabId;
  if (tab.kind === "file" && isDirty(tabId)) await flushAutoSave([tabId]);
  if (tab.kind === "file" && isDirty(tabId)) {
    const choice = await api.invoke("app:confirm", {
      type: "warning",
      message: `Do you want to save the changes you made to ${tab.title}?`,
      detail: "Your changes will be lost if you don't save them.",
      buttons: ["Save", "Don't Save", "Cancel"],
      defaultId: 0,
      cancelId: 2,
    });
    if (choice === 2) return false;
    if (choice === 0) {
      const saved = await saveTab(tabId);
      if (!saved) return false;
      currentId = saved;
    }
  }
  forceRemoveTab(currentId);
  return true;
}

export async function closeActiveTab(): Promise<void> {
  const { activeTabId } = getState();
  if (activeTabId) await closeTab(activeTabId);
}

export async function closeTabs(filter: (tab: Tab) => boolean): Promise<void> {
  for (const tab of getState().tabs.filter(filter)) {
    if (!(await closeTab(tab.id))) return;
  }
}

/**
 * Before closing the window or switching folders: offers to save every dirty
 * file. Returns false when the user cancels.
 */
export async function confirmUnsavedChanges(): Promise<boolean> {
  // With Auto Save on, files waiting for their save are saved now instead of asking.
  await flushAutoSave(
    getState()
      .tabs.filter((t) => isDirty(t.id))
      .map((t) => t.id),
  );
  const dirtyTabs = getState().tabs.filter((t) => t.kind === "file" && isDirty(t.id));
  if (!dirtyTabs.length) return true;
  const list = dirtyTabs
    .slice(0, 10)
    .map((t) => `  ${t.title}`)
    .join("\n");
  const choice = await api.invoke("app:confirm", {
    type: "warning",
    message:
      dirtyTabs.length === 1
        ? `Do you want to save the changes you made to ${dirtyTabs[0].title}?`
        : `Do you want to save the changes to the following ${dirtyTabs.length} files?`,
    detail: `${dirtyTabs.length > 1 ? `${list}\n\n` : ""}Your changes will be lost if you don't save them.`,
    buttons: ["Save All", "Don't Save", "Cancel"],
    defaultId: 0,
    cancelId: 2,
  });
  if (choice === 2) return false;
  if (choice === 0) return saveAll();
  return true;
}

/** Closes every tab without prompting (after confirmUnsavedChanges). */
export function resetTabs(): void {
  for (const [tabId] of allEntries()) {
    autoSave.forget(tabId);
    disposeEntry(tabId);
  }
  saveErrors.clear();
  setState({ tabs: [], activeTabId: null, dirty: {}, saveState: {}, editorStatus: null });
}

/** Keeps open tabs pointing at the right file after a rename or move. */
export function retargetTabs(oldPath: string, newPath: string): void {
  const { tabs, activeTabId, dirty } = getState();
  let nextActive = activeTabId;
  const nextDirty = { ...dirty };
  const nextTabs: Tab[] = [];
  for (const tab of tabs) {
    if (tab.kind === "diff" && paths.isInsideOrEqual(oldPath, tab.path)) {
      if (nextActive === tab.id) nextActive = null;
      continue;
    }
    if (tab.kind !== "file" || !tab.path || !paths.isInsideOrEqual(oldPath, tab.path)) {
      nextTabs.push(tab);
      continue;
    }
    const movedPath = newPath + tab.path.slice(oldPath.length);
    autoSave.forget(tab.id);
    rekeyEntry(tab.id, movedPath, movedPath, true);
    nextDirty[movedPath] = isDirty(movedPath);
    delete nextDirty[tab.id];
    if (nextActive === tab.id) nextActive = movedPath;
    nextTabs.push({
      kind: "file",
      id: movedPath,
      path: movedPath,
      title: paths.basename(movedPath),
    });
  }
  setState({
    tabs: nextTabs,
    activeTabId: nextActive ?? nextTabs[0]?.id ?? null,
    dirty: nextDirty,
  });
  // Unsaved changes of moved files are auto saved at their new path.
  for (const tab of nextTabs) if (nextDirty[tab.id]) autoSave.changed(tab.id);
}

/** Closes tabs for files that were deleted (inside `deletedPath`). */
export function closeTabsUnder(deletedPath: string): void {
  for (const tab of getState().tabs) {
    if (
      (tab.kind === "file" && tab.path && paths.isInsideOrEqual(deletedPath, tab.path)) ||
      (tab.kind === "diff" && paths.isInsideOrEqual(deletedPath, tab.path))
    ) {
      forceRemoveTab(tab.id);
    }
  }
}

/** Reloads clean open files that changed on disk (e.g. after `git checkout`). */
export async function reloadChangedFiles(changed: string[]): Promise<void> {
  const root = getState().workspace?.root;
  const everything = changed.some((p) => root && paths.samePath(p, root));
  for (const tab of getState().tabs) {
    if (tab.kind !== "file" || !tab.path || isDirty(tab.id)) continue;
    const affected = everything || changed.some((p) => paths.samePath(p, tab.path!));
    if (!affected) continue;
    const entry = getEntry(tab.id);
    const onDisk = await api.invoke("fs:stat", tab.path).catch(() => null);
    if (!entry || !onDisk || onDisk.kind !== "file" || Math.abs(onDisk.mtimeMs - entry.mtimeMs) < 1)
      continue;
    try {
      const file = await api.invoke("fs:read-file", tab.path);
      if (!file.binary && !isDirty(tab.id)) reloadContent(tab.id, file.content, file.mtimeMs);
    } catch {
      // the file may be mid-write; the next change event will retry
    }
  }
}
