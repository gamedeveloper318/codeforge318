import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The services import Electron's `shell` for "move to trash"; in unit tests
// that becomes a plain delete so we can assert on it.
vi.mock("electron", () => ({
  shell: { trashItem: vi.fn(async (p: string) => rmSync(p, { recursive: true, force: true })) },
}));

import { DEFAULT_SETTINGS } from "@shared/settings";
import { FileService, looksBinary } from "../../src/main/fs-service";
import { GitService } from "../../src/main/git-service";
import { assertAbsolutePath, isInside, realpathOfExisting } from "../../src/main/path-guard";
import { buildMatcher, findMatches } from "../../src/main/search-matcher";
import { SearchService } from "../../src/main/search-service";
import { Workspace } from "../../src/main/workspace";

let root: string;
let outside: string;
let workspace: Workspace;

beforeEach(async () => {
  const base = mkdtempSync(path.join(tmpdir(), "codeforge-unit-"));
  root = path.join(base, "project");
  outside = path.join(base, "outside");
  mkdirSync(path.join(root, "src"), { recursive: true });
  mkdirSync(outside);
  writeFileSync(
    path.join(root, "src", "app.ts"),
    "const greeting = 'hello';\nexport default greeting;\n",
  );
  writeFileSync(path.join(outside, "secret.txt"), "top secret");
  workspace = new Workspace({ onFilesChanged: () => {}, onGitChanged: () => {} });
  await workspace.open(root);
});

afterEach(() => {
  workspace.close();
  rmSync(path.dirname(root), { recursive: true, force: true });
});

describe("path guard", () => {
  it("detects containment on Windows and POSIX paths", () => {
    expect(isInside("C:\\proj", "C:\\proj\\src\\a.ts", path.win32)).toBe(true);
    expect(isInside("C:\\proj", "c:\\PROJ\\a.ts", path.win32)).toBe(true);
    expect(isInside("C:\\proj", "C:\\project-other\\a.ts", path.win32)).toBe(false);
    expect(isInside("C:\\proj", "C:\\proj\\..\\x", path.win32)).toBe(false);
    expect(isInside("/home/a", "/home/a/b", path.posix)).toBe(true);
    expect(isInside("/home/a", "/home/ab", path.posix)).toBe(false);
  });

  it("rejects relative, empty and NUL-containing paths", () => {
    expect(() => assertAbsolutePath("relative/file.txt")).toThrow(/absolute/);
    expect(() => assertAbsolutePath("")).toThrow();
    expect(() => assertAbsolutePath(path.join(root, "a\0b"))).toThrow();
  });

  it("resolves links for paths that do not exist yet", async () => {
    const link = path.join(root, "link");
    symlinkSync(outside, link, "junction");
    expect(await realpathOfExisting(path.join(link, "new.txt"))).toBe(
      path.join(await realpathOfExisting(outside), "new.txt"),
    );
  });
});

describe("workspace access control", () => {
  it("allows paths inside the open folder", async () => {
    await expect(workspace.resolve(path.join(root, "src", "app.ts"))).resolves.toBe(
      path.join(root, "src", "app.ts"),
    );
  });

  it("refuses paths outside the open folder, including traversal", async () => {
    await expect(workspace.resolve(path.join(outside, "secret.txt"))).rejects.toThrow(
      /outside the open folder/,
    );
    await expect(workspace.resolve(path.join(root, "..", "outside", "secret.txt"))).rejects.toThrow(
      /outside/,
    );
  });

  it("refuses links that point outside the open folder", async () => {
    symlinkSync(outside, path.join(root, "escape"), "junction");
    await expect(workspace.resolve(path.join(root, "escape", "secret.txt"))).rejects.toThrow(
      /links outside/,
    );
  });

  it("allows individually granted files (from Open/Save dialogs)", async () => {
    const file = path.join(outside, "secret.txt");
    workspace.allowFile(file);
    await expect(workspace.resolve(file)).resolves.toBe(file);
  });

  it("protects the workspace root from rename and delete", async () => {
    await expect(workspace.resolve(root, { forbidRoot: true })).rejects.toThrow(
      /workspace folder itself/,
    );
  });
});

describe("FileService", () => {
  const files = () => new FileService(workspace, () => DEFAULT_SETTINGS);

  it("lists folders before files and hides excluded names", async () => {
    mkdirSync(path.join(root, ".git"));
    writeFileSync(path.join(root, "b.txt"), "");
    const entries = await files().readDir(root);
    expect(entries.map((e) => e.name)).toEqual(["src", "b.txt"]);
  });

  it("round-trips UTF-8 files and keeps a byte order mark", async () => {
    const file = path.join(root, "bom.txt");
    writeFileSync(file, Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from("héllo")]));
    const content = await files().readFile(file);
    expect(content).toMatchObject({ content: "héllo", bom: true, binary: false });
    await files().writeFile(file, "changed", content.bom);
    expect([...readFileSync(file).subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    expect(readFileSync(file, "utf8").slice(1)).toBe("changed");
  });

  it("detects binary files", async () => {
    expect(looksBinary(Buffer.from([0x50, 0x4b, 0x00, 0x01]))).toBe(true);
    expect(looksBinary(Buffer.from("plain text"))).toBe(false);
    const file = path.join(root, "image.bin");
    writeFileSync(file, Buffer.from([1, 2, 0, 3]));
    expect((await files().readFile(file)).binary).toBe(true);
  });

  it("creates files and folders without overwriting", async () => {
    const service = files();
    await service.createFile(path.join(root, "nested", "new.ts"));
    expect(existsSync(path.join(root, "nested", "new.ts"))).toBe(true);
    await expect(service.createFile(path.join(root, "src", "app.ts"))).rejects.toThrow(
      /already exists/,
    );
    await service.createDirectory(path.join(root, "lib"));
    await expect(service.createDirectory(path.join(root, "lib"))).rejects.toThrow(/already exists/);
  });

  it("renames safely", async () => {
    const service = files();
    writeFileSync(path.join(root, "a.txt"), "a");
    writeFileSync(path.join(root, "b.txt"), "b");
    await expect(
      service.rename(path.join(root, "a.txt"), path.join(root, "b.txt")),
    ).rejects.toThrow(/already exists/);
    await expect(
      service.rename(path.join(root, "src"), path.join(root, "src", "inner")),
    ).rejects.toThrow(/into itself/);
    await service.rename(path.join(root, "a.txt"), path.join(root, "src", "moved.txt"));
    expect(readFileSync(path.join(root, "src", "moved.txt"), "utf8")).toBe("a");
  });

  it("refuses to read outside the folder", async () => {
    await expect(files().readFile(path.join(outside, "secret.txt"))).rejects.toThrow(
      /outside the open folder/,
    );
  });

  it("moves files to the trash", async () => {
    await files().trash(path.join(root, "src", "app.ts"));
    expect(existsSync(path.join(root, "src", "app.ts"))).toBe(false);
  });
});

describe("search", () => {
  it("builds matchers for literal, regex, case and whole-word searches", () => {
    expect(
      buildMatcher({ pattern: "a.b", isRegex: false, caseSensitive: false, wholeWord: false }).test(
        "axb",
      ),
    ).toBe(false);
    expect(
      buildMatcher({ pattern: "a.b", isRegex: true, caseSensitive: false, wholeWord: false }).test(
        "axb",
      ),
    ).toBe(true);
    expect(
      buildMatcher({
        pattern: "Hello",
        isRegex: false,
        caseSensitive: true,
        wholeWord: false,
      }).test("hello"),
    ).toBe(false);
    expect(
      buildMatcher({ pattern: "cat", isRegex: false, caseSensitive: false, wholeWord: true }).test(
        "concatenate",
      ),
    ).toBe(false);
    expect(() =>
      buildMatcher({ pattern: "(", isRegex: true, caseSensitive: false, wholeWord: false }),
    ).toThrow(/Invalid regular expression/);
  });

  it("reports 1-based positions and survives zero-width patterns", () => {
    const matches = findMatches(
      "one\n  two two\n",
      buildMatcher({ pattern: "two", isRegex: false, caseSensitive: false, wholeWord: false }),
      100,
    );
    expect(matches.map((m) => [m.line, m.column])).toEqual([
      [2, 3],
      [2, 7],
    ]);
    expect(matches[0].preview.slice(matches[0].previewOffset, matches[0].previewOffset + 3)).toBe(
      "two",
    );
    expect(
      findMatches(
        "abc",
        buildMatcher({ pattern: "x*", isRegex: true, caseSensitive: false, wholeWord: false }),
        10,
      ),
    ).toEqual([]);
  });

  it("searches the workspace and skips excluded folders", async () => {
    mkdirSync(path.join(root, "node_modules", "pkg"), { recursive: true });
    writeFileSync(path.join(root, "node_modules", "pkg", "index.js"), "greeting");
    const search = new SearchService(workspace, () => DEFAULT_SETTINGS);
    const response = await search.find({
      pattern: "greeting",
      isRegex: false,
      caseSensitive: false,
      wholeWord: false,
      include: "",
      exclude: "",
    });
    expect(response.results.map((r) => r.relativePath)).toEqual(["src/app.ts"]);
    expect(response.matchCount).toBe(2);
  });
});

const gitAvailable = (() => {
  try {
    execFileSync("git", ["--version"]);
    return true;
  } catch {
    return false;
  }
})();

describe.skipIf(!gitAvailable)("GitService (real git)", () => {
  const git = (...args: string[]) => execFileSync("git", args, { cwd: root, encoding: "utf8" });

  it("reports a folder that is not a repository", async () => {
    const status = await new GitService(workspace).status();
    expect(status.gitAvailable).toBe(true);
    // The temp folder must not be inside another repository for this check.
    if (!status.isRepo) expect(status.staged).toEqual([]);
  });

  it("initialises, stages, commits, diffs, branches and discards", async () => {
    const service = new GitService(workspace);
    await service.init();
    git("config", "user.email", "test@codeforge.local");
    git("config", "user.name", "CodeForge Test");

    let status = await service.status();
    expect(status.isRepo).toBe(true);
    expect(status.unstaged.map((c) => [c.path, c.kind])).toEqual([["src/app.ts", "untracked"]]);

    await service.stage([path.join(root, "src", "app.ts")]);
    status = await service.status();
    expect(status.staged.map((c) => c.path)).toEqual(["src/app.ts"]);

    await service.unstage([path.join(root, "src", "app.ts")]);
    expect((await service.status()).staged).toEqual([]);

    await service.commit("Initial commit", true);
    expect((await service.log(5)).map((c) => c.subject)).toEqual(["Initial commit"]);

    writeFileSync(path.join(root, "src", "app.ts"), "changed\n");
    status = await service.status();
    expect(status.unstaged.map((c) => [c.path, c.kind])).toEqual([["src/app.ts", "modified"]]);
    expect(await service.show(path.join(root, "src", "app.ts"), "HEAD")).toContain("hello");

    await service.discard([path.join(root, "src", "app.ts")]);
    expect(readFileSync(path.join(root, "src", "app.ts"), "utf8")).toContain("hello");

    await service.createBranch("feature/test");
    expect((await service.branches()).current).toBe("feature/test");
    await expect(service.createBranch("bad name")).rejects.toThrow(/not a valid branch name/);
    await expect(service.checkout("--force")).rejects.toThrow(/not a valid branch name/);
  });

  it("rejects paths outside the workspace", async () => {
    const service = new GitService(workspace);
    await service.init();
    await expect(service.stage([path.join(outside, "secret.txt")])).rejects.toThrow(/outside/);
  });

  it("works when the folder is opened through a junction or short path", async () => {
    // Git reports fully resolved paths, while the folder was opened through
    // another spelling (here a junction; on CI machines an 8.3 short name).
    const alias = path.join(path.dirname(root), "alias");
    symlinkSync(root, alias, "junction");
    const aliased = new Workspace({ onFilesChanged: () => {}, onGitChanged: () => {} });
    await aliased.open(alias);
    try {
      const service = new GitService(aliased);
      await service.init();
      const file = path.join(alias, "src", "app.ts");
      expect((await service.status()).unstaged.map((c) => c.absolutePath)).toEqual([file]);
      await service.stage([file]);
      expect((await service.status()).staged.map((c) => c.absolutePath)).toEqual([file]);
      expect(await service.show(file, "INDEX")).toContain("hello");
    } finally {
      aliased.close();
    }
  });
});
