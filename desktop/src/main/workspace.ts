import { watch, type FSWatcher } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import type { WorkspaceInfo } from "@shared/ipc";
import { assertAbsolutePath, isInside, realpathOfExisting, samePath } from "./path-guard";

export interface WorkspaceEvents {
  onFilesChanged(paths: string[]): void;
  onGitChanged(): void;
}

const MAX_CHANGED_PATHS = 500;
const pathKey = (p: string) => (process.platform === "win32" ? p.toLowerCase() : p);

/**
 * The folder the user opened. Every filesystem request from the renderer is
 * checked against it: the main process refuses paths outside the folder
 * (including via symlinks), except individual files the user picked in a
 * native Open/Save dialog.
 */
export class Workspace {
  private rootPath: string | null = null;
  private rootReal: string | null = null;
  private readonly allowedFiles = new Set<string>();
  private watcher: FSWatcher | null = null;
  private readonly pendingPaths = new Set<string>();
  private gitPending = false;
  private flushTimer: NodeJS.Timeout | null = null;

  constructor(private readonly events: WorkspaceEvents) {}

  get root(): string | null {
    return this.rootPath;
  }

  get info(): WorkspaceInfo | null {
    if (!this.rootPath) return null;
    return { root: this.rootPath, name: path.basename(this.rootPath) || this.rootPath };
  }

  async open(root: string): Promise<WorkspaceInfo> {
    const resolved = assertAbsolutePath(root);
    const stats = await stat(resolved).catch(() => null);
    if (!stats?.isDirectory()) throw new Error(`Folder not found: ${resolved}`);
    this.close();
    this.rootPath = resolved;
    this.rootReal = await realpathOfExisting(resolved);
    this.startWatching();
    return this.info!;
  }

  close(): void {
    this.stopWatching();
    this.rootPath = null;
    this.rootReal = null;
  }

  /** Grants access to a single file the user chose in a native dialog. */
  allowFile(file: string): void {
    this.allowedFiles.add(pathKey(path.resolve(file)));
  }

  /**
   * Validates a renderer-supplied path and returns it normalized.
   * Throws when it is outside the open folder.
   */
  async resolve(target: string, options: { forbidRoot?: boolean } = {}): Promise<string> {
    const absolute = assertAbsolutePath(target);
    if (this.allowedFiles.has(pathKey(absolute))) return absolute;
    if (!this.rootPath || !this.rootReal) throw new Error("Open a folder first.");
    if (!isInside(this.rootPath, absolute)) {
      throw new Error("Access denied: that path is outside the open folder.");
    }
    if (options.forbidRoot && samePath(this.rootPath, absolute)) {
      throw new Error("This action cannot be applied to the workspace folder itself.");
    }
    const real = await realpathOfExisting(absolute);
    if (!isInside(this.rootReal, real)) {
      throw new Error("Access denied: that path links outside the open folder.");
    }
    return absolute;
  }

  private startWatching(): void {
    const root = this.rootPath;
    if (!root) return;
    try {
      this.watcher = watch(root, { recursive: true }, (_event, filename) => {
        const relative = filename ? filename.toString() : "";
        const normalized = relative.replace(/\\/g, "/");
        if (normalized === ".git" || normalized.startsWith(".git/")) {
          // Git's own bookkeeping: only refs/index/HEAD changes matter, and lock
          // files are transient.
          if (
            !normalized.endsWith(".lock") &&
            /^\.git\/(index|HEAD|refs\/|MERGE_HEAD)/.test(normalized)
          ) {
            this.gitPending = true;
            this.scheduleFlush();
          }
          return;
        }
        this.pendingPaths.add(relative ? path.join(root, relative) : root);
        this.gitPending = true;
        this.scheduleFlush();
      });
      this.watcher.on("error", () => this.stopWatching());
    } catch {
      // Watching is best-effort; the explorer still has a manual refresh.
      this.watcher = null;
    }
  }

  private stopWatching(): void {
    this.watcher?.close();
    this.watcher = null;
    if (this.flushTimer) clearTimeout(this.flushTimer);
    this.flushTimer = null;
    this.pendingPaths.clear();
    this.gitPending = false;
  }

  private scheduleFlush(): void {
    if (this.flushTimer) return;
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      if (this.pendingPaths.size) {
        const paths =
          this.pendingPaths.size > MAX_CHANGED_PATHS && this.rootPath
            ? [this.rootPath]
            : [...this.pendingPaths];
        this.pendingPaths.clear();
        this.events.onFilesChanged(paths);
      }
      if (this.gitPending) {
        this.gitPending = false;
        this.events.onGitChanged();
      }
    }, 250);
  }
}
