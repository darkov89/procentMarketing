"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { PendingOutboxLead } from "@/components/outbox/outbox-types";
import { OutboxLeadCard } from "@/components/outbox/outbox-lead-card";
import { ToastNotification, ToastMessage } from "@/components/ui/toast-notification";
import {
  ShieldCheck,
  Send,
  RefreshCw,
  Search,
  CheckCircle2,
  History,
  ArrowLeft,
} from "lucide-react";

export default function OutboxPage() {
  const [leads, setLeads] = useState<PendingOutboxLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [search, setSearch] = useState("");
  const [batchSending, setBatchSending] = useState(false);
  const [sendingSingleId, setSendingSingleId] = useState<number | null>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const showToast = useCallback((message: string, type: "success" | "error" | "info" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  const fetchPendingLeads = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/leads");
      const data = await res.json();
      if (data.success && Array.isArray(data.leads)) {
        // Leads that have offer ready or approved and not yet sent terminal
        const pending = data.leads.filter(
          (l: PendingOutboxLead) =>
            l.offer &&
            ["approved", "offer_ready", "qualified"].includes(l.status)
        );
        setLeads(pending);
      }
    } catch {
      showToast("Błąd pobierania bazy oczekujących ofert", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchPendingLeads();
  }, [fetchPendingLeads]);

  const handleToggleSelect = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(leads.map((l) => l.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSendSingle = async (leadId: number) => {
    setSendingSingleId(leadId);
    showToast(`Wysyłanie maila do leada #${leadId}...`, "info");
    try {
      const res = await fetch(`/api/outreach/${leadId}`, { method: "POST" });
      const data = await res.json();
      if (data.success) {
        showToast("Wiadomość została wysłana!", "success");
        setLeads((prev) => prev.filter((l) => l.id !== leadId));
        setSelectedIds((prev) => prev.filter((id) => id !== leadId));
      } else {
        showToast(data.error || "Błąd wysyłki wiadomości", "error");
      }
    } catch {
      showToast("Błąd połączenia z serwerem wysyłkowym", "error");
    } finally {
      setSendingSingleId(null);
    }
  };

  const handleSendBatch = async (targetIds?: number[]) => {
    const idsToSend = targetIds || (selectedIds.length > 0 ? selectedIds : leads.map((l) => l.id));
    if (idsToSend.length === 0) {
      showToast("Brak leadów do wysyłki", "error");
      return;
    }

    setBatchSending(true);
    showToast(`Inicjowanie bezpiecznej wysyłki partii (${idsToSend.length} maili)...`, "info");

    try {
      const res = await fetch("/api/outreach/send-all", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadIds: idsToSend }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Wysłano pomyślnie ${data.sentCount || idsToSend.length} wiadomości!`, "success");
        fetchPendingLeads();
        setSelectedIds([]);
      } else {
        showToast(data.error || "Błąd wysyłki partii", "error");
      }
    } catch {
      showToast("Błąd połączenia z serwerem wysyłkowym", "error");
    } finally {
      setBatchSending(false);
    }
  };

  const filteredLeads = leads.filter((lead) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      lead.companyName.toLowerCase().includes(q) ||
      (lead.city && lead.city.toLowerCase().includes(q)) ||
      (lead.industry && lead.industry.toLowerCase().includes(q))
    );
  });

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
              <ShieldCheck className="text-[#FFE600]" size={20} />
              Zatwierdzanie & Outbox
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/outbox/history"
              className="text-xs bg-[#141C2E] hover:bg-[#1E293B] border border-[#28354D] text-[#38BDF8] px-3.5 py-2 rounded-xl flex items-center gap-1.5 font-bold"
            >
              <History size={14} /> Baza Wysłanych & Metryki
            </Link>
            <button
              onClick={() => handleSendBatch()}
              disabled={batchSending || leads.length === 0}
              className="bg-[#FFE600] hover:bg-[#FFF04D] text-black font-black text-xs px-5 py-2 rounded-xl flex items-center gap-2 shadow-lg shadow-yellow-500/10 disabled:opacity-50"
            >
              <Send size={14} className={batchSending ? "animate-spin" : ""} />
              {batchSending ? "Wysyłanie..." : `Wyślij wszystko (${leads.length})`}
            </button>
          </div>
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Banner AI Act Art. 14 */}
        <div className="bg-[#141C2E] border-2 border-[#FFE600]/60 p-6 rounded-2xl shadow-xl space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="bg-[#FFE600] text-black text-[10px] font-black uppercase px-2.5 py-0.5 rounded tracking-wider">
                  AI Act Art. 14 • Human Oversight
                </span>
                <span className="bg-emerald-950/80 text-emerald-400 border border-emerald-500/40 text-[10px] font-bold px-2 py-0.5 rounded">
                  Tryb: Kontrolowany
                </span>
              </div>
              <h2 className="text-xl font-black text-white mt-2">
                Centrum Zatwierdzania Kampanii & Wysyłki Ofert
              </h2>
              <p className="text-xs text-[#94A3B8] mt-1 max-w-2xl">
                Zgodnie z wymogami prawnymi żadna wiadomość nie jest wysyłana automatycznie bez zatwierdzenia.
                Przejrzyj przygotowane oferty przed wysłaniem.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-[#28354D] text-xs">
            <div className="bg-[#0A0E17] p-2.5 rounded-lg border border-[#28354D]">
              <span className="text-[#94A3B8] block text-[10px] uppercase font-bold">Gotowe do wysyłki</span>
              <span className="text-white font-extrabold text-base">{leads.length} ofert</span>
            </div>
            <div className="bg-[#0A0E17] p-2.5 rounded-lg border border-[#28354D]">
              <span className="text-[#94A3B8] block text-[10px] uppercase font-bold">Zaznaczone</span>
              <span className="text-[#FFE600] font-extrabold text-base">{selectedIds.length} firm</span>
            </div>
            <div className="bg-[#0A0E17] p-2.5 rounded-lg border border-[#28354D]">
              <span className="text-[#94A3B8] block text-[10px] uppercase font-bold">Kill-switch</span>
              <span className="text-[#38BDF8] font-extrabold text-base">STOP = Aktywny</span>
            </div>
            <div className="bg-[#0A0E17] p-2.5 rounded-lg border border-[#28354D]">
              <span className="text-[#94A3B8] block text-[10px] uppercase font-bold">Klauzula prawna</span>
              <span className="text-emerald-400 font-extrabold text-base">Art. 14 RODO + Opt-out</span>
            </div>
          </div>
        </div>

        {/* Toolbar */}
        {leads.length > 0 && (
          <div className="bg-[#141C2E] border border-[#28354D] p-3.5 rounded-xl flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-white select-none">
                <input
                  type="checkbox"
                  checked={leads.length > 0 && selectedIds.length === leads.length}
                  onChange={(e) => handleSelectAll(e.target.checked)}
                  className="w-4 h-4 rounded text-[#FFE600] accent-[#FFE600] cursor-pointer"
                />
                <span>Zaznacz wszystkie ({leads.length})</span>
              </label>

              {selectedIds.length > 0 && (
                <span className="text-xs text-[#94A3B8]">
                  (Wybrano {selectedIds.length} z {leads.length})
                </span>
              )}
            </div>

            <div className="flex items-center gap-2.5">
              <input
                type="text"
                placeholder="Filtruj firmy..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="bg-[#0A0E17] border border-[#28354D] text-xs px-3 py-1.5 rounded-lg text-white placeholder-[#64748B] focus:border-[#FFE600] outline-none w-48"
              />
              {selectedIds.length > 0 && selectedIds.length !== leads.length && (
                <button
                  onClick={() => handleSendBatch(selectedIds)}
                  disabled={batchSending}
                  className="bg-[#1E293B] hover:bg-[#FFE600] hover:text-black border border-[#FFE600] text-[#FFE600] font-bold text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all"
                >
                  <Send size={13} />
                  Wyślij tylko zaznaczone ({selectedIds.length})
                </button>
              )}
            </div>
          </div>
        )}

        {/* Lead cards list */}
        {loading ? (
          <div className="py-12 text-center text-sm text-[#94A3B8] flex items-center justify-center gap-2">
            <RefreshCw size={18} className="animate-spin text-[#FFE600]" />
            Ładowanie oczekujących ofert...
          </div>
        ) : filteredLeads.length === 0 ? (
          <div className="bg-[#141C2E] border border-[#28354D] p-12 text-center rounded-2xl space-y-3">
            <CheckCircle2 size={52} className="text-[#34D399] mx-auto mb-2" />
            <h3 className="text-lg font-bold text-white">Brak oczekujących ofert do wysyłki!</h3>
            <p className="text-sm text-[#94A3B8] max-w-md mx-auto">
              Wszystkie wygenerowane oferty zostały już wysłane lub nie ma jeszcze zakwalifikowanych firm z ofertami.
            </p>
            <div className="pt-2">
              <Link
                href="/leads"
                className="bg-[#FFE600] text-black font-extrabold text-xs px-5 py-2.5 rounded-lg inline-flex items-center gap-2"
              >
                <Search size={15} /> Przejdź do bazy CRM
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredLeads.map((lead) => (
              <OutboxLeadCard
                key={lead.id}
                lead={lead}
                isSelected={selectedIds.includes(lead.id)}
                onToggleSelect={handleToggleSelect}
                onSendSingle={handleSendSingle}
                isSending={sendingSingleId === lead.id}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
