"use client";

import React, { useState } from "react";
import { FullLeadDossier } from "../dossier-types";
import { Copy, ExternalLink, Edit2, Eye, Save, Sparkles, Zap, Check } from "lucide-react";

interface DossierOfferStudioTabProps {
  lead: FullLeadDossier;
  onGenerateOffer: () => Promise<void>;
  onRefresh: () => void;
  showToast: (msg: string, type?: "success" | "error" | "info") => void;
  isGenerating?: boolean;
}

export function DossierOfferStudioTab({
  lead,
  onGenerateOffer,
  onRefresh,
  showToast,
  isGenerating,
}: DossierOfferStudioTabProps) {
  const offer = lead.offer;
  const [editorMode, setEditorMode] = useState<"edit" | "preview">("edit");
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    title: offer?.title || "",
    heroObservation: offer?.heroObservation || "",
    customPitch: offer?.customPitch || "",
    ctaText: offer?.ctaText || "",
    ctaButtonText: offer?.ctaButtonText || "Porozmawiajmy o wdrożeniu",
    authorName: offer?.authorSignature?.name || "",
    authorRole: offer?.authorSignature?.role || "",
    authorCompany: offer?.authorSignature?.company || "",
    authorPhone: offer?.authorSignature?.phone || "",
    authorEmail: offer?.authorSignature?.email || "",
    authorWebsite: offer?.authorSignature?.website || "",
    authorNote: offer?.authorSignature?.note || "",
  });

  if (!offer) {
    return (
      <div className="bg-[#141C2E] border border-[#28354D] p-8 rounded-2xl text-center space-y-4">
        <Sparkles size={36} className="mx-auto text-[#FFE600]" />
        <h3 className="text-base font-bold text-white">Brak wygenerowanej oferty dla tej firmy</h3>
        <p className="text-xs text-[#94A3B8] max-w-md mx-auto">
          Wygeneruj spersonalizowaną ofertę lądowania (/o/[token]) na podstawie audytu technicznego i
          katalogu usług (Inwariant 5).
        </p>
        <button
          onClick={onGenerateOffer}
          disabled={isGenerating}
          className="bg-[#FFE600] hover:bg-[#FFF04D] text-black font-extrabold text-xs px-5 py-2.5 rounded-lg inline-flex items-center gap-2"
        >
          <Zap size={14} />
          {isGenerating ? "Generowanie oferty..." : "Wygeneruj Dedykowaną Ofertę"}
        </button>
      </div>
    );
  }

  const offerUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/o/${offer.token || offer.slug}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(offerUrl);
    setCopied(true);
    showToast("Skopiowano bezpośredni link do oferty!", "success");
    setTimeout(() => setCopied(false), 2500);
  };

  const handleSaveOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`/api/offers/${offer.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: formData.title,
          heroObservation: formData.heroObservation,
          customPitch: formData.customPitch,
          ctaText: formData.ctaText,
          ctaButtonText: formData.ctaButtonText,
          authorSignature: {
            name: formData.authorName,
            role: formData.authorRole,
            company: formData.authorCompany,
            phone: formData.authorPhone,
            email: formData.authorEmail,
            website: formData.authorWebsite,
            note: formData.authorNote,
          },
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast("Zapisano zmiany w ofercie i podpisie autora!", "success");
        onRefresh();
      } else {
        showToast(data.error || "Błąd zapisu oferty", "error");
      }
    } catch {
      showToast("Błąd połączenia z serwerem", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Control bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#141C2E] p-4 rounded-xl border border-[#28354D]">
        <div className="flex items-center gap-2">
          <span className="badge badge-offer text-xs px-2.5 py-0.5 rounded font-bold">
            OFERTA OPUBLIKOWANA
          </span>
          <span className="text-xs text-[#94A3B8] font-mono">
            /o/{offer.token ? `${offer.token.slice(0, 12)}...` : offer.slug}
          </span>
          {offer.viewCount != null && offer.viewCount > 0 && (
            <span className="text-xs bg-emerald-950 text-emerald-300 border border-emerald-800 px-2 py-0.5 rounded font-mono font-bold">
              👁️ Odsłony: {offer.viewCount}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopyLink}
            className="text-xs bg-[#1E293B] hover:bg-[#2D3D58] border border-[#334155] text-white font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5"
          >
            {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
            {copied ? "Skopiowano!" : "Kopiuj Link"}
          </button>
          <a
            href={offer.token ? `/o/${offer.token}` : `/o/${offer.slug}`}
            target="_blank"
            rel="noreferrer"
            className="text-xs bg-[#FFE600] hover:bg-[#FFF04D] text-black font-extrabold px-3 py-1.5 rounded-lg flex items-center gap-1.5"
          >
            <ExternalLink size={13} /> Otwórz Stronę
          </a>
        </div>
      </div>

      {/* Editor & Preview Mode Switcher */}
      <div className="flex border-b border-[#28354D] gap-2">
        <button
          type="button"
          onClick={() => setEditorMode("edit")}
          className={`pb-2.5 px-3 text-xs font-extrabold flex items-center gap-1.5 border-b-2 transition-all cursor-pointer ${
            editorMode === "edit"
              ? "border-[#FFE600] text-[#FFE600]"
              : "border-transparent text-[#94A3B8] hover:text-white"
          }`}
        >
          <Edit2 size={14} /> Edytor Treści & Podpisu
        </button>
        <button
          type="button"
          onClick={() => setEditorMode("preview")}
          className={`pb-2.5 px-3 text-xs font-extrabold flex items-center gap-1.5 border-b-2 transition-all cursor-pointer ${
            editorMode === "preview"
              ? "border-[#FFE600] text-[#FFE600]"
              : "border-transparent text-[#94A3B8] hover:text-white"
          }`}
        >
          <Eye size={14} /> Podgląd na żywo (/o/[token])
        </button>
      </div>

      {editorMode === "edit" ? (
        <form onSubmit={handleSaveOffer} className="space-y-5">
          {/* Main proposal header */}
          <div className="bg-[#141C2E] p-5 rounded-xl border border-[#28354D] space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#FFE600]">
              1. Nagłówek i Propozycja Wartości
            </h4>
            <div>
              <label className="block text-xs font-bold text-[#94A3B8] mb-1">Tytuł oferty</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full bg-[#0A0E17] border border-[#28354D] rounded-lg px-3 py-2 text-xs text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#94A3B8] mb-1">
                Główna obserwacja z audytu
              </label>
              <textarea
                rows={2}
                value={formData.heroObservation}
                onChange={(e) => setFormData({ ...formData, heroObservation: e.target.value })}
                className="w-full bg-[#0A0E17] border border-[#28354D] rounded-lg px-3 py-2 text-xs text-white"
              />
            </div>
          </div>

          {/* Author signature & White label */}
          <div className="bg-[#141C2E] p-5 rounded-xl border border-[#28354D] space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#FFE600]">
              2. Wizytówka i Podpis Autora (White-label)
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-[#94A3B8] font-bold mb-1">Imię i Nazwisko</label>
                <input
                  type="text"
                  value={formData.authorName}
                  onChange={(e) => setFormData({ ...formData, authorName: e.target.value })}
                  className="w-full bg-[#0A0E17] border border-[#28354D] rounded-lg px-3 py-2 text-white"
                />
              </div>
              <div>
                <label className="block text-[#94A3B8] font-bold mb-1">Rola / Stanowisko</label>
                <input
                  type="text"
                  value={formData.authorRole}
                  onChange={(e) => setFormData({ ...formData, authorRole: e.target.value })}
                  className="w-full bg-[#0A0E17] border border-[#28354D] rounded-lg px-3 py-2 text-white"
                />
              </div>
              <div>
                <label className="block text-[#94A3B8] font-bold mb-1">Firma / Marka</label>
                <input
                  type="text"
                  value={formData.authorCompany}
                  onChange={(e) => setFormData({ ...formData, authorCompany: e.target.value })}
                  className="w-full bg-[#0A0E17] border border-[#28354D] rounded-lg px-3 py-2 text-white"
                />
              </div>
              <div>
                <label className="block text-[#94A3B8] font-bold mb-1">Telefon</label>
                <input
                  type="text"
                  value={formData.authorPhone}
                  onChange={(e) => setFormData({ ...formData, authorPhone: e.target.value })}
                  className="w-full bg-[#0A0E17] border border-[#28354D] rounded-lg px-3 py-2 text-white"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-[#94A3B8] mb-1">Osobista notatka / dedykacja</label>
              <textarea
                rows={2}
                value={formData.authorNote}
                onChange={(e) => setFormData({ ...formData, authorNote: e.target.value })}
                className="w-full bg-[#0A0E17] border border-[#28354D] rounded-lg px-3 py-2 text-xs text-white"
                placeholder="np. Przygotowałem tę propozycję po wnikliwej analizie Twojego profilu w sieci..."
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="bg-[#FFE600] hover:bg-[#FFF04D] text-black font-extrabold text-xs px-5 py-2.5 rounded-lg flex items-center gap-1.5"
            >
              <Save size={14} /> {saving ? "Zapisywanie..." : "Zapisz Ofertę"}
            </button>
          </div>
        </form>
      ) : (
        <div className="border border-[#28354D] rounded-xl overflow-hidden bg-black h-[700px]">
          <iframe
            src={offer.token ? `/o/${offer.token}` : `/o/${offer.slug}`}
            className="w-full h-full border-0"
            title="Podgląd Oferty"
          />
        </div>
      )}
    </div>
  );
}
