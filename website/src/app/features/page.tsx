import type { Metadata } from "next";
import { FeatureIcon } from "@/components/FeatureIcon";
import { PageHeader } from "@/components/PageHeader";
import { Reveal } from "@/components/Reveal";
import { HIGHLIGHTS, SUPPORT_MATRIX, type SupportLevel } from "@/lib/features";

export const metadata: Metadata = {
  title: "Features",
  description:
    "What CodeForge can do today — editor, terminal, Git, search, language support — and what is planned next.",
};

const STATUS: Record<SupportLevel, { label: string; className: string }> = {
  available: {
    label: "Available",
    className: "border-[#34d399]/40 bg-[#34d399]/10 text-[#6ee7b7]",
  },
  partial: { label: "Partial", className: "border-[#fbbf24]/40 bg-[#fbbf24]/10 text-[#fcd34d]" },
  planned: { label: "Planned", className: "border-line-strong bg-surface-2 text-muted" },
};

export default function FeaturesPage() {
  return (
    <>
      <PageHeader eyebrow="Features" title="Built for the way you work">
        Everything listed as available is implemented and tested in the current release. Planned
        items are on the roadmap — we don&apos;t ship buttons that don&apos;t work.
      </PageHeader>

      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {HIGHLIGHTS.map((feature, index) => (
            <Reveal key={feature.id} delay={(index % 3) * 0.06}>
              <article className="card h-full p-6">
                <FeatureIcon icon={feature.icon} />
                <h2 className="mt-5 text-lg font-semibold">{feature.title}</h2>
                <p className="mt-2 leading-relaxed text-muted">{feature.summary}</p>
              </article>
            </Reveal>
          ))}
        </div>

        <section aria-labelledby="matrix-title" className="mt-20">
          <h2 id="matrix-title" className="text-2xl font-bold tracking-tight">
            Feature support matrix
          </h2>
          <p className="mt-2 text-muted">The current state of CodeForge, area by area.</p>
          <div className="mt-6 overflow-x-auto rounded-xl border border-line">
            <table className="w-full min-w-[640px] text-left text-sm" data-testid="support-matrix">
              <thead className="bg-surface/60 text-ink">
                <tr>
                  <th className="px-5 py-3 font-semibold">Area</th>
                  <th className="px-5 py-3 font-semibold">Capability</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                  <th className="px-5 py-3 font-semibold">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {SUPPORT_MATRIX.map((row) => (
                  <tr key={`${row.area}-${row.capability}`}>
                    <td className="px-5 py-3.5 text-muted">{row.area}</td>
                    <td className="px-5 py-3.5 text-ink">{row.capability}</td>
                    <td className="px-5 py-3.5">
                      <span
                        className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-medium ${STATUS[row.status].className}`}
                      >
                        {STATUS[row.status].label}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-muted">{row.note ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </>
  );
}
