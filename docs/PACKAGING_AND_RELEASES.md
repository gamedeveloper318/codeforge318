# Packaging and releases

## Build the Windows installer

```bash
npm run package:win
```

Produces, in `desktop/release/`:

| File | Purpose |
| --- | --- |
| `CodeForge-Setup-<version>-x64.exe` | NSIS installer (per-user, no admin rights; user can choose the folder) |
| `CodeForge-Setup-<version>-x64.exe.blockmap` | Used by future differential updates |
| `SHA256SUMS.txt` | Checksum of the installer |
| `win-unpacked/` | The unpacked app, useful for testing (`npm run test:e2e:packaged` in `desktop/`) |

It also writes the version, size and SHA-256 to `brand/release-manifest.json`, and `npm run package:win` (root) syncs that into the website.

Configuration lives in `desktop/electron-builder.yml`. Native terminal binaries are unpacked from the asar archive; `npmRebuild` is off because node-pty ships prebuilt N-API binaries.

### Verified for 0.1.0

- Installer built: `CodeForge-Setup-0.1.0-x64.exe`, 119.9 MB, SHA-256 `bc216888b0e61bf3c3e1024832e113921835ce187a8d528bc53764dab422ef7c`.
- Silent install (`/S`) to the default location, end-to-end tests against the **installed** `CodeForge.exe` (11/11 passed), silent uninstall removed files, registry entry and shortcuts.
- Known: installing into a folder whose path is longer than ~140 characters can exceed Windows' 248-character folder limit and skip the terminal binaries. The default location is far below that.

## Code signing (recommended before wide distribution)

The installer is **unsigned**, so Windows SmartScreen warns on first run. To sign:

1. Buy an OV/EV code-signing certificate (or use Azure Trusted Signing).
2. Provide it to electron-builder via `CSC_LINK` (path/base64 of the `.pfx`) and `CSC_KEY_PASSWORD`, or configure `win.azureSignOptions` for Trusted Signing.
3. Rebuild. Never commit certificates or passwords.

## Publish a release on GitHub

**Option A — manual (no token needed):**

1. Create a public GitHub repository and push this project.
2. On GitHub: **Releases → Draft a new release**, tag `v0.1.0`, title `CodeForge 0.1.0`.
3. Attach `desktop/release/CodeForge-Setup-0.1.0-x64.exe` and `SHA256SUMS.txt`. Paste the notes from the website's `/releases` page. Publish.

**Option B — automated:**

```powershell
$env:CODEFORGE_GITHUB_REPO = "you/codeforge"
$env:GH_TOKEN = "<token with contents:write>"
cd desktop
npm run release:win
```

Then set `CODEFORGE_GITHUB_REPO` in Vercel; the download button appears once the file is reachable.

## macOS and Linux

Targets are configured (`dmg`, `AppImage`) but untested. Build on the matching OS with `npx electron-builder --mac` or `--linux` inside `desktop/`. macOS distribution additionally requires an Apple Developer ID and notarization.

## Auto-update

Not implemented. electron-builder already emits the metadata (`latest.yml`) when publishing to GitHub; adding `electron-updater` is the next step and should be combined with code signing.

## Release checklist

1. Bump `version` in `desktop/package.json` (and the website's `src/lib/releases.ts` notes).
2. `npm run verify` — all green.
3. `npm run package:win`.
4. `npm run test:e2e:packaged` in `desktop/`.
5. Install the `.exe` on a clean Windows user account; open a folder, edit, save, run a terminal command, commit with Git; uninstall.
6. Publish the GitHub release (A or B above) with the installer and `SHA256SUMS.txt`.
7. Commit `brand/release-manifest.json` + `website/src/generated/release-manifest.json` and deploy the website.
8. Check `/download` shows the button, file size and checksum, and that the link downloads the file.
