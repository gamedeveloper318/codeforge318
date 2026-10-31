import { GitCompare, Keyboard, Settings, X } from "lucide-react";
import { useEffect, useRef } from "react";
import { activateTab, closeTab, closeTabs } from "../../actions/editor";
import { copyPath, revealInOS } from "../../actions/explorer";
import { api } from "../../lib/bridge";
import * as paths from "../../lib/paths";
import { useStore, type Tab } from "../../state/store";
import { FileIcon } from "../FileIcon";
import { openContextMenu } from "../Menu";

function TabIcon({ tab }: { tab: Tab }) {
  if (tab.kind === "settings") return <Settings size={14} color="var(--text-muted)" />;
  if (tab.kind === "shortcuts") return <Keyboard size={14} color="var(--text-muted)" />;
  if (tab.kind === "diff") return <GitCompare size={14} color="var(--git-modified)" />;
  return <FileIcon name={tab.path ?? tab.title} />;
}

export function TabBar() {
  const tabs = useStore((s) => s.tabs);
  const activeTabId = useStore((s) => s.activeTabId);
  const dirty = useStore((s) => s.dirty);
  const barRef = useRef<HTMLDivElement>(null);

  // Keep the active tab scrolled into view.
  useEffect(() => {
    barRef.current
      ?.querySelector(".tab.active")
      ?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [activeTabId]);

  // Show the folder name when two open files share a name.
  const nameCounts = new Map<string, number>();
  for (const tab of tabs) nameCounts.set(tab.title, (nameCounts.get(tab.title) ?? 0) + 1);

  return (
    <div className="tabbar" role="tablist" ref={barRef}>
      {tabs.map((tab) => {
        const isDirty = Boolean(dirty[tab.id]);
        const filePath = tab.kind === "file" ? tab.path : tab.kind === "diff" ? tab.path : null;
        const duplicate = (nameCounts.get(tab.title) ?? 0) > 1 && filePath;
        return (
          <div
            key={tab.id}
            role="tab"
            aria-selected={tab.id === activeTabId}
            className={`tab${tab.id === activeTabId ? " active" : ""}${isDirty ? " dirty" : ""}`}
            title={filePath ?? tab.title}
            data-testid="editor-tab"
            onMouseDown={(e) => {
              if (e.button === 1) {
                e.preventDefault();
                void closeTab(tab.id);
              } else if (e.button === 0) {
                activateTab(tab.id);
              }
            }}
            onContextMenu={(e) =>
              openContextMenu(e, [
                { label: "Close", shortcut: "Ctrl+W", run: () => void closeTab(tab.id) },
                { label: "Close Others", run: () => void closeTabs((t) => t.id !== tab.id) },
                { label: "Close All", run: () => void closeTabs(() => true) },
                ...(filePath
                  ? [
                      { separator: true },
                      { label: "Copy Path", run: () => void copyPath(filePath, false) },
                      {
                        label:
                          api.platform === "win32" ? "Reveal in File Explorer" : "Reveal in Finder",
                        run: () => void revealInOS(filePath),
                      },
                    ]
                  : []),
              ])
            }
          >
            <TabIcon tab={tab} />
            <span className="tab-title">
              {tab.title}
              {duplicate && (
                <span style={{ color: "var(--text-subtle)", marginLeft: 6, fontSize: 12 }}>
                  {paths.basename(paths.dirname(filePath))}
                </span>
              )}
            </span>
            <button
              className="tab-close"
              title={isDirty ? "Unsaved changes — close" : "Close"}
              aria-label={`Close ${tab.title}`}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={() => void closeTab(tab.id)}
            >
              {isDirty && <span className="dirty-dot" data-testid="dirty-indicator" />}
              <X size={14} className="close-icon" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

export function Breadcrumbs({ path }: { path: string }) {
  const root = useStore((s) => s.workspace?.root);
  const relativePath = root ? paths.relative(root, path) : path;
  const parts = relativePath.split(/[\\/]/).filter(Boolean);
  return (
    <div className="breadcrumbs">
      {parts.map((part, index) => (
        <span key={index} className="crumb">
          {part}
          {index < parts.length - 1 && (
            <span style={{ margin: "0 6px", color: "var(--text-subtle)" }}>›</span>
          )}
        </span>
      ))}
    </div>
  );
}
