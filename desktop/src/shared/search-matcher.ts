import type { SearchMatch, SearchQuery } from "@shared/ipc";

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Builds the global RegExp for a search query. Throws a readable error for bad regexes. */
export function buildMatcher(
  query: Pick<SearchQuery, "pattern" | "isRegex" | "caseSensitive" | "wholeWord">,
): RegExp {
  let source = query.isRegex ? query.pattern : escapeRegExp(query.pattern);
  if (query.wholeWord) source = `\\b(?:${source})\\b`;
  try {
    return new RegExp(source, query.caseSensitive ? "g" : "gi");
  } catch (error) {
    throw new Error(`Invalid regular expression: ${(error as Error).message}`, { cause: error });
  }
}

const PREVIEW_BEFORE = 40;
const PREVIEW_LENGTH = 220;

function makePreview(
  line: string,
  index: number,
  length: number,
): { preview: string; previewOffset: number } {
  let start = 0;
  while (start < index && (line[start] === " " || line[start] === "\t")) start++;
  let ellipsis = false;
  if (index - start > PREVIEW_BEFORE + 20) {
    start = index - PREVIEW_BEFORE;
    ellipsis = true;
  }
  const end = Math.min(line.length, Math.max(index + length + 80, start + PREVIEW_LENGTH));
  const text = line.slice(start, end);
  return ellipsis
    ? { preview: `…${text}`, previewOffset: index - start + 1 }
    : { preview: text, previewOffset: index - start };
}

/** Finds all matches in `text`, line by line. Stops after `limit` matches. */
export function findMatches(text: string, matcher: RegExp, limit: number): SearchMatch[] {
  const matches: SearchMatch[] = [];
  const lines = text.split(/\r\n|\r|\n/);
  for (let lineIndex = 0; lineIndex < lines.length && matches.length < limit; lineIndex++) {
    const line = lines[lineIndex];
    matcher.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = matcher.exec(line)) !== null) {
      if (match[0].length === 0) {
        // Zero-width matches (like "^" or "a*") would loop forever; skip them.
        matcher.lastIndex++;
        if (matcher.lastIndex > line.length) break;
        continue;
      }
      matches.push({
        line: lineIndex + 1,
        column: match.index + 1,
        length: match[0].length,
        ...makePreview(line, match.index, match[0].length),
      });
      if (matches.length >= limit) break;
    }
  }
  return matches;
}

/**
 * The text a regular-expression match is replaced with, supporting the same
 * patterns as JavaScript's String.replace: $$, $&, $`, $', $1-$99 and $<name>.
 */
export function expandReplacement(
  replacement: string,
  match: RegExpExecArray,
  line: string,
): string {
  return replacement.replace(
    /\$(\$|&|`|'|\d{1,2}|<([^>]*)>)/g,
    (token, what: string, name?: string) => {
      if (what === "$") return "$";
      if (what === "&") return match[0];
      if (what === "`") return line.slice(0, match.index);
      if (what === "'") return line.slice(match.index + match[0].length);
      if (name !== undefined) return match.groups?.[name] ?? "";
      const group = Number(what);
      if (group >= 1 && group < match.length) return match[group] ?? "";
      // "$12" with only one group means "$1" followed by "2", like String.replace.
      if (what.length === 2 && Number(what[0]) >= 1 && Number(what[0]) < match.length) {
        return (match[Number(what[0])] ?? "") + what[1];
      }
      return token;
    },
  );
}

/**
 * Replaces every match, line by line (exactly the matches findMatches reports),
 * keeping the file's line endings. Plain-text searches insert `replacement`
 * literally; regular-expression searches expand $1, $<name> and friends.
 */
export function replaceInText(
  text: string,
  matcher: RegExp,
  replacement: string,
  isRegex: boolean,
): { text: string; count: number } {
  let count = 0;
  // Odd indexes are the line separators, kept as they were.
  const parts = text.split(/(\r\n|\r|\n)/);
  for (let i = 0; i < parts.length; i += 2) {
    const line = parts[i];
    matcher.lastIndex = 0;
    let output = "";
    let last = 0;
    let match: RegExpExecArray | null;
    while ((match = matcher.exec(line)) !== null) {
      if (match[0].length === 0) {
        matcher.lastIndex++;
        if (matcher.lastIndex > line.length) break;
        continue;
      }
      output += line.slice(last, match.index);
      output += isRegex ? expandReplacement(replacement, match, line) : replacement;
      last = match.index + match[0].length;
      count++;
    }
    if (last > 0) parts[i] = output + line.slice(last);
  }
  return { text: parts.join(""), count };
}
