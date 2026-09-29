import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db, users, invitations } from "@/lib/db";
import { eq, sql } from "drizzle-orm";
import {
  validateInviteCode,
  hashPassword,
  createSession,
  SESSION_COOKIE_NAME,
} from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { inviteCode, email, password, name } = body;

    if (!inviteCode) {
      return NextResponse.json(
        { success: false, error: "Wymagany jest ważny kod zaproszenia" },
        { status: 400 }
      );
    }

    if (!email || !email.includes("@")) {
      return NextResponse.json(
        { success: false, error: "Podaj prawidłowy adres e-mail" },
        { status: 400 }
      );
    }

    if (!password || password.length < 6) {
      return NextResponse.json(
        { success: false, error: "Hasło musi mieć co najmniej 6 znaków" },
        { status: 400 }
      );
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanName = (name || cleanEmail.split("@")[0]).trim();

    // 1. Validate invitation code
    const inviteCheck = await validateInviteCode(inviteCode, cleanEmail);
    if (!inviteCheck.valid) {
      return NextResponse.json(
        { success: false, error: inviteCheck.error || "Nieprawidłowe lub wygasłe zaproszenie" },
        { status: 400 }
      );
    }

    // 2. Check if email already registered
    const [existingUser] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, cleanEmail));

    if (existingUser) {
      return NextResponse.json(
        { success: false, error: "Konto z tym adresem e-mail już istnieje. Zaloguj się." },
        { status: 400 }
      );
    }

    // 3. Hash password and insert user
    const passwordHash = hashPassword(password);
    const assignedRole = inviteCheck.role || "member";

    const [newUser] = await db
      .insert(users)
      .values({
        email: cleanEmail,
        passwordHash,
        name: cleanName,
        role: assignedRole,
      })
      .returning();

    // 4. Update invitation usage count if it was a stored invitation
    if (inviteCheck.invitation?.id) {
      await db
        .update(invitations)
        .set({
          usedCount: sql`${invitations.usedCount} + 1`,
        })
        .where(eq(invitations.id, inviteCheck.invitation.id));
    }

    // 5. Create session & set cookie
    const { token, expiresAt } = await createSession(newUser.id);
    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      expires: expiresAt,
      path: "/",
    });

    return NextResponse.json({
      success: true,
      user: {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
        role: newUser.role,
      },
    });
  } catch (err: any) {
    console.error("Register API error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Błąd podczas rejestracji konta" },
      { status: 500 }
    );
  }
}
