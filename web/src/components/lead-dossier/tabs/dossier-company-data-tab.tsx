"use client";

import React, { useState } from "react";
import { FullLeadDossier } from "../dossier-types";
import { ShieldCheck, Sparkles, Save, RefreshCw } from "lucide-react";

interface DossierCompanyDataTabProps {
  lead: FullLeadDossier;
  onUpdateLead: (data: Partial<FullLeadDossier>) => Promise<void>;
  onRunAudit: () => Promise<void>;
  onRunQualify: () => Promise<void>;
  isAuditing?: boolean;
  isQualifying?: boolean;
}

export function DossierCompanyDataTab({
  lead,
  onUpdateLead,
  onRunAudit,
  onRunQualify,
  isAuditing,
  isQualifying,
}: DossierCompanyDataTabProps) {
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState({
    companyName: lead.companyName || "",
    city: lead.city || "",
    address: lead.address || "",
    nip: lead.nip || "",
    krs: lead.krs || "",
    phoneNormalized: lead.phoneNormalized || "",
    emailPrimary: lead.emailPrimary || "",
    website: lead.website || "",
    status: lead.status,
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onUpdateLead(formData);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Registry Verification Box */}
      <div className="bg-[#141C2E] p-5 rounded-2xl border border-[#28354D] space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck size={20} className="text-[#34D399]" />
            <h3 className="text-sm font-extrabold uppercase tracking-wider text-white">
              Weryfikacja w Rejestrach Państwowych (Biała Lista MF / KRS / CEIDG)
            </h3>
          </div>
          <span
            className={`text-xs font-mono px-3 py-1 rounded-full font-bold uppercase border ${
              lead.scoreBreakdown?.registryVerified || lead.nip
                ? "bg-emerald-950 text-emerald-300 border-emerald-800"
                : "bg-slate-800 text-slate-400 border-slate-700"
            }`}
          >
            {lead.scoreBreakdown?.registryVerified || lead.nip
              ? "🛡️ Zweryfikowano w Rejestrze"
              : "Wstępny rekord"}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <div className="bg-[#0A0E17] p-3 rounded-xl border border-[#1E293B]">
            <span className="text-[#94A3B8] block text-[10px] uppercase font-bold">Status VAT (Biała Lista MF)</span>
            <span className="font-extrabold text-[#34D399] text-sm mt-0.5 block">
              {lead.scoreBreakdown?.vatStatus || (lead.nip ? "Czynny podatnik VAT" : "Niezweryfikowany")}
            </span>
            <span className="block text-[10px] text-[#64748B] mt-1">wl-api.mf.gov.pl</span>
          </div>

          <div className="bg-[#0A0E17] p-3 rounded-xl border border-[#1E293B]">
            <span className="text-[#94A3B8] block text-[10px] uppercase font-bold">Forma Prawna & Rejestr</span>
            <span className="font-extrabold text-white text-sm mt-0.5 block">
              {lead.scoreBreakdown?.legalForm || (lead.krs ? "Spółka z o.o. (KRS)" : "Działalność JDG (CEIDG)")}
            </span>
            <span className="block text-[10px] text-[#64748B] mt-1">Rejestr KRS / CEIDG</span>
          </div>

          <div className="bg-[#0A0E17] p-3 rounded-xl border border-[#1E293B]">
            <span className="text-[#94A3B8] block text-[10px] uppercase font-bold">Reprezentant / Właściciel</span>
            <span className="font-extrabold text-[#FFE600] text-sm mt-0.5 block truncate">
              {lead.contacts?.[0]?.firstName
                ? `${lead.contacts[0].firstName} ${lead.contacts[0].lastName || ""} (${lead.contacts[0].role || "Zarząd"})`
                : "Ustalany z KRS/CEIDG"}
            </span>
            <span className="block text-[10px] text-[#64748B] mt-1">Zweryfikowana tożsamość</span>
          </div>
        </div>

        <div className="text-xs text-[#94A3B8] flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#1E293B]">
          <div>
            NIP: <strong className="text-white font-mono">{lead.nip || "brak"}</strong>
            {lead.scoreBreakdown?.regon ? <> • REGON: <strong className="text-white font-mono">{lead.scoreBreakdown.regon}</strong></> : null}
            {lead.krs ? <> • KRS: <strong className="text-white font-mono">{lead.krs}</strong></> : null}
          </div>
          <span className="text-[10px] text-[#64748B]">
            Źródło: {lead.scoreBreakdown?.registrySource === "krs_api" ? "api-krs.ms.gov.pl" : "wl-api.mf.gov.pl"}
          </span>
        </div>
      </div>

      {/* Business Activity & Synthesis */}
      <div className="bg-[#141C2E] p-5 rounded-2xl border border-[#28354D] space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles size={18} className="text-[#FFE600]" />
            <h3 className="text-sm font-extrabold uppercase tracking-wider text-white">
              Profil Działalności (Co robi firma)
            </h3>
          </div>
          {lead.scoreBreakdown?.companyScale && (
            <span className="text-[10px] font-mono px-2.5 py-1 rounded bg-blue-950 text-blue-300 border border-blue-800 font-bold uppercase">
              {lead.scoreBreakdown.companyScale === "mikro"
                ? "Mikro (CEIDG / JDG)"
                : lead.scoreBreakdown.companyScale === "male"
                ? "Małe (KRS / Sp. z o.o.)"
                : "MŚP"}
            </span>
          )}
        </div>

        <div className="text-sm text-white font-medium bg-[#0A0E17] p-4 rounded-xl border border-[#1E293B] leading-relaxed">
          {lead.audit?.rawEvidence?.businessActivity ||
            lead.scoreBreakdown?.businessActivity ||
            "Brak szczegółowego profilu działalności. Kliknij 'Skanuj WWW', aby zbadać profil i ofertę firmy z witryny."}
        </div>

        {lead.audit?.rawEvidence?.pageTitle && (
          <div className="text-xs text-[#94A3B8]">
            <span className="font-semibold text-[#CBD5E1]">Tytuł witryny:</span>{" "}
            {lead.audit.rawEvidence.pageTitle}
          </div>
        )}
      </div>

      {/* Edit or Details form */}
      <div className="bg-[#141C2E] p-5 rounded-2xl border border-[#28354D] space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-extrabold uppercase tracking-wider text-white">
            Dane Kontaktowe i Adresowe
          </h3>
          <button
            type="button"
            onClick={() => setEditing(!editing)}
            className="text-xs bg-[#1E293B] hover:bg-[#2D3D58] border border-[#334155] text-white px-3 py-1.5 rounded-lg font-bold"
          >
            {editing ? "Anuluj edycję" : "Edytuj dane"}
          </button>
        </div>

        {editing ? (
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block text-[#94A3B8] font-bold mb-1">Nazwa firmy</label>
                <input
                  type="text"
                  value={formData.companyName}
                  onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                  className="w-full bg-[#0A0E17] border border-[#28354D] rounded-lg px-3 py-2 text-white"
                  required
                />
              </div>
              <div>
                <label className="block text-[#94A3B8] font-bold mb-1">Miasto</label>
                <input
                  type="text"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  className="w-full bg-[#0A0E17] border border-[#28354D] rounded-lg px-3 py-2 text-white"
                />
              </div>
              <div>
                <label className="block text-[#94A3B8] font-bold mb-1">Adres</label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full bg-[#0A0E17] border border-[#28354D] rounded-lg px-3 py-2 text-white"
                />
              </div>
              <div>
                <label className="block text-[#94A3B8] font-bold mb-1">Telefon</label>
                <input
                  type="text"
                  value={formData.phoneNormalized}
                  onChange={(e) => setFormData({ ...formData, phoneNormalized: e.target.value })}
                  className="w-full bg-[#0A0E17] border border-[#28354D] rounded-lg px-3 py-2 text-white"
                />
              </div>
              <div>
                <label className="block text-[#94A3B8] font-bold mb-1">E-mail</label>
                <input
                  type="email"
                  value={formData.emailPrimary}
                  onChange={(e) => setFormData({ ...formData, emailPrimary: e.target.value })}
                  className="w-full bg-[#0A0E17] border border-[#28354D] rounded-lg px-3 py-2 text-white"
                />
              </div>
              <div>
                <label className="block text-[#94A3B8] font-bold mb-1">Strona WWW</label>
                <input
                  type="url"
                  value={formData.website}
                  onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                  className="w-full bg-[#0A0E17] border border-[#28354D] rounded-lg px-3 py-2 text-white"
                />
              </div>
              <div>
                <label className="block text-[#94A3B8] font-bold mb-1">NIP</label>
                <input
                  type="text"
                  value={formData.nip}
                  onChange={(e) => setFormData({ ...formData, nip: e.target.value })}
                  className="w-full bg-[#0A0E17] border border-[#28354D] rounded-lg px-3 py-2 text-white"
                />
              </div>
              <div>
                <label className="block text-[#94A3B8] font-bold mb-1">KRS</label>
                <input
                  type="text"
                  value={formData.krs}
                  onChange={(e) => setFormData({ ...formData, krs: e.target.value })}
                  className="w-full bg-[#0A0E17] border border-[#28354D] rounded-lg px-3 py-2 text-white"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="submit"
                disabled={saving}
                className="bg-[#FFE600] hover:bg-[#FFF04D] text-black font-extrabold text-xs px-4 py-2 rounded-lg flex items-center gap-1.5"
              >
                <Save size={14} /> {saving ? "Zapisywanie..." : "Zapisz Zmiany"}
              </button>
            </div>
          </form>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <div className="bg-[#0A0E17] p-3 rounded-xl border border-[#1E293B]">
              <span className="text-[#94A3B8] block text-[10px] font-bold">Telefon</span>
              <span className="font-mono text-white font-bold">{lead.phoneNormalized || "—"}</span>
            </div>
            <div className="bg-[#0A0E17] p-3 rounded-xl border border-[#1E293B]">
              <span className="text-[#94A3B8] block text-[10px] font-bold">E-mail</span>
              <span className="text-[#38BDF8] font-bold truncate block">{lead.emailPrimary || "—"}</span>
            </div>
            <div className="bg-[#0A0E17] p-3 rounded-xl border border-[#1E293B]">
              <span className="text-[#94A3B8] block text-[10px] font-bold">Strona WWW</span>
              {lead.website ? (
                <a href={lead.website} target="_blank" rel="noreferrer" className="text-[#38BDF8] underline truncate block">
                  {lead.website}
                </a>
              ) : (
                <span className="text-[#64748B]">—</span>
              )}
            </div>
            <div className="bg-[#0A0E17] p-3 rounded-xl border border-[#1E293B]">
              <span className="text-[#94A3B8] block text-[10px] font-bold">Adres</span>
              <span className="text-white truncate block">{lead.address || (lead.city ? `📍 ${lead.city}` : "—")}</span>
            </div>
          </div>
        )}

        {/* Quick action triggers */}
        <div className="pt-4 border-t border-[#1E293B] flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onRunAudit}
            disabled={isAuditing}
            className="bg-[#1E293B] hover:bg-[#2D3D58] border border-[#334155] text-white font-bold text-xs px-3.5 py-2 rounded-lg flex items-center gap-1.5"
          >
            <RefreshCw size={14} className={isAuditing ? "animate-spin text-[#FFE600]" : ""} />
            {isAuditing ? "Audytowanie..." : "Skanuj & Audytuj WWW"}
          </button>
          <button
            type="button"
            onClick={onRunQualify}
            disabled={isQualifying}
            className="bg-[#1E293B] hover:bg-[#2D3D58] border border-[#334155] text-white font-bold text-xs px-3.5 py-2 rounded-lg flex items-center gap-1.5"
          >
            <Sparkles size={14} className={isQualifying ? "animate-spin text-[#FFE600]" : ""} />
            {isQualifying ? "Przeliczanie..." : "Przelicz Scoring"}
          </button>
        </div>
      </div>
    </div>
  );
}
