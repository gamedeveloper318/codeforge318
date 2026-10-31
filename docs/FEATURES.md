# Feature support matrix (CodeForge 0.4.0)

✅ implemented and tested · 🟡 partial · ⏳ planned

| Area | Capability | Status | Notes |
| --- | --- | --- | --- |
| Editor | Tabs, dirty indicators, save / save as / save all, untitled files | ✅ | E2E: edit + save to disk |
| Editor | Unsaved-change prompts on tab close, folder switch, window close | ✅ | E2E: close prompt |
| Editor | Find/replace, multi-cursor, folding, minimap, bracket colors, sticky scroll | ✅ | Monaco built-ins |
| Editor | Auto save (on by default, 1 s after typing stops; status bar state and toggle; failures keep changes, no retry loop), format on save | ✅ | Unit (scheduler, fake timers) + E2E (writes to disk, off/on, read-only file + Retry) |
| Editor | External change detection (reload clean files, warn before overwrite) | ✅ | |
| Editor | UTF-8 with BOM preservation, CRLF/LF preservation, binary/large file guard | ✅ | Unit tests |
| Files | Explorer: create (nested paths), rename, drag-move, delete to Recycle Bin | ✅ | E2E |
| Files | Reveal in Explorer, copy path, open terminal here, Git colors | ✅ | |
| Files | Recent folders, reopen last folder, open folder from command line | ✅ | |
| Files | Language icons (material-icon-theme) in explorer, tabs, quick open, search, problems; follow renames | ✅ | Unit (mapping) + E2E (icons, rename) |
| Search | Go to File (fuzzy), project text/regex search, include/exclude | ✅ | E2E |
| Search | Replace across files (preview, confirm, regex groups; open files changed in the editor) | ✅ | Unit + E2E |
| Terminal | Real shells via ConPTY, multiple sessions, resize, copy/paste, custom shell | ✅ | Unit (real PowerShell) + E2E |
| Terminal | Split terminals (up to 4 side by side) | ✅ | E2E |
| Terminal | Profiles: PowerShell, Command Prompt, PowerShell 7, Git Bash (detected), default-profile setting | ✅ | Unit (real cmd) + E2E (PowerShell and cmd commands) |
| Git | Status, stage/unstage, discard, diff (working tree & staged), commit | ✅ | Unit (real git) + E2E commit |
| Git | Branch switch/create, pull/push/fetch, recent commits | ✅ | Remote ops use the user's credentials; not E2E-tested against a remote |
| Git | Merge-conflict editor, blame, graph | ⏳ | Conflicted files are listed |
| Languages | Highlighting for 70+ file types; semantic colors for functions, methods, classes, parameters, properties | ✅ | E2E (rendered colors) |
| Languages | Problems: wrong-language code (Python in HTML, JS outside `<script>`, JS in Python, Python in JS), unbalanced HTML tags; grouped, filterable Problems panel | ✅ | Unit (true/false positives) + E2E |
| Languages | Keyword/built-in/snippet completion for Java, C, C++, C#, Go, Rust, PHP, Ruby, SQL, Kotlin, Swift, Dart, Lua, R, shell, PowerShell | ✅ | E2E (Java) |
| Languages | Change language mode; detection from shebang / doctype | ✅ | Unit + E2E |
| Languages | TS/JS intelligence | 🟡 | Across all project files (≤400); no `node_modules` types. E2E: cross-file type error |
| Languages | JSON/CSS/SCSS/Less/HTML intelligence | ✅ | |
| Languages | Python intelligence via Pyright (completion, type errors, hover, definition, references, rename) | ✅ | Unit (real Pyright) + E2E (pri → print ranked first) |
| Languages | LSP for Go, Rust, Java, C#… | ⏳ | |
| Run | Run current file (own terminal, exit code), stop running program, npm scripts | ✅ | Runtime checked first, with a download link when missing. E2E (Python, Node, stop) |
| Run | Sandboxed HTML / localhost preview | ✅ | |
| Debug | Start Debugging in the terminal: pdb (Python), node inspect (JavaScript) | ✅ | E2E (pdb stepping, node inspect) |
| Debug | Editor breakpoints / DAP | ⏳ | |
| UI | Title-bar menus (all items, Alt mnemonics, explanations when unavailable), Command Palette, Keyboard Shortcuts page, window zoom, dark/light themes, settings UI | ✅ | E2E incl. Windows hit test (WM_NCHITTEST) that every menu item gets real clicks |
| Extensions | Extension API / VS Code extensions | ⏳ | Not compatible with VS Code extensions |
| Platform | Windows 10/11 x64 installer | ✅ | Installed and E2E-tested |
| Platform | macOS / Linux | 🟡 | Config only; untested |
| Platform | Automatic updates from GitHub Releases | ✅ | From 0.2.0; unit tests with a fake updater, UI E2E |
| Platform | Code signing | ⏳ | |
| Cloud | Accounts, sync, database | ⏳ | See DATABASE.md |
