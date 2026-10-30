import { readFile, stat, writeFile } from "node:fs/promises";
import { GlobSet, splitPatterns } from "@shared/glob";
import type { ReplaceResult, SearchFileResult, SearchQuery, SearchResponse } from "@shared/ipc";
import type { Settings } from "@shared/settings";
import { looksBinary } from "./fs-service";
import { toRelative, walkFiles } from "./file-walker";
import { buildMatcher, findMatches, replaceInText } from "@shared/search-matcher";
import { friendlyFsError } from "./errors";
import type { Workspace } from "./workspace";

const MAX_MATCHES = 5000;
const MAX_FILES = 100_000;
const MAX_FILE_BYTES = 2 * 1024 * 1024;
const CONCURRENCY = 16;

/** Project-wide text search. Starting a new search cancels the previous one. */
export class SearchService {
  private generation = 0;

  constructor(
    private readonly workspace: Workspace,
    private readonly settings: () => Settings,
  ) {}

  async find(query: SearchQuery): Promise<SearchResponse> {
    const started = Date.now();
    const generation = ++this.generation;
    const isCancelled = () => generation !== this.generation;
    const empty: SearchResponse = {
      results: [],
      matchCount: 0,
      filesSearched: 0,
      truncated: false,
      durationMs: 0,
      cancelled: false,
    };
    const root = this.workspace.root;
    if (!root || !query.pattern) return empty;

    const matcher = buildMatcher(query);
    const settings = this.settings();
    const exclude = new GlobSet([
      ...settings["files.exclude"],
      ...settings["search.exclude"],
      ...splitPatterns(query.exclude),
    ]);
    const include = new GlobSet(splitPatterns(query.include));

    const walk = await walkFiles(root, { exclude, limit: MAX_FILES, isCancelled });
    const candidates = include.isEmpty
      ? walk.files
      : walk.files.filter((file) => include.matchesFileOrAncestor(toRelative(root, file)));

    const results: SearchFileResult[] = [];
    let matchCount = 0;
    let filesSearched = 0;
    let truncated = walk.truncated;

    for (let i = 0; i < candidates.length; i += CONCURRENCY) {
      if (isCancelled()) return { ...empty, cancelled: true };
      if (matchCount >= MAX_MATCHES) {
        truncated = true;
        break;
      }
      const batch = candidates.slice(i, i + CONCURRENCY);
      const texts = await Promise.all(batch.map((file) => readSearchable(file)));
      for (let j = 0; j < batch.length; j++) {
        const text = texts[j];
        if (text === null) continue;
        filesSearched++;
        // Each file gets its own RegExp so concurrent lastIndex state never clashes.
        const matches = findMatches(text, new RegExp(matcher), MAX_MATCHES - matchCount);
        if (matches.length) {
          results.push({ path: batch[j], relativePath: toRelative(root, batch[j]), matches });
          matchCount += matches.length;
        }
      }
    }
    return {
      results,
      matchCount,
      filesSearched,
      truncated,
      durationMs: Date.now() - started,
      cancelled: false,
    };
  }
}

const BOM = Buffer.from([0xef, 0xbb, 0xbf]);

/**
 * Replaces the query's matches in the given files on disk (files open in the
 * editor are changed in the editor instead, so they never come here).
 */
export async function replaceInFiles(
  workspace: Workspace,
  query: SearchQuery,
  replacement: string,
  paths: string[],
): Promise<ReplaceResult> {
  const matcher = buildMatcher(query);
  const result: ReplaceResult = { filesChanged: 0, replacements: 0, failed: [] };
  for (const requested of paths) {
    try {
      const file = await workspace.resolve(requested);
      const buffer = await readFile(file);
      if (looksBinary(buffer)) throw new Error("It is a binary file.");
      const bom = buffer.subarray(0, 3).equals(BOM);
      const { text, count } = replaceInText(
        buffer.toString("utf8", bom ? 3 : 0),
        new RegExp(matcher),
        replacement,
        query.isRegex,
      );
      if (!count) continue;
      const body = Buffer.from(text, "utf8");
      await writeFile(file, bom ? Buffer.concat([BOM, body]) : body);
      result.filesChanged++;
      result.replacements += count;
    } catch (error) {
      const message = friendlyFsError(error, "replace in", requested).message;
      result.failed.push({ path: requested, message });
    }
  }
  return result;
}

async function readSearchable(file: string): Promise<string | null> {
  try {
    const info = await stat(file);
    if (info.size > MAX_FILE_BYTES) return null;
    const buffer = await readFile(file);
    if (looksBinary(buffer)) return null;
    return buffer.toString("utf8");
  } catch {
    return null;
  }
}
