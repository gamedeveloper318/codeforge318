import { BookOpen, Bug, LifeBuoy, Mail } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { config, githubUrl } from "@/lib/site";

export const metadata: Metadata = {
  title: "Support & feedback",
  description: "Get help with CodeForge, report a problem or share feedback.",
};

export default function SupportPage() {
  const channels = [
    {
      icon: BookOpen,
      title: "Documentation",
      body: "Guides for every part of CodeForge, from your first folder to Git and the terminal.",
      href: "/docs",
      cta: "Read the docs",
      external: false,
    },
    {
      icon: LifeBuoy,
      title: "Troubleshooting",
      body: "Fixes for the most common problems: SmartScreen, terminals that won't start, Git not found and more.",
      href: "/docs/troubleshooting",
      cta: "Solve a problem",
      external: false,
    },
    ...(githubUrl
      ? [
          {
            icon: Bug,
            title: "Report a bug or request a feature",
            body: "Open an issue on GitHub. Include your CodeForge version (Help → About) and steps to reproduce.",
            href: `${githubUrl}/issues/new`,
            cta: "Open an issue",
            external: true,
          },
        ]
      : []),
    ...(config.supportEmail
      ? [
          {
            icon: Mail,
            title: "Email",
            body: "Prefer email? Write to us and we'll get back to you.",
            href: `mailto:${config.supportEmail}`,
            cta: config.supportEmail,
            external: true,
          },
        ]
      : []),
  ];

  return (
    <>
      <PageHeader eyebrow="Support" title="Support & feedback">
        Stuck, found a bug or have an idea? Here&apos;s how to get help.
      </PageHeader>
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <div className="grid gap-5 md:grid-cols-2">
          {channels.map(({ icon: Icon, title, body, href, cta, external }) => (
            <article key={title} className="card flex flex-col p-6">
              <Icon size={24} className="text-cyan" />
              <h2 className="mt-4 text-lg font-semibold">{title}</h2>
              <p className="mt-2 flex-1 leading-relaxed text-muted">{body}</p>
              {external ? (
                <a
                  href={href}
                  rel="noopener"
                  className="mt-5 font-semibold text-cyan hover:text-ink"
                >
                  {cta} →
                </a>
              ) : (
                <Link href={href} className="mt-5 font-semibold text-cyan hover:text-ink">
                  {cta} →
                </Link>
              )}
            </article>
          ))}
        </div>

        <section className="prose-cf mt-14 max-w-3xl">
          <h2>When reporting a problem</h2>
          <ul>
            <li>
              Your CodeForge version — <strong>Help → About CodeForge</strong>.
            </li>
            <li>Your Windows version and what you were doing when the problem happened.</li>
            <li>
              The diagnostic log at <code>%APPDATA%\CodeForge\logs\codeforge.log</code>. Check it
              for anything private before sharing; it contains file paths but never file contents.
            </li>
          </ul>
        </section>
      </div>
    </>
  );
}
