// Copies the shared brand files (logo, tokens, product info, release manifest)
// from brand/ into the website and desktop apps. Each app is deployed and
// packaged on its own, so it needs its own copy rather than a cross-folder import.
import { copyFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const brand = (file) => join(root, "brand", file);

const copies = [
  [brand("logo-mark.svg"), "website/public/logo.svg"],
  [brand("logo-mark.svg"), "website/src/app/icon.svg"],
  [brand("product.json"), "website/src/generated/product.json"],
  [brand("tokens.css"), "website/src/generated/tokens.css"],
  [brand("release-manifest.json"), "website/src/generated/release-manifest.json"],
  [brand("logo-mark.svg"), "desktop/src/renderer/src/assets/logo.svg"],
  [brand("product.json"), "desktop/src/shared/generated/product.json"],
  [brand("tokens.css"), "desktop/src/renderer/src/generated/tokens.css"],
];

const notice =
  "# Generated files\n\nThese files are copied from `brand/` by `npm run sync:brand`. Edit the originals in `brand/`, not these copies.\n";

const generatedDirs = new Set();
for (const [from, to] of copies) {
  const target = join(root, to);
  mkdirSync(dirname(target), { recursive: true });
  copyFileSync(from, target);
  if (dirname(to).endsWith("generated")) generatedDirs.add(dirname(target));
  console.log(`  ${relative(root, from)} -> ${to}`);
}
for (const dir of generatedDirs) writeFileSync(join(dir, "README.md"), notice);
console.log("Brand files synced.");
