"use client";

import { ArrowRight, Download } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { LogoMark } from "./Logo";

export interface HeroDownload {
  url: string;
  label: string;
  meta: string;
}

// Fixed positions keep server and client rendering identical.
const PARTICLES = Array.from({ length: 22 }, (_, i) => ({
  left: `${(i * 37) % 100}%`,
  delay: `${(i * 1.7) % 12}s`,
  duration: `${14 + ((i * 5) % 12)}s`,
  opacity: 0.25 + ((i * 13) % 50) / 100,
}));

const ease = [0.22, 1, 0.36, 1] as const;

export function Hero({
  name,
  tagline,
  description,
  version,
  download,
}: {
  name: string;
  tagline: string;
  description: string;
  version: string;
  download: HeroDownload | null;
}) {
  const reduce = useReducedMotion();
  const enter = (delay: number) =>
    reduce
      ? {}
      : {
          initial: { opacity: 0, y: 18 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.8, delay, ease },
        };

  return (
    <section
      className="relative isolate overflow-hidden pb-16 pt-20 sm:pb-24 sm:pt-28"
      aria-labelledby="hero-title"
    >
      {/* Ambient light and drifting sparks */}
      <div className="grid-backdrop pointer-events-none absolute inset-0 -z-10" aria-hidden />
      <div
        className="pointer-events-none absolute left-1/2 top-[-12rem] -z-10 h-[34rem] w-[34rem] -translate-x-[85%] animate-float rounded-full bg-cyan/20 blur-[110px]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute left-1/2 top-[-8rem] -z-10 h-[30rem] w-[30rem] -translate-x-[10%] animate-float rounded-full bg-violet/25 blur-[110px] [animation-delay:-4s]"
        aria-hidden
      />
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden>
        {PARTICLES.map((p, i) => (
          <span
            key={i}
            className="particle"
            style={{
              left: p.left,
              animationDelay: p.delay,
              animationDuration: p.duration,
              opacity: p.opacity,
            }}
          />
        ))}
      </div>

      <div className="mx-auto flex max-w-4xl flex-col items-center px-4 text-center sm:px-6">
        <motion.div
          {...(reduce
            ? {}
            : {
                initial: { opacity: 0, scale: 0.8 },
                animate: { opacity: 1, scale: 1 },
                transition: { duration: 0.9, ease },
              })}
          className="relative"
        >
          <div
            className="absolute inset-0 -z-10 animate-pulse-glow rounded-3xl bg-blue/40 blur-2xl"
            aria-hidden
          />
          <LogoMark size={88} />
        </motion.div>

        <motion.h1
          id="hero-title"
          {...enter(0.1)}
          className="text-gradient mt-8 text-6xl font-extrabold leading-[1.02] tracking-[-0.035em] sm:text-8xl"
        >
          {name}
        </motion.h1>
        <motion.p
          {...enter(0.2)}
          className="mt-4 text-balance text-xl font-medium tracking-tight text-ink/90 sm:text-2xl"
        >
          {tagline}
        </motion.p>
        <motion.p
          {...enter(0.3)}
          className="mt-6 max-w-2xl text-balance text-base leading-relaxed text-muted sm:text-lg"
        >
          {description}
        </motion.p>

        <motion.div
          {...enter(0.4)}
          className="mt-10 flex w-full flex-col items-center justify-center gap-3 sm:w-auto sm:flex-row"
        >
          {download ? (
            <a
              href={download.url}
              className="group inline-flex w-full items-center justify-center gap-2.5 rounded-xl bg-brand-gradient px-7 py-3.5 text-base font-semibold text-white shadow-[0_18px_50px_-12px_rgba(59,130,246,0.75)] transition hover:brightness-110 sm:w-auto"
              data-testid="hero-download"
            >
              <Download size={19} />
              {download.label}
            </a>
          ) : (
            <Link
              href="/download"
              className="group inline-flex w-full items-center justify-center gap-2.5 rounded-xl bg-brand-gradient px-7 py-3.5 text-base font-semibold text-white shadow-[0_18px_50px_-12px_rgba(59,130,246,0.75)] transition hover:brightness-110 sm:w-auto"
              data-testid="hero-download"
            >
              <Download size={19} />
              Get CodeForge
            </Link>
          )}
          <Link
            href="/features"
            className="group inline-flex w-full items-center justify-center gap-2 rounded-xl border border-line-strong bg-surface/60 px-7 py-3.5 text-base font-semibold text-ink backdrop-blur transition hover:border-cyan/50 hover:bg-surface sm:w-auto"
          >
            Explore features
            <ArrowRight size={17} className="transition-transform group-hover:translate-x-0.5" />
          </Link>
        </motion.div>

        <motion.p {...enter(0.5)} className="mt-5 text-sm text-subtle" data-testid="availability">
          {download
            ? download.meta
            : `Version ${version} · Windows installer coming soon · Build from source today`}
        </motion.p>

        <motion.ul
          {...enter(0.55)}
          className="mt-6 flex flex-wrap items-center justify-center gap-2"
          aria-label="Supported platforms"
        >
          <PlatformChip
            label="Windows 10 / 11"
            status={download ? "Available" : "Coming soon"}
            highlight={Boolean(download)}
          />
          <PlatformChip label="macOS" status="Build from source" />
          <PlatformChip label="Linux" status="Build from source" />
        </motion.ul>
      </div>
    </section>
  );
}

function PlatformChip({
  label,
  status,
  highlight = false,
}: {
  label: string;
  status: string;
  highlight?: boolean;
}) {
  return (
    <li
      className={`flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs ${
        highlight ? "border-cyan/40 bg-cyan/10 text-ink" : "border-line bg-surface/50 text-muted"
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${highlight ? "bg-cyan shadow-[0_0_8px_#22d3ee]" : "bg-subtle"}`}
        aria-hidden
      />
      <span className="font-medium">{label}</span>
      <span className="text-subtle">· {status}</span>
    </li>
  );
}
