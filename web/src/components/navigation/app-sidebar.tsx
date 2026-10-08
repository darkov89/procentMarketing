"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Building2,
  Compass,
  Upload,
  ShieldCheck,
  History,
  Settings,
  ChevronLeft,
  ChevronRight,
  Plus,
  X,
} from "lucide-react";

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  badge?: string;
  badgeVariant?: "yellow" | "sky" | "amber" | "emerald" | "default";
  match: (pathname: string) => boolean;
  tooltip: string;
}

interface NavGroup {
  groupName: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    groupName: "Kokpit & CRM",
    items: [
      {
        href: "/dashboard",
        label: "Dashboard",
        icon: LayoutDashboard,
        tooltip: "Przegląd metryk i wskaźników",
        match: (p) => p === "/dashboard" || p === "/",
      },
      {
        href: "/leads",
        label: "Pipeline CRM",
        icon: Building2,
        tooltip: "Baza kontaktów i firm",
        match: (p) => p.startsWith("/leads") && !p.startsWith("/leads/import"),
      },
    ],
  },
  {
    groupName: "Autonomiczne Pozyskiwanie",
    items: [
      {
        href: "/discovery",
        label: "Skaner Miejsc & CEIDG",
        icon: Compass,
        badge: "Auto",
        badgeVariant: "yellow",
        tooltip: "Automatyczne pozyskiwanie z Google Places i rejestrów",
        match: (p) => p.startsWith("/discovery"),
      },
      {
        href: "/leads/import",
        label: "Import Bazy (CSV/XLS)",
        icon: Upload,
        tooltip: "Importowanie rekordów z plików",
        match: (p) => p.startsWith("/leads/import"),
      },
    ],
  },
  {
    groupName: "Oferty & Outreach",
    items: [
      {
        href: "/outbox",
        label: "Do Zatwierdzenia",
        icon: ShieldCheck,
        badge: "AI Review",
        badgeVariant: "amber",
        tooltip: "Akceptacja wygenerowanych ofert i maili (AI Act Art. 14)",
        match: (p) => p === "/outbox",
      },
      {
        href: "/outbox/history",
        label: "Baza Wysłanych",
        icon: History,
        tooltip: "Historia korespondencji i odsłon stron ofert /o/[token]",
        match: (p) => p.startsWith("/outbox/history"),
      },
    ],
  },
  {
    groupName: "System",
    items: [
      {
        href: "/settings",
        label: "Ustawienia & Profil",
        icon: Settings,
        tooltip: "Konfiguracja nadawcy, SMTP/IMAP i zespołów",
        match: (p) => p.startsWith("/settings"),
      },
    ],
  },
];

interface AppSidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export function AppSidebar({
  collapsed,
  onToggleCollapse,
  mobileOpen,
  onCloseMobile,
}: AppSidebarProps) {
  const pathname = usePathname();

  const getBadgeClass = (variant?: string) => {
    switch (variant) {
      case "yellow":
        return "bg-[#FFE600] text-black font-black";
      case "amber":
        return "bg-amber-950/90 text-amber-300 border border-amber-800/60";
      case "sky":
        return "bg-sky-950/90 text-sky-300 border border-sky-800/60";
      case "emerald":
        return "bg-emerald-950/90 text-emerald-300 border border-emerald-800/60";
      default:
        return "bg-slate-800 text-slate-300 border border-slate-700";
    }
  };

  const sidebarContent = (
    <div className="flex flex-col h-full bg-[#090E17] border-r border-slate-800/80 select-none">
      {/* Brand & System Status */}
      <div className={`p-4 border-b border-slate-800/80 flex items-center ${collapsed ? "justify-center" : "justify-between"} gap-2`}>
        <Link
          href="/dashboard"
          onClick={onCloseMobile}
          className="flex items-center gap-3 group focus:outline-none"
        >
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#FFE600] to-yellow-500 text-black font-black flex items-center justify-center text-base shadow-lg shadow-yellow-500/20 group-hover:scale-105 transition-transform shrink-0">
            %
          </div>
          {!collapsed && (
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-black tracking-wider text-white uppercase group-hover:text-[#FFE600] transition-colors truncate">
                Procent Marketing
              </span>
              <span className="text-[10px] font-mono text-slate-400 flex items-center gap-1.5 truncate">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
                </span>
                Lead Machine 2.0
              </span>
            </div>
          )}
        </Link>

        {mobileOpen && (
          <button
            type="button"
            onClick={onCloseMobile}
            className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
            aria-label="Zamknij menu"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* Primary Action Button (ActiveCampaign style "+ Skaner") */}
      <div className="p-3">
        <Link
          href="/discovery"
          onClick={onCloseMobile}
          title={collapsed ? "Nowy Skaner Google Places" : undefined}
          className={`flex items-center ${
            collapsed ? "justify-center p-2.5" : "justify-center gap-2 px-3.5 py-2.5"
          } bg-[#FFE600] hover:bg-[#FFF04D] text-black font-black text-xs rounded-xl transition-all shadow-md shadow-yellow-500/20 active:scale-95`}
        >
          <Plus size={16} strokeWidth={3} />
          {!collapsed && <span>+ Skanuj Miejsca</span>}
        </Link>
      </div>

      {/* Navigation Groups */}
      <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-5 scrollbar-thin scrollbar-thumb-slate-800">
        {NAV_GROUPS.map((group) => (
          <div key={group.groupName} className="space-y-1">
            {!collapsed && (
              <div className="px-2.5 pb-1 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                {group.groupName}
              </div>
            )}
            <div className="space-y-1">
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = item.match(pathname);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onCloseMobile}
                    title={collapsed ? `${item.label} — ${item.tooltip}` : undefined}
                    className={`flex items-center ${
                      collapsed
                        ? "justify-center p-2.5"
                        : "justify-between px-3 py-2"
                    } rounded-xl text-xs font-bold transition-all group ${
                      isActive
                        ? "bg-[#FFE600] text-black shadow-md shadow-yellow-500/10 font-extrabold"
                        : "text-slate-400 hover:text-white hover:bg-slate-800/60"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Icon
                        size={17}
                        className={`shrink-0 ${
                          isActive
                            ? "text-black"
                            : "text-slate-400 group-hover:text-[#FFE600] transition-colors"
                        }`}
                      />
                      {!collapsed && <span className="truncate">{item.label}</span>}
                    </div>

                    {!collapsed && item.badge && (
                      <span
                        className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider shrink-0 ${getBadgeClass(
                          item.badgeVariant
                        )}`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer: Status, User, Collapse Toggle */}
      <div className="border-t border-slate-800/80 p-3 space-y-2 bg-[#060A11]">
        {/* Environment Badge */}
        {!collapsed ? (
          <div className="bg-[#111827] border border-slate-800 rounded-xl p-2.5 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
              </span>
              <span className="text-[11px] font-bold text-slate-300">Tryb Systemu:</span>
            </div>
            <span className="text-[10px] font-mono font-bold text-amber-300 bg-amber-950/80 border border-amber-800/60 px-2 py-0.5 rounded-full">
              TEST MODE
            </span>
          </div>
        ) : (
          <div
            className="flex justify-center py-1 text-amber-400"
            title="Tryb systemu: TEST MODE"
          >
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500" />
            </span>
          </div>
        )}

        {/* User profile & Collapse button */}
        <div className="flex items-center justify-between gap-1 pt-1">
          <Link
            href="/settings"
            onClick={onCloseMobile}
            className={`flex items-center ${
              collapsed ? "justify-center w-full" : "gap-2.5 flex-1 min-w-0"
            } p-1.5 rounded-xl hover:bg-slate-800/60 transition-colors group`}
            title="Ustawienia profilu"
          >
            <div className="w-7 h-7 rounded-lg bg-slate-800 border border-slate-700 text-[#FFE600] font-black text-xs flex items-center justify-center shrink-0 group-hover:border-[#FFE600] transition-colors">
              DO
            </div>
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold text-white truncate group-hover:text-[#FFE600] transition-colors">
                  Dariusz
                </div>
                <div className="text-[10px] text-slate-400 truncate font-mono">
                  Właściciel / Admin
                </div>
              </div>
            )}
          </Link>

          {/* Collapse/Expand Toggle on Desktop */}
          <button
            type="button"
            onClick={onToggleCollapse}
            className="hidden lg:flex items-center justify-center w-8 h-8 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title={collapsed ? "Rozwiń menu (Sidebar)" : "Zwiń menu (Sidebar)"}
            aria-label={collapsed ? "Rozwiń menu" : "Zwiń menu"}
          >
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar (Sticky, Height Screen) */}
      <aside
        className={`hidden lg:block h-screen sticky top-0 shrink-0 z-40 transition-all duration-300 ${
          collapsed ? "w-20" : "w-64"
        }`}
      >
        {sidebarContent}
      </aside>

      {/* Mobile Drawer (Backdrop + Slide-over) */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <div className="relative flex-1 flex flex-col max-w-xs w-full">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}
