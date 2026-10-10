"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Building2,
  ChevronsUpDown,
  Check,
  ShieldCheck,
  Search,
  Sparkles,
  Loader2,
} from "lucide-react";

interface TenantItem {
  id: number;
  slug: string;
  name: string;
  plan: string;
  role: string;
  isDirectMember?: boolean;
}

interface TenantSwitcherProps {
  collapsed?: boolean;
}

export function TenantSwitcher({ collapsed = false }: TenantSwitcherProps) {
  const [tenants, setTenants] = useState<TenantItem[]>([]);
  const [activeTenantId, setActiveTenantId] = useState<number | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [switchingId, setSwitchingId] = useState<number | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch accessible tenants
  const fetchTenants = async () => {
    try {
      const res = await fetch("/api/tenants");
      const data = await res.json();
      if (data.success) {
        setTenants(data.tenants || []);
        setActiveTenantId(data.activeTenantId ?? null);
        setIsSuperAdmin(Boolean(data.isSuperAdmin));
      }
    } catch (err) {
      console.error("Failed to load tenants:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTenants();
  }, []);

  // Close dropdown on outside click or escape
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const handleSwitchTenant = async (tenantId: number) => {
    if (tenantId === activeTenantId || switchingId !== null) return;
    setSwitchingId(tenantId);
    try {
      const res = await fetch("/api/tenants/switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId }),
      });
      const data = await res.json();
      if (data.success) {
        setActiveTenantId(tenantId);
        setIsOpen(false);
        // Force full page reload to re-run server components and query new tenant data
        window.location.reload();
      } else {
        alert(data.error || "Nie udało się przełączyć organizacji.");
      }
    } catch {
      alert("Błąd połączenia podczas przełączania organizacji.");
    } finally {
      setSwitchingId(null);
    }
  };

  const activeTenant = tenants.find((t) => t.id === activeTenantId) || tenants[0];

  const filteredTenants = tenants.filter((t) =>
    t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.slug.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getRoleLabel = (role?: string) => {
    switch (role?.toLowerCase()) {
      case "owner":
        return "Właściciel";
      case "superadmin":
        return "Super Admin";
      case "admin":
        return "Administrator";
      case "member":
        return "Członek";
      case "viewer":
        return "Podgląd";
      default:
        return role || "Użytkownik";
    }
  };

  if (loading) {
    return (
      <div className="h-10 px-2 flex items-center justify-center">
        <Loader2 size={15} className="animate-spin text-slate-500" />
      </div>
    );
  }

  // Collapsed view (icon button with tooltip)
  if (collapsed) {
    return (
      <div className="relative" ref={dropdownRef}>
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          title={`Organizacja: ${activeTenant?.name || "Wybierz"} (${getRoleLabel(activeTenant?.role)})`}
          className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 hover:border-[#FFE600] flex items-center justify-center text-slate-300 hover:text-white transition-all shadow-sm"
        >
          <Building2 size={16} className="text-[#FFE600]" />
        </button>

        {isOpen && (
          <div className="absolute left-12 top-0 z-50 w-72 bg-[#0F172A] border border-slate-700 rounded-2xl shadow-2xl p-2 animate-in fade-in zoom-in-95 duration-100">
            {renderDropdownContent()}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative w-full" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between gap-2 p-2 rounded-xl bg-[#111827]/80 hover:bg-[#1E293B] border border-slate-800 hover:border-slate-700 transition-all text-left group focus:outline-none focus:ring-1 focus:ring-[#FFE600]"
      >
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700/80 flex items-center justify-center text-[#FFE600] shrink-0 group-hover:border-[#FFE600]/60 transition-colors">
            <Building2 size={16} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-black text-white truncate flex items-center gap-1.5">
              <span>{activeTenant?.name || "Wybierz organizację"}</span>
            </div>
            <div className="text-[10px] text-slate-400 font-mono truncate flex items-center gap-1">
              <span>{getRoleLabel(activeTenant?.role)}</span>
              {isSuperAdmin && (
                <span className="text-[9px] bg-amber-950/80 text-amber-300 px-1 rounded border border-amber-800/60 font-bold">
                  SUPER
                </span>
              )}
            </div>
          </div>
        </div>

        <ChevronsUpDown size={14} className="text-slate-400 group-hover:text-slate-200 shrink-0" />
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute left-0 top-full mt-1.5 z-50 w-72 bg-[#0B1120] border border-slate-800 rounded-2xl shadow-2xl p-2 animate-in fade-in zoom-in-95 duration-100">
          {renderDropdownContent()}
        </div>
      )}
    </div>
  );

  function renderDropdownContent() {
    return (
      <div className="space-y-2">
        {/* Header */}
        <div className="px-2 py-1.5 border-b border-slate-800 flex items-center justify-between">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
            Wybierz Organizację
          </span>
          {isSuperAdmin && (
            <span className="text-[9px] font-mono text-[#FFE600] bg-yellow-950/60 border border-yellow-800/60 px-1.5 py-0.5 rounded-full flex items-center gap-1">
              <ShieldCheck size={10} />
              Super Admin
            </span>
          )}
        </div>

        {/* Filter input if multiple tenants */}
        {tenants.length > 3 && (
          <div className="relative px-1">
            <Search size={13} className="absolute left-3 top-2.5 text-slate-500" />
            <input
              type="text"
              placeholder="Filtruj organizacje..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#162032] border border-slate-800 rounded-lg pl-8 pr-2 py-1 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#FFE600]"
              autoFocus
            />
          </div>
        )}

        {/* List of Tenants */}
        <div className="max-h-56 overflow-y-auto space-y-1 pr-1 scrollbar-thin scrollbar-thumb-slate-800">
          {filteredTenants.length === 0 ? (
            <div className="p-3 text-center text-xs text-slate-500">
              Brak organizacji pasujących do wyszukiwania
            </div>
          ) : (
            filteredTenants.map((t) => {
              const isCurrent = t.id === activeTenantId;
              const isSwitching = switchingId === t.id;

              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => handleSwitchTenant(t.id)}
                  disabled={isCurrent || switchingId !== null}
                  className={`w-full flex items-center justify-between p-2 rounded-xl text-left text-xs transition-all group ${
                    isCurrent
                      ? "bg-[#FFE600]/10 border border-[#FFE600]/40 text-white font-bold"
                      : "hover:bg-slate-800/80 text-slate-300 hover:text-white border border-transparent"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-xs font-black ${
                        isCurrent
                          ? "bg-[#FFE600] text-black"
                          : "bg-slate-800 text-slate-400 group-hover:text-white"
                      }`}
                    >
                      {t.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-semibold">{t.name}</div>
                      <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1.5">
                        <span>{getRoleLabel(t.role)}</span>
                        {t.plan && (
                          <span className="uppercase text-[9px] text-slate-500 border border-slate-700 px-1 rounded">
                            {t.plan}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="shrink-0 pl-2">
                    {isSwitching ? (
                      <Loader2 size={14} className="animate-spin text-[#FFE600]" />
                    ) : isCurrent ? (
                      <Check size={14} className="text-[#FFE600]" />
                    ) : null}
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Super Admin Notice */}
        {isSuperAdmin && (
          <div className="pt-1.5 border-t border-slate-800 px-2 text-[10px] text-slate-400 flex items-center gap-1.5">
            <Sparkles size={11} className="text-yellow-400 shrink-0" />
            <span>Pełny dostęp audytowany w systemie</span>
          </div>
        )}
      </div>
    );
  }
}
