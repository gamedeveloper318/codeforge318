import { Files, GitBranch, Play, Search, Settings } from "lucide-react";
import { openSettingsTab } from "../actions/editor";
import { setState, useStore, type SidebarView } from "../state/store";

const VIEWS: { id: SidebarView; label: string; shortcut: string; Icon: typeof Files }[] = [
  { id: "explorer", label: "Explorer", shortcut: "Ctrl+Shift+E", Icon: Files },
  { id: "search", label: "Search", shortcut: "Ctrl+Shift+F", Icon: Search },
  { id: "scm", label: "Source Control", shortcut: "Ctrl+Shift+G", Icon: GitBranch },
  { id: "run", label: "Run", shortcut: "Ctrl+Shift+D", Icon: Play },
];

export function ActivityBar() {
  const sidebarVisible = useStore((s) => s.sidebarVisible);
  const sidebarView = useStore((s) => s.sidebarView);
  const changeCount = useStore((s) =>
    s.git ? s.git.staged.length + s.git.unstaged.length + s.git.conflicts.length : 0,
  );

  return (
    <nav className="activitybar" aria-label="Views">
      {VIEWS.map(({ id, label, shortcut, Icon }) => {
        const active = sidebarVisible && sidebarView === id;
        return (
          <button
            key={id}
            className={`activity-button${active ? " active" : ""}`}
            title={`${label} (${shortcut})`}
            aria-label={label}
            aria-pressed={active}
            onClick={() =>
              setState(
                active ? { sidebarVisible: false } : { sidebarVisible: true, sidebarView: id },
              )
            }
          >
            <Icon size={22} strokeWidth={1.6} />
            {id === "scm" && changeCount > 0 && (
              <span className="activity-badge">{changeCount > 99 ? "99+" : changeCount}</span>
            )}
          </button>
        );
      })}
      <div className="activity-spacer" />
      <button
        className="activity-button"
        title="Settings (Ctrl+,)"
        aria-label="Settings"
        onClick={openSettingsTab}
      >
        <Settings size={21} strokeWidth={1.6} />
      </button>
    </nav>
  );
}
