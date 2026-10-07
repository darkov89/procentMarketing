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
  return (
    <div className="bg-[#141C2E] border border-[#28354D] p-6 rounded-2xl shadow-xl space-y-6">
      <div className="flex flex-wrap items-center justify-between border-b border-[#28354D] pb-4 gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-[#FFE600] text-black rounded-xl font-bold">
            <User size={22} />
          </div>
          <div>
            <h3 className="text-lg font-extrabold text-white">
              Domyślny Profil Nadawcy & Podpis w Ofertach
            </h3>
            <p className="text-xs text-[#94A3B8]">
              Wizytówka autora, która wyświetla się na dedykowanej stronie klienta (/o/[token]) oraz w podpisach e-maili. Każdą ofertę możesz też dostosować indywidualnie.
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
          {loading ? "Zapisywanie..." : "Zapisz Profil Nadawcy"}
        </button>
      </div>

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
  );
}
