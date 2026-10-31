import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  _electron as electron,
  expect,
  type ElectronApplication,
  type Page,
} from "@playwright/test";

export interface LaunchedApp {
  app: ElectronApplication;
  page: Page;
  userData: string;
}

/**
 * Starts CodeForge with an isolated settings folder. Auto Save is off unless a
 * test turns it on, so tests can check unsaved changes step by step.
 */
export async function launchApp(
  options: { settings?: Record<string, unknown>; args?: string[] } = {},
): Promise<LaunchedApp> {
  const userData = mkdtempSync(path.join(tmpdir(), "codeforge-e2e-user-"));
  writeFileSync(
    path.join(userData, "settings.json"),
    JSON.stringify({ "files.autoSave": "off", ...options.settings }, null, 2),
  );
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) if (value !== undefined) env[key] = value;
  // Inherited from editors that are themselves Electron apps; it would make
  // Electron behave like plain Node.js and never open a window.
  delete env.ELECTRON_RUN_AS_NODE;
  env.CODEFORGE_USER_DATA_DIR = userData;
  // Never contact GitHub for updates (or install one) in the middle of a test run.
  env.CODEFORGE_DISABLE_UPDATES = "1";

  const executable = process.env.CODEFORGE_E2E_EXECUTABLE;
  const app = await electron.launch(
    executable
      ? { executablePath: path.resolve(executable), args: options.args ?? [], env }
      : { args: [path.resolve("."), ...(options.args ?? [])], env },
  );
  const page = await app.firstWindow();
  await page.waitForSelector(".workbench", { timeout: 30_000 });
  if (process.env.CODEFORGE_E2E_VISIBLE !== "1") {
    // Background mode: the window keeps rendering (Playwright drives it directly)
    // but is invisible, click-through and off the taskbar, so tests neither
    // distract whoever is using the computer nor get closed by them mid-run.
    // Set CODEFORGE_E2E_VISIBLE=1 to watch the tests.
    await app.evaluate(({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows()[0];
      win.setOpacity(0);
      win.setIgnoreMouseEvents(true);
      win.setSkipTaskbar(true);
    });
  }
  return { app, page, userData };
}

/** Creates a throwaway project folder with the given files. */
export function makeProject(files: Record<string, string>): string {
  const root = mkdtempSync(path.join(tmpdir(), "codeforge-e2e-project-"));
  for (const [name, content] of Object.entries(files)) {
    const file = path.join(root, ...name.split("/"));
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, content);
  }
  return root;
}

export function git(cwd: string, ...args: string[]): string {
  return execFileSync("git", args, { cwd, encoding: "utf8" });
}

/** Native dialogs can't be clicked by Playwright, so tests answer them in the main process. */
export async function answerOpenDialog(app: ElectronApplication, folder: string): Promise<void> {
  await app.evaluate(({ dialog }, chosen) => {
    dialog.showOpenDialog = (async () => ({
      canceled: false,
      filePaths: [chosen],
    })) as typeof dialog.showOpenDialog;
  }, folder);
}

/** Makes every message box answer with `response`, recording the messages shown. */
export async function answerMessageBoxes(
  app: ElectronApplication,
  response: number,
): Promise<void> {
  await app.evaluate(({ dialog }, answer) => {
    const g = globalThis as unknown as { shownMessages: string[] };
    g.shownMessages = [];
    dialog.showMessageBox = (async (...args: unknown[]) => {
      const options = (args.length > 1 ? args[1] : args[0]) as { message: string };
      g.shownMessages.push(options.message);
      return { response: answer, checkboxChecked: false };
    }) as typeof dialog.showMessageBox;
  }, response);
}

/** Makes "Save As" dialogs pick `file` without showing them. */
export async function answerSaveDialog(app: ElectronApplication, file: string): Promise<void> {
  await app.evaluate(({ dialog }, chosen) => {
    dialog.showSaveDialog = (async () => ({
      canceled: false,
      filePath: chosen,
    })) as typeof dialog.showSaveDialog;
  }, file);
}

/** Records links CodeForge opens in the web browser instead of opening them. */
export async function captureExternalLinks(app: ElectronApplication): Promise<void> {
  await app.evaluate(({ shell }) => {
    const g = globalThis as unknown as { openedLinks: string[] };
    g.openedLinks = [];
    shell.openExternal = (async (url: string) => {
      g.openedLinks.push(url);
    }) as typeof shell.openExternal;
  });
}

export async function openedLinks(app: ElectronApplication): Promise<string[]> {
  return app.evaluate(
    () => (globalThis as unknown as { openedLinks?: string[] }).openedLinks ?? [],
  );
}

/** Opens a title-bar menu (File, Edit, ...) and runs one of its items. */
export async function runMenuItem(page: Page, menu: string, item: string): Promise<void> {
  await page.getByTestId(`menubar-${menu.toLowerCase()}`).click();
  const dropdown = page.getByTestId("menu");
  await expect(dropdown).toBeVisible();
  await dropdown
    .getByRole("menuitem", { name: item, exact: true })
    .or(dropdown.getByRole("menuitemcheckbox", { name: item, exact: true }))
    .first()
    .click();
  await expect(dropdown).toHaveCount(0);
}

export async function shownMessages(app: ElectronApplication): Promise<string[]> {
  return app.evaluate(
    () => (globalThis as unknown as { shownMessages?: string[] }).shownMessages ?? [],
  );
}

export async function openFolder(
  app: ElectronApplication,
  page: Page,
  folder: string,
): Promise<void> {
  await answerOpenDialog(app, folder);
  await page.getByTestId("welcome-page").getByRole("button", { name: "Open Folder…" }).click();
  await expect(page.locator(".section-header .title").first()).toHaveText(path.basename(folder));
}

export async function openFileFromExplorer(page: Page, name: string): Promise<void> {
  await page.getByTestId("explorer-tree").getByRole("treeitem", { name, exact: true }).click();
  await expect(page.getByRole("tab", { name })).toHaveAttribute("aria-selected", "true");
}

export async function typeInEditor(page: Page, text: string): Promise<void> {
  await page.locator(".monaco-editor .view-lines").first().click();
  await page.keyboard.press("Control+End");
  await page.keyboard.type(text);
}
