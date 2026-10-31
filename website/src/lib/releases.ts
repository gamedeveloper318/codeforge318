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
    version: "0.4.0",
    date: "2026-10-31",
    title: "Working menus, Run & Debug, Auto Save and smarter editing",
    summary:
      "Every menu works, programs run and debug from the Run menu, files save themselves, and the editor colors, checks and completes your code much more like VS Code. Installed copies update automatically.",
    added: [
      "Fixed: clicking an item in the File, Edit, Selection, View, Go, Run, Terminal or Help menu did nothing on Windows (the click was treated as dragging the window). Every menu item now works, with its keyboard shortcut shown, Alt+F / Alt+E / … to open menus from the keyboard, and a short explanation when an action isn't available.",
      "New menu commands: File > Exit, Selection > Select Line and Shrink Selection, View > Zoom In / Zoom Out / Reset Zoom (Ctrl+= / Ctrl+- / Ctrl+0), Help > Documentation and a searchable Keyboard Shortcuts page.",
      "Run > Run Current File (Ctrl+F5) runs Python, JavaScript, TypeScript, Java, PowerShell, shell, Ruby, PHP, Go, Lua and Dart files in a terminal and shows the exit code. Start Debugging (F5) opens Python files in pdb and JavaScript files in node inspect; Stop Running Program (Shift+F5) stops them. A missing runtime is explained with a download link instead of an error.",
      "Terminal profiles: PowerShell, Command Prompt, PowerShell 7 and Git Bash (when installed), via Terminal > New Terminal With Profile… or the Default terminal setting.",
      "Auto Save is on by default: files are saved one second after you stop typing (configurable, or switch it off in the status bar or File > Auto Save). The status bar shows Saving…, Saved, Unsaved or Save failed; a failed save keeps your changes and offers Retry without repeating the error.",
      "Language icons for files in the Explorer, tabs, Go to File, search results and Problems (Python, JavaScript, TypeScript, React, HTML, CSS, JSON, Java, C, C++, C#, PHP, Ruby, Go, Rust, SQL, Markdown, XML, YAML and more); icons follow renames.",
      "Richer syntax highlighting: function and method names, classes and types, parameters and properties get their own colors, in every language.",
      "New checks in the Problems panel: code from the wrong language (for example Python print(…) written in an HTML page, or JavaScript outside a <script> tag) and unbalanced HTML tags. The Problems panel groups problems by file, filters by errors/warnings/info and jumps to the exact spot.",
      "Smarter suggestions: JavaScript/TypeScript IntelliSense now sees every file in the project (imports, types and errors across files), Python suggestions rank the best match first (pri → print), and Java, C, C++, C#, Go, Rust, PHP, Ruby, SQL and more get keyword and snippet suggestions.",
      "Change the language of a file from the status bar; files without an extension are recognised from their first line (#!/usr/bin/env python3, <!DOCTYPE html>, …).",
    ],
    security: [
      "Run and Start Debugging only send the file's path to the app's main process, which picks the program and its arguments itself; the page cannot start arbitrary programs.",
      "Terminal profiles are detected on this computer; the page can only choose one of them by name.",
    ],
    knownLimitations: [
      "Debugging uses each language's own terminal debugger (pdb, node inspect); breakpoints in the editor gutter are not available yet.",
      "Java, C, C++, C#, Go, Rust, PHP and Ruby get keyword, snippet and word suggestions; full IntelliSense for them needs their language servers, which are not included yet.",
      "The installer is still not code-signed.",
    ],
  },
  {
    version: "0.3.0",
    date: "2026-10-30",
    title: "Replace in files and split terminals",
    summary:
      "Search and replace across your whole project, and run terminals side by side. Installed 0.2.0 copies update to this version automatically.",
    added: [
      "Replace across files from the Search view, with a live preview of every change, Replace All or per-file replace, and a confirmation first. Regular-expression replacements support $1, $<name> and $&.",
      "Files open in the editor are changed in the editor (undo with Ctrl+Z, save when you're ready); other files are changed on disk, keeping their encoding and line endings.",
      "Search results now include unsaved changes in open files.",
      "Split terminals: up to four real shells side by side (Ctrl+Shift+5 or the split button).",
    ],
    security: ["Replacing on disk is limited to the open folder, like every other file operation."],
    knownLimitations: [
      "Breakpoint debugging and language servers for Go, Rust, Java and C# are not included yet.",
      "The installer is still not code-signed.",
    ],
  },
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
