import type { ComponentType } from "react";
import { ACCENTS, type Accent } from "./accents";

interface IconTileProps {
  icon: ComponentType<{ className?: string }>;
  title: string;
  desc: string;
  accent: Accent;
}

/** Capability tile — colcoured icon square that inverts on hover. */
export default function IconTile({ icon: Icon, title, desc, accent }: IconTileProps) {
  const a = ACCENTS[accent];
  return (
    <div className="group flex gap-4 rounded-xl border border-transparent p-4 transition-all duration-300 hover:border-zinc-200 hover:bg-zinc-50">
      <span
        className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg transition-colors duration-300 ${a.tileIdle} ${a.tileHover}`}
      >
        <Icon className="h-5 w-5" />
      </span>
      <div>
        <p className="text-sm font-semibold text-zinc-900">{title}</p>
        <p className="mt-1 text-xs leading-relaxed text-zinc-500">{desc}</p>
      </div>
    </div>
  );
}
