import React from "react";
import { User, Users, ShieldCheck, Sparkles, Key, CheckCircle2, Copy, Clock, Trash2, X } from "lucide-react";

export interface TeamUserState {
  id: number;
  name?: string | null;
  email: string;
  role: string;
  createdAt?: string | null;
}

export interface InvitationState {
  id: number;
  email?: string | null;
  role: string;
  status: string;
  code: string;
  expiresAt?: string | null;
}

interface TeamSectionProps {
  users: TeamUserState[];
  invitations: InvitationState[];
  currentUser: {
    id: number;
    email: string;
    name: string;
    role: string;
  } | null;
  inviteEmail: string;
  setInviteEmail: (v: string) => void;
  inviteRole: string;
  setInviteRole: (v: string) => void;
  inviteGenerating: boolean;
  generatedInviteUrl: string | null;
  onCreateInvitation: (e: React.FormEvent) => Promise<void>;
  onRevokeInvitation: (id: number) => Promise<void>;
  onUpdateUserRole: (userId: number, newRole: "admin" | "member") => Promise<void>;
  onDeleteUser: (userId: number, userName: string) => Promise<void>;
  onCopyUrl: (url: string) => void;
}

export function TeamSection({
  users,
  invitations,
  currentUser,
  inviteEmail,
  setInviteEmail,
  inviteRole,
  setInviteRole,
  inviteGenerating,
  generatedInviteUrl,
  onCreateInvitation,
  onRevokeInvitation,
  onUpdateUserRole,
  onDeleteUser,
  onCopyUrl,
}: TeamSectionProps) {
  return (
    <div className="space-y-6">
      {/* Intro Header */}
      <div className="bg-[#141C2E] border border-[#28354D] p-6 rounded-2xl shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-[#FFE600] text-black rounded-xl font-bold">
            <Users size={24} />
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-white">
              Zarządzanie Zespołem & Bezpieczeństwo Dostępu
            </h2>
            <p className="text-xs text-[#94A3B8] mt-0.5">
              Kontrola dostępu do CRM, uprawnienia członków organizacji oraz bezpieczne, jednorazowe zaproszenia imienne.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-[#0A0E17] border border-[#28354D] px-3.5 py-1.5 rounded-full text-xs font-bold text-[#34D399]">
          <ShieldCheck size={14} className="text-[#34D399]" />
          <span>TRYB ZAMKNIĘTY (INVITE-ONLY)</span>
        </div>
      </div>

      {/* 1. Active Team Members List */}
      <div className="bg-[#141C2E] border border-[#28354D] p-6 rounded-2xl shadow-xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#28354D] pb-3">
          <div>
            <h3 className="text-base font-extrabold text-white flex items-center gap-2">
              <User size={18} className="text-[#FFE600]" />
              Aktywni Członkowie Organizacji ({users.length})
            </h3>
            <p className="text-xs text-[#94A3B8] mt-0.5">
              Użytkownicy posiadający aktywny dostęp do platformy, ofert i bazy leadów.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#0A0E17] text-[#94A3B8] font-bold uppercase tracking-wider">
              <tr>
                <th className="p-3.5">Użytkownik</th>
                <th className="p-3.5">Rola w Organizacji</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5">Data Dołączenia</th>
                <th className="p-3.5 text-right">Zarządzanie</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#28354D]">
              {users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-[#94A3B8]">
                    Brak użytkowników w organizacji.
                  </td>
                </tr>
              ) : (
                users.map((u) => {
                  const isSelf = currentUser?.id === u.id || currentUser?.email === u.email;
                  const initials = (u.name || u.email || "U")
                    .split(" ")
                    .map((p: string) => p[0])
                    .join("")
                    .toUpperCase()
                    .slice(0, 2);

                  return (
                    <tr key={u.id} className="hover:bg-[#1E293B]/40 transition-colors">
                      <td className="p-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-[#1E293B] border border-[#38BDF8]/40 text-[#38BDF8] flex items-center justify-center font-bold text-xs">
                            {initials}
                          </div>
                          <div>
                            <div className="font-bold text-white flex items-center gap-1.5">
                              <span>{u.name || "Użytkownik"}</span>
                              {isSelf && (
                                <span className="text-[10px] bg-[#FFE600]/20 text-[#FFE600] px-1.5 py-0.2 rounded font-bold">
                                  Ty
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-[#94A3B8] font-mono">{u.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="p-3.5">
                        <select
                          value={u.role}
                          disabled={isSelf}
                          onChange={(e) => onUpdateUserRole(u.id, e.target.value as "admin" | "member")}
                          className={`text-xs font-bold px-2.5 py-1 rounded-lg border focus:outline-none transition-all ${
                            u.role === "admin"
                              ? "bg-amber-950/60 text-amber-300 border-amber-800"
                              : "bg-blue-950/60 text-blue-300 border-blue-800"
                          } ${isSelf ? "opacity-75 cursor-not-allowed" : "cursor-pointer hover:border-[#FFE600]"}`}
                        >
                          <option value="admin">Administrator (Pełny dostęp)</option>
                          <option value="member">Specjalista B2B (Dostęp operacyjny)</option>
                        </select>
                      </td>
                      <td className="p-3.5">
                        <span className="badge badge-approved">AKTYWNY</span>
                      </td>
                      <td className="p-3.5 text-[#94A3B8] font-mono">
                        {u.createdAt ? new Date(u.createdAt).toLocaleDateString("pl-PL") : "—"}
                      </td>
                      <td className="p-3.5 text-right">
                        {isSelf ? (
                          <span className="text-[11px] text-[#64748B] italic">Konto zalogowane</span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => onDeleteUser(u.id, u.name || u.email)}
                            className="text-xs bg-[#881337]/30 hover:bg-[#881337] border border-[#E11D48]/40 hover:border-[#E11D48] text-[#FB7185] hover:text-white px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer inline-flex items-center gap-1"
                          >
                            <Trash2 size={12} />
                            <span>Odbierz dostęp</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 2. Invite New Team Member Form */}
      <div className="bg-[#141C2E] border border-[#28354D] p-6 rounded-2xl shadow-xl space-y-4">
        <div className="border-b border-[#28354D] pb-3">
          <h3 className="text-base font-extrabold text-white flex items-center gap-2">
            <Sparkles size={18} className="text-[#FFE600]" />
            Zaproś Nowego Współpracownika do Zespołu
          </h3>
          <p className="text-xs text-[#94A3B8] mt-0.5">
            Wprowadź adres e-mail pracownika. System wygeneruje unikalne, jednorazowe zaproszenie chronione tokenem kryptograficznym (ważne 7 dni).
          </p>
        </div>

        <form onSubmit={onCreateInvitation} className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[#94A3B8] mb-1.5">
              Adres E-mail Pracownika (Wymagany)
            </label>
            <input
              type="email"
              required
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="np. marcin.kowalski@twojadomena.pl"
              className="w-full bg-[#0A0E17] border border-[#28354D] rounded-lg px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-[#FFE600]"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[#94A3B8] mb-1.5">
              Rola w Organizacji
            </label>
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value)}
              className="w-full bg-[#0A0E17] border border-[#28354D] rounded-lg px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-[#FFE600]"
            >
              <option value="member">Specjalista B2B (Dostęp do leadów, audytów i ofert)</option>
              <option value="admin">Administrator (Pełny dostęp do ustawień i zespołu)</option>
            </select>
          </div>

          <div className="flex items-end">
            <button
              type="submit"
              disabled={inviteGenerating || !inviteEmail}
              className="w-full bg-[#FFE600] hover:bg-[#FFF04D] text-black font-extrabold text-sm px-6 py-2.5 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-yellow-500/10 disabled:opacity-50 cursor-pointer"
            >
              <Key size={16} />
              {inviteGenerating ? "Generowanie..." : "Wygeneruj Imienne Zaproszenie"}
            </button>
          </div>
        </form>

        {/* Display Generated URL */}
        {generatedInviteUrl && (
          <div className="mt-4 p-4 bg-[#0A0E17] border border-emerald-500/50 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-3 animate-in fade-in">
            <div className="w-full overflow-hidden">
              <span className="text-xs font-bold text-[#34D399] flex items-center gap-1.5 uppercase tracking-wider mb-1">
                <CheckCircle2 size={15} /> Gotowy, Bezpieczny Link Zaproszenia:
              </span>
              <input
                type="text"
                readOnly
                value={generatedInviteUrl}
                className="w-full bg-[#141C2E] text-sm text-white font-mono px-3 py-1.5 rounded-lg border border-[#28354D] focus:outline-none select-all"
              />
              <p className="text-[11px] text-[#94A3B8] mt-1.5">
                Prześlij ten link pracownikowi. Po otwarciu ustawi swoje hasło i natychmiast uzyska dostęp do platformy.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onCopyUrl(generatedInviteUrl)}
              className="shrink-0 bg-[#38BDF8]/20 hover:bg-[#38BDF8]/30 border border-[#38BDF8]/60 text-[#38BDF8] font-bold text-xs px-4 py-2.5 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Copy size={15} /> Kopiuj Link
            </button>
          </div>
        )}
      </div>

      {/* 3. Pending Invitations Table */}
      <div className="bg-[#141C2E] border border-[#28354D] p-6 rounded-2xl shadow-xl space-y-4">
        <div className="border-b border-[#28354D] pb-3">
          <h3 className="text-base font-extrabold text-white flex items-center gap-2">
            <Clock size={18} className="text-[#38BDF8]" />
            Oczekujące Zaproszenia ({invitations.filter((i) => i.status === "active").length})
          </h3>
          <p className="text-xs text-[#94A3B8] mt-0.5">
            Lista aktywnych linków zaproszeniowych oczekujących na dokończenie rejestracji przez współpracowników.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#0A0E17] text-[#94A3B8] font-bold uppercase tracking-wider">
              <tr>
                <th className="p-3">Adres E-mail Odbiorcy</th>
                <th className="p-3">Przypisana Rola</th>
                <th className="p-3">Status</th>
                <th className="p-3">Ważność</th>
                <th className="p-3 text-right">Akcje</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#28354D]">
              {invitations.filter((i) => i.status === "active").length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-5 text-center text-[#94A3B8]">
                    Brak oczekujących zaproszeń. Wszyscy współpracownicy aktywowali swoje konta.
                  </td>
                </tr>
              ) : (
                invitations
                  .filter((inv) => inv.status === "active")
                  .map((inv) => (
                    <tr key={inv.id} className="hover:bg-[#1E293B]/40 transition-colors">
                      <td className="p-3 font-bold text-white">{inv.email || "Imienne zaproszenie"}</td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded font-bold uppercase text-[10px] ${
                            inv.role === "admin"
                              ? "bg-amber-950 text-amber-300 border border-amber-800"
                              : "bg-blue-950 text-blue-300 border border-blue-800"
                          }`}
                        >
                          {inv.role === "admin" ? "Administrator" : "Specjalista B2B"}
                        </span>
                      </td>
                      <td className="p-3">
                        <span className="text-[10px] font-bold text-amber-300 bg-amber-950/60 px-2 py-0.5 rounded border border-amber-800">
                          Oczekuje na rejestrację
                        </span>
                      </td>
                      <td className="p-3 text-[#94A3B8] font-mono">
                        {inv.expiresAt ? new Date(inv.expiresAt).toLocaleDateString("pl-PL") : "7 dni"}
                      </td>
                      <td className="p-3 text-right space-x-2">
                        <button
                          type="button"
                          onClick={() => {
                            const url = `${typeof window !== "undefined" ? window.location.origin : ""}/invite?code=${inv.code}`;
                            onCopyUrl(url);
                          }}
                          className="text-xs bg-[#1E293B] hover:bg-[#2D3D58] border border-[#334155] text-[#38BDF8] font-bold px-2.5 py-1 rounded-lg transition-all cursor-pointer inline-flex items-center gap-1"
                        >
                          <Copy size={12} /> Kopiuj link
                        </button>
                        <button
                          type="button"
                          onClick={() => onRevokeInvitation(inv.id)}
                          className="text-xs text-[#FB7185] hover:text-white bg-[#881337]/30 hover:bg-[#881337] border border-[#E11D48]/40 hover:border-[#E11D48] font-bold px-2.5 py-1 rounded-lg transition-all cursor-pointer inline-flex items-center gap-1 ml-2"
                        >
                          <X size={12} /> Unieważnij
                        </button>
                      </td>
                    </tr>
                  ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
