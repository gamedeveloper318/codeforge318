import { CaseSensitive, ChevronDown, ChevronRight, Regex, WholeWord } from "lucide-react";
import { useState } from "react";
import { openFile } from "../../actions/editor";
import { runSearch, scheduleSearch } from "../../actions/misc";
import { basename, dirname } from "../../lib/paths";
import { getState, setState, useStore, type SearchState } from "../../state/store";
import { FileIcon } from "../FileIcon";

function update(patch: Partial<SearchState>, immediate = false) {
  setState({ search: { ...getState().search, ...patch } });
  if (immediate) void runSearch();
  else scheduleSearch();
}

export function SearchView() {
  const search = useStore((s) => s.search);
  const workspace = useStore((s) => s.workspace);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [showFilters, setShowFilters] = useState(false);
  const response = search.response;

  return (
    <>
      <div className="view-header">
        <span className="title">Search</span>
      </div>
      <div className="search-form">
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
                      <mark>
                        {match.preview.slice(
                          match.previewOffset,
                          match.previewOffset + match.length,
                        )}
                      </mark>
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
