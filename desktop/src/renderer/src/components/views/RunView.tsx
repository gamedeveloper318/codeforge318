import { Eye, Globe, Play, RefreshCw, SquareTerminal } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { runCommandForPath } from "@shared/languages";
import {
  previewActiveHtml,
  promptLocalhostPreview,
  readPackageScripts,
  runActiveFile,
  runScript,
} from "../../actions/misc";
import { createTerminal } from "../../actions/terminal";
import { basename } from "../../lib/paths";
import { useStore } from "../../state/store";

export function RunView() {
  const workspace = useStore((s) => s.workspace);
  const activeFile = useStore((s) => {
    const tab = s.tabs.find((t) => t.id === s.activeTabId);
    return tab?.kind === "file" ? tab.path : null;
  });
  const [scripts, setScripts] = useState<Record<string, string> | null>(null);

  const loadScripts = useCallback(() => {
    void readPackageScripts().then(setScripts);
  }, []);
  useEffect(loadScripts, [loadScripts, workspace]);

  const runner = activeFile ? runCommandForPath(activeFile) : null;
  const isHtml = activeFile ? /\.html?$/i.test(activeFile) : false;

  return (
    <>
      <div className="view-header">
        <span className="title">Run</span>
        <div className="actions">
          <button className="icon-button" title="Reload package.json scripts" onClick={loadScripts}>
            <RefreshCw size={14} />
          </button>
        </div>
      </div>
      <div className="view-body">
        <div className="run-section">
          <h3>Active file</h3>
          {activeFile ? (
            runner ? (
              <>
                <span>
                  Runs <code>{`${runner.program} "${basename(activeFile)}"`}</code> in a new
                  terminal using {runner.label}. The tool must be installed on your computer.
                </span>
                <button className="btn" onClick={() => void runActiveFile()}>
                  <Play size={14} /> Run {basename(activeFile)}
                </button>
              </>
            ) : (
              <span>
                {basename(activeFile)} has no run command. Use the terminal to build or run it.
              </span>
            )
          ) : (
            <span>Open a file to run it.</span>
          )}
          {isHtml && (
            <button className="btn secondary" onClick={() => void previewActiveHtml()}>
              <Eye size={14} /> Preview {basename(activeFile!)}
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
            Breakpoint debugging is not available in this version of CodeForge. Use the integrated
            terminal with your language's debugger (for example <code>node --inspect</code> or{" "}
            <code>python -m pdb</code>) in the meantime.
          </div>
        </div>
      </div>
    </>
  );
}
