import type { UpdateStatus } from "@shared/ipc";

/**
 * The part of electron-updater's AppUpdater that CodeForge uses. Keeping it
 * this small lets tests drive the service with a fake updater.
 */
export interface Updater {
  autoDownload: boolean;
  autoInstallOnAppQuit: boolean;
  // Same listener signature as Node's EventEmitter, which electron-updater extends.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  on(event: string, listener: (...args: any[]) => void): unknown;
  checkForUpdates(): Promise<unknown>;
  quitAndInstall(isSilent?: boolean, isForceRunAfter?: boolean): void;
}

export interface UpdateServiceOptions {
  /** null when updates can't work (development build, or disabled for tests). */
  updater: Updater | null;
  unsupportedReason?: string;
  currentVersion: string;
  emit: (status: UpdateStatus) => void;
  log: (level: "info" | "warn" | "error", message: string) => void;
  /** Called right before quitting to install, so the window can close without prompting. */
  beforeInstall: () => void;
}

/** Turns updater errors into something a person can act on. */
export function describeUpdateError(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error);
  if (
    /ERR_INTERNET_DISCONNECTED|ENOTFOUND|EAI_AGAIN|ERR_NAME_NOT_RESOLVED|ECONNREFUSED|ETIMEDOUT|ERR_NETWORK_CHANGED/i.test(
      text,
    )
  ) {
    return "Couldn't reach GitHub to check for updates. Check your internet connection and try again.";
  }
  if (/\b(404|403)\b/.test(text)) {
    return "No downloadable update was found on GitHub. Try again later.";
  }
  return `Couldn't check for updates: ${text.split("\n")[0]}`;
}

/**
 * Automatic updates from GitHub Releases. Updates download in the background;
 * the user decides when to restart. If they simply quit, the update installs
 * on exit.
 */
export class UpdateService {
  private status: UpdateStatus;

  constructor(private readonly options: UpdateServiceOptions) {
    const { updater } = options;
    if (!updater) {
      this.status = {
        state: "unsupported",
        message:
          options.unsupportedReason ??
          "Automatic updates work in the installed version of CodeForge.",
      };
      return;
    }
    this.status = { state: "idle" };
    updater.autoDownload = true;
    updater.autoInstallOnAppQuit = true;
    updater.on("checking-for-update", () => this.set({ state: "checking" }));
    updater.on("update-available", (info: { version: string }) =>
      this.set({ state: "downloading", version: info.version, percent: 0 }),
    );
    updater.on("update-not-available", () =>
      this.set({ state: "up-to-date", version: options.currentVersion }),
    );
    updater.on("download-progress", (progress: { percent: number }) =>
      this.set({
        state: "downloading",
        version: this.status.version,
        percent: Math.round(progress.percent),
      }),
    );
    updater.on("update-downloaded", (info: { version: string }) =>
      this.set({ state: "ready", version: info.version }),
    );
    updater.on("error", (error: Error) =>
      this.set({ state: "error", message: describeUpdateError(error) }),
    );
  }

  get current(): UpdateStatus {
    return this.status;
  }

  private set(status: UpdateStatus): void {
    this.status = status;
    this.options.log(
      status.state === "error" ? "warn" : "info",
      `Update: ${status.state}${status.version ? ` ${status.version}` : ""}${
        status.percent !== undefined ? ` ${status.percent}%` : ""
      }${status.message ? ` — ${status.message}` : ""}`,
    );
    this.options.emit(status);
  }

  /** Checks GitHub for a newer version; a found update downloads automatically. */
  async check(): Promise<UpdateStatus> {
    const { updater } = this.options;
    if (!updater) return this.status;
    // A check, download or ready update is already in progress.
    if (["checking", "downloading", "ready"].includes(this.status.state)) return this.status;
    try {
      await updater.checkForUpdates();
    } catch (error) {
      this.set({ state: "error", message: describeUpdateError(error) });
    }
    return this.status;
  }

  /** Quits, installs the downloaded update silently and restarts CodeForge. */
  install(): void {
    const { updater } = this.options;
    if (!updater || this.status.state !== "ready") {
      throw new Error("No update has been downloaded yet.");
    }
    this.options.beforeInstall();
    updater.quitAndInstall(true, true);
  }
}
