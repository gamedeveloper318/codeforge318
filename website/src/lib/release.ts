import manifestJson from "@/generated/release-manifest.json";
import type { SiteConfig } from "./env";

export type Platform = "windows" | "macos" | "linux";

export interface ReleaseArtifact {
  platform: Platform;
  arch: string;
  kind: string;
  file: string;
  size: number;
  sha256: string;
}

export interface ReleaseManifest {
  version: string;
  releaseDate: string | null;
  artifacts: ReleaseArtifact[];
}

export interface DownloadOption extends ReleaseArtifact {
  url: string;
}

export const releaseManifest = manifestJson as ReleaseManifest;

/** Where an installer is published, or null when no host is configured. */
export function artifactUrl(
  manifest: ReleaseManifest,
  artifact: ReleaseArtifact,
  config: SiteConfig,
): string | null {
  if (artifact.platform === "windows" && config.windowsDownloadUrl)
    return config.windowsDownloadUrl;
  if (config.githubRepo) {
    return `https://github.com/${config.githubRepo}/releases/download/v${manifest.version}/${encodeURIComponent(artifact.file)}`;
  }
  return null;
}

/** True only when the URL really serves a file (HEAD request, redirects followed). */
export async function urlExists(url: string, fetcher: typeof fetch = fetch): Promise<boolean> {
  try {
    const response = await fetcher(url, {
      method: "HEAD",
      redirect: "follow",
      // Re-checked at most every 10 minutes, so a newly published release
      // appears without redeploying the site.
      next: { revalidate: 600 },
    } as RequestInit);
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Downloads that are actually available right now. An installer listed in the
 * manifest but not (yet) uploaded is left out, so the site never shows a
 * download button that leads nowhere.
 */
export async function getAvailableDownloads(
  config: SiteConfig,
  manifest: ReleaseManifest = releaseManifest,
  fetcher: typeof fetch = fetch,
): Promise<DownloadOption[]> {
  const checks = manifest.artifacts.map(async (artifact) => {
    const url = artifactUrl(manifest, artifact, config);
    return url && (await urlExists(url, fetcher)) ? { ...artifact, url } : null;
  });
  return (await Promise.all(checks)).filter((d): d is DownloadOption => d !== null);
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

export const PLATFORM_LABEL: Record<Platform, string> = {
  windows: "Windows",
  macos: "macOS",
  linux: "Linux",
};
