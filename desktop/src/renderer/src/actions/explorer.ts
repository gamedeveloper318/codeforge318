import { api } from "../lib/bridge";
import * as paths from "../lib/paths";
import { isDirty } from "../monaco/models";
import { getState, setState } from "../state/store";
import { closeTabsUnder, openFile, retargetTabs } from "./editor";
import { logOutput, reportError, toast } from "./notify";

export async function loadDir(dir: string): Promise<void> {
  try {
    const entries = await api.invoke("fs:read-dir", dir);
    setState({ dirChildren: { ...getState().dirChildren, [dir]: entries } });
  } catch (error) {
    // A folder that disappeared is simply dropped from the tree.
    const { [dir]: _gone, ...rest } = getState().dirChildren;
    setState({ dirChildren: rest });
    const root = getState().workspace?.root;
    if (root && paths.samePath(dir, root)) reportError("Could not read the folder", error);
  }
}

export async function toggleDir(dir: string, expand?: boolean): Promise<void> {
  const { expanded, dirChildren } = getState();
  const next = expand ?? !expanded[dir];
  setState({ expanded: { ...expanded, [dir]: next } });
  if (next && !dirChildren[dir]) await loadDir(dir);
}

export function collapseAll(): void {
  setState({ expanded: {} });
}

/** Reloads every loaded folder that contains one of the changed paths. */
export async function refreshForChanges(changed: string[]): Promise<void> {
  const { dirChildren, workspace } = getState();
  if (!workspace) return;
  const loaded = Object.keys(dirChildren);
  const everything = changed.some((p) => paths.samePath(p, workspace.root));
  const targets = everything
    ? loaded
    : loaded.filter((dir) =>
        changed.some((p) => paths.samePath(paths.dirname(p), dir) || paths.samePath(p, dir)),
      );
  await Promise.all(targets.map((dir) => loadDir(dir)));
}

export async function refreshExplorer(): Promise<void> {
  await Promise.all(Object.keys(getState().dirChildren).map((dir) => loadDir(dir)));
}

/** The folder new files go into: the selected folder, or the selected file's folder. */
function targetFolder(): string | null {
  const { selectedPath, workspace, dirChildren } = getState();
  if (!workspace) return null;
  if (!selectedPath) return workspace.root;
  const parent = paths.dirname(selectedPath);
  const isDir =
    dirChildren[parent]?.find((e) => paths.samePath(e.path, selectedPath))?.kind === "directory";
  return isDir || paths.samePath(selectedPath, workspace.root) ? selectedPath : parent;
}

export async function startCreate(mode: "new-file" | "new-folder", parent?: string): Promise<void> {
  const folder = parent ?? targetFolder();
  if (!folder) {
    toast("info", "Open a folder first", "Files are created inside the open folder.");
    return;
  }
  setState({ sidebarVisible: true, sidebarView: "explorer" });
  const root = getState().workspace!.root;
  if (!paths.samePath(folder, root)) await toggleDir(folder, true);
  setState({ explorerEdit: { mode, parent: folder } });
}

export function startRename(target: string): void {
  setState({
    explorerEdit: { mode: "rename", parent: paths.dirname(target), target },
    selectedPath: target,
  });
}

export function cancelEdit(): void {
  setState({ explorerEdit: null });
}

export async function commitEdit(name: string): Promise<void> {
  const edit = getState().explorerEdit;
  if (!edit) return;
  const error = paths.validateFileName(name);
  if (error) {
    toast("error", error);
    return;
  }
  setState({ explorerEdit: null });
  const target = paths.join(edit.parent, name.trim());
  try {
    if (edit.mode === "rename" && edit.target) {
      if (target === edit.target) return;
      await api.invoke("fs:rename", edit.target, target);
      retargetTabs(edit.target, target);
      logOutput(`Renamed ${edit.target} -> ${target}`);
    } else if (edit.mode === "new-file") {
      await api.invoke("fs:create-file", target);
      logOutput(`Created ${target}`);
    } else {
      await api.invoke("fs:create-dir", target);
      logOutput(`Created folder ${target}`);
    }
    // Nested names ("src/a.ts") create intermediate folders: reload and expand them.
    await loadDir(edit.parent);
    let folder = edit.mode === "new-folder" ? target : paths.dirname(target);
    const chain: string[] = [];
    while (!paths.samePath(folder, edit.parent) && paths.isInsideOrEqual(edit.parent, folder)) {
      chain.unshift(folder);
      folder = paths.dirname(folder);
    }
    for (const dir of chain.slice(0, edit.mode === "new-folder" ? -1 : undefined))
      await toggleDir(dir, true);
    setState({ selectedPath: target });
    if (edit.mode === "new-file") await openFile(target);
  } catch (err) {
    reportError(edit.mode === "rename" ? "Rename failed" : "Could not create it", err);
  }
}

export async function deletePath(target: string): Promise<void> {
  const name = paths.basename(target);
  const hasDirtyOpenFiles = getState().tabs.some(
    (t) => t.kind === "file" && t.path && paths.isInsideOrEqual(target, t.path) && isDirty(t.id),
  );
  const choice = await api.invoke("app:confirm", {
    type: "warning",
    message: `Are you sure you want to delete "${name}"?`,
    detail: `It will be moved to the ${api.platform === "win32" ? "Recycle Bin" : "Trash"}, so you can restore it later.${
      hasDirtyOpenFiles ? "\n\nUnsaved changes in open files inside it will be lost." : ""
    }`,
    buttons: ["Move to Trash", "Cancel"],
    defaultId: 0,
    cancelId: 1,
  });
  if (choice !== 0) return;
  try {
    await api.invoke("fs:trash", target);
    closeTabsUnder(target);
    logOutput(`Moved to trash: ${target}`);
    await loadDir(paths.dirname(target));
    if (getState().selectedPath && paths.samePath(getState().selectedPath!, target))
      setState({ selectedPath: null });
  } catch (error) {
    reportError(`Could not delete ${name}`, error);
  }
}

/** Drag-and-drop move into another folder. */
export async function movePath(source: string, folder: string): Promise<void> {
  if (paths.samePath(paths.dirname(source), folder) || paths.isInsideOrEqual(source, folder))
    return;
  const target = paths.join(folder, paths.basename(source));
  try {
    await api.invoke("fs:rename", source, target);
    retargetTabs(source, target);
    logOutput(`Moved ${source} -> ${target}`);
    await Promise.all([loadDir(paths.dirname(source)), loadDir(folder)]);
    await toggleDir(folder, true);
    setState({ selectedPath: target });
  } catch (error) {
    reportError(`Could not move ${paths.basename(source)}`, error);
  }
}

export async function copyPath(target: string, relativeToRoot: boolean): Promise<void> {
  const root = getState().workspace?.root;
  const text = relativeToRoot && root ? paths.relative(root, target) : target;
  await navigator.clipboard.writeText(text);
  toast("info", "Path copied", text);
}

export async function revealInOS(target: string): Promise<void> {
  await api
    .invoke("app:reveal", target)
    .catch((error) => reportError("Could not reveal the file", error));
}
