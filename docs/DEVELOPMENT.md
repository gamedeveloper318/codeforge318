# Development guide

## Prerequisites

- Node.js 22 or newer (developed on Node 24, npm 11)
- Git
- Windows 10/11 for building the Windows installer
- Microsoft Edge (preinstalled on Windows) for the website's browser tests

## First-time setup

```bash
npm run setup
```

This installs dependencies in the root, `desktop/` and `website/`, downloads the Electron runtime, syncs brand files, generates icons and validates the website configuration. Run it again any time — it is safe to repeat.

> **Why setup downloads Electron separately:** npm 11 no longer runs package install scripts by default, and Electron 45 downloads its binary lazily. `setup` runs `node_modules/electron/install.js` for you.

## Running

```bash
npm run dev:desktop   # Electron + Vite with hot reload (renderer) and auto-restart (main)
npm run dev:web       # Next.js dev server on http://localhost:3000
```

### `ELECTRON_RUN_AS_NODE`

Editors built on Electron (VS Code, AntiGravity…) sometimes leak `ELECTRON_RUN_AS_NODE=1` into terminals. With it set, Electron behaves like plain Node.js and **no window opens**. The desktop `dev`/`start` scripts run through `desktop/scripts/run-clean.mjs`, which removes it; the end-to-end tests and the integrated terminal (for programs you run inside CodeForge) also remove it.

## Testing

| Command | Where | What |
| --- | --- | --- |
| `npm test` (desktop) | `tests/unit` | Shared logic, path guard, file service, search, **real Git** in a temp repo, **real PowerShell** via node-pty |
| `npm run test:e2e` (desktop) | `tests/e2e` | Builds and launches the real app with Playwright: editing/saving, unsaved-change prompt, explorer, terminal, Git commit, search, palette, settings, security boundary |
| `npm run test:e2e:packaged` (desktop) | same | The same tests against `release/win-unpacked/CodeForge.exe` |
| `npm test` (website) | `tests/unit` | Config validation and download resolution |
| `npm run test:e2e` (website) | `tests/e2e` | Production server in Edge, desktop and mobile viewports |
| `npm run verify` (root) | everything | Typecheck, lint, tests, builds, end-to-end; prints a summary |

Native dialogs can't be clicked by Playwright, so the desktop tests answer them from the main process (`tests/e2e/helpers.ts`). Each test run uses a throwaway settings folder via `CODEFORGE_USER_DATA_DIR`.

Desktop end-to-end tests run in **background mode**: the app window is invisible, click-through and hidden from the taskbar, so tests don't interrupt you and can't be closed by accident mid-run. Set `CODEFORGE_E2E_VISIBLE=1` to watch them.

## Project conventions

- Renderer code never touches Node.js; add a channel to `desktop/src/shared/ipc.ts`, validate it in `desktop/src/main/ipc.ts`, and call it with `api.invoke(...)`.
- New settings go in `desktop/src/shared/settings.ts` (schema + descriptor); the settings UI picks them up automatically, and a unit test fails if a setting has no descriptor.
- New commands go in `desktop/src/renderer/src/commands/commands.ts`; they appear in the Command Palette, and can be placed in title-bar menus (`components/TitleBar.tsx`).
- Edit brand files in `brand/` and run `npm run sync:brand`.
- Formatting: `npm run format` (Prettier, root config).
