import { errorMessage } from "../lib/bridge";
import { getState, setState, type Toast } from "../state/store";

let nextToastId = 1;
const MAX_OUTPUT_LINES = 2000;

export function toast(kind: Toast["kind"], message: string, detail?: string): void {
  const id = nextToastId++;
  setState({ toasts: [...getState().toasts.slice(-3), { id, kind, message, detail }] });
  window.setTimeout(() => dismissToast(id), kind === "error" ? 9000 : 4500);
}

export function dismissToast(id: number): void {
  setState({ toasts: getState().toasts.filter((t) => t.id !== id) });
}

/** Appends to the Output panel, the running log of what CodeForge did. */
export function logOutput(text: string, level: "info" | "error" = "info"): void {
  const time = new Date().toLocaleTimeString();
  const output = [...getState().output, { time, text, level }];
  setState({ output: output.length > MAX_OUTPUT_LINES ? output.slice(-MAX_OUTPUT_LINES) : output });
}

/** Shows an error toast and logs it. Use for failures the user should see. */
export function reportError(context: string, error: unknown): void {
  const message = errorMessage(error);
  logOutput(`${context}: ${message}`, "error");
  toast("error", context, message);
}
