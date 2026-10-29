import { describe, expect, it } from "vitest";
import { fuzzyFilter, fuzzyMatch } from "@shared/fuzzy";
import { changeBadge, parseGitStatus } from "@shared/git-status";
import { GlobSet, globToRegExp, splitPatterns } from "@shared/glob";
import { languageForPath, runCommandForPath } from "@shared/languages";
import {
  DEFAULT_SETTINGS,
  mergeSettings,
  parseSettings,
  SETTING_DESCRIPTORS,
  settingsSchema,
} from "@shared/settings";

describe("settings", () => {
  it("fills every key with a default", () => {
    expect(DEFAULT_SETTINGS["editor.fontSize"]).toBe(14);
    expect(DEFAULT_SETTINGS["workbench.colorTheme"]).toBe("codeforge-dark");
    expect(DEFAULT_SETTINGS["files.autoSave"]).toBe("off");
  });

  it("replaces invalid values with defaults instead of failing", () => {
    const parsed = parseSettings({
      "editor.fontSize": 999,
      "editor.tabSize": "four",
      "editor.minimap": false,
    });
    expect(parsed["editor.fontSize"]).toBe(14);
    expect(parsed["editor.tabSize"]).toBe(2);
    expect(parsed["editor.minimap"]).toBe(false);
  });

  it("ignores non-object input and unknown keys", () => {
    expect(parseSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings([1, 2])).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings({ "evil.key": "x" })).not.toHaveProperty("evil.key");
  });

  it("merges partial updates and re-validates them", () => {
    const next = mergeSettings(DEFAULT_SETTINGS, {
      "editor.fontSize": 18,
      "terminal.fontSize": -5,
    });
    expect(next["editor.fontSize"]).toBe(18);
    expect(next["terminal.fontSize"]).toBe(13);
  });

  it("describes every setting in the settings UI", () => {
    const described = new Set(SETTING_DESCRIPTORS.map((d) => d.key));
    expect([...described].sort()).toEqual(Object.keys(settingsSchema.shape).sort());
  });
});

describe("languageForPath", () => {
  it.each([
    ["C:\\proj\\src\\index.ts", "typescript"],
    ["/home/me/app.tsx", "typescript"],
    ["main.py", "python"],
    ["Dockerfile", "dockerfile"],
    [".env.local", "ini"],
    ["styles.scss", "scss"],
    ["README.md", "markdown"],
    ["LICENSE", "plaintext"],
    ["archive.unknownext", "plaintext"],
  ])("%s -> %s", (file, language) => {
    expect(languageForPath(file)).toBe(language);
  });

  it("knows how to run common scripts", () => {
    expect(runCommandForPath("a.js")?.program).toBe("node");
    expect(runCommandForPath("a.py")?.program).toBe("python");
    expect(runCommandForPath("types.d.ts")).toBeNull();
    expect(runCommandForPath("notes.md")).toBeNull();
  });
});

describe("parseGitStatus", () => {
  const output = [
    "# branch.oid 1234567890abcdef",
    "# branch.head main",
    "# branch.upstream origin/main",
    "# branch.ab +2 -1",
    "1 M. N... 100644 100644 100644 aaa bbb src/staged file.ts",
    "1 .M N... 100644 100644 100644 aaa bbb README.md",
    "1 MM N... 100644 100644 100644 aaa bbb both.ts",
    "2 R. N... 100644 100644 100644 aaa bbb R100 new-name.ts",
    "old-name.ts",
    "1 .D N... 100644 100644 000000 aaa bbb gone.txt",
    "u UU N... 100644 100644 100644 100644 a b c conflict.ts",
    "? untracked dir/file.txt",
    "",
  ].join("\0");

  it("reads branch information", () => {
    const status = parseGitStatus(output);
    expect(status.branch).toBe("main");
    expect(status.upstream).toBe("origin/main");
    expect(status.ahead).toBe(2);
    expect(status.behind).toBe(1);
    expect(status.detached).toBe(false);
  });

  it("splits staged, unstaged, untracked and conflicted files", () => {
    const status = parseGitStatus(output);
    expect(status.staged).toEqual([
      { path: "src/staged file.ts", kind: "modified", origPath: undefined },
      { path: "both.ts", kind: "modified", origPath: undefined },
      { path: "new-name.ts", kind: "renamed", origPath: "old-name.ts" },
    ]);
    expect(status.unstaged.map((c) => [c.path, c.kind])).toEqual([
      ["README.md", "modified"],
      ["both.ts", "modified"],
      ["gone.txt", "deleted"],
      ["untracked dir/file.txt", "untracked"],
    ]);
    expect(status.conflicts).toEqual([{ path: "conflict.ts", kind: "conflict" }]);
  });

  it("handles a detached HEAD and an empty repository", () => {
    expect(parseGitStatus("# branch.oid (initial)\0# branch.head (detached)\0").detached).toBe(
      true,
    );
    expect(parseGitStatus("").staged).toEqual([]);
  });

  it("maps change kinds to badges", () => {
    expect(changeBadge("untracked")).toBe("U");
    expect(changeBadge("conflict")).toBe("!");
  });
});

describe("glob", () => {
  it("converts globs to regular expressions", () => {
    expect(globToRegExp("*.min.js").test("app.min.js")).toBe(true);
    expect(globToRegExp("*.min.js").test("dir/app.min.js")).toBe(false);
    expect(globToRegExp("src/**/*.ts").test("src/a/b/c.ts")).toBe(true);
    expect(globToRegExp("src/**/*.ts").test("src/c.ts")).toBe(true);
    expect(globToRegExp("file?.txt").test("file1.txt")).toBe(true);
  });

  it("excludes by name anywhere in the tree", () => {
    const set = new GlobSet(["node_modules", "*.log", "build/output"]);
    expect(set.matches("node_modules")).toBe(true);
    expect(set.matches("packages/a/node_modules")).toBe(true);
    expect(set.matches("logs/debug.log")).toBe(true);
    expect(set.matches("build/output")).toBe(true);
    expect(set.matches("src/index.ts")).toBe(false);
  });

  it("includes files under a matching folder", () => {
    const include = new GlobSet(splitPatterns("src, *.md"));
    expect(include.matchesFileOrAncestor("src/deep/file.ts")).toBe(true);
    expect(include.matchesFileOrAncestor("docs/guide.md")).toBe(true);
    expect(include.matchesFileOrAncestor("test/file.ts")).toBe(false);
  });
});

describe("fuzzy", () => {
  it("matches subsequences and rejects non-matches", () => {
    expect(fuzzyMatch("idx", "src/index.ts")).not.toBeNull();
    expect(fuzzyMatch("zzz", "src/index.ts")).toBeNull();
  });

  it("ranks file-name matches above directory matches", () => {
    const ranked = fuzzyFilter(["components/app/other.ts", "src/app.ts"], "app", (s) => s).map(
      (r) => r.item,
    );
    expect(ranked[0]).toBe("src/app.ts");
  });
});
