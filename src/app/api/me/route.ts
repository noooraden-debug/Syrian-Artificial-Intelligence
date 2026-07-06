import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { conversations } from "@/db/schema";
import { ensureAdminUser, getCurrentUser, publicUser } from "@/lib/auth";
import { buildUsagePayload } from "@/lib/usage";

export const dynamic = "force-dynamic";

export async function GET() {
  await ensureAdminUser();
  const user = await getCurrentUser();
  if (!user) return Response.json({ user: null });

  const visibleConversations = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.userId, user.id), eq(conversations.isUserDeleted, false)))
    .orderBy(desc(conversations.updatedAt))
    .limit(30);

  return Response.json({
    user: publicUser(user),
    usage: await buildUsagePayload(user),
    conversations: visibleConversations.map((conversation) => ({
      ...conversation,
      createdAt: conversation.createdAt.toISOString(),
      updatedAt: conversation.updatedAt.toISOString(),
      userDeletedAt: conversation.userDeletedAt?.toISOString() ?? null,
    })),
  });
}
