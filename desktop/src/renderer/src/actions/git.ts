import { api } from "../lib/bridge";
import * as paths from "../lib/paths";
import { getState, setState } from "../state/store";
import { logOutput, reportError, toast } from "./notify";

let refreshing: Promise<void> | null = null;
let refreshAgain = false;

/** Re-reads `git status`. Calls made while one is running are coalesced. */
export async function refreshGit(): Promise<void> {
  if (refreshing) {
    refreshAgain = true;
    return refreshing;
  }
  refreshing = (async () => {
    do {
      refreshAgain = false;
      if (!getState().workspace) {
        setState({ git: null, commits: [] });
        break;
      }
      try {
        const git = await api.invoke("git:status");
        const commits = git.isRepo ? await api.invoke("git:log", 20).catch(() => []) : [];
        setState({ git, commits });
      } catch (error) {
        logOutput(`git status failed: ${(error as Error).message}`, "error");
      }
    } while (refreshAgain);
  })();
  try {
    await refreshing;
  } finally {
    refreshing = null;
  }
}

async function run(
  label: string,
  action: () => Promise<unknown>,
  success?: string,
): Promise<boolean> {
  setState({ gitBusy: true });
  try {
    const result = await action();
    logOutput(typeof result === "string" && result ? `${label}: ${result}` : label);
    if (success) toast("success", success);
    return true;
  } catch (error) {
    reportError(`${label} failed`, error);
    return false;
  } finally {
    setState({ gitBusy: false });
    await refreshGit();
  }
}

export const initRepository = () =>
  run("git init", () => api.invoke("git:init"), "Initialized a Git repository.");
export const stage = (files: string[]) => run("git add", () => api.invoke("git:stage", files));
export const unstage = (files: string[]) =>
  run("git reset", () => api.invoke("git:unstage", files));

export async function discard(files: string[]): Promise<void> {
  const label = files.length === 1 ? `"${paths.basename(files[0])}"` : `${files.length} files`;
  const choice = await api.invoke("app:confirm", {
    type: "warning",
    message: `Discard changes in ${label}?`,
    detail:
      "Modified files are restored to their last staged or committed version. New (untracked) files are moved to the trash.",
    buttons: ["Discard Changes", "Cancel"],
    defaultId: 1,
    cancelId: 1,
  });
  if (choice === 0) await run("git discard", () => api.invoke("git:discard", files));
}

export async function commit(): Promise<void> {
  const { commitMessage, git } = getState();
  if (!git?.isRepo) return;
  if (!commitMessage.trim()) {
    toast("info", "Enter a commit message first.");
    return;
  }
  let stageAll = false;
  if (!git.staged.length) {
    if (!git.unstaged.length) {
      toast("info", "There are no changes to commit.");
      return;
    }
    const choice = await api.invoke("app:confirm", {
      type: "question",
      message: "There are no staged changes. Stage all changes and commit them?",
      buttons: ["Stage All & Commit", "Cancel"],
      defaultId: 0,
      cancelId: 1,
    });
    if (choice !== 0) return;
    stageAll = true;
  }
  const ok = await run(
    "git commit",
    () => api.invoke("git:commit", commitMessage, stageAll),
    "Changes committed.",
  );
  if (ok) setState({ commitMessage: "" });
}

export const sync = (action: "pull" | "push" | "fetch") =>
  run(
    `git ${action}`,
    () => api.invoke("git:sync", action),
    `${action[0].toUpperCase()}${action.slice(1)} finished.`,
  );

export async function pickBranch(): Promise<void> {
  try {
    const branches = await api.invoke("git:branches");
    setState({
      quickPick: {
        kind: "list",
        placeholder: "Select a branch to check out",
        items: [
          { id: "__create__", label: "+ Create new branch…" },
          ...branches.local.map((name) => ({
            id: name,
            label: name,
            description: name === branches.current ? "current" : undefined,
          })),
        ],
        onPick: (item) => {
          if (item.id === "__create__") promptNewBranch();
          else if (item.id !== branches.current)
            void run(`git checkout ${item.id}`, () => api.invoke("git:checkout", item.id));
        },
      },
    });
  } catch (error) {
    reportError("Could not list branches", error);
  }
}

export function promptNewBranch(): void {
  setState({
    quickPick: {
      kind: "input",
      prompt: "Name of the new branch (created from the current commit and checked out)",
      placeholder: "feature/my-change",
      validate: (value) =>
        /^[^\s~^:?*[\\]+$/.test(value.trim())
          ? null
          : "Branch names cannot contain spaces or ~ ^ : ? * [ \\",
      onAccept: (value) =>
        void run(`git checkout -b ${value.trim()}`, () =>
          api.invoke("git:create-branch", value.trim()),
        ),
    },
  });
}
