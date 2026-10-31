import { useEffect } from "react";
import { setState, useStore } from "../../state/store";
import { CodeEditor } from "./CodeEditor";
import { DiffView } from "./DiffView";
import { SettingsPage } from "./SettingsPage";
import { ShortcutsPage } from "./ShortcutsPage";
import { Breadcrumbs, TabBar } from "./TabBar";
import { WelcomePage } from "./WelcomePage";

export function EditorArea() {
  const tabs = useStore((s) => s.tabs);
  const activeTabId = useStore((s) => s.activeTabId);
  const active = tabs.find((t) => t.id === activeTabId) ?? null;
  const fileTabId = active?.kind === "file" ? active.id : null;

  // The status bar's cursor info only applies to the code editor.
  useEffect(() => {
    if (!fileTabId) setState({ editorStatus: null });
  }, [fileTabId]);

  return (
    <>
      {tabs.length > 0 && <TabBar />}
      {active?.kind === "file" && active.path && <Breadcrumbs path={active.path} />}
      <div className="editor-host">
        <CodeEditor tabId={fileTabId} />
        {!active && <WelcomePage />}
        {active?.kind === "settings" && <SettingsPage />}
        {active?.kind === "shortcuts" && <ShortcutsPage />}
        {active?.kind === "diff" && (
          <DiffView key={active.id} path={active.path} staged={active.staged} />
        )}
      </div>
    </>
  );
}
