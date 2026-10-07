"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
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
  const [mobileOpen, setMobileOpen] = useState(false);

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
    <header className="bg-[#0A0E17] border-b border-[#28354D] sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16 gap-4">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="flex items-center gap-2.5 group">
              <div className="w-8 h-8 rounded-lg bg-[#FFE600] text-black font-black flex items-center justify-center text-sm shadow-md shadow-yellow-500/20 group-hover:scale-105 transition-transform">
                %
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-black tracking-wider text-white uppercase group-hover:text-[#FFE600] transition-colors">
                  Procent Marketing
                </span>
                <span className="text-[10px] font-mono text-[#94A3B8]">
                  Lead Machine 2.0
                </span>
              </div>
            </Link>

            <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#1E293B] text-[#38BDF8] border border-[#334155]">
              LIVE_MODE: TEST
            </span>
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
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    isActive
                      ? "bg-[#FFE600] text-black shadow-md shadow-yellow-500/10 font-extrabold"
                      : "text-[#94A3B8] hover:text-white hover:bg-[#141C2E]"
                  }`}
                >
                  <Icon size={15} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Desktop Action & Mobile Toggle */}
          <div className="flex items-center gap-2.5">
            <Link
              href="/discovery"
              className="hidden sm:flex items-center gap-1.5 bg-[#141C2E] hover:bg-[#1E293B] border border-[#28354D] hover:border-[#FFE600] text-[#FFE600] font-bold text-xs px-3.5 py-2 rounded-xl transition-all"
            >
              <Plus size={14} />
              <span>Skanuj Google Places</span>
            </Link>

            {/* Mobile hamburger */}
            <button
              type="button"
              onClick={() => setMobileOpen((prev) => !prev)}
              className="lg:hidden p-2 rounded-xl text-[#94A3B8] hover:text-white hover:bg-[#141C2E] border border-[#28354D] cursor-pointer"
              aria-label="Toggle menu"
            >
              {mobileOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Menu */}
        {mobileOpen && (
          <div className="lg:hidden border-t border-[#28354D] py-3 space-y-1">
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
                      : "text-[#94A3B8] hover:text-white hover:bg-[#141C2E]"
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
