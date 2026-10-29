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
    version: "0.1.0",
    date: "2026-10-30",
    title: "First public preview",
    summary:
      "The first CodeForge release: a fast desktop editor with Monaco-powered editing, a real integrated terminal, Git, project search and a secure-by-default architecture.",
    added: [
      "Monaco editor with tabs, unsaved-change indicators, find and replace, multi-cursor editing, code folding, minimap, bracket colorization and sticky scroll.",
      "Syntax highlighting for 70+ file types; completion, diagnostics, hover and formatting for TypeScript, JavaScript, JSON, CSS, SCSS, Less and HTML.",
      "File explorer: create (including nested paths), rename, drag-and-drop move, delete to the Recycle Bin, reveal in File Explorer, copy path, Git status colors.",
      "Integrated terminal backed by real shell processes (ConPTY on Windows) with multiple sessions, resizing, copy/paste and a configurable shell.",
      "Source control: initialize, stage, unstage, discard, side-by-side diffs, commit, branch switching and creation, pull, push and fetch using your installed Git.",
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
