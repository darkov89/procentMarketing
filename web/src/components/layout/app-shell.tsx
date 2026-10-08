"use client";

import React, { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { AppSidebar } from "@/components/navigation/app-sidebar";
import { AppTopBar } from "@/components/navigation/app-topbar";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Restore sidebar state from localStorage on client
  useEffect(() => {
    try {
      const saved = localStorage.getItem("procent_sidebar_collapsed");
      if (saved !== null) {
        setCollapsed(saved === "true");
      }
    } catch {}
  }, []);

  const handleToggleCollapse = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("procent_sidebar_collapsed", String(next));
      } catch {}
      return next;
    });
  };

  // Public and landing pages render clean without sidebar
  const isPublicPage =
    !pathname ||
    pathname.startsWith("/o/") ||
    pathname.startsWith("/offers/") ||
    pathname === "/login" ||
    pathname.startsWith("/invite");

  if (isPublicPage) {
    return <div className="min-h-screen">{children}</div>;
  }

  return (
    <div className="min-h-screen flex bg-[#0A0E17] text-[#F8FAFC]">
      {/* ActiveCampaign-style Left Sidebar */}
      <AppSidebar
        collapsed={collapsed}
        onToggleCollapse={handleToggleCollapse}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />

      {/* Main Workspace Area */}
      <div className="flex-1 min-w-0 flex flex-col min-h-screen">
        <AppTopBar onOpenMobile={() => setMobileOpen(true)} />
        <div className="flex-1 min-w-0 flex flex-col">{children}</div>
      </div>
    </div>
  );
}
