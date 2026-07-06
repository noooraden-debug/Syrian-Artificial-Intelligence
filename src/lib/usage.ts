import { and, eq, gte } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { messages } from "@/db/schema";
import { FREE_DAILY_LIMIT, isProActive } from "./plans";
import type { AuthUser } from "./auth";

export function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

export async function getDailyUserMessageCount(userId: string) {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(messages)
    .where(and(eq(messages.userId, userId), eq(messages.role, "user"), gte(messages.createdAt, startOfToday())));
  return Number(row?.count ?? 0);
}

export async function buildUsagePayload(user: AuthUser) {
  const usedToday = await getDailyUserMessageCount(user.id);
  const proActive = isProActive(user);
  return {
    usedToday,
    freeDailyLimit: FREE_DAILY_LIMIT,
    remainingToday: proActive ? null : Math.max(0, FREE_DAILY_LIMIT - usedToday),
    proActive,
    subscriptionEndsAt: user.subscriptionEndsAt?.toISOString() ?? null,
  };
}
