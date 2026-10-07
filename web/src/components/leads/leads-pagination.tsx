import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface LeadsPaginationProps {
  currentPage: number;
  totalPages: number;
  pageSize: number;
  totalFiltered: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

export function LeadsPagination({
  currentPage,
  totalPages,
  pageSize,
  totalFiltered,
  onPageChange,
  onPageSizeChange,
}: LeadsPaginationProps) {
  return (
    <div className="bg-[#0E1422] border-t border-[#28354D] px-4 py-3 flex flex-wrap items-center justify-between gap-4 text-xs rounded-b-xl">
      <div className="flex items-center gap-3 text-[#94A3B8]">
        <span>
          Strona <strong className="text-white font-mono">{currentPage}</strong> z{" "}
          <strong className="text-white font-mono">{totalPages}</strong> ({totalFiltered} leadów)
        </span>
        <span className="text-[#475569]">|</span>
        <div className="flex items-center gap-1.5">
          <span>Wierszy na stronę:</span>
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="bg-[#0A0E17] border border-[#28354D] rounded px-2 py-1 text-white text-xs focus:outline-none focus:border-[#FFE600]"
          >
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
            <option value={-1}>Wszystkie ({totalFiltered})</option>
          </select>
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage <= 1 || pageSize === -1}
          className="p-1.5 rounded-lg border border-[#28354D] text-[#94A3B8] hover:text-white hover:border-[#64748B] disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
          title="Poprzednia strona"
        >
          <ChevronLeft size={16} />
        </button>

        {pageSize !== -1 && totalPages > 1 && (
          <div className="flex items-center gap-1">
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum = i + 1;
              if (totalPages > 5 && currentPage > 3) {
                pageNum = Math.min(currentPage - 2 + i, totalPages - 4 + i);
              }
              return (
                <button
                  key={pageNum}
                  type="button"
                  onClick={() => onPageChange(pageNum)}
                  className={`w-7 h-7 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                    currentPage === pageNum
                      ? "bg-[#FFE600] text-black"
                      : "bg-[#141C2E] border border-[#28354D] text-[#94A3B8] hover:text-white"
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}
          </div>
        )}

        <button
          type="button"
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage >= totalPages || pageSize === -1}
          className="p-1.5 rounded-lg border border-[#28354D] text-[#94A3B8] hover:text-white hover:border-[#64748B] disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
          title="Następna strona"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
