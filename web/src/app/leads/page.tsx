"use client";

import React, { useEffect, useState, useMemo, useCallback, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  LayoutDashboard,
  Building,
  RefreshCw,
  Download,
} from "lucide-react";
import * as XLSX from "xlsx";
import { LeadItem } from "@/components/leads/lead-types";
import { LeadsToolbar, QuickFilterId } from "@/components/leads/leads-toolbar";
import { LeadsTable, SortField, SortDirection } from "@/components/leads/leads-table";
import { LeadsPagination } from "@/components/leads/leads-pagination";
import { BulkActionsBar, BulkStatusModal } from "@/components/leads/leads-bulk-actions";
import { ToastNotification, ToastMessage } from "@/components/ui/toast-notification";

function LeadsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialStatus = searchParams.get("status") || "all";
  const initialFilter = (searchParams.get("filter") as QuickFilterId) || "all";

  const [leads, setLeads] = useState<LeadItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  // Filters & Search
  const [search, setSearch] = useState("");
  const [cityFilter, setCityFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState(initialStatus);
  const [quickFilter, setQuickFilter] = useState<QuickFilterId>(
    ["all", "pending_approval", "needs_review", "qualified", "in_sequence", "with_offer", "with_email"].includes(
      initialFilter
    )
      ? initialFilter
      : "all"
  );

  // Sorting & Pagination
  const [sortField, setSortField] = useState<SortField>("score");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [pageSize, setPageSize] = useState<number>(25);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Selection & Bulk Processing
  const [selectedLeadIds, setSelectedLeadIds] = useState<number[]>([]);
  const [bulkProcessing, setBulkProcessing] = useState<{
    active: boolean;
    label: string;
    current: number;
    total: number;
  } | null>(null);
  const [bulkStatusModal, setBulkStatusModal] = useState(false);
  const [targetBulkStatus, setTargetBulkStatus] = useState("qualified");

  // Inline editing
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValues, setEditValues] = useState<Partial<LeadItem>>({});

  const showToast = (message: string, type: "success" | "error" | "info" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/leads");
      const data = await res.json();
      if (data.success && Array.isArray(data.leads)) {
        setLeads(data.leads);
      }
    } catch {
      showToast("Błąd pobierania bazy leadów", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  // Distinct cities list
  const cities = useMemo(() => {
    const set = new Set<string>();
    for (const l of leads) {
      if (l.city) set.add(l.city);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "pl"));
  }, [leads]);

  // Quick filter counts
  const quickFilterCounts = useMemo(() => {
    return {
      all: leads.length,
      pending_approval: leads.filter((l) => l.status === "pending_approval").length,
      needs_review: leads.filter((l) => l.status === "needs_review").length,
      qualified: leads.filter((l) =>
        ["qualified", "pending_approval", "in_sequence", "approved"].includes(l.status)
      ).length,
      in_sequence: leads.filter((l) =>
        ["in_sequence", "followup_sent", "sent"].includes(l.status)
      ).length,
      with_offer: leads.filter((l) => Boolean(l.offer)).length,
      with_email: leads.filter((l) => Boolean(l.emailPrimary)).length,
    };
  }, [leads]);

  // Filtered Leads
  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      const q = search.toLowerCase();
      const matchesSearch =
        !search ||
        lead.companyName.toLowerCase().includes(q) ||
        (lead.industry && lead.industry.toLowerCase().includes(q)) ||
        (lead.phoneNormalized && lead.phoneNormalized.includes(q)) ||
        (lead.emailPrimary && lead.emailPrimary.toLowerCase().includes(q)) ||
        (lead.city && lead.city.toLowerCase().includes(q));

      const matchesCity = cityFilter === "all" || (lead.city && lead.city.toLowerCase() === cityFilter.toLowerCase());
      const matchesStatus = statusFilter === "all" || lead.status === statusFilter;

      const matchesQuick =
        quickFilter === "all" ||
        (quickFilter === "pending_approval" && lead.status === "pending_approval") ||
        (quickFilter === "needs_review" && lead.status === "needs_review") ||
        (quickFilter === "qualified" &&
          ["qualified", "pending_approval", "in_sequence", "approved"].includes(lead.status)) ||
        (quickFilter === "in_sequence" &&
          ["in_sequence", "followup_sent", "sent"].includes(lead.status)) ||
        (quickFilter === "with_offer" && Boolean(lead.offer)) ||
        (quickFilter === "with_email" && Boolean(lead.emailPrimary));

      return matchesSearch && matchesCity && matchesStatus && matchesQuick;
    });
  }, [leads, search, cityFilter, statusFilter, quickFilter]);

  // Sorted Leads
  const sortedLeads = useMemo(() => {
    return [...filteredLeads].sort((a, b) => {
      let comparison = 0;
      if (sortField === "score") {
        comparison = (a.score || 0) - (b.score || 0);
      } else if (sortField === "companyName") {
        comparison = a.companyName.localeCompare(b.companyName, "pl");
      } else if (sortField === "city") {
        comparison = (a.city || "").localeCompare(b.city || "", "pl");
      } else if (sortField === "status") {
        comparison = a.status.localeCompare(b.status);
      } else if (sortField === "id") {
        comparison = a.id - b.id;
      }
      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [filteredLeads, sortField, sortDirection]);

  // Paginated Leads
  const paginatedLeads = useMemo(() => {
    if (pageSize === -1) return sortedLeads;
    const start = (currentPage - 1) * pageSize;
    return sortedLeads.slice(start, start + pageSize);
  }, [sortedLeads, currentPage, pageSize]);

  const totalPages = pageSize === -1 ? 1 : Math.ceil(sortedLeads.length / pageSize) || 1;

  // Sorting handler
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  // Selection handlers
  const toggleSelectLead = (id: number) => {
    setSelectedLeadIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleSelectAllVisible = () => {
    const visibleIds = paginatedLeads.map((l) => l.id);
    const allSelected = visibleIds.every((id) => selectedLeadIds.includes(id));
    if (allSelected) {
      setSelectedLeadIds((prev) => prev.filter((id) => !visibleIds.includes(id)));
    } else {
      setSelectedLeadIds((prev) => Array.from(new Set([...prev, ...visibleIds])));
    }
  };

  const allVisibleSelected =
    paginatedLeads.length > 0 && paginatedLeads.every((l) => selectedLeadIds.includes(l.id));
  const someVisibleSelected =
    paginatedLeads.some((l) => selectedLeadIds.includes(l.id)) && !allVisibleSelected;

  const clearSelection = () => setSelectedLeadIds([]);

  // Inline editing save
  const handleSaveInline = async (id: number) => {
    try {
      const res = await fetch(`/api/leads/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editValues),
      });
      const data = await res.json();
      if (data.success) {
        setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, ...data.lead } : l)));
        showToast("Zapisano zmiany pomyślnie!");
        setEditingId(null);
        setEditValues({});
      } else {
        showToast(data.error || "Błąd zapisu", "error");
      }
    } catch {
      showToast("Błąd połączenia z serwerem", "error");
    }
  };

  // Bulk actions
  const handleBulkAudit = async () => {
    const targetLeads = leads.filter(
      (l) => selectedLeadIds.includes(l.id) && l.website && !l.audit
    );
    if (targetLeads.length === 0) {
      showToast("Wszystkie wybrane firmy posiadają już audyt lub nie mają strony WWW.", "info");
      return;
    }
    setBulkProcessing({
      active: true,
      label: "Audyt technologiczny WWW",
      current: 0,
      total: targetLeads.length,
    });
    let successCount = 0;
    for (let i = 0; i < targetLeads.length; i++) {
      setBulkProcessing({
        active: true,
        label: `Audyt: ${targetLeads[i].companyName}`,
        current: i + 1,
        total: targetLeads.length,
      });
      try {
        await fetch(`/api/audit/${targetLeads[i].id}`, { method: "POST" });
        successCount++;
      } catch (err) {
        console.error(err);
      }
    }
    setBulkProcessing(null);
    showToast(`Zakończono audyt. Zaktualizowano ${successCount} firm.`);
    fetchLeads();
  };

  const handleBulkGenerateOffers = async () => {
    const targetLeads = leads.filter(
      (l) => selectedLeadIds.includes(l.id) && !l.offer && l.status !== "disqualified"
    );
    if (targetLeads.length === 0) {
      showToast("Wszystkie wybrane firmy posiadają już wygenerowaną ofertę.", "info");
      return;
    }
    setBulkProcessing({
      active: true,
      label: "Generowanie ofert Gemini AI",
      current: 0,
      total: targetLeads.length,
    });
    let successCount = 0;
    for (let i = 0; i < targetLeads.length; i++) {
      setBulkProcessing({
        active: true,
        label: `Oferta: ${targetLeads[i].companyName}`,
        current: i + 1,
        total: targetLeads.length,
      });
      try {
        await fetch(`/api/offers/${targetLeads[i].id}`, { method: "POST" });
        successCount++;
      } catch (err) {
        console.error(err);
      }
    }
    setBulkProcessing(null);
    showToast(`Wygenerowano pomyślnie ${successCount} dedykowanych ofert.`);
    fetchLeads();
  };

  const handleBulkQualify = async () => {
    const targetLeads = leads.filter((l) => selectedLeadIds.includes(l.id));
    if (targetLeads.length === 0) return;
    setBulkProcessing({ active: true, label: "Przeliczanie scoringu", current: 0, total: targetLeads.length });
    let successCount = 0;
    for (let i = 0; i < targetLeads.length; i++) {
      setBulkProcessing({
        active: true,
        label: `Scoring: ${targetLeads[i].companyName}`,
        current: i + 1,
        total: targetLeads.length,
      });
      try {
        await fetch(`/api/qualify/${targetLeads[i].id}`, { method: "POST" });
        successCount++;
      } catch (err) {
        console.error(err);
      }
    }
    setBulkProcessing(null);
    showToast(`Zaktualizowano scoring i kwalifikację dla ${successCount} leadów.`);
    fetchLeads();
  };

  const handleBulkChangeStatus = async (status: string) => {
    if (selectedLeadIds.length === 0) return;
    setBulkProcessing({
      active: true,
      label: `Zmiana statusu na ${status}`,
      current: 0,
      total: selectedLeadIds.length,
    });
    let successCount = 0;
    for (let i = 0; i < selectedLeadIds.length; i++) {
      const id = selectedLeadIds[i];
      setBulkProcessing({
        active: true,
        label: `Status leada #${id}`,
        current: i + 1,
        total: selectedLeadIds.length,
      });
      try {
        await fetch(`/api/leads/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        });
        successCount++;
      } catch (err) {
        console.error(err);
      }
    }
    setBulkProcessing(null);
    setBulkStatusModal(false);
    showToast(`Zmieniono status dla ${successCount} leadów na '${status}'.`);
    clearSelection();
    fetchLeads();
  };

  const handleBulkDelete = async () => {
    if (!confirm(`Czy na pewno chcesz trwale usunąć ${selectedLeadIds.length} zaznaczonych firm z bazy CRM?`)) {
      return;
    }
    setBulkProcessing({ active: true, label: "Usuwanie rekordów", current: 0, total: selectedLeadIds.length });
    let successCount = 0;
    for (let i = 0; i < selectedLeadIds.length; i++) {
      const id = selectedLeadIds[i];
      try {
        await fetch(`/api/leads/${id}`, { method: "DELETE" });
        successCount++;
      } catch (err) {
        console.error(err);
      }
    }
    setBulkProcessing(null);
    showToast(`Usunięto ${successCount} rekordów z bazy.`);
    clearSelection();
    fetchLeads();
  };

  const handleBulkExport = () => {
    const exportTargets = leads.filter((l) => selectedLeadIds.includes(l.id));
    if (exportTargets.length === 0) return;
    const rows = exportTargets.map((l) => ({
      ID: l.id,
      Firma: l.companyName,
      NIP: l.nip || "",
      KRS: l.krs || "",
      Miasto: l.city || "",
      Telefon: l.phoneNormalized || "",
      Email: l.emailPrimary || "",
      StronaWWW: l.website || "",
      Branza: l.industry || "",
      Status: l.status,
      Scoring: l.score,
      DataDodania: l.createdAt ? new Date(l.createdAt).toLocaleDateString("pl-PL") : "",
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "WybraneLeady");
    XLSX.writeFile(wb, `leady_eksport_${new Date().toISOString().split("T")[0]}.xlsx`);
    showToast(`Wyeksportowano ${rows.length} rekordów do pliku Excel.`);
  };

  return (
    <div className="min-h-screen bg-[#0A0E17] text-[#F8FAFC]">
      <ToastNotification toast={toast} />

      {/* Top Header */}
      <header className="bg-[#0E1422] border-b border-[#28354D] px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard"
            className="flex items-center gap-1.5 text-xs font-bold text-[#38BDF8] hover:underline"
          >
            <LayoutDashboard size={14} />
            Dashboard
          </Link>
          <span className="text-[#28354D]">/</span>
          <div className="flex items-center gap-2">
            <Building size={18} className="text-[#FFE600]" />
            <h1 className="text-base font-extrabold text-white">Pipeline CRM & Baza Leadów</h1>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <a
            href="/api/export"
            target="_blank"
            className="bg-[#141C2E] hover:bg-[#1E293B] border border-[#334155] text-white font-bold text-xs px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition-all"
          >
            <Download size={14} />
            <span>Eksport Wszystkich</span>
          </a>
          <button
            type="button"
            onClick={fetchLeads}
            disabled={loading}
            className="bg-[#141C2E] hover:bg-[#1E293B] border border-[#334155] text-white p-2 rounded-xl transition-all cursor-pointer disabled:opacity-50"
            title="Odśwież bazę danych"
          >
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto p-6 space-y-4">
        {/* Toolbar */}
        <LeadsToolbar
          search={search}
          onSearchChange={(v) => {
            setSearch(v);
            setCurrentPage(1);
          }}
          cityFilter={cityFilter}
          onCityFilterChange={(v) => {
            setCityFilter(v);
            setCurrentPage(1);
          }}
          statusFilter={statusFilter}
          onStatusFilterChange={(v) => {
            setStatusFilter(v);
            setCurrentPage(1);
          }}
          quickFilter={quickFilter}
          onQuickFilterChange={(v) => {
            setQuickFilter(v);
            setCurrentPage(1);
          }}
          cities={cities}
          quickFilterCounts={quickFilterCounts}
          totalFiltered={sortedLeads.length}
          totalLeads={leads.length}
          paginatedCount={paginatedLeads.length}
        />

        {/* Data Table */}
        <LeadsTable
          leads={paginatedLeads}
          selectedLeadIds={selectedLeadIds}
          onToggleSelectLead={toggleSelectLead}
          onToggleSelectAllVisible={toggleSelectAllVisible}
          allVisibleSelected={allVisibleSelected}
          someVisibleSelected={someVisibleSelected}
          sortField={sortField}
          sortDirection={sortDirection}
          onSort={handleSort}
          editingId={editingId}
          editValues={editValues}
          setEditValues={setEditValues}
          onStartEditing={(lead) => {
            setEditingId(lead.id);
            setEditValues({
              companyName: lead.companyName,
              city: lead.city,
              status: lead.status,
              phoneNormalized: lead.phoneNormalized,
              emailPrimary: lead.emailPrimary,
            });
          }}
          onSaveInline={handleSaveInline}
          onCancelEditing={() => {
            setEditingId(null);
            setEditValues({});
          }}
          onSelectLead={(lead) => {
            router.push(`/leads/${lead.id}`);
          }}
          onClearFilters={() => {
            setSearch("");
            setCityFilter("all");
            setStatusFilter("all");
            setQuickFilter("all");
            setCurrentPage(1);
          }}
          hasActiveFilters={
            Boolean(search) || cityFilter !== "all" || statusFilter !== "all" || quickFilter !== "all"
          }
        />

        {/* Pagination */}
        <LeadsPagination
          currentPage={currentPage}
          totalPages={totalPages}
          pageSize={pageSize}
          totalFiltered={sortedLeads.length}
          onPageChange={setCurrentPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setCurrentPage(1);
          }}
        />

        {/* Floating Bulk Actions Bar */}
        <BulkActionsBar
          selectedCount={selectedLeadIds.length}
          bulkProcessing={bulkProcessing}
          onAudit={handleBulkAudit}
          onGenerateOffers={handleBulkGenerateOffers}
          onQualify={handleBulkQualify}
          onChangeStatusClick={() => setBulkStatusModal(true)}
          onExport={handleBulkExport}
          onDelete={handleBulkDelete}
          onClearSelection={clearSelection}
        />

        {/* Bulk Change Status Modal */}
        <BulkStatusModal
          isOpen={bulkStatusModal}
          onClose={() => setBulkStatusModal(false)}
          selectedCount={selectedLeadIds.length}
          targetStatus={targetBulkStatus}
          setTargetStatus={setTargetBulkStatus}
          onConfirm={handleBulkChangeStatus}
        />
      </main>
    </div>
  );
}

export default function LeadsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#0A0E17] flex items-center justify-center text-white">
          <div className="flex items-center gap-2 text-sm text-[#94A3B8]">
            <RefreshCw size={18} className="animate-spin text-[#FFE600]" />
            <span>Ładowanie bazy CRM...</span>
          </div>
        </div>
      }
    >
      <LeadsPageContent />
    </Suspense>
  );
}
