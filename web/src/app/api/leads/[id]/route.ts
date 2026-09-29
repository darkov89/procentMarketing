import { NextResponse } from "next/server";
import { db, leads } from "@/lib/db";
import { eq } from "drizzle-orm";
import { validateGeo } from "@/lib/geo";
import { normalizePhone, normalizeNip } from "@/lib/dedup";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const leadId = parseInt(id, 10);
    const body = await req.json();

    if (isNaN(leadId)) {
      return NextResponse.json({ success: false, error: "Nieprawidłowe ID" }, { status: 400 });
    }

    // Check geo if city/address is being updated
    if (body.city || body.address) {
      const geo = validateGeo({ city: body.city, address: body.address });
      if (!geo.isAllowed) {
        return NextResponse.json({ success: false, error: geo.rejectionReason }, { status: 400 });
      }
      if (geo.distanceKm != null) {
        body.distanceKm = geo.distanceKm;
      }
    }

    if (body.phoneNormalized) {
      body.phoneNormalized = normalizePhone(body.phoneNormalized);
    }
    if (body.nip) {
      body.nip = normalizeNip(body.nip);
    }

    body.updatedAt = new Date();

    const [updatedLead] = await db
      .update(leads)
      .set(body)
      .where(eq(leads.id, leadId))
      .returning();

    return NextResponse.json({ success: true, lead: updatedLead });
  } catch (err: any) {
    console.error("Error updating lead:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const leadId = parseInt(id, 10);

    if (isNaN(leadId)) {
      return NextResponse.json({ success: false, error: "Nieprawidłowe ID" }, { status: 400 });
    }

    await db.delete(leads).where(eq(leads.id, leadId));
    return NextResponse.json({ success: true, message: `Lead #${leadId} usunięty` });
  } catch (err: any) {
    console.error("Error deleting lead:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
