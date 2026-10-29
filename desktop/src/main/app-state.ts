import { join } from "node:path";
import { z } from "zod";
import { parseSettings, type Settings } from "@shared/settings";
import { JsonStore } from "./json-store";

const MAX_RECENT = 12;

const stateSchema = z.object({
  recentWorkspaces: z.array(z.string()).max(MAX_RECENT).catch([]),
  lastWorkspace: z.string().nullable().catch(null),
  window: z
    .object({
      width: z.number().int().min(400).max(10000),
      height: z.number().int().min(300).max(10000),
      x: z.number().int().optional(),
      y: z.number().int().optional(),
      maximized: z.boolean(),
    })
    .catch({ width: 1440, height: 900, maximized: false }),
});

export type PersistedState = z.infer<typeof stateSchema>;

/** Settings and window/workspace state, persisted in the user data folder. */
export class AppState {
  readonly settings: JsonStore<Settings>;
  readonly state: JsonStore<PersistedState>;

  constructor(userDataDir: string) {
    this.settings = new JsonStore(join(userDataDir, "settings.json"), parseSettings);
    this.state = new JsonStore(join(userDataDir, "state.json"), (raw) => stateSchema.parse(raw));
  }

  addRecentWorkspace(root: string): void {
    const current = this.state.get();
    const recent = [
      root,
      ...current.recentWorkspaces.filter((p) => p.toLowerCase() !== root.toLowerCase()),
    ];
    this.state.set({
      ...current,
      recentWorkspaces: recent.slice(0, MAX_RECENT),
      lastWorkspace: root,
    });
  }

  removeRecentWorkspace(root: string): string[] {
    const current = this.state.get();
    const recent = current.recentWorkspaces.filter((p) => p.toLowerCase() !== root.toLowerCase());
    const lastWorkspace =
      current.lastWorkspace?.toLowerCase() === root.toLowerCase() ? null : current.lastWorkspace;
    return this.state.set({ ...current, recentWorkspaces: recent, lastWorkspace }).recentWorkspaces;
  }
}
