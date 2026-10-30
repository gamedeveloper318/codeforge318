import {
  CaseSensitive,
  ChevronDown,
  ChevronRight,
  Regex,
  Replace,
  ReplaceAll,
  WholeWord,
} from "lucide-react";
import { useMemo, useState } from "react";
import type { SearchMatch } from "@shared/ipc";
import { buildMatcher, expandReplacement } from "@shared/search-matcher";
import { openFile } from "../../actions/editor";
import { replaceResults, runSearch, scheduleSearch } from "../../actions/misc";
import { basename, dirname } from "../../lib/paths";
import { getState, setState, useStore, type SearchState } from "../../state/store";
import { FileIcon } from "../FileIcon";

function update(patch: Partial<SearchState>, immediate = false) {
  setState({ search: { ...getState().search, ...patch } });
  if (immediate) void runSearch();
  else scheduleSearch();
}

/** What a match will become, for the replace preview (expands $1 etc. for regexes). */
function previewReplacement(
  match: SearchMatch,
  sticky: RegExp | null,
  replacement: string,
): string {
  if (!sticky) return replacement;
  sticky.lastIndex = match.previewOffset;
  const found = sticky.exec(match.preview);
  return found ? expandReplacement(replacement, found, match.preview) : replacement;
}

export function SearchView() {
  const search = useStore((s) => s.search);
  const workspace = useStore((s) => s.workspace);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [showFilters, setShowFilters] = useState(false);
  const response = search.response;
  const replacing = search.showReplace;

  // A sticky copy of the search regex, used to preview regex replacements.
  const sticky = useMemo(() => {
    if (!replacing || !search.isRegex || !search.pattern) return null;
    try {
      const matcher = buildMatcher(search);
      return new RegExp(matcher.source, matcher.flags.replace("g", "") + "y");
    } catch {
      return null;
    }
  }, [replacing, search]);

  const canReplace = Boolean(replacing && response?.matchCount && !search.running);

  return (
    <>
      <div className="view-header">
        <span className="title">Search</span>
      </div>
      <div className="search-form">
        <div className="search-fields">
          <button
            className="icon-button search-replace-toggle"
            title={replacing ? "Hide Replace" : "Show Replace"}
            aria-expanded={replacing}
            aria-label="Toggle Replace"
            onClick={() => update({ showReplace: !replacing }, true)}
          >
            {replacing ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
          </button>
          <div className="search-field-stack">
            <div className="search-input-row">
              <input
                className={`text-input${search.error ? " invalid" : ""}`}
                placeholder="Search"
                aria-label="Search text"
                autoFocus
                spellCheck={false}
                value={search.pattern}
                disabled={!workspace}
                onChange={(e) => update({ pattern: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void runSearch();
                }}
              />
              <div className="toggles">
                <button
                  className={`icon-button${search.caseSensitive ? " toggled" : ""}`}
                  title="Match Case"
                  aria-pressed={search.caseSensitive}
                  onClick={() => update({ caseSensitive: !search.caseSensitive }, true)}
                >
                  <CaseSensitive size={15} />
                </button>
                <button
                  className={`icon-button${search.wholeWord ? " toggled" : ""}`}
                  title="Match Whole Word"
                  aria-pressed={search.wholeWord}
                  onClick={() => update({ wholeWord: !search.wholeWord }, true)}
                >
                  <WholeWord size={15} />
                </button>
                <button
                  className={`icon-button${search.isRegex ? " toggled" : ""}`}
                  title="Use Regular Expression"
                  aria-pressed={search.isRegex}
                  onClick={() => update({ isRegex: !search.isRegex }, true)}
                >
                  <Regex size={14} />
                </button>
              </div>
            </div>
            {replacing && (
              <div className="search-input-row">
                <input
                  className="text-input"
                  placeholder={search.isRegex ? "Replace ($1, $<name> and $& allowed)" : "Replace"}
                  aria-label="Replace text"
                  spellCheck={false}
                  value={search.replacement}
                  disabled={!workspace}
                  onChange={(e) =>
                    setState({ search: { ...getState().search, replacement: e.target.value } })
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && canReplace)
                      void replaceResults();
                  }}
                />
                <div className="toggles">
                  <button
                    className="icon-button"
                    title="Replace All (Ctrl+Enter)"
                    aria-label="Replace All"
                    disabled={!canReplace}
                    onClick={() => void replaceResults()}
                  >
                    <ReplaceAll size={15} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
        <button
          className="icon-button"
          style={{ width: "auto", padding: "0 6px", alignSelf: "flex-start", fontSize: 12 }}
          onClick={() => setShowFilters(!showFilters)}
        >
          {showFilters ? "Hide filters" : "Files to include / exclude"}
        </button>
        {showFilters && (
          <>
            <input
              className="text-input"
              placeholder="Files to include (e.g. src, *.ts)"
              aria-label="Files to include"
              value={search.include}
              onChange={(e) => update({ include: e.target.value })}
            />
            <input
              className="text-input"
              placeholder="Files to exclude (e.g. *.test.ts)"
              aria-label="Files to exclude"
              value={search.exclude}
              onChange={(e) => update({ exclude: e.target.value })}
            />
          </>
        )}
      </div>
      {!workspace && <div className="empty-state">Open a folder to search its files.</div>}
      {search.error && <div className="search-summary severity-error">{search.error}</div>}
      {search.running && <div className="search-summary">Searching…</div>}
      {response && !search.running && (
        <div className="search-summary">
          {response.matchCount === 0
            ? `No results in ${response.filesSearched} files.`
            : `${response.matchCount} result${response.matchCount === 1 ? "" : "s"} in ${response.results.length} file${
                response.results.length === 1 ? "" : "s"
              }${response.truncated ? " (limit reached — refine your search)" : ""}`}
        </div>
      )}
      <div className="view-body" data-testid="search-results">
        {response?.results.map((file) => {
          const isCollapsed = collapsed[file.path];
          const folder = dirname(file.relativePath);
          return (
            <div key={file.path}>
              <div
                className="tree-row"
                style={{ paddingLeft: 8 }}
                title={file.path}
                onClick={() => setCollapsed({ ...collapsed, [file.path]: !isCollapsed })}
              >
                <span className="twistie">
                  {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                </span>
                <FileIcon name={file.relativePath} />
                <span className="name" style={{ flex: "none" }}>
                  {basename(file.relativePath)}
                </span>
                <span className="description">{folder === file.relativePath ? "" : folder}</span>
                {canReplace && (
                  <span className="row-actions" onClick={(e) => e.stopPropagation()}>
                    <button
                      className="icon-button"
                      title={`Replace in ${basename(file.relativePath)}`}
                      aria-label={`Replace in ${basename(file.relativePath)}`}
                      onClick={() => void replaceResults(file.path)}
                    >
                      <Replace size={14} />
                    </button>
                  </span>
                )}
                <span className="description" style={{ marginLeft: "auto" }}>
                  {file.matches.length}
                </span>
              </div>
              {!isCollapsed &&
                file.matches.map((match, index) => (
                  <div
                    key={index}
                    className="tree-row search-match"
                    title={`Line ${match.line}`}
                    onClick={() =>
                      void openFile(file.path, {
                        line: match.line,
                        column: match.column,
                        endColumn: match.column + match.length,
                      })
                    }
                  >
                    <span className="name">
                      {match.preview.slice(0, match.previewOffset)}
                      {replacing ? (
                        <>
                          <del>
                            {match.preview.slice(
                              match.previewOffset,
                              match.previewOffset + match.length,
                            )}
                          </del>
                          <ins>{previewReplacement(match, sticky, search.replacement)}</ins>
                        </>
                      ) : (
                        <mark>
                          {match.preview.slice(
                            match.previewOffset,
                            match.previewOffset + match.length,
                          )}
                        </mark>
                      )}
                      {match.preview.slice(match.previewOffset + match.length)}
                    </span>
                    <span className="line-number">{match.line}</span>
                  </div>
                ))}
            </div>
          );
        })}
      </div>
    </>
  );
}
