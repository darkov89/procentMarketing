"use client";

import React from "react";
import Link from "next/link";
import {
  Compass,
  CheckCircle2,
  PackageCheck,
  Send,
  MessageSquare,
  PhoneCall,
  ChevronRight,
  TrendingUp,
} from "lucide-react";

interface FunnelStage {
  id: string;
  label: string;
  count: number;
  icon: React.ElementType;
  status: string;
  conversionPercent?: number;
  conversionLabel?: string;
  badgeColor?: string;
}

interface PipelineFunnelProps {
  discovered: number;
  qualified: number;
  batched: number;
  outreached: number;
  replied: number;
  inTalks: number;
  paid?: number;
}

export function PipelineFunnel({
  discovered,
  qualified,
  batched,
  outreached,
  replied,
  inTalks,
  paid = 0,
}: PipelineFunnelProps) {
  const calcRate = (current: number, base: number) => {
    if (base <= 0) return 0;
    return Math.round((current / base) * 1000) / 10;
  };

  const stages: FunnelStage[] = [
    {
      id: "discovered",
      label: "1. Znalezione",
      count: discovered,
      icon: Compass,
      status: "all",
      conversionLabel: "Baza startowa",
      badgeColor: "text-slate-400 bg-slate-800/80 border-slate-700",
    },
    {
      id: "qualified",
      label: "2. Kwalifikacja",
      count: qualified,
      icon: CheckCircle2,
      status: "qualified",
      conversionPercent: calcRate(qualified, discovered),
      conversionLabel: `${calcRate(qualified, discovered)}% z bazy`,
      badgeColor: "text-sky-400 bg-sky-950/60 border-sky-800/60",
    },
    {
      id: "batched",
      label: "3. W partii (Gotowe)",
      count: batched,
      icon: PackageCheck,
      status: "approved",
      conversionPercent: calcRate(batched, qualified),
      conversionLabel: `${calcRate(batched, qualified)}% gotowych`,
      badgeColor: "text-indigo-400 bg-indigo-950/60 border-indigo-800/60",
    },
    {
      id: "outreached",
      label: "4. Wysłane (Outreach)",
      count: outreached,
      icon: Send,
      status: "in_sequence",
      conversionPercent: calcRate(outreached, batched),
      conversionLabel: `${calcRate(outreached, batched)}% wysłanych`,
      badgeColor: "text-amber-400 bg-amber-950/60 border-amber-800/60",
    },
    {
      id: "replied",
      label: "5. Odpowiedź",
      count: replied,
      icon: MessageSquare,
      status: "replied",
      conversionPercent: calcRate(replied, outreached),
      conversionLabel: `${calcRate(replied, outreached)}% odpowiedzi`,
      badgeColor: "text-emerald-400 bg-emerald-950/60 border-emerald-800/60",
    },
    {
      id: "in_talks",
      label: "6. Rozmowa / Deal",
      count: inTalks,
      icon: PhoneCall,
      status: "in_talks",
      conversionPercent: calcRate(inTalks, replied),
      conversionLabel: `${calcRate(inTalks, replied)}% rozmów`,
      badgeColor: "text-[#FFE600] bg-yellow-950/60 border-yellow-800/60",
    },
  ];

  const overallConversion = calcRate(inTalks, discovered);

  return (
    <div className="bg-[#0E1424] border border-slate-800/90 rounded-2xl p-6 shadow-2xl relative overflow-hidden">
      {/* Background ambient subtle glow */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Funnel Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-800/80">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-black text-white tracking-tight flex items-center gap-2">
              <TrendingUp className="text-[#FFE600]" size={18} />
              Interaktywny Lejek Konwersji B2B (Pipeline Engine)
            </h2>
            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-400 border border-emerald-800/60">
              Live Real-Time
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Wizualizacja przepływu kontaktów z rejestrów i Google Places przez audyt, akceptację, outreach i odpowiedzi.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">
              Globalny Win-Rate
            </span>
            <span className="text-base font-black text-[#FFE600]">
              {overallConversion}%
            </span>
          </div>
          <div className="h-8 w-px bg-slate-800" />
          <Link
            href="/leads"
            className="text-xs text-sky-400 hover:text-sky-300 font-bold hover:underline flex items-center gap-1"
          >
            Zobacz całą tabelę CRM →
          </Link>
        </div>
      </div>

      {/* Funnel Pipeline Stages Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
        {stages.map((stage, idx) => {
          const Icon = stage.icon;
          const maxBase = Math.max(discovered, 1);
          const percentOfTotal = Math.min(Math.round((stage.count / maxBase) * 100), 100);

          return (
            <Link
              key={stage.id}
              href={`/leads?status=${stage.status}`}
              className="group relative bg-[#131B2F] hover:bg-[#1A243D] border border-slate-800 hover:border-[#FFE600]/80 rounded-xl p-4 transition-all duration-200 shadow-md hover:shadow-lg hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-[#FFE600]"
            >
              {/* Stage number & Icon */}
              <div className="flex items-center justify-between mb-2.5">
                <div className="w-8 h-8 rounded-lg bg-slate-800/80 group-hover:bg-slate-700/80 border border-slate-700/60 flex items-center justify-center text-slate-300 group-hover:text-white transition-colors">
                  <Icon size={16} />
                </div>
                {idx < stages.length - 1 && (
                  <span className="hidden lg:block text-slate-700 group-hover:text-slate-500 transition-colors">
                    <ChevronRight size={14} />
                  </span>
                )}
              </div>

              {/* Stage Label */}
              <div className="text-xs font-bold text-slate-300 group-hover:text-white transition-colors truncate">
                {stage.label}
              </div>

              {/* Count */}
              <div className="mt-1 flex items-baseline justify-between gap-1">
                <span className="text-2xl font-black text-white group-hover:text-[#FFE600] transition-colors tracking-tight">
                  {stage.count}
                </span>
              </div>

              {/* Progress bar representing share of top of funnel */}
              <div className="mt-2.5 h-1.5 w-full bg-slate-800/80 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-sky-500 to-[#FFE600] rounded-full transition-all duration-500"
                  style={{ width: `${percentOfTotal}%` }}
                />
              </div>

              {/* Conversion pill */}
              <div className="mt-2.5">
                <span
                  className={`inline-block text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${
                    stage.badgeColor || "text-slate-400 bg-slate-800 border-slate-700"
                  }`}
                >
                  {stage.conversionLabel}
                </span>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Pipeline Micro-Footer */}
      <div className="mt-4 pt-3 border-t border-slate-800/60 flex flex-wrap items-center justify-between text-[11px] text-slate-400 gap-2">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-400" />
          Kliknij dowolny etap lejka, aby natychmiast otworzyć przefiltrowaną listę firm w CRM.
        </span>
        <span className="font-mono text-slate-400">
          Potwierdzone sukcesy handlowe: <strong className="text-white">{paid}</strong>
        </span>
      </div>
    </div>
  );
}
