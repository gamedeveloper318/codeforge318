import { Search } from "lucide-react";
import { useCallback, useLayoutEffect, useRef, useState } from "react";
import logo from "../assets/logo.svg";
import { openRecent } from "../actions/workspace";
import { getCommand, runCommand, shortcutFor } from "../commands/commands";
import { isMac } from "../lib/bridge";
import { basename } from "../lib/paths";
import { getState, setState, useStore, type MenuItem, type WorkbenchState } from "../state/store";
import { Menu } from "./Menu";

type MenuEntry = string | "-" | { submenu: "recent" };

interface TitleMenu {
  label: string;
  /** Alt+<mnemonic> opens the menu from the keyboard. */
  mnemonic: string;
  entries: MenuEntry[];
}

export const MENUS: TitleMenu[] = [
  {
    label: "File",
    mnemonic: "F",
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
      "-",
      "file.exit",
    ],
  },
  {
    label: "Edit",
    mnemonic: "E",
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
      "edit.selectAll",
      "-",
      "edit.toggleComment",
      "edit.format",
    ],
  },
  {
    label: "Selection",
    mnemonic: "S",
    entries: [
      "edit.selectAll",
      "edit.selectLine",
      "edit.expandSelection",
      "edit.shrinkSelection",
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
    mnemonic: "V",
    entries: [
      "view.commandPalette",
      "-",
      "view.explorer",
      "view.search",
      "view.scm",
      "view.run",
      "-",
      "terminal.toggle",
      "view.problems",
      "view.output",
      "-",
      "view.toggleSidebar",
      "view.togglePanel",
      "view.wordWrap",
      "view.minimap",
      "-",
      "view.zoomIn",
      "view.zoomOut",
      "view.zoomReset",
      "-",
      "view.toggleTheme",
    ],
  },
  {
    label: "Go",
    mnemonic: "G",
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
  {
    label: "Run",
    mnemonic: "R",
    entries: ["run.activeFile", "run.debug", "run.stop", "-", "run.previewHtml", "run.previewUrl"],
  },
  {
    label: "Terminal",
    mnemonic: "T",
    entries: [
      "terminal.new",
      "terminal.newWithProfile",
      "terminal.split",
      "-",
      "terminal.clear",
      "terminal.kill",
    ],
  },
  {
    label: "Help",
    mnemonic: "H",
    entries: [
      "help.docs",
      "help.shortcuts",
      "-",
      "help.checkUpdates",
      "help.devtools",
      "-",
      "help.about",
    ],
  },
];

/** Alt+F, Alt+E, ...: the title-bar menu for a key code, if any (Windows/Linux only). */
export function menuForMnemonic(event: KeyboardEvent): number | null {
  if (isMac || !event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return null;
  const letter = /^Key([A-Z])$/.exec(event.code)?.[1];
  const index = MENUS.findIndex((menu) => menu.mnemonic === letter);
  return index === -1 ? null : index;
}

function menuItems(entries: MenuEntry[], state: WorkbenchState): MenuItem[] {
  const items: MenuItem[] = [];
  for (const entry of entries) {
    if (entry === "-") items.push({ separator: true });
    else if (typeof entry === "object") {
      for (const root of state.recent.slice(0, 6)) {
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
          checked: command.checked?.(state),
          run: () => runCommand(entry),
        });
    }
  }
  return items;
}

export function TitleBar() {
  const workspace = useStore((s) => s.workspace);
  const openIndex = useStore((s) => s.openMenu);
  // While a menu is open, re-render on changes so check marks (Auto Save, ...) stay current.
  const state = useStore((s) => (s.openMenu === null ? null : s));
  const navRef = useRef<HTMLElement>(null);
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [anchor, setAnchor] = useState<{ x: number; y: number } | null>(null);

  useLayoutEffect(() => {
    const button = openIndex === null ? null : buttonRefs.current[openIndex];
    if (!button) {
      setAnchor(null);
      return;
    }
    const rect = button.getBoundingClientRect();
    setAnchor({ x: rect.left, y: rect.bottom + 2 });
  }, [openIndex]);

  const close = useCallback(() => setState({ openMenu: null }), []);
  const navigate = useCallback((direction: -1 | 1) => {
    const current = getState().openMenu ?? 0;
    setState({ openMenu: (current + direction + MENUS.length) % MENUS.length });
  }, []);

  return (
    <header className={`titlebar${isMac ? " mac" : ""}`}>
      <img className="titlebar-logo" src={logo} alt="" draggable={false} />
      {!isMac && (
        <nav className="menubar" aria-label="Main menu" ref={navRef} role="menubar">
          {MENUS.map((menu, index) => (
            <button
              key={menu.label}
              ref={(el) => {
                buttonRefs.current[index] = el;
              }}
              role="menuitem"
              aria-haspopup="menu"
              aria-expanded={openIndex === index}
              title={`${menu.label} (Alt+${menu.mnemonic})`}
              className={`menubar-item${openIndex === index ? " open" : ""}`}
              data-testid={`menubar-${menu.label.toLowerCase()}`}
              onMouseDown={(e) => {
                if (e.button !== 0) return;
                e.preventDefault();
                setState({ openMenu: openIndex === index ? null : index });
              }}
              onMouseEnter={() => {
                if (openIndex !== null && openIndex !== index) setState({ openMenu: index });
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
                  e.preventDefault();
                  setState({ openMenu: index });
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
      {openIndex !== null && anchor && state && (
        <Menu
          key={openIndex}
          x={anchor.x}
          y={anchor.y}
          label={MENUS[openIndex].label}
          items={menuItems(MENUS[openIndex].entries, state)}
          onClose={close}
          onNavigate={navigate}
          ignoreRef={navRef}
        />
      )}
    </header>
  );
}
