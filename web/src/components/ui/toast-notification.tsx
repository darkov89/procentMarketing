import React from "react";
import { CheckCircle2, AlertTriangle } from "lucide-react";

export interface ToastMessage {
  message: string;
  type: "success" | "error" | "info";
}

interface ToastNotificationProps {
  toast: ToastMessage | null;
}

export function ToastNotification({ toast }: ToastNotificationProps) {
  if (!toast) return null;

  return (
    <div
      className={`fixed top-5 right-5 z-50 px-5 py-3 rounded-lg shadow-xl text-sm font-semibold flex items-center gap-3 transition-all ${
        toast.type === "success"
          ? "bg-[#064E3B] border border-[#059669] text-[#34D399]"
          : toast.type === "error"
          ? "bg-[#881337] border border-[#E11D48] text-[#FB7185]"
          : "bg-[#1E293B] border border-[#334155] text-[#FFE600]"
      }`}
    >
      {toast.type === "success" ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
      <span>{toast.message}</span>
    </div>
  );
}
