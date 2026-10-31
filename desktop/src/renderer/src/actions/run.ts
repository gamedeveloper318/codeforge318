import type { RunMode } from "@shared/run-plan";
import { api } from "../lib/bridge";
import * as paths from "../lib/paths";
import { isDirty } from "../monaco/models";
import { getState, type TerminalState } from "../state/store";
import { saveTab } from "./editor";
import { previewActiveHtml } from "./misc";
import { logOutput, reportError, toast } from "./notify";
import { createProgramTerminal, killTerminal, showPanel } from "./terminal";

/** How long Stop waits for Ctrl+C to end a program before ending it forcibly. */
const STOP_GRACE_MS = 1500;

/**
 * Saves the active file if needed and checks that it can run: the language is
 * supported and its runtime (Python, Node.js, ...) is installed. Explains the
 * problem otherwise. Returns the file's path when everything is ready.
 */
async function prepareActiveFile(mode: RunMode): Promise<{ file: string; help?: string } | null> {
  const { tabs, activeTabId } = getState();
  const tab = tabs.find((t) => t.id === activeTabId);
  if (tab?.kind !== "file") {
    toast(
      "info",
      mode === "debug" ? "Open a file to debug it." : "Open a file to run it.",
      "Run and Start Debugging work on the file shown in the editor.",
    );
    return null;
  }
  if (mode === "run" && tab.path && /\.html?$/i.test(tab.path)) {
    await previewActiveHtml();
    return null;
  }
  let file = tab.path;
  if (!file || isDirty(tab.id)) {
    // Unsaved changes would not be part of the run; untitled files ask for a name.
    const saved = await saveTab(tab.id);
    if (!saved) return null;
    file = saved;
  }
  try {
    const check = await api.invoke("run:check", file, mode);
    if (!check.ok) {
      toast(
        "error",
        mode === "debug" ? "Can't start debugging" : "Can't run this file",
        check.reason,
        check.installUrl
          ? [
              {
                label: `Download ${check.runtimeLabel ?? "it"}`,
                run: () => void api.invoke("app:open-external", check.installUrl!),
              },
            ]
          : undefined,
      );
      return null;
    }
    logOutput(`${mode === "debug" ? "Debugging" : "Running"} ${file} with ${check.description}`);
    return { file, help: check.debugHelp };
  } catch (error) {
    reportError("Could not prepare the run", error);
    return null;
  }
}

function programTerminals(file?: string): TerminalState[] {
  return getState().terminals.filter(
    (t) => t.purpose && (!file || t.title.endsWith(`: ${paths.basename(file)}`)),
  );
}

/** Run > Run Current File: starts the file with its language's runtime in a terminal. */
export async function runActiveFile(): Promise<void> {
  await start("run");
}

/** Run > Start Debugging: Python files open in pdb, JavaScript files in node inspect. */
export async function startDebugging(): Promise<void> {
  await start("debug");
}

async function start(mode: RunMode): Promise<void> {
  const prepared = await prepareActiveFile(mode);
  if (!prepared) return;
  // Running the same file again replaces its previous run.
  for (const old of programTerminals(prepared.file)) await killTerminal(old.id);
  const id = await createProgramTerminal(prepared.file, mode);
  if (id !== null && mode === "debug" && prepared.help) {
    toast("info", `Debugging ${paths.basename(prepared.file)}`, prepared.help);
  }
}

/** Run > Stop Running Program: Ctrl+C, then ends the program if it is still running. */
export async function stopRunningProgram(): Promise<void> {
  const { terminals, activeTerminalId } = getState();
  const running = terminals.filter((t) => t.purpose && !t.exited);
  const target = running.find((t) => t.id === activeTerminalId) ?? running.at(-1);
  if (!target) {
    toast("info", "No program is running.", "Start one with Run > Run Current File (Ctrl+F5).");
    return;
  }
  showPanel("terminal");
  api.send("terminal:write", target.id, "\x03");
  logOutput(`Stopping ${target.title}`);
  await new Promise((resolve) => window.setTimeout(resolve, STOP_GRACE_MS));
  const still = getState().terminals.find((t) => t.id === target.id);
  if (still && !still.exited) await api.invoke("terminal:kill", target.id).catch(() => undefined);
  toast("info", `Stopped ${target.title.replace(/^(Run|Debug): /, "")}`);
}
