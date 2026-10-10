import { db, users } from "../src/lib/db";
import { eq } from "drizzle-orm";
import { hashPassword } from "../src/lib/auth";

async function resetPassword() {
  const email = process.argv[2] || "dariusz.rink@gmail.com";
  const newPassword = process.argv[3];

  if (!newPassword) {
    console.log("Użycie: npx tsx --env-file=.env.local scripts/reset-password.ts <email> <nowe_haslo>");
    console.log("Przykład: npx tsx --env-file=.env.local scripts/reset-password.ts dariusz.rink@gmail.com MojeNoweHaslo123!");
    process.exit(1);
  }

  const [existingUser] = await db
    .select()
    .from(users)
    .where(eq(users.email, email.trim().toLowerCase()));

  if (!existingUser) {
    console.error(`❌ Użytkownik ${email} nie został znaleziony w bazie.`);
    process.exit(1);
  }

  const newHash = hashPassword(newPassword);
  await db
    .update(users)
    .set({ passwordHash: newHash, updatedAt: new Date() })
    .where(eq(users.id, existingUser.id));

  console.log(`✅ Pomyślnie zaktualizowano hasło dla ${email} (ID: ${existingUser.id})!`);
  process.exit(0);
}

resetPassword().catch((err) => {
  console.error("Błąd podczas resetowania hasła:", err);
  process.exit(1);
});
