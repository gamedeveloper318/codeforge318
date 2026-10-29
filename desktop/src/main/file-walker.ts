import { readdir } from "node:fs/promises";
import path from "node:path";
import type { GlobSet } from "@shared/glob";

export interface WalkOptions {
  exclude: GlobSet;
  /** Stop after this many files. */
  limit: number;
  isCancelled?: () => boolean;
}

/**
 * Lists files under `root`, skipping excluded names and never following
 * symlinked folders (which could loop or escape the workspace).
 * Returns absolute paths and whether the limit cut the walk short.
 */
export async function walkFiles(
  root: string,
  options: WalkOptions,
): Promise<{ files: string[]; truncated: boolean }> {
  const files: string[] = [];
  const stack: string[] = [root];
  while (stack.length) {
    if (options.isCancelled?.()) break;
    const dir = stack.pop()!;
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      continue; // unreadable folders are skipped, not fatal
    }
    entries.sort((a, b) => a.name.localeCompare(b.name));
    const subdirs: string[] = [];
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      const relative = path.relative(root, full).split(path.sep).join("/");
      if (options.exclude.matches(relative)) continue;
      if (entry.isDirectory()) {
        subdirs.push(full);
      } else if (entry.isFile()) {
        files.push(full);
        if (files.length >= options.limit) return { files, truncated: true };
      }
    }
    // Push in reverse so folders are visited in alphabetical order.
    for (let i = subdirs.length - 1; i >= 0; i--) stack.push(subdirs[i]);
  }
  return { files, truncated: false };
}

export function toRelative(root: string, file: string): string {
  return path.relative(root, file).split(path.sep).join("/");
}
