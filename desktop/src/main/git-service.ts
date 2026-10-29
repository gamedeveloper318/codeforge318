import { execFile } from "node:child_process";
import path from "node:path";
import { shell } from "electron";
import { parseGitStatus, type GitChange } from "@shared/git-status";
import type { GitBranches, GitCommit, GitFileChange, GitStatusResponse } from "@shared/ipc";
import { childProcessEnv } from "./env";
import type { Workspace } from "./workspace";

/**
 * Real Git integration: every operation runs the user's installed `git`
 * executable with an argument array (never through a shell).
 */

class GitError extends Error {
  constructor(
    message: string,
    readonly notFound = false,
  ) {
    super(message);
  }
}

function runGit(args: string[], cwd: string, timeoutMs = 30_000): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      "git",
      args,
      {
        cwd,
        // Never block on an interactive credential prompt; Git Credential
        // Manager still shows its own window on Windows.
        env: childProcessEnv({ GIT_TERMINAL_PROMPT: "0", GIT_OPTIONAL_LOCKS: "0" }),
        maxBuffer: 64 * 1024 * 1024,
        windowsHide: true,
        timeout: timeoutMs,
        encoding: "utf8",
      },
      (error, stdout, stderr) => {
        if (!error) return resolve(stdout);
        const code = (error as NodeJS.ErrnoException).code;
        if (code === "ENOENT")
          return reject(new GitError("Git is not installed or not on PATH.", true));
        if (error.killed) return reject(new GitError(`git ${args[0]} timed out.`));
        const message = (stderr || stdout || error.message)
          .trim()
          .replace(/^(fatal|error): /gm, "")
          .split("\n")
          .slice(0, 8)
          .join("\n");
        reject(new GitError(message || `git ${args[0]} failed.`));
      },
    );
  });
}

// Control characters are deliberately rejected in branch names.
/* eslint-disable no-control-regex */
const BRANCH_NAME =
  /^(?!-)(?!.*\.\.)(?!.*\/\/)(?!.*@\{)(?!.*\.lock$)[^\s~^:?*[\\\x00-\x1f\x7f]+(?<![./])$/;
/* eslint-enable no-control-regex */

export class GitService {
  private available: boolean | null = null;

  constructor(private readonly workspace: Workspace) {}

  async isAvailable(): Promise<boolean> {
    if (this.available === null) {
      this.available = await runGit(["--version"], process.cwd()).then(
        () => true,
        () => false,
      );
    }
    return this.available;
  }

  private async repoRoot(): Promise<string | null> {
    const root = this.workspace.root;
    if (!root || !(await this.isAvailable())) return null;
    try {
      return path.resolve((await runGit(["rev-parse", "--show-toplevel"], root)).trim());
    } catch {
      return null;
    }
  }

  private async requireRepo(): Promise<string> {
    if (!(await this.isAvailable())) throw new Error("Git is not installed or not on PATH.");
    const repo = await this.repoRoot();
    if (!repo) throw new Error("This folder is not a Git repository.");
    return repo;
  }

  /** Validates renderer paths and converts them to repo-relative "/" paths. */
  private async toRepoPaths(repo: string, paths: string[]): Promise<string[]> {
    const result: string[] = [];
    for (const p of paths) {
      const resolved = await this.workspace.resolve(p);
      const relative = path.relative(repo, resolved);
      if (relative.startsWith("..") || path.isAbsolute(relative)) {
        throw new Error("That file is outside the Git repository.");
      }
      result.push(relative.split(path.sep).join("/") || ".");
    }
    return result;
  }

  async status(): Promise<GitStatusResponse> {
    const gitAvailable = await this.isAvailable();
    const base: GitStatusResponse = {
      gitAvailable,
      isRepo: false,
      repoRoot: null,
      branch: null,
      detached: false,
      upstream: null,
      ahead: 0,
      behind: 0,
      staged: [],
      unstaged: [],
      conflicts: [],
    };
    const repo = await this.repoRoot();
    if (!repo) return base;
    const output = await runGit(
      ["status", "--porcelain=v2", "--branch", "-z", "--untracked-files=all"],
      repo,
    );
    const parsed = parseGitStatus(output);
    const withAbsolute = (changes: GitChange[]): GitFileChange[] =>
      changes
        .slice(0, 5000)
        .map((change) => ({ ...change, absolutePath: path.join(repo, ...change.path.split("/")) }));
    return {
      ...base,
      isRepo: true,
      repoRoot: repo,
      branch: parsed.branch,
      detached: parsed.detached,
      upstream: parsed.upstream,
      ahead: parsed.ahead,
      behind: parsed.behind,
      staged: withAbsolute(parsed.staged),
      unstaged: withAbsolute(parsed.unstaged),
      conflicts: withAbsolute(parsed.conflicts),
    };
  }

  async init(): Promise<void> {
    const root = this.workspace.root;
    if (!root) throw new Error("Open a folder first.");
    await runGit(["init"], root);
  }

  async stage(paths: string[]): Promise<void> {
    const repo = await this.requireRepo();
    await runGit(["add", "-A", "--", ...(await this.toRepoPaths(repo, paths))], repo);
  }

  async unstage(paths: string[]): Promise<void> {
    const repo = await this.requireRepo();
    const relative = await this.toRepoPaths(repo, paths);
    const hasHead = await runGit(["rev-parse", "--verify", "HEAD"], repo).then(
      () => true,
      () => false,
    );
    if (hasHead) await runGit(["reset", "-q", "HEAD", "--", ...relative], repo);
    else await runGit(["rm", "--cached", "-r", "-q", "--", ...relative], repo);
  }

  /** Reverts working-tree changes. Untracked files go to the recycle bin. */
  async discard(paths: string[]): Promise<void> {
    const repo = await this.requireRepo();
    const relative = await this.toRepoPaths(repo, paths);
    const status = parseGitStatus(
      await runGit(
        ["status", "--porcelain=v2", "-z", "--untracked-files=all", "--", ...relative],
        repo,
      ),
    );
    const untracked = new Set(
      status.unstaged.filter((c) => c.kind === "untracked").map((c) => c.path),
    );
    const tracked = relative.filter((p) => !untracked.has(p));
    if (tracked.length) await runGit(["checkout", "--", ...tracked], repo);
    for (const file of untracked) await shell.trashItem(path.join(repo, ...file.split("/")));
  }

  async commit(message: string, stageAll: boolean): Promise<string> {
    const repo = await this.requireRepo();
    const text = message.trim();
    if (!text) throw new Error("Enter a commit message first.");
    if (stageAll) await runGit(["add", "-A"], repo);
    const output = await runGit(["commit", "-m", text], repo);
    return output.split("\n")[0]?.trim() || "Committed.";
  }

  /** File contents at HEAD or in the index; null when the file is not there. */
  async show(file: string, ref: "HEAD" | "INDEX"): Promise<string | null> {
    const repo = await this.requireRepo();
    const [relative] = await this.toRepoPaths(repo, [file]);
    try {
      return await runGit(["show", `${ref === "HEAD" ? "HEAD" : ""}:${relative}`], repo);
    } catch {
      return null;
    }
  }

  async branches(): Promise<GitBranches> {
    const repo = await this.requireRepo();
    const local = (await runGit(["branch", "--format=%(refname:short)"], repo))
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    const current = (await runGit(["branch", "--show-current"], repo)).trim() || null;
    return { current, local };
  }

  private async validateBranch(repo: string, name: string): Promise<string> {
    const trimmed = name.trim();
    if (!BRANCH_NAME.test(trimmed)) throw new Error(`"${trimmed}" is not a valid branch name.`);
    await runGit(["check-ref-format", "--branch", trimmed], repo).catch(() => {
      throw new Error(`"${trimmed}" is not a valid branch name.`);
    });
    return trimmed;
  }

  async checkout(branch: string): Promise<void> {
    const repo = await this.requireRepo();
    await runGit(["checkout", await this.validateBranch(repo, branch)], repo);
  }

  async createBranch(name: string): Promise<void> {
    const repo = await this.requireRepo();
    await runGit(["checkout", "-b", await this.validateBranch(repo, name)], repo);
  }

  async log(limit: number): Promise<GitCommit[]> {
    const repo = await this.requireRepo();
    let output: string;
    try {
      output = await runGit(
        ["log", `-n${limit}`, "--pretty=format:%H%x1f%h%x1f%an%x1f%ar%x1f%s%x1e"],
        repo,
      );
    } catch {
      return []; // a repository with no commits yet
    }
    return output
      .split("\x1e")
      .map((record) => record.trim())
      .filter(Boolean)
      .map((record) => {
        const [hash, shortHash, author, relativeDate, subject] = record.split("\x1f");
        return { hash, shortHash, author, relativeDate, subject };
      });
  }

  async sync(action: "pull" | "push" | "fetch"): Promise<string> {
    const repo = await this.requireRepo();
    let args: string[];
    if (action === "pull") args = ["pull", "--ff-only"];
    else if (action === "fetch") args = ["fetch", "--prune"];
    else {
      const hasUpstream = await runGit(["rev-parse", "--abbrev-ref", "@{upstream}"], repo).then(
        () => true,
        () => false,
      );
      args = hasUpstream ? ["push"] : ["push", "-u", "origin", "HEAD"];
    }
    const output = await runGit(args, repo, 120_000);
    return output.trim() || `${action[0].toUpperCase()}${action.slice(1)} complete.`;
  }
}
