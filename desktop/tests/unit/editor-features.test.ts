import { existsSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AutoSaveScheduler, type AutoSaveHost, type AutoSaveResult } from "@shared/autosave";
import { allIconIds, iconForFile } from "@shared/file-icons";
import { findHtmlStructureProblems } from "@shared/html-structure";
import { findLanguageMismatches } from "@shared/language-mismatch";
import { detectLanguageFromContent, languageForFile } from "@shared/languages";
import { planRun, quotePowerShell } from "@shared/run-plan";
import { prepareRun } from "../../src/main/run-service";
import { findExecutable, isStoreAlias } from "../../src/main/runtime";
import type { Workspace } from "../../src/main/workspace";
import { chooseProfile, detectProfiles } from "../../src/main/terminal-service";

describe("file icons", () => {
  it("gives every requested language its own icon", () => {
    const expected: Record<string, string> = {
      "main.py": "python",
      "app.js": "javascript",
      "App.jsx": "react",
      "index.ts": "typescript",
      "App.tsx": "react_ts",
      "index.html": "html",
      "styles.css": "css",
      "data.json": "json",
      "Main.java": "java",
      "main.cpp": "cpp",
      "main.c": "c",
      "Program.cs": "csharp",
      "index.php": "php",
      "app.rb": "ruby",
      "main.go": "go",
      "lib.rs": "rust",
      "schema.sql": "database",
      "README.md": "readme",
      "notes.md": "markdown",
      "pom.xml": "xml",
      "config.yml": "yaml",
      "config.yaml": "yaml",
    };
    for (const [name, icon] of Object.entries(expected)) expect(iconForFile(name), name).toBe(icon);
  });

  it("handles special names, multi-part extensions, paths and unknown types", () => {
    expect(iconForFile("package.json")).toBe("nodejs");
    expect(iconForFile("Dockerfile")).toBe("docker");
    expect(iconForFile(".gitignore")).toBe("git");
    expect(iconForFile(".env.local")).toBe("tune");
    expect(iconForFile("types.d.ts")).toBe("typescript-def");
    expect(iconForFile("math.test.ts")).toBe("test-ts");
    expect(iconForFile("C:\\project\\src\\APP.PY")).toBe("python");
    expect(iconForFile("archive.unknownext")).toBe("file");
    expect(iconForFile("LICENSE")).toBe("license");
    expect(iconForFile("noextension")).toBe("file");
  });

  it("follows renames: the icon comes from the new name", () => {
    expect(iconForFile("test.txt")).toBe("document");
    expect(iconForFile("test.py")).toBe("python");
  });

  it("ships an SVG for every icon it can return", () => {
    const folder = path.join("src", "renderer", "src", "assets", "file-icons");
    for (const id of allIconIds())
      expect(existsSync(path.join(folder, `${id}.svg`)), id).toBe(true);
    expect(existsSync(path.join(folder, "LICENSE.txt"))).toBe(true);
  });
});

describe("language mismatch checks", () => {
  const lines = (text: string, language: string) =>
    findLanguageMismatches(text, language).map((p) => p.line);

  it("reports Python print(Talha) in an HTML file, with its exact position", () => {
    const html = "<!DOCTYPE html>\n<html>\n<body>\n  print(Talha)\n</body>\n</html>\n";
    const problems = findLanguageMismatches(html, "html");
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatchObject({
      line: 4,
      startColumn: 3,
      endColumn: 15,
      severity: "warning",
    });
    expect(problems[0].message).toMatch(/looks like Python code, but this is an HTML file/);
  });

  it("finds Python statements in HTML text and inside text-only elements", () => {
    const html = [
      "<body>",
      "<p>print('hello')</p>",
      "def greet(name):",
      "name = input('Your name? ')",
      "<div>for item in items:</div>",
      "</body>",
    ].join("\n");
    expect(lines(html, "html")).toEqual([2, 3, 4, 5]);
  });

  it("reports JavaScript outside <script> and CSS outside <style>", () => {
    const html = "<body>\nconsole.log('hi');\nbody {\n</body>";
    expect(lines(html, "html")).toEqual([2, 3]);
  });

  it("does not report code inside script, style, pre, code, comments or attributes", () => {
    const html = [
      "<script>",
      "  console.log('fine');",
      "  const x = 1;",
      "</script>",
      "<style>",
      "body {",
      "  color: red;",
      "}",
      "</style>",
      "<pre><code>",
      "print('an example')",
      "def f(x):",
      "</code></pre>",
      "<!--",
      "print('commented out')",
      "-->",
      '<button onclick="print(1)">Print</button>',
      "<code>import os</code>",
      "{{ print(value) }}",
      "{% if user %}",
    ].join("\n");
    expect(findLanguageMismatches(html, "html")).toEqual([]);
  });

  it("does not report ordinary sentences", () => {
    const html = [
      "<p>",
      "Use print() to show values in Python.",
      "if you have questions:",
      "If needed, contact us:",
      "import data",
      "else",
      "for more details see below",
      "Printing is easy.",
      "</p>",
    ].join("\n");
    expect(findLanguageMismatches(html, "html")).toEqual([]);
  });

  it("reports weak Python lines only when the page has other Python", () => {
    expect(lines("<p>\nimport os\n</p>", "html")).toEqual([]);
    expect(lines("<p>\nimport os\nprint(os.getcwd())\n</p>", "html")).toEqual([2, 3]);
  });

  it("reports JavaScript in Python files but not Python's own syntax", () => {
    const py = [
      "data = {",
      '    "a": 1,',
      "}",
      "console.log('x')",
      "const total = 1",
      '"""',
      "const in a docstring = fine",
      '"""',
      "# console.log in a comment",
      "if x > 1:",
      "    print(x)",
    ].join("\n");
    expect(lines(py, "python")).toEqual([4, 5]);
  });

  it("reports Python in JavaScript/TypeScript files but not JSX text", () => {
    const js = [
      "def main():",
      "import os",
      "from math import sqrt",
      "const a = 1;",
      "if (a > 0) {",
      "}",
      "// def commented():",
      "const page = <p>",
      "  if you want:",
      "  import data",
      "</p>;",
    ].join("\n");
    expect(lines(js, "javascript")).toEqual([1, 2, 3]);
    expect(lines("elif x > 1:", "typescript")).toEqual([1]);
  });

  it("ignores languages it has no rules for", () => {
    expect(findLanguageMismatches("print(x)", "markdown")).toEqual([]);
    expect(findLanguageMismatches("print(x)", "plaintext")).toEqual([]);
  });
});

describe("HTML structure checks", () => {
  it("accepts valid HTML, including void elements and optional end tags", () => {
    const html = [
      "<!DOCTYPE html>",
      "<html><head><meta charset='utf-8'><title>x</title></head>",
      "<body>",
      "<p>one<p>two",
      "<ul><li>a<li>b</ul>",
      "<img src='a.png'><br><input type=text>",
      "<svg><path d='M0 0' /></svg>",
      "<table><tr><td>1<td>2</table>",
      "<script>if (a < b && c > d) { document.write('</p>') }</script>",
      "<div title='a > b'>ok</div>",
    ].join("\n");
    expect(findHtmlStructureProblems(html)).toEqual([]);
  });

  it("reports a closing tag without an opening tag", () => {
    const problems = findHtmlStructureProblems("<div>\n</span>\n</div>");
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatchObject({ line: 2, startColumn: 1, severity: "error" });
    expect(problems[0].message).toMatch(/<\/span> has no matching opening/);
  });

  it("reports elements that are never closed or closed in the wrong order", () => {
    const problems = findHtmlStructureProblems("<section>\n<div>\n</section>\n<main>");
    expect(problems.map((p) => [p.line, p.message])).toEqual([
      [2, "<div> is not closed: add </div> before </section>."],
      [4, "<main> is never closed: add </main>."],
    ]);
  });

  it("reports closing tags for void elements", () => {
    const problems = findHtmlStructureProblems("<br></br>");
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toMatch(/empty element/);
  });
});

describe("language detection", () => {
  it("detects languages from the first line of files without a known extension", () => {
    expect(detectLanguageFromContent("#!/usr/bin/env python3\nprint(1)")).toBe("python");
    expect(detectLanguageFromContent("#!/usr/bin/env node\n")).toBe("javascript");
    expect(detectLanguageFromContent("#!/bin/bash\necho hi")).toBe("shell");
    expect(detectLanguageFromContent("<!DOCTYPE html>\n<html>")).toBe("html");
    expect(detectLanguageFromContent("<?php echo 1;")).toBe("php");
    expect(detectLanguageFromContent("hello world")).toBeNull();
  });

  it("prefers the file name and falls back to the content", () => {
    expect(languageForFile("script", "#!/usr/bin/python\n")).toBe("python");
    expect(languageForFile("page.py", "<!DOCTYPE html>")).toBe("python");
    expect(languageForFile("notes", "just text")).toBe("plaintext");
  });
});

describe("run and debug plans", () => {
  it("runs files with their language's runtime", () => {
    expect(planRun("C:\\p\\app.py", "run")).toMatchObject({
      ok: true,
      plan: { runtime: "python", args: ["C:\\p\\app.py"] },
    });
    expect(planRun("/p/index.js", "run")).toMatchObject({ ok: true, plan: { runtime: "node" } });
    expect(planRun("/p/main.ts", "run")).toMatchObject({
      ok: true,
      plan: { runtime: "npx", args: ["tsx", "/p/main.ts"] },
    });
    expect(planRun("/p/Main.java", "run")).toMatchObject({ ok: true, plan: { runtime: "java" } });
    expect(planRun("/p/types.d.ts", "run").ok).toBe(false);
  });

  it("debugs Python with pdb and JavaScript with node inspect", () => {
    expect(planRun("/p/app.py", "debug")).toMatchObject({
      ok: true,
      plan: { runtime: "python", args: ["-m", "pdb", "/p/app.py"] },
    });
    expect(planRun("/p/app.js", "debug")).toMatchObject({
      ok: true,
      plan: { runtime: "node", args: ["inspect", "/p/app.js"] },
    });
  });

  it("explains files it can't run or debug", () => {
    const c = planRun("/p/main.c", "run");
    expect(c.ok).toBe(false);
    if (!c.ok) expect(c.reason).toMatch(/gcc/);
    const debugGo = planRun("/p/main.go", "debug");
    expect(debugGo.ok).toBe(false);
    if (!debugGo.ok) expect(debugGo.reason).toMatch(/Python \(\.py\) and JavaScript/);
    const notes = planRun("/p/notes.txt", "run");
    expect(notes.ok).toBe(false);
  });

  it("quotes PowerShell arguments safely", () => {
    expect(quotePowerShell("C:\\My Files\\it's.py")).toBe("'C:\\My Files\\it''s.py'");
  });
});

describe("preparing a run", () => {
  const workspace = { resolve: async (p: string) => p } as unknown as Workspace;

  it("explains a missing runtime and where to get it, without starting anything", async () => {
    const prepared = await prepareRun(workspace, "C:\\p\\app.py", "run", async () => null);
    expect(prepared.launch).toBeUndefined();
    expect(prepared.check).toMatchObject({
      ok: false,
      installUrl: "https://www.python.org/downloads/",
      runtimeLabel: "Python",
    });
    if (!prepared.check.ok) expect(prepared.check.reason).toMatch(/Python isn't installed/);
  });

  it("starts the found program with the planned arguments", async () => {
    const prepared = await prepareRun(workspace, "/p/app.py", "debug", async () => ({
      path: "/usr/bin/python3",
      version: "Python 3.12.1",
    }));
    expect(prepared.check).toMatchObject({ ok: true, command: "python3 -m pdb /p/app.py" });
    expect(prepared.launch).toEqual({
      program: "/usr/bin/python3",
      args: ["-m", "pdb", "/p/app.py"],
      name: "Debug: app.py",
    });
    expect(prepared.cwd).toBe("/p");
  });
});

describe("runtime lookup", () => {
  const files = new Set([
    "C:\\Tools\\node.exe",
    "C:\\Tools\\npx.cmd",
    "C:\\Users\\me\\AppData\\Local\\Microsoft\\WindowsApps\\python.exe",
    "/usr/bin/python3",
  ]);
  const isFile = (file: string) => files.has(file);

  it("searches PATH with PATHEXT on Windows, case-insensitively", () => {
    const env = { Path: "C:\\Missing;C:\\Tools", PATHEXT: ".COM;.EXE;.BAT;.CMD" };
    expect(findExecutable("node", { platform: "win32", env, isFile })).toBe("C:\\Tools\\node.exe");
    expect(findExecutable("npx", { platform: "win32", env, isFile })).toBe("C:\\Tools\\npx.cmd");
    expect(findExecutable("ruby", { platform: "win32", env, isFile })).toBeNull();
  });

  it("searches PATH on macOS and Linux", () => {
    const env = { PATH: "/usr/local/bin:/usr/bin" };
    expect(findExecutable("python3", { platform: "linux", env, isFile })).toBe("/usr/bin/python3");
  });

  it("recognises the Microsoft Store python.exe shortcut", () => {
    expect(isStoreAlias("C:\\Users\\me\\AppData\\Local\\Microsoft\\WindowsApps\\python.exe")).toBe(
      true,
    );
    expect(isStoreAlias("C:\\Python312\\python.exe")).toBe(false);
  });
});

describe("terminal profiles", () => {
  it("offers PowerShell and Command Prompt on Windows, plus PowerShell 7 and Git Bash when installed", () => {
    const installed = new Set([
      "C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe",
      "C:\\Program Files\\Git\\bin\\bash.exe",
    ]);
    const profiles = detectProfiles("", {
      platform: "win32",
      env: {
        SystemRoot: "C:\\Windows",
        ProgramFiles: "C:\\Program Files",
        ComSpec: "C:\\Windows\\system32\\cmd.exe",
        Path: "",
      },
      isFile: (f) => installed.has(f),
    });
    expect(profiles.map((p) => [p.id, p.name, p.kind])).toEqual([
      ["powershell", "PowerShell", "powershell"],
      ["cmd", "Command Prompt", "cmd"],
      ["git-bash", "Git Bash", "posix"],
    ]);
    expect(profiles.find((p) => p.id === "cmd")?.file).toBe("C:\\Windows\\system32\\cmd.exe");
  });

  it("uses the login shell elsewhere and a custom shell first", () => {
    const profiles = detectProfiles("/opt/fish", {
      platform: "linux",
      env: { SHELL: "/bin/zsh" },
      isFile: (f) => f === "/bin/bash",
    });
    expect(profiles.map((p) => p.id)).toEqual(["custom", "zsh", "bash"]);
  });

  it("chooses the requested profile, else the custom shell, else the default setting", () => {
    const profiles = detectProfiles("", {
      platform: "win32",
      env: { Path: "" },
      isFile: () => false,
    });
    expect(chooseProfile(profiles, "cmd", "").id).toBe("cmd");
    expect(chooseProfile(profiles, undefined, "cmd").id).toBe("cmd");
    expect(chooseProfile(profiles, undefined, "pwsh").id).toBe("powershell");
    expect(chooseProfile(profiles, "nonexistent", "").id).toBe("powershell");
  });
});

describe("auto save scheduler", () => {
  let versions: Record<string, number>;
  let saved: Record<string, number>;
  let saves: string[];
  let failures: string[];
  let enabled: boolean;
  let saveImpl: (id: string) => Promise<AutoSaveResult>;

  const host = (): AutoSaveHost => ({
    enabled: () => enabled,
    delay: () => 1000,
    canAutoSave: (id) => !id.startsWith("untitled"),
    isDirty: (id) => versions[id] !== saved[id],
    version: (id) => versions[id],
    save: (id) => saveImpl(id),
    failed: (id, result) => failures.push(`${id}:${result}`),
    setTimer: (callback, ms) => setTimeout(callback, ms),
    clearTimer: (handle) => clearTimeout(handle as NodeJS.Timeout),
  });

  const edit = (scheduler: AutoSaveScheduler, id: string) => {
    versions[id] = (versions[id] ?? 0) + 1;
    scheduler.changed(id);
  };

  beforeEach(() => {
    vi.useFakeTimers();
    versions = { a: 0, b: 0, "untitled:1": 0 };
    saved = { a: 0, b: 0, "untitled:1": 0 };
    saves = [];
    failures = [];
    enabled = true;
    saveImpl = async (id) => {
      saves.push(id);
      saved[id] = versions[id];
      return "saved";
    };
  });
  afterEach(() => vi.useRealTimers());

  it("saves once, after the user stops typing for the delay", async () => {
    const scheduler = new AutoSaveScheduler(host());
    edit(scheduler, "a");
    await vi.advanceTimersByTimeAsync(600);
    edit(scheduler, "a");
    await vi.advanceTimersByTimeAsync(600);
    expect(saves).toEqual([]);
    await vi.advanceTimersByTimeAsync(500);
    expect(saves).toEqual(["a"]);
    await vi.advanceTimersByTimeAsync(5000);
    expect(saves).toEqual(["a"]);
  });

  it("does not write files without changes, untitled files, or when turned off", async () => {
    const scheduler = new AutoSaveScheduler(host());
    scheduler.changed("b"); // a change event without a new version (e.g. undo back to saved)
    edit(scheduler, "untitled:1");
    enabled = false;
    edit(scheduler, "a");
    await vi.advanceTimersByTimeAsync(3000);
    expect(saves).toEqual([]);
  });

  it("never writes the same file twice at once; changes during a save are saved after it", async () => {
    let finish: () => void = () => {};
    saveImpl = (id) =>
      new Promise((resolve) => {
        saves.push(`${id}@${versions[id]}`);
        const version = versions[id];
        finish = () => {
          saved[id] = version;
          resolve("saved");
        };
      });
    const scheduler = new AutoSaveScheduler(host());
    edit(scheduler, "a");
    await vi.advanceTimersByTimeAsync(1000);
    expect(saves).toEqual(["a@1"]);
    edit(scheduler, "a");
    await vi.advanceTimersByTimeAsync(1000); // timer fires while the first save is running
    expect(saves).toEqual(["a@1"]);
    finish();
    await vi.advanceTimersByTimeAsync(0);
    expect(saves).toEqual(["a@1", "a@2"]);
    finish();
    await vi.advanceTimersByTimeAsync(0);
    expect(saved.a).toBe(2);
  });

  it("stops retrying after an error until the next edit, and reports it once", async () => {
    saveImpl = async (id) => {
      saves.push(id);
      return "failed";
    };
    const scheduler = new AutoSaveScheduler(host());
    edit(scheduler, "a");
    await vi.advanceTimersByTimeAsync(1000);
    expect(saves).toEqual(["a"]);
    expect(failures).toEqual(["a:failed"]);
    expect(scheduler.isBlocked("a")).toBe(true);
    // No loop: nothing happens until the user edits again.
    scheduler.changed("a");
    await vi.advanceTimersByTimeAsync(10_000);
    expect(saves).toEqual(["a"]);
    // The next edit tries again; a repeated failure is not reported twice.
    edit(scheduler, "a");
    await vi.advanceTimersByTimeAsync(1000);
    expect(saves).toEqual(["a", "a"]);
    expect(failures).toEqual(["a:failed"]);
    // Once a save works again, a later failure is a new episode.
    saveImpl = async (id) => {
      saves.push(id);
      saved[id] = versions[id];
      return "saved";
    };
    edit(scheduler, "a");
    await vi.advanceTimersByTimeAsync(1000);
    expect(scheduler.isBlocked("a")).toBe(false);
  });

  it("forgets closed files", async () => {
    const scheduler = new AutoSaveScheduler(host());
    edit(scheduler, "a");
    scheduler.forget("a");
    await vi.advanceTimersByTimeAsync(2000);
    expect(saves).toEqual([]);
  });
});
