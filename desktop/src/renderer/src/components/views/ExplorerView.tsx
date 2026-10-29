import {
  ChevronDown,
  ChevronRight,
  ChevronsDownUp,
  FilePlus,
  FolderPlus,
  RefreshCw,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { DirEntry } from "@shared/ipc";
import type { GitChangeKind } from "@shared/git-status";
import { openFile } from "../../actions/editor";
import {
  cancelEdit,
  collapseAll,
  commitEdit,
  copyPath,
  deletePath,
  movePath,
  refreshExplorer,
  revealInOS,
  startCreate,
  startRename,
  toggleDir,
} from "../../actions/explorer";
import { createTerminal } from "../../actions/terminal";
import { openFolder, openRecent } from "../../actions/workspace";
import { api } from "../../lib/bridge";
import { getActiveEditor } from "../../monaco/editor-ref";
import * as paths from "../../lib/paths";
import { setState, useStore, type ExplorerEdit } from "../../state/store";
import { FileIcon, FolderIcon } from "../FileIcon";
import { openContextMenu } from "../Menu";

type Row =
  | { type: "entry"; entry: DirEntry; depth: number }
  | { type: "input"; depth: number; edit: ExplorerEdit; entry?: DirEntry };

const DRAG_TYPE = "application/x-codeforge-path";
const GIT_CLASS: Partial<Record<GitChangeKind, string>> = {
  modified: "git-modified",
  typechange: "git-modified",
  added: "git-added",
  renamed: "git-added",
  copied: "git-added",
  untracked: "git-untracked",
  deleted: "git-deleted",
  conflict: "git-conflict",
};

function InlineInput({ edit, initial }: { edit: ExplorerEdit; initial: string }) {
  const ref = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState(initial);
  const error = value.trim() ? paths.validateFileName(value) : null;

  useEffect(() => {
    const input = ref.current;
    if (!input) return;
    input.focus();
    // Select the name without its extension, like most file managers.
    const dot = initial.lastIndexOf(".");
    input.setSelectionRange(0, edit.mode === "rename" && dot > 0 ? dot : initial.length);
  }, [edit.mode, initial]);

  return (
    <input
      ref={ref}
      className={`text-input${error ? " invalid" : ""}`}
      value={value}
      title={error ?? undefined}
      aria-label={
        edit.mode === "rename"
          ? "New name"
          : edit.mode === "new-file"
            ? "New file name"
            : "New folder name"
      }
      spellCheck={false}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Enter" && !error) void commitEdit(value);
        if (e.key === "Escape") cancelEdit();
      }}
      onBlur={() =>
        value.trim() && !error && value !== initial ? void commitEdit(value) : cancelEdit()
      }
    />
  );
}

export function ExplorerView() {
  const workspace = useStore((s) => s.workspace);
  const recent = useStore((s) => s.recent);
  const dirChildren = useStore((s) => s.dirChildren);
  const expanded = useStore((s) => s.expanded);
  const selectedPath = useStore((s) => s.selectedPath);
  const edit = useStore((s) => s.explorerEdit);
  const git = useStore((s) => s.git);
  const [dropTarget, setDropTarget] = useState<string | null>(null);

  // Git decorations: colour changed files and the folders that contain them.
  const decorations = useMemo(() => {
    const files = new Map<string, string>();
    const folders = new Set<string>();
    if (!git?.isRepo || !workspace) return { files, folders };
    for (const change of [...git.staged, ...git.unstaged, ...git.conflicts]) {
      const key = change.absolutePath.toLowerCase();
      if (!files.has(key) || change.kind === "conflict")
        files.set(key, GIT_CLASS[change.kind] ?? "");
      let dir = paths.dirname(change.absolutePath);
      while (paths.isInsideOrEqual(workspace.root, dir) && !paths.samePath(dir, workspace.root)) {
        folders.add(dir.toLowerCase());
        dir = paths.dirname(dir);
      }
    }
    return { files, folders };
  }, [git, workspace]);

  const rows = useMemo(() => {
    const result: Row[] = [];
    if (!workspace) return result;
    const walk = (dir: string, depth: number) => {
      if (edit && edit.mode !== "rename" && paths.samePath(edit.parent, dir))
        result.push({ type: "input", depth, edit });
      for (const entry of dirChildren[dir] ?? []) {
        if (edit?.mode === "rename" && edit.target && paths.samePath(edit.target, entry.path)) {
          result.push({ type: "input", depth, edit, entry });
        } else {
          result.push({ type: "entry", entry, depth });
        }
        if (entry.kind === "directory" && expanded[entry.path]) walk(entry.path, depth + 1);
      }
    };
    walk(workspace.root, 0);
    return result;
  }, [workspace, dirChildren, expanded, edit]);

  if (!workspace) {
    return (
      <div className="empty-state">
        <p>You have not opened a folder yet.</p>
        <button className="btn block" onClick={() => void openFolder()}>
          Open Folder
        </button>
        {recent.length > 0 && (
          <>
            <p style={{ marginTop: 18 }}>Recent folders:</p>
            {recent.slice(0, 5).map((root) => (
              <div
                key={root}
                className="tree-row"
                style={{ paddingLeft: 4 }}
                title={root}
                onClick={() => void openRecent(root)}
              >
                <FolderIcon open={false} />
                <span className="name">{paths.basename(root)}</span>
              </div>
            ))}
          </>
        )}
      </div>
    );
  }

  const entryMenu = (event: React.MouseEvent, entry: DirEntry | null) => {
    const target = entry?.path ?? workspace.root;
    const isDir = !entry || entry.kind === "directory";
    const folder = isDir ? target : paths.dirname(target);
    setState({ selectedPath: target });
    openContextMenu(event, [
      { label: "New File…", run: () => void startCreate("new-file", folder) },
      { label: "New Folder…", run: () => void startCreate("new-folder", folder) },
      { separator: true },
      ...(entry?.kind === "file" && /\.html?$/i.test(entry.name)
        ? [
            { label: "Open Preview", run: () => void api.invoke("preview:open-file", entry.path) },
            { separator: true },
          ]
        : []),
      { label: "Open in Integrated Terminal", run: () => void createTerminal({ cwd: folder }) },
      {
        label: api.platform === "win32" ? "Reveal in File Explorer" : "Reveal in Finder",
        run: () => void revealInOS(target),
      },
      { separator: true },
      { label: "Copy Path", run: () => void copyPath(target, false) },
      { label: "Copy Relative Path", run: () => void copyPath(target, true) },
      ...(entry
        ? [
            { separator: true },
            { label: "Rename…", shortcut: "F2", run: () => startRename(entry.path) },
            {
              label: "Delete",
              shortcut: "Delete",
              danger: true,
              run: () => void deletePath(entry.path),
            },
          ]
        : []),
    ]);
  };

  const activate = (entry: DirEntry) => {
    setState({ selectedPath: entry.path });
    if (entry.kind === "directory") void toggleDir(entry.path);
    // Like VS Code: a single click keeps focus in the tree so arrow keys,
    // F2 and Delete keep working; double-click moves focus into the editor.
    else void openFile(entry.path, undefined, { preserveFocus: true });
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    const entries = rows.filter((r): r is Extract<Row, { type: "entry" }> => r.type === "entry");
    const index = entries.findIndex(
      (r) => selectedPath && paths.samePath(r.entry.path, selectedPath),
    );
    const current = entries[index]?.entry;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const next =
        entries[
          Math.max(0, Math.min(entries.length - 1, index + (event.key === "ArrowDown" ? 1 : -1)))
        ];
      if (next) setState({ selectedPath: next.entry.path });
    } else if (event.key === "Enter" && current) {
      activate(current);
    } else if (event.key === "ArrowRight" && current?.kind === "directory") {
      void toggleDir(current.path, true);
    } else if (event.key === "ArrowLeft" && current?.kind === "directory") {
      void toggleDir(current.path, false);
    } else if (event.key === "F2" && current) {
      startRename(current.path);
    } else if (event.key === "Delete" && current) {
      void deletePath(current.path);
    }
  };

  const dropProps = (folder: string) => ({
    onDragOver: (e: React.DragEvent) => {
      if (!e.dataTransfer.types.includes(DRAG_TYPE)) return;
      e.preventDefault();
      e.stopPropagation();
      setDropTarget(folder);
    },
    onDragLeave: () => setDropTarget((current) => (current === folder ? null : current)),
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDropTarget(null);
      const source = e.dataTransfer.getData(DRAG_TYPE);
      if (source) void movePath(source, folder);
    },
  });

  return (
    <>
      <div className="view-header">
        <span className="title">Explorer</span>
        <div className="actions">
          <button
            className="icon-button"
            title="New File"
            onClick={() => void startCreate("new-file")}
          >
            <FilePlus size={15} />
          </button>
          <button
            className="icon-button"
            title="New Folder"
            onClick={() => void startCreate("new-folder")}
          >
            <FolderPlus size={15} />
          </button>
          <button
            className="icon-button"
            title="Refresh Explorer"
            onClick={() => void refreshExplorer()}
          >
            <RefreshCw size={14} />
          </button>
          <button className="icon-button" title="Collapse Folders" onClick={collapseAll}>
            <ChevronsDownUp size={15} />
          </button>
        </div>
      </div>
      <div
        className="section-header"
        title={workspace.root}
        onContextMenu={(e) => entryMenu(e, null)}
        onClick={() => setState({ selectedPath: workspace.root })}
      >
        <ChevronDown size={14} />
        <span className="title">{workspace.name}</span>
      </div>
      <div
        className={`view-body${dropTarget === workspace.root ? " drop-target" : ""}`}
        role="tree"
        aria-label="Files"
        tabIndex={0}
        data-testid="explorer-tree"
        onKeyDown={onKeyDown}
        onContextMenu={(e) => entryMenu(e, null)}
        {...dropProps(workspace.root)}
      >
        {rows.map((row) => {
          const indent = 8 + row.depth * 14;
          if (row.type === "input") {
            const isFolder = row.edit.mode === "new-folder" || row.entry?.kind === "directory";
            return (
              <div
                key={`input-${row.entry?.path ?? row.edit.parent}`}
                className="tree-row"
                style={{ paddingLeft: indent }}
              >
                <span className="twistie" />
                {isFolder ? <FolderIcon open={false} /> : <FileIcon name={row.entry?.name ?? ""} />}
                <InlineInput edit={row.edit} initial={row.entry?.name ?? ""} />
              </div>
            );
          }
          const { entry } = row;
          const isDir = entry.kind === "directory";
          const isOpen = isDir && Boolean(expanded[entry.path]);
          const key = entry.path.toLowerCase();
          const gitClass = isDir
            ? decorations.folders.has(key)
              ? "git-modified"
              : ""
            : (decorations.files.get(key) ?? "");
          return (
            <div
              key={entry.path}
              role="treeitem"
              aria-expanded={isDir ? isOpen : undefined}
              aria-selected={selectedPath === entry.path}
              className={`tree-row${selectedPath === entry.path ? " selected" : ""}${dropTarget === entry.path ? " drop-target" : ""}`}
              style={{ paddingLeft: indent }}
              title={entry.path}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData(DRAG_TYPE, entry.path);
                e.dataTransfer.effectAllowed = "move";
              }}
              {...(isDir ? dropProps(entry.path) : {})}
              onClick={() => activate(entry)}
              onDoubleClick={() => entry.kind === "file" && getActiveEditor()?.focus()}
              onContextMenu={(e) => entryMenu(e, entry)}
            >
              <span className="twistie">
                {isDir ? isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} /> : null}
              </span>
              {isDir ? <FolderIcon open={isOpen} /> : <FileIcon name={entry.name} />}
              <span className={`name ${gitClass}${gitClass === "git-deleted" ? " strike" : ""}`}>
                {entry.name}
              </span>
            </div>
          );
        })}
        {dirChildren[workspace.root]?.length === 0 && !edit && (
          <div className="empty-state">
            <p>This folder is empty.</p>
            <button
              className="btn secondary"
              onClick={() => void startCreate("new-file", workspace.root)}
            >
              Create a file
            </button>
          </div>
        )}
      </div>
    </>
  );
}
