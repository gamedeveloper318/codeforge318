# Security

## Desktop app controls

| Control | Where |
| --- | --- |
| Renderer sandbox, `contextIsolation: true`, `nodeIntegration: false` | `desktop/src/main/index.ts` (`createMainWindow`) |
| Allow-listed IPC channels; preload exposes only `invoke` / `send` / `on` | `desktop/src/shared/ipc.ts`, `desktop/src/preload/index.ts` |
| Sender verification (main window, main frame, `app://codeforge` origin) on every IPC call | `desktop/src/main/ipc.ts` (`assertTrusted`) |
| Argument validation with zod on every IPC call | `desktop/src/main/ipc.ts` |
| Filesystem limited to the open folder (+ dialog-picked files); symlink/junction escape blocked; root cannot be renamed/deleted | `desktop/src/main/workspace.ts`, `path-guard.ts` |
| Deletes go to the Recycle Bin; destructive Git actions confirm first | `fs-service.ts`, renderer `actions/` |
| Strict CSP: `default-src 'self'; script-src 'self'; object-src 'none'; frame-src 'none'; base-uri 'none'` | `desktop/electron.vite.config.ts` |
| UI served from a private `app://` protocol with path-traversal check | `desktop/src/main/index.ts` (`registerAppProtocol`) |
| Navigation away from the app blocked; `window.open` denied (http(s) links open in the browser); `<webview>` blocked | `index.ts` |
| Permissions denied except clipboard for the app's own origin | `index.ts` (`hardenSessions`) |
| Previews: separate in-memory session, sandbox, no preload, all permissions denied, navigation limited to localhost / the previewed folder | `desktop/src/main/preview.ts` |
| Git invoked with argument arrays (no shell), branch names validated (no option injection), no interactive prompts | `git-service.ts` |
| Child processes don't inherit Electron-internal variables | `env.ts` |
| Automatic updates only from this repository's GitHub Releases over HTTPS, verified against the release's SHA-512 before installing; restart only after the user confirms | `desktop/src/main/update-service.ts`, `electron-builder.yml` (`publish`) |
| Python language server (Pyright) runs as a separate process with Electron's Node.js; it only receives Python files saved on disk, and runs no user code | `desktop/src/main/lsp-service.ts` |
| Run / Start Debugging: the page sends only a file path (inside the open folder) and a mode; the main process chooses the program and arguments from the file type, checks the runtime exists, and starts it with an argument array (non-.exe programs via PowerShell with single-quoted arguments) | `run-service.ts`, `runtime.ts`, `shared/run-plan.ts`, `terminal-service.ts` |
| Terminal profiles: the page can only pick a detected shell by id; it cannot pass an executable path | `terminal-service.ts` (`detectProfiles`, `chooseProfile`), `ipc.ts` |
| No telemetry; network calls only for update checks (can be turned off) and user-initiated actions (Git remotes, links, previews) | — |

These controls are covered by tests: `tests/unit/main-services.test.ts` (path guard, symlink escape, refusal outside folder, branch-name injection) and `tests/e2e/app.spec.ts` ("keeps Node.js and the filesystem out of reach of the page").

## Website controls

- Security headers: `X-Frame-Options: DENY`, `frame-ancestors 'none'`, `X-Content-Type-Options: nosniff`, HSTS, strict `Referrer-Policy`, restrictive `Permissions-Policy`, no `X-Powered-By` (`website/next.config.ts`, checked by `tests/e2e/site.spec.ts`).
- No secrets; only `NEXT_PUBLIC_SITE_URL` reaches the browser.
- No cookies, analytics or forms.

## Dependency review

- Run `npm audit` in `desktop/` and `website/` before each release.
- npm 11 blocks dependency install scripts by default; `electron-winstaller`'s script (Squirrel target, unused) stays blocked.
- Monaco 0.57 vendors DOMPurify 3.4.15, which has published advisories. `desktop/electron.vite.config.ts` redirects that import to the patched `dompurify` package (3.4.17, pinned via `overrides`), and the build was checked to contain only 3.4.17. Remove the alias once Monaco ships a fixed version.
- `npm audit --omit=dev` (everything that ships in the app and the website) reports 0 vulnerabilities in both apps (checked for 0.4.0). The full `npm audit` of `desktop/` reports a moderate `minimatch` advisory (GHSA-g3hv-75wg-m249, denial of service through crafted glob patterns) in build tools only — electron-builder and eslint — which never ship in the installer and only see the project's own patterns. npm's only offered fix is a breaking downgrade; update electron-builder when it moves to minimatch 11.

## Known gaps

- Installer is not code-signed (SmartScreen warning).
- Updates are verified by SHA-512 but not by code signature, because the installer is not signed yet.
- The integrated terminal is, by design, a full shell: anything typed there runs with the user's permissions. Run and Start Debugging run the user's own file with its language's runtime, only when the user asks.
