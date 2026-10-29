// Runs a command with ELECTRON_RUN_AS_NODE removed from the environment.
// Editors built on Electron (VS Code, AntiGravity, …) can leak that variable
// into terminals; it makes Electron behave like plain Node.js and no window opens.
import { spawn } from "node:child_process";

// The command comes from package.json scripts (e.g. "electron-vite dev"), never from user input.
const command = process.argv.slice(2).join(" ");
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
const child = spawn(command, { stdio: "inherit", env, shell: true });
child.on("exit", (code) => process.exit(code ?? 1));
