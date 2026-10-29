"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { nav } from "@/lib/site";
import { LogoLink } from "./Logo";

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <header
      className={`sticky top-0 z-50 border-b transition-colors duration-300 ${
        scrolled || open
          ? "border-line bg-bg/80 backdrop-blur-xl"
          : "border-transparent bg-transparent"
      }`}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <LogoLink />
        <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive(item.href) ? "page" : undefined}
              className={`rounded-lg px-3 py-2 text-sm transition-colors ${
                isActive(item.href) ? "text-ink" : "text-muted hover:text-ink"
              }`}
            >
              {item.label}
            </Link>
          ))}
          <Link
            href="/download"
            className="ml-3 rounded-lg bg-brand-gradient px-4 py-2 text-sm font-semibold text-white shadow-[0_8px_30px_-8px_rgba(59,130,246,0.7)] transition hover:brightness-110"
          >
            Download
          </Link>
        </nav>
        <button
          className="rounded-lg p-2 text-muted hover:text-ink md:hidden"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          aria-controls="mobile-nav"
          onClick={() => setOpen(!open)}
        >
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>
      {open && (
        <nav
          id="mobile-nav"
          aria-label="Mobile"
          className="border-t border-line px-4 pb-4 md:hidden"
        >
          {[...nav, { href: "/download", label: "Download" }].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className="block rounded-lg px-3 py-3 text-base text-muted hover:bg-surface hover:text-ink"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}
