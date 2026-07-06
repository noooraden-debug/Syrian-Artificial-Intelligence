import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { createSession, ensureAdminUser, publicUser, verifyPassword } from "@/lib/auth";
import { ADMIN_ALIASES, isAdminAlias } from "@/lib/admin-credentials";
import { buildUsagePayload } from "@/lib/usage";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  await ensureAdminUser();
  const body = (await request.json().catch(() => null)) as {
    username?: string;
    password?: string;
    remember?: boolean;
  } | null;

  const username = body?.username?.trim().toLowerCase();
  const password = body?.password ?? "";

  if (!username || !password) {
    return Response.json({ error: "يرجى إدخال اسم المستخدم وكلمة المرور" }, { status: 400 });
  }

  const adminCandidates = isAdminAlias(username)
    ? await db.select().from(users).where(inArray(users.username, ADMIN_ALIASES))
    : [];
  const user = isAdminAlias(username)
    ? (adminCandidates.find((candidate) => candidate.role === "admin") ?? adminCandidates[0])
    : await db.query.users.findFirst({ where: eq(users.username, username) });

  if (!user || !verifyPassword(password, user.passwordHash)) {
    return Response.json({ error: "بيانات الدخول غير صحيحة" }, { status: 401 });
  }

  const [updated] = await db
    .update(users)
    .set({ isOnline: true, lastSeenAt: new Date(), updatedAt: new Date() })
    .where(eq(users.id, user.id))
    .returning();

  const signedInUser = updated ?? user;
  await createSession(signedInUser.id, Boolean(body?.remember));

  return Response.json({ user: publicUser(signedInUser), usage: await buildUsagePayload(signedInUser) });
}
