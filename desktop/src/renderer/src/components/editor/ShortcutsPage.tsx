import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { allShortcutsFor, COMMANDS, runCommand } from "../../commands/commands";

/** Help > Keyboard Shortcuts: every command, its menu and its shortcuts. Double-click runs one. */
export function ShortcutsPage() {
  const [filter, setFilter] = useState("");
  const rows = useMemo(() => {
    const words = filter.toLowerCase().split(/\s+/).filter(Boolean);
    return COMMANDS.map((command) => ({ command, keys: allShortcutsFor(command) }))
      .filter(({ command, keys }) => {
        const haystack = `${command.category} ${command.title} ${keys.join(" ")}`.toLowerCase();
        return words.every((word) => haystack.includes(word));
      })
      .sort(
        (a, b) =>
          Number(b.keys.length > 0) - Number(a.keys.length > 0) ||
          a.command.category.localeCompare(b.command.category) ||
          a.command.title.localeCompare(b.command.title),
      );
  }, [filter]);

  return (
    <div className="shortcuts-page" data-testid="shortcuts-page">
      <div className="shortcuts-header">
        <h1>Keyboard Shortcuts</h1>
        <label className="shortcuts-search">
          <Search size={14} />
          <input
            autoFocus
            value={filter}
            placeholder="Type to search commands and shortcuts (e.g. save, ctrl+shift, terminal)"
            aria-label="Search keyboard shortcuts"
            onChange={(e) => setFilter(e.target.value)}
          />
        </label>
      </div>
      <div className="shortcuts-table" role="table" aria-label="Keyboard shortcuts">
        <div className="shortcuts-row head" role="row">
          <span role="columnheader">Command</span>
          <span role="columnheader">Keybinding</span>
          <span role="columnheader">Category</span>
        </div>
        {rows.map(({ command, keys }) => (
          <div
            key={command.id}
            className="shortcuts-row"
            role="row"
            title="Double-click to run this command"
            onDoubleClick={() => runCommand(command.id)}
          >
            <span role="cell">{command.title}</span>
            <span role="cell">
              {keys.length ? (
                keys.map((key) => (
                  <kbd key={key} className="kbd">
                    {key}
                  </kbd>
                ))
              ) : (
                <span className="muted">—</span>
              )}
            </span>
            <span role="cell" className="muted">
              {command.category}
            </span>
          </div>
        ))}
        {rows.length === 0 && <div className="empty-state">No commands match “{filter}”.</div>}
      </div>
    </div>
  );
}
