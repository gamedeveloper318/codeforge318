import { useStore } from "../state/store";
import { ExplorerView } from "./views/ExplorerView";
import { RunView } from "./views/RunView";
import { SearchView } from "./views/SearchView";
import { SourceControlView } from "./views/SourceControlView";

export function Sidebar() {
  const view = useStore((s) => s.sidebarView);
  const width = useStore((s) => s.sidebarWidth);
  return (
    <aside className="sidebar" style={{ width }} aria-label="Side bar">
      {view === "explorer" && <ExplorerView />}
      {view === "search" && <SearchView />}
      {view === "scm" && <SourceControlView />}
      {view === "run" && <RunView />}
    </aside>
  );
}
