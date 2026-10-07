"use client";

import React, { useState } from "react";
import { FullLeadDossier } from "../dossier-types";
import { Send, Mail, Clock, ChevronDown, ChevronRight } from "lucide-react";

interface DossierCorrespondenceTabProps {
  lead: FullLeadDossier;
  onRefresh: () => void;
  showToast: (msg: string, type?: "success" | "error" | "info") => void;
}

export function DossierCorrespondenceTab({
  lead,
  onRefresh,
  showToast,
}: DossierCorrespondenceTabProps) {
  const [sending, setSending] = useState(false);
  const [expandedMsgId, setExpandedMsgId] = useState<number | null>(null);

  const messages = lead.messages || [];
  const outboundSent = messages.filter((m) => m.direction === "outbound" && m.status === "sent");
  const canSendMore = outboundSent.length < 4 && lead.status !== "unsubscribed" && lead.status !== "lost";

  const handleSendDraft = async () => {
    if (!lead.offer) {
      showToast("Przed wysyłką wygeneruj dedykowaną ofertę dla leada", "error");
      return;
    }
    setSending(true);
    showToast("Wysyłanie wiadomości przez bezpieczny SendService (Inwariant 2)...", "info");
    try {
      const res = await fetch(`/api/outreach/${lead.id}`, {
        method: "POST",
      });
      const data = await res.json();
      if (data.success) {
        showToast("Wiadomość została wysłana pomyślnie!", "success");
        onRefresh();
      } else {
        showToast(data.error || "Błąd wysyłki wiadomości", "error");
      }
    } catch {
      showToast("Błąd połączenia z serwerem wysyłkowym", "error");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner Status */}
      <div className="bg-[#141C2E] p-5 rounded-2xl border border-[#28354D] flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Mail size={18} className="text-[#FFE600]" />
            <h3 className="text-sm font-extrabold uppercase tracking-wider text-white">
              Sekwencja Outreach ({outboundSent.length}/4 wysłanych)
            </h3>
          </div>
          <p className="text-xs text-[#94A3B8] mt-1">
            Zgodnie z Inwariantem 7 obowiązuje twardy limit maks. 3 follow-upów (4 wiadomości łącznie).
          </p>
        </div>

        {canSendMore && lead.offer && (
          <button
            onClick={handleSendDraft}
            disabled={sending}
            className="bg-[#FFE600] hover:bg-[#FFF04D] text-black font-extrabold text-xs px-4 py-2.5 rounded-lg flex items-center gap-2"
          >
            <Send size={14} className={sending ? "animate-spin" : ""} />
            {sending
              ? "Wysyłanie..."
              : outboundSent.length === 0
              ? "Wyślij Wiadomość Initial"
              : `Wyślij Follow-up #${outboundSent.length}`}
          </button>
        )}
      </div>

      {/* Messages Timeline */}
      <div className="space-y-3">
        <h4 className="text-xs font-bold uppercase tracking-wider text-[#94A3B8]">
          Historia Korespondencji ({messages.length})
        </h4>

        {messages.length === 0 ? (
          <div className="bg-[#141C2E] border border-[#28354D] p-8 rounded-2xl text-center space-y-2">
            <Clock size={32} className="mx-auto text-[#64748B]" />
            <p className="text-sm text-[#94A3B8]">Brak zarejestrowanych wiadomości dla tego kontaktu.</p>
            <p className="text-xs text-[#64748B]">Wiadomości pojawią się tutaj po zatwierdzeniu lub wysłaniu kampanii.</p>
          </div>
        ) : (
          messages.map((m) => {
            const isExpanded = expandedMsgId === m.id;
            const isOutbound = m.direction === "outbound";
            return (
              <div
                key={m.id}
                className="bg-[#141C2E] border border-[#28354D] rounded-xl overflow-hidden text-xs"
              >
                <div
                  onClick={() => setExpandedMsgId(isExpanded ? null : m.id)}
                  className="p-4 flex items-center justify-between cursor-pointer hover:bg-[#1E293B]/60 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`px-2 py-0.5 rounded font-bold uppercase font-mono text-[10px] ${
                        isOutbound
                          ? "bg-blue-950 text-blue-300 border border-blue-800"
                          : "bg-emerald-950 text-emerald-300 border border-emerald-800"
                      }`}
                    >
                      {isOutbound ? `OUTBOUND #${m.sequenceStep ?? 1}` : "INBOUND (REPLY)"}
                    </span>
                    <span className="font-bold text-white text-sm">
                      {m.subject || "(brak tematu)"}
                    </span>
                  </div>

                  <div className="flex items-center gap-4 text-[#94A3B8]">
                    <span className="font-mono text-[11px]">
                      {m.sentAt ? new Date(m.sentAt).toLocaleString("pl-PL") : new Date(m.createdAt).toLocaleString("pl-PL")}
                    </span>
                    <span className="badge badge-default uppercase font-mono text-[10px]">
                      {m.status}
                    </span>
                    {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </div>
                </div>

                {isExpanded && (
                  <div className="p-4 border-t border-[#1E293B] bg-[#0A0E17] space-y-3">
                    <div className="text-[11px] text-[#94A3B8] flex flex-wrap gap-4">
                      <span>Od: <strong className="text-white">{m.senderEmail || "System"}</strong></span>
                      <span>Do: <strong className="text-white">{m.recipientEmail || lead.emailPrimary}</strong></span>
                      <span>Kanał: <strong className="text-white">{m.channel}</strong></span>
                    </div>

                    <div className="p-3 bg-[#141C2E] rounded-lg border border-[#28354D] text-white leading-relaxed font-sans whitespace-pre-line text-xs">
                      {m.bodySnippet || "(brak treści wiadomości)"}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
