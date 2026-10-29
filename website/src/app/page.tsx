import { ArrowRight, Check, Download } from "lucide-react";
import Link from "next/link";
import { FeatureIcon } from "@/components/FeatureIcon";
import { Hero, type HeroDownload } from "@/components/Hero";
import { Reveal } from "@/components/Reveal";
import { Showcase } from "@/components/Showcase";
import { HIGHLIGHTS } from "@/lib/features";
import { formatBytes, getAvailableDownloads, releaseManifest } from "@/lib/release";
import { config, site } from "@/lib/site";

// Re-check installer availability every 10 minutes.
export const revalidate = 600;

const SHORTCUTS = [
  ["Command Palette", "Ctrl+Shift+P"],
  ["Go to File", "Ctrl+P"],
  ["Toggle Terminal", "Ctrl+`"],
  ["Find in Files", "Ctrl+Shift+F"],
  ["Source Control", "Ctrl+Shift+G"],
  ["Save All", "Ctrl+Alt+S"],
];

const SECURITY = [
  "The interface runs sandboxed, with no direct access to Node.js",
  "Every request to the system is allow-listed and validated",
  "File access is limited to the folder you open",
  "Previews run in an isolated window with permissions denied",
  "No telemetry, no accounts, no code leaves your machine",
];

export default async function HomePage() {
  const downloads = await getAvailableDownloads(config);
  const windows = downloads.find((d) => d.platform === "windows");
  const heroDownload: HeroDownload | null = windows
    ? {
        url: windows.url,
        label: "Download for Windows",
        meta: `Version ${releaseManifest.version} · Windows 10/11 · 64-bit · ${formatBytes(windows.size)}`,
      }
    : null;

  return (
    <>
      <Hero
        name={site.name}
        tagline={site.tagline}
        description="A fast, focused desktop code editor with Monaco-powered editing, a real integrated terminal, built-in Git and project-wide search — designed to keep you in flow."
        version={releaseManifest.version}
        download={heroDownload}
      />
      <Showcase src="/screenshots/codeforge-editor.webp" version={releaseManifest.version} />

      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6" aria-labelledby="features-title">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan">
            Everything you need
          </p>
          <h2 id="features-title" className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
            Professional tools. Nothing in your way.
          </h2>
          <p className="mt-4 text-lg text-muted">
            CodeForge brings the workflows developers rely on into one quiet, fast workspace.
          </p>
        </Reveal>
        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {HIGHLIGHTS.map((feature, index) => (
            <Reveal key={feature.id} delay={(index % 3) * 0.08}>
              <article className="card group h-full p-6 transition-colors duration-300 hover:border-cyan/30">
                <FeatureIcon icon={feature.icon} />
                <h3 className="mt-5 text-lg font-semibold text-ink">{feature.title}</h3>
                <p className="mt-2 leading-relaxed text-muted">{feature.summary}</p>
              </article>
            </Reveal>
          ))}
        </div>
        <Reveal className="mt-10 text-center">
          <Link
            href="/features"
            className="inline-flex items-center gap-2 font-semibold text-cyan hover:text-ink"
          >
            See the full feature list <ArrowRight size={17} />
          </Link>
        </Reveal>
      </section>

      <section className="border-y border-line bg-bg-elevated/50">
        <div className="mx-auto grid max-w-6xl gap-12 px-4 py-20 sm:px-6 lg:grid-cols-2">
          <Reveal>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan">
              Keyboard first
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight">
              Move at the speed of thought.
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-muted">
              Familiar shortcuts, a Command Palette for every action and instant fuzzy file search
              mean you rarely reach for the mouse.
            </p>
            <dl className="mt-8 grid gap-3 sm:grid-cols-2">
              {SHORTCUTS.map(([label, keys]) => (
                <div
                  key={label}
                  className="flex items-center justify-between gap-4 rounded-xl border border-line bg-surface/50 px-4 py-3"
                >
                  <dt className="text-sm text-muted">{label}</dt>
                  <dd>
                    <kbd>{keys}</kbd>
                  </dd>
                </div>
              ))}
            </dl>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan">
              Secure by design
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight">Your code stays yours.</h2>
            <p className="mt-4 text-lg leading-relaxed text-muted">
              CodeForge follows Electron&apos;s security best practices so a malicious file or web
              page can&apos;t reach your system.
            </p>
            <ul className="mt-8 space-y-3">
              {SECURITY.map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <span className="mt-0.5 inline-flex h-5 w-5 flex-none items-center justify-center rounded-full bg-cyan/15 text-cyan">
                    <Check size={13} strokeWidth={3} />
                  </span>
                  <span className="text-ink/90">{item}</span>
                </li>
              ))}
            </ul>
            <Link
              href="/docs/security"
              className="mt-8 inline-flex items-center gap-2 font-semibold text-cyan hover:text-ink"
            >
              How CodeForge protects you <ArrowRight size={17} />
            </Link>
          </Reveal>
        </div>
      </section>

      <section className="relative overflow-hidden px-4 py-24 sm:px-6">
        <div
          className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-72 w-[40rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue/20 blur-3xl"
          aria-hidden
        />
        <Reveal className="mx-auto max-w-3xl text-center">
          <h2 className="text-4xl font-bold tracking-tight sm:text-5xl">
            Ready to <span className="text-gradient">forge</span>?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-muted">{site.tagline}</p>
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href={heroDownload ? heroDownload.url : "/download"}
              className="inline-flex items-center gap-2.5 rounded-xl bg-brand-gradient px-7 py-3.5 font-semibold text-white shadow-[0_18px_50px_-12px_rgba(59,130,246,0.75)] transition hover:brightness-110"
            >
              <Download size={19} /> {heroDownload ? "Download for Windows" : "Get CodeForge"}
            </Link>
            <Link
              href="/docs/getting-started"
              className="inline-flex items-center gap-2 rounded-xl px-6 py-3.5 font-semibold text-muted hover:text-ink"
            >
              Read the getting started guide <ArrowRight size={17} />
            </Link>
          </div>
        </Reveal>
      </section>
    </>
  );
}
