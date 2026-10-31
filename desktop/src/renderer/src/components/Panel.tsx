import { ChevronDown, Columns2, Eraser, Plus, SquareTerminal, Trash2, X } from "lucide-react";
import { useEffect, useLayoutEffect, useRef } from "react";
import {
  clearActiveTerminal,
  closeActiveTerminal,
  createTerminal,
  killTerminal,
  pickTerminalProfile,
} from "../actions/terminal";
import { setState, useStore, type PanelView, type TerminalState } from "../state/store";
import { attachXterm, fitXterm, focusXterm } from "../terminal/xterm-manager";
import { ProblemsPanel } from "./ProblemsPanel";

function TerminalPane({
  terminal,
  active,
  split,
}: {
  terminal: TerminalState;
  active: boolean;
  split: boolean;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const { id } = terminal;

  useLayoutEffect(() => {
    if (hostRef.current) attachXterm(id, hostRef.current);
  }, [id]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const observer = new ResizeObserver(() => fitXterm(id));
    observer.observe(host);
    return () => observer.disconnect();
  }, [id]);

  return (
    <div
      className={`terminal-container${split && active ? " active-pane" : ""}`}
      data-testid="terminal-pane"
      onMouseDown={() => setState({ activeTerminalId: id })}
      onClick={() => focusXterm(id)}
    >
      <div className="xterm-host" ref={hostRef} />
      {terminal.exited && (
        <div className="terminal-exited-banner">
          Process exited (code {terminal.exitCode})
          <button className="btn secondary" onClick={() => void killTerminal(id)}>
            Close
          </button>
        </div>
      )}
    </div>
  );
}

function TerminalPanel() {
  const terminals = useStore((s) => s.terminals);
  const activeId = useStore((s) => s.activeTerminalId);
  const active = terminals.find((t) => t.id === activeId);
  // The panes of the active split group, side by side.
  const panes = active ? terminals.filter((t) => t.group === active.group) : [];

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
      <div className="terminal-group" data-testid="terminal">
        {panes.map((t) => (
          <TerminalPane
            key={t.id}
            terminal={t}
            active={t.id === activeId}
            split={panes.length > 1}
          />
        ))}
      </div>
      {terminals.length > 1 && (
        <div className="terminal-list" role="listbox" aria-label="Terminals">
          {terminals.map((t, index) => {
            const inSplit = terminals.filter((other) => other.group === t.group).length > 1;
            const firstOfGroup = terminals.findIndex((other) => other.group === t.group) === index;
            return (
              <div
                key={t.id}
                role="option"
                aria-selected={t.id === activeId}
                className={`tree-row${t.id === activeId ? " selected" : ""}`}
                style={{ paddingLeft: inSplit && !firstOfGroup ? 26 : 10 }}
                onClick={() => setState({ activeTerminalId: t.id })}
                title={`${t.profile} · PID ${t.pid}`}
              >
                {inSplit && !firstOfGroup ? (
                  <span className="split-marker">└</span>
                ) : (
                  <SquareTerminal size={13} />
                )}
                <span className={`name${t.exited ? " strike" : ""}`}>{t.title}</span>
                {t.profile !== "Program" && t.title !== t.profile && (
                  <span className="description">{t.profile}</span>
                )}
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
            );
          })}
        </div>
      )}
    </>
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
            <button
              className="icon-button"
              title="New Terminal With Profile… (PowerShell, Command Prompt, …)"
              aria-label="New Terminal With Profile"
              onClick={() => void pickTerminalProfile()}
            >
              <ChevronDown size={14} />
            </button>
            <button
              className="icon-button"
              title="Split Terminal (Ctrl+Shift+5)"
              aria-label="Split Terminal"
              onClick={() => void createTerminal({ split: true })}
            >
              <Columns2 size={14} />
            </button>
            <button className="icon-button" title="Clear Terminal" onClick={clearActiveTerminal}>
              <Eraser size={14} />
            </button>
            <button
              className="icon-button"
              title="Close Terminal"
              aria-label="Close Terminal"
              onClick={() => void closeActiveTerminal()}
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
