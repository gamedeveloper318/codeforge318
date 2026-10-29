"use client";

import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import Image from "next/image";
import { useRef } from "react";

/**
 * A real screenshot of the CodeForge desktop app, tilted back in 3D and
 * flattening as it scrolls into view.
 */
export function Showcase({ src, version }: { src: string; version: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "center center"] });
  const rotateX = useTransform(scrollYProgress, [0, 1], [18, 0]);
  const scale = useTransform(scrollYProgress, [0, 1], [0.92, 1]);
  const opacity = useTransform(scrollYProgress, [0, 0.4], [0.4, 1]);

  return (
    <section className="relative px-4 pb-24 sm:px-6" aria-label="CodeForge editor preview">
      <div ref={ref} className="mx-auto max-w-6xl [perspective:1600px]">
        <motion.figure
          style={reduce ? undefined : { rotateX, scale, opacity }}
          className="relative origin-top"
        >
          <div
            className="absolute -inset-px -z-10 rounded-[18px] bg-gradient-to-b from-cyan/40 via-blue/20 to-violet/30 blur-xl"
            aria-hidden
          />
          <div className="overflow-hidden rounded-2xl border border-line-strong bg-surface shadow-[0_40px_120px_-30px_rgba(0,0,0,0.9)]">
            <div
              className="flex h-8 items-center gap-2 border-b border-line bg-bg-elevated px-4"
              aria-hidden
            >
              <span className="h-2.5 w-2.5 rounded-full bg-[#334155]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#334155]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#334155]" />
            </div>
            <Image
              src={src}
              alt="The CodeForge editor with a TypeScript file open, the file explorer, Git status colors and an integrated PowerShell terminal."
              width={1440}
              height={900}
              className="h-auto w-full"
              sizes="(min-width: 1152px) 1152px, 100vw"
              priority
            />
          </div>
          <figcaption className="mt-4 text-center text-sm text-subtle">
            Actual screenshot of CodeForge {version} on Windows.
          </figcaption>
        </motion.figure>
      </div>
    </section>
  );
}
