import Link from "next/link";
import { githubUrl, site } from "@/lib/site";
import { LogoLink } from "./Logo";

const columns = [
  {
    title: "Product",
    links: [
      { href: "/features", label: "Features" },
      { href: "/download", label: "Download" },
      { href: "/releases", label: "Release notes" },
      { href: "/download#requirements", label: "System requirements" },
    ],
  },
  {
    title: "Learn",
    links: [
      { href: "/docs", label: "Documentation" },
      { href: "/docs/installation", label: "Installation guide" },
      { href: "/docs/keyboard-shortcuts", label: "Keyboard shortcuts" },
      { href: "/faq", label: "FAQ" },
    ],
  },
  {
    title: "Company",
    links: [
      { href: "/support", label: "Support & feedback" },
      { href: "/privacy", label: "Privacy" },
      { href: "/terms", label: "Terms" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-line bg-bg-elevated/60">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div>
          <LogoLink />
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted">{site.tagline}</p>
          {githubUrl && (
            <a
              href={githubUrl}
              className="mt-4 inline-block text-sm text-muted hover:text-ink"
              rel="noopener"
            >
              Source on GitHub
            </a>
          )}
        </div>
        {columns.map((column) => (
          <div key={column.title}>
            <h2 className="text-sm font-semibold text-ink">{column.title}</h2>
            <ul className="mt-4 space-y-2.5">
              {column.links.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-muted transition-colors hover:text-ink"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-line">
        <p className="mx-auto max-w-6xl px-4 py-6 text-xs text-subtle sm:px-6">
          © {new Date().getFullYear()} CodeForge. CodeForge is an independent project and is not
          affiliated with Microsoft or Visual Studio Code.
        </p>
      </div>
    </footer>
  );
}
