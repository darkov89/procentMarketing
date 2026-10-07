"use client";

import React, { useState } from "react";
import { FullLeadDossier } from "../dossier-types";
import { Users, UserPlus, Mail, Phone, ExternalLink, UserCheck } from "lucide-react";

interface DossierContactsTabProps {
  lead: FullLeadDossier;
  onRefresh: () => void;
  showToast: (msg: string, type?: "success" | "error" | "info") => void;
}

export function DossierContactsTab({
  lead,
  onRefresh,
  showToast,
}: DossierContactsTabProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    role: "Decydent",
    linkedinUrl: "",
    isPrimary: false,
  });
  const [submitting, setSubmitting] = useState(false);

  const contacts = lead.contacts || [];

  const handleCreateContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.firstName && !formData.email) {
      showToast("Podaj przynajmniej imię lub adres e-mail", "error");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/leads/${lead.id}/contacts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (data.success) {
        showToast("Pomyślnie dodano kontakt!", "success");
        setShowAddForm(false);
        setFormData({
          firstName: "",
          lastName: "",
          email: "",
          phone: "",
          role: "Decydent",
          linkedinUrl: "",
          isPrimary: false,
        });
        onRefresh();
      } else {
        showToast(data.error || "Błąd zapisu kontaktu", "error");
      }
    } catch {
      showToast("Błąd połączenia z serwerem", "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-extrabold uppercase tracking-wider text-white flex items-center gap-2">
            <Users size={18} className="text-[#FFE600]" />
            Osoby Kontaktowe & Decydenci ({contacts.length})
          </h3>
          <p className="text-xs text-[#94A3B8]">
            Zidentyfikowane osoby decyzyjne, właściciele oraz osoby reprezentujące podmiot.
          </p>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="bg-[#FFE600] hover:bg-[#FFF04D] text-black font-extrabold text-xs px-3.5 py-2 rounded-lg flex items-center gap-1.5"
        >
          <UserPlus size={14} /> {showAddForm ? "Anuluj" : "Dodaj Osobę"}
        </button>
      </div>

      {/* Add contact modal/form */}
      {showAddForm && (
        <form onSubmit={handleCreateContact} className="bg-[#141C2E] p-5 rounded-2xl border border-[#28354D] space-y-4">
          <h4 className="text-xs font-bold uppercase tracking-wider text-[#FFE600]">
            Nowa osoba kontaktowa
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div>
              <label className="block text-[#94A3B8] font-bold mb-1">Imię</label>
              <input
                type="text"
                value={formData.firstName}
                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                className="w-full bg-[#0A0E17] border border-[#28354D] rounded-lg px-3 py-2 text-white"
                placeholder="np. Jan"
                required
              />
            </div>
            <div>
              <label className="block text-[#94A3B8] font-bold mb-1">Nazwisko</label>
              <input
                type="text"
                value={formData.lastName}
                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                className="w-full bg-[#0A0E17] border border-[#28354D] rounded-lg px-3 py-2 text-white"
                placeholder="np. Kowalski"
              />
            </div>
            <div>
              <label className="block text-[#94A3B8] font-bold mb-1">Rola / Stanowisko</label>
              <input
                type="text"
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                className="w-full bg-[#0A0E17] border border-[#28354D] rounded-lg px-3 py-2 text-white"
                placeholder="np. Właściciel, CEO"
              />
            </div>
            <div>
              <label className="block text-[#94A3B8] font-bold mb-1">E-mail</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full bg-[#0A0E17] border border-[#28354D] rounded-lg px-3 py-2 text-white"
                placeholder="jan@firma.pl"
              />
            </div>
            <div>
              <label className="block text-[#94A3B8] font-bold mb-1">Telefon</label>
              <input
                type="text"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full bg-[#0A0E17] border border-[#28354D] rounded-lg px-3 py-2 text-white"
                placeholder="+48 600 000 000"
              />
            </div>
            <div>
              <label className="block text-[#94A3B8] font-bold mb-1">Profil LinkedIn</label>
              <input
                type="url"
                value={formData.linkedinUrl}
                onChange={(e) => setFormData({ ...formData, linkedinUrl: e.target.value })}
                className="w-full bg-[#0A0E17] border border-[#28354D] rounded-lg px-3 py-2 text-white"
                placeholder="https://linkedin.com/in/..."
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <label className="flex items-center gap-2 text-xs text-[#CBD5E1] cursor-pointer">
              <input
                type="checkbox"
                checked={formData.isPrimary}
                onChange={(e) => setFormData({ ...formData, isPrimary: e.target.checked })}
                className="rounded border-[#28354D] text-[#FFE600] focus:ring-0"
              />
              Główna osoba kontaktowa (Primary)
            </label>
            <button
              type="submit"
              disabled={submitting}
              className="bg-[#FFE600] hover:bg-[#FFF04D] text-black font-extrabold text-xs px-4 py-2 rounded-lg"
            >
              {submitting ? "Zapisywanie..." : "Zapisz kontakt"}
            </button>
          </div>
        </form>
      )}

      {/* List of contacts */}
      {contacts.length === 0 ? (
        <div className="bg-[#141C2E] border border-[#28354D] p-8 rounded-2xl text-center space-y-3">
          <UserCheck size={32} className="mx-auto text-[#64748B]" />
          <p className="text-sm text-[#94A3B8]">Brak zidentyfikowanych kontaktów personalnych w bazie.</p>
          <p className="text-xs text-[#64748B]">
            Domyślnie system wykorzystuje główny adres e-mail firmy: <strong>{lead.emailPrimary || "brak"}</strong>
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {contacts.map((c) => (
            <div key={c.id} className="bg-[#141C2E] p-4 rounded-xl border border-[#28354D] space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-white text-sm">
                      {c.firstName} {c.lastName}
                    </span>
                    {c.isPrimary && (
                      <span className="text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-800 px-2 py-0.2 rounded font-bold uppercase">
                        Główny
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-[#FFE600] font-semibold">{c.role || "Decydent"}</span>
                </div>
              </div>

              <div className="space-y-1.5 text-xs text-[#94A3B8] pt-2 border-t border-[#1E293B]">
                {c.email && (
                  <div className="flex items-center gap-2 text-[#38BDF8]">
                    <Mail size={13} className="text-[#64748B]" /> {c.email}
                  </div>
                )}
                {c.phone && (
                  <div className="flex items-center gap-2 font-mono text-white">
                    <Phone size={13} className="text-[#64748B]" /> {c.phone}
                  </div>
                )}
                {c.linkedinUrl && (
                  <a
                    href={c.linkedinUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 text-[#38BDF8] hover:underline"
                  >
                    <ExternalLink size={13} className="text-[#64748B]" /> Profil LinkedIn
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
