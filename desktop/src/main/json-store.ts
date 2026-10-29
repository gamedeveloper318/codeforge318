import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

/**
 * A small JSON file store. Reads are validated by `parse`, so a corrupted or
 * hand-edited file falls back to defaults instead of crashing the app. Writes
 * go to a temp file first and are renamed into place.
 */
export class JsonStore<T> {
  private value: T;

  constructor(
    private readonly file: string,
    private readonly parse: (raw: unknown) => T,
  ) {
    this.value = this.load();
  }

  get(): T {
    return this.value;
  }

  set(value: T): T {
    this.value = this.parse(value);
    mkdirSync(dirname(this.file), { recursive: true });
    const temp = `${this.file}.tmp`;
    writeFileSync(temp, JSON.stringify(this.value, null, 2), "utf8");
    renameSync(temp, this.file);
    return this.value;
  }

  private load(): T {
    if (!existsSync(this.file)) return this.parse({});
    try {
      return this.parse(JSON.parse(readFileSync(this.file, "utf8")));
    } catch {
      return this.parse({});
    }
  }
}
