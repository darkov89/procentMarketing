import React from "react";
import { Filter, Search } from "lucide-react";

export type QuickFilterId =
  | "all"
  | "pending_approval"
  | "needs_review"
  | "qualified"
  | "in_sequence"
  | "with_offer"
  | "with_email";

interface LeadsToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  cityFilter: string;
  onCityFilterChange: (value: string) => void;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  quickFilter: QuickFilterId;
  onQuickFilterChange: (value: QuickFilterId) => void;
  cities: string[];
  quickFilterCounts: Record<QuickFilterId, number>;
  totalFiltered: number;
  totalLeads: number;
  paginatedCount: number;
}

export function LeadsToolbar({
  search,
  onSearchChange,
  cityFilter,
  onCityFilterChange,
  statusFilter,
  onStatusFilterChange,
  quickFilter,
  onQuickFilterChange,
  cities,
  quickFilterCounts,
  totalFiltered,
  totalLeads,
  paginatedCount,
}: LeadsToolbarProps) {
  const pills: Array<{
    id: QuickFilterId;
    label: string;
    count: number;
    color: string;
  }> = [
    { id: "all", label: "Wszystkie", count: quickFilterCounts.all, color: "hover:border-[#94A3B8]" },
    {
      id: "pending_approval",
      label: "🛡️ Do zatwierdzenia AI",
      count: quickFilterCounts.pending_approval,
      color: "hover:border-amber-400 text-amber-300",
    },
    {
      id: "needs_review",
      label: "⚠️ Do weryfikacji",
      count: quickFilterCounts.needs_review,
      color: "hover:border-orange-400 text-orange-300",
    },
    {
      id: "qualified",
      label: "✅ Zakwalifikowane",
      count: quickFilterCounts.qualified,
      color: "hover:border-emerald-400 text-emerald-300",
    },
    {
      id: "in_sequence",
      label: "📬 W sekwencji",
      count: quickFilterCounts.in_sequence,
      color: "hover:border-purple-400 text-purple-300",
    },
    {
      id: "with_offer",
      label: "📄 Z ofertą",
      count: quickFilterCounts.with_offer,
      color: "hover:border-sky-400 text-sky-300",
    },
    {
      id: "with_email",
      label: "📧 Z e-mailem",
      count: quickFilterCounts.with_email,
      color: "hover:border-[#FFE600] text-[#FFE600]",
    },
  ];

  return (
    <div className="space-y-4">
      {/* Quick Filter Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
        <span className="text-[#64748B] font-semibold text-[11px] uppercase tracking-wider flex items-center gap-1 shrink-0">
          <Filter size={12} /> Szybkie filtry:
        </span>
        {pills.map((pill) => {
          const isActive = quickFilter === pill.id;
          return (
            <button
              key={pill.id}
              onClick={() => onQuickFilterChange(pill.id)}
              className={`px-3 py-1.5 rounded-lg border font-medium transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
                isActive
                  ? "bg-[#FFE600] text-black border-[#FFE600] font-bold shadow-md shadow-[#FFE600]/10"
                  : `bg-[#0E1422] border-[#28354D] text-[#94A3B8] hover:text-white ${pill.color}`
              }`}
            >
              <span>{pill.label}</span>
              <span
                className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                  isActive ? "bg-black/20 text-black" : "bg-[#1E293B] text-[#CBD5E1]"
                }`}
              >
                {pill.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Filter Toolbar */}
      <div className="bg-[#141C2E] border border-[#28354D] p-4 rounded-xl flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
          {/* Search */}
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3.5 top-2.5 text-[#94A3B8]" size={16} />
            <input
              type="text"
              placeholder="Szukaj firmy po nazwie, branży, telefonie, emailu..."
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full bg-[#0A0E17] border border-[#28354D] rounded-lg pl-10 pr-4 py-2 text-sm text-white placeholder-[#64748B] focus:outline-none focus:border-[#FFE600]"
            />
          </div>

          {/* City Filter */}
          <select
            value={cityFilter}
            onChange={(e) => onCityFilterChange(e.target.value)}
            className="bg-[#0A0E17] border border-[#28354D] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#FFE600]"
          >
            <option value="all">Wszystkie Miasta</option>
            {cities.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => onStatusFilterChange(e.target.value)}
            className="bg-[#0A0E17] border border-[#28354D] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#FFE600]"
          >
            <option value="all">Wszystkie Statusy</option>
            <option value="pending_approval">🛡️ Do Zatwierdzenia AI Act (pending_approval)</option>
            <option value="needs_review">⚠️ Do Weryfikacji (needs_review)</option>
            <option value="qualified">✅ Zakwalifikowane (qualified)</option>
            <option value="new">🆕 Nowe (new)</option>
            <option value="in_sequence">📬 W Sekwencji Outreach (in_sequence)</option>
            <option value="replied_interested">💬 Odpowiedź: Zainteresowany</option>
            <option value="meeting_booked">🏆 Umówione Spotkanie</option>
            <option value="offer_published">📄 Oferta Opublikowana</option>
            <option value="sent">📧 E-mail Wysłany</option>
            <option value="followup_sent">🔄 Follow-up Wysłany</option>
            <option value="disqualified">❌ Odrzucone (disqualified)</option>
          </select>
        </div>

        <div className="text-xs text-[#94A3B8]">
          Wyświetlanie <strong className="text-white">{paginatedCount}</strong> z{" "}
          <strong className="text-white">{totalFiltered}</strong> (łącznie {totalLeads})
        </div>
      </div>
    </div>
  );
}
