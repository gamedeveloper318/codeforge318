import { api } from "../lib/bridge";
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
import { getState, setState, type Tab } from "../state/store";
import { logOutput, reportError, toast } from "./notify";

type FileTab = Extract<Tab, { kind: "file" }>;

interface PendingReveal {
  line: number;
  column: number;
  endColumn?: number;
}
const pendingReveals = new Map<string, PendingReveal>();
const preserveFocus = new Set<string>();
const autoSaveTimers = new Map<string, number>();

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
    const endColumn = target.endColumn ?? target.column;
    editor.setSelection({
      startLineNumber: target.line,
      startColumn: target.column,
      endLineNumber: target.line,
      endColumn,
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
  const { settings, tabs } = getState();
  const tab = tabs.find((t) => t.id === tabId);
  if (settings["files.autoSave"] !== "afterDelay" || tab?.kind !== "file" || !tab.path) return;
  window.clearTimeout(autoSaveTimers.get(tabId));
  autoSaveTimers.set(
    tabId,
    window.setTimeout(() => {
      autoSaveTimers.delete(tabId);
      if (isDirty(tabId)) void saveTab(tabId);
    }, settings["files.autoSaveDelay"]),
  );
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

    const result = await api.invoke("fs:write-file", target, entry.model.getValue(), entry.bom);
    logOutput(`Saved ${target}`);

    if (tab.path && paths.samePath(target, tab.path)) {
      markSaved(tabId, result);
      setDirtyFlag(tabId, false);
      return tabId;
    }

    // Untitled -> file, or Save As to a different path: the tab moves to the new path.
    const other = findFileTab(target);
    if (other && other.id !== tabId) forceRemoveTab(other.id);
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
    return target;
  } catch (error) {
    reportError(`Could not save ${tab.title}`, error);
    return null;
  }
}

export async function saveActive(saveAs = false): Promise<void> {
  const { activeTabId } = getState();
  if (activeTabId) await saveTab(activeTabId, saveAs);
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
  window.clearTimeout(autoSaveTimers.get(tabId));
  const { [tabId]: _removed, ...restDirty } = dirty;
  setState({ tabs: next, activeTabId: active, dirty: restDirty });
}

/** Closes a tab, asking to save unsaved changes first. Returns false if cancelled. */
export async function closeTab(tabId: string): Promise<boolean> {
  const tab = getState().tabs.find((t) => t.id === tabId);
  if (!tab) return true;
  let currentId = tabId;
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
  for (const [tabId] of allEntries()) disposeEntry(tabId);
  setState({ tabs: [], activeTabId: null, dirty: {}, editorStatus: null });
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
