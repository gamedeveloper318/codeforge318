import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";

export const metadata: Metadata = {
  title: "Terms of use",
  description: "The terms that apply to using CodeForge and this website.",
};

export default function TermsPage() {
  return (
    <>
      <PageHeader eyebrow="Legal" title="Terms of use">
        Last updated October 30, 2026.
      </PageHeader>
      <div className="prose-cf mx-auto max-w-3xl px-4 py-14 sm:px-6">
        <p>By downloading or using CodeForge or this website, you agree to these terms.</p>

        <h2>Using CodeForge</h2>
        <p>
          You may download, install and use CodeForge free of charge for personal and commercial
          work. You are responsible for the code, files and commands you create, open or run with it
          — including commands run in the integrated terminal and programs started from the Run
          view.
        </p>

        <h2>Early-release software</h2>
        <p>
          CodeForge is provided <strong>“as is”</strong>, without warranty of any kind, express or
          implied, including fitness for a particular purpose. Early releases may contain bugs. Keep
          backups and use version control for important work. To the maximum extent permitted by
          law, the authors are not liable for any damages arising from the use of CodeForge.
        </p>

        <h2>Third-party software</h2>
        <p>
          CodeForge includes open-source components such as Electron, the Monaco editor, xterm.js,
          React and node-pty, each under its own license. Their license notices are included with
          the application. Git, language runtimes and shells that CodeForge starts are separate
          programs installed by you.
        </p>

        <h2>Trademarks</h2>
        <p>
          “CodeForge” and the CodeForge logo identify this project. CodeForge is independent and is
          not affiliated with, endorsed by or sponsored by Microsoft. Visual Studio Code is a
          trademark of Microsoft Corporation.
        </p>

        <h2>Changes</h2>
        <p>
          These terms may be updated; the date above shows the latest version. Questions are welcome
          on the <Link href="/support">support page</Link>.
        </p>
      </div>
    </>
  );
}
