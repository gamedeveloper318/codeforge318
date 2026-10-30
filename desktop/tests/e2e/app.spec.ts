import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import {
  answerMessageBoxes,
  git,
  launchApp,
  makeProject,
  openFileFromExplorer,
  openFolder,
  shownMessages,
  typeInEditor,
  type LaunchedApp,
} from "./helpers";

let launched: LaunchedApp;

test.beforeEach(async () => {
  launched = await launchApp();
});

test.afterEach(async () => {
  // Answer "Don't Save" to any leftover prompt so the window can close.
  await answerMessageBoxes(launched.app, 1).catch(() => undefined);
  await launched.app.close();
});

test("shows the CodeForge welcome page", async () => {
  const { page } = launched;
  await expect(page.getByRole("heading", { name: "CodeForge" })).toBeVisible();
  await expect(page.getByText("Your Code. Your Workspace. Your Power.")).toBeVisible();
  await expect(page).toHaveTitle(/CodeForge/);
});

test("keeps Node.js and the filesystem out of reach of the page", async () => {
  const { app, page } = launched;
  const exposed = await page.evaluate(() => ({
    require: typeof (window as unknown as { require?: unknown }).require,
    process: typeof (window as unknown as { process?: unknown }).process,
    bridge: Object.keys(window.codeforge).sort(),
  }));
  expect(exposed.require).toBe("undefined");
  expect(exposed.process).toBe("undefined");
  expect(exposed.bridge).toEqual(["invoke", "on", "platform", "send"]);

  const project = makeProject({ "inside.txt": "ok" });
  await openFolder(app, page, project);
  const outsidePath = path.join(path.dirname(project), "definitely-outside.txt");
  const error = await page.evaluate(
    (p) =>
      window.codeforge.invoke("fs:read-file", p).then(
        () => "no error",
        (e: Error) => e.message,
      ),
    outsidePath,
  );
  expect(error).toMatch(/outside the open folder/);
  const blocked = await page.evaluate(() =>
    (window.codeforge.invoke as (c: string) => Promise<unknown>)("not:a-channel").then(
      () => "no error",
      (e: Error) => e.message,
    ),
  );
  expect(blocked).toMatch(/Blocked IPC channel/);
});

test("opens a folder, edits a file and saves it to disk", async () => {
  const { app, page } = launched;
  const project = makeProject({ "hello.txt": "Hello", "src/app.ts": "export const x = 1;\n" });
  await openFolder(app, page, project);

  await openFileFromExplorer(page, "hello.txt");
  await typeInEditor(page, " World");
  await expect(page.getByTestId("dirty-indicator")).toBeVisible();
  expect(readFileSync(path.join(project, "hello.txt"), "utf8")).toBe("Hello");

  await page.keyboard.press("Control+S");
  await expect(page.getByTestId("dirty-indicator")).toHaveCount(0);
  expect(readFileSync(path.join(project, "hello.txt"), "utf8")).toBe("Hello World");

  // A second tab for a TypeScript file gets syntax highlighting.
  await page.getByTestId("explorer-tree").getByRole("treeitem", { name: "src" }).click();
  await openFileFromExplorer(page, "app.ts");
  await expect(page.getByTestId("editor-tab")).toHaveCount(2);
  await expect(
    page
      .locator(".monaco-editor .view-lines .mtk1, .monaco-editor .view-lines [class*='mtk']")
      .first(),
  ).toBeVisible();
});

test("asks before closing a tab with unsaved changes", async () => {
  const { app, page } = launched;
  const project = makeProject({ "draft.md": "# Draft" });
  await openFolder(app, page, project);
  await openFileFromExplorer(page, "draft.md");
  await typeInEditor(page, "\nunsaved line");

  await answerMessageBoxes(app, 1); // "Don't Save"
  await page.keyboard.press("Control+W");
  await expect(page.getByTestId("editor-tab")).toHaveCount(0);
  expect(await shownMessages(app)).toEqual([
    "Do you want to save the changes you made to draft.md?",
  ]);
  expect(readFileSync(path.join(project, "draft.md"), "utf8")).toBe("# Draft");
});

test("creates, renames and deletes files from the explorer", async () => {
  const { app, page } = launched;
  const project = makeProject({ "keep.txt": "keep" });
  await openFolder(app, page, project);

  await page.getByTitle("New File").click();
  await page.getByLabel("New file name").fill("notes/todo.md");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("tab", { name: "todo.md" })).toBeVisible();
  expect(existsSync(path.join(project, "notes", "todo.md"))).toBe(true);

  await page.getByTestId("explorer-tree").getByRole("treeitem", { name: "keep.txt" }).click();
  await page.keyboard.press("F2");
  await page.getByLabel("New name").fill("renamed.txt");
  await page.keyboard.press("Enter");
  await expect(
    page.getByTestId("explorer-tree").getByRole("treeitem", { name: "renamed.txt" }),
  ).toBeVisible();
  expect(existsSync(path.join(project, "renamed.txt"))).toBe(true);
  expect(existsSync(path.join(project, "keep.txt"))).toBe(false);

  await answerMessageBoxes(app, 0); // "Move to Trash"
  await page.getByTestId("explorer-tree").getByRole("treeitem", { name: "renamed.txt" }).click();
  await page.keyboard.press("Delete");
  await expect(
    page.getByTestId("explorer-tree").getByRole("treeitem", { name: "renamed.txt" }),
  ).toHaveCount(0);
  expect(existsSync(path.join(project, "renamed.txt"))).toBe(false);
});

test("runs real commands in the integrated terminal", async () => {
  const { app, page } = launched;
  const project = makeProject({ "README.md": "terminal test" });
  await openFolder(app, page, project);

  await page.keyboard.press("Control+`");
  const terminal = page.getByTestId("terminal");
  await expect(terminal.locator(".xterm")).toBeVisible();
  await terminal.click();
  const command =
    process.platform === "win32" ? 'Write-Output ("cf-" + (20 + 22))' : 'echo "cf-$((20 + 22))"';
  await page.keyboard.type(command);
  await page.keyboard.press("Enter");
  // Only a real shell evaluating the expression prints "cf-42".
  await expect(terminal.locator(".xterm-rows")).toContainText("cf-42", { timeout: 30_000 });
});

test("shows Git changes and commits them", async () => {
  const { app, page } = launched;
  const project = makeProject({ "tracked.txt": "v1\n" });
  git(project, "init", "-q");
  git(project, "config", "user.email", "e2e@codeforge.local");
  git(project, "config", "user.name", "CodeForge E2E");
  git(project, "add", ".");
  git(project, "commit", "-q", "-m", "first");
  await openFolder(app, page, project);

  await openFileFromExplorer(page, "tracked.txt");
  await typeInEditor(page, "v2\n");
  await page.keyboard.press("Control+S");
  await page.getByTitle("New File").click();
  await page.getByLabel("New file name").fill("added.txt");
  await page.keyboard.press("Enter");

  await page.keyboard.press("Control+Shift+G");
  const changes = page.getByTestId("scm-unstaged");
  await expect(changes.getByText("tracked.txt")).toBeVisible();
  await expect(changes.getByText("added.txt")).toBeVisible();

  await changes.getByText("tracked.txt").click();
  await expect(page.getByTestId("diff-editor")).toBeVisible();

  await page.getByLabel("Commit message").fill("Second commit from CodeForge");
  await answerMessageBoxes(app, 0); // "Stage All & Commit"
  await page.getByRole("button", { name: "Commit", exact: true }).click();
  await expect(page.getByText("No changes. Your working tree is clean.")).toBeVisible();
  expect(git(project, "log", "--format=%s")).toContain("Second commit from CodeForge");
});

test("searches across files and opens a result", async () => {
  const { app, page } = launched;
  const project = makeProject({
    "a.ts": "const needle = 1;\n",
    "b/c.js": "// needle here\n",
    "node_modules/x/index.js": "needle",
  });
  await openFolder(app, page, project);

  await page.keyboard.press("Control+Shift+F");
  await page.getByLabel("Search text").fill("needle");
  const results = page.getByTestId("search-results");
  await expect(page.getByText("2 results in 2 files")).toBeVisible();
  await expect(results).not.toContainText("index.js");
  await results.locator(".search-match").first().click();
  await expect(page.getByTestId("editor-tab")).toHaveCount(1);
});

test("quick open and the command palette", async () => {
  const { app, page } = launched;
  const project = makeProject({
    "src/components/Button.tsx": "export {};\n",
    "package.json": "{}",
  });
  await openFolder(app, page, project);

  await page.keyboard.press("Control+P");
  await page.keyboard.type("buttsx");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("tab", { name: "Button.tsx" })).toBeVisible();

  await page.keyboard.press("Control+Shift+P");
  await page.keyboard.type("toggle light dark");
  await page.keyboard.press("Enter");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});

test("saves settings to disk", async () => {
  const { page, userData } = launched;
  await page.keyboard.press("Control+,");
  const fontSize = page.getByLabel("Font size", { exact: true });
  await fontSize.fill("17");
  await fontSize.press("Enter");
  await expect
    .poll(() => {
      try {
        return JSON.parse(readFileSync(path.join(userData, "settings.json"), "utf8"))[
          "editor.fontSize"
        ];
      } catch {
        return null;
      }
    })
    .toBe(17);
});

test("shows TypeScript hover information and diagnostics", async () => {
  const { app, page } = launched;
  const project = makeProject({
    "math.ts":
      "export function add(a: number, b: number) {\n  return a + b;\n}\n\nconst total: number = add(1, 2);\nconst wrong: number = 'text';\n",
  });
  await openFolder(app, page, project);
  await openFileFromExplorer(page, "math.ts");

  // Put the cursor inside "add" on line 1 ("export function add(" -> column 17)
  // and use Monaco's Show Hover shortcut. Hover content is rendered through
  // Monaco's markdown renderer and DOMPurify.
  await page.locator(".monaco-editor .view-lines").first().click();
  await page.keyboard.press("Control+Home");
  for (let i = 0; i < 17; i++) await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Control+K");
  await page.keyboard.press("Control+I");
  await expect(
    page
      .locator(".monaco-hover")
      .filter({ hasText: "function add(a: number, b: number): number" })
      .first(),
  ).toBeVisible({ timeout: 20_000 });

  // The real type error is reported in the Problems panel.
  await page.keyboard.press("Control+Shift+M");
  await expect(page.getByTestId("problems")).toContainText("is not assignable to type 'number'");
});

test("Python IntelliSense from Pyright: errors, hover and completion", async () => {
  const { app, page } = launched;
  const project = makeProject({
    "app.py":
      "import os\n\n\ndef greet(name: str) -> str:\n    return 'Hello ' + name\n\n\ncount: int = 'oops'\nprint(greet('CodeForge'))\n",
  });
  await openFolder(app, page, project);
  await openFileFromExplorer(page, "app.py");

  // A real type error, reported by the language server in the Problems panel.
  await page.keyboard.press("Control+Shift+M");
  await expect(page.getByTestId("problems")).toContainText(
    /not assignable to declared type "int"/,
    {
      timeout: 60_000,
    },
  );

  // Hover over "greet" (line 4, "def greet(" -> column 5).
  await page.locator(".monaco-editor .view-lines").first().click();
  await page.keyboard.press("Control+Home");
  for (let i = 0; i < 3; i++) await page.keyboard.press("ArrowDown");
  for (let i = 0; i < 5; i++) await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Control+K");
  await page.keyboard.press("Control+I");
  await expect(
    page.locator(".monaco-hover").filter({ hasText: "def greet(name: str) -> str" }).first(),
  ).toBeVisible({ timeout: 30_000 });
  await page.keyboard.press("Escape");

  // Completion after "os." comes from the language server.
  await page.keyboard.press("Control+End");
  await page.keyboard.type("os.pa");
  await expect(
    page.locator(".suggest-widget .monaco-list-row").filter({ hasText: "path" }).first(),
  ).toBeVisible({ timeout: 30_000 });
});

test("replaces across files: on disk, and in open editors with undo", async () => {
  const { app, page } = launched;
  const project = makeProject({
    "a.txt": "foo one\nfoo two\n",
    "b/c.txt": "say foo\n",
    "open.txt": "foo open\n",
  });
  await openFolder(app, page, project);
  await openFileFromExplorer(page, "open.txt");

  await page.keyboard.press("Control+Shift+F");
  await page.getByLabel("Search text").fill("foo");
  await expect(page.getByText("4 results in 3 files")).toBeVisible();
  await page.getByRole("button", { name: "Toggle Replace" }).click();
  await page.getByLabel("Replace text").fill("bar");
  // The results preview the change.
  await expect(page.getByTestId("search-results").locator("ins").first()).toHaveText("bar");

  await answerMessageBoxes(app, 0); // "Replace"
  await page.getByRole("button", { name: "Replace All" }).click();
  await expect(page.getByText(/No results in/)).toBeVisible();
  expect(await shownMessages(app)).toEqual(["Replace 4 occurrences in 3 files with “bar”?"]);

  // Files that were not open are changed on disk.
  expect(readFileSync(path.join(project, "a.txt"), "utf8")).toBe("bar one\nbar two\n");
  expect(readFileSync(path.join(project, "b", "c.txt"), "utf8")).toBe("say bar\n");
  // The open file is changed in the editor and left unsaved.
  expect(readFileSync(path.join(project, "open.txt"), "utf8")).toBe("foo open\n");
  await expect(page.getByTestId("dirty-indicator")).toBeVisible();
  await expect(page.locator(".monaco-editor .view-lines").first()).toContainText("bar open");
  await page.locator(".monaco-editor .view-lines").first().click();
  await page.keyboard.press("Control+S");
  await expect(page.getByTestId("dirty-indicator")).toHaveCount(0);
  expect(readFileSync(path.join(project, "open.txt"), "utf8")).toBe("bar open\n");
});

test("splits the terminal into side-by-side real shells", async () => {
  const { app, page } = launched;
  const project = makeProject({ "README.md": "split test" });
  await openFolder(app, page, project);

  await page.keyboard.press("Control+`");
  const panes = page.getByTestId("terminal-pane");
  await expect(panes).toHaveCount(1);
  await expect(panes.first().locator(".xterm")).toBeVisible();
  await page.keyboard.press("Control+Shift+5");
  await expect(panes).toHaveCount(2);

  // The new (right) pane is active: a command typed there runs there only.
  await panes.nth(1).click();
  const command =
    process.platform === "win32" ? 'Write-Output ("pane-" + (40 + 2))' : 'echo "pane-$((40 + 2))"';
  await page.keyboard.type(command);
  await page.keyboard.press("Enter");
  await expect(panes.nth(1).locator(".xterm-rows")).toContainText("pane-42", { timeout: 30_000 });
  await expect(panes.nth(0).locator(".xterm-rows")).not.toContainText("pane-42");

  await page.keyboard.press("Control+Shift+P");
  await page.keyboard.type("kill active terminal");
  await page.keyboard.press("Enter");
  await expect(panes).toHaveCount(1);
});

test("update notifications and the Check for Updates command", async () => {
  const { app, page } = launched;
  // Tests run with updates turned off, so a manual check explains that.
  await page.keyboard.press("Control+Shift+P");
  await page.keyboard.type("check for updates");
  await page.keyboard.press("Enter");
  await expect(page.locator(".toast").last()).toContainText("Automatic updates aren't available");

  // Simulate the main process finishing a background download.
  await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0].webContents.send("update:status", {
      state: "ready",
      version: "9.9.9",
    }),
  );
  await expect(page.getByTestId("restart-to-update")).toContainText("9.9.9");
  const notice = page.locator(".toast", { hasText: "CodeForge 9.9.9 is ready to install" });
  await expect(notice).toBeVisible();
  await notice.getByRole("button", { name: "Later" }).click();
  await expect(notice).toHaveCount(0);
  // The status bar keeps offering the restart.
  await expect(page.getByTestId("restart-to-update")).toBeVisible();
});
