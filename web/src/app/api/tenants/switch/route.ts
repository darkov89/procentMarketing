import { NextResponse } from "next/server";
import { db, tenants, tenantMembers } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { requireUser, TENANT_COOKIE_NAME } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = await req.json();

    const targetTenantId = parseInt(body.tenantId, 10);
    if (!targetTenantId || isNaN(targetTenantId)) {
      return NextResponse.json(
        { success: false, error: "Nieprawidłowe ID tenanta" },
        { status: 400 }
      );
    }

    // Verify tenant exists
    const targetTenant = await db.query.tenants.findFirst({
      where: eq(tenants.id, targetTenantId),
    });

    if (!targetTenant) {
      return NextResponse.json(
        { success: false, error: "Tenant nie istnieje" },
        { status: 404 }
      );
    }

    // Authorization: Super Admin can switch to any tenant; members can switch to their own
    if (user.role !== "admin" && user.role !== "superadmin") {
      const membership = await db.query.tenantMembers.findFirst({
        where: and(
          eq(tenantMembers.tenantId, targetTenantId),
          eq(tenantMembers.userId, user.id)
        ),
      });

      if (!membership) {
        return NextResponse.json(
          { success: false, error: "Brak uprawnień do tego tenanta" },
          { status: 403 }
        );
      }
    }

    const res = NextResponse.json({
      success: true,
      message: `Przełączono na tenanta: ${targetTenant.name}`,
      activeTenant: {
        id: targetTenant.id,
        slug: targetTenant.slug,
        name: targetTenant.name,
        enabledModules: targetTenant.enabledModules,
      },
    });

    // Set cookie for 30 days
    res.cookies.set({
      name: TENANT_COOKIE_NAME,
      value: String(targetTenantId),
      path: "/",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 30 * 24 * 60 * 60,
    });

    return res;
  } catch (err: any) {
    if (err?.name === "AuthenticationError") {
      return NextResponse.json({ success: false, error: err.message }, { status: 401 });
    }
    console.error("Error switching tenant:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
