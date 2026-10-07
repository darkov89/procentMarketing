"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Building,
  Compass,
  Upload,
  ShieldCheck,
  History,
  Settings,
  Menu,
  X,
  Plus,
  Search,
  Command,
  User,
  Sparkles,
} from "lucide-react";

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  match: (pathname: string) => boolean;
}

const NAV_ITEMS: NavItem[] = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    match: (p) => p === "/dashboard" || p === "/",
  },
  {
    href: "/leads",
    label: "Pipeline CRM",
    icon: Building,
    match: (p) => p.startsWith("/leads") && !p.startsWith("/leads/import"),
  },
  {
    href: "/discovery",
    label: "Generator & Odkrywanie",
    icon: Compass,
    match: (p) => p.startsWith("/discovery"),
  },
  {
    href: "/leads/import",
    label: "Import Bazy",
    icon: Upload,
    match: (p) => p.startsWith("/leads/import"),
  },
  {
    href: "/outbox",
    label: "Do Zatwierdzenia",
    icon: ShieldCheck,
    match: (p) => p === "/outbox",
  },
  {
    href: "/outbox/history",
    label: "Baza Wysłanych",
    icon: History,
    match: (p) => p.startsWith("/outbox/history"),
  },
  {
    href: "/settings",
    label: "Ustawienia",
    icon: Settings,
    match: (p) => p.startsWith("/settings"),
  },
];

export function AppNavbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Global shortcut Cmd+K or Ctrl+K
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

  // Hide on public landing pages and auth screens
  if (
    !pathname ||
    pathname.startsWith("/o/") ||
    pathname.startsWith("/offers/") ||
    pathname === "/login" ||
    pathname.startsWith("/invite")
  ) {
    return null;
  }

  return (
    <header className="bg-[#0B0F19]/95 backdrop-blur-md border-b border-white/[0.08] sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16 gap-3">
          {/* Brand & Organization */}
          <div className="flex items-center gap-3 shrink-0">
            <Link href="/dashboard" className="flex items-center gap-2.5 group">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#FFE600] to-yellow-500 text-black font-black flex items-center justify-center text-sm shadow-md shadow-yellow-500/20 group-hover:scale-105 transition-transform">
                %
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-black tracking-wider text-white uppercase group-hover:text-[#FFE600] transition-colors leading-tight">
                  Procent Marketing
                </span>
                <span className="text-[10px] font-mono text-slate-400">
                  Lead Machine 2.0
                </span>
              </div>
            </Link>

            <div className="hidden xl:flex items-center gap-1.5 pl-2 border-l border-slate-800">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
              </span>
              <span className="text-[10px] font-mono font-bold text-amber-300 bg-amber-950/60 border border-amber-800/60 px-2 py-0.5 rounded-full">
                TEST MODE
              </span>
            </div>
          </div>

          {/* Desktop Nav Links */}
          <nav className="hidden lg:flex items-center gap-1">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = item.match(pathname);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    isActive
                      ? "bg-[#FFE600] text-black shadow-md shadow-yellow-500/20 font-extrabold"
                      : "text-slate-400 hover:text-white hover:bg-slate-800/60"
                  }`}
                >
                  <Icon size={14} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Search, Action & User Profile */}
          <div className="flex items-center gap-2.5">
            {/* Quick Search */}
            <form onSubmit={handleSearchSubmit} className="hidden md:flex items-center relative">
              <Search size={14} className="absolute left-3 text-slate-500 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Szukaj w bazie (⌘K)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-[#131B2F] border border-slate-800 hover:border-slate-700 focus:border-[#FFE600] text-xs text-white placeholder-slate-500 rounded-xl pl-9 pr-8 py-1.5 w-48 lg:w-56 focus:w-64 transition-all focus:outline-none"
              />
              <span className="absolute right-2.5 text-[9px] font-mono text-slate-500 border border-slate-700/80 px-1 py-0.2 rounded bg-slate-800/80 pointer-events-none">
                ⌘K
              </span>
            </form>

            {/* Quick Skaner Button */}
            <Link
              href="/discovery"
              className="hidden sm:flex items-center gap-1.5 bg-[#FFE600] hover:bg-[#FFF04D] text-black font-extrabold text-xs px-3.5 py-1.5 rounded-xl transition-all shadow-md shadow-yellow-500/10 shrink-0"
            >
              <Plus size={14} />
              <span>Skaner Miejsc</span>
            </Link>

            {/* User Avatar */}
            <Link
              href="/settings"
              className="flex items-center justify-center w-8 h-8 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 hover:text-white hover:border-[#FFE600] transition-colors shrink-0"
              title="Konto i Ustawienia"
            >
              <User size={15} />
            </Link>

            {/* Mobile hamburger */}
            <button
              type="button"
              onClick={() => setMobileOpen((prev) => !prev)}
              className="lg:hidden p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800 cursor-pointer"
              aria-label="Toggle menu"
            >
              {mobileOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Menu */}
        {mobileOpen && (
          <div className="lg:hidden border-t border-slate-800 py-3 space-y-1">
            <form onSubmit={handleSearchSubmit} className="pb-2">
              <input
                type="text"
                placeholder="Szukaj firmy, NIP, miasta..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#131B2F] border border-slate-800 text-xs text-white placeholder-slate-500 rounded-xl px-3 py-2 focus:outline-none focus:border-[#FFE600]"
              />
            </form>

            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = item.match(pathname);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
                    isActive
                      ? "bg-[#FFE600] text-black font-extrabold"
                      : "text-slate-400 hover:text-white hover:bg-slate-800/80"
                  }`}
                >
                  <Icon size={16} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
            <div className="pt-2">
              <Link
                href="/discovery"
                onClick={() => setMobileOpen(false)}
                className="flex items-center justify-center gap-2 bg-[#FFE600] text-black font-extrabold text-xs py-2.5 rounded-xl w-full"
              >
                <Plus size={14} />
                <span>+ Skanuj Google Places</span>
              </Link>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
