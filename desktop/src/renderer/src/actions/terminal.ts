import type { TerminalProfile, TerminalSession } from "@shared/ipc";
import { api } from "../lib/bridge";
import { getState, setState, type TerminalState } from "../state/store";
import {
  clearXterm,
  createXterm,
  disposeXterm,
  focusXterm,
  writeToXterm,
} from "../terminal/xterm-manager";
import { logOutput, reportError, toast } from "./notify";

/** Most terminals shown side by side in one split group. */
export const MAX_SPLIT_PANES = 4;

export function showPanel(view: "terminal" | "problems" | "output"): void {
  setState({ panelVisible: true, panelView: view });
}

/** Adds a started terminal session to the panel and focuses it. */
function addTerminal(
  session: TerminalSession,
  options: { name?: string; group?: number; purpose?: TerminalState["purpose"] },
): void {
  createXterm(session.id, getState().settings);
  const sameProfile = getState().terminals.filter((t) => t.profile === session.profile).length;
  const title =
    options.name ?? (sameProfile ? `${session.title} ${sameProfile + 1}` : session.title);
  setState({
    terminals: [
      ...getState().terminals,
      {
        id: session.id,
        group: options.group ?? session.id,
        title,
        pid: session.pid,
        profile: session.profile,
        purpose: options.purpose,
        exited: false,
      },
    ],
    activeTerminalId: session.id,
  });
  window.setTimeout(() => focusXterm(session.id), 50);
}

/**
 * Starts a real shell (the default terminal profile unless `profile` is given).
 * When `command` is given it is typed into the new shell on the user's behalf;
 * it only ever runs because the user clicked something.
 */
export async function createTerminal(
  options: {
    cwd?: string;
    command?: string;
    name?: string;
    split?: boolean;
    profile?: string;
  } = {},
): Promise<number | null> {
  showPanel("terminal");
  const { terminals, activeTerminalId } = getState();
  const splitFrom = options.split ? terminals.find((t) => t.id === activeTerminalId) : undefined;
  if (splitFrom && terminals.filter((t) => t.group === splitFrom.group).length >= MAX_SPLIT_PANES) {
    toast("info", `A split can show up to ${MAX_SPLIT_PANES} terminals side by side.`);
    return null;
  }
  try {
    const session = await api.invoke("terminal:create", {
      cols: 100,
      rows: 24,
      cwd: options.cwd,
      profile: options.profile,
    });
    addTerminal(session, { name: options.name, group: splitFrom?.group });
    if (options.command) {
      logOutput(`Running in terminal "${options.name ?? session.title}": ${options.command}`);
      api.send("terminal:write", session.id, `${options.command}\r`);
    }
    return session.id;
  } catch (error) {
    reportError("Could not start a terminal", error);
    return null;
  }
}

/** Starts Run / Start Debugging for a file in its own terminal. */
export async function createProgramTerminal(
  file: string,
  mode: "run" | "debug",
): Promise<number | null> {
  showPanel("terminal");
  try {
    const session = await api.invoke("run:start", { file, mode, cols: 100, rows: 24 });
    addTerminal(session, { name: session.title, purpose: mode });
    return session.id;
  } catch (error) {
    reportError(mode === "debug" ? "Could not start debugging" : "Could not run the file", error);
    return null;
  }
}

/** Terminal > New Terminal With Profile…: PowerShell, Command Prompt, Git Bash, ... */
export async function pickTerminalProfile(): Promise<void> {
  let profiles: TerminalProfile[];
  let defaultId: string;
  try {
    ({ profiles, defaultId } = await api.invoke("terminal:profiles"));
  } catch (error) {
    reportError("Could not list the installed shells", error);
    return;
  }
  setState({
    quickPick: {
      kind: "list",
      placeholder: "Select the shell for the new terminal",
      items: profiles.map((p) => ({
        id: p.id,
        label: p.name,
        description: p.id === defaultId ? "default" : undefined,
      })),
      onPick: (item) => void createTerminal({ profile: item.id }),
    },
  });
}

export async function toggleTerminal(): Promise<void> {
  const { panelVisible, panelView, terminals } = getState();
  if (panelVisible && panelView === "terminal") {
    setState({ panelVisible: false });
    return;
  }
  showPanel("terminal");
  if (!terminals.length) await createTerminal();
}

export async function killTerminal(id: number): Promise<void> {
  const terminal = getState().terminals.find((t) => t.id === id);
  if (!terminal) return;
  if (!terminal.exited) await api.invoke("terminal:kill", id).catch(() => undefined);
  disposeXterm(id);
  const remaining = getState().terminals.filter((t) => t.id !== id);
  // Stay in the same split group when one of its panes closes.
  const sibling = remaining.filter((t) => t.group === terminal.group).at(-1);
  const activeTerminalId =
    getState().activeTerminalId === id
      ? (sibling?.id ?? remaining.at(-1)?.id ?? null)
      : getState().activeTerminalId;
  setState({ terminals: remaining, activeTerminalId });
}

/** Terminal > Close Terminal. */
export async function closeActiveTerminal(): Promise<void> {
  const id = getState().activeTerminalId;
  if (id === null) {
    toast("info", "There is no terminal to close.");
    return;
  }
  await killTerminal(id);
}

/** Terminal > Clear Terminal: clears the screen and scrollback of the active terminal. */
export function clearActiveTerminal(): void {
  const { activeTerminalId } = getState();
  if (activeTerminalId === null) {
    toast("info", "There is no terminal to clear.", "Open one with Terminal > New Terminal.");
    return;
  }
  showPanel("terminal");
  clearXterm(activeTerminalId);
  focusXterm(activeTerminalId);
}

export function handleTerminalData(id: number, data: string): void {
  writeToXterm(id, data);
}

export function handleTerminalExit(id: number, exitCode: number): void {
  const terminal = getState().terminals.find((t) => t.id === id);
  const what = terminal?.purpose ? "program" : "process";
  writeToXterm(id, `\r\n\x1b[90m[CodeForge: ${what} exited with code ${exitCode}]\x1b[0m\r\n`);
  setState({
    terminals: getState().terminals.map((t) =>
      t.id === id ? { ...t, exited: true, exitCode } : t,
    ),
  });
}
