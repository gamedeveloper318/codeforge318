import { api, isMac } from "../lib/bridge";
import { editorWithFile, runEditorAction } from "../monaco/editor-ref";
import { pasteIntoEditor } from "../actions/clipboard";
import {
  closeActiveTab,
  closeTabs,
  cycleTab,
  newUntitledFile,
  openSettingsTab,
  openShortcutsTab,
  saveActive,
  saveAll,
} from "../actions/editor";
import { collapseAll, refreshExplorer, startCreate } from "../actions/explorer";
import { commit, pickBranch, promptNewBranch, refreshGit, sync } from "../actions/git";
import { pickLanguageMode } from "../actions/language";
import {
  openDocumentation,
  previewActiveHtml,
  promptLocalhostPreview,
  showAbout,
  toggleTheme,
  updateSettings,
  zoomWindow,
} from "../actions/misc";
import { runActiveFile, startDebugging, stopRunningProgram } from "../actions/run";
import {
  clearActiveTerminal,
  closeActiveTerminal,
  createTerminal,
  pickTerminalProfile,
  showPanel,
  toggleTerminal,
} from "../actions/terminal";
import { checkForUpdates, installUpdate } from "../actions/update";
import { closeFolder, openFiles, openFolder, quitApp } from "../actions/workspace";
import { getState, setState, type SidebarView, type WorkbenchState } from "../state/store";

export interface Command {
  id: string;
  title: string;
  category: string;
  /** "Mod" is Ctrl on Windows/Linux and Cmd on macOS. */
  keybinding?: string[];
  /** Shortcut handled by the editor (or the OS) itself; shown in menus but not intercepted. */
  editorKeybinding?: string;
  /** For toggles: whether the option is on (shown as a check mark in menus). */
  checked?: (state: WorkbenchState) => boolean;
  run: () => unknown;
}

function showView(view: SidebarView): void {
  setState({ sidebarVisible: true, sidebarView: view });
}

/** A Monaco editor action; with no file open it explains that instead of doing nothing. */
function editorCommand(
  id: string,
  title: string,
  category: string,
  actionId: string,
  editorKeybinding?: string,
): Command {
  return { id, title, category, editorKeybinding, run: () => runEditorAction(actionId, title) };
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
    title: "New File…",
    category: "File",
    keybinding: ["Mod+Alt+N"],
    run: () => (getState().workspace ? startCreate("new-file") : newUntitledFile()),
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
    title: "Auto Save",
    category: "File",
    checked: (state) => state.settings["files.autoSave"] === "afterDelay",
    run: () =>
      updateSettings({
        "files.autoSave": getState().settings["files.autoSave"] === "off" ? "afterDelay" : "off",
      }),
  },
  { id: "file.closeFolder", title: "Close Folder", category: "File", run: closeFolder },
  {
    id: "file.exit",
    title: "Exit",
    category: "File",
    editorKeybinding: "Alt+F4",
    run: quitApp,
  },
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
  editorCommand("edit.undo", "Undo", "Edit", "undo", "Mod+Z"),
  editorCommand("edit.redo", "Redo", "Edit", "redo", "Mod+Y"),
  editorCommand("edit.cut", "Cut", "Edit", "editor.action.clipboardCutAction", "Mod+X"),
  editorCommand("edit.copy", "Copy", "Edit", "editor.action.clipboardCopyAction", "Mod+C"),
  {
    id: "edit.paste",
    title: "Paste",
    category: "Edit",
    editorKeybinding: "Mod+V",
    run: pasteIntoEditor,
  },
  editorCommand("edit.find", "Find", "Edit", "actions.find", "Mod+F"),
  editorCommand("edit.replace", "Replace", "Edit", "editor.action.startFindReplaceAction", "Mod+H"),
  {
    id: "edit.findInFiles",
    title: "Find in Files",
    category: "Edit",
    keybinding: ["Mod+Shift+F"],
    run: () => showView("search"),
  },
  editorCommand(
    "edit.toggleComment",
    "Toggle Line Comment",
    "Edit",
    "editor.action.commentLine",
    "Mod+/",
  ),
  editorCommand(
    "edit.format",
    "Format Document",
    "Edit",
    "editor.action.formatDocument",
    "Shift+Alt+F",
  ),

  // Selection
  editorCommand("edit.selectAll", "Select All", "Selection", "editor.action.selectAll", "Mod+A"),
  editorCommand("edit.selectLine", "Select Line", "Selection", "expandLineSelection", "Mod+L"),
  editorCommand(
    "edit.expandSelection",
    "Expand Selection",
    "Selection",
    "editor.action.smartSelect.expand",
    "Shift+Alt+Right",
  ),
  editorCommand(
    "edit.shrinkSelection",
    "Shrink Selection",
    "Selection",
    "editor.action.smartSelect.shrink",
    "Shift+Alt+Left",
  ),
  editorCommand(
    "edit.cursorAbove",
    "Add Cursor Above",
    "Selection",
    "editor.action.insertCursorAbove",
    "Mod+Alt+Up",
  ),
  editorCommand(
    "edit.cursorBelow",
    "Add Cursor Below",
    "Selection",
    "editor.action.insertCursorBelow",
    "Mod+Alt+Down",
  ),
  editorCommand(
    "edit.selectOccurrences",
    "Select All Occurrences",
    "Selection",
    "editor.action.selectHighlights",
    "Mod+Shift+L",
  ),
  editorCommand(
    "edit.duplicateLine",
    "Duplicate Line Down",
    "Selection",
    "editor.action.copyLinesDownAction",
    "Shift+Alt+Down",
  ),
  editorCommand("edit.foldAll", "Fold All", "View", "editor.foldAll"),
  editorCommand("edit.unfoldAll", "Unfold All", "View", "editor.unfoldAll"),

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
    keybinding: ["Mod+G"],
    run: () => {
      if (editorWithFile("Go to Line"))
        setState({ quickPick: { kind: "quick-open", initial: ":" } });
    },
  },
  editorCommand(
    "go.symbol",
    "Go to Symbol in Editor…",
    "Go",
    "editor.action.quickOutline",
    "Mod+Shift+O",
  ),
  editorCommand("go.definition", "Go to Definition", "Go", "editor.action.revealDefinition", "F12"),
  editorCommand(
    "go.references",
    "Find All References",
    "Go",
    "editor.action.goToReferences",
    "Shift+F12",
  ),
  editorCommand("go.rename", "Rename Symbol", "Go", "editor.action.rename", "F2"),
  editorCommand(
    "go.nextProblem",
    "Go to Next Problem",
    "Go",
    "editor.action.marker.nextInFiles",
    "F8",
  ),

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
    title: "Explorer",
    category: "View",
    keybinding: ["Mod+Shift+E"],
    run: () => showView("explorer"),
  },
  {
    id: "view.search",
    title: "Search",
    category: "View",
    editorKeybinding: "Mod+Shift+F",
    run: () => showView("search"),
  },
  {
    id: "view.scm",
    title: "Source Control",
    category: "View",
    keybinding: ["Mod+Shift+G"],
    run: () => showView("scm"),
  },
  {
    id: "view.run",
    title: "Run and Debug",
    category: "View",
    keybinding: ["Mod+Shift+D"],
    run: () => showView("run"),
  },
  {
    id: "view.toggleSidebar",
    title: "Toggle Sidebar",
    category: "View",
    keybinding: ["Mod+B"],
    checked: (state) => state.sidebarVisible,
    run: () => setState({ sidebarVisible: !getState().sidebarVisible }),
  },
  {
    id: "view.togglePanel",
    title: "Toggle Panel",
    category: "View",
    keybinding: ["Mod+J"],
    checked: (state) => state.panelVisible,
    run: () => setState({ panelVisible: !getState().panelVisible }),
  },
  {
    id: "view.problems",
    title: "Problems",
    category: "View",
    keybinding: ["Mod+Shift+M"],
    run: () => showPanel("problems"),
  },
  {
    id: "view.output",
    title: "Output",
    category: "View",
    keybinding: ["Mod+Shift+U"],
    run: () => showPanel("output"),
  },
  {
    id: "view.wordWrap",
    title: "Word Wrap",
    category: "View",
    keybinding: ["Alt+Z"],
    checked: (state) => state.settings["editor.wordWrap"] === "on",
    run: () =>
      updateSettings({
        "editor.wordWrap": getState().settings["editor.wordWrap"] === "on" ? "off" : "on",
      }),
  },
  {
    id: "view.minimap",
    title: "Minimap",
    category: "View",
    checked: (state) => state.settings["editor.minimap"],
    run: () => updateSettings({ "editor.minimap": !getState().settings["editor.minimap"] }),
  },
  {
    id: "view.zoomIn",
    title: "Zoom In",
    category: "View",
    keybinding: ["Mod+=", "Mod+Shift+="],
    run: () => zoomWindow(1),
  },
  {
    id: "view.zoomOut",
    title: "Zoom Out",
    category: "View",
    keybinding: ["Mod+-"],
    run: () => zoomWindow(-1),
  },
  {
    id: "view.zoomReset",
    title: "Reset Zoom",
    category: "View",
    keybinding: ["Mod+0"],
    run: () => zoomWindow(0),
  },
  {
    id: "editor.fontSizeUp",
    title: "Increase Editor Font Size",
    category: "View",
    run: () =>
      updateSettings({
        "editor.fontSize": Math.min(40, getState().settings["editor.fontSize"] + 1),
      }),
  },
  {
    id: "editor.fontSizeDown",
    title: "Decrease Editor Font Size",
    category: "View",
    run: () =>
      updateSettings({
        "editor.fontSize": Math.max(8, getState().settings["editor.fontSize"] - 1),
      }),
  },
  {
    id: "editor.changeLanguage",
    title: "Change Language Mode…",
    category: "View",
    run: pickLanguageMode,
  },
  {
    id: "view.toggleTheme",
    title: "Toggle Light/Dark Theme",
    category: "Preferences",
    run: toggleTheme,
  },
  {
    id: "settings.open",
    title: "Settings",
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

  // Run
  {
    id: "run.activeFile",
    title: "Run Current File",
    category: "Run",
    keybinding: ["Mod+F5"],
    run: runActiveFile,
  },
  {
    id: "run.debug",
    title: "Start Debugging",
    category: "Run",
    keybinding: ["F5"],
    run: startDebugging,
  },
  {
    id: "run.stop",
    title: "Stop Running Program",
    category: "Run",
    keybinding: ["Shift+F5"],
    run: stopRunningProgram,
  },
  {
    id: "run.previewHtml",
    title: "Preview HTML File",
    category: "Run",
    run: previewActiveHtml,
  },
  {
    id: "run.previewUrl",
    title: "Open Localhost Preview…",
    category: "Run",
    run: promptLocalhostPreview,
  },

  // Terminal
  {
    id: "terminal.toggle",
    title: "Terminal",
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
    id: "terminal.newWithProfile",
    title: "New Terminal With Profile…",
    category: "Terminal",
    run: pickTerminalProfile,
  },
  {
    id: "terminal.split",
    title: "Split Terminal",
    category: "Terminal",
    keybinding: ["Mod+Shift+5"],
    run: () => createTerminal({ split: true }),
  },
  { id: "terminal.clear", title: "Clear Terminal", category: "Terminal", run: clearActiveTerminal },
  {
    id: "terminal.kill",
    title: "Close Terminal",
    category: "Terminal",
    run: closeActiveTerminal,
  },

  // Help
  { id: "help.docs", title: "Documentation", category: "Help", run: openDocumentation },
  {
    id: "help.shortcuts",
    title: "Keyboard Shortcuts",
    category: "Help",
    run: openShortcutsTab,
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
  NumpadAdd: "=",
  NumpadSubtract: "-",
  Numpad0: "0",
};

function keyName(event: KeyboardEvent): string | null {
  const { code } = event;
  if (/^Key[A-Z]$/.test(code)) return code.slice(3);
  if (/^Digit\d$/.test(code)) return code.slice(5);
  if (/^F\d{1,2}$/.test(code)) return code;
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

/** Every shortcut of a command, for the Keyboard Shortcuts page. */
export function allShortcutsFor(command: Command): string[] {
  const chords = [...(command.keybinding ?? [])];
  if (command.editorKeybinding) chords.push(command.editorKeybinding);
  return chords.map(formatChord);
}
