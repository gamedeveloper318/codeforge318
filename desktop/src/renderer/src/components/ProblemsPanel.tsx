import { ChevronDown, ChevronRight, CircleX, Info, Search, TriangleAlert } from "lucide-react";
import { useMemo, useState } from "react";
import { openFile } from "../actions/editor";
import * as paths from "../lib/paths";
import { useStore, type Problem } from "../state/store";
import { FileIcon } from "./FileIcon";

type Severity = Problem["severity"];

function SeverityIcon({ severity }: { severity: Severity }) {
  if (severity === "error") return <CircleX size={14} className="severity-error" />;
  if (severity === "warning") return <TriangleAlert size={14} className="severity-warning" />;
  return <Info size={14} className="severity-info" />;
}

/**
 * Errors, warnings and notes from every checker (TypeScript/JavaScript, CSS,
 * JSON, Python via Pyright, and CodeForge's own checks), grouped by file.
 * Clicking one opens the file with the problem selected.
 */
export function ProblemsPanel() {
  const problems = useStore((s) => s.problems);
  const root = useStore((s) => s.workspace?.root);
  const [shown, setShown] = useState<Record<Severity, boolean>>({
    error: true,
    warning: true,
    info: true,
  });
  const [filter, setFilter] = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const counts = useMemo(() => {
    const result: Record<Severity, number> = { error: 0, warning: 0, info: 0 };
    for (const p of problems) result[p.severity]++;
    return result;
  }, [problems]);

  const groups = useMemo(() => {
    const text = filter.trim().toLowerCase();
    const byFile = new Map<string, Problem[]>();
    for (const p of problems) {
      if (!shown[p.severity]) continue;
      if (
        text &&
        !`${p.message} ${p.source ?? ""} ${paths.basename(p.path)}`.toLowerCase().includes(text)
      )
        continue;
      byFile.set(p.path, [...(byFile.get(p.path) ?? []), p]);
    }
    return [...byFile.entries()];
  }, [problems, shown, filter]);

  const toggle = (severity: Severity) => setShown((s) => ({ ...s, [severity]: !s[severity] }));
  const label: Record<Severity, string> = { error: "Errors", warning: "Warnings", info: "Info" };

  return (
    <div className="problems" data-testid="problems">
      <div className="problems-toolbar">
        {(["error", "warning", "info"] as const).map((severity) => (
          <button
            key={severity}
            className={`problems-filter${shown[severity] ? " on" : ""}`}
            aria-pressed={shown[severity]}
            title={`${shown[severity] ? "Hide" : "Show"} ${label[severity].toLowerCase()}`}
            onClick={() => toggle(severity)}
          >
            <SeverityIcon severity={severity} />
            {label[severity]} {counts[severity]}
          </button>
        ))}
        <label className="problems-search">
          <Search size={12} />
          <input
            value={filter}
            placeholder="Filter (e.g. text, file name, Pyright)"
            aria-label="Filter problems"
            onChange={(e) => setFilter(e.target.value)}
          />
        </label>
      </div>
      <div className="list-view">
        {problems.length === 0 && (
          <div className="empty-state">No problems have been detected in open files.</div>
        )}
        {problems.length > 0 && groups.length === 0 && (
          <div className="empty-state">No problems match the filter.</div>
        )}
        {groups.map(([file, items]) => {
          const isCollapsed = collapsed[file];
          const relative = root ? paths.relative(root, file) : file;
          const folder = paths.dirname(relative);
          return (
            <div key={file} className="problems-group">
              <div
                className="tree-row problems-file"
                title={file}
                onClick={() => setCollapsed((c) => ({ ...c, [file]: !c[file] }))}
              >
                {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                <FileIcon name={file} />
                <span className="name">{paths.basename(file)}</span>
                {folder !== relative && folder !== "." && (
                  <span className="description">{folder}</span>
                )}
                <span className="count">{items.length}</span>
              </div>
              {!isCollapsed &&
                items.map((p, index) => (
                  <div
                    key={index}
                    className="tree-row problem-row"
                    data-testid="problem"
                    title={p.message}
                    onClick={() =>
                      void openFile(p.path, {
                        line: p.line,
                        column: p.column,
                        endLine: p.endLine,
                        endColumn: p.endColumn,
                      })
                    }
                  >
                    <SeverityIcon severity={p.severity} />
                    <span className="name problem-message">{p.message}</span>
                    {p.source && <span className="description">{p.source}</span>}
                    <span className="description problem-position">
                      Ln {p.line}, Col {p.column}
                    </span>
                  </div>
                ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
