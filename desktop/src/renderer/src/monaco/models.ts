import { languageForPath } from "@shared/languages";
import { monaco } from "./setup";

/**
 * One Monaco text model per open file tab. Dirty tracking compares the model's
 * alternative version id with the one recorded at the last save, so undoing
 * back to the saved text clears the dirty marker (like VS Code).
 */
export interface ModelEntry {
  model: monaco.editor.ITextModel;
  savedVersion: number;
  bom: boolean;
  mtimeMs: number;
  viewState: monaco.editor.ICodeEditorViewState | null;
}

const entries = new Map<string, ModelEntry>();
let untitledCounter = 0;
let contentListener: (tabId: string) => void = () => {};

export function onModelContentChange(listener: (tabId: string) => void): void {
  contentListener = listener;
}

function track(
  tabId: string,
  model: monaco.editor.ITextModel,
  meta: { bom: boolean; mtimeMs: number },
): ModelEntry {
  const entry: ModelEntry = {
    model,
    savedVersion: model.getAlternativeVersionId(),
    bom: meta.bom,
    mtimeMs: meta.mtimeMs,
    viewState: null,
  };
  entries.set(tabId, entry);
  model.onDidChangeContent(() => contentListener(tabId));
  return entry;
}

export function createFileModel(
  tabId: string,
  path: string,
  content: string,
  meta: { bom: boolean; mtimeMs: number },
): ModelEntry {
  const uri = monaco.Uri.file(path);
  monaco.editor.getModel(uri)?.dispose();
  return track(tabId, monaco.editor.createModel(content, languageForPath(path), uri), meta);
}

export function createUntitledModel(): { tabId: string; title: string; entry: ModelEntry } {
  untitledCounter++;
  const title = `Untitled-${untitledCounter}`;
  const model = monaco.editor.createModel(
    "",
    "plaintext",
    monaco.Uri.from({ scheme: "untitled", path: title }),
  );
  const tabId = `untitled:${untitledCounter}`;
  return { tabId, title, entry: track(tabId, model, { bom: false, mtimeMs: 0 }) };
}

export const getEntry = (tabId: string): ModelEntry | undefined => entries.get(tabId);

export function isDirty(tabId: string): boolean {
  const entry = entries.get(tabId);
  return Boolean(entry && entry.model.getAlternativeVersionId() !== entry.savedVersion);
}

export function markSaved(tabId: string, meta?: { mtimeMs: number }): void {
  const entry = entries.get(tabId);
  if (!entry) return;
  entry.savedVersion = entry.model.getAlternativeVersionId();
  if (meta) entry.mtimeMs = meta.mtimeMs;
}

/** Replaces the text with what is on disk (used when a clean file changes externally). */
export function reloadContent(tabId: string, content: string, mtimeMs: number): void {
  const entry = entries.get(tabId);
  if (!entry) return;
  if (entry.model.getValue() !== content) {
    entry.model.pushEditOperations(
      [],
      [{ range: entry.model.getFullModelRange(), text: content }],
      () => null,
    );
  }
  entry.mtimeMs = mtimeMs;
  entry.savedVersion = entry.model.getAlternativeVersionId();
}

export function disposeEntry(tabId: string): void {
  entries.get(tabId)?.model.dispose();
  entries.delete(tabId);
}

/**
 * Moves an open file to a new path (after a rename or "Save As"), keeping its
 * text, cursor position and dirty state.
 */
export function rekeyEntry(
  oldTabId: string,
  newTabId: string,
  newPath: string,
  keepDirty: boolean,
): ModelEntry | undefined {
  const old = entries.get(oldTabId);
  if (!old) return undefined;
  const wasDirty = keepDirty && isDirty(oldTabId);
  const entry = createFileModel(newTabId, newPath, old.model.getValue(), {
    bom: old.bom,
    mtimeMs: old.mtimeMs,
  });
  entry.viewState = old.viewState;
  if (wasDirty) entry.savedVersion = -1;
  old.model.dispose();
  entries.delete(oldTabId);
  return entry;
}

export function allEntries(): [string, ModelEntry][] {
  return [...entries.entries()];
}
