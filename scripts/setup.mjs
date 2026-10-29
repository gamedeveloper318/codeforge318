// One command to prepare the whole project after cloning:
//   npm run setup
// Installs dependencies for the repo root, the desktop app and the website,
// downloads the Electron runtime, syncs brand files, generates app icons and
// validates the website configuration.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const desktop = join(root, "desktop");
const website = join(root, "website");

const [major] = process.versions.node.split(".").map(Number);
if (major < 22) {
  console.error(
    `CodeForge needs Node.js 22 or newer (found ${process.versions.node}). Install it from https://nodejs.org.`,
  );
  process.exit(1);
}

const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE; // inherited from Electron-based editors; breaks Electron

function run(title, command, args, cwd) {
  console.log(`\n▶ ${title}`);
  const result = spawnSync(command, args, {
    cwd,
    env,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (result.status !== 0) {
    console.error(`\n✖ "${title}" failed. Fix the error above and run \`npm run setup\` again.`);
    process.exit(result.status ?? 1);
  }
}

run("Installing root tools", "npm", ["install", "--no-audit", "--no-fund"], root);
run("Installing desktop app dependencies", "npm", ["install", "--no-audit", "--no-fund"], desktop);
// npm 11+ no longer runs install scripts by default, so fetch Electron's binary explicitly.
if (!existsSync(join(desktop, "node_modules", "electron", "dist"))) {
  run("Downloading the Electron runtime", "node", ["node_modules/electron/install.js"], desktop);
}
run("Installing website dependencies", "npm", ["install", "--no-audit", "--no-fund"], website);
run("Syncing brand files", "node", ["scripts/sync-brand.mjs"], root);
run("Generating app icons", "node", ["scripts/build-icons.mjs"], desktop);
run("Checking website configuration", "node", ["scripts/check-env.mjs"], website);

console.log(`
✔ CodeForge is ready.

  npm run dev:desktop   start the desktop app with hot reload
  npm run dev:web       start the website at http://localhost:3000
  npm run verify        typecheck, lint, test and build everything
  npm run package:win   build the Windows installer
`);
