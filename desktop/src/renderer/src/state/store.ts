import { create } from "zustand";
import type {
  AppInfo,
  DirEntry,
  GitCommit,
  GitStatusResponse,
  SearchResponse,
  UpdateStatus,
  WorkspaceInfo,
} from "@shared/ipc";
import { DEFAULT_SETTINGS, type Settings } from "@shared/settings";

export type SidebarView = "explorer" | "search" | "scm" | "run";
export type PanelView = "terminal" | "problems" | "output";

export type Tab =
  | { kind: "file"; id: string; path: string | null; title: string }
  | { kind: "diff"; id: string; path: string; staged: boolean; title: string }
  | { kind: "settings"; id: "settings"; title: string }
  | { kind: "shortcuts"; id: "shortcuts"; title: string };

export interface Problem {
  path: string;
  line: number;
  column: number;
  endLine: number;
  endColumn: number;
  message: string;
  severity: "error" | "warning" | "info";
  /** Who reported it: "ts", "css", "Pyright", "CodeForge", ... */
  source?: string;
}

export interface Toast {
  id: number;
  kind: "info" | "success" | "error";
  message: string;
  detail?: string;
  /** Buttons shown in the notification; a notification with actions stays until used or dismissed. */
  actions?: { label: string; run: () => void }[];
}

export interface OutputLine {
  time: string;
  text: string;
  level: "info" | "error";
}

export interface TerminalState {
  id: number;
  /** Terminals in the same group are shown side by side (split). */
  group: number;
  title: string;
  pid: number;
  /** Shell profile it was started with, e.g. "PowerShell" or "Command Prompt". */
  profile: string;
  /** Terminals started by Run / Start Debugging; Stop Running Program targets them. */
  purpose?: "run" | "debug";
  exited: boolean;
  exitCode?: number;
}

export interface ExplorerEdit {
  mode: "new-file" | "new-folder" | "rename";
  /** Folder the new item goes into, or the parent of the renamed item. */
  parent: string;
  /** The item being renamed. */
  target?: string;
}

export interface MenuItem {
  label?: string;
  shortcut?: string;
  disabled?: boolean;
  danger?: boolean;
  /** Shows a check mark (toggle items such as Auto Save). */
  checked?: boolean;
  separator?: boolean;
  run?: () => void;
}

export interface QuickPickItem {
  id: string;
  label: string;
  description?: string;
  detail?: string;
  /** Character indices of `label` to highlight. */
  highlights?: number[];
  /** File name whose language icon is shown before the label. */
  fileIcon?: string;
}

export type QuickPickRequest =
  | { kind: "quick-open"; initial: string }
  | {
      kind: "list";
      placeholder: string;
      items: QuickPickItem[];
      onPick: (item: QuickPickItem) => void;
    }
  | {
      kind: "input";
      prompt: string;
      placeholder?: string;
      value?: string;
      validate?: (value: string) => string | null;
      onAccept: (value: string) => void;
    };

export interface EditorStatus {
  line: number;
  column: number;
  selected: number;
  language: string;
  eol: "LF" | "CRLF";
  tabSize: number;
  insertSpaces: boolean;
  bom: boolean;
}

export interface SearchState {
  pattern: string;
  isRegex: boolean;
  caseSensitive: boolean;
  wholeWord: boolean;
  include: string;
  exclude: string;
  showReplace: boolean;
  replacement: string;
  running: boolean;
  error: string | null;
  response: SearchResponse | null;
}

export interface WorkbenchState {
  ready: boolean;
  appInfo: AppInfo | null;
  settings: Settings;
  workspace: WorkspaceInfo | null;
  recent: string[];

  sidebarVisible: boolean;
  sidebarView: SidebarView;
  sidebarWidth: number;
  panelVisible: boolean;
  panelView: PanelView;
  panelHeight: number;

  tabs: Tab[];
  activeTabId: string | null;
  dirty: Record<string, boolean>;
  /** Last save of each file tab: shown in the status bar ("Saving…", "Saved", "Save failed"). */
  saveState: Record<string, "saving" | "saved" | "failed">;
  editorStatus: EditorStatus | null;

  dirChildren: Record<string, DirEntry[]>;
  expanded: Record<string, boolean>;
  selectedPath: string | null;
  explorerEdit: ExplorerEdit | null;

  git: GitStatusResponse | null;
  gitBusy: boolean;
  commitMessage: string;
  commits: GitCommit[];

  terminals: TerminalState[];
  activeTerminalId: number | null;

  problems: Problem[];
  output: OutputLine[];
  toasts: Toast[];
  search: SearchState;

  quickPick: QuickPickRequest | null;
  updateStatus: UpdateStatus | null;
  contextMenu: { x: number; y: number; items: MenuItem[] } | null;
  /** Index of the open title-bar menu (File, Edit, ...). */
  openMenu: number | null;
}

export const useStore = create<WorkbenchState>()(() => ({
  ready: false,
  appInfo: null,
  settings: DEFAULT_SETTINGS,
  workspace: null,
  recent: [],

  sidebarVisible: true,
  sidebarView: "explorer",
  sidebarWidth: 270,
  panelVisible: false,
  panelView: "terminal",
  panelHeight: 260,

  tabs: [],
  activeTabId: null,
  dirty: {},
  saveState: {},
  editorStatus: null,

  dirChildren: {},
  expanded: {},
  selectedPath: null,
  explorerEdit: null,

  git: null,
  gitBusy: false,
  commitMessage: "",
  commits: [],

  terminals: [],
  activeTerminalId: null,

  problems: [],
  output: [],
  toasts: [],
  search: {
    pattern: "",
    isRegex: false,
    caseSensitive: false,
    wholeWord: false,
    include: "",
    exclude: "",
    showReplace: false,
    replacement: "",
    running: false,
    error: null,
    response: null,
  },

  quickPick: null,
  updateStatus: null,
  contextMenu: null,
  openMenu: null,
}));

export const getState = useStore.getState;
export const setState = useStore.setState;
