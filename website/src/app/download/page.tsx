import { Download, ShieldAlert, Wrench } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { formatBytes, getAvailableDownloads, releaseManifest } from "@/lib/release";
import { config, githubUrl } from "@/lib/site";

export const metadata: Metadata = {
  title: "Download",
  description:
    "Download the CodeForge desktop code editor for Windows, with checksums, system requirements and build-from-source instructions.",
};

// Re-check installer availability every 10 minutes.
export const revalidate = 600;

const REQUIREMENTS = [
  ["Operating system", "Windows 10 version 1809 or later, or Windows 11 (64-bit)"],
  ["Processor", "64-bit (x64) processor"],
  ["Memory", "4 GB RAM (8 GB recommended for large projects)"],
  ["Disk space", "About 400 MB"],
  ["Optional", "Git for source control; Node.js, Python or other runtimes to run your code"],
];

export default async function DownloadPage() {
  const downloads = await getAvailableDownloads(config);
  const windows = downloads.find((d) => d.platform === "windows");
  const version = releaseManifest.version;

  return (
    <>
      <PageHeader eyebrow={`Version ${version}`} title="Download CodeForge">
        Install the desktop editor on Windows in under a minute. CodeForge is free to use.
      </PageHeader>

      <div className="mx-auto max-w-6xl space-y-16 px-4 py-14 sm:px-6">
        <section
          aria-labelledby="windows-title"
          className="card relative overflow-hidden p-6 sm:p-10"
        >
          <div
            className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-blue/20 blur-3xl"
            aria-hidden
          />
          <div className="relative grid gap-8 lg:grid-cols-[1.3fr_1fr]">
            <div>
              <h2 id="windows-title" className="text-2xl font-bold tracking-tight">
                CodeForge for Windows
              </h2>
              <p className="mt-2 text-muted">
                Windows 10 (1809+) and Windows 11 · 64-bit installer
              </p>

              {windows ? (
                <>
                  <a
                    href={windows.url}
                    className="mt-7 inline-flex items-center gap-2.5 rounded-xl bg-brand-gradient px-7 py-3.5 font-semibold text-white shadow-[0_18px_50px_-12px_rgba(59,130,246,0.75)] transition hover:brightness-110"
                    data-testid="windows-download"
                  >
                    <Download size={19} /> Download for Windows ({formatBytes(windows.size)})
                  </a>
                  <dl className="mt-7 space-y-3 text-sm">
                    <div>
                      <dt className="text-subtle">File</dt>
                      <dd className="font-mono text-ink">{windows.file}</dd>
                    </div>
                    <div>
                      <dt className="text-subtle">SHA-256 checksum</dt>
                      <dd className="break-all font-mono text-ink" data-testid="sha256">
                        {windows.sha256}
                      </dd>
                    </div>
                  </dl>
                  <p className="mt-4 text-sm text-muted">
                    Verify the download in PowerShell with{" "}
                    <code className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-ink">
                      Get-FileHash .\{windows.file}
                    </code>{" "}
                    and compare the result with the checksum above.
                  </p>
                </>
              ) : (
                <div
                  className="mt-7 rounded-xl border border-line-strong bg-surface/60 p-5"
                  data-testid="download-pending"
                >
                  <p className="font-semibold text-ink">
                    The Windows installer for version {version} is not published yet.
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-muted">
                    The download button appears here automatically as soon as the installer is
                    available. In the meantime you can{" "}
                    <a href="#build" className="text-cyan underline underline-offset-4">
                      build CodeForge from source
                    </a>
                    .
                  </p>
                </div>
              )}
            </div>

            <aside className="rounded-xl border border-line bg-bg-elevated/70 p-5 text-sm leading-relaxed text-muted">
              <p className="flex items-center gap-2 font-semibold text-ink">
                <ShieldAlert size={17} className="text-[#fbbf24]" /> About the Windows SmartScreen
                warning
              </p>
              <p className="mt-3">
                This early release is not code-signed yet, so Windows may show{" "}
                <em>“Windows protected your PC”</em> the first time you run the installer. Choose{" "}
                <strong className="text-ink">More info → Run anyway</strong> to continue — after
                checking the SHA-256 checksum if you want to be sure the file is genuine.
              </p>
              <p className="mt-3">
                The installer lets you choose the install folder, creates Start menu and desktop
                shortcuts, and can be removed from
                <em> Settings → Apps</em>.
              </p>
            </aside>
          </div>
        </section>

        <section aria-labelledby="platforms-title">
          <h2 id="platforms-title" className="text-2xl font-bold tracking-tight">
            Supported platforms
          </h2>
          <div className="mt-6 overflow-x-auto rounded-xl border border-line">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="bg-surface/60 text-ink">
                <tr>
                  <th className="px-5 py-3 font-semibold">Platform</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                  <th className="px-5 py-3 font-semibold">How to get it</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line text-muted">
                <tr>
                  <td className="px-5 py-4 text-ink">Windows 10 / 11 (x64)</td>
                  <td className="px-5 py-4">{windows ? "Available" : "Installer coming soon"}</td>
                  <td className="px-5 py-4">{windows ? "Installer above" : "Build from source"}</td>
                </tr>
                <tr>
                  <td className="px-5 py-4 text-ink">macOS (Apple silicon / Intel)</td>
                  <td className="px-5 py-4">Experimental — not yet tested</td>
                  <td className="px-5 py-4">Build from source</td>
                </tr>
                <tr>
                  <td className="px-5 py-4 text-ink">Linux (x64, AppImage)</td>
                  <td className="px-5 py-4">Experimental — not yet tested</td>
                  <td className="px-5 py-4">Build from source</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section id="requirements" aria-labelledby="requirements-title" className="scroll-mt-24">
          <h2 id="requirements-title" className="text-2xl font-bold tracking-tight">
            System requirements
          </h2>
          <dl className="mt-6 divide-y divide-line rounded-xl border border-line">
            {REQUIREMENTS.map(([label, value]) => (
              <div key={label} className="grid gap-1 px-5 py-4 sm:grid-cols-[220px_1fr]">
                <dt className="font-medium text-ink">{label}</dt>
                <dd className="text-muted">{value}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section id="build" aria-labelledby="build-title" className="scroll-mt-24">
          <h2
            id="build-title"
            className="flex items-center gap-2 text-2xl font-bold tracking-tight"
          >
            <Wrench size={22} className="text-cyan" /> Build from source
          </h2>
          <p className="mt-3 max-w-2xl text-muted">
            You need Node.js 22 or newer and Git.{" "}
            {githubUrl ? "Clone the repository, then:" : "From the CodeForge source folder:"}
          </p>
          <pre className="mt-5 overflow-x-auto rounded-xl border border-line bg-[#0b1120] p-5 font-mono text-sm leading-relaxed text-ink">
            {`${githubUrl ? `git clone ${githubUrl}.git\ncd ${config.githubRepo?.split("/")[1]}\n` : ""}npm run setup          # installs everything and prepares the project
npm run dev:desktop    # starts CodeForge in development mode
npm run package:win    # builds desktop/release/CodeForge-Setup-${version}-x64.exe`}
          </pre>
          <p className="mt-4 text-sm text-muted">
            See the{" "}
            <Link
              href="/docs/building-from-source"
              className="text-cyan underline underline-offset-4"
            >
              developer guide
            </Link>{" "}
            for macOS and Linux builds and the full list of commands.
          </p>
        </section>
      </div>
    </>
  );
}
