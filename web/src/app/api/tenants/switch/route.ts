import { NextResponse } from "next/server";
import { db, tenants, tenantMembers, events } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { requireUser, ACTIVE_TENANT_COOKIE_NAME } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const user = await requireUser(req);
    const body = await req.json().catch(() => ({}));
    const targetTenantId = Number(body.tenantId);

    if (!targetTenantId || !Number.isInteger(targetTenantId) || targetTenantId <= 0) {
      return NextResponse.json(
        { success: false, error: "Nieprawidłowe ID organizacji." },
        { status: 400 }
      );
    }

    // 1. Verify that tenant exists and is active
    const [targetTenant] = await db
      .select()
      .from(tenants)
      .where(and(eq(tenants.id, targetTenantId), eq(tenants.isActive, true)))
      .limit(1);

    if (!targetTenant) {
      return NextResponse.json(
        { success: false, error: "Wybrana organizacja nie istnieje lub jest nieaktywna." },
        { status: 404 }
      );
    }

    // 2. Strict authorization check (Zero Trust)
    const isSuperAdmin = user.isSuperAdmin || user.role === "admin";
    let effectiveRole = "superadmin";

    const [membership] = await db
      .select()
      .from(tenantMembers)
      .where(
        and(
          eq(tenantMembers.tenantId, targetTenantId),
          eq(tenantMembers.userId, user.id)
        )
      )
      .limit(1);

    if (!isSuperAdmin) {
      if (!membership) {
        return NextResponse.json(
          { success: false, error: "Brak dostępu do wybranej organizacji." },
          { status: 403 }
        );
      }
      effectiveRole = membership.role;
    } else {
      if (membership) {
        effectiveRole = membership.role;
      }
    }

    // 3. Security Audit Event (EU AI Act Art. 14 & RODO traceability)
    try {
      await db.insert(events).values({
        tenantId: targetTenantId,
        eventType: "tenant_switched",
        payload: {
          userId: user.id,
          userEmail: user.email,
          userName: user.name,
          fromTenantId: user.tenantId ?? null,
          toTenantId: targetTenantId,
          toTenantName: targetTenant.name,
          toTenantSlug: targetTenant.slug,
          effectiveRole,
          isSuperAdmin,
          switchedAt: new Date().toISOString(),
        },
      });
    } catch (auditErr) {
      console.error("Failed to record tenant switch audit event:", auditErr);
      // Non-fatal, but logged
    }

    // 4. Return response with HttpOnly, SameSite=Lax cookie
    const response = NextResponse.json({
      success: true,
      message: `Przełączono kontekst na: ${targetTenant.name}`,
      activeTenantId: targetTenantId,
      tenant: {
        id: targetTenant.id,
        name: targetTenant.name,
        slug: targetTenant.slug,
        role: effectiveRole,
      },
    });

    response.cookies.set({
      name: ACTIVE_TENANT_COOKIE_NAME,
      value: String(targetTenantId),
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 30 * 24 * 60 * 60, // 30 days
    });

    return response;
  } catch (err: any) {
    if (err?.name === "AuthenticationError") {
      return NextResponse.json({ success: false, error: err.message }, { status: 401 });
    }
    console.error("Tenant switch error:", err);
    return NextResponse.json(
      { success: false, error: "Wystąpił błąd podczas przełączania organizacji." },
      { status: 500 }
    );
  }
}
