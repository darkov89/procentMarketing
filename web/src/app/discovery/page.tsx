"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ToastNotification, ToastMessage } from "@/components/ui/toast-notification";
import {
  Compass,
  Building,
  Zap,
  CheckCircle2,
  Search,
  ArrowLeft,
} from "lucide-react";

export type CompanyScale = "mikro" | "male" | "msp";

export default function DiscoveryPage() {
  const router = useRouter();
  const [scale, setScale] = useState<CompanyScale>("mikro");
  const [city, setCity] = useState("Wrocław");
  const [voivodeship, setVoivodeship] = useState("Dolnośląskie");
  const [industry, setIndustry] = useState("biura_rachunkowe");
  const [customQuery, setCustomQuery] = useState("");
  const [radiusKm, setRadiusKm] = useState(35);
  const [limit, setLimit] = useState(20);
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [stats, setStats] = useState<{ found?: number; inserted?: number; duplicates?: number } | null>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [syncFromSettings, setSyncFromSettings] = useState(false);

  const showToast = (message: string, type: "success" | "error" | "info" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Synchronize initial values with central settings
  React.useEffect(() => {
    async function loadSettings() {
      try {
        const res = await fetch("/api/settings/targeting");
        const data = await res.json();
        if (data.success && data.preferences) {
          if (data.preferences.defaultCity) setCity(data.preferences.defaultCity);
          if (data.preferences.targetVoivodeship) setVoivodeship(data.preferences.targetVoivodeship);
          if (data.preferences.defaultRadiusKm) setRadiusKm(data.preferences.defaultRadiusKm);
          setSyncFromSettings(true);
        }
      } catch {}
    }
    loadSettings();
  }, []);

  const handleRunDiscovery = async () => {
    setRunning(true);
    setStats(null);
    setResults([]);
    showToast("Wyszukiwanie i pozyskiwanie firm (Google Places & Registry)...", "info");

    try {
      const res = await fetch("/api/scraper", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          city,
          voivodeship,
          industry,
          query: customQuery || undefined,
          keyword: customQuery || undefined,
          radiusKm,
          limit,
          companyScale: scale,
          autoAudit: true,
          autoQualify: true,
        }),
      });

      const data = await res.json();
      if (data.success) {
        showToast(`Pozyskano ${data.added ?? data.insertedCount ?? data.leads?.length ?? 0} nowych leadów!`, "success");
        setResults(data.addedLeads || data.leads || []);
        setStats({
          found: data.scanned || data.totalFound || data.leads?.length || 0,
          inserted: data.added || data.insertedCount || data.leads?.length || 0,
          duplicates: data.rejectedDuplicates || data.duplicateCount || 0,
        });
      } else {
        showToast(data.error || "Błąd wyszukiwania firm", "error");
      }
    } catch {
      showToast("Błąd połączenia z modułem scrapera", "error");
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#070A11] text-white">
      {toast && <ToastNotification toast={toast} />}

      {/* Header */}
      <div className="bg-[#0A0E17] border-b border-[#28354D] sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="text-xs bg-[#141C2E] hover:bg-[#1E293B] border border-[#28354D] text-[#94A3B8] hover:text-white px-3 py-1.5 rounded-lg flex items-center gap-1.5 font-semibold"
            >
              <ArrowLeft size={14} /> Dashboard
            </Link>
            <span className="text-[#64748B] text-xs font-mono">/</span>
            <h1 className="text-lg font-black text-white flex items-center gap-2">
              <Compass className="text-[#FFE600]" size={20} />
              Lead Generator & Web Discovery
            </h1>
          </div>

          <Link
            href="/leads"
            className="text-xs bg-[#141C2E] hover:bg-[#1E293B] border border-[#28354D] text-[#FFE600] px-3.5 py-2 rounded-xl flex items-center gap-1.5 font-bold"
          >
            Przejdź do CRM →
          </Link>
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* SCALE SELECTION */}
        <div className="bg-[#141C2E] border border-[#28354D] p-6 rounded-2xl shadow-xl space-y-4">
          <div>
            <h3 className="text-base font-extrabold text-[#FFE600] flex items-center gap-2">
              <Building size={18} />
              Wybór Segmentu Przedsiębiorstw (Mikro / Małe / MŚP)
            </h3>
            <p className="text-xs text-[#94A3B8] mt-0.5">
              System automatycznie weryfikuje rejestry CEIDG/KRS, analizuje stronę WWW i bada profil usług.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
            {/* Mikro */}
            <div
              onClick={() => setScale("mikro")}
              className={`p-4 rounded-xl border cursor-pointer transition-all ${
                scale === "mikro"
                  ? "bg-[#1E293B] border-[#FFE600] shadow-md shadow-yellow-500/10"
                  : "bg-[#0A0E17] border-[#28354D] hover:border-[#38BDF8]"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-2xl">🏢</span>
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${scale === "mikro" ? "bg-[#FFE600] text-black" : "bg-[#1E293B] text-[#94A3B8]"}`}>
                  CEIDG / JDG
                </span>
              </div>
              <h4 className="font-extrabold text-sm text-white">Mikroprzedsiębiorstwa</h4>
              <p className="text-xs text-[#94A3B8] mt-1">
                Firmy do 9 osób, jednoosobowe działalności (CEIDG), &lt;80 opinii Google Places.
              </p>
              <div className="mt-3 text-[11px] text-[#38BDF8] flex items-center gap-1 font-semibold">
                <CheckCircle2 size={12} /> Auto-audyt WWW + oferta dopasowana do usług
              </div>
            </div>

            {/* Małe */}
            <div
              onClick={() => setScale("male")}
              className={`p-4 rounded-xl border cursor-pointer transition-all ${
                scale === "male"
                  ? "bg-[#1E293B] border-[#FFE600] shadow-md shadow-yellow-500/10"
                  : "bg-[#0A0E17] border-[#28354D] hover:border-[#38BDF8]"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-2xl">🏭</span>
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${scale === "male" ? "bg-[#FFE600] text-black" : "bg-[#1E293B] text-[#94A3B8]"}`}>
                  KRS / Sp. z o.o.
                </span>
              </div>
              <h4 className="font-extrabold text-sm text-white">Małe Przedsiębiorstwa</h4>
              <p className="text-xs text-[#94A3B8] mt-1">
                Firmy 10–49 osób, zarejestrowane w KRS (Sp. z o.o., Sp. j.), 80–250 opinii.
              </p>
              <div className="mt-3 text-[11px] text-[#38BDF8] flex items-center gap-1 font-semibold">
                <CheckCircle2 size={12} /> Rozwiązania B2B, automatyzacja procesów
              </div>
            </div>

            {/* MŚP */}
            <div
              onClick={() => setScale("msp")}
              className={`p-4 rounded-xl border cursor-pointer transition-all ${
                scale === "msp"
                  ? "bg-[#1E293B] border-[#FFE600] shadow-md shadow-yellow-500/10"
                  : "bg-[#0A0E17] border-[#28354D] hover:border-[#38BDF8]"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-2xl">🌐</span>
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${scale === "msp" ? "bg-[#FFE600] text-black" : "bg-[#1E293B] text-[#94A3B8]"}`}>
                  Pełne MŚP
                </span>
              </div>
              <h4 className="font-extrabold text-sm text-white">Wszystkie Rozmiary MŚP</h4>
              <p className="text-xs text-[#94A3B8] mt-1">
                Bez restrykcji wielkościowych: mikro, małe i średnie podmioty w danym rejonie.
              </p>
              <div className="mt-3 text-[11px] text-[#38BDF8] flex items-center gap-1 font-semibold">
                <CheckCircle2 size={12} /> Maksymalne pokrycie rynku lokalnego
              </div>
            </div>
          </div>
        </div>

        {/* SEARCH PARAMS FORM */}
        <div className="bg-[#141C2E] border border-[#28354D] p-6 rounded-2xl shadow-xl space-y-4">
          <h3 className="text-sm font-extrabold uppercase tracking-wider text-white flex items-center gap-2">
            <Search size={16} className="text-[#FFE600]" />
            Parametry Wyszukiwania & Geotargetowania
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block text-[#94A3B8] font-bold mb-1">Miasto bazowe</label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="np. Legnica, Lubin, Wrocław"
                className="w-full bg-[#0A0E17] border border-[#28354D] rounded-lg px-3 py-2 text-white"
              />
            </div>

            <div>
              <label className="block text-[#94A3B8] font-bold mb-1">
                Branża / Nisza
                {syncFromSettings && (
                  <span className="ml-2 text-[10px] text-emerald-400 font-mono font-normal">
                    (Zsynchronizowano z Ustawieniami)
                  </span>
                )}
              </label>
              <select
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                className="w-full bg-[#0A0E17] border border-[#28354D] rounded-lg px-3 py-2 text-white"
              >
                <option value="biura_rachunkowe">Biura Rachunkowe & Księgowość</option>
                <option value="kancelarie">Kancelarie Prawne & Doradztwo</option>
                <option value="stomatologia">Stomatologia / Gabinety Dentystyczne</option>
                <option value="medycyna_estetyczna">Medycyna Estetyczna & Kosmetologia</option>
                <option value="fotowoltaika">Fotowoltaika & Pompy Ciepła</option>
                <option value="motoryzacja">Serwisy Samochodowe & Detailing</option>
                <option value="budownictwo">Budownictwo & Remonty</option>
                <option value="inne">Inne (Użyj własnego zapytania poniżej)</option>
              </select>
            </div>

            <div>
              <label className="block text-[#94A3B8] font-bold mb-1">Promień poszukiwań (km)</label>
              <input
                type="number"
                value={radiusKm}
                onChange={(e) => setRadiusKm(parseInt(e.target.value, 10) || 10)}
                className="w-full bg-[#0A0E17] border border-[#28354D] rounded-lg px-3 py-2 text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block text-[#94A3B8] font-bold mb-1">Własne zapytanie Google Maps (opcjonalne)</label>
              <input
                type="text"
                value={customQuery}
                onChange={(e) => setCustomQuery(e.target.value)}
                placeholder="np. klinika stomatologiczna implanty"
                className="w-full bg-[#0A0E17] border border-[#28354D] rounded-lg px-3 py-2 text-white"
              />
            </div>

            <div>
              <label className="block text-[#94A3B8] font-bold mb-1">Limit wyników na cykl</label>
              <input
                type="number"
                value={limit}
                onChange={(e) => setLimit(parseInt(e.target.value, 10) || 5)}
                className="w-full bg-[#0A0E17] border border-[#28354D] rounded-lg px-3 py-2 text-white"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              onClick={handleRunDiscovery}
              disabled={running}
              className="bg-[#FFE600] hover:bg-[#FFF04D] text-black font-black text-xs px-6 py-3 rounded-xl flex items-center gap-2 shadow-lg shadow-yellow-500/10 disabled:opacity-50"
            >
              <Zap size={15} className={running ? "animate-spin" : ""} />
              {running ? "Wyszukiwanie i audytowanie..." : "🚀 Uruchom Lead Generator"}
            </button>
          </div>
        </div>

        {/* STATS REPORT */}
        {stats && (
          <div className="bg-[#141C2E] border border-emerald-500/50 p-6 rounded-2xl space-y-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={22} className="text-[#34D399]" />
              <h3 className="text-base font-bold text-white">Cykl generatora zakończony</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-center text-xs">
              <div className="bg-[#0A0E17] p-4 rounded-xl border border-emerald-800">
                <span className="text-[#94A3B8] block mb-1">Nowo dodane leady</span>
                <div className="text-2xl font-black text-[#34D399]">+{stats.inserted}</div>
              </div>
              <div className="bg-[#0A0E17] p-4 rounded-xl border border-[#28354D]">
                <span className="text-[#94A3B8] block mb-1">Znalezione firmy</span>
                <div className="text-2xl font-black text-white">{stats.found}</div>
              </div>
              <div className="bg-[#0A0E17] p-4 rounded-xl border border-[#28354D]">
                <span className="text-[#94A3B8] block mb-1">Pominięte duplikaty</span>
                <div className="text-2xl font-black text-[#94A3B8]">{stats.duplicates}</div>
              </div>
            </div>
            <div className="flex justify-end">
              <button
                onClick={() => router.push("/leads")}
                className="bg-[#FFE600] text-black font-extrabold text-xs px-5 py-2.5 rounded-xl"
              >
                Przejdź do bazy CRM →
              </button>
            </div>
          </div>
        )}

        {/* RESULTS PREVIEW */}
        {results.length > 0 && (
          <div className="bg-[#141C2E] border border-[#28354D] rounded-2xl overflow-hidden p-5 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#94A3B8]">
              Wyniki ostatniego wyszukiwania ({results.length})
            </h4>
            <div className="divide-y divide-[#1E293B]">
              {results.map((r: any, idx) => (
                <div key={idx} className="py-3 flex items-center justify-between text-xs">
                  <div>
                    <h5 className="font-extrabold text-white">{r.companyName}</h5>
                    <p className="text-[#94A3B8]">
                      📍 {r.city || city} • ✉️ {r.emailPrimary || "brak e-maila"} • 📞 {r.phoneNormalized || "brak"}
                    </p>
                  </div>
                  {r.id && (
                    <Link
                      href={`/leads/${r.id}`}
                      className="text-xs bg-[#1E293B] hover:bg-[#2D3D58] border border-[#334155] text-white px-3 py-1.5 rounded-lg font-bold"
                    >
                      Dossier leada →
                    </Link>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
