import { NextResponse } from "next/server";
import {
  db,
  tenants,
  tenantMembers,
  playbooks,
  playbookVersions,
  campaigns,
  tenantProfiles,
  events,
} from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { requireUser, ACTIVE_TENANT_COOKIE_NAME } from "@/lib/auth";
import {
  AGENCY_SALES_PRESET,
  SPONSORSHIP_FUNDRAISING_PRESET,
} from "@/modules/campaigns/playbook.schema";
import { TenantModulesConfig } from "@/lib/db/schema";
import slugify from "slugify";

export async function GET(req?: Request) {
  try {
    const user = await requireUser(req);

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
    const user = await requireUser(req);
    const body = await req.json().catch(() => ({}));

    const name = body.name?.trim();
    if (!name) {
      return NextResponse.json(
        { success: false, error: "Nazwa tenanta/organizacji jest wymagana" },
        { status: 400 }
      );
    }

    const presetKey =
      body.presetKey === "sponsorship_fundraising"
        ? "sponsorship_fundraising"
        : "agency_sales";

    const plan =
      body.plan || (presetKey === "sponsorship_fundraising" ? "ngo" : "pro");

    // Modules configuration based on organization type
    const enabledModules: TenantModulesConfig =
      presetKey === "sponsorship_fundraising"
        ? {
            sourcingPlaces: true,
            sourcingCsv: true,
            compliancePke: true,
            outreachMode: "plain",
            callTasksQueue: true,
            dealFinanceTracking: true,
            excludedIndustries: ["alkohol", "hazard", "tytoń", "dorosli"],
            maxDailySends: 5,
          }
        : {
            sourcingPlaces: true,
            sourcingCsv: true,
            compliancePke: false,
            outreachMode: "offer_page",
            callTasksQueue: false,
            dealFinanceTracking: false,
            excludedIndustries: [],
            maxDailySends: 15,
          };

    const baseSlug = slugify(name, { lower: true, strict: true }).slice(0, 35) || "workspace";
    let slug = baseSlug;

    // Check if slug already exists; if so, append random suffix
    const existing = await db
      .select({ id: tenants.id })
      .from(tenants)
      .where(eq(tenants.slug, slug))
      .limit(1);

    if (existing.length > 0) {
      slug = `${baseSlug}-${Math.random().toString(36).substring(2, 6)}`;
    }

    // 1. Create new tenant
    const [newTenant] = await db
      .insert(tenants)
      .values({
        slug,
        name,
        plan,
        isActive: true,
        enabledModules,
      })
      .returning();

    // 2. Add creator as owner of the new tenant
    await db.insert(tenantMembers).values({
      tenantId: newTenant.id,
      userId: user.id,
      role: "owner",
      capabilities:
        presetKey === "sponsorship_fundraising"
          ? ["approve_batch", "verify_channel", "campaign_owner", "confirm_payment", "manage_playbook"]
          : ["*"],
    });

    // 3. Initialize playbook & version from preset
    const playbookDef =
      presetKey === "sponsorship_fundraising"
        ? SPONSORSHIP_FUNDRAISING_PRESET
        : AGENCY_SALES_PRESET;

    const playbookName =
      presetKey === "sponsorship_fundraising"
        ? "Pozyskiwanie Darczyńców B2B"
        : "Sprzedaż Usług Marketingowych";

    const [playbook] = await db
      .insert(playbooks)
      .values({
        tenantId: newTenant.id,
        name: playbookName,
        presetKey,
      })
      .returning();

    const [playbookVersion] = await db
      .insert(playbookVersions)
      .values({
        playbookId: playbook.id,
        version: 1,
        definition: playbookDef,
      })
      .returning();

    // 4. Initialize initial active campaign
    await db.insert(campaigns).values({
      tenantId: newTenant.id,
      playbookVersionId: playbookVersion.id,
      name:
        presetKey === "sponsorship_fundraising"
          ? "Kampania Główna - Darczyńcy"
          : "Kampania Główna - Sprzedaż",
      status: "active",
      ownerUserId: user.id,
      testMode: true,
    });

    // 5. Initialize tenant profile
    try {
      await db
        .insert(tenantProfiles)
        .values({
          tenantId: newTenant.id,
          companyDescription:
            body.companyDescription?.trim() || `Profil organizacji ${newTenant.name}`,
          coreServices:
            presetKey === "sponsorship_fundraising"
              ? ["Wsparcie Podopiecznych", "Działania Edukacyjne", "Projekty Społeczne"]
              : ["Pozyskiwanie Klientów B2B", "Audyt WWW", "Personalizowane Oferty"],
          uniqueSellingPoints:
            presetKey === "sponsorship_fundraising"
              ? ["Transparentność finansowa", "Realny wpływ na lokalną społeczność"]
              : ["Sprawdzone rezultaty", "Dedykowana strategia", "Bezpieczeństwo RODO"],
        })
        .onConflictDoNothing();
    } catch (profileErr) {
      console.warn("Non-fatal: could not create tenantProfile:", profileErr);
    }

    // 6. Security Audit Event (RODO / EU AI Act Art. 14 traceability)
    try {
      await db.insert(events).values({
        tenantId: newTenant.id,
        eventType: "tenant_created",
        payload: {
          tenantId: newTenant.id,
          tenantName: newTenant.name,
          tenantSlug: newTenant.slug,
          presetKey,
          createdById: user.id,
          createdByEmail: user.email,
          createdAt: new Date().toISOString(),
        },
      });
    } catch (auditErr) {
      console.warn("Failed to record tenant_created event:", auditErr);
    }

    // 7. Return response and set cookie to automatically switch user into the new tenant
    const response = NextResponse.json({
      success: true,
      message: `Organizacja '${newTenant.name}' została pomyślnie utworzona!`,
      tenant: {
        ...newTenant,
        role: "owner",
        isDirectMember: true,
      },
    });

    response.cookies.set({
      name: ACTIVE_TENANT_COOKIE_NAME,
      value: String(newTenant.id),
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
    console.error("Tenants POST error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
