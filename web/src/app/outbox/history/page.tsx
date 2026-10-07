"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { OutreachHistoryEntry, OutreachHistoryMetrics } from "@/components/outbox/outbox-types";
import { ToastNotification, ToastMessage } from "@/components/ui/toast-notification";
import {
  History,
  Building,
  ShieldCheck,
  RefreshCw,
  Users,
  Eye,
  MessageSquare,
  Award,
  ExternalLink,
  ArrowLeft,
  Search,
} from "lucide-react";
import { getStatusMeta } from "@/lib/status-meta";

export default function OutboxHistoryPage() {
  const [history, setHistory] = useState<OutreachHistoryEntry[]>([]);
  const [metrics, setMetrics] = useState<OutreachHistoryMetrics | null>(null);
  const [tenantName, setTenantName] = useState<string>("Organizacja");
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const showToast = useCallback((message: string, type: "success" | "error" | "info" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/outreach/history");
      const data = await res.json();
      if (data.success) {
        setHistory(data.history || []);
        setMetrics(data.metrics || null);
        if (data.tenantName) setTenantName(data.tenantName);
      } else {
        showToast(data.error || "Błąd pobierania historii outreachu", "error");
      }
    } catch {
      showToast("Błąd połączenia z serwerem historii", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const filteredHistory = history.filter((item) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      item.companyName.toLowerCase().includes(q) ||
      (item.city && item.city.toLowerCase().includes(q)) ||
      (item.emailPrimary && item.emailPrimary.toLowerCase().includes(q))
    );
  });

  return (
    <div className="min-h-screen bg-[#070A11] text-white">
      {toast && <ToastNotification toast={toast} />}

      {/* Header */}
      <div className="bg-[#0A0E17] border-b border-[#28354D] sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/outbox"
              className="text-xs bg-[#141C2E] hover:bg-[#1E293B] border border-[#28354D] text-[#94A3B8] hover:text-white px-3 py-1.5 rounded-lg flex items-center gap-1.5 font-semibold"
            >
              <ArrowLeft size={14} /> Outbox (Wysyłka)
            </Link>
            <span className="text-[#64748B] text-xs font-mono">/</span>
            <h1 className="text-lg font-black text-white flex items-center gap-2">
              <History className="text-[#FFE600]" size={20} />
              Baza Wysłanych & Metryki
            </h1>
          </div>

          <button
            onClick={fetchHistory}
            disabled={loading}
            className="bg-[#1E293B] hover:bg-[#2D3D58] border border-[#334155] text-white font-bold text-xs px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition-all"
          >
            <RefreshCw size={13} className={loading ? "animate-spin text-[#FFE600]" : ""} />
            <span>Odśwież Historię</span>
          </button>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Context Banner */}
        <div className="bg-[#141C2E] border border-[#28354D] p-5 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-lg">
          <div>
            <div className="flex items-center gap-2">
              <span className="bg-[#38BDF8]/20 border border-[#38BDF8]/40 text-[#38BDF8] text-[10px] font-black uppercase px-2 py-0.5 rounded tracking-wider flex items-center gap-1">
                <Building size={11} />
                TENANT: {tenantName}
              </span>
              <span className="text-xs text-[#34D399] font-bold flex items-center gap-1">
                <ShieldCheck size={13} />
                Szyfrowana Izolacja Danych
              </span>
            </div>
            <h2 className="text-xl font-black text-white mt-1">
              Baza Wysłanych Kontaktów & Metryki Kampanii
            </h2>
            <p className="text-xs text-[#94A3B8] mt-0.5">
              Śledzenie w czasie rzeczywistym odsłon ofert <code className="text-[#FFE600] font-mono">/o/[token]</code>, wskaźnika odpowiedzi IMAP oraz spotkań B2B.
            </p>
          </div>
        </div>

        {/* 4 PRIMARY KPI CARDS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-[#141C2E] border border-[#28354D] p-4 rounded-xl">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black uppercase tracking-wider text-[#94A3B8] flex items-center gap-1.5">
                <Users size={14} className="text-[#38BDF8]" />
                Wysłane Kontakty
              </span>
              <span className="text-[10px] bg-[#1E293B] border border-[#334155] text-[#94A3B8] font-bold px-2 py-0.5 rounded-full">
                {metrics?.totalMessagesSent ?? 0} maili
              </span>
            </div>
            <div className="text-3xl font-black text-white mt-2">
              {metrics?.totalOutreached ?? 0}
            </div>
            <p className="text-[11px] text-[#64748B] mt-1">
              Firmy z co najmniej 1 wysłaną wiadomością
            </p>
          </div>

          <div className="bg-[#141C2E] border border-[#28354D] p-4 rounded-xl">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black uppercase tracking-wider text-[#38BDF8] flex items-center gap-1.5">
                <Eye size={14} className="text-[#38BDF8]" />
                Odsłony Ofert (/o/[token])
              </span>
              <span className="text-[10px] bg-[#38BDF8]/20 border border-[#38BDF8]/40 text-[#38BDF8] font-black px-2 py-0.5 rounded-full">
                {metrics?.offerViewRate ?? 0}% view rate
              </span>
            </div>
            <div className="text-3xl font-black text-[#38BDF8] mt-2">
              {metrics?.totalOfferViews ?? 0}
            </div>
            <p className="text-[11px] text-[#64748B] mt-1">
              {metrics?.leadsWithOfferViews ?? 0} firm weszło na stronę oferty
            </p>
          </div>

          <div className="bg-[#141C2E] border border-[#28354D] p-4 rounded-xl">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black uppercase tracking-wider text-[#34D399] flex items-center gap-1.5">
                <MessageSquare size={14} className="text-[#34D399]" />
                Wskaźnik Odpowiedzi
              </span>
              <span className="text-[10px] bg-[#064E3B] border border-[#059669] text-[#34D399] font-black px-2 py-0.5 rounded-full">
                {metrics?.repliesCount ?? 0} odpowiedzi
              </span>
            </div>
            <div className="text-3xl font-black text-[#34D399] mt-2">
              {metrics?.replyRate ?? 0}%
            </div>
            <p className="text-[11px] text-[#64748B] mt-1">
              Wykryte odpowiedzi z monitoringu IMAP
            </p>
          </div>

          <div className="bg-[#141C2E] border-2 border-[#FFE600]/60 p-4 rounded-xl">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black uppercase tracking-wider text-[#FFE600] flex items-center gap-1.5">
                <Award size={14} className="text-[#FFE600]" />
                Umówione Spotkania (KPI)
              </span>
              <span className="text-[10px] bg-[#FFE600] text-black font-black px-2 py-0.5 rounded-full">
                {metrics?.meetingRate ?? 0}% konwersji
              </span>
            </div>
            <div className="text-3xl font-black text-[#FFE600] mt-2">
              {metrics?.meetingsBookedCount ?? 0}
            </div>
            <p className="text-[11px] text-[#94A3B8] mt-1">
              Główna miara biznesowa sukcesu systemu
            </p>
          </div>
        </div>

        {/* Search bar */}
        <div className="bg-[#141C2E] border border-[#28354D] p-3.5 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-2 w-full max-w-sm">
            <Search size={14} className="text-[#64748B]" />
            <input
              type="text"
              placeholder="Szukaj firmy, miasta lub adresu e-mail..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-transparent border-0 outline-none text-xs text-white placeholder-[#64748B] w-full"
            />
          </div>
          <span className="text-xs text-[#94A3B8] font-mono">
            {filteredHistory.length} z {history.length} rekordów
          </span>
        </div>

        {/* Table */}
        <div className="bg-[#141C2E] border border-[#28354D] rounded-2xl overflow-hidden shadow-lg">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-[#CBD5E1]">
              <thead className="bg-[#0A0E17] text-[#94A3B8] uppercase text-[10px] tracking-wider border-b border-[#28354D]">
                <tr>
                  <th className="p-4">Firma</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Sekwencja</th>
                  <th className="p-4">Odsłony Oferty</th>
                  <th className="p-4">Odpowiedź / Spotkanie</th>
                  <th className="p-4">Ostatnia Wysyłka</th>
                  <th className="p-4 text-right">Akcje</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1E293B]">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-[#94A3B8]">
                      <RefreshCw size={18} className="animate-spin text-[#FFE600] inline mr-2" />
                      Ładowanie historii wysyłek...
                    </td>
                  </tr>
                ) : filteredHistory.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-[#94A3B8]">
                      Brak zarejestrowanych wysyłek w historii tenanta.
                    </td>
                  </tr>
                ) : (
                  filteredHistory.map((item) => {
                    const statusMeta = getStatusMeta(item.leadStatus);
                    const offerUrl = item.offerToken ? `/o/${item.offerToken}` : null;
                    return (
                      <tr key={item.leadId} className="hover:bg-[#1E293B]/50 transition-colors">
                        <td className="p-4">
                          <Link
                            href={`/leads/${item.leadId}`}
                            className="font-extrabold text-white hover:text-[#FFE600] block text-sm"
                          >
                            {item.companyName}
                          </Link>
                          <span className="text-[11px] text-[#94A3B8]">
                            📍 {item.city || "—"} • ✉️ {item.emailPrimary || "brak"}
                          </span>
                        </td>
                        <td className="p-4">
                          <span className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] ${statusMeta.className}`}>
                            {statusMeta.label}
                          </span>
                        </td>
                        <td className="p-4 font-mono font-bold">
                          {item.outboundCount}/4 (krok {Math.min(3, item.outboundCount)})
                        </td>
                        <td className="p-4">
                          {item.offerViewCount > 0 ? (
                            <span className="text-emerald-400 font-bold flex items-center gap-1 font-mono">
                              👁️ {item.offerViewCount} odsłon
                            </span>
                          ) : (
                            <span className="text-[#64748B]">Brak wizyt</span>
                          )}
                        </td>
                        <td className="p-4">
                          {item.meetingBooked ? (
                            <span className="text-[#FFE600] font-black uppercase text-[10px] bg-yellow-950/80 border border-yellow-700 px-2 py-0.5 rounded">
                              🏆 Spotkanie
                            </span>
                          ) : item.hasReplied ? (
                            <span className="text-emerald-400 font-bold uppercase text-[10px] bg-emerald-950 border border-emerald-800 px-2 py-0.5 rounded">
                              Odpowiedź
                            </span>
                          ) : (
                            <span className="text-[#64748B]">Oczekiwanie</span>
                          )}
                        </td>
                        <td className="p-4 font-mono text-[11px] text-[#94A3B8]">
                          {item.lastMessageSentAt
                            ? new Date(item.lastMessageSentAt).toLocaleDateString("pl-PL")
                            : "—"}
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {offerUrl && (
                              <a
                                href={offerUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-xs bg-[#1E293B] hover:bg-[#2D3D58] border border-[#38BDF8]/60 text-[#38BDF8] px-2.5 py-1.5 rounded-lg flex items-center gap-1"
                                title="Podgląd oferty"
                              >
                                <ExternalLink size={12} />
                              </a>
                            )}
                            <Link
                              href={`/leads/${item.leadId}?tab=korespondencja`}
                              className="text-xs bg-[#1E293B] hover:bg-[#2D3D58] border border-[#334155] text-white px-2.5 py-1.5 rounded-lg font-bold"
                            >
                              Dossier
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
