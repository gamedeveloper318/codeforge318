import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import {
  app,
  BrowserWindow,
  dialog,
  Menu,
  nativeTheme,
  protocol,
  screen,
  session,
  shell,
} from "electron";
import { autoUpdater } from "electron-updater";
import type { EventChannel, EventChannels } from "@shared/ipc";
import type { Settings } from "@shared/settings";
import { AppState } from "./app-state";
import { FileService } from "./fs-service";
import { GitService } from "./git-service";
import { registerIpcHandlers } from "./ipc";
import { initLog, log } from "./log";
import { LspService } from "./lsp-service";
import { isInside } from "./path-guard";
import { SearchService } from "./search-service";
import { TerminalService } from "./terminal-service";
import { UpdateService, type Updater } from "./update-service";
import { Workspace } from "./workspace";

// Tests (and power users) can isolate settings and state in another folder.
if (process.env.CODEFORGE_USER_DATA_DIR) {
  app.setPath("userData", path.resolve(process.env.CODEFORGE_USER_DATA_DIR));
}

// The UI is served from app://codeforge/ instead of file:// so it gets a real
// origin: Monaco's web workers need one, and the CSP's 'self' then means
// exactly "files that ship with CodeForge".
const APP_SCHEME = "app";
const APP_HOST = "codeforge";
protocol.registerSchemesAsPrivileged([
  {
    scheme: APP_SCHEME,
    privileges: { standard: true, secure: true, supportFetchAPI: true, codeCache: true },
  },
]);

const devServerUrl = app.isPackaged ? undefined : process.env.ELECTRON_RENDERER_URL;
const rendererRoot = path.join(__dirname, "../renderer");

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".ttf": "font/ttf",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".wasm": "application/wasm",
};

const TITLE_BAR = {
  dark: { color: "#0a0f1c", symbolColor: "#94a3b8", height: 36 },
  light: { color: "#eef1f6", symbolColor: "#475569", height: 36 },
};

function isTrustedUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === `${APP_SCHEME}:` && parsed.host === APP_HOST) return true;
    return Boolean(devServerUrl) && parsed.origin === new URL(devServerUrl!).origin;
  } catch {
    return false;
  }
}

const userData = app.getPath("userData");
initLog(userData);
const state = new AppState(userData);
let mainWindow: BrowserWindow | null = null;
let closeConfirmed = false;

function send<K extends EventChannel>(channel: K, payload: EventChannels[K]): void {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send(channel, payload);
}

const settings = () => state.settings.get();
const workspace = new Workspace({
  onFilesChanged: (paths) => send("fs:changed", { paths }),
  onGitChanged: () => send("git:changed", undefined),
});
const files = new FileService(workspace, settings);
const search = new SearchService(workspace, settings);
const git = new GitService(workspace);
const terminals = new TerminalService(send, settings);

// Tests (and anyone who prefers manual updates) can switch the updater off.
const updatesDisabled = Boolean(process.env.CODEFORGE_DISABLE_UPDATES);
const updatesEnabled = app.isPackaged && !updatesDisabled;
const updates = new UpdateService({
  updater: updatesEnabled ? (autoUpdater as unknown as Updater) : null,
  unsupportedReason: updatesDisabled
    ? "Automatic updates are turned off for this session."
    : undefined,
  currentVersion: app.getVersion(),
  emit: (status) => send("update:status", status),
  log,
  beforeInstall: () => {
    closeConfirmed = true;
    terminals.killAll();
    pythonLsp.stop();
  },
});
if (updatesEnabled) {
  autoUpdater.logger = {
    info: (message: unknown) => log("info", `updater: ${String(message)}`),
    warn: (message: unknown) => log("warn", `updater: ${String(message)}`),
    error: (message: unknown) => log("error", `updater: ${String(message)}`),
    debug: () => undefined,
  };
}

/** Pyright's server entry point; packaged builds run it from app.asar.unpacked. */
function pyrightScript(): string {
  return require
    .resolve("pyright/langserver.index.js")
    .replace(/app\.asar([\\/])/, "app.asar.unpacked$1");
}

const pythonLsp = new LspService({
  languageId: "python",
  serverScript: pyrightScript(),
  args: ["--stdio"],
  workspaceRoot: () => workspace.root,
  enabled: () => settings()["python.languageServer"],
  emitMessage: (message) => send("lsp:message", { language: "python", message }),
  emitStopped: (reason) => send("lsp:stopped", { language: "python", reason }),
  log,
});

function themeOf(current: Settings): "dark" | "light" {
  return current["workbench.colorTheme"] === "codeforge-light" ? "light" : "dark";
}

function applySettings(next: Settings): void {
  const theme = themeOf(next);
  nativeTheme.themeSource = theme;
  if (mainWindow && process.platform !== "darwin") mainWindow.setTitleBarOverlay(TITLE_BAR[theme]);
  if (!next["python.languageServer"]) pythonLsp.stop();
  send("settings:changed", next);
}

function registerAppProtocol(): void {
  protocol.handle(APP_SCHEME, async (request) => {
    const url = new URL(request.url);
    if (url.host !== APP_HOST) return new Response("Not found", { status: 404 });
    const pathname = decodeURIComponent(url.pathname);
    const target = path.resolve(rendererRoot, `.${pathname === "/" ? "/index.html" : pathname}`);
    if (!isInside(rendererRoot, target)) return new Response("Forbidden", { status: 403 });
    try {
      const body = await readFile(target);
      const type = MIME_TYPES[path.extname(target).toLowerCase()] ?? "application/octet-stream";
      return new Response(new Uint8Array(body), { headers: { "content-type": type } });
    } catch {
      return new Response("Not found", { status: 404 });
    }
  });
}

function hardenSessions(): void {
  // The editor only ever needs clipboard access; everything else is denied.
  const allowed = new Set(["clipboard-read", "clipboard-sanitized-write"]);
  session.defaultSession.setPermissionRequestHandler((contents, permission, callback, details) => {
    callback(
      contents === mainWindow?.webContents &&
        allowed.has(permission) &&
        isTrustedUrl(details.requestingUrl),
    );
  });
  session.defaultSession.setPermissionCheckHandler((contents, permission, origin) => {
    return contents === mainWindow?.webContents && allowed.has(permission) && isTrustedUrl(origin);
  });

  app.on("web-contents-created", (_event, contents) => {
    contents.on("will-attach-webview", (event) => event.preventDefault());
    contents.setWindowOpenHandler(({ url }) => {
      if (/^https?:/i.test(url)) void shell.openExternal(url);
      return { action: "deny" };
    });
  });
}

function restoredBounds(): Electron.Rectangle | { width: number; height: number } {
  const saved = state.state.get().window;
  if (saved.x === undefined || saved.y === undefined)
    return { width: saved.width, height: saved.height };
  const visible = screen.getAllDisplays().some(({ workArea }) => {
    return (
      saved.x! >= workArea.x - 50 &&
      saved.y! >= workArea.y - 50 &&
      saved.x! < workArea.x + workArea.width - 100 &&
      saved.y! < workArea.y + workArea.height - 100
    );
  });
  return visible
    ? { x: saved.x, y: saved.y, width: saved.width, height: saved.height }
    : { width: saved.width, height: saved.height };
}

function saveWindowState(win: BrowserWindow): void {
  const bounds = win.getNormalBounds();
  state.state.set({
    ...state.state.get(),
    window: { ...bounds, maximized: win.isMaximized() },
  });
}

function createMainWindow(): BrowserWindow {
  const theme = themeOf(settings());
  const win = new BrowserWindow({
    ...restoredBounds(),
    minWidth: 760,
    minHeight: 480,
    show: false,
    title: "CodeForge",
    backgroundColor: theme === "dark" ? "#070a13" : "#f7f8fb",
    titleBarStyle: "hidden",
    titleBarOverlay: process.platform === "darwin" ? undefined : TITLE_BAR[theme],
    trafficLightPosition: { x: 14, y: 11 },
    icon: app.isPackaged ? undefined : path.join(__dirname, "../../build/icon.png"),
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
      spellcheck: false,
    },
  });
  mainWindow = win;
  closeConfirmed = false;

  if (state.state.get().window.maximized) win.maximize();
  win.once("ready-to-show", () => win.show());

  // Never navigate the editor window away from CodeForge's own UI.
  win.webContents.on("will-navigate", (event, url) => {
    if (!isTrustedUrl(url)) event.preventDefault();
  });

  // Closing is a handshake: the UI first gets a chance to ask about unsaved files.
  win.on("close", (event) => {
    if (closeConfirmed || win.webContents.isCrashed()) {
      saveWindowState(win);
      return;
    }
    event.preventDefault();
    send("window:close-requested", undefined);
  });
  win.on("closed", () => {
    terminals.killAll();
    if (mainWindow === win) mainWindow = null;
  });

  win.webContents.on("render-process-gone", async (_event, details) => {
    log("error", `Renderer process gone: ${details.reason}`);
    if (details.reason === "clean-exit" || win.isDestroyed()) return;
    const { response } = await dialog.showMessageBox(win, {
      type: "error",
      title: "CodeForge",
      message: "The CodeForge window stopped unexpectedly.",
      detail: `Reason: ${details.reason}. Files you saved are safe on disk.`,
      buttons: ["Reload Window", "Close"],
      defaultId: 0,
      noLink: true,
    });
    if (response === 0 && !win.isDestroyed()) win.webContents.reload();
    else if (!win.isDestroyed()) win.destroy();
  });

  if (devServerUrl) void win.loadURL(devServerUrl);
  else void win.loadURL(`${APP_SCHEME}://${APP_HOST}/index.html`);
  return win;
}

/** A folder passed on the command line, e.g. `CodeForge.exe C:\projects\site`. */
async function folderFromArgs(argv: string[]): Promise<string | null> {
  for (const arg of argv.slice(app.isPackaged ? 1 : 2)) {
    if (arg.startsWith("-")) continue;
    const candidate = path.resolve(arg);
    const info = await stat(candidate).catch(() => null);
    if (info?.isDirectory()) return candidate;
  }
  return null;
}

async function restoreWorkspace(): Promise<void> {
  const fromArgs = await folderFromArgs(process.argv);
  const last = settings()["workbench.restoreWorkspace"] ? state.state.get().lastWorkspace : null;
  const target = fromArgs ?? last;
  if (!target) return;
  try {
    const info = await workspace.open(target);
    state.addRecentWorkspace(info.root);
  } catch (error) {
    log("warn", `Could not reopen ${target}`, error);
  }
}

function setApplicationMenu(): void {
  if (process.platform !== "darwin") {
    // Windows/Linux use CodeForge's own title-bar menu.
    Menu.setApplicationMenu(null);
    return;
  }
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([{ role: "appMenu" }, { role: "editMenu" }, { role: "windowMenu" }]),
  );
}

process.on("uncaughtException", (error) => log("error", "Uncaught exception", error));
process.on("unhandledRejection", (reason) => log("error", "Unhandled rejection", reason));

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });

  app.whenReady().then(async () => {
    log("info", `CodeForge ${app.getVersion()} starting (Electron ${process.versions.electron})`);
    nativeTheme.themeSource = themeOf(settings());
    registerAppProtocol();
    hardenSessions();
    setApplicationMenu();
    registerIpcHandlers({
      getWindow: () => mainWindow,
      isTrustedUrl,
      confirmClose: () => {
        closeConfirmed = true;
        mainWindow?.close();
      },
      onSettingsChanged: applySettings,
      state,
      workspace,
      files,
      search,
      git,
      terminals,
      updates,
      pythonLsp,
    });
    await restoreWorkspace();
    createMainWindow();

    if (updatesEnabled) {
      // First check shortly after startup, then every six hours.
      const checkIfWanted = () => {
        if (settings()["update.checkOnStartup"]) void updates.check();
      };
      setTimeout(checkIfWanted, 15_000);
      setInterval(checkIfWanted, 6 * 60 * 60 * 1000);
    }

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
    });
  });

  app.on("window-all-closed", () => {
    terminals.killAll();
    pythonLsp.stop();
    workspace.close();
    if (process.platform !== "darwin") app.quit();
  });
}
