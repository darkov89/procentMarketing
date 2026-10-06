import {
  db,
  campaigns,
  campaignLeads,
  playbookVersions,
  sequenceRuns,
  tasks,
  channelPermissions,
  messages,
} from "@/lib/db";
import { eq, and, lte } from "drizzle-orm";
import { PlaybookDefinition } from "./playbook.schema";
import { addPolishBusinessDays } from "@/lib/polish-calendar";

export interface AdvanceSequenceResult {
  processed: number;
  emailsQueued: number;
  tasksCreated: number;
  errors: string[];
}

/**
 * Executes a single step of a campaign lead's sequence run.
 */
export async function advanceLeadSequence(sequenceRunId: number): Promise<{
  success: boolean;
  actionTaken?: "email_queued" | "task_created" | "waiting" | "sequence_completed";
  error?: string;
}> {
  const [run] = await db
    .select({
      id: sequenceRuns.id,
      tenantId: sequenceRuns.tenantId,
      campaignLeadId: sequenceRuns.campaignLeadId,
      stepIndex: sequenceRuns.stepIndex,
      status: sequenceRuns.status,
      nextRunAt: sequenceRuns.nextRunAt,
      campaignId: campaignLeads.campaignId,
      leadId: campaignLeads.leadId,
      currentState: campaignLeads.state,
      definition: playbookVersions.definition,
      chosenContactId: campaignLeads.chosenContactId,
    })
    .from(sequenceRuns)
    .innerJoin(campaignLeads, eq(sequenceRuns.campaignLeadId, campaignLeads.id))
    .innerJoin(campaigns, eq(campaignLeads.campaignId, campaigns.id))
    .innerJoin(playbookVersions, eq(campaigns.playbookVersionId, playbookVersions.id))
    .where(and(eq(sequenceRuns.id, sequenceRunId), eq(sequenceRuns.status, "active")))
    .limit(1);

  if (!run) {
    return { success: false, error: "Aktywny przebieg sekwencji nie został znaleziony." };
  }

  const pbDef = run.definition as PlaybookDefinition;
  const sequenceSteps = pbDef.sequence || [];

  if (run.stepIndex >= sequenceSteps.length) {
    await db
      .update(sequenceRuns)
      .set({ status: "done", updatedAt: new Date() })
      .where(eq(sequenceRuns.id, run.id));
    return { success: true, actionTaken: "sequence_completed" };
  }

  const currentStep = sequenceSteps[run.stepIndex];

  if (currentStep.type === "send_email") {
    // Queue outbound message for sendMessage
    const idempotencyKey = `seq_${run.campaignId}_${run.leadId}_step_${run.stepIndex}`;

    await db.insert(messages).values({
      tenantId: run.tenantId,
      leadId: run.leadId,
      contactId: run.chosenContactId,
      direction: "outbound",
      channel: "email",
      status: "pending",
      idempotencyKey,
      sequenceStep: run.stepIndex,
      createdAt: new Date(),
    });

    // Advance stepIndex immediately or schedule next step
    const nextStepIndex = run.stepIndex + 1;
    if (nextStepIndex < sequenceSteps.length) {
      const nextStep = sequenceSteps[nextStepIndex];
      let nextRunAt = new Date();
      if (nextStep.type === "wait") {
        nextRunAt = addPolishBusinessDays(new Date(), nextStep.businessDays);
      }
      await db
        .update(sequenceRuns)
        .set({ stepIndex: nextStepIndex, nextRunAt, updatedAt: new Date() })
        .where(eq(sequenceRuns.id, run.id));
    } else {
      await db
        .update(sequenceRuns)
        .set({ status: "done", updatedAt: new Date() })
        .where(eq(sequenceRuns.id, run.id));
    }

    return { success: true, actionTaken: "email_queued" };
  }

  if (currentStep.type === "wait") {
    // Wait step reached; schedule next step after business days
    const nextRunAt = addPolishBusinessDays(new Date(), currentStep.businessDays);
    const nextStepIndex = run.stepIndex + 1;

    await db
      .update(sequenceRuns)
      .set({
        stepIndex: nextStepIndex,
        nextRunAt,
        updatedAt: new Date(),
      })
      .where(eq(sequenceRuns.id, run.id));

    return { success: true, actionTaken: "waiting" };
  }

  if (currentStep.type === "create_task") {
    // Check required permission if specified
    if (currentStep.requires?.channel === "phone") {
      const [perm] = await db
        .select({ status: channelPermissions.status })
        .from(channelPermissions)
        .where(
          and(
            eq(channelPermissions.campaignLeadId, run.campaignLeadId),
            eq(channelPermissions.channel, "phone")
          )
        )
        .limit(1);

      if (perm?.status !== "yes") {
        // If phone permission is not confirmed, create a verify_channel task instead of phone call
        await db.insert(tasks).values({
          tenantId: run.tenantId,
          campaignLeadId: run.campaignLeadId,
          type: "verify_channel",
          dueAt: new Date(),
          status: "open",
          blockedReason: "Brak potwierdzonej zgody na kontakt telefoniczny (status != yes).",
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        // Advance to next step
        await db
          .update(sequenceRuns)
          .set({ stepIndex: run.stepIndex + 1, updatedAt: new Date() })
          .where(eq(sequenceRuns.id, run.id));

        return { success: true, actionTaken: "task_created" };
      }
    }

    // Create phone call task
    await db.insert(tasks).values({
      tenantId: run.tenantId,
      campaignLeadId: run.campaignLeadId,
      type: currentStep.taskType,
      dueAt: new Date(),
      status: "open",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Advance step
    await db
      .update(sequenceRuns)
      .set({ stepIndex: run.stepIndex + 1, updatedAt: new Date() })
      .where(eq(sequenceRuns.id, run.id));

    return { success: true, actionTaken: "task_created" };
  }

  return { success: false, error: "Nieobsługiwany typ kroku sekwencji." };
}

/**
 * Processes all sequence runs that are due for advancement across tenants.
 */
export async function advanceAllDueSequences(): Promise<AdvanceSequenceResult> {
  const dueRuns = await db
    .select({ id: sequenceRuns.id })
    .from(sequenceRuns)
    .where(
      and(
        eq(sequenceRuns.status, "active"),
        lte(sequenceRuns.nextRunAt, new Date())
      )
    );

  let processed = 0;
  let emailsQueued = 0;
  let tasksCreated = 0;
  const errors: string[] = [];

  for (const r of dueRuns) {
    try {
      const res = await advanceLeadSequence(r.id);
      if (res.success) {
        processed++;
        if (res.actionTaken === "email_queued") emailsQueued++;
        if (res.actionTaken === "task_created") tasksCreated++;
      } else if (res.error) {
        errors.push(`Run #${r.id}: ${res.error}`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`Run #${r.id}: ${msg}`);
    }
  }

  return { processed, emailsQueued, tasksCreated, errors };
}
