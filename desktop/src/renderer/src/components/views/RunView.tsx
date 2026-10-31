import { Bug, Eye, Globe, Play, RefreshCw, Square, SquareTerminal } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { planRun, RUNTIMES } from "@shared/run-plan";
import {
  previewActiveHtml,
  promptLocalhostPreview,
  readPackageScripts,
  runScript,
} from "../../actions/misc";
import { runActiveFile, startDebugging, stopRunningProgram } from "../../actions/run";
import { createTerminal } from "../../actions/terminal";
import { basename } from "../../lib/paths";
import { useStore } from "../../state/store";

export function RunView() {
  const workspace = useStore((s) => s.workspace);
  const activeFile = useStore((s) => {
    const tab = s.tabs.find((t) => t.id === s.activeTabId);
    return tab?.kind === "file" ? (tab.path ?? tab.title) : null;
  });
  const terminals = useStore((s) => s.terminals);
  const running = terminals.filter((t) => t.purpose && !t.exited);
  const [scripts, setScripts] = useState<Record<string, string> | null>(null);

  const loadScripts = useCallback(() => {
    void readPackageScripts().then(setScripts);
  }, []);
  useEffect(loadScripts, [loadScripts, workspace]);

  const run = activeFile ? planRun(activeFile, "run") : null;
  const debug = activeFile ? planRun(activeFile, "debug") : null;
  const isHtml = activeFile ? /\.html?$/i.test(activeFile) : false;

  return (
    <>
      <div className="view-header">
        <span className="title">Run and Debug</span>
        <div className="actions">
          <button className="icon-button" title="Reload package.json scripts" onClick={loadScripts}>
            <RefreshCw size={14} />
          </button>
        </div>
      </div>
      <div className="view-body" data-testid="run-view">
        <div className="run-section">
          <h3>Active file</h3>
          {!activeFile && <span>Open a file to run or debug it.</span>}
          {activeFile && run?.ok && (
            <>
              <span>
                Runs <b>{basename(activeFile)}</b> with {RUNTIMES[run.plan.runtime].label} in a new
                terminal. {RUNTIMES[run.plan.runtime].label} must be installed on this computer;
                CodeForge checks first and tells you what to install if it's missing.
              </span>
              <button className="btn" onClick={() => void runActiveFile()}>
                <Play size={14} /> Run {basename(activeFile)}
              </button>
            </>
          )}
          {activeFile && run && !run.ok && !isHtml && <span>{run.reason}</span>}
          {activeFile && debug?.ok && (
            <button className="btn secondary" onClick={() => void startDebugging()}>
              <Bug size={14} /> Start Debugging ({debug.plan.description})
            </button>
          )}
          {isHtml && (
            <button className="btn secondary" onClick={() => void previewActiveHtml()}>
              <Eye size={14} /> Preview {basename(activeFile!)}
            </button>
          )}
          {running.length > 0 && (
            <button className="btn secondary" onClick={() => void stopRunningProgram()}>
              <Square size={13} /> Stop {running.at(-1)!.title.replace(/^(Run|Debug): /, "")}
            </button>
          )}
        </div>

        <div className="run-section">
          <h3>npm scripts</h3>
          {!workspace ? (
            <span>Open a folder with a package.json.</span>
          ) : scripts === null ? (
            <span>No package.json found in the folder root.</span>
          ) : Object.keys(scripts).length === 0 ? (
            <span>package.json has no scripts.</span>
          ) : (
            Object.entries(scripts).map(([name, command]) => (
              <div
                key={name}
                className="tree-row"
                style={{ padding: "0 4px", borderRadius: 6 }}
                title={command}
                onClick={() => void runScript(name)}
              >
                <Play size={13} color="var(--success)" />
                <span className="name">{name}</span>
                <span className="description">{command}</span>
              </div>
            ))
          )}
        </div>

        <div className="run-section">
          <h3>Preview</h3>
          <span>
            Open a running local dev server (for example from <code>npm run dev</code>) in a
            sandboxed preview window.
          </span>
          <button className="btn secondary" onClick={promptLocalhostPreview}>
            <Globe size={14} /> Open Localhost Preview…
          </button>
          <button className="btn secondary" onClick={() => void createTerminal()}>
            <SquareTerminal size={14} /> New Terminal
          </button>
        </div>

        <div className="run-section">
          <div className="notice">
            Start Debugging (F5) opens the language's own debugger in the terminal: <code>pdb</code>{" "}
            for Python and <code>node inspect</code> for JavaScript. Type <code>n</code> for the
            next line, <code>c</code> to continue and <code>q</code> (pdb) or <code>.exit</code>{" "}
            (node) to quit. Stop Running Program is Shift+F5.
          </div>
        </div>
      </div>
    </>
  );
}
