"use client";

import React, { useState, useEffect } from "react";
import {
  HeartHandshake,
  DollarSign,
  Calendar,
  CheckCircle2,
  Clock,
  Plus,
  Building2,
  User,
  ShieldCheck,
  RefreshCw,
  X,
  CreditCard,
  AlertCircle,
} from "lucide-react";

interface DealItem {
  id: number;
  leadId: number;
  companyName: string;
  declaredAmount: number;
  expectedPaymentAt?: string | null;
  paidAmount: number;
  paidConfirmedAt?: string | null;
  status: "declared" | "paid" | "cancelled";
  confirmedByUserName?: string | null;
  notes?: string | null;
  createdAt: string;
}

interface LeadSimple {
  id: number;
  companyName: string;
  city?: string | null;
}

interface DealsFinanceTabProps {
  leads: LeadSimple[];
  showToast: (msg: string, type: "success" | "error" | "info") => void;
  currentUser?: { name: string; role: string } | null;
}

export function DealsFinanceTab({ leads, showToast, currentUser }: DealsFinanceTabProps) {
  const [deals, setDeals] = useState<DealItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [confirmingDeal, setConfirmingDeal] = useState<DealItem | null>(null);

  // New Deal Form
  const [selectedLeadId, setSelectedLeadId] = useState<string>("");
  const [declaredAmount, setDeclaredAmount] = useState<string>("");
  const [expectedDate, setExpectedDate] = useState<string>("");
  const [dealNotes, setDealNotes] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  // Confirm Payment Form (Ania)
  const [confirmPaidAmount, setConfirmPaidAmount] = useState<string>("");
  const [confirmNotes, setConfirmNotes] = useState<string>("");
  const [confirming, setConfirming] = useState(false);

  const fetchDeals = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/deals");
      const data = await res.json();
      if (data.success && data.deals) {
        setDeals(data.deals);
      }
    } catch {
      showToast("Błąd pobierania listy deklaracji sponsorskich", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDeals();
  }, []);

  const handleCreateDeal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLeadId || !declaredAmount) {
      showToast("Wybierz firmę oraz podaj deklarowaną kwotę", "error");
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch("/api/deals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId: parseInt(selectedLeadId, 10),
          declaredAmount: parseFloat(declaredAmount),
          expectedPaymentAt: expectedDate ? new Date(expectedDate).toISOString() : null,
          notes: dealNotes,
        }),
      });

      const data = await res.json();
      if (data.success) {
        showToast(data.message || "Zapisano deklarację wsparcia!", "success");
        setIsAddModalOpen(false);
        setSelectedLeadId("");
        setDeclaredAmount("");
        setExpectedDate("");
        setDealNotes("");
        fetchDeals();
      } else {
        showToast(data.error || "Błąd zapisu deklaracji", "error");
      }
    } catch {
      showToast("Błąd połączenia z serwerem", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirmingDeal) return;

    try {
      setConfirming(true);
      const res = await fetch("/api/deals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dealId: confirmingDeal.id,
          action: "confirm_payment",
          paidAmount: confirmPaidAmount ? parseFloat(confirmPaidAmount) : confirmingDeal.declaredAmount,
          notes: confirmNotes || confirmingDeal.notes,
        }),
      });

      const data = await res.json();
      if (data.success) {
        showToast(data.message || "Wpłata została pomyślnie potwierdzona!", "success");
        setConfirmingDeal(null);
        fetchDeals();
      } else {
        showToast(data.error || "Błąd autoryzacji wpłaty", "error");
      }
    } catch {
      showToast("Błąd połączenia z serwerem", "error");
    } finally {
      setConfirming(false);
    }
  };

  // KPI Calculations
  const totalDeclared = deals.reduce((sum, d) => sum + (d.declaredAmount || 0), 0);
  const totalPaid = deals.reduce((sum, d) => sum + (d.paidAmount || 0), 0);
  const pendingAmount = Math.max(0, totalDeclared - totalPaid);
  const collectionRate = totalDeclared > 0 ? Math.round((totalPaid / totalDeclared) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Top Banner & Context */}
      <div className="bg-[#101726] border border-[#28354D] rounded-2xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-[#34D399] flex items-center justify-center">
              <HeartHandshake size={22} />
            </div>
            <div>
              <h3 className="text-base font-black text-white flex items-center gap-2">
                Program „Firmy Dzieciom” — Ewidencja Wpłat & Finansów
                <span className="text-[10px] bg-sky-950 text-sky-400 border border-sky-800 px-2 py-0.5 rounded-full font-mono uppercase">
                  Fundacja Szumi Las
                </span>
              </h3>
              <p className="text-xs text-[#94A3B8] mt-0.5">
                Śledzenie deklaracji sponsorskich, terminów wpłat oraz autoryzacja wpływu środków.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="bg-[#FFE600] hover:bg-[#FFF04D] text-black font-extrabold text-xs px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition-all shadow-md cursor-pointer"
            >
              <Plus size={15} />
              Nowa Deklaracja Wsparcia
            </button>
            <button
              onClick={fetchDeals}
              disabled={loading}
              className="bg-[#141C2E] hover:bg-[#1E293B] border border-[#28354D] text-white p-2 rounded-xl text-xs transition-all cursor-pointer"
              title="Odśwież dane"
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            </button>
          </div>
        </div>

        {/* Roles & Governance Rules from Brief */}
        <div className="bg-[#0A0E17] border border-[#28354D] rounded-xl p-3.5 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          <div className="flex items-start gap-2.5">
            <ShieldCheck size={16} className="text-[#38BDF8] shrink-0 mt-0.5" />
            <div>
              <strong className="text-white block font-bold">Zasady wyceny (Jakub):</strong>
              <span className="text-[#94A3B8] text-[11px] leading-relaxed">
                Kwoty i świadczenia sponsorskie podajemy dopiero po potwierdzeniu kosztów pobytu dzieci i warunków wsparcia przez Jakuba.
              </span>
            </div>
          </div>

          <div className="flex items-start gap-2.5">
            <CheckCircle2 size={16} className="text-[#34D399] shrink-0 mt-0.5" />
            <div>
              <strong className="text-white block font-bold">Autoryzacja wpłat (Ania):</strong>
              <span className="text-[#94A3B8] text-[11px] leading-relaxed">
                Deklaracja wsparcia nie oznacza otrzymanej wpłaty. Wpływ darowizny na rachunek Fundacji potwierdza wyłącznie Ania.
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Metric Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-[#0E1422] border border-[#28354D] p-4 rounded-xl">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8] block">
            Łącznie Zadeklarowano
          </span>
          <div className="text-2xl font-black text-white mt-1">
            {totalDeclared.toLocaleString("pl-PL")} <span className="text-xs text-[#94A3B8]">PLN</span>
          </div>
        </div>

        <div className="bg-[#0E1422] border border-[#28354D] p-4 rounded-xl">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#34D399] block">
            Wpłacono na Konto
          </span>
          <div className="text-2xl font-black text-[#34D399] mt-1">
            {totalPaid.toLocaleString("pl-PL")} <span className="text-xs text-[#94A3B8]">PLN</span>
          </div>
        </div>

        <div className="bg-[#0E1422] border border-[#28354D] p-4 rounded-xl">
          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 block">
            Oczekujące Wpłaty
          </span>
          <div className="text-2xl font-black text-amber-400 mt-1">
            {pendingAmount.toLocaleString("pl-PL")} <span className="text-xs text-[#94A3B8]">PLN</span>
          </div>
        </div>

        <div className="bg-[#0E1422] border border-[#28354D] p-4 rounded-xl">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#38BDF8] block">
            Wskaźnik Realizacji
          </span>
          <div className="text-2xl font-black text-[#38BDF8] mt-1">
            {collectionRate}%
          </div>
        </div>
      </div>

      {/* Deals Table */}
      <div className="bg-[#0E1422] border border-[#28354D] rounded-2xl overflow-hidden shadow-xl">
        <div className="p-4 border-b border-[#28354D] flex items-center justify-between">
          <span className="text-xs font-black uppercase tracking-wider text-[#94A3B8]">
            Zarejestrowane Deklaracje Sponsorskie ({deals.length})
          </span>
        </div>

        {loading && deals.length === 0 ? (
          <div className="py-16 text-center text-sm text-[#94A3B8]">Wczytywanie deklaracji...</div>
        ) : deals.length === 0 ? (
          <div className="py-16 text-center text-sm text-[#94A3B8] space-y-2">
            <HeartHandshake size={32} className="mx-auto text-[#64748B] opacity-50" />
            <div className="text-white font-bold">Brak deklaracji wsparcia</div>
            <p className="text-xs text-[#64748B] max-w-md mx-auto">
              Gdy Dawid podczas rozmowy telefonicznej ustali deklarację wsparcia, kliknij „Nowa Deklaracja Wsparcia”, aby zarejestrować kwotę i termin wpłaty.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#28354D] bg-[#141C2E]/60 text-[#94A3B8] font-bold">
                  <th className="p-3.5">ID</th>
                  <th className="p-3.5">Firma (Sponsor)</th>
                  <th className="p-3.5">Kwota Zadeklarowana</th>
                  <th className="p-3.5">Termin Wpłaty</th>
                  <th className="p-3.5">Kwota Wpłacona</th>
                  <th className="p-3.5">Status & Weryfikacja</th>
                  <th className="p-3.5 text-right">Akcje</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1E293B]">
                {deals.map((deal) => {
                  const isPaid = deal.status === "paid";

                  return (
                    <tr key={deal.id} className="hover:bg-[#182338] transition-colors">
                      <td className="p-3.5 font-mono text-[#64748B]">#{deal.id}</td>

                      <td className="p-3.5 font-bold text-white">
                        <div className="flex items-center gap-1.5">
                          <Building2 size={14} className="text-[#38BDF8]" />
                          <span>{deal.companyName || `Lead #${deal.leadId}`}</span>
                        </div>
                        {deal.notes && (
                          <div className="text-[11px] text-[#94A3B8] font-normal mt-0.5 line-clamp-1">
                            {deal.notes}
                          </div>
                        )}
                      </td>

                      <td className="p-3.5 font-extrabold text-[#FFE600] font-mono">
                        {deal.declaredAmount?.toLocaleString("pl-PL")} PLN
                      </td>

                      <td className="p-3.5 text-[#CBD5E1]">
                        <div className="flex items-center gap-1.5 font-mono">
                          <Calendar size={13} className="text-[#94A3B8]" />
                          <span>
                            {deal.expectedPaymentAt
                              ? new Date(deal.expectedPaymentAt).toLocaleDateString("pl-PL")
                              : "—"}
                          </span>
                        </div>
                      </td>

                      <td className="p-3.5 font-extrabold font-mono">
                        {isPaid ? (
                          <span className="text-[#34D399]">
                            {deal.paidAmount?.toLocaleString("pl-PL")} PLN
                          </span>
                        ) : (
                          <span className="text-[#64748B]">0 PLN</span>
                        )}
                      </td>

                      <td className="p-3.5">
                        {isPaid ? (
                          <div className="space-y-0.5">
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800">
                              <CheckCircle2 size={11} /> Wpłata Potwierdzona
                            </span>
                            <div className="text-[10px] text-[#94A3B8] font-mono">
                              Przez: {deal.confirmedByUserName || "Ania"}
                            </div>
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-950 text-amber-400 border border-amber-800">
                            <Clock size={11} /> Oczekuje na wpływ
                          </span>
                        )}
                      </td>

                      <td className="p-3.5 text-right">
                        {!isPaid ? (
                          <button
                            onClick={() => {
                              setConfirmingDeal(deal);
                              setConfirmPaidAmount(String(deal.declaredAmount || ""));
                              setConfirmNotes(deal.notes || "");
                            }}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-[11px] px-3 py-1.5 rounded-lg inline-flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
                            title="Potwierdź zaksięgowanie wpłaty na rachunku Fundacji"
                          >
                            <CheckCircle2 size={13} />
                            Potwierdź wpłatę (Ania)
                          </button>
                        ) : (
                          <span className="text-[11px] text-[#64748B] font-mono">Zaksięgowano</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: Nowa Deklaracja Wsparcia */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0E1422] border border-[#28354D] rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-[#28354D] pb-3">
              <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                <HeartHandshake size={18} className="text-[#FFE600]" />
                Rejestracja Deklaracji Sponsorskiej
              </h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-[#94A3B8] hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateDeal} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#CBD5E1] mb-1.5">
                  Wybierz Firmę (Lead ze wskazanym wsparciem) *
                </label>
                <select
                  value={selectedLeadId}
                  onChange={(e) => setSelectedLeadId(e.target.value)}
                  required
                  className="w-full bg-[#141C2E] border border-[#28354D] focus:border-[#FFE600] rounded-xl px-3 py-2 text-xs text-white"
                >
                  <option value="">Wybierz sponsora z listy...</option>
                  {leads.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.companyName} {l.city ? `(${l.city})` : ""} — ID #{l.id}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#CBD5E1] mb-1.5">
                    Kwota Deklarowana (PLN) *
                  </label>
                  <input
                    type="number"
                    step="100"
                    placeholder="np. 5000"
                    value={declaredAmount}
                    onChange={(e) => setDeclaredAmount(e.target.value)}
                    required
                    className="w-full bg-[#141C2E] border border-[#28354D] focus:border-[#FFE600] rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#CBD5E1] mb-1.5">
                    Oczekiwana Data Wpłaty
                  </label>
                  <input
                    type="date"
                    value={expectedDate}
                    onChange={(e) => setExpectedDate(e.target.value)}
                    className="w-full bg-[#141C2E] border border-[#28354D] focus:border-[#FFE600] rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#CBD5E1] mb-1.5">
                  Notatka do pakietu / ustalenia (Warunki Jakuba)
                </label>
                <textarea
                  rows={3}
                  placeholder="np. Sfinansowanie 3 turnusów dla dzieci, certyfikat i logotyp na stronie..."
                  value={dealNotes}
                  onChange={(e) => setDealNotes(e.target.value)}
                  className="w-full bg-[#141C2E] border border-[#28354D] focus:border-[#FFE600] rounded-xl p-2.5 text-xs text-white placeholder-[#64748B]"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#28354D]">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="bg-[#141C2E] hover:bg-[#1E293B] text-[#94A3B8] font-bold text-xs px-4 py-2 rounded-xl cursor-pointer"
                >
                  Anuluj
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="bg-[#FFE600] hover:bg-[#FFF04D] text-black font-extrabold text-xs px-5 py-2 rounded-xl cursor-pointer disabled:opacity-50"
                >
                  {submitting ? "Zapisywanie..." : "Zapisz Deklarację"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Potwierdzenie Wpłaty przez Anię */}
      {confirmingDeal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0E1422] border border-emerald-500/40 rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-[#28354D] pb-3">
              <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                <ShieldCheck size={18} className="text-[#34D399]" />
                Autoryzacja Wpływu Darowizny (Ania)
              </h3>
              <button
                onClick={() => setConfirmingDeal(null)}
                className="text-[#94A3B8] hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleConfirmPayment} className="space-y-4">
              <div className="bg-[#141C2E] p-3.5 rounded-xl border border-[#28354D] space-y-1 text-xs">
                <span className="text-[#94A3B8] block">Sponsor:</span>
                <span className="font-extrabold text-white text-sm">
                  {confirmingDeal.companyName}
                </span>
                <span className="text-[#94A3B8] block mt-1">
                  Zadeklarowana kwota:{" "}
                  <strong className="text-[#FFE600] font-mono">
                    {confirmingDeal.declaredAmount} PLN
                  </strong>
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#CBD5E1] mb-1.5">
                  Rzeczywista Kwota Zaksięgowana (PLN) *
                </label>
                <input
                  type="number"
                  step="1"
                  value={confirmPaidAmount}
                  onChange={(e) => setConfirmPaidAmount(e.target.value)}
                  required
                  className="w-full bg-[#141C2E] border border-emerald-500/50 focus:border-emerald-400 rounded-xl px-3 py-2 text-xs text-white font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#CBD5E1] mb-1.5">
                  Potwierdzenie bankowe / Notatka księgowa
                </label>
                <textarea
                  rows={2}
                  placeholder="np. Przelew zaksięgowany na rachunku Fundacji 06.10.2026..."
                  value={confirmNotes}
                  onChange={(e) => setConfirmNotes(e.target.value)}
                  className="w-full bg-[#141C2E] border border-[#28354D] rounded-xl p-2.5 text-xs text-white placeholder-[#64748B]"
                />
              </div>

              <div className="bg-emerald-950/40 border border-emerald-800/40 rounded-xl p-3 text-[11px] text-emerald-300">
                Potwierdzasz wpływ środków jako autoryzowany skarbnik / administrator. Status leada zostanie zaktualizowany w bazie CRM.
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#28354D]">
                <button
                  type="button"
                  onClick={() => setConfirmingDeal(null)}
                  className="bg-[#141C2E] hover:bg-[#1E293B] text-[#94A3B8] font-bold text-xs px-4 py-2 rounded-xl cursor-pointer"
                >
                  Anuluj
                </button>
                <button
                  type="submit"
                  disabled={confirming}
                  className="bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-xs px-5 py-2 rounded-xl cursor-pointer disabled:opacity-50"
                >
                  {confirming ? "Zatwierdzanie..." : "Potwierdź Zaksięgowanie Wpłaty"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
