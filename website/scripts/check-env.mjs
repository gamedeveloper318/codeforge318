// Validates the website's environment variables without building.
// Usage: npm run check:env   (reads the current environment and .env.local)
import { existsSync, readFileSync } from "node:fs";
import { loadConfig } from "../src/lib/env.ts";

const env = { ...process.env };
if (existsSync(".env.local")) {
  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (match && env[match[1]] === undefined) env[match[1]] = match[2].replace(/^["']|["']$/g, "");
  }
}

try {
  const config = loadConfig(env);
  console.log("Configuration is valid:");
  console.log(`  Site URL ............ ${config.siteUrl}`);
  console.log(
    `  GitHub repository ... ${config.githubRepo ?? "(not set — download button stays in 'coming soon' state)"}`,
  );
  console.log(
    `  Windows download .... ${config.windowsDownloadUrl ?? "(derived from GitHub repository)"}`,
  );
  console.log(`  Support email ....... ${config.supportEmail ?? "(not set)"}`);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
