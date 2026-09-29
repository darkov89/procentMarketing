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
  Inbox,
  Server,
  Key,
  Upload,
  Sparkles,
  Send,
  Clock,
  MessageSquare,
  ArrowRight,
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
  const [scraperCompanyScale, setScraperCompanyScale] = useState<"mikro" | "male" | "msp">("mikro");
  const [scraperKeyword, setScraperKeyword] = useState("");
  const [scraperCity, setScraperCity] = useState("Legnica");
  const [scraperRadius, setScraperRadius] = useState(30);
  const [scraperLoading, setScraperLoading] = useState(false);
  const [scraperResult, setScraperResult] = useState<any>(null);

  // Inbox Poller state
  const [inboxLoading, setInboxLoading] = useState(false);
  const [inboxResult, setInboxResult] = useState<any>(null);

  // Mail & API Settings state
  const [mailSettings, setMailSettings] = useState({
    smtpHost: "",
    smtpPort: 587,
    smtpUser: "",
    smtpPass: "",
    smtpFromEmail: "",
    smtpFromName: "",
    smtpSecure: false,
    imapHost: "",
    imapPort: 993,
    imapUser: "",
    imapPass: "",
    imapTls: true,
    googleApiKey: "",
    geminiApiKey: "",
    netlifyToken: "",
    hasSmtpPass: false,
    hasImapPass: false,
    hasGoogleApiKey: false,
    hasGeminiApiKey: false,
    hasNetlifyToken: false,
  });
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [smtpTesting, setSmtpTesting] = useState(false);
  const [imapTesting, setImapTesting] = useState(false);
  const [csvUploading, setCsvUploading] = useState(false);

  // Outreach & Follow-up Drawer State
  const [outreachData, setOutreachData] = useState<{
    lead?: any;
    messages?: any[];
    initialDraft?: any;
    followupDraft?: any;
    alreadySent?: boolean;
    canSendFollowup?: boolean;
  } | null>(null);
  const [outreachLoading, setOutreachLoading] = useState(false);
  const [outreachSubject, setOutreachSubject] = useState("");
  const [outreachBody, setOutreachBody] = useState("");
  const [outreachSending, setOutreachSending] = useState(false);
  const [outreachAiGenerating, setOutreachAiGenerating] = useState(false);

  // Notification Toast
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);

  const showToast = (message: string, type: "success" | "error" | "info" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Fetch Outreach data (messages, initial draft, AI follow-up draft)
  const fetchOutreachData = async (leadId: number) => {
    try {
      setOutreachLoading(true);
      const res = await fetch(`/api/outreach/${leadId}`);
      const data = await res.json();
      if (data.success) {
        setOutreachData(data);
        if (data.canSendFollowup && data.followupDraft) {
          setOutreachSubject(data.followupDraft.subject || "");
          setOutreachBody(data.followupDraft.bodyText || "");
        } else if (!data.alreadySent && data.initialDraft) {
          setOutreachSubject(data.initialDraft.subject || "");
          setOutreachBody(data.initialDraft.bodyText || "");
        } else if (data.messages && data.messages.length > 0) {
          setOutreachSubject(data.messages[0].subject || "");
          setOutreachBody(data.messages[0].bodyText || "");
        }
      }
    } catch (err) {
      console.error("Błąd pobierania danych outreach:", err);
    } finally {
      setOutreachLoading(false);
    }
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

  // When drawer opens or switches to email tab, fetch message history and drafts
  useEffect(() => {
    if (selectedLead && drawerTab === "email") {
      fetchOutreachData(selectedLead.id);
    }
  }, [selectedLead?.id, drawerTab]);

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
    const qualified = leads.filter((l) => ["qualified", "offer_published", "sent", "followup_sent"].includes(l.status)).length;
    const needsReview = leads.filter((l) => l.status === "needs_review").length;
    const offersPublished = leads.filter((l) => l.offer).length;
    const emailsSent = leads.filter((l) => l.status === "sent" || l.status === "followup_sent" || l.messages?.some((m) => m.status === "sent")).length;
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
        showToast(
          data.isFollowup
            ? `Wysłano Follow-up do: ${data.result.recipient}`
            : `Wysłano e-mail do: ${data.result.recipient}`
        );
        fetchLeads();
        if (selectedLead?.id === leadId) {
          fetchOutreachData(leadId);
        }
      } else {
        showToast(data.result?.errorMessage || data.error || "Błąd wysyłki", "error");
      }
    } catch {
      showToast("Błąd wysyłki", "error");
    }
  };

  // Drawer Action: Send Outreach or Follow-up
  const handleSendOutreachFromDrawer = async (isFollowupMode: boolean) => {
    if (!selectedLead) return;
    try {
      setOutreachSending(true);
      showToast(isFollowupMode ? "Wysyłka Follow-up AI..." : "Wysyłka e-maila zgodnie z RODO...", "info");
      const res = await fetch(`/api/outreach/${selectedLead.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          isFollowup: isFollowupMode,
          subject: outreachSubject,
          bodyText: outreachBody,
          ignoreWindow: true,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(
          isFollowupMode
            ? `Wysłano Follow-up AI do: ${data.result.recipient}`
            : `Wysłano e-mail do: ${data.result.recipient}`
        );
        await fetchLeads();
        await fetchOutreachData(selectedLead.id);
      } else {
        showToast(data.result?.errorMessage || data.error || "Błąd wysyłki", "error");
      }
    } catch {
      showToast("Błąd wysyłki wiadomości", "error");
    } finally {
      setOutreachSending(false);
    }
  };

  // Drawer Action: Regenerate Follow-up AI draft
  const handleRegenerateFollowupAi = async () => {
    if (!selectedLead) return;
    try {
      setOutreachAiGenerating(true);
      showToast("Generowanie spersonalizowanego Follow-up z Gemini AI...", "info");
      await fetchOutreachData(selectedLead.id);
      showToast("Zaktualizowano szkic z modelu Gemini AI!");
    } catch {
      showToast("Błąd odświeżania draftu AI", "error");
    } finally {
      setOutreachAiGenerating(false);
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

  // Run Scraper with scale definition
  const handleRunScraper = async () => {
    setScraperLoading(true);
    setScraperResult(null);
    const scaleLabel = scraperCompanyScale === "mikro" ? "Mikroprzedsiębiorstwa (CEIDG)" : scraperCompanyScale === "male" ? "Małe Przedsiębiorstwa (KRS)" : "MŚP";
    showToast(`Wyszukiwanie firm (${scaleLabel}) w rejonie ${scraperCity}...`, "info");
    try {
      const res = await fetch("/api/scraper", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keyword: scraperKeyword,
          city: scraperCity,
          radiusKm: scraperRadius,
          companyScale: scraperCompanyScale,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setScraperResult(data);
        showToast(`Dodano ${data.added} nowych firm (${scaleLabel})! Odrzucono Wrocław: ${data.rejectedWroclaw}`);
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

  // Run Autonomous End-to-End Scale Cycle (Scrape -> Audit/Scrape Email -> Grounded AI Offer -> Send)
  const handleRunAutonomousScaleCycle = async () => {
    setScraperLoading(true);
    const scaleLabel = scraperCompanyScale === "mikro" ? "Mikroprzedsiębiorstwa (CEIDG)" : scraperCompanyScale === "male" ? "Małe Przedsiębiorstwa (KRS)" : "MŚP";
    showToast(`[Krok 1/2] Wyszukiwanie firm (${scaleLabel}) i weryfikacja Google Places / CEIDG...`, "info");
    try {
      const resScraper = await fetch("/api/scraper", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keyword: scraperKeyword,
          city: scraperCity,
          radiusKm: scraperRadius,
          companyScale: scraperCompanyScale,
        }),
      });
      const dataScraper = await resScraper.json();
      if (!dataScraper.success) {
        showToast(dataScraper.error || "Błąd pobierania firm", "error");
        setScraperLoading(false);
        return;
      }
      setScraperResult(dataScraper);
      setScraperLoading(false);

      // Step 2: Trigger Pipeline
      setPipelineRunning(true);
      showToast(`[Krok 2/2] Czytanie działalności ze stron WWW, deep-scraping e-maili, tworzenie dedykowanych ofert AI i wysyłka...`, "info");
      const resPipeline = await fetch("/api/pipeline", { method: "POST" });
      const dataPipeline = await resPipeline.json();
      if (dataPipeline.success) {
        setPipelineReport(dataPipeline.report);
        showToast(
          `Cykl ukończony! Zaudytowano WWW: ${dataPipeline.report.auditedCount}, Oferty AI: ${dataPipeline.report.offersGeneratedCount}, E-maile: ${dataPipeline.report.emailsSentCount}`,
          "success"
        );
        fetchLeads();
      } else {
        showToast(dataPipeline.error || "Błąd wykonania pipeline'u", "error");
      }
    } catch (err: any) {
      showToast("Błąd wykonania cyklu: " + (err.message || String(err)), "error");
    } finally {
      setScraperLoading(false);
      setPipelineRunning(false);
    }
  };

  // Presets definition
  const PRESETS = [
    {
      icon: "🦷",
      title: "Stomatologia & Medycyna",
      keyword: "Stomatologia",
      city: "Legnica",
      radius: 30,
      desc: "Gabinety i kliniki stomatologiczne (Legnica, Lubin, Jawor)",
    },
    {
      icon: "📊",
      title: "Biura Rachunkowe",
      keyword: "Księgowość",
      city: "Lubin",
      radius: 30,
      desc: "Kancelarie podatkowe i rachunkowe (Legnica, Lubin, Jawor)",
    },
    {
      icon: "⚖️",
      title: "Kancelarie Prawne",
      keyword: "Prawo",
      city: "Legnica",
      radius: 30,
      desc: "Adwokaci i radcowie prawni w Zagłębiu Miedziowym",
    },
    {
      icon: "☀️",
      title: "Fotowoltaika & HVAC",
      keyword: "Fotowoltaika",
      city: "Chojnów",
      radius: 30,
      desc: "Instalatorzy OZE, pomp ciepła i klimatyzacji",
    },
    {
      icon: "🏭",
      title: "Automatyka B2B & Przemysł",
      keyword: "Automatyka B2B",
      city: "Polkowice",
      radius: 35,
      desc: "Serwis maszyn przemysłowych i integracja robotów",
    },
    {
      icon: "🏗️",
      title: "Budownictwo & Remonty",
      keyword: "Budownictwo",
      city: "Złotoryja",
      radius: 30,
      desc: "Generalni wykonawcy i firmy budowlano-remontowe",
    },
  ];

  // Fetch mail settings
  const fetchSettings = async () => {
    try {
      const res = await fetch("/api/settings/mail");
      const data = await res.json();
      if (data.success && data.config) {
        setMailSettings((prev) => ({ ...prev, ...data.config }));
      }
    } catch {}
  };

  useEffect(() => {
    if (activeTab === "settings") {
      fetchSettings();
    }
  }, [activeTab]);

  // Handle Poll Inbox
  const handlePollInbox = async () => {
    setInboxLoading(true);
    showToast("Odpytywanie serwera IMAP i klasyfikacja odpowiedzi...", "info");
    try {
      const res = await fetch("/api/inbox/poll", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setInboxResult(data);
        showToast(data.message, "success");
        fetchLeads();
      } else {
        showToast(data.message || "Błąd odpytywania skrzynki", "error");
      }
    } catch {
      showToast("Błąd połączenia z serwerem poczty", "error");
    } finally {
      setInboxLoading(false);
    }
  };

  // Handle Test SMTP
  const handleTestSmtp = async () => {
    setSmtpTesting(true);
    showToast("Testowanie połączenia z serwerem SMTP...", "info");
    try {
      const res = await fetch("/api/settings/test-smtp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mailSettings),
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message, "success");
      } else {
        showToast(data.message, "error");
      }
    } catch {
      showToast("Błąd wykonania testu SMTP", "error");
    } finally {
      setSmtpTesting(false);
    }
  };

  // Handle Test IMAP
  const handleTestImap = async () => {
    setImapTesting(true);
    showToast("Testowanie połączenia z serwerem IMAP...", "info");
    try {
      const res = await fetch("/api/settings/test-imap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mailSettings),
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message, "success");
      } else {
        showToast(data.message, "error");
      }
    } catch {
      showToast("Błąd wykonania testu IMAP", "error");
    } finally {
      setImapTesting(false);
    }
  };

  // Handle Save Settings
  const handleSaveSettings = async () => {
    setSettingsLoading(true);
    showToast("Zapisywanie konfiguracji...", "info");
    try {
      const res = await fetch("/api/settings/mail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mailSettings),
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message, "success");
        fetchSettings();
      } else {
        showToast(data.error || "Błąd zapisu ustawień", "error");
      }
    } catch {
      showToast("Błąd połączenia z serwerem", "error");
    } finally {
      setSettingsLoading(false);
    }
  };

  // Handle Apply Preset
  const handleApplyPreset = async (preset: (typeof PRESETS)[0]) => {
    setScraperKeyword(preset.keyword);
    setScraperCity(preset.city);
    setScraperRadius(preset.radius);
    setScraperLoading(true);
    setScraperResult(null);
    showToast(`Uruchamianie presetu '${preset.title}' (${preset.city} + ${preset.radius}km)...`, "info");
    try {
      const res = await fetch("/api/scraper", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keyword: preset.keyword,
          city: preset.city,
          radiusKm: preset.radius,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setScraperResult(data);
        showToast(`Preset: Dodano ${data.added} nowych firm! Odrzucono Wrocław: ${data.rejectedWroclaw}`);
        fetchLeads();
      } else {
        showToast(data.error || "Błąd presetu", "error");
      }
    } catch {
      showToast("Błąd scrapera", "error");
    } finally {
      setScraperLoading(false);
    }
  };

  // Handle CSV file upload
  const handleCsvFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCsvUploading(true);
    showToast("Przetwarzanie pliku CSV...", "info");
    try {
      const text = await file.text();
      const lines = text.split("\n").filter((l) => l.trim().length > 0);
      if (lines.length <= 1) {
        showToast("Plik CSV jest pusty lub zawiera tylko nagłówek", "error");
        setCsvUploading(false);
        return;
      }

      const headers = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/["']/g, ""));
      const nameIdx = headers.findIndex((h) => h.includes("name") || h.includes("firma") || h.includes("nazwa"));
      const cityIdx = headers.findIndex((h) => h.includes("city") || h.includes("miasto"));
      const phoneIdx = headers.findIndex((h) => h.includes("phone") || h.includes("tel"));
      const webIdx = headers.findIndex((h) => h.includes("web") || h.includes("url") || h.includes("strona"));
      const addressIdx = headers.findIndex((h) => h.includes("addr") || h.includes("adres"));
      const nipIdx = headers.findIndex((h) => h.includes("nip"));
      const catIdx = headers.findIndex((h) => h.includes("cat") || h.includes("bran"));

      const items: any[] = [];
      for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].split(",").map((p) => p.trim().replace(/^["']|["']$/g, ""));
        if (!parts[nameIdx] && !parts[0]) continue;

        items.push({
          companyName: parts[nameIdx !== -1 ? nameIdx : 0] || "Firma",
          city: parts[cityIdx !== -1 ? cityIdx : 1] || "Legnica",
          phone: parts[phoneIdx !== -1 ? phoneIdx : 2] || "",
          address: parts[addressIdx !== -1 ? addressIdx : 3] || "",
          website: parts[webIdx !== -1 ? webIdx : 4] || "",
          industry: parts[catIdx !== -1 ? catIdx : 5] || "B2B",
          nip: nipIdx !== -1 ? parts[nipIdx] : undefined,
        });
      }

      const res = await fetch("/api/scraper", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csvItems: items }),
      });
      const data = await res.json();
      if (data.success) {
        setScraperResult(data);
        showToast(`Zaimportowano z CSV: +${data.added} firm (Odrzucono Wrocław: ${data.rejectedWroclaw})`);
        fetchLeads();
      } else {
        showToast(data.error || "Błąd importu CSV", "error");
      }
    } catch (err: any) {
      showToast("Błąd czytania pliku CSV", "error");
    } finally {
      setCsvUploading(false);
      e.target.value = "";
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
            <button
              onClick={handlePollInbox}
              disabled={inboxLoading}
              className="bg-[#1E293B] hover:bg-[#2D3D58] border border-[#38BDF8]/50 text-[#38BDF8] font-bold text-sm px-3.5 py-2 rounded-lg flex items-center gap-2 transition-all disabled:opacity-50"
              title="Odpytaj serwer IMAP w poszukiwaniu nowych odpowiedzi klientów"
            >
              <Inbox size={16} className={inboxLoading ? "animate-pulse" : ""} />
              <span className="hidden lg:inline">{inboxLoading ? "Sprawdzanie..." : "Sprawdź skrzynkę (IMAP)"}</span>
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
                  <option value="followup_sent">Follow-up wysłany (followup_sent)</option>
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
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="hover:text-[#FFE600] transition-colors">{lead.companyName}</span>
                                    {lead.scoreBreakdown?.companyScale && (
                                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue-950/80 text-blue-300 border border-blue-800 font-bold uppercase">
                                        {lead.scoreBreakdown.companyScale === "mikro" ? "MIKRO" : lead.scoreBreakdown.companyScale === "male" ? "MAŁA" : "MŚP"}
                                      </span>
                                    )}
                                  </div>
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
                                  {(lead.audit?.rawEvidence?.businessActivity || lead.scoreBreakdown?.businessActivity) && (
                                    <div className="text-[11px] text-[#94A3B8] mt-1 line-clamp-1 italic max-w-sm">
                                      🎯 {lead.audit?.rawEvidence?.businessActivity || lead.scoreBreakdown?.businessActivity}
                                    </div>
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
                                  <option value="followup_sent">followup_sent</option>
                                  <option value="disqualified">disqualified</option>
                                </select>
                              ) : (
                                <span
                                  className={`px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider ${
                                    lead.status === "qualified"
                                      ? "bg-emerald-950/80 text-emerald-400 border border-emerald-700/60"
                                      : lead.status === "needs_review"
                                      ? "bg-amber-950/80 text-amber-400 border border-amber-700/60"
                                      : lead.status === "disqualified"
                                      ? "bg-rose-950/80 text-rose-400 border border-rose-700/60"
                                      : lead.status === "offer_published"
                                      ? "bg-sky-950/80 text-sky-400 border border-sky-700/60"
                                      : lead.status === "sent"
                                      ? "bg-purple-950/80 text-purple-400 border border-purple-700/60"
                                      : lead.status === "followup_sent"
                                      ? "bg-indigo-950/80 text-indigo-400 border border-indigo-700/60"
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
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedLead(lead);
                                    setDrawerTab("email");
                                  }}
                                  className="text-[#C084FC] hover:text-[#E9D5FF] font-bold flex items-center gap-1 bg-[#581C87]/40 hover:bg-[#581C87]/70 border border-[#9333EA]/40 px-2.5 py-1 rounded-md transition-all cursor-pointer"
                                  title="Wysłano e-mail wstępny. Kliknij, aby przygotować Follow-up AI"
                                >
                                  <CheckCircle2 size={13} /> Wysłano (Follow-up AI →)
                                </button>
                              ) : lead.status === "followup_sent" ? (
                                <span className="text-[#A5B4FC] font-bold flex items-center gap-1 bg-[#3730A3]/40 border border-[#6366F1]/40 px-2.5 py-1 rounded-md w-max">
                                  <CheckCircle2 size={13} /> Follow-up wysłany
                                </span>
                              ) : lead.offer ? (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedLead(lead);
                                    setDrawerTab("email");
                                  }}
                                  className="text-[#FFE600] hover:text-black hover:bg-[#FFE600] font-bold flex items-center gap-1 border border-[#FFE600]/40 px-2.5 py-1 rounded-md transition-all cursor-pointer"
                                  title="Oferta gotowa. Kliknij, aby przygotować wysyłkę"
                                >
                                  <Mail size={13} /> Wyślij e-mail
                                </button>
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
          <div className="max-w-5xl mx-auto space-y-6">
            {/* SCALE DEFINITION / TARGET ENTERPRISE SEGMENT */}
            <div className="bg-[#141C2E] border border-[#28354D] p-6 rounded-2xl shadow-xl">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                <div>
                  <h3 className="text-lg font-bold text-[#FFE600] flex items-center gap-2">
                    <Building size={20} />
                    <span>Segment Przedsiębiorstw do Pozyskania (Mikro / Małe / MŚP)</span>
                  </h3>
                  <p className="text-xs text-[#94A3B8] mt-0.5">
                    Wybierz docelową skalę firm. System weryfikuje CEIDG / KRS i Google Places, czyta ze stron WWW czym firma się zajmuje, i tworzy hiper-personalizowaną ofertę.
                  </p>
                </div>
                <button
                  onClick={handleRunAutonomousScaleCycle}
                  disabled={scraperLoading || pipelineRunning}
                  className="bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-xs px-4 py-2.5 rounded-xl flex items-center gap-2 transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50 whitespace-nowrap self-start md:self-auto"
                >
                  <Zap size={15} />
                  {scraperLoading || pipelineRunning ? "Przetwarzanie cyklu..." : "🚀 Pełny Cykl Autonomiczny (1-Click)"}
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                {/* Option 1: Mikro */}
                <div
                  onClick={() => setScraperCompanyScale("mikro")}
                  className={`p-4 rounded-xl border cursor-pointer transition-all ${
                    scraperCompanyScale === "mikro"
                      ? "bg-[#1E293B] border-[#FFE600] shadow-md shadow-yellow-500/10"
                      : "bg-[#0A0E17] border-[#28354D] hover:border-[#38BDF8]"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-2xl">🏢</span>
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${scraperCompanyScale === "mikro" ? "bg-[#FFE600] text-black" : "bg-[#1E293B] text-[#94A3B8]"}`}>
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

                {/* Option 2: Małe */}
                <div
                  onClick={() => setScraperCompanyScale("male")}
                  className={`p-4 rounded-xl border cursor-pointer transition-all ${
                    scraperCompanyScale === "male"
                      ? "bg-[#1E293B] border-[#FFE600] shadow-md shadow-yellow-500/10"
                      : "bg-[#0A0E17] border-[#28354D] hover:border-[#38BDF8]"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-2xl">🏭</span>
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${scraperCompanyScale === "male" ? "bg-[#FFE600] text-black" : "bg-[#1E293B] text-[#94A3B8]"}`}>
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

                {/* Option 3: Wszystkie MŚP */}
                <div
                  onClick={() => setScraperCompanyScale("msp")}
                  className={`p-4 rounded-xl border cursor-pointer transition-all ${
                    scraperCompanyScale === "msp"
                      ? "bg-[#1E293B] border-[#FFE600] shadow-md shadow-yellow-500/10"
                      : "bg-[#0A0E17] border-[#28354D] hover:border-[#38BDF8]"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-2xl">🌐</span>
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${scraperCompanyScale === "msp" ? "bg-[#FFE600] text-black" : "bg-[#1E293B] text-[#94A3B8]"}`}>
                      CAŁE MŚP
                    </span>
                  </div>
                  <h4 className="font-extrabold text-sm text-white">Wszystkie MŚP (Mikro + Małe)</h4>
                  <p className="text-xs text-[#94A3B8] mt-1">
                    Pełen przekrój lokalnego rynku przedsiębiorstw w promieniu 30 km od Legnicy.
                  </p>
                  <div className="mt-3 text-[11px] text-[#38BDF8] flex items-center gap-1 font-semibold">
                    <CheckCircle2 size={12} /> Baza CEIDG + KRS + Google Places API
                  </div>
                </div>
              </div>
            </div>

            {/* Custom Search Form */}
            <div className="bg-[#141C2E] border border-[#28354D] p-6 rounded-2xl shadow-xl">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2.5 bg-[#FFE600] text-black rounded-xl font-bold">
                  <Search size={22} />
                </div>
                <div>
                  <h2 className="text-xl font-bold">Własne Kryteria Poszukiwań & Filtr Geograficzny</h2>
                  <p className="text-sm text-[#94A3B8]">
                    Wyszukaj firmy o wybranej skali. Branża jest opcjonalna — zostaw puste, aby pobrać wszystkie przedsiębiorstwa.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-2">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#94A3B8] mb-1.5">
                    Wielkość Przedsiębiorstwa
                  </label>
                  <select
                    value={scraperCompanyScale}
                    onChange={(e) => setScraperCompanyScale(e.target.value as any)}
                    className="w-full bg-[#0A0E17] border border-[#28354D] rounded-lg px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-[#FFE600]"
                  >
                    <option value="mikro">Mikro (CEIDG / JDG)</option>
                    <option value="male">Małe (KRS / Sp. z o.o.)</option>
                    <option value="msp">Całe MŚP (Mikro + Małe)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#94A3B8] mb-1.5">
                    Branża (opcjonalnie)
                  </label>
                  <input
                    type="text"
                    value={scraperKeyword}
                    onChange={(e) => setScraperKeyword(e.target.value)}
                    placeholder="Wszystkie branże lokalne"
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
                    <option value="Polkowice">Polkowice</option>
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

              <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
                <span className="text-xs text-[#94A3B8]">
                  Automatycznie: pobiera profil z Google Places & CEIDG/KRS, audytuje WWW i wyciąga profil usług.
                </span>
                <button
                  onClick={handleRunScraper}
                  disabled={scraperLoading}
                  className="bg-[#FFE600] hover:bg-[#FFF04D] text-black font-extrabold text-sm px-6 py-3 rounded-xl flex items-center gap-2 transition-all shadow-lg shadow-yellow-500/10 disabled:opacity-50"
                >
                  <Play size={16} />
                  {scraperLoading ? "Skanowanie w toku..." : `Skanuj & Pobierz (${scraperCompanyScale === "mikro" ? "Mikro" : scraperCompanyScale === "male" ? "Małe" : "MŚP"})`}
                </button>
              </div>
            </div>

            {/* Quick Presets Grid (Optional Specific Niches) */}
            <div className="bg-[#141C2E] border border-[#28354D] p-6 rounded-2xl shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <span>⚡ Opcjonalne Szybkie Filtry Branżowe (Jeśli chcesz zawęzić do niszy)</span>
                  </h3>
                  <p className="text-xs text-[#94A3B8] mt-0.5">
                    Możesz też szybko przefiltrować konkretne profile branżowe w regionie Zagłębia Miedziowego:
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                {PRESETS.map((preset, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleApplyPreset(preset)}
                    disabled={scraperLoading}
                    className="p-3.5 bg-[#0A0E17] hover:bg-[#1E293B] border border-[#28354D] hover:border-[#FFE600]/60 rounded-xl text-left transition-all group disabled:opacity-50"
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xl">{preset.icon}</span>
                      <span className="text-[10px] font-mono bg-[#1E293B] px-2 py-0.5 rounded text-[#FFE600] font-bold">
                        {preset.city} +{preset.radius}km
                      </span>
                    </div>
                    <h4 className="font-bold text-xs text-white group-hover:text-[#FFE600] transition-colors">
                      {preset.title}
                    </h4>
                    <p className="text-[11px] text-[#94A3B8] mt-0.5 line-clamp-1">{preset.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* CSV Import Section */}
            <div className="bg-[#141C2E] border border-[#28354D] p-6 rounded-2xl shadow-xl flex flex-col md:flex-row items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Upload size={18} className="text-[#38BDF8]" />
                  Importuj Bazę z Pliku CSV
                </h3>
                <p className="text-xs text-[#94A3B8] mt-1">
                  Obsługuje pliki z Google Maps, Apify, PanoramaFirm lub CEIDG. Automatyczny filtr geo (Legnica ≤30km) i deduplikacja.
                </p>
              </div>
              <label className="bg-[#1E293B] hover:bg-[#2D3D58] border border-[#334155] text-white font-bold text-xs px-4 py-2.5 rounded-xl cursor-pointer flex items-center gap-2 transition-all">
                <Upload size={15} />
                {csvUploading ? "Przetwarzanie..." : "Wybierz plik .CSV"}
                <input type="file" accept=".csv" onChange={handleCsvFileUpload} disabled={csvUploading} className="hidden" />
              </label>
            </div>

            {/* Scraper Results Card */}
            {scraperResult && (
              <div className="bg-[#141C2E] border border-[#28354D] p-6 rounded-2xl animate-in fade-in duration-200">
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
                    <span className="text-xs text-[#94A3B8]">Duplikaty pominięte</span>
                    <div className="text-xl font-black text-white">{scraperResult.rejectedDuplicates}</div>
                  </div>
                </div>

                {/* Google Places Engine Status Badge */}
                <div className="mt-4 p-3 bg-[#0A0E17] rounded-xl border border-[#28354D] text-xs flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[#94A3B8] font-bold flex items-center gap-1.5">
                    <Globe size={14} className="text-[#38BDF8]" />
                    Silnik pobierania danych:
                  </span>
                  {scraperResult.googlePlacesStatus === "OK" ? (
                    <span className="bg-emerald-950 text-emerald-300 border border-emerald-800 px-2.5 py-1 rounded font-bold flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                      Google Places API (Połączono na żywo)
                    </span>
                  ) : scraperResult.googlePlacesStatus && scraperResult.googlePlacesStatus !== "OK" && scraperResult.googlePlacesStatus !== "FALLBACK_NO_KEY" ? (
                    <span className="bg-amber-950 text-amber-300 border border-amber-800 px-2.5 py-1 rounded font-bold">
                      ⚠️ Google Places: {scraperResult.googlePlacesError || scraperResult.googlePlacesStatus} (Użyto katalogu regionalnego)
                    </span>
                  ) : (
                    <span className="bg-slate-800 text-slate-300 border border-slate-700 px-2.5 py-1 rounded font-bold">
                      ℹ️ Katalog Regionalny (Legnica & Region)
                    </span>
                  )}
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
          <div className="max-w-4xl mx-auto space-y-6">
            {/* System Status Indicators */}
            <div className="bg-[#141C2E] border border-[#28354D] p-6 rounded-2xl shadow-xl space-y-4">
              <h2 className="text-xl font-bold flex items-center gap-2 text-[#FFE600]">
                <SettingsIcon size={22} />
                Status Systemu & Zabezpieczenia
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
                <div className="p-3.5 bg-[#0A0E17] border border-[#28354D] rounded-xl flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-xs uppercase tracking-wider text-[#94A3B8]">Tryb Wysyłki</h4>
                    <p className="text-sm font-extrabold text-[#34D399] mt-0.5">SANDBOX (BEZPIECZNY)</p>
                  </div>
                  <span className="badge badge-approved">AKTYWNY</span>
                </div>

                <div className="p-3.5 bg-[#0A0E17] border border-[#28354D] rounded-xl flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-xs uppercase tracking-wider text-[#94A3B8]">Kill-Switch (STOP)</h4>
                    <p className="text-sm font-extrabold text-[#38BDF8] mt-0.5">BEZPIECZNIK CZUWA</p>
                  </div>
                  <span className="badge badge-approved">UZBROJONY</span>
                </div>

                <div className="p-3.5 bg-[#0A0E17] border border-[#28354D] rounded-xl flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-xs uppercase tracking-wider text-[#94A3B8]">Neon Cloud DB</h4>
                    <p className="text-sm font-extrabold text-[#C084FC] mt-0.5">POSTGRESQL FRANKFURT</p>
                  </div>
                  <span className="badge badge-approved">POŁĄCZONO</span>
                </div>
              </div>
            </div>

            {/* SMTP Configuration Form */}
            <div className="bg-[#141C2E] border border-[#28354D] p-6 rounded-2xl shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-[#28354D] pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-[#FFE600]/10 text-[#FFE600] rounded-lg">
                    <Server size={18} />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-white">Serwer Poczty Wychodzącej (SMTP)</h3>
                    <p className="text-xs text-[#94A3B8]">Wysyłka spersonalizowanych propozycji i audytów (Sandbox / Live)</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleTestSmtp}
                  disabled={smtpTesting}
                  className="bg-[#1E293B] hover:bg-[#2D3D58] border border-[#FFE600]/40 text-[#FFE600] font-bold text-xs px-3.5 py-2 rounded-lg flex items-center gap-2 transition-all disabled:opacity-50"
                >
                  <RefreshCw size={14} className={smtpTesting ? "animate-spin" : ""} />
                  {smtpTesting ? "Testowanie..." : "Testuj połączenie SMTP"}
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                <div>
                  <label className="block text-xs font-bold text-[#94A3B8] mb-1">Host SMTP</label>
                  <input
                    type="text"
                    value={mailSettings.smtpHost}
                    onChange={(e) => setMailSettings({ ...mailSettings, smtpHost: e.target.value })}
                    placeholder="np. smtp.gmail.com lub mail.twojadomena.pl"
                    className="w-full bg-[#0A0E17] border border-[#28354D] rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-[#FFE600]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#94A3B8] mb-1">Port SMTP</label>
                  <input
                    type="number"
                    value={mailSettings.smtpPort}
                    onChange={(e) => setMailSettings({ ...mailSettings, smtpPort: parseInt(e.target.value, 10) || 587 })}
                    placeholder="587 (STARTTLS) lub 465 (SSL)"
                    className="w-full bg-[#0A0E17] border border-[#28354D] rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-[#FFE600]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#94A3B8] mb-1">Użytkownik / Login</label>
                  <input
                    type="text"
                    value={mailSettings.smtpUser}
                    onChange={(e) => setMailSettings({ ...mailSettings, smtpUser: e.target.value })}
                    placeholder="kontakt@twojadomena.pl"
                    className="w-full bg-[#0A0E17] border border-[#28354D] rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-[#FFE600]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#94A3B8] mb-1">Hasło / Hasło Aplikacji</label>
                  <input
                    type="password"
                    value={mailSettings.smtpPass}
                    onChange={(e) => setMailSettings({ ...mailSettings, smtpPass: e.target.value })}
                    placeholder={mailSettings.hasSmtpPass ? "•••••••• (pozostaw puste aby nie zmieniać)" : "Wpisz hasło"}
                    className="w-full bg-[#0A0E17] border border-[#28354D] rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-[#FFE600]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#94A3B8] mb-1">Adres Nadawcy (From Email)</label>
                  <input
                    type="text"
                    value={mailSettings.smtpFromEmail}
                    onChange={(e) => setMailSettings({ ...mailSettings, smtpFromEmail: e.target.value })}
                    placeholder="kontakt@procentmarketing.pl"
                    className="w-full bg-[#0A0E17] border border-[#28354D] rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-[#FFE600]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#94A3B8] mb-1">Nazwa Nadawcy (From Name)</label>
                  <input
                    type="text"
                    value={mailSettings.smtpFromName}
                    onChange={(e) => setMailSettings({ ...mailSettings, smtpFromName: e.target.value })}
                    placeholder="Procent Marketing"
                    className="w-full bg-[#0A0E17] border border-[#28354D] rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-[#FFE600]"
                  />
                </div>
              </div>
            </div>

            {/* IMAP Configuration Form */}
            <div className="bg-[#141C2E] border border-[#28354D] p-6 rounded-2xl shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-[#28354D] pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-[#38BDF8]/10 text-[#38BDF8] rounded-lg">
                    <Inbox size={18} />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-white">Serwer Poczty Przychodzącej (IMAP - Monitor)</h3>
                    <p className="text-xs text-[#94A3B8]">Automatyczne wykrywanie odpowiedzi, pytań i żądań wypisania STOP</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleTestImap}
                  disabled={imapTesting}
                  className="bg-[#1E293B] hover:bg-[#2D3D58] border border-[#38BDF8]/40 text-[#38BDF8] font-bold text-xs px-3.5 py-2 rounded-lg flex items-center gap-2 transition-all disabled:opacity-50"
                >
                  <RefreshCw size={14} className={imapTesting ? "animate-spin" : ""} />
                  {imapTesting ? "Testowanie..." : "Testuj połączenie IMAP"}
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                <div>
                  <label className="block text-xs font-bold text-[#94A3B8] mb-1">Host IMAP</label>
                  <input
                    type="text"
                    value={mailSettings.imapHost}
                    onChange={(e) => setMailSettings({ ...mailSettings, imapHost: e.target.value })}
                    placeholder="np. imap.gmail.com lub mail.twojadomena.pl"
                    className="w-full bg-[#0A0E17] border border-[#28354D] rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-[#FFE600]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#94A3B8] mb-1">Port IMAP</label>
                  <input
                    type="number"
                    value={mailSettings.imapPort}
                    onChange={(e) => setMailSettings({ ...mailSettings, imapPort: parseInt(e.target.value, 10) || 993 })}
                    placeholder="993 (SSL) lub 143 (STARTTLS)"
                    className="w-full bg-[#0A0E17] border border-[#28354D] rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-[#FFE600]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#94A3B8] mb-1">Użytkownik IMAP</label>
                  <input
                    type="text"
                    value={mailSettings.imapUser}
                    onChange={(e) => setMailSettings({ ...mailSettings, imapUser: e.target.value })}
                    placeholder="kontakt@twojadomena.pl"
                    className="w-full bg-[#0A0E17] border border-[#28354D] rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-[#FFE600]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#94A3B8] mb-1">Hasło IMAP</label>
                  <input
                    type="password"
                    value={mailSettings.imapPass}
                    onChange={(e) => setMailSettings({ ...mailSettings, imapPass: e.target.value })}
                    placeholder={mailSettings.hasImapPass ? "•••••••• (pozostaw puste aby nie zmieniać)" : "Wpisz hasło IMAP"}
                    className="w-full bg-[#0A0E17] border border-[#28354D] rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-[#FFE600]"
                  />
                </div>
              </div>
            </div>

            {/* API Keys Configuration */}
            <div className="bg-[#141C2E] border border-[#28354D] p-6 rounded-2xl shadow-xl space-y-4">
              <div className="flex items-center gap-2.5 border-b border-[#28354D] pb-3">
                <div className="p-2 bg-[#A855F7]/10 text-[#C084FC] rounded-lg">
                  <Key size={18} />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-white">Klucze Usług Zewnętrznych</h3>
                  <p className="text-xs text-[#94A3B8]">Google Places API, Gemini AI oraz Netlify</p>
                </div>
              </div>

              <div className="space-y-3 pt-1">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-[#94A3B8]">GOOGLE_MAPS_API_KEY (Google Places & Details)</label>
                    <span className="text-[11px] text-[#A5B4FC]">Opcjonalne (odblokowuje dynamiczne pobieranie www i telefonów)</span>
                  </div>
                  <input
                    type="password"
                    value={mailSettings.googleApiKey}
                    onChange={(e) => setMailSettings({ ...mailSettings, googleApiKey: e.target.value })}
                    placeholder={mailSettings.hasGoogleApiKey ? "•••••••• (skonfigurowano)" : "Wklej klucz Google Places API"}
                    className="w-full bg-[#0A0E17] border border-[#28354D] rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-[#FFE600]"
                  />
                  <p className="text-[11px] text-[#64748B] mt-1">
                    Bez klucza Google Places system korzysta z wbudowanego bogatego katalogu lokalnego (Legnica + 30km) oraz importu CSV.
                  </p>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-[#94A3B8]">GEMINI_API_KEY (Google Gemini AI)</label>
                    <span className="text-[11px] text-[#A5B4FC]">Wymagane do personalizacji ofert i AI klasyfikacji</span>
                  </div>
                  <input
                    type="password"
                    value={mailSettings.geminiApiKey}
                    onChange={(e) => setMailSettings({ ...mailSettings, geminiApiKey: e.target.value })}
                    placeholder={mailSettings.hasGeminiApiKey ? "•••••••• (skonfigurowano)" : "Wklej klucz Gemini API"}
                    className="w-full bg-[#0A0E17] border border-[#28354D] rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-[#FFE600]"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-[#94A3B8]">NETLIFY_AUTH_TOKEN</label>
                    <span className="text-[11px] text-[#A5B4FC]">Opcjonalne (do publikacji stron na Netlify)</span>
                  </div>
                  <input
                    type="password"
                    value={mailSettings.netlifyToken}
                    onChange={(e) => setMailSettings({ ...mailSettings, netlifyToken: e.target.value })}
                    placeholder={mailSettings.hasNetlifyToken ? "•••••••• (skonfigurowano)" : "Wklej token Netlify"}
                    className="w-full bg-[#0A0E17] border border-[#28354D] rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-[#FFE600]"
                  />
                </div>
              </div>
            </div>

            {/* Save Button */}
            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={handleSaveSettings}
                disabled={settingsLoading}
                className="bg-[#FFE600] hover:bg-[#FFF04D] text-black font-extrabold text-sm px-6 py-3 rounded-xl flex items-center gap-2 transition-all shadow-lg shadow-yellow-500/10 disabled:opacity-50"
              >
                <Save size={16} />
                {settingsLoading ? "Zapisywanie..." : "Zapisz Wszystkie Ustawienia"}
              </button>
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

                {/* Profile Działalności (Co robi firma ze strony WWW & CEIDG/KRS) */}
                <div className="bg-[#141C2E] p-4 rounded-xl border border-[#28354D] space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#FFE600] flex items-center gap-1.5 uppercase tracking-wider">
                      <Sparkles size={14} /> Profil Działalności (Co robi firma)
                    </span>
                    {selectedLead.scoreBreakdown?.companyScale && (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-800 font-bold uppercase">
                        {selectedLead.scoreBreakdown.companyScale === "mikro"
                          ? "Mikro (CEIDG / JDG)"
                          : selectedLead.scoreBreakdown.companyScale === "male"
                          ? "Małe (KRS / Sp. z o.o.)"
                          : "MŚP"}
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-white font-medium bg-[#0A0E17] p-3 rounded-lg border border-[#1E293B] leading-relaxed">
                    {selectedLead.audit?.rawEvidence?.businessActivity ||
                      selectedLead.scoreBreakdown?.businessActivity ||
                      "Brak szczegółowego profilu działalności. Kliknij 'Skanuj WWW', aby zbadać usługi i ofertę firmy z witryny."}
                  </div>
                  {selectedLead.audit?.rawEvidence?.pageTitle && (
                    <div className="text-xs text-[#94A3B8]">
                      <span className="font-semibold text-[#CBD5E1]">Tytuł strony:</span>{" "}
                      {selectedLead.audit.rawEvidence.pageTitle}
                    </div>
                  )}
                  {selectedLead.scoreBreakdown?.legalForm && (
                    <div className="text-xs text-[#94A3B8]">
                      <span className="font-semibold text-[#CBD5E1]">Rejestr / Forma prawna:</span>{" "}
                      {selectedLead.scoreBreakdown.legalForm}
                    </div>
                  )}
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
              <div className="space-y-5">
                {!selectedLead.offer ? (
                  <div className="bg-[#141C2E] border border-[#28354D] p-6 rounded-2xl text-center space-y-3">
                    <AlertTriangle size={32} className="mx-auto text-[#FFE600]" />
                    <h4 className="text-base font-bold text-white">Brak opublikowanej oferty dla tej firmy</h4>
                    <p className="text-xs text-[#94A3B8] max-w-md mx-auto">
                      Zgodnie z zasadą zero-zmyślania i personalizacji Procent Marketing, outreach wymaga najpierw
                      przeprowadzenia audytu i wygenerowania dedykowanej strony landing page.
                    </p>
                    <button
                      onClick={() => {
                        setDrawerTab("offer");
                        handleGenerateOffer(selectedLead.id);
                      }}
                      className="bg-[#FFE600] text-black font-extrabold text-xs px-5 py-2.5 rounded-lg inline-flex items-center gap-2 hover:bg-[#FFF04D] transition-all cursor-pointer"
                    >
                      <Zap size={14} /> Wygeneruj Ofertę i Wróć Tutaj
                    </button>
                  </div>
                ) : outreachLoading ? (
                  <div className="py-12 text-center text-[#94A3B8] text-sm flex items-center justify-center gap-2">
                    <RefreshCw size={18} className="animate-spin text-[#FFE600]" />
                    Ładowanie historii korespondencji i generowanie draftu AI...
                  </div>
                ) : (
                  <>
                    {/* Status Banner */}
                    {selectedLead.status === "followup_sent" ? (
                      <div className="bg-indigo-950/40 border border-indigo-500/40 p-4 rounded-xl flex items-start gap-3">
                        <CheckCircle2 size={20} className="text-indigo-400 mt-0.5 shrink-0" />
                        <div>
                          <h4 className="text-sm font-bold text-indigo-200">
                            Pełna sekwencja zakończona (Follow-up wysłany)
                          </h4>
                          <p className="text-xs text-indigo-300/80 mt-1">
                            Wysłano wstępny e-mail z audytem oraz jeden follow-up. Zgodnie z etyką B2B i nienarzucającym
                            się kontaktem, system blokuje wysyłanie kolejnych wiadomości automatycznych do tej firmy.
                          </p>
                        </div>
                      </div>
                    ) : selectedLead.status === "sent" ? (
                      <div className="bg-purple-950/40 border border-purple-500/40 p-4 rounded-xl flex items-start gap-3">
                        <Clock size={20} className="text-purple-400 mt-0.5 shrink-0" />
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <h4 className="text-sm font-bold text-purple-200">
                              Wysłano e-mail wstępny — Blokada ponownej wysyłki
                            </h4>
                            <span className="text-[11px] bg-purple-900/60 text-purple-300 font-bold px-2 py-0.5 rounded">
                              Oczekiwanie na odpowiedź
                            </span>
                          </div>
                          <p className="text-xs text-purple-300/80 mt-1">
                            Pierwsza wiadomość została już wysłana. System trwale blokuje wysłanie pierwszej wiadomości po raz drugi.
                            Jeśli odbiorca nie odpisał, możesz poniżej uruchomić i wysłać <strong>spersonalizowany Follow-up AI</strong> w tym samym wątku (<code className="text-purple-200">Re: ...</code>).
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-emerald-950/30 border border-emerald-500/30 p-4 rounded-xl flex items-start gap-3">
                        <Mail size={20} className="text-emerald-400 mt-0.5 shrink-0" />
                        <div>
                          <h4 className="text-sm font-bold text-emerald-200">
                            Gotowy do pierwszej wysyłki (Outreach Sandbox)
                          </h4>
                          <p className="text-xs text-emerald-300/80 mt-1">
                            Oferta i audyt są gotowe. Wiadomość zostanie wysłana z zachowaniem klauzuli RODO (art. 14)
                            i stopki rezygnacji. W trybie testowym wiadomość trafi na Twój adres weryfikacyjny.
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Message Parameters */}
                    <div className="grid grid-cols-2 gap-3 text-xs bg-[#141C2E] p-3.5 rounded-xl border border-[#28354D]">
                      <div>
                        <span className="text-[#94A3B8] block mb-0.5">Odbiorca docelowy (strona www/rejestr):</span>
                        <span className="text-white font-mono font-bold truncate block">
                          {selectedLead.emailPrimary || "brak e-maila w rekordzie"}
                        </span>
                      </div>
                      <div>
                        <span className="text-[#94A3B8] block mb-0.5">Tryb wysyłki:</span>
                        <span className="text-[#38BDF8] font-bold block truncate">
                          LIVE_MODE=false (Sandbox → TEST_RECIPIENTS)
                        </span>
                      </div>
                    </div>

                    {/* Composer Editor (Active if not followup_sent) */}
                    {selectedLead.status !== "followup_sent" ? (
                      <div className="bg-[#141C2E] border border-[#28354D] p-4 rounded-xl space-y-3">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-bold text-white flex items-center gap-1.5">
                            {selectedLead.status === "sent" ? (
                              <>
                                <Sparkles size={14} className="text-[#FFE600]" />
                                Szkic Follow-up AI (Gemini):
                              </>
                            ) : (
                              <>
                                <Mail size={14} className="text-[#FFE600]" />
                                Szkic Pierwszej Wiadomości:
                              </>
                            )}
                          </label>

                          {selectedLead.status === "sent" && (
                            <button
                              onClick={handleRegenerateFollowupAi}
                              disabled={outreachAiGenerating}
                              className="text-xs text-[#FFE600] hover:text-[#FFF04D] flex items-center gap-1 font-bold disabled:opacity-50 cursor-pointer"
                              title="Odśwież wersję wygenerowaną przez Gemini AI"
                            >
                              <RefreshCw size={12} className={outreachAiGenerating ? "animate-spin" : ""} />
                              Przeładuj z AI
                            </button>
                          )}
                        </div>

                        <div>
                          <span className="text-[11px] text-[#94A3B8] block mb-1">Temat wiadomości:</span>
                          <input
                            type="text"
                            value={outreachSubject}
                            onChange={(e) => setOutreachSubject(e.target.value)}
                            className="w-full bg-[#0A0E17] border border-[#28354D] focus:border-[#FFE600] rounded-lg px-3 py-2 text-xs text-white outline-none"
                          />
                        </div>

                        <div>
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-[11px] text-[#94A3B8]">Treść wiadomości:</span>
                            <span className="text-[10px] text-[#64748B]">
                              {outreachBody.split(/\s+/).filter(Boolean).length} słów | {outreachBody.length} znaków
                            </span>
                          </div>
                          <textarea
                            rows={9}
                            value={outreachBody}
                            onChange={(e) => setOutreachBody(e.target.value)}
                            className="w-full bg-[#0A0E17] border border-[#28354D] focus:border-[#FFE600] rounded-lg p-3 text-xs text-white font-mono leading-relaxed outline-none"
                          />
                        </div>

                        <div className="pt-2">
                          {selectedLead.status === "sent" ? (
                            <button
                              onClick={() => handleSendOutreachFromDrawer(true)}
                              disabled={outreachSending}
                              className="w-full bg-gradient-to-r from-[#6366F1] to-[#8B5CF6] hover:from-[#4F46E5] hover:to-[#7C3AED] text-white font-extrabold text-sm py-3 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20 disabled:opacity-50 transition-all cursor-pointer"
                            >
                              <Sparkles size={16} />
                              {outreachSending ? "Wysyłanie Follow-up..." : "Wyślij Follow-up AI (wątek Re:...)"}
                            </button>
                          ) : (
                            <button
                              onClick={() => handleSendOutreachFromDrawer(false)}
                              disabled={outreachSending}
                              className="w-full bg-[#FFE600] hover:bg-[#FFF04D] text-black font-extrabold text-sm py-3 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-yellow-500/10 disabled:opacity-50 transition-all cursor-pointer"
                            >
                              <Send size={16} />
                              {outreachSending ? "Wysyłanie e-maila..." : "Wyślij Pierwszy E-mail z Ofertą"}
                            </button>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="bg-[#141C2E] border border-[#28354D] p-5 rounded-xl text-center space-y-2">
                        <CheckCircle2 size={28} className="mx-auto text-indigo-400" />
                        <h4 className="text-sm font-bold text-white">Sekwencja outreach jest ukończona</h4>
                        <p className="text-xs text-[#94A3B8]">
                          Wszystkie dopuszczalne wiadomości (wstępna + follow-up) zostały wysłane.
                        </p>
                      </div>
                    )}

                    {/* Message History Timeline */}
                    <div className="space-y-3 pt-2">
                      <div className="flex items-center justify-between border-b border-[#28354D] pb-2">
                        <h4 className="text-xs uppercase tracking-wider font-extrabold text-[#94A3B8] flex items-center gap-2">
                          <MessageSquare size={14} />
                          Historia wiadomości ({outreachData?.messages?.length || 0})
                        </h4>
                      </div>

                      {outreachData?.messages && outreachData.messages.length > 0 ? (
                        <div className="space-y-2.5">
                          {outreachData.messages.map((msg: any) => (
                            <div
                              key={msg.id}
                              className="bg-[#141C2E] border border-[#28354D] p-3.5 rounded-xl space-y-2 text-xs"
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span
                                    className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                      msg.direction === "outbound"
                                        ? "bg-purple-950 text-purple-300 border border-purple-800"
                                        : "bg-emerald-950 text-emerald-300 border border-emerald-800"
                                    }`}
                                  >
                                    {msg.direction === "outbound" ? "Wychodząca" : "Odpowiedź"}
                                  </span>
                                  <span className="font-bold text-white">{msg.subject}</span>
                                </div>
                                <span className="text-[11px] text-[#64748B]">
                                  {msg.sentAt
                                    ? new Date(msg.sentAt).toLocaleString("pl-PL")
                                    : msg.createdAt
                                    ? new Date(msg.createdAt).toLocaleString("pl-PL")
                                    : "—"}
                                </span>
                              </div>

                              <p className="text-[#94A3B8] whitespace-pre-wrap font-mono text-[11px] bg-[#0A0E17] p-2.5 rounded-lg border border-[#1E293B]">
                                {msg.bodyText}
                              </p>

                              <div className="flex items-center justify-between text-[11px] text-[#64748B] pt-1">
                                <span>
                                  Odbiorca: <strong className="text-[#CBD5E1]">{msg.recipient}</strong>
                                </span>
                                <span>
                                  Status: <strong className="text-emerald-400">{msg.status}</strong>
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-[#64748B] italic py-2">
                          Brak wcześniejszych wiadomości w bazie dla tego leada.
                        </p>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
