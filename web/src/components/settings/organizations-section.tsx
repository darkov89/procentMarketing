"use client";

import React, { useState } from "react";
import {
  Building2,
  Plus,
  CheckCircle2,
  ShieldCheck,
  Sparkles,
  ExternalLink,
  Layers,
  ArrowRight,
  Loader2,
  Check,
} from "lucide-react";
import { CreateTenantModal } from "@/components/tenants/create-tenant-modal";

export interface TenantDetails {
  id: number;
  slug: string;
  name: string;
  plan: string;
  role: string;
  isActive: boolean;
  isDirectMember?: boolean;
  createdAt?: string;
}

interface OrganizationsSectionProps {
  tenants: TenantDetails[];
  activeTenantId: number | null;
  isSuperAdmin: boolean;
  onRefresh?: () => void;
}

export function OrganizationsSection({
  tenants,
  activeTenantId,
  isSuperAdmin,
  onRefresh,
}: OrganizationsSectionProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [switchingId, setSwitchingId] = useState<number | null>(null);

  const activeTenant = tenants.find((t) => t.id === activeTenantId) || tenants[0];

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

  const getRoleBadge = (role?: string) => {
    switch (role?.toLowerCase()) {
      case "owner":
        return <span className="bg-amber-950/70 text-amber-300 border border-amber-800/60 px-2 py-0.5 rounded-full text-[10px] font-bold">Właściciel</span>;
      case "superadmin":
        return <span className="bg-yellow-950/70 text-[#FFE600] border border-yellow-800/60 px-2 py-0.5 rounded-full text-[10px] font-bold">Super Admin</span>;
      case "admin":
        return <span className="bg-blue-950/70 text-blue-300 border border-blue-800/60 px-2 py-0.5 rounded-full text-[10px] font-bold">Administrator</span>;
      default:
        return <span className="bg-slate-800 text-slate-300 border border-slate-700 px-2 py-0.5 rounded-full text-[10px] font-bold">{role || "Członek"}</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Intro Header */}
      <div className="bg-[#141C2E] border border-[#28354D] p-6 rounded-2xl shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-[#FFE600] text-black rounded-xl font-bold">
            <Building2 size={24} />
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-white">
              Zarządzanie Organizacjami (Multi-Tenancy)
            </h2>
            <p className="text-xs text-[#94A3B8] mt-0.5">
              Pełna izolacja danych leadów, kampanii, playbooków i skrzynek pocztowych pomiędzy workspace&apos;ami.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="bg-[#FFE600] hover:bg-[#FFF04D] text-black font-extrabold text-xs px-5 py-2.5 rounded-xl flex items-center gap-2 transition-all shadow-lg shadow-yellow-500/20 cursor-pointer self-start md:self-auto"
        >
          <Plus size={16} />
          Utwórz Nową Organizację
        </button>
      </div>

      {/* Active Organization Card */}
      {activeTenant && (
        <div className="bg-[#141C2E] border border-[#28354D] p-6 rounded-2xl shadow-xl space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#28354D] pb-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase font-mono tracking-wider text-[#38BDF8] bg-sky-950/60 border border-sky-800/60 px-2 py-0.5 rounded-md font-bold">
                  BIEŻĄCY AKTYWNY KONTEKST
                </span>
                {getRoleBadge(activeTenant.role)}
              </div>
              <h3 className="text-lg font-black text-white mt-1">
                {activeTenant.name}
              </h3>
            </div>
            <div className="text-right">
              <div className="text-xs text-slate-400 font-mono">
                ID: #{activeTenant.id} &bull; Slug: <span className="text-white font-bold">{activeTenant.slug}</span>
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5 uppercase tracking-wider font-semibold">
                Plan: <span className="text-[#FFE600] font-bold">{activeTenant.plan}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
            <div className="bg-[#0A0E17] border border-[#28354D] p-3.5 rounded-xl">
              <div className="text-[11px] font-bold text-slate-400 flex items-center gap-1.5 mb-1">
                <ShieldCheck size={14} className="text-[#34D399]" />
                Izolacja Danych (RLS)
              </div>
              <div className="text-xs text-white font-semibold">
                Twardy filtr tenant_id we wszystkich zapytaniach
              </div>
            </div>

            <div className="bg-[#0A0E17] border border-[#28354D] p-3.5 rounded-xl">
              <div className="text-[11px] font-bold text-slate-400 flex items-center gap-1.5 mb-1">
                <Layers size={14} className="text-[#38BDF8]" />
                Dedykowane Kampanie
              </div>
              <div className="text-xs text-white font-semibold">
                Własne playbooki, szablony i kolejki wysyłkowe
              </div>
            </div>

            <div className="bg-[#0A0E17] border border-[#28354D] p-3.5 rounded-xl">
              <div className="text-[11px] font-bold text-slate-400 flex items-center gap-1.5 mb-1">
                <Sparkles size={14} className="text-[#FFE600]" />
                Zgody & Wykluczenia
              </div>
              <div className="text-xs text-white font-semibold">
                Oddzielna suppression list i rejestr zgód
              </div>
            </div>
          </div>
        </div>
      )}

      {/* List of Available Organizations */}
      <div className="bg-[#141C2E] border border-[#28354D] p-6 rounded-2xl shadow-xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#28354D] pb-3">
          <div>
            <h3 className="text-base font-extrabold text-white flex items-center gap-2">
              <Building2 size={18} className="text-[#FFE600]" />
              Dostępne Organizacje ({tenants.length})
            </h3>
            <p className="text-xs text-[#94A3B8] mt-0.5">
              Organizacje, do których masz uprawnienia jako członek lub administrator.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#0A0E17] text-[#94A3B8] font-bold uppercase tracking-wider">
              <tr>
                <th className="p-3.5">Organizacja</th>
                <th className="p-3.5">Slug</th>
                <th className="p-3.5">Rola</th>
                <th className="p-3.5">Plan</th>
                <th className="p-3.5 text-right">Akcja</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#28354D]/60">
              {tenants.map((t) => {
                const isCurrent = t.id === activeTenantId;
                const isSwitching = switchingId === t.id;

                return (
                  <tr
                    key={t.id}
                    className={`hover:bg-[#1E293B]/60 transition-colors ${
                      isCurrent ? "bg-[#FFE600]/5" : ""
                    }`}
                  >
                    <td className="p-3.5">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${
                            isCurrent
                              ? "bg-[#FFE600] text-black"
                              : "bg-slate-800 text-slate-300"
                          }`}
                        >
                          {t.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-extrabold text-white flex items-center gap-1.5">
                            <span>{t.name}</span>
                            {isCurrent && (
                              <span className="text-[10px] text-[#FFE600] font-normal flex items-center gap-0.5">
                                <Check size={12} />
                                Aktywny
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            ID: #{t.id}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="p-3.5 font-mono text-slate-300">{t.slug}</td>
                    <td className="p-3.5">{getRoleBadge(t.role)}</td>
                    <td className="p-3.5">
                      <span className="uppercase text-[10px] px-2 py-0.5 rounded border border-slate-700 text-slate-400 font-bold">
                        {t.plan}
                      </span>
                    </td>
                    <td className="p-3.5 text-right">
                      {isCurrent ? (
                        <span className="text-xs font-bold text-[#34D399] flex items-center justify-end gap-1">
                          <CheckCircle2 size={14} />
                          Wybrana
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleSwitchTenant(t.id)}
                          disabled={isSwitching}
                          className="bg-[#1E293B] hover:bg-[#FFE600] hover:text-black text-slate-300 font-bold text-xs px-3.5 py-1.5 rounded-xl border border-slate-700 hover:border-transparent transition-all flex items-center gap-1.5 ml-auto cursor-pointer disabled:opacity-50"
                        >
                          {isSwitching ? (
                            <>
                              <Loader2 size={12} className="animate-spin" />
                              Przełączanie...
                            </>
                          ) : (
                            <>
                              Przełącz
                              <ArrowRight size={12} />
                            </>
                          )}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <CreateTenantModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => {
          if (onRefresh) onRefresh();
        }}
      />
    </div>
  );
}
