import { randomBytes, pbkdf2Sync, timingSafeEqual, createHash } from "crypto";
import { cookies } from "next/headers";
import { and, eq, gt, inArray } from "drizzle-orm";
import { db } from "@/db";
import { sessions, users } from "@/db/schema";
import { ADMIN_ALIASES, ADMIN_PASSWORD, ADMIN_USERNAME } from "./admin-credentials";

const SESSION_COOKIE = "syria_ai_session";
const HASH_ITERATIONS = 120_000;
const HASH_KEY_LENGTH = 32;
const HASH_DIGEST = "sha256";

export type AuthUser = typeof users.$inferSelect;

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = pbkdf2Sync(password, salt, HASH_ITERATIONS, HASH_KEY_LENGTH, HASH_DIGEST).toString("hex");
  return `pbkdf2_${HASH_DIGEST}$${HASH_ITERATIONS}$${salt}$${hash}`;
}

export function verifyPassword(password: string, storedHash: string) {
  const [algorithm, iterationsRaw, salt, hash] = storedHash.split("$");
  if (algorithm !== `pbkdf2_${HASH_DIGEST}` || !iterationsRaw || !salt || !hash) return false;
  const iterations = Number(iterationsRaw);
  if (!Number.isFinite(iterations) || iterations < 1) return false;
  const candidate = pbkdf2Sync(password, salt, iterations, HASH_KEY_LENGTH, HASH_DIGEST);
  const expected = Buffer.from(hash, "hex");
  return expected.length === candidate.length && timingSafeEqual(expected, candidate);
}

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function ensureAdminUser() {
  const existingAliases = await db.select().from(users).where(inArray(users.username, ADMIN_ALIASES));
  const existing = existingAliases.find((candidate) => candidate.role === "admin") ?? existingAliases[0];
  const passwordHash = hashPassword(ADMIN_PASSWORD);

  if (!existing) {
    const [admin] = await db
      .insert(users)
      .values({
        username: ADMIN_USERNAME,
        displayName: "الجوكر",
        passwordHash,
        role: "admin",
        plan: "admin",
        subscriptionEndsAt: null,
        isOnline: false,
      })
      .returning();
    return admin;
  }

  if (existing.role !== "admin" || !verifyPassword(ADMIN_PASSWORD, existing.passwordHash)) {
    const [admin] = await db
      .update(users)
      .set({ role: "admin", plan: "admin", passwordHash, updatedAt: new Date() })
      .where(eq(users.id, existing.id))
      .returning();
    return admin;
  }

  return existing;
}

export async function createSession(userId: string, remember: boolean) {
  const token = randomBytes(32).toString("base64url");
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + (remember ? 1000 * 60 * 60 * 24 * 30 : 1000 * 60 * 60 * 12));

  await db.insert(sessions).values({ tokenHash, userId, expiresAt });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });

  return token;
}

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const tokenHash = hashToken(token);
  const session = await db.query.sessions.findFirst({
    where: and(eq(sessions.tokenHash, tokenHash), gt(sessions.expiresAt, new Date())),
  });

  if (!session) return null;

  const user = await db.query.users.findFirst({ where: eq(users.id, session.userId) });
  if (!user) return null;

  const [updated] = await db
    .update(users)
    .set({ isOnline: true, lastSeenAt: new Date(), updatedAt: new Date() })
    .where(eq(users.id, user.id))
    .returning();

  return updated ?? user;
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new Response(JSON.stringify({ error: "يرجى تسجيل الدخول أولاً" }), { status: 401 });
  return user;
}

export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "admin") throw new Response(JSON.stringify({ error: "هذه العملية تحتاج صلاحيات المدير" }), { status: 403 });
  return user;
}

export async function logoutCurrentSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) {
    await db.delete(sessions).where(eq(sessions.tokenHash, hashToken(token)));
  }
  cookieStore.delete(SESSION_COOKIE);
}

export function publicUser(user: AuthUser) {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    role: user.role,
    plan: user.plan,
    subscriptionEndsAt: user.subscriptionEndsAt?.toISOString() ?? null,
    isOnline: user.isOnline,
    lastSeenAt: user.lastSeenAt.toISOString(),
    createdAt: user.createdAt.toISOString(),
  };
}
