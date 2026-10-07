import { redirect } from "next/navigation";
import Link from "next/link";
import { requireTenant } from "@/lib/auth";
import { calculateDashboardMetrics } from "@/modules/analytics/dashboard-metrics";
import { StatCard } from "@/components/ui/stat-card";

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
  } catch {
    redirect("/login");
  }

  const params = await searchParams;
  const parsed = params.campaignId ? Number.parseInt(params.campaignId, 10) : NaN;
  const campaignId = Number.isFinite(parsed) ? parsed : null;

  const m = await calculateDashboardMetrics({ tenantId, campaignId });
  const f = m.funnel;

  const funnel: { label: string; value: number; status: string }[] = [
    { label: "Znalezione", value: f.discovered, status: "all" },
    { label: "Zakwalifikowane", value: f.qualified, status: "qualified" },
    { label: "W partii", value: f.batched, status: "approved" },
    { label: "Wysłane", value: f.outreached, status: "in_sequence" },
    { label: "Odpowiedź", value: f.replied, status: "replied" },
    { label: "Rozmowa", value: f.inTalks, status: "in_talks" },
  ];

  return (
    <main className="mx-auto max-w-7xl space-y-8 p-6 text-white">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-[#28354D] pb-6">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">Przegląd Operacyjny (Dashboard)</h1>
          <p className="text-xs text-[#94A3B8] mt-1">
            Główne metryki lejka, jakość danych i wskaźniki pozyskiwania klientów B2B
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/discovery"
            className="flex items-center gap-2 bg-[#FFE600] hover:bg-[#FFF04D] text-black font-extrabold text-xs px-4 py-2.5 rounded-xl transition-all shadow-lg shadow-yellow-500/20"
          >
            <span>+ Szukaj Nowych Leadów</span>
          </Link>
          <Link
            href="/leads"
            className="flex items-center gap-2 bg-[#141C2E] hover:bg-[#1E293B] border border-[#28354D] text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-all"
          >
            <span>Otwórz Pipeline CRM →</span>
          </Link>
        </div>
      </header>

      <section aria-labelledby="funnel-h">
        <div className="flex items-center justify-between mb-3">
          <h2 id="funnel-h" className="text-xs font-bold uppercase tracking-wider text-[#94A3B8]">
            Lejek Pozyskiwania Klientów (Kliknij kartę, aby przejść do CRM)
          </h2>
          <span className="text-[11px] text-[#64748B]">Filtruj wg statusu leada</span>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
          {funnel.map((s) => (
            <StatCard key={s.label} label={s.label} value={s.value} href={`/leads?status=${s.status}`} />
          ))}
        </div>
      </section>

      <section aria-labelledby="quality-h">
        <h2 id="quality-h" className="mb-3 text-xs font-bold uppercase tracking-wider text-[#94A3B8]">
          Jakość Danych & Weryfikacja WWW
        </h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard label="Leady" value={m.dataQuality.totalLeads} href="/leads" />
          <StatCard label="Ze stroną WWW" value={m.dataQuality.withWebsite} href="/leads" />
          <StatCard label="Bez kontaktu" value={`${m.dataQuality.missingContactPercent}%`} href="/leads" />
          <StatCard
            label="Do ręcznej oceny"
            value={m.dataQuality.requiresManualReviewCount}
            hint={`${m.dataQuality.requiresManualReviewPercent}%`}
            href="/leads?filter=needs_review"
          />
        </div>
      </section>

      <section aria-labelledby="mail-h">
        <h2 id="mail-h" className="mb-3 text-xs font-bold uppercase tracking-wider text-[#94A3B8]">
          Wysyłka & Zadania
        </h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard label="Wysłane wiadomości" value={m.mailQueue.totalMessagesSent} href="/outbox/history" />
          <StatCard label="Reply rate" value={`${m.mailQueue.replyRate}%`} href="/outbox/history" />
          {m.modulesEnabled.offers ? (
            <StatCard
              label="Odsłony ofert"
              value={m.mailQueue.totalOfferViews}
              hint={`View rate ${m.mailQueue.offerViewRate}%`}
              href="/outbox/history"
            />
          ) : null}
          <StatCard
            label="Otwarte zadania"
            value={m.tasks.openTasksCount}
            hint={`Telefony: ${m.tasks.phoneCallsPending} · Wstrzymane: ${m.tasks.blockedTasksCount}`}
            href="/leads"
          />
        </div>
      </section>

      {m.modulesEnabled.outcomeSchema ? (
        <section aria-labelledby="fin-h">
          <h2 id="fin-h" className="mb-3 text-xs font-bold uppercase tracking-wider text-[#94A3B8]">
            Wyniki Finansowe
          </h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <StatCard label="Zadeklarowane" value={formatPln(m.financials.totalPledgedMinor)} hint="Deklaracja ≠ wpłata" href="/leads" />
            <StatCard label="Wpłacone (potwierdzone)" value={formatPln(m.financials.totalPaidMinor)} href="/leads" />
            <StatCard label="Potwierdzone wpłaty" value={m.financials.paidCount} href="/leads" />
          </div>
        </section>
      ) : null}
    </main>
  );
}
