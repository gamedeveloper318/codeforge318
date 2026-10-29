import type { CodeForgeBridge } from "../shared/ipc";

declare global {
  interface Window {
    codeforge: CodeForgeBridge;
  }
}

export {};
