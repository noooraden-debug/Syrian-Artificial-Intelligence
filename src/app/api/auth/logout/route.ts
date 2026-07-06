import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getCurrentUser, logoutCurrentSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST() {
  const user = await getCurrentUser();
  if (user) {
    await db.update(users).set({ isOnline: false, updatedAt: new Date() }).where(eq(users.id, user.id));
  }
  await logoutCurrentSession();
  return Response.json({ ok: true });
}
