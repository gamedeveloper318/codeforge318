import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";

export const metadata: Metadata = {
  title: "FAQ",
  description: "Answers to common questions about CodeForge.",
};

const FAQ: { q: string; a: React.ReactNode }[] = [
  {
    q: "Is CodeForge free?",
    a: "Yes. CodeForge is free to download and use.",
  },
  {
    q: "Is CodeForge a fork of Visual Studio Code?",
    a: "No. CodeForge is an independent editor built with Electron, React and Monaco — the open-source editing component that also powers VS Code. Workflows and shortcuts will feel familiar, but CodeForge has its own code, interface and branding, and is not affiliated with Microsoft.",
  },
  {
    q: "Can I use VS Code extensions?",
    a: "Not today. CodeForge does not run VS Code extensions. An extension system is on the roadmap; until it exists we won't claim compatibility.",
  },
  {
    q: "Which languages are supported?",
    a: (
      <>
        Syntax highlighting covers more than 70 file types. Python gets completion, type errors,
        hover and go to definition from the bundled Pyright language server, and TypeScript,
        JavaScript, JSON, CSS, SCSS, Less and HTML have built-in completion, diagnostics and
        formatting. See <Link href="/docs/languages">Languages</Link> for details.
      </>
    ),
  },
  {
    q: "Does CodeForge update itself?",
    a: (
      <>
        Yes, from version 0.2.0. New versions download in the background and CodeForge asks before
        restarting; you can also use <em>Help → Check for Updates…</em>. Version 0.1.1 has no
        updater, so install the latest version from the <Link href="/download">download page</Link>{" "}
        once.
      </>
    ),
  },
  {
    q: "Does CodeForge send my code anywhere?",
    a: (
      <>
        No. There is no telemetry, no account and no cloud service. Network access only happens when
        you ask for it — for example
        <code> git push</code>, or opening a link. See the{" "}
        <Link href="/privacy">privacy policy</Link>.
      </>
    ),
  },
  {
    q: "Is the terminal real?",
    a: "Yes. Each terminal is a real shell process (PowerShell by default on Windows) connected through a pseudo-terminal, so anything you can run in a normal terminal works there.",
  },
  {
    q: "Why does Windows warn me when I run the installer?",
    a: (
      <>
        Early releases are not code-signed yet, so SmartScreen doesn&apos;t recognise the publisher.
        Choose <em>More info → Run anyway</em>. The <Link href="/download">download page</Link>{" "}
        lists the installer&apos;s SHA-256 checksum so you can verify the file first.
      </>
    ),
  },
  {
    q: "Does it support debugging?",
    a: "Breakpoint debugging is not in the current release. You can run programs from the Run view or the terminal, and use your language's own debugger there in the meantime.",
  },
  {
    q: "Is there a Mac or Linux version?",
    a: (
      <>
        The build configuration for macOS and Linux exists, but those builds haven&apos;t been
        tested yet, so only Windows has an installer. You can{" "}
        <Link href="/docs/building-from-source">build from source</Link> on any platform.
      </>
    ),
  },
  {
    q: "Where are my settings stored?",
    a: (
      <>
        In <code>%APPDATA%\CodeForge\settings.json</code> on Windows. Deleting that file resets
        every setting to its default.
      </>
    ),
  },
];

export default function FaqPage() {
  return (
    <>
      <PageHeader eyebrow="FAQ" title="Frequently asked questions" />
      <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
        <div className="divide-y divide-line rounded-xl border border-line">
          {FAQ.map(({ q, a }) => (
            <details
              key={q}
              className="group px-5 py-4 [&_a]:text-cyan [&_a]:underline [&_a]:underline-offset-4 [&_code]:font-mono [&_code]:text-ink"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold text-ink">
                {q}
                <span
                  className="text-xl text-subtle transition-transform group-open:rotate-45"
                  aria-hidden
                >
                  +
                </span>
              </summary>
              <div className="mt-3 leading-relaxed text-muted">{a}</div>
            </details>
          ))}
        </div>
      </div>
    </>
  );
}
