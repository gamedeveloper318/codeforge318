import os from "node:os";
import path from "node:path";
import { stat } from "node:fs/promises";
import {
  app,
  dialog,
  ipcMain,
  shell,
  type BrowserWindow,
  type IpcMainEvent,
  type IpcMainInvokeEvent,
} from "electron";
import { z } from "zod";
import type {
  InvokeChannel,
  InvokeChannels,
  IpcResult,
  SendChannel,
  SendChannels,
} from "@shared/ipc";
import { DEFAULT_SETTINGS, mergeSettings, type Settings } from "@shared/settings";
import type { AppState } from "./app-state";
import type { FileService } from "./fs-service";
import type { GitService } from "./git-service";
import { log } from "./log";
import type { LspService } from "./lsp-service";
import { isLocalPreviewUrl, openPreviewWindow } from "./preview";
import { prepareRun } from "./run-service";
import { replaceInFiles, type SearchService } from "./search-service";
import type { TerminalService } from "./terminal-service";
import type { UpdateService } from "./update-service";
import type { Workspace } from "./workspace";

export interface IpcDeps {
  getWindow(): BrowserWindow | null;
  isTrustedUrl(url: string): boolean;
  confirmClose(): void;
  onSettingsChanged(settings: Settings): void;
  state: AppState;
  workspace: Workspace;
  files: FileService;
  search: SearchService;
  git: GitService;
  terminals: TerminalService;
  updates: UpdateService;
  pythonLsp: LspService;
}

const absPath = z.string().min(1).max(4096);
const pathList = z.array(absPath).min(1).max(10_000);
const dimension = z.number().int().min(1).max(2000);
const terminalId = z.number().int().positive();

const confirmOptions = z.object({
  type: z.enum(["none", "info", "warning", "question", "error"]).optional(),
  message: z.string().min(1).max(2000),
  detail: z.string().max(4000).optional(),
  buttons: z.array(z.string().min(1).max(100)).min(1).max(5),
  defaultId: z.number().int().min(0).optional(),
  cancelId: z.number().int().min(0).optional(),
});

const searchQuery = z.object({
  pattern: z.string().max(1000),
  isRegex: z.boolean(),
  caseSensitive: z.boolean(),
  wholeWord: z.boolean(),
  include: z.string().max(2000),
  exclude: z.string().max(2000),
});

const settingsPatch = z.custom<Partial<Settings>>(
  (value) => typeof value === "object" && value !== null && !Array.isArray(value),
  "Settings must be an object.",
);

const samePathKey = (p: string) => (process.platform === "win32" ? p.toLowerCase() : p);

export function registerIpcHandlers(deps: IpcDeps): void {
  const { state, workspace, files, search, git, terminals, updates, pythonLsp } = deps;

  const assertTrusted = (event: IpcMainInvokeEvent | IpcMainEvent) => {
    const win = deps.getWindow();
    const frame = event.senderFrame;
    if (
      !win ||
      event.sender.id !== win.webContents.id ||
      !frame ||
      frame.parent ||
      !deps.isTrustedUrl(frame.url)
    ) {
      throw new Error("Blocked a request from an untrusted page.");
    }
  };

  const handle = <K extends InvokeChannel>(
    channel: K,
    schema: z.ZodType<InvokeChannels[K]["args"]>,
    fn: (
      ...args: InvokeChannels[K]["args"]
    ) => Promise<InvokeChannels[K]["result"]> | InvokeChannels[K]["result"],
  ) => {
    ipcMain.handle(
      channel,
      async (event, ...rawArgs): Promise<IpcResult<InvokeChannels[K]["result"]>> => {
        try {
          assertTrusted(event);
          const parsed = schema.safeParse(rawArgs);
          if (!parsed.success) throw new Error(`Invalid request for ${channel}.`);
          return { ok: true, value: await fn(...parsed.data) };
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          log("warn", `${channel} failed: ${message}`);
          return { ok: false, error: message };
        }
      },
    );
  };

  const on = <K extends SendChannel>(
    channel: K,
    schema: z.ZodType<SendChannels[K]>,
    fn: (...args: SendChannels[K]) => void,
  ) => {
    ipcMain.on(channel, (event, ...rawArgs) => {
      try {
        assertTrusted(event);
        const parsed = schema.safeParse(rawArgs);
        if (parsed.success) fn(...parsed.data);
      } catch (error) {
        log("warn", `${channel} rejected`, error);
      }
    });
  };

  const openWorkspace = async (root: string) => {
    const info = await workspace.open(root);
    state.addRecentWorkspace(info.root);
    pythonLsp.workspaceChanged();
    return info;
  };

  // --- app & window -------------------------------------------------------
  handle("app:info", z.tuple([]), () => ({
    name: "CodeForge",
    version: app.getVersion(),
    platform: process.platform,
    arch: process.arch,
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
    isPackaged: app.isPackaged,
    homeDir: os.homedir(),
  }));

  handle("app:open-external", z.tuple([z.string().max(4096)]), async (url) => {
    if (!/^(https?:|mailto:)/i.test(url))
      throw new Error("Only web and email links can be opened.");
    await shell.openExternal(url);
  });

  handle("app:toggle-devtools", z.tuple([]), () => {
    deps.getWindow()?.webContents.toggleDevTools();
  });

  handle("app:confirm", z.tuple([confirmOptions]), async (options) => {
    const win = deps.getWindow();
    const box = { ...options, noLink: true, title: "CodeForge" };
    const result = win ? await dialog.showMessageBox(win, box) : await dialog.showMessageBox(box);
    return result.response;
  });

  handle("app:reveal", z.tuple([absPath]), async (target) => {
    shell.showItemInFolder(await workspace.resolve(target));
  });

  handle("app:quit", z.tuple([]), () => {
    // Same path as the window's close button: the UI asks about unsaved files first.
    deps.getWindow()?.close();
  });

  handle("window:confirm-close", z.tuple([]), () => deps.confirmClose());

  // --- workspace ----------------------------------------------------------
  handle("workspace:open-dialog", z.tuple([]), async () => {
    const win = deps.getWindow();
    const options: Electron.OpenDialogOptions = {
      title: "Open Folder",
      properties: ["openDirectory", "createDirectory"],
    };
    const result = win
      ? await dialog.showOpenDialog(win, options)
      : await dialog.showOpenDialog(options);
    if (result.canceled || !result.filePaths[0]) return null;
    return openWorkspace(result.filePaths[0]);
  });

  handle("workspace:open-recent", z.tuple([absPath]), async (root) => {
    // Only folders the user opened before can be reopened without a dialog.
    const known = state.state
      .get()
      .recentWorkspaces.some((p) => samePathKey(p) === samePathKey(root));
    if (!known) throw new Error("That folder is not in the recent list.");
    const exists = await stat(root).then(
      (s) => s.isDirectory(),
      () => false,
    );
    if (!exists) {
      state.removeRecentWorkspace(root);
      throw new Error(
        `The folder "${root}" no longer exists. It was removed from the recent list.`,
      );
    }
    return openWorkspace(root);
  });

  handle("workspace:current", z.tuple([]), () => workspace.info);
  handle("workspace:recent", z.tuple([]), () => state.state.get().recentWorkspaces);
  handle("workspace:remove-recent", z.tuple([absPath]), (root) =>
    state.removeRecentWorkspace(root),
  );
  handle("workspace:close", z.tuple([]), () => {
    workspace.close();
    state.state.set({ ...state.state.get(), lastWorkspace: null });
    pythonLsp.workspaceChanged();
  });

  // --- dialogs --------------------------------------------------------------
  handle("dialog:open-files", z.tuple([]), async () => {
    const win = deps.getWindow();
    const options: Electron.OpenDialogOptions = {
      title: "Open File",
      properties: ["openFile", "multiSelections"],
    };
    const result = win
      ? await dialog.showOpenDialog(win, options)
      : await dialog.showOpenDialog(options);
    if (result.canceled) return [];
    result.filePaths.forEach((file) => workspace.allowFile(file));
    return result.filePaths;
  });

  handle("dialog:save-as", z.tuple([z.string().max(255)]), async (suggestedName) => {
    const win = deps.getWindow();
    const base = workspace.root ?? app.getPath("documents");
    const options: Electron.SaveDialogOptions = {
      title: "Save As",
      defaultPath: path.join(base, path.basename(suggestedName) || "untitled.txt"),
    };
    const result = win
      ? await dialog.showSaveDialog(win, options)
      : await dialog.showSaveDialog(options);
    if (result.canceled || !result.filePath) return null;
    workspace.allowFile(result.filePath);
    return result.filePath;
  });

  // --- filesystem -----------------------------------------------------------
  handle("fs:read-dir", z.tuple([absPath]), (dir) => files.readDir(dir));
  handle("fs:read-file", z.tuple([absPath]), (file) => files.readFile(file));
  handle("fs:write-file", z.tuple([absPath, z.string(), z.boolean()]), (file, content, bom) =>
    files.writeFile(file, content, bom),
  );
  handle("fs:stat", z.tuple([absPath]), (target) => files.stat(target));
  handle("fs:create-file", z.tuple([absPath]), (file) => files.createFile(file));
  handle("fs:create-dir", z.tuple([absPath]), (dir) => files.createDirectory(dir));
  handle("fs:rename", z.tuple([absPath, absPath]), (from, to) => files.rename(from, to));
  handle("fs:trash", z.tuple([absPath]), (target) => files.trash(target));
  handle("fs:list-files", z.tuple([]), () => files.listFiles());

  // --- search ---------------------------------------------------------------
  handle("search:find", z.tuple([searchQuery]), (query) => search.find(query));
  handle(
    "search:replace",
    z.tuple([
      searchQuery.refine((q) => q.pattern.length > 0),
      z.string().max(10_000),
      z.array(absPath).max(10_000),
    ]),
    (query, replacement, paths) => replaceInFiles(workspace, query, replacement, paths),
  );

  // --- git ------------------------------------------------------------------
  handle("git:status", z.tuple([]), () => git.status());
  handle("git:init", z.tuple([]), () => git.init());
  handle("git:stage", z.tuple([pathList]), (paths) => git.stage(paths));
  handle("git:unstage", z.tuple([pathList]), (paths) => git.unstage(paths));
  handle("git:discard", z.tuple([pathList]), (paths) => git.discard(paths));
  handle("git:commit", z.tuple([z.string().max(10_000), z.boolean()]), (message, stageAll) =>
    git.commit(message, stageAll),
  );
  handle("git:show", z.tuple([absPath, z.enum(["HEAD", "INDEX"])]), (file, ref) =>
    git.show(file, ref),
  );
  handle("git:branches", z.tuple([]), () => git.branches());
  handle("git:checkout", z.tuple([z.string().min(1).max(250)]), (branch) => git.checkout(branch));
  handle("git:create-branch", z.tuple([z.string().min(1).max(250)]), (name) =>
    git.createBranch(name),
  );
  handle("git:log", z.tuple([z.number().int().min(1).max(500)]), (limit) => git.log(limit));
  handle("git:sync", z.tuple([z.enum(["pull", "push", "fetch"])]), (action) => git.sync(action));

  // --- terminal -------------------------------------------------------------
  handle(
    "terminal:create",
    z.tuple([
      z.object({
        cols: dimension,
        rows: dimension,
        cwd: absPath.optional(),
        profile: z.string().max(50).optional(),
      }),
    ]),
    async (options) => {
      let cwd = workspace.root ?? os.homedir();
      if (options.cwd) {
        const resolved = await workspace.resolve(options.cwd);
        const info = await stat(resolved).catch(() => null);
        cwd = info?.isDirectory() ? resolved : path.dirname(resolved);
      }
      // Only shells detected on this computer can start; the id just picks one.
      return terminals.create({
        cols: options.cols,
        rows: options.rows,
        cwd,
        profile: options.profile,
      });
    },
  );
  handle("terminal:kill", z.tuple([terminalId]), (id) => terminals.kill(id));
  handle("terminal:profiles", z.tuple([]), () => terminals.profiles());

  // --- run & debug ----------------------------------------------------------
  const runMode = z.enum(["run", "debug"]);
  handle("run:check", z.tuple([absPath, runMode]), async (file, mode) => {
    return (await prepareRun(workspace, file, mode)).check;
  });
  handle(
    "run:start",
    z.tuple([z.object({ file: absPath, mode: runMode, cols: dimension, rows: dimension })]),
    async ({ file, mode, cols, rows }) => {
      const prepared = await prepareRun(workspace, file, mode);
      if (!prepared.check.ok || !prepared.launch) {
        throw new Error(prepared.check.ok ? "Nothing to run." : prepared.check.reason);
      }
      return terminals.createProgram(prepared.launch, { cols, rows, cwd: prepared.cwd });
    },
  );
  on("terminal:write", z.tuple([terminalId, z.string().max(1_000_000)]), (id, data) =>
    terminals.write(id, data),
  );
  on("terminal:resize", z.tuple([terminalId, dimension, dimension]), (id, cols, rows) =>
    terminals.resize(id, cols, rows),
  );

  // --- updates --------------------------------------------------------------
  handle("update:status", z.tuple([]), () => updates.current);
  handle("update:check", z.tuple([]), () => updates.check());
  handle("update:install", z.tuple([]), () => updates.install());

  // --- language servers -----------------------------------------------------
  handle("lsp:start", z.tuple([z.literal("python")]), () => pythonLsp.start());
  on(
    "lsp:send",
    z.tuple([z.literal("python"), z.record(z.string(), z.unknown())]),
    (_language, message) => pythonLsp.send(message),
  );

  // --- settings -------------------------------------------------------------
  handle("settings:get", z.tuple([]), () => state.settings.get());
  handle("settings:update", z.tuple([settingsPatch]), (patch) => {
    const next = state.settings.set(mergeSettings(state.settings.get(), patch));
    deps.onSettingsChanged(next);
    return next;
  });
  handle("settings:reset", z.tuple([]), () => {
    const next = state.settings.set(DEFAULT_SETTINGS);
    deps.onSettingsChanged(next);
    return next;
  });

  // --- preview --------------------------------------------------------------
  handle("preview:open-file", z.tuple([absPath]), async (file) => {
    const resolved = await workspace.resolve(file);
    if (!/\.html?$/i.test(resolved)) throw new Error("Only .html files can be previewed.");
    openPreviewWindow({ file: resolved }, deps.getWindow());
  });
  handle("preview:open-url", z.tuple([z.string().max(2048)]), (url) => {
    if (!isLocalPreviewUrl(url)) {
      throw new Error("Preview only opens local development servers (localhost or 127.0.0.1).");
    }
    openPreviewWindow({ url }, deps.getWindow());
  });
}
