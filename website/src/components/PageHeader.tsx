export function PageHeader({
  eyebrow,
  title,
  children,
}: {
  eyebrow?: string;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="relative overflow-hidden border-b border-line">
      <div className="grid-backdrop pointer-events-none absolute inset-0" aria-hidden />
      <div
        className="pointer-events-none absolute -top-40 left-1/2 h-80 w-[46rem] -translate-x-1/2 rounded-full bg-blue/20 blur-3xl"
        aria-hidden
      />
      <div className="relative mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        {eyebrow && (
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan">{eyebrow}</p>
        )}
        <h1 className="mt-3 text-4xl font-bold tracking-tight text-ink sm:text-5xl">{title}</h1>
        {children && (
          <div className="mt-4 max-w-2xl text-lg leading-relaxed text-muted">{children}</div>
        )}
      </div>
    </div>
  );
}
