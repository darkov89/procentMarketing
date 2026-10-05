import { NextResponse } from "next/server";
import { db, leads } from "@/lib/db";
import { eq } from "drizzle-orm";
import { validateGeo } from "@/lib/geo";
import { normalizePhone, normalizeNip } from "@/lib/dedup";
import { requireUser } from "@/lib/auth";
import { transitionLead, LeadStatus } from "@/lib/state-machine";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireUser();
    const { id } = await params;
    const leadId = parseInt(id, 10);

    if (isNaN(leadId)) {
      return NextResponse.json({ success: false, error: "Nieprawidłowe ID" }, { status: 400 });
    }

    const lead = await db.query.leads.findFirst({
      where: eq(leads.id, leadId),
      with: {
        audit: true,
        offer: true,
        contacts: true,
        messages: true,
        leadEvents: true,
      },
    });

    if (!lead) {
      return NextResponse.json({ success: false, error: "Lead nie istnieje" }, { status: 404 });
    }

    return NextResponse.json({ success: true, lead });
  } catch (err: any) {
    if (err?.name === "AuthenticationError") {
      return NextResponse.json({ success: false, error: err.message }, { status: 401 });
    }
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const leadId = parseInt(id, 10);
    const body = await req.json();

    if (isNaN(leadId)) {
      return NextResponse.json({ success: false, error: "Nieprawidłowe ID" }, { status: 400 });
    }

    // Update coordinates and distance if city/address is being updated
    if (body.city || body.address) {
      const geo = validateGeo({
        city: body.city,
        address: body.address,
        maxRadiusKm: 0, // Admin manual update - allow any Polish city
      });
      if (geo.distanceKm != null) {
        body.distanceKm = geo.distanceKm;
      }
      if (geo.latitude != null) body.latitude = geo.latitude;
      if (geo.longitude != null) body.longitude = geo.longitude;
    }

    if (body.phoneNormalized) {
      body.phoneNormalized = normalizePhone(body.phoneNormalized);
    }
    if (body.nip) {
      body.nip = normalizeNip(body.nip);
    }

    // INVARIANT 3: Status transitions must NEVER be direct DB updates.
    // They must go through transitionLead().
    const requestedStatus = body.status as LeadStatus | undefined;
    const statusReason = body.rejectionReason || body.reason || null;
    delete body.status; // Prevent raw status mutation

    if (requestedStatus) {
      await transitionLead({
        leadId,
        toStatus: requestedStatus,
        reason: statusReason,
        actor: `user:${user.id}`,
        forceAdminOverride: true, // Manual admin intervention in UI
      });
    }

    body.updatedAt = new Date();

    const [updatedLead] = await db
      .update(leads)
      .set(body)
      .where(eq(leads.id, leadId))
      .returning();

    return NextResponse.json({ success: true, lead: updatedLead });
  } catch (err: any) {
    if (err?.name === "AuthenticationError") {
      return NextResponse.json({ success: false, error: err.message }, { status: 401 });
    }
    console.error("Error updating lead:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireUser();
    const { id } = await params;
    const leadId = parseInt(id, 10);

    if (isNaN(leadId)) {
      return NextResponse.json({ success: false, error: "Nieprawidłowe ID" }, { status: 400 });
    }

    await db.delete(leads).where(eq(leads.id, leadId));
    return NextResponse.json({ success: true, message: `Lead #${leadId} usunięty` });
  } catch (err: any) {
    if (err?.name === "AuthenticationError") {
      return NextResponse.json({ success: false, error: err.message }, { status: 401 });
    }
    console.error("Error deleting lead:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
