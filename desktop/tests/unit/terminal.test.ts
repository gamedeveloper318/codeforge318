import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "@shared/settings";
import { TerminalService } from "../../src/main/terminal-service";

type Event = { channel: string; payload: { id: number; data?: string; exitCode?: number } };

function harness() {
  const events: Event[] = [];
  const service = new TerminalService(
    (channel, payload) => events.push({ channel, payload }),
    () => DEFAULT_SETTINGS,
  );
  const output = (id: number) =>
    events
      .filter((e) => e.channel === "terminal:data" && e.payload.id === id)
      .map((e) => e.payload.data)
      .join("");
  const exit = (id: number) =>
    events.find((e) => e.channel === "terminal:exit" && e.payload.id === id)?.payload.exitCode;
  const until = async (condition: () => boolean, ms = 20_000) => {
    const deadline = Date.now() + ms;
    while (!condition() && Date.now() < deadline) await new Promise((r) => setTimeout(r, 100));
  };
  return { service, output, exit, until };
}

describe("TerminalService (real pseudo-terminals)", () => {
  it("runs a real shell command in the default shell and reports its output and exit", async () => {
    const { service, output, exit, until } = harness();
    const session = service.create({ cols: 120, rows: 30, cwd: os.tmpdir() });
    if (process.platform === "win32") expect(session.profile).toBe("PowerShell");

    // The shell must evaluate the expression; the echoed input alone does not contain "cf-42".
    const command =
      process.platform === "win32" ? 'Write-Output ("cf-" + (20 + 22))' : 'echo "cf-$((20 + 22))"';
    service.write(session.id, `${command}\r`);
    await until(() => output(session.id).includes("cf-42"));
    expect(output(session.id)).toContain("cf-42");

    service.resize(session.id, 80, 20);
    service.write(session.id, "exit\r");
    await until(() => exit(session.id) !== undefined);
    expect(exit(session.id)).toBeDefined();
    expect(service.count).toBe(0);
  }, 40_000);

  it.runIf(process.platform === "win32")(
    "runs Command Prompt as a separate profile",
    async () => {
      const { service, output, until } = harness();
      expect(service.profiles().profiles.map((p) => p.id)).toEqual(
        expect.arrayContaining(["powershell", "cmd"]),
      );
      const session = service.create({ cols: 120, rows: 30, cwd: os.tmpdir(), profile: "cmd" });
      expect(session.profile).toBe("Command Prompt");
      // Only cmd.exe's FOR loop turns "%i" into 42.
      service.write(session.id, "for /L %i in (42,1,42) do @echo cmd-%i\r");
      await until(() => output(session.id).includes("cmd-42"));
      expect(output(session.id)).toContain("cmd-42");
      service.kill(session.id);
    },
    40_000,
  );

  it("runs a program directly and reports when it ends, with its exit code", async () => {
    const { service, output, exit, until } = harness();
    const session = service.createProgram(
      {
        program: process.execPath,
        args: ["-e", "console.log('prog-' + (40 + 2)); process.exit(3)"],
        name: "Run: test.js",
      },
      { cols: 100, rows: 24, cwd: os.tmpdir() },
    );
    expect(session.title).toBe("Run: test.js");
    await until(() => exit(session.id) !== undefined);
    expect(output(session.id)).toContain("prog-42");
    expect(exit(session.id)).toBe(3);
  }, 40_000);

  it.runIf(process.platform === "win32")(
    "starts non-.exe programs through PowerShell with safe quoting",
    async () => {
      const { service, output, exit, until } = harness();
      const folder = path.join(mkdtempSync(path.join(os.tmpdir(), "cf-run-")), "it's a folder");
      mkdirSync(folder);
      const script = path.join(folder, "hello.cmd");
      writeFileSync(script, "@echo off\r\necho script-%~1\r\nexit /b 0\r\n");
      const session = service.createProgram(
        { program: script, args: ["4 2"], name: "Run: hello.cmd" },
        { cols: 100, rows: 24, cwd: folder },
      );
      await until(() => exit(session.id) !== undefined);
      expect(output(session.id)).toContain("script-4 2");
      expect(exit(session.id)).toBe(0);
    },
    40_000,
  );
});
