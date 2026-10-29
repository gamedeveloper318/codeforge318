import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Check,
  ChevronDown,
  ChevronRight,
  File,
  GitBranch,
  GitCommitHorizontal,
  Minus,
  Plus,
  RefreshCw,
  Undo2,
} from "lucide-react";
import { useState } from "react";
import { changeBadge } from "@shared/git-status";
import type { GitFileChange } from "@shared/ipc";
import { openDiff, openFile } from "../../actions/editor";
import {
  commit,
  discard,
  initRepository,
  pickBranch,
  refreshGit,
  stage,
  sync,
  unstage,
} from "../../actions/git";
import { api } from "../../lib/bridge";
import { basename, dirname } from "../../lib/paths";
import { setState, useStore } from "../../state/store";
import { FileIcon } from "../FileIcon";

const BADGE_CLASS: Record<string, string> = {
  M: "git-modified",
  T: "git-modified",
  A: "git-added",
  R: "git-added",
  C: "git-added",
  U: "git-untracked",
  D: "git-deleted",
  "!": "git-conflict",
};

type Group = "conflicts" | "staged" | "unstaged";

function ChangeRow({ change, group }: { change: GitFileChange; group: Group }) {
  const busy = useStore((s) => s.gitBusy);
  const badge = changeBadge(change.kind);
  const folder = dirname(change.path);
  const open = () => {
    if (change.kind === "untracked" || change.kind === "added" || group === "conflicts")
      void openFile(change.absolutePath);
    else openDiff(change.absolutePath, group === "staged");
  };
  return (
    <div className="tree-row" style={{ paddingLeft: 22 }} title={change.path} onClick={open}>
      <FileIcon name={change.path} />
      <span
        className={`name ${BADGE_CLASS[badge]}${change.kind === "deleted" ? " strike" : ""}`}
        style={{ flex: "none" }}
      >
        {basename(change.path)}
      </span>
      <span className="description" style={{ flex: 1, maxWidth: "none", minWidth: 0 }}>
        {folder === change.path ? "" : folder}
      </span>
      <span className="row-actions" onClick={(e) => e.stopPropagation()}>
        {change.kind !== "deleted" && (
          <button
            className="icon-button"
            title="Open File"
            onClick={() => void openFile(change.absolutePath)}
          >
            <File size={14} />
          </button>
        )}
        {group === "unstaged" && (
          <button
            className="icon-button"
            title="Discard Changes"
            disabled={busy}
            onClick={() => void discard([change.absolutePath])}
          >
            <Undo2 size={14} />
          </button>
        )}
        {group === "staged" ? (
          <button
            className="icon-button"
            title="Unstage Changes"
            disabled={busy}
            onClick={() => void unstage([change.absolutePath])}
          >
            <Minus size={14} />
          </button>
        ) : (
          <button
            className="icon-button"
            title="Stage Changes"
            disabled={busy}
            onClick={() => void stage([change.absolutePath])}
          >
            <Plus size={14} />
          </button>
        )}
      </span>
      <span className={`badge ${BADGE_CLASS[badge]}`}>{badge}</span>
    </div>
  );
}

function Section({
  title,
  changes,
  group,
  actions,
}: {
  title: string;
  changes: GitFileChange[];
  group: Group;
  actions?: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);
  if (!changes.length) return null;
  return (
    <div data-testid={`scm-${group}`}>
      <div className="section-header" onClick={() => setOpen(!open)}>
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <span className="title">{title}</span>
        <span className="actions" onClick={(e) => e.stopPropagation()}>
          {actions}
        </span>
        <span className="activity-badge" style={{ position: "static" }}>
          {changes.length}
        </span>
      </div>
      {open &&
        changes.map((change) => (
          <ChangeRow key={`${group}:${change.path}`} change={change} group={group} />
        ))}
    </div>
  );
}

export function SourceControlView() {
  const workspace = useStore((s) => s.workspace);
  const git = useStore((s) => s.git);
  const busy = useStore((s) => s.gitBusy);
  const message = useStore((s) => s.commitMessage);
  const commits = useStore((s) => s.commits);
  const [showHistory, setShowHistory] = useState(true);

  const header = (
    <div className="view-header">
      <span className="title">Source Control</span>
      {git?.isRepo && (
        <div className="actions">
          <button
            className="icon-button"
            title="Pull"
            disabled={busy}
            onClick={() => void sync("pull")}
          >
            <ArrowDownToLine size={14} />
          </button>
          <button
            className="icon-button"
            title="Push"
            disabled={busy}
            onClick={() => void sync("push")}
          >
            <ArrowUpFromLine size={14} />
          </button>
          <button
            className="icon-button"
            title="Refresh"
            disabled={busy}
            onClick={() => void refreshGit()}
          >
            <RefreshCw size={14} />
          </button>
        </div>
      )}
    </div>
  );

  if (!workspace)
    return (
      <>
        {header}
        <div className="empty-state">Open a folder to use source control.</div>
      </>
    );
  if (!git)
    return (
      <>
        {header}
        <div className="empty-state">Checking Git status…</div>
      </>
    );
  if (!git.gitAvailable) {
    return (
      <>
        {header}
        <div className="empty-state">
          <p>Git was not found on this computer. Install Git, then restart CodeForge.</p>
          <button
            className="btn"
            onClick={() => void api.invoke("app:open-external", "https://git-scm.com/downloads")}
          >
            Download Git
          </button>
        </div>
      </>
    );
  }
  if (!git.isRepo) {
    return (
      <>
        {header}
        <div className="empty-state">
          <p>The open folder is not a Git repository yet.</p>
          <button className="btn block" disabled={busy} onClick={() => void initRepository()}>
            Initialize Repository
          </button>
        </div>
      </>
    );
  }

  const unstagedPaths = git.unstaged.map((c) => c.absolutePath);
  const nothingToCommit = !git.staged.length && !git.unstaged.length;

  return (
    <>
      {header}
      <div className="scm-commit">
        <button
          className="scm-branch icon-button"
          style={{ width: "auto", justifyContent: "flex-start", padding: "0 4px" }}
          onClick={() => void pickBranch()}
          title="Checkout branch"
        >
          <GitBranch size={13} />
          {git.branch ?? "(detached HEAD)"}
          {git.upstream && (
            <span style={{ color: "var(--text-subtle)" }}>
              {" "}
              ↓{git.behind} ↑{git.ahead}
            </span>
          )}
        </button>
        <textarea
          className="text-input"
          placeholder={`Message (Ctrl+Enter to commit on "${git.branch ?? "HEAD"}")`}
          aria-label="Commit message"
          value={message}
          rows={3}
          onChange={(e) => setState({ commitMessage: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              void commit();
            }
          }}
        />
        <button
          className="btn block"
          disabled={busy || nothingToCommit}
          onClick={() => void commit()}
        >
          <Check size={15} />
          Commit
        </button>
      </div>
      <div className="view-body">
        {nothingToCommit && !git.conflicts.length && (
          <div className="empty-state">No changes. Your working tree is clean.</div>
        )}
        <Section title="Merge Changes" changes={git.conflicts} group="conflicts" />
        <Section
          title="Staged Changes"
          changes={git.staged}
          group="staged"
          actions={
            <button
              className="icon-button"
              title="Unstage All"
              disabled={busy}
              onClick={() => void unstage(git.staged.map((c) => c.absolutePath))}
            >
              <Minus size={14} />
            </button>
          }
        />
        <Section
          title="Changes"
          changes={git.unstaged}
          group="unstaged"
          actions={
            <>
              <button
                className="icon-button"
                title="Discard All Changes"
                disabled={busy}
                onClick={() => void discard(unstagedPaths)}
              >
                <Undo2 size={14} />
              </button>
              <button
                className="icon-button"
                title="Stage All Changes"
                disabled={busy}
                onClick={() => void stage(unstagedPaths)}
              >
                <Plus size={14} />
              </button>
            </>
          }
        />
        {commits.length > 0 && (
          <div>
            <div className="section-header" onClick={() => setShowHistory(!showHistory)}>
              {showHistory ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              <span className="title">Recent Commits</span>
            </div>
            {showHistory &&
              commits.map((c) => (
                <div
                  key={c.hash}
                  className="tree-row"
                  style={{ paddingLeft: 22, cursor: "default" }}
                  title={`${c.hash}\n${c.author}, ${c.relativeDate}`}
                >
                  <GitCommitHorizontal size={14} color="var(--text-muted)" />
                  <span className="name">{c.subject}</span>
                  <span className="description">{c.shortHash}</span>
                </div>
              ))}
          </div>
        )}
      </div>
    </>
  );
}
