import { NextResponse } from "next/server";
import { requireTenant, requireCapability } from "@/lib/auth";
import { db, leadDeals, leads } from "@/lib/db";
import { eq, and, desc } from "drizzle-orm";
import { z } from "zod";

const createDealSchema = z.object({
  leadId: z.number().int().positive(),
  dealName: z.string().min(1).max(255),
  status: z.enum(["identified", "proposed", "pledged", "paid", "cancelled"]).default("identified"),
  declaredAmount: z.number().int().nonnegative().optional(), // in grosze
  paidAmount: z.number().int().nonnegative().optional(), // in grosze
  currency: z.string().length(3).default("PLN"),
  expectedPaymentDate: z.string().optional(),
  notes: z.string().optional(),
});

const updateDealSchema = z.object({
  id: z.number().int().positive(),
  status: z.enum(["identified", "proposed", "pledged", "paid", "cancelled"]).optional(),
  declaredAmount: z.number().int().nonnegative().optional(),
  paidAmount: z.number().int().nonnegative().optional(),
  currency: z.string().length(3).optional(),
  expectedPaymentDate: z.string().optional(),
  notes: z.string().optional(),
});

/**
 * GET /api/deals?leadId=123
 * List deals for a specific lead or across the tenant
 */
export async function GET(req: Request) {
  try {
    const { tenantId } = await requireTenant();
    const url = new URL(req.url);
    const leadIdParam = url.searchParams.get("leadId");

    const whereClause = leadIdParam
      ? and(eq(leadDeals.tenantId, tenantId), eq(leadDeals.leadId, parseInt(leadIdParam, 10)))
      : eq(leadDeals.tenantId, tenantId);

    const deals = await db
      .select()
      .from(leadDeals)
      .where(whereClause)
      .orderBy(desc(leadDeals.createdAt));

    return NextResponse.json({
      success: true,
      deals: deals.map((d) => ({
        ...d,
        declaredAmount: d.declaredAmount ? Number(d.declaredAmount) : null,
        paidAmount: d.paidAmount ? Number(d.paidAmount) : null,
      })),
    });
  } catch (err: any) {
    if (err?.name === "AuthenticationError") {
      return NextResponse.json({ success: false, error: err.message }, { status: 401 });
    }
    if (err?.name === "AuthorizationError") {
      return NextResponse.json({ success: false, error: err.message }, { status: 403 });
    }
    return NextResponse.json({ success: false, error: err?.message || String(err) }, { status: 500 });
  }
}

/**
 * POST /api/deals
 * Create a new deal for a lead
 */
export async function POST(req: Request) {
  try {
    const { user, tenantId } = await requireTenant();
    const body = await req.json();
    const parsed = createDealSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Błędne dane transakcji", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { leadId, dealName, status, declaredAmount, paidAmount, currency, expectedPaymentDate, notes } =
      parsed.data;

    // Verify lead belongs to current tenant
    const [lead] = await db
      .select({ id: leads.id })
      .from(leads)
      .where(and(eq(leads.id, leadId), eq(leads.tenantId, tenantId)))
      .limit(1);

    if (!lead) {
      return NextResponse.json({ success: false, error: "Lead nie został odnaleziony" }, { status: 404 });
    }

    // If deal is created directly with paidAmount > 0 or status "paid", require confirm_payment capability
    if (paidAmount && paidAmount > 0) {
      const { user: authedUser } = await requireCapability("confirm_payment");
      const [newDeal] = await db
        .insert(leadDeals)
        .values({
          tenantId,
          leadId,
          status,
          declaredAmount: declaredAmount ?? 0,
          paidAmount: paidAmount,
          currency,
          expectedPaymentAt: expectedPaymentDate ? new Date(expectedPaymentDate) : null,
          confirmedByUserId: authedUser.id,
          paidConfirmedAt: new Date(),
          notes,
        })
        .returning();

      return NextResponse.json({
        success: true,
        deal: newDeal,
      });
    }

    const [newDeal] = await db
      .insert(leadDeals)
      .values({
        tenantId,
        leadId,
        status,
        declaredAmount: declaredAmount ?? 0,
        paidAmount: 0,
        currency,
        expectedPaymentAt: expectedPaymentDate ? new Date(expectedPaymentDate) : null,
        notes,
      })
      .returning();

    return NextResponse.json({
      success: true,
      deal: newDeal,
    });
  } catch (err: any) {
    if (err?.name === "AuthenticationError") {
      return NextResponse.json({ success: false, error: err.message }, { status: 401 });
    }
    if (err?.name === "AuthorizationError") {
      return NextResponse.json({ success: false, error: err.message }, { status: 403 });
    }
    return NextResponse.json({ success: false, error: err?.message || String(err) }, { status: 500 });
  }
}

/**
 * PATCH /api/deals
 * Update deal status or confirm payment
 */
export async function PATCH(req: Request) {
  try {
    const { user, tenantId } = await requireTenant();
    const body = await req.json();
    const parsed = updateDealSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Błędne dane aktualizacji", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { id, status, declaredAmount, paidAmount, currency, expectedPaymentDate, notes } = parsed.data;

    const [existingDeal] = await db
      .select()
      .from(leadDeals)
      .where(and(eq(leadDeals.id, id), eq(leadDeals.tenantId, tenantId)))
      .limit(1);

    if (!existingDeal) {
      return NextResponse.json(
        { success: false, error: "Transakcja nie została znaleziona" },
        { status: 404 }
      );
    }

    const updates: Partial<typeof leadDeals.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (declaredAmount !== undefined) updates.declaredAmount = declaredAmount;
    if (currency !== undefined) updates.currency = currency;
    if (expectedPaymentDate !== undefined) {
      updates.expectedPaymentAt = expectedPaymentDate ? new Date(expectedPaymentDate) : null;
    }
    if (notes !== undefined) updates.notes = notes;

    // STEP 1.4a: Confirm payment requires granular capability 'confirm_payment'
    if (paidAmount !== undefined || status === "paid") {
      const { user: confirmedUser } = await requireCapability("confirm_payment");
      if (paidAmount !== undefined) updates.paidAmount = paidAmount;
      if (status !== undefined) updates.status = status;
      updates.confirmedByUserId = confirmedUser.id;
      updates.paidConfirmedAt = new Date();
    } else if (status !== undefined) {
      updates.status = status;
    }

    const [updated] = await db
      .update(leadDeals)
      .set(updates)
      .where(eq(leadDeals.id, id))
      .returning();

    return NextResponse.json({
      success: true,
      deal: updated,
    });
  } catch (err: any) {
    if (err?.name === "AuthenticationError") {
      return NextResponse.json({ success: false, error: err.message }, { status: 401 });
    }
    if (err?.name === "AuthorizationError") {
      return NextResponse.json({ success: false, error: err.message }, { status: 403 });
    }
    return NextResponse.json({ success: false, error: err?.message || String(err) }, { status: 500 });
  }
}
