import { NextResponse } from "next/server";
import { db, invitations, users } from "@/lib/db";
import { desc, eq } from "drizzle-orm";
import { getCurrentUser, generateInviteCode, BOOTSTRAP_INVITE_CODE } from "@/lib/auth";

export async function GET(req: Request) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || currentUser.role !== "admin") {
      return NextResponse.json(
        { success: false, error: "Brak uprawnień administratora" },
        { status: 403 }
      );
    }

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
      invitations: allInvites,
      users: allUsers,
      bootstrapCode: BOOTSTRAP_INVITE_CODE,
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

    const body = await req.json();
    const { email, role = "member", maxUses = 1, expiresInDays = 7 } = body;

    const code = generateInviteCode("pm_inv_");
    const expiresAt = expiresInDays
      ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
      : null;

    const [newInvite] = await db
      .insert(invitations)
      .values({
        code,
        email: email ? email.trim().toLowerCase() : null,
        role: role === "admin" ? "admin" : "member",
        createdById: currentUser.id,
        maxUses: Number(maxUses) || 1,
        usedCount: 0,
        expiresAt,
      })
      .returning();

    const host = req.headers.get("host") || "localhost:3000";
    const protocol = host.includes("localhost") ? "http" : "https";
    const inviteUrl = `${protocol}://${host}/invite?code=${newInvite.code}`;

    return NextResponse.json({
      success: true,
      invitation: newInvite,
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
