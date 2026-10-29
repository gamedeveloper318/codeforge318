import Image from "next/image";
import Link from "next/link";

export function LogoMark({ size = 32, className }: { size?: number; className?: string }) {
  return <Image src="/logo.svg" alt="" width={size} height={size} className={className} priority />;
}

export function LogoLink() {
  return (
    <Link
      href="/"
      className="flex items-center gap-2.5 rounded-lg font-semibold tracking-tight text-ink"
      aria-label="CodeForge home"
    >
      <LogoMark size={30} />
      <span className="text-[17px]">CodeForge</span>
    </Link>
  );
}
