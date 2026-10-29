/**
 * Parser for `git status --porcelain=v2 --branch -z --untracked-files=all`.
 * Paths are relative to the repository root and use forward slashes.
 */
export type GitChangeKind =
  "modified" | "added" | "deleted" | "renamed" | "copied" | "typechange" | "untracked" | "conflict";

export interface GitChange {
  path: string;
  origPath?: string;
  kind: GitChangeKind;
}

export interface ParsedGitStatus {
  branch: string | null;
  detached: boolean;
  upstream: string | null;
  ahead: number;
  behind: number;
  staged: GitChange[];
  unstaged: GitChange[];
  conflicts: GitChange[];
}

const KIND_BY_CODE: Record<string, GitChangeKind> = {
  M: "modified",
  A: "added",
  D: "deleted",
  R: "renamed",
  C: "copied",
  T: "typechange",
  U: "conflict",
};

export function parseGitStatus(output: string): ParsedGitStatus {
  const result: ParsedGitStatus = {
    branch: null,
    detached: false,
    upstream: null,
    ahead: 0,
    behind: 0,
    staged: [],
    unstaged: [],
    conflicts: [],
  };

  const entries = output.split("\0");
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    if (!entry) continue;

    if (entry.startsWith("# ")) {
      const [, key, ...rest] = entry.split(" ");
      const value = rest.join(" ");
      if (key === "branch.head") {
        result.detached = value === "(detached)";
        result.branch = result.detached ? null : value;
      } else if (key === "branch.upstream") {
        result.upstream = value;
      } else if (key === "branch.ab") {
        const match = /^\+(\d+) -(\d+)$/.exec(value);
        if (match) {
          result.ahead = Number(match[1]);
          result.behind = Number(match[2]);
        }
      }
      continue;
    }

    const type = entry[0];
    if (type === "?") {
      result.unstaged.push({ path: entry.slice(2), kind: "untracked" });
    } else if (type === "1" || type === "2") {
      // "1 XY sub mH mI mW hH hI path" / "2 XY sub mH mI mW hH hI Xscore path\0origPath"
      const fieldsBeforePath = type === "1" ? 8 : 9;
      const parts = entry.split(" ");
      const xy = parts[1] ?? "..";
      const path = parts.slice(fieldsBeforePath).join(" ");
      const origPath = type === "2" ? entries[++i] : undefined;
      const [x, y] = [xy[0], xy[1]];
      if (x && x !== ".") {
        result.staged.push({ path, origPath, kind: KIND_BY_CODE[x] ?? "modified" });
      }
      if (y && y !== ".") {
        result.unstaged.push({ path, kind: KIND_BY_CODE[y] ?? "modified" });
      }
    } else if (type === "u") {
      // "u XY sub m1 m2 m3 mW h1 h2 h3 path"
      const parts = entry.split(" ");
      result.conflicts.push({ path: parts.slice(10).join(" "), kind: "conflict" });
    }
  }
  return result;
}

/** Single-letter badge shown next to a changed file, like most Git UIs. */
export function changeBadge(kind: GitChangeKind): string {
  switch (kind) {
    case "modified":
      return "M";
    case "added":
      return "A";
    case "deleted":
      return "D";
    case "renamed":
      return "R";
    case "copied":
      return "C";
    case "typechange":
      return "T";
    case "untracked":
      return "U";
    case "conflict":
      return "!";
  }
}
