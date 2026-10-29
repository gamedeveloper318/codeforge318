import { FitAddon } from "@xterm/addon-fit";
import { Terminal, type ITheme } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";
import type { Settings } from "@shared/settings";
import { api } from "../lib/bridge";

/**
 * xterm.js instances live outside React so their scrollback survives when the
 * panel is hidden or another terminal is shown. Each one is connected to a
 * real shell process in the main process by its id.
 */
interface Instance {
  term: Terminal;
  fit: FitAddon;
  element: HTMLDivElement;
  opened: boolean;
}

const instances = new Map<number, Instance>();
const earlyData = new Map<number, string>();

const DARK: ITheme = {
  background: "#0b1120",
  foreground: "#e2e8f0",
  cursor: "#22d3ee",
  cursorAccent: "#0b1120",
  selectionBackground: "#3b82f655",
  black: "#1e293b",
  red: "#f87171",
  green: "#4ade80",
  yellow: "#fbbf24",
  blue: "#60a5fa",
  magenta: "#c084fc",
  cyan: "#22d3ee",
  white: "#e2e8f0",
  brightBlack: "#64748b",
  brightRed: "#fca5a5",
  brightGreen: "#86efac",
  brightYellow: "#fde68a",
  brightBlue: "#93c5fd",
  brightMagenta: "#d8b4fe",
  brightCyan: "#67e8f9",
  brightWhite: "#f8fafc",
};

const LIGHT: ITheme = {
  background: "#f7f8fb",
  foreground: "#0f172a",
  cursor: "#2563eb",
  cursorAccent: "#f7f8fb",
  selectionBackground: "#2563eb33",
  black: "#0f172a",
  red: "#dc2626",
  green: "#15803d",
  yellow: "#a16207",
  blue: "#1d4ed8",
  magenta: "#7c3aed",
  cyan: "#0e7490",
  white: "#cbd5e1",
  brightBlack: "#475569",
  brightRed: "#ef4444",
  brightGreen: "#16a34a",
  brightYellow: "#ca8a04",
  brightBlue: "#2563eb",
  brightMagenta: "#9333ea",
  brightCyan: "#0891b2",
  brightWhite: "#ffffff",
};

function optionsFor(settings: Settings) {
  return {
    fontFamily: settings["editor.fontFamily"],
    fontSize: settings["terminal.fontSize"],
    cursorBlink: settings["terminal.cursorBlink"],
    theme: settings["workbench.colorTheme"] === "codeforge-light" ? LIGHT : DARK,
  };
}

export function createXterm(id: number, settings: Settings): void {
  const term = new Terminal({
    ...optionsFor(settings),
    scrollback: 5000,
    allowProposedApi: false,
    macOptionIsMeta: true,
  });
  const fit = new FitAddon();
  term.loadAddon(fit);
  const element = document.createElement("div");
  element.className = "xterm-instance";
  element.style.width = "100%";
  element.style.height = "100%";

  term.onData((data) => api.send("terminal:write", id, data));
  term.onResize(({ cols, rows }) => api.send("terminal:resize", id, cols, rows));

  // Ctrl+C copies when text is selected (otherwise it interrupts the process);
  // Ctrl+V pastes.
  term.attachCustomKeyEventHandler((event) => {
    if (event.type !== "keydown" || !(event.ctrlKey || event.metaKey) || event.altKey) return true;
    const key = event.key.toLowerCase();
    if (key === "c" && !event.shiftKey && term.hasSelection()) {
      void navigator.clipboard.writeText(term.getSelection());
      term.clearSelection();
      event.preventDefault();
      return false;
    }
    if (key === "v") {
      event.preventDefault();
      void navigator.clipboard.readText().then((text) => term.paste(text));
      return false;
    }
    return true;
  });

  instances.set(id, { term, fit, element, opened: false });
  const pending = earlyData.get(id);
  if (pending) {
    term.write(pending);
    earlyData.delete(id);
  }
}

/** Mounts the terminal into a visible container (opening it the first time). */
export function attachXterm(id: number, container: HTMLElement): void {
  const instance = instances.get(id);
  if (!instance) return;
  if (instance.element.parentElement !== container) {
    container.replaceChildren(instance.element);
  }
  if (!instance.opened) {
    instance.term.open(instance.element);
    instance.opened = true;
  }
  fitXterm(id);
}

export function fitXterm(id: number): void {
  const instance = instances.get(id);
  if (!instance?.opened || !instance.element.isConnected) return;
  try {
    instance.fit.fit();
  } catch {
    // container not measurable yet
  }
}

export function focusXterm(id: number): void {
  instances.get(id)?.term.focus();
}

export function writeToXterm(id: number, data: string): void {
  const instance = instances.get(id);
  if (instance) instance.term.write(data);
  else earlyData.set(id, (earlyData.get(id) ?? "") + data);
}

export function clearXterm(id: number): void {
  instances.get(id)?.term.clear();
}

export function disposeXterm(id: number): void {
  instances.get(id)?.term.dispose();
  instances.delete(id);
  earlyData.delete(id);
}

export function applyXtermSettings(settings: Settings): void {
  const options = optionsFor(settings);
  for (const [id, instance] of instances) {
    instance.term.options.fontFamily = options.fontFamily;
    instance.term.options.fontSize = options.fontSize;
    instance.term.options.cursorBlink = options.cursorBlink;
    instance.term.options.theme = options.theme;
    fitXterm(id);
  }
}
