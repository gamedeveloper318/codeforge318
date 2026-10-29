import os from "node:os";
import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "@shared/settings";
import { resolveShell, TerminalService } from "../../src/main/terminal-service";

describe("resolveShell", () => {
  it("uses the configured shell when set", () => {
    expect(resolveShell("C:\\Program Files\\Git\\bin\\bash.exe")).toEqual({
      file: "C:\\Program Files\\Git\\bin\\bash.exe",
      args: [],
    });
  });

  it("falls back to the platform default", () => {
    const shell = resolveShell("");
    if (process.platform === "win32") expect(shell.file).toBe("powershell.exe");
    else expect(shell.file.length).toBeGreaterThan(0);
  });
});

describe("TerminalService (real pseudo-terminal)", () => {
  it("runs a real shell command and reports its output and exit", async () => {
    const events: { channel: string; payload: { id: number; data?: string; exitCode?: number } }[] =
      [];
    const service = new TerminalService(
      (channel, payload) => events.push({ channel, payload }),
      () => DEFAULT_SETTINGS,
    );
    const session = service.create({ cols: 120, rows: 30, cwd: os.tmpdir() });

    // The shell must evaluate the expression; the echoed input alone does not contain "cf-42".
    const command =
      process.platform === "win32" ? 'Write-Output ("cf-" + (20 + 22))' : 'echo "cf-$((20 + 22))"';
    service.write(session.id, `${command}\r`);

    const output = () =>
      events
        .filter((e) => e.channel === "terminal:data")
        .map((e) => e.payload.data)
        .join("");
    const deadline = Date.now() + 20_000;
    while (!output().includes("cf-42") && Date.now() < deadline)
      await new Promise((r) => setTimeout(r, 100));
    expect(output()).toContain("cf-42");

    service.resize(session.id, 80, 20);
    service.write(session.id, "exit\r");
    while (!events.some((e) => e.channel === "terminal:exit") && Date.now() < deadline + 10_000) {
      await new Promise((r) => setTimeout(r, 100));
    }
    expect(events.some((e) => e.channel === "terminal:exit")).toBe(true);
    expect(service.count).toBe(0);
  }, 40_000);
});
