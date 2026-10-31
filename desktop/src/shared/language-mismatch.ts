import { scanHtml } from "./html-scan";

/**
 * Finds lines written in a different language than the file's, such as Python
 * `print(Talha)` in an .html file, where the browser would just show it as
 * text. Rules only match whole lines that are unmistakably code, so normal
 * sentences ("if you have questions:") are not reported, and HTML is only
 * checked outside <script>, <style>, <pre>, <code>, comments and tags.
 */
export interface LanguageProblem {
  line: number;
  startColumn: number;
  endColumn: number;
  message: string;
  severity: "error" | "warning";
}

type Language = "Python" | "JavaScript" | "CSS" | "HTML";

interface Rule {
  language: Language;
  pattern: RegExp;
  /**
   * Weak rules also match ordinary words ("import data", "else:"), so in HTML
   * they only count when the page has other code in the same language.
   */
  weak?: boolean;
}

const IDENT = "[A-Za-z_][A-Za-z0-9_]*";
// A Python expression without spaces between words: x, user.name, items[0], len(x), "text".
const EXPR = `(?:[\\w.\\[\\]()'"]+|"[^"]*"|'[^']*')`;
const OPERATOR = `(?:==|!=|<=|>=|<|>|\\+|-|\\*|/|%|\\bin\\b|\\bnot in\\b|\\bis\\b|\\band\\b|\\bor\\b)`;
const CONDITION = `(?:not\\s+)?${EXPR}(?:\\s*${OPERATOR}\\s*${EXPR})*`;

const PYTHON_RULES: Rule[] = [
  { language: "Python", pattern: /^print\s*\(.*\)\s*;?$/ },
  { language: "Python", pattern: /^input\s*\(.*\)$/ },
  { language: "Python", pattern: new RegExp(`^def\\s+${IDENT}\\s*\\(.*\\)\\s*(->\\s*[^:]+)?:$`) },
  { language: "Python", pattern: new RegExp(`^class\\s+${IDENT}\\s*(\\(.*\\))?\\s*:$`) },
  {
    language: "Python",
    pattern: new RegExp(
      `^${IDENT}\\s*=\\s*(input|int|float|str|len|range|list|dict|set|open)\\s*\\(.*\\)$`,
    ),
  },
  { language: "Python", weak: true, pattern: new RegExp(`^(if|elif|while)\\s+${CONDITION}\\s*:$`) },
  {
    language: "Python",
    weak: true,
    pattern: new RegExp(`^for\\s+${IDENT}(\\s*,\\s*${IDENT})*\\s+in\\s+${EXPR}\\s*:$`),
  },
  { language: "Python", weak: true, pattern: /^(else|try|finally)\s*:$/ },
  {
    language: "Python",
    weak: true,
    pattern: new RegExp(`^except(\\s+${IDENT}(\\s+as\\s+${IDENT})?)?\\s*:$`),
  },
  {
    language: "Python",
    weak: true,
    pattern: new RegExp(
      `^import\\s+${IDENT}(\\.${IDENT})*(\\s+as\\s+${IDENT})?(\\s*,\\s*${IDENT}(\\.${IDENT})*)*$`,
    ),
  },
  {
    language: "Python",
    weak: true,
    pattern: new RegExp(`^from\\s+[\\w.]+\\s+import\\s+(\\*|${IDENT})`),
  },
];

const JAVASCRIPT_RULES: Rule[] = [
  { language: "JavaScript", pattern: /^console\.(log|error|warn|info|debug|table)\s*\(.*\)\s*;?$/ },
  { language: "JavaScript", pattern: /^(const|let|var)\s+[A-Za-z_$][\w$]*\s*=\s*.+$/ },
  {
    language: "JavaScript",
    pattern: /^(async\s+)?function\s*\*?\s*[A-Za-z_$][\w$]*\s*\(.*\)\s*\{?$/,
  },
  { language: "JavaScript", pattern: /^(document|window)\.[\w$]+.*[;)]$/ },
  { language: "JavaScript", pattern: /^alert\s*\(.*\)\s*;?$/ },
];

const CSS_RULES: Rule[] = [
  {
    language: "CSS",
    pattern: /^(@media\b.*|(\*|[.#]?[A-Za-z][\w-]*)(\s*[,>+~]?\s*[.#:]?[A-Za-z][\w-]*)*)\s*\{$/,
  },
];

const HTML_IN_PYTHON: Rule[] = [
  {
    language: "HTML",
    pattern:
      /^<(!doctype\s+html|html|head|body|div|span|p|h[1-6]|ul|ol|li|a|img|button|form|table)(\s[^<>]*)?\/?>/i,
  },
];

// Only lines that are never valid JavaScript/TypeScript and can't be JSX text
// either (JSX text such as "if you want:" or "import data" is left alone).
const PYTHON_MODULES =
  "os|sys|re|json|math|random|time|datetime|csv|pathlib|subprocess|collections|itertools|typing|numpy|pandas|requests|flask|django|tkinter|turtle|pygame|matplotlib";
const PYTHON_IN_SCRIPT: Rule[] = [
  { language: "Python", pattern: new RegExp(`^def\\s+${IDENT}\\s*\\(.*\\)\\s*(->\\s*[^:]+)?:$`) },
  { language: "Python", pattern: new RegExp(`^elif\\s+${CONDITION}\\s*:$`) },
  {
    language: "Python",
    pattern: new RegExp(`^import\\s+(${PYTHON_MODULES})(\\.${IDENT})*(\\s+as\\s+${IDENT})?$`),
  },
  { language: "Python", pattern: new RegExp(`^from\\s+[\\w.]+\\s+import\\s+(\\*|${IDENT})`) },
  { language: "Python", pattern: /^print\s+["'].*["']$/ },
];

const JAVASCRIPT_IN_PYTHON: Rule[] = [
  { language: "JavaScript", pattern: /^console\.(log|error|warn|info)\s*\(/ },
  { language: "JavaScript", pattern: /^(const|let|var)\s+[A-Za-z_$][\w$]*\s*=/ },
  { language: "JavaScript", pattern: /^function\s+[A-Za-z_$][\w$]*\s*\(.*\)\s*\{?$/ },
];

function htmlMessage(language: Language): string {
  switch (language) {
    case "Python":
      return "This line looks like Python code, but this is an HTML file: browsers don't run Python, so it is shown as plain text on the page. Move it to a .py file, or put it inside <pre><code>…</code></pre> if it is an example to show.";
    case "JavaScript":
      return "This line looks like JavaScript, but it is outside a <script> tag, so the browser shows it as plain text instead of running it. Put it inside <script>…</script>.";
    case "CSS":
      return "This line looks like a CSS rule, but it is outside a <style> tag, so the browser shows it as plain text. Put it inside <style>…</style> or a .css file.";
    default:
      return "This line looks like code from another language.";
  }
}

interface Match {
  line: number;
  startColumn: number;
  endColumn: number;
  rule: Rule;
}

function matchLines(text: string, rules: Rule[]): Match[] {
  const matches: Match[] = [];
  const lines = text.split("\n");
  for (let index = 0; index < lines.length; index++) {
    const raw = lines[index].replace(/\r$/, "");
    const trimmed = raw.trim();
    if (trimmed.length < 3 || trimmed.length > 400) continue;
    const rule = rules.find((r) => r.pattern.test(trimmed));
    if (!rule) continue;
    const start = raw.indexOf(trimmed);
    matches.push({
      line: index + 1,
      startColumn: start + 1,
      endColumn: start + trimmed.length + 1,
      rule,
    });
  }
  return matches;
}

function toProblems(matches: Match[], message: (language: Language) => string): LanguageProblem[] {
  return matches.map(({ line, startColumn, endColumn, rule }) => ({
    line,
    startColumn,
    endColumn,
    message: message(rule.language),
    severity: "warning",
  }));
}

/** Blanks out Python strings ('''…''' / """…""") and comments, keeping line breaks. */
function pythonCodeOnly(text: string): string {
  return text
    .replace(/("""|''')[\s\S]*?(\1|$)/g, (block) => block.replace(/[^\n]/g, " "))
    .replace(/^\s*#.*$/gm, (line) => " ".repeat(line.length));
}

/** Blanks out JavaScript/TypeScript comments and template strings, keeping line breaks. */
function scriptCodeOnly(text: string): string {
  return text
    .replace(/\/\*[\s\S]*?(\*\/|$)/g, (block) => block.replace(/[^\n]/g, " "))
    .replace(/`(?:\\[\s\S]|[^`\\])*(`|$)/g, (block) => block.replace(/[^\n]/g, " "))
    .replace(/^\s*\/\/.*$/gm, (line) => " ".repeat(line.length));
}

/** Lines of `text` that look like a different language than `languageId`. */
export function findLanguageMismatches(text: string, languageId: string): LanguageProblem[] {
  if (text.length > 2_000_000) return [];
  switch (languageId) {
    case "html": {
      const { pageText } = scanHtml(text);
      const matches = matchLines(pageText, [...PYTHON_RULES, ...JAVASCRIPT_RULES, ...CSS_RULES]);
      // A weak match ("import data") counts only next to other code of that language.
      const support = (language: Language) =>
        matches.filter((m) => m.rule.language === language).length;
      const kept = matches.filter(
        (m) =>
          !m.rule.weak ||
          matches.some((other) => other.rule.language === m.rule.language && !other.rule.weak) ||
          support(m.rule.language) >= 3,
      );
      return toProblems(kept, htmlMessage);
    }
    case "python":
      return toProblems(
        matchLines(pythonCodeOnly(text), [...JAVASCRIPT_IN_PYTHON, ...HTML_IN_PYTHON]),
        (language) =>
          language === "HTML"
            ? "This line looks like HTML, but this is a Python file. HTML belongs in an .html file (or inside a Python string)."
            : "This line looks like JavaScript, but this is a Python file. Python uses print() instead of console.log(), plain names instead of const/let/var, and def instead of function.",
      );
    case "javascript":
    case "typescript": {
      const name = languageId === "typescript" ? "TypeScript" : "JavaScript";
      return toProblems(
        matchLines(scriptCodeOnly(text), PYTHON_IN_SCRIPT),
        () =>
          `This line looks like Python, but this is a ${name} file. ${name} uses function instead of def, parentheses and { } instead of a colon, else if instead of elif, and import … from "…".`,
      );
    }
    default:
      return [];
  }
}
