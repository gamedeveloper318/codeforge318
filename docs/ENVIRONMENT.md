# Environment variables

CodeForge needs **no secrets and no required environment variables** to build, run or deploy. Everything below is optional.

## Website (`website/`)

Documented in [`website/.env.example`](../website/.env.example). Validated by `website/src/lib/env.ts` at build and start; check locally with `npm run check:env` inside `website/`.

| Variable | Required | Secret | Purpose |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | No | No | Canonical URL for metadata, sitemap and social cards. Defaults to Vercel's production domain (`VERCEL_PROJECT_PRODUCTION_URL`, set by Vercel automatically), then `http://localhost:3000`. |
| `CODEFORGE_GITHUB_REPO` | No | No | `owner/name` of the repository whose GitHub Releases host the installers. Enables the download button (after the file is verified to exist) and GitHub links. |
| `CODEFORGE_DOWNLOAD_URL_WINDOWS` | No | No | Direct `https://` URL to the Windows installer, overriding the GitHub URL. |
| `CODEFORGE_SUPPORT_EMAIL` | No | No | Email shown on the Support page. |

Only `NEXT_PUBLIC_SITE_URL` is exposed to the browser. Set production values with the Vercel dashboard (Project → Settings → Environment Variables) or:

```bash
cd website
vercel env add CODEFORGE_GITHUB_REPO production
```

Local development: copy `.env.example` to `.env.local` (git-ignored).

## Desktop app (`desktop/`)

| Variable | Used by | Purpose |
| --- | --- | --- |
| `CODEFORGE_USER_DATA_DIR` | app | Store settings/state/logs in another folder (tests use this). |
| `CODEFORGE_E2E_EXECUTABLE` | tests | Run end-to-end tests against a packaged or installed `CodeForge.exe`. |
| `CODEFORGE_E2E_VISIBLE` | tests | `1` shows the app window during end-to-end tests (hidden by default). |
| `E2E_PORT`, `E2E_BROWSER_CHANNEL` | website tests | Port for the test server (default 3123) and browser channel (default `msedge`). |
| `CODEFORGE_GITHUB_REPO` | `npm run release:win` | Repository to publish the installer to. |
| `GH_TOKEN` | `npm run release:win` | **Secret.** GitHub token with `contents: write` on that repository. Set it only in your shell or CI secrets — never commit it. |
| `CSC_LINK`, `CSC_KEY_PASSWORD` | electron-builder | **Secret.** Code-signing certificate and password, when you have one (see [PACKAGING_AND_RELEASES.md](PACKAGING_AND_RELEASES.md)). |

## Rules

- `.env`, `.env.*` (except `.env.example`) and `.vercel/` are git-ignored.
- Never put a secret in a `NEXT_PUBLIC_*` variable or in desktop renderer code.
- The desktop app does not read `.env` files.
