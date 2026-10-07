import React from "react";
import {
  Globe,
  Eye,
  Mail,
  CheckCircle2,
  Edit2,
  ChevronRight,
  Save,
  X,
  Square,
  CheckSquare,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Search,
} from "lucide-react";
import { LeadItem } from "./lead-types";
import { getStatusMeta } from "@/lib/status-meta";

export type SortField = "companyName" | "score" | "city" | "status" | "id";
export type SortDirection = "asc" | "desc";

interface LeadsTableProps {
  leads: LeadItem[];
  selectedLeadIds: number[];
  onToggleSelectLead: (id: number) => void;
  onToggleSelectAllVisible: () => void;
  allVisibleSelected: boolean;
  someVisibleSelected: boolean;
  sortField: SortField;
  sortDirection: SortDirection;
  onSort: (field: SortField) => void;
  editingId: number | null;
  editValues: Partial<LeadItem>;
  setEditValues: React.Dispatch<React.SetStateAction<Partial<LeadItem>>>;
  onStartEditing: (lead: LeadItem) => void;
  onSaveInline: (id: number) => Promise<void>;
  onCancelEditing: () => void;
  onSelectLead: (lead: LeadItem) => void;
  onClearFilters: () => void;
  hasActiveFilters: boolean;
  defaultCity?: string;
}

export function LeadsTable({
  leads,
  selectedLeadIds,
  onToggleSelectLead,
  onToggleSelectAllVisible,
  allVisibleSelected,
  someVisibleSelected,
  sortField,
  sortDirection,
  onSort,
  editingId,
  editValues,
  setEditValues,
  onStartEditing,
  onSaveInline,
  onCancelEditing,
  onSelectLead,
  onClearFilters,
  hasActiveFilters,
  defaultCity = "Polska",
}: LeadsTableProps) {
  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown size={12} className="opacity-40" />;
    }
    return sortDirection === "asc" ? (
      <ArrowUp size={13} className="text-[#FFE600]" />
    ) : (
      <ArrowDown size={13} className="text-[#FFE600]" />
    );
  };

  return (
    <div className="bg-[#141C2E] border border-[#28354D] rounded-xl overflow-hidden shadow-2xl">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm border-collapse">
          <thead>
            <tr className="border-b border-[#28354D] bg-[#0E1422] text-[#94A3B8] text-[11px] uppercase tracking-wider font-extrabold">
              {/* Checkbox column */}
              <th className="p-3.5 w-10 text-center">
                <button
                  type="button"
                  onClick={onToggleSelectAllVisible}
                  className="text-[#94A3B8] hover:text-[#FFE600] transition-colors p-0.5 cursor-pointer block mx-auto"
                  title={allVisibleSelected ? "Odznacz widoczne" : "Zaznacz widoczne"}
                >
                  {allVisibleSelected ? (
                    <CheckSquare size={17} className="text-[#FFE600]" />
                  ) : someVisibleSelected ? (
                    <div className="w-4 h-4 rounded border-2 border-[#FFE600] bg-[#FFE600]/20 flex items-center justify-center">
                      <div className="w-2 h-0.5 bg-[#FFE600]" />
                    </div>
                  ) : (
                    <Square size={17} />
                  )}
                </button>
              </th>

              <th
                className="p-3.5 cursor-pointer select-none hover:text-white transition-colors"
                onClick={() => onSort("id")}
              >
                <div className="flex items-center gap-1.5">
                  <span>ID</span>
                  {renderSortIcon("id")}
                </div>
              </th>

              <th
                className="p-3.5 cursor-pointer select-none hover:text-white transition-colors min-w-[200px]"
                onClick={() => onSort("companyName")}
              >
                <div className="flex items-center gap-1.5">
                  <span>Firma</span>
                  {renderSortIcon("companyName")}
                </div>
              </th>

              <th
                className="p-3.5 cursor-pointer select-none hover:text-white transition-colors"
                onClick={() => onSort("city")}
              >
                <div className="flex items-center gap-1.5">
                  <span>Lokalizacja</span>
                  {renderSortIcon("city")}
                </div>
              </th>

              <th className="p-3.5">Branża</th>

              <th
                className="p-3.5 cursor-pointer select-none hover:text-white transition-colors"
                onClick={() => onSort("status")}
              >
                <div className="flex items-center gap-1.5">
                  <span>Status</span>
                  {renderSortIcon("status")}
                </div>
              </th>

              <th
                className="p-3.5 text-center cursor-pointer select-none hover:text-white transition-colors"
                onClick={() => onSort("score")}
              >
                <div className="flex items-center justify-center gap-1.5">
                  <span>Score</span>
                  {renderSortIcon("score")}
                </div>
              </th>

              <th className="p-3.5">Kontakt</th>
              <th className="p-3.5">Oferta WWW</th>
              <th className="p-3.5">E-mail</th>
              <th className="p-3.5 text-right">Akcje</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-[#1E293B]">
            {leads.length === 0 ? (
              <tr>
                <td colSpan={11} className="py-16 px-4 text-center">
                  <div className="max-w-md mx-auto flex flex-col items-center justify-center space-y-3">
                    <div className="w-12 h-12 rounded-full bg-[#1E293B] border border-[#334155] flex items-center justify-center text-[#94A3B8]">
                      <Search size={22} />
                    </div>
                    <div className="text-white font-bold text-base">Brak leadów spełniających kryteria</div>
                    <p className="text-xs text-[#94A3B8] leading-relaxed">
                      {hasActiveFilters
                        ? "Zastosowane filtry lub wyszukiwana fraza nie dopasowały żadnych rekordów w bazie CRM."
                        : "Brak zapisanych rekordów. Użyj generatora leadów lub zaimportuj plik CSV."}
                    </p>
                    {hasActiveFilters && (
                      <button
                        type="button"
                        onClick={onClearFilters}
                        className="mt-2 bg-[#FFE600] hover:bg-[#FACC15] text-black text-xs font-bold px-4 py-2 rounded-lg transition-all cursor-pointer shadow-md"
                      >
                        Wyczyść filtry i wyszukiwanie
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              leads.map((lead) => {
                const isEditing = editingId === lead.id;
                const isSelected = selectedLeadIds.includes(lead.id);
                const statusMeta = getStatusMeta(lead.status);

                return (
                  <tr
                    key={lead.id}
                    className={`transition-colors cursor-pointer group ${
                      isSelected
                        ? "bg-[#182338]/90 hover:bg-[#1E2B45] border-l-4 border-l-[#FFE600]"
                        : "hover:bg-[#182338]"
                    }`}
                    onClick={(e) => {
                      const target = e.target as HTMLElement;
                      if (
                        target.tagName === "INPUT" ||
                        target.tagName === "SELECT" ||
                        target.tagName === "BUTTON" ||
                        target.tagName === "A"
                      ) {
                        return;
                      }
                      onSelectLead(lead);
                    }}
                  >
                    {/* Checkbox */}
                    <td className="p-3.5 text-center w-10" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => onToggleSelectLead(lead.id)}
                        className="text-[#94A3B8] hover:text-[#FFE600] transition-colors p-0.5 cursor-pointer block mx-auto"
                      >
                        {isSelected ? (
                          <CheckSquare size={17} className="text-[#FFE600]" />
                        ) : (
                          <Square size={17} />
                        )}
                      </button>
                    </td>

                    <td className="p-3.5 text-[#64748B] font-mono text-xs">#{lead.id}</td>

                    {/* Company Name */}
                    <td className="p-3.5 font-bold text-white min-w-[200px]">
                      {isEditing ? (
                        <input
                          type="text"
                          value={editValues.companyName ?? lead.companyName}
                          onChange={(e) =>
                            setEditValues((prev) => ({ ...prev, companyName: e.target.value }))
                          }
                          className="w-full bg-[#0A0E17] border border-[#FFE600] rounded px-2 py-1 text-sm text-white"
                        />
                      ) : (
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="hover:text-[#FFE600] transition-colors">
                              {lead.companyName}
                            </span>
                            {lead.scoreBreakdown?.companyScale && (
                              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue-950/80 text-blue-300 border border-blue-800 font-bold uppercase">
                                {lead.scoreBreakdown.companyScale === "mikro"
                                  ? "MIKRO"
                                  : lead.scoreBreakdown.companyScale === "male"
                                  ? "MAŁA"
                                  : "MŚP"}
                              </span>
                            )}
                          </div>
                          {lead.website && (
                            <a
                              href={lead.website.startsWith("http") ? lead.website : `https://${lead.website}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs text-[#38BDF8] flex items-center gap-1 mt-0.5"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Globe size={11} /> {lead.website.replace(/^https?:\/\//, "")}
                            </a>
                          )}
                          {(lead.audit?.rawEvidence?.businessActivity ||
                            lead.scoreBreakdown?.businessActivity) && (
                            <div className="text-[11px] text-[#94A3B8] mt-1 line-clamp-1 italic max-w-sm">
                              🎯 {lead.audit?.rawEvidence?.businessActivity || lead.scoreBreakdown?.businessActivity}
                            </div>
                          )}
                        </div>
                      )}
                    </td>

                    {/* Location */}
                    <td className="p-3.5 text-[#E2E8F0] text-xs">
                      {isEditing ? (
                        <input
                          type="text"
                          value={editValues.city ?? (lead.city || "")}
                          onChange={(e) =>
                            setEditValues((prev) => ({ ...prev, city: e.target.value }))
                          }
                          className="w-24 bg-[#0A0E17] border border-[#FFE600] rounded px-2 py-1 text-xs text-white"
                        />
                      ) : (
                        <div>
                          <strong>{lead.city || defaultCity}</strong>
                          <span className="text-[#94A3B8] block text-[11px]">
                            {lead.distanceKm != null ? `${lead.distanceKm.toFixed(1)} km` : ""}
                          </span>
                        </div>
                      )}
                    </td>

                    {/* Industry */}
                    <td className="p-3.5 text-xs text-[#CBD5E1]">
                      <span className="bg-[#1E293B] px-2.5 py-1 rounded-md border border-[#334155]">
                        {lead.industry || "Ogólna"}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="p-3.5">
                      {isEditing ? (
                        <select
                          value={editValues.status ?? lead.status}
                          onChange={(e) =>
                            setEditValues((prev) => ({ ...prev, status: e.target.value }))
                          }
                          className="bg-[#0A0E17] border border-[#FFE600] rounded px-2 py-1 text-xs text-white"
                        >
                          <option value="new">Nowy</option>
                          <option value="needs_review">Do weryfikacji</option>
                          <option value="qualified">Zakwalifikowany</option>
                          <option value="approved">Zatwierdzony</option>
                          <option value="pending_approval">Do zatwierdzenia</option>
                          <option value="in_sequence">W sekwencji</option>
                          <option value="replied">Odpowiedź</option>
                          <option value="in_talks">Rozmowa</option>
                          <option value="pledged">Deklaracja</option>
                          <option value="paid">Wpłata potwierdzona</option>
                          <option value="disqualified">Odrzucony</option>
                        </select>
                      ) : (
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider ${statusMeta.className}`}
                        >
                          {statusMeta.label}
                        </span>
                      )}
                    </td>

                    {/* Scoring */}
                    <td className="p-3.5 text-center font-extrabold text-sm">
                      <span className={lead.score >= 60 ? "text-[#FFE600]" : "text-[#94A3B8]"}>
                        {lead.score}
                      </span>
                    </td>

                    {/* Contact */}
                    <td className="p-3.5 text-xs">
                      {isEditing ? (
                        <div className="space-y-1">
                          <input
                            type="text"
                            placeholder="Telefon"
                            value={editValues.phoneNormalized ?? (lead.phoneNormalized || "")}
                            onChange={(e) =>
                              setEditValues((prev) => ({ ...prev, phoneNormalized: e.target.value }))
                            }
                            className="w-full bg-[#0A0E17] border border-[#FFE600] rounded px-1.5 py-0.5 text-xs text-white"
                          />
                          <input
                            type="text"
                            placeholder="Email"
                            value={editValues.emailPrimary ?? (lead.emailPrimary || "")}
                            onChange={(e) =>
                              setEditValues((prev) => ({ ...prev, emailPrimary: e.target.value }))
                            }
                            className="w-full bg-[#0A0E17] border border-[#FFE600] rounded px-1.5 py-0.5 text-xs text-white"
                          />
                        </div>
                      ) : (
                        <div>
                          <div className="font-mono text-white">{lead.phoneNormalized || "—"}</div>
                          <div className="text-[#94A3B8] truncate max-w-[150px]">
                            {lead.emailPrimary || "—"}
                          </div>
                        </div>
                      )}
                    </td>

                    {/* Offer Badge */}
                    <td className="p-3.5">
                      {lead.offer ? (
                        <a
                          href={lead.offer.token ? `/o/${lead.offer.token}` : `/offers/${lead.offer.slug}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs bg-[#0C4A6E] text-[#38BDF8] border border-[#0284C7] px-2.5 py-1 rounded-md font-bold hover:underline flex items-center gap-1 w-max"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Eye size={12} /> Gotowa
                        </a>
                      ) : (
                        <span className="text-xs text-[#64748B]">—</span>
                      )}
                    </td>

                    {/* Email Outreach Status */}
                    <td className="p-3.5 text-xs">
                      {lead.status === "sent" ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectLead(lead);
                          }}
                          className="text-[#C084FC] hover:text-[#E9D5FF] font-bold flex items-center gap-1 bg-[#581C87]/40 hover:bg-[#581C87]/70 border border-[#9333EA]/40 px-2.5 py-1 rounded-md transition-all cursor-pointer"
                        >
                          <CheckCircle2 size={13} /> Wysłano
                        </button>
                      ) : lead.status === "followup_sent" ? (
                        <span className="text-[#A5B4FC] font-bold flex items-center gap-1 bg-[#3730A3]/40 border border-[#6366F1]/40 px-2.5 py-1 rounded-md w-max">
                          <CheckCircle2 size={13} /> Follow-up
                        </span>
                      ) : lead.offer ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectLead(lead);
                          }}
                          className="text-[#FFE600] hover:text-black hover:bg-[#FFE600] font-bold flex items-center gap-1 border border-[#FFE600]/40 px-2.5 py-1 rounded-md transition-all cursor-pointer"
                        >
                          <Mail size={13} /> Wyślij e-mail
                        </button>
                      ) : (
                        <span className="text-[#64748B]">Oczekuje</span>
                      )}
                    </td>

                    {/* Actions Column */}
                    <td className="p-3.5 text-right whitespace-nowrap">
                      {isEditing ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => onSaveInline(lead.id)}
                            className="bg-[#10B981] hover:bg-[#059669] text-white p-1.5 rounded transition-all cursor-pointer"
                            title="Zapisz"
                          >
                            <Save size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={onCancelEditing}
                            className="bg-[#334155] hover:bg-[#475569] text-white p-1.5 rounded transition-all cursor-pointer"
                            title="Anuluj"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onStartEditing(lead);
                            }}
                            className="text-[#94A3B8] hover:text-[#FFE600] p-1.5 rounded hover:bg-[#1E293B] transition-all cursor-pointer"
                            title="Edytuj inline"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectLead(lead);
                            }}
                            className="text-[#94A3B8] hover:text-white p-1.5 rounded hover:bg-[#1E293B] transition-all cursor-pointer"
                            title="Szczegóły / Dossier"
                          >
                            <ChevronRight size={16} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
