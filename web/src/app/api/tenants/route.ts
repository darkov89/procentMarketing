import { NextResponse } from "next/server";
import { db, tenants, tenantMembers } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import slugify from "slugify";

export async function GET() {
  try {
    const user = await requireUser();

    if (user.isSuperAdmin || user.role === "admin") {
      // Super Admin: select all active tenants in system
      const allTenants = await db
        .select({
          id: tenants.id,
          slug: tenants.slug,
          name: tenants.name,
          plan: tenants.plan,
          isActive: tenants.isActive,
          createdAt: tenants.createdAt,
        })
        .from(tenants)
        .where(eq(tenants.isActive, true));

      // Fetch user's direct memberships to attach actual roles
      const userMemberships = await db
        .select({
          tenantId: tenantMembers.tenantId,
          role: tenantMembers.role,
        })
        .from(tenantMembers)
        .where(eq(tenantMembers.userId, user.id));

      const memberRoleMap = new Map(userMemberships.map((m) => [m.tenantId, m.role]));

      const mapped = allTenants.map((t) => ({
        ...t,
        role: memberRoleMap.get(t.id) || "superadmin",
        isDirectMember: memberRoleMap.has(t.id),
      }));

      return NextResponse.json({
        success: true,
        activeTenantId: user.tenantId ?? null,
        isSuperAdmin: true,
        tenants: mapped,
      });
    }

    // Regular user: Query only active tenants the user belongs to
    const memberships = await db
      .select({
        id: tenants.id,
        slug: tenants.slug,
        name: tenants.name,
        plan: tenants.plan,
        isActive: tenants.isActive,
        role: tenantMembers.role,
        createdAt: tenants.createdAt,
      })
      .from(tenantMembers)
      .innerJoin(tenants, eq(tenantMembers.tenantId, tenants.id))
      .where(and(eq(tenantMembers.userId, user.id), eq(tenants.isActive, true)));

    return NextResponse.json({
      success: true,
      activeTenantId: user.tenantId ?? null,
      isSuperAdmin: false,
      tenants: memberships.map((m) => ({ ...m, isDirectMember: true })),
    });
  } catch (err: any) {
    if (err?.name === "AuthenticationError") {
      return NextResponse.json({ success: false, error: err.message }, { status: 401 });
    }
    console.error("Tenants GET error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = await req.json();

    const name = body.name?.trim();
    if (!name) {
      return NextResponse.json(
        { success: false, error: "Nazwa tenanta/organizacji jest wymagana" },
        { status: 400 }
      );
    }

    const baseSlug = slugify(name, { lower: true, strict: true }).slice(0, 40) || "workspace";
    const slug = `${baseSlug}-${Math.random().toString(36).substring(2, 6)}`;

    // Create new tenant
    const [newTenant] = await db
      .insert(tenants)
      .values({
        slug,
        name,
        plan: body.plan || "pro",
        isActive: true,
      })
      .returning();

    // Add user as owner of the new tenant
    await db.insert(tenantMembers).values({
      tenantId: newTenant.id,
      userId: user.id,
      role: "owner",
    });

    return NextResponse.json({
      success: true,
      message: `Tenant '${newTenant.name}' został utworzony!`,
      tenant: newTenant,
    });
  } catch (err: any) {
    if (err?.name === "AuthenticationError") {
      return NextResponse.json({ success: false, error: err.message }, { status: 401 });
    }
    console.error("Tenants POST error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
