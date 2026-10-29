import {
  CircleX,
  Info,
  Plus,
  SquareTerminal,
  Trash2,
  TriangleAlert,
  X,
  Eraser,
} from "lucide-react";
import { useEffect, useLayoutEffect, useRef } from "react";
import { openFile } from "../actions/editor";
import { clearActiveTerminal, createTerminal, killTerminal } from "../actions/terminal";
import * as paths from "../lib/paths";
import { setState, useStore, type PanelView } from "../state/store";
import { attachXterm, fitXterm, focusXterm } from "../terminal/xterm-manager";

function TerminalPanel() {
  const terminals = useStore((s) => s.terminals);
  const activeId = useStore((s) => s.activeTerminalId);
  const hostRef = useRef<HTMLDivElement>(null);
  const active = terminals.find((t) => t.id === activeId);

  useLayoutEffect(() => {
    if (activeId !== null && hostRef.current) attachXterm(activeId, hostRef.current);
  }, [activeId]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || activeId === null) return;
    const observer = new ResizeObserver(() => fitXterm(activeId));
    observer.observe(host);
    return () => observer.disconnect();
  }, [activeId]);

  if (!terminals.length) {
    return (
      <div className="empty-state">
        <button className="btn" onClick={() => void createTerminal()}>
          <SquareTerminal size={14} /> New Terminal
        </button>
      </div>
    );
  }

  return (
    <>
      <div
        className="terminal-container"
        data-testid="terminal"
        onClick={() => activeId !== null && focusXterm(activeId)}
      >
        <div className="xterm-host" ref={hostRef} />
        {active?.exited && (
          <div className="terminal-exited-banner">
            Process exited (code {active.exitCode})
            <button className="btn secondary" onClick={() => void killTerminal(active.id)}>
              Close
            </button>
          </div>
        )}
      </div>
      {terminals.length > 1 && (
        <div className="terminal-list" role="listbox" aria-label="Terminals">
          {terminals.map((t) => (
            <div
              key={t.id}
              role="option"
              aria-selected={t.id === activeId}
              className={`tree-row${t.id === activeId ? " selected" : ""}`}
              onClick={() => setState({ activeTerminalId: t.id })}
              title={`PID ${t.pid}`}
            >
              <SquareTerminal size={13} />
              <span className={`name${t.exited ? " strike" : ""}`}>{t.title}</span>
              <span className="row-actions">
                <button
                  className="icon-button"
                  title="Kill Terminal"
                  onClick={(e) => {
                    e.stopPropagation();
                    void killTerminal(t.id);
                  }}
                >
                  <Trash2 size={13} />
                </button>
              </span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function ProblemsPanel() {
  const problems = useStore((s) => s.problems);
  const root = useStore((s) => s.workspace?.root);
  if (!problems.length)
    return <div className="empty-state">No problems have been detected in open files.</div>;
  return (
    <div className="list-view" data-testid="problems">
      {problems.map((p, index) => (
        <div
          key={index}
          className="tree-row"
          style={{ paddingLeft: 14 }}
          onClick={() => void openFile(p.path, { line: p.line, column: p.column })}
          title={p.message}
        >
          {p.severity === "error" ? (
            <CircleX size={14} className="severity-error" />
          ) : p.severity === "warning" ? (
            <TriangleAlert size={14} className="severity-warning" />
          ) : (
            <Info size={14} className="severity-info" />
          )}
          <span className="name">{p.message}</span>
          <span className="description">
            {root ? paths.relative(root, p.path) : paths.basename(p.path)} [{p.line}, {p.column}]
          </span>
        </div>
      ))}
    </div>
  );
}

function OutputPanel() {
  const output = useStore((s) => s.output);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.scrollTo({ top: ref.current.scrollHeight });
  }, [output]);
  return (
    <div className="list-view" ref={ref} data-testid="output">
      {output.length === 0 && (
        <div className="empty-state">CodeForge logs file, Git and terminal activity here.</div>
      )}
      {output.map((line, index) => (
        <div key={index} className={`output-line${line.level === "error" ? " error" : ""}`}>
          <span className="time">{line.time}</span>
          {line.text}
        </div>
      ))}
    </div>
  );
}

const TABS: { id: PanelView; label: string }[] = [
  { id: "terminal", label: "Terminal" },
  { id: "problems", label: "Problems" },
  { id: "output", label: "Output" },
];

export function Panel() {
  const view = useStore((s) => s.panelView);
  const height = useStore((s) => s.panelHeight);
  const problemCount = useStore((s) => s.problems.length);

  return (
    <section className="panel" style={{ height }} aria-label="Panel">
      <div className="panel-header">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            className={`panel-tab${view === tab.id ? " active" : ""}`}
            onClick={() => setState({ panelView: tab.id })}
          >
            {tab.label}
            {tab.id === "problems" && problemCount > 0 && (
              <span className="count">{problemCount}</span>
            )}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        {view === "terminal" && (
          <>
            <button
              className="icon-button"
              title="New Terminal (Ctrl+Shift+`)"
              onClick={() => void createTerminal()}
            >
              <Plus size={15} />
            </button>
            <button className="icon-button" title="Clear Terminal" onClick={clearActiveTerminal}>
              <Eraser size={14} />
            </button>
            <button
              className="icon-button"
              title="Kill Terminal"
              onClick={() => {
                const id = useStore.getState().activeTerminalId;
                if (id !== null) void killTerminal(id);
              }}
            >
              <Trash2 size={14} />
            </button>
          </>
        )}
        {view === "output" && (
          <button
            className="icon-button"
            title="Clear Output"
            onClick={() => setState({ output: [] })}
          >
            <Eraser size={14} />
          </button>
        )}
        <button
          className="icon-button"
          title="Hide Panel (Ctrl+J)"
          onClick={() => setState({ panelVisible: false })}
        >
          <X size={15} />
        </button>
      </div>
      <div className="panel-body">
        {view === "terminal" && <TerminalPanel />}
        {view === "problems" && <ProblemsPanel />}
        {view === "output" && <OutputPanel />}
      </div>
    </section>
  );
}
