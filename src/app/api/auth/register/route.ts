import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { createSession, ensureAdminUser, hashPassword, publicUser } from "@/lib/auth";
import { isAdminAlias } from "@/lib/admin-credentials";
import { buildUsagePayload } from "@/lib/usage";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  await ensureAdminUser();
  const body = (await request.json().catch(() => null)) as {
    username?: string;
    password?: string;
    displayName?: string;
    remember?: boolean;
  } | null;

  const username = body?.username?.trim().toLowerCase();
  const password = body?.password ?? "";
  const displayName = body?.displayName?.trim() || username || "مستخدم جديد";

  if (!username || username.length < 3) {
    return Response.json({ error: "اسم المستخدم يجب أن يكون 3 أحرف على الأقل" }, { status: 400 });
  }

  if (password.length < 6) {
    return Response.json({ error: "كلمة المرور يجب أن تكون 6 أحرف على الأقل" }, { status: 400 });
  }

  if (isAdminAlias(username)) {
    return Response.json({ error: "اسم المستخدم غير متاح" }, { status: 409 });
  }

  const existing = await db.query.users.findFirst({ where: eq(users.username, username) });
  if (existing) return Response.json({ error: "اسم المستخدم موجود مسبقاً" }, { status: 409 });

  const [user] = await db
    .insert(users)
    .values({
      username,
      displayName,
      passwordHash: hashPassword(password),
      role: "user",
      plan: "free",
      isOnline: true,
      lastSeenAt: new Date(),
    })
    .returning();

  await createSession(user.id, Boolean(body?.remember));

  return Response.json({ user: publicUser(user), usage: await buildUsagePayload(user) });
}
