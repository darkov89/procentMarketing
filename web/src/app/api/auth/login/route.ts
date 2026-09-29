import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db, users } from "@/lib/db";
import { eq } from "drizzle-orm";
import {
  createSession,
  verifyPassword,
  SESSION_COOKIE_NAME,
} from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: "Podaj adres e-mail i hasło" },
        { status: 400 }
      );
    }

    const cleanEmail = email.trim().toLowerCase();
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, cleanEmail));

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Nieprawidłowy e-mail lub hasło" },
        { status: 401 }
      );
    }

    const isMatch = verifyPassword(password, user.passwordHash);
    if (!isMatch) {
      return NextResponse.json(
        { success: false, error: "Nieprawidłowy e-mail lub hasło" },
        { status: 401 }
      );
    }

    // Create session in database
    const { token, expiresAt } = await createSession(user.id);

    // Set cookie
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
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
  } catch (err: any) {
    console.error("Login API error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Błąd serwera podczas logowania" },
      { status: 500 }
    );
  }
}
