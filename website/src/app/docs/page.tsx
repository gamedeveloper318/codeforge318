import type { Metadata } from "next";
import Link from "next/link";
import { DOC_SECTIONS, DOCS } from "@/lib/docs";

export const metadata: Metadata = {
  title: "Documentation",
  description: "Learn how to install and use CodeForge.",
};

export default function DocsIndexPage() {
  return (
    <article>
      <h1 className="text-4xl font-bold tracking-tight">Documentation</h1>
      <p className="mt-3 max-w-2xl text-lg text-muted">
        Everything you need to install CodeForge, get productive and solve problems. New here? Start
        with{" "}
        <Link href="/docs/getting-started" className="text-cyan underline underline-offset-4">
          Getting started
        </Link>
        .
      </p>
      {DOC_SECTIONS.map((section) => (
        <section key={section} className="mt-12">
          <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-subtle">
            {section}
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {DOCS.filter((doc) => doc.section === section).map((doc) => (
              <Link
                key={doc.slug}
                href={`/docs/${doc.slug}`}
                className="card block p-5 transition-colors hover:border-cyan/30"
              >
                <h3 className="font-semibold text-ink">{doc.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">{doc.description}</p>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </article>
  );
}
