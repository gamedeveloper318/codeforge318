import { api } from "../lib/bridge";
import { monaco } from "./setup";

/**
 * Makes the JavaScript/TypeScript language service aware of the whole open
 * folder, not just the open tabs: every .js/.jsx/.ts/.tsx file is given to it
 * (as an "extra lib"), so imports between project files resolve and
 * completion, hover, signatures, go to definition and type errors work across
 * files. Files open in the editor are served from their editor model instead.
 */
const SOURCE = /\.(m|c)?(j|t)sx?$/i;
const MAX_FILES = 400;
const MAX_TOTAL_BYTES = 8 * 1024 * 1024;
const MAX_FILE_BYTES = 512 * 1024;

const ts = monaco.typescript;
const libs = new Map<string, { content: string; handles: monaco.IDisposable[] }>();
let generation = 0;

function uriOf(path: string): string {
  return monaco.Uri.file(path).toString();
}

function hasOpenModel(path: string): boolean {
  const model = monaco.editor.getModel(monaco.Uri.file(path));
  return Boolean(model && !model.isDisposed());
}

function addLib(path: string, content: string): void {
  removeLib(path, false);
  const uri = uriOf(path);
  const handles = hasOpenModel(path)
    ? []
    : [
        ts.typescriptDefaults.addExtraLib(content, uri),
        ts.javascriptDefaults.addExtraLib(content, uri),
      ];
  libs.set(path.toLowerCase(), { content, handles });
}

function removeLib(path: string, forget = true): void {
  const entry = libs.get(path.toLowerCase());
  entry?.handles.forEach((h) => h.dispose());
  if (entry) entry.handles = [];
  if (forget) libs.delete(path.toLowerCase());
}

/** Loads the project's source files (called when a folder is opened). */
export async function loadProjectSources(): Promise<void> {
  const run = ++generation;
  for (const path of [...libs.keys()]) removeLib(path);
  let files: string[];
  try {
    files = (await api.invoke("fs:list-files")).filter((f) => SOURCE.test(f));
  } catch {
    return;
  }
  let total = 0;
  for (const file of files.slice(0, MAX_FILES)) {
    if (run !== generation) return; // another folder was opened meanwhile
    try {
      const { content, binary, size } = await api.invoke("fs:read-file", file);
      if (binary || size > MAX_FILE_BYTES) continue;
      total += size;
      if (total > MAX_TOTAL_BYTES) break;
      addLib(file, content);
    } catch {
      // unreadable files are simply skipped
    }
  }
}

/** Keeps the language service's copy of changed project files current. */
export async function refreshProjectSources(changed: string[]): Promise<void> {
  for (const file of changed) {
    if (!SOURCE.test(file)) continue;
    try {
      const info = await api.invoke("fs:read-file", file);
      if (!info.binary) addLib(file, info.content);
    } catch {
      removeLib(file); // deleted
    }
  }
}

let watching = false;

/** Open files are served from their editor model; closed ones from the loaded copy. */
export function watchEditorModels(): void {
  if (watching) return;
  watching = true;
  monaco.editor.onDidCreateModel((model) => {
    if (model.uri.scheme !== "file") return;
    const entry = libs.get(model.uri.fsPath.toLowerCase());
    if (!entry) return;
    entry.handles.forEach((h) => h.dispose());
    entry.handles = [];
    model.onWillDispose(() => {
      const path = model.uri.fsPath;
      const text = model.getValue();
      // Re-add after the model is gone, with its latest text.
      window.setTimeout(() => {
        if (libs.has(path.toLowerCase())) addLib(path, text);
      }, 0);
    });
  });
}
