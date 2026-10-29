import { access, mkdir, readdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { shell } from "electron";
import { GlobSet } from "@shared/glob";
import type { DirEntry, FileContent, FileStat, SaveResult } from "@shared/ipc";
import type { Settings } from "@shared/settings";
import { friendlyFsError } from "./errors";
import { walkFiles } from "./file-walker";
import { isInside, samePath } from "./path-guard";
import type { Workspace } from "./workspace";

const MAX_EDITABLE_BYTES = 50 * 1024 * 1024;
const MAX_LISTED_FILES = 50_000;
const BOM = Buffer.from([0xef, 0xbb, 0xbf]);

/** A file is treated as binary when its first 8 KB contain a NUL byte. */
export function looksBinary(buffer: Buffer): boolean {
  const length = Math.min(buffer.length, 8000);
  for (let i = 0; i < length; i++) if (buffer[i] === 0) return true;
  return false;
}

const exists = (target: string) =>
  access(target).then(
    () => true,
    () => false,
  );

export class FileService {
  constructor(
    private readonly workspace: Workspace,
    private readonly settings: () => Settings,
  ) {}

  async readDir(dir: string): Promise<DirEntry[]> {
    const resolved = await this.workspace.resolve(dir);
    const root = this.workspace.root ?? resolved;
    const exclude = new GlobSet(this.settings()["files.exclude"]);
    let entries;
    try {
      entries = await readdir(resolved, { withFileTypes: true });
    } catch (error) {
      throw friendlyFsError(error, "read folder", resolved);
    }
    const result: DirEntry[] = [];
    for (const entry of entries) {
      const full = path.join(resolved, entry.name);
      if (exclude.matches(path.relative(root, full).split(path.sep).join("/"))) continue;
      let kind: DirEntry["kind"] = entry.isDirectory() ? "directory" : "file";
      if (entry.isSymbolicLink()) {
        const target = await stat(full).catch(() => null);
        kind = target?.isDirectory() ? "directory" : "file";
      }
      result.push({ name: entry.name, path: full, kind, isSymlink: entry.isSymbolicLink() });
    }
    const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });
    return result.sort((a, b) =>
      a.kind === b.kind ? collator.compare(a.name, b.name) : a.kind === "directory" ? -1 : 1,
    );
  }

  async readFile(file: string): Promise<FileContent> {
    const resolved = await this.workspace.resolve(file);
    try {
      const info = await stat(resolved);
      if (info.isDirectory()) throw new Error("That is a folder, not a file.");
      if (info.size > MAX_EDITABLE_BYTES) {
        const mb = (info.size / 1024 / 1024).toFixed(1);
        throw new Error(
          `"${path.basename(resolved)}" is too large to open (${mb} MB). The limit is 50 MB.`,
        );
      }
      const buffer = await readFile(resolved);
      const base = { path: resolved, size: info.size, mtimeMs: info.mtimeMs };
      if (looksBinary(buffer)) return { ...base, content: "", bom: false, binary: true };
      const bom = buffer.subarray(0, 3).equals(BOM);
      return { ...base, content: buffer.toString("utf8", bom ? 3 : 0), bom, binary: false };
    } catch (error) {
      throw friendlyFsError(error, "open", resolved);
    }
  }

  async writeFile(file: string, content: string, bom: boolean): Promise<SaveResult> {
    const resolved = await this.workspace.resolve(file);
    try {
      const body = Buffer.from(content, "utf8");
      await writeFile(resolved, bom ? Buffer.concat([BOM, body]) : body);
      const info = await stat(resolved);
      return { mtimeMs: info.mtimeMs, size: info.size };
    } catch (error) {
      throw friendlyFsError(error, "save", resolved);
    }
  }

  async stat(target: string): Promise<FileStat | null> {
    const resolved = await this.workspace.resolve(target);
    const info = await stat(resolved).catch(() => null);
    if (!info) return null;
    return {
      kind: info.isDirectory() ? "directory" : "file",
      size: info.size,
      mtimeMs: info.mtimeMs,
    };
  }

  async createFile(file: string): Promise<void> {
    const resolved = await this.workspace.resolve(file);
    try {
      await mkdir(path.dirname(resolved), { recursive: true });
      await writeFile(resolved, "", { flag: "wx" });
    } catch (error) {
      throw friendlyFsError(error, "create", resolved);
    }
  }

  async createDirectory(dir: string): Promise<void> {
    const resolved = await this.workspace.resolve(dir);
    if (await exists(resolved)) {
      throw new Error(
        `Could not create "${path.basename(resolved)}": a file or folder with that name already exists.`,
      );
    }
    try {
      await mkdir(resolved, { recursive: true });
    } catch (error) {
      throw friendlyFsError(error, "create", resolved);
    }
  }

  /** Renames or moves a file or folder. Never overwrites an existing target. */
  async rename(from: string, to: string): Promise<void> {
    const source = await this.workspace.resolve(from, { forbidRoot: true });
    const target = await this.workspace.resolve(to, { forbidRoot: true });
    if (samePath(source, target) && source === target) return;
    if (isInside(source, target) && !samePath(source, target)) {
      throw new Error("A folder cannot be moved into itself.");
    }
    // On Windows "a.txt" -> "A.txt" is the same file; only block real collisions.
    if (!samePath(source, target) && (await exists(target))) {
      throw new Error(`"${path.basename(target)}" already exists in that location.`);
    }
    try {
      await mkdir(path.dirname(target), { recursive: true });
      await rename(source, target);
    } catch (error) {
      throw friendlyFsError(error, "move", source);
    }
  }

  /** Moves to the OS recycle bin / trash so deletes can be undone. */
  async trash(target: string): Promise<void> {
    const resolved = await this.workspace.resolve(target, { forbidRoot: true });
    try {
      await shell.trashItem(resolved);
    } catch (error) {
      throw friendlyFsError(error, "delete", resolved);
    }
  }

  async listFiles(): Promise<string[]> {
    const root = this.workspace.root;
    if (!root) return [];
    const exclude = new GlobSet([
      ...this.settings()["files.exclude"],
      ...this.settings()["search.exclude"],
    ]);
    const { files } = await walkFiles(root, { exclude, limit: MAX_LISTED_FILES });
    return files;
  }
}
