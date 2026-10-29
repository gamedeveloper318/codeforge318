import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-4 text-center">
      <p className="font-mono text-sm text-cyan">404</p>
      <h1 className="mt-3 text-4xl font-bold tracking-tight">This page doesn&apos;t exist</h1>
      <p className="mt-3 text-muted">The link may be broken, or the page may have moved.</p>
      <div className="mt-8 flex gap-3">
        <Link
          href="/"
          className="rounded-xl bg-brand-gradient px-5 py-2.5 font-semibold text-white"
        >
          Go home
        </Link>
        <Link
          href="/docs"
          className="rounded-xl border border-line-strong px-5 py-2.5 font-semibold text-ink"
        >
          Documentation
        </Link>
      </div>
    </div>
  );
}
