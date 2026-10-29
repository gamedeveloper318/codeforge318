import { appendFileSync, mkdirSync, renameSync, statSync } from "node:fs";
import { join } from "node:path";

const MAX_LOG_BYTES = 5 * 1024 * 1024;
let logFile: string | null = null;

/** Writes to <userData>/logs/codeforge.log, keeping one rotated backup. */
export function initLog(userDataDir: string): string {
  const dir = join(userDataDir, "logs");
  mkdirSync(dir, { recursive: true });
  logFile = join(dir, "codeforge.log");
  try {
    if (statSync(logFile).size > MAX_LOG_BYTES) renameSync(logFile, `${logFile}.1`);
  } catch {
    // no existing log yet
  }
  return logFile;
}

export function log(level: "info" | "warn" | "error", message: string, error?: unknown): void {
  const detail =
    error instanceof Error ? ` ${error.stack ?? error.message}` : error ? ` ${String(error)}` : "";
  const line = `${new Date().toISOString()} [${level}] ${message}${detail}`;
  if (level === "error") console.error(line);
  else console.log(line);
  if (!logFile) return;
  try {
    appendFileSync(logFile, `${line}\n`);
  } catch {
    // logging must never crash the app
  }
}
