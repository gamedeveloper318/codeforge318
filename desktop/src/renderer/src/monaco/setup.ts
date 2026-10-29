import * as monaco from "monaco-editor";
import EditorWorker from "monaco-editor/editor/editor.worker?worker";
import CssWorker from "monaco-editor/languages/features/css/css.worker?worker";
import HtmlWorker from "monaco-editor/languages/features/html/html.worker?worker";
import JsonWorker from "monaco-editor/languages/features/json/json.worker?worker";
import TsWorker from "monaco-editor/languages/features/typescript/ts.worker?worker";

// Language workers are bundled with the app, so the editor works offline and
// never loads code from a CDN.
(self as unknown as { MonacoEnvironment: monaco.Environment }).MonacoEnvironment = {
  getWorker(_workerId: string, label: string) {
    if (label === "json") return new JsonWorker();
    if (label === "css" || label === "scss" || label === "less") return new CssWorker();
    if (label === "html" || label === "handlebars" || label === "razor") return new HtmlWorker();
    if (label === "typescript" || label === "javascript") return new TsWorker();
    return new EditorWorker();
  },
};

const ts = monaco.typescript;

// Without a project's node_modules, some diagnostics are guaranteed false
// alarms (unresolvable imports, missing @types). Those codes are muted so the
// Problems panel only shows issues the user can act on.
const NOISY_DIAGNOSTICS = [
  2307, // Cannot find module
  2792, // Cannot find module (moduleResolution hint)
  7016, // No declaration file for module
  7026, // JSX element implicitly has type 'any'
  2580, // Cannot find name 'require' / 'process' (needs @types/node)
  2591, // same, for other configurations
  2875, // JSX needs 'react/jsx-runtime'
];

ts.typescriptDefaults.setCompilerOptions({
  target: ts.ScriptTarget.ESNext,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.NodeJs,
  jsx: ts.JsxEmit.ReactJSX,
  allowJs: true,
  allowNonTsExtensions: true,
  esModuleInterop: true,
  strict: true,
  // Imports can't be resolved without the project's node_modules, so their
  // values are `any`; implicit-any errors on them would be false alarms.
  noImplicitAny: false,
  skipLibCheck: true,
});
ts.typescriptDefaults.setDiagnosticsOptions({
  noSemanticValidation: false,
  noSyntaxValidation: false,
  diagnosticCodesToIgnore: NOISY_DIAGNOSTICS,
});
ts.typescriptDefaults.setEagerModelSync(true);

ts.javascriptDefaults.setCompilerOptions({
  target: ts.ScriptTarget.ESNext,
  module: ts.ModuleKind.ESNext,
  jsx: ts.JsxEmit.ReactJSX,
  allowJs: true,
  allowNonTsExtensions: true,
  checkJs: false,
});
ts.javascriptDefaults.setDiagnosticsOptions({
  noSemanticValidation: true,
  noSyntaxValidation: false,
});
ts.javascriptDefaults.setEagerModelSync(true);

monaco.editor.defineTheme("codeforge-dark", {
  base: "vs-dark",
  inherit: true,
  rules: [
    { token: "comment", foreground: "64748b", fontStyle: "italic" },
    { token: "keyword", foreground: "c4b5fd" },
    { token: "keyword.flow", foreground: "c4b5fd" },
    { token: "storage", foreground: "c4b5fd" },
    { token: "string", foreground: "86efac" },
    { token: "string.escape", foreground: "5eead4" },
    { token: "number", foreground: "fdba74" },
    { token: "regexp", foreground: "fca5a5" },
    { token: "type", foreground: "67e8f9" },
    { token: "type.identifier", foreground: "67e8f9" },
    { token: "identifier", foreground: "e2e8f0" },
    { token: "function", foreground: "93c5fd" },
    { token: "variable", foreground: "e2e8f0" },
    { token: "constant", foreground: "fdba74" },
    { token: "delimiter", foreground: "94a3b8" },
    { token: "operator", foreground: "a5b4fc" },
    { token: "tag", foreground: "7dd3fc" },
    { token: "metatag", foreground: "7dd3fc" },
    { token: "attribute.name", foreground: "c4b5fd" },
    { token: "attribute.value", foreground: "86efac" },
    { token: "key", foreground: "93c5fd" },
    { token: "string.key.json", foreground: "93c5fd" },
    { token: "string.value.json", foreground: "86efac" },
    { token: "annotation", foreground: "fcd34d" },
  ],
  colors: {
    "editor.background": "#0d1324",
    "editor.foreground": "#e2e8f0",
    "editorLineNumber.foreground": "#3a4864",
    "editorLineNumber.activeForeground": "#a5b4cf",
    "editor.lineHighlightBackground": "#ffffff07",
    "editor.lineHighlightBorder": "#00000000",
    "editor.selectionBackground": "#3b82f645",
    "editor.inactiveSelectionBackground": "#3b82f622",
    "editor.selectionHighlightBackground": "#3b82f622",
    "editor.wordHighlightBackground": "#8b5cf622",
    "editor.findMatchBackground": "#f59e0b66",
    "editor.findMatchHighlightBackground": "#f59e0b2a",
    "editorCursor.foreground": "#22d3ee",
    "editorIndentGuide.background1": "#1b2540",
    "editorIndentGuide.activeBackground1": "#334366",
    "editorWhitespace.foreground": "#2a3654",
    "editorBracketMatch.background": "#3b82f62a",
    "editorBracketMatch.border": "#3b82f6aa",
    "editorGutter.background": "#0d1324",
    "editorWidget.background": "#0f1729",
    "editorWidget.border": "#24304d",
    "editorSuggestWidget.background": "#0f1729",
    "editorSuggestWidget.border": "#24304d",
    "editorSuggestWidget.selectedBackground": "#1d2b4d",
    "editorHoverWidget.background": "#0f1729",
    "editorHoverWidget.border": "#24304d",
    "editorStickyScroll.background": "#0d1324",
    "editorStickyScrollHover.background": "#141e34",
    "minimap.background": "#0d1324",
    "scrollbarSlider.background": "#94a3b822",
    "scrollbarSlider.hoverBackground": "#94a3b838",
    "scrollbarSlider.activeBackground": "#94a3b850",
    "input.background": "#070b16",
    "input.border": "#24304d",
    focusBorder: "#3b82f6",
    "list.hoverBackground": "#141e34",
    "list.activeSelectionBackground": "#1d2b4d",
    "list.highlightForeground": "#93c5fd",
    "diffEditor.insertedTextBackground": "#22c55e24",
    "diffEditor.removedTextBackground": "#ef444424",
    "diffEditor.insertedLineBackground": "#22c55e14",
    "diffEditor.removedLineBackground": "#ef444414",
  },
});

monaco.editor.defineTheme("codeforge-light", {
  base: "vs",
  inherit: true,
  rules: [
    { token: "comment", foreground: "64748b", fontStyle: "italic" },
    { token: "keyword", foreground: "7c3aed" },
    { token: "string", foreground: "15803d" },
    { token: "number", foreground: "c2410c" },
    { token: "type", foreground: "0e7490" },
    { token: "type.identifier", foreground: "0e7490" },
    { token: "delimiter", foreground: "475569" },
    { token: "tag", foreground: "1d4ed8" },
    { token: "attribute.name", foreground: "7c3aed" },
    { token: "attribute.value", foreground: "15803d" },
    { token: "string.key.json", foreground: "1d4ed8" },
    { token: "string.value.json", foreground: "15803d" },
  ],
  colors: {
    "editor.background": "#ffffff",
    "editorLineNumber.foreground": "#a3aec2",
    "editorLineNumber.activeForeground": "#334155",
    "editor.lineHighlightBackground": "#0f172a08",
    "editorCursor.foreground": "#2563eb",
    "editor.selectionBackground": "#2563eb30",
    focusBorder: "#2563eb",
  },
});

export { monaco };
