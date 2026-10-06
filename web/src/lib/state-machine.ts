import { db, leads, leadEvents, campaigns, campaignLeads, playbookVersions } from "@/lib/db";
import { eq, and } from "drizzle-orm";

export type LeadStatus =
  | "new"
  | "enriching"
  | "audit_failed"
  | "needs_review"
  | "qualified"
  | "disqualified"
  | "offer_ready"
  | "pending_approval"
  | "approved"
  | "in_sequence"
  | "paused_autoreply"
  | "replied_interested"
  | "replied_question"
  | "replied_negative"
  | "needs_human"
  | "unsubscribed"
  | "bounced"
  | "meeting_booked"
  | "won"
  | "lost";

export const TERMINAL_STATUSES: LeadStatus[] = [
  "unsubscribed",
  "bounced",
  "replied_negative",
  "disqualified",
];

export interface TransitionParams {
  leadId: number;
  toStatus: LeadStatus;
  reason?: string | null;
  actor?: string; // "system" | "user:<id>" | "worker:<job_id>"
  metadata?: Record<string, unknown> | null;
  sequenceStep?: number;
  nextActionAt?: Date | null;
  lostReason?: string | null;
  cooldownUntil?: Date | null;
  forceAdminOverride?: boolean;
}

// Legal State Transition Matrix
export const ALLOWED_TRANSITIONS: Record<LeadStatus, LeadStatus[]> = {
  new: ["enriching", "needs_review", "disqualified", "qualified", "audit_failed", "unsubscribed"],
  enriching: ["needs_review", "qualified", "disqualified", "audit_failed", "new"],
  audit_failed: ["enriching", "needs_review", "disqualified", "new"],
  needs_review: ["qualified", "disqualified", "audit_failed", "new", "unsubscribed"],
  qualified: ["offer_ready", "pending_approval", "needs_review", "disqualified", "unsubscribed"],
  disqualified: ["needs_review", "new"], // Only with explicit human review
  offer_ready: ["pending_approval", "approved", "needs_review", "disqualified", "unsubscribed"],
  pending_approval: ["approved", "needs_review", "disqualified", "offer_ready", "unsubscribed"],
  approved: ["in_sequence", "pending_approval", "unsubscribed"],
  in_sequence: [
    "in_sequence", // Next follow-up step
    "paused_autoreply",
    "replied_interested",
    "replied_question",
    "replied_negative",
    "needs_human",
    "bounced",
    "unsubscribed",
    "meeting_booked",
    "lost",
  ],
  paused_autoreply: ["in_sequence", "needs_human", "unsubscribed", "lost"],
  replied_interested: ["meeting_booked", "won", "lost", "needs_human", "unsubscribed"],
  replied_question: ["meeting_booked", "replied_interested", "replied_negative", "needs_human", "unsubscribed", "lost"],
  replied_negative: ["unsubscribed"], // Terminal
  needs_human: [
    "in_sequence",
    "replied_interested",
    "replied_question",
    "replied_negative",
    "meeting_booked",
    "won",
    "lost",
    "unsubscribed",
  ],
  unsubscribed: [], // Terminal: zero automatic transitions
  bounced: [], // Terminal: zero automatic transitions
  meeting_booked: ["won", "lost", "needs_human"],
  won: [],
  lost: ["new", "needs_review"], // Only after cooldown expires or manual reactivation
};

export class IllegalStateTransitionError extends Error {
  leadId: number;
  fromStatus: string;
  toStatus: string;

  constructor(
    leadId: number,
    fromStatus: string,
    toStatus: string,
    message?: string
  ) {
    super(
      message ||
        `Niedozwolone przejście stanu leada #${leadId}: '${fromStatus}' ➔ '${toStatus}'.`
    );
    this.name = "IllegalStateTransitionError";
    this.leadId = leadId;
    this.fromStatus = fromStatus;
    this.toStatus = toStatus;
  }
}

/**
 * Checks whether a transition between two states is permitted by ALLOWED_TRANSITIONS
 */
export function isValidTransition(fromStatus: LeadStatus, toStatus: LeadStatus): boolean {
  if (fromStatus === toStatus) return true;
  const allowed = ALLOWED_TRANSITIONS[fromStatus] || [];
  return allowed.includes(toStatus);
}

/**
 * Centralized, authoritative lead transition function.
 * INVARIANT 3: Every production status change must go through transitionLead().
 */
export async function transitionLead(params: TransitionParams) {
  const {
    leadId,
    toStatus,
    reason,
    actor = "system",
    metadata,
    sequenceStep,
    nextActionAt,
    lostReason,
    cooldownUntil,
    forceAdminOverride = false,
  } = params;

  // 1. Fetch current lead
  const [currentLead] = await db
    .select({
      id: leads.id,
      tenantId: leads.tenantId,
      status: leads.status,
      sequenceStep: leads.sequenceStep,
      isFixture: leads.isFixture,
    })
    .from(leads)
    .where(eq(leads.id, leadId));

  if (!currentLead) {
    throw new Error(`Lead #${leadId} nie został znaleziony w bazie danych.`);
  }

  const fromStatus = (currentLead.status || "new") as LeadStatus;

  // If already in target status and no step update, no-op
  if (fromStatus === toStatus && sequenceStep === undefined) {
    return {
      success: true,
      leadId: currentLead.id,
      previousStatus: fromStatus,
      currentStatus: toStatus,
    };
  }

  // 2. Validate legality of transition
  if (!forceAdminOverride) {
    // Check terminal statuses
    if (TERMINAL_STATUSES.includes(fromStatus) && fromStatus !== toStatus) {
      throw new IllegalStateTransitionError(
        leadId,
        fromStatus,
        toStatus,
        `Lead #${leadId} znajduje się w stanie terminalnym '${fromStatus}'. Automatyczny powrót do sekwencji jest zablokowany.`
      );
    }

    const allowed = ALLOWED_TRANSITIONS[fromStatus] || [];
    if (!allowed.includes(toStatus)) {
      throw new IllegalStateTransitionError(leadId, fromStatus, toStatus);
    }

    // Special rule: in_sequence -> lost requires reason
    if (fromStatus === "in_sequence" && toStatus === "lost" && !lostReason && !reason) {
      throw new IllegalStateTransitionError(
        leadId,
        fromStatus,
        toStatus,
        `Przejście 'in_sequence' ➔ 'lost' wymaga podania powodu (lostReason lub reason).`
      );
    }
  }

  // 3. Prepare update payload
  const updateData: Record<string, unknown> = {
    status: toStatus,
    updatedAt: new Date(),
  };

  if (sequenceStep !== undefined) {
    updateData.sequenceStep = sequenceStep;
  }
  if (nextActionAt !== undefined) {
    updateData.nextActionAt = nextActionAt;
  }
  if (lostReason !== undefined) {
    updateData.lostReason = lostReason;
  }
  if (cooldownUntil !== undefined) {
    updateData.cooldownUntil = cooldownUntil;
  }
  if (reason) {
    updateData.rejectionReason = reason;
  }

  // 4. Update lead and append immutable audit log to lead_events
  await db.update(leads).set(updateData).where(eq(leads.id, leadId));

  // Sync state to default campaign_leads if present (Faza 2 adapter)
  try {
    await db
      .update(campaignLeads)
      .set({ state: toStatus, updatedAt: new Date() })
      .where(and(eq(campaignLeads.leadId, leadId), eq(campaignLeads.tenantId, currentLead.tenantId)));
  } catch (syncErr) {
    console.warn("Could not sync campaignLeads state:", syncErr);
  }

  await db.insert(leadEvents).values({
    tenantId: currentLead.tenantId,
    leadId,
    fromStatus,
    toStatus,
    reason: reason || lostReason || null,
    actor,
    metadata: {
      ...metadata,
      adminOverride: forceAdminOverride,
      sequenceStep: sequenceStep ?? currentLead.sequenceStep,
    },
    createdAt: new Date(),
  });

  return {
    success: true,
    leadId,
    previousStatus: fromStatus,
    currentStatus: toStatus,
  };
}

export interface CampaignLeadTransitionParams {
  campaignLeadId: number;
  toState: string;
  reason?: string | null;
  actor?: string;
  metadata?: Record<string, unknown> | null;
}

/**
 * INVARIANT 3 & FAZA 2: Transition state of campaign_lead based on campaign playbook definition.
 */
export async function transitionCampaignLead({
  campaignLeadId,
  toState,
  reason = null,
  actor = "system",
  metadata = null,
}: CampaignLeadTransitionParams): Promise<{
  success: boolean;
  campaignLeadId: number;
  fromState: string;
  toState: string;
}> {
  const [record] = await db
    .select({
      id: campaignLeads.id,
      tenantId: campaignLeads.tenantId,
      campaignId: campaignLeads.campaignId,
      leadId: campaignLeads.leadId,
      fromState: campaignLeads.state,
      definition: playbookVersions.definition,
    })
    .from(campaignLeads)
    .innerJoin(campaigns, eq(campaignLeads.campaignId, campaigns.id))
    .innerJoin(playbookVersions, eq(campaigns.playbookVersionId, playbookVersions.id))
    .where(eq(campaignLeads.id, campaignLeadId));

  if (!record) {
    throw new Error(`CampaignLead #${campaignLeadId} nie został odnaleziony.`);
  }

  const { fromState, definition } = record;
  if (fromState === toState) {
    return { success: true, campaignLeadId, fromState, toState };
  }

  // Validate allowed transition against playbook definition
  const pbDef = definition as {
    states?: string[];
    transitions?: Array<{ from: string; to: string }>;
  };

  const allowedTransitions = pbDef.transitions || [];
  const isAllowed = allowedTransitions.some((t) => t.from === fromState && t.to === toState);

  // Core terminal states are always allowable destinations
  const isTerminalCore = ["blocked", "unsubscribed", "bounced"].includes(toState);

  if (!isAllowed && !isTerminalCore) {
    throw new IllegalStateTransitionError(
      record.leadId,
      fromState as LeadStatus,
      toState as LeadStatus,
      `Niedozwolone przejście z '${fromState}' do '${toState}' w playbooku kampanii.`
    );
  }

  // Update campaign_lead
  await db
    .update(campaignLeads)
    .set({ state: toState, updatedAt: new Date() })
    .where(eq(campaignLeads.id, campaignLeadId));

  // Sync to leads table
  await db
    .update(leads)
    .set({ status: toState, updatedAt: new Date() })
    .where(eq(leads.id, record.leadId));

  // Immutable audit log
  await db.insert(leadEvents).values({
    tenantId: record.tenantId,
    leadId: record.leadId,
    fromStatus: fromState,
    toStatus: toState,
    reason,
    actor,
    metadata: {
      ...metadata,
      campaignId: record.campaignId,
      campaignLeadId,
    },
    createdAt: new Date(),
  });

  return { success: true, campaignLeadId, fromState, toState };
}

