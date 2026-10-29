// Runs every check for both products and prints a summary.
//   npm run verify            everything, including end-to-end tests
//   npm run verify -- --quick skip the end-to-end tests
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const quick = process.argv.includes("--quick");
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;

const steps = [
  ["desktop", "Typecheck", "npm run typecheck"],
  ["desktop", "Lint", "npm run lint"],
  ["desktop", "Unit & integration tests", "npm test"],
  ["desktop", "Production build", "npm run build"],
  ...(quick ? [] : [["desktop", "End-to-end tests (real app)", "npx playwright test"]]),
  ["website", "Typecheck", "npm run typecheck"],
  ["website", "Lint", "npm run lint"],
  ["website", "Unit tests", "npm test"],
  ["website", "Production build", "npm run build"],
  ...(quick ? [] : [["website", "End-to-end tests (Edge)", "npx playwright test"]]),
];

const results = [];
for (const [project, name, command] of steps) {
  console.log(`\n▶ ${project}: ${name}  (${command})`);
  const started = Date.now();
  const { status } = spawnSync(command, {
    cwd: join(root, project),
    env,
    stdio: "inherit",
    shell: true,
  });
  results.push({
    project,
    name,
    ok: status === 0,
    seconds: ((Date.now() - started) / 1000).toFixed(1),
  });
}

console.log("\nSummary");
for (const r of results)
  console.log(`  ${r.ok ? "✔" : "✖"} ${r.project.padEnd(8)} ${r.name.padEnd(30)} ${r.seconds}s`);
const failed = results.filter((r) => !r.ok).length;
console.log(failed ? `\n${failed} step(s) failed.` : "\nAll checks passed.");
process.exit(failed ? 1 : 0);
