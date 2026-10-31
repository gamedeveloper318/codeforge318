import { monaco } from "./setup";

/**
 * Semantic highlighting on top of Monaco's own tokenizers. The tokenizers know
 * keywords, strings, numbers and comments; this adds what they don't tell
 * apart: function and method names (where they are defined and where they are
 * called), class and type names, parameters, properties and Python built-ins.
 * It works from Monaco's tokens, so text inside strings and comments is never
 * colored as code. Colors come from the theme rules in setup.ts.
 */
const TOKEN_TYPES = ["function", "method", "class", "type", "property", "parameter"] as const;
const TOKEN_MODIFIERS = ["declaration", "defaultLibrary"] as const;
type TokenType = (typeof TOKEN_TYPES)[number];
const DECLARATION = 1;
const DEFAULT_LIBRARY = 2;

export const SEMANTIC_LANGUAGES = [
  "javascript",
  "typescript",
  "python",
  "java",
  "c",
  "cpp",
  "csharp",
  "go",
  "rust",
  "php",
  "ruby",
  "kotlin",
  "swift",
  "dart",
  "scala",
  "lua",
  "r",
  "powershell",
  "perl",
  "julia",
  "elixir",
  "fsharp",
  "vb",
  "objective-c",
  "coffeescript",
  "html",
];

const FUNCTION_KEYWORDS = new Set(["def", "function", "fn", "func", "fun", "sub", "proc"]);
const CLASS_KEYWORDS = new Set(["class", "struct", "enum", "record", "object", "module", "new"]);
const TYPE_KEYWORDS = new Set(["interface", "type", "trait", "protocol", "typedef"]);
const MEMBER_ACCESS = new Set([".", "?.", "->", "::"]);
const PYTHON_BUILTINS = new Set(
  (
    "print input len range int str float list dict set tuple open sum min max abs sorted " +
    "enumerate zip map filter isinstance issubclass super round any all bool repr format " +
    "getattr setattr hasattr delattr iter next reversed chr ord id hash dir vars help exit " +
    "type object bytes bytearray callable divmod pow frozenset globals locals eval exec"
  ).split(" "),
);
const MAX_LENGTH = 400_000;

interface Sig {
  line: number;
  start: number;
  text: string;
  kind: "identifier" | "keyword" | "other";
}

function significantTokens(model: monaco.editor.ITextModel): Sig[] {
  const lines = model.getLinesContent();
  const tokenized = monaco.editor.tokenize(model.getValue(), model.getLanguageId());
  const result: Sig[] = [];
  tokenized.forEach((tokens, line) => {
    const text = lines[line] ?? "";
    tokens.forEach((token, i) => {
      const end = i + 1 < tokens.length ? tokens[i + 1].offset : text.length;
      const value = text.slice(token.offset, end);
      const type = token.type;
      if (!value.trim() || /^(comment|string|regexp?|number)\b/.test(type)) {
        // Strings and comments are boundaries: nothing before them is "called".
        if (value.trim()) result.push({ line, start: token.offset, text: "", kind: "other" });
        return;
      }
      const kind = /^(type\.)?identifier\b/.test(type)
        ? "identifier"
        : /^keyword\b/.test(type)
          ? "keyword"
          : "other";
      // Delimiter tokens can hold several characters ("()", ");"): split them.
      if (kind === "other") {
        const trimmedStart = value.length - value.trimStart().length;
        result.push({ line, start: token.offset + trimmedStart, text: value.trim(), kind });
      } else {
        result.push({ line, start: token.offset, text: value, kind });
      }
    });
  });
  return result;
}

const isWord = (text: string) => /^[A-Za-z_$][\w$]*$/.test(text);
const looksLikeType = (text: string) =>
  /^[A-Z][a-z0-9]+[A-Za-z0-9]*$/.test(text) || /^[A-Z][A-Za-z0-9]*[a-z][A-Za-z0-9]*$/.test(text);

/** Classifies identifiers into semantic token types. Exported for tests. */
export function classify(
  sig: Sig[],
  language: string,
): { index: number; type: TokenType; modifiers: number }[] {
  const out: { index: number; type: TokenType; modifiers: number }[] = [];
  const parameters = new Set<number>();
  for (let i = 0; i < sig.length; i++) {
    const token = sig[i];
    if (token.kind === "other" || !isWord(token.text)) continue;
    const prev = sig[i - 1];
    const next = sig[i + 1];
    const prevText = prev?.text ?? "";
    const calls = next?.text.startsWith("(") ?? false;

    if (parameters.has(i)) {
      out.push({ index: i, type: "parameter", modifiers: DECLARATION });
      continue;
    }
    if (token.kind === "keyword") {
      // Python's tokenizer calls dunder names (__init__, __str__) keywords.
      if (
        prev?.kind === "keyword" &&
        FUNCTION_KEYWORDS.has(prevText) &&
        /^__\w+__$/.test(token.text)
      ) {
        out.push({ index: i, type: "function", modifiers: DECLARATION });
        if (calls) markParameters(sig, i + 1, parameters);
      } else if (
        language === "python" &&
        PYTHON_BUILTINS.has(token.text) &&
        calls &&
        prevText !== "."
      )
        out.push({ index: i, type: "function", modifiers: DEFAULT_LIBRARY });
      continue;
    }
    if (prev?.kind === "keyword" && FUNCTION_KEYWORDS.has(prevText)) {
      out.push({ index: i, type: "function", modifiers: DECLARATION });
      if (calls) markParameters(sig, i + 1, parameters);
      continue;
    }
    if (prev?.kind === "keyword" && CLASS_KEYWORDS.has(prevText)) {
      out.push({ index: i, type: "class", modifiers: prevText === "new" ? 0 : DECLARATION });
      continue;
    }
    if (prev?.kind === "keyword" && TYPE_KEYWORDS.has(prevText)) {
      out.push({ index: i, type: "type", modifiers: DECLARATION });
      continue;
    }
    if (calls) {
      if (MEMBER_ACCESS.has(prevText)) out.push({ index: i, type: "method", modifiers: 0 });
      else if (looksLikeType(token.text)) out.push({ index: i, type: "class", modifiers: 0 });
      else out.push({ index: i, type: "function", modifiers: 0 });
      continue;
    }
    if (MEMBER_ACCESS.has(prevText)) {
      out.push({ index: i, type: "property", modifiers: 0 });
      continue;
    }
    if (looksLikeType(token.text)) out.push({ index: i, type: "type", modifiers: 0 });
  }
  return out;
}

/** Marks the names in a parameter list "( a, b: int = 1, *args )" starting at `open`. */
function markParameters(sig: Sig[], open: number, parameters: Set<number>): void {
  let depth = 0;
  for (let j = open; j < sig.length && j < open + 400; j++) {
    const text = sig[j].text;
    for (const c of text) {
      if (c === "(" || c === "[" || c === "{") depth++;
      if (c === ")" || c === "]" || c === "}") depth--;
    }
    if (depth <= 0 && j > open) return;
    if (depth !== 1 || sig[j].kind !== "identifier") continue;
    const before = sig[j - 1]?.text ?? "";
    const after = sig[j + 1]?.text ?? "";
    const startsItem =
      /[(,]$/.test(before) || before === "*" || before === "**" || before === "...";
    const endsName = /^[,):=?]/.test(after) || after === "";
    if (startsItem && endsName) parameters.add(j);
  }
}

/** Languages whose tokenizers appear inside another language's files. */
const EMBEDDED: Record<string, string[]> = {
  html: ["javascript", "css"],
  php: ["html", "javascript", "css"],
};
const tokenizersReady = new Map<string, Promise<unknown>>();

/**
 * Monaco loads each language's tokenizer the first time it is needed. Until
 * then `monaco.editor.tokenize` returns untyped tokens, so the first request
 * after opening a file would find nothing; `colorize` resolves once loaded.
 */
function tokenizerReady(language: string): Promise<unknown> {
  let ready = tokenizersReady.get(language);
  if (!ready) {
    ready = Promise.all(
      [language, ...(EMBEDDED[language] ?? [])].map((id) =>
        monaco.editor.colorize("", id, {}).catch(() => undefined),
      ),
    );
    tokenizersReady.set(language, ready);
  }
  return ready;
}

class Provider implements monaco.languages.DocumentSemanticTokensProvider {
  getLegend(): monaco.languages.SemanticTokensLegend {
    return { tokenTypes: [...TOKEN_TYPES], tokenModifiers: [...TOKEN_MODIFIERS] };
  }

  async provideDocumentSemanticTokens(
    model: monaco.editor.ITextModel,
    _lastResultId: string | null,
    cancel: monaco.CancellationToken,
  ): Promise<monaco.languages.SemanticTokens | null> {
    if (model.getValueLength() > MAX_LENGTH) return { data: new Uint32Array(0) };
    await tokenizerReady(model.getLanguageId());
    if (cancel.isCancellationRequested || model.isDisposed()) return null;
    const sig = significantTokens(model);
    const data: number[] = [];
    let lastLine = 0;
    let lastStart = 0;
    for (const { index, type, modifiers } of classify(sig, model.getLanguageId())) {
      const { line, start, text } = sig[index];
      const deltaLine = line - lastLine;
      data.push(
        deltaLine,
        deltaLine === 0 ? start - lastStart : start,
        text.length,
        TOKEN_TYPES.indexOf(type),
        modifiers,
      );
      lastLine = line;
      lastStart = start;
    }
    return { data: new Uint32Array(data) };
  }

  releaseDocumentSemanticTokens(): void {}
}

export function registerSemanticHighlighting(): void {
  const provider = new Provider();
  for (const language of SEMANTIC_LANGUAGES) {
    monaco.languages.registerDocumentSemanticTokensProvider(language, provider);
  }
}
