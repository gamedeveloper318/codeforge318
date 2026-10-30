import { EventEmitter } from "node:events";
import { describe, expect, it, vi } from "vitest";
import type { UpdateStatus } from "@shared/ipc";
import { describeUpdateError, UpdateService, type Updater } from "../../src/main/update-service";

/** Stands in for electron-updater: emits the same events in the same order. */
class FakeUpdater extends EventEmitter implements Updater {
  autoDownload = false;
  autoInstallOnAppQuit = false;
  checkForUpdates = vi.fn(async () => undefined as unknown);
  quitAndInstall = vi.fn();
}

function setup(updater: FakeUpdater | null = new FakeUpdater()) {
  const statuses: UpdateStatus[] = [];
  const beforeInstall = vi.fn();
  const service = new UpdateService({
    updater,
    currentVersion: "0.2.0",
    emit: (status) => statuses.push(status),
    log: () => undefined,
    beforeInstall,
  });
  return { service, updater, statuses, beforeInstall };
}

describe("UpdateService", () => {
  it("downloads automatically and installs on quit", () => {
    const { updater } = setup();
    expect(updater?.autoDownload).toBe(true);
    expect(updater?.autoInstallOnAppQuit).toBe(true);
  });

  it("reports up-to-date", async () => {
    const { service, updater, statuses } = setup();
    updater!.checkForUpdates.mockImplementation(async () => {
      updater!.emit("checking-for-update");
      updater!.emit("update-not-available", { version: "0.2.0" });
    });
    expect(await service.check()).toEqual({ state: "up-to-date", version: "0.2.0" });
    expect(statuses.map((s) => s.state)).toEqual(["checking", "up-to-date"]);
  });

  it("tracks a download and becomes ready to install", async () => {
    const { service, updater, statuses, beforeInstall } = setup();
    updater!.checkForUpdates.mockImplementation(async () => {
      updater!.emit("checking-for-update");
      updater!.emit("update-available", { version: "0.3.0" });
    });
    expect(await service.check()).toMatchObject({ state: "downloading", version: "0.3.0" });
    updater!.emit("download-progress", { percent: 41.6 });
    expect(service.current).toEqual({ state: "downloading", version: "0.3.0", percent: 42 });

    // A second check while downloading doesn't start another one.
    await service.check();
    expect(updater!.checkForUpdates).toHaveBeenCalledTimes(1);

    expect(() => service.install()).toThrow(/No update has been downloaded/);
    updater!.emit("update-downloaded", { version: "0.3.0" });
    expect(service.current).toEqual({ state: "ready", version: "0.3.0" });

    service.install();
    expect(beforeInstall).toHaveBeenCalledOnce();
    expect(updater!.quitAndInstall).toHaveBeenCalledWith(true, true);
    expect(statuses.at(-1)).toEqual({ state: "ready", version: "0.3.0" });
  });

  it("turns errors into readable messages", async () => {
    const { service, updater } = setup();
    updater!.checkForUpdates.mockRejectedValue(new Error("net::ERR_INTERNET_DISCONNECTED"));
    expect(await service.check()).toEqual({
      state: "error",
      message: expect.stringMatching(/internet connection/),
    });
    updater!.emit("error", new Error("HttpError: 404 Not Found"));
    expect(service.current.message).toMatch(/No downloadable update/);
    expect(describeUpdateError(new Error("something odd\nstack"))).toBe(
      "Couldn't check for updates: something odd",
    );
  });

  it("explains when updates are unavailable (development build or turned off)", async () => {
    const { service } = setup(null);
    expect(service.current.state).toBe("unsupported");
    expect(await service.check()).toMatchObject({ state: "unsupported" });
    expect(() => service.install()).toThrow();
  });
});
