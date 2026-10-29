import { DocsNav } from "@/components/DocsNav";
import { DOC_SECTIONS, DOCS } from "@/lib/docs";

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  const sections = DOC_SECTIONS.map((section) => ({
    title: section,
    links: DOCS.filter((d) => d.section === section).map((d) => ({
      href: `/docs/${d.slug}`,
      label: d.title,
    })),
  }));
  return (
    <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[220px_1fr]">
      <DocsNav sections={sections} />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
