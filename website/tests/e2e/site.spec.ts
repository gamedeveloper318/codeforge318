import { expect, test } from "@playwright/test";

test("homepage shows the brand, tagline and a download path", async ({ page }) => {
  await page.goto("/");
  const title = page.getByRole("heading", { level: 1, name: "CodeForge" });
  await expect(title).toBeVisible();
  // The tagline sits directly under the title.
  const tagline = page.getByText("Your Code. Your Workspace. Your Power.", { exact: true }).first();
  await expect(tagline).toBeVisible();
  const [titleBox, taglineBox] = await Promise.all([title.boundingBox(), tagline.boundingBox()]);
  expect(taglineBox!.y).toBeGreaterThan(titleBox!.y);
  expect(taglineBox!.y - (titleBox!.y + titleBox!.height)).toBeLessThan(60);

  const download = page.getByTestId("hero-download");
  await expect(download).toBeVisible();
  const href = await download.getAttribute("href");
  // Either a verified installer URL or the download page — never a dead link.
  expect(href === "/download" || href?.startsWith("https://")).toBe(true);
  await expect(page.getByTestId("availability")).toContainText("0.1.0");
});

test("every main page loads", async ({ page }) => {
  for (const [path, heading] of [
    ["/features", "Built for the way you work"],
    ["/download", "Download CodeForge"],
    ["/docs", "Documentation"],
    ["/docs/getting-started", "Getting started"],
    ["/docs/security", "Security & privacy"],
    ["/releases", "Release notes"],
    ["/faq", "Frequently asked questions"],
    ["/support", "Support & feedback"],
    ["/privacy", "Privacy policy"],
    ["/terms", "Terms of use"],
  ]) {
    const response = await page.goto(path);
    expect(response?.status(), path).toBe(200);
    await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
  }
});

test("download page never shows a dead download button", async ({ page }) => {
  await page.goto("/download");
  const button = page.getByTestId("windows-download");
  if (await button.count()) {
    const href = await button.getAttribute("href");
    const head = await page.request.head(href!);
    expect(head.ok()).toBe(true);
    await expect(page.getByTestId("sha256")).toHaveText(/^[0-9a-f]{64}$/);
  } else {
    await expect(page.getByTestId("download-pending")).toContainText("not published yet");
  }
  await expect(page.locator("#requirements")).toContainText("Windows 10 version 1809");
});

test("content stays visible without JavaScript", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Professional tools. Nothing in your way." }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Monaco-powered editing" })).toBeVisible();
  await context.close();
});

test("scrolling reveals the feature sections", async ({ page }) => {
  await page.goto("/");
  const heading = page.getByRole("heading", { name: "Your code stays yours." });
  await heading.scrollIntoViewIfNeeded();
  await expect(heading).toBeVisible();
});

test("security headers and health endpoint", async ({ request }) => {
  const response = await request.get("/");
  expect(response.headers()["x-frame-options"]).toBe("DENY");
  expect(response.headers()["x-content-type-options"]).toBe("nosniff");
  expect(response.headers()["x-powered-by"]).toBeUndefined();
  const health = await request.get("/api/health");
  expect(await health.json()).toMatchObject({ status: "ok", product: "CodeForge" });
});

test("unknown pages return 404", async ({ page }) => {
  const response = await page.goto("/definitely-not-a-page");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "This page doesn't exist" })).toBeVisible();
});

test("mobile navigation menu works", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "mobile only");
  await page.goto("/");
  await page.getByRole("button", { name: "Open menu" }).click();
  await page
    .getByRole("navigation", { name: "Mobile" })
    .getByRole("link", { name: "Docs" })
    .click();
  await expect(page).toHaveURL(/\/docs$/);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});
