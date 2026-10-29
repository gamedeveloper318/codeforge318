import { isWindows } from "./bridge";

/** Path helpers for the renderer, which has no access to Node's `path`. */
export const sep = isWindows ? "\\" : "/";

const key = (p: string) => (isWindows ? p.toLowerCase() : p);
const trimTrailing = (p: string) =>
  p.length > 1 && /[\\/]$/.test(p) && !/^[a-zA-Z]:[\\/]$/.test(p) ? p.slice(0, -1) : p;

export function basename(p: string): string {
  const trimmed = trimTrailing(p);
  const index = Math.max(trimmed.lastIndexOf("/"), trimmed.lastIndexOf("\\"));
  return index === -1 ? trimmed : trimmed.slice(index + 1);
}

export function dirname(p: string): string {
  const trimmed = trimTrailing(p);
  const index = Math.max(trimmed.lastIndexOf("/"), trimmed.lastIndexOf("\\"));
  if (index === -1) return trimmed;
  const parent = trimmed.slice(0, index);
  if (parent === "") return trimmed.slice(0, 1); // POSIX root "/"
  if (/^[a-zA-Z]:$/.test(parent)) return parent + sep; // "C:\"
  return parent;
}

export function join(dir: string, ...parts: string[]): string {
  let result = dir;
  for (const part of parts) {
    for (const segment of part.split(/[\\/]/).filter(Boolean)) {
      result = /[\\/]$/.test(result) ? result + segment : result + sep + segment;
    }
  }
  return result;
}

export function samePath(a: string, b: string): boolean {
  return key(trimTrailing(a)) === key(trimTrailing(b));
}

/** True when `child` is inside `parent` (or equal to it). */
export function isInsideOrEqual(parent: string, child: string): boolean {
  const p = key(trimTrailing(parent));
  const c = key(trimTrailing(child));
  return c === p || c.startsWith(/[\\/]$/.test(p) ? p : p + sep) || c.startsWith(p + "/");
}

/** Path of `p` relative to `root` with "/" separators, or `p` when outside. */
export function relative(root: string, p: string): string {
  if (samePath(root, p)) return "";
  if (!isInsideOrEqual(root, p)) return p;
  const rootTrimmed = trimTrailing(root);
  const offset = /[\\/]$/.test(rootTrimmed) ? rootTrimmed.length : rootTrimmed.length + 1;
  return p.slice(offset).replace(/\\/g, "/");
}

// Control characters are deliberately rejected in file names.
// eslint-disable-next-line no-control-regex
const INVALID_NAME = isWindows ? /[<>:"|?*\x00-\x1f]/ : /\x00/;
const RESERVED_WINDOWS = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i;

/**
 * Validates a file name typed by the user. "/" is allowed to create nested
 * folders ("src/utils/math.ts"). Returns an error message or null.
 */
export function validateFileName(name: string): string | null {
  const value = name.trim();
  if (!value) return "A name is required.";
  const segments = value.split(/[\\/]/);
  for (const segment of segments) {
    if (!segment) return "The name cannot contain empty folder names.";
    if (segment === "." || segment === "..") return `"${segment}" is not a valid name.`;
    if (INVALID_NAME.test(segment)) return `"${segment}" contains characters that are not allowed.`;
    if (isWindows && RESERVED_WINDOWS.test(segment))
      return `"${segment}" is a reserved name on Windows.`;
    if (isWindows && /[. ]$/.test(segment))
      return "Names cannot end with a dot or a space on Windows.";
  }
  return null;
}
