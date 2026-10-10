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
    pricingRange: (offer as any)?.pricingRange || "",
    ctaText: (offer as any)?.ctaText || offer?.ctaText || "Umów bezpłatną konsultację",
    authorName: (offer as any)?.senderName || offer?.authorSignature?.name || "",
    authorRole: (offer as any)?.senderRole || offer?.authorSignature?.role || "",
    authorCompany: (offer as any)?.senderCompany || offer?.authorSignature?.company || "",
    authorPhone: (offer as any)?.senderPhone || offer?.authorSignature?.phone || "",
    authorEmail: (offer as any)?.senderEmail || offer?.authorSignature?.email || "",
    authorWebsite: (offer as any)?.senderWebsite || offer?.authorSignature?.website || "",
    authorNote: (offer as any)?.customNote || offer?.authorSignature?.note || "",
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
          pricingRange: formData.pricingRange,
          ctaText: formData.ctaText,
          senderName: formData.authorName,
          senderRole: formData.authorRole,
          senderCompany: formData.authorCompany,
          senderPhone: formData.authorPhone,
          senderEmail: formData.authorEmail,
          senderWebsite: formData.authorWebsite,
          customNote: formData.authorNote,
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
        showToast("Zapisano zmiany w ofercie, cenniku i podpisie autora!", "success");
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

          {/* Pricing & Business Model */}
          <div className="bg-[#141C2E] p-5 rounded-xl border border-[#28354D] space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#FFE600]">
                2. Cennik & Model Rozliczenia
              </h4>
              <span className="text-[11px] text-[#94A3B8]">
                Dopasuj model rozliczenia lub pozostaw puste, aby wyświetlić tylko &quot;Sprawdź ceny&quot;
              </span>
            </div>

            {/* Quick model presets */}
            <div>
              <label className="block text-xs font-bold text-[#94A3B8] mb-1.5">
                Szybki wybór modelu współpracy:
              </label>
              <div className="flex flex-wrap gap-2 text-xs">
                <button
                  type="button"
                  onClick={() =>
                    setFormData({
                      ...formData,
                      pricingRange: "50% podział zysku (Success Fee)",
                      ctaText: "Sprawdź warunki współpracy",
                    })
                  }
                  className="bg-[#1E293B] hover:bg-[#2D3D58] border border-[#334155] text-white px-2.5 py-1.5 rounded-lg font-medium transition-all"
                >
                  💼 % Zysku (50/50)
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setFormData({
                      ...formData,
                      pricingRange: "180 zł / godz.",
                      ctaText: "Zapytaj o wycenę",
                    })
                  }
                  className="bg-[#1E293B] hover:bg-[#2D3D58] border border-[#334155] text-white px-2.5 py-1.5 rounded-lg font-medium transition-all"
                >
                  ⏱️ Stawka godzinowa
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setFormData({
                      ...formData,
                      pricingRange: "od 3 500 zł za wdrożenie",
                      ctaText: "Sprawdź zakres prac",
                    })
                  }
                  className="bg-[#1E293B] hover:bg-[#2D3D58] border border-[#334155] text-white px-2.5 py-1.5 rounded-lg font-medium transition-all"
                >
                  📦 Za wykonanie / Projekt
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setFormData({
                      ...formData,
                      pricingRange: "od 2 500 zł / mies.",
                      ctaText: "Umów bezpłatną konsultację",
                    })
                  }
                  className="bg-[#1E293B] hover:bg-[#2D3D58] border border-[#334155] text-white px-2.5 py-1.5 rounded-lg font-medium transition-all"
                >
                  📅 Abonament miesięczny
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setFormData({
                      ...formData,
                      pricingRange: "",
                      ctaText: "Sprawdź ceny",
                    })
                  }
                  className="bg-[#2A1D0E] hover:bg-[#3D2B14] border border-[#F59E0B]/50 text-[#F59E0B] px-2.5 py-1.5 rounded-lg font-bold transition-all"
                >
                  🔍 Tylko &quot;Sprawdź ceny&quot; (bez kwot)
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-[#94A3B8] font-bold mb-1">
                  Widełki / Treść wyceny na ofercie
                </label>
                <input
                  type="text"
                  value={formData.pricingRange}
                  onChange={(e) => setFormData({ ...formData, pricingRange: e.target.value })}
                  placeholder="Pozostaw puste dla 'Sprawdź ceny' / 'Wycena indywidualna'"
                  className="w-full bg-[#0A0E17] border border-[#28354D] rounded-lg px-3 py-2 text-white"
                />
                <p className="text-[11px] text-[#64748B] mt-1">
                  np. <code className="text-[#FFE600]">50% podział zysku</code>, <code className="text-[#FFE600]">180 zł / godz.</code>, <code className="text-[#FFE600]">od 3 500 zł</code> lub puste.
                </p>
              </div>

              <div>
                <label className="block text-[#94A3B8] font-bold mb-1">
                  Tekst przycisku CTA
                </label>
                <input
                  type="text"
                  value={formData.ctaText}
                  onChange={(e) => setFormData({ ...formData, ctaText: e.target.value })}
                  placeholder="np. Sprawdź ceny, Umów bezpłatną konsultację"
                  className="w-full bg-[#0A0E17] border border-[#28354D] rounded-lg px-3 py-2 text-white"
                />
                <p className="text-[11px] text-[#64748B] mt-1">
                  Przycisk kierujący do rezerwacji terminu lub kontaktu.
                </p>
              </div>
            </div>

            {/* Status explanation */}
            {!formData.pricingRange.trim() ? (
              <div className="p-3 bg-amber-950/30 border border-amber-800/40 rounded-lg text-xs text-amber-300">
                ⚡ <strong>Tryb bez podanych kwot:</strong> Na stronie oferty wyświetli się etykieta <em>&bdquo;Model współpracy&rdquo;</em>, kwota <em>&bdquo;Wycena indywidualna&rdquo;</em> oraz przycisk <em>&bdquo;{formData.ctaText || "Sprawdź ceny & Porozmawiajmy"}&rdquo;</em>.
              </div>
            ) : formData.pricingRange.includes("%") || formData.pricingRange.toLowerCase().includes("zysku") ? (
              <div className="p-3 bg-emerald-950/30 border border-emerald-800/40 rounded-lg text-xs text-emerald-300">
                💼 <strong>Model prowizyjny / Podział zysku:</strong> Na ofercie pojawi się nagłówek <em>&bdquo;Model prowizyjny & Podział zysku (Success Fee)&rdquo;</em> oraz transparentny opis partnerski (Procent Marketing).
              </div>
            ) : formData.pricingRange.toLowerCase().includes("godz") ? (
              <div className="p-3 bg-sky-950/30 border border-sky-800/40 rounded-lg text-xs text-sky-300">
                ⏱️ <strong>Stawka godzinowa:</strong> Oferta wyświetli stawkę za godzinę z opisem rozliczenia za faktyczny czas pracy.
              </div>
            ) : formData.pricingRange.toLowerCase().includes("projekt") || formData.pricingRange.toLowerCase().includes("wykonani") ? (
              <div className="p-3 bg-purple-950/30 border border-purple-800/40 rounded-lg text-xs text-purple-300">
                📦 <strong>Za wykonanie / Projekt:</strong> Oferta wyświetli stałą kwotę wdrożenia z gwarancją zakresu prac.
              </div>
            ) : (
              <div className="p-3 bg-blue-950/30 border border-blue-800/40 rounded-lg text-xs text-blue-300">
                📅 <strong>Inwestycja miesięczna:</strong> Oferta wyświetli podaną kwotę abonamentu miesięcznego.
              </div>
            )}
          </div>

          {/* Author signature & White label */}
          <div className="bg-[#141C2E] p-5 rounded-xl border border-[#28354D] space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#FFE600]">
              3. Wizytówka i Podpis Autora (White-label)
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
