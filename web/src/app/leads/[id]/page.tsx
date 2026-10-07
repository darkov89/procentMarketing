"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { FullLeadDossier, DossierTab } from "@/components/lead-dossier/dossier-types";
import { DossierHeader } from "@/components/lead-dossier/dossier-header";
import { DossierCompanyDataTab } from "@/components/lead-dossier/tabs/dossier-company-data-tab";
import { DossierAuditEvidenceTab } from "@/components/lead-dossier/tabs/dossier-audit-evidence-tab";
import { DossierContactsTab } from "@/components/lead-dossier/tabs/dossier-contacts-tab";
import { DossierOfferStudioTab } from "@/components/lead-dossier/tabs/dossier-offer-studio-tab";
import { DossierCorrespondenceTab } from "@/components/lead-dossier/tabs/dossier-correspondence-tab";
import { DossierTasksNotesTab } from "@/components/lead-dossier/tabs/dossier-tasks-notes-tab";
import { DossierHistoryAuditTab } from "@/components/lead-dossier/tabs/dossier-history-audit-tab";
import { ToastNotification, ToastMessage } from "@/components/ui/toast-notification";
import { RefreshCw, AlertTriangle } from "lucide-react";
import Link from "next/link";

export default function LeadDossierPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();

  const leadId = params.id as string;
  const initialTab = (searchParams.get("tab") as DossierTab) || "dane";

  const [lead, setLead] = useState<FullLeadDossier | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<DossierTab>(
    ["dane", "dowody", "kontakt", "oferta", "korespondencja", "zadania", "historia"].includes(initialTab)
      ? initialTab
      : "dane"
  );
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [isAuditing, setIsAuditing] = useState(false);
  const [isQualifying, setIsQualifying] = useState(false);
  const [isGeneratingOffer, setIsGeneratingOffer] = useState(false);

  const showToast = useCallback((message: string, type: "success" | "error" | "info" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  const fetchLead = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/leads/${leadId}`);
      const data = await res.json();
      if (data.success && data.lead) {
        setLead(data.lead);
      } else {
        showToast(data.error || "Nie udało się pobrać leada", "error");
      }
    } catch {
      showToast("Błąd połączenia z bazą leadów", "error");
    } finally {
      setLoading(false);
    }
  }, [leadId, showToast]);

  useEffect(() => {
    fetchLead();
  }, [fetchLead]);

  const switchTab = (tab: DossierTab) => {
    setActiveTab(tab);
    router.replace(`/leads/${leadId}?tab=${tab}`, { scroll: false });
  };

  const handleUpdateLead = async (data: Partial<FullLeadDossier>) => {
    try {
      const res = await fetch(`/api/leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const resData = await res.json();
      if (resData.success) {
        showToast("Zaktualizowano dane leada!", "success");
        fetchLead();
      } else {
        showToast(resData.error || "Błąd zapisu danych leada", "error");
      }
    } catch {
      showToast("Błąd połączenia z serwerem", "error");
    }
  };

  const handleRunAudit = async () => {
    setIsAuditing(true);
    showToast("Uruchamianie bezpiecznego audytora WWW...", "info");
    try {
      const res = await fetch(`/api/leads/${leadId}/audit`, { method: "POST" });
      const data = await res.json();
      if (data.success) {
        showToast("Audyt zakończony pomyślnie!", "success");
        fetchLead();
      } else {
        showToast(data.error || "Błąd podczas wykonywania audytu", "error");
      }
    } catch {
      showToast("Błąd połączenia z modułem audytora", "error");
    } finally {
      setIsAuditing(false);
    }
  };

  const handleRunQualify = async () => {
    setIsQualifying(true);
    showToast("Przeliczanie scoringu i reguł kwalifikacji...", "info");
    try {
      const res = await fetch(`/api/leads/${leadId}/qualify`, { method: "POST" });
      const data = await res.json();
      if (data.success) {
        showToast("Scoring przeliczony pomyślnie!", "success");
        fetchLead();
      } else {
        showToast(data.error || "Błąd przeliczania scoringu", "error");
      }
    } catch {
      showToast("Błąd połączenia z silnikiem kwalifikacji", "error");
    } finally {
      setIsQualifying(false);
    }
  };

  const handleGenerateOffer = async () => {
    setIsGeneratingOffer(true);
    showToast("Generowanie dedykowanej oferty i strony lądowania...", "info");
    try {
      const res = await fetch(`/api/offers/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId: parseInt(leadId, 10) }),
      });
      const data = await res.json();
      if (data.success) {
        showToast("Oferta została pomyślnie wygenerowana!", "success");
        fetchLead();
      } else {
        showToast(data.error || "Błąd generowania oferty", "error");
      }
    } catch {
      showToast("Błąd połączenia z generatorem ofert", "error");
    } finally {
      setIsGeneratingOffer(false);
    }
  };

  if (loading && !lead) {
    return (
      <div className="min-h-screen bg-[#070A11] flex items-center justify-center text-white">
        <div className="flex items-center gap-3 text-sm text-[#94A3B8]">
          <RefreshCw size={20} className="animate-spin text-[#FFE600]" />
          Ładowanie Dossier Leada #{leadId}...
        </div>
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="min-h-screen bg-[#070A11] flex items-center justify-center text-white p-4">
        <div className="bg-[#141C2E] border border-[#28354D] p-8 rounded-2xl max-w-md w-full text-center space-y-4">
          <AlertTriangle size={36} className="mx-auto text-rose-400" />
          <h2 className="text-lg font-bold">Nie znaleziono leada</h2>
          <p className="text-xs text-[#94A3B8]">
            Lead o podanym identyfikatorze nie istnieje lub nie masz uprawnień do jego wyświetlenia.
          </p>
          <Link
            href="/leads"
            className="inline-block bg-[#FFE600] text-black font-extrabold text-xs px-4 py-2 rounded-lg"
          >
            Powrót do CRM
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#070A11] text-white">
      {toast && <ToastNotification toast={toast} />}

      <DossierHeader
        lead={lead}
        activeTab={activeTab}
        onTabChange={switchTab}
        onRefresh={fetchLead}
        loading={loading}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {activeTab === "dane" && (
          <DossierCompanyDataTab
            lead={lead}
            onUpdateLead={handleUpdateLead}
            onRunAudit={handleRunAudit}
            onRunQualify={handleRunQualify}
            isAuditing={isAuditing}
            isQualifying={isQualifying}
          />
        )}

        {activeTab === "dowody" && (
          <DossierAuditEvidenceTab
            lead={lead}
            onRunAudit={handleRunAudit}
            isAuditing={isAuditing}
          />
        )}

        {activeTab === "kontakt" && (
          <DossierContactsTab
            lead={lead}
            onRefresh={fetchLead}
            showToast={showToast}
          />
        )}

        {activeTab === "oferta" && (
          <DossierOfferStudioTab
            lead={lead}
            onGenerateOffer={handleGenerateOffer}
            onRefresh={fetchLead}
            showToast={showToast}
            isGenerating={isGeneratingOffer}
          />
        )}

        {activeTab === "korespondencja" && (
          <DossierCorrespondenceTab
            lead={lead}
            onRefresh={fetchLead}
            showToast={showToast}
          />
        )}

        {activeTab === "zadania" && (
          <DossierTasksNotesTab
            lead={lead}
            showToast={showToast}
          />
        )}

        {activeTab === "historia" && (
          <DossierHistoryAuditTab lead={lead} />
        )}
      </main>
    </div>
  );
}
