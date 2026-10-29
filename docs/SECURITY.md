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
| No telemetry; no network calls except user-initiated (Git remotes, links, previews) | — |

These controls are covered by tests: `tests/unit/main-services.test.ts` (path guard, symlink escape, refusal outside folder, branch-name injection) and `tests/e2e/app.spec.ts` ("keeps Node.js and the filesystem out of reach of the page").

## Website controls

- Security headers: `X-Frame-Options: DENY`, `frame-ancestors 'none'`, `X-Content-Type-Options: nosniff`, HSTS, strict `Referrer-Policy`, restrictive `Permissions-Policy`, no `X-Powered-By` (`website/next.config.ts`, checked by `tests/e2e/site.spec.ts`).
- No secrets; only `NEXT_PUBLIC_SITE_URL` reaches the browser.
- No cookies, analytics or forms.

## Dependency review

- Run `npm audit` in `desktop/` and `website/` before each release.
- npm 11 blocks dependency install scripts by default; `electron-winstaller`'s script (Squirrel target, unused) stays blocked.
- Monaco 0.57 vendors DOMPurify 3.4.15, which has published advisories. `desktop/electron.vite.config.ts` redirects that import to the patched `dompurify` package (3.4.17, pinned via `overrides`), and the build was checked to contain only 3.4.17. `npm audit` reports 0 vulnerabilities in both apps. Remove the alias once Monaco ships a fixed version.

## Known gaps

- Installer is not code-signed (SmartScreen warning).
- No auto-update channel yet (so no update-signature verification needed yet).
- The integrated terminal is, by design, a full shell: anything typed there runs with the user's permissions.
