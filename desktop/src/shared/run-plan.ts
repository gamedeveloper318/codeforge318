import { basename, languageForPath } from "./languages";

/** Programs CodeForge can look up and start to run or debug a file. */
export const RUNTIMES = {
  python: { label: "Python", installUrl: "https://www.python.org/downloads/" },
  node: { label: "Node.js", installUrl: "https://nodejs.org/" },
  npx: { label: "Node.js (npx)", installUrl: "https://nodejs.org/" },
  powershell: { label: "PowerShell", installUrl: "https://aka.ms/powershell" },
  bash: { label: "Bash", installUrl: "https://git-scm.com/downloads" },
  ruby: { label: "Ruby", installUrl: "https://www.ruby-lang.org/en/downloads/" },
  php: { label: "PHP", installUrl: "https://www.php.net/downloads" },
  go: { label: "Go", installUrl: "https://go.dev/dl/" },
  lua: { label: "Lua", installUrl: "https://www.lua.org/download.html" },
  dart: { label: "Dart", installUrl: "https://dart.dev/get-dart" },
  java: { label: "Java (JDK 11 or newer)", installUrl: "https://adoptium.net/" },
} as const;

export type RuntimeId = keyof typeof RUNTIMES;
export const RUNTIME_IDS = Object.keys(RUNTIMES) as RuntimeId[];
export type RunMode = "run" | "debug";

export interface RunPlan {
  runtime: RuntimeId;
  /** Arguments after the program, e.g. ["-m", "pdb", file]. */
  args: string[];
  /** Shown to the user while starting, e.g. "Python debugger (pdb)". */
  description: string;
  /** Short reminder of the debugger's commands. */
  debugHelp?: string;
}

export type RunPlanResult = { ok: true; plan: RunPlan } | { ok: false; reason: string };

const DEBUGGERS: Partial<Record<string, (file: string) => RunPlan>> = {
  python: (file) => ({
    runtime: "python",
    args: ["-m", "pdb", file],
    description: "Python debugger (pdb)",
    debugHelp:
      "n = next line · s = step into · c = continue · b 12 = breakpoint at line 12 · p name = print a variable · q = quit",
  }),
  javascript: (file) => ({
    runtime: "node",
    args: ["inspect", file],
    description: "Node.js debugger (node inspect)",
    debugHelp:
      "n = next line · s = step into · c = continue · setBreakpoint(12) · repl = inspect variables · .exit = quit",
  }),
};

const NOT_RUNNABLE: Record<string, string> = {
  c: "C files must be compiled first, for example: gcc main.c -o main, then run the program from the terminal.",
  cpp: "C++ files must be compiled first, for example: g++ main.cpp -o main, then run the program from the terminal.",
  csharp: "C# code runs as a project: use dotnet run in the terminal inside the project folder.",
  rust: "Rust code is built with Cargo: use cargo run in the terminal inside the project folder.",
  html: "Use Run > Preview HTML File to open HTML pages.",
  css: "CSS files are not programs. Open the HTML page that uses them and preview it.",
  json: "JSON files are data, not programs.",
  markdown: "Markdown files are documents, not programs.",
};

/** How to run (or debug) a file, decided from its language. Pure: does not check what is installed. */
export function planRun(filePath: string, mode: RunMode): RunPlanResult {
  const language = languageForPath(filePath);
  const name = basename(filePath);
  if (mode === "debug") {
    const debug = DEBUGGERS[language];
    if (debug) return { ok: true, plan: debug(filePath) };
    return {
      ok: false,
      reason: `Debugging is available for Python (.py) and JavaScript (.js) files. Use Run Current File to run "${name}".`,
    };
  }
  const plan = runPlan(language, filePath);
  if (plan) return { ok: true, plan };
  return {
    ok: false,
    reason:
      NOT_RUNNABLE[language] ??
      `CodeForge doesn't know how to run "${name}". Supported: Python, JavaScript, TypeScript, Java, PowerShell, shell scripts, Ruby, PHP, Go, Lua and Dart.`,
  };
}

function runPlan(language: string, file: string): RunPlan | null {
  const simple = (runtime: RuntimeId, args: string[] = [file]): RunPlan => ({
    runtime,
    args,
    description: RUNTIMES[runtime].label,
  });
  switch (language) {
    case "python":
      return simple("python");
    case "javascript":
      return simple("node");
    case "typescript":
      return file.toLowerCase().endsWith(".d.ts")
        ? null
        : { runtime: "npx", args: ["tsx", file], description: "tsx (TypeScript runner, via npx)" };
    case "java":
      return simple("java");
    case "powershell":
      return simple("powershell", ["-NoLogo", "-ExecutionPolicy", "Bypass", "-File", file]);
    case "shell":
      return simple("bash");
    case "ruby":
      return simple("ruby");
    case "php":
      return simple("php");
    case "go":
      return simple("go", ["run", file]);
    case "lua":
      return simple("lua");
    case "dart":
      return simple("dart", ["run", file]);
    default:
      return null;
  }
}

/** Quotes one argument for PowerShell: single quotes are literal, a ' is written as ''. */
export function quotePowerShell(arg: string): string {
  return `'${arg.replace(/'/g, "''")}'`;
}

/** The command line shown at the top of a run terminal (for the user, not executed). */
export function displayCommand(program: string, args: string[]): string {
  return [program, ...args].map((a) => (/[\s"']/.test(a) ? `"${a}"` : a)).join(" ");
}
