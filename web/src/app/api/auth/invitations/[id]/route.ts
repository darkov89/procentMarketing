import { NextResponse } from "next/server";
import { db, invitations } from "@/lib/db";
import { eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || currentUser.role !== "admin") {
      return NextResponse.json(
        { success: false, error: "Brak uprawnień administratora" },
        { status: 403 }
      );
    }

    const { id } = await params;
    const inviteId = parseInt(id, 10);
    if (isNaN(inviteId)) {
      return NextResponse.json(
        { success: false, error: "Nieprawidłowe ID zaproszenia" },
        { status: 400 }
      );
    }

    await db.delete(invitations).where(eq(invitations.id, inviteId));

    return NextResponse.json({ success: true, message: "Zaproszenie unieważnione" });
  } catch (err: any) {
    console.error("Delete invitation error:", err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
