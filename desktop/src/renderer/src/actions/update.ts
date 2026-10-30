import type { UpdateStatus } from "@shared/ipc";
import { api } from "../lib/bridge";
import { getState, setState } from "../state/store";
import { confirmUnsavedChanges } from "./editor";
import { reportError, toast } from "./notify";

/** Restarts into the downloaded update after offering to save unsaved files. */
export async function installUpdate(): Promise<void> {
  if (getState().updateStatus?.state !== "ready") return;
  if (!(await confirmUnsavedChanges())) return;
  try {
    await api.invoke("update:install");
  } catch (error) {
    reportError("Could not install the update", error);
  }
}

function announceReady(status: UpdateStatus): void {
  toast(
    "success",
    `CodeForge ${status.version} is ready to install`,
    "Restart CodeForge to finish updating. Unsaved files will be offered for saving first.",
    [
      { label: "Restart Now", run: () => void installUpdate() },
      { label: "Later", run: () => undefined },
    ],
  );
}

/** Status pushed from the main process (background checks and downloads). */
export function handleUpdateStatus(status: UpdateStatus): void {
  const previous = getState().updateStatus;
  setState({ updateStatus: status });
  if (status.state === "ready" && previous?.state !== "ready") announceReady(status);
}

/** "Check for Updates…": always tells the user what happened. */
export async function checkForUpdates(): Promise<void> {
  const before = getState().updateStatus;
  if (before?.state === "ready") {
    announceReady(before);
    return;
  }
  if (before?.state !== "unsupported") toast("info", "Checking for updates…");
  let status: UpdateStatus;
  try {
    status = await api.invoke("update:check");
  } catch (error) {
    reportError("Could not check for updates", error);
    return;
  }
  setState({ updateStatus: status });
  const version = getState().appInfo?.version;
  switch (status.state) {
    case "unsupported":
      toast("info", "Automatic updates aren't available here", status.message);
      break;
    case "up-to-date":
      toast(
        "success",
        "CodeForge is up to date",
        `You have the latest version (${status.version ?? version}).`,
      );
      break;
    case "downloading":
      toast(
        "info",
        `Downloading CodeForge ${status.version}…`,
        "You'll be asked to restart when it's ready.",
      );
      break;
    case "error":
      toast("error", "Update check failed", status.message);
      break;
    case "ready":
      // announced by handleUpdateStatus when the download finished
      break;
    default:
      break;
  }
}
