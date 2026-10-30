export interface ReleaseNote {
  version: string;
  date: string;
  title: string;
  summary: string;
  added: string[];
  security: string[];
  knownLimitations: string[];
}

/** Human-written release notes, newest first. */
export const RELEASES: ReleaseNote[] = [
  {
    version: "0.2.0",
    date: "2026-10-30",
    title: "Python IntelliSense and automatic updates",
    summary:
      "CodeForge now understands Python and keeps itself up to date: install this version once, and future versions arrive automatically.",
    added: [
      "Python IntelliSense powered by the bundled Pyright language server: completion, type errors in the Problems panel, hover information, signature help, go to definition, find references and rename. Works without installing anything extra; with Python installed it also understands your installed packages.",
      'Automatic updates: CodeForge checks GitHub for a newer version when it starts and every few hours, downloads it in the background and offers "Restart Now" or "Later". If you simply quit, the update installs on exit.',
      "Help → Check for Updates… to check right away, and a status-bar indicator while an update downloads or waits to be installed.",
      "New settings: “Python IntelliSense” and “Check for updates automatically”, both on by default.",
    ],
    security: [
      "Updates are downloaded over HTTPS from this project's GitHub Releases and checked against the SHA-512 recorded with each release before they are installed.",
      "Restarting to update first offers to save unsaved files, exactly like closing the window.",
    ],
    knownLimitations: [
      "Version 0.1.1 has no updater, so install 0.2.0 from the download page once; later versions then arrive automatically.",
      "The installer is still not code-signed, so Windows SmartScreen may warn on the first manual install.",
      "Language servers for Go, Rust, Java, C# and other languages are not included yet.",
    ],
  },
  {
    version: "0.1.1",
    date: "2026-10-30",
    title: "First public preview",
    summary:
      "The first CodeForge release: a fast desktop editor with Monaco-powered editing, a real integrated terminal, Git, project search and a secure-by-default architecture.",
    added: [
      "Monaco editor with tabs, unsaved-change indicators, find and replace, multi-cursor editing, code folding, minimap, bracket colorization and sticky scroll.",
      "Syntax highlighting for 70+ file types; completion, diagnostics, hover and formatting for TypeScript, JavaScript, JSON, CSS, SCSS, Less and HTML.",
      "File explorer: create (including nested paths), rename, drag-and-drop move, delete to the Recycle Bin, reveal in File Explorer, copy path, Git status colors.",
      "Integrated terminal backed by real shell processes (ConPTY on Windows) with multiple sessions, resizing, copy/paste and a configurable shell.",
      "Source control: initialize, stage, unstage, discard, side-by-side diffs, commit, branch switching and creation, pull, push and fetch using your installed Git — including folders opened through junctions, symbolic links, subst drives or short (8.3) paths.",
      "Project-wide search with case, whole-word and regular-expression options plus include/exclude filters.",
      "Command Palette, Go to File, Go to Line, keyboard shortcuts and a custom title-bar menu.",
      "Run the active file (Node.js, Python, PowerShell and more) or npm scripts in a terminal, and preview HTML files or localhost servers in a sandboxed window.",
      "Settings UI with dark and light themes, auto save, format on save and editor preferences, saved automatically.",
      "Protection against data loss: prompts before closing unsaved files, a warning when a file changed on disk, and detection of external edits.",
    ],
    security: [
      "Renderer runs sandboxed with context isolation and no Node.js access.",
      "Every IPC request is checked against an allow-list and validated in the main process.",
      "File operations are restricted to the folder you opened, including protection against symlink escapes.",
      "Strict Content Security Policy; the UI is served from a private app:// origin.",
      "Previews run in a separate sandboxed window with all permissions denied.",
    ],
    knownLimitations: [
      "Windows only for the prebuilt installer; macOS and Linux can be built from source but are untested.",
      "The installer is not code-signed yet, so Windows SmartScreen shows a warning on first run.",
      "Breakpoint debugging and language servers for languages beyond the web stack (Python, Go, Rust, …) are not included yet.",
      "No extension marketplace; VS Code extensions are not supported.",
      "No automatic updates yet — download new versions from this site.",
    ],
  },
];
