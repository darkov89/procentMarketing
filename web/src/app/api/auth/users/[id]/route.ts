import { NextResponse } from "next/server";
import { db, users, tenantMembers, sessions } from "@/lib/db";
import { eq, and, ne } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";

/**
 * PATCH /api/auth/users/[id]
 * Updates a team member's role (admin <-> member).
 * Protected by admin authorization and checks against self-lockout.
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || currentUser.role !== "admin") {
      return NextResponse.json(
        { success: false, error: "Wymagane uprawnienia administratora organizacji" },
        { status: 403 }
      );
    }

    const { id } = await params;
    const targetUserId = parseInt(id, 10);
    if (isNaN(targetUserId)) {
      return NextResponse.json(
        { success: false, error: "Nieprawidłowy identyfikator użytkownika" },
        { status: 400 }
      );
    }

    const body = await req.json();
    const { role } = body;
    if (role !== "admin" && role !== "member") {
      return NextResponse.json(
        { success: false, error: "Dozwolone role to wyłącznie 'admin' lub 'member'" },
        { status: 400 }
      );
    }

    // Verify target user exists
    const [targetUser] = await db
      .select({ id: users.id, role: users.role, email: users.email })
      .from(users)
      .where(eq(users.id, targetUserId))
      .limit(1);

    if (!targetUser) {
      return NextResponse.json(
        { success: false, error: "Użytkownik nie został odnaleziony" },
        { status: 404 }
      );
    }

    // Security guard: If demoting self from admin, ensure there is at least one other admin
    if (currentUser.id === targetUserId && role !== "admin") {
      const otherAdmins = await db
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.role, "admin"), ne(users.id, targetUserId)))
        .limit(1);

      if (otherAdmins.length === 0) {
        return NextResponse.json(
          {
            success: false,
            error: "Nie możesz odebrać sobie uprawnień administratora — organizacja musi posiadać co najmniej jednego aktywnego administratora",
          },
          { status: 400 }
        );
      }
    }

    // Update role in users table
    const [updatedUser] = await db
      .update(users)
      .set({
        role,
        updatedAt: new Date(),
      })
      .where(eq(users.id, targetUserId))
      .returning({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
      });

    // Also sync role in tenant_members if entry exists
    try {
      await db
        .update(tenantMembers)
        .set({ role })
        .where(eq(tenantMembers.userId, targetUserId));
    } catch {}

    return NextResponse.json({
      success: true,
      message: `Rola użytkownika ${updatedUser.email} została zmieniona na: ${role === "admin" ? "Administrator" : "Specjalista B2B"}`,
      user: updatedUser,
    });
  } catch (err: any) {
    console.error("Error updating user role:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Błąd podczas aktualizacji roli" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/auth/users/[id]
 * Removes a member from the organization and terminates their active sessions.
 * Protected by admin authorization and checks against deleting self or the last admin.
 */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || currentUser.role !== "admin") {
      return NextResponse.json(
        { success: false, error: "Wymagane uprawnienia administratora organizacji" },
        { status: 403 }
      );
    }

    const { id } = await params;
    const targetUserId = parseInt(id, 10);
    if (isNaN(targetUserId)) {
      return NextResponse.json(
        { success: false, error: "Nieprawidłowy identyfikator użytkownika" },
        { status: 400 }
      );
    }

    // Security guard: Cannot delete self
    if (currentUser.id === targetUserId) {
      return NextResponse.json(
        {
          success: false,
          error: "Nie możesz usunąć własnego konta z panelu zarządzania zespołem",
        },
        { status: 400 }
      );
    }

    // Verify target user exists
    const [targetUser] = await db
      .select({ id: users.id, role: users.role, email: users.email })
      .from(users)
      .where(eq(users.id, targetUserId))
      .limit(1);

    if (!targetUser) {
      return NextResponse.json(
        { success: false, error: "Użytkownik nie został odnaleziony" },
        { status: 404 }
      );
    }

    // Security guard: Cannot delete the last admin
    if (targetUser.role === "admin") {
      const remainingAdmins = await db
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.role, "admin"), ne(users.id, targetUserId)))
        .limit(1);

      if (remainingAdmins.length === 0) {
        return NextResponse.json(
          {
            success: false,
            error: "Nie można usunąć ostatniego administratora organizacji",
          },
          { status: 400 }
        );
      }
    }

    // Terminate all sessions of target user
    await db.delete(sessions).where(eq(sessions.userId, targetUserId));

    // Remove membership
    await db.delete(tenantMembers).where(eq(tenantMembers.userId, targetUserId));

    // Delete user
    await db.delete(users).where(eq(users.id, targetUserId));

    return NextResponse.json({
      success: true,
      message: `Dostęp dla użytkownika ${targetUser.email} został pomyślnie cofnięty`,
    });
  } catch (err: any) {
    console.error("Error deleting user:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Błąd podczas usuwania użytkownika" },
      { status: 500 }
    );
  }
}
