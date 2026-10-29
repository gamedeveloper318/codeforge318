import type { CodeForgeBridge } from "@shared/ipc";

/** Typed access to the preload bridge (window.codeforge). */
export const api: CodeForgeBridge = window.codeforge;

export const isMac = api.platform === "darwin";
export const isWindows = api.platform === "win32";

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
