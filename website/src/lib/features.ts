export type SupportLevel = "available" | "partial" | "planned";

export interface Feature {
  id: string;
  title: string;
  summary: string;
  icon:
    | "code"
    | "terminal"
    | "git"
    | "search"
    | "command"
    | "shield"
    | "brain"
    | "play"
    | "palette"
    | "folder"
    | "save"
    | "bug";
}

export const HIGHLIGHTS: Feature[] = [
  {
    id: "editor",
    title: "Monaco-powered editing",
    summary:
      "The editing engine behind VS Code: multi-cursor, find & replace, folding, minimap, bracket colors and sticky scroll.",
    icon: "code",
  },
  {
    id: "terminal",
    title: "A real integrated terminal",
    summary:
      "Real shell processes through ConPTY — PowerShell, cmd or Git Bash — with multiple sessions and copy/paste.",
    icon: "terminal",
  },
  {
    id: "git",
    title: "Git, built in",
    summary:
      "Stage, unstage, discard, diff, commit, switch branches, pull and push — powered by the Git you already have.",
    icon: "git",
  },
  {
    id: "search",
    title: "Project-wide search",
    summary:
      "Find text across your whole project with regex, case and whole-word options and include/exclude filters.",
    icon: "search",
  },
  {
    id: "palette",
    title: "Keyboard first",
    summary:
      "Command Palette, Go to File, Go to Line and familiar shortcuts keep your hands on the keyboard.",
    icon: "command",
  },
  {
    id: "intelligence",
    title: "Language intelligence",
    summary:
      "Completion, errors, hover and go to definition for Python (Pyright), TypeScript, JavaScript, JSON, CSS and HTML; highlighting for 70+ file types.",
    icon: "brain",
  },
  {
    id: "run",
    title: "Run & preview",
    summary:
      "Run the current file or npm scripts in one click and preview HTML or localhost servers in a sandboxed window.",
    icon: "play",
  },
  {
    id: "files",
    title: "Safe file management",
    summary:
      "Create, rename, drag to move and delete to the Recycle Bin, with prompts before you lose unsaved work.",
    icon: "folder",
  },
  {
    id: "security",
    title: "Secure by design",
    summary:
      "Sandboxed UI, an allow-listed IPC bridge, file access limited to your open folder and a strict content policy.",
    icon: "shield",
  },
];

export interface MatrixRow {
  area: string;
  capability: string;
  status: SupportLevel;
  note?: string;
}

/** The honest support matrix shown on the Features page. */
export const SUPPORT_MATRIX: MatrixRow[] = [
  {
    area: "Editor",
    capability: "Tabs, unsaved indicators, save / save as / save all",
    status: "available",
  },
  {
    area: "Editor",
    capability: "Find & replace, multi-cursor, folding, minimap",
    status: "available",
  },
  {
    area: "Editor",
    capability: "Auto save and format on save",
    status: "available",
    note: "Formatting for JS/TS/JSON/CSS/HTML",
  },
  { area: "Editor", capability: "Detects files changed outside CodeForge", status: "available" },
  {
    area: "Files",
    capability: "Explorer: create, rename, move, delete to Recycle Bin",
    status: "available",
  },
  { area: "Files", capability: "Recent folders, reopen last folder", status: "available" },
  { area: "Search", capability: "Project-wide text and regex search", status: "available" },
  { area: "Search", capability: "Replace across files", status: "planned" },
  {
    area: "Terminal",
    capability: "Real shells, multiple sessions, resize, copy/paste",
    status: "available",
  },
  { area: "Terminal", capability: "Split terminals", status: "planned" },
  { area: "Git", capability: "Status, stage, unstage, discard, diff, commit", status: "available" },
  {
    area: "Git",
    capability: "Branches, pull, push, fetch",
    status: "available",
    note: "Uses your Git credentials",
  },
  { area: "Git", capability: "Merge conflict editor, blame, history graph", status: "planned" },
  { area: "Languages", capability: "Syntax highlighting (70+ file types)", status: "available" },
  {
    area: "Languages",
    capability: "TypeScript / JavaScript intelligence",
    status: "partial",
    note: "Works across open files; no node_modules type resolution yet",
  },
  {
    area: "Languages",
    capability: "JSON, CSS, SCSS, Less, HTML intelligence",
    status: "available",
  },
  {
    area: "Languages",
    capability: "Python intelligence (Pyright language server)",
    status: "available",
    note: "Completion, type errors, hover, go to definition, references, rename",
  },
  {
    area: "Languages",
    capability: "Language servers for Go, Rust, Java, C#…",
    status: "planned",
  },
  {
    area: "Run",
    capability: "Run active file, npm scripts",
    status: "available",
    note: "Requires the language runtime installed",
  },
  { area: "Run", capability: "Sandboxed HTML and localhost preview", status: "available" },
  { area: "Debugging", capability: "Breakpoints and step debugging", status: "planned" },
  {
    area: "Customization",
    capability: "Dark & light themes, settings UI, keyboard shortcuts",
    status: "available",
  },
  {
    area: "Customization",
    capability: "Extensions",
    status: "planned",
    note: "VS Code extensions are not supported",
  },
  { area: "Platform", capability: "Windows 10/11 installer", status: "available" },
  {
    area: "Platform",
    capability: "macOS and Linux builds",
    status: "partial",
    note: "Build from source; not yet tested",
  },
  {
    area: "Platform",
    capability: "Automatic updates",
    status: "available",
    note: "From 0.2.0: downloads in the background, asks before restarting",
  },
];
