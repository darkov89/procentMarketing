"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";
import { ToastNotification, ToastMessage } from "@/components/ui/toast-notification";
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  ArrowLeft,
} from "lucide-react";

interface ParsedRow {
  companyName: string;
  city?: string;
  phone?: string;
  email?: string;
  website?: string;
  nip?: string;
  industry?: string;
}

export default function LeadsImportPage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [fileSizeKb, setFileSizeKb] = useState(0);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [detectedHeaders, setDetectedHeaders] = useState<Record<string, string>>({});
  const [running, setRunning] = useState(false);
  const [report, setReport] = useState<{
    added: number;
    duplicates: number;
    rejectedRadius?: number;
  } | null>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const showToast = (message: string, type: "success" | "error" | "info" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0];
    if (!uploadedFile) return;

    setFile(uploadedFile);
    setFileSizeKb(Math.round(uploadedFile.size / 1024));
    setReport(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: "binary" });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { header: 1 });

        if (!data || data.length < 2) {
          showToast("Plik jest pusty lub nie zawiera wiersza nagłówkowego", "error");
          return;
        }

        const rawHeaders = (data[0] as string[]).map((h) => String(h || "").trim());
        const mapping: Record<string, string> = {};

        // Auto match columns
        rawHeaders.forEach((h) => {
          const lower = h.toLowerCase();
          if (lower.includes("nazw") || lower.includes("firma") || lower.includes("company") || lower.includes("name")) {
            mapping["companyName"] = h;
          } else if (lower.includes("miast") || lower.includes("city")) {
            mapping["city"] = h;
          } else if (lower.includes("tel") || lower.includes("phone")) {
            mapping["phone"] = h;
          } else if (lower.includes("mail") || lower.includes("email")) {
            mapping["email"] = h;
          } else if (lower.includes("www") || lower.includes("stron") || lower.includes("web") || lower.includes("url")) {
            mapping["website"] = h;
          } else if (lower.includes("nip") || lower.includes("tax")) {
            mapping["nip"] = h;
          } else if (lower.includes("branż") || lower.includes("industry")) {
            mapping["industry"] = h;
          }
        });

        setDetectedHeaders(mapping);

        const rows: ParsedRow[] = [];
        for (let i = 1; i < data.length; i++) {
          const rowData = data[i] as any[];
          if (!rowData || rowData.length === 0) continue;

          const getVal = (fieldKey: string) => {
            const headerName = mapping[fieldKey];
            if (!headerName) return undefined;
            const idx = rawHeaders.indexOf(headerName);
            return idx !== -1 ? String(rowData[idx] || "").trim() : undefined;
          };

          const companyName = getVal("companyName") || String(rowData[0] || "").trim();
          if (companyName) {
            rows.push({
              companyName,
              city: getVal("city"),
              phone: getVal("phone"),
              email: getVal("email"),
              website: getVal("website"),
              nip: getVal("nip"),
              industry: getVal("industry"),
            });
          }
        }

        setParsedRows(rows);
        showToast(`Załadowano plik: ${rows.length} wierszy`, "success");
      } catch (err: any) {
        showToast(`Błąd odczytu pliku: ${err?.message || "Nieznany błąd"}`, "error");
      }
    };

    reader.readAsBinaryString(uploadedFile);
  };

  const handleExecuteImport = async () => {
    if (parsedRows.length === 0) {
      showToast("Brak wierszy do zaimportowania", "error");
      return;
    }

    setRunning(true);
    showToast(`Importowanie ${parsedRows.length} firm do CRM...`, "info");

    try {
      let added = 0;
      let duplicates = 0;
      let rejectedRadius = 0;

      // Batch in chunks of 50
      const chunkSize = 50;
      for (let i = 0; i < parsedRows.length; i += chunkSize) {
        const chunk = parsedRows.slice(i, i + chunkSize);
        const res = await fetch("/api/leads", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            leads: chunk.map((r) => ({
              companyName: r.companyName,
              city: r.city,
              phoneNormalized: r.phone,
              emailPrimary: r.email,
              website: r.website,
              nip: r.nip,
              industry: r.industry,
              source: "excel_import",
            })),
          }),
        });

        const resData = await res.json();
        if (resData.success) {
          added += resData.insertedCount || chunk.length;
          duplicates += resData.duplicateCount || 0;
          rejectedRadius += resData.rejectedRadiusCount || 0;
        }
      }

      setReport({ added, duplicates, rejectedRadius });
      showToast(`Import zakończony! Dodano +${added} firm`, "success");
    } catch {
      showToast("Błąd połączenia z bazą leadów", "error");
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#070A11] text-white">
      {toast && <ToastNotification toast={toast} />}

      {/* Header */}
      <div className="bg-[#0A0E17] border-b border-[#28354D] sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/leads"
              className="text-xs bg-[#141C2E] hover:bg-[#1E293B] border border-[#28354D] text-[#94A3B8] hover:text-white px-3 py-1.5 rounded-lg flex items-center gap-1.5 font-semibold"
            >
              <ArrowLeft size={14} /> Baza Leadów CRM
            </Link>
            <span className="text-[#64748B] text-xs font-mono">/</span>
            <h1 className="text-lg font-black text-white flex items-center gap-2">
              <Upload className="text-[#FFE600]" size={20} />
              Import Bazy (CSV / Excel)
            </h1>
          </div>
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Upload card */}
        <div className="bg-[#141C2E] border border-[#28354D] p-8 rounded-2xl shadow-xl space-y-6">
          <div className="text-center max-w-lg mx-auto space-y-2">
            <FileSpreadsheet size={44} className="mx-auto text-[#FFE600]" />
            <h2 className="text-xl font-black text-white">Przeciągnij lub Wybierz Plik Arkusza</h2>
            <p className="text-xs text-[#94A3B8]">
              Obsługiwane formaty: <strong>.xlsx, .xls, .csv</strong>. Inteligentny silnik automatycznie rozpozna kolumny (nazwa, miasto, NIP, telefon, e-mail).
            </p>
          </div>

          <div className="max-w-md mx-auto">
            <label className="flex flex-col items-center justify-center border-2 border-dashed border-[#28354D] hover:border-[#FFE600] rounded-2xl p-6 cursor-pointer bg-[#0A0E17] transition-all">
              <Upload size={24} className="text-[#94A3B8] mb-2" />
              <span className="text-xs font-bold text-white">Wybierz plik z dysku</span>
              <span className="text-[10px] text-[#64748B] mt-1">Maks. 50 MB</span>
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
          </div>

          {/* File details & execute action */}
          {file && (
            <div className="bg-[#0A0E17] border border-[#28354D] p-5 rounded-xl space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs bg-[#38BDF8]/20 text-[#38BDF8] border border-[#38BDF8]/40 px-2 py-0.5 rounded font-mono font-bold uppercase">
                      {file.name.endsWith(".csv") ? "CSV" : "EXCEL"}
                    </span>
                    <span className="font-bold text-white text-sm">{file.name}</span>
                  </div>
                  <span className="text-xs text-[#94A3B8] font-mono mt-0.5 block">
                    Rozmiar: {(fileSizeKb / 1024).toFixed(2)} MB • Liczba wierszy: {parsedRows.length}
                  </span>
                </div>

                <button
                  onClick={handleExecuteImport}
                  disabled={running || parsedRows.length === 0}
                  className="bg-[#FFE600] hover:bg-[#FFF04D] text-black font-black text-xs px-6 py-2.5 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-[#FFE600]/20 disabled:opacity-50 transition-all cursor-pointer"
                >
                  <Upload size={14} className={running ? "animate-spin" : ""} />
                  {running ? "Importowanie do CRM..." : `Zatwierdź i Zaimportuj (${parsedRows.length} firm)`}
                </button>
              </div>

              {/* Detected headers */}
              <div>
                <span className="text-xs text-[#94A3B8] block mb-2 font-bold uppercase tracking-wider">
                  Rozpoznane kolumny danych:
                </span>
                <div className="flex flex-wrap gap-2 text-xs">
                  {Object.entries(detectedHeaders).map(([field, orig]) => (
                    <span
                      key={field}
                      className="bg-[#141C2E] border border-[#38BDF8]/40 text-[#38BDF8] px-2.5 py-1 rounded-lg flex items-center gap-1.5"
                    >
                      <CheckCircle2 size={12} className="text-emerald-400" />
                      <strong>{field}:</strong> {orig}
                    </span>
                  ))}
                </div>
              </div>

              {/* Preview table */}
              {parsedRows.length > 0 && (
                <div>
                  <span className="text-xs text-[#94A3B8] block mb-2 font-bold uppercase tracking-wider">
                    Podgląd pierwszych wierszy:
                  </span>
                  <div className="overflow-x-auto rounded-lg border border-[#28354D]">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-[#141C2E] text-[#94A3B8] font-bold border-b border-[#28354D]">
                          <th className="p-2.5">Firma</th>
                          <th className="p-2.5">Miasto</th>
                          <th className="p-2.5">Telefon</th>
                          <th className="p-2.5">Strona WWW</th>
                          <th className="p-2.5">NIP</th>
                          <th className="p-2.5">Branża</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#1E293B]">
                        {parsedRows.slice(0, 5).map((row, idx) => (
                          <tr key={idx} className="hover:bg-[#141C2E]">
                            <td className="p-2.5 font-bold text-white">{row.companyName}</td>
                            <td className="p-2.5 text-[#CBD5E1]">{row.city || "—"}</td>
                            <td className="p-2.5 text-[#94A3B8] font-mono">{row.phone || "—"}</td>
                            <td className="p-2.5 text-[#38BDF8] truncate max-w-[150px]">{row.website || "—"}</td>
                            <td className="p-2.5 font-mono text-[#94A3B8]">{row.nip || "—"}</td>
                            <td className="p-2.5 text-[#94A3B8]">{row.industry || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Post import report */}
          {report && (
            <div className="bg-[#0E1422] border border-[#059669] p-6 rounded-2xl space-y-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={24} className="text-[#34D399]" />
                <h3 className="text-base font-bold text-white">Import bazy zakończony pomyślnie</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-center text-xs">
                <div className="bg-[#141C2E] p-4 rounded-xl border border-emerald-800">
                  <span className="text-[#94A3B8] block mb-1">Dodano nowych firm</span>
                  <div className="text-2xl font-black text-[#34D399]">+{report.added}</div>
                </div>
                <div className="bg-[#141C2E] p-4 rounded-xl border border-[#28354D]">
                  <span className="text-[#94A3B8] block mb-1">Pominięte duplikaty</span>
                  <div className="text-2xl font-black text-white">{report.duplicates}</div>
                </div>
                <div className="bg-[#141C2E] p-4 rounded-xl border border-[#28354D]">
                  <span className="text-[#94A3B8] block mb-1">Odrzucone poza zakresem</span>
                  <div className="text-2xl font-black text-[#94A3B8]">{report.rejectedRadius || 0}</div>
                </div>
              </div>
              <div className="flex justify-end">
                <button
                  onClick={() => router.push("/leads")}
                  className="bg-[#FFE600] text-black font-extrabold text-xs px-5 py-2.5 rounded-xl shadow-md"
                >
                  Przejdź do bazy CRM →
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
