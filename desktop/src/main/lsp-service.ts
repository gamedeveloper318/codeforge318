import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import type { LspMessage } from "@shared/ipc";
import { childProcessEnv } from "./env";

/** Content-Length framed JSON-RPC, as spoken by language servers over stdio. */
export class MessageReader {
  private buffer = Buffer.alloc(0);

  constructor(private readonly onMessage: (message: LspMessage) => void) {}

  push(chunk: Buffer): void {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    for (;;) {
      const headerEnd = this.buffer.indexOf("\r\n\r\n");
      if (headerEnd === -1) return;
      const header = this.buffer.subarray(0, headerEnd).toString("ascii");
      const start = headerEnd + 4;
      const match = /Content-Length:\s*(\d+)/i.exec(header);
      if (!match) {
        this.buffer = this.buffer.subarray(start); // skip a malformed header block
        continue;
      }
      const end = start + Number(match[1]);
      if (this.buffer.length < end) return; // wait for the rest of the body
      const body = this.buffer.subarray(start, end).toString("utf8");
      this.buffer = this.buffer.subarray(end);
      try {
        this.onMessage(JSON.parse(body) as LspMessage);
      } catch {
        // ignore a body that isn't valid JSON
      }
    }
  }
}

export function encodeMessage(message: LspMessage): Buffer {
  const body = Buffer.from(JSON.stringify(message), "utf8");
  return Buffer.concat([Buffer.from(`Content-Length: ${body.length}\r\n\r\n`, "ascii"), body]);
}

/** Server capabilities that become editor features; they are limited to the server's language. */
const FEATURE_CAPABILITIES = [
  "completionProvider",
  "hoverProvider",
  "signatureHelpProvider",
  "declarationProvider",
  "definitionProvider",
  "typeDefinitionProvider",
  "implementationProvider",
  "referencesProvider",
  "documentHighlightProvider",
  "documentSymbolProvider",
  "codeActionProvider",
  "codeLensProvider",
  "documentLinkProvider",
  "colorProvider",
  "documentFormattingProvider",
  "documentRangeFormattingProvider",
  "documentOnTypeFormattingProvider",
  "renameProvider",
  "foldingRangeProvider",
  "selectionRangeProvider",
  "callHierarchyProvider",
  "semanticTokensProvider",
  "linkedEditingRangeProvider",
  "inlayHintProvider",
  "inlineValueProvider",
  "diagnosticProvider",
];

type Params = Record<string, unknown> & { textDocument?: { uri?: string; languageId?: string } };

export interface LspBridgeOptions {
  languageId: string;
  workspaceRoot: () => string | null;
  toServer: (message: LspMessage) => void;
  toClient: (message: LspMessage) => void;
}

/**
 * Sits between Monaco's LSP client and the language server:
 * - only documents of the server's language, saved on disk, reach the server;
 * - the server's features are registered for that language only;
 * - the server is told which folder is open;
 * - server requests the editor doesn't implement are answered here.
 */
export class LspBridge {
  /** Open documents (lower-cased URI) and the messages that opened and edited them. */
  private readonly openDocuments = new Map<string, LspMessage[]>();
  private initializeId: unknown;
  private initializeRequest: LspMessage | null = null;
  private readonly replayIds = new Set<string>();
  private replayCount = 0;

  constructor(private readonly options: LspBridgeOptions) {}

  private workspaceFolders() {
    const root = this.options.workspaceRoot();
    if (!root) return { rootUri: null, rootPath: null, workspaceFolders: null };
    const uri = pathToFileURL(root).href;
    return { rootUri: uri, rootPath: root, workspaceFolders: [{ uri, name: path.basename(root) }] };
  }

  private withWorkspace(request: LspMessage): LspMessage {
    const params = (request.params ?? {}) as Params;
    return {
      ...request,
      params: { ...params, processId: process.pid, ...this.workspaceFolders() },
    };
  }

  private scope(options: unknown): unknown {
    if (!options) return options;
    const base = typeof options === "object" ? options : {};
    return { ...base, documentSelector: [{ language: this.options.languageId }] };
  }

  /** Editor -> server. */
  fromClient(message: LspMessage): void {
    const method = typeof message.method === "string" ? message.method : undefined;
    const params = (message.params ?? {}) as Params;
    const uri = params.textDocument?.uri;

    if (method === "initialize") {
      this.initializeId = message.id;
      this.initializeRequest = message;
      this.options.toServer(this.withWorkspace(message));
      return;
    }
    if (method === "textDocument/didOpen") {
      const languageId = params.textDocument?.languageId;
      if (languageId !== this.options.languageId || !uri?.startsWith("file:")) return;
      this.openDocuments.set(uri.toLowerCase(), [message]);
      this.options.toServer(message);
      return;
    }
    if (method?.startsWith("textDocument/did")) {
      const history = uri ? this.openDocuments.get(uri.toLowerCase()) : undefined;
      if (!history) return;
      if (method === "textDocument/didClose") this.openDocuments.delete(uri!.toLowerCase());
      else if (method === "textDocument/didChange") history.push(message);
      this.options.toServer(message);
      return;
    }
    // The editor doesn't implement some requests the server sends. An error
    // reply can crash a server that doesn't expect one, so answer "nothing".
    if (
      method === undefined &&
      message.id !== undefined &&
      (message.error as { code?: number } | undefined)?.code === -32601
    ) {
      this.options.toServer({ jsonrpc: "2.0", id: message.id as string | number, result: null });
      return;
    }
    // A question about a document the server never saw gets an empty answer.
    if (message.id !== undefined && uri && !this.openDocuments.has(uri.toLowerCase())) {
      this.options.toClient({ jsonrpc: "2.0", id: message.id as string | number, result: null });
      return;
    }
    this.options.toServer(message);
  }

  /** Server -> editor. */
  fromServer(message: LspMessage): void {
    const method = typeof message.method === "string" ? message.method : undefined;
    const id = message.id as string | number | undefined;

    if (method && id !== undefined) {
      const reply = (result: unknown) =>
        this.options.toServer({ jsonrpc: "2.0", id, result: result ?? null });
      const params = (message.params ?? {}) as {
        items?: unknown[];
        registrations?: { method: string; registerOptions?: unknown }[];
      };
      switch (method) {
        case "workspace/configuration":
          // No editor-side configuration: the server uses its defaults.
          return reply((params.items ?? []).map(() => null));
        case "workspace/workspaceFolders":
          return reply(this.workspaceFolders().workspaceFolders);
        case "window/workDoneProgress/create":
        case "window/showMessageRequest":
          return reply(null);
        case "workspace/diagnostic/refresh":
        case "workspace/semanticTokens/refresh":
        case "workspace/inlayHint/refresh":
        case "workspace/inlineValue/refresh":
        case "workspace/codeLens/refresh":
        case "workspace/foldingRange/refresh":
          return reply(null);
        case "client/registerCapability": {
          const textDocument = (params.registrations ?? [])
            .filter((r) => r.method.startsWith("textDocument/"))
            .map((r) => ({ ...r, registerOptions: this.scope(r.registerOptions ?? {}) }));
          if (!textDocument.length) return reply(null);
          this.options.toClient({ ...message, params: { registrations: textDocument } });
          return;
        }
      }
      this.options.toClient(message);
      return;
    }

    if (id !== undefined && this.replayIds.has(String(id))) {
      this.replayIds.delete(String(id)); // answer to a replayed initialize, not for the editor
      return;
    }
    if (id !== undefined && id === this.initializeId && message.result) {
      const result = message.result as { capabilities?: Record<string, unknown> };
      const capabilities = { ...result.capabilities };
      for (const key of FEATURE_CAPABILITIES) {
        if (capabilities[key]) capabilities[key] = this.scope(capabilities[key]);
      }
      this.options.toClient({ ...message, result: { ...result, capabilities } });
      return;
    }
    if (method === "window/logMessage" || method === "telemetry/event") return;
    this.options.toClient(message);
  }

  /**
   * After a server restart: initialize it the way the editor did, then reopen
   * the documents the editor still has open, with every edit since.
   */
  replayInitialize(): void {
    if (!this.initializeRequest) return;
    const id = `codeforge-replay-${++this.replayCount}`;
    this.replayIds.add(id);
    this.options.toServer({ ...this.withWorkspace(this.initializeRequest), id });
    this.options.toServer({ jsonrpc: "2.0", method: "initialized", params: {} });
    for (const history of this.openDocuments.values())
      history.forEach((m) => this.options.toServer(m));
  }

  get hasInitialized(): boolean {
    return this.initializeRequest !== null;
  }
}

export interface LspServiceOptions {
  languageId: string;
  /** Path of the server's Node.js entry point (run with Electron's built-in Node). */
  serverScript: string;
  args: string[];
  workspaceRoot: () => string | null;
  enabled: () => boolean;
  emitMessage: (message: LspMessage) => void;
  emitStopped: (reason: string) => void;
  log: (level: "info" | "warn" | "error", message: string) => void;
}

const MAX_RESTARTS = 3;

/** Runs one language server process and relays its messages through an LspBridge. */
export class LspService {
  private process: ChildProcessWithoutNullStreams | null = null;
  private readonly bridge: LspBridge;
  private restarts = 0;

  constructor(private readonly options: LspServiceOptions) {
    this.bridge = new LspBridge({
      languageId: options.languageId,
      workspaceRoot: options.workspaceRoot,
      toServer: (message) => this.process?.stdin.write(encodeMessage(message)),
      toClient: options.emitMessage,
    });
  }

  get running(): boolean {
    return this.process !== null;
  }

  start(): void {
    if (this.process) return;
    if (!this.options.enabled()) throw new Error("Python IntelliSense is turned off in Settings.");
    const child = spawn(process.execPath, [this.options.serverScript, ...this.options.args], {
      cwd: this.options.workspaceRoot() ?? os.homedir(),
      // Electron's executable acts as plain Node.js for the server process.
      env: { ...childProcessEnv(), ELECTRON_RUN_AS_NODE: "1" },
      windowsHide: true,
    });
    this.process = child;
    const reader = new MessageReader((message) => this.bridge.fromServer(message));
    child.stdout.on("data", (chunk: Buffer) => reader.push(chunk));
    child.stderr.on("data", (chunk: Buffer) =>
      this.options.log(
        "warn",
        `${this.options.languageId} language server: ${chunk.toString().trim().slice(0, 500)}`,
      ),
    );
    child.on("error", (error) =>
      this.options.log(
        "error",
        `Could not start the ${this.options.languageId} language server: ${error.message}`,
      ),
    );
    child.on("exit", (code) => {
      // A replaced or deliberately stopped process is no longer the current one.
      if (this.process !== child) return;
      this.process = null;
      this.options.log("warn", `${this.options.languageId} language server exited (code ${code})`);
      if (this.restarts < MAX_RESTARTS && this.bridge.hasInitialized) {
        this.restarts++;
        this.restart();
      } else {
        this.options.emitStopped(
          `The ${this.options.languageId} language server stopped (exit code ${code}).`,
        );
      }
    });
    this.options.log(
      "info",
      `Started ${this.options.languageId} language server (pid ${child.pid})`,
    );
  }

  private restart(): void {
    try {
      this.start();
      this.bridge.replayInitialize();
    } catch (error) {
      this.options.emitStopped((error as Error).message);
    }
  }

  /** Message from the editor. With no server running, requests get an empty answer. */
  send(message: LspMessage): void {
    if (this.process) {
      this.bridge.fromClient(message);
    } else if (message.id !== undefined && typeof message.method === "string") {
      this.options.emitMessage({ jsonrpc: "2.0", id: message.id as string | number, result: null });
    }
  }

  /** The open folder changed: restart so the server analyses the new folder. */
  workspaceChanged(): void {
    if (!this.process) return;
    this.stop();
    this.restart();
  }

  stop(): void {
    const child = this.process;
    this.process = null;
    if (!child) return;
    try {
      child.stdin.end();
      child.kill();
    } catch {
      // already gone
    }
  }
}
