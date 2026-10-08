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
  Sparkles,
  Zap,
  ArrowRight,
} from "lucide-react";

interface FunnelStage {
  id: string;
  stepNumber: string;
  label: string;
  count: number;
  icon: React.ElementType;
  status: string;
  conversionPercent?: number;
  conversionLabel: string;
  badgeColor: string;
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
      stepNumber: "01",
      label: "Znalezione",
      count: discovered,
      icon: Compass,
      status: "all",
      conversionLabel: "Start bazy",
      badgeColor: "text-slate-300 bg-slate-800/80 border-slate-700",
    },
    {
      id: "qualified",
      stepNumber: "02",
      label: "Kwalifikacja",
      count: qualified,
      icon: CheckCircle2,
      status: "qualified",
      conversionPercent: calcRate(qualified, discovered),
      conversionLabel: `${calcRate(qualified, discovered)}% bazy`,
      badgeColor: "text-sky-300 bg-sky-950/80 border-sky-800/60",
    },
    {
      id: "batched",
      stepNumber: "03",
      label: "Gotowa Oferta",
      count: batched,
      icon: PackageCheck,
      status: "approved",
      conversionPercent: calcRate(batched, qualified),
      conversionLabel: `${calcRate(batched, qualified)}% gotowych`,
      badgeColor: "text-indigo-300 bg-indigo-950/80 border-indigo-800/60",
    },
    {
      id: "outreached",
      stepNumber: "04",
      label: "Wysłane",
      count: outreached,
      icon: Send,
      status: "in_sequence",
      conversionPercent: calcRate(outreached, batched),
      conversionLabel: `${calcRate(outreached, batched)}% wysłanych`,
      badgeColor: "text-amber-300 bg-amber-950/80 border-amber-800/60",
    },
    {
      id: "replied",
      stepNumber: "05",
      label: "Odpowiedź",
      count: replied,
      icon: MessageSquare,
      status: "replied",
      conversionPercent: calcRate(replied, outreached),
      conversionLabel: `${calcRate(replied, outreached)}% odp.`,
      badgeColor: "text-emerald-300 bg-emerald-950/80 border-emerald-800/60",
    },
    {
      id: "in_talks",
      stepNumber: "06",
      label: "Rozmowa / Deal",
      count: inTalks,
      icon: PhoneCall,
      status: "in_talks",
      conversionPercent: calcRate(inTalks, replied),
      conversionLabel: `${calcRate(inTalks, replied)}% rozmów`,
      badgeColor: "text-[#FFE600] bg-yellow-950/80 border-yellow-800/60",
    },
  ];

  const overallConversion = calcRate(inTalks, discovered);

  return (
    <div className="bg-[#0D1322] border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl relative overflow-hidden space-y-5">
      {/* Background ambient subtle glow */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-yellow-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Autonomous Machine Header & Value Highlight */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <h2 className="text-base font-black text-white tracking-tight flex items-center gap-2">
              <TrendingUp className="text-[#FFE600]" size={18} />
              Autonomiczny Lejek Pozyskiwania (Active Campaign Engine)
            </h2>
            <span className="text-[10px] uppercase font-mono font-bold tracking-wider px-2 py-0.5 rounded-full bg-[#FFE600]/10 text-[#FFE600] border border-[#FFE600]/30 hidden sm:inline-flex">
              Full Automation
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Automatyczne odkrywanie leadów z Google Places &bull; Audyt technologiczny WWW &bull; Generowanie ofert B2B &bull; Outreach
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block font-mono">
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
            Pełny CRM &rarr;
          </Link>
        </div>
      </div>

      {/* Autonomous Workflow Bar (ActiveCampaign Visual Journey) */}
      <div className="bg-[#080C14] border border-slate-800/80 rounded-xl p-3 text-xs text-slate-300 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-slate-400 font-mono text-[11px]">
          <Zap size={14} className="text-[#FFE600]" />
          <span className="font-bold text-white uppercase tracking-wider">Przebieg Maszyny:</span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-medium text-slate-300">
          <span className="text-white font-bold">1. Google Places / CEIDG</span>
          <span className="text-slate-600">&rarr;</span>
          <span className="text-sky-300 font-semibold">2. Auto-Audyt WWW</span>
          <span className="text-slate-600">&rarr;</span>
          <span className="text-[#FFE600] font-bold">3. Auto-Oferta /o/[token]</span>
          <span className="text-slate-600">&rarr;</span>
          <span className="text-amber-300 font-semibold">4. Akceptacja & Outreach</span>
          <span className="text-slate-600">&rarr;</span>
          <span className="text-emerald-400 font-bold">5. Spotkanie & Deal</span>
        </div>
      </div>

      {/* Funnel Pipeline Stages Grid (Equal Heights, No Wrapping Glitches) */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 items-stretch">
        {stages.map((stage, idx) => {
          const Icon = stage.icon;
          const maxBase = Math.max(discovered, 1);
          const percentOfTotal = Math.min(Math.round((stage.count / maxBase) * 100), 100);

          return (
            <Link
              key={stage.id}
              href={`/leads?status=${stage.status}`}
              className="group relative bg-[#111827] hover:bg-[#152033] border border-slate-800 hover:border-[#FFE600] rounded-xl p-3.5 transition-all duration-200 shadow-md flex flex-col justify-between h-full min-h-[145px] focus:outline-none focus:ring-2 focus:ring-[#FFE600]"
            >
              {/* Stage Top: Step & Icon */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-mono font-bold text-slate-500 group-hover:text-slate-400">
                    KROK {stage.stepNumber}
                  </span>
                  <div className="w-7 h-7 rounded-lg bg-slate-800/80 group-hover:bg-slate-700/80 border border-slate-700/60 flex items-center justify-center text-slate-300 group-hover:text-[#FFE600] transition-colors">
                    <Icon size={14} />
                  </div>
                </div>

                {/* Stage Label */}
                <div className="text-xs font-bold text-slate-200 group-hover:text-white transition-colors truncate">
                  {stage.label}
                </div>

                {/* Count */}
                <div className="mt-1 text-2xl font-black text-white group-hover:text-[#FFE600] transition-colors tracking-tight">
                  {stage.count}
                </div>
              </div>

              {/* Stage Bottom: Progress & Conversion */}
              <div className="mt-3 pt-2 border-t border-slate-800/60">
                {/* Micro Progress Bar */}
                <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden mb-2">
                  <div
                    className="h-full bg-gradient-to-r from-sky-500 via-indigo-500 to-[#FFE600] rounded-full transition-all duration-500"
                    style={{ width: `${Math.max(percentOfTotal, 5)}%` }}
                  />
                </div>

                {/* Conversion Pill */}
                <span
                  className={`inline-block text-[9px] font-mono font-bold px-2 py-0.5 rounded border truncate max-w-full ${stage.badgeColor}`}
                >
                  {stage.conversionLabel}
                </span>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Pipeline Micro-Footer */}
      <div className="pt-2 border-t border-slate-800/60 flex flex-wrap items-center justify-between text-[11px] text-slate-400 gap-2">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-400" />
          Kliknij dowolny etap lejka, aby otworzyć przefiltrowaną listę firm w CRM.
        </span>
        <span className="font-mono text-slate-400">
          Wygrane deale: <strong className="text-white">{paid}</strong>
        </span>
      </div>
    </div>
  );
}
