import {
  ArrowDown,
  ArrowUp,
  Check,
  CircleArrowDown,
  CircleX,
  GitBranch,
  LoaderCircle,
  RefreshCw,
  TriangleAlert,
} from "lucide-react";
import { lastSaveError, saveTab } from "../actions/editor";
import { pickBranch, sync } from "../actions/git";
import { languageName, pickLanguageMode } from "../actions/language";
import { updateSettings } from "../actions/misc";
import { showPanel } from "../actions/terminal";
import { installUpdate } from "../actions/update";
import { useStore } from "../state/store";

/** "Saving…", "Saved", "Unsaved changes" or "Save failed" for the file in the editor. */
function SaveStatus() {
  const tab = useStore((s) => s.tabs.find((t) => t.id === s.activeTabId));
  const dirty = useStore((s) => (s.activeTabId ? Boolean(s.dirty[s.activeTabId]) : false));
  const state = useStore((s) => (s.activeTabId ? s.saveState[s.activeTabId] : undefined));
  if (tab?.kind !== "file") return null;
  if (state === "saving")
    return (
      <span className="status-item" data-testid="save-status">
        <LoaderCircle size={12} className="spin" /> Saving…
      </span>
    );
  if (state === "failed" && dirty)
    return (
      <button
        className="status-item status-error"
        data-testid="save-status"
        title={`${lastSaveError(tab.id) ?? "The file could not be saved."} Click to try again.`}
        onClick={() => void saveTab(tab.id)}
      >
        <CircleX size={12} /> Save failed
      </button>
    );
  if (dirty)
    return (
      <span className="status-item" data-testid="save-status" title="This file has unsaved changes">
        ● Unsaved
      </span>
    );
  if (!tab.path) return null;
  return (
    <span className="status-item" data-testid="save-status" title="All changes are saved to disk">
      <Check size={12} /> Saved
    </span>
  );
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
          <button
            className="status-item"
            title="Change Language Mode"
            data-testid="language-status"
            onClick={pickLanguageMode}
          >
            {languageName(status.language)}
          </button>
        </>
      )}
      <SaveStatus />
      <button
        className="status-item"
        data-testid="autosave-toggle"
        title={
          autoSave === "afterDelay"
            ? "Auto Save is on: files are saved shortly after you stop typing. Click to turn it off."
            : "Auto Save is off. Click to turn it on."
        }
        onClick={() =>
          void updateSettings({
            "files.autoSave": autoSave === "afterDelay" ? "off" : "afterDelay",
          })
        }
      >
        Auto Save: {autoSave === "afterDelay" ? "On" : "Off"}
      </button>
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
