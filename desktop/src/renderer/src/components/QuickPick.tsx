import { useEffect, useMemo, useRef, useState } from "react";
import { fuzzyFilter } from "@shared/fuzzy";
import { openFile } from "../actions/editor";
import { COMMANDS, runCommand, shortcutFor } from "../commands/commands";
import { api } from "../lib/bridge";
import * as paths from "../lib/paths";
import { getActiveEditor } from "../monaco/editor-ref";
import { FileIcon } from "./FileIcon";
import { setState, useStore, type QuickPickItem, type QuickPickRequest } from "../state/store";

function Highlighted({ text, positions }: { text: string; positions?: number[] }) {
  if (!positions?.length) return <>{text}</>;
  const set = new Set(positions);
  return (
    <>
      {[...text].map((char, i) =>
        set.has(i) ? <mark key={i}>{char}</mark> : <span key={i}>{char}</span>,
      )}
    </>
  );
}

const close = () => setState({ quickPick: null });

/**
 * One overlay for several pickers: "Go to File" (Ctrl+P), the Command Palette
 * (">" prefix), "Go to Line" (":" prefix), lists such as branches, and simple
 * text prompts.
 */
function QuickPickInner({ request }: { request: QuickPickRequest }) {
  const workspace = useStore((s) => s.workspace);
  const tabs = useStore((s) => s.tabs);
  const [value, setValue] = useState(
    request.kind === "quick-open"
      ? request.initial
      : request.kind === "input"
        ? (request.value ?? "")
        : "",
  );
  const [activeIndex, setActiveIndex] = useState(0);
  const [files, setFiles] = useState<string[] | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const mode =
    request.kind === "quick-open"
      ? value.startsWith(">")
        ? "commands"
        : value.startsWith(":")
          ? "line"
          : "files"
      : request.kind;

  useEffect(() => {
    if (mode === "files" && files === null && workspace) {
      api
        .invoke("fs:list-files")
        .then(setFiles)
        .catch(() => setFiles([]));
    }
  }, [mode, files, workspace]);

  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    input.focus();
    if (request.kind === "input") input.select();
    else input.setSelectionRange(input.value.length, input.value.length);
  }, [request]);

  const items: (QuickPickItem & { run: () => void })[] = useMemo(() => {
    if (mode === "commands") {
      return fuzzyFilter(COMMANDS, value.slice(1), (c) => `${c.category}: ${c.title}`, 300).map(
        ({ item, positions }) => ({
          id: item.id,
          label: `${item.category}: ${item.title}`,
          detail: shortcutFor(item),
          highlights: positions,
          run: () => runCommand(item.id),
        }),
      );
    }
    if (mode === "files") {
      const root = workspace?.root ?? "";
      const openPaths = tabs.flatMap((t) => (t.kind === "file" && t.path ? [t.path] : []));
      const candidates = value.trim()
        ? (files ?? [])
        : [...new Set([...openPaths.reverse(), ...(files ?? [])])];
      return fuzzyFilter(candidates, value, (f) => paths.relative(root, f), 200).map(
        ({ item, positions }) => {
          const rel = paths.relative(root, item);
          const name = paths.basename(item);
          const offset = rel.length - name.length;
          return {
            id: item,
            label: name,
            fileIcon: name,
            description: paths.dirname(rel) === rel ? "" : rel.slice(0, Math.max(0, offset - 1)),
            highlights: positions.filter((p) => p >= offset).map((p) => p - offset),
            run: () => void openFile(item),
          };
        },
      );
    }
    if (mode === "list" && request.kind === "list") {
      return fuzzyFilter(request.items, value, (i) => i.label, 300).map(({ item, positions }) => ({
        ...item,
        highlights: positions,
        run: () => request.onPick(item),
      }));
    }
    return [];
  }, [mode, value, files, workspace, tabs, request]);

  useEffect(() => setActiveIndex(0), [value]);
  useEffect(() => {
    listRef.current?.querySelector(".quickpick-item.active")?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  const editor = getActiveEditor();
  const lineCount = editor?.getModel()?.getLineCount() ?? 0;
  const lineTarget = mode === "line" ? Number.parseInt(value.slice(1), 10) : NaN;
  const inputError = request.kind === "input" && value ? (request.validate?.(value) ?? null) : null;

  let message: { text: string; error?: boolean } | null = null;
  if (mode === "line") {
    message = lineCount
      ? Number.isNaN(lineTarget)
        ? { text: `Type a line number between 1 and ${lineCount}, then press Enter.` }
        : { text: `Go to line ${Math.min(Math.max(lineTarget, 1), lineCount)}.` }
      : { text: "Open a file in the editor first.", error: true };
  } else if (request.kind === "input") {
    message = inputError ? { text: inputError, error: true } : { text: request.prompt };
  } else if (mode === "files" && !workspace) {
    message = { text: "Open a folder to search its files. Type > to run a command." };
  } else if (mode === "files" && files === null) {
    message = { text: "Indexing files…" };
  } else if (!items.length) {
    message = { text: "No matching results." };
  }

  const accept = (index: number) => {
    if (mode === "line") {
      if (!editor || Number.isNaN(lineTarget)) return;
      close();
      const line = Math.min(Math.max(lineTarget, 1), lineCount);
      editor.setPosition({ lineNumber: line, column: 1 });
      editor.revealLineInCenter(line);
      editor.focus();
      return;
    }
    if (request.kind === "input") {
      if (!value.trim() || inputError) return;
      close();
      request.onAccept(value);
      return;
    }
    const item = items[index];
    if (!item) return;
    close();
    item.run();
  };

  const placeholder =
    request.kind === "list"
      ? request.placeholder
      : request.kind === "input"
        ? (request.placeholder ?? "")
        : "Search files by name (type > for commands, : for a line number)";

  return (
    <>
      <div className="quickpick-backdrop" onMouseDown={close} />
      <div className="quickpick" role="dialog" aria-label="Quick pick">
        <div className="quickpick-input">
          <input
            ref={inputRef}
            className={`text-input${inputError ? " invalid" : ""}`}
            value={value}
            placeholder={placeholder}
            spellCheck={false}
            aria-label={placeholder || "Input"}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.preventDefault();
                close();
              } else if (e.key === "ArrowDown") {
                e.preventDefault();
                setActiveIndex((i) => Math.min(i + 1, items.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActiveIndex((i) => Math.max(i - 1, 0));
              } else if (e.key === "Enter") {
                e.preventDefault();
                accept(activeIndex);
              }
            }}
          />
        </div>
        {message && (
          <div className={`quickpick-message${message.error ? " error" : ""}`}>{message.text}</div>
        )}
        {items.length > 0 && (
          <div className="quickpick-list" ref={listRef} role="listbox">
            {items.map((item, index) => (
              <div
                key={item.id}
                role="option"
                aria-selected={index === activeIndex}
                className={`quickpick-item${index === activeIndex ? " active" : ""}`}
                onMouseMove={() => setActiveIndex(index)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  accept(index);
                }}
              >
                {item.fileIcon && <FileIcon name={item.fileIcon} />}
                <span className="label">
                  <Highlighted text={item.label} positions={item.highlights} />
                </span>
                {item.description && <span className="description">{item.description}</span>}
                {item.detail && <span className="detail">{item.detail}</span>}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

const requestIds = new WeakMap<QuickPickRequest, number>();
let nextRequestId = 0;

export function QuickPick() {
  const request = useStore((s) => s.quickPick);
  if (!request) return null;
  if (!requestIds.has(request)) requestIds.set(request, ++nextRequestId);
  // A new request always gets a fresh picker (empty input, first item active).
  return <QuickPickInner key={requestIds.get(request)} request={request} />;
}
