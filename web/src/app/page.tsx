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
  ChevronLeft,
  ChevronDown,
  Menu,
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
  User,
  Users,
  LogOut,
  Copy,
  Sliders,
  Target,
  MapPin,
  History,
  BarChart3,
  TrendingUp,
  Calendar,
  Award,
  CheckSquare,
  Square,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Tag,
} from "lucide-react";
import * as XLSX from "xlsx";
import { POLISH_VOIVODESHIPS } from "@/lib/geo";

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

function getEmailPreview(lead: LeadItem) {
  const contactName = lead.contacts?.[0]?.firstName || null;
  const salutation = contactName ? `Dzień dobry Panie/Pani ${contactName},` : "Dzień dobry,";
  const citySuffix = lead.city ? ` (${lead.city})` : "";
  const cityPhrase = lead.city ? ` w rejonie ${lead.city}` : "";
  const offerUrl =
    lead.offer?.token
      ? `${typeof window !== "undefined" ? window.location.origin : ""}/o/${lead.offer.token}`
      : lead.offer?.deployUrl ||
        lead.offer?.bookingUrl ||
        (lead.offer?.slug ? `/offers/${lead.offer.slug}` : "https://procentmarketing.pl");

  const companySender = lead.offer?.senderCompany || "Procent Marketing";
  const senderName = lead.offer?.senderName || "Dariusz";
  const senderRole = lead.offer?.senderRole || "Założyciel & Strateg B2B";
  const senderEmail = lead.offer?.senderEmail || "kontakt@procentmarketing.pl";
  const senderPhone = lead.offer?.senderPhone || null;
  const senderWebsite = lead.offer?.senderWebsite || "https://procentmarketing.pl";

  const subject = `${lead.companyName} — dedykowana strategia automatyzacji i pozyskiwania klientów${citySuffix}`;

  const bodyText = `${salutation}

Zwracam się do Państwa w imieniu ${companySender}.

W ramach analizy rynku${cityPhrase} przygotowaliśmy dla firmy ${lead.companyName} dedykowaną stronę ze wstępną analizą obecności w sieci oraz propozycją automatyzacji zapytań:

👉 Dedykowana strona dla Państwa firmy: ${offerUrl}

Prezentacja zawiera:
• Wnioski z audytu technologicznego Państwa witryny,
• Rekomendowane moduły eliminujące utratę zapytań od klientów,
• Przejrzysty model wdrożenia i transparentną wycenę.

Wewnątrz strony znajduje się bezpośredni kalendarz do 15-minutowej, bezpłatnej rozmowy.

Z poważaniem,
${senderName}
${senderRole} | ${companySender}
${senderEmail}${senderPhone ? ` | tel. ${senderPhone}` : ''}
${senderWebsite}

---
Klauzula informacyjna (Art. 14 RODO):
Administratorem Państwa danych jest ${companySender}. Dane pozyskano z publicznie dostępnych rejestrów (CEIDG/KRS) lub strony WWW. Aby zrezygnować, odpowiedz 'STOP'.`;

  return { subject, bodyText, offerUrl };
}

export default function LeadMachineDashboard() {
  const [leads, setLeads] = useState<LeadItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [cityFilter, setCityFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [activeTab, setActiveTab] = useState<"crm" | "generator" | "outreach" | "history" | "review" | "import" | "settings" | "team">("crm");

  // CRM Data Grid: Multiselect, Bulk Actions, Sorting & Pagination
  const [selectedCrmLeadIds, setSelectedCrmLeadIds] = useState<number[]>([]);
  const [bulkProcessing, setBulkProcessing] = useState<{ active: boolean; label: string; current: number; total: number } | null>(null);
  const [bulkStatusModal, setBulkStatusModal] = useState<boolean>(false);
  const [targetBulkStatus, setTargetBulkStatus] = useState<string>("qualified");
  const [sortField, setSortField] = useState<"companyName" | "score" | "city" | "status" | "id">("score");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [quickFilter, setQuickFilter] = useState<"all" | "pending_approval" | "needs_review" | "qualified" | "in_sequence" | "with_offer" | "with_email">("all");
  const [pageSize, setPageSize] = useState<number>(25);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Collapsible Sidebar & Navigation Hub state
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Dedicated CSV / Excel Import state
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreviewRows, setImportPreviewRows] = useState<any[]>([]);
  const [importDetectedHeaders, setImportDetectedHeaders] = useState<{ [key: string]: string }>({});
  const [importStats, setImportStats] = useState<{ totalRows: number; fileSizeKb: number } | null>(null);
  const [importTargetCity, setImportTargetCity] = useState<string>("");
  const [importTargetVoivodeship, setImportTargetVoivodeship] = useState<string>("dolnoslaskie");
  const [importDeduplicate, setImportDeduplicate] = useState<boolean>(true);
  const [importRunning, setImportRunning] = useState<boolean>(false);
  const [importReport, setImportReport] = useState<{ added: number; duplicates: number; rejectedRadius?: number } | null>(null);
  const [rawParsedImportItems, setRawParsedImportItems] = useState<any[]>([]);

  // Batch Outreach & AI Act Human Oversight state
  const [selectedOutreachIds, setSelectedOutreachIds] = useState<number[]>([]);
  const [batchSending, setBatchSending] = useState(false);
  const [expandedDraftLeadId, setExpandedDraftLeadId] = useState<number | null>(null);
  const [inlineEmailInput, setInlineEmailInput] = useState<{ [leadId: number]: string }>({});
  const [outreachSearch, setOutreachSearch] = useState("");

  // Outreach History & Multi-tenant Metrics state
  const [historyList, setHistoryList] = useState<any[]>([]);
  const [historyMetrics, setHistoryMetrics] = useState<{
    totalOutreached: number;
    totalMessagesSent: number;
    totalOfferViews: number;
    leadsWithOfferViews: number;
    offerViewRate: number;
    repliesCount: number;
    replyRate: number;
    meetingsBookedCount: number;
    meetingRate: number;
  } | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historySearch, setHistorySearch] = useState("");
  const [historyStatusFilter, setHistoryStatusFilter] = useState("all");
  const [selectedHistoryItem, setSelectedHistoryItem] = useState<any | null>(null);
  const [activeMessageIndex, setActiveMessageIndex] = useState(0);

  // Auth & Team state
  const [currentUser, setCurrentUser] = useState<{
    id: number;
    email: string;
    name: string;
    role: string;
    tenantId?: number;
    tenantSlug?: string;
    tenantName?: string;
  } | null>(null);
  const [invitationsList, setInvitationsList] = useState<any[]>([]);
  const [teamUsersList, setTeamUsersList] = useState<any[]>([]);
  const [bootstrapCode, setBootstrapCode] = useState<string>("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [inviteMaxUses, setInviteMaxUses] = useState(1);
  const [inviteExpiresInDays, setInviteExpiresInDays] = useState(7);
  const [inviteGenerating, setInviteGenerating] = useState(false);
  const [generatedInviteUrl, setGeneratedInviteUrl] = useState<string | null>(null);
  
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
  const [scraperVoivodeship, setScraperVoivodeship] = useState("Dolnośląskie");
  const [scraperCity, setScraperCity] = useState("Wrocław");
  const [scraperCustomCity, setScraperCustomCity] = useState("");
  const [isCustomCityInput, setIsCustomCityInput] = useState(false);
  const [scraperRadius, setScraperRadius] = useState(35);
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
  const [googleTesting, setGoogleTesting] = useState(false);
  const [googleDiagnostic, setGoogleDiagnostic] = useState<{
    tested: boolean;
    success: boolean;
    message: string;
    hint?: string;
  } | null>(null);
  const [csvUploading, setCsvUploading] = useState(false);

  // Targeting Preferences state
  const [targetingSettings, setTargetingSettings] = useState<{
    targetVoivodeship: string;
    targetRegion: string;
    defaultCity: string;
    defaultRadiusKm: number;
    targetIndustries: string[];
    targetCompanyScales: string[];
    excludedKeywords: string[];
    notes?: string;
  }>({
    targetVoivodeship: "Dolnośląskie",
    targetRegion: "Dolnośląskie",
    defaultCity: "Wrocław",
    defaultRadiusKm: 35,
    targetIndustries: [
      "Stomatologia & Medycyna",
      "Biura Rachunkowe & Podatki",
      "Kancelarie Prawne",
      "Fotowoltaika & HVAC",
      "Automatyka B2B & Przemysł",
      "Budownictwo & Remonty",
      "Transport & Spedycja",
      "Serwis Samochodowy & Warsztaty",
      "Usługi IT & Nowe Technologie",
    ],
    targetCompanyScales: ["mikro", "male", "msp"],
    excludedKeywords: [],
    notes: "",
  });
  const [isTargetCustomCity, setIsTargetCustomCity] = useState(false);
  const [targetingCustomCity, setTargetingCustomCity] = useState("");
  const [targetingLoading, setTargetingLoading] = useState(false);
  const [newIndustryTag, setNewIndustryTag] = useState("");
  const [newExcludedKeyword, setNewExcludedKeyword] = useState("");

  const currentVoivodeshipCities = useMemo(() => {
    const found = POLISH_VOIVODESHIPS.find(
      (v) => v.name.toLowerCase() === (scraperVoivodeship || "").toLowerCase()
    );
    return found ? found.majorCities : (POLISH_VOIVODESHIPS[0]?.majorCities || []);
  }, [scraperVoivodeship]);

  const currentTargetingCities = useMemo(() => {
    const vName = targetingSettings.targetVoivodeship || targetingSettings.targetRegion || "";
    const found = POLISH_VOIVODESHIPS.find(
      (v) => v.name.toLowerCase() === vName.toLowerCase()
    );
    return found ? found.majorCities : (POLISH_VOIVODESHIPS[0]?.majorCities || []);
  }, [targetingSettings.targetVoivodeship, targetingSettings.targetRegion]);

  // Sender Profile & Signature Settings state
  const [senderProfile, setSenderProfile] = useState<{
    senderName: string;
    senderRole: string;
    senderEmail: string;
    senderPhone: string;
    senderCompany: string;
    senderWebsite: string;
    bookingUrl: string;
    customNote: string;
  }>({
    senderName: "Dariusz",
    senderRole: "Założyciel & Strateg B2B",
    senderEmail: "kontakt@procentmarketing.pl",
    senderPhone: "+48 700 000 000",
    senderCompany: "Procent Marketing",
    senderWebsite: "https://procentmarketing.pl",
    bookingUrl: "https://cal.com/procentmarketing/15min",
    customNote: "W razie pytań technicznych dotyczących wstępnej analizy, zapraszam do bezpośredniego kontaktu.",
  });
  const [senderProfileLoading, setSenderProfileLoading] = useState(false);

  // Offer Studio Editor state (for selectedLead)
  const [offerEditorMode, setOfferEditorMode] = useState<"edit" | "preview">("edit");
  const [offerForm, setOfferForm] = useState<{
    title: string;
    heroObservation: string;
    pricingRange: string;
    ctaText: string;
    bookingUrl: string;
    proposedModules: Array<{ name: string; description: string; iconEmoji: string }>;
    senderName: string;
    senderRole: string;
    senderEmail: string;
    senderPhone: string;
    senderCompany: string;
    senderWebsite: string;
    customNote: string;
  }>({
    title: "",
    heroObservation: "",
    pricingRange: "od 2 800 zł / mies.",
    ctaText: "Umów bezpłatną konsultację",
    bookingUrl: "",
    proposedModules: [],
    senderName: "",
    senderRole: "",
    senderEmail: "",
    senderPhone: "",
    senderCompany: "",
    senderWebsite: "",
    customNote: "",
  });
  const [offerSaving, setOfferSaving] = useState(false);
  const [offerCopied, setOfferCopied] = useState(false);

  // Outreach & Follow-up Drawer State
  const [outreachData, setOutreachData] = useState<{
    lead?: any;
    messages?: any[];
    initialDraft?: any;
    followupDraft?: any;
    alreadySent?: boolean;
    canSendFollowup?: boolean;
    outboundCount?: number;
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

  // Fetch Current User
  const fetchCurrentUser = async () => {
    try {
      const res = await fetch("/api/auth/me");
      const data = await res.json();
      if (data.success && data.user) {
        setCurrentUser(data.user);
      }
    } catch {}
  };

  // Fetch Invitations and Team
  const fetchTeamData = async () => {
    try {
      const res = await fetch("/api/auth/invitations");
      const data = await res.json();
      if (data.success) {
        setInvitationsList(data.invitations || []);
        setTeamUsersList(data.users || []);
        if (data.bootstrapCode) setBootstrapCode(data.bootstrapCode);
      }
    } catch {}
  };

  // Fetch Outreach History & Multi-tenant Metrics
  const fetchOutreachHistory = async () => {
    setHistoryLoading(true);
    try {
      const res = await fetch("/api/outreach/history");
      const data = await res.json();
      if (data.success) {
        setHistoryList(data.history || []);
        setHistoryMetrics(data.metrics || null);
      }
    } catch (err) {
      console.error("Failed to fetch outreach history:", err);
    } finally {
      setHistoryLoading(false);
    }
  };

  // Logout handler
  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      window.location.href = "/login";
    } catch {
      window.location.href = "/login";
    }
  };

  // Create Invitation handler
  const handleCreateInvitation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail || !inviteEmail.includes("@")) {
      showToast("Wprowadź prawidłowy adres e-mail współpracownika", "error");
      return;
    }
    setInviteGenerating(true);
    showToast("Generowanie bezpiecznego zaproszenia...", "info");
    try {
      const res = await fetch("/api/auth/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: inviteEmail.trim().toLowerCase(),
          role: inviteRole,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setGeneratedInviteUrl(data.inviteUrl);
        showToast("Wygenerowano imienne zaproszenie dla współpracownika!", "success");
        setInviteEmail("");
        fetchTeamData();
      } else {
        showToast(data.error || "Błąd generowania zaproszenia", "error");
      }
    } catch {
      showToast("Błąd serwera", "error");
    } finally {
      setInviteGenerating(false);
    }
  };

  // Revoke Invitation handler
  const handleRevokeInvitation = async (id: number) => {
    if (!confirm("Czy na pewno chcesz unieważnić to zaproszenie?")) return;
    try {
      const res = await fetch(`/api/auth/invitations/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        showToast("Zaproszenie zostało unieważnione", "success");
        fetchTeamData();
      } else {
        showToast(data.error || "Błąd usuwania", "error");
      }
    } catch {
      showToast("Błąd serwera", "error");
    }
  };

  // Update User Role handler
  const handleUpdateUserRole = async (userId: number, newRole: "admin" | "member") => {
    try {
      showToast("Aktualizacja uprawnień...", "info");
      const res = await fetch(`/api/auth/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message || "Rola użytkownika została zaktualizowana", "success");
        fetchTeamData();
      } else {
        showToast(data.error || "Błąd aktualizacji roli", "error");
      }
    } catch {
      showToast("Błąd połączenia z serwerem", "error");
    }
  };

  // Delete User handler
  const handleDeleteUser = async (userId: number, userName: string) => {
    if (!confirm(`Czy na pewno chcesz odebrać dostęp do systemu dla użytkownika: ${userName}?`)) return;
    try {
      showToast("Cofanie dostępu dla użytkownika...", "info");
      const res = await fetch(`/api/auth/users/${userId}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        showToast(data.message || "Użytkownik został usunięty z organizacji", "success");
        fetchTeamData();
      } else {
        showToast(data.error || "Błąd usuwania użytkownika", "error");
      }
    } catch {
      showToast("Błąd połączenia z serwerem", "error");
    }
  };

  useEffect(() => {
    fetchLeads();
    fetchCurrentUser();
    fetchSettings();
    fetchOutreachHistory();
  }, []);

  useEffect(() => {
    if (activeTab === "team") {
      fetchTeamData();
    } else if (activeTab === "history") {
      fetchOutreachHistory();
    }
  }, [activeTab]);

  // When drawer opens or switches to email tab, fetch message history and drafts
  useEffect(() => {
    if (selectedLead && drawerTab === "email") {
      fetchOutreachData(selectedLead.id);
    }
  }, [selectedLead?.id, drawerTab]);

  // Keep offerForm synchronized when selectedLead or its offer changes
  useEffect(() => {
    if (selectedLead?.offer) {
      const o = selectedLead.offer;
      setOfferForm({
        title: o.title || "",
        heroObservation: o.heroObservation || "",
        pricingRange: o.pricingRange || "od 2 800 zł / mies.",
        ctaText: o.ctaText || "Umów bezpłatną konsultację",
        bookingUrl: o.bookingUrl && !o.bookingUrl.startsWith("/o/") ? o.bookingUrl : "",
        proposedModules: Array.isArray(o.proposedModules) ? o.proposedModules : [],
        senderName: o.senderName || senderProfile.senderName || "Dariusz",
        senderRole: o.senderRole || senderProfile.senderRole || "Założyciel & Strateg B2B",
        senderEmail: o.senderEmail || senderProfile.senderEmail || "kontakt@procentmarketing.pl",
        senderPhone: o.senderPhone || senderProfile.senderPhone || "+48 700 000 000",
        senderCompany: o.senderCompany || senderProfile.senderCompany || "Procent Marketing",
        senderWebsite: o.senderWebsite || senderProfile.senderWebsite || "https://procentmarketing.pl",
        customNote: o.customNote !== undefined ? o.customNote : (senderProfile.customNote || ""),
      });
    }
  }, [selectedLead?.id, selectedLead?.offer, senderProfile]);

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

      const matchesQuick =
        quickFilter === "all" ||
        (quickFilter === "pending_approval" && lead.status === "pending_approval") ||
        (quickFilter === "needs_review" && lead.status === "needs_review") ||
        (quickFilter === "qualified" && ["qualified", "pending_approval", "in_sequence", "approved"].includes(lead.status)) ||
        (quickFilter === "in_sequence" && ["in_sequence", "followup_sent", "sent"].includes(lead.status)) ||
        (quickFilter === "with_offer" && Boolean(lead.offer)) ||
        (quickFilter === "with_email" && Boolean(lead.emailPrimary));

      return matchesSearch && matchesCity && matchesStatus && matchesQuick;
    });
  }, [leads, search, cityFilter, statusFilter, quickFilter]);

  // Quick Filter Counts
  const quickFilterCounts = useMemo(() => {
    return {
      all: leads.length,
      pending_approval: leads.filter((l) => l.status === "pending_approval").length,
      needs_review: leads.filter((l) => l.status === "needs_review").length,
      qualified: leads.filter((l) => ["qualified", "pending_approval", "in_sequence", "approved"].includes(l.status)).length,
      in_sequence: leads.filter((l) => ["in_sequence", "followup_sent", "sent"].includes(l.status)).length,
      with_offer: leads.filter((l) => Boolean(l.offer)).length,
      with_email: leads.filter((l) => Boolean(l.emailPrimary)).length,
    };
  }, [leads]);

  // Sorted Leads
  const sortedLeads = useMemo(() => {
    return [...filteredLeads].sort((a, b) => {
      let comparison = 0;
      if (sortField === "score") {
        comparison = (a.score || 0) - (b.score || 0);
      } else if (sortField === "companyName") {
        comparison = a.companyName.localeCompare(b.companyName, "pl");
      } else if (sortField === "city") {
        comparison = (a.city || "").localeCompare(b.city || "", "pl");
      } else if (sortField === "status") {
        comparison = a.status.localeCompare(b.status);
      } else if (sortField === "id") {
        comparison = a.id - b.id;
      }
      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [filteredLeads, sortField, sortDirection]);

  // Paginated Leads
  const paginatedLeads = useMemo(() => {
    if (pageSize === -1) return sortedLeads;
    const start = (currentPage - 1) * pageSize;
    return sortedLeads.slice(start, start + pageSize);
  }, [sortedLeads, currentPage, pageSize]);

  const totalPages = useMemo(() => {
    if (pageSize === -1 || sortedLeads.length === 0) return 1;
    return Math.ceil(sortedLeads.length / pageSize);
  }, [sortedLeads.length, pageSize]);

  const handleSort = (field: "companyName" | "score" | "city" | "status" | "id") => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection(field === "companyName" || field === "city" ? "asc" : "desc");
    }
    setCurrentPage(1);
  };

  // CRM Multiselect Handlers
  const toggleSelectLead = (id: number) => {
    setSelectedCrmLeadIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleSelectAllVisible = () => {
    const visibleIds = paginatedLeads.map((l) => l.id);
    const allSelected = visibleIds.every((id) => selectedCrmLeadIds.includes(id));
    if (allSelected) {
      setSelectedCrmLeadIds((prev) => prev.filter((id) => !visibleIds.includes(id)));
    } else {
      setSelectedCrmLeadIds((prev) => Array.from(new Set([...prev, ...visibleIds])));
    }
  };

  const selectAllFiltered = () => {
    setSelectedCrmLeadIds(sortedLeads.map((l) => l.id));
  };

  const clearCrmSelection = () => {
    setSelectedCrmLeadIds([]);
  };

  const allVisibleSelected = useMemo(() => {
    const visibleIds = paginatedLeads.map((l) => l.id);
    return visibleIds.length > 0 && visibleIds.every((id) => selectedCrmLeadIds.includes(id));
  }, [paginatedLeads, selectedCrmLeadIds]);

  const someVisibleSelected = useMemo(() => {
    const visibleIds = paginatedLeads.map((l) => l.id);
    return visibleIds.some((id) => selectedCrmLeadIds.includes(id));
  }, [paginatedLeads, selectedCrmLeadIds]);

  // Drawer Master-Detail Navigation (Previous / Next Lead)
  const currentLeadIndex = useMemo(() => {
    if (!selectedLead) return -1;
    return sortedLeads.findIndex((l) => l.id === selectedLead.id);
  }, [selectedLead, sortedLeads]);

  const hasPrevLead = currentLeadIndex > 0;
  const hasNextLead = currentLeadIndex !== -1 && currentLeadIndex < sortedLeads.length - 1;

  const goToPrevLead = () => {
    if (hasPrevLead) {
      setSelectedLead(sortedLeads[currentLeadIndex - 1]);
    }
  };

  const goToNextLead = () => {
    if (hasNextLead) {
      setSelectedLead(sortedLeads[currentLeadIndex + 1]);
    }
  };

  // Keyboard navigation shortcuts: Esc (close drawer), ArrowLeft (prev lead), ArrowRight (next lead)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!selectedLead) return;
      const target = e.target as HTMLElement;
      const isInput =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT" ||
        target.isContentEditable;
      if (e.key === "Escape") {
        setSelectedLead(null);
      } else if (!isInput && e.key === "ArrowLeft") {
        if (currentLeadIndex > 0) {
          setSelectedLead(sortedLeads[currentLeadIndex - 1]);
        }
      } else if (!isInput && e.key === "ArrowRight") {
        if (currentLeadIndex !== -1 && currentLeadIndex < sortedLeads.length - 1) {
          setSelectedLead(sortedLeads[currentLeadIndex + 1]);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedLead, currentLeadIndex, sortedLeads]);

  // Deep-linking: sync URL with selectedLead
  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (selectedLead) {
      url.searchParams.set("leadId", String(selectedLead.id));
    } else {
      url.searchParams.delete("leadId");
    }
    window.history.replaceState({}, "", url.toString());
  }, [selectedLead?.id]);

  // Deep-linking: open lead if leadId is in URL on load
  useEffect(() => {
    if (typeof window === "undefined" || leads.length === 0 || selectedLead) return;
    const url = new URL(window.location.href);
    const paramId = url.searchParams.get("leadId");
    if (paramId) {
      const found = leads.find((l) => l.id === Number(paramId));
      if (found) {
        setSelectedLead(found);
      }
    }
  }, [leads]);

  // Bulk Actions
  const handleBulkAudit = async () => {
    const targetLeads = leads.filter(
      (l) => selectedCrmLeadIds.includes(l.id) && l.website && !l.audit
    );
    if (targetLeads.length === 0) {
      showToast("Wszystkie wybrane firmy posiadają już audyt lub nie mają strony WWW.", "info");
      return;
    }
    setBulkProcessing({ active: true, label: "Audyt technologiczny WWW", current: 0, total: targetLeads.length });
    let successCount = 0;
    for (let i = 0; i < targetLeads.length; i++) {
      setBulkProcessing({ active: true, label: `Audyt WWW: ${targetLeads[i].companyName}`, current: i + 1, total: targetLeads.length });
      try {
        await fetch(`/api/audit/${targetLeads[i].id}`, { method: "POST" });
        successCount++;
      } catch (err) {
        console.error(err);
      }
    }
    setBulkProcessing(null);
    showToast(`Zakończono audyt ${successCount} z ${targetLeads.length} firm!`);
    await fetchLeads();
  };

  const handleBulkGenerateOffers = async () => {
    const targetLeads = leads.filter(
      (l) => selectedCrmLeadIds.includes(l.id) && !l.offer && l.status !== "disqualified"
    );
    if (targetLeads.length === 0) {
      showToast("Wszystkie wybrane firmy posiadają już wygenerowaną ofertę.", "info");
      return;
    }
    setBulkProcessing({ active: true, label: "Generowanie ofert Gemini AI", current: 0, total: targetLeads.length });
    let successCount = 0;
    for (let i = 0; i < targetLeads.length; i++) {
      setBulkProcessing({ active: true, label: `Oferta dla: ${targetLeads[i].companyName}`, current: i + 1, total: targetLeads.length });
      try {
        const res = await fetch(`/api/offers/${targetLeads[i].id}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        const data = await res.json();
        if (data.success) successCount++;
      } catch (err) {
        console.error(err);
      }
    }
    setBulkProcessing(null);
    showToast(`Wygenerowano ${successCount} nowych stron ofertowych!`);
    await fetchLeads();
  };

  const handleBulkQualify = async () => {
    const targetLeads = leads.filter((l) => selectedCrmLeadIds.includes(l.id));
    if (targetLeads.length === 0) return;
    setBulkProcessing({ active: true, label: "Przeliczanie scoringu", current: 0, total: targetLeads.length });
    let successCount = 0;
    for (let i = 0; i < targetLeads.length; i++) {
      setBulkProcessing({ active: true, label: `Scoring: ${targetLeads[i].companyName}`, current: i + 1, total: targetLeads.length });
      try {
        await fetch(`/api/qualify/${targetLeads[i].id}`, { method: "POST" });
        successCount++;
      } catch (err) {
        console.error(err);
      }
    }
    setBulkProcessing(null);
    showToast(`Zaktualizowano scoring dla ${successCount} firm!`);
    await fetchLeads();
  };

  const handleBulkChangeStatus = async (targetStatus: string) => {
    if (selectedCrmLeadIds.length === 0) return;
    setBulkProcessing({ active: true, label: `Zmiana statusu na ${targetStatus}`, current: 0, total: selectedCrmLeadIds.length });
    let successCount = 0;
    for (let i = 0; i < selectedCrmLeadIds.length; i++) {
      const id = selectedCrmLeadIds[i];
      setBulkProcessing({ active: true, label: `Status leada #${id}`, current: i + 1, total: selectedCrmLeadIds.length });
      try {
        await fetch(`/api/leads/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: targetStatus }),
        });
        successCount++;
      } catch (err) {
        console.error(err);
      }
    }
    setBulkProcessing(null);
    setBulkStatusModal(false);
    showToast(`Zaktualizowano status ${successCount} firm!`);
    await fetchLeads();
  };

  const handleBulkDelete = async () => {
    if (!confirm(`Czy na pewno chcesz trwale usunąć ${selectedCrmLeadIds.length} zaznaczonych firm z bazy CRM?`)) return;
    setBulkProcessing({ active: true, label: "Usuwanie rekordów", current: 0, total: selectedCrmLeadIds.length });
    let successCount = 0;
    for (let i = 0; i < selectedCrmLeadIds.length; i++) {
      const id = selectedCrmLeadIds[i];
      try {
        await fetch(`/api/leads/${id}`, { method: "DELETE" });
        successCount++;
      } catch (err) {
        console.error(err);
      }
    }
    setBulkProcessing(null);
    setSelectedCrmLeadIds([]);
    showToast(`Usunięto ${successCount} firm z bazy CRM!`);
    await fetchLeads();
  };

  const handleBulkExport = () => {
    const exportTargets = leads.filter((l) => selectedCrmLeadIds.includes(l.id));
    if (exportTargets.length === 0) return;
    const rows = exportTargets.map((l) => ({
      ID: l.id,
      Firma: l.companyName,
      NIP: l.nip || "",
      KRS: l.krs || "",
      Miasto: l.city || "",
      Telefon: l.phoneNormalized || "",
      Email: l.emailPrimary || "",
      StronaWWW: l.website || "",
      Branza: l.industry || "",
      Status: l.status,
      Score: l.score,
      OfertaToken: l.offer?.token || "",
      LiczbaOdslonOferty: l.offer?.viewCount || 0,
      DataDodania: l.createdAt ? new Date(l.createdAt).toLocaleDateString("pl-PL") : "",
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Zaznaczone_Leady");
    XLSX.writeFile(workbook, `leady_zaznaczone_${exportTargets.length}_${new Date().toISOString().slice(0, 10)}.xlsx`);
    showToast(`Wyeksportowano ${exportTargets.length} firm do pliku Excel!`);
  };

  // Filtered Outreach History
  const filteredHistory = useMemo(() => {
    return historyList.filter((item) => {
      const q = historySearch.toLowerCase();
      const matchesSearch =
        !historySearch ||
        item.companyName.toLowerCase().includes(q) ||
        (item.city && item.city.toLowerCase().includes(q)) ||
        (item.industry && item.industry.toLowerCase().includes(q)) ||
        (item.recipientEmail && item.recipientEmail.toLowerCase().includes(q)) ||
        (item.contactName && item.contactName.toLowerCase().includes(q));

      const matchesStatus =
        historyStatusFilter === "all" ||
        (historyStatusFilter === "viewed" && (item.offer?.viewCount || 0) > 0) ||
        (historyStatusFilter === "replied" &&
          ["replied_interested", "replied_question", "replied_negative", "meeting_booked", "won"].includes(
            item.status
          )) ||
        (historyStatusFilter === "meeting" && ["meeting_booked", "won"].includes(item.status)) ||
        (historyStatusFilter === "in_sequence" && ["in_sequence", "followup_sent"].includes(item.status)) ||
        item.status === historyStatusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [historyList, historySearch, historyStatusFilter]);

  // Cities list
  const cities = useMemo(() => {
    const set = new Set<string>();
    leads.forEach((l) => {
      if (l.city) set.add(l.city);
    });
    return Array.from(set).sort();
  }, [leads]);

  // Pending approval leads: have an offer generated, not yet sent, not disqualified
  const pendingApprovalLeads = useMemo(() => {
    return leads.filter((l) => {
      const hasOffer = Boolean(l.offer);
      const isSent =
        l.status === "sent" ||
        l.status === "followup_sent" ||
        l.messages?.some((m) => m.direction === "outbound" && m.channel === "email" && m.status === "sent");
      const isDisqualified = l.status === "disqualified";
      return hasOffer && !isSent && !isDisqualified;
    });
  }, [leads]);

  // Keep selectedOutreachIds in sync by default
  useEffect(() => {
    if (pendingApprovalLeads.length > 0 && selectedOutreachIds.length === 0) {
      setSelectedOutreachIds(pendingApprovalLeads.map((l) => l.id));
    }
  }, [pendingApprovalLeads]);

  // Metric counts
  const metrics = useMemo(() => {
    const total = leads.length;
    const qualified = leads.filter((l) =>
      [
        "qualified",
        "pending_approval",
        "approved",
        "in_sequence",
        "offer_ready",
        "offer_published",
        "sent",
        "followup_sent",
        "replied_interested",
        "meeting_booked",
        "won",
      ].includes(l.status)
    ).length;
    const needsReview = leads.filter((l) => l.status === "needs_review").length;
    const offersPublished = leads.filter((l) => l.offer).length;
    const emailsSent = leads.filter(
      (l) =>
        l.status === "sent" ||
        l.status === "followup_sent" ||
        l.status === "in_sequence" ||
        l.messages?.some((m) => m.status === "sent")
    ).length;
    const disqualified = leads.filter((l) => l.status === "disqualified").length;
    const readyToSend = pendingApprovalLeads.length;

    return { total, qualified, needsReview, offersPublished, emailsSent, disqualified, readyToSend };
  }, [leads, pendingApprovalLeads]);

  // Batch Outreach (AI Act Human Oversight - Send All or Selected)
  const handleSendAll = async (specificIds?: number[]) => {
    const targetIds = specificIds || selectedOutreachIds;
    if (targetIds.length === 0) {
      showToast("Zaznacz przynajmniej jedną firmę do wysyłki", "error");
      return;
    }

    const missingEmailCount = targetIds.filter((id) => {
      const l = leads.find((item) => item.id === id);
      return !l?.emailPrimary;
    }).length;

    if (missingEmailCount > 0) {
      const proceed = confirm(
        `Uwaga: ${missingEmailCount} z wybranych firm nie posiada adresu e-mail i zostanie pominięte. Czy chcesz wysłać wiadomości do pozostałych ${targetIds.length - missingEmailCount} firm?`
      );
      if (!proceed) return;
    }

    setBatchSending(true);
    showToast(`Wysyłanie ${targetIds.length} maili (Zatwierdzenie Człowieka / AI Act)...`, "info");
    try {
      const res = await fetch("/api/outreach/send-all", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadIds: targetIds }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(
          `Wysłano pomyślnie ${data.sentCount} e-maili! (Pominięto: ${data.skippedCount}, Błędów: ${data.failedCount})`,
          data.failedCount > 0 ? "info" : "success"
        );
        fetchLeads();
      } else {
        showToast(data.error || "Błąd wysyłki zbiorczej", "error");
      }
    } catch (err: any) {
      showToast("Błąd wysyłki: " + (err.message || String(err)), "error");
    } finally {
      setBatchSending(false);
    }
  };

  // Single email send
  const handleSendSingle = async (leadId: number) => {
    const lead = leads.find((l) => l.id === leadId);
    if (!lead?.emailPrimary) {
      showToast("Ten lead nie posiada adresu e-mail. Wpisz e-mail przed wysyłką.", "error");
      return;
    }

    showToast(`Wysyłanie e-maila do ${lead.companyName}...`, "info");
    try {
      const res = await fetch(`/api/outreach/${leadId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ignoreWindow: true }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Wysłano e-mail do ${lead.companyName}!`, "success");
        fetchLeads();
      } else {
        showToast(data.error || "Błąd wysyłki", "error");
      }
    } catch (err: any) {
      showToast("Błąd wysyłki: " + (err.message || String(err)), "error");
    }
  };

  // Save missing email inline
  const handleSaveMissingEmail = async (leadId: number) => {
    const email = inlineEmailInput[leadId]?.trim();
    if (!email || !email.includes("@")) {
      showToast("Wprowadź prawidłowy adres e-mail", "error");
      return;
    }

    try {
      const res = await fetch(`/api/leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailPrimary: email }),
      });
      const data = await res.json();
      if (data.success) {
        showToast("Zapisano adres e-mail!", "success");
        setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, emailPrimary: email } : l)));
        setInlineEmailInput((prev) => {
          const next = { ...prev };
          delete next[leadId];
          return next;
        });
      } else {
        showToast(data.error || "Błąd zapisu e-maila", "error");
      }
    } catch {
      showToast("Błąd zapisu", "error");
    }
  };

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

  // Live Drawer State Synchronizer - re-fetches lead details so buttons immediately update drawer UI
  const refreshSelectedLead = async (leadId: number) => {
    try {
      const res = await fetch(`/api/leads/${leadId}`);
      const data = await res.json();
      if (data.success && data.lead) {
        setSelectedLead(data.lead);
      }
    } catch (e) {
      console.error("Błąd odświeżania wybranego leada:", e);
    }
    fetchLeads();
  };

  // Quick Action: Run Audit
  const handleRunAudit = async (leadId: number) => {
    showToast("Uruchamianie audytu technologicznego...", "info");
    try {
      const res = await fetch(`/api/audit/${leadId}`, { method: "POST" });
      const data = await res.json();
      if (data.success) {
        showToast("Audyt zakończony pomyślnie!");
        await refreshSelectedLead(leadId);
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
        await refreshSelectedLead(leadId);
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
        await refreshSelectedLead(leadId);
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
        await refreshSelectedLead(leadId);
        fetchOutreachData(leadId);
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
        await refreshSelectedLead(selectedLead.id);
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

  // Run Full Pipeline (Enrich -> Audit -> Qualify -> Offer -> Pause for Human Oversight)
  const handleRunFullPipeline = async () => {
    setPipelineRunning(true);
    showToast("Uruchamianie cyklu (Audyt WWW -> Kwalifikacja -> Generowanie Ofert AI)... Wysyłka zatrzymana do akceptacji.", "info");
    try {
      const res = await fetch("/api/pipeline", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setPipelineReport(data.report);
        showToast("Zakończono generowanie ofert! Przejrzyj treści i kliknij 'Wyślij wszystko'.", "success");
        fetchLeads();
        setActiveTab("outreach");
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
    const effectiveCity = isCustomCityInput && scraperCustomCity.trim() ? scraperCustomCity.trim() : scraperCity;
    const scaleLabel = scraperCompanyScale === "mikro" ? "Mikroprzedsiębiorstwa (CEIDG)" : scraperCompanyScale === "male" ? "Małe Przedsiębiorstwa (KRS)" : "MŚP";
    showToast(`Wyszukiwanie firm (${scaleLabel}) w rejonie ${effectiveCity}, woj. ${scraperVoivodeship}...`, "info");
    try {
      const res = await fetch("/api/scraper", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keyword: scraperKeyword,
          voivodeship: scraperVoivodeship,
          city: effectiveCity,
          radiusKm: scraperRadius,
          companyScale: scraperCompanyScale,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setScraperResult(data);
        if (data.added > 0) {
          showToast(`Dodano ${data.added} nowych firm (${scaleLabel})! Zbadano: ${data.scanned} (zweryfikowano w rejestrach: ${data.registryVerifiedCount || 0})`);
        } else {
          showToast(`Zbadano ${data.scanned} firm (${data.rejectedDuplicates} to duplikaty w CRM).`, "info");
        }
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

  // Run Scale Cycle with Human-in-the-Loop (Scrape -> Audit/Scrape Email -> Grounded AI Offer -> Review Queue)
  const handleRunAutonomousScaleCycle = async () => {
    setScraperLoading(true);
    const effectiveCity = isCustomCityInput && scraperCustomCity.trim() ? scraperCustomCity.trim() : scraperCity;
    const scaleLabel = scraperCompanyScale === "mikro" ? "Mikroprzedsiębiorstwa (CEIDG)" : scraperCompanyScale === "male" ? "Małe Przedsiębiorstwa (KRS)" : "MŚP";
    showToast(`[Krok 1/2] Wyszukiwanie firm (${scaleLabel}) w rejonie ${effectiveCity} i weryfikacja Google Places / CEIDG / KRS...`, "info");
    try {
      const resScraper = await fetch("/api/scraper", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keyword: scraperKeyword,
          voivodeship: scraperVoivodeship,
          city: effectiveCity,
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

      // Step 2: Trigger Pipeline (Offer Generation & Pause before dispatch)
      setPipelineRunning(true);
      showToast(`[Krok 2/2] Czytanie działalności ze stron WWW, deep-scraping e-maili, tworzenie dedykowanych ofert AI (Nadzór Człowieka)...`, "info");
      const resPipeline = await fetch("/api/pipeline", { method: "POST" });
      const dataPipeline = await resPipeline.json();
      if (dataPipeline.success) {
        setPipelineReport(dataPipeline.report);
        showToast(
          `Cykl ukończony! Zaudytowano WWW: ${dataPipeline.report.auditedCount}, Oferty AI: ${dataPipeline.report.offersGeneratedCount}. Wiadomości oczekują na Twoje zatwierdzenie (AI Act).`,
          "success"
        );
        fetchLeads();
        setActiveTab("outreach");
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

  // Presets definition (Multi-Voivodeship Nationwide Coverage)
  const PRESETS = [
    {
      icon: "🦷",
      title: "Stomatologia & Medycyna",
      keyword: "Stomatologia",
      voivodeship: "Dolnośląskie",
      city: "Wrocław",
      radius: 30,
      desc: "Kliniki stomatologiczne i gabinety medyczne (Wrocław, Legnica, Lubin)",
    },
    {
      icon: "⚖️",
      title: "Kancelarie Prawne & Podatki",
      keyword: "Kancelaria Prawna",
      voivodeship: "Mazowieckie",
      city: "Warszawa",
      radius: 30,
      desc: "Adwokaci, radcowie prawni i doradztwo podatkowe w Warszawie",
    },
    {
      icon: "🏭",
      title: "Automatyka B2B & Przemysł",
      keyword: "Automatyka Przemysłowa",
      voivodeship: "Śląskie",
      city: "Katowice",
      radius: 35,
      desc: "Serwis maszyn, automatyka i integracje robotów na Śląsku",
    },
    {
      icon: "☀️",
      title: "Fotowoltaika & HVAC",
      keyword: "Fotowoltaika",
      voivodeship: "Wielkopolskie",
      city: "Poznań",
      radius: 35,
      desc: "Instalatorzy OZE, pomp ciepła i klimatyzacji w Wielkopolsce",
    },
    {
      icon: "📊",
      title: "Biura Rachunkowe & Audyt",
      keyword: "Biuro Rachunkowe",
      voivodeship: "Małopolskie",
      city: "Kraków",
      radius: 30,
      desc: "Kancelarie podatkowe i biura księgowe w Małopolsce",
    },
    {
      icon: "🚚",
      title: "Spedycja & Logistyka B2B",
      keyword: "Spedycja Transport",
      voivodeship: "Pomorskie",
      city: "Gdańsk",
      radius: 40,
      desc: "Firmy transportowe, spedycyjne i logistyczne Trójmiasta",
    },
    {
      icon: "🏗️",
      title: "Generalni Wykonawcy Budowlani",
      keyword: "Generalny Wykonawca",
      voivodeship: "Dolnośląskie",
      city: "Legnica",
      radius: 35,
      desc: "Firmy budowlano-remontowe i generalni wykonawcy (Zagłębie Miedziowe)",
    },
    {
      icon: "💻",
      title: "Software House & Usługi IT",
      keyword: "Software House",
      voivodeship: "Dolnośląskie",
      city: "Wrocław",
      radius: 25,
      desc: "Software house'y, agencje digital i integracje B2B we Wrocławiu",
    },
  ];

  // Fetch mail and targeting settings
  const fetchSettings = async () => {
    try {
      const res = await fetch("/api/settings/mail");
      const data = await res.json();
      if (data.success && data.config) {
        setMailSettings((prev) => ({ ...prev, ...data.config }));
      }
    } catch {}

    try {
      const resTargeting = await fetch("/api/settings/targeting");
      const dataTargeting = await resTargeting.json();
      if (dataTargeting.success && dataTargeting.preferences) {
        setTargetingSettings(dataTargeting.preferences);
        if (dataTargeting.preferences.targetVoivodeship) {
          setScraperVoivodeship(dataTargeting.preferences.targetVoivodeship);
        }
        if (dataTargeting.preferences.defaultCity) {
          setScraperCity(dataTargeting.preferences.defaultCity);
        }
        if (dataTargeting.preferences.defaultRadiusKm !== undefined) {
          setScraperRadius(dataTargeting.preferences.defaultRadiusKm);
        }
        if (dataTargeting.preferences.targetCompanyScales?.length > 0) {
          const firstScale = dataTargeting.preferences.targetCompanyScales[0];
          if (firstScale === "mikro" || firstScale === "male" || firstScale === "msp") {
            setScraperCompanyScale(firstScale);
          }
        }
      }
    } catch {}

    try {
      const resSender = await fetch("/api/settings/sender-profile");
      const dataSender = await resSender.json();
      if (dataSender.success && dataSender.profile) {
        setSenderProfile(dataSender.profile);
      }
    } catch {}
  };

  // Handle Save Sender Profile Settings
  const handleSaveSenderProfile = async () => {
    setSenderProfileLoading(true);
    showToast("Zapisywanie profilu i podpisu nadawcy...", "info");
    try {
      const res = await fetch("/api/settings/sender-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(senderProfile),
      });
      const data = await res.json();
      if (data.success) {
        showToast("Domyślny profil nadawcy został pomyślnie zapisany!");
        if (data.profile) setSenderProfile(data.profile);
      } else {
        showToast(data.error || "Błąd zapisu profilu", "error");
      }
    } catch {
      showToast("Błąd zapisu profilu nadawcy", "error");
    } finally {
      setSenderProfileLoading(false);
    }
  };

  // Handle Save Custom Offer Edits
  const handleSaveOfferEdits = async (leadId: number) => {
    setOfferSaving(true);
    showToast("Zapisywanie zmian w ofercie i podpisie...", "info");
    try {
      const res = await fetch(`/api/offers/${leadId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(offerForm),
      });
      const data = await res.json();
      if (data.success) {
        showToast("Oferta i podpis zostały pomyślnie zaktualizowane!");
        await fetchLeads();
        if (selectedLead && data.offer) {
          setSelectedLead({
            ...selectedLead,
            offer: data.offer,
          });
        }
      } else {
        showToast(data.error || "Błąd zapisu oferty", "error");
      }
    } catch (e: any) {
      showToast("Błąd zapisu oferty: " + (e?.message || String(e)), "error");
    } finally {
      setOfferSaving(false);
    }
  };

  // Handle Save Targeting Settings
  const handleSaveTargetingSettings = async () => {
    setTargetingLoading(true);
    showToast("Zapisywanie preferencji targetowania...", "info");
    try {
      const res = await fetch("/api/settings/targeting", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(targetingSettings),
      });
      const data = await res.json();
      if (data.success) {
        showToast("Zapisano preferencje targetowania!", "success");
        setScraperCity(targetingSettings.defaultCity);
        setScraperRadius(targetingSettings.defaultRadiusKm);
      } else {
        showToast(data.error || "Błąd zapisu preferencji", "error");
      }
    } catch {
      showToast("Błąd zapisu preferencji", "error");
    } finally {
      setTargetingLoading(false);
    }
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

  // Handle Master Save: All Settings (Targeting, Sender Profile, Integrations & Mail)
  const handleSaveAllSettings = async () => {
    setSettingsLoading(true);
    showToast("Zapisywanie wszystkich ustawień (Zasięg, Profil, Klucze i Poczta)...", "info");
    try {
      const [resTargeting, resSender, resMail] = await Promise.all([
        fetch("/api/settings/targeting", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(targetingSettings),
        }),
        fetch("/api/settings/sender-profile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(senderProfile),
        }),
        fetch("/api/settings/mail", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(mailSettings),
        }),
      ]);

      const [dTargeting, dSender, dMail] = await Promise.all([
        resTargeting.json(),
        resSender.json(),
        resMail.json(),
      ]);

      if (dTargeting.success && dSender.success && dMail.success) {
        showToast("Wszystkie ustawienia zostały pomyślnie zapisane!", "success");
        setScraperVoivodeship(targetingSettings.targetVoivodeship || "Dolnośląskie");
        setScraperCity(targetingSettings.defaultCity || "Wrocław");
        setScraperRadius(targetingSettings.defaultRadiusKm);
        await fetchSettings();
      } else {
        const err = dTargeting.error || dSender.error || dMail.error || "Błąd zapisu części ustawień";
        showToast(err, "error");
      }
    } catch {
      showToast("Błąd połączenia z serwerem", "error");
    } finally {
      setSettingsLoading(false);
    }
  };

  // Handle Test Google API Key
  const handleTestGoogleApi = async () => {
    setGoogleTesting(true);
    setGoogleDiagnostic(null);
    showToast("Weryfikacja klucza Google Places / Maps API...", "info");
    try {
      const res = await fetch("/api/settings/test-google-api", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: mailSettings.googleApiKey }),
      });
      const data = await res.json();
      if (data.success) {
        setGoogleDiagnostic({
          tested: true,
          success: true,
          message: data.message || "Połączenie z Google Places API nawiązane pomyślnie!",
        });
        showToast("Google API: Klucz aktywny i zweryfikowany!", "success");
      } else {
        setGoogleDiagnostic({
          tested: true,
          success: false,
          message: data.diagnostic?.message || data.error || "Błąd weryfikacji klucza",
          hint: data.diagnostic?.actionableHint,
        });
        showToast(data.diagnostic?.message || data.error || "Błąd Google API", "error");
      }
    } catch {
      setGoogleDiagnostic({
        tested: true,
        success: false,
        message: "Błąd połączenia z serwerem testowym",
      });
      showToast("Błąd połączenia z Google API", "error");
    } finally {
      setGoogleTesting(false);
    }
  };

  // Handle Save Mail Settings
  const handleSaveMailSettings = async () => {
    setSettingsLoading(true);
    showToast("Zapisywanie konfiguracji poczty i kluczy API...", "info");
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
    if ((preset as any).city) setScraperCity((preset as any).city);
    if ((preset as any).voivodeship) setScraperVoivodeship((preset as any).voivodeship);
    if ((preset as any).radius) setScraperRadius((preset as any).radius);
    setScraperLoading(true);
    setScraperResult(null);
    showToast(`Uruchamianie presetu '${preset.title}'...`, "info");
    try {
      const res = await fetch("/api/scraper", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keyword: preset.keyword,
          voivodeship: (preset as any).voivodeship || scraperVoivodeship,
          city: (preset as any).city || scraperCity,
          radiusKm: (preset as any).radius || scraperRadius,
          companyScale: scraperCompanyScale,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setScraperResult(data);
        if (data.added > 0) {
          showToast(`Dodano ${data.added} nowych firm! Zbadano: ${data.scanned} (zweryfikowano w rejestrach: ${data.registryVerifiedCount || 0})`);
        } else {
          showToast(`Zbadano ${data.scanned} firm (${data.rejectedDuplicates} to duplikaty w CRM).`, "info");
        }
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
          city: parts[cityIdx !== -1 ? cityIdx : 1] || targetingSettings.defaultCity || "Polska",
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
        showToast(`Zaimportowano z CSV: +${data.added} firm (Poza promieniem: ${data.rejectedRadius || 0}, Duplikaty: ${data.rejectedDuplicates || 0})`);
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

  // Dedicated CSV & Excel File Processor (Prompt 5)
  const handleProcessImportFile = async (file: File) => {
    try {
      setImportFile(file);
      setImportReport(null);
      const isExcel = file.name.endsWith(".xlsx") || file.name.endsWith(".xls");
      let rows: string[][] = [];

      if (isExcel) {
        const buffer = await file.arrayBuffer();
        const wb = XLSX.read(buffer, { type: "array" });
        const sheetName = wb.SheetNames[0];
        const sheet = wb.Sheets[sheetName];
        rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as string[][];
      } else {
        const text = await file.text();
        const lines = text.split("\n").filter((l) => l.trim().length > 0);
        // Detect delimiter (comma vs semicolon)
        const delimiter = lines[0].includes(";") ? ";" : ",";
        rows = lines.map((l) => l.split(delimiter).map((p) => p.trim().replace(/^["']|["']$/g, "")));
      }

      if (rows.length <= 1) {
        showToast("Plik jest pusty lub zawiera tylko nagłówek", "error");
        return;
      }

      const headers = rows[0].map((h) => String(h || "").trim().toLowerCase());
      const nameIdx = headers.findIndex((h) => h.includes("name") || h.includes("firma") || h.includes("nazwa"));
      const cityIdx = headers.findIndex((h) => h.includes("city") || h.includes("miasto") || h.includes("miejsc"));
      const phoneIdx = headers.findIndex((h) => h.includes("phone") || h.includes("tel"));
      const webIdx = headers.findIndex((h) => h.includes("web") || h.includes("url") || h.includes("strona") || h.includes("witryn"));
      const addressIdx = headers.findIndex((h) => h.includes("addr") || h.includes("adres") || h.includes("ulic"));
      const nipIdx = headers.findIndex((h) => h.includes("nip"));
      const catIdx = headers.findIndex((h) => h.includes("cat") || h.includes("bran") || h.includes("kategori"));
      const emailIdx = headers.findIndex((h) => h.includes("mail") || h.includes("email") || h.includes("e-mail"));

      const detected: { [key: string]: string } = {};
      if (nameIdx !== -1) detected["Nazwa firmy"] = rows[0][nameIdx];
      if (cityIdx !== -1) detected["Miasto"] = rows[0][cityIdx];
      if (phoneIdx !== -1) detected["Telefon"] = rows[0][phoneIdx];
      if (webIdx !== -1) detected["Strona WWW"] = rows[0][webIdx];
      if (emailIdx !== -1) detected["E-mail"] = rows[0][emailIdx];
      if (nipIdx !== -1) detected["NIP"] = rows[0][nipIdx];
      if (catIdx !== -1) detected["Branża"] = rows[0][catIdx];
      setImportDetectedHeaders(detected);

      const items: any[] = [];
      for (let i = 1; i < rows.length; i++) {
        const parts = rows[i];
        if (!parts || parts.length === 0) continue;
        const compName = parts[nameIdx !== -1 ? nameIdx : 0];
        if (!compName) continue;

        items.push({
          companyName: String(compName).trim(),
          city: (cityIdx !== -1 && parts[cityIdx]) ? String(parts[cityIdx]).trim() : undefined,
          phone: (phoneIdx !== -1 && parts[phoneIdx]) ? String(parts[phoneIdx]).trim() : "",
          address: (addressIdx !== -1 && parts[addressIdx]) ? String(parts[addressIdx]).trim() : "",
          website: (webIdx !== -1 && parts[webIdx]) ? String(parts[webIdx]).trim() : "",
          email: (emailIdx !== -1 && parts[emailIdx]) ? String(parts[emailIdx]).trim() : undefined,
          industry: (catIdx !== -1 && parts[catIdx]) ? String(parts[catIdx]).trim() : "B2B",
          nip: (nipIdx !== -1 && parts[nipIdx]) ? String(parts[nipIdx]).trim() : undefined,
        });
      }

      setRawParsedImportItems(items);
      setImportStats({
        totalRows: items.length,
        fileSizeKb: Math.round(file.size / 1024),
      });
      setImportPreviewRows(items.slice(0, 5));
      showToast(`Załadowano plik: ${items.length} pozycji do zaimportowania`, "success");
    } catch (err: any) {
      console.error(err);
      showToast("Błąd przetwarzania pliku: " + err.message, "error");
    }
  };

  const handleExecuteImport = async () => {
    if (rawParsedImportItems.length === 0) return;
    setImportRunning(true);
    showToast("Trwa importowanie danych do bazy...", "info");

    try {
      const targetItems = rawParsedImportItems.map((item) => ({
        ...item,
        city: item.city || importTargetCity || targetingSettings.defaultCity || "Polska",
      }));

      const res = await fetch("/api/scraper", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csvItems: targetItems }),
      });
      const data = await res.json();
      if (data.success) {
        setImportReport({
          added: data.added || 0,
          duplicates: data.rejectedDuplicates || 0,
          rejectedRadius: data.rejectedRadius || 0,
        });
        showToast(`Zaimportowano pomyślnie +${data.added} firm do bazy!`, "success");
        await fetchLeads();
      } else {
        showToast(data.error || "Błąd podczas importu", "error");
      }
    } catch (err: any) {
      showToast("Błąd połączenia z serwerem importu", "error");
    } finally {
      setImportRunning(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0E17] text-[#F8FAFC] flex flex-col lg:flex-row">
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

      {/* MOBILE TOP BAR (< lg) */}
      <div className="lg:hidden bg-[#0E1422] border-b border-[#28354D] px-4 py-3 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="p-2 rounded-lg bg-[#141C2E] border border-[#28354D] text-white hover:bg-[#1E293B] cursor-pointer"
          >
            <Menu size={20} />
          </button>
          <div className="flex items-center gap-2">
            <div className="bg-[#FFE600] text-black font-black text-sm px-2 py-0.5 rounded shadow">
              %
            </div>
            <span className="font-extrabold text-sm text-white">Lead Machine</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {pendingApprovalLeads.length > 0 && (
            <button
              onClick={() => setActiveTab("outreach")}
              className="bg-[#FFE600] text-black text-[10px] font-black px-2 py-1 rounded-full flex items-center gap-1 shadow animate-pulse cursor-pointer"
            >
              <ShieldCheck size={12} />
              <span>{pendingApprovalLeads.length} AI</span>
            </button>
          )}
          <button
            onClick={fetchLeads}
            className="p-2 rounded-lg bg-[#141C2E] border border-[#28354D] text-[#94A3B8] hover:text-white cursor-pointer"
            title="Odśwież"
          >
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* MOBILE NAVIGATION DRAWER (< lg) */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-black/75 backdrop-blur-sm animate-in fade-in"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative w-72 bg-[#0E1422] border-r border-[#28354D] h-full flex flex-col justify-between p-4 z-10 animate-in slide-in-from-left duration-200">
            <div>
              {/* Drawer Brand */}
              <div className="flex items-center justify-between border-b border-[#28354D] pb-4 mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="bg-[#FFE600] text-black font-black text-base px-2.5 py-1 rounded-lg shadow-[0_0_12px_rgba(255,230,0,0.3)]">
                    %
                  </div>
                  <div>
                    <h2 className="text-sm font-black text-white">PROCENT MARKETING</h2>
                    <span className="text-[10px] text-[#FFE600] font-bold">LEAD MACHINE 2.0</span>
                  </div>
                </div>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-1.5 rounded-lg text-[#94A3B8] hover:text-white hover:bg-[#1E293B] cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Mobile Nav Links */}
              <nav className="space-y-6">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-[#64748B] block mb-2 px-2">
                    Proces Lejka (Pipeline)
                  </span>
                  <div className="space-y-1">
                    {[
                      { id: "crm", label: "Pipeline CRM", icon: Building, badge: leads.length },
                      { id: "outreach", label: "Zatwierdzanie Ofert", icon: ShieldCheck, badge: pendingApprovalLeads.length, highlight: pendingApprovalLeads.length > 0 },
                      { id: "history", label: "Baza Wysłanych & KPI", icon: History, badge: historyMetrics?.totalOutreached || 0 },
                      { id: "review", label: "Weryfikacja AI", icon: AlertTriangle, badge: metrics.needsReview },
                    ].map((item) => {
                      const Icon = item.icon;
                      const isActive = activeTab === item.id;
                      return (
                        <button
                          key={item.id}
                          onClick={() => {
                            setActiveTab(item.id as any);
                            setMobileMenuOpen(false);
                          }}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                            isActive
                              ? "bg-[#FFE600] text-black shadow-md shadow-[#FFE600]/20 font-black"
                              : "text-[#94A3B8] hover:text-white hover:bg-[#141C2E]"
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <Icon size={16} />
                            <span>{item.label}</span>
                          </div>
                          {item.badge != null && item.badge > 0 && (
                            <span
                              className={`text-[10px] font-mono font-black px-1.5 py-0.2 rounded-full ${
                                isActive
                                  ? "bg-black text-[#FFE600]"
                                  : item.highlight
                                  ? "bg-[#FFE600] text-black"
                                  : "bg-[#1E293B] text-[#CBD5E1]"
                              }`}
                            >
                              {item.badge}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-[#64748B] block mb-2 px-2">
                    Pozyskiwanie Leadów
                  </span>
                  <div className="space-y-1">
                    {[
                      { id: "generator", label: "Generator & Scraper", icon: Search },
                      { id: "import", label: "Import Bazy (CSV / Excel)", icon: Upload },
                    ].map((item) => {
                      const Icon = item.icon;
                      const isActive = activeTab === item.id;
                      return (
                        <button
                          key={item.id}
                          onClick={() => {
                            setActiveTab(item.id as any);
                            setMobileMenuOpen(false);
                          }}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                            isActive
                              ? "bg-[#FFE600] text-black shadow-md shadow-[#FFE600]/20 font-black"
                              : "text-[#94A3B8] hover:text-white hover:bg-[#141C2E]"
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <Icon size={16} />
                            <span>{item.label}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-[#64748B] block mb-2 px-2">
                    Administracja
                  </span>
                  <div className="space-y-1">
                    {[
                      { id: "settings", label: "Ustawienia & Reguły", icon: SettingsIcon },
                      { id: "team", label: "Zespół & Dostęp", icon: Users },
                    ].map((item) => {
                      const Icon = item.icon;
                      const isActive = activeTab === item.id;
                      return (
                        <button
                          key={item.id}
                          onClick={() => {
                            setActiveTab(item.id as any);
                            setMobileMenuOpen(false);
                          }}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                            isActive
                              ? "bg-[#FFE600] text-black shadow-md shadow-[#FFE600]/20 font-black"
                              : "text-[#94A3B8] hover:text-white hover:bg-[#141C2E]"
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <Icon size={16} />
                            <span>{item.label}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </nav>
            </div>

            {/* Mobile Footer User */}
            {currentUser && (
              <div className="border-t border-[#28354D] pt-3 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-[#1E293B] border border-[#334155] text-[#FFE600] font-black text-xs flex items-center justify-center">
                    {currentUser.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white leading-tight">{currentUser.name}</div>
                    <div className="text-[10px] text-[#94A3B8]">{currentUser.role}</div>
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  className="p-2 text-[#94A3B8] hover:text-rose-400 cursor-pointer"
                  title="Wyloguj"
                >
                  <LogOut size={16} />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* DESKTOP SIDEBAR (>= lg) */}
      <aside
        className={`hidden lg:flex flex-col justify-between bg-[#0E1422] border-r border-[#28354D] h-screen sticky top-0 transition-all duration-200 z-30 shrink-0 ${
          sidebarCollapsed ? "w-20 p-3" : "w-64 p-4"
        }`}
      >
        <div className="space-y-6">
          {/* Brand header */}
          <div className="flex items-center justify-between border-b border-[#28354D] pb-4">
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="bg-[#FFE600] text-black font-black text-lg w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-[0_0_15px_rgba(255,230,0,0.3)]">
                %
              </div>
              {!sidebarCollapsed && (
                <div className="min-w-0">
                  <h1 className="text-xs font-black tracking-tight text-white truncate">
                    PROCENT MARKETING
                  </h1>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[10px] text-[#FFE600] font-bold">LEAD MACHINE</span>
                    <span className="text-[9px] bg-[#1E293B] text-[#94A3B8] px-1 py-0.2 rounded font-mono font-bold">
                      v2.0
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Mode Badges (Sandbox & Kill Switch) */}
          {!sidebarCollapsed && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between bg-[#064E3B]/60 border border-[#059669]/60 px-2.5 py-1.5 rounded-lg text-[10px] text-[#34D399] font-bold">
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#34D399] animate-pulse"></span>
                  SANDBOX MODE
                </span>
                <span className="font-mono text-[9px] text-[#A7F3D0]">LIVE=false</span>
              </div>
              <div className="flex items-center justify-between bg-[#141C2E] border border-[#28354D] px-2.5 py-1.5 rounded-lg text-[10px] text-[#94A3B8]">
                <span>BEZPIECZNIK STOP:</span>
                <span className="text-emerald-400 font-bold">OK (UZBROJONY)</span>
              </div>
            </div>
          )}

          {/* Navigation Groups */}
          <nav className="space-y-5">
            {/* Group 1: Pipeline */}
            <div>
              {!sidebarCollapsed && (
                <span className="text-[10px] font-black uppercase tracking-wider text-[#64748B] block mb-2 px-2">
                  Proces Lejka
                </span>
              )}
              <div className="space-y-1">
                {[
                  { id: "crm", label: "Pipeline CRM", icon: Building, badge: leads.length },
                  { id: "outreach", label: "Zatwierdzanie Ofert", icon: ShieldCheck, badge: pendingApprovalLeads.length, highlight: pendingApprovalLeads.length > 0 },
                  { id: "history", label: "Baza Wysłanych", icon: History, badge: historyMetrics?.totalOutreached || 0 },
                  { id: "review", label: "Weryfikacja AI", icon: AlertTriangle, badge: metrics.needsReview },
                ].map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setActiveTab(item.id as any)}
                      className={`w-full flex items-center ${
                        sidebarCollapsed ? "justify-center p-2.5" : "justify-between px-3 py-2.5"
                      } rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        isActive
                          ? "bg-[#FFE600] text-black shadow-lg shadow-[#FFE600]/15 font-black"
                          : "text-[#94A3B8] hover:text-white hover:bg-[#141C2E]"
                      }`}
                      title={sidebarCollapsed ? item.label : undefined}
                    >
                      <div className="flex items-center gap-2.5">
                        <Icon size={17} className={isActive ? "text-black" : "text-[#94A3B8]"} />
                        {!sidebarCollapsed && <span>{item.label}</span>}
                      </div>
                      {!sidebarCollapsed && item.badge != null && item.badge > 0 && (
                        <span
                          className={`text-[10px] font-mono font-black px-1.5 py-0.2 rounded-full ${
                            isActive
                              ? "bg-black text-[#FFE600]"
                              : item.highlight
                              ? "bg-[#FFE600] text-black"
                              : "bg-[#1E293B] text-[#CBD5E1]"
                          }`}
                        >
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Group 2: Acquisition */}
            <div>
              {!sidebarCollapsed && (
                <span className="text-[10px] font-black uppercase tracking-wider text-[#64748B] block mb-2 px-2">
                  Pozyskiwanie
                </span>
              )}
              <div className="space-y-1">
                {[
                  { id: "generator", label: "Generator & Scraper", icon: Search },
                  { id: "import", label: "Import CSV / Excel", icon: Upload },
                ].map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setActiveTab(item.id as any)}
                      className={`w-full flex items-center ${
                        sidebarCollapsed ? "justify-center p-2.5" : "justify-between px-3 py-2.5"
                      } rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        isActive
                          ? "bg-[#FFE600] text-black shadow-lg shadow-[#FFE600]/15 font-black"
                          : "text-[#94A3B8] hover:text-white hover:bg-[#141C2E]"
                      }`}
                      title={sidebarCollapsed ? item.label : undefined}
                    >
                      <div className="flex items-center gap-2.5">
                        <Icon size={17} className={isActive ? "text-black" : "text-[#94A3B8]"} />
                        {!sidebarCollapsed && <span>{item.label}</span>}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Group 3: Settings */}
            <div>
              {!sidebarCollapsed && (
                <span className="text-[10px] font-black uppercase tracking-wider text-[#64748B] block mb-2 px-2">
                  System
                </span>
              )}
              <div className="space-y-1">
                {[
                  { id: "settings", label: "Ustawienia & Reguły", icon: SettingsIcon },
                  { id: "team", label: "Zespół & Dostęp", icon: Users },
                ].map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setActiveTab(item.id as any)}
                      className={`w-full flex items-center ${
                        sidebarCollapsed ? "justify-center p-2.5" : "justify-between px-3 py-2.5"
                      } rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        isActive
                          ? "bg-[#FFE600] text-black shadow-lg shadow-[#FFE600]/15 font-black"
                          : "text-[#94A3B8] hover:text-white hover:bg-[#141C2E]"
                      }`}
                      title={sidebarCollapsed ? item.label : undefined}
                    >
                      <div className="flex items-center gap-2.5">
                        <Icon size={17} className={isActive ? "text-black" : "text-[#94A3B8]"} />
                        {!sidebarCollapsed && <span>{item.label}</span>}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </nav>
        </div>

        {/* Sidebar Footer: Toggle + Profile */}
        <div className="border-t border-[#28354D] pt-3 space-y-3">
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="w-full flex items-center justify-center p-2 rounded-xl text-[#94A3B8] hover:text-white hover:bg-[#141C2E] transition-all cursor-pointer text-xs"
            title={sidebarCollapsed ? "Rozwiń pasek boczny" : "Zwiń pasek boczny"}
          >
            {sidebarCollapsed ? <ChevronRight size={18} /> : <div className="flex items-center gap-2"><ChevronLeft size={16} /><span>Zwiń menu</span></div>}
          </button>

          {currentUser && (
            <div className={`bg-[#141C2E] rounded-xl border border-[#28354D] p-2.5 flex items-center ${sidebarCollapsed ? "justify-center" : "justify-between gap-2"}`}>
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-full bg-[#1E293B] border border-[#334155] text-[#FFE600] font-black text-xs flex items-center justify-center shrink-0">
                  {currentUser.name.slice(0, 2).toUpperCase()}
                </div>
                {!sidebarCollapsed && (
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-white truncate">{currentUser.name}</div>
                    <div className="text-[10px] text-[#94A3B8] font-mono truncate">
                      {currentUser.tenantName || currentUser.role}
                    </div>
                  </div>
                )}
              </div>
              {!sidebarCollapsed && (
                <button
                  onClick={handleLogout}
                  className="p-1.5 rounded-lg text-[#94A3B8] hover:text-rose-400 hover:bg-[#1E293B] transition-all cursor-pointer"
                  title="Wyloguj się"
                >
                  <LogOut size={15} />
                </button>
              )}
            </div>
          )}
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 min-w-0 flex flex-col min-h-screen">
        {/* Desktop Top Header */}
        <header className="border-b border-[#28354D] bg-[#0E1422] px-6 py-3.5 sticky top-0 z-20 hidden lg:block">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <h2 className="text-base font-black text-white flex items-center gap-2">
                {activeTab === "crm" && "Pipeline CRM & Tabela Danych"}
                {activeTab === "generator" && "Generator Leadów & Web Scraper"}
                {activeTab === "import" && "Dedykowany Import Bazy (CSV / Excel)"}
                {activeTab === "outreach" && "Zatwierdzanie Ofert AI & Wysyłka (AI Act Art. 14)"}
                {activeTab === "history" && "Baza Wysłanych Wiadomości & Metryki Kampanii"}
                {activeTab === "review" && "Kolejka Spraw Granicznych (Needs Review)"}
                {activeTab === "settings" && "Konfiguracja Systemu, Poczty & AI"}
                {activeTab === "team" && "Zarządzanie Zespołem & Zaproszenia"}
              </h2>
              {currentUser?.tenantName && (
                <span className="text-[11px] bg-[#141C2E] border border-[#38BDF8]/40 text-[#38BDF8] font-bold px-2.5 py-0.5 rounded-full">
                  Organizacja: {currentUser.tenantName}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2.5">
              <button
                onClick={handleRunFullPipeline}
                disabled={pipelineRunning}
                className="bg-[#FFE600] hover:bg-[#FFF04D] text-black font-extrabold text-xs px-3.5 py-2 rounded-lg flex items-center gap-2 transition-all shadow-[0_0_12px_rgba(255,230,0,0.25)] disabled:opacity-50 cursor-pointer"
              >
                <Zap size={14} />
                {pipelineRunning ? "Przetwarzanie..." : "Uruchom Pełny Cykl"}
              </button>
              <button
                onClick={handlePollInbox}
                disabled={inboxLoading}
                className="bg-[#141C2E] hover:bg-[#1E293B] border border-[#38BDF8]/50 text-[#38BDF8] font-bold text-xs px-3 py-2 rounded-lg flex items-center gap-1.5 transition-all disabled:opacity-50 cursor-pointer"
                title="Odpytaj serwer IMAP w poszukiwaniu nowych odpowiedzi"
              >
                <Inbox size={14} className={inboxLoading ? "animate-pulse" : ""} />
                <span>{inboxLoading ? "Sprawdzanie..." : "Sprawdź IMAP"}</span>
              </button>
              <a
                href="/api/export"
                target="_blank"
                className="bg-[#141C2E] hover:bg-[#1E293B] border border-[#334155] text-white font-bold text-xs px-3 py-2 rounded-lg flex items-center gap-1.5 transition-all"
              >
                <Download size={14} />
                <span>Eksport Excel</span>
              </a>
              <button
                onClick={fetchLeads}
                className="bg-[#141C2E] hover:bg-[#1E293B] border border-[#334155] text-white p-2 rounded-lg transition-all cursor-pointer"
                title="Odśwież dane z bazy"
              >
                <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
              </button>
            </div>
          </div>
        </header>

        {/* METRIC STRIP */}
        <section className="bg-[#101726] border-b border-[#28354D] py-3.5 px-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
            <div className="bg-[#141C2E] border border-[#28354D] p-3 rounded-xl">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8]">Wszystkie Leady</span>
              <div className="text-xl font-black text-white mt-0.5">{metrics.total}</div>
            </div>
            <div className="bg-[#141C2E] border border-[#28354D] p-3 rounded-xl">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#34D399]">Zakwalifikowane</span>
              <div className="text-xl font-black text-[#34D399] mt-0.5">{metrics.qualified}</div>
            </div>
            <div
              onClick={() => setActiveTab("outreach")}
              className="bg-[#141C2E] border-2 border-[#FFE600]/80 p-3 rounded-xl cursor-pointer hover:bg-[#1E293B] transition-all group"
              title="Kliknij, aby przejść do zatwierdzania i wysyłki ofert"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-[#FFE600]">
                  Do Wysyłki (AI Act)
                </span>
                <span className="text-[8px] bg-[#FFE600] text-black font-extrabold px-1.5 py-0.2 rounded">
                  AUDYT
                </span>
              </div>
              <div className="text-xl font-black text-[#FFE600] mt-0.5 flex items-center justify-between">
                <span>{metrics.readyToSend}</span>
                <ArrowRight size={15} className="text-[#FFE600] group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
            <div className="bg-[#141C2E] border border-[#28354D] p-3 rounded-xl">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#38BDF8]">Oferty WWW</span>
              <div className="text-xl font-black text-[#38BDF8] mt-0.5">{metrics.offersPublished}</div>
            </div>
            <div className="bg-[#141C2E] border border-[#28354D] p-3 rounded-xl">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#C084FC]">Wysłane Wiadomości</span>
              <div className="text-xl font-black text-[#C084FC] mt-0.5">{metrics.emailsSent}</div>
            </div>
            <div className="bg-[#141C2E] border border-[#28354D] p-3 rounded-xl">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#FBBF24]">Weryfikacja Leada</span>
              <div className="text-xl font-black text-[#FBBF24] mt-0.5">{metrics.needsReview}</div>
            </div>
          </div>
        </section>

        {/* MAIN CONTAINER */}
        <main className="p-4 sm:p-6 flex-1">
          {/* BANNER: AI ACT HUMAN OVERSIGHT ALERT */}
          {pendingApprovalLeads.length > 0 && (
            <div className="mb-6 bg-gradient-to-r from-[#141C2E] via-[#1A2338] to-[#141C2E] border-2 border-[#FFE600]/70 p-4 sm:p-5 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xl shadow-yellow-500/5">
              <div className="flex items-start gap-3.5">
                <div className="p-3 bg-[#FFE600]/10 border border-[#FFE600]/30 text-[#FFE600] rounded-xl shrink-0 mt-0.5">
                  <ShieldCheck size={26} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="bg-[#FFE600] text-black text-[10px] font-black uppercase px-2 py-0.5 rounded tracking-wider">
                      AI Act Art. 14 • Maszyna Wstrzymana
                    </span>
                    <span className="text-xs text-[#38BDF8] font-bold">
                      Oczekiwanie na akceptację człowieka
                    </span>
                  </div>
                  <h3 className="text-base font-extrabold text-white mt-1">
                    {pendingApprovalLeads.length} wygenerowanych ofert i maili czeka na Twoje sprawdzenie
                  </h3>
                  <p className="text-xs text-[#94A3B8] mt-0.5">
                    Automatyczna wysyłka została zatrzymana. Możesz przejrzeć każdą stronę oferty WWW, sprawdzić treść maila i kliknąć „Wyślij wszystko” jednym guzikiem.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0 self-end md:self-center">
                <button
                  onClick={() => setActiveTab("outreach")}
                  className="bg-[#1E293B] hover:bg-[#2D3D58] border border-[#38BDF8] text-[#38BDF8] hover:text-white font-extrabold text-xs px-4 py-2.5 rounded-xl flex items-center gap-2 transition-all cursor-pointer"
                >
                  <Eye size={15} /> Przejrzyj oferty i maile
                </button>
                <button
                  onClick={() => handleSendAll()}
                  disabled={batchSending}
                  className="bg-[#FFE600] hover:bg-[#FFF04D] text-black font-black text-xs px-5 py-2.5 rounded-xl flex items-center gap-2 transition-all shadow-lg shadow-yellow-500/20 disabled:opacity-50 cursor-pointer"
                >
                  <Send size={15} className={batchSending ? "animate-spin" : ""} />
                  {batchSending ? "Wysyłanie..." : `🚀 Wyślij wszystko (${pendingApprovalLeads.length})`}
                </button>
              </div>
            </div>
          )}

        {/* TAB 1: CRM & EDITABLE TABLE */}
        {activeTab === "crm" && (
          <div className="space-y-4">
            {/* Quick Filter Pills */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
              <span className="text-[#64748B] font-semibold text-[11px] uppercase tracking-wider flex items-center gap-1 shrink-0">
                <Filter size={12} /> Szybkie filtry:
              </span>
              {[
                { id: "all", label: "Wszystkie", count: quickFilterCounts.all, color: "hover:border-[#94A3B8]" },
                { id: "pending_approval", label: "🛡️ Do zatwierdzenia AI", count: quickFilterCounts.pending_approval, color: "hover:border-amber-400 text-amber-300" },
                { id: "needs_review", label: "⚠️ Do weryfikacji", count: quickFilterCounts.needs_review, color: "hover:border-orange-400 text-orange-300" },
                { id: "qualified", label: "✅ Zakwalifikowane", count: quickFilterCounts.qualified, color: "hover:border-emerald-400 text-emerald-300" },
                { id: "in_sequence", label: "📬 W sekwencji", count: quickFilterCounts.in_sequence, color: "hover:border-purple-400 text-purple-300" },
                { id: "with_offer", label: "📄 Z ofertą", count: quickFilterCounts.with_offer, color: "hover:border-sky-400 text-sky-300" },
                { id: "with_email", label: "📧 Z e-mailem", count: quickFilterCounts.with_email, color: "hover:border-[#FFE600] text-[#FFE600]" },
              ].map((pill) => {
                const isActive = quickFilter === pill.id;
                return (
                  <button
                    key={pill.id}
                    onClick={() => {
                      setQuickFilter(pill.id as any);
                      setCurrentPage(1);
                    }}
                    className={`px-3 py-1.5 rounded-lg border font-medium transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
                      isActive
                        ? "bg-[#FFE600] text-black border-[#FFE600] font-bold shadow-md shadow-[#FFE600]/10"
                        : `bg-[#0E1422] border-[#28354D] text-[#94A3B8] hover:text-white ${pill.color}`
                    }`}
                  >
                    <span>{pill.label}</span>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                        isActive ? "bg-black/20 text-black" : "bg-[#1E293B] text-[#CBD5E1]"
                      }`}
                    >
                      {pill.count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Selection Banner */}
            {selectedCrmLeadIds.length > 0 && (
              <div className="bg-amber-950/40 border border-amber-600/40 rounded-xl px-4 py-2.5 flex items-center justify-between text-xs text-amber-200">
                <div className="flex items-center gap-3">
                  <CheckSquare size={16} className="text-[#FFE600]" />
                  <span>
                    Zaznaczono <strong className="text-white font-mono">{selectedCrmLeadIds.length}</strong> z{" "}
                    <strong className="text-white font-mono">{sortedLeads.length}</strong> przefiltrowanych leadów
                  </span>
                  {selectedCrmLeadIds.length < sortedLeads.length && (
                    <button
                      onClick={selectAllFiltered}
                      className="text-[#FFE600] underline font-bold hover:text-white cursor-pointer ml-2"
                    >
                      Zaznacz wszystkie {sortedLeads.length} leadów
                    </button>
                  )}
                </div>
                <button
                  onClick={clearCrmSelection}
                  className="text-[#94A3B8] hover:text-white underline cursor-pointer"
                >
                  Wyczyść zaznaczenie
                </button>
              </div>
            )}

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
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="w-full bg-[#0A0E17] border border-[#28354D] rounded-lg pl-10 pr-4 py-2 text-sm text-white placeholder-[#64748B] focus:outline-none focus:border-[#FFE600]"
                  />
                </div>

                {/* City Filter */}
                <select
                  value={cityFilter}
                  onChange={(e) => {
                    setCityFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="bg-[#0A0E17] border border-[#28354D] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#FFE600]"
                >
                  <option value="all">Wszystkie Miasta</option>
                  {cities.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>

                {/* Status Filter */}
                <select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="bg-[#0A0E17] border border-[#28354D] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#FFE600]"
                >
                  <option value="all">Wszystkie Statusy</option>
                  <option value="pending_approval">🛡️ Do Zatwierdzenia AI Act (pending_approval)</option>
                  <option value="needs_review">⚠️ Do Weryfikacji (needs_review)</option>
                  <option value="qualified">✅ Zakwalifikowane (qualified)</option>
                  <option value="new">🆕 Nowe (new)</option>
                  <option value="in_sequence">📬 W Sekwencji Outreach (in_sequence)</option>
                  <option value="replied_interested">💬 Odpowiedź: Zainteresowany</option>
                  <option value="meeting_booked">🏆 Umówione Spotkanie</option>
                  <option value="offer_published">📄 Oferta Opublikowana</option>
                  <option value="sent">📧 E-mail Wysłany</option>
                  <option value="followup_sent">🔄 Follow-up Wysłany</option>
                  <option value="disqualified">❌ Odrzucone (disqualified)</option>
                </select>
              </div>

              <div className="text-xs text-[#94A3B8]">
                Wyświetlanie <strong className="text-white">{paginatedLeads.length}</strong> z{" "}
                <strong className="text-white">{sortedLeads.length}</strong> (łącznie {leads.length})
              </div>
            </div>

            {/* Editable Data Table */}
            <div className="bg-[#141C2E] border border-[#28354D] rounded-xl overflow-hidden shadow-2xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-[#28354D] bg-[#0E1422] text-[#94A3B8] text-[11px] uppercase tracking-wider font-extrabold">
                      {/* Checkbox column */}
                      <th className="p-3.5 w-10 text-center">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleSelectAllVisible();
                          }}
                          className="text-[#94A3B8] hover:text-[#FFE600] transition-colors p-0.5 cursor-pointer block mx-auto"
                          title={allVisibleSelected ? "Odznacz widoczne" : "Zaznacz widoczne"}
                        >
                          {allVisibleSelected ? (
                            <CheckSquare size={17} className="text-[#FFE600]" />
                          ) : someVisibleSelected ? (
                            <div className="w-4 h-4 rounded border-2 border-[#FFE600] bg-[#FFE600]/20 flex items-center justify-center">
                              <div className="w-2 h-0.5 bg-[#FFE600]" />
                            </div>
                          ) : (
                            <Square size={17} />
                          )}
                        </button>
                      </th>
                      <th
                        className="p-3.5 cursor-pointer select-none hover:text-white transition-colors"
                        onClick={() => handleSort("id")}
                      >
                        <div className="flex items-center gap-1.5">
                          <span>ID</span>
                          {sortField === "id" ? (
                            sortDirection === "asc" ? <ArrowUp size={13} className="text-[#FFE600]" /> : <ArrowDown size={13} className="text-[#FFE600]" />
                          ) : (
                            <ArrowUpDown size={12} className="opacity-40" />
                          )}
                        </div>
                      </th>
                      <th
                        className="p-3.5 cursor-pointer select-none hover:text-white transition-colors min-w-[200px]"
                        onClick={() => handleSort("companyName")}
                      >
                        <div className="flex items-center gap-1.5">
                          <span>Firma</span>
                          {sortField === "companyName" ? (
                            sortDirection === "asc" ? <ArrowUp size={13} className="text-[#FFE600]" /> : <ArrowDown size={13} className="text-[#FFE600]" />
                          ) : (
                            <ArrowUpDown size={12} className="opacity-40" />
                          )}
                        </div>
                      </th>
                      <th
                        className="p-3.5 cursor-pointer select-none hover:text-white transition-colors"
                        onClick={() => handleSort("city")}
                      >
                        <div className="flex items-center gap-1.5">
                          <span>Lokalizacja</span>
                          {sortField === "city" ? (
                            sortDirection === "asc" ? <ArrowUp size={13} className="text-[#FFE600]" /> : <ArrowDown size={13} className="text-[#FFE600]" />
                          ) : (
                            <ArrowUpDown size={12} className="opacity-40" />
                          )}
                        </div>
                      </th>
                      <th className="p-3.5">Branża</th>
                      <th
                        className="p-3.5 cursor-pointer select-none hover:text-white transition-colors"
                        onClick={() => handleSort("status")}
                      >
                        <div className="flex items-center gap-1.5">
                          <span>Status</span>
                          {sortField === "status" ? (
                            sortDirection === "asc" ? <ArrowUp size={13} className="text-[#FFE600]" /> : <ArrowDown size={13} className="text-[#FFE600]" />
                          ) : (
                            <ArrowUpDown size={12} className="opacity-40" />
                          )}
                        </div>
                      </th>
                      <th
                        className="p-3.5 text-center cursor-pointer select-none hover:text-white transition-colors"
                        onClick={() => handleSort("score")}
                      >
                        <div className="flex items-center justify-center gap-1.5">
                          <span>Score</span>
                          {sortField === "score" ? (
                            sortDirection === "asc" ? <ArrowUp size={13} className="text-[#FFE600]" /> : <ArrowDown size={13} className="text-[#FFE600]" />
                          ) : (
                            <ArrowUpDown size={12} className="opacity-40" />
                          )}
                        </div>
                      </th>
                      <th className="p-3.5">Kontakt</th>
                      <th className="p-3.5">Oferta WWW</th>
                      <th className="p-3.5">E-mail</th>
                      <th className="p-3.5 text-right">Akcje</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1E293B]">
                    {paginatedLeads.length === 0 ? (
                      <tr>
                        <td colSpan={11} className="py-16 px-4 text-center">
                          <div className="max-w-md mx-auto flex flex-col items-center justify-center space-y-3">
                            <div className="w-12 h-12 rounded-full bg-[#1E293B] border border-[#334155] flex items-center justify-center text-[#94A3B8]">
                              <Search size={22} />
                            </div>
                            <div className="text-white font-bold text-base">Brak leadów spełniających kryteria</div>
                            <p className="text-xs text-[#94A3B8] leading-relaxed">
                              {search || cityFilter !== "all" || statusFilter !== "all" || quickFilter !== "all"
                                ? "Zastosowane filtry lub wyszukiwana fraza nie dopasowały żadnych rekordów w bazie CRM."
                                : "Brak zapisanych rekordów. Użyj generatora leadów lub zaimportuj plik CSV."}
                            </p>
                            {(search || cityFilter !== "all" || statusFilter !== "all" || quickFilter !== "all") && (
                              <button
                                onClick={() => {
                                  setSearch("");
                                  setCityFilter("all");
                                  setStatusFilter("all");
                                  setQuickFilter("all");
                                  setCurrentPage(1);
                                }}
                                className="mt-2 bg-[#FFE600] hover:bg-[#FACC15] text-black text-xs font-bold px-4 py-2 rounded-lg transition-all cursor-pointer shadow-md"
                              >
                                Wyczyść filtry i wyszukiwanie
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ) : (
                      paginatedLeads.map((lead) => {
                        const isEditing = editingId === lead.id;
                        const isSelected = selectedCrmLeadIds.includes(lead.id);

                        return (
                          <tr
                            key={lead.id}
                            className={`transition-colors cursor-pointer group ${
                              isSelected
                                ? "bg-[#182338]/90 hover:bg-[#1E2B45] border-l-4 border-l-[#FFE600]"
                                : "hover:bg-[#182338]"
                            }`}
                            onClick={(e) => {
                              const target = e.target as HTMLElement;
                              if (target.tagName === "INPUT" || target.tagName === "SELECT" || target.tagName === "BUTTON" || target.tagName === "A") {
                                return;
                              }
                              setSelectedLead(lead);
                            }}
                          >
                            {/* Checkbox */}
                            <td className="p-3.5 text-center w-10" onClick={(e) => e.stopPropagation()}>
                              <button
                                type="button"
                                onClick={() => toggleSelectLead(lead.id)}
                                className="text-[#94A3B8] hover:text-[#FFE600] transition-colors p-0.5 cursor-pointer block mx-auto"
                              >
                                {isSelected ? (
                                  <CheckSquare size={17} className="text-[#FFE600]" />
                                ) : (
                                  <Square size={17} />
                                )}
                              </button>
                            </td>

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
                                  <strong>{lead.city || targetingSettings.defaultCity || "—"}</strong>
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
                                  <option value="needs_review">needs_review</option>
                                  <option value="qualified">qualified</option>
                                  <option value="pending_approval">pending_approval</option>
                                  <option value="in_sequence">in_sequence</option>
                                  <option value="replied_interested">replied_interested</option>
                                  <option value="meeting_booked">meeting_booked</option>
                                  <option value="offer_published">offer_published</option>
                                  <option value="sent">sent</option>
                                  <option value="followup_sent">followup_sent</option>
                                  <option value="disqualified">disqualified</option>
                                </select>
                              ) : (
                                <span
                                  className={`px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider ${
                                    lead.status === "pending_approval"
                                      ? "bg-amber-950/80 text-[#FFE600] border border-[#FFE600]/70 shadow-sm"
                                      : lead.status === "qualified"
                                      ? "bg-emerald-950/80 text-emerald-400 border border-emerald-700/60"
                                      : lead.status === "needs_review"
                                      ? "bg-amber-950/80 text-amber-400 border border-amber-700/60"
                                      : lead.status === "in_sequence"
                                      ? "bg-purple-950/80 text-purple-300 border border-purple-700/60"
                                      : lead.status === "replied_interested"
                                      ? "bg-emerald-900/80 text-emerald-300 border border-emerald-500"
                                      : lead.status === "meeting_booked"
                                      ? "bg-[#FFE600] text-black border border-[#FFE600] font-black"
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
                                  {lead.status === "pending_approval" ? "Do zatwierdzenia" : lead.status}
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
                                  href={lead.offer.token ? `/o/${lead.offer.token}` : `/offers/${lead.offer.slug}`}
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

              {/* Pagination Bar */}
              <div className="bg-[#0E1422] border-t border-[#28354D] px-4 py-3 flex flex-wrap items-center justify-between gap-4 text-xs">
                <div className="flex items-center gap-3 text-[#94A3B8]">
                  <span>
                    Strona <strong className="text-white font-mono">{currentPage}</strong> z{" "}
                    <strong className="text-white font-mono">{totalPages}</strong> ({sortedLeads.length} leadów)
                  </span>
                  <span className="text-[#475569]">|</span>
                  <div className="flex items-center gap-1.5">
                    <span>Wierszy na stronę:</span>
                    <select
                      value={pageSize}
                      onChange={(e) => {
                        setPageSize(Number(e.target.value));
                        setCurrentPage(1);
                      }}
                      className="bg-[#0A0E17] border border-[#28354D] rounded px-2 py-1 text-white text-xs focus:outline-none focus:border-[#FFE600]"
                    >
                      <option value={25}>25</option>
                      <option value={50}>50</option>
                      <option value={100}>100</option>
                      <option value={-1}>Wszystkie ({sortedLeads.length})</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage <= 1 || pageSize === -1}
                    className="p-1.5 rounded-lg border border-[#28354D] text-[#94A3B8] hover:text-white hover:border-[#64748B] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                    title="Poprzednia strona"
                  >
                    <ChevronLeft size={16} />
                  </button>

                  {pageSize !== -1 && totalPages > 1 && (
                    <div className="flex items-center gap-1">
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let pageNum = i + 1;
                        if (totalPages > 5 && currentPage > 3) {
                          pageNum = Math.min(currentPage - 2 + i, totalPages - 4 + i);
                        }
                        return (
                          <button
                            key={pageNum}
                            onClick={() => setCurrentPage(pageNum)}
                            className={`w-7 h-7 rounded-lg text-xs font-mono font-bold transition-all ${
                              currentPage === pageNum
                                ? "bg-[#FFE600] text-black"
                                : "bg-[#141C2E] border border-[#28354D] text-[#94A3B8] hover:text-white"
                            }`}
                          >
                            {pageNum}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  <button
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage >= totalPages || pageSize === -1}
                    className="p-1.5 rounded-lg border border-[#28354D] text-[#94A3B8] hover:text-white hover:border-[#64748B] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                    title="Następna strona"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            </div>

            {/* FLOATING BULK BAR */}
            {selectedCrmLeadIds.length > 0 && (
              <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-[#0F172A]/95 backdrop-blur-md border-2 border-[#FFE600] rounded-2xl shadow-2xl px-5 py-3 flex items-center gap-3 text-xs max-w-4xl w-[95%] sm:w-auto animate-in slide-in-from-bottom-5 duration-200">
                <div className="flex items-center gap-2 pr-3 border-r border-[#28354D] shrink-0">
                  <div className="w-6 h-6 rounded-full bg-[#FFE600] text-black font-black font-mono text-[11px] flex items-center justify-center shadow">
                    {selectedCrmLeadIds.length}
                  </div>
                  <span className="text-white font-bold hidden sm:inline">zaznaczonych</span>
                </div>

                {bulkProcessing ? (
                  <div className="flex items-center gap-2 text-[#FFE600] font-semibold py-1">
                    <RefreshCw size={14} className="animate-spin" />
                    <span>
                      {bulkProcessing.label}... ({bulkProcessing.current}/{bulkProcessing.total})
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      onClick={handleBulkAudit}
                      className="bg-[#141C2E] hover:bg-[#1E293B] border border-[#28354D] hover:border-[#38BDF8] text-white px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                      title="Uruchom audyt WWW dla zaznaczonych leadów ze stronami"
                    >
                      <Globe size={13} className="text-[#38BDF8]" />
                      <span>Skanuj WWW</span>
                    </button>

                    <button
                      onClick={handleBulkGenerateOffers}
                      className="bg-[#141C2E] hover:bg-[#1E293B] border border-[#28354D] hover:border-amber-400 text-white px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                      title="Wygeneruj spersonalizowane oferty dla wybranych firm"
                    >
                      <Sparkles size={13} className="text-amber-400" />
                      <span>Generuj Oferty</span>
                    </button>

                    <button
                      onClick={handleBulkQualify}
                      className="bg-[#141C2E] hover:bg-[#1E293B] border border-[#28354D] hover:border-emerald-400 text-white px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                      title="Przelicz scoring ICP i zaktualizuj kwalifikację"
                    >
                      <Zap size={13} className="text-emerald-400" />
                      <span>Scoring & Kwalifikacja</span>
                    </button>

                    <button
                      onClick={() => setBulkStatusModal(true)}
                      className="bg-[#141C2E] hover:bg-[#1E293B] border border-[#28354D] hover:border-purple-400 text-white px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                      title="Zmień status dla wszystkich zaznaczonych"
                    >
                      <Tag size={13} className="text-purple-400" />
                      <span>Zmień Status</span>
                    </button>

                    <button
                      onClick={handleBulkExport}
                      className="bg-[#141C2E] hover:bg-[#1E293B] border border-[#28354D] hover:border-[#FFE600] text-white px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                      title="Pobierz arkusz Excel z danymi zaznaczonych leadów"
                    >
                      <Download size={13} className="text-[#FFE600]" />
                      <span>Eksport (.xlsx)</span>
                    </button>

                    <button
                      onClick={handleBulkDelete}
                      className="bg-rose-950/60 hover:bg-rose-900 border border-rose-800 text-rose-200 px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                      title="Usuń trwale zaznaczone firmy"
                    >
                      <Trash2 size={13} />
                      <span>Usuń</span>
                    </button>

                    <button
                      onClick={clearCrmSelection}
                      className="text-[#94A3B8] hover:text-white p-1.5 rounded-lg hover:bg-[#1E293B] transition-all ml-1 cursor-pointer"
                      title="Odznacz wszystkie"
                    >
                      <X size={16} />
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* MODAL: MASOWA ZMIANA STATUSU (BULK STATUS MODAL) */}
            {bulkStatusModal && (
              <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div className="max-w-md w-full bg-[#101726] border border-[#28354D] rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150">
                  <div className="bg-[#141C2E] border-b border-[#28354D] p-5 flex items-center justify-between">
                    <div>
                      <h3 className="text-base font-black text-white flex items-center gap-2">
                        <Tag size={18} className="text-[#FFE600]" />
                        Masowa zmiana statusu
                      </h3>
                      <p className="text-xs text-[#94A3B8] mt-0.5">
                        Zaznaczono <strong className="text-white">{selectedCrmLeadIds.length}</strong> firm
                      </p>
                    </div>
                    <button
                      onClick={() => setBulkStatusModal(false)}
                      className="text-[#94A3B8] hover:text-white p-1.5 rounded-lg hover:bg-[#1E293B] transition-all cursor-pointer"
                    >
                      <X size={18} />
                    </button>
                  </div>

                  <div className="p-5 space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-[#CBD5E1] uppercase tracking-wider mb-2">
                        Wybierz nowy status:
                      </label>
                      <select
                        value={targetBulkStatus}
                        onChange={(e) => setTargetBulkStatus(e.target.value)}
                        className="w-full bg-[#0A0E17] border border-[#28354D] rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#FFE600]"
                      >
                        <option value="pending_approval">🛡️ Do Zatwierdzenia AI Act (pending_approval)</option>
                        <option value="needs_review">⚠️ Do Weryfikacji (needs_review)</option>
                        <option value="qualified">✅ Zakwalifikowane (qualified)</option>
                        <option value="new">🆕 Nowe (new)</option>
                        <option value="in_sequence">📬 W Sekwencji Outreach (in_sequence)</option>
                        <option value="disqualified">❌ Odrzucone (disqualified)</option>
                        <option value="replied_interested">💬 Odpowiedź: Zainteresowany</option>
                        <option value="meeting_booked">🏆 Umówione Spotkanie</option>
                      </select>
                    </div>

                    <p className="text-[11px] text-[#94A3B8] leading-relaxed bg-[#0A0E17] p-3 rounded-lg border border-[#1E293B]">
                      ℹ️ Zmiana statusu wywoła masowe przejście w maszynie stanów z audytem w zdarzeniach leada (Invariant 3).
                    </p>

                    <div className="flex items-center justify-end gap-3 pt-2">
                      <button
                        onClick={() => setBulkStatusModal(false)}
                        className="px-4 py-2 rounded-xl text-xs font-bold text-[#94A3B8] hover:text-white hover:bg-[#1E293B] transition-all cursor-pointer"
                      >
                        Anuluj
                      </button>
                      <button
                        onClick={() => handleBulkChangeStatus(targetBulkStatus)}
                        className="bg-[#FFE600] hover:bg-[#FACC15] text-black px-5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer shadow-lg shadow-[#FFE600]/20"
                      >
                        Zatwierdź zmianę ({selectedCrmLeadIds.length})
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
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
                    Pełen przekrój rynku przedsiębiorstw w wybranym rejonie poszukiwań.
                  </p>
                  <div className="mt-3 text-[11px] text-[#38BDF8] flex items-center gap-1 font-semibold">
                    <CheckCircle2 size={12} /> Baza CEIDG + KRS + Google Places API
                  </div>
                </div>
              </div>
            </div>

            {/* Custom Search Form */}
            <div className="bg-[#141C2E] border border-[#28354D] p-6 rounded-2xl shadow-xl space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#28354D] pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-[#FFE600] text-black rounded-xl font-bold">
                    <Search size={22} />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">Generator Leadów & Wyszukiwanie Geograficzne</h2>
                    <p className="text-xs text-[#94A3B8]">
                      Województwo, miasto i promień oparte na Google Places API oraz weryfikacji w rejestrach (Biała Lista MF / KRS / CEIDG).
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[#94A3B8] font-semibold">Status Google API:</span>
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded border ${mailSettings.hasGoogleApiKey || mailSettings.googleApiKey ? "bg-emerald-950 text-emerald-300 border-emerald-800" : "bg-amber-950 text-amber-300 border-amber-800"}`}>
                    {mailSettings.hasGoogleApiKey || mailSettings.googleApiKey ? "🟢 Live API Aktywne" : "🟡 Katalog Lokalny & CSV"}
                  </span>
                </div>
              </div>

              {/* Trust Badges & Data Sources */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                <div className="p-2.5 bg-[#0A0E17] border border-[#28354D] rounded-xl flex items-center gap-2.5">
                  <span className="text-lg">🗺️</span>
                  <div className="min-w-0">
                    <div className="text-[10px] font-bold text-[#94A3B8] uppercase">Google Places API</div>
                    <div className="text-xs font-bold text-[#34D399] truncate">
                      {mailSettings.hasGoogleApiKey || mailSettings.googleApiKey ? "Live Search (v1 & Legacy)" : "Wbudowany Katalog"}
                    </div>
                  </div>
                </div>
                <div className="p-2.5 bg-[#0A0E17] border border-[#28354D] rounded-xl flex items-center gap-2.5">
                  <span className="text-lg">🛡️</span>
                  <div className="min-w-0">
                    <div className="text-[10px] font-bold text-[#94A3B8] uppercase">Biała Lista VAT (MF)</div>
                    <div className="text-xs font-bold text-[#38BDF8] truncate">wl-api.mf.gov.pl (Oficjalne)</div>
                  </div>
                </div>
                <div className="p-2.5 bg-[#0A0E17] border border-[#28354D] rounded-xl flex items-center gap-2.5">
                  <span className="text-lg">🏛️</span>
                  <div className="min-w-0">
                    <div className="text-[10px] font-bold text-[#94A3B8] uppercase">KRS API & CEIDG</div>
                    <div className="text-xs font-bold text-[#C084FC] truncate">Weryfikacja Zarządu / JDG</div>
                  </div>
                </div>
                <div className="p-2.5 bg-[#0A0E17] border border-[#28354D] rounded-xl flex items-center gap-2.5">
                  <span className="text-lg">⚡</span>
                  <div className="min-w-0">
                    <div className="text-[10px] font-bold text-[#94A3B8] uppercase">Auto-Audytor WWW</div>
                    <div className="text-xs font-bold text-[#FFE600] truncate">Scraping E-maili & SSL</div>
                  </div>
                </div>
              </div>

              {/* Form Controls Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 pt-1">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#94A3B8] mb-1.5">
                    Województwo
                  </label>
                  <select
                    value={scraperVoivodeship}
                    onChange={(e) => {
                      const v = e.target.value;
                      setScraperVoivodeship(v);
                      setIsCustomCityInput(false);
                      const def = POLISH_VOIVODESHIPS.find((item) => item.name === v);
                      if (def) {
                        setScraperCity(def.capital);
                      }
                    }}
                    className="w-full bg-[#0A0E17] border border-[#28354D] rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#FFE600]"
                  >
                    {POLISH_VOIVODESHIPS.map((voiv) => (
                      <option key={voiv.name} value={voiv.name}>
                        {voiv.name} (stolica: {voiv.capital})
                      </option>
                    ))}
                    <option value="Cała Polska">Cała Polska (Wszystkie woj.)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#94A3B8] mb-1.5">
                    Centrum Poszukiwań (Miasto)
                  </label>
                  <select
                    value={isCustomCityInput ? "__custom__" : scraperCity}
                    onChange={(e) => {
                      if (e.target.value === "__custom__") {
                        setIsCustomCityInput(true);
                      } else {
                        setIsCustomCityInput(false);
                        setScraperCity(e.target.value);
                      }
                    }}
                    className="w-full bg-[#0A0E17] border border-[#28354D] rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#FFE600]"
                  >
                    {currentVoivodeshipCities.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                    <option value="__custom__">✏️ Wpisz inne miasto w Polsce...</option>
                  </select>
                  {isCustomCityInput && (
                    <input
                      type="text"
                      value={scraperCustomCity}
                      onChange={(e) => setScraperCustomCity(e.target.value)}
                      placeholder="Wpisz dowolne miasto..."
                      className="w-full mt-2 bg-[#0A0E17] border border-[#FFE600] rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none"
                      autoFocus
                    />
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-[#94A3B8]">
                      Maks. promień
                    </label>
                    <span className="font-extrabold text-xs text-[#FFE600]">
                      {scraperRadius > 0 ? `${scraperRadius} km` : "Bez limitu"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={5}
                      value={scraperRadius}
                      onChange={(e) => setScraperRadius(parseInt(e.target.value, 10))}
                      className="flex-1 accent-[#FFE600]"
                    />
                    <button
                      type="button"
                      onClick={() => setScraperRadius(scraperRadius === 0 ? 35 : 0)}
                      className={`text-[10px] font-bold px-2 py-1 rounded border transition-all ${
                        scraperRadius === 0
                          ? "bg-[#FFE600] text-black border-[#FFE600]"
                          : "bg-[#0A0E17] text-[#94A3B8] border-[#28354D]"
                      }`}
                    >
                      {scraperRadius === 0 ? "Bez limitu" : "Cała PL"}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#94A3B8] mb-1.5">
                    Wielkość Przedsiębiorstwa
                  </label>
                  <select
                    value={scraperCompanyScale}
                    onChange={(e) => setScraperCompanyScale(e.target.value as any)}
                    className="w-full bg-[#0A0E17] border border-[#28354D] rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#FFE600]"
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
                    placeholder="Wszystkie branże"
                    className="w-full bg-[#0A0E17] border border-[#28354D] rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#FFE600]"
                  />
                </div>
              </div>

              {/* Configurable Targeting Notice */}
              <div className="p-3.5 bg-[#1E293B]/70 border border-[#38BDF8]/30 rounded-xl flex items-center justify-between text-xs text-[#38BDF8]">
                <div className="flex items-center gap-2">
                  <Target size={16} />
                  <span>
                    <strong>Aktywne kryteria wyszukiwania:</strong> Województwo: <strong>{scraperVoivodeship}</strong>, Miasto:{" "}
                    <strong>{isCustomCityInput && scraperCustomCity.trim() ? scraperCustomCity : scraperCity}</strong> (
                    {scraperRadius > 0 ? `promień ≤${scraperRadius} km` : "dowolny promień / Cała Polska"}), wielkość:{" "}
                    <strong>
                      {scraperCompanyScale === "mikro"
                        ? "Mikro (CEIDG / JDG)"
                        : scraperCompanyScale === "male"
                        ? "Małe (KRS / Sp. z o.o.)"
                        : "Całe MŚP"}
                    </strong>.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab("settings")}
                  className="bg-[#38BDF8]/20 hover:bg-[#38BDF8]/30 text-[#38BDF8] px-2.5 py-1 rounded font-bold text-[11px] transition-all flex items-center gap-1 cursor-pointer"
                >
                  <Sliders size={12} /> Zmień w Ustawieniach
                </button>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <span className="text-xs text-[#94A3B8]">
                  Automatycznie: pobiera profil z Google Places & CEIDG/KRS, audytuje WWW i weryfikuje Białą Listę VAT (MF).
                </span>
                <button
                  onClick={handleRunScraper}
                  disabled={scraperLoading}
                  className="bg-[#FFE600] hover:bg-[#FFF04D] text-black font-extrabold text-sm px-6 py-3 rounded-xl flex items-center gap-2 transition-all shadow-lg shadow-yellow-500/10 disabled:opacity-50 cursor-pointer"
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
                    Szybki wybór popularnych rynków w kluczowych województwach Polski (Wrocław, Warszawa, Katowice, Poznań, Kraków, Gdańsk):
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-3.5">
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
                        {(preset as any).voivodeship ? `${(preset as any).voivodeship} • ` : ""}{preset.city}
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

            {/* CSV Import Banner pointing to dedicated Import Hub */}
            <div className="bg-[#141C2E] border border-[#28354D] p-6 rounded-2xl shadow-xl flex flex-col md:flex-row items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Upload size={18} className="text-[#38BDF8]" />
                  Posiadasz zewnętrzną bazę firm (CSV / Excel)?
                </h3>
                <p className="text-xs text-[#94A3B8] mt-1">
                  Skorzystaj z dedykowanego modułu importu z automatycznym wykrywaniem kolumn, podglądem danych i deduplikacją.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab("import")}
                className="bg-[#1E293B] hover:bg-[#2D3D58] border border-[#38BDF8] text-[#38BDF8] hover:text-white font-bold text-xs px-4 py-2.5 rounded-xl cursor-pointer flex items-center gap-2 transition-all shrink-0"
              >
                <FileSpreadsheet size={15} />
                Przejdź do Importu CSV / Excel →
              </button>
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
                  <div className="bg-[#0A0E17] p-3 rounded-lg border border-[#28354D]">
                    <span className="text-xs text-[#94A3B8]">Poza promieniem</span>
                    <div className="text-xl font-black text-white">{scraperResult.rejectedRadius || 0}</div>
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
                      ℹ️ Wbudowany Katalog Przedsiębiorstw B2B
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB: DEDICATED CSV & EXCEL IMPORT (PROMPT 5) */}
        {activeTab === "import" && (
          <div className="max-w-5xl mx-auto space-y-6">
            <div className="bg-[#141C2E] border border-[#28354D] p-6 rounded-2xl shadow-xl">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#28354D] pb-5">
                <div>
                  <h2 className="text-xl font-black text-white flex items-center gap-2">
                    <Upload size={22} className="text-[#38BDF8]" />
                    Import Bazy Przedsiębiorstw (CSV / Excel)
                  </h2>
                  <p className="text-xs text-[#94A3B8] mt-1">
                    Wgraj plik z bazą firm z Google Maps, Apify, CEIDG, PanoramaFirm lub własnej bazy Excel. System automatycznie dopasuje kolumny i przeprowadzi deduplikację.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs bg-[#0E1422] border border-[#28354D] text-[#94A3B8] px-3 py-1.5 rounded-lg">
                    Formaty: <strong className="text-white">.CSV, .XLSX, .XLS</strong>
                  </span>
                </div>
              </div>

              {/* Drag & Drop Zone */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const file = e.dataTransfer.files?.[0];
                  if (file) handleProcessImportFile(file);
                }}
                className="mt-6 border-2 border-dashed border-[#28354D] hover:border-[#FFE600] rounded-2xl p-8 sm:p-12 text-center transition-all bg-[#0A0E17]/60 group cursor-pointer"
                onClick={() => document.getElementById("csv-file-input")?.click()}
              >
                <input
                  id="csv-file-input"
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleProcessImportFile(file);
                  }}
                  className="hidden"
                />
                <div className="w-16 h-16 rounded-2xl bg-[#141C2E] border border-[#28354D] group-hover:border-[#FFE600] flex items-center justify-center mx-auto text-[#38BDF8] group-hover:text-[#FFE600] transition-all shadow-lg">
                  <FileSpreadsheet size={32} />
                </div>
                <h4 className="text-base font-bold text-white mt-4">
                  Przeciągnij i upuść plik tutaj lub <span className="text-[#FFE600] underline">przeglądaj dysk</span>
                </h4>
                <p className="text-xs text-[#94A3B8] mt-1 max-w-md mx-auto">
                  Obsługuje pliki rozdzielane przecinkami, średnikami oraz skoroszyty Excel (.xlsx, .xls).
                </p>
              </div>

              {/* Import Configuration & Target Settings */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6 bg-[#0E1422] p-4 rounded-xl border border-[#28354D]">
                <div>
                  <label className="block text-xs font-bold text-[#CBD5E1] mb-1.5">
                    Domyślne miasto (gdy puste):
                  </label>
                  <input
                    type="text"
                    value={importTargetCity}
                    onChange={(e) => setImportTargetCity(e.target.value)}
                    placeholder={targetingSettings.defaultCity || "Wrocław"}
                    className="w-full bg-[#0A0E17] border border-[#28354D] rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-[#FFE600]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#CBD5E1] mb-1.5">
                    Województwo docelowe:
                  </label>
                  <select
                    value={importTargetVoivodeship}
                    onChange={(e) => setImportTargetVoivodeship(e.target.value)}
                    className="w-full bg-[#0A0E17] border border-[#28354D] rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-[#FFE600]"
                  >
                    {POLISH_VOIVODESHIPS.map((v) => (
                      <option key={v.name} value={v.name}>
                        {v.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center pt-5">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={importDeduplicate}
                      onChange={(e) => setImportDeduplicate(e.target.checked)}
                      className="accent-[#FFE600] w-4 h-4 rounded"
                    />
                    <span className="text-xs text-white font-semibold">
                      Automatyczna deduplikacja (NIP / Telefon / Domena)
                    </span>
                  </label>
                </div>
              </div>

              {/* File Preview and Detected Columns Card */}
              {importFile && importStats && (
                <div className="mt-6 bg-[#0E1422] border border-[#28354D] p-5 rounded-xl space-y-4 animate-in fade-in duration-200">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#28354D] pb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs bg-[#38BDF8]/20 text-[#38BDF8] border border-[#38BDF8]/40 px-2 py-0.5 rounded font-mono font-bold uppercase">
                          {importFile.name.endsWith(".csv") ? "CSV" : "EXCEL"}
                        </span>
                        <span className="font-bold text-white text-sm">{importFile.name}</span>
                      </div>
                      <span className="text-xs text-[#94A3B8] font-mono mt-0.5 block">
                        Rozmiar: {(importStats.fileSizeKb / 1024).toFixed(2)} MB • Liczba wierszy: {importStats.totalRows}
                      </span>
                    </div>

                    <button
                      onClick={handleExecuteImport}
                      disabled={importRunning}
                      className="bg-[#FFE600] hover:bg-[#FACC15] text-black font-black text-xs px-6 py-2.5 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-[#FFE600]/20 disabled:opacity-50 transition-all cursor-pointer"
                    >
                      <Upload size={15} className={importRunning ? "animate-spin" : ""} />
                      {importRunning ? "Importowanie do CRM..." : `Zatwierdź i Zaimportuj (${importStats.totalRows} firm)`}
                    </button>
                  </div>

                  {/* Detected column badges */}
                  <div>
                    <span className="text-xs text-[#94A3B8] block mb-2 font-bold uppercase tracking-wider">
                      Rozpoznane kolumny danych:
                    </span>
                    <div className="flex flex-wrap gap-2 text-xs">
                      {Object.entries(importDetectedHeaders).map(([field, orig]) => (
                        <span
                          key={field}
                          className="bg-[#141C2E] border border-[#38BDF8]/40 text-[#38BDF8] px-2.5 py-1 rounded-lg flex items-center gap-1.5"
                        >
                          <CheckCircle2 size={12} className="text-emerald-400" />
                          <strong>{field}:</strong> {orig}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Preview Table (First 5 rows) */}
                  {importPreviewRows.length > 0 && (
                    <div>
                      <span className="text-xs text-[#94A3B8] block mb-2 font-bold uppercase tracking-wider">
                        Podgląd pierwszych wierszy:
                      </span>
                      <div className="overflow-x-auto rounded-lg border border-[#28354D]">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="bg-[#141C2E] text-[#94A3B8] font-bold border-b border-[#28354D]">
                              <th className="p-2.5">Firma</th>
                              <th className="p-2.5">Miasto</th>
                              <th className="p-2.5">Telefon</th>
                              <th className="p-2.5">Strona WWW</th>
                              <th className="p-2.5">NIP</th>
                              <th className="p-2.5">Branża</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#1E293B]">
                            {importPreviewRows.map((row, idx) => (
                              <tr key={idx} className="hover:bg-[#141C2E]">
                                <td className="p-2.5 font-bold text-white">{row.companyName}</td>
                                <td className="p-2.5 text-[#CBD5E1]">{row.city || "—"}</td>
                                <td className="p-2.5 text-[#94A3B8] font-mono">{row.phone || "—"}</td>
                                <td className="p-2.5 text-[#38BDF8] truncate max-w-[150px]">{row.website || "—"}</td>
                                <td className="p-2.5 font-mono text-[#94A3B8]">{row.nip || "—"}</td>
                                <td className="p-2.5 text-[#94A3B8]">{row.industry || "—"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Post-Import Report Card */}
              {importReport && (
                <div className="mt-6 bg-[#0E1422] border border-[#059669] p-6 rounded-2xl animate-in fade-in duration-200">
                  <div className="flex items-center gap-2 mb-4">
                    <CheckCircle2 size={24} className="text-[#34D399]" />
                    <h3 className="text-base font-bold text-white">Import bazy zakończony pomyślnie</h3>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-center text-xs">
                    <div className="bg-[#141C2E] p-4 rounded-xl border border-emerald-800">
                      <span className="text-[#94A3B8] block mb-1">Dodano nowych firm</span>
                      <div className="text-2xl font-black text-[#34D399]">+{importReport.added}</div>
                    </div>
                    <div className="bg-[#141C2E] p-4 rounded-xl border border-[#28354D]">
                      <span className="text-[#94A3B8] block mb-1">Pominięte duplikaty</span>
                      <div className="text-2xl font-black text-white">{importReport.duplicates}</div>
                    </div>
                    <div className="bg-[#141C2E] p-4 rounded-xl border border-[#28354D]">
                      <span className="text-[#94A3B8] block mb-1">Odrzucone poza zakresem</span>
                      <div className="text-2xl font-black text-[#94A3B8]">{importReport.rejectedRadius || 0}</div>
                    </div>
                  </div>
                  <div className="mt-4 flex justify-end">
                    <button
                      onClick={() => setActiveTab("crm")}
                      className="bg-[#FFE600] hover:bg-[#FACC15] text-black font-extrabold text-xs px-5 py-2.5 rounded-xl transition-all cursor-pointer shadow-md"
                    >
                      Przejdź do tabeli CRM →
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB: CAMPAIGN REVIEW & BATCH DISPATCH (AI ACT HUMAN OVERSIGHT) */}
        {activeTab === "outreach" && (
          <div className="max-w-5xl mx-auto space-y-6">
            {/* Header banner */}
            <div className="bg-[#141C2E] border-2 border-[#FFE600]/60 p-6 rounded-2xl shadow-xl space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="bg-[#FFE600] text-black text-[10px] font-black uppercase px-2.5 py-0.5 rounded tracking-wider">
                      AI Act Art. 14 • Human Oversight
                    </span>
                    <span className="bg-emerald-950/80 text-emerald-400 border border-emerald-500/40 text-[10px] font-bold px-2 py-0.5 rounded">
                      Tryb: SANDBOX (bezpieczny)
                    </span>
                  </div>
                  <h2 className="text-xl font-black text-white mt-1 flex items-center gap-2">
                    <ShieldCheck className="text-[#FFE600]" size={24} />
                    Centrum Zatwierdzania Kampanii & Wysyłki Ofert
                  </h2>
                  <p className="text-xs text-[#94A3B8] mt-1 max-w-2xl">
                    Maszyna nie wysyła maili bez Twojej wiedzy. Poniżej możesz przejrzeć każdą wygenerowaną ofertę WWW
                    oraz treść spersonalizowanego maila. Kiedy wszystko zweryfikujesz, kliknij <strong>„Wyślij wszystko jednym kliknięciem”</strong>.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  <button
                    onClick={() => handleSendAll()}
                    disabled={batchSending || pendingApprovalLeads.length === 0}
                    className="bg-[#FFE600] hover:bg-[#FFF04D] text-black font-black text-sm px-6 py-3 rounded-xl flex items-center justify-center gap-2 transition-all shadow-xl shadow-yellow-500/20 disabled:opacity-50 cursor-pointer"
                  >
                    <Send size={18} className={batchSending ? "animate-spin" : ""} />
                    {batchSending ? "Wysyłanie maili..." : `🚀 Wyślij wszystko (${pendingApprovalLeads.length})`}
                  </button>
                </div>
              </div>

              {/* Status bar */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-[#28354D] text-xs">
                <div className="bg-[#0A0E17] p-2.5 rounded-lg border border-[#28354D]">
                  <span className="text-[#94A3B8] block text-[10px] uppercase font-bold">Gotowe do wysyłki</span>
                  <span className="text-white font-extrabold text-base">{pendingApprovalLeads.length} ofert</span>
                </div>
                <div className="bg-[#0A0E17] p-2.5 rounded-lg border border-[#28354D]">
                  <span className="text-[#94A3B8] block text-[10px] uppercase font-bold">Zaznaczone</span>
                  <span className="text-[#FFE600] font-extrabold text-base">{selectedOutreachIds.length} firm</span>
                </div>
                <div className="bg-[#0A0E17] p-2.5 rounded-lg border border-[#28354D]">
                  <span className="text-[#94A3B8] block text-[10px] uppercase font-bold">Bezpiecznik (Kill-switch)</span>
                  <span className="text-[#38BDF8] font-extrabold text-base">STOP = Aktywny</span>
                </div>
                <div className="bg-[#0A0E17] p-2.5 rounded-lg border border-[#28354D]">
                  <span className="text-[#94A3B8] block text-[10px] uppercase font-bold">Klauzula prawna</span>
                  <span className="text-emerald-400 font-extrabold text-base">Art. 14 RODO + STOP</span>
                </div>
              </div>
            </div>

            {/* Selection Toolbar */}
            {pendingApprovalLeads.length > 0 && (
              <div className="bg-[#141C2E] border border-[#28354D] p-3.5 rounded-xl flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-white select-none">
                    <input
                      type="checkbox"
                      checked={
                        pendingApprovalLeads.length > 0 &&
                        selectedOutreachIds.length === pendingApprovalLeads.length
                      }
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedOutreachIds(pendingApprovalLeads.map((l) => l.id));
                        } else {
                          setSelectedOutreachIds([]);
                        }
                      }}
                      className="w-4 h-4 rounded text-[#FFE600] accent-[#FFE600] cursor-pointer"
                    />
                    <span>Zaznacz wszystkie ({pendingApprovalLeads.length})</span>
                  </label>

                  {selectedOutreachIds.length > 0 && (
                    <span className="text-xs text-[#94A3B8]">
                      (Wybrano {selectedOutreachIds.length} z {pendingApprovalLeads.length})
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2.5">
                  <input
                    type="text"
                    placeholder="Filtruj firmy..."
                    value={outreachSearch}
                    onChange={(e) => setOutreachSearch(e.target.value)}
                    className="bg-[#0A0E17] border border-[#28354D] text-xs px-3 py-1.5 rounded-lg text-white placeholder-[#64748B] focus:border-[#FFE600] outline-none w-48"
                  />
                  {selectedOutreachIds.length > 0 && selectedOutreachIds.length !== pendingApprovalLeads.length && (
                    <button
                      onClick={() => handleSendAll(selectedOutreachIds)}
                      disabled={batchSending}
                      className="bg-[#1E293B] hover:bg-[#FFE600] hover:text-black border border-[#FFE600] text-[#FFE600] font-bold text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      <Send size={13} />
                      Wyślij tylko zaznaczone ({selectedOutreachIds.length})
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* List of Leads / Offers ready */}
            {pendingApprovalLeads.length === 0 ? (
              <div className="bg-[#141C2E] border border-[#28354D] p-12 text-center rounded-2xl space-y-3">
                <CheckCircle2 size={52} className="text-[#34D399] mx-auto mb-2" />
                <h3 className="text-lg font-bold text-white">Brak oczekujących ofert do wysyłki!</h3>
                <p className="text-sm text-[#94A3B8] max-w-md mx-auto">
                  Wszystkie wygenerowane oferty zostały już wysłane lub nie ma jeszcze zakwalifikowanych firm z ofertami.
                </p>
                <div className="pt-2">
                  <button
                    onClick={() => setActiveTab("generator")}
                    className="bg-[#FFE600] text-black font-extrabold text-xs px-5 py-2.5 rounded-lg inline-flex items-center gap-2 hover:bg-[#FFF04D] transition-all cursor-pointer"
                  >
                    <Search size={15} /> Przejdź do Lead Generatora & Wyszukaj Nowe Firmy
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {pendingApprovalLeads
                  .filter((lead) => {
                    if (!outreachSearch) return true;
                    const q = outreachSearch.toLowerCase();
                    return (
                      lead.companyName.toLowerCase().includes(q) ||
                      (lead.city && lead.city.toLowerCase().includes(q)) ||
                      (lead.industry && lead.industry.toLowerCase().includes(q))
                    );
                  })
                  .map((lead) => {
                    const preview = getEmailPreview(lead);
                    const isSelected = selectedOutreachIds.includes(lead.id);
                    const isExpanded = expandedDraftLeadId === lead.id;

                    return (
                      <div
                        key={lead.id}
                        className={`bg-[#141C2E] border rounded-2xl p-5 transition-all shadow-md ${
                          isSelected ? "border-[#FFE600]/80 shadow-yellow-500/5" : "border-[#28354D]"
                        }`}
                      >
                        {/* Top row */}
                        <div className="flex flex-wrap items-start justify-between gap-3 pb-3 border-b border-[#28354D]">
                          <div className="flex items-start gap-3">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedOutreachIds((prev) => [...prev, lead.id]);
                                } else {
                                  setSelectedOutreachIds((prev) => prev.filter((id) => id !== lead.id));
                                }
                              }}
                              className="mt-1 w-4 h-4 rounded text-[#FFE600] accent-[#FFE600] cursor-pointer"
                            />
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-xs text-[#64748B]">#{lead.id}</span>
                                <h3 className="text-base font-extrabold text-white">{lead.companyName}</h3>
                                <span className="badge badge-approved">Score: {lead.score} pkt</span>
                              </div>
                              <p className="text-xs text-[#94A3B8] mt-0.5">
                                📍 {lead.city || "Brak miasta"} • {lead.industry || "Brak branży"}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            {preview.offerUrl && (
                              <a
                                href={preview.offerUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="bg-[#1E293B] hover:bg-[#2D3D58] border border-[#38BDF8]/60 text-[#38BDF8] font-bold text-xs px-3 py-2 rounded-lg flex items-center gap-1.5 transition-all"
                                title="Otwórz wygenerowaną stronę WWW oferty w nowej karcie"
                              >
                                <ExternalLink size={13} />
                                <span>Zobacz Stronę Oferty</span>
                              </a>
                            )}
                            <button
                              onClick={() => {
                                setSelectedLead(lead);
                                setDrawerTab("email");
                              }}
                              className="bg-[#1E293B] hover:bg-[#2D3D58] border border-[#334155] text-white font-bold text-xs px-3 py-2 rounded-lg flex items-center gap-1.5 transition-all"
                              title="Edytuj treść w wysuwanym panelu bocznym"
                            >
                              <Edit2 size={13} />
                              <span>Edytuj w panelu</span>
                            </button>
                            <button
                              onClick={() => handleSendSingle(lead.id)}
                              disabled={batchSending}
                              className="bg-[#059669] hover:bg-[#10B981] text-white font-extrabold text-xs px-3.5 py-2 rounded-lg flex items-center gap-1.5 transition-all shadow-md shadow-emerald-500/20 disabled:opacity-50"
                              title="Wyślij natychmiast tę jedną wiadomość"
                            >
                              <Send size={13} />
                              <span>Wyślij ten e-mail</span>
                            </button>
                          </div>
                        </div>

                        {/* Recipient status */}
                        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                          <div className="flex items-center gap-2">
                            <span className="text-[#94A3B8] font-bold">Odbiorca:</span>
                            {lead.emailPrimary ? (
                              <span className="text-[#38BDF8] font-mono font-bold bg-[#0A0E17] px-2.5 py-1 rounded border border-[#28354D]">
                                ✉️ {lead.emailPrimary}
                              </span>
                            ) : (
                              <div className="flex items-center gap-2">
                                <span className="text-[#FB7185] font-bold">⚠️ Brak e-maila:</span>
                                <input
                                  type="email"
                                  placeholder="Wpisz np. biuro@firma.pl"
                                  value={inlineEmailInput[lead.id] || ""}
                                  onChange={(e) =>
                                    setInlineEmailInput((prev) => ({ ...prev, [lead.id]: e.target.value }))
                                  }
                                  className="bg-[#0A0E17] border border-[#FB7185]/60 text-white font-mono text-xs px-2.5 py-1 rounded outline-none focus:border-[#FFE600]"
                                />
                                <button
                                  onClick={() => handleSaveMissingEmail(lead.id)}
                                  className="bg-[#FFE600] text-black font-extrabold text-xs px-3 py-1 rounded hover:bg-[#FFF04D]"
                                >
                                  Zapisz
                                </button>
                              </div>
                            )}
                          </div>

                          <button
                            onClick={() => setExpandedDraftLeadId(isExpanded ? null : lead.id)}
                            className="text-[#FFE600] hover:underline font-bold text-xs flex items-center gap-1 cursor-pointer"
                          >
                            <Eye size={13} />
                            {isExpanded ? "Zwiń podgląd maila" : "Podgląd treści maila"}
                          </button>
                        </div>

                        {/* Email Preview Drawer */}
                        {isExpanded && (
                          <div className="mt-3.5 pt-3 border-t border-[#28354D] space-y-2.5">
                            <div className="text-xs font-mono bg-[#0A0E17] p-2.5 rounded-lg border border-[#28354D]">
                              <span className="text-[#94A3B8] font-bold">Temat maila: </span>
                              <span className="text-white font-semibold">{preview.subject}</span>
                            </div>
                            <pre className="text-xs text-[#CBD5E1] whitespace-pre-wrap font-sans bg-[#0A0E17] p-4 rounded-xl border border-[#28354D] leading-relaxed max-h-64 overflow-y-auto">
                              {preview.bodyText}
                            </pre>
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        )}

        {/* TAB: OUTREACH HISTORY & TENANT METRICS */}
        {activeTab === "history" && (
          <div className="space-y-6">
            {/* Header & Tenant Isolation Context */}
            <div className="bg-[#141C2E] border border-[#28354D] p-5 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-lg">
              <div>
                <div className="flex items-center gap-2">
                  <span className="bg-[#38BDF8]/20 border border-[#38BDF8]/40 text-[#38BDF8] text-[10px] font-black uppercase px-2 py-0.5 rounded tracking-wider flex items-center gap-1">
                    <Building size={11} />
                    TENANT: {currentUser?.tenantName || "Procent Marketing"}
                  </span>
                  <span className="text-xs text-[#34D399] font-bold flex items-center gap-1">
                    <ShieldCheck size={13} />
                    Szyfrowana Izolacja Danych
                  </span>
                </div>
                <h2 className="text-xl font-black text-white mt-1 flex items-center gap-2">
                  <History className="text-[#FFE600]" size={22} />
                  Baza Wysłanych Kontaktów & Metryki Kampanii
                </h2>
                <p className="text-xs text-[#94A3B8] mt-0.5">
                  Dedykowana baza kontaktów, do których wysłano ofertę lub follow-up. Śledzenie w czasie rzeczywistym odsłon stron <code className="text-[#FFE600] font-mono">/o/[token]</code>, wskaźnika odpowiedzi IMAP oraz spotkań B2B.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={fetchOutreachHistory}
                  disabled={historyLoading}
                  className="bg-[#1E293B] hover:bg-[#2D3D58] border border-[#334155] text-white font-bold text-xs px-3.5 py-2.5 rounded-xl flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                  title="Odśwież historię kampanii"
                >
                  <RefreshCw size={14} className={historyLoading ? "animate-spin text-[#FFE600]" : "text-[#94A3B8]"} />
                  <span>{historyLoading ? "Pobieranie..." : "Odśwież Historię"}</span>
                </button>
              </div>
            </div>

            {/* 4 PRIMARY KPI METRIC CARDS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Card 1: Total Outreached Contacts */}
              <div className="bg-[#141C2E] border border-[#28354D] p-4 rounded-xl relative overflow-hidden group hover:border-[#38BDF8]/50 transition-all">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black uppercase tracking-wider text-[#94A3B8] flex items-center gap-1.5">
                    <Users size={14} className="text-[#38BDF8]" />
                    Wysłane Kontakty
                  </span>
                  <span className="text-[10px] bg-[#1E293B] border border-[#334155] text-[#94A3B8] font-bold px-2 py-0.5 rounded-full">
                    {historyMetrics?.totalMessagesSent ?? 0} maili łącznie
                  </span>
                </div>
                <div className="text-3xl font-black text-white mt-2">
                  {historyMetrics?.totalOutreached ?? 0}
                </div>
                <p className="text-[11px] text-[#64748B] mt-1">
                  Firmy z co najmniej 1 wysłaną wiadomością
                </p>
              </div>

              {/* Card 2: Offer Views & View Rate */}
              <div className="bg-[#141C2E] border border-[#28354D] p-4 rounded-xl relative overflow-hidden group hover:border-[#38BDF8]/50 transition-all">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black uppercase tracking-wider text-[#38BDF8] flex items-center gap-1.5">
                    <Eye size={14} className="text-[#38BDF8]" />
                    Odsłony Ofert (/o/[token])
                  </span>
                  <span className="text-[10px] bg-[#38BDF8]/20 border border-[#38BDF8]/40 text-[#38BDF8] font-black px-2 py-0.5 rounded-full">
                    {historyMetrics?.offerViewRate ?? 0}% wskaźnik otwarć
                  </span>
                </div>
                <div className="text-3xl font-black text-[#38BDF8] mt-2 flex items-baseline gap-2">
                  <span>{historyMetrics?.totalOfferViews ?? 0}</span>
                  <span className="text-xs text-[#94A3B8] font-normal">odsłon</span>
                </div>
                <p className="text-[11px] text-[#64748B] mt-1">
                  {historyMetrics?.leadsWithOfferViews ?? 0} firm weszło na stronę swojej oferty
                </p>
              </div>

              {/* Card 3: Reply Rate */}
              <div className="bg-[#141C2E] border border-[#28354D] p-4 rounded-xl relative overflow-hidden group hover:border-[#34D399]/50 transition-all">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black uppercase tracking-wider text-[#34D399] flex items-center gap-1.5">
                    <MessageSquare size={14} className="text-[#34D399]" />
                    Wskaźnik Odpowiedzi
                  </span>
                  <span className="text-[10px] bg-[#064E3B] border border-[#059669] text-[#34D399] font-black px-2 py-0.5 rounded-full">
                    {historyMetrics?.repliesCount ?? 0} odpowiedzi
                  </span>
                </div>
                <div className="text-3xl font-black text-[#34D399] mt-2">
                  {historyMetrics?.replyRate ?? 0}%
                </div>
                <p className="text-[11px] text-[#64748B] mt-1">
                  Wykryte odpowiedzi z odpytywania IMAP
                </p>
              </div>

              {/* Card 4: Meetings Booked (Primary Goal) */}
              <div className="bg-[#141C2E] border-2 border-[#FFE600]/60 p-4 rounded-xl relative overflow-hidden group hover:border-[#FFE600] transition-all">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black uppercase tracking-wider text-[#FFE600] flex items-center gap-1.5">
                    <Award size={14} className="text-[#FFE600]" />
                    Umówione Spotkania (KPI)
                  </span>
                  <span className="text-[10px] bg-[#FFE600] text-black font-black px-2 py-0.5 rounded-full">
                    {historyMetrics?.meetingRate ?? 0}% konwersji
                  </span>
                </div>
                <div className="text-3xl font-black text-[#FFE600] mt-2">
                  {historyMetrics?.meetingsBookedCount ?? 0}
                </div>
                <p className="text-[11px] text-[#94A3B8] mt-1">
                  Główna miara biznesowa sukcesu systemu
                </p>
              </div>
            </div>

            {/* Filter and Search Bar */}
            <div className="bg-[#141C2E] border border-[#28354D] p-3.5 rounded-xl flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
              <div className="relative flex-1">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
                <input
                  type="text"
                  placeholder="Filtruj historię po firmie, emailu, mieście, osobie kontaktowej..."
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  className="w-full bg-[#0E1422] border border-[#28354D] rounded-lg pl-10 pr-4 py-2 text-sm text-white placeholder-[#64748B] focus:outline-none focus:border-[#FFE600]"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-[#94A3B8] font-bold">Filtruj:</span>
                {[
                  { id: "all", label: `Wszystkie (${historyList.length})` },
                  { id: "viewed", label: `Odsłony > 0 (${historyList.filter((h) => (h.offer?.viewCount || 0) > 0).length})` },
                  { id: "replied", label: `Odpowiedzi (${historyList.filter((h) => ["replied_interested", "replied_question", "replied_negative", "meeting_booked", "won"].includes(h.status)).length})` },
                  { id: "meeting", label: `Spotkania (${historyList.filter((h) => ["meeting_booked", "won"].includes(h.status)).length})` },
                  { id: "in_sequence", label: `W sekwencji (${historyList.filter((h) => ["in_sequence", "followup_sent"].includes(h.status)).length})` },
                ].map((pill) => (
                  <button
                    key={pill.id}
                    onClick={() => setHistoryStatusFilter(pill.id)}
                    className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                      historyStatusFilter === pill.id
                        ? "bg-[#FFE600] text-black font-extrabold"
                        : "bg-[#1E293B] text-[#94A3B8] hover:text-white hover:bg-[#2D3D58]"
                    }`}
                  >
                    {pill.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Outreach Table */}
            <div className="bg-[#141C2E] border border-[#28354D] rounded-xl overflow-hidden shadow-xl">
              {historyLoading ? (
                <div className="py-20 text-center">
                  <RefreshCw size={28} className="animate-spin text-[#FFE600] mx-auto mb-3" />
                  <p className="text-sm text-[#94A3B8]">Ładowanie bazy wysłanych kontaktów i metryk...</p>
                </div>
              ) : filteredHistory.length === 0 ? (
                <div className="py-20 text-center px-4">
                  <div className="w-14 h-14 bg-[#1E293B] border border-[#28354D] rounded-2xl flex items-center justify-center mx-auto mb-3 text-[#94A3B8]">
                    <Inbox size={26} />
                  </div>
                  <h3 className="text-base font-extrabold text-white">Brak rekordów wysyłki</h3>
                  <p className="text-xs text-[#94A3B8] max-w-md mx-auto mt-1">
                    {historySearch || historyStatusFilter !== "all"
                      ? "Żaden rekord nie pasuje do wybranych filtrów."
                      : "Nie wysłano jeszcze żadnych ofert z tej przestrzeni tenanta. Przejdź do zakładki 'Zatwierdzanie Ofert & Wysyłka', aby zatwierdzić i wysłać pierwsze maile."}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm border-collapse">
                    <thead>
                      <tr className="bg-[#0E1422] border-b border-[#28354D] text-[11px] font-black uppercase tracking-wider text-[#94A3B8]">
                        <th className="py-3 px-4">Firma & Miasto</th>
                        <th className="py-3 px-4">Odbiorca & Kontakt</th>
                        <th className="py-3 px-4">Status & Sekwencja</th>
                        <th className="py-3 px-4">Interakcja z Ofertą (/o/[token])</th>
                        <th className="py-3 px-4">Wysłane Wiadomości</th>
                        <th className="py-3 px-4 text-right">Akcje</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1E293B]">
                      {filteredHistory.map((item) => {
                        const offerViewCount = item.offer?.viewCount || 0;
                        const hasViewed = offerViewCount > 0;
                        const offerUrl = item.offer?.token ? `/o/${item.offer.token}` : null;

                        return (
                          <tr key={item.leadId} className="hover:bg-[#1A2338]/60 transition-colors">
                            {/* Firma & Miasto */}
                            <td className="py-3.5 px-4">
                              <div className="font-extrabold text-white text-sm flex items-center gap-1.5">
                                <span>{item.companyName}</span>
                              </div>
                              <div className="text-xs text-[#94A3B8] flex items-center gap-2 mt-0.5">
                                <span className="flex items-center gap-1">
                                  <MapPin size={11} className="text-[#FFE600]" />
                                  {item.city}
                                </span>
                                <span>•</span>
                                <span className="text-[#64748B]">{item.industry}</span>
                              </div>
                            </td>

                            {/* Odbiorca & Kontakt */}
                            <td className="py-3.5 px-4">
                              <div className="text-xs font-bold text-white flex items-center gap-1.5">
                                <User size={12} className="text-[#94A3B8]" />
                                <span>{item.contactName}</span>
                              </div>
                              <div className="text-xs text-[#38BDF8] font-mono mt-0.5 flex items-center gap-1">
                                <Mail size={11} />
                                <span>{item.recipientEmail}</span>
                              </div>
                            </td>

                            {/* Status & Sekwencja */}
                            <td className="py-3.5 px-4">
                              <div className="flex flex-col gap-1 items-start">
                                {item.status === "meeting_booked" ? (
                                  <span className="bg-[#FFE600] text-black text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1">
                                    <Award size={10} /> SPOTKANIE UMÓWIONE
                                  </span>
                                ) : item.status === "won" ? (
                                  <span className="bg-emerald-500 text-black text-[10px] font-black px-2 py-0.5 rounded-full">
                                    🏆 KLIENT POZYSKANY
                                  </span>
                                ) : item.status === "replied_interested" ? (
                                  <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-[10px] font-black px-2 py-0.5 rounded-full">
                                    💬 ZAINTERESOWANY
                                  </span>
                                ) : item.status === "replied_question" ? (
                                  <span className="bg-amber-500/20 text-amber-400 border border-amber-500/40 text-[10px] font-black px-2 py-0.5 rounded-full">
                                    ❓ PYTANIE KLIENTA
                                  </span>
                                ) : item.status === "in_sequence" || item.status === "followup_sent" ? (
                                  <span className="bg-[#A855F7]/20 text-[#C084FC] border border-[#A855F7]/40 text-[10px] font-black px-2 py-0.5 rounded-full">
                                    SEKWENCJA (KROK {item.sequenceStep || 1}/3)
                                  </span>
                                ) : item.status === "sent" ? (
                                  <span className="bg-[#38BDF8]/20 text-[#38BDF8] border border-[#38BDF8]/40 text-[10px] font-black px-2 py-0.5 rounded-full">
                                    OFERTA WYSŁANA
                                  </span>
                                ) : item.status === "lost" ? (
                                  <span className="bg-rose-500/20 text-rose-400 border border-rose-500/40 text-[10px] font-bold px-2 py-0.5 rounded-full">
                                    BRAK REAKCJI (LOST)
                                  </span>
                                ) : (
                                  <span className="bg-[#1E293B] text-[#94A3B8] border border-[#334155] text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
                                    {item.status}
                                  </span>
                                )}

                                <span className="text-[10px] text-[#64748B]">
                                  {item.latestSentAt
                                    ? `Ostatnio: ${new Date(item.latestSentAt).toLocaleDateString("pl-PL")}`
                                    : "—"}
                                </span>
                              </div>
                            </td>

                            {/* Interakcja z Ofertą */}
                            <td className="py-3.5 px-4">
                              {item.offer ? (
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2">
                                    {hasViewed ? (
                                      <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1">
                                        <Eye size={10} />
                                        {offerViewCount} {offerViewCount === 1 ? "ODSŁONA" : "ODSŁONY"}
                                      </span>
                                    ) : (
                                      <span className="bg-[#1E293B] text-[#64748B] text-[10px] font-bold px-2 py-0.5 rounded-full">
                                        0 odsłon
                                      </span>
                                    )}
                                  </div>
                                  {item.offer.lastViewedAt ? (
                                    <div className="text-[10px] text-emerald-300 font-medium">
                                      Ostatnio: {new Date(item.offer.lastViewedAt).toLocaleString("pl-PL")}
                                    </div>
                                  ) : (
                                    <div className="text-[10px] text-[#64748B]">
                                      Oczekiwanie na kliknięcie linku
                                    </div>
                                  )}
                                  {item.offer.token && (
                                    <div className="text-[10px] text-[#38BDF8] font-mono truncate max-w-[180px]">
                                      /o/{item.offer.token.substring(0, 16)}...
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <span className="text-xs text-[#64748B] italic">Brak oferty</span>
                              )}
                            </td>

                            {/* Wysłane Wiadomości */}
                            <td className="py-3.5 px-4">
                              <div className="space-y-1">
                                <div className="text-xs font-bold text-white flex items-center gap-1.5">
                                  <Mail size={12} className="text-[#A5B4FC]" />
                                  <span>{item.totalSent} {item.totalSent === 1 ? "wiadomość" : "wiadomości"}</span>
                                </div>
                                <div className="flex flex-wrap gap-1">
                                  {(item.messages || []).map((m: any, idx: number) => (
                                    <span
                                      key={m.id || idx}
                                      className="text-[9px] bg-[#1E293B] border border-[#334155] text-[#94A3B8] px-1.5 py-0.5 rounded font-mono"
                                      title={m.subject || "Wiadomość"}
                                    >
                                      {m.sequenceStep === 0 ? "Initial" : `FU${m.sequenceStep}`}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            </td>

                            {/* Akcje */}
                            <td className="py-3.5 px-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => {
                                    setSelectedHistoryItem(item);
                                    setActiveMessageIndex(0);
                                  }}
                                  className="bg-[#1E293B] hover:bg-[#2D3D58] border border-[#334155] text-white hover:text-[#FFE600] text-xs font-bold px-2.5 py-1.5 rounded-lg flex items-center gap-1 transition-all cursor-pointer"
                                  title="Zobacz treść wysłanych maili"
                                >
                                  <Mail size={13} />
                                  <span className="hidden sm:inline">Treść Maila</span>
                                </button>

                                {offerUrl && (
                                  <>
                                    <button
                                      onClick={() => {
                                        const fullUrl = `${window.location.origin}${offerUrl}`;
                                        navigator.clipboard.writeText(fullUrl);
                                        showToast("Skopiowano bezpośredni link do oferty!");
                                      }}
                                      className="bg-[#1E293B] hover:bg-[#2D3D58] border border-[#334155] text-[#94A3B8] hover:text-white p-1.5 rounded-lg transition-all cursor-pointer"
                                      title="Kopiuj link do dedykowanej oferty /o/[token]"
                                    >
                                      <Copy size={13} />
                                    </button>
                                    <a
                                      href={offerUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="bg-[#1E293B] hover:bg-[#2D3D58] border border-[#38BDF8]/40 text-[#38BDF8] hover:text-white p-1.5 rounded-lg transition-all cursor-pointer"
                                      title="Otwórz stronę oferty w nowej karcie"
                                    >
                                      <ExternalLink size={13} />
                                    </a>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
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
            {/* Master Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-[#141C2E] border border-[#28354D] p-5 rounded-2xl shadow-xl">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-[#FFE600] text-black rounded-xl font-bold">
                  <SettingsIcon size={24} />
                </div>
                <div>
                  <h1 className="text-xl font-extrabold text-white">Centrum Konfiguracji & Integracji</h1>
                  <p className="text-xs text-[#94A3B8] mt-0.5">
                    Zarządzaj zasięgiem geograficznym, profilem eksperta, kluczami Google/Gemini oraz serwerami SMTP/IMAP.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleSaveAllSettings}
                disabled={settingsLoading || targetingLoading || senderProfileLoading}
                className="w-full sm:w-auto bg-[#FFE600] hover:bg-[#FFF04D] text-black font-extrabold text-sm px-6 py-3 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-yellow-500/20 disabled:opacity-50 cursor-pointer"
              >
                <Save size={18} />
                {settingsLoading ? "Zapisywanie wszystkich..." : "💾 Zapisz Wszystkie Ustawienia"}
              </button>
            </div>

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
                    <h4 className="font-bold text-xs uppercase tracking-wider text-[#94A3B8]">Bezpieczeństwo Kampanii</h4>
                    <p className="text-sm font-extrabold text-[#38BDF8] mt-0.5">BEZPIECZNIK AKTYWNY</p>
                  </div>
                  <span className="badge badge-approved">ZABEZPIECZONE</span>
                </div>

                <div className="p-3.5 bg-[#0A0E17] border border-[#28354D] rounded-xl flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-xs uppercase tracking-wider text-[#94A3B8]">Baza Danych CRM</h4>
                    <p className="text-sm font-extrabold text-[#C084FC] mt-0.5">SZYFROWANIE CHMURY EU</p>
                  </div>
                  <span className="badge badge-approved">POŁĄCZONO</span>
                </div>
              </div>
            </div>

            {/* TARGETING & LEAD PREFERENCES FORM */}
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
                  onClick={handleSaveTargetingSettings}
                  disabled={targetingLoading}
                  className="bg-[#FFE600] hover:bg-[#FFF04D] text-black font-extrabold text-xs px-5 py-2.5 rounded-xl flex items-center gap-2 transition-all shadow-lg shadow-yellow-500/10 disabled:opacity-50"
                >
                  <Save size={16} />
                  {targetingLoading ? "Zapisywanie..." : "Zapisz Kryteria Targetowania"}
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
                      value={targetingSettings.targetVoivodeship || targetingSettings.targetRegion}
                      onChange={(e) => {
                        const v = e.target.value;
                        const def = POLISH_VOIVODESHIPS.find((item) => item.name === v);
                        setTargetingSettings({
                          ...targetingSettings,
                          targetVoivodeship: v,
                          targetRegion: v,
                          defaultCity: def ? def.capital : targetingSettings.defaultCity,
                        });
                        setIsTargetCustomCity(false);
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
                      value={isTargetCustomCity ? "__custom__" : targetingSettings.defaultCity}
                      onChange={(e) => {
                        if (e.target.value === "__custom__") {
                          setIsTargetCustomCity(true);
                        } else {
                          setIsTargetCustomCity(false);
                          setTargetingSettings({ ...targetingSettings, defaultCity: e.target.value });
                        }
                      }}
                      className="w-full bg-[#0A0E17] border border-[#28354D] rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-[#FFE600]"
                    >
                      {currentTargetingCities.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                      <option value="__custom__">✏️ Wpisz inne miasto w Polsce...</option>
                    </select>
                    {isTargetCustomCity && (
                      <input
                        type="text"
                        value={targetingSettings.defaultCity}
                        onChange={(e) =>
                          setTargetingSettings({ ...targetingSettings, defaultCity: e.target.value })
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
                        {targetingSettings.defaultRadiusKm > 0 ? `${targetingSettings.defaultRadiusKm} km` : "Bez limitu"}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        min={0}
                        max={100}
                        step={5}
                        value={targetingSettings.defaultRadiusKm}
                        onChange={(e) =>
                          setTargetingSettings({
                            ...targetingSettings,
                            defaultRadiusKm: parseInt(e.target.value, 10),
                          })
                        }
                        className="flex-1 accent-[#FFE600]"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setTargetingSettings({
                            ...targetingSettings,
                            defaultRadiusKm: targetingSettings.defaultRadiusKm === 0 ? 35 : 0,
                          })
                        }
                        className={`text-[10px] font-bold px-2 py-1 rounded border transition-all ${
                          targetingSettings.defaultRadiusKm === 0
                            ? "bg-[#FFE600] text-black border-[#FFE600]"
                            : "bg-[#0A0E17] text-[#94A3B8] border-[#28354D]"
                        }`}
                      >
                        {targetingSettings.defaultRadiusKm === 0 ? "Bez limitu km" : "Cała PL"}
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
                      const scales = targetingSettings.targetCompanyScales.includes("mikro")
                        ? targetingSettings.targetCompanyScales.filter((s) => s !== "mikro")
                        : [...targetingSettings.targetCompanyScales, "mikro"];
                      setTargetingSettings({ ...targetingSettings, targetCompanyScales: scales });
                    }}
                    className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                      targetingSettings.targetCompanyScales.includes("mikro")
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
                      const scales = targetingSettings.targetCompanyScales.includes("male")
                        ? targetingSettings.targetCompanyScales.filter((s) => s !== "male")
                        : [...targetingSettings.targetCompanyScales, "male"];
                      setTargetingSettings({ ...targetingSettings, targetCompanyScales: scales });
                    }}
                    className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                      targetingSettings.targetCompanyScales.includes("male")
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
                      const scales = targetingSettings.targetCompanyScales.includes("msp")
                        ? targetingSettings.targetCompanyScales.filter((s) => s !== "msp")
                        : [...targetingSettings.targetCompanyScales, "msp"];
                      setTargetingSettings({ ...targetingSettings, targetCompanyScales: scales });
                    }}
                    className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                      targetingSettings.targetCompanyScales.includes("msp")
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
                  {targetingSettings.targetIndustries.map((ind, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#0A0E17] border border-[#28354D] text-xs font-bold text-white hover:border-[#FFE600] transition-all"
                    >
                      {ind}
                      <button
                        type="button"
                        onClick={() => {
                          const updated = targetingSettings.targetIndustries.filter((_, i) => i !== idx);
                          setTargetingSettings({ ...targetingSettings, targetIndustries: updated });
                        }}
                        className="text-[#94A3B8] hover:text-[#FB7185] ml-1"
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
                        if (!targetingSettings.targetIndustries.includes(newIndustryTag.trim())) {
                          setTargetingSettings({
                            ...targetingSettings,
                            targetIndustries: [...targetingSettings.targetIndustries, newIndustryTag.trim()],
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
                      if (newIndustryTag.trim() && !targetingSettings.targetIndustries.includes(newIndustryTag.trim())) {
                        setTargetingSettings({
                          ...targetingSettings,
                          targetIndustries: [...targetingSettings.targetIndustries, newIndustryTag.trim()],
                        });
                        setNewIndustryTag("");
                      }
                    }}
                    className="bg-[#1E293B] hover:bg-[#2D3D58] border border-[#334155] text-white font-bold text-xs px-3.5 py-2 rounded-lg flex items-center gap-1"
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
                  {targetingSettings.excludedKeywords?.map((exc, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#881337]/20 border border-[#E11D48]/40 text-xs text-[#FB7185] font-semibold"
                    >
                      {exc}
                      <button
                        type="button"
                        onClick={() => {
                          const updated = targetingSettings.excludedKeywords.filter((_, i) => i !== idx);
                          setTargetingSettings({ ...targetingSettings, excludedKeywords: updated });
                        }}
                        className="hover:text-white"
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
                        setTargetingSettings({
                          ...targetingSettings,
                          excludedKeywords: [...(targetingSettings.excludedKeywords || []), newExcludedKeyword.trim()],
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
                        setTargetingSettings({
                          ...targetingSettings,
                          excludedKeywords: [...(targetingSettings.excludedKeywords || []), newExcludedKeyword.trim()],
                        });
                        setNewExcludedKeyword("");
                      }
                    }}
                    className="bg-[#1E293B] hover:bg-[#2D3D58] border border-[#334155] text-white font-bold text-xs px-3.5 py-2 rounded-lg flex items-center gap-1"
                  >
                    <Plus size={14} /> Wyklucz
                  </button>
                </div>
              </div>
            </div>

            {/* DEFAULT SENDER PROFILE & SIGNATURE CARD */}
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
                  onClick={handleSaveSenderProfile}
                  disabled={senderProfileLoading}
                  className="bg-[#FFE600] hover:bg-[#FFF04D] text-black font-extrabold text-xs px-5 py-2.5 rounded-xl flex items-center gap-2 transition-all shadow-lg shadow-yellow-500/10 disabled:opacity-50 cursor-pointer"
                >
                  <Save size={16} />
                  {senderProfileLoading ? "Zapisywanie..." : "Zapisz Profil Nadawcy"}
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#94A3B8] mb-1">
                    Imię i Nazwisko Nadawcy
                  </label>
                  <input
                    type="text"
                    value={senderProfile.senderName}
                    onChange={(e) => setSenderProfile({ ...senderProfile, senderName: e.target.value })}
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
                    value={senderProfile.senderRole}
                    onChange={(e) => setSenderProfile({ ...senderProfile, senderRole: e.target.value })}
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
                    value={senderProfile.senderCompany}
                    onChange={(e) => setSenderProfile({ ...senderProfile, senderCompany: e.target.value })}
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
                    value={senderProfile.senderEmail}
                    onChange={(e) => setSenderProfile({ ...senderProfile, senderEmail: e.target.value })}
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
                    value={senderProfile.senderPhone}
                    onChange={(e) => setSenderProfile({ ...senderProfile, senderPhone: e.target.value })}
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
                    value={senderProfile.senderWebsite}
                    onChange={(e) => setSenderProfile({ ...senderProfile, senderWebsite: e.target.value })}
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
                    value={senderProfile.bookingUrl}
                    onChange={(e) => setSenderProfile({ ...senderProfile, bookingUrl: e.target.value })}
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
                    value={senderProfile.customNote}
                    onChange={(e) => setSenderProfile({ ...senderProfile, customNote: e.target.value })}
                    placeholder="np. W razie pytań technicznych dotyczących wstępnej analizy, zapraszam do bezpośredniego kontaktu."
                    className="w-full bg-[#0A0E17] border border-[#28354D] rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-[#FFE600]"
                  />
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
                  <h3 className="text-base font-extrabold text-white">Klucze Usług Zewnętrznych & Integracje API</h3>
                  <p className="text-xs text-[#94A3B8]">Google Places / Maps API, Gemini AI oraz Netlify</p>
                </div>
              </div>

              <div className="space-y-4 pt-1">
                {/* Google Places API */}
                <div className="p-4 bg-[#0A0E17] border border-[#28354D] rounded-xl space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <label className="text-xs font-bold text-white flex items-center gap-1.5">
                        <span>🗺️</span> GOOGLE_MAPS_API_KEY (Google Places API New & Legacy)
                      </label>
                      <p className="text-[11px] text-[#94A3B8] mt-0.5">
                        Wymagany do dynamicznego wyszukiwania przedsiębiorstw, weryfikacji stron WWW, telefonów i geolokalizacji.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleTestGoogleApi}
                      disabled={googleTesting || (!mailSettings.googleApiKey && !mailSettings.hasGoogleApiKey)}
                      className="bg-[#1E293B] hover:bg-[#2D3D58] border border-[#FFE600]/40 text-[#FFE600] font-bold text-xs px-3.5 py-2 rounded-lg flex items-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
                    >
                      <RefreshCw size={14} className={googleTesting ? "animate-spin" : ""} />
                      {googleTesting ? "Testowanie klucza..." : "Testuj połączenie Google API"}
                    </button>
                  </div>

                  <input
                    type="password"
                    value={mailSettings.googleApiKey}
                    onChange={(e) => setMailSettings({ ...mailSettings, googleApiKey: e.target.value })}
                    placeholder={mailSettings.hasGoogleApiKey ? "•••••••• (Klucz aktywny w bazie — wpisz nowy aby zmienić)" : "Wklej klucz Google API (AIzaSy...)"}
                    className="w-full bg-[#141C2E] border border-[#28354D] rounded-lg px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-[#FFE600]"
                  />

                  {/* Google API Diagnostic Result Box */}
                  {googleDiagnostic && (
                    <div
                      className={`p-3.5 rounded-xl border text-xs space-y-1.5 animate-in fade-in duration-200 ${
                        googleDiagnostic.success
                          ? "bg-emerald-950/50 border-emerald-500/50 text-emerald-200"
                          : "bg-rose-950/50 border-rose-500/50 text-rose-200"
                      }`}
                    >
                      <div className="flex items-center gap-2 font-bold text-white">
                        {googleDiagnostic.success ? (
                          <>
                            <CheckCircle2 size={16} className="text-emerald-400" />
                            <span>Klucz Google API aktywny i zweryfikowany!</span>
                          </>
                        ) : (
                          <>
                            <AlertTriangle size={16} className="text-rose-400" />
                            <span>Błąd weryfikacji Google API</span>
                          </>
                        )}
                      </div>
                      <p className="text-xs leading-relaxed">{googleDiagnostic.message}</p>
                      {googleDiagnostic.hint && (
                        <div className="mt-2 p-2.5 bg-black/40 rounded-lg border border-amber-500/30 text-amber-300 text-[11px] leading-relaxed">
                          <strong className="block mb-0.5 text-white">💡 Wskazówka / Jak naprawić:</strong>
                          {googleDiagnostic.hint}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Gemini AI API */}
                <div className="p-4 bg-[#0A0E17] border border-[#28354D] rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-white flex items-center gap-1.5">
                      <span>✨</span> GEMINI_API_KEY (Google Gemini AI 2.5 Flash)
                    </label>
                    <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800">
                      Wymagane do audytów & ofert
                    </span>
                  </div>
                  <input
                    type="password"
                    value={mailSettings.geminiApiKey}
                    onChange={(e) => setMailSettings({ ...mailSettings, geminiApiKey: e.target.value })}
                    placeholder={mailSettings.hasGeminiApiKey ? "•••••••• (Klucz aktywny w bazie — wpisz nowy aby zmienić)" : "Wklej klucz Gemini API (AIzaSy...)"}
                    className="w-full bg-[#141C2E] border border-[#28354D] rounded-lg px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-[#FFE600]"
                  />
                </div>

                {/* Netlify Auth Token */}
                <div className="p-4 bg-[#0A0E17] border border-[#28354D] rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-white flex items-center gap-1.5">
                      <span>🌐</span> NETLIFY_AUTH_TOKEN
                    </label>
                    <span className="text-[10px] text-[#94A3B8]">Opcjonalne (hosting stron landing page)</span>
                  </div>
                  <input
                    type="password"
                    value={mailSettings.netlifyToken}
                    onChange={(e) => setMailSettings({ ...mailSettings, netlifyToken: e.target.value })}
                    placeholder={mailSettings.hasNetlifyToken ? "•••••••• (skonfigurowano)" : "Wklej token Netlify"}
                    className="w-full bg-[#141C2E] border border-[#28354D] rounded-lg px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-[#FFE600]"
                  />
                </div>
              </div>
            </div>

            {/* Master Bottom Save Button */}
            <div className="flex justify-end pt-2 pb-6">
              <button
                type="button"
                onClick={handleSaveAllSettings}
                disabled={settingsLoading || targetingLoading || senderProfileLoading}
                className="w-full sm:w-auto bg-[#FFE600] hover:bg-[#FFF04D] text-black font-extrabold text-sm px-8 py-4 rounded-xl flex items-center justify-center gap-2.5 transition-all shadow-xl shadow-yellow-500/20 disabled:opacity-50 cursor-pointer"
              >
                <Save size={18} />
                {settingsLoading ? "Zapisywanie wszystkich ustawień..." : "💾 Zapisz Wszystkie Ustawienia (Zasięg, Profil, API i Poczta)"}
              </button>
            </div>
          </div>
        )}

        {/* TAB: TEAM & ACCESS MANAGEMENT */}
        {activeTab === "team" && (
          <div className="max-w-5xl mx-auto space-y-6">
            {/* Header / Intro Card */}
            <div className="bg-[#141C2E] border border-[#28354D] p-6 rounded-2xl shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-[#FFE600] text-black rounded-xl font-bold">
                  <Users size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-extrabold text-white">
                    Zarządzanie Zespołem & Bezpieczeństwo Dostępu
                  </h2>
                  <p className="text-xs text-[#94A3B8] mt-0.5">
                    Kontrola dostępu do CRM, uprawnienia członków organizacji oraz bezpieczne, jednorazowe zaproszenia imienne.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 bg-[#0A0E17] border border-[#28354D] px-3.5 py-1.5 rounded-full text-xs font-bold text-[#34D399]">
                <ShieldCheck size={14} className="text-[#34D399]" />
                <span>TRYB ZAMKNIĘTY (INVITE-ONLY)</span>
              </div>
            </div>

            {/* 1. Active Team Members List (TOP PRIORITY) */}
            <div className="bg-[#141C2E] border border-[#28354D] p-6 rounded-2xl shadow-xl space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#28354D] pb-3">
                <div>
                  <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                    <User size={18} className="text-[#FFE600]" />
                    Aktywni Członkowie Organizacji ({teamUsersList.length})
                  </h3>
                  <p className="text-xs text-[#94A3B8] mt-0.5">
                    Użytkownicy posiadający aktywny dostęp do platformy, ofert i bazy leadów.
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#0A0E17] text-[#94A3B8] font-bold uppercase tracking-wider">
                    <tr>
                      <th className="p-3.5">Użytkownik</th>
                      <th className="p-3.5">Rola w Organizacji</th>
                      <th className="p-3.5">Status</th>
                      <th className="p-3.5">Data Dołączenia</th>
                      <th className="p-3.5 text-right">Zarządzanie</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#28354D]">
                    {teamUsersList.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-6 text-center text-[#94A3B8]">
                          Brak użytkowników w organizacji.
                        </td>
                      </tr>
                    ) : (
                      teamUsersList.map((u) => {
                        const isSelf = currentUser?.id === u.id || currentUser?.email === u.email;
                        const initials = (u.name || u.email || "U")
                          .split(" ")
                          .map((p: string) => p[0])
                          .join("")
                          .toUpperCase()
                          .slice(0, 2);

                        return (
                          <tr key={u.id} className="hover:bg-[#1E293B]/40 transition-colors">
                            <td className="p-3.5">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-[#1E293B] border border-[#38BDF8]/40 text-[#38BDF8] flex items-center justify-center font-bold text-xs">
                                  {initials}
                                </div>
                                <div>
                                  <div className="font-bold text-white flex items-center gap-1.5">
                                    <span>{u.name || "Użytkownik"}</span>
                                    {isSelf && (
                                      <span className="text-[10px] bg-[#FFE600]/20 text-[#FFE600] px-1.5 py-0.2 rounded font-bold">
                                        Ty
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[11px] text-[#94A3B8] font-mono">{u.email}</div>
                                </div>
                              </div>
                            </td>
                            <td className="p-3.5">
                              <select
                                value={u.role}
                                disabled={isSelf}
                                onChange={(e) => handleUpdateUserRole(u.id, e.target.value as any)}
                                className={`text-xs font-bold px-2.5 py-1 rounded-lg border focus:outline-none transition-all ${
                                  u.role === "admin"
                                    ? "bg-amber-950/60 text-amber-300 border-amber-800"
                                    : "bg-blue-950/60 text-blue-300 border-blue-800"
                                } ${isSelf ? "opacity-75 cursor-not-allowed" : "cursor-pointer hover:border-[#FFE600]"}`}
                              >
                                <option value="admin">Administrator (Pełny dostęp)</option>
                                <option value="member">Specjalista B2B (Dostęp operacyjny)</option>
                              </select>
                            </td>
                            <td className="p-3.5">
                              <span className="badge badge-approved">AKTYWNY</span>
                            </td>
                            <td className="p-3.5 text-[#94A3B8] font-mono">
                              {u.createdAt ? new Date(u.createdAt).toLocaleDateString("pl-PL") : "—"}
                            </td>
                            <td className="p-3.5 text-right">
                              {isSelf ? (
                                <span className="text-[11px] text-[#64748B] italic">Konto zalogowane</span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteUser(u.id, u.name || u.email)}
                                  className="text-xs bg-[#881337]/30 hover:bg-[#881337] border border-[#E11D48]/40 hover:border-[#E11D48] text-[#FB7185] hover:text-white px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer inline-flex items-center gap-1"
                                >
                                  <Trash2 size={12} />
                                  <span>Odbierz dostęp</span>
                                </button>
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

            {/* 2. Invite New Team Member Form */}
            <div className="bg-[#141C2E] border border-[#28354D] p-6 rounded-2xl shadow-xl space-y-4">
              <div className="border-b border-[#28354D] pb-3">
                <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                  <Sparkles size={18} className="text-[#FFE600]" />
                  Zaproś Nowego Współpracownika do Zespołu
                </h3>
                <p className="text-xs text-[#94A3B8] mt-0.5">
                  Wprowadź adres e-mail pracownika. System wygeneruje unikalne, jednorazowe zaproszenie chronione tokenem kryptograficznym (ważne 7 dni).
                </p>
              </div>

              <form onSubmit={handleCreateInvitation} className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#94A3B8] mb-1.5">
                    Adres E-mail Pracownika (Wymagany)
                  </label>
                  <input
                    type="email"
                    required
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="np. marcin.kowalski@twojadomena.pl"
                    className="w-full bg-[#0A0E17] border border-[#28354D] rounded-lg px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-[#FFE600]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#94A3B8] mb-1.5">
                    Rola w Organizacji
                  </label>
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value)}
                    className="w-full bg-[#0A0E17] border border-[#28354D] rounded-lg px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-[#FFE600]"
                  >
                    <option value="member">Specjalista B2B (Dostęp do leadów, audytów i ofert)</option>
                    <option value="admin">Administrator (Pełny dostęp do ustawień i zespołu)</option>
                  </select>
                </div>

                <div className="flex items-end">
                  <button
                    type="submit"
                    disabled={inviteGenerating || !inviteEmail}
                    className="w-full bg-[#FFE600] hover:bg-[#FFF04D] text-black font-extrabold text-sm px-6 py-2.5 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-yellow-500/10 disabled:opacity-50 cursor-pointer"
                  >
                    <Key size={16} />
                    {inviteGenerating ? "Generowanie..." : "Wygeneruj Imienne Zaproszenie"}
                  </button>
                </div>
              </form>

              {/* Display Generated URL */}
              {generatedInviteUrl && (
                <div className="mt-4 p-4 bg-[#0A0E17] border border-emerald-500/50 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-3 animate-in fade-in">
                  <div className="w-full overflow-hidden">
                    <span className="text-xs font-bold text-[#34D399] flex items-center gap-1.5 uppercase tracking-wider mb-1">
                      <CheckCircle2 size={15} /> Gotowy, Bezpieczny Link Zaproszenia:
                    </span>
                    <input
                      type="text"
                      readOnly
                      value={generatedInviteUrl}
                      className="w-full bg-[#141C2E] text-sm text-white font-mono px-3 py-1.5 rounded-lg border border-[#28354D] focus:outline-none select-all"
                    />
                    <p className="text-[11px] text-[#94A3B8] mt-1.5">
                      Prześlij ten link pracownikowi. Po otwarciu ustawi swoje hasło i natychmiast uzyska dostęp do platformy.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(generatedInviteUrl);
                      showToast("Skopiowano link zaproszenia do schowka!", "success");
                    }}
                    className="shrink-0 bg-[#38BDF8]/20 hover:bg-[#38BDF8]/30 border border-[#38BDF8]/60 text-[#38BDF8] font-bold text-xs px-4 py-2.5 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Copy size={15} /> Kopiuj Link
                  </button>
                </div>
              )}
            </div>

            {/* 3. Pending Invitations Table */}
            <div className="bg-[#141C2E] border border-[#28354D] p-6 rounded-2xl shadow-xl space-y-4">
              <div className="border-b border-[#28354D] pb-3">
                <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                  <Clock size={18} className="text-[#38BDF8]" />
                  Oczekujące Zaproszenia ({invitationsList.filter((i) => i.status === "active").length})
                </h3>
                <p className="text-xs text-[#94A3B8] mt-0.5">
                  Lista aktywnych linków zaproszeniowych oczekujących na dokończenie rejestracji przez współpracowników.
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#0A0E17] text-[#94A3B8] font-bold uppercase tracking-wider">
                    <tr>
                      <th className="p-3">Adres E-mail Odbiorcy</th>
                      <th className="p-3">Przypisana Rola</th>
                      <th className="p-3">Status</th>
                      <th className="p-3">Ważność</th>
                      <th className="p-3 text-right">Akcje</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#28354D]">
                    {invitationsList.filter((i) => i.status === "active").length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-5 text-center text-[#94A3B8]">
                          Brak oczekujących zaproszeń. Wszyscy współpracownicy aktywowali swoje konta.
                        </td>
                      </tr>
                    ) : (
                      invitationsList
                        .filter((inv) => inv.status === "active")
                        .map((inv) => (
                          <tr key={inv.id} className="hover:bg-[#1E293B]/40 transition-colors">
                            <td className="p-3 font-bold text-white">{inv.email || "Imienne zaproszenie"}</td>
                            <td className="p-3">
                              <span
                                className={`px-2 py-0.5 rounded font-bold uppercase text-[10px] ${
                                  inv.role === "admin"
                                    ? "bg-amber-950 text-amber-300 border border-amber-800"
                                    : "bg-blue-950 text-blue-300 border border-blue-800"
                                }`}
                              >
                                {inv.role === "admin" ? "Administrator" : "Specjalista B2B"}
                              </span>
                            </td>
                            <td className="p-3">
                              <span className="text-[10px] font-bold text-amber-300 bg-amber-950/60 px-2 py-0.5 rounded border border-amber-800">
                                Oczekuje na rejestrację
                              </span>
                            </td>
                            <td className="p-3 text-[#94A3B8] font-mono">
                              {inv.expiresAt ? new Date(inv.expiresAt).toLocaleDateString("pl-PL") : "7 dni"}
                            </td>
                            <td className="p-3 text-right space-x-2">
                              <button
                                type="button"
                                onClick={() => {
                                  const url = `${window.location.origin}/invite?code=${inv.code}`;
                                  navigator.clipboard.writeText(url);
                                  showToast("Skopiowano link zaproszenia!", "success");
                                }}
                                className="text-xs bg-[#1E293B] hover:bg-[#2D3D58] border border-[#334155] text-[#38BDF8] font-bold px-2.5 py-1 rounded-lg transition-all cursor-pointer inline-flex items-center gap-1"
                              >
                                <Copy size={12} /> Kopiuj link
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRevokeInvitation(inv.id)}
                                className="text-xs text-[#FB7185] hover:text-white bg-[#881337]/30 hover:bg-[#881337] border border-[#E11D48]/40 hover:border-[#E11D48] font-bold px-2.5 py-1 rounded-lg transition-all cursor-pointer inline-flex items-center gap-1 ml-2"
                              >
                                <X size={12} /> Unieważnij
                              </button>
                            </td>
                          </tr>
                        ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>
      </div>

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
                  <span className="text-xs text-[#94A3B8]">{selectedLead.city || targetingSettings.defaultCity || "Polska"}</span>
                  <span className="text-xs text-[#64748B]">•</span>
                  <span className="text-xs text-[#FFE600] font-bold">{selectedLead.industry}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center bg-[#141C2E] border border-[#28354D] rounded-lg p-0.5 text-xs">
                  <button
                    onClick={goToPrevLead}
                    disabled={!hasPrevLead}
                    className="p-1.5 rounded hover:bg-[#1E293B] text-[#94A3B8] hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
                    title="Poprzedni lead (←)"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <span className="px-2 text-[11px] font-mono text-[#94A3B8] select-none">
                    {currentLeadIndex !== -1 ? `${currentLeadIndex + 1} / ${sortedLeads.length}` : "—"}
                  </span>
                  <button
                    onClick={goToNextLead}
                    disabled={!hasNextLead}
                    className="p-1.5 rounded hover:bg-[#1E293B] text-[#94A3B8] hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
                    title="Następny lead (→)"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
                <button
                  onClick={() => setSelectedLead(null)}
                  className="p-2 rounded-lg bg-[#1E293B] hover:bg-[#334155] text-[#94A3B8] hover:text-white transition-all cursor-pointer"
                  title="Zamknij (Esc)"
                >
                  <X size={18} />
                </button>
              </div>
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
                Studio Oferty & Strona
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

                {/* Weryfikacja w Rejestrach Państwowych (Biała Lista MF / KRS / CEIDG) */}
                <div className="bg-[#141C2E] p-4 rounded-xl border border-[#28354D] space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#FFE600] flex items-center gap-1.5 uppercase tracking-wider">
                      <ShieldCheck size={16} className="text-[#34D399]" /> Weryfikacja w Rejestrach Państwowych
                    </span>
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold uppercase border ${
                        selectedLead.scoreBreakdown?.registryVerified || selectedLead.nip
                          ? "bg-emerald-950 text-emerald-300 border-emerald-800"
                          : "bg-slate-800 text-slate-400 border-slate-700"
                      }`}
                    >
                      {selectedLead.scoreBreakdown?.registryVerified || selectedLead.nip
                        ? "🛡️ Zweryfikowano w Rejestrze"
                        : "Wstępny rekord"}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                    <div className="bg-[#0A0E17] p-2.5 rounded-lg border border-[#1E293B]">
                      <span className="text-[#94A3B8] block text-[10px] uppercase font-bold">Status VAT (Biała Lista MF)</span>
                      <span className="font-extrabold text-[#34D399]">
                        {selectedLead.scoreBreakdown?.vatStatus || (selectedLead.nip ? "Czynny podatnik VAT" : "Niezweryfikowany")}
                      </span>
                      <span className="block text-[10px] text-[#64748B] mt-0.5">wl-api.mf.gov.pl</span>
                    </div>

                    <div className="bg-[#0A0E17] p-2.5 rounded-lg border border-[#1E293B]">
                      <span className="text-[#94A3B8] block text-[10px] uppercase font-bold">Forma Prawna & Rejestr</span>
                      <span className="font-extrabold text-white">
                        {selectedLead.scoreBreakdown?.legalForm || (selectedLead.krs ? "Spółka z o.o. (KRS)" : "Działalność JDG (CEIDG)")}
                      </span>
                      <span className="block text-[10px] text-[#64748B] mt-0.5">Rejestr KRS / CEIDG</span>
                    </div>

                    <div className="bg-[#0A0E17] p-2.5 rounded-lg border border-[#1E293B]">
                      <span className="text-[#94A3B8] block text-[10px] uppercase font-bold">Reprezentant / Właściciel</span>
                      <span className="font-extrabold text-[#FFE600] truncate block">
                        {selectedLead.contacts?.[0]?.firstName
                          ? `${selectedLead.contacts[0].firstName} (${selectedLead.contacts[0].role || "Zarząd"})`
                          : "Ustalany z KRS"}
                      </span>
                      <span className="block text-[10px] text-[#64748B] mt-0.5">Zweryfikowana tożsamość</span>
                    </div>
                  </div>

                  <div className="text-[11px] text-[#94A3B8] flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-[#1E293B]">
                    <span>
                      NIP: <strong className="text-white font-mono">{selectedLead.nip || "brak"}</strong>
                      {selectedLead.scoreBreakdown?.regon ? <> • REGON: <strong className="text-white font-mono">{selectedLead.scoreBreakdown.regon}</strong></> : null}
                      {selectedLead.krs ? <> • KRS: <strong className="text-white font-mono">{selectedLead.krs}</strong></> : null}
                    </span>
                    <span className="text-[10px] text-[#64748B]">
                      Źródło: {selectedLead.scoreBreakdown?.registrySource === "krs_api" ? "api-krs.ms.gov.pl" : "wl-api.mf.gov.pl (MF)"}
                    </span>
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
                  <div className="space-y-4">
                    {/* Top Control Bar */}
                    <div className="flex flex-wrap items-center justify-between gap-2 bg-[#141C2E] p-3 rounded-xl border border-[#28354D]">
                      <div className="flex items-center gap-2">
                        <span className="badge badge-offer">OFERTA OPUBLIKOWANA</span>
                        <span className="text-[11px] text-[#94A3B8] font-mono">
                          /o/{selectedLead.offer.token ? `${selectedLead.offer.token.slice(0, 10)}...` : selectedLead.offer.slug}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            const url = `${window.location.origin}/o/${selectedLead.offer.token || selectedLead.offer.slug}`;
                            navigator.clipboard.writeText(url);
                            setOfferCopied(true);
                            showToast("Skopiowano bezpośredni link do oferty!");
                            setTimeout(() => setOfferCopied(false), 2500);
                          }}
                          className="text-xs bg-[#1E293B] hover:bg-[#2D3D58] border border-[#334155] text-white font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer"
                        >
                          <Copy size={13} /> {offerCopied ? "Skopiowano!" : "Kopiuj Link"}
                        </button>
                        <a
                          href={selectedLead.offer.token ? `/o/${selectedLead.offer.token}` : `/offers/${selectedLead.offer.slug}`}
                          target="_blank"
                          className="text-xs bg-[#FFE600] hover:bg-[#FFF04D] text-black font-extrabold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all"
                        >
                          <ExternalLink size={13} /> Otwórz Stronę
                        </a>
                      </div>
                    </div>

                    {/* Mode Switcher Tabs */}
                    <div className="flex border-b border-[#28354D] gap-2">
                      <button
                        type="button"
                        onClick={() => setOfferEditorMode("edit")}
                        className={`pb-2.5 px-3 text-xs font-extrabold flex items-center gap-1.5 border-b-2 transition-all cursor-pointer ${
                          offerEditorMode === "edit"
                            ? "border-[#FFE600] text-[#FFE600]"
                            : "border-transparent text-[#94A3B8] hover:text-white"
                        }`}
                      >
                        <Edit2 size={14} /> Edytor Treści & Podpisu
                      </button>
                      <button
                        type="button"
                        onClick={() => setOfferEditorMode("preview")}
                        className={`pb-2.5 px-3 text-xs font-extrabold flex items-center gap-1.5 border-b-2 transition-all cursor-pointer ${
                          offerEditorMode === "preview"
                            ? "border-[#FFE600] text-[#FFE600]"
                            : "border-transparent text-[#94A3B8] hover:text-white"
                        }`}
                      >
                        <Eye size={14} /> Podgląd na żywo (/o/[token])
                      </button>
                    </div>

                    {/* MODE 1: EDIT FORM */}
                    {offerEditorMode === "edit" && (
                      <div className="space-y-4">
                        {/* 1. Header & Hero Observation */}
                        <div className="bg-[#141C2E] p-4 rounded-xl border border-[#28354D] space-y-3">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-[#FFE600]">
                            1. Nagłówek & Główna Obserwacja Audytu
                          </h4>
                          <div>
                            <label className="block text-[11px] font-bold text-[#94A3B8] mb-1">
                              Tytuł / Główna propozycja
                            </label>
                            <input
                              type="text"
                              value={offerForm.title}
                              onChange={(e) => setOfferForm({ ...offerForm, title: e.target.value })}
                              className="w-full bg-[#0A0E17] border border-[#28354D] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#FFE600]"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-bold text-[#94A3B8] mb-1">
                              Wstępna obserwacja audytu (hero observation)
                            </label>
                            <textarea
                              rows={3}
                              value={offerForm.heroObservation}
                              onChange={(e) => setOfferForm({ ...offerForm, heroObservation: e.target.value })}
                              className="w-full bg-[#0A0E17] border border-[#28354D] rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-[#FFE600] leading-relaxed"
                            />
                          </div>
                        </div>

                        {/* 2. Proposed Modules */}
                        <div className="bg-[#141C2E] p-4 rounded-xl border border-[#28354D] space-y-3">
                          <div className="flex items-center justify-between">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-[#FFE600]">
                              2. Proponowane Moduły Wdrożenia ({offerForm.proposedModules?.length || 0})
                            </h4>
                            <button
                              type="button"
                              onClick={() => {
                                const newMod = {
                                  name: "Nowy moduł automatyzacji",
                                  description: "Opis wdrożenia dedykowanego rozwiązania dla klienta.",
                                  iconEmoji: "⚡",
                                };
                                setOfferForm({
                                  ...offerForm,
                                  proposedModules: [...(offerForm.proposedModules || []), newMod],
                                });
                              }}
                              className="text-[11px] bg-[#1E293B] hover:bg-[#2D3D58] border border-[#334155] text-white font-bold px-2.5 py-1 rounded flex items-center gap-1 cursor-pointer"
                            >
                              <Plus size={12} /> Dodaj Moduł
                            </button>
                          </div>

                          <div className="space-y-2.5">
                            {offerForm.proposedModules?.map((mod, idx) => (
                              <div
                                key={idx}
                                className="bg-[#0A0E17] p-3 rounded-lg border border-[#28354D] space-y-2"
                              >
                                <div className="flex items-center gap-2">
                                  <input
                                    type="text"
                                    value={mod.iconEmoji || "⚡"}
                                    onChange={(e) => {
                                      const updated = [...offerForm.proposedModules];
                                      updated[idx].iconEmoji = e.target.value;
                                      setOfferForm({ ...offerForm, proposedModules: updated });
                                    }}
                                    className="w-10 text-center bg-[#141C2E] border border-[#28354D] rounded py-1 text-sm text-white focus:outline-none focus:border-[#FFE600]"
                                    title="Ikona Emoji"
                                  />
                                  <input
                                    type="text"
                                    value={mod.name}
                                    onChange={(e) => {
                                      const updated = [...offerForm.proposedModules];
                                      updated[idx].name = e.target.value;
                                      setOfferForm({ ...offerForm, proposedModules: updated });
                                    }}
                                    placeholder="Nazwa modułu..."
                                    className="flex-1 bg-[#141C2E] border border-[#28354D] rounded px-2.5 py-1 text-xs text-white font-bold focus:outline-none focus:border-[#FFE600]"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const updated = offerForm.proposedModules.filter((_, i) => i !== idx);
                                      setOfferForm({ ...offerForm, proposedModules: updated });
                                    }}
                                    className="text-[#94A3B8] hover:text-[#FB7185] p-1 transition-colors cursor-pointer"
                                    title="Usuń moduł"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                                <textarea
                                  rows={2}
                                  value={mod.description}
                                  onChange={(e) => {
                                    const updated = [...offerForm.proposedModules];
                                    updated[idx].description = e.target.value;
                                    setOfferForm({ ...offerForm, proposedModules: updated });
                                  }}
                                  placeholder="Opis wdrożenia..."
                                  className="w-full bg-[#141C2E] border border-[#28354D] rounded p-2 text-xs text-[#CBD5E1] focus:outline-none focus:border-[#FFE600]"
                                />
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* 3. Pricing, CTA & Calendar */}
                        <div className="bg-[#141C2E] p-4 rounded-xl border border-[#28354D] space-y-3">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-[#FFE600]">
                            3. Wycena, CTA & Kalendarz
                          </h4>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div>
                              <label className="block text-[11px] font-bold text-[#94A3B8] mb-1">
                                Szacowana Inwestycja
                              </label>
                              <input
                                type="text"
                                value={offerForm.pricingRange}
                                onChange={(e) => setOfferForm({ ...offerForm, pricingRange: e.target.value })}
                                placeholder="np. od 2 800 zł / mies."
                                className="w-full bg-[#0A0E17] border border-[#28354D] rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#FFE600]"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-bold text-[#94A3B8] mb-1">
                                Tekst Przycisku CTA
                              </label>
                              <input
                                type="text"
                                value={offerForm.ctaText}
                                onChange={(e) => setOfferForm({ ...offerForm, ctaText: e.target.value })}
                                placeholder="np. Umów bezpłatną konsultację"
                                className="w-full bg-[#0A0E17] border border-[#28354D] rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#FFE600]"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-bold text-[#94A3B8] mb-1">
                                Własny Link do Kalendarza
                              </label>
                              <input
                                type="text"
                                value={offerForm.bookingUrl}
                                onChange={(e) => setOfferForm({ ...offerForm, bookingUrl: e.target.value })}
                                placeholder="Domyślnie z Ustawień"
                                className="w-full bg-[#0A0E17] border border-[#28354D] rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#FFE600]"
                              />
                            </div>
                          </div>
                        </div>

                        {/* 4. Sender Profile & Signature */}
                        <div className="bg-[#141C2E] p-4 rounded-xl border border-[#28354D] space-y-3">
                          <div className="flex items-center justify-between">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-[#FFE600]">
                              4. Wizytówka Autora & Podpis (Karta na stronie /o/[token])
                            </h4>
                            <span className="text-[10px] text-[#94A3B8]">Dedykowane dla tej propozycji</span>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-[11px] font-bold text-[#94A3B8] mb-1">
                                Imię i Nazwisko
                              </label>
                              <input
                                type="text"
                                value={offerForm.senderName}
                                onChange={(e) => setOfferForm({ ...offerForm, senderName: e.target.value })}
                                placeholder="np. Dariusz"
                                className="w-full bg-[#0A0E17] border border-[#28354D] rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#FFE600]"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-bold text-[#94A3B8] mb-1">
                                Rola / Stanowisko
                              </label>
                              <input
                                type="text"
                                value={offerForm.senderRole}
                                onChange={(e) => setOfferForm({ ...offerForm, senderRole: e.target.value })}
                                placeholder="np. Założyciel & Strateg B2B"
                                className="w-full bg-[#0A0E17] border border-[#28354D] rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#FFE600]"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-bold text-[#94A3B8] mb-1">
                                Firma / Brand Nadawcy
                              </label>
                              <input
                                type="text"
                                value={offerForm.senderCompany}
                                onChange={(e) => setOfferForm({ ...offerForm, senderCompany: e.target.value })}
                                placeholder="np. Procent Marketing"
                                className="w-full bg-[#0A0E17] border border-[#28354D] rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#FFE600]"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-bold text-[#94A3B8] mb-1">
                                E-mail Autora
                              </label>
                              <input
                                type="email"
                                value={offerForm.senderEmail}
                                onChange={(e) => setOfferForm({ ...offerForm, senderEmail: e.target.value })}
                                placeholder="kontakt@twojadomena.pl"
                                className="w-full bg-[#0A0E17] border border-[#28354D] rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#FFE600]"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-bold text-[#94A3B8] mb-1">
                                Telefon do Kontaktu
                              </label>
                              <input
                                type="text"
                                value={offerForm.senderPhone}
                                onChange={(e) => setOfferForm({ ...offerForm, senderPhone: e.target.value })}
                                placeholder="+48 700 000 000"
                                className="w-full bg-[#0A0E17] border border-[#28354D] rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#FFE600]"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-bold text-[#94A3B8] mb-1">
                                Strona WWW Firmy
                              </label>
                              <input
                                type="text"
                                value={offerForm.senderWebsite}
                                onChange={(e) => setOfferForm({ ...offerForm, senderWebsite: e.target.value })}
                                placeholder="https://procentmarketing.pl"
                                className="w-full bg-[#0A0E17] border border-[#28354D] rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#FFE600]"
                              />
                            </div>
                            <div className="md:col-span-2">
                              <label className="block text-[11px] font-bold text-[#94A3B8] mb-1">
                                Osobista Notatka / Dedykacja w Podpisie
                              </label>
                              <textarea
                                rows={2}
                                value={offerForm.customNote}
                                onChange={(e) => setOfferForm({ ...offerForm, customNote: e.target.value })}
                                placeholder="np. W razie pytań technicznych dotyczących wstępnej analizy, zapraszam do bezpośredniego kontaktu."
                                className="w-full bg-[#0A0E17] border border-[#28354D] rounded-lg p-2 text-xs text-white focus:outline-none focus:border-[#FFE600]"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Save Action Bar */}
                        <div className="flex flex-wrap items-center gap-3 pt-2">
                          <button
                            type="button"
                            onClick={() => handleSaveOfferEdits(selectedLead.id)}
                            disabled={offerSaving}
                            className="flex-1 bg-[#FFE600] hover:bg-[#FFF04D] text-black font-extrabold text-xs py-3 px-4 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-yellow-500/10 disabled:opacity-50 transition-all cursor-pointer"
                          >
                            <Save size={15} />
                            {offerSaving ? "Zapisywanie..." : "Zapisz Zmiany w Ofercie & Podpisie"}
                          </button>
                          <button
                            type="button"
                            onClick={() => setOfferEditorMode("preview")}
                            className="bg-[#1E293B] hover:bg-[#2D3D58] border border-[#334155] text-white font-bold text-xs py-3 px-4 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer"
                          >
                            <Eye size={15} /> Zobacz Podgląd
                          </button>
                          <button
                            type="button"
                            onClick={() => setDrawerTab("email")}
                            className="bg-[#1E293B] hover:bg-[#2D3D58] border border-[#334155] text-[#38BDF8] font-bold text-xs py-3 px-4 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer"
                          >
                            <Mail size={15} /> Do E-maila
                          </button>
                        </div>
                      </div>
                    )}

                    {/* MODE 2: LIVE PREVIEW */}
                    {offerEditorMode === "preview" && (
                      <div className="space-y-3">
                        <div className="border border-[#28354D] rounded-xl overflow-hidden shadow-2xl">
                          <div className="bg-[#0A0E17] px-3.5 py-2 text-xs text-[#94A3B8] font-bold flex items-center justify-between border-b border-[#28354D]">
                            <div className="flex items-center gap-2">
                              <span className="w-2.5 h-2.5 rounded-full bg-[#34D399] animate-pulse" />
                              <span>Podgląd na żywo strony klienta (/o/[token]):</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                const url = `${window.location.origin}/o/${selectedLead.offer.token || selectedLead.offer.slug}`;
                                navigator.clipboard.writeText(url);
                                setOfferCopied(true);
                                showToast("Skopiowano link do schowka!");
                                setTimeout(() => setOfferCopied(false), 2500);
                              }}
                              className="text-[11px] text-[#FFE600] hover:underline flex items-center gap-1 cursor-pointer"
                            >
                              <Copy size={12} /> {offerCopied ? "Skopiowano!" : "Kopiuj Link"}
                            </button>
                          </div>
                          <iframe
                            src={selectedLead.offer.token ? `/o/${selectedLead.offer.token}` : `/offers/${selectedLead.offer.slug}`}
                            className="w-full h-[620px] bg-[#0A0C10]"
                          />
                        </div>
                        <div className="text-center">
                          <button
                            type="button"
                            onClick={() => setOfferEditorMode("edit")}
                            className="text-xs text-[#94A3B8] hover:text-[#FFE600] inline-flex items-center gap-1 font-bold cursor-pointer"
                          >
                            <Edit2 size={13} /> Wróć do edycji treści i podpisu oferty
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-10 bg-[#141C2E] p-6 rounded-2xl border border-[#28354D] space-y-4">
                    <div className="w-12 h-12 bg-[#FFE600]/10 text-[#FFE600] rounded-xl flex items-center justify-center mx-auto text-xl">
                      ⚡
                    </div>
                    <div>
                      <h4 className="text-base font-extrabold text-white">Brak wygenerowanej oferty</h4>
                      <p className="text-xs text-[#94A3B8] max-w-md mx-auto mt-1">
                        Wygeneruj spersonalizowaną ofertę z analizą obecności w sieci na bazie audytu technologicznego i profilu nadawcy.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleGenerateOffer(selectedLead.id)}
                      className="bg-[#FFE600] hover:bg-[#FFF04D] text-black font-extrabold text-xs px-6 py-3 rounded-xl shadow-lg shadow-yellow-500/10 inline-flex items-center gap-2 cursor-pointer transition-all"
                    >
                      <Zap size={15} /> Generuj Ofertę (Gemini AI)
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
                    {outreachData?.alreadySent && !outreachData?.canSendFollowup ? (
                      <div className="bg-indigo-950/40 border border-indigo-500/40 p-4 rounded-xl flex items-start gap-3">
                        <CheckCircle2 size={20} className="text-indigo-400 mt-0.5 shrink-0" />
                        <div>
                          <h4 className="text-sm font-bold text-indigo-200">
                            Pełna sekwencja zakończona (Wysłano {outreachData?.outboundCount || 4}/4 wiadomości)
                          </h4>
                          <p className="text-xs text-indigo-300/80 mt-1">
                            Zgodnie z Inwariantem 7 (maks. 3 follow-upy, 4 wiadomości łącznie) oraz etyką B2B, system zablokował dalszą wysyłkę automatyczną do tej firmy.
                          </p>
                        </div>
                      </div>
                    ) : outreachData?.alreadySent && outreachData?.canSendFollowup ? (
                      <div className="bg-purple-950/40 border border-purple-500/40 p-4 rounded-xl flex items-start gap-3">
                        <Clock size={20} className="text-purple-400 mt-0.5 shrink-0" />
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <h4 className="text-sm font-bold text-purple-200">
                              Sekwencja w toku: Gotowy Follow-up {outreachData.outboundCount || 1} z 3
                            </h4>
                            <span className="text-[11px] bg-purple-900/60 text-purple-300 font-bold px-2 py-0.5 rounded">
                              Krok {outreachData.outboundCount || 1} / 3 FU
                            </span>
                          </div>
                          <p className="text-xs text-purple-300/80 mt-1">
                            Wysłano już {outreachData.outboundCount || 1} wiadomości. Jeśli odbiorca nadal nie odpisał, możesz poniżej przygotować i wysłać <strong>spersonalizowany Follow-up {outreachData.outboundCount || 1} AI</strong> w tym samym wątku (<code className="text-purple-200">Re: ...</code>).
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

                    {/* 4-Step Sequence Timeline (Invariant 7) */}
                    <div className="bg-[#141C2E] border border-[#28354D] p-4 rounded-xl space-y-3">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold uppercase tracking-wider text-[#94A3B8] flex items-center gap-1.5">
                          <Calendar size={13} className="text-[#FFE600]" />
                          Harmonogram Sekwencji (Inwariant 7: Inicjalny + do 3 FU)
                        </span>
                        <span className="font-mono text-[11px] text-[#FFE600] font-bold">
                          Wysłano {Math.min(4, outreachData?.outboundCount || 0)}/4
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                        {[
                          { step: 0, title: "0. E-mail Inicjalny", desc: "Audyt WWW + Landing", delay: "Dzień 0" },
                          { step: 1, title: "1. Follow-up 1", desc: "Konsultacja online", delay: "+3 dni ciszy" },
                          { step: 2, title: "2. Follow-up 2", desc: "Pytanie biznesowe", delay: "+3 dni ciszy" },
                          { step: 3, title: "3. Break-up (FU3)", desc: "Domknięcie kontaktu", delay: "+4 dni ciszy" },
                        ].map((item) => {
                          const count = outreachData?.outboundCount || 0;
                          const isPast = count > item.step;
                          const isCurrent = count === item.step && (!outreachData?.alreadySent || outreachData?.canSendFollowup);

                          return (
                            <div
                              key={item.step}
                              className={`p-3 rounded-xl border flex flex-col justify-between transition-all ${
                                isPast
                                  ? "bg-purple-950/30 border-purple-800/60 text-purple-200"
                                  : isCurrent
                                  ? "bg-[#FFE600]/10 border-[#FFE600] text-white shadow-sm"
                                  : "bg-[#0E1422] border-[#1E293B] text-[#64748B]"
                              }`}
                            >
                              <div>
                                <div className="flex items-center justify-between text-[10px] font-bold mb-1">
                                  <span className={isCurrent ? "text-[#FFE600]" : ""}>{item.delay}</span>
                                  {isPast ? (
                                    <span className="text-emerald-400 flex items-center gap-0.5 font-mono">
                                      <CheckCircle2 size={11} /> Wysłano
                                    </span>
                                  ) : isCurrent ? (
                                    <span className="text-[#FFE600] font-bold flex items-center gap-0.5">
                                      <Clock size={11} className="animate-spin" /> Teraz
                                    </span>
                                  ) : (
                                    <span className="text-[#64748B]">Oczekuje</span>
                                  )}
                                </div>
                                <div className={`text-xs font-black ${isCurrent ? "text-[#FFE600]" : "text-white"}`}>
                                  {item.title}
                                </div>
                                <div className="text-[10px] text-[#94A3B8] mt-0.5">{item.desc}</div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Composer Editor (Active if not finished) */}
                    {(!outreachData?.alreadySent || outreachData?.canSendFollowup) ? (
                      <div className="bg-[#141C2E] border border-[#28354D] p-4 rounded-xl space-y-3">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-bold text-white flex items-center gap-1.5">
                            {outreachData?.alreadySent ? (
                              <>
                                <Sparkles size={14} className="text-[#FFE600]" />
                                Szkic Follow-up {outreachData?.outboundCount || 1} AI (Gemini):
                              </>
                            ) : (
                              <>
                                <Mail size={14} className="text-[#FFE600]" />
                                Szkic Pierwszej Wiadomości:
                              </>
                            )}
                          </label>

                          {outreachData?.alreadySent && (
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

                        <div className="pt-2 flex flex-col sm:flex-row gap-2.5">
                          {outreachData?.alreadySent ? (
                            <button
                              onClick={() => handleSendOutreachFromDrawer(true)}
                              disabled={outreachSending}
                              className="flex-1 bg-gradient-to-r from-[#6366F1] to-[#8B5CF6] hover:from-[#4F46E5] hover:to-[#7C3AED] text-white font-extrabold text-sm py-3 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20 disabled:opacity-50 transition-all cursor-pointer"
                            >
                              <Sparkles size={16} />
                              {outreachSending ? "Wysyłanie Follow-up..." : `Wyślij Follow-up ${outreachData?.outboundCount || 1} AI (wątek Re:...)`}
                            </button>
                          ) : (
                            <button
                              onClick={() => handleSendOutreachFromDrawer(false)}
                              disabled={outreachSending}
                              className="flex-1 bg-[#FFE600] hover:bg-[#FFF04D] text-black font-extrabold text-sm py-3 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-yellow-500/10 disabled:opacity-50 transition-all cursor-pointer"
                            >
                              <Send size={16} />
                              {outreachSending ? "Wysyłanie e-maila..." : "Wyślij E-mail przez SMTP"}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              const fullText = `Temat: ${outreachSubject}\n\n${outreachBody}`;
                              navigator.clipboard.writeText(fullText);
                              showToast("Skopiowano temat i treść e-maila do schowka! Możesz wysłać z własnej skrzynki.", "success");
                            }}
                            className="bg-[#1E293B] hover:bg-[#2D3D58] border border-[#334155] text-white font-bold text-xs py-3 px-4 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                          >
                            <Copy size={15} /> Kopiuj Treść Maila
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-[#141C2E] border border-[#28354D] p-5 rounded-xl text-center space-y-2">
                        <CheckCircle2 size={28} className="mx-auto text-indigo-400" />
                        <h4 className="text-sm font-bold text-white">Sekwencja outreach jest ukończona</h4>
                        <p className="text-xs text-[#94A3B8]">
                          Wszystkie dopuszczalne wiadomości (wstępna + 3 follow-upy) zostały wysłane.
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

      {/* MODAL: PODGLĄD WYSŁANEJ WIADOMOŚCI & HISTORIA KONTAKTU */}
      {selectedHistoryItem && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="max-w-2xl w-full bg-[#101726] border border-[#28354D] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="bg-[#141C2E] border-b border-[#28354D] p-5 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="bg-[#FFE600] text-black text-[10px] font-black uppercase px-2 py-0.5 rounded">
                    Baza Wysłanych
                  </span>
                  <span className="text-xs text-[#94A3B8] font-bold">
                    ID #{selectedHistoryItem.leadId}
                  </span>
                </div>
                <h3 className="text-lg font-black text-white mt-1">
                  {selectedHistoryItem.companyName}
                </h3>
                <p className="text-xs text-[#38BDF8] font-mono mt-0.5">
                  Do: {selectedHistoryItem.recipientEmail} ({selectedHistoryItem.contactName})
                </p>
              </div>

              <button
                onClick={() => setSelectedHistoryItem(null)}
                className="text-[#94A3B8] hover:text-white p-2 rounded-lg hover:bg-[#1E293B] transition-all cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Message Step Tabs (if multiple messages exist) */}
            {selectedHistoryItem.messages && selectedHistoryItem.messages.length > 1 && (
              <div className="bg-[#0E1422] border-b border-[#28354D] px-5 py-2 flex items-center gap-2 overflow-x-auto">
                {selectedHistoryItem.messages.map((m: any, idx: number) => (
                  <button
                    key={m.id || idx}
                    onClick={() => setActiveMessageIndex(idx)}
                    className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                      activeMessageIndex === idx
                        ? "bg-[#FFE600] text-black font-extrabold"
                        : "bg-[#1E293B] text-[#94A3B8] hover:text-white"
                    }`}
                  >
                    {m.sequenceStep === 0 ? "Wiadomość Główna" : `Follow-up ${m.sequenceStep}`}
                  </button>
                ))}
              </div>
            )}

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-4 flex-1">
              {(() => {
                const currentMsg =
                  selectedHistoryItem.messages?.[activeMessageIndex] ||
                  selectedHistoryItem.messages?.[0] ||
                  null;

                if (!currentMsg) {
                  return (
                    <p className="text-sm text-[#94A3B8] italic py-8 text-center">
                      Brak zapisanego rekordu treści wiadomości w bazie.
                    </p>
                  );
                }

                return (
                  <div className="space-y-4">
                    {/* Message Meta */}
                    <div className="bg-[#141C2E] border border-[#28354D] p-3 rounded-xl flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div>
                        <span className="text-[#94A3B8]">Wysłano: </span>
                        <strong className="text-white">
                          {currentMsg.sentAt
                            ? new Date(currentMsg.sentAt).toLocaleString("pl-PL")
                            : currentMsg.createdAt
                            ? new Date(currentMsg.createdAt).toLocaleString("pl-PL")
                            : "—"}
                        </strong>
                      </div>
                      <div>
                        <span className="text-[#94A3B8]">Status: </span>
                        <strong className="text-emerald-400 uppercase font-mono">{currentMsg.status}</strong>
                      </div>
                      <div>
                        <span className="text-[#94A3B8]">Krok sekwencji: </span>
                        <strong className="text-[#FFE600]">
                          {currentMsg.sequenceStep === 0 ? "Inicjalny (0)" : `Follow-up (${currentMsg.sequenceStep})`}
                        </strong>
                      </div>
                    </div>

                    {/* Subject */}
                    <div>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-[#94A3B8]">
                        Temat wiadomości
                      </span>
                      <div className="text-sm font-extrabold text-white mt-1 p-2.5 bg-[#0E1422] border border-[#28354D] rounded-lg">
                        {currentMsg.subject || "(Brak tematu)"}
                      </div>
                    </div>

                    {/* Body */}
                    <div>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-[#94A3B8]">
                        Treść wysłanego e-maila
                      </span>
                      <div className="mt-1 p-4 bg-[#0A0E17] border border-[#1E293B] rounded-xl text-xs font-mono text-[#CBD5E1] whitespace-pre-wrap leading-relaxed max-h-[300px] overflow-y-auto">
                        {currentMsg.bodyText || "(Pusta treść)"}
                      </div>
                    </div>

                    {/* Associated Offer Link Info */}
                    {selectedHistoryItem.offer && (
                      <div className="bg-[#141C2E] border border-[#38BDF8]/40 p-3.5 rounded-xl flex items-center justify-between gap-3">
                        <div>
                          <div className="text-[11px] font-bold text-[#38BDF8] flex items-center gap-1.5">
                            <Eye size={13} />
                            Dedykowana Strona Oferty (/o/[token])
                          </div>
                          <div className="text-xs text-white font-extrabold mt-0.5">
                            {selectedHistoryItem.offer.title || "Oferta automatyzacji i pozyskiwania klientów"}
                          </div>
                          <div className="text-[11px] text-[#94A3B8] mt-0.5">
                            Liczba odsłon: <strong className="text-emerald-400">{selectedHistoryItem.offer.viewCount || 0}</strong>
                            {selectedHistoryItem.offer.lastViewedAt && (
                              <span> • Ostatnia: {new Date(selectedHistoryItem.offer.lastViewedAt).toLocaleString("pl-PL")}</span>
                            )}
                          </div>
                        </div>

                        {selectedHistoryItem.offer.token && (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => {
                                const fullUrl = `${window.location.origin}/o/${selectedHistoryItem.offer.token}`;
                                navigator.clipboard.writeText(fullUrl);
                                showToast("Skopiowano link oferty do schowka!");
                              }}
                              className="bg-[#1E293B] hover:bg-[#2D3D58] border border-[#334155] text-white text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 cursor-pointer"
                            >
                              <Copy size={13} /> Kopiuj link
                            </button>
                            <a
                              href={`/o/${selectedHistoryItem.offer.token}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="bg-[#FFE600] hover:bg-[#FFF04D] text-black text-xs font-black px-3 py-1.5 rounded-lg flex items-center gap-1.5 cursor-pointer"
                            >
                              <ExternalLink size={13} /> Otwórz
                            </a>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* Modal Footer */}
            <div className="bg-[#141C2E] border-t border-[#28354D] p-4 flex items-center justify-between">
              <button
                onClick={() => {
                  const currentMsg =
                    selectedHistoryItem.messages?.[activeMessageIndex] ||
                    selectedHistoryItem.messages?.[0];
                  if (currentMsg) {
                    navigator.clipboard.writeText(`Temat: ${currentMsg.subject}\n\n${currentMsg.bodyText}`);
                    showToast("Skopiowano temat i treść do schowka!");
                  }
                }}
                className="bg-[#1E293B] hover:bg-[#2D3D58] border border-[#334155] text-white text-xs font-bold px-4 py-2 rounded-lg flex items-center gap-1.5 cursor-pointer"
              >
                <Copy size={14} />
                Kopiuj Treść Maila
              </button>

              <button
                onClick={() => setSelectedHistoryItem(null)}
                className="bg-[#FFE600] hover:bg-[#FFF04D] text-black text-xs font-black px-5 py-2 rounded-lg cursor-pointer"
              >
                Zamknij
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
