"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface Section {
  title: string;
  links: { href: string; label: string }[];
}

export function DocsNav({ sections }: { sections: Section[] }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Documentation" className="lg:sticky lg:top-24 lg:self-start">
      <Link
        href="/docs"
        className={`block text-sm font-semibold ${pathname === "/docs" ? "text-cyan" : "text-ink"}`}
      >
        Documentation
      </Link>
      <div className="mt-4 grid gap-6 sm:grid-cols-2 lg:grid-cols-1">
        {sections.map((section) => (
          <div key={section.title}>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-subtle">
              {section.title}
            </p>
            <ul className="mt-2 space-y-1 border-l border-line">
              {section.links.map((link) => {
                const active = pathname === link.href;
                return (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      aria-current={active ? "page" : undefined}
                      className={`-ml-px block border-l py-1 pl-3 text-sm transition-colors ${
                        active
                          ? "border-cyan text-ink"
                          : "border-transparent text-muted hover:border-line-strong hover:text-ink"
                      }`}
                    >
                      {link.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </nav>
  );
}
