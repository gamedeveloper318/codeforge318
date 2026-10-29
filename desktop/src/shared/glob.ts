/**
 * Minimal glob matching for exclude lists.
 * - A pattern without "/" matches any single path segment (".git", "*.min.js").
 * - A pattern with "/" matches the whole relative path ("src/**\/*.test.ts").
 * Supports `*`, `**` and `?`.
 */
export function globToRegExp(pattern: string): RegExp {
  let source = "";
  for (let i = 0; i < pattern.length; i++) {
    const char = pattern[i];
    if (char === "*") {
      if (pattern[i + 1] === "*") {
        // "**/" matches zero or more directories; a bare "**" matches anything.
        if (pattern[i + 2] === "/") {
          source += "(?:.*/)?";
          i += 2;
        } else {
          source += ".*";
          i += 1;
        }
      } else {
        source += "[^/]*";
      }
    } else if (char === "?") {
      source += "[^/]";
    } else {
      source += char.replace(/[.+^${}()|[\]\\]/g, "\\$&");
    }
  }
  return new RegExp(`^${source}$`, "i");
}

export class GlobSet {
  private readonly segmentPatterns: RegExp[] = [];
  private readonly pathPatterns: RegExp[] = [];

  constructor(patterns: string[]) {
    for (const raw of patterns) {
      const pattern = raw.trim().replace(/\\/g, "/").replace(/^\.\//, "").replace(/\/$/, "");
      if (!pattern) continue;
      if (pattern.includes("/")) this.pathPatterns.push(globToRegExp(pattern));
      else this.segmentPatterns.push(globToRegExp(pattern));
    }
  }

  get isEmpty(): boolean {
    return this.segmentPatterns.length === 0 && this.pathPatterns.length === 0;
  }

  /**
   * Exclude semantics: tests the last segment and the full path.
   * `relativePath` uses "/" separators and is relative to the workspace root.
   */
  matches(relativePath: string): boolean {
    const normalized = relativePath.replace(/\\/g, "/");
    const name = normalized.slice(normalized.lastIndexOf("/") + 1);
    if (this.segmentPatterns.some((re) => re.test(name))) return true;
    return this.pathPatterns.some((re) => re.test(normalized));
  }

  /**
   * Include semantics for a file: true when the file or any folder above it
   * matches, so "src" or "src/components" include everything underneath.
   */
  matchesFileOrAncestor(relativePath: string): boolean {
    const segments = relativePath.replace(/\\/g, "/").split("/");
    for (let i = 0; i < segments.length; i++) {
      if (this.segmentPatterns.some((re) => re.test(segments[i]))) return true;
      const prefix = segments.slice(0, i + 1).join("/");
      if (this.pathPatterns.some((re) => re.test(prefix))) return true;
    }
    return false;
  }
}

/** Splits a comma-separated pattern field as typed in the search view. */
export function splitPatterns(value: string): string[] {
  return value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}
