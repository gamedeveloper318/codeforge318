/**
 * Maps file names to Monaco language ids. Monaco ships syntax highlighting for
 * all of these; richer intelligence (completion, diagnostics, formatting) is
 * only available for the languages listed in LANGUAGE_INTELLIGENCE.
 */
const BY_EXTENSION: Record<string, string> = {
  ts: "typescript",
  mts: "typescript",
  cts: "typescript",
  tsx: "typescript",
  js: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  jsx: "javascript",
  json: "json",
  jsonc: "json",
  json5: "json",
  webmanifest: "json",
  md: "markdown",
  markdown: "markdown",
  mdx: "mdx",
  html: "html",
  htm: "html",
  vue: "html",
  svelte: "html",
  css: "css",
  scss: "scss",
  less: "less",
  py: "python",
  pyw: "python",
  pyi: "python",
  java: "java",
  c: "c",
  h: "c",
  cpp: "cpp",
  cc: "cpp",
  cxx: "cpp",
  hpp: "cpp",
  hh: "cpp",
  hxx: "cpp",
  cs: "csharp",
  csx: "csharp",
  go: "go",
  rs: "rust",
  rb: "ruby",
  php: "php",
  swift: "swift",
  kt: "kotlin",
  kts: "kotlin",
  dart: "dart",
  lua: "lua",
  r: "r",
  sql: "sql",
  sh: "shell",
  bash: "shell",
  zsh: "shell",
  ps1: "powershell",
  psm1: "powershell",
  psd1: "powershell",
  bat: "bat",
  cmd: "bat",
  yml: "yaml",
  yaml: "yaml",
  xml: "xml",
  svg: "xml",
  xaml: "xml",
  csproj: "xml",
  plist: "xml",
  toml: "ini",
  ini: "ini",
  cfg: "ini",
  conf: "ini",
  properties: "ini",
  env: "ini",
  graphql: "graphql",
  gql: "graphql",
  scala: "scala",
  clj: "clojure",
  cljs: "clojure",
  ex: "elixir",
  exs: "elixir",
  fs: "fsharp",
  fsx: "fsharp",
  pl: "perl",
  pm: "perl",
  jl: "julia",
  sol: "solidity",
  proto: "protobuf",
  tf: "hcl",
  hcl: "hcl",
  pug: "pug",
  hbs: "handlebars",
  twig: "twig",
  vb: "vb",
  m: "objective-c",
  pas: "pascal",
  tcl: "tcl",
  coffee: "coffeescript",
  rst: "restructuredtext",
  wgsl: "wgsl",
  txt: "plaintext",
  log: "plaintext",
};

const BY_FILENAME: Record<string, string> = {
  dockerfile: "dockerfile",
  containerfile: "dockerfile",
  ".bashrc": "shell",
  ".zshrc": "shell",
  ".profile": "shell",
  ".gitignore": "ini",
  ".gitattributes": "ini",
  ".npmrc": "ini",
  ".editorconfig": "ini",
  ".env": "ini",
  ".prettierrc": "json",
  ".eslintrc": "json",
  "tsconfig.json": "json",
  "jsconfig.json": "json",
};

export function basename(filePath: string): string {
  const parts = filePath.split(/[\\/]/);
  return parts[parts.length - 1] ?? filePath;
}

export function languageForPath(filePath: string): string {
  const name = basename(filePath).toLowerCase();
  if (BY_FILENAME[name]) return BY_FILENAME[name];
  if (name.startsWith(".env")) return "ini";
  if (name.startsWith("dockerfile")) return "dockerfile";
  const dot = name.lastIndexOf(".");
  if (dot <= 0 && !name.startsWith(".")) return "plaintext";
  const ext = name.slice(dot + 1);
  return BY_EXTENSION[ext] ?? "plaintext";
}

/** Languages with built-in intelligence beyond syntax highlighting. */
export const LANGUAGE_INTELLIGENCE: Record<string, string> = {
  typescript: "Completion, diagnostics, hover, go to definition (open files), formatting",
  javascript: "Completion, diagnostics, hover, go to definition (open files), formatting",
  json: "Validation, completion, formatting",
  css: "Validation, completion, hover, formatting",
  scss: "Validation, completion, hover, formatting",
  less: "Validation, completion, hover, formatting",
  html: "Completion, tag matching, formatting",
};

/**
 * Guesses the language of a file without a known extension from its first
 * line (shebang, doctype, <?php, <?xml).
 */
export function detectLanguageFromContent(content: string): string | null {
  const first = content.slice(0, 300).trimStart().split(/\r?\n/, 1)[0] ?? "";
  if (first.startsWith("#!")) {
    if (/\bpython[0-9.]*\b/.test(first)) return "python";
    if (/\b(node|deno|bun)\b/.test(first)) return "javascript";
    if (/\b(bash|sh|zsh|dash|ksh)\b/.test(first)) return "shell";
    if (/\bruby\b/.test(first)) return "ruby";
    if (/\bperl\b/.test(first)) return "perl";
    if (/\bphp\b/.test(first)) return "php";
    if (/\bpwsh\b/.test(first)) return "powershell";
  }
  if (/^<!doctype html/i.test(first) || /^<html[\s>]/i.test(first)) return "html";
  if (/^<\?php/.test(first)) return "php";
  if (/^<\?xml/.test(first)) return "xml";
  return null;
}

/** The language for a file: from its name, else (unknown extension) from its content. */
export function languageForFile(filePath: string, content: string): string {
  const byName = languageForPath(filePath);
  return byName === "plaintext" ? (detectLanguageFromContent(content) ?? byName) : byName;
}
