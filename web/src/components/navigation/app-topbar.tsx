"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Menu,
  Search,
  Plus,
  User,
  Zap,
} from "lucide-react";

interface AppTopBarProps {
  onOpenMobile: () => void;
}

export function AppTopBar({ onOpenMobile }: AppTopBarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Keyboard shortcut Cmd+K or Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    router.push(`/leads?search=${encodeURIComponent(searchQuery.trim())}`);
  };

  const getSectionTitle = () => {
    if (pathname === "/dashboard" || pathname === "/") return "Panel Dowodzenia (Cockpit)";
    if (pathname.startsWith("/leads/import")) return "Import Bazy Kontaktów";
    if (pathname.startsWith("/leads")) return "Pipeline CRM & Baza Leadów";
    if (pathname.startsWith("/discovery")) return "Lead Generator & Odkrywanie";
    if (pathname === "/outbox") return "Do Zatwierdzenia (AI Act)";
    if (pathname.startsWith("/outbox/history")) return "Baza Wysłanych & Raporty";
    if (pathname.startsWith("/settings")) return "Ustawienia & Profil Nadawcy";
    return "Lead Machine 2.0";
  };

  return (
    <header className="h-14 bg-[#0B0F19]/90 backdrop-blur-md border-b border-slate-800/80 sticky top-0 z-30 px-4 sm:px-6 flex items-center justify-between gap-4">
      {/* Left: Mobile hamburger + Breadcrumb Title */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onOpenMobile}
          className="lg:hidden p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800"
          aria-label="Otwórz menu nawigacji"
        >
          <Menu size={18} />
        </button>

        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs font-mono text-slate-400 hidden sm:inline">Lead Machine /</span>
          <h2 className="text-sm font-black text-white truncate">
            {getSectionTitle()}
          </h2>
        </div>
      </div>

      {/* Center / Right: Search & Actions */}
      <div className="flex items-center gap-3 shrink-0">
        {/* Fast Universal Search */}
        <form onSubmit={handleSearchSubmit} className="relative hidden md:flex items-center">
          <Search size={14} className="absolute left-3 text-slate-500 pointer-events-none" />
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Szukaj firmy, NIP, miasta..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-[#111827] border border-slate-800 hover:border-slate-700 focus:border-[#FFE600] text-xs text-white placeholder-slate-500 rounded-xl pl-9 pr-12 py-1.5 w-52 lg:w-64 focus:w-72 transition-all focus:outline-none"
          />
          <span className="absolute right-2 text-[9px] font-mono text-slate-500 border border-slate-700/80 px-1.5 py-0.5 rounded bg-slate-800 pointer-events-none">
            ⌘K
          </span>
        </form>

        {/* Autonomous Engine Status Badge */}
        <div className="hidden xl:flex items-center gap-2 bg-[#111827] border border-slate-800 px-3 py-1 rounded-xl text-xs">
          <Zap size={13} className="text-[#FFE600]" />
          <span className="text-[11px] font-semibold text-slate-300">
            Auto-Pilot: <strong className="text-emerald-400">Aktywny</strong>
          </span>
        </div>

        {/* Quick Skaner Button */}
        <Link
          href="/discovery"
          className="flex items-center gap-1.5 bg-[#FFE600] hover:bg-[#FFF04D] text-black font-extrabold text-xs px-3.5 py-1.5 rounded-xl transition-all shadow-md shadow-yellow-500/10 active:scale-95"
        >
          <Plus size={14} strokeWidth={2.5} />
          <span className="hidden sm:inline">Nowy Skaner</span>
        </Link>

        {/* Account Button */}
        <Link
          href="/settings"
          className="flex items-center justify-center w-8 h-8 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 hover:text-white hover:border-[#FFE600] transition-colors"
          title="Ustawienia i profil"
        >
          <User size={15} />
        </Link>
      </div>
    </header>
  );
}
