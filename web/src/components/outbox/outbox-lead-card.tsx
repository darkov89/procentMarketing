"use client";

import React, { useState } from "react";
import Link from "next/link";
import { PendingOutboxLead } from "./outbox-types";
import { ExternalLink, Edit2, Send, Eye } from "lucide-react";

interface OutboxLeadCardProps {
  lead: PendingOutboxLead;
  isSelected: boolean;
  onToggleSelect: (id: number) => void;
  onSendSingle: (id: number) => Promise<void>;
  isSending?: boolean;
}

export function OutboxLeadCard({
  lead,
  isSelected,
  onToggleSelect,
  onSendSingle,
  isSending,
}: OutboxLeadCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [inlineEmail, setInlineEmail] = useState("");
  const [savingEmail, setSavingEmail] = useState(false);

  const offerUrl = lead.offer
    ? `/o/${lead.offer.token || lead.offer.slug}`
    : null;

  return (
    <div
      className={`bg-[#141C2E] border rounded-2xl p-5 transition-all shadow-md ${
        isSelected ? "border-[#FFE600]/80 shadow-yellow-500/5" : "border-[#28354D]"
      }`}
    >
      {/* Top Header Row */}
      <div className="flex flex-wrap items-start justify-between gap-3 pb-3 border-b border-[#28354D]">
        <div className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => onToggleSelect(lead.id)}
            className="mt-1 w-4 h-4 rounded text-[#FFE600] accent-[#FFE600] cursor-pointer"
          />
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-xs text-[#64748B]">#{lead.id}</span>
              <h3 className="text-base font-extrabold text-white">{lead.companyName}</h3>
              <span className="text-xs bg-[#1E293B] text-[#FFE600] border border-[#334155] px-2 py-0.5 rounded font-mono font-bold">
                Score: {lead.score} pkt
              </span>
            </div>
            <p className="text-xs text-[#94A3B8] mt-0.5">
              📍 {lead.city || "Brak miasta"} • {lead.industry || "Brak branży"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {offerUrl && (
            <a
              href={offerUrl}
              target="_blank"
              rel="noreferrer"
              className="bg-[#1E293B] hover:bg-[#2D3D58] border border-[#38BDF8]/60 text-[#38BDF8] font-bold text-xs px-3 py-2 rounded-lg flex items-center gap-1.5 transition-all"
            >
              <ExternalLink size={13} />
              <span>Zobacz Stronę Oferty</span>
            </a>
          )}
          <Link
            href={`/leads/${lead.id}?tab=oferta`}
            className="bg-[#1E293B] hover:bg-[#2D3D58] border border-[#334155] text-white font-bold text-xs px-3 py-2 rounded-lg flex items-center gap-1.5 transition-all"
          >
            <Edit2 size={13} />
            <span>Edytuj Ofertę</span>
          </Link>
          <button
            onClick={() => onSendSingle(lead.id)}
            disabled={isSending || !lead.emailPrimary}
            className="bg-[#059669] hover:bg-[#10B981] text-white font-extrabold text-xs px-3.5 py-2 rounded-lg flex items-center gap-1.5 transition-all shadow-md shadow-emerald-500/20 disabled:opacity-50"
          >
            <Send size={13} className={isSending ? "animate-spin" : ""} />
            <span>{isSending ? "Wysyłanie..." : "Wyślij ten e-mail"}</span>
          </button>
        </div>
      </div>

      {/* Recipient Status Row */}
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
                value={inlineEmail}
                onChange={(e) => setInlineEmail(e.target.value)}
                className="bg-[#0A0E17] border border-[#FB7185]/60 text-white font-mono text-xs px-2.5 py-1 rounded outline-none focus:border-[#FFE600]"
              />
              <button
                onClick={async () => {
                  if (!inlineEmail) return;
                  setSavingEmail(true);
                  try {
                    await fetch(`/api/leads/${lead.id}`, {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ emailPrimary: inlineEmail }),
                    });
                    lead.emailPrimary = inlineEmail;
                  } finally {
                    setSavingEmail(false);
                  }
                }}
                disabled={savingEmail}
                className="bg-[#FFE600] text-black font-extrabold text-xs px-3 py-1 rounded hover:bg-[#FFF04D]"
              >
                {savingEmail ? "..." : "Zapisz"}
              </button>
            </div>
          )}
        </div>

        <button
          onClick={() => setExpanded(!expanded)}
          className="text-[#FFE600] hover:underline font-bold text-xs flex items-center gap-1 cursor-pointer"
        >
          <Eye size={13} />
          {expanded ? "Zwiń podgląd oferty" : "Podgląd propozycji"}
        </button>
      </div>

      {/* Expanded Quick Details */}
      {expanded && lead.offer && (
        <div className="mt-3.5 pt-3 border-t border-[#28354D] space-y-2 text-xs">
          <div className="bg-[#0A0E17] p-3 rounded-lg border border-[#28354D]">
            <span className="text-[#94A3B8] font-bold block mb-1">Tytuł oferty:</span>
            <span className="text-white font-semibold">{lead.offer.title}</span>
          </div>
        </div>
      )}
    </div>
  );
}
