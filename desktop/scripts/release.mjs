// Builds the Windows installer and publishes it to a GitHub Release.
// Requires:
//   CODEFORGE_GITHUB_REPO = owner/name   (the repository to publish to)
//   GH_TOKEN              = a GitHub token with "contents: write" on that repository
// Usage (PowerShell):
//   $env:CODEFORGE_GITHUB_REPO = "you/codeforge"; $env:GH_TOKEN = "<token>"; npm run release:win
import { spawnSync } from "node:child_process";

const repo = process.env.CODEFORGE_GITHUB_REPO ?? "";
if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) {
  console.error("Set CODEFORGE_GITHUB_REPO to owner/name (for example you/codeforge).");
  process.exit(1);
}
if (!process.env.GH_TOKEN) {
  console.error("Set GH_TOKEN to a GitHub token that can create releases in that repository.");
  process.exit(1);
}
const [owner, name] = repo.split("/");

const run = (command) => {
  const { status } = spawnSync(command, { stdio: "inherit", shell: true });
  if (status !== 0) process.exit(status ?? 1);
};

run("npm run build");
run(
  [
    "npx electron-builder --win nsis --x64 --publish always",
    "-c.publish.provider=github",
    `-c.publish.owner=${owner}`,
    `-c.publish.repo=${name}`,
    "-c.publish.releaseType=release",
  ].join(" "),
);
run("node scripts/write-release-manifest.mjs");
console.log(
  `\nPublished. The website will show the download once https://github.com/${repo}/releases has the installer.`,
);
