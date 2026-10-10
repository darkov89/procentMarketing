"use client";

import React, { useState } from "react";
import {
  Building2,
  X,
  Loader2,
  Sparkles,
  Briefcase,
  HeartHandshake,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";
import slugify from "slugify";

interface CreateTenantModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (newTenant: any) => void;
}

export function CreateTenantModal({
  isOpen,
  onClose,
  onSuccess,
}: CreateTenantModalProps) {
  const [name, setName] = useState("");
  const [presetKey, setPresetKey] = useState<"agency_sales" | "sponsorship_fundraising">("agency_sales");
  const [plan, setPlan] = useState<"pro" | "ngo" | "starter">("pro");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const generatedSlug = name
    ? slugify(name, { lower: true, strict: true }).slice(0, 35) || "workspace"
    : "twoja-organizacja";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Wprowadź nazwę organizacji.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          presetKey,
          plan: presetKey === "sponsorship_fundraising" && plan === "pro" ? "ngo" : plan,
          companyDescription: description.trim(),
        }),
      });

      const data = await res.json();
      if (!data.success) {
        setError(data.error || "Wystąpił błąd podczas tworzenia organizacji.");
        setLoading(false);
        return;
      }

      if (onSuccess) {
        onSuccess(data.tenant);
      }

      // Automatically reload page to enter the new tenant context immediately
      window.location.reload();
    } catch (err: any) {
      setError(err?.message || "Błąd sieci podczas tworzenia organizacji.");
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg bg-[#0F172A] border border-slate-700 rounded-3xl shadow-2xl p-6 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#FFE600] text-black font-black flex items-center justify-center shadow-lg shadow-yellow-500/20">
              <Building2 size={20} />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-white">
                Nowa Organizacja / Tenant
              </h3>
              <p className="text-xs text-slate-400">
                Wydzielona baza leadów, kampanii, playbooków i członków zespołu.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {error && (
          <div className="mt-4 p-3 rounded-xl bg-red-950/70 border border-red-800/80 text-xs text-red-200">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* Organization Name */}
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
              Nazwa organizacji *
            </label>
            <input
              type="text"
              required
              placeholder="np. Akademia Rozwoju B2B, Fundacja Czysty Las"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError(null);
              }}
              className="w-full bg-[#162032] border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#FFE600]"
              autoFocus
            />
            <div className="mt-1 text-[11px] text-slate-500 font-mono">
              Identyfikator (slug): <span className="text-slate-400">{generatedSlug}</span>
            </div>
          </div>

          {/* Model / Playbook Preset Choice */}
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
              Model operacyjny & Szablon playbooka
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* Option 1: Agency Sales */}
              <button
                type="button"
                onClick={() => {
                  setPresetKey("agency_sales");
                  if (plan === "ngo") setPlan("pro");
                }}
                className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                  presetKey === "agency_sales"
                    ? "bg-[#FFE600]/10 border-[#FFE600] text-white shadow-md shadow-yellow-500/10"
                    : "bg-[#162032] border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                }`}
              >
                <div className="flex items-center gap-2 mb-1.5 font-bold text-xs text-white">
                  <Briefcase size={15} className={presetKey === "agency_sales" ? "text-[#FFE600]" : "text-slate-400"} />
                  Sprzedaż B2B / Agencja
                </div>
                <div className="text-[11px] leading-relaxed text-slate-400">
                  Audyt WWW, landing page oferty, scoring technologiczny, follow-upy cold mail.
                </div>
              </button>

              {/* Option 2: NGO / Sponsorship */}
              <button
                type="button"
                onClick={() => {
                  setPresetKey("sponsorship_fundraising");
                  setPlan("ngo");
                }}
                className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                  presetKey === "sponsorship_fundraising"
                    ? "bg-[#34D399]/10 border-[#34D399] text-white shadow-md shadow-emerald-500/10"
                    : "bg-[#162032] border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                }`}
              >
                <div className="flex items-center gap-2 mb-1.5 font-bold text-xs text-white">
                  <HeartHandshake size={15} className={presetKey === "sponsorship_fundraising" ? "text-[#34D399]" : "text-slate-400"} />
                  Fundacja / Darczyńcy B2B
                </div>
                <div className="text-[11px] leading-relaxed text-slate-400">
                  Rubryka dopasowania CSR, zgody PKE, zadania telefoniczne, ewidencja wpłat.
                </div>
              </button>
            </div>
          </div>

          {/* Description (Optional) */}
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
              Opis działalności (opcjonalnie)
            </label>
            <textarea
              rows={2}
              placeholder="np. Agencja marketingu efektywnościowego dla branży technicznej..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-[#162032] border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#FFE600] resize-none"
            />
          </div>

          {/* Security Notice */}
          <div className="p-3 bg-slate-900/90 border border-slate-800 rounded-2xl text-[11px] text-slate-400 flex items-start gap-2">
            <CheckCircle2 size={14} className="text-[#34D399] shrink-0 mt-0.5" />
            <div>
              Zostaniesz automatycznie przypisany jako <span className="text-white font-bold">Właściciel (Owner)</span>. Nowa organizacja otrzyma domyślny playbook i aktywną kampanię gotową do startu.
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              Anuluj
            </button>
            <button
              type="submit"
              disabled={loading || !name.trim()}
              className="px-5 py-2.5 rounded-xl bg-[#FFE600] hover:bg-[#FFF04D] text-black font-extrabold text-xs flex items-center gap-2 transition-all shadow-lg shadow-yellow-500/20 disabled:opacity-50 cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Tworzenie organizacji...
                </>
              ) : (
                <>
                  Utwórz & Przełącz
                  <ArrowRight size={14} />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
