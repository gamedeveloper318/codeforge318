import type { LspMessage } from "@shared/ipc";
import { logOutput, toast } from "../actions/notify";
import { api, errorMessage } from "../lib/bridge";
import { monaco } from "../monaco/setup";
import { getState } from "../state/store";

type Listener = (event: { data: LspMessage }) => void;

let started = false;
const listeners = new Set<Listener>();

/**
 * Connects Monaco's built-in LSP client to the Pyright language server that
 * the main process runs. Monaco's client expects something shaped like a web
 * worker; this port forwards its messages over CodeForge's IPC bridge.
 */
async function start(): Promise<void> {
  started = true;
  try {
    await api.invoke("lsp:start", "python");
  } catch (error) {
    started = false;
    logOutput(`Python IntelliSense is not running: ${errorMessage(error)}`);
    return;
  }
  const port = {
    postMessage: (message: LspMessage) => api.send("lsp:send", "python", message),
    addEventListener: (_type: string, listener: Listener) => listeners.add(listener),
    removeEventListener: (_type: string, listener: Listener) => listeners.delete(listener),
  };
  new monaco.lsp.MonacoLspClient(monaco.lsp.createTransportToWorker(port as unknown as Worker));
  logOutput("Python IntelliSense started (Pyright language server)");
}

/** Starts Python IntelliSense the first time a Python file is opened. */
export function setupPythonLanguageServer(): void {
  api.on("lsp:message", ({ language, message }) => {
    if (language === "python") for (const listener of listeners) listener({ data: message });
  });
  api.on("lsp:stopped", ({ reason }) => {
    toast(
      "error",
      "Python IntelliSense stopped",
      `${reason} Restart CodeForge to turn it back on.`,
    );
  });

  const consider = (model: monaco.editor.ITextModel) => {
    if (started || model.uri.scheme !== "file" || model.getLanguageId() !== "python") return;
    if (!getState().settings["python.languageServer"]) return;
    void start();
  };
  monaco.editor.onDidCreateModel(consider);
  monaco.editor.getModels().forEach(consider);
}
