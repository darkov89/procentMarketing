import React, { useMemo, useState } from "react";
import { Target, MapPin, Building, Sliders, XCircle, Plus, X, Save } from "lucide-react";
import { POLISH_VOIVODESHIPS } from "@/lib/geo";

export interface TargetingSettingsState {
  targetVoivodeship: string;
  targetRegion: string;
  defaultCity: string;
  defaultRadiusKm: number;
  targetIndustries: string[];
  targetCompanyScales: string[];
  excludedKeywords: string[];
  notes?: string;
}

interface TargetingSectionProps {
  settings: TargetingSettingsState;
  onChange: (settings: TargetingSettingsState) => void;
  onSave: () => Promise<void>;
  loading: boolean;
}

export function TargetingSection({ settings, onChange, onSave, loading }: TargetingSectionProps) {
  const [isCustomCity, setIsCustomCity] = useState(false);
  const [newIndustryTag, setNewIndustryTag] = useState("");
  const [newExcludedKeyword, setNewExcludedKeyword] = useState("");

  const currentCities = useMemo(() => {
    const vName = settings.targetVoivodeship || settings.targetRegion || "";
    const found = POLISH_VOIVODESHIPS.find(
      (v) => v.name.toLowerCase() === vName.toLowerCase()
    );
    return found ? found.majorCities : (POLISH_VOIVODESHIPS[0]?.majorCities || []);
  }, [settings.targetVoivodeship, settings.targetRegion]);

  return (
    <div className="bg-[#141C2E] border border-[#28354D] p-6 rounded-2xl shadow-xl space-y-6">
      <div className="flex flex-wrap items-center justify-between border-b border-[#28354D] pb-4 gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-[#FFE600] text-black rounded-xl font-bold">
            <Target size={22} />
          </div>
          <div>
            <h3 className="text-lg font-extrabold text-white">
              Kryteria Targetowania & Preferencje Rynku B2B
            </h3>
            <p className="text-xs text-[#94A3B8]">
              Wybierz interesujący Cię region, miasto, wielkość firm oraz branże docelowe. Ustawienia te stanowią domyślny profil poszukiwań.
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
          {loading ? "Zapisywanie..." : "Zapisz Kryteria Targetowania"}
        </button>
      </div>

      {/* 1. Region, Centrum i Promień */}
      <div className="space-y-3">
        <h4 className="text-xs font-bold uppercase tracking-wider text-[#FFE600] flex items-center gap-1.5">
          <MapPin size={14} /> 1. Region Geograficzny & Centrum Poszukiwań
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-bold text-[#94A3B8] mb-1">
              Województwo / Obszar
            </label>
            <select
              value={settings.targetVoivodeship || settings.targetRegion}
              onChange={(e) => {
                const v = e.target.value;
                const def = POLISH_VOIVODESHIPS.find((item) => item.name === v);
                onChange({
                  ...settings,
                  targetVoivodeship: v,
                  targetRegion: v,
                  defaultCity: def ? def.capital : settings.defaultCity,
                });
                setIsCustomCity(false);
              }}
              className="w-full bg-[#0A0E17] border border-[#28354D] rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-[#FFE600]"
            >
              {POLISH_VOIVODESHIPS.map((voiv) => (
                <option key={voiv.name} value={voiv.name}>
                  {voiv.name} (stolica: {voiv.capital})
                </option>
              ))}
              <option value="Cała Polska">Cała Polska (Wszystkie województwa)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-[#94A3B8] mb-1">
              Domyślne Miasto Centrum
            </label>
            <select
              value={isCustomCity ? "__custom__" : settings.defaultCity}
              onChange={(e) => {
                if (e.target.value === "__custom__") {
                  setIsCustomCity(true);
                } else {
                  setIsCustomCity(false);
                  onChange({ ...settings, defaultCity: e.target.value });
                }
              }}
              className="w-full bg-[#0A0E17] border border-[#28354D] rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-[#FFE600]"
            >
              {currentCities.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
              <option value="__custom__">✏️ Wpisz inne miasto w Polsce...</option>
            </select>
            {isCustomCity && (
              <input
                type="text"
                value={settings.defaultCity}
                onChange={(e) =>
                  onChange({ ...settings, defaultCity: e.target.value })
                }
                placeholder="Wpisz dowolne miasto w Polsce..."
                className="w-full mt-2 bg-[#0A0E17] border border-[#FFE600] rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none"
                autoFocus
              />
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-[#94A3B8]">Domyślny Promień (km)</label>
              <span className="font-extrabold text-xs text-[#FFE600]">
                {settings.defaultRadiusKm > 0 ? `${settings.defaultRadiusKm} km` : "Bez limitu"}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={settings.defaultRadiusKm}
                onChange={(e) =>
                  onChange({
                    ...settings,
                    defaultRadiusKm: parseInt(e.target.value, 10),
                  })
                }
                className="flex-1 accent-[#FFE600]"
              />
              <button
                type="button"
                onClick={() =>
                  onChange({
                    ...settings,
                    defaultRadiusKm: settings.defaultRadiusKm === 0 ? 35 : 0,
                  })
                }
                className={`text-[10px] font-bold px-2 py-1 rounded border transition-all cursor-pointer ${
                  settings.defaultRadiusKm === 0
                    ? "bg-[#FFE600] text-black border-[#FFE600]"
                    : "bg-[#0A0E17] text-[#94A3B8] border-[#28354D]"
                }`}
              >
                {settings.defaultRadiusKm === 0 ? "Bez limitu km" : "Cała PL"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Wielkość Przedsiębiorstw */}
      <div className="space-y-3 pt-2 border-t border-[#28354D]">
        <h4 className="text-xs font-bold uppercase tracking-wider text-[#FFE600] flex items-center gap-1.5">
          <Building size={14} /> 2. Preferowane Wielkości Przedsiębiorstw (Segmenty Rynku)
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div
            onClick={() => {
              const scales = settings.targetCompanyScales.includes("mikro")
                ? settings.targetCompanyScales.filter((s) => s !== "mikro")
                : [...settings.targetCompanyScales, "mikro"];
              onChange({ ...settings, targetCompanyScales: scales });
            }}
            className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
              settings.targetCompanyScales.includes("mikro")
                ? "bg-[#1E293B] border-[#FFE600] text-white"
                : "bg-[#0A0E17] border-[#28354D] text-[#94A3B8] opacity-60"
            }`}
          >
            <div className="flex items-center justify-between font-bold text-xs mb-1">
              <span>🏢 Mikroprzedsiębiorstwa</span>
              <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300">
                CEIDG / JDG
              </span>
            </div>
            <p className="text-[11px] text-[#94A3B8]">
              Jednoosobowe działalności, gabinety, kancelarie, wykonawcy (1–9 osób).
            </p>
          </div>

          <div
            onClick={() => {
              const scales = settings.targetCompanyScales.includes("male")
                ? settings.targetCompanyScales.filter((s) => s !== "male")
                : [...settings.targetCompanyScales, "male"];
              onChange({ ...settings, targetCompanyScales: scales });
            }}
            className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
              settings.targetCompanyScales.includes("male")
                ? "bg-[#1E293B] border-[#FFE600] text-white"
                : "bg-[#0A0E17] border-[#28354D] text-[#94A3B8] opacity-60"
            }`}
          >
            <div className="flex items-center justify-between font-bold text-xs mb-1">
              <span>🏭 Małe Przedsiębiorstwa</span>
              <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-blue-950 text-blue-300">
                KRS / Sp. z o.o.
              </span>
            </div>
            <p className="text-[11px] text-[#94A3B8]">
              Spółki z o.o., jawne, komandytowe, producenci i hurtownie (10–49 osób).
            </p>
          </div>

          <div
            onClick={() => {
              const scales = settings.targetCompanyScales.includes("msp")
                ? settings.targetCompanyScales.filter((s) => s !== "msp")
                : [...settings.targetCompanyScales, "msp"];
              onChange({ ...settings, targetCompanyScales: scales });
            }}
            className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
              settings.targetCompanyScales.includes("msp")
                ? "bg-[#1E293B] border-[#FFE600] text-white"
                : "bg-[#0A0E17] border-[#28354D] text-[#94A3B8] opacity-60"
            }`}
          >
            <div className="flex items-center justify-between font-bold text-xs mb-1">
              <span>🌐 Pełny Sektor MŚP</span>
              <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-purple-950 text-purple-300">
                Mikro + Małe + Średnie
              </span>
            </div>
            <p className="text-[11px] text-[#94A3B8]">
              Pełen przekrój rynku bez ograniczeń formy prawnej.
            </p>
          </div>
        </div>
      </div>

      {/* 3. Preferowane Branże & Nisze */}
      <div className="space-y-3 pt-2 border-t border-[#28354D]">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold uppercase tracking-wider text-[#FFE600] flex items-center gap-1.5">
            <Sliders size={14} /> 3. Branże Docelowe (Profile & Nisze)
          </h4>
          <span className="text-[11px] text-[#94A3B8]">
            Kliknij tag, aby usunąć lub dodaj własny
          </span>
        </div>

        <div className="flex flex-wrap gap-2 pt-1">
          {settings.targetIndustries.map((ind, idx) => (
            <span
              key={idx}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#0A0E17] border border-[#28354D] text-xs font-bold text-white hover:border-[#FFE600] transition-all"
            >
              {ind}
              <button
                type="button"
                onClick={() => {
                  const updated = settings.targetIndustries.filter((_, i) => i !== idx);
                  onChange({ ...settings, targetIndustries: updated });
                }}
                className="text-[#94A3B8] hover:text-[#FB7185] ml-1 cursor-pointer"
              >
                <X size={13} />
              </button>
            </span>
          ))}
        </div>

        <div className="flex items-center gap-2 pt-1">
          <input
            type="text"
            value={newIndustryTag}
            onChange={(e) => setNewIndustryTag(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && newIndustryTag.trim()) {
                e.preventDefault();
                if (!settings.targetIndustries.includes(newIndustryTag.trim())) {
                  onChange({
                    ...settings,
                    targetIndustries: [...settings.targetIndustries, newIndustryTag.trim()],
                  });
                }
                setNewIndustryTag("");
              }
            }}
            placeholder="Wpisz nową branżę (np. Architekci, Geodezja, Ochrona) i naciśnij Enter..."
            className="flex-1 bg-[#0A0E17] border border-[#28354D] rounded-lg px-3.5 py-2 text-xs text-white focus:outline-none focus:border-[#FFE600]"
          />
          <button
            type="button"
            onClick={() => {
              if (newIndustryTag.trim() && !settings.targetIndustries.includes(newIndustryTag.trim())) {
                onChange({
                  ...settings,
                  targetIndustries: [...settings.targetIndustries, newIndustryTag.trim()],
                });
                setNewIndustryTag("");
              }
            }}
            className="bg-[#1E293B] hover:bg-[#2D3D58] border border-[#334155] text-white font-bold text-xs px-3.5 py-2 rounded-lg flex items-center gap-1 cursor-pointer"
          >
            <Plus size={14} /> Dodaj branżę
          </button>
        </div>
      </div>

      {/* 4. Opcjonalna Blacklista Wykluczeń */}
      <div className="space-y-3 pt-2 border-t border-[#28354D]">
        <h4 className="text-xs font-bold uppercase tracking-wider text-[#94A3B8] flex items-center gap-1.5">
          <XCircle size={14} className="text-[#FB7185]" /> 4. Opcjonalne Wykluczenia (Twoja Własna Czarna Lista)
        </h4>
        <p className="text-xs text-[#94A3B8]">
          Wpisz słowa lub miasta, które chcesz wykluczyć (np. &quot;sieciówki&quot;, &quot;franczyza&quot;, &quot;korporacja&quot;). Brak sztywnego blokowania — decydujesz Ty.
        </p>
        <div className="flex flex-wrap gap-2">
          {settings.excludedKeywords?.map((exc, idx) => (
            <span
              key={idx}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#881337]/20 border border-[#E11D48]/40 text-xs text-[#FB7185] font-semibold"
            >
              {exc}
              <button
                type="button"
                onClick={() => {
                  const updated = settings.excludedKeywords.filter((_, i) => i !== idx);
                  onChange({ ...settings, excludedKeywords: updated });
                }}
                className="hover:text-white cursor-pointer"
              >
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={newExcludedKeyword}
            onChange={(e) => setNewExcludedKeyword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && newExcludedKeyword.trim()) {
                e.preventDefault();
                onChange({
                  ...settings,
                  excludedKeywords: [...(settings.excludedKeywords || []), newExcludedKeyword.trim()],
                });
                setNewExcludedKeyword("");
              }
            }}
            placeholder="Wpisz słowo do wykluczenia i naciśnij Enter..."
            className="flex-1 bg-[#0A0E17] border border-[#28354D] rounded-lg px-3.5 py-2 text-xs text-white focus:outline-none focus:border-[#FFE600]"
          />
          <button
            type="button"
            onClick={() => {
              if (newExcludedKeyword.trim()) {
                onChange({
                  ...settings,
                  excludedKeywords: [...(settings.excludedKeywords || []), newExcludedKeyword.trim()],
                });
                setNewExcludedKeyword("");
              }
            }}
            className="bg-[#1E293B] hover:bg-[#2D3D58] border border-[#334155] text-white font-bold text-xs px-3.5 py-2 rounded-lg flex items-center gap-1 cursor-pointer"
          >
            <Plus size={14} /> Wyklucz
          </button>
        </div>
      </div>
    </div>
  );
}
