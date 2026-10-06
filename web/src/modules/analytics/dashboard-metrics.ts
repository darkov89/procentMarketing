import { leads, messages, offers, tasks, outcomes, campaignLeads, campaigns, playbookVersions, withTenant } from "@/lib/db";
import { eq, and, sql } from "drizzle-orm";
import { PlaybookDefinition } from "@/modules/campaigns/playbook.schema";

export interface DashboardMetricsResult {
  tenantId: number;
  campaignId: number | null;
  modulesEnabled: {
    audit: boolean;
    offers: boolean;
    pricing: boolean;
    outcomeSchema: boolean;
  };

  // 1. Funnel Metrics
  funnel: {
    discovered: number;
    researched: number;
    qualified: number;
    batched: number;
    outreached: number;
    replied: number;
    inTalks: number;
    pledged: number;
    paid: number;
  };

  // 2. Data Quality Metrics
  dataQuality: {
    totalLeads: number;
    withWebsite: number;
    withEmailOrPhone: number;
    missingContactPercent: number;
    requiresManualReviewCount: number;
    requiresManualReviewPercent: number;
  };

  // 3. Mailbox & Queue
  mailQueue: {
    totalMessagesSent: number;
    totalOfferViews: number;
    leadsWithOfferViews: number;
    offerViewRate: number;
    replyRate: number;
  };

  // 4. Tasks & Calls
  tasks: {
    openTasksCount: number;
    phoneCallsPending: number;
    blockedTasksCount: number;
  };

  // 5. Financial Outcomes (Zero Guessing: paid strictly after paymentConfirmedAt)
  financials: {
    totalPledgedMinor: number;
    totalPaidMinor: number;
    currency: string;
    paidCount: number;
  };
}

export interface DashboardFilters {
  tenantId: number;
  campaignId?: number | null;
}

/**
 * Calculates modular dashboard metrics strictly respecting:
 * 1. Playbook module visibility (hides offers metrics when modules.offers = false).
 * 2. Invariant 5 & R1 (financials: paid strictly from outcomes.paid_minor where payment_confirmed_at IS NOT NULL).
 * 3. Linkable metrics without dead-ends.
 */
export async function calculateDashboardMetrics(filters: DashboardFilters): Promise<DashboardMetricsResult> {
  const { tenantId, campaignId } = filters;

  return await withTenant(tenantId, async (tx) => {
    // 1. Load active campaign and playbook definition if campaignId specified
    let modulesEnabled = {
      audit: true,
      offers: true,
      pricing: true,
      outcomeSchema: true,
    };

    if (campaignId) {
      const [camp] = await tx
        .select({
          definition: playbookVersions.definition,
        })
        .from(campaigns)
        .innerJoin(playbookVersions, eq(campaigns.playbookVersionId, playbookVersions.id))
        .where(and(eq(campaigns.id, campaignId), eq(campaigns.tenantId, tenantId)))
        .limit(1);

      if (camp) {
        const pb = camp.definition as PlaybookDefinition;
        modulesEnabled = {
          audit: pb.modules?.audit ?? true,
          offers: pb.modules?.offers ?? true,
          pricing: pb.modules?.pricing ?? true,
          outcomeSchema: pb.outcomeSchema?.enabled ?? true,
        };
      }
    }

    // 2. Funnel metrics
    const campaignLeadConditions = [eq(campaignLeads.tenantId, tenantId)];
    if (campaignId) {
      campaignLeadConditions.push(eq(campaignLeads.campaignId, campaignId));
    }

    const campaignLeadRows = await tx
      .select({
        state: campaignLeads.state,
        requiresManualReview: campaignLeads.requiresManualReview,
      })
      .from(campaignLeads)
      .where(and(...campaignLeadConditions));

    const totalDiscovered = campaignLeadRows.length;
    let qualified = 0;
    let batched = 0;
    let outreached = 0;
    let replied = 0;
    let inTalks = 0;
    let manualReviewCount = 0;

    for (const cl of campaignLeadRows) {
      if (cl.requiresManualReview) manualReviewCount++;
      const s = cl.state;
      if (["qualified", "approved", "in_sequence", "replied", "in_talks", "pledged", "paid"].includes(s)) qualified++;
      if (["approved", "in_sequence", "replied", "in_talks", "pledged", "paid"].includes(s)) batched++;
      if (["in_sequence", "replied", "in_talks", "pledged", "paid"].includes(s)) outreached++;
      if (["replied", "in_talks", "pledged", "paid"].includes(s)) replied++;
      if (["in_talks", "pledged", "paid"].includes(s)) inTalks++;
    }

    // 3. Data quality metrics from leads table
    const leadConditions = [eq(leads.tenantId, tenantId)];
    const leadRows = await tx
      .select({
        id: leads.id,
        website: leads.website,
        emailPrimary: leads.emailPrimary,
        phoneNormalized: leads.phoneNormalized,
      })
      .from(leads)
      .where(and(...leadConditions));

    const totalLeads = leadRows.length;
    const withWebsite = leadRows.filter((l) => Boolean(l.website)).length;
    const withContact = leadRows.filter((l) => Boolean(l.emailPrimary || l.phoneNormalized)).length;
    const missingContactCount = totalLeads - withContact;
    const missingContactPercent = totalLeads > 0 ? Math.round((missingContactCount / totalLeads) * 100) : 0;
    const requiresManualReviewPercent = totalDiscovered > 0 ? Math.round((manualReviewCount / totalDiscovered) * 100) : 0;

    // 4. Outreach & Messages
    const [msgCountRow] = await tx
      .select({
        totalSent: sql<number>`count(*)::int`,
      })
      .from(messages)
      .where(and(eq(messages.tenantId, tenantId), eq(messages.direction, "outbound"), eq(messages.status, "sent")));

    const totalMessagesSent = Number(msgCountRow?.totalSent || 0);

    // Offers views (only if modulesEnabled.offers is true)
    let totalOfferViews = 0;
    let leadsWithOfferViews = 0;
    if (modulesEnabled.offers) {
      const offerRows = await tx
        .select({
          viewCount: offers.viewCount,
        })
        .from(offers)
        .where(eq(offers.tenantId, tenantId));

      for (const o of offerRows) {
        const vc = Number(o.viewCount || 0);
        totalOfferViews += vc;
        if (vc > 0) leadsWithOfferViews++;
      }
    }

    const offerViewRate = outreached > 0 ? Math.round((leadsWithOfferViews / outreached) * 100) : 0;
    const replyRate = outreached > 0 ? Math.round((replied / outreached) * 100) : 0;

    // 5. Tasks
    const taskRows = await tx
      .select({
        type: tasks.type,
        status: tasks.status,
      })
      .from(tasks)
      .where(eq(tasks.tenantId, tenantId));

    const openTasksCount = taskRows.filter((t) => t.status === "open").length;
    const phoneCallsPending = taskRows.filter((t) => t.status === "open" && t.type === "phone_call").length;
    const blockedTasksCount = taskRows.filter((t) => t.status === "blocked").length;

    // 6. Financial Outcomes (Rule: paid strictly when paymentConfirmedAt IS NOT NULL)
    let totalPledgedMinor = 0;
    let totalPaidMinor = 0;
    let paidCount = 0;

    if (modulesEnabled.outcomeSchema) {
      const outcomeRows = await tx
        .select({
          pledgedMinor: outcomes.pledgedMinor,
          paidMinor: outcomes.paidMinor,
          paymentConfirmedAt: outcomes.paymentConfirmedAt,
        })
        .from(outcomes)
        .where(eq(outcomes.tenantId, tenantId));

      for (const o of outcomeRows) {
        if (o.pledgedMinor) {
          totalPledgedMinor += Number(o.pledgedMinor);
        }
        // CRITICAL INVARIANT: Pledged never counts as paid. Only confirmed payments count!
        if (o.paidMinor && o.paymentConfirmedAt) {
          totalPaidMinor += Number(o.paidMinor);
          paidCount++;
        }
      }
    }

    return {
      tenantId,
      campaignId: campaignId || null,
      modulesEnabled,
      funnel: {
        discovered: totalDiscovered,
        researched: totalDiscovered,
        qualified,
        batched,
        outreached,
        replied,
        inTalks,
        pledged: totalPledgedMinor > 0 ? 1 : 0,
        paid: paidCount,
      },
      dataQuality: {
        totalLeads,
        withWebsite,
        withEmailOrPhone: withContact,
        missingContactPercent,
        requiresManualReviewCount: manualReviewCount,
        requiresManualReviewPercent,
      },
      mailQueue: {
        totalMessagesSent,
        totalOfferViews,
        leadsWithOfferViews,
        offerViewRate,
        replyRate,
      },
      tasks: {
        openTasksCount,
        phoneCallsPending,
        blockedTasksCount,
      },
      financials: {
        totalPledgedMinor,
        totalPaidMinor,
        currency: "PLN",
        paidCount,
      },
    };
  });
}
