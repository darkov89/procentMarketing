import { NextResponse } from "next/server";
import { db, tenants, tenantMembers, DEFAULT_TENANT_MODULES, TenantModulesConfig } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import slugify from "slugify";

export async function GET() {
  try {
    const user = await requireUser();

    // If Super Admin / Admin, return all tenants in the system
    if (user.role === "admin" || user.role === "superadmin") {
      const allTenants = await db.query.tenants.findMany({
        orderBy: (tenants, { asc }) => [asc(tenants.id)],
      });

      return NextResponse.json({
        success: true,
        activeTenantId: user.tenantId || 1,
        isSuperAdmin: true,
        tenants: allTenants.map((t) => ({
          id: t.id,
          slug: t.slug,
          name: t.name,
          plan: t.plan,
          isActive: t.isActive,
          enabledModules: (t.enabledModules as TenantModulesConfig) || DEFAULT_TENANT_MODULES,
          role: "superadmin",
          createdAt: t.createdAt,
        })),
      });
    }

    // Query all tenants the user belongs to
    const memberships = await db
      .select({
        id: tenants.id,
        slug: tenants.slug,
        name: tenants.name,
        plan: tenants.plan,
        isActive: tenants.isActive,
        enabledModules: tenants.enabledModules,
        role: tenantMembers.role,
        createdAt: tenants.createdAt,
      })
      .from(tenantMembers)
      .innerJoin(tenants, eq(tenantMembers.tenantId, tenants.id))
      .where(eq(tenantMembers.userId, user.id));

    return NextResponse.json({
      success: true,
      activeTenantId: user.tenantId || 1,
      isSuperAdmin: false,
      tenants: memberships,
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

    // Custom or generated slug
    let slug = body.slug?.trim();
    if (slug) {
      slug = slugify(slug, { lower: true, strict: true });
    } else {
      const baseSlug = slugify(name, { lower: true, strict: true }).slice(0, 40) || "workspace";
      slug = `${baseSlug}-${Math.random().toString(36).substring(2, 6)}`;
    }

    // Check slug uniqueness
    const existing = await db.query.tenants.findFirst({
      where: eq(tenants.slug, slug),
    });
    if (existing) {
      return NextResponse.json(
        { success: false, error: `Slug '${slug}' jest już zajęty.` },
        { status: 400 }
      );
    }

    const enabledModules: TenantModulesConfig = {
      ...DEFAULT_TENANT_MODULES,
      ...(body.enabledModules || {}),
    };

    // Create new tenant
    const [newTenant] = await db
      .insert(tenants)
      .values({
        slug,
        name,
        plan: body.plan || "pro",
        isActive: true,
        enabledModules,
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

export async function PUT(req: Request) {
  try {
    const user = await requireUser();
    const body = await req.json();

    const tenantId = parseInt(body.id || body.tenantId, 10);
    if (!tenantId || isNaN(tenantId)) {
      return NextResponse.json(
        { success: false, error: "Wymagane ID tenanta do aktualizacji" },
        { status: 400 }
      );
    }

    // Authorization: only admin/superadmin or owner of the tenant can edit
    if (user.role !== "admin" && user.role !== "superadmin") {
      const membership = await db.query.tenantMembers.findFirst({
        where: and(
          eq(tenantMembers.tenantId, tenantId),
          eq(tenantMembers.userId, user.id),
          eq(tenantMembers.role, "owner")
        ),
      });

      if (!membership) {
        return NextResponse.json(
          { success: false, error: "Brak uprawnień do edycji tego tenanta" },
          { status: 403 }
        );
      }
    }

    const targetTenant = await db.query.tenants.findFirst({
      where: eq(tenants.id, tenantId),
    });

    if (!targetTenant) {
      return NextResponse.json(
        { success: false, error: "Tenant nie istnieje" },
        { status: 404 }
      );
    }

    const updateData: Partial<typeof tenants.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (body.name?.trim()) updateData.name = body.name.trim();
    if (body.plan) updateData.plan = body.plan;
    if (typeof body.isActive === "boolean") updateData.isActive = body.isActive;

    if (body.enabledModules) {
      const current = (targetTenant.enabledModules as TenantModulesConfig) || DEFAULT_TENANT_MODULES;
      updateData.enabledModules = {
        ...current,
        ...body.enabledModules,
      };
    }

    const [updated] = await db
      .update(tenants)
      .set(updateData)
      .where(eq(tenants.id, tenantId))
      .returning();

    return NextResponse.json({
      success: true,
      message: `Tenant '${updated.name}' zaktualizowany!`,
      tenant: updated,
    });
  } catch (err: any) {
    if (err?.name === "AuthenticationError") {
      return NextResponse.json({ success: false, error: err.message }, { status: 401 });
    }
    console.error("Tenants PUT error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
