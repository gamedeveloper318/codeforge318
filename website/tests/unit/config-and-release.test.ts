import { describe, expect, it, vi } from "vitest";
import { loadConfig } from "@/lib/env";
import {
  artifactUrl,
  formatBytes,
  getAvailableDownloads,
  urlExists,
  type ReleaseManifest,
} from "@/lib/release";

describe("loadConfig", () => {
  it("works with no variables at all", () => {
    expect(loadConfig({})).toEqual({
      siteUrl: "http://localhost:3000",
      githubRepo: null,
      windowsDownloadUrl: null,
      supportEmail: null,
    });
  });

  it("treats empty strings as unset", () => {
    expect(
      loadConfig({ CODEFORGE_GITHUB_REPO: "  ", NEXT_PUBLIC_SITE_URL: "" }).githubRepo,
    ).toBeNull();
  });

  it("derives the site URL from Vercel's production domain", () => {
    expect(loadConfig({ VERCEL_PROJECT_PRODUCTION_URL: "codeforge.example.com" }).siteUrl).toBe(
      "https://codeforge.example.com",
    );
    expect(
      loadConfig({
        NEXT_PUBLIC_SITE_URL: "https://a.example/",
        VERCEL_PROJECT_PRODUCTION_URL: "b.example",
      }).siteUrl,
    ).toBe("https://a.example");
  });

  it("rejects malformed values with a readable message", () => {
    expect(() => loadConfig({ CODEFORGE_GITHUB_REPO: "not a repo" })).toThrow(
      /CODEFORGE_GITHUB_REPO: must look like owner\/repository/,
    );
    expect(() =>
      loadConfig({ CODEFORGE_DOWNLOAD_URL_WINDOWS: "http://insecure.example/x.exe" }),
    ).toThrow(/https/);
    expect(() => loadConfig({ CODEFORGE_SUPPORT_EMAIL: "nope" })).toThrow(
      /CODEFORGE_SUPPORT_EMAIL/,
    );
  });
});

const manifest: ReleaseManifest = {
  version: "1.2.3",
  releaseDate: "2026-01-01",
  artifacts: [
    {
      platform: "windows",
      arch: "x64",
      kind: "installer",
      file: "CodeForge-Setup-1.2.3-x64.exe",
      size: 100,
      sha256: "abc",
    },
  ],
};
const base = loadConfig({});

describe("download resolution", () => {
  it("has no URL until a host is configured", () => {
    expect(artifactUrl(manifest, manifest.artifacts[0], base)).toBeNull();
  });

  it("builds GitHub release URLs", () => {
    expect(
      artifactUrl(manifest, manifest.artifacts[0], { ...base, githubRepo: "me/codeforge" }),
    ).toBe(
      "https://github.com/me/codeforge/releases/download/v1.2.3/CodeForge-Setup-1.2.3-x64.exe",
    );
  });

  it("prefers an explicit Windows download URL", () => {
    const config = {
      ...base,
      githubRepo: "me/codeforge",
      windowsDownloadUrl: "https://cdn.example/setup.exe",
    };
    expect(artifactUrl(manifest, manifest.artifacts[0], config)).toBe(
      "https://cdn.example/setup.exe",
    );
  });

  it("only lists installers that really exist", async () => {
    const config = { ...base, githubRepo: "me/codeforge" };
    const missing = vi.fn(async () => new Response(null, { status: 404 }));
    expect(
      await getAvailableDownloads(config, manifest, missing as unknown as typeof fetch),
    ).toEqual([]);
    expect(missing).toHaveBeenCalledWith(
      expect.stringContaining("github.com"),
      expect.objectContaining({ method: "HEAD" }),
    );

    const present = vi.fn(async () => new Response(null, { status: 200 }));
    const downloads = await getAvailableDownloads(
      config,
      manifest,
      present as unknown as typeof fetch,
    );
    expect(downloads).toHaveLength(1);
    expect(downloads[0].url).toContain("CodeForge-Setup-1.2.3-x64.exe");
  });

  it("treats network errors as unavailable", async () => {
    const failing = vi.fn(async () => {
      throw new Error("offline");
    });
    expect(await urlExists("https://example.com/x", failing as unknown as typeof fetch)).toBe(
      false,
    );
  });

  it("formats sizes", () => {
    expect(formatBytes(125_744_277)).toBe("119.9 MB");
    expect(formatBytes(2048)).toBe("2 KB");
  });
});
