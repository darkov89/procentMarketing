import React from "react";
import {
  Globe,
  Sparkles,
  Zap,
  Tag,
  Download,
  Trash2,
  X,
  RefreshCw,
} from "lucide-react";

interface BulkActionsBarProps {
  selectedCount: number;
  bulkProcessing: {
    active: boolean;
    label: string;
    current: number;
    total: number;
  } | null;
  onAudit: () => Promise<void>;
  onGenerateOffers: () => Promise<void>;
  onQualify: () => Promise<void>;
  onChangeStatusClick: () => void;
  onExport: () => void;
  onDelete: () => Promise<void>;
  onClearSelection: () => void;
}

export function BulkActionsBar({
  selectedCount,
  bulkProcessing,
  onAudit,
  onGenerateOffers,
  onQualify,
  onChangeStatusClick,
  onExport,
  onDelete,
  onClearSelection,
}: BulkActionsBarProps) {
  if (selectedCount === 0) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-[#0F172A]/95 backdrop-blur-md border-2 border-[#FFE600] rounded-2xl shadow-2xl px-5 py-3 flex items-center gap-3 text-xs max-w-4xl w-[95%] sm:w-auto animate-in slide-in-from-bottom-5 duration-200">
      <div className="flex items-center gap-2 pr-3 border-r border-[#28354D] shrink-0">
        <div className="w-6 h-6 rounded-full bg-[#FFE600] text-black font-black font-mono text-[11px] flex items-center justify-center shadow">
          {selectedCount}
        </div>
        <span className="text-white font-bold hidden sm:inline">zaznaczonych</span>
      </div>

      {bulkProcessing ? (
        <div className="flex items-center gap-2 text-[#FFE600] font-semibold py-1">
          <RefreshCw size={14} className="animate-spin" />
          <span>
            {bulkProcessing.label}... ({bulkProcessing.current}/{bulkProcessing.total})
          </span>
        </div>
      ) : (
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={onAudit}
            className="bg-[#141C2E] hover:bg-[#1E293B] border border-[#28354D] hover:border-[#38BDF8] text-white px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-all cursor-pointer"
            title="Uruchom audyt WWW dla zaznaczonych leadów ze stronami"
          >
            <Globe size={13} className="text-[#38BDF8]" />
            <span>Skanuj WWW</span>
          </button>

          <button
            type="button"
            onClick={onGenerateOffers}
            className="bg-[#141C2E] hover:bg-[#1E293B] border border-[#28354D] hover:border-amber-400 text-white px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-all cursor-pointer"
            title="Wygeneruj spersonalizowane oferty dla wybranych firm"
          >
            <Sparkles size={13} className="text-amber-400" />
            <span>Generuj Oferty</span>
          </button>

          <button
            type="button"
            onClick={onQualify}
            className="bg-[#141C2E] hover:bg-[#1E293B] border border-[#28354D] hover:border-emerald-400 text-white px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-all cursor-pointer"
            title="Przelicz scoring ICP i zaktualizuj kwalifikację"
          >
            <Zap size={13} className="text-emerald-400" />
            <span>Scoring & Kwalifikacja</span>
          </button>

          <button
            type="button"
            onClick={onChangeStatusClick}
            className="bg-[#141C2E] hover:bg-[#1E293B] border border-[#28354D] hover:border-purple-400 text-white px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-all cursor-pointer"
            title="Zmień status dla wszystkich zaznaczonych"
          >
            <Tag size={13} className="text-purple-400" />
            <span>Zmień Status</span>
          </button>

          <button
            type="button"
            onClick={onExport}
            className="bg-[#141C2E] hover:bg-[#1E293B] border border-[#28354D] hover:border-[#FFE600] text-white px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-all cursor-pointer"
            title="Pobierz arkusz Excel z danymi zaznaczonych leadów"
          >
            <Download size={13} className="text-[#FFE600]" />
            <span>Eksport (.xlsx)</span>
          </button>

          <button
            type="button"
            onClick={onDelete}
            className="bg-rose-950/60 hover:bg-rose-900 border border-rose-800 text-rose-200 px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-all cursor-pointer"
            title="Usuń trwale zaznaczone firmy"
          >
            <Trash2 size={13} />
            <span>Usuń</span>
          </button>

          <button
            type="button"
            onClick={onClearSelection}
            className="text-[#94A3B8] hover:text-white p-1.5 rounded-lg hover:bg-[#1E293B] transition-all ml-1 cursor-pointer"
            title="Odznacz wszystkie"
          >
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
}

interface BulkStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedCount: number;
  targetStatus: string;
  setTargetStatus: (s: string) => void;
  onConfirm: (status: string) => Promise<void>;
}

export function BulkStatusModal({
  isOpen,
  onClose,
  selectedCount,
  targetStatus,
  setTargetStatus,
  onConfirm,
}: BulkStatusModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-[#101726] border border-[#28354D] rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150">
        <div className="bg-[#141C2E] border-b border-[#28354D] p-5 flex items-center justify-between">
          <div>
            <h3 className="text-base font-black text-white flex items-center gap-2">
              <Tag size={18} className="text-[#FFE600]" />
              Masowa zmiana statusu
            </h3>
            <p className="text-xs text-[#94A3B8] mt-0.5">
              Zaznaczono <strong className="text-white">{selectedCount}</strong> firm
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[#94A3B8] hover:text-white p-1.5 rounded-lg hover:bg-[#1E293B] transition-all cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-bold text-[#CBD5E1] uppercase tracking-wider mb-2">
              Wybierz nowy status:
            </label>
            <select
              value={targetStatus}
              onChange={(e) => setTargetStatus(e.target.value)}
              className="w-full bg-[#0A0E17] border border-[#28354D] rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#FFE600]"
            >
              <option value="pending_approval">🛡️ Do Zatwierdzenia AI Act (pending_approval)</option>
              <option value="needs_review">⚠️ Do Weryfikacji (needs_review)</option>
              <option value="qualified">✅ Zakwalifikowane (qualified)</option>
              <option value="new">🆕 Nowe (new)</option>
              <option value="in_sequence">📬 W Sekwencji Outreach (in_sequence)</option>
              <option value="disqualified">❌ Odrzucone (disqualified)</option>
              <option value="replied_interested">💬 Odpowiedź: Zainteresowany</option>
              <option value="meeting_booked">🏆 Umówione Spotkanie</option>
            </select>
          </div>

          <p className="text-[11px] text-[#94A3B8] leading-relaxed bg-[#0A0E17] p-3 rounded-lg border border-[#1E293B]">
            ℹ️ Zmiana statusu wywoła masowe przejście w maszynie stanów z audytem w zdarzeniach leada (Invariant 3).
          </p>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-[#94A3B8] hover:text-white hover:bg-[#1E293B] transition-all cursor-pointer"
            >
              Anuluj
            </button>
            <button
              type="button"
              onClick={() => onConfirm(targetStatus)}
              className="bg-[#FFE600] hover:bg-[#FACC15] text-black px-5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer shadow-lg shadow-[#FFE600]/20"
            >
              Zatwierdź zmianę ({selectedCount})
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
