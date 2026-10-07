"use client";

import React from "react";
import Link from "next/link";
import { ArrowLeft, Building, ExternalLink, Globe, Phone, Mail } from "lucide-react";
import { FullLeadDossier, DossierTab } from "./dossier-types";
import { getStatusMeta } from "@/lib/status-meta";

interface DossierHeaderProps {
  lead: FullLeadDossier;
  activeTab: DossierTab;
  onTabChange: (tab: DossierTab) => void;
  onRefresh?: () => void;
  loading?: boolean;
}

const TABS: { id: DossierTab; label: string; icon: string; countBadge?: (l: FullLeadDossier) => number | string | null }[] = [
  { id: "dane", label: "Dane Firmy & Rejestry", icon: "🏛️" },
  {
    id: "dowody",
    label: "Dowody & Audyt WWW",
    icon: "🔍",
    countBadge: (l) => (l.audit ? "Audyt OK" : "Brak"),
  },
  {
    id: "kontakt",
    label: "Osoby & Kontakty",
    icon: "👥",
    countBadge: (l) => l.contacts?.length || null,
  },
  {
    id: "oferta",
    label: "Studio Oferty & Strona",
    icon: "💎",
    countBadge: (l) => (l.offer ? (l.offer.viewCount ? `👁️ ${l.offer.viewCount}` : "Gotowa") : null),
  },
  {
    id: "korespondencja",
    label: "Outreach & Wiadomości",
    icon: "✉️",
    countBadge: (l) => l.messages?.length || null,
  },
  { id: "zadania", label: "Zadania & Notatki", icon: "📋" },
  {
    id: "historia",
    label: "Historia Zdarzeń & Audyt",
    icon: "📜",
    countBadge: (l) => l.leadEvents?.length || null,
  },
];

export function DossierHeader({
  lead,
  activeTab,
  onTabChange,
}: DossierHeaderProps) {
  const statusMeta = getStatusMeta(lead.status);

  return (
    <div className="bg-[#0A0E17] border-b border-[#28354D] sticky top-0 z-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
        {/* Navigation & breadcrumb */}
        <div className="flex items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <Link
              href="/leads"
              className="text-xs bg-[#141C2E] hover:bg-[#1E293B] border border-[#28354D] text-[#94A3B8] hover:text-white px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all font-semibold"
            >
              <ArrowLeft size={14} /> Powrót do CRM
            </Link>
            <span className="text-[#64748B] text-xs font-mono">/</span>
            <span className="text-xs text-[#94A3B8] font-mono">Lead #{lead.id}</span>
          </div>

          <div className="flex items-center gap-2">
            {lead.offer && (
              <a
                href={lead.offer.token ? `/o/${lead.offer.token}` : `/o/${lead.offer.slug}`}
                target="_blank"
                rel="noreferrer"
                className="text-xs bg-[#FFE600] hover:bg-[#FFF04D] text-black font-extrabold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all"
              >
                <ExternalLink size={13} /> Podgląd Oferty
              </a>
            )}
          </div>
        </div>

        {/* Company Title & Quick Badges */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-2">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-[#141C2E] border border-[#28354D] flex items-center justify-center text-[#FFE600] shrink-0 font-bold text-lg">
              <Building size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl font-extrabold text-white tracking-tight">
                  {lead.companyName}
                </h1>
                <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${statusMeta.className}`}>
                  {statusMeta.label}
                </span>
                {lead.score != null && (
                  <span className="text-xs font-mono bg-[#1E293B] text-[#FFE600] border border-[#334155] px-2 py-0.5 rounded font-bold">
                    Score: {lead.score}/100
                  </span>
                )}
              </div>

              <div className="flex items-center gap-4 text-xs text-[#94A3B8] mt-1.5 flex-wrap">
                {lead.city && <span>📍 {lead.city}</span>}
                {lead.phoneNormalized && (
                  <span className="flex items-center gap-1 font-mono text-white">
                    <Phone size={12} className="text-[#64748B]" /> {lead.phoneNormalized}
                  </span>
                )}
                {lead.emailPrimary && (
                  <span className="flex items-center gap-1 text-[#38BDF8]">
                    <Mail size={12} className="text-[#64748B]" /> {lead.emailPrimary}
                  </span>
                )}
                {lead.website && (
                  <a
                    href={lead.website}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 text-[#38BDF8] hover:underline"
                  >
                    <Globe size={12} className="text-[#64748B]" /> {lead.website.replace(/^https?:\/\//, "")}
                  </a>
                )}
                {lead.nip && (
                  <span className="font-mono text-[#CBD5E1]">
                    NIP: {lead.nip}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Tab navigation */}
        <div className="flex items-center gap-1 border-b border-[#28354D] overflow-x-auto no-scrollbar pt-3 mt-2">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            const badgeValue = tab.countBadge ? tab.countBadge(lead) : null;
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`flex items-center gap-2 px-3.5 py-2.5 text-xs font-bold rounded-t-lg transition-all border-b-2 whitespace-nowrap cursor-pointer ${
                  isActive
                    ? "border-[#FFE600] text-[#FFE600] bg-[#141C2E]"
                    : "border-transparent text-[#94A3B8] hover:text-white hover:bg-[#141C2E]/50"
                }`}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
                {badgeValue != null && (
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
                      isActive
                        ? "bg-[#FFE600]/20 text-[#FFE600]"
                        : "bg-[#1E293B] text-[#94A3B8]"
                    }`}
                  >
                    {badgeValue}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
