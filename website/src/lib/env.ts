import { z } from "zod";

/**
 * Server-side configuration for the website. Every variable is optional: the
 * site builds and runs with none of them, and features light up as they are
 * configured. Invalid values fail the build with a readable message.
 *
 * Nothing here is secret, but only NEXT_PUBLIC_* values are ever sent to the
 * browser.
 */
const emptyToUndefined = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

const httpsUrl = z
  .url({ protocol: /^https$/, error: "must be an https:// URL" })
  .transform((value) => value.replace(/\/$/, ""));

const schema = z.object({
  NEXT_PUBLIC_SITE_URL: z.preprocess(emptyToUndefined, z.url({ protocol: /^https?$/ }).optional()),
  CODEFORGE_GITHUB_REPO: z.preprocess(
    emptyToUndefined,
    z
      .string()
      .regex(/^[\w.-]+\/[\w.-]+$/, "must look like owner/repository")
      .optional(),
  ),
  CODEFORGE_DOWNLOAD_URL_WINDOWS: z.preprocess(emptyToUndefined, httpsUrl.optional()),
  CODEFORGE_SUPPORT_EMAIL: z.preprocess(emptyToUndefined, z.email().optional()),
  VERCEL_PROJECT_PRODUCTION_URL: z.preprocess(emptyToUndefined, z.string().optional()),
});

export interface SiteConfig {
  siteUrl: string;
  githubRepo: string | null;
  windowsDownloadUrl: string | null;
  supportEmail: string | null;
}

export function loadConfig(env: Record<string, string | undefined> = process.env): SiteConfig {
  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    const problems = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(
      `Invalid CodeForge website configuration:\n${problems}\nSee website/.env.example for the expected format.`,
    );
  }
  const values = parsed.data;
  const siteUrl =
    values.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
    (values.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${values.VERCEL_PROJECT_PRODUCTION_URL}`
      : "http://localhost:3000");
  return {
    siteUrl,
    githubRepo: values.CODEFORGE_GITHUB_REPO ?? null,
    windowsDownloadUrl: values.CODEFORGE_DOWNLOAD_URL_WINDOWS ?? null,
    supportEmail: values.CODEFORGE_SUPPORT_EMAIL ?? null,
  };
}
