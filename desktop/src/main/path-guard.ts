import { realpath } from "node:fs/promises";
import path from "node:path";

/** True when `child` is `parent` itself or somewhere beneath it. */
export function isInside(
  parent: string,
  child: string,
  pathApi: path.PlatformPath = path,
): boolean {
  const relative = pathApi.relative(parent, child);
  return relative === "" || (!relative.startsWith("..") && !pathApi.isAbsolute(relative));
}

export function samePath(a: string, b: string, pathApi: path.PlatformPath = path): boolean {
  return pathApi.relative(a, b) === "";
}

/** Rejects anything that is not a plain absolute path string. */
export function assertAbsolutePath(value: string, pathApi: path.PlatformPath = path): string {
  if (typeof value !== "string" || value.length === 0 || value.length > 4096) {
    throw new Error("Invalid path.");
  }
  if (value.includes("\0")) throw new Error("Invalid path.");
  if (!pathApi.isAbsolute(value)) throw new Error("Expected an absolute path.");
  return pathApi.resolve(value);
}

/**
 * Resolves symlinks for the longest existing prefix of `target`, then appends
 * the parts that do not exist yet. This catches symlinks that point outside the
 * workspace even when the final path is about to be created.
 */
export async function realpathOfExisting(target: string): Promise<string> {
  const missing: string[] = [];
  let current = target;
  for (;;) {
    try {
      const real = await realpath(current);
      return missing.length ? path.join(real, ...missing.reverse()) : real;
    } catch {
      const parent = path.dirname(current);
      if (parent === current) return target;
      missing.push(path.basename(current));
      current = parent;
    }
  }
}
