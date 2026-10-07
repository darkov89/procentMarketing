"use client";

import React, { useState } from "react";
import { FullLeadDossier } from "../dossier-types";
import { CheckSquare, Plus, Trash2, Calendar, FileText } from "lucide-react";

interface DossierTasksNotesTabProps {
  lead: FullLeadDossier;
  onUpdateNotes?: (notes: string) => Promise<void>;
  showToast: (msg: string, type?: "success" | "error" | "info") => void;
}

interface NoteItem {
  id: string;
  text: string;
  createdAt: string;
}

export function DossierTasksNotesTab({
  lead: _lead,
  showToast,
}: DossierTasksNotesTabProps) {
  const [newNote, setNewNote] = useState("");
  const [notes, setNotes] = useState<NoteItem[]>([]);

  const handleAddNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNote.trim()) return;
    const note: NoteItem = {
      id: Date.now().toString(),
      text: newNote.trim(),
      createdAt: new Date().toISOString(),
    };
    setNotes([note, ...notes]);
    setNewNote("");
    showToast("Dodano notatkę operacyjną", "success");
  };

  return (
    <div className="space-y-6">
      {/* Quick note composer */}
      <div className="bg-[#141C2E] p-5 rounded-2xl border border-[#28354D] space-y-4">
        <h3 className="text-sm font-extrabold uppercase tracking-wider text-white flex items-center gap-2">
          <FileText size={16} className="text-[#FFE600]" />
          Dodaj Notatkę ze Spotkania lub Rozmowy
        </h3>
        <form onSubmit={handleAddNote} className="space-y-3">
          <textarea
            rows={3}
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            placeholder="np. Klient prosi o telefon w poniedziałek po 14:00, interesuje ich pakiet audytu i wdrożenie GA4..."
            className="w-full bg-[#0A0E17] border border-[#28354D] rounded-xl p-3 text-xs text-white focus:outline-none focus:border-[#FFE600]"
          />
          <div className="flex justify-end">
            <button
              type="submit"
              className="bg-[#FFE600] hover:bg-[#FFF04D] text-black font-extrabold text-xs px-4 py-2 rounded-lg flex items-center gap-1.5"
            >
              <Plus size={14} /> Zapisz Notatkę
            </button>
          </div>
        </form>
      </div>

      {/* Notes list */}
      <div className="space-y-3">
        <h4 className="text-xs font-bold uppercase tracking-wider text-[#94A3B8]">
          Zarejestrowane Notatki ({notes.length})
        </h4>

        {notes.length === 0 ? (
          <div className="bg-[#141C2E] border border-[#28354D] p-8 rounded-2xl text-center space-y-2">
            <CheckSquare size={32} className="mx-auto text-[#64748B]" />
            <p className="text-sm text-[#94A3B8]">Brak bieżących notatek dla tego leada.</p>
            <p className="text-xs text-[#64748B]">Wprowadź powyżej ustalenia handlowe lub zadania.</p>
          </div>
        ) : (
          notes.map((n) => (
            <div key={n.id} className="bg-[#141C2E] p-4 rounded-xl border border-[#28354D] space-y-2 text-xs">
              <div className="flex items-center justify-between text-[#94A3B8] text-[11px]">
                <span className="flex items-center gap-1.5">
                  <Calendar size={12} /> {new Date(n.createdAt).toLocaleString("pl-PL")}
                </span>
                <button
                  onClick={() => setNotes(notes.filter((item) => item.id !== n.id))}
                  className="text-rose-400 hover:text-rose-300"
                >
                  <Trash2 size={12} />
                </button>
              </div>
              <p className="text-white leading-relaxed whitespace-pre-line">{n.text}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
