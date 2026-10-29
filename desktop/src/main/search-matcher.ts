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
