"use client";

import React, { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Key,
  Mail,
  User,
  Lock,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import Link from "next/link";

function InviteForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialCode = searchParams.get("code") || "";

  const [inviteCode, setInviteCode] = useState(initialCode);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inviteCode,
          name,
          email,
          password,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setSuccess(true);
        setTimeout(() => {
          router.push("/");
          router.refresh();
        }, 1200);
      } else {
        setError(data.error || "Błąd podczas aktywacji zaproszenia");
      }
    } catch {
      setError("Błąd połączenia z serwerem");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0C10] text-[#F3F4F6] flex flex-col justify-center items-center p-4">
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-[#FFE600]/5 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-[#141C2E] border border-[#28354D] mb-3 shadow-lg">
            <span className="text-[#FFE600] font-black text-2xl tracking-wider mr-2 font-mono">
              %
            </span>
            <span className="font-extrabold text-white text-lg tracking-wide">
              PROCENT MARKETING
            </span>
          </div>
          <h1 className="text-2xl font-black text-white mt-1">Dołącz do Zespołu</h1>
          <p className="text-xs text-[#94A3B8] mt-1 flex items-center justify-center gap-1.5 font-medium">
            <ShieldCheck size={14} className="text-[#FFE600]" />
            Dostęp autoryzowany — aktywacja imiennego zaproszenia
          </p>
        </div>

        <div className="bg-[#141C2E] border border-[#28354D] rounded-3xl p-7 shadow-2xl backdrop-blur-xl">
          {error && (
            <div className="mb-5 p-3.5 bg-rose-950/40 border border-rose-800/80 rounded-xl flex items-center gap-2.5 text-xs text-rose-300 animate-in fade-in">
              <AlertCircle size={16} className="shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {success ? (
            <div className="p-6 text-center space-y-3">
              <div className="w-12 h-12 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 size={26} />
              </div>
              <h3 className="text-lg font-bold text-white">Zaproszenie aktywowane!</h3>
              <p className="text-xs text-[#94A3B8]">
                Twoje konto zostało utworzone. Trwa logowanie i przekierowanie do panelu głównego...
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#94A3B8] mb-1.5 flex items-center justify-between">
                  <span>Kod Zaproszenia</span>
                  <span className="text-[10px] text-[#FFE600] font-normal">Zweryfikuj</span>
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
                    placeholder="Wklej kod zaproszenia"
                    className="w-full bg-[#0A0E17] border border-[#28354D] rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-white font-mono focus:outline-none focus:border-[#FFE600] transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#94A3B8] mb-1.5">
                  Twoje Imię i Nazwisko
                </label>
                <div className="relative">
                  <User
                    size={16}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#64748B]"
                  />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="np. Anna Nowak"
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
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="twoj.email@procentmarketing.pl"
                    className="w-full bg-[#0A0E17] border border-[#28354D] rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-[#FFE600] transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#94A3B8] mb-1.5">
                  Ustaw Hasło do Konta
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
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minimum 6 znaków"
                    className="w-full bg-[#0A0E17] border border-[#28354D] rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-[#FFE600] transition-colors"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 bg-[#FFE600] hover:bg-[#FFF04D] text-black font-extrabold text-sm py-3 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-yellow-500/10 disabled:opacity-50 cursor-pointer"
              >
                {loading ? "Rejestracja..." : "Aktywuj Konto i Wejdź do Systemu"}
                <Sparkles size={16} />
              </button>
            </form>
          )}

          <div className="mt-6 pt-5 border-t border-[#28354D] text-center text-xs text-[#94A3B8]">
            Masz już aktywne konto?{" "}
            <Link href="/login" className="text-[#FFE600] font-bold hover:underline">
              Zaloguj się
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function InvitePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0A0C10] flex items-center justify-center text-white">Ładowanie...</div>}>
      <InviteForm />
    </Suspense>
  );
}
