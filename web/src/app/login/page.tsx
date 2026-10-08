"use client";

import React, { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Lock,
  Mail,
  User,
  Key,
  ShieldCheck,
  ArrowRight,
  Sparkles,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectPath = searchParams.get("redirect") || "/";

  const [mode, setMode] = useState<"login" | "register">("login");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Login form state
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // Register form state
  const [inviteCode, setInviteCode] = useState(searchParams.get("code") || "");
  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });
      const data = await res.json();

      if (data.success) {
        setSuccessMsg(`Zalogowano pomyślnie! Przekierowanie...`);
        const target = redirectPath && redirectPath !== "/login" ? redirectPath : "/dashboard";
        setTimeout(() => {
          window.location.href = target;
        }, 500);
      } else {
        setError(data.error || "Błąd logowania");
      }
    } catch {
      setError("Błąd połączenia z serwerem");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inviteCode,
          name: regName,
          email: regEmail,
          password: regPassword,
        }),
      });
      const data = await res.json();

      if (data.success) {
        setSuccessMsg("Konto zostało utworzone! Przekierowanie do panelu...");
        const target = redirectPath && redirectPath !== "/login" ? redirectPath : "/dashboard";
        setTimeout(() => {
          window.location.href = target;
        }, 800);
      } else {
        setError(data.error || "Błąd rejestracji");
      }
    } catch {
      setError("Błąd połączenia z serwerem");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0C10] text-[#F3F4F6] flex flex-col justify-center items-center p-4">
      {/* Background Glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-[#FFE600]/5 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-[#141C2E] border border-[#28354D] mb-3 shadow-lg">
            <span className="text-[#FFE600] font-black text-2xl tracking-wider mr-2 font-mono">
              %
            </span>
            <span className="font-extrabold text-white text-lg tracking-wide">
              PROCENT MARKETING
            </span>
          </div>
          <h1 className="text-2xl font-black text-white mt-1">Lead Machine 2.0</h1>
          <p className="text-xs text-[#94A3B8] mt-1 flex items-center justify-center gap-1.5 font-medium">
            <ShieldCheck size={14} className="text-[#FFE600]" />
            Dostęp zamknięty — wyłącznie na zaproszenie
          </p>
        </div>

        {/* Auth Card */}
        <div className="bg-[#141C2E] border border-[#28354D] rounded-3xl p-7 shadow-2xl backdrop-blur-xl">
          {/* Mode Switcher */}
          <div className="grid grid-cols-2 p-1 bg-[#0A0E17] rounded-xl border border-[#28354D] mb-6">
            <button
              type="button"
              onClick={() => {
                setMode("login");
                setError(null);
              }}
              className={`py-2 text-xs font-extrabold rounded-lg transition-all ${
                mode === "login"
                  ? "bg-[#FFE600] text-black shadow-md"
                  : "text-[#94A3B8] hover:text-white"
              }`}
            >
              Logowanie
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("register");
                setError(null);
              }}
              className={`py-2 text-xs font-extrabold rounded-lg transition-all ${
                mode === "register"
                  ? "bg-[#FFE600] text-black shadow-md"
                  : "text-[#94A3B8] hover:text-white"
              }`}
            >
              Mam Zaproszenie
            </button>
          </div>

          {/* Feedback Messages */}
          {error && (
            <div className="mb-5 p-3.5 bg-rose-950/40 border border-rose-800/80 rounded-xl flex items-center gap-2.5 text-xs text-rose-300 animate-in fade-in">
              <AlertCircle size={16} className="shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="mb-5 p-3.5 bg-emerald-950/40 border border-emerald-800/80 rounded-xl flex items-center gap-2.5 text-xs text-emerald-300 animate-in fade-in">
              <CheckCircle2 size={16} className="shrink-0 text-emerald-400" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* MODE 1: LOGIN */}
          {mode === "login" && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#94A3B8] mb-1.5">
                  Adres E-mail
                </label>
                <div className="relative">
                  <Mail
                    size={16}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#64748B]"
                  />
                  <input
                    type="email"
                    required
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="twoj.email@procentmarketing.pl"
                    className="w-full bg-[#0A0E17] border border-[#28354D] rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-[#FFE600] transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#94A3B8] mb-1.5">
                  Hasło
                </label>
                <div className="relative">
                  <Lock
                    size={16}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#64748B]"
                  />
                  <input
                    type="password"
                    required
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-[#0A0E17] border border-[#28354D] rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-[#FFE600] transition-colors"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 bg-[#FFE600] hover:bg-[#FFF04D] text-black font-extrabold text-sm py-3 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-yellow-500/10 disabled:opacity-50 cursor-pointer"
              >
                {loading ? "Weryfikacja..." : "Zaloguj do Panelu"}
                <ArrowRight size={16} />
              </button>
            </form>
          )}

          {/* MODE 2: REGISTER WITH INVITATION */}
          {mode === "register" && (
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#94A3B8] mb-1.5 flex items-center justify-between">
                  <span>Kod Zaproszenia</span>
                  <span className="text-[10px] text-[#FFE600] font-normal">Wymagany</span>
                </label>
                <div className="relative">
                  <Key
                    size={16}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#FFE600]"
                  />
                  <input
                    type="text"
                    required
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value)}
                    placeholder="Wklej kod zaproszenia (np. inv_...)"
                    className="w-full bg-[#0A0E17] border border-[#28354D] rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-white font-mono focus:outline-none focus:border-[#FFE600] transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#94A3B8] mb-1.5">
                  Imię i Nazwisko
                </label>
                <div className="relative">
                  <User
                    size={16}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#64748B]"
                  />
                  <input
                    type="text"
                    required
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    placeholder="Jan Kowalski"
                    className="w-full bg-[#0A0E17] border border-[#28354D] rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-[#FFE600] transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#94A3B8] mb-1.5">
                  Adres E-mail
                </label>
                <div className="relative">
                  <Mail
                    size={16}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#64748B]"
                  />
                  <input
                    type="email"
                    required
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    placeholder="twoj.email@procentmarketing.pl"
                    className="w-full bg-[#0A0E17] border border-[#28354D] rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-[#FFE600] transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#94A3B8] mb-1.5">
                  Ustaw Hasło (min. 6 znaków)
                </label>
                <div className="relative">
                  <Lock
                    size={16}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#64748B]"
                  />
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-[#0A0E17] border border-[#28354D] rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-[#FFE600] transition-colors"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 bg-[#FFE600] hover:bg-[#FFF04D] text-black font-extrabold text-sm py-3 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-yellow-500/10 disabled:opacity-50 cursor-pointer"
              >
                {loading ? "Tworzenie konta..." : "Aktywuj Zaproszenie & Wejdź"}
                <Sparkles size={16} />
              </button>
            </form>
          )}

          {/* Invitation Notice */}
          <div className="mt-6 pt-5 border-t border-[#28354D] text-center text-[11px] text-[#64748B]">
            Rejestracja jest możliwa wyłącznie po otrzymaniu unikalnego kodu od administratora systemu Procent Marketing.
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-[#64748B] mt-6">
          &copy; {new Date().getFullYear()} Procent Marketing. System chroniony i monitorowany.
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0A0C10] flex items-center justify-center text-white">Ładowanie...</div>}>
      <LoginForm />
    </Suspense>
  );
}
