import { db, leads, leadTasks, tenants, leadEvents, TenantModulesConfig } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { addPolishBusinessDays } from "@/lib/polish-calendar";

export interface CreateTaskResult {
  created: boolean;
  taskId?: number;
  dueAt?: Date;
  reason?: string;
}

/**
 * Schedules a phone call task for Dawid / SDR after an email is sent.
 * Strictly respects:
 * 1. Tenant module flag: callTasksQueue
 * 2. PKE Compliance (Art. 398 PKE): phone must be explicitly 'allowed'
 * 3. Polish statutory calendar: exactly +2 business days (skipping weekends & public holidays)
 */
export async function scheduleCallTaskAfterEmail(params: {
  tenantId: number;
  leadId: number;
  sentAt?: Date;
  assignedUserId?: number | null;
}): Promise<CreateTaskResult> {
  const { tenantId, leadId, sentAt = new Date(), assignedUserId } = params;

  // 1. Check Tenant configuration
  const tenant = await db.query.tenants.findFirst({
    where: eq(tenants.id, tenantId),
  });

  if (!tenant) {
    return { created: false, reason: "Tenant nie istnieje." };
  }

  const modules = (tenant.enabledModules as TenantModulesConfig) || {};
  if (!modules.callTasksQueue) {
    return { created: false, reason: "Moduł kolejki zadań telefonicznych jest wyłączony dla tego tenanta." };
  }

  // 2. Check Lead & PKE Compliance
  const lead = await db.query.leads.findFirst({
    where: and(eq(leads.id, leadId), eq(leads.tenantId, tenantId)),
  });

  if (!lead) {
    return { created: false, reason: "Lead nie istnieje w kontekście tenanta." };
  }

  // STRICT COMPLIANCE GATE (Art. 398 PKE):
  // Sending an email DOES NOT give permission for phone contact.
  if (modules.compliancePke && lead.pkePhoneStatus !== "allowed") {
    await db.insert(leadEvents).values({
      tenantId,
      leadId,
      fromStatus: lead.status,
      toStatus: lead.status,
      reason: "Pominięto automatyczne zadanie telefonu: brak dopuszczenia kontaktu telefonicznego (art. 398 PKE).",
      actor: "system:compliance_pke_gate",
      metadata: { pkePhoneStatus: lead.pkePhoneStatus },
    });

    return {
      created: false,
      reason: `Zablokowano: brak zgody telefonicznej (PKE status: '${lead.pkePhoneStatus || "needs_review"}').`,
    };
  }

  // 3. Compute Due Date: +2 Polish business days (skipping weekends and statutory holidays)
  const dueAt = addPolishBusinessDays(sentAt, 2);
  dueAt.setHours(10, 0, 0, 0); // Scheduled for 10:00 AM

  // 4. Create Task in Database
  const [createdTask] = await db
    .insert(leadTasks)
    .values({
      tenantId,
      leadId,
      assignedUserId: assignedUserId || null,
      taskType: "call",
      title: `Rozmowa telefoniczna: ${lead.companyName}`,
      dueAt,
      status: "pending",
      notes: `Pierwszy mail wysłany: ${sentAt.toLocaleDateString("pl-PL")}. Telefon zaplanowany po 2 dniach roboczych.`,
    })
    .returning();

  // 5. Audit Log
  await db.insert(leadEvents).values({
    tenantId,
    leadId,
    fromStatus: lead.status,
    toStatus: lead.status,
    reason: `Zaplanowano zadanie telefoniczne na ${dueAt.toLocaleDateString("pl-PL")} (+2 dni robocze).`,
    actor: "system:task_scheduler",
    metadata: { taskId: createdTask.id, dueAt: dueAt.toISOString() },
  });

  return {
    created: true,
    taskId: createdTask.id,
    dueAt,
  };
}

/**
 * Cancels pending tasks for a lead (e.g. on email bounce, opt-out, refusal)
 */
export async function cancelPendingTasksForLead(params: {
  tenantId: number;
  leadId: number;
  reason: string;
}): Promise<number> {
  const { tenantId, leadId, reason } = params;

  const result = await db
    .update(leadTasks)
    .set({
      status: "cancelled",
      outcome: "odmowa_lub_blad",
      notes: `Zadanie anulowane: ${reason}`,
      completedAt: new Date(),
    })
    .where(
      and(
        eq(leadTasks.tenantId, tenantId),
        eq(leadTasks.leadId, leadId),
        eq(leadTasks.status, "pending")
      )
    );

  return 1;
}
