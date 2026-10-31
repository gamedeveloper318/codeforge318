import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import type { LspMessage } from "@shared/ipc";
import {
  applyContentChanges,
  encodeMessage,
  LspBridge,
  LspService,
  MessageReader,
  withWordRanges,
} from "../../src/main/lsp-service";

describe("MessageReader / encodeMessage", () => {
  it("reassembles messages split across chunks, including multi-byte text", () => {
    const received: LspMessage[] = [];
    const reader = new MessageReader((m) => received.push(m));
    const a = encodeMessage({ jsonrpc: "2.0", method: "a", params: { text: "héllo — ✓" } });
    const b = encodeMessage({ jsonrpc: "2.0", id: 2, result: null });
    const all = Buffer.concat([a, b]);
    reader.push(all.subarray(0, 7));
    reader.push(all.subarray(7, a.length + 3));
    expect(received).toHaveLength(1);
    reader.push(all.subarray(a.length + 3));
    expect(received).toEqual([
      { jsonrpc: "2.0", method: "a", params: { text: "héllo — ✓" } },
      { jsonrpc: "2.0", id: 2, result: null },
    ]);
  });
});

describe("LspBridge", () => {
  function bridge(root: string | null = "C:\\work\\proj") {
    const server: LspMessage[] = [];
    const client: LspMessage[] = [];
    const b = new LspBridge({
      languageId: "python",
      workspaceRoot: () => root,
      toServer: (m) => server.push(m),
      toClient: (m) => client.push(m),
    });
    return { b, server, client };
  }
  const open = (uri: string, languageId = "python") => ({
    jsonrpc: "2.0",
    method: "textDocument/didOpen",
    params: { textDocument: { uri, languageId, version: 1, text: "x = 1" } },
  });

  it("gives completion items the range of the typed word, so the best match ranks first", () => {
    const { b, client } = bridge();
    const uri = "file:///c%3A/work/proj/app.py";
    b.fromClient({
      ...open(uri),
      params: { textDocument: { uri, languageId: "python", text: "x = 1\n" } },
    });
    // The user types "pri" on line 2 (an incremental edit, as the editor sends it).
    b.fromClient({
      jsonrpc: "2.0",
      method: "textDocument/didChange",
      params: {
        textDocument: { uri, version: 2 },
        contentChanges: [
          {
            range: { start: { line: 1, character: 0 }, end: { line: 1, character: 0 } },
            text: "pri",
          },
        ],
      },
    });
    b.fromClient({
      jsonrpc: "2.0",
      id: 7,
      method: "textDocument/completion",
      params: { textDocument: { uri }, position: { line: 1, character: 3 } },
    });
    const keep = {
      range: { start: { line: 1, character: 0 }, end: { line: 1, character: 3 } },
      newText: "x",
    };
    b.fromServer({
      jsonrpc: "2.0",
      id: 7,
      result: {
        isIncomplete: false,
        items: [
          { label: "ProfileFunction" },
          { label: "print", insertText: "print" },
          { label: "x", textEdit: keep },
        ],
      },
    });
    const items = (client.at(-1)!.result as { items: { label: string; textEdit: unknown }[] })
      .items;
    const wordRange = { start: { line: 1, character: 0 }, end: { line: 1, character: 3 } };
    expect(items[0].textEdit).toEqual({ range: wordRange, newText: "ProfileFunction" });
    expect(items[1].textEdit).toEqual({ range: wordRange, newText: "print" });
    expect(items[2].textEdit).toBe(keep);
  });

  it("tracks document text through full and incremental changes", () => {
    const at = (line: number, character: number) => ({ line, character });
    let text = applyContentChanges("hello\nworld", [
      { range: { start: at(1, 0), end: at(1, 5) }, text: "there" },
    ]);
    expect(text).toBe("hello\nthere");
    text = applyContentChanges(text, [
      { range: { start: at(0, 5), end: at(0, 5) }, text: ",\nmy" },
    ]);
    expect(text).toBe("hello,\nmy\nthere");
    expect(applyContentChanges(text, [{ text: "replaced" }])).toBe("replaced");
    expect(withWordRanges(null, "", at(0, 0))).toBeNull();
  });

  it("tells the server which folder is open", () => {
    const { b, server } = bridge();
    b.fromClient({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: { rootUri: null, capabilities: {} },
    });
    const params = server[0].params as {
      rootUri: string;
      workspaceFolders: { name: string }[];
      processId: number;
    };
    expect(params.rootUri).toMatch(/^file:\/\/\/.*proj$/);
    expect(params.workspaceFolders[0].name).toBe("proj");
    expect(params.processId).toBe(process.pid);
  });

  it("limits the server's features to its language", () => {
    const { b, client } = bridge();
    b.fromClient({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} });
    b.fromServer({
      jsonrpc: "2.0",
      id: 1,
      result: {
        capabilities: {
          hoverProvider: true,
          completionProvider: { triggerCharacters: ["."] },
          textDocumentSync: 2,
        },
      },
    });
    const caps = (client[0].result as { capabilities: Record<string, unknown> }).capabilities;
    expect(caps.hoverProvider).toEqual({ documentSelector: [{ language: "python" }] });
    expect(caps.completionProvider).toEqual({
      triggerCharacters: ["."],
      documentSelector: [{ language: "python" }],
    });
    expect(caps.textDocumentSync).toBe(2);
  });

  it("only sends saved Python files to the server", () => {
    const { b, server } = bridge();
    b.fromClient(open("file:///c:/work/proj/app.ts", "typescript"));
    b.fromClient(open("codeforge-diff:/1/original", "python"));
    b.fromClient(open("untitled:Untitled-1", "plaintext"));
    b.fromClient({
      jsonrpc: "2.0",
      method: "textDocument/didChange",
      params: { textDocument: { uri: "file:///c:/work/proj/app.ts" }, contentChanges: [] },
    });
    expect(server).toEqual([]);
    b.fromClient(open("file:///c:/work/proj/main.py"));
    b.fromClient({
      jsonrpc: "2.0",
      method: "textDocument/didChange",
      params: { textDocument: { uri: "file:///C:/work/proj/MAIN.py" }, contentChanges: [] },
    });
    expect(server.map((m) => m.method)).toEqual(["textDocument/didOpen", "textDocument/didChange"]);
  });

  it("answers requests about documents the server never saw", () => {
    const { b, server, client } = bridge();
    b.fromClient({
      jsonrpc: "2.0",
      id: 7,
      method: "textDocument/hover",
      params: {
        textDocument: { uri: "codeforge-diff:/1/original" },
        position: { line: 0, character: 0 },
      },
    });
    expect(server).toEqual([]);
    expect(client).toEqual([{ jsonrpc: "2.0", id: 7, result: null }]);
  });

  it("never lets an unsupported request turn into an error for the server", () => {
    // Regression: Pyright crashed (exit code 1) on the editor's error reply.
    const { b, server, client } = bridge();
    b.fromServer({ jsonrpc: "2.0", id: 1, method: "workspace/diagnostic/refresh" });
    expect(server).toEqual([{ jsonrpc: "2.0", id: 1, result: null }]);
    b.fromServer({ jsonrpc: "2.0", id: 2, method: "window/showDocument", params: {} });
    expect(client.at(-1)?.method).toBe("window/showDocument");
    b.fromClient({ jsonrpc: "2.0", id: 2, error: { code: -32601, message: "No request handler" } });
    expect(server.at(-1)).toEqual({ jsonrpc: "2.0", id: 2, result: null });
  });

  it("reopens documents with their edits after a server restart", () => {
    const { b, server } = bridge();
    b.fromClient({ jsonrpc: "2.0", id: 0, method: "initialize", params: {} });
    b.fromClient(open("file:///c:/work/proj/main.py"));
    const edit = {
      jsonrpc: "2.0",
      method: "textDocument/didChange",
      params: {
        textDocument: { uri: "file:///c:/work/proj/main.py", version: 2 },
        contentChanges: [{ text: "x = 2" }],
      },
    };
    b.fromClient(edit);
    server.length = 0;
    b.replayInitialize();
    expect(server.map((m) => m.method)).toEqual([
      "initialize",
      "initialized",
      "textDocument/didOpen",
      "textDocument/didChange",
    ]);
    expect(server[3]).toEqual(edit);
  });

  it("answers server requests the editor doesn't implement", () => {
    const { b, server, client } = bridge();
    b.fromServer({
      jsonrpc: "2.0",
      id: "c1",
      method: "workspace/configuration",
      params: { items: [{ section: "python" }, { section: "python.analysis" }] },
    });
    b.fromServer({
      jsonrpc: "2.0",
      id: "c2",
      method: "client/registerCapability",
      params: { registrations: [{ id: "w", method: "workspace/didChangeWatchedFiles" }] },
    });
    b.fromServer({
      jsonrpc: "2.0",
      method: "window/logMessage",
      params: { type: 4, message: "noise" },
    });
    expect(server).toEqual([
      { jsonrpc: "2.0", id: "c1", result: [null, null] },
      { jsonrpc: "2.0", id: "c2", result: null },
    ]);
    expect(client).toEqual([]);
  });
});

describe("LspService with the real Pyright language server", () => {
  const require = createRequire(import.meta.url);
  const script = require.resolve("pyright/langserver.index.js");
  let service: LspService | null = null;
  let root: string;

  afterEach(() => {
    service?.stop();
    rmSync(root, { recursive: true, force: true });
  });

  it("reports real type errors and offers completions", async () => {
    root = mkdtempSync(path.join(tmpdir(), "codeforge-pyright-"));
    const file = path.join(root, "app.py");
    const text = "import os\n\ncount: int = 'oops'\nos.\n";
    writeFileSync(file, text);
    const uri = pathToFileURL(file).href;

    const received: LspMessage[] = [];
    service = new LspService({
      languageId: "python",
      serverScript: script,
      args: ["--stdio"],
      workspaceRoot: () => root,
      enabled: () => true,
      emitMessage: (m) => received.push(m),
      emitStopped: () => undefined,
      log: () => undefined,
    });
    service.start();
    const waitFor = async (predicate: (m: LspMessage) => boolean, ms = 60_000) => {
      const deadline = Date.now() + ms;
      for (;;) {
        const found = received.find(predicate);
        if (found) return found;
        if (Date.now() > deadline) throw new Error("Timed out waiting for the language server");
        await new Promise((r) => setTimeout(r, 100));
      }
    };

    service.send({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: { processId: null, rootUri: null, capabilities: {} },
    });
    const init = await waitFor((m) => m.id === 1 && !m.method);
    expect(
      (init.result as { capabilities: { hoverProvider: unknown } }).capabilities.hoverProvider,
    ).toMatchObject({
      documentSelector: [{ language: "python" }],
    });
    service.send({ jsonrpc: "2.0", method: "initialized", params: {} });
    service.send({
      jsonrpc: "2.0",
      method: "textDocument/didOpen",
      params: { textDocument: { uri, languageId: "python", version: 1, text } },
    });

    const diagnostics = await waitFor(
      (m) =>
        m.method === "textDocument/publishDiagnostics" &&
        ((m.params as { diagnostics: unknown[] }).diagnostics?.length ?? 0) > 0,
    );
    const messages = (diagnostics.params as { diagnostics: { message: string }[] }).diagnostics.map(
      (d) => d.message,
    );
    expect(messages.join("\n")).toMatch(/not assignable to declared type "int"/);

    service.send({
      jsonrpc: "2.0",
      id: 2,
      method: "textDocument/completion",
      params: { textDocument: { uri }, position: { line: 3, character: 3 } },
    });
    const completion = await waitFor((m) => m.id === 2 && !m.method);
    const result = completion.result as { items?: { label: string }[] } | { label: string }[];
    const items = Array.isArray(result) ? result : (result.items ?? []);
    expect(items.map((i) => i.label)).toContain("path");
  }, 90_000);

  it("keeps running with the editor's pull-diagnostics setup (regression)", async () => {
    root = mkdtempSync(path.join(tmpdir(), "codeforge-pyright-"));
    const file = path.join(root, "app.py");
    const text = "count: int = 'oops'\n";
    writeFileSync(file, text);
    const uri = pathToFileURL(file).href;
    const received: LspMessage[] = [];
    const stopped: string[] = [];
    service = new LspService({
      languageId: "python",
      serverScript: script,
      args: ["--stdio"],
      workspaceRoot: () => root,
      enabled: () => true,
      emitMessage: (m) => received.push(m),
      emitStopped: (reason) => stopped.push(reason),
      log: () => undefined,
    });
    service.start();
    // Monaco's client advertises pull diagnostics, which makes Pyright send
    // workspace/diagnostic/refresh requests.
    service.send({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: { capabilities: { textDocument: { diagnostic: { dynamicRegistration: true } } } },
    });
    service.send({ jsonrpc: "2.0", method: "initialized", params: {} });
    service.send({
      jsonrpc: "2.0",
      method: "textDocument/didOpen",
      params: { textDocument: { uri, languageId: "python", version: 1, text } },
    });
    service.send({
      jsonrpc: "2.0",
      id: 2,
      method: "textDocument/diagnostic",
      params: { textDocument: { uri } },
    });
    const deadline = Date.now() + 60_000;
    let report: LspMessage | undefined;
    while (!(report = received.find((m) => m.id === 2 && !m.method)) && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 100));
    }
    await new Promise((r) => setTimeout(r, 3000)); // give a crash time to happen
    expect(service.running).toBe(true);
    expect(stopped).toEqual([]);
    expect(JSON.stringify(report?.result)).toMatch(/not assignable to declared type/);
  }, 90_000);

  it("answers requests with nothing while the server is not running", () => {
    root = mkdtempSync(path.join(tmpdir(), "codeforge-pyright-"));
    const received: LspMessage[] = [];
    service = new LspService({
      languageId: "python",
      serverScript: script,
      args: ["--stdio"],
      workspaceRoot: () => root,
      enabled: () => false,
      emitMessage: (m) => received.push(m),
      emitStopped: () => undefined,
      log: () => undefined,
    });
    expect(() => service!.start()).toThrow(/turned off/);
    service.send({ jsonrpc: "2.0", id: 9, method: "textDocument/hover", params: {} });
    expect(received).toEqual([{ jsonrpc: "2.0", id: 9, result: null }]);
  });
});
