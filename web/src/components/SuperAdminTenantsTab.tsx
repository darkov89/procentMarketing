"use client";

import React, { useState, useEffect } from "react";
import {
  Building2,
  ShieldCheck,
  PhoneCall,
  HeartHandshake,
  Mail,
  Globe,
  Sliders,
  Plus,
  Save,
  Check,
  RefreshCw,
  ExternalLink,
  Layers,
  CheckCircle2,
  AlertTriangle,
  X,
} from "lucide-react";

interface TenantModulesConfig {
  compliancePke: boolean;
  callTasksQueue: boolean;
  dealFinanceTracking: boolean;
  offersStudio: boolean;
  emailOutreach: boolean;
  outreachMode: "commercial" | "csr_fundraising" | "custom";
  maxDailySends: number;
  excludedIndustries: string[];
}

interface TenantItem {
  id: number;
  slug: string;
  name: string;
  plan: string;
  isActive: boolean;
  enabledModules: TenantModulesConfig;
  role?: string;
  createdAt: string;
}

interface SuperAdminTenantsTabProps {
  currentTenantId?: number;
  showToast: (msg: string, type: "success" | "error" | "info") => void;
  onTenantSwitched: (tenantId: number) => void;
}

export function SuperAdminTenantsTab({
  currentTenantId,
  showToast,
  onTenantSwitched,
}: SuperAdminTenantsTabProps) {
  const [tenants, setTenants] = useState<TenantItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingModules, setEditingModules] = useState<Record<number, TenantModulesConfig>>({});
  const [savingTenantId, setSavingTenantId] = useState<number | null>(null);

  // New Tenant Form
  const [newName, setNewName] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [newPlan, setNewPlan] = useState("pro");
  const [newModules, setNewModules] = useState<TenantModulesConfig>({
    compliancePke: true,
    callTasksQueue: true,
    dealFinanceTracking: true,
    offersStudio: false,
    emailOutreach: true,
    outreachMode: "csr_fundraising",
    maxDailySends: 5,
    excludedIndustries: ["tytoń", "hazard", "alkohol", "adult"],
  });
  const [creating, setCreating] = useState(false);

  const fetchTenants = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/tenants");
      const data = await res.json();
      if (data.success && data.tenants) {
        setTenants(data.tenants);
        const map: Record<number, TenantModulesConfig> = {};
        data.tenants.forEach((t: TenantItem) => {
          map[t.id] = { ...t.enabledModules };
        });
        setEditingModules(map);
      }
    } catch {
      showToast("Błąd pobierania organizacji", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTenants();
  }, []);

  const handleToggleModule = (tenantId: number, field: keyof TenantModulesConfig, value: any) => {
    setEditingModules((prev) => ({
      ...prev,
      [tenantId]: {
        ...prev[tenantId],
        [field]: value,
      },
    }));
  };

  const handleSaveModules = async (tenant: TenantItem) => {
    const modules = editingModules[tenant.id];
    if (!modules) return;

    try {
      setSavingTenantId(tenant.id);
      const res = await fetch("/api/tenants", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId: tenant.id,
          enabledModules: modules,
        }),
      });

      const data = await res.json();
      if (data.success) {
        showToast(`Zapisano moduły dla organizacji: ${tenant.name}`, "success");
        fetchTenants();
      } else {
        showToast(data.error || "Błąd zapisu modułów", "error");
      }
    } catch {
      showToast("Błąd połączenia z serwerem", "error");
    } finally {
      setSavingTenantId(null);
    }
  };

  const handleSwitchTenant = async (tenantId: number, tenantName: string) => {
    try {
      const res = await fetch("/api/tenants/switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Przełączono na tenanta: ${tenantName}`, "success");
        onTenantSwitched(tenantId);
      } else {
        showToast(data.error || "Błąd przełączania", "error");
      }
    } catch {
      showToast("Błąd połączenia z serwerem", "error");
    }
  };

  const handleCreateTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName) {
      showToast("Podaj nazwę organizacji", "error");
      return;
    }

    try {
      setCreating(true);
      const res = await fetch("/api/tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName,
          slug: newSlug || undefined,
          plan: newPlan,
          enabledModules: newModules,
        }),
      });

      const data = await res.json();
      if (data.success) {
        showToast(data.message || "Utworzono nowego tenanta!", "success");
        setIsAddModalOpen(false);
        setNewName("");
        setNewSlug("");
        fetchTenants();
      } else {
        showToast(data.error || "Błąd tworzenia organizacji", "error");
      }
    } catch {
      showToast("Błąd połączenia z serwerem", "error");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-[#101726] border border-[#28354D] rounded-2xl p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#FFE600]/10 border border-[#FFE600]/30 text-[#FFE600] flex items-center justify-center">
              <Layers size={22} />
            </div>
            <div>
              <h3 className="text-base font-black text-white flex items-center gap-2">
                Multi-Tenant Module Governance
                <span className="text-[10px] bg-[#FFE600] text-black px-2 py-0.5 rounded-full font-mono font-extrabold uppercase">
                  SUPER ADMIN
                </span>
              </h3>
              <p className="text-xs text-[#94A3B8] mt-0.5">
                Konfiguracja dostępnych modułów per organizacja (PKE, telefon Dawida, finanse Ani, oferty www).
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="bg-[#FFE600] hover:bg-[#FFF04D] text-black font-extrabold text-xs px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition-all shadow-md cursor-pointer"
            >
              <Plus size={15} />
              Utwórz Nowego Tenanta
            </button>
            <button
              onClick={fetchTenants}
              disabled={loading}
              className="bg-[#141C2E] hover:bg-[#1E293B] border border-[#28354D] text-white p-2 rounded-xl text-xs transition-all cursor-pointer"
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            </button>
          </div>
        </div>

        <div className="bg-[#0A0E17] border border-[#28354D] rounded-xl p-3 text-xs text-[#CBD5E1] leading-relaxed">
          Każdy tenant posiada twardo wyizolowane tabele bazodanowe (<span className="text-[#38BDF8] font-mono">tenant_id</span>), niezależne ustawienia prawne, dedykowaną kolejkę wysyłek SMTP oraz własną bazę wypisań i blokad.
        </div>
      </div>

      {/* Tenants List */}
      <div className="space-y-5">
        {tenants.map((t) => {
          const isCurrent = t.id === currentTenantId;
          const mods = editingModules[t.id] || t.enabledModules;
          const isSaving = savingTenantId === t.id;

          return (
            <div
              key={t.id}
              className={`bg-[#0E1422] border rounded-2xl p-5 space-y-4 shadow-xl transition-all ${
                isCurrent ? "border-[#38BDF8]/60 shadow-[#38BDF8]/5" : "border-[#28354D]"
              }`}
            >
              {/* Tenant Header */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1E293B] pb-4">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm ${
                      isCurrent
                        ? "bg-[#38BDF8] text-black"
                        : "bg-[#141C2E] border border-[#28354D] text-white"
                    }`}
                  >
                    {t.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-base font-extrabold text-white">{t.name}</h4>
                      {isCurrent && (
                        <span className="text-[10px] bg-[#38BDF8]/20 border border-[#38BDF8]/40 text-[#38BDF8] font-bold px-2 py-0.5 rounded-full">
                          AKTYWNA ORGANIZACJA
                        </span>
                      )}
                      <span className="text-[10px] bg-[#141C2E] border border-[#28354D] text-[#94A3B8] font-mono px-2 py-0.5 rounded uppercase">
                        Plan: {t.plan}
                      </span>
                    </div>
                    <div className="text-xs text-[#64748B] font-mono mt-0.5">
                      slug: <strong className="text-[#94A3B8]">{t.slug}</strong> • ID: #{t.id}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {!isCurrent ? (
                    <button
                      onClick={() => handleSwitchTenant(t.id, t.name)}
                      className="bg-[#141C2E] hover:bg-[#1E293B] border border-[#28354D] hover:border-[#38BDF8]/50 text-white font-bold text-xs px-3.5 py-2 rounded-xl transition-all cursor-pointer"
                    >
                      Przełącz do tej organizacji
                    </button>
                  ) : (
                    <span className="text-xs text-[#38BDF8] font-bold flex items-center gap-1.5 px-3 py-2 bg-[#38BDF8]/10 rounded-xl border border-[#38BDF8]/30">
                      <CheckCircle2 size={14} /> Jesteś w tej organizacji
                    </span>
                  )}
                </div>
              </div>

              {/* Module Toggles Grid */}
              <div>
                <span className="text-[11px] font-black uppercase tracking-wider text-[#94A3B8] block mb-3">
                  Włączone Moduły dla: {t.name}
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {/* Module: Compliance PKE */}
                  <label className="flex items-start gap-3 bg-[#141C2E] p-3 rounded-xl border border-[#1E293B] hover:border-[#28354D] cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      checked={mods.compliancePke}
                      onChange={(e) => handleToggleModule(t.id, "compliancePke", e.target.checked)}
                      className="mt-0.5 accent-[#FFE600] rounded"
                    />
                    <div className="text-xs space-y-0.5">
                      <span className="font-extrabold text-white flex items-center gap-1.5">
                        <ShieldCheck size={14} className="text-[#34D399]" />
                        Wymóg Zgód Art. 398 PKE
                      </span>
                      <p className="text-[10px] text-[#94A3B8]">
                        Wymusza weryfikację przesłanki kontaktu i blokuje telefon bez uprzedniej zgody.
                      </p>
                    </div>
                  </label>

                  {/* Module: Call Tasks Queue (Dawid) */}
                  <label className="flex items-start gap-3 bg-[#141C2E] p-3 rounded-xl border border-[#1E293B] hover:border-[#28354D] cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      checked={mods.callTasksQueue}
                      onChange={(e) => handleToggleModule(t.id, "callTasksQueue", e.target.checked)}
                      className="mt-0.5 accent-[#FFE600] rounded"
                    />
                    <div className="text-xs space-y-0.5">
                      <span className="font-extrabold text-white flex items-center gap-1.5">
                        <PhoneCall size={14} className="text-[#FFE600]" />
                        Kolejka Rozmów (Dawid)
                      </span>
                      <p className="text-[10px] text-[#94A3B8]">
                        Generuje zadanie telefoniczne +2 dni robocze po udanym e-mailu.
                      </p>
                    </div>
                  </label>

                  {/* Module: Deal & Finance Tracking (Ania) */}
                  <label className="flex items-start gap-3 bg-[#141C2E] p-3 rounded-xl border border-[#1E293B] hover:border-[#28354D] cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      checked={mods.dealFinanceTracking}
                      onChange={(e) => handleToggleModule(t.id, "dealFinanceTracking", e.target.checked)}
                      className="mt-0.5 accent-[#FFE600] rounded"
                    />
                    <div className="text-xs space-y-0.5">
                      <span className="font-extrabold text-white flex items-center gap-1.5">
                        <HeartHandshake size={14} className="text-[#38BDF8]" />
                        Wpłaty & Finanse (Ania)
                      </span>
                      <p className="text-[10px] text-[#94A3B8]">
                        Ewidencja kwot deklarowanych, terminów oraz autoryzacja wpłat na konto.
                      </p>
                    </div>
                  </label>

                  {/* Module: Offers Studio */}
                  <label className="flex items-start gap-3 bg-[#141C2E] p-3 rounded-xl border border-[#1E293B] hover:border-[#28354D] cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      checked={mods.offersStudio}
                      onChange={(e) => handleToggleModule(t.id, "offersStudio", e.target.checked)}
                      className="mt-0.5 accent-[#FFE600] rounded"
                    />
                    <div className="text-xs space-y-0.5">
                      <span className="font-extrabold text-white flex items-center gap-1.5">
                        <Globe size={14} className="text-[#818CF8]" />
                        Studio Oferty WWW (/o/[token])
                      </span>
                      <p className="text-[10px] text-[#94A3B8]">
                        Generowanie personalizowanych mini-stron ofertowych B2B.
                      </p>
                    </div>
                  </label>

                  {/* Module: Email Outreach */}
                  <label className="flex items-start gap-3 bg-[#141C2E] p-3 rounded-xl border border-[#1E293B] hover:border-[#28354D] cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      checked={mods.emailOutreach}
                      onChange={(e) => handleToggleModule(t.id, "emailOutreach", e.target.checked)}
                      className="mt-0.5 accent-[#FFE600] rounded"
                    />
                    <div className="text-xs space-y-0.5">
                      <span className="font-extrabold text-white flex items-center gap-1.5">
                        <Mail size={14} className="text-emerald-400" />
                        Silnik E-mail Outreach
                      </span>
                      <p className="text-[10px] text-[#94A3B8]">
                        Wysyłka maili przez SMTP z obsługą follow-upów i opt-outu.
                      </p>
                    </div>
                  </label>

                  {/* Settings: Outreach Mode & Daily Limit */}
                  <div className="bg-[#141C2E] p-3 rounded-xl border border-[#1E293B] space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-[#94A3B8] font-bold">Tryb Outreach:</span>
                      <select
                        value={mods.outreachMode}
                        onChange={(e) => handleToggleModule(t.id, "outreachMode", e.target.value)}
                        className="bg-[#0A0E17] border border-[#28354D] rounded px-2 py-0.5 text-xs text-white"
                      >
                        <option value="csr_fundraising">CSR Fundraising</option>
                        <option value="commercial">Komercyjny B2B</option>
                        <option value="custom">Niestandardowy</option>
                      </select>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[#94A3B8] font-bold">Limit dzienny:</span>
                      <input
                        type="number"
                        min="1"
                        max="100"
                        value={mods.maxDailySends}
                        onChange={(e) =>
                          handleToggleModule(t.id, "maxDailySends", parseInt(e.target.value, 10) || 5)
                        }
                        className="w-16 bg-[#0A0E17] border border-[#28354D] rounded px-2 py-0.5 text-xs text-white text-right font-mono"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Excluded Industries */}
              <div className="bg-[#141C2E] p-3 rounded-xl border border-[#1E293B] text-xs space-y-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8] block">
                  Wykluczone branże (Pilotaż Briefu):
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {(mods.excludedIndustries || []).map((ind, i) => (
                    <span
                      key={i}
                      className="bg-[#0A0E17] border border-rose-900/60 text-rose-300 px-2 py-0.5 rounded text-[10px] font-mono font-bold"
                    >
                      🚫 {ind}
                    </span>
                  ))}
                </div>
              </div>

              {/* Save Tenant Button */}
              <div className="flex items-center justify-end pt-2">
                <button
                  onClick={() => handleSaveModules(t)}
                  disabled={isSaving}
                  className="bg-[#1E293B] hover:bg-[#28354D] text-[#FFE600] border border-[#FFE600]/30 font-bold text-xs px-4 py-2 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                >
                  <Save size={14} />
                  {isSaving ? "Zapisywanie..." : "Zapisz konfigurację organizacji"}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal: Utwórz Nowego Tenanta */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0E1422] border border-[#28354D] rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-[#28354D] pb-3">
              <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                <Building2 size={18} className="text-[#FFE600]" />
                Nowa Organizacja (Tenant)
              </h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-[#94A3B8] hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateTenant} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#CBD5E1] mb-1.5">
                  Nazwa Organizacji / Fundacji / Klienta *
                </label>
                <input
                  type="text"
                  placeholder="np. Fundacja Dobre Serce"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  required
                  className="w-full bg-[#141C2E] border border-[#28354D] focus:border-[#FFE600] rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#CBD5E1] mb-1.5">
                  Unikalny Identyfikator (Slug) — opcjonalny
                </label>
                <input
                  type="text"
                  placeholder="np. dobre-serce"
                  value={newSlug}
                  onChange={(e) => setNewSlug(e.target.value)}
                  className="w-full bg-[#141C2E] border border-[#28354D] focus:border-[#FFE600] rounded-xl px-3 py-2 text-xs text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#CBD5E1] mb-1.5">
                  Tryb kampanii (Outreach Mode)
                </label>
                <select
                  value={newModules.outreachMode}
                  onChange={(e) =>
                    setNewModules((prev) => ({
                      ...prev,
                      outreachMode: e.target.value as any,
                    }))
                  }
                  className="w-full bg-[#141C2E] border border-[#28354D] rounded-xl px-3 py-2 text-xs text-white"
                >
                  <option value="csr_fundraising">CSR Fundraising (Fundacje & Dzieci)</option>
                  <option value="commercial">Komercyjny B2B (Sprzedaż Usług)</option>
                  <option value="custom">Niestandardowy</option>
                </select>
              </div>

              <div className="space-y-2 pt-2 border-t border-[#28354D]">
                <span className="text-[11px] font-bold text-[#94A3B8] block">Włącz moduły na start:</span>
                <label className="flex items-center gap-2 text-xs text-white cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newModules.compliancePke}
                    onChange={(e) =>
                      setNewModules((prev) => ({ ...prev, compliancePke: e.target.checked }))
                    }
                    className="accent-[#FFE600]"
                  />
                  <span>Wymóg Prawny Zgód Art. 398 PKE</span>
                </label>
                <label className="flex items-center gap-2 text-xs text-white cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newModules.callTasksQueue}
                    onChange={(e) =>
                      setNewModules((prev) => ({ ...prev, callTasksQueue: e.target.checked }))
                    }
                    className="accent-[#FFE600]"
                  />
                  <span>Kolejka Zadań Telefonicznych po wysyłce</span>
                </label>
                <label className="flex items-center gap-2 text-xs text-white cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newModules.dealFinanceTracking}
                    onChange={(e) =>
                      setNewModules((prev) => ({ ...prev, dealFinanceTracking: e.target.checked }))
                    }
                    className="accent-[#FFE600]"
                  />
                  <span>Moduł Finansów & Autoryzacji Wpłat</span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#28354D]">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="bg-[#141C2E] hover:bg-[#1E293B] text-[#94A3B8] font-bold text-xs px-4 py-2 rounded-xl cursor-pointer"
                >
                  Anuluj
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="bg-[#FFE600] hover:bg-[#FFF04D] text-black font-extrabold text-xs px-5 py-2 rounded-xl cursor-pointer disabled:opacity-50"
                >
                  {creating ? "Tworzenie..." : "Utwórz Organizację"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
