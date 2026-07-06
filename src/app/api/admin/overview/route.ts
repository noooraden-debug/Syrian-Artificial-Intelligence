import { desc } from "drizzle-orm";
import { db } from "@/db";
import { conversations, rechargeCodes, users } from "@/db/schema";
import { ensureAdminUser, getCurrentUser } from "@/lib/auth";
import { currentPlanLabel } from "@/lib/plans";

export const dynamic = "force-dynamic";

export async function GET() {
  await ensureAdminUser();
  const admin = await getCurrentUser();
  if (!admin || admin.role !== "admin") return Response.json({ error: "غير مصرح" }, { status: 403 });

  const allUsers = await db.select().from(users).orderBy(desc(users.createdAt));
  const allConversations = await db.select().from(conversations).orderBy(desc(conversations.updatedAt)).limit(120);
  const allCodes = await db.select().from(rechargeCodes).orderBy(desc(rechargeCodes.createdAt)).limit(200);
  const now = Date.now();

  return Response.json({
    users: allUsers.map((user) => ({
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      role: user.role,
      plan: user.plan,
      planLabel: currentPlanLabel(user),
      subscriptionEndsAt: user.subscriptionEndsAt?.toISOString() ?? null,
      isOnline: user.isOnline && now - user.lastSeenAt.getTime() < 1000 * 60 * 2,
      lastSeenAt: user.lastSeenAt.toISOString(),
      createdAt: user.createdAt.toISOString(),
    })),
    conversations: allConversations.map((conversation) => ({
      ...conversation,
      createdAt: conversation.createdAt.toISOString(),
      updatedAt: conversation.updatedAt.toISOString(),
      userDeletedAt: conversation.userDeletedAt?.toISOString() ?? null,
    })),
    codes: allCodes.map((code) => ({
      ...code,
      redeemedAt: code.redeemedAt?.toISOString() ?? null,
      createdAt: code.createdAt.toISOString(),
    })),
  });
}
