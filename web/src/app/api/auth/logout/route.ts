import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { deleteSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth";

export async function POST() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    if (token) {
      await deleteSessionToken(token);
    }

    cookieStore.delete(SESSION_COOKIE_NAME);

    return NextResponse.json({ success: true, message: "Wylogowano pomyślnie" });
  } catch (err: any) {
    console.error("Logout API error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Błąd wylogowywania" },
      { status: 500 }
    );
  }
}
