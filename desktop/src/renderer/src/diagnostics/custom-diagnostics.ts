import { findHtmlStructureProblems } from "@shared/html-structure";
import { findLanguageMismatches } from "@shared/language-mismatch";
import { monaco } from "../monaco/setup";

/**
 * CodeForge's own checks, on top of the language services (TypeScript, CSS,
 * JSON workers and Pyright): code written in the wrong language for the file
 * and unbalanced HTML tags. Results become editor markers, so they show as
 * squiggles and in the Problems panel like every other diagnostic.
 */
const OWNER = "codeforge";
const CHECKED = new Set(["html", "python", "javascript", "typescript"]);
const DELAY_MS = 350;

const timers = new Map<string, number>();

function severity(value: "error" | "warning"): monaco.MarkerSeverity {
  return value === "error" ? monaco.MarkerSeverity.Error : monaco.MarkerSeverity.Warning;
}

export function checkModel(model: monaco.editor.ITextModel): void {
  if (model.isDisposed()) return;
  const language = model.getLanguageId();
  if (!CHECKED.has(language)) {
    monaco.editor.setModelMarkers(model, OWNER, []);
    return;
  }
  const text = model.getValue();
  const markers: monaco.editor.IMarkerData[] = findLanguageMismatches(text, language).map((p) => ({
    severity: severity(p.severity),
    message: p.message,
    startLineNumber: p.line,
    startColumn: p.startColumn,
    endLineNumber: p.line,
    endColumn: p.endColumn,
    source: "CodeForge",
    code: "language-mismatch",
  }));
  if (language === "html") {
    for (const p of findHtmlStructureProblems(text)) {
      markers.push({
        severity: severity(p.severity),
        message: p.message,
        startLineNumber: p.line,
        startColumn: p.startColumn,
        endLineNumber: p.endLine,
        endColumn: p.endColumn,
        source: "CodeForge HTML",
        code: "html-structure",
      });
    }
  }
  monaco.editor.setModelMarkers(model, OWNER, markers);
}

function schedule(model: monaco.editor.ITextModel): void {
  const key = model.uri.toString();
  window.clearTimeout(timers.get(key));
  timers.set(
    key,
    window.setTimeout(() => {
      timers.delete(key);
      checkModel(model);
    }, DELAY_MS),
  );
}

function watch(model: monaco.editor.ITextModel): void {
  // Files only; the diff editor's "original" models (git: URIs) are left alone.
  if (model.uri.scheme !== "file" && model.uri.scheme !== "untitled") return;
  checkModel(model);
  const subscriptions = [
    model.onDidChangeContent(() => schedule(model)),
    model.onDidChangeLanguage(() => checkModel(model)),
  ];
  model.onWillDispose(() => {
    window.clearTimeout(timers.get(model.uri.toString()));
    subscriptions.forEach((s) => s.dispose());
  });
}

let started = false;

/** Starts checking every open file (once, at startup). */
export function startCustomDiagnostics(): void {
  if (started) return;
  started = true;
  monaco.editor.getModels().forEach(watch);
  monaco.editor.onDidCreateModel(watch);
}
