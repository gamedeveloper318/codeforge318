import product from "@/generated/product.json";
import { loadConfig } from "./env";

export const site = {
  name: product.name,
  tagline: product.tagline,
  description: product.description,
};

export const config = loadConfig();

export const nav = [
  { href: "/features", label: "Features" },
  { href: "/docs", label: "Docs" },
  { href: "/releases", label: "Releases" },
  { href: "/faq", label: "FAQ" },
];

export const githubUrl = config.githubRepo ? `https://github.com/${config.githubRepo}` : null;
