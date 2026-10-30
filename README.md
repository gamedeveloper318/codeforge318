# CodeForge

**Your Code. Your Workspace. Your Power.**

CodeForge is a desktop code editor for Windows with Monaco-powered editing, a real integrated terminal, built-in Git and project-wide search — plus the website that presents and distributes it.

| Product | Folder | Built with |
| --- | --- | --- |
| Desktop editor | [`desktop/`](desktop) | Electron 45, React 19, TypeScript, Monaco, xterm.js, node-pty, electron-builder |
| Website | [`website/`](website) | Next.js 16, React 19, Tailwind CSS 4, Motion — deployed on Vercel |
| Shared brand | [`brand/`](brand) | Logo, design tokens, product info, release manifest |

## Quick start

You need **Node.js 22+** and **Git**. No C++ compiler is required.

```bash
npm run setup          # installs everything, downloads Electron, generates icons
npm run dev:desktop    # run the editor with hot reload
npm run dev:web        # run the website at http://localhost:3000
```

## Everyday commands (run from this folder)

| Command | What it does |
| --- | --- |
| `npm run setup` | One-time setup of the whole project |
| `npm run dev:desktop` / `npm run dev:web` | Development mode |
| `npm test` | Unit and integration tests for both products |
| `npm run test:e2e` | End-to-end tests: launches the real app and the website |
| `npm run verify` | Typecheck, lint, tests and production builds for everything (`-- --quick` skips end-to-end) |
| `npm run package:win` | Builds `desktop/release/CodeForge-Setup-<version>-x64.exe` and records its checksum |
| `npm run deploy:web` | Deploys the website to Vercel (after `vercel login`) |
| `npm run sync:brand` | Copies `brand/` files into both apps after editing them |

## What works today

Editor tabs, saving and unsaved-change protection · find/replace, multi-cursor, folding · syntax highlighting for 70+ file types · Python IntelliSense (Pyright) · TypeScript/JavaScript/JSON/CSS/HTML intelligence · file explorer (create, rename, move, delete to Recycle Bin) · real integrated terminals · Git (stage, diff, commit, branches, pull/push) · project search · Command Palette and Go to File · run files and npm scripts · sandboxed HTML/localhost preview · settings with dark and light themes · Windows installer with automatic updates.

Not yet: breakpoint debugging, language servers for Go/Rust/Java/C#, extensions, signed installers, tested macOS/Linux builds. The full matrix is in [docs/FEATURES.md](docs/FEATURES.md).

## Documentation

- [Architecture](docs/ARCHITECTURE.md) — how the pieces fit together
- [Development guide](docs/DEVELOPMENT.md) — setup, scripts, testing
- [Environment variables](docs/ENVIRONMENT.md)
- [Database decision](docs/DATABASE.md) — why there is no database yet, and how to add one
- [Deploying the website](docs/DEPLOYMENT.md)
- [Packaging and releases](docs/PACKAGING_AND_RELEASES.md) — installers, signing, GitHub Releases, release checklist
- [Security](docs/SECURITY.md)
- [Feature support matrix](docs/FEATURES.md)
- [Troubleshooting](docs/TROUBLESHOOTING.md)

User-facing documentation lives on the website (`website/src/lib/docs.tsx`, served at `/docs`).

## License

No license has been chosen yet. Until one is added, all rights are reserved by the project owner. Third-party components keep their own licenses (Electron, Monaco, xterm.js and node-pty are MIT).
