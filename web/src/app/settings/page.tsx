"use client";

import React, { useEffect, useState, useCallback, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Settings as SettingsIcon,
  Target,
  User,
  Server,
  Users,
  Building2,
  Save,
  LayoutDashboard,
} from "lucide-react";
import { ToastNotification, ToastMessage } from "@/components/ui/toast-notification";
import { TargetingSection, TargetingSettingsState } from "@/components/settings/targeting-section";
import { SenderProfileSection, SenderProfileState } from "@/components/settings/sender-profile-section";
import { MailAndApiSection, MailSettingsState } from "@/components/settings/mail-api-section";
import { TeamSection, TeamUserState, InvitationState } from "@/components/settings/team-section";
import { OrganizationsSection, TenantDetails } from "@/components/settings/organizations-section";

type SettingsTab = "targeting" | "sender" | "mail" | "team" | "organizations";

function SettingsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get("tab") as SettingsTab) || "targeting";
  const [activeTab, setActiveTab] = useState<SettingsTab>(
    ["targeting", "sender", "mail", "team", "organizations"].includes(initialTab) ? initialTab : "targeting"
  );

  const [toast, setToast] = useState<ToastMessage | null>(null);

  const showToast = (message: string, type: "success" | "error" | "info" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Targeting state
  const [targetingSettings, setTargetingSettings] = useState<TargetingSettingsState>({
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
    ],
    targetCompanyScales: ["mikro", "male"],
    excludedKeywords: [],
    notes: "",
  });
  const [targetingLoading, setTargetingLoading] = useState(false);

  // Sender profile state
  const [senderProfile, setSenderProfile] = useState<SenderProfileState>({
    senderName: "Dariusz",
    senderRole: "Założyciel & Strateg B2B",
    senderCompany: "Procent Marketing",
    senderEmail: "kontakt@procentmarketing.pl",
    senderPhone: "+48 700 000 000",
    senderWebsite: "https://procentmarketing.pl",
    bookingUrl: "https://cal.com/procentmarketing/15min",
    customNote: "W razie pytań technicznych dotyczących wstępnej analizy, zapraszam do bezpośredniego kontaktu.",
  });
  const [senderProfileLoading, setSenderProfileLoading] = useState(false);

  // Mail & API settings state
  const [mailSettings, setMailSettings] = useState<MailSettingsState>({
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

  // Team state
  const [teamUsersList, setTeamUsersList] = useState<TeamUserState[]>([]);
  const [invitationsList, setInvitationsList] = useState<InvitationState[]>([]);
  const [currentUser, setCurrentUser] = useState<{
    id: number;
    email: string;
    name: string;
    role: string;
  } | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [inviteGenerating, setInviteGenerating] = useState(false);
  const [generatedInviteUrl, setGeneratedInviteUrl] = useState<string | null>(null);

  // Tenants state
  const [tenantsList, setTenantsList] = useState<TenantDetails[]>([]);
  const [activeTenantId, setActiveTenantId] = useState<number | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  const fetchAllSettings = useCallback(async () => {
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
      }
    } catch {}

    try {
      const resSender = await fetch("/api/settings/sender-profile");
      const dataSender = await resSender.json();
      if (dataSender.success && dataSender.profile) {
        setSenderProfile(dataSender.profile);
      }
    } catch {}

    try {
      const resUser = await fetch("/api/auth/me");
      const dataUser = await resUser.json();
      if (dataUser.success && dataUser.user) {
        setCurrentUser(dataUser.user);
      }
    } catch {}

    try {
      const resTeam = await fetch("/api/auth/invitations");
      const dataTeam = await resTeam.json();
      if (dataTeam.success) {
        setInvitationsList(dataTeam.invitations || []);
        setTeamUsersList(dataTeam.users || []);
      }
    } catch {}

    try {
      const resTenants = await fetch("/api/tenants");
      const dataTenants = await resTenants.json();
      if (dataTenants.success) {
        setTenantsList(dataTenants.tenants || []);
        setActiveTenantId(dataTenants.activeTenantId ?? null);
        setIsSuperAdmin(Boolean(dataTenants.isSuperAdmin));
      }
    } catch {}
  }, []);

  useEffect(() => {
    fetchAllSettings();
  }, [fetchAllSettings]);

  const switchTab = (tab: SettingsTab) => {
    setActiveTab(tab);
    router.replace(`/settings?tab=${tab}`, { scroll: false });
  };

  // Save Targeting
  const handleSaveTargeting = async () => {
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
      } else {
        showToast(data.error || "Błąd zapisu preferencji", "error");
      }
    } catch {
      showToast("Błąd połączenia z serwerem", "error");
    } finally {
      setTargetingLoading(false);
    }
  };

  // Save Sender Profile
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
        showToast("Profil nadawcy został zapisany!", "success");
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

  // Test SMTP
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
      showToast(data.message, data.success ? "success" : "error");
    } catch {
      showToast("Błąd wykonania testu SMTP", "error");
    } finally {
      setSmtpTesting(false);
    }
  };

  // Test IMAP
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
      showToast(data.message, data.success ? "success" : "error");
    } catch {
      showToast("Błąd wykonania testu IMAP", "error");
    } finally {
      setImapTesting(false);
    }
  };

  // Test Google API
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

  // Master Save All
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
        await fetchAllSettings();
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

  // Team actions
  const handleCreateInvitation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail) return;
    setInviteGenerating(true);
    try {
      const res = await fetch("/api/auth/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: inviteEmail,
          role: inviteRole,
          maxUses: 1,
          expiresInDays: 7,
        }),
      });
      const data = await res.json();
      if (data.success && data.inviteUrl) {
        setGeneratedInviteUrl(data.inviteUrl);
        setInviteEmail("");
        showToast("Wygenerowano imienne zaproszenie!", "success");
        fetchAllSettings();
      } else {
        showToast(data.error || "Błąd generowania zaproszenia", "error");
      }
    } catch {
      showToast("Błąd serwera", "error");
    } finally {
      setInviteGenerating(false);
    }
  };

  const handleRevokeInvitation = async (id: number) => {
    if (!confirm("Czy na pewno chcesz unieważnić to zaproszenie?")) return;
    try {
      const res = await fetch(`/api/auth/invitations/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        showToast("Zaproszenie zostało unieważnione", "success");
        fetchAllSettings();
      } else {
        showToast(data.error || "Błąd usuwania", "error");
      }
    } catch {
      showToast("Błąd serwera", "error");
    }
  };

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
        fetchAllSettings();
      } else {
        showToast(data.error || "Błąd aktualizacji roli", "error");
      }
    } catch {
      showToast("Błąd połączenia z serwerem", "error");
    }
  };

  const handleDeleteUser = async (userId: number, userName: string) => {
    if (!confirm(`Czy na pewno chcesz odebrać dostęp do systemu dla użytkownika: ${userName}?`)) return;
    try {
      showToast("Cofanie dostępu dla użytkownika...", "info");
      const res = await fetch(`/api/auth/users/${userId}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        showToast(data.message || "Użytkownik został usunięty z organizacji", "success");
        fetchAllSettings();
      } else {
        showToast(data.error || "Błąd usuwania użytkownika", "error");
      }
    } catch {
      showToast("Błąd połączenia z serwerem", "error");
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0E17] text-[#F8FAFC]">
      <ToastNotification toast={toast} />

      {/* Top Header */}
      <header className="bg-[#0E1422] border-b border-[#28354D] px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard"
            className="flex items-center gap-1.5 text-xs font-bold text-[#38BDF8] hover:underline"
          >
            <LayoutDashboard size={14} />
            Dashboard
          </Link>
          <span className="text-[#28354D]">/</span>
          <div className="flex items-center gap-2">
            <SettingsIcon size={18} className="text-[#FFE600]" />
            <h1 className="text-base font-extrabold text-white">Ustawienia & Integracje</h1>
          </div>
        </div>

        <button
          type="button"
          onClick={handleSaveAllSettings}
          disabled={settingsLoading || targetingLoading || senderProfileLoading}
          className="bg-[#FFE600] hover:bg-[#FFF04D] text-black font-extrabold text-xs px-5 py-2.5 rounded-xl flex items-center gap-2 transition-all shadow-lg shadow-yellow-500/20 disabled:opacity-50 cursor-pointer"
        >
          <Save size={16} />
          {settingsLoading ? "Zapisywanie..." : "💾 Zapisz Wszystko"}
        </button>
      </header>

      {/* Main Container */}
      <main className="max-w-5xl mx-auto p-6 space-y-6">
        {/* Navigation Tabs */}
        <div className="flex border-b border-[#28354D] gap-2 pb-1 overflow-x-auto text-sm font-bold">
          <button
            type="button"
            onClick={() => switchTab("targeting")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all cursor-pointer ${
              activeTab === "targeting"
                ? "bg-[#FFE600] text-black shadow-md font-black"
                : "text-[#94A3B8] hover:text-white hover:bg-[#141C2E]"
            }`}
          >
            <Target size={16} />
            Targetowanie & Rynek
          </button>

          <button
            type="button"
            onClick={() => switchTab("sender")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all cursor-pointer ${
              activeTab === "sender"
                ? "bg-[#FFE600] text-black shadow-md font-black"
                : "text-[#94A3B8] hover:text-white hover:bg-[#141C2E]"
            }`}
          >
            <User size={16} />
            Profil Nadawcy & Podpis
          </button>

          <button
            type="button"
            onClick={() => switchTab("mail")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all cursor-pointer ${
              activeTab === "mail"
                ? "bg-[#FFE600] text-black shadow-md font-black"
                : "text-[#94A3B8] hover:text-white hover:bg-[#141C2E]"
            }`}
          >
            <Server size={16} />
            Poczta (SMTP/IMAP) & API
          </button>

          <button
            type="button"
            onClick={() => switchTab("team")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all cursor-pointer ${
              activeTab === "team"
                ? "bg-[#FFE600] text-black shadow-md font-black"
                : "text-[#94A3B8] hover:text-white hover:bg-[#141C2E]"
            }`}
          >
            <Users size={16} />
            Zespół & Zaproszenia ({teamUsersList.length})
          </button>

          <button
            type="button"
            onClick={() => switchTab("organizations")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all cursor-pointer ${
              activeTab === "organizations"
                ? "bg-[#FFE600] text-black shadow-md font-black"
                : "text-[#94A3B8] hover:text-white hover:bg-[#141C2E]"
            }`}
          >
            <Building2 size={16} />
            Organizacje & Tenanty ({tenantsList.length})
          </button>
        </div>

        {/* Tab Contents */}
        {activeTab === "targeting" && (
          <TargetingSection
            settings={targetingSettings}
            onChange={setTargetingSettings}
            onSave={handleSaveTargeting}
            loading={targetingLoading}
          />
        )}

        {activeTab === "sender" && (
          <SenderProfileSection
            profile={senderProfile}
            onChange={setSenderProfile}
            onSave={handleSaveSenderProfile}
            loading={senderProfileLoading}
          />
        )}

        {activeTab === "mail" && (
          <MailAndApiSection
            settings={mailSettings}
            onChange={setMailSettings}
            onTestSmtp={handleTestSmtp}
            smtpTesting={smtpTesting}
            onTestImap={handleTestImap}
            imapTesting={imapTesting}
            onTestGoogleApi={handleTestGoogleApi}
            googleTesting={googleTesting}
            googleDiagnostic={googleDiagnostic}
          />
        )}

        {activeTab === "team" && (
          <TeamSection
            users={teamUsersList}
            invitations={invitationsList}
            currentUser={currentUser}
            inviteEmail={inviteEmail}
            setInviteEmail={setInviteEmail}
            inviteRole={inviteRole}
            setInviteRole={setInviteRole}
            inviteGenerating={inviteGenerating}
            generatedInviteUrl={generatedInviteUrl}
            onCreateInvitation={handleCreateInvitation}
            onRevokeInvitation={handleRevokeInvitation}
            onUpdateUserRole={handleUpdateUserRole}
            onDeleteUser={handleDeleteUser}
            onCopyUrl={(url) => {
              navigator.clipboard.writeText(url);
              showToast("Skopiowano link do schowka!", "success");
            }}
          />
        )}

        {activeTab === "organizations" && (
          <OrganizationsSection
            tenants={tenantsList}
            activeTenantId={activeTenantId}
            isSuperAdmin={isSuperAdmin}
            onRefresh={fetchAllSettings}
          />
        )}
      </main>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#0A0E17] flex items-center justify-center text-white">
          <div className="flex items-center gap-2 text-sm text-[#94A3B8]">
            <Server size={18} className="animate-spin text-[#FFE600]" />
            <span>Ładowanie ustawień...</span>
          </div>
        </div>
      }
    >
      <SettingsPageContent />
    </Suspense>
  );
}
