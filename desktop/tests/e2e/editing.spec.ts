import { chmodSync, readFileSync } from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import {
  answerMessageBoxes,
  launchApp,
  makeProject,
  openFileFromExplorer,
  openFolder,
  type LaunchedApp,
} from "./helpers";

let launched: LaunchedApp | undefined;

test.afterEach(async () => {
  if (!launched) return;
  await answerMessageBoxes(launched.app, 1).catch(() => undefined);
  await launched.app.close().catch(() => undefined);
  launched = undefined;
});

const editorText = (page: Page) => page.locator(".monaco-editor .view-lines").first();
const suggestions = (page: Page) => page.locator(".suggest-widget.visible .monaco-list-row");

async function typeAtEnd(page: Page, text: string): Promise<void> {
  await editorText(page).click();
  await page.keyboard.press("Control+End");
  await page.keyboard.type(text);
}

/** The rendered color of the first editor token that contains `text`. */
async function colorContaining(page: Page, text: string): Promise<string> {
  return page.evaluate((t) => {
    for (const span of document.querySelectorAll(".view-lines span span"))
      if (span.textContent?.includes(t)) return getComputedStyle(span).color;
    return "not found";
  }, text);
}

/** The rendered color of the first occurrence of `word` in the editor. */
async function colorOf(page: Page, word: string): Promise<string> {
  return page.evaluate((w) => {
    for (const span of document.querySelectorAll(".view-lines span span"))
      if (span.textContent?.trim() === w) return getComputedStyle(span).color;
    return "not found";
  }, word);
}

test("Auto Save is on by default and writes changes without Ctrl+S", async () => {
  // No settings: the defaults a new user gets.
  launched = await launchApp({ settings: { "files.autoSave": "afterDelay" } });
  const { app, page } = launched;
  const project = makeProject({ "notes.txt": "first" });
  const file = path.join(project, "notes.txt");
  await openFolder(app, page, project);
  await openFileFromExplorer(page, "notes.txt");
  await expect(page.getByTestId("autosave-toggle")).toHaveText("Auto Save: On");

  await typeAtEnd(page, " second");
  await expect.poll(() => readFileSync(file, "utf8"), { timeout: 10_000 }).toBe("first second");
  await expect(page.getByTestId("save-status")).toContainText("Saved");
  await expect(page.getByTestId("dirty-indicator")).toHaveCount(0);

  // Turned off from the status bar: changes stay unsaved.
  await page.getByTestId("autosave-toggle").click();
  await expect(page.getByTestId("autosave-toggle")).toHaveText("Auto Save: Off");
  await typeAtEnd(page, " third");
  await page.waitForTimeout(2500);
  expect(readFileSync(file, "utf8")).toBe("first second");
  await expect(page.getByTestId("save-status")).toContainText("Unsaved");

  // Turned back on: the pending change is saved.
  await page.getByTestId("autosave-toggle").click();
  await expect
    .poll(() => readFileSync(file, "utf8"), { timeout: 10_000 })
    .toBe("first second third");
});

test("a failed auto save keeps the changes, explains why once, and can be retried", async () => {
  launched = await launchApp({ settings: { "files.autoSave": "afterDelay" } });
  const { app, page } = launched;
  const project = makeProject({ "locked.txt": "original" });
  const file = path.join(project, "locked.txt");
  await openFolder(app, page, project);
  await openFileFromExplorer(page, "locked.txt");
  chmodSync(file, 0o444); // read-only
  try {
    await typeAtEnd(page, " edited");
    const failure = page.locator(".toast", { hasText: "Auto Save couldn't save locked.txt" });
    await expect(failure).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("save-status")).toContainText("Save failed");
    await expect(page.getByTestId("dirty-indicator")).toBeVisible();
    expect(readFileSync(file, "utf8")).toBe("original");

    // Further edits retry quietly: no loop of error messages.
    await typeAtEnd(page, "!");
    await page.waitForTimeout(2500);
    await expect(failure).toHaveCount(1);

    chmodSync(file, 0o666);
    await failure.getByRole("button", { name: "Retry" }).click();
    await expect.poll(() => readFileSync(file, "utf8")).toBe("original edited!");
    await expect(page.getByTestId("save-status")).toContainText("Saved");
  } finally {
    chmodSync(file, 0o666);
  }
});

test("edits in several files are kept while switching between tabs", async () => {
  launched = await launchApp();
  const { app, page } = launched;
  const project = makeProject({ "a.txt": "A", "b.txt": "B" });
  await openFolder(app, page, project);
  await openFileFromExplorer(page, "a.txt");
  await typeAtEnd(page, "-edited-a");
  await openFileFromExplorer(page, "b.txt");
  await typeAtEnd(page, "-edited-b");
  await page.getByRole("tab", { name: "a.txt" }).click();
  await expect(editorText(page)).toContainText("A-edited-a");
  await page.getByRole("tab", { name: "b.txt" }).click();
  await expect(editorText(page)).toContainText("B-edited-b");
  await expect(page.getByTestId("dirty-indicator")).toHaveCount(2);
});

test("language icons in the explorer and tabs follow the file name", async () => {
  launched = await launchApp();
  const { app, page } = launched;
  const project = makeProject({
    "test.py": "print(1)\n",
    "test.html": "<p>hi</p>\n",
    "app.js": "",
    "App.tsx": "",
    "style.css": "",
    "data.json": "{}",
    "Main.java": "",
    "notes.txt": "plain",
    "unknown.zzz": "",
  });
  await openFolder(app, page, project);
  const iconOf = (name: string) =>
    page
      .getByTestId("explorer-tree")
      .getByRole("treeitem", { name, exact: true })
      .locator("img.file-icon")
      .getAttribute("data-icon");
  expect(await iconOf("test.py")).toBe("python");
  expect(await iconOf("test.html")).toBe("html");
  expect(await iconOf("app.js")).toBe("javascript");
  expect(await iconOf("App.tsx")).toBe("react_ts");
  expect(await iconOf("style.css")).toBe("css");
  expect(await iconOf("data.json")).toBe("json");
  expect(await iconOf("Main.java")).toBe("java");
  expect(await iconOf("unknown.zzz")).toBe("file");

  await openFileFromExplorer(page, "test.py");
  await expect(page.getByRole("tab", { name: "test.py" }).locator("img.file-icon")).toHaveAttribute(
    "data-icon",
    "python",
  );

  // Renaming notes.txt to notes.py changes its icon and its language.
  await openFileFromExplorer(page, "notes.txt");
  await expect(page.getByTestId("language-status")).toHaveText("Plain Text");
  await page.getByTestId("explorer-tree").getByRole("treeitem", { name: "notes.txt" }).click();
  await page.keyboard.press("F2");
  await page.getByLabel("New name").fill("notes.py");
  await page.keyboard.press("Enter");
  await expect.poll(() => iconOf("notes.py")).toBe("python");
  await expect(
    page.getByRole("tab", { name: "notes.py" }).locator("img.file-icon"),
  ).toHaveAttribute("data-icon", "python");
  await expect(page.getByTestId("language-status")).toHaveText("Python");
});

test("syntax highlighting colors each language, including functions, classes and parameters", async () => {
  launched = await launchApp();
  const { app, page } = launched;
  const project = makeProject({
    "shapes.py":
      'class Circle:\n    def area(self, radius):\n        return 3.14 * radius * radius\n\n\nprint(len("text"))\n',
    "shapes.js":
      'export function area(radius) {\n  const label = "circle";\n  return Math.round(radius * 2);\n}\n',
    "shapes.txt": "class Circle def area print",
  });
  await openFolder(app, page, project);
  const KEYWORD = "rgb(199, 146, 234)";
  const FUNCTION = "rgb(253, 230, 138)";
  const CLASS = "rgb(94, 234, 212)";
  const PARAMETER = "rgb(253, 186, 116)";
  const STRING = "rgb(165, 227, 160)";
  const PLAIN = "rgb(226, 232, 240)";

  await openFileFromExplorer(page, "shapes.py");
  await expect.poll(() => colorOf(page, "Circle")).toBe(CLASS);
  expect(await colorOf(page, "class")).toBe(KEYWORD);
  expect(await colorOf(page, "def")).toBe(KEYWORD);
  expect(await colorOf(page, "area")).toBe(FUNCTION);
  expect(await colorOf(page, "radius")).toBe(PARAMETER);
  expect(await colorOf(page, "print")).toBe(FUNCTION);
  expect(await colorContaining(page, "text")).toBe(STRING);

  await openFileFromExplorer(page, "shapes.js");
  await expect.poll(() => colorOf(page, "area")).toBe(FUNCTION);
  expect(await colorOf(page, "function")).toBe(KEYWORD);
  expect(await colorOf(page, "radius")).toBe(PARAMETER);
  expect(await colorOf(page, "round")).toBe(FUNCTION);

  // The same words in a plain text file are not colored as code.
  await openFileFromExplorer(page, "shapes.txt");
  await page.waitForTimeout(500);
  const text = await page.evaluate(() =>
    [...document.querySelectorAll(".view-lines span span")].map((s) => getComputedStyle(s).color),
  );
  expect(new Set(text)).toEqual(new Set([PLAIN]));
});

test("IntelliSense: suggestions while typing, accepted with Enter or Tab, dismissed with Escape", async () => {
  launched = await launchApp();
  const { app, page } = launched;
  const project = makeProject({
    "app.js": "",
    "index.html": "",
    "style.css": "",
    "Main.java": "",
  });
  await openFolder(app, page, project);

  await openFileFromExplorer(page, "app.js");
  await typeAtEnd(page, "cons");
  await expect(suggestions(page).filter({ hasText: "console" }).first()).toBeVisible();
  await page.keyboard.press("Enter");
  await page.keyboard.type(".lo");
  await expect(suggestions(page).filter({ hasText: "log" }).first()).toBeVisible();
  await page.keyboard.press("Tab");
  await expect(editorText(page)).toContainText("console.log");
  await page.keyboard.type("\nMath.ma");
  await expect(suggestions(page).filter({ hasText: "max" }).first()).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator(".suggest-widget.visible")).toHaveCount(0);

  await openFileFromExplorer(page, "index.html");
  await typeAtEnd(page, "<div");
  await expect(suggestions(page).first()).toContainText("div");
  await page.keyboard.press("Enter");
  await expect(editorText(page)).toContainText("<div");

  await openFileFromExplorer(page, "style.css");
  await typeAtEnd(page, "body { col");
  await expect(
    suggestions(page)
      .filter({ hasText: /^color/ })
      .first(),
  ).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(editorText(page)).toContainText("body { color");

  // Languages without a bundled language service get keywords and snippets.
  await openFileFromExplorer(page, "Main.java");
  await typeAtEnd(page, "publ");
  await expect(suggestions(page).filter({ hasText: "public" }).first()).toBeVisible();
  await page.keyboard.press("Tab");
  await expect(editorText(page)).toContainText("public");
});

test("Python IntelliSense suggests print and accepts it with Tab", async () => {
  launched = await launchApp();
  const { app, page } = launched;
  const project = makeProject({ "hello.py": "" });
  await openFolder(app, page, project);
  await openFileFromExplorer(page, "hello.py");
  await typeAtEnd(page, "pri");
  // The language server starts with the first Python file; until it is ready
  // there is nothing to suggest, so retype the last letter like a user would.
  await expect(async () => {
    if (!(await suggestions(page).filter({ hasText: "print" }).count())) {
      await page.keyboard.press("Escape");
      await page.keyboard.press("Backspace");
      await page.keyboard.type("i");
    }
    await expect(suggestions(page).filter({ hasText: "print" }).first()).toBeVisible({
      timeout: 3000,
    });
  }).toPass({ timeout: 60_000 });
  console.log(
    JSON.stringify(
      await suggestions(page).evaluateAll((rows) =>
        rows.slice(0, 8).map((r) => r.getAttribute("aria-label") ?? r.textContent),
      ),
    ),
  );
  await page.keyboard.press("Tab");
  await page.keyboard.type('("hi")');
  await expect(editorText(page)).toContainText('print("hi")');
});

test("Problems: Python in an HTML file is reported with its position; clicking jumps to it", async () => {
  launched = await launchApp();
  const { app, page } = launched;
  const project = makeProject({
    "test.html": [
      "<!DOCTYPE html>",
      "<html>",
      "<body>",
      "  print(Talha)",
      "  <p>Use print() to show text. If you want, read more:</p>",
      "  <pre><code>print('an example')</code></pre>",
      "  <script>",
      "    console.log('fine');",
      "  </script>",
      "</body>",
      "</html>",
      "",
    ].join("\n"),
  });
  await openFolder(app, page, project);
  await openFileFromExplorer(page, "test.html");
  await page.keyboard.press("Control+Shift+M");
  const problems = page.getByTestId("problems");
  const rows = problems.getByTestId("problem");
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText("looks like Python code, but this is an HTML file");
  await expect(rows.first()).toContainText("Ln 4, Col 3");
  await expect(problems).toContainText("test.html");
  await expect(problems.getByRole("button", { name: /Warnings 1/ })).toBeVisible();

  // The squiggle is in the editor too, and clicking the problem selects the code.
  await expect(page.locator(".monaco-editor .squiggly-warning").first()).toBeVisible();
  await page.keyboard.press("Control+Home");
  await rows.first().click();
  // "print(Talha)" (12 characters on line 4, from column 3) is selected.
  await expect(page.locator(".statusbar")).toContainText("Ln 4, Col 15 (12 selected)");

  // Filters hide and show by severity.
  await problems.getByRole("button", { name: /Warnings/ }).click();
  await expect(rows).toHaveCount(0);
  await problems.getByRole("button", { name: /Warnings/ }).click();
  await expect(rows).toHaveCount(1);

  // Replacing the code with text removes the problem.
  await rows.first().click();
  await page.keyboard.type("Talha");
  await expect(rows).toHaveCount(0);
});

test("Problems: unbalanced HTML tags and Python written in a JavaScript file", async () => {
  launched = await launchApp();
  const { app, page } = launched;
  const project = makeProject({
    "page.html": "<div>\n</span>\n</div>\n",
    "script.js": "def main():\n    return 1\n",
  });
  await openFolder(app, page, project);
  await openFileFromExplorer(page, "page.html");
  await openFileFromExplorer(page, "script.js");
  await page.keyboard.press("Control+Shift+M");
  const problems = page.getByTestId("problems");
  await expect(problems).toContainText("Closing tag </span> has no matching opening <span> tag.");
  await expect(problems).toContainText("looks like Python, but this is a JavaScript file");
});

test("JavaScript/TypeScript IntelliSense sees the other files of the project", async () => {
  launched = await launchApp();
  const { app, page } = launched;
  const project = makeProject({
    "utils.ts": "export function computeTotal(price: number): number {\n  return price * 2;\n}\n",
    "main.ts": 'import { computeTotal } from "./utils";\n\ncomputeTotal("ten");\n',
  });
  await openFolder(app, page, project);
  // utils.ts is never opened: the type error needs its declaration anyway.
  await openFileFromExplorer(page, "main.ts");
  await page.keyboard.press("Control+Shift+M");
  await expect(page.getByTestId("problems")).toContainText(
    "not assignable to parameter of type 'number'",
    { timeout: 30_000 },
  );
});

test("Change Language Mode from the status bar, and detection from the first line", async () => {
  launched = await launchApp();
  const { app, page } = launched;
  const project = makeProject({
    "notes.txt": "x = 1\n",
    "build-script": "#!/usr/bin/env python3\nprint('hi')\n",
  });
  await openFolder(app, page, project);
  await openFileFromExplorer(page, "build-script");
  await expect(page.getByTestId("language-status")).toHaveText("Python");

  await openFileFromExplorer(page, "notes.txt");
  await expect(page.getByTestId("language-status")).toHaveText("Plain Text");
  await page.getByTestId("language-status").click();
  await page.keyboard.type("python");
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("language-status")).toHaveText("Python");
});
