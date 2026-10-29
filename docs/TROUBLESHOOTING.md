# Troubleshooting (developers)

User-facing troubleshooting is on the website at `/docs/troubleshooting`.

| Symptom | Cause | Fix |
| --- | --- | --- |
| `npm run dev:desktop` builds but no window appears | `ELECTRON_RUN_AS_NODE=1` inherited from an Electron-based editor | Use the npm scripts (they clear it via `scripts/run-clean.mjs`), or `Remove-Item Env:ELECTRON_RUN_AS_NODE` in PowerShell |
| `Electron failed to install correctly` / missing `electron/dist` | npm 11 skipped install scripts | `node node_modules/electron/install.js` in `desktop/` (or rerun `npm run setup`) |
| Terminal fails in a packaged/installed build | Native binaries missing from `app.asar.unpacked` (e.g. very long install path > ~140 chars) | Check `resources/app.asar.unpacked/node_modules/@lydell/node-pty-win32-x64/prebuilds/win32-x64/`; reinstall to a shorter path |
| `@lydell/node-pty ... could not find the platform-specific package` | Installed with `--omit=optional` or copied `node_modules` across OSes | `npm install` again in `desktop/` |
| Monaco shows "Could not create web worker" | UI loaded from `file://` | Always load via `app://codeforge/` (production) or the Vite dev server |
| Website build fails with "Invalid CodeForge website configuration" | A malformed env var | Fix the value named in the message (see `website/.env.example`), or unset it |
| Website E2E tests can't launch a browser | Edge not installed | `E2E_BROWSER_CHANNEL=chrome npm run test:e2e`, or `npx playwright install chromium` and `E2E_BROWSER_CHANNEL=chromium` |
| Website E2E tests use a stale build | Playwright reuses a server already on port 3123 | Stop it, rebuild, rerun |
| App logs | — | `%APPDATA%\CodeForge\logs\codeforge.log` (or `<CODEFORGE_USER_DATA_DIR>\logs`) |
