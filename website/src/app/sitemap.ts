import type { MetadataRoute } from "next";
import { DOCS } from "@/lib/docs";
import { config } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const pages = [
    "",
    "/features",
    "/download",
    "/docs",
    "/releases",
    "/faq",
    "/support",
    "/privacy",
    "/terms",
  ];
  return [
    ...pages.map((path) => ({
      url: `${config.siteUrl}${path}`,
      changeFrequency: "weekly" as const,
      priority: path === "" ? 1 : 0.7,
    })),
    ...DOCS.map((doc) => ({
      url: `${config.siteUrl}/docs/${doc.slug}`,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
  ];
}
