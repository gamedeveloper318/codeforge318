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

/**
 * Syntax colors. Rules match Monaco's tokenizer token types by prefix
 * ("string" covers "string.escape.python") and the semantic token types added
 * by semantic-highlighting.ts ("function", "method", "class", "parameter", ...).
 */
const DARK = {
  comment: "6b7a99",
  keyword: "c792ea",
  control: "f472b6",
  string: "a5e3a0",
  escape: "89ddff",
  number: "f9a26c",
  regexp: "fca5a5",
  type: "5eead4",
  function: "fde68a",
  variable: "e2e8f0",
  parameter: "fdba74",
  property: "93c5fd",
  constant: "f9a26c",
  operator: "89ddff",
  delimiter: "94a3b8",
  tag: "7dd3fc",
  attribute: "c4b5fd",
  annotation: "fbbf24",
  invalid: "f87171",
};

const LIGHT = {
  comment: "6b7280",
  keyword: "7c3aed",
  control: "be185d",
  string: "15803d",
  escape: "0e7490",
  number: "c2410c",
  regexp: "b91c1c",
  type: "0f766e",
  function: "a16207",
  variable: "0f172a",
  parameter: "c2410c",
  property: "1d4ed8",
  constant: "c2410c",
  operator: "0e7490",
  delimiter: "475569",
  tag: "1d4ed8",
  attribute: "7c3aed",
  annotation: "b45309",
  invalid: "dc2626",
};

function syntaxRules(c: typeof DARK): monaco.editor.ITokenThemeRule[] {
  return [
    { token: "", foreground: c.variable },
    { token: "comment", foreground: c.comment, fontStyle: "italic" },
    { token: "keyword", foreground: c.keyword },
    { token: "keyword.flow", foreground: c.control },
    { token: "keyword.control", foreground: c.control },
    { token: "storage", foreground: c.keyword },
    { token: "string", foreground: c.string },
    { token: "string.escape", foreground: c.escape },
    { token: "string.invalid", foreground: c.invalid },
    { token: "string.key.json", foreground: c.property },
    { token: "string.value.json", foreground: c.string },
    { token: "string.link", foreground: c.tag, fontStyle: "underline" },
    { token: "number", foreground: c.number },
    { token: "regexp", foreground: c.regexp },
    { token: "type", foreground: c.type },
    { token: "type.identifier", foreground: c.type },
    { token: "namespace", foreground: c.type },
    { token: "identifier", foreground: c.variable },
    { token: "variable", foreground: c.variable },
    { token: "variable.predefined", foreground: c.keyword },
    { token: "variable.parameter", foreground: c.parameter },
    { token: "constant", foreground: c.constant },
    { token: "predefined", foreground: c.function },
    { token: "operator", foreground: c.operator },
    { token: "operators", foreground: c.operator },
    { token: "delimiter", foreground: c.delimiter },
    { token: "delimiter.html", foreground: c.delimiter },
    { token: "delimiter.xml", foreground: c.delimiter },
    { token: "tag", foreground: c.tag },
    { token: "metatag", foreground: c.tag },
    { token: "metatag.content", foreground: c.string },
    { token: "attribute.name", foreground: c.attribute },
    { token: "attribute.value", foreground: c.string },
    { token: "attribute.value.number", foreground: c.number },
    { token: "attribute.value.unit", foreground: c.number },
    { token: "attribute.value.hex", foreground: c.number },
    { token: "annotation", foreground: c.annotation },
    { token: "key", foreground: c.property },
    { token: "invalid", foreground: c.invalid },
    { token: "emphasis", fontStyle: "italic" },
    { token: "strong", fontStyle: "bold" },
    { token: "keyword.md", foreground: c.tag, fontStyle: "bold" },
    // Semantic tokens (see semantic-highlighting.ts).
    { token: "function", foreground: c.function },
    { token: "method", foreground: c.function },
    { token: "class", foreground: c.type },
    { token: "parameter", foreground: c.parameter },
    { token: "property", foreground: c.property },
  ];
}

monaco.editor.defineTheme("codeforge-dark", {
  base: "vs-dark",
  inherit: true,
  rules: syntaxRules(DARK),
  colors: {
    "editor.background": "#0d1324",
    "editor.foreground": "#e2e8f0",
    "editorLineNumber.foreground": "#3a4864",
    "editorLineNumber.activeForeground": "#a5b4cf",
    "editor.lineHighlightBackground": "#ffffff09",
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
    "editorBracketHighlight.foreground1": "#fbbf24",
    "editorBracketHighlight.foreground2": "#c084fc",
    "editorBracketHighlight.foreground3": "#38bdf8",
    "editorGutter.background": "#0d1324",
    "editorError.foreground": "#f87171",
    "editorWarning.foreground": "#fbbf24",
    "editorInfo.foreground": "#60a5fa",
    "editorWidget.background": "#0f1729",
    "editorWidget.border": "#24304d",
    "editorSuggestWidget.background": "#0f1729",
    "editorSuggestWidget.border": "#24304d",
    "editorSuggestWidget.selectedBackground": "#1d2b4d",
    "editorSuggestWidget.highlightForeground": "#93c5fd",
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
  rules: syntaxRules(LIGHT),
  colors: {
    "editor.background": "#ffffff",
    "editor.foreground": "#0f172a",
    "editorLineNumber.foreground": "#a3aec2",
    "editorLineNumber.activeForeground": "#334155",
    "editor.lineHighlightBackground": "#0f172a08",
    "editorCursor.foreground": "#2563eb",
    "editor.selectionBackground": "#2563eb30",
    "editorBracketHighlight.foreground1": "#b45309",
    "editorBracketHighlight.foreground2": "#7c3aed",
    "editorBracketHighlight.foreground3": "#0369a1",
    focusBorder: "#2563eb",
  },
});

export { monaco };
