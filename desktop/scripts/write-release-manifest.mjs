// After `electron-builder` runs, records the real installer's file name, size and
// SHA-256 checksum in brand/release-manifest.json (which the website reads) and
// writes release/SHA256SUMS.txt next to the installer.
import { createHash } from "node:crypto";
import { createReadStream, existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const desktop = join(dirname(fileURLToPath(import.meta.url)), "..");
const { version } = JSON.parse(readFileSync(join(desktop, "package.json"), "utf8"));
const releaseDir = join(desktop, "release");

const candidates = [
  {
    platform: "windows",
    arch: "x64",
    kind: "installer",
    file: `CodeForge-Setup-${version}-x64.exe`,
  },
  { platform: "macos", arch: "arm64", kind: "dmg", file: `CodeForge-${version}-arm64.dmg` },
  { platform: "macos", arch: "x64", kind: "dmg", file: `CodeForge-${version}-x64.dmg` },
  {
    platform: "linux",
    arch: "x64",
    kind: "appimage",
    file: `CodeForge-${version}-x86_64.AppImage`,
  },
];

const sha256 = (file) =>
  new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    createReadStream(file)
      .on("data", (chunk) => hash.update(chunk))
      .on("end", () => resolve(hash.digest("hex")))
      .on("error", reject);
  });

const artifacts = [];
for (const candidate of candidates) {
  const path = join(releaseDir, candidate.file);
  if (!existsSync(path)) continue;
  artifacts.push({ ...candidate, size: statSync(path).size, sha256: await sha256(path) });
}

if (!artifacts.length) {
  console.error(
    `No installers for version ${version} found in ${releaseDir}. Run the packaging step first.`,
  );
  process.exit(1);
}

const manifest = { version, releaseDate: new Date().toLocaleDateString("en-CA"), artifacts };
writeFileSync(
  join(desktop, "..", "brand", "release-manifest.json"),
  `${JSON.stringify(manifest, null, 2)}\n`,
);
writeFileSync(
  join(releaseDir, "SHA256SUMS.txt"),
  artifacts.map((a) => `${a.sha256}  ${a.file}`).join("\n") + "\n",
);
for (const a of artifacts)
  console.log(`${a.file}  ${(a.size / 1024 / 1024).toFixed(1)} MB  sha256=${a.sha256}`);
console.log(
  "Updated brand/release-manifest.json — run `npm run sync:brand` from the repo root to copy it to the website.",
);
