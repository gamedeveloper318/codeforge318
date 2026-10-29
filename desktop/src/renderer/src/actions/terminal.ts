import { api } from "../lib/bridge";
import { getState, setState } from "../state/store";
import {
  clearXterm,
  createXterm,
  disposeXterm,
  focusXterm,
  writeToXterm,
} from "../terminal/xterm-manager";
import { logOutput, reportError } from "./notify";

export function showPanel(view: "terminal" | "problems" | "output"): void {
  setState({ panelVisible: true, panelView: view });
}

/**
 * Starts a real shell. When `command` is given it is typed into the new shell
 * on the user's behalf; it only ever runs because the user clicked something.
 */
export async function createTerminal(
  options: { cwd?: string; command?: string; name?: string } = {},
): Promise<number | null> {
  showPanel("terminal");
  try {
    const session = await api.invoke("terminal:create", { cols: 100, rows: 24, cwd: options.cwd });
    createXterm(session.id, getState().settings);
    const count = getState().terminals.length + 1;
    const title = options.name ?? `${session.title} ${count}`;
    setState({
      terminals: [
        ...getState().terminals,
        { id: session.id, title, pid: session.pid, exited: false },
      ],
      activeTerminalId: session.id,
    });
    if (options.command) {
      logOutput(`Running in terminal "${title}": ${options.command}`);
      api.send("terminal:write", session.id, `${options.command}\r`);
    }
    window.setTimeout(() => focusXterm(session.id), 50);
    return session.id;
  } catch (error) {
    reportError("Could not start a terminal", error);
    return null;
  }
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
  const activeTerminalId =
    getState().activeTerminalId === id
      ? (remaining[remaining.length - 1]?.id ?? null)
      : getState().activeTerminalId;
  setState({ terminals: remaining, activeTerminalId });
}

export function clearActiveTerminal(): void {
  const { activeTerminalId } = getState();
  if (activeTerminalId !== null) clearXterm(activeTerminalId);
}

export function handleTerminalData(id: number, data: string): void {
  writeToXterm(id, data);
}

export function handleTerminalExit(id: number, exitCode: number): void {
  writeToXterm(id, `\r\n\x1b[90m[CodeForge: process exited with code ${exitCode}]\x1b[0m\r\n`);
  setState({
    terminals: getState().terminals.map((t) =>
      t.id === id ? { ...t, exited: true, exitCode } : t,
    ),
  });
}
