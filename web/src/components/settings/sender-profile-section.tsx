import React from "react";
import { User, Save } from "lucide-react";

export interface SenderProfileState {
  senderName: string;
  senderRole: string;
  senderCompany: string;
  senderEmail: string;
  senderPhone: string;
  senderWebsite: string;
  bookingUrl: string;
  customNote: string;
  companyDescription?: string;
  pricingModel?: "rev_share" | "hourly" | "fixed_project" | "monthly" | "custom";
  pricingCustomRate?: string;
  defaultCtaText?: string;
}

interface SenderProfileSectionProps {
  profile: SenderProfileState;
  onChange: (profile: SenderProfileState) => void;
  onSave: () => Promise<void>;
  loading: boolean;
}

export function SenderProfileSection({
  profile,
  onChange,
  onSave,
  loading,
}: SenderProfileSectionProps) {
  const currentPricingModel = profile.pricingModel || "rev_share";

  return (
    <div className="bg-[#141C2E] border border-[#28354D] p-6 rounded-2xl shadow-xl space-y-6">
      <div className="flex flex-wrap items-center justify-between border-b border-[#28354D] pb-4 gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-[#FFE600] text-black rounded-xl font-bold">
            <User size={22} />
          </div>
          <div>
            <h3 className="text-lg font-extrabold text-white">
              Domyślny Profil Nadawcy, Opis Firmy & Cennik
            </h3>
            <p className="text-xs text-[#94A3B8]">
              Wizytówka autora oraz profil oferenta, z którego silnik AI czerpie wiedzę do łączenia Twoich usług z potrzebami klienta i ustalania wyceny.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onSave}
          disabled={loading}
          className="bg-[#FFE600] hover:bg-[#FFF04D] text-black font-extrabold text-xs px-5 py-2.5 rounded-xl flex items-center gap-2 transition-all shadow-lg shadow-yellow-500/10 disabled:opacity-50 cursor-pointer"
        >
          <Save size={16} />
          {loading ? "Zapisywanie..." : "Zapisz Profil & Cennik"}
        </button>
      </div>

      {/* 1. Opis działalności firmy oferującej */}
      <div className="bg-[#0A0E17] border border-[#28354D] p-4 rounded-xl space-y-2">
        <label className="block text-xs font-bold text-[#FFE600] uppercase tracking-wide">
          1. Profil Twojej Firmy — Co robisz i jak pomagasz klientom
        </label>
        <p className="text-xs text-[#94A3B8]">
          Silnik generowania ofert wykorzystuje ten opis, aby połączyć Twoje unikalne kompetencje (np. automatyzacja marketingu, generowanie leadów, podział zysku) ze specyfiką branży odbiorcy.
        </p>
        <textarea
          rows={3}
          value={profile.companyDescription || ""}
          onChange={(e) => onChange({ ...profile, companyDescription: e.target.value })}
          placeholder="np. Procent Marketing — agencja automatyzacji pozyskiwania klientów i sprzedaży B2B. Specjalizujemy się w lejkach, dedykowanych stronach ofertowych, narzędziach rezerwacji 24/7 i analityce ROI. Dzielimy się zyskiem 50/50 ze zleceń lub oferujemy elastyczne modele stałe."
          className="w-full bg-[#141C2E] border border-[#28354D] rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-[#FFE600]"
        />
      </div>

      {/* 2. Domyślny cennik i model rozliczenia */}
      <div className="bg-[#0A0E17] border border-[#28354D] p-4 rounded-xl space-y-3">
        <label className="block text-xs font-bold text-[#FFE600] uppercase tracking-wide">
          2. Domyślny Model Rozliczenia & Cennik dla Nowych Ofert
        </label>
        <p className="text-xs text-[#94A3B8]">
          Wybierz domyślny model. Jeśli pozostawisz pole kwoty puste, oferta automatycznie wyświetli &bdquo;Wycena indywidualna&rdquo; z przyciskiem &bdquo;Sprawdź ceny&rdquo;.
        </p>

        {/* Model pills */}
        <div className="flex flex-wrap gap-2 pt-1">
          <button
            type="button"
            onClick={() =>
              onChange({
                ...profile,
                pricingModel: "rev_share",
                pricingCustomRate: "50% podział zysku (Success Fee)",
                defaultCtaText: "Sprawdź warunki współpracy",
              })
            }
            className={`text-xs px-3 py-1.5 rounded-lg font-bold border transition-all ${
              currentPricingModel === "rev_share"
                ? "bg-[#FFE600] text-black border-[#FFE600]"
                : "bg-[#141C2E] text-[#94A3B8] border-[#28354D] hover:text-white"
            }`}
          >
            💼 % Zysku (50/50 - Procent Marketing)
          </button>
          <button
            type="button"
            onClick={() =>
              onChange({
                ...profile,
                pricingModel: "hourly",
                pricingCustomRate: "180 zł / godz.",
                defaultCtaText: "Zapytaj o wycenę",
              })
            }
            className={`text-xs px-3 py-1.5 rounded-lg font-bold border transition-all ${
              currentPricingModel === "hourly"
                ? "bg-[#FFE600] text-black border-[#FFE600]"
                : "bg-[#141C2E] text-[#94A3B8] border-[#28354D] hover:text-white"
            }`}
          >
            ⏱️ Stawka godzinowa
          </button>
          <button
            type="button"
            onClick={() =>
              onChange({
                ...profile,
                pricingModel: "fixed_project",
                pricingCustomRate: "od 3 500 zł za wdrożenie",
                defaultCtaText: "Sprawdź zakres prac",
              })
            }
            className={`text-xs px-3 py-1.5 rounded-lg font-bold border transition-all ${
              currentPricingModel === "fixed_project"
                ? "bg-[#FFE600] text-black border-[#FFE600]"
                : "bg-[#141C2E] text-[#94A3B8] border-[#28354D] hover:text-white"
            }`}
          >
            📦 Za wykonanie / Projekt
          </button>
          <button
            type="button"
            onClick={() =>
              onChange({
                ...profile,
                pricingModel: "monthly",
                pricingCustomRate: "od 2 500 zł / mies.",
                defaultCtaText: "Umów bezpłatną konsultację",
              })
            }
            className={`text-xs px-3 py-1.5 rounded-lg font-bold border transition-all ${
              currentPricingModel === "monthly"
                ? "bg-[#FFE600] text-black border-[#FFE600]"
                : "bg-[#141C2E] text-[#94A3B8] border-[#28354D] hover:text-white"
            }`}
          >
            📅 Abonament miesięczny
          </button>
          <button
            type="button"
            onClick={() =>
              onChange({
                ...profile,
                pricingModel: "custom",
                pricingCustomRate: "",
                defaultCtaText: "Sprawdź ceny",
              })
            }
            className={`text-xs px-3 py-1.5 rounded-lg font-bold border transition-all ${
              currentPricingModel === "custom" || !profile.pricingCustomRate
                ? "bg-[#F59E0B] text-black border-[#F59E0B]"
                : "bg-[#141C2E] text-[#94A3B8] border-[#28354D] hover:text-white"
            }`}
          >
            🔍 Tylko &quot;Sprawdź ceny&quot; (bez kwot)
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
          <div>
            <label className="block text-xs font-bold text-[#94A3B8] mb-1">
              Domyślna stawka / treść wyceny
            </label>
            <input
              type="text"
              value={profile.pricingCustomRate || ""}
              onChange={(e) => onChange({ ...profile, pricingCustomRate: e.target.value })}
              placeholder="Pozostaw puste dla 'Sprawdź ceny' / 'Wycena indywidualna'"
              className="w-full bg-[#141C2E] border border-[#28354D] rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-[#FFE600]"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-[#94A3B8] mb-1">
              Domyślny tekst przycisku CTA
            </label>
            <input
              type="text"
              value={profile.defaultCtaText || ""}
              onChange={(e) => onChange({ ...profile, defaultCtaText: e.target.value })}
              placeholder="np. Sprawdź warunki współpracy, Sprawdź ceny"
              className="w-full bg-[#141C2E] border border-[#28354D] rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-[#FFE600]"
            />
          </div>
        </div>
      </div>

      {/* 3. Wizytówka i Podpis Autora */}
      <div className="space-y-4">
        <h4 className="text-xs font-bold uppercase tracking-wide text-[#FFE600]">
          3. Wizytówka & Dane Kontaktowe Nadawcy
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-[#94A3B8] mb-1">
              Imię i Nazwisko Nadawcy
            </label>
            <input
              type="text"
              value={profile.senderName}
              onChange={(e) => onChange({ ...profile, senderName: e.target.value })}
              placeholder="np. Dariusz"
              className="w-full bg-[#0A0E17] border border-[#28354D] rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-[#FFE600]"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[#94A3B8] mb-1">
              Stanowisko / Rola
            </label>
            <input
              type="text"
              value={profile.senderRole}
              onChange={(e) => onChange({ ...profile, senderRole: e.target.value })}
              placeholder="np. Założyciel & Strateg B2B"
              className="w-full bg-[#0A0E17] border border-[#28354D] rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-[#FFE600]"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[#94A3B8] mb-1">
              Nazwa Twojej Firmy / Brandu
            </label>
            <input
              type="text"
              value={profile.senderCompany}
              onChange={(e) => onChange({ ...profile, senderCompany: e.target.value })}
              placeholder="np. Procent Marketing"
              className="w-full bg-[#0A0E17] border border-[#28354D] rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-[#FFE600]"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[#94A3B8] mb-1">
              Oficjalny Adres E-mail do Kontaktu
            </label>
            <input
              type="email"
              value={profile.senderEmail}
              onChange={(e) => onChange({ ...profile, senderEmail: e.target.value })}
              placeholder="kontakt@twojadomena.pl"
              className="w-full bg-[#0A0E17] border border-[#28354D] rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-[#FFE600]"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[#94A3B8] mb-1">
              Numer Telefonu (widoczny na ofercie)
            </label>
            <input
              type="text"
              value={profile.senderPhone}
              onChange={(e) => onChange({ ...profile, senderPhone: e.target.value })}
              placeholder="np. +48 700 000 000"
              className="w-full bg-[#0A0E17] border border-[#28354D] rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-[#FFE600]"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[#94A3B8] mb-1">
              Strona Internetowa Firmy
            </label>
            <input
              type="text"
              value={profile.senderWebsite}
              onChange={(e) => onChange({ ...profile, senderWebsite: e.target.value })}
              placeholder="np. https://procentmarketing.pl"
              className="w-full bg-[#0A0E17] border border-[#28354D] rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-[#FFE600]"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-[#94A3B8] mb-1">
              Link do Kalendarza Rezerwacji (Cal.com / Calendly / Własny)
            </label>
            <input
              type="text"
              value={profile.bookingUrl}
              onChange={(e) => onChange({ ...profile, bookingUrl: e.target.value })}
              placeholder="np. https://cal.com/procentmarketing/15min"
              className="w-full bg-[#0A0E17] border border-[#28354D] rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-[#FFE600]"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-[#94A3B8] mb-1">
              Domyślna Osobista Notatka / Dedykacja na Ofercie
            </label>
            <textarea
              rows={2}
              value={profile.customNote}
              onChange={(e) => onChange({ ...profile, customNote: e.target.value })}
              placeholder="np. W razie pytań technicznych dotyczących wstępnej analizy, zapraszam do bezpośredniego kontaktu."
              className="w-full bg-[#0A0E17] border border-[#28354D] rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-[#FFE600]"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
