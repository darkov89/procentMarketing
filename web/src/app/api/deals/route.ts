import { NextResponse } from "next/server";
import { db, leadDeals, leads, users } from "@/lib/db";
import { eq, and, desc } from "drizzle-orm";
import { requireUser } from "@/lib/auth";

export async function GET() {
  try {
    const user = await requireUser();
    const tenantId = user.tenantId || 1;

    const deals = await db.query.leadDeals.findMany({
      where: eq(leadDeals.tenantId, tenantId),
      orderBy: [desc(leadDeals.createdAt)],
      with: {
        lead: true,
        confirmedByUser: true,
      },
    });

    return NextResponse.json({
      success: true,
      deals: deals.map((d) => ({
        id: d.id,
        leadId: d.leadId,
        companyName: d.lead?.companyName,
        declaredAmount: d.declaredAmount || 0,
        expectedPaymentAt: d.expectedPaymentAt,
        paidAmount: d.paidAmount || 0,
        paidConfirmedAt: d.paidConfirmedAt,
        status: d.status,
        confirmedByUserName: d.confirmedByUser?.name || null,
        notes: d.notes,
        createdAt: d.createdAt,
      })),
    });
  } catch (err: any) {
    if (err?.name === "AuthenticationError") {
      return NextResponse.json({ success: false, error: err.message }, { status: 401 });
    }
    console.error("Deals GET error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const tenantId = user.tenantId || 1;
    const body = await req.json();

    const leadId = parseInt(body.leadId, 10);
    if (!leadId || isNaN(leadId)) {
      return NextResponse.json({ success: false, error: "Wymagane ID leada" }, { status: 400 });
    }

    const declaredAmount = parseFloat(body.declaredAmount || "0");
    const expectedPaymentAt = body.expectedPaymentAt ? new Date(body.expectedPaymentAt) : null;
    const notes = body.notes || "";

    const [newDeal] = await db
      .insert(leadDeals)
      .values({
        tenantId,
        leadId,
        declaredAmount,
        expectedPaymentAt,
        paidAmount: 0,
        status: "declared",
        notes,
      })
      .returning();

    return NextResponse.json({
      success: true,
      message: `Zapisano deklarację wsparcia na kwotę ${declaredAmount} PLN.`,
      deal: newDeal,
    });
  } catch (err: any) {
    if (err?.name === "AuthenticationError") {
      return NextResponse.json({ success: false, error: err.message }, { status: 401 });
    }
    console.error("Deals POST error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const user = await requireUser();
    const tenantId = user.tenantId || 1;
    const body = await req.json();

    const dealId = parseInt(body.dealId || body.id, 10);
    if (!dealId || isNaN(dealId)) {
      return NextResponse.json({ success: false, error: "Wymagane ID rozliczenia" }, { status: 400 });
    }

    const deal = await db.query.leadDeals.findFirst({
      where: and(eq(leadDeals.id, dealId), eq(leadDeals.tenantId, tenantId)),
    });

    if (!deal) {
      return NextResponse.json({ success: false, error: "Rozliczenie nie zostało znalezione" }, { status: 404 });
    }

    const updateData: Partial<typeof leadDeals.$inferInsert> = {
      updatedAt: new Date(),
    };

    // Ania's payment confirmation
    if (body.action === "confirm_payment" || body.paidAmount !== undefined) {
      const paid = parseFloat(body.paidAmount !== undefined ? body.paidAmount : String(deal.declaredAmount || 0));
      updateData.paidAmount = paid;
      updateData.paidConfirmedAt = new Date();
      updateData.confirmedByUserId = user.id;
      updateData.status = "paid";
      if (body.notes) updateData.notes = body.notes;
    } else {
      if (body.status) updateData.status = body.status;
      if (body.declaredAmount !== undefined) updateData.declaredAmount = parseFloat(body.declaredAmount);
      if (body.expectedPaymentAt) updateData.expectedPaymentAt = new Date(body.expectedPaymentAt);
      if (body.notes) updateData.notes = body.notes;
    }

    const [updated] = await db
      .update(leadDeals)
      .set(updateData)
      .where(and(eq(leadDeals.id, dealId), eq(leadDeals.tenantId, tenantId)))
      .returning();

    return NextResponse.json({
      success: true,
      message: updateData.status === "paid" 
        ? `Wpłata ${updated.paidAmount} PLN została potwierdzona przez ${user.name}!`
        : `Zaktualizowano dane finansowe.`,
      deal: updated,
    });
  } catch (err: any) {
    if (err?.name === "AuthenticationError") {
      return NextResponse.json({ success: false, error: err.message }, { status: 401 });
    }
    console.error("Deals PATCH error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
