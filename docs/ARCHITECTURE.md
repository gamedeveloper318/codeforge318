# Architecture

CodeForge is two independent products that share a brand:

```
brand/                 single source of truth: logo, tokens, product.json, release-manifest.json
  └─ scripts/sync-brand.mjs copies these into ↓
desktop/               Electron app (Windows installer)
website/               Next.js site (Vercel)
```

Each app is built, tested and deployed on its own. The website never imports desktop code, and the desktop app has no runtime dependency on the website. Copies of brand files live in each app's `generated/` folders so Vercel can build `website/` without the rest of the repository.

## Desktop app

Electron splits the app into processes with very different privileges:

```
┌─────────────────────────── main process (Node.js, full access) ───────────────────────────┐
│ index.ts        app lifecycle, app:// protocol, window, single instance, crash recovery      │
│ ipc.ts          the ONLY entry point for UI requests: sender check + zod validation         │
│ workspace.ts    the open folder, path guard, file watcher                                   │
│ fs-service.ts   read / write / create / rename / trash                                      │
│ search-service  project search          git-service   runs the user's git (execFile)        │
│ terminal-service node-pty shells        preview.ts    sandboxed preview windows             │
│ update-service  electron-updater (GitHub Releases)    lsp-service  Pyright for Python       │
│ app-state.ts    settings.json + state.json in %APPDATA%\CodeForge                           │
└───────────────────────────────────────────────┬────────────────────────────────────────────┘
                                                │ allow-listed IPC channels (shared/ipc.ts)
┌──────────────────── preload (sandboxed) ───────┴── exposes window.codeforge {invoke, send, on} ┐
└───────────────────────────────────────────────┬────────────────────────────────────────────┘
┌──────────────────── renderer (sandboxed, no Node.js) — React UI ───────────────────────────┐
│ state/store.ts (zustand) · actions/* (what buttons do) · commands/ (palette + shortcuts)     │
│ monaco/ (editor engine, workers, themes, models) · terminal/ (xterm.js instances)           │
│ components/ (title bar, activity bar, side bar views, editor area, panel, status bar)      │
└────────────────────────────────────────────────────────────────────────────────────────────┘
```

Key decisions:

- **IPC contract in one file.** `desktop/src/shared/ipc.ts` lists every channel, its argument types and its result type. The preload refuses channels not on the list; `ipc.ts` validates arguments with zod and checks the sender is CodeForge's own window. Errors cross the boundary as plain messages (`{ ok, value | error }`).
- **Path guard.** Every filesystem path from the UI goes through `Workspace.resolve()`: it must be inside the open folder after resolving symlinks/junctions, or be a file the user picked in a native dialog.
- **Custom `app://` protocol.** The UI is served from `app://codeforge/` instead of `file://`: Monaco's web workers need a real origin, and the strict CSP (`script-src 'self'`) then means "only files shipped with CodeForge".
- **One Monaco editor, many models.** Each tab owns a text model; switching tabs swaps the model and restores the view state. Dirty state compares the model's version with the version at last save.
- **Terminals.** `@lydell/node-pty` ships prebuilt N-API binaries, so no compiler is needed and the same binary works in Node (tests) and Electron. Output is batched every 5 ms. The binaries are unpacked from the asar archive (`asarUnpack` in `electron-builder.yml`).
- **Git.** `git` is called with argument arrays (never a shell), `GIT_TERMINAL_PROMPT=0` so it never hangs, and `GIT_OPTIONAL_LOCKS=0` so status checks don't fight other Git tools.
- **Close handshake.** Closing the window asks the UI first; the UI offers to save dirty files and then confirms.
- **Python IntelliSense.** Monaco 0.57's built-in LSP client (`monaco.lsp.MonacoLspClient`) talks to Pyright through a worker-shaped port (`renderer/src/lsp/python.ts`) over IPC. `lsp-service.ts` runs Pyright with Electron's Node (`ELECTRON_RUN_AS_NODE`), frames messages, and its `LspBridge` only forwards Python files saved on disk, scopes the server's features to Python, tells the server which folder is open, answers server requests the editor doesn't implement, and replays open documents after a crash restart. The server starts the first time a Python file is opened.
- **Automatic updates.** `update-service.ts` wraps electron-updater: background download, `update:status` events to the UI, install on "Restart Now" (after the unsaved-changes prompt) or on quit. The GitHub provider is configured in `electron-builder.yml`; the release workflow uploads `latest.yml` and the blockmap that installed copies read.

## Website

Next.js App Router with the classic caching model (not Cache Components):

- All pages are prerendered. `/` and `/download` use `revalidate = 600`.
- `src/lib/release.ts` builds installer URLs from `release-manifest.json` + `CODEFORGE_GITHUB_REPO` and **HEAD-checks** them. A download button only renders when the file really exists, so a fresh deployment shows "coming soon" instead of a dead link, and the button appears within 10 minutes of publishing a release — no redeploy needed.
- `src/lib/env.ts` validates configuration with zod; `next.config.ts` calls it so a bad value fails the build with a clear message.
- Docs content is TSX in `src/lib/docs.tsx`, rendered by `app/docs/[slug]`.
- Security headers (frame denial, nosniff, HSTS, referrer and permissions policies) are set in `next.config.ts`.
