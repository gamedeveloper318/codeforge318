import { useEffect, useRef } from "react";
import logo from "./assets/logo.svg";
import { initialize } from "./actions/workspace";
import { reportError } from "./actions/notify";
import { commandForEvent, runCommand } from "./commands/commands";
import { ActivityBar } from "./components/ActivityBar";
import { EditorArea } from "./components/editor/EditorArea";
import { ContextMenuHost } from "./components/Menu";
import { Panel } from "./components/Panel";
import { QuickPick } from "./components/QuickPick";
import { Sash } from "./components/Sash";
import { Sidebar } from "./components/Sidebar";
import { StatusBar } from "./components/StatusBar";
import { menuForMnemonic, TitleBar } from "./components/TitleBar";
import { Toasts } from "./components/Toasts";
import { allEntries } from "./monaco/models";
import { monaco } from "./monaco/setup";
import { getState, setState, useStore, type Problem } from "./state/store";

const LAYOUT_KEY = "codeforge.layout";

function restoreLayout(): void {
  try {
    const saved = JSON.parse(localStorage.getItem(LAYOUT_KEY) ?? "{}") as Record<string, unknown>;
    const patch: Partial<ReturnType<typeof getState>> = {};
    if (typeof saved.sidebarWidth === "number") patch.sidebarWidth = saved.sidebarWidth;
    if (typeof saved.panelHeight === "number") patch.panelHeight = saved.panelHeight;
    if (typeof saved.sidebarVisible === "boolean") patch.sidebarVisible = saved.sidebarVisible;
    setState(patch);
  } catch {
    // layout preferences are optional
  }
}

function saveLayout(): void {
  const { sidebarWidth, panelHeight, sidebarVisible } = getState();
  try {
    localStorage.setItem(LAYOUT_KEY, JSON.stringify({ sidebarWidth, panelHeight, sidebarVisible }));
  } catch {
    // ignore storage failures
  }
}

/** Mirrors Monaco's diagnostics (from its built-in language services) into the Problems panel. */
function watchMarkers(): monaco.IDisposable {
  const severity = (value: monaco.MarkerSeverity): Problem["severity"] | null =>
    value === monaco.MarkerSeverity.Error
      ? "error"
      : value === monaco.MarkerSeverity.Warning
        ? "warning"
        : value === monaco.MarkerSeverity.Info
          ? "info"
          : null;
  return monaco.editor.onDidChangeMarkers(() => {
    const pathByUri = new Map(
      allEntries().map(([tabId, entry]) => [entry.model.uri.toString(), tabId]),
    );
    const problems: Problem[] = [];
    for (const marker of monaco.editor.getModelMarkers({})) {
      const level = severity(marker.severity);
      const path = pathByUri.get(marker.resource.toString());
      if (!level || !path || path.startsWith("untitled:")) continue;
      problems.push({
        path,
        line: marker.startLineNumber,
        column: marker.startColumn,
        endLine: marker.endLineNumber,
        endColumn: marker.endColumn,
        message: marker.message,
        severity: level,
        source: marker.source,
      });
    }
    const rank = { error: 0, warning: 1, info: 2 };
    problems.sort(
      (a, b) =>
        rank[a.severity] - rank[b.severity] || a.path.localeCompare(b.path) || a.line - b.line,
    );
    setState({ problems });
  });
}

export function App() {
  const ready = useStore((s) => s.ready);
  const sidebarVisible = useStore((s) => s.sidebarVisible);
  const panelVisible = useStore((s) => s.panelVisible);
  const dragStart = useRef(0);

  useEffect(() => {
    restoreLayout();
    initialize().catch((error) => reportError("CodeForge failed to start", error));
    const markers = watchMarkers();

    // Workbench shortcuts are handled in the capture phase so they work
    // everywhere (editor, terminal, inputs). Editing keys stay with Monaco.
    const onKeyDown = (event: KeyboardEvent) => {
      // Alt+F, Alt+E, ... open the title-bar menus.
      const menu = menuForMnemonic(event);
      if (menu !== null) {
        event.preventDefault();
        event.stopPropagation();
        setState({ openMenu: menu, contextMenu: null });
        return;
      }
      const command = commandForEvent(event);
      if (!command) return;
      event.preventDefault();
      event.stopPropagation();
      runCommand(command.id);
    };
    window.addEventListener("keydown", onKeyDown, true);
    const unsubscribe = useStore.subscribe((state, previous) => {
      if (
        state.sidebarWidth !== previous.sidebarWidth ||
        state.panelHeight !== previous.panelHeight ||
        state.sidebarVisible !== previous.sidebarVisible
      ) {
        saveLayout();
      }
    });
    return () => {
      markers.dispose();
      window.removeEventListener("keydown", onKeyDown, true);
      unsubscribe();
    };
  }, []);

  if (!ready) {
    return (
      <div style={{ height: "100%", display: "grid", placeItems: "center" }}>
        <img src={logo} alt="CodeForge" width={72} height={72} style={{ opacity: 0.9 }} />
      </div>
    );
  }

  return (
    <div className="workbench">
      <TitleBar />
      <div className="workbench-main">
        <ActivityBar />
        {sidebarVisible && (
          <>
            <Sidebar />
            <Sash
              direction="vertical"
              onResize={(delta) => {
                if (!dragStart.current) dragStart.current = getState().sidebarWidth;
                setState({ sidebarWidth: Math.min(700, Math.max(170, dragStart.current + delta)) });
              }}
              onEnd={() => (dragStart.current = 0)}
            />
          </>
        )}
        <main className="editor-column">
          <EditorArea />
          {panelVisible && (
            <>
              <Sash
                direction="horizontal"
                onResize={(delta) => {
                  if (!dragStart.current) dragStart.current = getState().panelHeight;
                  setState({
                    panelHeight: Math.min(
                      window.innerHeight - 160,
                      Math.max(90, dragStart.current - delta),
                    ),
                  });
                }}
                onEnd={() => (dragStart.current = 0)}
              />
              <Panel />
            </>
          )}
        </main>
      </div>
      <StatusBar />
      <QuickPick />
      <ContextMenuHost />
      <Toasts />
    </div>
  );
}
