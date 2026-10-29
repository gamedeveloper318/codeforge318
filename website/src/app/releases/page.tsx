import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { RELEASES } from "@/lib/releases";

export const metadata: Metadata = {
  title: "Release notes",
  description: "What changed in each version of CodeForge.",
};

function List({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="mt-6">
      <h3 className="font-semibold text-ink">{title}</h3>
      <ul className="mt-3 space-y-2 text-muted">
        {items.map((item) => (
          <li key={item} className="flex gap-3 leading-relaxed">
            <span className="mt-2.5 h-1.5 w-1.5 flex-none rounded-full bg-cyan" aria-hidden />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function ReleasesPage() {
  return (
    <>
      <PageHeader eyebrow="Changelog" title="Release notes">
        Every CodeForge release, newest first.
      </PageHeader>
      <div className="mx-auto max-w-4xl px-4 py-14 sm:px-6">
        {RELEASES.map((release) => (
          <article
            key={release.version}
            id={`v${release.version}`}
            className="card scroll-mt-24 p-6 sm:p-8"
          >
            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
              <h2 className="text-2xl font-bold tracking-tight">Version {release.version}</h2>
              <time dateTime={release.date} className="text-sm text-subtle">
                {new Date(`${release.date}T00:00:00Z`).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                  timeZone: "UTC",
                })}
              </time>
              <span className="rounded-full border border-cyan/40 bg-cyan/10 px-2.5 py-0.5 text-xs font-medium text-cyan">
                {release.title}
              </span>
            </div>
            <p className="mt-4 leading-relaxed text-ink/90">{release.summary}</p>
            <List title="New" items={release.added} />
            <List title="Security" items={release.security} />
            <List title="Known limitations" items={release.knownLimitations} />
            <Link
              href="/download"
              className="mt-8 inline-block font-semibold text-cyan hover:text-ink"
            >
              Download version {release.version} →
            </Link>
          </article>
        ))}
      </div>
    </>
  );
}
