import {
  ArrowDown,
  ArrowUp,
  CircleArrowDown,
  CircleX,
  GitBranch,
  RefreshCw,
  TriangleAlert,
} from "lucide-react";
import { pickBranch, sync } from "../actions/git";
import { showPanel } from "../actions/terminal";
import { installUpdate } from "../actions/update";
import { monaco } from "../monaco/setup";
import { useStore } from "../state/store";

function languageName(id: string): string {
  const info = monaco.languages.getLanguages().find((l) => l.id === id);
  return info?.aliases?.[0] ?? id;
}

export function StatusBar() {
  const git = useStore((s) => s.git);
  const gitBusy = useStore((s) => s.gitBusy);
  const status = useStore((s) => s.editorStatus);
  const errors = useStore((s) => s.problems.filter((p) => p.severity === "error").length);
  const warnings = useStore((s) => s.problems.filter((p) => p.severity === "warning").length);
  const autoSave = useStore((s) => s.settings["files.autoSave"]);
  const update = useStore((s) => s.updateStatus);

  return (
    <footer className="statusbar">
      {git?.isRepo && (
        <>
          <button className="status-item" title="Checkout branch" onClick={() => void pickBranch()}>
            <GitBranch size={13} />
            {git.branch ?? "(detached)"}
          </button>
          <button
            className="status-item"
            title={
              git.upstream ? `Pull/push with ${git.upstream}` : "Publish this branch (git push)"
            }
            disabled={gitBusy}
            onClick={() => void sync(git.behind > 0 ? "pull" : "push")}
          >
            <RefreshCw size={12} className={gitBusy ? "spin" : undefined} />
            {git.upstream && (
              <>
                {git.behind}
                <ArrowDown size={11} />
                {git.ahead}
                <ArrowUp size={11} />
              </>
            )}
          </button>
        </>
      )}
      <button
        className="status-item"
        title="Problems (Ctrl+Shift+M)"
        onClick={() => showPanel("problems")}
      >
        <CircleX size={13} />
        {errors}
        <TriangleAlert size={13} />
        {warnings}
      </button>
      <div className="spacer" />
      {status && (
        <>
          <span className="status-item">
            Ln {status.line}, Col {status.column}
            {status.selected > 0 && ` (${status.selected} selected)`}
          </span>
          <span className="status-item">
            {status.insertSpaces ? `Spaces: ${status.tabSize}` : `Tab Size: ${status.tabSize}`}
          </span>
          <span className="status-item">{status.bom ? "UTF-8 with BOM" : "UTF-8"}</span>
          <span className="status-item">{status.eol}</span>
          <span className="status-item">{languageName(status.language)}</span>
        </>
      )}
      {autoSave === "afterDelay" && <span className="status-item">Auto Save</span>}
      {update?.state === "downloading" && (
        <span className="status-item" title={`Downloading CodeForge ${update.version}`}>
          <CircleArrowDown size={13} />
          Downloading update {update.percent ?? 0}%
        </span>
      )}
      {update?.state === "ready" && (
        <button
          className="status-item status-update"
          title={`CodeForge ${update.version} has been downloaded`}
          onClick={() => void installUpdate()}
          data-testid="restart-to-update"
        >
          <CircleArrowDown size={13} />
          Restart to update ({update.version})
        </button>
      )}
      <span className="status-item status-brand">CodeForge</span>
    </footer>
  );
}
