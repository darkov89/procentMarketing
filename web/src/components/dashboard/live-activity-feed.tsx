"use client";

import React from "react";
import Link from "next/link";
import {
  Activity,
  ArrowRight,
  ExternalLink,
  ShieldCheck,
  Building,
  CheckCircle2,
  Clock,
  Sparkles,
} from "lucide-react";
import { getStatusMeta } from "@/lib/status-meta";

export interface ActivityEvent {
  id: number;
  leadId: number;
  companyName: string;
  fromStatus: string;
  toStatus: string;
  reason: string | null;
  actor: string;
  createdAt: Date | string;
}

interface LiveActivityFeedProps {
  events: ActivityEvent[];
}

function timeAgo(date: Date | string): string {
  const now = new Date();
  const d = new Date(date);
  const diffSec = Math.floor((now.getTime() - d.getTime()) / 1000);

  if (diffSec < 60) return "przed chwilą";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)} min temu`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} godz. temu`;
  return `${Math.floor(diffSec / 86400)} dni temu`;
}

export function LiveActivityFeed({ events }: LiveActivityFeedProps) {
  return (
    <div className="bg-[#0D1322] border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col h-full">
      <div className="flex items-center justify-between pb-4 border-b border-slate-800/80 mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-950/80 border border-indigo-800/60 flex items-center justify-center text-indigo-400">
            <Activity size={16} />
          </div>
          <div>
            <h3 className="text-sm font-black text-white tracking-tight flex items-center gap-2">
              Dziennik Aktywności (Live Feed)
            </h3>
            <p className="text-[11px] text-slate-400">
              Automatyczne audyty WWW, przejścia statusów i zdarzenia silnika
            </p>
          </div>
        </div>

        <Link
          href="/outbox/history"
          className="text-xs text-sky-400 hover:text-sky-300 font-bold hover:underline flex items-center gap-1"
        >
          <span>Pełna historia</span>
          <ArrowRight size={13} />
        </Link>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto max-h-[380px] pr-1">
        {events.length === 0 ? (
          <div className="text-center py-10 px-4">
            <Sparkles size={28} className="mx-auto text-slate-600 mb-2" />
            <p className="text-xs font-semibold text-slate-400">
              Brak zarejestrowanych zdarzeń w bieżącej sesji.
            </p>
            <p className="text-[11px] text-slate-500 mt-1">
              Rozpocznij nowe wyszukiwanie lub uruchom audyt techniczny w CRM.
            </p>
            <Link
              href="/discovery"
              className="inline-block mt-3 text-xs bg-[#FFE600] text-black font-extrabold px-3.5 py-1.5 rounded-lg hover:bg-yellow-400 transition-colors"
            >
              Uruchom Skaner Leadów
            </Link>
          </div>
        ) : (
          events.map((event) => {
            const toMeta = getStatusMeta(event.toStatus);
            return (
              <div
                key={event.id}
                className="group bg-[#131B2F] hover:bg-[#1A243D] border border-slate-800/80 hover:border-slate-700 p-3.5 rounded-xl transition-all flex items-start justify-between gap-3"
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-slate-800/90 border border-slate-700/60 flex items-center justify-center text-slate-300 shrink-0 mt-0.5">
                    <Building size={15} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link
                        href={`/leads/${event.leadId}`}
                        className="text-xs font-bold text-white hover:text-[#FFE600] transition-colors truncate max-w-[200px]"
                      >
                        {event.companyName}
                      </Link>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${toMeta.className}`}>
                        {toMeta.label}
                      </span>
                    </div>

                    {event.reason && (
                      <p className="text-[11px] text-slate-400 mt-1 line-clamp-1">
                        {event.reason}
                      </p>
                    )}

                    <div className="flex items-center gap-3 mt-1.5 text-[10px] text-slate-500 font-mono">
                      <span className="flex items-center gap-1">
                        <Clock size={11} />
                        {timeAgo(event.createdAt)}
                      </span>
                      <span>·</span>
                      <span className="text-slate-400">
                        Aktor: {event.actor}
                      </span>
                    </div>
                  </div>
                </div>

                <Link
                  href={`/leads/${event.leadId}`}
                  className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-white p-1 rounded transition-opacity shrink-0"
                  title="Otwórz Dossier Leada"
                >
                  <ExternalLink size={14} />
                </Link>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
