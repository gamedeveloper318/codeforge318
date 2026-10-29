import {
  Braces,
  Database,
  File,
  FileCode,
  FileImage,
  FileJson,
  FileTerminal,
  FileText,
  Folder,
  FolderOpen,
  Hash,
  Lock,
  Package,
  Settings,
} from "lucide-react";

const COLORS: Record<string, string> = {
  ts: "#3b82f6",
  tsx: "#38bdf8",
  mts: "#3b82f6",
  cts: "#3b82f6",
  js: "#facc15",
  jsx: "#38bdf8",
  mjs: "#facc15",
  cjs: "#facc15",
  json: "#f59e0b",
  md: "#94a3b8",
  mdx: "#94a3b8",
  html: "#f97316",
  htm: "#f97316",
  css: "#60a5fa",
  scss: "#f472b6",
  less: "#818cf8",
  py: "#38bdf8",
  java: "#f97316",
  c: "#60a5fa",
  cpp: "#818cf8",
  h: "#a78bfa",
  cs: "#a78bfa",
  go: "#22d3ee",
  rs: "#fb923c",
  rb: "#f87171",
  php: "#a78bfa",
  swift: "#fb923c",
  kt: "#c084fc",
  dart: "#22d3ee",
  vue: "#4ade80",
  svelte: "#fb923c",
  sql: "#f472b6",
  sh: "#4ade80",
  ps1: "#60a5fa",
  bat: "#4ade80",
  yml: "#f87171",
  yaml: "#f87171",
  xml: "#fb923c",
  svg: "#fbbf24",
  toml: "#94a3b8",
};

const IMAGE = new Set(["png", "jpg", "jpeg", "gif", "webp", "ico", "bmp", "avif"]);
const CODE = new Set(
  Object.keys(COLORS).filter((ext) => !["json", "md", "mdx", "yml", "yaml", "toml"].includes(ext)),
);

export function FileIcon({ name, size = 15 }: { name: string; size?: number }) {
  const lower = name.toLowerCase();
  const ext = lower.includes(".") ? lower.slice(lower.lastIndexOf(".") + 1) : "";
  const color = COLORS[ext] ?? "var(--text-muted)";
  const props = { size, color, strokeWidth: 1.8, style: { flex: "none" } } as const;

  if (lower === "package.json") return <Package {...props} color="#4ade80" />;
  if (lower.endsWith(".lock") || lower === "package-lock.json")
    return <Lock {...props} color="var(--text-subtle)" />;
  if (lower.startsWith(".env")) return <Settings {...props} color="#fbbf24" />;
  if (
    lower.startsWith(".git") ||
    lower.startsWith(".prettier") ||
    lower.startsWith(".eslint") ||
    lower === ".editorconfig"
  )
    return <Settings {...props} color="var(--text-muted)" />;
  if (ext === "json") return <FileJson {...props} />;
  if (ext === "md" || ext === "mdx" || ext === "txt") return <FileText {...props} />;
  if (IMAGE.has(ext)) return <FileImage {...props} color="#34d399" />;
  if (ext === "sql" || ext === "db" || ext === "sqlite") return <Database {...props} />;
  if (["sh", "ps1", "bat", "cmd", "bash", "zsh"].includes(ext)) return <FileTerminal {...props} />;
  if (ext === "css" || ext === "scss" || ext === "less") return <Hash {...props} />;
  if (ext === "yml" || ext === "yaml" || ext === "toml") return <Braces {...props} />;
  if (CODE.has(ext)) return <FileCode {...props} />;
  return <File {...props} />;
}

export function FolderIcon({ open, size = 15 }: { open: boolean; size?: number }) {
  const props = { size, color: "#60a5fa", strokeWidth: 1.8, style: { flex: "none" } } as const;
  return open ? <FolderOpen {...props} /> : <Folder {...props} />;
}
