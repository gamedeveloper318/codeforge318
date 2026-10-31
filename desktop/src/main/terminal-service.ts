import { statSync } from "node:fs";
import path from "node:path";
import * as pty from "@lydell/node-pty";
import type { EventChannels, TerminalProfile, TerminalSession } from "@shared/ipc";
import { displayCommand, quotePowerShell } from "@shared/run-plan";
import type { Settings } from "@shared/settings";
import { childProcessEnv } from "./env";
import { findExecutable, type LookupOptions } from "./runtime";

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

interface ProfileDefinition extends TerminalProfile {
  file: string;
  args: string[];
}

const lookupDefaults = (): LookupOptions => ({
  platform: process.platform,
  env: process.env,
  isFile: (file) => {
    try {
      return statSync(file).isFile();
    } catch {
      return false;
    }
  },
});

/**
 * The shells installed on this computer: Windows PowerShell and Command Prompt
 * always, PowerShell 7 and Git Bash when present; the login shell elsewhere.
 * A custom `terminal.shell` path is offered first.
 */
export function detectProfiles(
  customShell: string,
  options: LookupOptions = lookupDefaults(),
): ProfileDefinition[] {
  const profiles: ProfileDefinition[] = [];
  const custom = customShell.trim();
  if (custom) {
    profiles.push({
      id: "custom",
      name: path.basename(custom).replace(/\.exe$/i, ""),
      kind: /powershell|pwsh/i.test(custom)
        ? "powershell"
        : /cmd(\.exe)?$/i.test(custom)
          ? "cmd"
          : "posix",
      file: custom,
      args: [],
    });
  }
  const env = options.env;
  const get = (name: string) => env[Object.keys(env).find((k) => k.toUpperCase() === name) ?? name];
  if (options.platform === "win32") {
    const systemRoot = get("SYSTEMROOT") ?? "C:\\Windows";
    const programFiles = get("PROGRAMFILES") ?? "C:\\Program Files";
    const windowsPowerShell = path.win32.join(
      systemRoot,
      "System32",
      "WindowsPowerShell",
      "v1.0",
      "powershell.exe",
    );
    profiles.push({
      id: "powershell",
      name: "PowerShell",
      kind: "powershell",
      file: options.isFile(windowsPowerShell) ? windowsPowerShell : "powershell.exe",
      args: ["-NoLogo"],
    });
    const pwsh =
      [path.win32.join(programFiles, "PowerShell", "7", "pwsh.exe")].find(options.isFile) ??
      findExecutable("pwsh", options);
    if (pwsh)
      profiles.push({
        id: "pwsh",
        name: "PowerShell 7",
        kind: "powershell",
        file: pwsh,
        args: ["-NoLogo"],
      });
    profiles.push({
      id: "cmd",
      name: "Command Prompt",
      kind: "cmd",
      file: get("COMSPEC") ?? path.win32.join(systemRoot, "System32", "cmd.exe"),
      args: [],
    });
    const gitBash = path.win32.join(programFiles, "Git", "bin", "bash.exe");
    if (options.isFile(gitBash))
      profiles.push({
        id: "git-bash",
        name: "Git Bash",
        kind: "posix",
        file: gitBash,
        args: ["--login", "-i"],
      });
    return profiles;
  }
  const login = get("SHELL") || "/bin/bash";
  const loginArgs = options.platform === "darwin" ? ["-l"] : [];
  profiles.push({
    id: path.posix.basename(login),
    name: path.posix.basename(login),
    kind: "posix",
    file: login,
    args: loginArgs,
  });
  for (const shell of ["/bin/bash", "/bin/zsh", "/usr/bin/fish"]) {
    const id = path.posix.basename(shell);
    if (shell !== login && options.isFile(shell) && !profiles.some((p) => p.id === id))
      profiles.push({ id, name: id, kind: "posix", file: shell, args: loginArgs });
  }
  return profiles;
}

/** The profile a new terminal uses: the requested one, else the default setting, else the first. */
export function chooseProfile(
  profiles: ProfileDefinition[],
  requested: string | undefined,
  defaultId: string,
): ProfileDefinition {
  return (
    profiles.find((p) => p.id === requested) ??
    profiles.find((p) => p.id === "custom") ??
    profiles.find((p) => p.id === defaultId) ??
    profiles[0]
  );
}

/** A program started for Run / Start Debugging, already located by the runtime lookup. */
export interface ProgramLaunch {
  program: string;
  args: string[];
  name: string;
}

/**
 * Integrated terminals backed by real pseudo-terminals (ConPTY on Windows).
 * Output is batched every few milliseconds so fast commands do not flood IPC.
 */
export class TerminalService {
  private readonly sessions = new Map<number, Session>();
  private nextId = 1;
  private profileCache: ProfileDefinition[] | null = null;
  private profileCacheKey = "";

  constructor(
    private readonly emit: Emit,
    private readonly settings: () => Settings,
  ) {}

  profiles(): { profiles: TerminalProfile[]; defaultId: string } {
    const all = this.profileDefinitions();
    const chosen = chooseProfile(all, undefined, this.settings()["terminal.defaultProfile"]);
    return {
      profiles: all.map(({ id, name, kind }) => ({ id, name, kind })),
      defaultId: chosen.id,
    };
  }

  private profileDefinitions(): ProfileDefinition[] {
    const key = this.settings()["terminal.shell"];
    if (!this.profileCache || this.profileCacheKey !== key) {
      this.profileCache = detectProfiles(key);
      this.profileCacheKey = key;
    }
    return this.profileCache;
  }

  /** Starts an interactive shell. */
  create(options: { cols: number; rows: number; cwd: string; profile?: string }): TerminalSession {
    const profile = chooseProfile(
      this.profileDefinitions(),
      options.profile,
      this.settings()["terminal.defaultProfile"],
    );
    return this.spawn(profile.file, profile.args, options, {
      title: profile.name,
      profile: profile.name,
    });
  }

  /**
   * Starts a program (Run / Start Debugging) directly in a terminal, so the
   * terminal shows when it ends and its exit code. Programs that aren't .exe
   * files (npx.cmd, scripts) start through PowerShell on Windows, which quotes
   * arguments safely.
   */
  createProgram(
    launch: ProgramLaunch,
    options: { cols: number; rows: number; cwd: string },
  ): TerminalSession {
    let file = launch.program;
    let args = launch.args;
    if (process.platform === "win32" && !/\.exe$/i.test(file)) {
      const script = `& ${[file, ...args].map(quotePowerShell).join(" ")}; exit $LASTEXITCODE`;
      file = "powershell.exe";
      args = ["-NoLogo", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", script];
    }
    const session = this.spawn(file, args, options, { title: launch.name, profile: "Program" });
    this.emit("terminal:data", {
      id: session.id,
      data: `\x1b[90m> ${displayCommand(path.basename(launch.program), launch.args)}\x1b[0m\r\n`,
    });
    return session;
  }

  private spawn(
    file: string,
    args: string[],
    options: { cols: number; rows: number; cwd: string },
    labels: { title: string; profile: string },
  ): TerminalSession {
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
      throw new Error(`Could not start "${file}": ${(error as Error).message}`, { cause: error });
    }

    const id = this.nextId++;
    const info: TerminalSession = {
      id,
      shell: file,
      cwd: options.cwd,
      pid: proc.pid,
      title: labels.title,
      profile: labels.profile,
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

  isRunning(id: number): boolean {
    return this.sessions.has(id);
  }

  get count(): number {
    return this.sessions.size;
  }
}
