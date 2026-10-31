import { positionAt, scanHtml, type HtmlTag } from "./html-scan";

/**
 * Checks that HTML tags are opened and closed in order. Knows the rules that
 * make valid HTML look unbalanced, so it doesn't complain about them: void
 * elements (<br>, <img>, <input>, ...) never close, and some elements may
 * leave out their end tag (<p>, <li>, <td>, <option>, <html>, <body>, ...).
 */
export interface HtmlProblem {
  line: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
  message: string;
  severity: "error" | "warning";
}

const VOID = new Set([
  "!doctype",
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr",
]);

/** End tags HTML lets you omit (the parser closes these elements itself). */
const OPTIONAL_END = new Set([
  "html",
  "head",
  "body",
  "p",
  "li",
  "dt",
  "dd",
  "option",
  "optgroup",
  "tr",
  "td",
  "th",
  "thead",
  "tbody",
  "tfoot",
  "colgroup",
  "caption",
  "rt",
  "rp",
]);

function problemAt(
  text: string,
  tag: HtmlTag,
  message: string,
  severity: HtmlProblem["severity"],
): HtmlProblem {
  const start = positionAt(text, tag.start);
  const end = positionAt(text, tag.end);
  return {
    line: start.line,
    startColumn: start.column,
    endLine: end.line,
    endColumn: end.column,
    message,
    severity,
  };
}

export function findHtmlStructureProblems(text: string): HtmlProblem[] {
  if (text.length > 2_000_000) return [];
  const { tags } = scanHtml(text);
  const problems: HtmlProblem[] = [];
  const open: HtmlTag[] = [];
  for (const tag of tags) {
    if (!tag.closing) {
      if (!tag.selfClosing && !VOID.has(tag.name)) open.push(tag);
      continue;
    }
    if (VOID.has(tag.name)) {
      problems.push(
        problemAt(
          text,
          tag,
          `</${tag.name}> is not needed: <${tag.name}> is an empty element that never has a closing tag.`,
          "warning",
        ),
      );
      continue;
    }
    const index = open.map((t) => t.name).lastIndexOf(tag.name);
    if (index === -1) {
      problems.push(
        problemAt(
          text,
          tag,
          `Closing tag </${tag.name}> has no matching opening <${tag.name}> tag.`,
          "error",
        ),
      );
      continue;
    }
    // Elements opened after the matching tag are closed implicitly; report those that can't be.
    for (const inner of open.splice(index).slice(1)) {
      if (OPTIONAL_END.has(inner.name)) continue;
      problems.push(
        problemAt(
          text,
          inner,
          `<${inner.name}> is not closed: add </${inner.name}> before </${tag.name}>.`,
          "warning",
        ),
      );
    }
  }
  for (const tag of open) {
    if (OPTIONAL_END.has(tag.name)) continue;
    problems.push(
      problemAt(text, tag, `<${tag.name}> is never closed: add </${tag.name}>.`, "warning"),
    );
  }
  return problems.sort((a, b) => a.line - b.line || a.startColumn - b.startColumn);
}
