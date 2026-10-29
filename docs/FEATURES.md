# Feature support matrix (CodeForge 0.1.0)

✅ implemented and tested · 🟡 partial · ⏳ planned

| Area | Capability | Status | Notes |
| --- | --- | --- | --- |
| Editor | Tabs, dirty indicators, save / save as / save all, untitled files | ✅ | E2E: edit + save to disk |
| Editor | Unsaved-change prompts on tab close, folder switch, window close | ✅ | E2E: close prompt |
| Editor | Find/replace, multi-cursor, folding, minimap, bracket colors, sticky scroll | ✅ | Monaco built-ins |
| Editor | Auto save, format on save | ✅ | Formatters: JS/TS/JSON/CSS/SCSS/Less/HTML |
| Editor | External change detection (reload clean files, warn before overwrite) | ✅ | |
| Editor | UTF-8 with BOM preservation, CRLF/LF preservation, binary/large file guard | ✅ | Unit tests |
| Files | Explorer: create (nested paths), rename, drag-move, delete to Recycle Bin | ✅ | E2E |
| Files | Reveal in Explorer, copy path, open terminal here, Git colors | ✅ | |
| Files | Recent folders, reopen last folder, open folder from command line | ✅ | |
| Search | Go to File (fuzzy), project text/regex search, include/exclude | ✅ | E2E |
| Search | Replace across files | ⏳ | |
| Terminal | Real shells via ConPTY, multiple sessions, resize, copy/paste, custom shell | ✅ | Unit (real PowerShell) + E2E |
| Terminal | Split panes | ⏳ | |
| Git | Status, stage/unstage, discard, diff (working tree & staged), commit | ✅ | Unit (real git) + E2E commit |
| Git | Branch switch/create, pull/push/fetch, recent commits | ✅ | Remote ops use the user's credentials; not E2E-tested against a remote |
| Git | Merge-conflict editor, blame, graph | ⏳ | Conflicted files are listed |
| Languages | Highlighting for 70+ file types | ✅ | |
| Languages | TS/JS intelligence | 🟡 | Across open files; no `node_modules` types |
| Languages | JSON/CSS/SCSS/Less/HTML intelligence | ✅ | |
| Languages | LSP for Python, Go, Rust, Java, C#… | ⏳ | |
| Run | Run active file, npm scripts | ✅ | Runtime must be installed |
| Run | Sandboxed HTML / localhost preview | ✅ | |
| Debug | Breakpoints, stepping (DAP) | ⏳ | Not shown in the UI as available |
| UI | Command Palette, keyboard shortcuts, title-bar menus, dark/light themes, settings UI | ✅ | E2E palette + settings |
| Extensions | Extension API / VS Code extensions | ⏳ | Not compatible with VS Code extensions |
| Platform | Windows 10/11 x64 installer | ✅ | Installed and E2E-tested |
| Platform | macOS / Linux | 🟡 | Config only; untested |
| Platform | Auto-update, code signing | ⏳ | |
| Cloud | Accounts, sync, database | ⏳ | See DATABASE.md |
