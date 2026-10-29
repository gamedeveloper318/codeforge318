/**
 * Environment for processes CodeForge starts (terminals, Git). Variables that
 * only make sense for CodeForge's own Electron runtime are removed; for example
 * ELECTRON_RUN_AS_NODE would break any Electron app the user runs from the
 * integrated terminal.
 */
const ELECTRON_ONLY_VARS = [
  "ELECTRON_RUN_AS_NODE",
  "ELECTRON_NO_ATTACH_CONSOLE",
  "ELECTRON_ENABLE_LOGGING",
  "ELECTRON_RENDERER_URL",
  "CODEFORGE_USER_DATA_DIR",
];

export function childProcessEnv(extra: Record<string, string> = {}): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined && !ELECTRON_ONLY_VARS.includes(key.toUpperCase())) env[key] = value;
  }
  return { ...env, ...extra };
}
