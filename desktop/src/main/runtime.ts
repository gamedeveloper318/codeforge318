import { execFile } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import path from "node:path";
import type { RuntimeId } from "@shared/run-plan";
import { childProcessEnv } from "./env";

export interface LookupOptions {
  platform: NodeJS.Platform;
  env: NodeJS.ProcessEnv;
  isFile: (file: string) => boolean;
}

const defaultLookup = (): LookupOptions => ({
  platform: process.platform,
  env: process.env,
  isFile: (file) => {
    try {
      return statSync(file).isFile();
    } catch {
      // App execution aliases (WindowsApps) can't be stat'ed but do exist.
      return existsSync(file);
    }
  },
});

function envValue(env: NodeJS.ProcessEnv, name: string): string | undefined {
  // Windows environment variable names are case-insensitive ("Path" vs "PATH").
  const key = Object.keys(env).find((k) => k.toUpperCase() === name.toUpperCase());
  return key ? env[key] : undefined;
}

/** Finds a program on PATH, like `where` (Windows) or `which`. */
export function findExecutable(
  name: string,
  options: LookupOptions = defaultLookup(),
): string | null {
  const win = options.platform === "win32";
  const join = win ? path.win32.join : path.posix.join;
  const dirs = (envValue(options.env, "PATH") ?? "").split(win ? ";" : ":").filter(Boolean);
  const extensions = win
    ? (envValue(options.env, "PATHEXT") ?? ".COM;.EXE;.BAT;.CMD").split(";").filter(Boolean)
    : [""];
  const hasExtension = win && /\.[a-z0-9]+$/i.test(name);
  for (const dir of dirs) {
    const clean = dir.replace(/^"(.*)"$/, "$1");
    for (const ext of hasExtension ? [""] : extensions) {
      const candidate = join(clean, name + ext.toLowerCase());
      if (options.isFile(candidate)) return candidate;
    }
  }
  return null;
}

/** Windows ships "python.exe" shortcuts that only open the Microsoft Store. */
export function isStoreAlias(file: string): boolean {
  return /[\\/]Microsoft[\\/]WindowsApps[\\/]python[0-9.]*\.exe$/i.test(file);
}

function versionOf(file: string): Promise<string | null> {
  return new Promise((resolve) => {
    execFile(
      file,
      ["--version"],
      { timeout: 5000, windowsHide: true, env: childProcessEnv() },
      (error, stdout, stderr) => {
        if (error) resolve(null);
        else resolve((stdout || stderr).toString().trim().split(/\r?\n/)[0] || "");
      },
    );
  });
}

const CANDIDATES: Record<RuntimeId, { win32: string[]; posix: string[] }> = {
  python: { win32: ["python", "py"], posix: ["python3", "python"] },
  node: { win32: ["node"], posix: ["node"] },
  npx: { win32: ["npx"], posix: ["npx"] },
  powershell: { win32: ["powershell"], posix: ["pwsh"] },
  bash: { win32: ["bash"], posix: ["bash"] },
  ruby: { win32: ["ruby"], posix: ["ruby"] },
  php: { win32: ["php"], posix: ["php"] },
  go: { win32: ["go"], posix: ["go"] },
  lua: { win32: ["lua", "lua54", "lua53"], posix: ["lua", "lua5.4", "lua5.3"] },
  dart: { win32: ["dart"], posix: ["dart"] },
  java: { win32: ["java"], posix: ["java"] },
};

/** Well-known install locations that are often missing from PATH on Windows. */
function windowsExtras(id: RuntimeId, env: NodeJS.ProcessEnv): string[] {
  const systemRoot = envValue(env, "SystemRoot") ?? "C:\\Windows";
  const programFiles = envValue(env, "ProgramFiles") ?? "C:\\Program Files";
  if (id === "powershell")
    return [path.win32.join(systemRoot, "System32", "WindowsPowerShell", "v1.0", "powershell.exe")];
  if (id === "bash") return [path.win32.join(programFiles, "Git", "bin", "bash.exe")];
  return [];
}

export interface ResolvedRuntime {
  path: string;
  version: string | null;
}

/**
 * Locates the program for a runtime. Returns null when it isn't installed, so
 * the UI can explain what to install instead of failing in the terminal.
 */
export async function resolveRuntime(
  id: RuntimeId,
  options: LookupOptions = defaultLookup(),
): Promise<ResolvedRuntime | null> {
  const win = options.platform === "win32";
  // Git Bash before PATH: on Windows "bash" on PATH is often WSL's launcher.
  const extras = win ? windowsExtras(id, options.env) : [];
  for (const extra of extras) {
    if (options.isFile(extra)) return { path: extra, version: null };
  }
  for (const name of CANDIDATES[id][win ? "win32" : "posix"]) {
    const found = findExecutable(name, options);
    if (!found) continue;
    if (id === "python") {
      // Only a working interpreter counts (the Store alias exits with an error).
      const version = await versionOf(found);
      if (version === null || (isStoreAlias(found) && !/^Python \d/.test(version))) continue;
      return { path: found, version };
    }
    return { path: found, version: null };
  }
  return null;
}
