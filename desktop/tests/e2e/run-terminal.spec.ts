import { expect, test, type Page } from "@playwright/test";
import {
  answerMessageBoxes,
  launchApp,
  makeProject,
  openFileFromExplorer,
  openFolder,
  runMenuItem,
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

const panes = (page: Page) => page.getByTestId("terminal-pane");
const activePaneText = (page: Page) => page.getByTestId("terminal").locator(".xterm-rows");

test("terminal menu: PowerShell by default, Command Prompt on request, clear and close", async () => {
  test.skip(process.platform !== "win32", "PowerShell and Command Prompt are Windows shells");
  const { app, page } = launched;
  const project = makeProject({ "README.md": "terminals" });
  await openFolder(app, page, project);

  await runMenuItem(page, "Terminal", "New Terminal");
  await expect(panes(page)).toHaveCount(1);
  await panes(page).first().click();
  await page.keyboard.type('Write-Output ("ps-" + (20 + 22))');
  await page.keyboard.press("Enter");
  await expect(activePaneText(page)).toContainText("ps-42", { timeout: 30_000 });

  await runMenuItem(page, "Terminal", "New Terminal With Profile…");
  await page.keyboard.type("Command Prompt");
  await page.keyboard.press("Enter");
  const list = page.getByRole("listbox", { name: "Terminals" });
  await expect(list.getByRole("option", { name: /Command Prompt/ })).toBeVisible();
  await panes(page).first().click();
  // Only cmd.exe's FOR loop turns "%i" into 42.
  await page.keyboard.type("for /L %i in (42,1,42) do @echo cmd-%i");
  await page.keyboard.press("Enter");
  await expect(activePaneText(page)).toContainText("cmd-42", { timeout: 30_000 });

  await runMenuItem(page, "Terminal", "Clear Terminal");
  await expect(activePaneText(page)).not.toContainText("cmd-42");

  await runMenuItem(page, "Terminal", "Split Terminal");
  await expect(panes(page)).toHaveCount(2);
  await runMenuItem(page, "Terminal", "Close Terminal");
  await expect(panes(page)).toHaveCount(1);
  await runMenuItem(page, "Terminal", "Close Terminal");
  await runMenuItem(page, "Terminal", "Close Terminal");
  await expect(panes(page)).toHaveCount(0);
});

test("Run Current File runs Python and JavaScript files and shows how they ended", async () => {
  const { app, page } = launched;
  const project = makeProject({
    "hello.py": 'print("py-" + str(40 + 2))\n',
    "hello.js": 'console.log("js-" + (40 + 2));\nprocess.exitCode = 3;\n',
  });
  await openFolder(app, page, project);

  await openFileFromExplorer(page, "hello.py");
  await runMenuItem(page, "Run", "Run Current File");
  await expect(activePaneText(page)).toContainText("py-42", { timeout: 30_000 });
  await expect(activePaneText(page)).toContainText("program exited with code 0");

  await openFileFromExplorer(page, "hello.js");
  await page.keyboard.press("Control+F5");
  await expect(activePaneText(page)).toContainText("js-42", { timeout: 30_000 });
  await expect(activePaneText(page)).toContainText("program exited with code 3");
});

test("Stop Running Program ends a program that keeps running", async () => {
  const { app, page } = launched;
  const project = makeProject({
    "forever.js": 'setInterval(() => console.log("tick"), 200);\n',
  });
  await openFolder(app, page, project);
  await openFileFromExplorer(page, "forever.js");
  await runMenuItem(page, "Run", "Run Current File");
  await expect(activePaneText(page)).toContainText("tick", { timeout: 30_000 });

  await runMenuItem(page, "Run", "Stop Running Program");
  await expect(page.locator(".toast", { hasText: "Stopped forever.js" })).toBeVisible();
  await expect(page.locator(".terminal-exited-banner")).toBeVisible();
  await runMenuItem(page, "Run", "Stop Running Program");
  await expect(page.locator(".toast").last()).toContainText("No program is running.");
});

test("Start Debugging opens the Python debugger (pdb) in the terminal", async () => {
  const { app, page } = launched;
  const project = makeProject({ "debug_me.py": "total = 40\ntotal += 2\nprint(total)\n" });
  await openFolder(app, page, project);
  await openFileFromExplorer(page, "debug_me.py");
  await page.keyboard.press("F5");
  await expect(activePaneText(page)).toContainText("(Pdb)", { timeout: 30_000 });
  await expect(page.locator(".toast", { hasText: "Debugging debug_me.py" })).toContainText(
    "n = next line",
  );
  // Step twice, then print the variable from the debugger.
  await panes(page).first().click();
  for (const command of ["n", "n", "p total"]) {
    await page.keyboard.type(command);
    await page.keyboard.press("Enter");
  }
  await expect(activePaneText(page)).toContainText("42", { timeout: 15_000 });
  await page.keyboard.press("Shift+F5");
  await expect(page.locator(".terminal-exited-banner")).toBeVisible({ timeout: 15_000 });
});

test("Start Debugging opens node inspect for JavaScript", async () => {
  const { app, page } = launched;
  const project = makeProject({ "debug_me.js": "const answer = 42;\nconsole.log(answer);\n" });
  await openFolder(app, page, project);
  await openFileFromExplorer(page, "debug_me.js");
  await runMenuItem(page, "Run", "Start Debugging");
  await expect(activePaneText(page)).toContainText("debug>", { timeout: 30_000 });
  await runMenuItem(page, "Run", "Stop Running Program");
  await expect(page.locator(".terminal-exited-banner")).toBeVisible({ timeout: 15_000 });
});

test("Run explains files it can't run instead of failing in the terminal", async () => {
  const { app, page } = launched;
  const project = makeProject({
    "main.c": "int main(void) { return 0; }\n",
    "notes.md": "# Notes\n",
  });
  await openFolder(app, page, project);
  await openFileFromExplorer(page, "main.c");
  await runMenuItem(page, "Run", "Run Current File");
  await expect(page.locator(".toast").last()).toContainText("must be compiled first");
  await runMenuItem(page, "Run", "Start Debugging");
  await expect(page.locator(".toast").last()).toContainText("Debugging is available for Python");
  await expect(panes(page)).toHaveCount(0);
});
