import path from "node:path";
import * as pty from "@lydell/node-pty";
import type { EventChannels, TerminalSession } from "@shared/ipc";
import type { Settings } from "@shared/settings";
import { childProcessEnv } from "./env";

type Emit = <K extends "terminal:data" | "terminal:exit">(
  channel: K,
  payload: EventChannels[K],
) => void;

interface Session {
  process: pty.IPty;
  info: TerminalSession;
  pending: string;
  flushTimer: NodeJS.Timeout | null;
}

/** The shell started when `terminal.shell` is empty. */
export function resolveShell(configured: string): { file: string; args: string[] } {
  const custom = configured.trim();
  if (custom) return { file: custom, args: [] };
  if (process.platform === "win32") return { file: "powershell.exe", args: ["-NoLogo"] };
  const shell = process.env.SHELL || "/bin/bash";
  return { file: shell, args: process.platform === "darwin" ? ["-l"] : [] };
}

/**
 * Integrated terminals backed by real pseudo-terminals (ConPTY on Windows).
 * Output is batched every few milliseconds so fast commands do not flood IPC.
 */
export class TerminalService {
  private readonly sessions = new Map<number, Session>();
  private nextId = 1;

  constructor(
    private readonly emit: Emit,
    private readonly settings: () => Settings,
  ) {}

  create(options: { cols: number; rows: number; cwd: string }): TerminalSession {
    const { file, args } = resolveShell(this.settings()["terminal.shell"]);
    let proc: pty.IPty;
    try {
      proc = pty.spawn(file, args, {
        name: "xterm-256color",
        cols: options.cols,
        rows: options.rows,
        cwd: options.cwd,
        env: childProcessEnv({ TERM_PROGRAM: "CodeForge", COLORTERM: "truecolor" }),
      });
    } catch (error) {
      throw new Error(`Could not start the terminal shell "${file}": ${(error as Error).message}`, {
        cause: error,
      });
    }

    const id = this.nextId++;
    const info: TerminalSession = {
      id,
      shell: file,
      cwd: options.cwd,
      pid: proc.pid,
      title: path.basename(file).replace(/\.exe$/i, ""),
    };
    const session: Session = { process: proc, info, pending: "", flushTimer: null };
    this.sessions.set(id, session);

    proc.onData((data) => {
      session.pending += data;
      session.flushTimer ??= setTimeout(() => this.flush(session), 5);
    });
    proc.onExit(({ exitCode }) => {
      this.flush(session);
      this.sessions.delete(id);
      this.emit("terminal:exit", { id, exitCode });
    });
    return info;
  }

  private flush(session: Session): void {
    if (session.flushTimer) clearTimeout(session.flushTimer);
    session.flushTimer = null;
    if (!session.pending) return;
    const data = session.pending;
    session.pending = "";
    this.emit("terminal:data", { id: session.info.id, data });
  }

  write(id: number, data: string): void {
    this.sessions.get(id)?.process.write(data);
  }

  resize(id: number, cols: number, rows: number): void {
    try {
      this.sessions.get(id)?.process.resize(cols, rows);
    } catch {
      // the process may have exited between the resize and this call
    }
  }

  kill(id: number): void {
    const session = this.sessions.get(id);
    if (!session) return;
    try {
      session.process.kill();
    } catch {
      // already gone
    }
  }

  killAll(): void {
    for (const id of [...this.sessions.keys()]) this.kill(id);
  }

  get count(): number {
    return this.sessions.size;
  }
}
