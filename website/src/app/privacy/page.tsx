import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";

export const metadata: Metadata = {
  title: "Privacy policy",
  description: "How CodeForge and this website handle your data.",
};

export default function PrivacyPage() {
  return (
    <>
      <PageHeader eyebrow="Legal" title="Privacy policy">
        Last updated October 30, 2026.
      </PageHeader>
      <div className="prose-cf mx-auto max-w-3xl px-4 py-14 sm:px-6">
        <p>
          CodeForge is designed to keep your work on your computer. This policy explains what the
          CodeForge desktop application and this website do — and don&apos;t do — with your data.
        </p>

        <h2>The CodeForge desktop application</h2>
        <ul>
          <li>
            <strong>No telemetry or analytics.</strong> The application does not collect usage
            statistics, crash reports or any other data, and does not send your code or files
            anywhere.
          </li>
          <li>
            <strong>No account.</strong> You don&apos;t need to sign in, and CodeForge has no cloud
            service.
          </li>
          <li>
            <strong>Local storage only.</strong> Your settings, recent folders, window position and
            a diagnostic log are stored on your computer (on Windows in{" "}
            <code>%APPDATA%\CodeForge</code>). You can delete that folder at any time.
          </li>
          <li>
            <strong>Network access you start.</strong> CodeForge only uses the network when you ask
            it to — for example when you run
            <code> git pull</code> or <code>git push</code>, open a link in your browser, preview a
            local development server, or run commands in the terminal. Those actions talk to the
            services you choose, under their own privacy policies.
          </li>
        </ul>

        <h2>This website</h2>
        <ul>
          <li>
            The website does not use cookies, analytics or advertising trackers, and has no sign-up
            forms.
          </li>
          <li>
            It is hosted on Vercel. Like any web host, Vercel processes technical information such
            as IP addresses and request logs to deliver and secure the site. See{" "}
            <a href="https://vercel.com/legal/privacy-policy" rel="noopener">
              Vercel&apos;s privacy policy
            </a>
            .
          </li>
          <li>
            Installer downloads may be served by GitHub Releases, which is subject to{" "}
            <a
              href="https://docs.github.com/site-policy/privacy-policies/github-general-privacy-statement"
              rel="noopener"
            >
              GitHub&apos;s privacy statement
            </a>
            .
          </li>
        </ul>

        <h2>Changes and contact</h2>
        <p>
          If this policy changes, the updated version will be published on this page with a new
          date. Questions? See the <Link href="/support">support page</Link>.
        </p>
      </div>
    </>
  );
}
