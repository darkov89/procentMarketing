"use client";

import React, { useState, useEffect } from "react";
import {
  Phone,
  PhoneCall,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ShieldAlert,
  ShieldCheck,
  Building2,
  Calendar,
  Save,
  User,
  HeartHandshake,
  Check,
  RefreshCw,
  ExternalLink,
} from "lucide-react";

interface LeadTaskItem {
  id: number;
  leadId: number;
  companyName: string;
  phone?: string | null;
  email?: string | null;
  city?: string | null;
  dueAt: string;
  status: "pending" | "completed" | "cancelled";
  taskType: string;
  title: string;
  outcome?: string | null;
  notes?: string | null;
  pkePhoneStatus?: "allowed" | "blocked" | "needs_check" | null;
  assignedUserName?: string | null;
  createdAt: string;
}

interface TasksQueueTabProps {
  showToast: (msg: string, type: "success" | "error" | "info") => void;
  onNavigateToDeals?: (leadId?: number) => void;
}

export function TasksQueueTab({ showToast, onNavigateToDeals }: TasksQueueTabProps) {
  const [tasks, setTasks] = useState<LeadTaskItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState<"pending" | "completed" | "all">("pending");
  const [updatingTaskId, setUpdatingTaskId] = useState<number | null>(null);

  // Form edit state per task
  const [taskOutcomes, setTaskOutcomes] = useState<Record<number, string>>({});
  const [taskNotes, setTaskNotes] = useState<Record<number, string>>({});

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/tasks?status=${filterStatus}`);
      const data = await res.json();
      if (data.success && data.tasks) {
        setTasks(data.tasks);
        // Initialize local edit state
        const initialOutcomes: Record<number, string> = {};
        const initialNotes: Record<number, string> = {};
        data.tasks.forEach((t: LeadTaskItem) => {
          if (t.outcome) initialOutcomes[t.id] = t.outcome;
          if (t.notes) initialNotes[t.id] = t.notes;
        });
        setTaskOutcomes(initialOutcomes);
        setTaskNotes(initialNotes);
      }
    } catch {
      showToast("Błąd pobierania kolejki zadań telefonicznych", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, [filterStatus]);

  const handleSaveOutcome = async (task: LeadTaskItem) => {
    const outcome = taskOutcomes[task.id];
    const notes = taskNotes[task.id] || "";

    if (!outcome) {
      showToast("Wybierz wynik rozmowy przed zapisaniem", "error");
      return;
    }

    try {
      setUpdatingTaskId(task.id);
      const res = await fetch("/api/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId: task.id,
          status: "completed",
          outcome,
          notes,
        }),
      });

      const data = await res.json();
      if (data.success) {
        showToast(`Zapisano wynik rozmowy: ${outcome}`, "success");
        // Refetch or update locally
        fetchTasks();
      } else {
        showToast(data.error || "Błąd zapisu zadania", "error");
      }
    } catch {
      showToast("Błąd połączenia z serwerem", "error");
    } finally {
      setUpdatingTaskId(null);
    }
  };

  const pendingCount = tasks.filter((t) => t.status === "pending").length;
  const completedCount = tasks.filter((t) => t.status === "completed").length;

  return (
    <div className="space-y-6">
      {/* Top Banner - Brief Context & Art. 398 PKE */}
      <div className="bg-[#101726] border border-[#28354D] rounded-2xl p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[#FFE600] flex items-center justify-center">
              <PhoneCall size={20} />
            </div>
            <div>
              <h3 className="text-base font-black text-white flex items-center gap-2">
                Kolejka Rozmów Telefonicznych (Dawid)
                <span className="text-[10px] bg-emerald-950 text-emerald-400 border border-emerald-800 px-2 py-0.5 rounded-full font-mono uppercase">
                  Program: Firmy Dzieciom
                </span>
              </h3>
              <p className="text-xs text-[#94A3B8] mt-0.5">
                Zadania kontaktu po udanym mailu. Zadanie tworzone jest z terminem +2 dni roboczych.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchTasks}
              disabled={loading}
              className="bg-[#141C2E] hover:bg-[#1E293B] border border-[#28354D] text-white px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
              Odśwież
            </button>
          </div>
        </div>

        {/* Legal Art. 398 PKE Information */}
        <div className="bg-[#0A0E17] border border-amber-500/30 rounded-xl p-3.5 flex items-start gap-3 text-xs">
          <ShieldAlert size={18} className="text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1 text-[#CBD5E1]">
            <span className="font-extrabold text-amber-300 block">
              Inwariant Prawny: Prawo Komunikacji Elektronicznej (art. 398 PKE)
            </span>
            <p className="leading-relaxed text-[11px] text-[#94A3B8]">
              Publiczny numer telefonu ani sam wysłany e-mail nie stanowią zgody na marketing bezpośredni. Telefon jest dozwolony wyłącznie wtedy, gdy firma wyraziła zgodę lub publicznie zaprosiła do kontaktu w sprawach CSR / sponsoringu (<span className="text-emerald-400 font-mono font-bold">pke_phone_status: allowed</span>).
            </p>
          </div>
        </div>
      </div>

      {/* Filter Tabs & Quick Metrics */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2 bg-[#0E1422] p-1 rounded-xl border border-[#28354D]">
          <button
            onClick={() => setFilterStatus("pending")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              filterStatus === "pending"
                ? "bg-[#FFE600] text-black shadow-sm"
                : "text-[#94A3B8] hover:text-white"
            }`}
          >
            <Clock size={13} />
            <span>Do Wykonania</span>
            <span className="text-[10px] bg-black/20 px-1.5 py-0.2 rounded-full font-mono">
              {pendingCount}
            </span>
          </button>
          <button
            onClick={() => setFilterStatus("completed")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              filterStatus === "completed"
                ? "bg-[#FFE600] text-black shadow-sm"
                : "text-[#94A3B8] hover:text-white"
            }`}
          >
            <CheckCircle2 size={13} />
            <span>Zakończone</span>
            <span className="text-[10px] bg-black/20 px-1.5 py-0.2 rounded-full font-mono">
              {completedCount}
            </span>
          </button>
          <button
            onClick={() => setFilterStatus("all")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              filterStatus === "all"
                ? "bg-[#FFE600] text-black shadow-sm"
                : "text-[#94A3B8] hover:text-white"
            }`}
          >
            Wszystkie Zadania
          </button>
        </div>

        <div className="text-xs text-[#94A3B8] font-mono">
          Łącznie zadań: <strong className="text-white">{tasks.length}</strong>
        </div>
      </div>

      {/* Tasks List */}
      {loading && tasks.length === 0 ? (
        <div className="py-16 text-center text-sm text-[#94A3B8] bg-[#0E1422] border border-[#28354D] rounded-2xl">
          Ładowanie kolejki zadań...
        </div>
      ) : tasks.length === 0 ? (
        <div className="py-16 text-center text-sm text-[#94A3B8] bg-[#0E1422] border border-[#28354D] rounded-2xl space-y-2">
          <PhoneCall size={32} className="mx-auto text-[#64748B] opacity-50" />
          <div className="text-white font-bold">Brak zadań w wybranym filtrze</div>
          <p className="text-xs text-[#64748B] max-w-md mx-auto">
            Zadania telefoniczne generują się automatycznie po wysłaniu pierwszego maila do leada, pod warunkiem że kontakt telefoniczny jest dopuszczony (art. 398 PKE).
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {tasks.map((task) => {
            const isCompleted = task.status === "completed";
            const currentOutcome = taskOutcomes[task.id] || task.outcome || "";
            const currentNote = taskNotes[task.id] !== undefined ? taskNotes[task.id] : task.notes || "";
            const isSaving = updatingTaskId === task.id;

            return (
              <div
                key={task.id}
                className={`bg-[#0E1422] border rounded-2xl p-5 transition-all space-y-4 ${
                  isCompleted
                    ? "border-[#1E293B] opacity-80"
                    : "border-[#28354D] hover:border-[#38BDF8]/40 shadow-lg"
                }`}
              >
                {/* Header row */}
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#1E293B] pb-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-[#64748B]">#{task.id}</span>
                      <h4 className="text-base font-extrabold text-white flex items-center gap-2">
                        <Building2 size={16} className="text-[#38BDF8]" />
                        {task.companyName || "Firma nieznana"}
                      </h4>
                      {task.city && (
                        <span className="text-xs text-[#94A3B8]">({task.city})</span>
                      )}
                    </div>
                    <div className="text-xs text-[#CBD5E1] flex items-center gap-2">
                      <User size={13} className="text-[#FFE600]" />
                      <span>Osoba kontaktowa / Dawid</span>
                      {task.email && (
                        <span className="text-[#64748B] font-mono">• {task.email}</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* PKE Status Badge */}
                    {task.pkePhoneStatus === "allowed" ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-lg bg-emerald-950/80 text-emerald-400 border border-emerald-800">
                        <ShieldCheck size={13} />
                        PKE Telefon OK
                      </span>
                    ) : task.pkePhoneStatus === "blocked" ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-lg bg-rose-950/80 text-rose-400 border border-rose-800">
                        <ShieldAlert size={13} />
                        Brak zgody tel (PKE)
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-lg bg-amber-950/80 text-amber-400 border border-amber-800">
                        <AlertTriangle size={13} />
                        Do weryfikacji tel
                      </span>
                    )}

                    {/* Due Date Badge */}
                    <div className="flex items-center gap-1.5 text-xs bg-[#141C2E] border border-[#28354D] px-2.5 py-1 rounded-lg text-[#CBD5E1]">
                      <Calendar size={13} className="text-[#38BDF8]" />
                      <span className="font-mono">
                        {task.dueAt ? new Date(task.dueAt).toLocaleDateString("pl-PL") : "Brak daty"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Call details & Action row */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Phone column */}
                  <div className="bg-[#141C2E] p-3.5 rounded-xl border border-[#1E293B] space-y-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8] block">
                      Numer Telefonu
                    </span>
                    {task.phone ? (
                      <a
                        href={`tel:${task.phone}`}
                        className="text-base font-extrabold text-[#FFE600] hover:underline flex items-center gap-2"
                      >
                        <Phone size={16} />
                        <span className="font-mono">{task.phone}</span>
                      </a>
                    ) : (
                      <span className="text-xs text-[#64748B]">Brak numeru w rekordzie</span>
                    )}
                    <span className="text-[10px] text-[#64748B] block">
                      Kliknij numer, aby połączyć bezpośrednio
                    </span>
                  </div>

                  {/* Outcome Select */}
                  <div className="bg-[#141C2E] p-3.5 rounded-xl border border-[#1E293B] space-y-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8] block">
                      Wynik Rozmowy Dawida
                    </span>
                    <select
                      value={currentOutcome}
                      onChange={(e) =>
                        setTaskOutcomes((prev) => ({ ...prev, [task.id]: e.target.value }))
                      }
                      disabled={isCompleted}
                      className="w-full bg-[#0A0E17] border border-[#28354D] focus:border-[#FFE600] rounded-lg px-2.5 py-1.5 text-xs text-white"
                    >
                      <option value="">Wybierz status po rozmowie...</option>
                      <option value="dalsza_rozmowa">📞 Dalsza rozmowa / nowy termin</option>
                      <option value="oferta">📄 Wysłanie szczegółowej oferty</option>
                      <option value="decyzja">⏳ Oczekiwanie na decyzję zarządu</option>
                      <option value="deklaracja_wsparcia">🎉 Deklaracja wsparcia sponsorskiego</option>
                      <option value="zamkniete">🚫 Zamknięte / Brak zainteresowania</option>
                    </select>
                    {currentOutcome === "deklaracja_wsparcia" && onNavigateToDeals && (
                      <button
                        type="button"
                        onClick={() => onNavigateToDeals(task.leadId)}
                        className="text-[11px] text-[#34D399] hover:underline font-bold flex items-center gap-1 mt-1 cursor-pointer"
                      >
                        <HeartHandshake size={13} />
                        Przejdź do rejestracji deklaracji (Ania) &rarr;
                      </button>
                    )}
                  </div>

                  {/* Notes / Next step */}
                  <div className="bg-[#141C2E] p-3.5 rounded-xl border border-[#1E293B] space-y-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8] block">
                      Notatki & Następny Krok
                    </span>
                    <textarea
                      rows={2}
                      placeholder="Wpisz ustalenia, imię rozmówcy, preferowaną kwotę..."
                      value={currentNote}
                      onChange={(e) =>
                        setTaskNotes((prev) => ({ ...prev, [task.id]: e.target.value }))
                      }
                      disabled={isCompleted}
                      className="w-full bg-[#0A0E17] border border-[#28354D] focus:border-[#FFE600] rounded-lg p-2 text-xs text-white placeholder-[#64748B]"
                    />
                  </div>
                </div>

                {/* Save button footer */}
                {!isCompleted && (
                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      onClick={() => handleSaveOutcome(task)}
                      disabled={isSaving}
                      className="bg-[#FFE600] hover:bg-[#FFF04D] text-black font-extrabold text-xs px-4 py-2 rounded-xl flex items-center gap-1.5 transition-all shadow-md cursor-pointer disabled:opacity-50"
                    >
                      <Save size={14} />
                      {isSaving ? "Zapisywanie..." : "Zapisz wynik i zakończ zadanie"}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
