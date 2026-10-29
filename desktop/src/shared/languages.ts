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

/** A command that runs a single file of this language, if one is known. */
export function runCommandForPath(filePath: string): { program: string; label: string } | null {
  const lang = languageForPath(filePath);
  const name = basename(filePath).toLowerCase();
  if (lang === "javascript") return { program: "node", label: "Node.js" };
  if (lang === "typescript" && !name.endsWith(".d.ts"))
    return { program: "npx tsx", label: "tsx (via npx)" };
  if (lang === "python") return { program: "python", label: "Python" };
  if (lang === "powershell")
    return { program: "powershell -ExecutionPolicy Bypass -File", label: "PowerShell" };
  if (lang === "shell") return { program: "bash", label: "Bash" };
  if (lang === "ruby") return { program: "ruby", label: "Ruby" };
  if (lang === "php") return { program: "php", label: "PHP" };
  if (lang === "go") return { program: "go run", label: "Go" };
  if (lang === "lua") return { program: "lua", label: "Lua" };
  if (lang === "dart") return { program: "dart run", label: "Dart" };
  return null;
}
