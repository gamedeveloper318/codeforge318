import {
  Bug,
  Code2,
  Command,
  FolderTree,
  GitBranch,
  Palette,
  Play,
  Save,
  Search,
  ShieldCheck,
  Sparkles,
  SquareTerminal,
} from "lucide-react";
import type { Feature } from "@/lib/features";

const ICONS = {
  code: Code2,
  terminal: SquareTerminal,
  git: GitBranch,
  search: Search,
  command: Command,
  shield: ShieldCheck,
  brain: Sparkles,
  play: Play,
  palette: Palette,
  folder: FolderTree,
  save: Save,
  bug: Bug,
} as const;

export function FeatureIcon({ icon }: { icon: Feature["icon"] }) {
  const Icon = ICONS[icon];
  return (
    <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-line-strong bg-gradient-to-br from-cyan/15 via-blue/10 to-violet/15 text-cyan">
      <Icon size={21} strokeWidth={1.8} />
    </span>
  );
}
