"use client";

import React from "react";
import { FullLeadDossier } from "../dossier-types";
import { CheckCircle2, XCircle, AlertTriangle, Zap, Activity } from "lucide-react";

interface DossierAuditEvidenceTabProps {
  lead: FullLeadDossier;
  onRunAudit: () => Promise<void>;
  isAuditing?: boolean;
}

export function DossierAuditEvidenceTab({
  lead,
  onRunAudit,
  isAuditing,
}: DossierAuditEvidenceTabProps) {
  const audit = lead.audit;

  if (!audit) {
    return (
      <div className="bg-[#141C2E] border border-[#28354D] p-8 rounded-2xl text-center space-y-4">
        <Activity size={36} className="mx-auto text-[#FFE600]" />
        <h3 className="text-base font-bold text-white">Brak audytu technicznego dla tej witryny</h3>
        <p className="text-xs text-[#94A3B8] max-w-md mx-auto">
          Przeprowadź bezpieczny audyt WWW (Inwariant 6), aby zbadać responsywność, SSL, analitykę GA4,
          formularze i obecność systemu rezerwacji online.
        </p>
        <button
          onClick={onRunAudit}
          disabled={isAuditing}
          className="bg-[#FFE600] hover:bg-[#FFF04D] text-black font-extrabold text-xs px-5 py-2.5 rounded-lg inline-flex items-center gap-2"
        >
          <Zap size={14} />
          {isAuditing ? "Trwa analiza witryny..." : "Uruchom Audyt Teraz"}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 4 Pillars Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-[#141C2E] p-4 rounded-xl border border-[#28354D]">
          <span className="text-[11px] text-[#94A3B8] block mb-1">Certyfikat SSL</span>
          <div className="flex items-center gap-2">
            {audit.sslValid ? (
              <span className="text-emerald-400 font-bold text-sm flex items-center gap-1">
                <CheckCircle2 size={16} /> Aktywny
              </span>
            ) : (
              <span className="text-rose-400 font-bold text-sm flex items-center gap-1">
                <XCircle size={16} /> Brak / Niepoprawny
              </span>
            )}
          </div>
        </div>

        <div className="bg-[#141C2E] p-4 rounded-xl border border-[#28354D]">
          <span className="text-[11px] text-[#94A3B8] block mb-1">Wersja Mobilna</span>
          <div className="flex items-center gap-2">
            {audit.isResponsive ? (
              <span className="text-emerald-400 font-bold text-sm flex items-center gap-1">
                <CheckCircle2 size={16} /> Responsywna
              </span>
            ) : (
              <span className="text-rose-400 font-bold text-sm flex items-center gap-1">
                <XCircle size={16} /> Brak viewportu
              </span>
            )}
          </div>
        </div>

        <div className="bg-[#141C2E] p-4 rounded-xl border border-[#28354D]">
          <span className="text-[11px] text-[#94A3B8] block mb-1">Analityka Google (GA4)</span>
          <div className="flex items-center gap-2">
            {audit.hasGa4 ? (
              <span className="text-emerald-400 font-bold text-sm flex items-center gap-1">
                <CheckCircle2 size={16} /> Zainstalowane
              </span>
            ) : (
              <span className="text-amber-400 font-bold text-sm flex items-center gap-1">
                <AlertTriangle size={16} /> Brak GA4
              </span>
            )}
          </div>
        </div>

        <div className="bg-[#141C2E] p-4 rounded-xl border border-[#28354D]">
          <span className="text-[11px] text-[#94A3B8] block mb-1">Rezerwacja Online</span>
          <div className="flex items-center gap-2">
            {audit.hasOnlineBooking ? (
              <span className="text-emerald-400 font-bold text-sm flex items-center gap-1">
                <CheckCircle2 size={16} /> {audit.bookingTool || "Obecna"}
              </span>
            ) : (
              <span className="text-slate-400 font-bold text-sm flex items-center gap-1">
                Brak widgetu
              </span>
            )}
          </div>
        </div>
      </div>

      {/* SEO & Scores */}
      <div className="bg-[#141C2E] p-5 rounded-2xl border border-[#28354D] space-y-4">
        <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#FFE600]">
          Metadane i Wskaźniki Wydajności
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div>
            <span className="text-[#94A3B8] block font-bold mb-1">Meta Title:</span>
            <div className="bg-[#0A0E17] p-3 rounded-lg border border-[#1E293B] text-white">
              {audit.metaTitle || audit.rawEvidence?.pageTitle || "Brak tagu title"}
            </div>
          </div>
          <div>
            <span className="text-[#94A3B8] block font-bold mb-1">Meta Description:</span>
            <div className="bg-[#0A0E17] p-3 rounded-lg border border-[#1E293B] text-white">
              {audit.metaDescription || "Brak opisu meta description"}
            </div>
          </div>
        </div>

        {audit.cmsPlatform && (
          <div className="text-xs text-[#94A3B8]">
            Rozpoznany silnik / CMS: <strong className="text-white">{audit.cmsPlatform}</strong>
          </div>
        )}
      </div>

      {/* Issues & Recommendations */}
      {audit.issues && audit.issues.length > 0 && (
        <div className="bg-[#141C2E] p-5 rounded-2xl border border-[#28354D] space-y-3">
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-rose-400 flex items-center gap-2">
            <AlertTriangle size={16} /> Wykryte Problemy Techniczne ({audit.issues.length})
          </h3>
          <div className="space-y-2">
            {audit.issues.map((issue, idx) => (
              <div key={idx} className="bg-[#0A0E17] p-3 rounded-lg border border-rose-950 text-xs text-rose-200">
                {issue.description}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action refresh audit */}
      <div className="flex justify-end">
        <button
          onClick={onRunAudit}
          disabled={isAuditing}
          className="bg-[#1E293B] hover:bg-[#2D3D58] border border-[#334155] text-white font-bold text-xs px-4 py-2 rounded-lg flex items-center gap-1.5"
        >
          <Zap size={14} className={isAuditing ? "animate-spin text-[#FFE600]" : ""} />
          {isAuditing ? "Odświeżanie..." : "Wykonaj Ponowny Audyt"}
        </button>
      </div>
    </div>
  );
}
