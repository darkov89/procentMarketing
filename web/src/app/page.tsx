"use client";

import React, { useEffect, useState, useMemo } from "react";
import {
  Search,
  Filter,
  RefreshCw,
  Plus,
  Download,
  Zap,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ExternalLink,
  Mail,
  Eye,
  Trash2,
  Edit2,
  Save,
  Globe,
  ShieldCheck,
  Building,
  Phone,
  FileSpreadsheet,
  Settings as SettingsIcon,
  ChevronRight,
  X,
  Play,
} from "lucide-react";

interface LeadItem {
  id: number;
  companyName: string;
  nip?: string | null;
  krs?: string | null;
  website?: string | null;
  phoneNormalized?: string | null;
  emailPrimary?: string | null;
  address?: string | null;
  city?: string | null;
  distanceKm?: number | null;
  industry?: string | null;
  status: string;
  score: number;
  scoreBreakdown?: any;
  rejectionReason?: string | null;
  ownerConfidence?: string | null;
  notes?: string | null;
  createdAt?: string;
  audit?: any;
  offer?: any;
  contacts?: any[];
  messages?: any[];
}

export default function LeadMachineDashboard() {
  const [leads, setLeads] = useState<LeadItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [cityFilter, setCityFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [activeTab, setActiveTab] = useState<"crm" | "generator" | "review" | "import" | "settings">("crm");
  
  // Selected lead for Slide-Over Drawer
  const [selectedLead, setSelectedLead] = useState<LeadItem | null>(null);
  const [drawerTab, setDrawerTab] = useState<"details" | "audit" | "offer" | "email">("details");

  // Inline editing state
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValues, setEditValues] = useState<Partial<LeadItem>>({});

  // Full Pipeline running state
  const [pipelineRunning, setPipelineRunning] = useState(false);
  const [pipelineReport, setPipelineReport] = useState<any>(null);

  // Scraper Generator state
  const [scraperKeyword, setScraperKeyword] = useState("Stomatologia");
  const [scraperCity, setScraperCity] = useState("Legnica");
  const [scraperRadius, setScraperRadius] = useState(30);
  const [scraperLoading, setScraperLoading] = useState(false);
  const [scraperResult, setScraperResult] = useState<any>(null);

  // Notification Toast
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);

  const showToast = (message: string, type: "success" | "error" | "info" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Fetch leads
  const fetchLeads = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/leads");
      const data = await res.json();
      if (data.success) {
        setLeads(data.leads);
        if (selectedLead) {
          const updated = data.leads.find((l: LeadItem) => l.id === selectedLead.id);
          if (updated) setSelectedLead(updated);
        }
      }
    } catch (err) {
      showToast("Błąd pobierania danych", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeads();
  }, []);

  // Filtered Leads
  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      const q = search.toLowerCase();
      const matchesSearch =
        !search ||
        lead.companyName.toLowerCase().includes(q) ||
        (lead.industry && lead.industry.toLowerCase().includes(q)) ||
        (lead.phoneNormalized && lead.phoneNormalized.includes(q)) ||
        (lead.emailPrimary && lead.emailPrimary.toLowerCase().includes(q)) ||
        (lead.city && lead.city.toLowerCase().includes(q));

      const matchesCity = cityFilter === "all" || (lead.city && lead.city.toLowerCase() === cityFilter.toLowerCase());
      const matchesStatus = statusFilter === "all" || lead.status === statusFilter;

      return matchesSearch && matchesCity && matchesStatus;
    });
  }, [leads, search, cityFilter, statusFilter]);

  // Cities list
  const cities = useMemo(() => {
    const set = new Set<string>();
    leads.forEach((l) => {
      if (l.city) set.add(l.city);
    });
    return Array.from(set).sort();
  }, [leads]);

  // Metric counts
  const metrics = useMemo(() => {
    const total = leads.length;
    const qualified = leads.filter((l) => ["qualified", "offer_published", "sent"].includes(l.status)).length;
    const needsReview = leads.filter((l) => l.status === "needs_review").length;
    const offersPublished = leads.filter((l) => l.offer).length;
    const emailsSent = leads.filter((l) => l.messages?.some((m) => m.status === "sent")).length;
    const disqualified = leads.filter((l) => l.status === "disqualified").length;

    return { total, qualified, needsReview, offersPublished, emailsSent, disqualified };
  }, [leads]);

  // Inline patch update
  const handleSaveInline = async (id: number) => {
    try {
      const res = await fetch(`/api/leads/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editValues),
      });
      const data = await res.json();
      if (data.success) {
        setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, ...data.lead } : l)));
        showToast("Zapisano zmiany pomyślnie!");
        setEditingId(null);
        setEditValues({});
      } else {
        showToast(data.error || "Błąd zapisu", "error");
      }
    } catch {
      showToast("Błąd połączenia z serwerem", "error");
    }
  };

  // Quick Action: Run Audit
  const handleRunAudit = async (leadId: number) => {
    showToast("Uruchamianie audytu technologicznego...", "info");
    try {
      const res = await fetch(`/api/audit/${leadId}`, { method: "POST" });
      const data = await res.json();
      if (data.success) {
        showToast("Audyt zakończony pomyślnie!");
        fetchLeads();
      } else {
        showToast(data.error || "Błąd audytu", "error");
      }
    } catch {
      showToast("Błąd audytu", "error");
    }
  };

  // Quick Action: Run Qualify
  const handleRunQualify = async (leadId: number) => {
    try {
      const res = await fetch(`/api/qualify/${leadId}`, { method: "POST" });
      const data = await res.json();
      if (data.success) {
        showToast(`Zakwalifikowano: ${data.lead.status.toUpperCase()} (${data.lead.score} pkt)`);
        fetchLeads();
      } else {
        showToast(data.error || "Błąd kwalifikacji", "error");
      }
    } catch {
      showToast("Błąd kwalifikacji", "error");
    }
  };

  // Quick Action: Generate Offer
  const handleGenerateOffer = async (leadId: number, customData?: any) => {
    showToast("Generowanie oferty przez Gemini AI i publikacja...", "info");
    try {
      const res = await fetch(`/api/offers/${leadId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(customData || {}),
      });
      const data = await res.json();
      if (data.success) {
        showToast("Oferta opublikowana pomyślnie!");
        fetchLeads();
      } else {
        showToast(data.error || "Błąd oferty", "error");
      }
    } catch {
      showToast("Błąd oferty", "error");
    }
  };

  // Quick Action: Send Outreach Email
  const handleSendEmail = async (leadId: number, customDraft?: any) => {
    showToast("Wysyłka e-maila zgodnie z RODO...", "info");
    try {
      const res = await fetch(`/api/outreach/${leadId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(customDraft || {}),
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Wysłano wiadomość do: ${data.result.recipient}`);
        fetchLeads();
      } else {
        showToast(data.result?.errorMessage || data.error || "Błąd wysyłki", "error");
      }
    } catch {
      showToast("Błąd wysyłki", "error");
    }
  };

  // Quick Action: Delete Lead
  const handleDeleteLead = async (leadId: number) => {
    if (!confirm("Czy na pewno chcesz usunąć ten lead?")) return;
    try {
      const res = await fetch(`/api/leads/${leadId}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        showToast("Lead usunięty.");
        if (selectedLead?.id === leadId) setSelectedLead(null);
        fetchLeads();
      }
    } catch {
      showToast("Błąd usuwania", "error");
    }
  };

  // Run Full Pipeline
  const handleRunFullPipeline = async () => {
    setPipelineRunning(true);
    showToast("Uruchamianie pełnego cyklu (Enrich -> Audit -> Qualify -> Offer -> Outreach)...", "info");
    try {
      const res = await fetch("/api/pipeline", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setPipelineReport(data.report);
        showToast("Zakończono pełny cykl autonomiczny!");
        fetchLeads();
      } else {
        showToast(data.error || "Błąd pipeline'u", "error");
      }
    } catch {
      showToast("Błąd wykonania pipeline'u", "error");
    } finally {
      setPipelineRunning(false);
    }
  };

  // Run Scraper
  const handleRunScraper = async () => {
    setScraperLoading(true);
    setScraperResult(null);
    showToast(`Skanowanie dla branży '${scraperKeyword}' w rejonie ${scraperCity}...`, "info");
    try {
      const res = await fetch("/api/scraper", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keyword: scraperKeyword,
          city: scraperCity,
          radiusKm: scraperRadius,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setScraperResult(data);
        showToast(`Dodano ${data.added} nowych firm! Odrzucono Wrocław: ${data.rejectedWroclaw}`);
        fetchLeads();
      } else {
        showToast(data.error || "Błąd scrapera", "error");
      }
    } catch {
      showToast("Błąd scrapera", "error");
    } finally {
      setScraperLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0E17] text-[#F8FAFC]">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed top-5 right-5 z-50 px-5 py-3 rounded-lg shadow-xl text-sm font-semibold flex items-center gap-3 transition-all ${
            toast.type === "success"
              ? "bg-[#064E3B] border border-[#059669] text-[#34D399]"
              : toast.type === "error"
              ? "bg-[#881337] border border-[#E11D48] text-[#FB7185]"
              : "bg-[#1E293B] border border-[#334155] text-[#FFE600]"
          }`}
        >
          {toast.type === "success" ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* TOP HEADER */}
      <header className="border-b border-[#28354D] bg-[#0E1422] px-6 py-4 sticky top-0 z-30">
        <div className="max-w-[1700px] mx-auto flex flex-wrap items-center justify-between gap-4">
          {/* Logo & Subtitle */}
          <div className="flex items-center gap-3">
            <div className="bg-[#FFE600] text-black font-black text-xl px-3 py-1 rounded-lg shadow-[0_0_15px_rgba(255,230,0,0.4)]">
              %
            </div>
            <div>
              <h1 className="text-xl font-extrabold tracking-tight flex items-center gap-2">
                PROCENT MARKETING <span className="text-[#FFE600]">LEAD MACHINE 2.0</span>
              </h1>
              <p className="text-xs text-[#94A3B8]">
                Autonomiczny Silnik Sprzedaży B2B • Neon Cloud Postgres • Legnica + 30 km
              </p>
            </div>
          </div>

          {/* Badges & Mode indicators */}
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 bg-[#141C2E] border border-[#28354D] px-3 py-1.5 rounded-full text-xs">
              <span className="pulse-dot"></span>
              <span className="font-bold text-[#A5B4FC]">AUTONOMOUS AI: ON</span>
            </div>
            <div className="flex items-center gap-2 bg-[#064E3B] border border-[#059669] text-[#34D399] px-3 py-1.5 rounded-full text-xs font-bold">
              🟢 SANDBOX MODE
            </div>
            <div className="flex items-center gap-2 bg-[#141C2E] border border-[#28354D] text-[#38BDF8] px-3 py-1.5 rounded-full text-xs font-bold">
              🛡️ BEZPIECZNIK STOP: OK
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2.5">
            <button
              onClick={handleRunFullPipeline}
              disabled={pipelineRunning}
              className="bg-[#FFE600] hover:bg-[#FFF04D] text-black font-extrabold text-sm px-4 py-2 rounded-lg flex items-center gap-2 transition-all shadow-[0_0_15px_rgba(255,230,0,0.3)] disabled:opacity-50"
            >
              <Zap size={16} />
              {pipelineRunning ? "Przetwarzanie..." : "Uruchom Pełny Cykl"}
            </button>
            <a
              href="/api/export"
              target="_blank"
              className="bg-[#1E293B] hover:bg-[#2D3D58] border border-[#334155] text-white font-bold text-sm px-3 py-2 rounded-lg flex items-center gap-2 transition-all"
            >
              <Download size={15} />
              <span className="hidden md:inline">Eksport Excel</span>
            </a>
            <button
              onClick={fetchLeads}
              className="bg-[#1E293B] hover:bg-[#2D3D58] border border-[#334155] text-white p-2 rounded-lg transition-all"
              title="Odśwież dane z Neon"
            >
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            </button>
          </div>
        </div>
      </header>

      {/* METRIC STRIP */}
      <section className="bg-[#101726] border-b border-[#28354D] py-4 px-6">
        <div className="max-w-[1700px] mx-auto grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
          <div className="bg-[#141C2E] border border-[#28354D] p-3.5 rounded-xl">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#94A3B8]">Wszystkie Leady</span>
            <div className="text-2xl font-black text-white mt-1">{metrics.total}</div>
          </div>
          <div className="bg-[#141C2E] border border-[#28354D] p-3.5 rounded-xl">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#34D399]">Zakwalifikowane</span>
            <div className="text-2xl font-black text-[#34D399] mt-1">{metrics.qualified}</div>
          </div>
          <div className="bg-[#141C2E] border border-[#28354D] p-3.5 rounded-xl">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#FBBF24]">Do Weryfikacji</span>
            <div className="text-2xl font-black text-[#FBBF24] mt-1">{metrics.needsReview}</div>
          </div>
          <div className="bg-[#141C2E] border border-[#28354D] p-3.5 rounded-xl">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#38BDF8]">Oferty Netlify</span>
            <div className="text-2xl font-black text-[#38BDF8] mt-1">{metrics.offersPublished}</div>
          </div>
          <div className="bg-[#141C2E] border border-[#28354D] p-3.5 rounded-xl">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#C084FC]">Wysłane E-maile</span>
            <div className="text-2xl font-black text-[#C084FC] mt-1">{metrics.emailsSent}</div>
          </div>
          <div className="bg-[#141C2E] border border-[#28354D] p-3.5 rounded-xl">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#FB7185]">Odrzucone</span>
            <div className="text-2xl font-black text-[#FB7185] mt-1">{metrics.disqualified}</div>
          </div>
        </div>
      </section>

      {/* MAIN CONTAINER */}
      <main className="max-w-[1700px] mx-auto p-6">
        {/* NAVIGATION TABS */}
        <div className="flex border-b border-[#28354D] gap-2 mb-6 overflow-x-auto pb-1">
          <button
            onClick={() => setActiveTab("crm")}
            className={`px-5 py-2.5 rounded-t-lg font-extrabold text-sm flex items-center gap-2 transition-all ${
              activeTab === "crm"
                ? "bg-[#141C2E] text-[#FFE600] border-t-2 border-x border-[#FFE600]"
                : "text-[#94A3B8] hover:text-white"
            }`}
          >
            <Building size={16} />
            Pipeline CRM & Tabela
          </button>
          <button
            onClick={() => setActiveTab("generator")}
            className={`px-5 py-2.5 rounded-t-lg font-extrabold text-sm flex items-center gap-2 transition-all ${
              activeTab === "generator"
                ? "bg-[#141C2E] text-[#FFE600] border-t-2 border-x border-[#FFE600]"
                : "text-[#94A3B8] hover:text-white"
            }`}
          >
            <Search size={16} />
            Lead Generator & Scraper
          </button>
          <button
            onClick={() => setActiveTab("review")}
            className={`px-5 py-2.5 rounded-t-lg font-extrabold text-sm flex items-center gap-2 transition-all ${
              activeTab === "review"
                ? "bg-[#141C2E] text-[#FFE600] border-t-2 border-x border-[#FFE600]"
                : "text-[#94A3B8] hover:text-white"
            }`}
          >
            <AlertTriangle size={16} />
            Kolejka Weryfikacji ({metrics.needsReview})
          </button>
          <button
            onClick={() => setActiveTab("settings")}
            className={`px-5 py-2.5 rounded-t-lg font-extrabold text-sm flex items-center gap-2 transition-all ${
              activeTab === "settings"
                ? "bg-[#141C2E] text-[#FFE600] border-t-2 border-x border-[#FFE600]"
                : "text-[#94A3B8] hover:text-white"
            }`}
          >
            <SettingsIcon size={16} />
            Ustawienia & Reguły
          </button>
        </div>

        {/* TAB 1: CRM & EDITABLE TABLE */}
        {activeTab === "crm" && (
          <div className="space-y-4">
            {/* Filter Toolbar */}
            <div className="bg-[#141C2E] border border-[#28354D] p-4 rounded-xl flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
                {/* Search */}
                <div className="relative flex-1 min-w-[240px]">
                  <Search className="absolute left-3.5 top-2.5 text-[#94A3B8]" size={16} />
                  <input
                    type="text"
                    placeholder="Szukaj firmy po nazwie, branży, telefonie, emailu..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full bg-[#0A0E17] border border-[#28354D] rounded-lg pl-10 pr-4 py-2 text-sm text-white placeholder-[#64748B] focus:outline-none focus:border-[#FFE600]"
                  />
                </div>

                {/* City Filter */}
                <select
                  value={cityFilter}
                  onChange={(e) => setCityFilter(e.target.value)}
                  className="bg-[#0A0E17] border border-[#28354D] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#FFE600]"
                >
                  <option value="all">Wszystkie Miasta (≤30km)</option>
                  {cities.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>

                {/* Status Filter */}
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="bg-[#0A0E17] border border-[#28354D] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#FFE600]"
                >
                  <option value="all">Wszystkie Statusy</option>
                  <option value="new">Nowe (new)</option>
                  <option value="qualified">Zakwalifikowane (qualified)</option>
                  <option value="needs_review">Do weryfikacji (needs_review)</option>
                  <option value="offer_published">Oferta gotowa (offer_published)</option>
                  <option value="sent">E-mail wysłany (sent)</option>
                  <option value="disqualified">Odrzucone (disqualified)</option>
                </select>
              </div>

              <div className="text-xs text-[#94A3B8]">
                Wyświetlanie <strong className="text-white">{filteredLeads.length}</strong> z{" "}
                <strong className="text-white">{leads.length}</strong> leadów
              </div>
            </div>

            {/* Editable Data Table */}
            <div className="bg-[#141C2E] border border-[#28354D] rounded-xl overflow-hidden shadow-2xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-[#28354D] bg-[#0E1422] text-[#94A3B8] text-[11px] uppercase tracking-wider font-extrabold">
                      <th className="p-3.5">ID</th>
                      <th className="p-3.5">Firma</th>
                      <th className="p-3.5">Lokalizacja</th>
                      <th className="p-3.5">Branża</th>
                      <th className="p-3.5">Status</th>
                      <th className="p-3.5 text-center">Score</th>
                      <th className="p-3.5">Kontakt</th>
                      <th className="p-3.5">Oferta WWW</th>
                      <th className="p-3.5">E-mail</th>
                      <th className="p-3.5 text-right">Akcje</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1E293B]">
                    {filteredLeads.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="p-8 text-center text-[#94A3B8]">
                          Brak leadów spełniających kryteria. Użyj generatora lub zaimportuj plik.
                        </td>
                      </tr>
                    ) : (
                      filteredLeads.map((lead) => {
                        const isEditing = editingId === lead.id;

                        return (
                          <tr
                            key={lead.id}
                            className="hover:bg-[#182338] transition-colors cursor-pointer group"
                            onClick={(e) => {
                              // If clicked on input/button, don't open drawer
                              const target = e.target as HTMLElement;
                              if (target.tagName === "INPUT" || target.tagName === "SELECT" || target.tagName === "BUTTON" || target.tagName === "A") {
                                return;
                              }
                              setSelectedLead(lead);
                            }}
                          >
                            <td className="p-3.5 text-[#64748B] font-mono text-xs">#{lead.id}</td>

                            {/* Company Name (Editable) */}
                            <td className="p-3.5 font-bold text-white min-w-[200px]">
                              {isEditing ? (
                                <input
                                  type="text"
                                  value={editValues.companyName ?? lead.companyName}
                                  onChange={(e) =>
                                    setEditValues((prev) => ({ ...prev, companyName: e.target.value }))
                                  }
                                  className="w-full bg-[#0A0E17] border border-[#FFE600] rounded px-2 py-1 text-sm text-white"
                                />
                              ) : (
                                <div>
                                  <span className="hover:text-[#FFE600] transition-colors">{lead.companyName}</span>
                                  {lead.website && (
                                    <a
                                      href={lead.website.startsWith("http") ? lead.website : `https://${lead.website}`}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="text-xs text-[#38BDF8] flex items-center gap-1 mt-0.5"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <Globe size={11} /> {lead.website.replace(/^https?:\/\//, "")}
                                    </a>
                                  )}
                                </div>
                              )}
                            </td>

                            {/* Location */}
                            <td className="p-3.5 text-[#E2E8F0] text-xs">
                              {isEditing ? (
                                <input
                                  type="text"
                                  value={editValues.city ?? (lead.city || "")}
                                  onChange={(e) => setEditValues((prev) => ({ ...prev, city: e.target.value }))}
                                  className="w-24 bg-[#0A0E17] border border-[#FFE600] rounded px-2 py-1 text-xs text-white"
                                />
                              ) : (
                                <div>
                                  <strong>{lead.city || "Legnica"}</strong>
                                  <span className="text-[#94A3B8] block text-[11px]">
                                    {lead.distanceKm != null ? `${lead.distanceKm.toFixed(1)} km` : ""}
                                  </span>
                                </div>
                              )}
                            </td>

                            {/* Industry */}
                            <td className="p-3.5 text-xs text-[#CBD5E1]">
                              <span className="bg-[#1E293B] px-2.5 py-1 rounded-md border border-[#334155]">
                                {lead.industry || "Ogólna"}
                              </span>
                            </td>

                            {/* Status (Inline Selectable) */}
                            <td className="p-3.5">
                              {isEditing ? (
                                <select
                                  value={editValues.status ?? lead.status}
                                  onChange={(e) =>
                                    setEditValues((prev) => ({ ...prev, status: e.target.value }))
                                  }
                                  className="bg-[#0A0E17] border border-[#FFE600] rounded px-2 py-1 text-xs text-white"
                                >
                                  <option value="new">new</option>
                                  <option value="qualified">qualified</option>
                                  <option value="needs_review">needs_review</option>
                                  <option value="offer_published">offer_published</option>
                                  <option value="sent">sent</option>
                                  <option value="disqualified">disqualified</option>
                                </select>
                              ) : (
                                <span
                                  className={`badge ${
                                    lead.status === "qualified"
                                      ? "badge-approved"
                                      : lead.status === "needs_review"
                                      ? "badge-review"
                                      : lead.status === "disqualified"
                                      ? "badge-rejected"
                                      : lead.status === "offer_published"
                                      ? "badge-offer"
                                      : lead.status === "sent"
                                      ? "badge-sent"
                                      : "bg-[#1E293B] text-white border border-[#334155]"
                                  }`}
                                >
                                  {lead.status}
                                </span>
                              )}
                            </td>

                            {/* Scoring */}
                            <td className="p-3.5 text-center font-extrabold text-sm">
                              <span className={lead.score >= 60 ? "text-[#FFE600]" : "text-[#94A3B8]"}>
                                {lead.score}
                              </span>
                            </td>

                            {/* Contact (Phone & Email) */}
                            <td className="p-3.5 text-xs">
                              {isEditing ? (
                                <div className="space-y-1">
                                  <input
                                    type="text"
                                    placeholder="Telefon"
                                    value={editValues.phoneNormalized ?? (lead.phoneNormalized || "")}
                                    onChange={(e) =>
                                      setEditValues((prev) => ({ ...prev, phoneNormalized: e.target.value }))
                                    }
                                    className="w-full bg-[#0A0E17] border border-[#FFE600] rounded px-1.5 py-0.5 text-xs text-white"
                                  />
                                  <input
                                    type="text"
                                    placeholder="Email"
                                    value={editValues.emailPrimary ?? (lead.emailPrimary || "")}
                                    onChange={(e) =>
                                      setEditValues((prev) => ({ ...prev, emailPrimary: e.target.value }))
                                    }
                                    className="w-full bg-[#0A0E17] border border-[#FFE600] rounded px-1.5 py-0.5 text-xs text-white"
                                  />
                                </div>
                              ) : (
                                <div>
                                  <div className="font-mono text-white">{lead.phoneNormalized || "—"}</div>
                                  <div className="text-[#94A3B8] truncate max-w-[150px]">{lead.emailPrimary || "—"}</div>
                                </div>
                              )}
                            </td>

                            {/* Offer Badge */}
                            <td className="p-3.5">
                              {lead.offer ? (
                                <a
                                  href={`/offers/${lead.offer.slug}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-xs bg-[#0C4A6E] text-[#38BDF8] border border-[#0284C7] px-2.5 py-1 rounded-md font-bold hover:underline flex items-center gap-1 w-max"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <Eye size={12} /> Gotowa
                                </a>
                              ) : (
                                <span className="text-xs text-[#64748B]">—</span>
                              )}
                            </td>

                            {/* Email Outreach Status */}
                            <td className="p-3.5 text-xs">
                              {lead.status === "sent" ? (
                                <span className="text-[#C084FC] font-bold flex items-center gap-1">
                                  <CheckCircle2 size={13} /> Wysłany
                                </span>
                              ) : (
                                <span className="text-[#64748B]">Oczekuje</span>
                              )}
                            </td>

                            {/* Actions Column */}
                            <td className="p-3.5 text-right whitespace-nowrap">
                              {isEditing ? (
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    onClick={() => handleSaveInline(lead.id)}
                                    className="bg-[#10B981] hover:bg-[#059669] text-white p-1.5 rounded transition-all"
                                    title="Zapisz"
                                  >
                                    <Save size={14} />
                                  </button>
                                  <button
                                    onClick={() => {
                                      setEditingId(null);
                                      setEditValues({});
                                    }}
                                    className="bg-[#334155] hover:bg-[#475569] text-white p-1.5 rounded transition-all"
                                    title="Anuluj"
                                  >
                                    <X size={14} />
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setEditingId(lead.id);
                                      setEditValues({
                                        companyName: lead.companyName,
                                        city: lead.city,
                                        status: lead.status,
                                        phoneNormalized: lead.phoneNormalized,
                                        emailPrimary: lead.emailPrimary,
                                      });
                                    }}
                                    className="text-[#94A3B8] hover:text-[#FFE600] p-1.5 rounded hover:bg-[#1E293B] transition-all"
                                    title="Edytuj inline"
                                  >
                                    <Edit2 size={14} />
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedLead(lead);
                                    }}
                                    className="text-[#94A3B8] hover:text-white p-1.5 rounded hover:bg-[#1E293B] transition-all"
                                    title="Szczegóły / Studio"
                                  >
                                    <ChevronRight size={16} />
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: CONFIGURABLE LEAD GENERATOR & SCRAPER */}
        {activeTab === "generator" && (
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="bg-[#141C2E] border border-[#28354D] p-6 rounded-2xl shadow-xl">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2.5 bg-[#FFE600] text-black rounded-xl font-bold">
                  <Search size={22} />
                </div>
                <div>
                  <h2 className="text-xl font-bold">Autonomiczny Generator Leadów & Scraper</h2>
                  <p className="text-sm text-[#94A3B8]">
                    Wyszukaj nowe firmy, zweryfikuj współrzędne GPS i twardo odrzuć Wrocław.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#94A3B8] mb-1.5">
                    Branża docelowa / Słowo kluczowe
                  </label>
                  <input
                    type="text"
                    value={scraperKeyword}
                    onChange={(e) => setScraperKeyword(e.target.value)}
                    placeholder="np. Stomatologia, Kancelaria, OZE"
                    className="w-full bg-[#0A0E17] border border-[#28354D] rounded-lg px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-[#FFE600]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#94A3B8] mb-1.5">
                    Centrum poszukiwań
                  </label>
                  <select
                    value={scraperCity}
                    onChange={(e) => setScraperCity(e.target.value)}
                    className="w-full bg-[#0A0E17] border border-[#28354D] rounded-lg px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-[#FFE600]"
                  >
                    <option value="Legnica">Legnica (Rynek)</option>
                    <option value="Lubin">Lubin</option>
                    <option value="Jawor">Jawor</option>
                    <option value="Złotoryja">Złotoryja</option>
                    <option value="Chojnów">Chojnów</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#94A3B8] mb-1.5">
                    Maksymalny promień (km)
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min={5}
                      max={45}
                      step={5}
                      value={scraperRadius}
                      onChange={(e) => setScraperRadius(parseInt(e.target.value, 10))}
                      className="flex-1 accent-[#FFE600]"
                    />
                    <span className="font-extrabold text-sm text-[#FFE600] w-12">{scraperRadius} km</span>
                  </div>
                </div>
              </div>

              {/* Strict Rule Notice */}
              <div className="mt-5 p-3.5 bg-[#881337]/30 border border-[#E11D48]/50 rounded-xl flex items-center justify-between text-xs text-[#FB7185]">
                <div className="flex items-center gap-2">
                  <ShieldCheck size={16} />
                  <span>
                    <strong>Twarda reguła bezpieczeństwa:</strong> Wyniki z Wrocławia zostaną bezwzględnie zablokowane i
                    odrzucone na poziomie algorytmu.
                  </span>
                </div>
                <span className="bg-[#E11D48] text-white px-2 py-0.5 rounded font-black text-[10px]">ZERO TOLERANCE</span>
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  onClick={handleRunScraper}
                  disabled={scraperLoading}
                  className="bg-[#FFE600] hover:bg-[#FFF04D] text-black font-extrabold text-sm px-6 py-3 rounded-xl flex items-center gap-2 transition-all shadow-lg shadow-yellow-500/10 disabled:opacity-50"
                >
                  <Play size={16} />
                  {scraperLoading ? "Skanowanie w toku..." : "Skanuj & Pobierz Firmy"}
                </button>
              </div>
            </div>

            {/* Scraper Results Card */}
            {scraperResult && (
              <div className="bg-[#141C2E] border border-[#28354D] p-6 rounded-2xl">
                <h3 className="text-lg font-bold text-[#FFE600] mb-3">Wyniki ostatniego skanowania:</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                  <div className="bg-[#0A0E17] p-3 rounded-lg border border-[#28354D]">
                    <span className="text-xs text-[#94A3B8]">Zbadano łącznie</span>
                    <div className="text-xl font-black text-white">{scraperResult.scanned}</div>
                  </div>
                  <div className="bg-[#0A0E17] p-3 rounded-lg border border-[#059669]">
                    <span className="text-xs text-[#34D399]">Dodano do bazy</span>
                    <div className="text-xl font-black text-[#34D399]">+{scraperResult.added}</div>
                  </div>
                  <div className="bg-[#0A0E17] p-3 rounded-lg border border-[#E11D48]">
                    <span className="text-xs text-[#FB7185]">Odrzucono Wrocław</span>
                    <div className="text-xl font-black text-[#FB7185]">{scraperResult.rejectedWroclaw}</div>
                  </div>
                  <div className="bg-[#0A0E17] p-3 rounded-lg border border-[#28354D]">
                    <span className="text-xs text-[#94A3B8]">Duplikaty</span>
                    <div className="text-xl font-black text-white">{scraperResult.rejectedDuplicates}</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: HUMAN REVIEW QUEUE */}
        {activeTab === "review" && (
          <div className="max-w-4xl mx-auto space-y-4">
            <div className="bg-[#141C2E] border border-[#28354D] p-5 rounded-xl">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <AlertTriangle className="text-[#FBBF24]" size={20} />
                Kolejka Spraw Granicznych (Needs Review)
              </h2>
              <p className="text-sm text-[#94A3B8] mt-1">
                Silnik AI skierował te firmy do 1-kliknięcia człowieka ze względu na nietypowy profil lub brak pewności
                co do decydenta.
              </p>
            </div>

            {leads.filter((l) => l.status === "needs_review").length === 0 ? (
              <div className="bg-[#141C2E] border border-[#28354D] p-12 text-center rounded-2xl">
                <CheckCircle2 size={48} className="text-[#34D399] mx-auto mb-3" />
                <h3 className="text-lg font-bold text-white">Brak oczekujących spraw!</h3>
                <p className="text-sm text-[#94A3B8]">Wszystkie leady zostały sklasyfikowane automatycznie przez AI.</p>
              </div>
            ) : (
              leads
                .filter((l) => l.status === "needs_review")
                .map((lead) => (
                  <div key={lead.id} className="bg-[#141C2E] border border-[#28354D] p-5 rounded-2xl flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2.5">
                        <span className="font-mono text-xs text-[#64748B]">#{lead.id}</span>
                        <h3 className="text-base font-extrabold text-white">{lead.companyName}</h3>
                        <span className="badge badge-review">Score: {lead.score} pkt</span>
                      </div>
                      <p className="text-xs text-[#94A3B8] mt-1">
                        Branża: <strong>{lead.industry}</strong> | Miasto: <strong>{lead.city}</strong> | WWW:{" "}
                        <a href={lead.website || "#"} target="_blank" className="text-[#38BDF8] underline">
                          {lead.website || "brak"}
                        </a>
                      </p>
                      {lead.rejectionReason && (
                        <p className="text-xs text-[#FBBF24] mt-2 bg-[#78350F]/30 border border-[#D97706]/40 p-2 rounded-lg">
                          ⚠️ {lead.rejectionReason}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={async () => {
                          await fetch(`/api/leads/${lead.id}`, {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ status: "qualified", rejectionReason: null }),
                          });
                          showToast(`Zatwierdzono #${lead.id}!`);
                          fetchLeads();
                        }}
                        className="bg-[#059669] hover:bg-[#10B981] text-white font-bold text-xs px-4 py-2.5 rounded-lg transition-all flex items-center gap-1.5"
                      >
                        <CheckCircle2 size={15} /> Zatwierdź
                      </button>
                      <button
                        onClick={async () => {
                          await fetch(`/api/leads/${lead.id}`, {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              status: "disqualified",
                              rejectionReason: "Odrzucony manualnie przez człowieka",
                            }),
                          });
                          showToast(`Odrzucono #${lead.id}`);
                          fetchLeads();
                        }}
                        className="bg-[#881337] hover:bg-[#E11D48] text-white font-bold text-xs px-4 py-2.5 rounded-lg transition-all flex items-center gap-1.5"
                      >
                        <XCircle size={15} /> Odrzuć
                      </button>
                    </div>
                  </div>
                ))
            )}
          </div>
        )}

        {/* TAB 4: SETTINGS */}
        {activeTab === "settings" && (
          <div className="max-w-3xl mx-auto bg-[#141C2E] border border-[#28354D] p-6 rounded-2xl shadow-xl space-y-6">
            <h2 className="text-xl font-bold flex items-center gap-2 text-[#FFE600]">
              <SettingsIcon size={22} />
              Konfiguracja Globalna & Integracje
            </h2>

            <div className="space-y-4">
              <div className="p-4 bg-[#0A0E17] border border-[#28354D] rounded-xl flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-sm">Tryb Wysyłki (LIVE_MODE)</h4>
                  <p className="text-xs text-[#94A3B8]">W trybie sandbox maile trafiają wyłącznie na adres testowy.</p>
                </div>
                <span className="badge badge-approved">SANDBOX (BEZPIECZNY)</span>
              </div>

              <div className="p-4 bg-[#0A0E17] border border-[#28354D] rounded-xl flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-sm">Główny Bezpiecznik (Kill-Switch)</h4>
                  <p className="text-xs text-[#94A3B8]">Obecność pliku STOP w systemie natychmiastowo paraliżuje wszelką wysyłkę.</p>
                </div>
                <span className="badge badge-approved">BEZPIECZNIK AKTYWNY</span>
              </div>

              <div className="p-4 bg-[#0A0E17] border border-[#28354D] rounded-xl flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-sm">Baza Danych Neon PostgreSQL</h4>
                  <p className="text-xs text-[#94A3B8]">Połączenie serverless HTTP (Frankfurt aws-eu-central-1).</p>
                </div>
                <span className="badge badge-approved">POŁĄCZONO</span>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* SLIDE-OVER DOSSIER DRAWER */}
      {selectedLead && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-sm flex justify-end">
          <div className="w-full max-w-2xl bg-[#0E1422] border-l border-[#28354D] h-full overflow-y-auto p-6 space-y-6 shadow-2xl animate-in slide-in-from-right duration-200">
            {/* Drawer Header */}
            <div className="flex items-center justify-between border-b border-[#28354D] pb-4">
              <div>
                <span className="text-xs text-[#64748B] font-mono">ID: #{selectedLead.id}</span>
                <h2 className="text-2xl font-black text-white">{selectedLead.companyName}</h2>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-[#94A3B8]">{selectedLead.city || "Legnica"}</span>
                  <span className="text-xs text-[#64748B]">•</span>
                  <span className="text-xs text-[#FFE600] font-bold">{selectedLead.industry}</span>
                </div>
              </div>
              <button
                onClick={() => setSelectedLead(null)}
                className="p-2 rounded-lg bg-[#1E293B] hover:bg-[#334155] text-white transition-all"
              >
                <X size={20} />
              </button>
            </div>

            {/* Drawer Tabs */}
            <div className="flex border-b border-[#28354D] gap-2 pb-1 text-sm font-bold">
              <button
                onClick={() => setDrawerTab("details")}
                className={`px-3 py-1.5 rounded ${drawerTab === "details" ? "bg-[#FFE600] text-black" : "text-[#94A3B8]"}`}
              >
                Karta Leada
              </button>
              <button
                onClick={() => setDrawerTab("audit")}
                className={`px-3 py-1.5 rounded ${drawerTab === "audit" ? "bg-[#FFE600] text-black" : "text-[#94A3B8]"}`}
              >
                Audyt WWW
              </button>
              <button
                onClick={() => setDrawerTab("offer")}
                className={`px-3 py-1.5 rounded ${drawerTab === "offer" ? "bg-[#FFE600] text-black" : "text-[#94A3B8]"}`}
              >
                Oferta Netlify
              </button>
              <button
                onClick={() => setDrawerTab("email")}
                className={`px-3 py-1.5 rounded ${drawerTab === "email" ? "bg-[#FFE600] text-black" : "text-[#94A3B8]"}`}
              >
                Outreach E-mail
              </button>
            </div>

            {/* TAB: DETAILS */}
            {drawerTab === "details" && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="bg-[#141C2E] p-3 rounded-lg border border-[#28354D]">
                    <span className="text-xs text-[#94A3B8]">Telefon</span>
                    <div className="font-mono text-white font-bold">{selectedLead.phoneNormalized || "brak"}</div>
                  </div>
                  <div className="bg-[#141C2E] p-3 rounded-lg border border-[#28354D]">
                    <span className="text-xs text-[#94A3B8]">E-mail</span>
                    <div className="text-white font-bold truncate">{selectedLead.emailPrimary || "brak"}</div>
                  </div>
                  <div className="bg-[#141C2E] p-3 rounded-lg border border-[#28354D]">
                    <span className="text-xs text-[#94A3B8]">Strona WWW</span>
                    <div>
                      {selectedLead.website ? (
                        <a href={selectedLead.website} target="_blank" className="text-[#38BDF8] underline">
                          {selectedLead.website}
                        </a>
                      ) : (
                        "brak"
                      )}
                    </div>
                  </div>
                  <div className="bg-[#141C2E] p-3 rounded-lg border border-[#28354D]">
                    <span className="text-xs text-[#94A3B8]">NIP / KRS</span>
                    <div className="text-white font-mono">
                      {selectedLead.nip || "—"} / {selectedLead.krs || "—"}
                    </div>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="pt-4 border-t border-[#28354D] flex flex-wrap gap-2">
                  <button
                    onClick={() => handleRunAudit(selectedLead.id)}
                    className="bg-[#1E293B] hover:bg-[#2D3D58] border border-[#334155] text-white font-bold text-xs px-3.5 py-2 rounded-lg flex items-center gap-1.5"
                  >
                    <Search size={14} /> Skanuj WWW
                  </button>
                  <button
                    onClick={() => handleRunQualify(selectedLead.id)}
                    className="bg-[#1E293B] hover:bg-[#2D3D58] border border-[#334155] text-white font-bold text-xs px-3.5 py-2 rounded-lg flex items-center gap-1.5"
                  >
                    <Zap size={14} /> Przelicz Scoring
                  </button>
                  <button
                    onClick={() => handleDeleteLead(selectedLead.id)}
                    className="bg-[#881337] hover:bg-[#E11D48] text-white font-bold text-xs px-3.5 py-2 rounded-lg ml-auto flex items-center gap-1.5"
                  >
                    <Trash2 size={14} /> Usuń
                  </button>
                </div>
              </div>
            )}

            {/* TAB: AUDIT */}
            {drawerTab === "audit" && (
              <div className="space-y-4">
                {selectedLead.audit ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="bg-[#141C2E] p-2.5 rounded border border-[#28354D]">
                        SSL: <strong>{selectedLead.audit.sslValid ? "Aktywny" : "Brak"}</strong>
                      </div>
                      <div className="bg-[#141C2E] p-2.5 rounded border border-[#28354D]">
                        Mobile: <strong>{selectedLead.audit.isResponsive ? "Responsywna" : "Brak"}</strong>
                      </div>
                      <div className="bg-[#141C2E] p-2.5 rounded border border-[#28354D]">
                        GA4: <strong>{selectedLead.audit.hasGa4 ? "Zainstalowane" : "Brak"}</strong>
                      </div>
                      <div className="bg-[#141C2E] p-2.5 rounded border border-[#28354D]">
                        Rezerwacja Online: <strong>{selectedLead.audit.hasOnlineBooking ? "Obecna" : "Brak"}</strong>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-sm text-[#94A3B8] mb-3">Brak audytu dla tej witryny.</p>
                    <button
                      onClick={() => handleRunAudit(selectedLead.id)}
                      className="bg-[#FFE600] text-black font-bold text-xs px-4 py-2 rounded-lg"
                    >
                      Uruchom Audyt Teraz
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* TAB: OFFER STUDIO & LIVE PREVIEW */}
            {drawerTab === "offer" && (
              <div className="space-y-4">
                {selectedLead.offer ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="badge badge-offer">OFERTA OPUBLIKOWANA</span>
                      <a
                        href={`/offers/${selectedLead.offer.slug}`}
                        target="_blank"
                        className="text-xs bg-[#FFE600] text-black font-extrabold px-3 py-1.5 rounded-lg flex items-center gap-1.5"
                      >
                        <ExternalLink size={13} /> Otwórz Stronę
                      </a>
                    </div>
                    <h3 className="text-base font-bold text-[#FFE600]">{selectedLead.offer.title}</h3>
                    <p className="text-xs text-[#CBD5E1] bg-[#141C2E] p-3 rounded-lg border border-[#28354D]">
                      {selectedLead.offer.heroObservation}
                    </p>

                    {/* Live Preview Iframe */}
                    <div className="border border-[#28354D] rounded-xl overflow-hidden">
                      <div className="bg-[#0A0E17] px-3 py-1.5 text-xs text-[#94A3B8] font-bold">
                        Podgląd Strony Klienta:
                      </div>
                      <iframe
                        src={`/offers/${selectedLead.offer.slug}`}
                        className="w-full h-[400px] bg-[#0A0C10]"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-sm text-[#94A3B8] mb-3">Ta firma nie posiada jeszcze wygenerowanej oferty.</p>
                    <button
                      onClick={() => handleGenerateOffer(selectedLead.id)}
                      className="bg-[#FFE600] text-black font-extrabold text-xs px-5 py-2.5 rounded-lg shadow-lg"
                    >
                      ⚡ Generuj Ofertę (Gemini AI)
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* TAB: EMAIL OUTREACH */}
            {drawerTab === "email" && (
              <div className="space-y-4">
                {selectedLead.offer ? (
                  <div className="space-y-3">
                    <button
                      onClick={() => handleSendEmail(selectedLead.id)}
                      className="w-full bg-[#FFE600] hover:bg-[#FFF04D] text-black font-extrabold text-sm py-2.5 rounded-lg flex items-center justify-center gap-2"
                    >
                      <Mail size={16} /> Wyślij E-mail z Ofertą (Sandbox)
                    </button>
                  </div>
                ) : (
                  <p className="text-sm text-[#94A3B8]">Najpierw wygeneruj ofertę, aby móc skomponować e-mail.</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
