import { NextResponse } from "next/server";
import { db, invitations, users } from "@/lib/db";
import { desc, eq, and, gt } from "drizzle-orm";
import { getCurrentUser, generateInviteCode } from "@/lib/auth";

export async function GET(_req: Request) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || currentUser.role !== "admin") {
      return NextResponse.json(
        { success: false, error: "Brak uprawnień administratora" },
        { status: 403 }
      );
    }

    // Fetch invitations (ordered by creation date)
    const allInvites = await db
      .select({
        id: invitations.id,
        code: invitations.code,
        email: invitations.email,
        role: invitations.role,
        maxUses: invitations.maxUses,
        usedCount: invitations.usedCount,
        expiresAt: invitations.expiresAt,
        createdAt: invitations.createdAt,
      })
      .from(invitations)
      .orderBy(desc(invitations.createdAt));

    // Formatted invitations with clear status
    const formattedInvites = allInvites.map((inv) => {
      const isUsed = inv.usedCount >= inv.maxUses;
      const isExpired = inv.expiresAt ? new Date(inv.expiresAt) < new Date() : false;
      let status: "active" | "used" | "expired" = "active";
      if (isUsed) status = "used";
      else if (isExpired) status = "expired";

      return {
        ...inv,
        status,
      };
    });

    // Fetch team users
    const allUsers = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        createdAt: users.createdAt,
      })
      .from(users)
      .orderBy(desc(users.createdAt));

    return NextResponse.json({
      success: true,
      invitations: formattedInvites,
      users: allUsers,
    });
  } catch (err: any) {
    console.error("Invitations GET error:", err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || currentUser.role !== "admin") {
      return NextResponse.json(
        { success: false, error: "Brak uprawnień administratora" },
        { status: 403 }
      );
    }

    if (!currentUser.tenantId) {
      return NextResponse.json(
        { success: false, error: "Brak aktywnego kontekstu organizacji (tenantId)" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { email, role = "member" } = body;

    // Strict validation: Email is required for secure B2B invitation
    if (!email || typeof email !== "string" || !email.includes("@")) {
      return NextResponse.json(
        { success: false, error: "Wprowadź prawidłowy adres e-mail zapraszanego współpracownika" },
        { status: 400 }
      );
    }

    const cleanEmail = email.trim().toLowerCase();

    // Check if user already exists
    const [existingUser] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, cleanEmail))
      .limit(1);

    if (existingUser) {
      return NextResponse.json(
        {
          success: false,
          error: `Użytkownik o adresie ${cleanEmail} ma już aktywne konto w systemie`,
        },
        { status: 400 }
      );
    }

    // Check if there is an active, pending invitation for this email
    const [existingInvite] = await db
      .select({ id: invitations.id, code: invitations.code })
      .from(invitations)
      .where(
        and(
          eq(invitations.email, cleanEmail),
          eq(invitations.usedCount, 0),
          gt(invitations.expiresAt, new Date())
        )
      )
      .limit(1);

    const host = req.headers.get("host") || "localhost:3000";
    const protocol = host.includes("localhost") ? "http" : "https";

    if (existingInvite) {
      const inviteUrl = `${protocol}://${host}/invite?code=${existingInvite.code}`;
      return NextResponse.json({
        success: true,
        message: `Istnieje już aktywne zaproszenie dla ${cleanEmail}. Skopiowano link.`,
        invitation: existingInvite,
        inviteUrl,
      });
    }

    // Generate single-use, 7-day secure invite token
    const code = generateInviteCode("pm_inv_");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const [newInvite] = await db
      .insert(invitations)
      .values({
        tenantId: currentUser.tenantId,
        code,
        email: cleanEmail,
        role: role === "admin" ? "admin" : "member",
        createdById: currentUser.id,
        maxUses: 1, // Single-use strictly
        usedCount: 0,
        expiresAt,
      })
      .returning();

    const inviteUrl = `${protocol}://${host}/invite?code=${newInvite.code}`;

    return NextResponse.json({
      success: true,
      invitation: {
        ...newInvite,
        status: "active",
      },
      inviteUrl,
    });
  } catch (err: any) {
    console.error("Invitations POST error:", err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
