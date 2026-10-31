/**
 * A small, forgiving HTML scanner shared by CodeForge's own HTML checks. It
 * understands just enough HTML to tell page text apart from markup: tags (with
 * quoted attribute values), comments, and elements whose content is not page
 * text (script, style, pre, code, textarea, template, ...).
 */

export interface HtmlTag {
  /** Lower-case tag name, e.g. "div". */
  name: string;
  closing: boolean;
  /** Written as <br/> or <path ... />. */
  selfClosing: boolean;
  /** Offsets of "<" and just after ">" in the text. */
  start: number;
  end: number;
}

/** Elements whose content is code or preformatted text, never checked as page text. */
const OPAQUE_CONTENT = new Set([
  "script",
  "style",
  "pre",
  "code",
  "kbd",
  "samp",
  "textarea",
  "template",
  "svg",
  "math",
  "noscript",
  "xmp",
]);

/** Elements whose content is raw text: tags inside them are not tags. */
const RAW_TEXT = new Set(["script", "style", "textarea", "xmp"]);

export interface HtmlScan {
  tags: HtmlTag[];
  /**
   * The text with everything that is not page text (tags, comments, code
   * blocks, template expressions) replaced by spaces. Line breaks are kept, so
   * offsets, lines and columns match the original text.
   */
  pageText: string;
}

function blank(chars: string[], from: number, to: number): void {
  for (let i = from; i < to && i < chars.length; i++) {
    if (chars[i] !== "\n" && chars[i] !== "\r") chars[i] = " ";
  }
}

/** Finds the end of a tag starting at `start` ("<"), honouring quoted attribute values. */
function tagEnd(text: string, start: number): number {
  let quote: string | null = null;
  for (let i = start + 1; i < text.length; i++) {
    const c = text[i];
    if (quote) {
      if (c === quote) quote = null;
    } else if (c === '"' || c === "'") {
      quote = c;
    } else if (c === ">") {
      return i + 1;
    }
  }
  return text.length;
}

export function scanHtml(text: string): HtmlScan {
  // One element per UTF-16 code unit, so offsets match the string's.
  const aligned = text.split("");
  const tags: HtmlTag[] = [];
  let opaqueUntil: string | null = null;
  let opaqueStart = 0;
  let i = 0;
  while (i < text.length) {
    if (text.startsWith("<!--", i)) {
      const close = text.indexOf("-->", i + 4);
      const end = close === -1 ? text.length : close + 3;
      blank(aligned, i, end);
      i = end;
      continue;
    }
    // Template syntax used by many HTML files: {{ value }}, {% tag %}, {# comment #}, <?php ?>.
    const template = /^(\{\{|\{%|\{#|<\?|<%)/.exec(text.slice(i, i + 2));
    if (template) {
      const closer = { "{{": "}}", "{%": "%}", "{#": "#}", "<?": "?>", "<%": "%>" }[template[1]]!;
      const close = text.indexOf(closer, i + 2);
      const end = close === -1 ? text.length : close + closer.length;
      blank(aligned, i, end);
      i = end;
      continue;
    }
    if (text[i] === "<" && /[A-Za-z/!]/.test(text[i + 1] ?? "")) {
      const end = tagEnd(text, i);
      const raw = text.slice(i, end);
      const match = /^<\s*(\/)?\s*([A-Za-z][\w:-]*|!doctype)/i.exec(raw);
      if (match) {
        const tag: HtmlTag = {
          name: match[2].toLowerCase(),
          closing: Boolean(match[1]),
          selfClosing: /\/\s*>$/.test(raw),
          start: i,
          end,
        };
        if (opaqueUntil) {
          // Inside script/style/... only the matching closing tag counts.
          if (tag.closing && tag.name === opaqueUntil) {
            blank(aligned, opaqueStart, end);
            tags.push(tag);
            opaqueUntil = null;
          } else if (!RAW_TEXT.has(opaqueUntil)) {
            tags.push(tag);
          }
          i = end;
          continue;
        }
        tags.push(tag);
        blank(aligned, i, end);
        if (!tag.closing && !tag.selfClosing && OPAQUE_CONTENT.has(tag.name)) {
          opaqueUntil = tag.name;
          opaqueStart = end;
        }
      } else {
        blank(aligned, i, end);
      }
      i = end;
      continue;
    }
    i++;
  }
  if (opaqueUntil) blank(aligned, opaqueStart, text.length);
  return { tags, pageText: aligned.join("") };
}

/** 1-based line and column of an offset. */
export function positionAt(text: string, offset: number): { line: number; column: number } {
  let line = 1;
  let lineStart = 0;
  for (let i = 0; i < offset && i < text.length; i++) {
    if (text[i] === "\n") {
      line++;
      lineStart = i + 1;
    }
  }
  return { line, column: offset - lineStart + 1 };
}
