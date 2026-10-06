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
    <main className="mx-auto max-w-7xl space-y-8 p-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
        <Link href="/" className="text-sm text-indigo-600 hover:underline">
          Panel klasyczny →
        </Link>
      </header>

      <section aria-labelledby="funnel-h">
        <h2 id="funnel-h" className="mb-3 text-sm font-semibold text-slate-700">Lejek</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
          {funnel.map((s) => (
            <StatCard key={s.label} label={s.label} value={s.value} href={`/?status=${s.status}`} />
          ))}
        </div>
      </section>

      <section aria-labelledby="quality-h">
        <h2 id="quality-h" className="mb-3 text-sm font-semibold text-slate-700">Jakość danych</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard label="Leady" value={m.dataQuality.totalLeads} />
          <StatCard label="Ze stroną WWW" value={m.dataQuality.withWebsite} />
          <StatCard label="Bez kontaktu" value={`${m.dataQuality.missingContactPercent}%`} />
          <StatCard
            label="Do ręcznej oceny"
            value={m.dataQuality.requiresManualReviewCount}
            hint={`${m.dataQuality.requiresManualReviewPercent}%`}
          />
        </div>
      </section>

      <section aria-labelledby="mail-h">
        <h2 id="mail-h" className="mb-3 text-sm font-semibold text-slate-700">Wysyłka i zadania</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard label="Wysłane wiadomości" value={m.mailQueue.totalMessagesSent} />
          <StatCard label="Reply rate" value={`${m.mailQueue.replyRate}%`} />
          {m.modulesEnabled.offers ? (
            <StatCard
              label="Odsłony ofert"
              value={m.mailQueue.totalOfferViews}
              hint={`View rate ${m.mailQueue.offerViewRate}%`}
            />
          ) : null}
          <StatCard
            label="Otwarte zadania"
            value={m.tasks.openTasksCount}
            hint={`Telefony: ${m.tasks.phoneCallsPending} · Wstrzymane: ${m.tasks.blockedTasksCount}`}
          />
        </div>
      </section>

      {m.modulesEnabled.outcomeSchema ? (
        <section aria-labelledby="fin-h">
          <h2 id="fin-h" className="mb-3 text-sm font-semibold text-slate-700">Wyniki finansowe</h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <StatCard label="Zadeklarowane" value={formatPln(m.financials.totalPledgedMinor)} hint="Deklaracja ≠ wpłata" />
            <StatCard label="Wpłacone (potwierdzone)" value={formatPln(m.financials.totalPaidMinor)} />
            <StatCard label="Potwierdzone wpłaty" value={m.financials.paidCount} />
          </div>
        </section>
      ) : null}
    </main>
  );
}
