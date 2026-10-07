"use client";

import React from "react";
import Link from "next/link";
import {
  ShieldAlert,
  Globe,
  Mail,
  AlertTriangle,
  ArrowRight,
  Plus,
  Upload,
  ShieldCheck,
  Sliders,
} from "lucide-react";

interface DataHealthCardProps {
  totalLeads: number;
  withWebsite: number;
  missingContactPercent: number;
  requiresManualReviewCount: number;
  requiresManualReviewPercent: number;
}

export function DataHealthCard({
  totalLeads,
  withWebsite,
  missingContactPercent,
  requiresManualReviewCount,
  requiresManualReviewPercent,
}: DataHealthCardProps) {
  const websitePercent = totalLeads > 0 ? Math.round((withWebsite / totalLeads) * 100) : 0;
  const withContactPercent = Math.max(0, 100 - missingContactPercent);

  return (
    <div className="bg-[#0E1424] border border-slate-800/90 rounded-2xl p-6 shadow-xl flex flex-col justify-between h-full">
      <div>
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800/80 mb-5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-950/80 border border-emerald-800/60 flex items-center justify-center text-emerald-400">
              <ShieldCheck size={16} />
            </div>
            <div>
              <h3 className="text-sm font-black text-white tracking-tight">
                Kondycja Bazy & Rejestrów
              </h3>
              <p className="text-[11px] text-slate-400">
                Weryfikacja domen WWW, danych kontaktowych i wymogów audytu
              </p>
            </div>
          </div>

          <Link
            href="/leads"
            className="text-xs text-sky-400 hover:text-sky-300 font-bold hover:underline flex items-center gap-1"
          >
            <span>Filtry CRM</span>
            <ArrowRight size={13} />
          </Link>
        </div>

        {/* Meters */}
        <div className="space-y-4">
          {/* Strony WWW */}
          <div>
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="font-bold text-slate-300 flex items-center gap-1.5">
                <Globe size={13} className="text-emerald-400" />
                Firmy ze stroną WWW
              </span>
              <span className="font-mono font-bold text-white">
                {withWebsite} <span className="text-slate-500 font-normal">/ {totalLeads} ({websitePercent}%)</span>
              </span>
            </div>
            <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                style={{ width: `${websitePercent}%` }}
              />
            </div>
          </div>

          {/* Kontakt */}
          <div>
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="font-bold text-slate-300 flex items-center gap-1.5">
                <Mail size={13} className="text-sky-400" />
                Zidentyfikowany kontakt (E-mail / Tel)
              </span>
              <span className="font-mono font-bold text-white">
                {withContactPercent}% <span className="text-slate-500 font-normal">bazy</span>
              </span>
            </div>
            <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-sky-500 rounded-full transition-all duration-500"
                style={{ width: `${withContactPercent}%` }}
              />
            </div>
          </div>

          {/* Do ręcznej weryfikacji */}
          <Link
            href="/leads?filter=needs_review"
            className="group flex items-center justify-between p-3 rounded-xl bg-[#131B2F] hover:bg-[#1A243D] border border-slate-800 hover:border-amber-500/50 transition-all cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-amber-950/80 border border-amber-800/60 flex items-center justify-center text-amber-400 shrink-0">
                <AlertTriangle size={14} />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-200 group-hover:text-white transition-colors">
                  Kolejka Spraw Niejasnych
                </div>
                <div className="text-[10px] text-slate-400">
                  Wymóg EU AI Act (Art. 14) – weryfikacja człowieka
                </div>
              </div>
            </div>
            <div className="text-right">
              <span className="text-sm font-black text-amber-400 font-mono">
                {requiresManualReviewCount}
              </span>
              <span className="text-[10px] text-slate-500 block">
                {requiresManualReviewPercent}%
              </span>
            </div>
          </Link>
        </div>
      </div>

      {/* Quick Launchpad Buttons */}
      <div className="mt-6 pt-4 border-t border-slate-800/80">
        <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block mb-2.5">
          Szybkie Akcje Operacyjne
        </span>
        <div className="grid grid-cols-2 gap-2">
          <Link
            href="/discovery"
            className="flex items-center gap-2 bg-[#131B2F] hover:bg-[#1A243D] border border-slate-800 hover:border-[#FFE600]/80 p-2.5 rounded-xl text-xs font-bold text-slate-200 hover:text-white transition-all"
          >
            <Plus size={14} className="text-[#FFE600]" />
            <span>Skaner Miejsc</span>
          </Link>
          <Link
            href="/leads/import"
            className="flex items-center gap-2 bg-[#131B2F] hover:bg-[#1A243D] border border-slate-800 hover:border-sky-500/80 p-2.5 rounded-xl text-xs font-bold text-slate-200 hover:text-white transition-all"
          >
            <Upload size={14} className="text-sky-400" />
            <span>Import CSV/XLS</span>
          </Link>
          <Link
            href="/outbox"
            className="flex items-center gap-2 bg-[#131B2F] hover:bg-[#1A243D] border border-slate-800 hover:border-emerald-500/80 p-2.5 rounded-xl text-xs font-bold text-slate-200 hover:text-white transition-all"
          >
            <ShieldCheck size={14} className="text-emerald-400" />
            <span>Zatwierdź Oferty</span>
          </Link>
          <Link
            href="/settings"
            className="flex items-center gap-2 bg-[#131B2F] hover:bg-[#1A243D] border border-slate-800 hover:border-indigo-500/80 p-2.5 rounded-xl text-xs font-bold text-slate-200 hover:text-white transition-all"
          >
            <Sliders size={14} className="text-indigo-400" />
            <span>Ustawienia</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
