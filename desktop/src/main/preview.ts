import path from "node:path";
import { pathToFileURL } from "node:url";
import { BrowserWindow, session, shell } from "electron";

const PREVIEW_PARTITION = "codeforge-preview";
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

export function isLocalPreviewUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (url.protocol === "http:" || url.protocol === "https:") && LOCAL_HOSTS.has(url.hostname);
  } catch {
    return false;
  }
}

let partitionConfigured = false;

/**
 * Opens a web preview in its own sandboxed window. Preview pages are treated as
 * untrusted: no preload, no Node.js, a separate in-memory session, every
 * permission request denied, and navigation limited to the previewed folder or
 * localhost. Other links open in the system browser.
 */
export function openPreviewWindow(
  target: { file: string } | { url: string },
  parent: BrowserWindow | null,
): void {
  const previewSession = session.fromPartition(PREVIEW_PARTITION);
  if (!partitionConfigured) {
    previewSession.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));
    previewSession.setPermissionCheckHandler(() => false);
    partitionConfigured = true;
  }

  const win = new BrowserWindow({
    width: 1200,
    height: 820,
    title: "CodeForge Preview",
    autoHideMenuBar: true,
    backgroundColor: "#ffffff",
    parent: parent ?? undefined,
    webPreferences: {
      session: previewSession,
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
      spellcheck: false,
    },
  });

  const allowedFolder = "file" in target ? path.dirname(target.file) : null;
  const isAllowed = (url: string) => {
    if (isLocalPreviewUrl(url)) return true;
    if (!allowedFolder || !url.startsWith("file:")) return false;
    try {
      const filePath = decodeURIComponent(new URL(url).pathname).replace(/^\/([a-zA-Z]:)/, "$1");
      const relative = path.relative(allowedFolder, path.resolve(filePath));
      return !relative.startsWith("..") && !path.isAbsolute(relative);
    } catch {
      return false;
    }
  };

  win.webContents.on("will-navigate", (event, url) => {
    if (isAllowed(url)) return;
    event.preventDefault();
    if (/^https?:/i.test(url)) void shell.openExternal(url);
  });
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) void shell.openExternal(url);
    return { action: "deny" };
  });

  if ("file" in target) void win.loadURL(pathToFileURL(target.file).toString());
  else void win.loadURL(target.url);
}
