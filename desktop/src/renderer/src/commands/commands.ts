import { api, isMac } from "../lib/bridge";
import { runEditorAction } from "../monaco/editor-ref";
import {
  closeActiveTab,
  closeTabs,
  cycleTab,
  newUntitledFile,
  openSettingsTab,
  saveActive,
  saveAll,
} from "../actions/editor";
import { collapseAll, refreshExplorer, startCreate } from "../actions/explorer";
import { commit, pickBranch, promptNewBranch, refreshGit, sync } from "../actions/git";
import {
  previewActiveHtml,
  promptLocalhostPreview,
  runActiveFile,
  showAbout,
  toggleTheme,
  updateSettings,
} from "../actions/misc";
import {
  clearActiveTerminal,
  createTerminal,
  killTerminal,
  showPanel,
  toggleTerminal,
} from "../actions/terminal";
import { checkForUpdates, installUpdate } from "../actions/update";
import { closeFolder, openFiles, openFolder } from "../actions/workspace";
import { getState, setState, type SidebarView } from "../state/store";

export interface Command {
  id: string;
  title: string;
  category: string;
  /** "Mod" is Ctrl on Windows/Linux and Cmd on macOS. */
  keybinding?: string[];
  /** Shortcut handled by the editor itself; shown in menus but not intercepted. */
  editorKeybinding?: string;
  run: () => unknown;
}

function showView(view: SidebarView): void {
  const { sidebarVisible, sidebarView } = getState();
  if (sidebarVisible && sidebarView === view) setState({ sidebarVisible: false });
  else setState({ sidebarVisible: true, sidebarView: view });
}

export const COMMANDS: Command[] = [
  // File
  {
    id: "file.new",
    title: "New Text File",
    category: "File",
    keybinding: ["Mod+N"],
    run: newUntitledFile,
  },
  {
    id: "file.newInFolder",
    title: "New File in Explorer…",
    category: "File",
    run: () => startCreate("new-file"),
  },
  {
    id: "file.newFolder",
    title: "New Folder…",
    category: "File",
    run: () => startCreate("new-folder"),
  },
  { id: "file.open", title: "Open File…", category: "File", keybinding: ["Mod+O"], run: openFiles },
  { id: "file.openFolder", title: "Open Folder…", category: "File", run: openFolder },
  {
    id: "file.save",
    title: "Save",
    category: "File",
    keybinding: ["Mod+S"],
    run: () => saveActive(),
  },
  {
    id: "file.saveAs",
    title: "Save As…",
    category: "File",
    keybinding: ["Mod+Shift+S"],
    run: () => saveActive(true),
  },
  {
    id: "file.saveAll",
    title: "Save All",
    category: "File",
    keybinding: ["Mod+Alt+S"],
    run: saveAll,
  },
  {
    id: "file.toggleAutoSave",
    title: "Toggle Auto Save",
    category: "File",
    run: () =>
      updateSettings({
        "files.autoSave": getState().settings["files.autoSave"] === "off" ? "afterDelay" : "off",
      }),
  },
  { id: "file.closeFolder", title: "Close Folder", category: "File", run: closeFolder },
  {
    id: "editor.close",
    title: "Close Editor",
    category: "View",
    keybinding: ["Mod+W", "Mod+F4"],
    run: closeActiveTab,
  },
  {
    id: "editor.closeAll",
    title: "Close All Editors",
    category: "View",
    run: () => closeTabs(() => true),
  },
  {
    id: "editor.closeOthers",
    title: "Close Other Editors",
    category: "View",
    run: () => closeTabs((t) => t.id !== getState().activeTabId),
  },
  {
    id: "editor.next",
    title: "Next Editor",
    category: "View",
    keybinding: ["Mod+Tab", "Mod+PageDown"],
    run: () => cycleTab(1),
  },
  {
    id: "editor.previous",
    title: "Previous Editor",
    category: "View",
    keybinding: ["Mod+Shift+Tab", "Mod+PageUp"],
    run: () => cycleTab(-1),
  },

  // Edit (implemented by the Monaco editor)
  {
    id: "edit.undo",
    title: "Undo",
    category: "Edit",
    editorKeybinding: "Mod+Z",
    run: () => runEditorAction("undo"),
  },
  {
    id: "edit.redo",
    title: "Redo",
    category: "Edit",
    editorKeybinding: "Mod+Y",
    run: () => runEditorAction("redo"),
  },
  {
    id: "edit.cut",
    title: "Cut",
    category: "Edit",
    editorKeybinding: "Mod+X",
    run: () => runEditorAction("editor.action.clipboardCutAction"),
  },
  {
    id: "edit.copy",
    title: "Copy",
    category: "Edit",
    editorKeybinding: "Mod+C",
    run: () => runEditorAction("editor.action.clipboardCopyAction"),
  },
  {
    id: "edit.paste",
    title: "Paste",
    category: "Edit",
    editorKeybinding: "Mod+V",
    run: () => runEditorAction("editor.action.clipboardPasteAction"),
  },
  {
    id: "edit.find",
    title: "Find",
    category: "Edit",
    editorKeybinding: "Mod+F",
    run: () => runEditorAction("actions.find"),
  },
  {
    id: "edit.replace",
    title: "Replace",
    category: "Edit",
    editorKeybinding: "Mod+H",
    run: () => runEditorAction("editor.action.startFindReplaceAction"),
  },
  {
    id: "edit.findInFiles",
    title: "Find in Files",
    category: "Edit",
    keybinding: ["Mod+Shift+F"],
    run: () => setState({ sidebarVisible: true, sidebarView: "search" }),
  },
  {
    id: "edit.toggleComment",
    title: "Toggle Line Comment",
    category: "Edit",
    editorKeybinding: "Mod+/",
    run: () => runEditorAction("editor.action.commentLine"),
  },
  {
    id: "edit.format",
    title: "Format Document",
    category: "Edit",
    editorKeybinding: "Shift+Alt+F",
    run: () => runEditorAction("editor.action.formatDocument"),
  },
  {
    id: "edit.selectAll",
    title: "Select All",
    category: "Selection",
    editorKeybinding: "Mod+A",
    run: () => runEditorAction("editor.action.selectAll"),
  },
  {
    id: "edit.expandSelection",
    title: "Expand Selection",
    category: "Selection",
    editorKeybinding: "Shift+Alt+Right",
    run: () => runEditorAction("editor.action.smartSelect.expand"),
  },
  {
    id: "edit.cursorAbove",
    title: "Add Cursor Above",
    category: "Selection",
    editorKeybinding: "Mod+Alt+Up",
    run: () => runEditorAction("editor.action.insertCursorAbove"),
  },
  {
    id: "edit.cursorBelow",
    title: "Add Cursor Below",
    category: "Selection",
    editorKeybinding: "Mod+Alt+Down",
    run: () => runEditorAction("editor.action.insertCursorBelow"),
  },
  {
    id: "edit.selectOccurrences",
    title: "Select All Occurrences",
    category: "Selection",
    editorKeybinding: "Mod+Shift+L",
    run: () => runEditorAction("editor.action.selectHighlights"),
  },
  {
    id: "edit.duplicateLine",
    title: "Duplicate Line Down",
    category: "Selection",
    editorKeybinding: "Shift+Alt+Down",
    run: () => runEditorAction("editor.action.copyLinesDownAction"),
  },
  {
    id: "edit.foldAll",
    title: "Fold All",
    category: "View",
    run: () => runEditorAction("editor.foldAll"),
  },
  {
    id: "edit.unfoldAll",
    title: "Unfold All",
    category: "View",
    run: () => runEditorAction("editor.unfoldAll"),
  },

  // Go
  {
    id: "go.file",
    title: "Go to File…",
    category: "Go",
    keybinding: ["Mod+P"],
    run: () => setState({ quickPick: { kind: "quick-open", initial: "" } }),
  },
  {
    id: "go.line",
    title: "Go to Line…",
    category: "Go",
    editorKeybinding: "Mod+G",
    run: () => setState({ quickPick: { kind: "quick-open", initial: ":" } }),
  },
  {
    id: "go.symbol",
    title: "Go to Symbol in Editor…",
    category: "Go",
    editorKeybinding: "Mod+Shift+O",
    run: () => runEditorAction("editor.action.quickOutline"),
  },
  {
    id: "go.definition",
    title: "Go to Definition",
    category: "Go",
    editorKeybinding: "F12",
    run: () => runEditorAction("editor.action.revealDefinition"),
  },
  {
    id: "go.references",
    title: "Find All References",
    category: "Go",
    editorKeybinding: "Shift+F12",
    run: () => runEditorAction("editor.action.goToReferences"),
  },
  {
    id: "go.rename",
    title: "Rename Symbol",
    category: "Go",
    editorKeybinding: "F2",
    run: () => runEditorAction("editor.action.rename"),
  },
  {
    id: "go.nextProblem",
    title: "Go to Next Problem",
    category: "Go",
    editorKeybinding: "F8",
    run: () => runEditorAction("editor.action.marker.nextInFiles"),
  },

  // View
  {
    id: "view.commandPalette",
    title: "Command Palette…",
    category: "View",
    keybinding: ["Mod+Shift+P", "F1"],
    run: () => setState({ quickPick: { kind: "quick-open", initial: ">" } }),
  },
  {
    id: "view.explorer",
    title: "Show Explorer",
    category: "View",
    keybinding: ["Mod+Shift+E"],
    run: () => showView("explorer"),
  },
  { id: "view.search", title: "Show Search", category: "View", run: () => showView("search") },
  {
    id: "view.scm",
    title: "Show Source Control",
    category: "View",
    keybinding: ["Mod+Shift+G"],
    run: () => showView("scm"),
  },
  {
    id: "view.run",
    title: "Show Run",
    category: "View",
    keybinding: ["Mod+Shift+D"],
    run: () => showView("run"),
  },
  {
    id: "view.toggleSidebar",
    title: "Toggle Primary Side Bar",
    category: "View",
    keybinding: ["Mod+B"],
    run: () => setState({ sidebarVisible: !getState().sidebarVisible }),
  },
  {
    id: "view.togglePanel",
    title: "Toggle Panel",
    category: "View",
    keybinding: ["Mod+J"],
    run: () => setState({ panelVisible: !getState().panelVisible }),
  },
  {
    id: "view.problems",
    title: "Show Problems",
    category: "View",
    keybinding: ["Mod+Shift+M"],
    run: () => showPanel("problems"),
  },
  {
    id: "view.output",
    title: "Show Output",
    category: "View",
    keybinding: ["Mod+Shift+U"],
    run: () => showPanel("output"),
  },
  {
    id: "view.wordWrap",
    title: "Toggle Word Wrap",
    category: "View",
    keybinding: ["Alt+Z"],
    run: () =>
      updateSettings({
        "editor.wordWrap": getState().settings["editor.wordWrap"] === "on" ? "off" : "on",
      }),
  },
  {
    id: "view.minimap",
    title: "Toggle Minimap",
    category: "View",
    run: () => updateSettings({ "editor.minimap": !getState().settings["editor.minimap"] }),
  },
  {
    id: "view.zoomIn",
    title: "Increase Editor Font Size",
    category: "View",
    keybinding: ["Mod+="],
    run: () =>
      updateSettings({
        "editor.fontSize": Math.min(40, getState().settings["editor.fontSize"] + 1),
      }),
  },
  {
    id: "view.zoomOut",
    title: "Decrease Editor Font Size",
    category: "View",
    keybinding: ["Mod+-"],
    run: () =>
      updateSettings({
        "editor.fontSize": Math.max(8, getState().settings["editor.fontSize"] - 1),
      }),
  },
  {
    id: "view.toggleTheme",
    title: "Toggle Light/Dark Theme",
    category: "Preferences",
    run: toggleTheme,
  },
  {
    id: "settings.open",
    title: "Open Settings",
    category: "Preferences",
    keybinding: ["Mod+,"],
    run: openSettingsTab,
  },

  // Explorer
  { id: "explorer.refresh", title: "Refresh Explorer", category: "Explorer", run: refreshExplorer },
  {
    id: "explorer.collapse",
    title: "Collapse Folders in Explorer",
    category: "Explorer",
    run: collapseAll,
  },

  // Git
  { id: "git.refresh", title: "Refresh Source Control", category: "Git", run: refreshGit },
  { id: "git.commit", title: "Commit", category: "Git", run: commit },
  { id: "git.checkout", title: "Checkout Branch…", category: "Git", run: pickBranch },
  { id: "git.createBranch", title: "Create Branch…", category: "Git", run: promptNewBranch },
  { id: "git.pull", title: "Pull", category: "Git", run: () => sync("pull") },
  { id: "git.push", title: "Push", category: "Git", run: () => sync("push") },
  { id: "git.fetch", title: "Fetch", category: "Git", run: () => sync("fetch") },

  // Run & terminal
  {
    id: "run.activeFile",
    title: "Run Active File",
    category: "Run",
    keybinding: ["Mod+F5"],
    run: runActiveFile,
  },
  {
    id: "run.previewHtml",
    title: "Preview Active HTML File",
    category: "Run",
    run: previewActiveHtml,
  },
  {
    id: "run.previewUrl",
    title: "Open Localhost Preview…",
    category: "Run",
    run: promptLocalhostPreview,
  },
  {
    id: "terminal.toggle",
    title: "Toggle Terminal",
    category: "Terminal",
    keybinding: ["Mod+`"],
    run: toggleTerminal,
  },
  {
    id: "terminal.new",
    title: "New Terminal",
    category: "Terminal",
    keybinding: ["Mod+Shift+`"],
    run: () => createTerminal(),
  },
  {
    id: "terminal.kill",
    title: "Kill Active Terminal",
    category: "Terminal",
    run: () => {
      const id = getState().activeTerminalId;
      if (id !== null) void killTerminal(id);
    },
  },
  { id: "terminal.clear", title: "Clear Terminal", category: "Terminal", run: clearActiveTerminal },

  // Help
  {
    id: "help.shortcuts",
    title: "Keyboard Shortcuts",
    category: "Help",
    run: () => setState({ quickPick: { kind: "quick-open", initial: ">" } }),
  },
  {
    id: "help.devtools",
    title: "Toggle Developer Tools",
    category: "Help",
    run: () => api.invoke("app:toggle-devtools"),
  },
  {
    id: "help.checkUpdates",
    title: "Check for Updates…",
    category: "Help",
    run: checkForUpdates,
  },
  {
    id: "update.install",
    title: "Restart to Update",
    category: "Help",
    run: installUpdate,
  },
  { id: "help.about", title: "About CodeForge", category: "Help", run: showAbout },
];

const byId = new Map(COMMANDS.map((c) => [c.id, c]));

export function getCommand(id: string): Command | undefined {
  return byId.get(id);
}

export function runCommand(id: string): void {
  const command = byId.get(id);
  if (command) void Promise.resolve(command.run());
}

// ---------- Keybindings ----------

const CODE_NAMES: Record<string, string> = {
  Backquote: "`",
  Comma: ",",
  Period: ".",
  Slash: "/",
  Equal: "=",
  Minus: "-",
  Tab: "Tab",
  PageUp: "PageUp",
  PageDown: "PageDown",
};

function keyName(event: KeyboardEvent): string | null {
  const { code } = event;
  if (/^Key[A-Z]$/.test(code)) return code.slice(3);
  if (/^Digit\d$/.test(code)) return code.slice(5);
  if (/^F\d{1,2}$/.test(code)) return code;
  if (code === "NumpadAdd") return "=";
  if (code === "NumpadSubtract") return "-";
  return CODE_NAMES[code] ?? null;
}

export function eventToChord(event: KeyboardEvent): string | null {
  const key = keyName(event);
  if (!key) return null;
  const parts: string[] = [];
  if (isMac ? event.metaKey : event.ctrlKey) parts.push("Mod");
  if (event.altKey) parts.push("Alt");
  if (event.shiftKey) parts.push("Shift");
  parts.push(key);
  return parts.join("+");
}

const chordIndex = new Map<string, Command>();
for (const command of COMMANDS) {
  for (const chord of command.keybinding ?? []) chordIndex.set(chord, command);
}

export function commandForEvent(event: KeyboardEvent): Command | undefined {
  const chord = eventToChord(event);
  return chord ? chordIndex.get(chord) : undefined;
}

/** "Mod+Shift+P" -> "Ctrl+Shift+P" (Windows/Linux) or "⌘⇧P" (macOS). */
export function formatChord(chord: string | undefined): string {
  if (!chord) return "";
  if (!isMac) return chord.replace(/Mod/g, "Ctrl");
  return chord
    .replace(/Mod\+/g, "⌘")
    .replace(/Shift\+/g, "⇧")
    .replace(/Alt\+/g, "⌥");
}

export function shortcutFor(command: Command): string {
  return formatChord(command.keybinding?.[0] ?? command.editorKeybinding);
}
