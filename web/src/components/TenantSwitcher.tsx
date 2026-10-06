"use client";

import React, { useState, useEffect, useRef } from "react";
import { Building2, ChevronDown, Check, Plus, Settings, ShieldAlert, Sparkles } from "lucide-react";

interface TenantItem {
  id: number;
  slug: string;
  name: string;
  plan: string;
  isActive: boolean;
  enabledModules: {
    compliancePke: boolean;
    callTasksQueue: boolean;
    dealFinanceTracking: boolean;
    offersStudio: boolean;
    emailOutreach: boolean;
    outreachMode: string;
    maxDailySends: number;
    excludedIndustries: string[];
  };
  role?: string;
}

interface TenantSwitcherProps {
  currentTenantId?: number;
  currentTenantName?: string;
  userRole?: string;
  onTenantSwitched: (tenantId: number) => void;
  onOpenSuperAdmin?: () => void;
  showToast: (msg: string, type: "success" | "error" | "info") => void;
}

export function TenantSwitcher({
  currentTenantId,
  currentTenantName,
  userRole,
  onTenantSwitched,
  onOpenSuperAdmin,
  showToast,
}: TenantSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [tenants, setTenants] = useState<TenantItem[]>([]);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const isSuperAdmin = userRole === "admin" || userRole === "superadmin";

  const fetchTenants = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/tenants");
      const data = await res.json();
      if (data.success && data.tenants) {
        setTenants(data.tenants);
      }
    } catch {
      showToast("Błąd pobierania listy organizacji", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchTenants();
    }
  }, [isOpen]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSwitch = async (tenantId: number, tenantName: string) => {
    if (tenantId === currentTenantId) {
      setIsOpen(false);
      return;
    }

    try {
      setLoading(true);
      const res = await fetch("/api/tenants/switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Przełączono organizację na: ${tenantName}`, "success");
        setIsOpen(false);
        onTenantSwitched(tenantId);
      } else {
        showToast(data.error || "Błąd przełączania organizacji", "error");
      }
    } catch {
      showToast("Błąd sieci podczas przełączania", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 bg-[#141C2E] hover:bg-[#1E293B] border border-[#28354D] hover:border-[#38BDF8]/60 text-white px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm group"
        title="Kliknij, aby zmienić aktywną organizację / tenanta"
      >
        <div className="w-5 h-5 rounded-lg bg-[#1E293B] group-hover:bg-[#38BDF8]/20 text-[#38BDF8] flex items-center justify-center transition-colors">
          <Building2 size={13} />
        </div>
        <div className="flex flex-col text-left">
          <span className="text-[10px] text-[#94A3B8] font-medium leading-none">Organizacja</span>
          <span className="text-xs font-extrabold text-white truncate max-w-[180px] leading-tight">
            {currentTenantName || "Wybierz organizację"}
          </span>
        </div>
        <ChevronDown size={14} className={`text-[#94A3B8] transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div className="absolute left-0 mt-2 w-72 sm:w-80 rounded-2xl bg-[#0E1422] border border-[#28354D] shadow-2xl shadow-black/80 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          <div className="px-3.5 py-2.5 border-b border-[#28354D] bg-[#141C2E]/60 flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-[#94A3B8] flex items-center gap-1.5">
              <Building2 size={13} className="text-[#FFE600]" /> Dostępne Organizacje
            </span>
            {isSuperAdmin && (
              <span className="text-[9px] font-mono font-bold bg-[#FFE600] text-black px-1.5 py-0.5 rounded">
                SUPER ADMIN
              </span>
            )}
          </div>

          <div className="max-h-64 overflow-y-auto p-1.5 space-y-1">
            {loading && tenants.length === 0 ? (
              <div className="p-4 text-center text-xs text-[#94A3B8]">Wczytywanie organizacji...</div>
            ) : tenants.length === 0 ? (
              <div className="p-4 text-center text-xs text-[#94A3B8]">Brak dostępnych organizacji</div>
            ) : (
              tenants.map((t) => {
                const isSelected = t.id === currentTenantId;
                return (
                  <button
                    key={t.id}
                    onClick={() => handleSwitch(t.id, t.name)}
                    className={`w-full flex items-center justify-between p-2.5 rounded-xl text-left transition-all cursor-pointer ${
                      isSelected
                        ? "bg-[#1E293B] border border-[#38BDF8]/40 text-white"
                        : "hover:bg-[#141C2E] text-[#CBD5E1]"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 font-black text-xs ${
                          isSelected
                            ? "bg-[#38BDF8] text-black font-extrabold"
                            : "bg-[#141C2E] border border-[#28354D] text-[#94A3B8]"
                        }`}
                      >
                        {t.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold truncate text-white flex items-center gap-1.5">
                          <span>{t.name}</span>
                          {t.enabledModules?.outreachMode === "csr_fundraising" && (
                            <span className="text-[9px] bg-emerald-950 text-emerald-400 border border-emerald-800 px-1 py-0.2 rounded font-mono">
                              CSR
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-[#64748B] font-mono truncate">
                          slug: {t.slug} • id: #{t.id}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {isSelected ? (
                        <Check size={16} className="text-[#38BDF8]" />
                      ) : (
                        <span className="text-[10px] text-[#64748B] group-hover:text-white">Przełącz</span>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {isSuperAdmin && onOpenSuperAdmin && (
            <div className="p-2 border-t border-[#28354D] bg-[#101726]">
              <button
                onClick={() => {
                  setIsOpen(false);
                  onOpenSuperAdmin();
                }}
                className="w-full flex items-center justify-center gap-2 bg-[#1E293B] hover:bg-[#28354D] text-[#FFE600] font-bold text-xs py-2 px-3 rounded-xl transition-all cursor-pointer"
              >
                <Settings size={13} />
                <span>Panel Modułów & Zarządzanie Tenantami</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
