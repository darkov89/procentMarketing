import { NextResponse } from "next/server";
import { db, tenants, tenantMembers } from "@/lib/db";
import { eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import slugify from "slugify";

export async function GET() {
  try {
    const user = await requireUser();

    // Query all tenants the user belongs to
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
      .where(eq(tenantMembers.userId, user.id));

    return NextResponse.json({
      success: true,
      activeTenantId: user.tenantId ?? null,
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
