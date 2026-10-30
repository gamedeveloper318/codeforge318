import type { GitChange } from "./git-status";
import type { Settings } from "./settings";

/**
 * The complete IPC contract between the renderer (UI) and the main process.
 * The preload script only forwards channels listed here, and the main process
 * validates every argument, so this file is the full attack surface.
 */

export interface AppInfo {
  name: string;
  version: string;
  platform: string;
  arch: string;
  electron: string;
  chrome: string;
  node: string;
  isPackaged: boolean;
  homeDir: string;
}

export interface WorkspaceInfo {
  root: string;
  name: string;
}

export interface DirEntry {
  name: string;
  path: string;
  kind: "file" | "directory";
  isSymlink: boolean;
}

export interface FileContent {
  path: string;
  content: string;
  /** The file started with a UTF-8 byte order mark; it is restored on save. */
  bom: boolean;
  size: number;
  mtimeMs: number;
  /** Binary files are not loaded into the editor. */
  binary: boolean;
}

export interface SaveResult {
  mtimeMs: number;
  size: number;
}

export interface FileStat {
  kind: "file" | "directory";
  size: number;
  mtimeMs: number;
}

export interface SearchQuery {
  pattern: string;
  isRegex: boolean;
  caseSensitive: boolean;
  wholeWord: boolean;
  /** Comma-separated globs; empty means everything. */
  include: string;
  /** Comma-separated globs, added to the `search.exclude` setting. */
  exclude: string;
}

export interface SearchMatch {
  /** 1-based line number. */
  line: number;
  /** 1-based column of the match start. */
  column: number;
  length: number;
  /** The line text, possibly trimmed around the match. */
  preview: string;
  /** Where the match starts inside `preview`. */
  previewOffset: number;
}

export interface SearchFileResult {
  path: string;
  relativePath: string;
  matches: SearchMatch[];
}

export interface SearchResponse {
  results: SearchFileResult[];
  matchCount: number;
  filesSearched: number;
  truncated: boolean;
  durationMs: number;
  cancelled: boolean;
}

export interface GitFileChange extends GitChange {
  /** Absolute path on disk. */
  absolutePath: string;
}

export interface GitStatusResponse {
  gitAvailable: boolean;
  isRepo: boolean;
  repoRoot: string | null;
  branch: string | null;
  detached: boolean;
  upstream: string | null;
  ahead: number;
  behind: number;
  staged: GitFileChange[];
  unstaged: GitFileChange[];
  conflicts: GitFileChange[];
}

export interface GitCommit {
  hash: string;
  shortHash: string;
  author: string;
  relativeDate: string;
  subject: string;
}

export interface GitBranches {
  current: string | null;
  local: string[];
}

export interface TerminalSession {
  id: number;
  shell: string;
  cwd: string;
  pid: number;
  title: string;
}

/** State of the automatic updater, shown in the status bar and notifications. */
export interface UpdateStatus {
  state: "unsupported" | "idle" | "checking" | "up-to-date" | "downloading" | "ready" | "error";
  /** The new version (downloading/ready) or the installed version (up-to-date). */
  version?: string;
  /** Download progress, 0-100. */
  percent?: number;
  message?: string;
}

/** A JSON-RPC message exchanged with a language server. */
export type LspMessage = Record<string, unknown>;

export interface ConfirmOptions {
  type?: "none" | "info" | "warning" | "question" | "error";
  message: string;
  detail?: string;
  buttons: string[];
  defaultId?: number;
  cancelId?: number;
}

/** Request/response channels (renderer -> main via ipcRenderer.invoke). */
export interface InvokeChannels {
  "app:info": { args: []; result: AppInfo };
  "app:open-external": { args: [url: string]; result: void };
  "app:toggle-devtools": { args: []; result: void };
  "app:confirm": { args: [options: ConfirmOptions]; result: number };
  "app:reveal": { args: [path: string]; result: void };
  "window:confirm-close": { args: []; result: void };
  "workspace:open-dialog": { args: []; result: WorkspaceInfo | null };
  "workspace:open-recent": { args: [path: string]; result: WorkspaceInfo };
  "workspace:current": { args: []; result: WorkspaceInfo | null };
  "workspace:recent": { args: []; result: string[] };
  "workspace:remove-recent": { args: [path: string]; result: string[] };
  "workspace:close": { args: []; result: void };
  "dialog:open-files": { args: []; result: string[] };
  "dialog:save-as": { args: [suggestedName: string]; result: string | null };
  "fs:read-dir": { args: [path: string]; result: DirEntry[] };
  "fs:read-file": { args: [path: string]; result: FileContent };
  "fs:write-file": { args: [path: string, content: string, bom: boolean]; result: SaveResult };
  "fs:stat": { args: [path: string]; result: FileStat | null };
  "fs:create-file": { args: [path: string]; result: void };
  "fs:create-dir": { args: [path: string]; result: void };
  "fs:rename": { args: [from: string, to: string]; result: void };
  "fs:trash": { args: [path: string]; result: void };
  "fs:list-files": { args: []; result: string[] };
  "search:find": { args: [query: SearchQuery]; result: SearchResponse };
  "git:status": { args: []; result: GitStatusResponse };
  "git:init": { args: []; result: void };
  "git:stage": { args: [paths: string[]]; result: void };
  "git:unstage": { args: [paths: string[]]; result: void };
  "git:discard": { args: [paths: string[]]; result: void };
  "git:commit": { args: [message: string, stageAll: boolean]; result: string };
  "git:show": { args: [path: string, ref: "HEAD" | "INDEX"]; result: string | null };
  "git:branches": { args: []; result: GitBranches };
  "git:checkout": { args: [branch: string]; result: void };
  "git:create-branch": { args: [name: string]; result: void };
  "git:log": { args: [limit: number]; result: GitCommit[] };
  "git:sync": { args: [action: "pull" | "push" | "fetch"]; result: string };
  "terminal:create": {
    args: [options: { cols: number; rows: number; cwd?: string }];
    result: TerminalSession;
  };
  "terminal:kill": { args: [id: number]; result: void };
  "settings:get": { args: []; result: Settings };
  "settings:update": { args: [patch: Partial<Settings>]; result: Settings };
  "settings:reset": { args: []; result: Settings };
  "preview:open-file": { args: [path: string]; result: void };
  "preview:open-url": { args: [url: string]; result: void };
  "update:status": { args: []; result: UpdateStatus };
  "update:check": { args: []; result: UpdateStatus };
  "update:install": { args: []; result: void };
  "lsp:start": { args: [language: "python"]; result: void };
}

/** Fire-and-forget channels (renderer -> main via ipcRenderer.send). */
export interface SendChannels {
  "terminal:write": [id: number, data: string];
  "terminal:resize": [id: number, cols: number, rows: number];
  "lsp:send": [language: "python", message: LspMessage];
}

/** Events pushed from main to the renderer. */
export interface EventChannels {
  "fs:changed": { paths: string[] };
  "git:changed": void;
  "terminal:data": { id: number; data: string };
  "terminal:exit": { id: number; exitCode: number };
  "settings:changed": Settings;
  "window:close-requested": void;
  "update:status": UpdateStatus;
  "lsp:message": { language: "python"; message: LspMessage };
  "lsp:stopped": { language: "python"; reason: string };
}

export type InvokeChannel = keyof InvokeChannels;
export type SendChannel = keyof SendChannels;
export type EventChannel = keyof EventChannels;

/** Shape of every invoke response; errors cross the boundary as plain messages. */
export type IpcResult<T> = { ok: true; value: T } | { ok: false; error: string };

export const INVOKE_CHANNELS: readonly InvokeChannel[] = [
  "app:info",
  "app:open-external",
  "app:toggle-devtools",
  "app:confirm",
  "app:reveal",
  "window:confirm-close",
  "workspace:open-dialog",
  "workspace:open-recent",
  "workspace:current",
  "workspace:recent",
  "workspace:remove-recent",
  "workspace:close",
  "dialog:open-files",
  "dialog:save-as",
  "fs:read-dir",
  "fs:read-file",
  "fs:write-file",
  "fs:stat",
  "fs:create-file",
  "fs:create-dir",
  "fs:rename",
  "fs:trash",
  "fs:list-files",
  "search:find",
  "git:status",
  "git:init",
  "git:stage",
  "git:unstage",
  "git:discard",
  "git:commit",
  "git:show",
  "git:branches",
  "git:checkout",
  "git:create-branch",
  "git:log",
  "git:sync",
  "terminal:create",
  "terminal:kill",
  "settings:get",
  "settings:update",
  "settings:reset",
  "preview:open-file",
  "preview:open-url",
  "update:status",
  "update:check",
  "update:install",
  "lsp:start",
];

export const SEND_CHANNELS: readonly SendChannel[] = [
  "terminal:write",
  "terminal:resize",
  "lsp:send",
];

export const EVENT_CHANNELS: readonly EventChannel[] = [
  "fs:changed",
  "git:changed",
  "terminal:data",
  "terminal:exit",
  "settings:changed",
  "window:close-requested",
  "update:status",
  "lsp:message",
  "lsp:stopped",
];

/** The API exposed on `window.codeforge` by the preload script. */
export interface CodeForgeBridge {
  invoke<K extends InvokeChannel>(
    channel: K,
    ...args: InvokeChannels[K]["args"]
  ): Promise<InvokeChannels[K]["result"]>;
  send<K extends SendChannel>(channel: K, ...args: SendChannels[K]): void;
  on<K extends EventChannel>(channel: K, listener: (payload: EventChannels[K]) => void): () => void;
  platform: string;
}
