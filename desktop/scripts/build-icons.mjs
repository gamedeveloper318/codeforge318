// Renders brand/logo-mark.svg into the PNG and ICO icons electron-builder needs.
// The ICO embeds PNG images (supported since Windows Vista), so no extra tools are required.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const desktop = join(dirname(fileURLToPath(import.meta.url)), "..");
const svg = readFileSync(join(desktop, "..", "brand", "logo-mark.svg"));
const buildDir = join(desktop, "build");
mkdirSync(buildDir, { recursive: true });

const render = (size) => sharp(svg, { density: 384 }).resize(size, size).png().toBuffer();

const icoSizes = [16, 24, 32, 48, 64, 128, 256];
const images = await Promise.all(icoSizes.map(render));

// ICONDIR header + one ICONDIRENTRY per image, followed by the PNG payloads.
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(images.length, 4);
const entries = [];
let offset = 6 + 16 * images.length;
images.forEach((png, i) => {
  const size = icoSizes[i];
  const entry = Buffer.alloc(16);
  entry.writeUInt8(size >= 256 ? 0 : size, 0);
  entry.writeUInt8(size >= 256 ? 0 : size, 1);
  entry.writeUInt8(0, 2);
  entry.writeUInt8(0, 3);
  entry.writeUInt16LE(1, 4);
  entry.writeUInt16LE(32, 6);
  entry.writeUInt32LE(png.length, 8);
  entry.writeUInt32LE(offset, 12);
  offset += png.length;
  entries.push(entry);
});
writeFileSync(join(buildDir, "icon.ico"), Buffer.concat([header, ...entries, ...images]));
writeFileSync(join(buildDir, "icon.png"), await render(512));
console.log("Wrote build/icon.ico and build/icon.png");
