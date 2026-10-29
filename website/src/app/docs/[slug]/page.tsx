import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DOCS, getDoc } from "@/lib/docs";

export function generateStaticParams() {
  return DOCS.map((doc) => ({ slug: doc.slug }));
}

export const dynamicParams = false;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const doc = getDoc((await params).slug);
  return doc ? { title: doc.title, description: doc.description } : {};
}

export default async function DocPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const doc = getDoc(slug);
  if (!doc) notFound();
  const index = DOCS.indexOf(doc);
  const previous = DOCS[index - 1];
  const next = DOCS[index + 1];

  return (
    <article>
      <p className="text-sm font-semibold uppercase tracking-[0.14em] text-cyan">{doc.section}</p>
      <h1 className="mt-2 text-4xl font-bold tracking-tight">{doc.title}</h1>
      <p className="mt-3 text-lg text-muted">{doc.description}</p>
      <div className="prose-cf mt-8">{doc.body}</div>
      <nav
        aria-label="Pagination"
        className="mt-14 grid gap-4 border-t border-line pt-8 sm:grid-cols-2"
      >
        {previous ? (
          <Link href={`/docs/${previous.slug}`} className="card block p-4 hover:border-cyan/30">
            <span className="text-xs text-subtle">Previous</span>
            <span className="mt-1 block font-semibold text-ink">← {previous.title}</span>
          </Link>
        ) : (
          <span />
        )}
        {next && (
          <Link
            href={`/docs/${next.slug}`}
            className="card block p-4 text-right hover:border-cyan/30"
          >
            <span className="text-xs text-subtle">Next</span>
            <span className="mt-1 block font-semibold text-ink">{next.title} →</span>
          </Link>
        )}
      </nav>
    </article>
  );
}
