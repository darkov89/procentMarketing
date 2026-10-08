import { redirect } from "next/navigation";
import Link from "next/link";
import { requireTenant } from "@/lib/auth";
import { calculateDashboardMetrics } from "@/modules/analytics/dashboard-metrics";
import { StatCard } from "@/components/ui/stat-card";
import { PipelineFunnel } from "@/components/dashboard/pipeline-funnel";
import { LiveActivityFeed, ActivityEvent } from "@/components/dashboard/live-activity-feed";
import { DataHealthCard } from "@/components/dashboard/data-health-card";
import { withTenant, leadEvents, leads } from "@/lib/db";
import { eq, desc } from "drizzle-orm";
import {
  TrendingUp,
  Target,
  MessageSquare,
  ShieldCheck,
  Plus,
  ArrowRight,
  Sparkles,
  Building,
  Zap,
} from "lucide-react";

export const dynamic = "force-dynamic";

function formatPln(minor: number): string {
  return (minor / 100).toLocaleString("pl-PL", { style: "currency", currency: "PLN" });
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ campaignId?: string }>;
}) {
  let tenantId: number;
  try {
    ({ tenantId } = await requireTenant());
  } catch (err: any) {
    console.error("Dashboard requireTenant failed:", err?.message || err);
    redirect("/login");
  }

  const params = await searchParams;
  const parsed = params.campaignId ? Number.parseInt(params.campaignId, 10) : NaN;
  const campaignId = Number.isFinite(parsed) ? parsed : null;

  // 1. Calculate executive metrics
  const m = await calculateDashboardMetrics({ tenantId, campaignId });
  const f = m.funnel;

  // 2. Fetch recent real-time activity events
  let recentEvents: ActivityEvent[] = [];
  try {
    recentEvents = await withTenant(tenantId, async (tx) => {
      const rows = await tx
        .select({
          id: leadEvents.id,
          leadId: leadEvents.leadId,
          companyName: leads.companyName,
          fromStatus: leadEvents.fromStatus,
          toStatus: leadEvents.toStatus,
          reason: leadEvents.reason,
          actor: leadEvents.actor,
          createdAt: leadEvents.createdAt,
        })
        .from(leadEvents)
        .innerJoin(leads, eq(leadEvents.leadId, leads.id))
        .orderBy(desc(leadEvents.createdAt))
        .limit(8);

      return rows as ActivityEvent[];
    });
  } catch {
    recentEvents = [];
  }

  const qualificationRate = f.discovered > 0 ? Math.round((f.qualified / f.discovered) * 100) : 0;

  return (
    <main className="mx-auto max-w-7xl space-y-8 p-4 sm:p-6 lg:p-8 text-white">
      {/* Executive Hero Bar */}
      <header className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-slate-800/80">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Panel Dowodzenia (Executive Dashboard)
            </h1>
            <span className="inline-flex items-center gap-1 text-[10px] uppercase font-bold tracking-wider px-2.5 py-0.5 rounded-full bg-[#FFE600]/10 text-[#FFE600] border border-[#FFE600]/30 font-mono">
              <Zap size={11} />
              B2B Growth Engine
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            Zautomatyzowane pozyskiwanie leadów, weryfikacja w CEIDG/KRS, audyt technologiczny WWW i spersonalizowany outreach.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            href="/discovery"
            className="flex items-center gap-2 bg-[#FFE600] hover:bg-[#FFF04D] text-black font-extrabold text-xs px-4 py-2.5 rounded-xl transition-all shadow-lg shadow-yellow-500/20 active:scale-95"
          >
            <Plus size={15} />
            <span>+ Nowy Skaner Miejsc</span>
          </Link>
          <Link
            href="/leads"
            className="flex items-center gap-2 bg-[#131B2F] hover:bg-[#1A243D] border border-slate-800 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-all"
          >
            <Building size={14} className="text-slate-400" />
            <span>Otwórz Pipeline CRM →</span>
          </Link>
        </div>
      </header>

      {/* Top 4 Hero KPI Cards */}
      <section aria-labelledby="kpi-heading" className="space-y-3">
        <h2 id="kpi-heading" className="text-xs font-bold uppercase tracking-wider text-slate-400">
          Główne Wskaźniki Efektywności (KPI)
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* 1. Pipeline Value */}
          <StatCard
            label="Wartość Potencjału (Pipeline)"
            value={formatPln(m.financials.totalPledgedMinor)}
            hint={`Wpłacone: ${formatPln(m.financials.totalPaidMinor)} (${m.financials.paidCount} transakcji)`}
            trend="90% wpłat"
            trendColor="emerald"
            icon={TrendingUp}
            href="/leads"
          />

          {/* 2. Kwalifikacja Bazy */}
          <StatCard
            label="Kwalifikacja Bazy Handlowej"
            value={`${f.qualified} firm`}
            hint={`z ${f.discovered} zidentyfikowanych w Google Places / rejestrach`}
            trend={`${qualificationRate}% bazy`}
            trendColor="sky"
            icon={Target}
            href="/leads?status=qualified"
          />

          {/* 3. Wskaźnik Odpowiedzi Outreachu */}
          <StatCard
            label="Skuteczność Outreachu"
            value={`${m.mailQueue.replyRate}% Reply`}
            hint={`${m.mailQueue.totalMessagesSent} maili · ${m.mailQueue.totalOfferViews} odsłon stron ofert`}
            trend="Aktywna konwersja"
            trendColor="yellow"
            icon={MessageSquare}
            href="/outbox/history"
          />

          {/* 4. Zadania i Kolejka */}
          <StatCard
            label="Zadania & Kolejka Handlowa"
            value={`${m.tasks.openTasksCount} zadań`}
            hint={`${m.tasks.phoneCallsPending} telefonów · ${m.tasks.blockedTasksCount} wstrzymanych`}
            trend={m.tasks.blockedTasksCount > 0 ? "Wymaga uwagi" : "Na bieżąco"}
            trendColor={m.tasks.blockedTasksCount > 0 ? "amber" : "emerald"}
            icon={ShieldCheck}
            href="/leads"
          />
        </div>
      </section>

      {/* Interactive Pipeline Funnel */}
      <section aria-labelledby="funnel-heading">
        <PipelineFunnel
          discovered={f.discovered}
          qualified={f.qualified}
          batched={f.batched}
          outreached={f.outreached}
          replied={f.replied}
          inTalks={f.inTalks}
          paid={m.financials.paidCount}
        />
      </section>

      {/* Split Grid: Live Activity Feed (60%) + Data Health Meter (40%) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <div className="lg:col-span-7 flex flex-col">
          <LiveActivityFeed events={recentEvents} />
        </div>
        <div className="lg:col-span-5 flex flex-col">
          <DataHealthCard
            totalLeads={m.dataQuality.totalLeads}
            withWebsite={m.dataQuality.withWebsite}
            missingContactPercent={m.dataQuality.missingContactPercent}
            requiresManualReviewCount={m.dataQuality.requiresManualReviewCount}
            requiresManualReviewPercent={m.dataQuality.requiresManualReviewPercent}
          />
        </div>
      </div>
    </main>
  );
}
