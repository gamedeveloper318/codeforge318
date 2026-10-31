import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import {
  answerMessageBoxes,
  answerSaveDialog,
  captureExternalLinks,
  launchApp,
  makeProject,
  openedLinks,
  openFileFromExplorer,
  openFolder,
  runMenuItem,
  shownMessages,
  type LaunchedApp,
} from "./helpers";

let launched: LaunchedApp;

test.beforeEach(async () => {
  launched = await launchApp();
});

test.afterEach(async () => {
  await answerMessageBoxes(launched.app, 1).catch(() => undefined);
  await launched.app.close().catch(() => undefined);
});

const lastToast = (page: Page) => page.locator(".toast").last();

async function menuLabels(page: Page, menu: string): Promise<string[]> {
  await page.getByTestId(`menubar-${menu.toLowerCase()}`).click();
  const labels = await page
    .getByTestId("menu")
    .locator("button")
    .evaluateAll((buttons) => buttons.map((b) => b.getAttribute("aria-label") ?? ""));
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("menu")).toHaveCount(0);
  return labels;
}

test("every menu and menu item receives real Windows mouse clicks", async () => {
  test.skip(process.platform !== "win32", "Window-drag regions are a Windows title bar feature");
  const { app, page } = launched;
  // Ask Windows how it would handle a real click at each point (WM_NCHITTEST):
  // 1 = the page gets the click, 2 = the click would drag the window instead.
  const hwnd = await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0].getNativeWindowHandle().readBigInt64LE(0).toString(),
  );
  const hitTest = async (points: [number, number][]) => {
    const content = await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0].getContentBounds(),
    );
    const zoom = await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0].webContents.getZoomFactor(),
    );
    const list = points
      .map(([x, y]) => `${Math.round(content.x + x * zoom)},${Math.round(content.y + y * zoom)}`)
      .join(";");
    const output = execFileSync(
      "powershell.exe",
      [
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        path.resolve("tests", "e2e", "win32-hit-test.ps1"),
        "-Hwnd",
        hwnd,
        "-Points",
        list,
      ],
      { encoding: "utf8", windowsHide: true },
    );
    return output.trim().split(",").map(Number);
  };
  const center = (box: { x: number; y: number; width: number; height: number } | null) =>
    [box!.x + box!.width / 2, box!.y + box!.height / 2] as [number, number];

  // The empty part of the title bar still moves the window, as it should.
  const spacer = await page.locator(".titlebar-spacer").first().boundingBox();
  expect(await hitTest([center(spacer)])).toEqual([2]);

  const buttons = page.locator(".menubar-item");
  for (let i = 0; i < (await buttons.count()); i++) {
    const button = buttons.nth(i);
    expect(await hitTest([center(await button.boundingBox())])).toEqual([1]);
    await button.click();
    const items = page.getByTestId("menu").locator("button");
    const points: [number, number][] = [];
    for (let j = 0; j < (await items.count()); j++)
      points.push(center(await items.nth(j).boundingBox()));
    expect(points.length).toBeGreaterThan(2);
    // Every item must be clickable (in v0.3.0 every item answered 2).
    expect(await hitTest(points)).toEqual(points.map(() => 1));
    await page.keyboard.press("Escape");
  }
});

test("the menus contain every requested command", async () => {
  const { page } = launched;
  const required: Record<string, string[]> = {
    File: [
      "New Text File",
      "New File…",
      "New Folder…",
      "Open File…",
      "Open Folder…",
      "Save",
      "Save As…",
      "Save All",
      "Auto Save",
      "Close Editor",
      "Exit",
    ],
    Edit: ["Undo", "Redo", "Cut", "Copy", "Paste", "Find", "Replace", "Select All"],
    Selection: [
      "Select All",
      "Select Line",
      "Expand Selection",
      "Shrink Selection",
      "Add Cursor Above",
      "Add Cursor Below",
    ],
    View: [
      "Explorer",
      "Search",
      "Source Control",
      "Run and Debug",
      "Terminal",
      "Toggle Sidebar",
      "Zoom In",
      "Zoom Out",
      "Reset Zoom",
    ],
    Go: ["Go to File…", "Go to Line…", "Go to Symbol in Editor…", "Go to Definition"],
    Run: ["Run Current File", "Start Debugging", "Stop Running Program"],
    Terminal: ["New Terminal", "Split Terminal", "Clear Terminal", "Close Terminal"],
    Help: ["Documentation", "Keyboard Shortcuts", "About CodeForge"],
  };
  for (const [menu, items] of Object.entries(required)) {
    expect(await menuLabels(page, menu)).toEqual(expect.arrayContaining(items));
  }
  // Shortcuts are shown next to the items.
  await page.getByTestId("menubar-file").click();
  await expect(page.getByRole("menuitem", { name: "Save", exact: true })).toHaveAttribute(
    "aria-keyshortcuts",
    "Ctrl+S",
  );
});

test("File menu: new file, Save As, Auto Save toggle and Exit (asks about unsaved changes)", async () => {
  const { app, page, userData } = launched;
  const project = makeProject({ "keep.txt": "keep" });
  await openFolder(app, page, project);

  await runMenuItem(page, "File", "New Text File");
  await expect(page.getByRole("tab", { name: "Untitled-1" })).toBeVisible();
  await page.keyboard.type("hello from the menu");
  const target = path.join(project, "saved.txt");
  await answerSaveDialog(app, target);
  await runMenuItem(page, "File", "Save As…");
  await expect(page.getByRole("tab", { name: "saved.txt" })).toBeVisible();
  expect(readFileSync(target, "utf8")).toBe("hello from the menu");

  // Auto Save is a checkable menu item stored in the settings.
  await page.getByTestId("menubar-file").click();
  await expect(page.getByRole("menuitemcheckbox", { name: "Auto Save" })).toHaveAttribute(
    "aria-checked",
    "false",
  );
  await page.getByRole("menuitemcheckbox", { name: "Auto Save" }).click();
  await expect(page.getByTestId("autosave-toggle")).toHaveText("Auto Save: On");
  await expect
    .poll(
      () =>
        JSON.parse(readFileSync(path.join(userData, "settings.json"), "utf8"))["files.autoSave"],
    )
    .toBe("afterDelay");
  await runMenuItem(page, "File", "Auto Save");
  await expect(page.getByTestId("autosave-toggle")).toHaveText("Auto Save: Off");

  // Exit with unsaved changes asks first; Cancel keeps CodeForge open.
  await page.locator(".monaco-editor .view-lines").first().click();
  await page.keyboard.type(" (more)");
  await answerMessageBoxes(app, 2); // "Cancel"
  await runMenuItem(page, "File", "Exit");
  await expect
    .poll(() => shownMessages(app))
    .toEqual(["Do you want to save the changes you made to saved.txt?"]);
  await expect(page.locator(".workbench")).toBeVisible();

  // "Don't Save" exits.
  await answerMessageBoxes(app, 1);
  const closed = app.waitForEvent("close");
  await page.getByTestId("menubar-file").click();
  await page.getByRole("menuitem", { name: "Exit", exact: true }).click();
  await closed;
  expect(readFileSync(target, "utf8")).toBe("hello from the menu");
});

test("Edit, Selection, Go and View menus act on the editor and the window", async () => {
  const { app, page, userData } = launched;
  const project = makeProject({ "sample.txt": "alpha beta\ngamma\n" });
  await openFolder(app, page, project);
  await openFileFromExplorer(page, "sample.txt");
  await page.locator(".monaco-editor .view-lines").first().click();
  await page.keyboard.press("Control+Home");

  await runMenuItem(page, "Selection", "Select Line");
  await expect(page.locator(".statusbar")).toContainText("(11 selected)");
  await runMenuItem(page, "Edit", "Select All");
  await expect(page.locator(".statusbar")).toContainText("(17 selected)");

  await page.keyboard.press("Control+End");
  await page.keyboard.type("X");
  await runMenuItem(page, "Edit", "Undo");
  await expect(page.locator(".monaco-editor .view-lines").first()).not.toContainText("X");

  await runMenuItem(page, "Edit", "Find");
  await expect(page.locator(".find-widget.visible")).toBeVisible();
  await page.keyboard.press("Escape");

  await runMenuItem(page, "Go", "Go to Line…");
  await page.keyboard.type("2");
  await page.keyboard.press("Enter");
  await expect(page.locator(".statusbar")).toContainText("Ln 2, Col 1");

  await runMenuItem(page, "View", "Toggle Sidebar");
  await expect(page.locator(".sidebar")).toHaveCount(0);
  await runMenuItem(page, "View", "Toggle Sidebar");
  await expect(page.locator(".sidebar")).toHaveCount(1);
  await runMenuItem(page, "View", "Run and Debug");
  await expect(page.getByTestId("run-view")).toBeVisible();
  await runMenuItem(page, "View", "Explorer");
  await expect(page.getByTestId("explorer-tree")).toBeVisible();

  // Zoom scales the whole window and is remembered.
  const zoom = () =>
    app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0].webContents.getZoomLevel(),
    );
  await runMenuItem(page, "View", "Zoom In");
  await expect.poll(zoom).toBe(1);
  expect(
    JSON.parse(readFileSync(path.join(userData, "settings.json"), "utf8"))["window.zoomLevel"],
  ).toBe(1);
  await runMenuItem(page, "View", "Zoom Out");
  await runMenuItem(page, "View", "Zoom Out");
  await expect.poll(zoom).toBe(-1);
  await runMenuItem(page, "View", "Reset Zoom");
  await expect.poll(zoom).toBe(0);
  // ...and the same with the keyboard.
  await page.keyboard.press("Control+=");
  await expect.poll(zoom).toBe(1);
  await page.keyboard.press("Control+0");
  await expect.poll(zoom).toBe(0);
});

test("Help menu: documentation, keyboard shortcuts and About", async () => {
  const { app, page } = launched;
  await captureExternalLinks(app);
  await runMenuItem(page, "Help", "Documentation");
  await expect.poll(() => openedLinks(app)).toEqual(["https://codeforge318.vercel.app/docs"]);

  await runMenuItem(page, "Help", "Keyboard Shortcuts");
  const shortcuts = page.getByTestId("shortcuts-page");
  await expect(shortcuts).toBeVisible();
  await shortcuts.getByLabel("Search keyboard shortcuts").fill("save as");
  await expect(shortcuts.getByRole("row").filter({ hasText: "Save As…" })).toContainText(
    "Ctrl+Shift+S",
  );

  await answerMessageBoxes(app, 0);
  await runMenuItem(page, "Help", "About CodeForge");
  await expect
    .poll(async () => (await shownMessages(app))[0] ?? "")
    .toMatch(/^CodeForge \d+\.\d+\.\d+/);
});

test("menu commands explain why they can't run instead of doing nothing", async () => {
  const { page } = launched;
  await runMenuItem(page, "Edit", "Undo");
  await expect(lastToast(page)).toContainText("Undo needs an open file");
  await runMenuItem(page, "File", "Save");
  await expect(lastToast(page)).toContainText("There is no open file to save");
  await runMenuItem(page, "Run", "Stop Running Program");
  await expect(lastToast(page)).toContainText("No program is running.");
  await runMenuItem(page, "Terminal", "Close Terminal");
  await expect(lastToast(page)).toContainText("There is no terminal to close.");
  await runMenuItem(page, "Run", "Run Current File");
  await expect(lastToast(page)).toContainText("Open a file to run it.");
  await runMenuItem(page, "File", "New Folder…");
  await expect(lastToast(page)).toContainText("Open a folder first");
});

test("menus work from the keyboard: Alt+letter, arrows and Escape", async () => {
  test.skip(process.platform === "darwin", "macOS uses the system menu bar");
  const { page } = launched;
  await page.keyboard.press("Alt+F");
  await expect(page.getByRole("menu", { name: "File" })).toBeVisible();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("menu", { name: "Edit" })).toBeVisible();
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowLeft");
  await expect(page.getByRole("menu", { name: "Help" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("menu")).toHaveCount(0);

  // Enter runs the focused item: Help > Keyboard Shortcuts is the second entry.
  await page.keyboard.press("Alt+H");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("shortcuts-page")).toBeVisible();
});
