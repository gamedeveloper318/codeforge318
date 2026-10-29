import { FilePlus, FolderOpen, FolderGit2, FileSearch, X } from "lucide-react";
import logo from "../../assets/logo.svg";
import product from "@shared/generated/product.json";
import { newUntitledFile } from "../../actions/editor";
import { openFiles, openFolder, openRecent, removeRecent } from "../../actions/workspace";
import { getCommand, shortcutFor } from "../../commands/commands";
import { basename } from "../../lib/paths";
import { useStore } from "../../state/store";

const SHORTCUTS = [
  "view.commandPalette",
  "go.file",
  "file.save",
  "terminal.toggle",
  "edit.findInFiles",
  "view.toggleSidebar",
];

export function WelcomePage() {
  const recent = useStore((s) => s.recent);
  const workspace = useStore((s) => s.workspace);
  const version = useStore((s) => s.appInfo?.version);

  return (
    <div className="welcome" data-testid="welcome-page">
      <div className="welcome-inner">
        <div className="welcome-hero">
          <img src={logo} alt="" draggable={false} />
          <h1>{product.name}</h1>
          <p>{product.tagline}</p>
          {version && (
            <p style={{ fontSize: 12, marginTop: 6, color: "var(--text-subtle)" }}>
              Version {version}
            </p>
          )}
        </div>
        <div className="welcome-grid">
          <section>
            <h2>Start</h2>
            <button className="welcome-action" onClick={newUntitledFile}>
              <FilePlus size={16} /> New File{" "}
              <span className="meta">{shortcutFor(getCommand("file.new")!)}</span>
            </button>
            <button className="welcome-action" onClick={() => void openFiles()}>
              <FileSearch size={16} /> Open File…{" "}
              <span className="meta">{shortcutFor(getCommand("file.open")!)}</span>
            </button>
            <button className="welcome-action" onClick={() => void openFolder()}>
              <FolderOpen size={16} /> Open Folder…
            </button>
            {workspace && (
              <p style={{ color: "var(--text-muted)", margin: "14px 10px 0", lineHeight: 1.6 }}>
                <strong style={{ color: "var(--text)" }}>{workspace.name}</strong> is open. Pick a
                file in the Explorer or press <kbd>{shortcutFor(getCommand("go.file")!)}</kbd> to
                jump to one.
              </p>
            )}
          </section>
          <section>
            <h2>Recent</h2>
            {recent.length === 0 && (
              <p style={{ color: "var(--text-muted)", margin: "8px 10px" }}>
                Folders you open will appear here.
              </p>
            )}
            {recent.slice(0, 7).map((root) => (
              <div key={root} className="recent-item">
                <button
                  className="welcome-action"
                  title={root}
                  onClick={() => void openRecent(root)}
                  style={{ minWidth: 0 }}
                >
                  <FolderGit2 size={16} style={{ flex: "none" }} />
                  <span style={{ flex: "none" }}>{basename(root)}</span>
                  <span className="path">{root}</span>
                </button>
                <button
                  className="icon-button"
                  title="Remove from list"
                  onClick={() => void removeRecent(root)}
                >
                  <X size={13} />
                </button>
              </div>
            ))}
          </section>
          <section>
            <h2>Keyboard shortcuts</h2>
            <div className="shortcut-list">
              {SHORTCUTS.map((id) => {
                const command = getCommand(id)!;
                return (
                  <div key={id} style={{ display: "contents" }}>
                    <span>{command.title.replace(/…$/, "")}</span>
                    <kbd>{shortcutFor(command)}</kbd>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
