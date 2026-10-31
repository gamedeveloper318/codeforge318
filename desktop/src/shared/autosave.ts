/**
 * Decides when files are auto saved ("files.autoSave": "afterDelay").
 *
 * - Each change restarts that file's timer; the file is saved once the user
 *   has stopped typing for `delay()` ms.
 * - Nothing is written when the text equals what was last saved.
 * - A file is never written twice at the same time: a change that arrives
 *   during a save is saved right after it, once.
 * - After a failed save (read-only file, disk full, changed on disk, ...) the
 *   file is left alone until it is edited again, so errors don't repeat in a
 *   loop. `failed` reports a failure once per episode, not on every retry.
 *
 * It has no DOM or Monaco dependencies so it can be unit tested with fake timers.
 */
export type AutoSaveResult = "saved" | "failed" | "conflict" | "skipped";

export interface AutoSaveHost {
  enabled(): boolean;
  delay(): number;
  /** Only files with a path on disk are auto saved (never untitled files). */
  canAutoSave(id: string): boolean;
  isDirty(id: string): boolean;
  /** Changes on every edit (Monaco's alternative version id). */
  version(id: string): number;
  save(id: string): Promise<AutoSaveResult>;
  /** Called once when a file's auto save starts failing (shown to the user). */
  failed(id: string, result: "failed" | "conflict"): void;
  setTimer(callback: () => void, ms: number): unknown;
  clearTimer(handle: unknown): void;
}

export class AutoSaveScheduler {
  private readonly timers = new Map<string, unknown>();
  private readonly saving = new Set<string>();
  private readonly again = new Set<string>();
  /** Files whose last auto save failed, with the version that failed. */
  private readonly blocked = new Map<string, number>();

  constructor(private readonly host: AutoSaveHost) {}

  /** The file's text changed. */
  changed(id: string): void {
    if (!this.host.enabled() || !this.host.canAutoSave(id)) return;
    const blockedAt = this.blocked.get(id);
    if (blockedAt !== undefined && blockedAt === this.host.version(id)) return;
    this.cancel(id);
    this.timers.set(
      id,
      this.host.setTimer(() => {
        this.timers.delete(id);
        void this.flush(id);
      }, this.host.delay()),
    );
  }

  /** Saves now if the file has unsaved changes (used by the timer). */
  async flush(id: string): Promise<void> {
    if (!this.host.enabled() || !this.host.canAutoSave(id) || !this.host.isDirty(id)) return;
    if (this.saving.has(id)) {
      this.again.add(id);
      return;
    }
    const version = this.host.version(id);
    this.saving.add(id);
    let result: AutoSaveResult;
    try {
      result = await this.host.save(id);
    } catch {
      result = "failed";
    } finally {
      this.saving.delete(id);
    }
    if (result === "failed" || result === "conflict") {
      const firstFailure = !this.blocked.has(id);
      this.blocked.set(id, version);
      this.again.delete(id);
      if (firstFailure) this.host.failed(id, result);
      return;
    }
    if (result === "saved") this.blocked.delete(id);
    if (this.again.delete(id)) await this.flush(id);
  }

  /** A manual save succeeded (Ctrl+S): forget earlier failures for the file. */
  savedManually(id: string): void {
    this.blocked.delete(id);
  }

  isBlocked(id: string): boolean {
    return this.blocked.has(id);
  }

  cancel(id: string): void {
    const timer = this.timers.get(id);
    if (timer !== undefined) this.host.clearTimer(timer);
    this.timers.delete(id);
  }

  /** The tab closed or moved to another path. */
  forget(id: string): void {
    this.cancel(id);
    this.again.delete(id);
    this.blocked.delete(id);
  }

  cancelAll(): void {
    for (const id of [...this.timers.keys()]) this.cancel(id);
  }

  pending(id: string): boolean {
    return this.timers.has(id) || this.saving.has(id);
  }
}
