import { z } from "zod";

/**
 * User settings. Keys are flat and dotted (like `editor.fontSize`) so they map
 * one-to-one onto the settings UI and the settings.json file on disk.
 * Every field uses `.catch(default)`: a missing or invalid value in the file
 * falls back to its default instead of failing the whole file.
 */
export const DEFAULT_SEARCH_EXCLUDE = [
  "node_modules",
  "dist",
  "out",
  "build",
  ".next",
  "coverage",
  "release",
  ".venv",
  "venv",
  "__pycache__",
  "*.min.js",
];

export const DEFAULT_FILES_EXCLUDE = [".git", ".DS_Store", "Thumbs.db"];

const stringList = (fallback: string[]) =>
  z.array(z.string().min(1).max(200)).max(200).catch(fallback);

export const settingsSchema = z.object({
  "workbench.colorTheme": z.enum(["codeforge-dark", "codeforge-light"]).catch("codeforge-dark"),
  "workbench.restoreWorkspace": z.boolean().catch(true),
  "editor.fontSize": z.number().int().min(8).max(40).catch(14),
  "editor.fontFamily": z
    .string()
    .min(1)
    .max(300)
    .catch("'Cascadia Code', 'JetBrains Mono', Consolas, 'Courier New', monospace"),
  "editor.fontLigatures": z.boolean().catch(false),
  "editor.tabSize": z.number().int().min(1).max(8).catch(2),
  "editor.insertSpaces": z.boolean().catch(true),
  "editor.wordWrap": z.enum(["off", "on"]).catch("off"),
  "editor.minimap": z.boolean().catch(true),
  "editor.lineNumbers": z.enum(["on", "off", "relative"]).catch("on"),
  "editor.renderWhitespace": z.enum(["none", "boundary", "selection", "all"]).catch("selection"),
  "editor.cursorBlinking": z.enum(["blink", "smooth", "phase", "expand", "solid"]).catch("smooth"),
  "editor.smoothScrolling": z.boolean().catch(true),
  "editor.bracketPairColorization": z.boolean().catch(true),
  "editor.stickyScroll": z.boolean().catch(true),
  "editor.formatOnSave": z.boolean().catch(false),
  "files.autoSave": z.enum(["off", "afterDelay"]).catch("off"),
  "files.autoSaveDelay": z.number().int().min(100).max(60000).catch(1000),
  "files.exclude": stringList(DEFAULT_FILES_EXCLUDE),
  "search.exclude": stringList(DEFAULT_SEARCH_EXCLUDE),
  "terminal.shell": z.string().max(500).catch(""),
  "terminal.fontSize": z.number().int().min(8).max(32).catch(13),
  "terminal.cursorBlink": z.boolean().catch(true),
  "python.languageServer": z.boolean().catch(true),
  "update.checkOnStartup": z.boolean().catch(true),
});

export type Settings = z.infer<typeof settingsSchema>;
export type SettingKey = keyof Settings;

export const DEFAULT_SETTINGS: Settings = settingsSchema.parse({});

/** Parses untrusted settings data (for example a hand-edited settings.json). */
export function parseSettings(input: unknown): Settings {
  const source = input && typeof input === "object" && !Array.isArray(input) ? input : {};
  return settingsSchema.parse(source);
}

/** Applies a partial update and re-validates every key. */
export function mergeSettings(
  current: Settings,
  patch: Partial<Record<string, unknown>>,
): Settings {
  return parseSettings({ ...current, ...patch });
}

type SettingControl =
  | { type: "boolean" }
  | { type: "number"; min: number; max: number }
  | { type: "string"; placeholder?: string }
  | { type: "enum"; options: { value: string; label: string }[] }
  | { type: "list" };

export interface SettingDescriptor {
  key: SettingKey;
  category: "Appearance" | "Editor" | "Files" | "Search" | "Terminal" | "Python" | "Updates";
  label: string;
  description: string;
  control: SettingControl;
}

export const SETTING_DESCRIPTORS: SettingDescriptor[] = [
  {
    key: "workbench.colorTheme",
    category: "Appearance",
    label: "Color theme",
    description: "The color theme used by the whole workbench and the editor.",
    control: {
      type: "enum",
      options: [
        { value: "codeforge-dark", label: "CodeForge Dark" },
        { value: "codeforge-light", label: "CodeForge Light" },
      ],
    },
  },
  {
    key: "workbench.restoreWorkspace",
    category: "Appearance",
    label: "Restore last folder",
    description: "Reopen the folder you were working in when CodeForge starts.",
    control: { type: "boolean" },
  },
  {
    key: "editor.fontSize",
    category: "Editor",
    label: "Font size",
    description: "Editor font size in pixels.",
    control: { type: "number", min: 8, max: 40 },
  },
  {
    key: "editor.fontFamily",
    category: "Editor",
    label: "Font family",
    description: "Comma-separated list of fonts, tried in order.",
    control: { type: "string" },
  },
  {
    key: "editor.fontLigatures",
    category: "Editor",
    label: "Font ligatures",
    description: "Render programming ligatures when the font supports them.",
    control: { type: "boolean" },
  },
  {
    key: "editor.tabSize",
    category: "Editor",
    label: "Tab size",
    description: "Number of spaces a tab is equal to.",
    control: { type: "number", min: 1, max: 8 },
  },
  {
    key: "editor.insertSpaces",
    category: "Editor",
    label: "Insert spaces",
    description: "Insert spaces when pressing Tab.",
    control: { type: "boolean" },
  },
  {
    key: "editor.wordWrap",
    category: "Editor",
    label: "Word wrap",
    description: "Wrap long lines at the edge of the editor.",
    control: {
      type: "enum",
      options: [
        { value: "off", label: "Off" },
        { value: "on", label: "On" },
      ],
    },
  },
  {
    key: "editor.minimap",
    category: "Editor",
    label: "Minimap",
    description: "Show the code overview on the right side of the editor.",
    control: { type: "boolean" },
  },
  {
    key: "editor.lineNumbers",
    category: "Editor",
    label: "Line numbers",
    description: "How line numbers are shown.",
    control: {
      type: "enum",
      options: [
        { value: "on", label: "On" },
        { value: "relative", label: "Relative" },
        { value: "off", label: "Off" },
      ],
    },
  },
  {
    key: "editor.renderWhitespace",
    category: "Editor",
    label: "Render whitespace",
    description: "When to draw whitespace characters.",
    control: {
      type: "enum",
      options: [
        { value: "none", label: "None" },
        { value: "boundary", label: "Boundary" },
        { value: "selection", label: "Selection" },
        { value: "all", label: "All" },
      ],
    },
  },
  {
    key: "editor.cursorBlinking",
    category: "Editor",
    label: "Cursor animation",
    description: "Cursor blinking style.",
    control: {
      type: "enum",
      options: ["blink", "smooth", "phase", "expand", "solid"].map((value) => ({
        value,
        label: value[0].toUpperCase() + value.slice(1),
      })),
    },
  },
  {
    key: "editor.smoothScrolling",
    category: "Editor",
    label: "Smooth scrolling",
    description: "Animate scrolling in the editor.",
    control: { type: "boolean" },
  },
  {
    key: "editor.bracketPairColorization",
    category: "Editor",
    label: "Bracket pair colors",
    description: "Color matching brackets so nesting is easier to read.",
    control: { type: "boolean" },
  },
  {
    key: "editor.stickyScroll",
    category: "Editor",
    label: "Sticky scroll",
    description: "Pin the enclosing function or class header while scrolling.",
    control: { type: "boolean" },
  },
  {
    key: "editor.formatOnSave",
    category: "Editor",
    label: "Format on save",
    description:
      "Format the file when saving. Built-in formatters cover JavaScript, TypeScript, JSON, CSS, SCSS, Less and HTML.",
    control: { type: "boolean" },
  },
  {
    key: "files.autoSave",
    category: "Files",
    label: "Auto save",
    description: "Save changed files automatically after a short delay.",
    control: {
      type: "enum",
      options: [
        { value: "off", label: "Off" },
        { value: "afterDelay", label: "After delay" },
      ],
    },
  },
  {
    key: "files.autoSaveDelay",
    category: "Files",
    label: "Auto save delay (ms)",
    description: "How long to wait after the last change before auto saving.",
    control: { type: "number", min: 100, max: 60000 },
  },
  {
    key: "files.exclude",
    category: "Files",
    label: "Hidden files",
    description: "Names or glob patterns hidden from the explorer and quick open. One per line.",
    control: { type: "list" },
  },
  {
    key: "search.exclude",
    category: "Search",
    label: "Search exclude",
    description: "Names or glob patterns skipped by search and quick open. One per line.",
    control: { type: "list" },
  },
  {
    key: "terminal.shell",
    category: "Terminal",
    label: "Shell path",
    description:
      "Program started in new terminals. Leave empty for the default (PowerShell on Windows, $SHELL elsewhere).",
    control: { type: "string", placeholder: "Default" },
  },
  {
    key: "terminal.fontSize",
    category: "Terminal",
    label: "Terminal font size",
    description: "Font size of the integrated terminal.",
    control: { type: "number", min: 8, max: 32 },
  },
  {
    key: "terminal.cursorBlink",
    category: "Terminal",
    label: "Cursor blink",
    description: "Blink the terminal cursor.",
    control: { type: "boolean" },
  },
  {
    key: "python.languageServer",
    category: "Python",
    label: "Python IntelliSense",
    description:
      "Completion, error checking, hover, go to definition and rename for Python files, powered by the bundled Pyright language server.",
    control: { type: "boolean" },
  },
  {
    key: "update.checkOnStartup",
    category: "Updates",
    label: "Check for updates automatically",
    description:
      "Check GitHub for a newer CodeForge when the app starts (and every few hours), download it in the background and ask before restarting.",
    control: { type: "boolean" },
  },
];
