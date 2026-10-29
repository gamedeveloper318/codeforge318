import { Search } from "lucide-react";
import { useState } from "react";
import logo from "../assets/logo.svg";
import { openRecent } from "../actions/workspace";
import { getCommand, runCommand, shortcutFor } from "../commands/commands";
import { isMac } from "../lib/bridge";
import { basename } from "../lib/paths";
import { setState, useStore, type MenuItem } from "../state/store";
import { Menu } from "./Menu";

type MenuEntry = string | "-" | { submenu: "recent" };

const MENUS: { label: string; entries: MenuEntry[] }[] = [
  {
    label: "File",
    entries: [
      "file.new",
      "file.newInFolder",
      "file.newFolder",
      "-",
      "file.open",
      "file.openFolder",
      { submenu: "recent" },
      "-",
      "file.save",
      "file.saveAs",
      "file.saveAll",
      "file.toggleAutoSave",
      "-",
      "settings.open",
      "-",
      "editor.close",
      "file.closeFolder",
    ],
  },
  {
    label: "Edit",
    entries: [
      "edit.undo",
      "edit.redo",
      "-",
      "edit.cut",
      "edit.copy",
      "edit.paste",
      "-",
      "edit.find",
      "edit.replace",
      "edit.findInFiles",
      "-",
      "edit.toggleComment",
      "edit.format",
    ],
  },
  {
    label: "Selection",
    entries: [
      "edit.selectAll",
      "edit.expandSelection",
      "-",
      "edit.cursorAbove",
      "edit.cursorBelow",
      "edit.selectOccurrences",
      "-",
      "edit.duplicateLine",
    ],
  },
  {
    label: "View",
    entries: [
      "view.commandPalette",
      "-",
      "view.explorer",
      "view.search",
      "view.scm",
      "view.run",
      "-",
      "view.problems",
      "view.output",
      "terminal.toggle",
      "-",
      "view.toggleSidebar",
      "view.togglePanel",
      "view.wordWrap",
      "view.minimap",
      "edit.foldAll",
      "edit.unfoldAll",
      "-",
      "view.zoomIn",
      "view.zoomOut",
      "view.toggleTheme",
    ],
  },
  {
    label: "Go",
    entries: [
      "go.file",
      "go.line",
      "go.symbol",
      "-",
      "go.definition",
      "go.references",
      "go.rename",
      "-",
      "go.nextProblem",
      "editor.next",
      "editor.previous",
    ],
  },
  { label: "Run", entries: ["run.activeFile", "-", "run.previewHtml", "run.previewUrl"] },
  {
    label: "Terminal",
    entries: ["terminal.new", "terminal.toggle", "terminal.clear", "terminal.kill"],
  },
  { label: "Help", entries: ["help.shortcuts", "help.devtools", "-", "help.about"] },
];

function menuItems(entries: MenuEntry[], recent: string[]): MenuItem[] {
  const items: MenuItem[] = [];
  for (const entry of entries) {
    if (entry === "-") items.push({ separator: true });
    else if (typeof entry === "object") {
      for (const root of recent.slice(0, 6)) {
        items.push({
          label: `Open Recent: ${basename(root)}`,
          shortcut: "",
          run: () => void openRecent(root),
        });
      }
    } else {
      const command = getCommand(entry);
      if (command)
        items.push({
          label: command.title,
          shortcut: shortcutFor(command),
          run: () => runCommand(entry),
        });
    }
  }
  return items;
}

export function TitleBar() {
  const workspace = useStore((s) => s.workspace);
  const recent = useStore((s) => s.recent);
  const [open, setOpen] = useState<{ index: number; x: number; y: number } | null>(null);

  const openMenu = (index: number, target: HTMLElement) => {
    const rect = target.getBoundingClientRect();
    setOpen({ index, x: rect.left, y: rect.bottom + 2 });
  };

  return (
    <header className={`titlebar${isMac ? " mac" : ""}`}>
      <img className="titlebar-logo" src={logo} alt="" draggable={false} />
      {!isMac && (
        <nav className="menubar" aria-label="Main menu">
          {MENUS.map((menu, index) => (
            <button
              key={menu.label}
              className={`menubar-item${open?.index === index ? " open" : ""}`}
              onMouseDown={(e) => {
                e.preventDefault();
                if (open?.index === index) setOpen(null);
                else openMenu(index, e.currentTarget);
              }}
              onMouseEnter={(e) => {
                if (open && open.index !== index) openMenu(index, e.currentTarget);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
                  e.preventDefault();
                  openMenu(index, e.currentTarget);
                }
              }}
            >
              {menu.label}
            </button>
          ))}
        </nav>
      )}
      <div className="titlebar-spacer" />
      <button
        className="command-center"
        title="Search files by name (Ctrl+P). Type > for commands."
        onClick={() => setState({ quickPick: { kind: "quick-open", initial: "" } })}
      >
        <Search size={13} />
        <span>{workspace ? workspace.name : "CodeForge"}</span>
      </button>
      <div className="titlebar-spacer" />
      {open && (
        <Menu
          x={open.x}
          y={open.y}
          items={menuItems(MENUS[open.index].entries, recent)}
          onClose={() => setOpen(null)}
        />
      )}
    </header>
  );
}
