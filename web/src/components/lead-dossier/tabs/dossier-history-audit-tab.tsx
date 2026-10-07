"use client";

import React from "react";
import { FullLeadDossier } from "../dossier-types";
import { History, Shield, Calendar, User, ArrowRight } from "lucide-react";

interface DossierHistoryAuditTabProps {
  lead: FullLeadDossier;
}

export function DossierHistoryAuditTab({ lead }: DossierHistoryAuditTabProps) {
  const events = lead.leadEvents || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-extrabold uppercase tracking-wider text-white flex items-center gap-2">
            <History size={18} className="text-[#FFE600]" />
            Dziennik Zdarzeń & Ścieżka Audytu (Inwariant 3)
          </h3>
          <p className="text-xs text-[#94A3B8]">
            Każda zmiana stanu leada jest trwale logowana w bazie z identyfikatorem aktora i powodem przejścia.
          </p>
        </div>
        <span className="text-xs bg-[#1E293B] text-[#94A3B8] px-2.5 py-1 rounded font-mono">
          {events.length} wpisów
        </span>
      </div>

      {events.length === 0 ? (
        <div className="bg-[#141C2E] border border-[#28354D] p-8 rounded-2xl text-center space-y-2">
          <Shield size={32} className="mx-auto text-[#64748B]" />
          <p className="text-sm text-[#94A3B8]">Brak zarejestrowanych zdarzeń audytowych.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {events.map((ev) => (
            <div
              key={ev.id}
              className="bg-[#141C2E] p-4 rounded-xl border border-[#28354D] flex flex-wrap items-center justify-between gap-3 text-xs"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-[#FFE600] uppercase font-mono text-[11px]">
                    {ev.eventType}
                  </span>
                  {ev.fromStatus && ev.toStatus && (
                    <div className="flex items-center gap-1.5 text-white font-mono text-[11px] bg-[#0A0E17] px-2 py-0.5 rounded border border-[#1E293B]">
                      <span>{ev.fromStatus}</span>
                      <ArrowRight size={10} className="text-[#64748B]" />
                      <span className="text-emerald-400 font-bold">{ev.toStatus}</span>
                    </div>
                  )}
                </div>

                {ev.reason && (
                  <p className="text-[#CBD5E1] text-xs">
                    Powód: <span className="italic">{ev.reason}</span>
                  </p>
                )}
              </div>

              <div className="text-right text-[#94A3B8] text-[11px] space-y-0.5">
                <div className="flex items-center gap-1 justify-end font-mono">
                  <Calendar size={11} /> {new Date(ev.createdAt).toLocaleString("pl-PL")}
                </div>
                {ev.actor && (
                  <div className="flex items-center gap-1 justify-end">
                    <User size={11} /> Aktor: <strong className="text-white">{ev.actor}</strong>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
