import { NextResponse } from "next/server";
import { db, leadTasks, leads, users } from "@/lib/db";
import { eq, and, asc, desc } from "drizzle-orm";
import { requireUser } from "@/lib/auth";

export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const tenantId = user.tenantId || 1;
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") || "pending";

    const conditions = [eq(leadTasks.tenantId, tenantId)];
    if (status !== "all") {
      conditions.push(eq(leadTasks.status, status));
    }

    const tasks = await db.query.leadTasks.findMany({
      where: and(...conditions),
      orderBy: [asc(leadTasks.dueAt), desc(leadTasks.id)],
      with: {
        lead: true,
        assignedUser: true,
      },
    });

    return NextResponse.json({
      success: true,
      tasks: tasks.map((t) => ({
        id: t.id,
        leadId: t.leadId,
        companyName: t.lead?.companyName,
        phone: t.lead?.phoneNormalized,
        email: t.lead?.emailPrimary,
        city: t.lead?.city,
        dueAt: t.dueAt,
        status: t.status,
        taskType: t.taskType,
        title: t.title,
        outcome: t.outcome,
        notes: t.notes,
        pkePhoneStatus: t.lead?.pkePhoneStatus,
        assignedUserName: t.assignedUser?.name || "Dawid",
        createdAt: t.createdAt,
      })),
    });
  } catch (err: any) {
    if (err?.name === "AuthenticationError") {
      return NextResponse.json({ success: false, error: err.message }, { status: 401 });
    }
    console.error("Tasks GET error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const user = await requireUser();
    const tenantId = user.tenantId || 1;
    const body = await req.json();

    const taskId = parseInt(body.taskId || body.id, 10);
    if (!taskId || isNaN(taskId)) {
      return NextResponse.json({ success: false, error: "Wymagane ID zadania" }, { status: 400 });
    }

    const task = await db.query.leadTasks.findFirst({
      where: and(eq(leadTasks.id, taskId), eq(leadTasks.tenantId, tenantId)),
    });

    if (!task) {
      return NextResponse.json({ success: false, error: "Zadanie nie zostało znalezione" }, { status: 404 });
    }

    const updateData: Partial<typeof leadTasks.$inferInsert> = {};

    if (body.status) updateData.status = body.status;
    if (body.outcome) updateData.outcome = body.outcome;
    if (body.notes !== undefined) updateData.notes = body.notes;

    if (body.status === "completed" || body.outcome) {
      updateData.status = "completed";
      updateData.completedAt = new Date();
    }

    const [updated] = await db
      .update(leadTasks)
      .set(updateData)
      .where(and(eq(leadTasks.id, taskId), eq(leadTasks.tenantId, tenantId)))
      .returning();

    return NextResponse.json({
      success: true,
      message: `Zadanie '${updated.title}' zostało zaktualizowane.`,
      task: updated,
    });
  } catch (err: any) {
    if (err?.name === "AuthenticationError") {
      return NextResponse.json({ success: false, error: err.message }, { status: 401 });
    }
    console.error("Tasks PATCH error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
