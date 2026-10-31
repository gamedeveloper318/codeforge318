import path from "node:path";
import type { RunCheck } from "@shared/ipc";
import { displayCommand, planRun, RUNTIMES, type RunMode } from "@shared/run-plan";
import { resolveRuntime, type ResolvedRuntime } from "./runtime";
import type { ProgramLaunch } from "./terminal-service";
import type { Workspace } from "./workspace";

export interface PreparedRun {
  check: RunCheck;
  launch?: ProgramLaunch;
  cwd: string;
}

/**
 * Decides how to run or debug a file and checks that the program for it is
 * installed. The renderer only names the file; the program and its arguments
 * are always chosen here, from the file's language.
 */
export async function prepareRun(
  workspace: Workspace,
  file: string,
  mode: RunMode,
  resolve: (id: Parameters<typeof resolveRuntime>[0]) => Promise<ResolvedRuntime | null> = (id) =>
    resolveRuntime(id),
): Promise<PreparedRun> {
  const target = await workspace.resolve(file);
  const cwd = path.dirname(target);
  const planned = planRun(target, mode);
  if (!planned.ok) return { check: { ok: false, reason: planned.reason }, cwd };
  const { plan } = planned;
  const runtime = RUNTIMES[plan.runtime];
  const found = await resolve(plan.runtime);
  if (!found) {
    return {
      check: {
        ok: false,
        reason: `${runtime.label} isn't installed on this computer (or isn't on PATH), so "${path.basename(target)}" can't ${mode === "debug" ? "be debugged" : "run"}. Install it, then restart CodeForge.`,
        installUrl: runtime.installUrl,
        runtimeLabel: runtime.label,
      },
      cwd,
    };
  }
  const description = mode === "debug" ? plan.description : (found.version ?? plan.description);
  return {
    check: {
      ok: true,
      description,
      command: displayCommand(path.basename(found.path), plan.args),
      debugHelp: plan.debugHelp,
    },
    launch: {
      program: found.path,
      args: plan.args,
      name: `${mode === "debug" ? "Debug" : "Run"}: ${path.basename(target)}`,
    },
    cwd,
  };
}
