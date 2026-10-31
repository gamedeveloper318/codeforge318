// Copies the file icons CodeForge uses from the material-icon-theme package
// (MIT license) into the renderer's assets, together with the license.
// Run after changing src/shared/file-icons.ts:  node scripts/copy-file-icons.mjs
// (Needs Node.js 22.18+ / 23.6+, which can import TypeScript files directly.)
import { copyFileSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { allIconIds } from "../src/shared/file-icons.ts";

const desktop = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(desktop, "node_modules", "material-icon-theme");
const target = join(desktop, "src", "renderer", "src", "assets", "file-icons");

rmSync(target, { recursive: true, force: true });
mkdirSync(target, { recursive: true });
const available = new Set(readdirSync(join(source, "icons")));
const missing = [];
for (const id of allIconIds()) {
  if (!available.has(`${id}.svg`)) missing.push(id);
  else copyFileSync(join(source, "icons", `${id}.svg`), join(target, `${id}.svg`));
}
copyFileSync(join(source, "LICENSE"), join(target, "LICENSE.txt"));
if (missing.length) {
  console.error(`These icons don't exist in material-icon-theme: ${missing.join(", ")}`);
  process.exit(1);
}
console.log(`Copied ${allIconIds().length} icons to ${target}`);
