import React from "react";
import Link from "next/link";

export interface StatCardProps {
  label: string;
  value: string | number;
  hint?: string;
  href?: string;
  icon?: React.ElementType;
  trend?: string;
  trendColor?: "emerald" | "sky" | "amber" | "yellow" | "slate";
}

export function StatCard({
  label,
  value,
  hint,
  href,
  icon: Icon,
  trend,
  trendColor = "emerald",
}: StatCardProps) {
  const trendClass = {
    emerald: "text-emerald-400 bg-emerald-950/60 border-emerald-800/60",
    sky: "text-sky-400 bg-sky-950/60 border-sky-800/60",
    amber: "text-amber-400 bg-amber-950/60 border-amber-800/60",
    yellow: "text-[#FFE600] bg-yellow-950/60 border-yellow-800/60",
    slate: "text-slate-400 bg-slate-800/80 border-slate-700",
  }[trendColor];

  const body = (
    <div className="rounded-2xl border border-slate-800/90 bg-[#0E1424] hover:bg-[#131B2F] p-5 shadow-lg transition-all hover:border-[#FFE600]/80 group relative overflow-hidden">
      <div className="flex items-center justify-between gap-3 mb-2">
        <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 group-hover:text-slate-300 transition-colors truncate">
          {label}
        </div>
        {Icon && (
          <div className="w-8 h-8 rounded-lg bg-slate-800/80 border border-slate-700/60 flex items-center justify-center text-slate-300 group-hover:text-[#FFE600] transition-colors shrink-0">
            <Icon size={16} />
          </div>
        )}
      </div>

      <div className="flex items-baseline justify-between gap-2">
        <div className="text-2xl lg:text-3xl font-black text-white group-hover:text-[#FFE600] transition-colors tracking-tight">
          {value}
        </div>
      </div>

      <div className="mt-2.5 flex items-center justify-between gap-2 text-xs">
        {hint ? (
          <div className="text-[11px] text-slate-400 group-hover:text-slate-300 transition-colors truncate">
            {hint}
          </div>
        ) : (
          <div />
        )}
        {trend && (
          <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border shrink-0 ${trendClass}`}>
            {trend}
          </span>
        )}
      </div>
    </div>
  );

  return href ? (
    <Link
      href={href}
      className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FFE600] rounded-2xl transition-transform hover:-translate-y-0.5"
    >
      {body}
    </Link>
  ) : (
    body
  );
}
