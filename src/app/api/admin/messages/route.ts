import { asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { conversations, messages, users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const admin = await getCurrentUser();
  if (!admin || admin.role !== "admin") return Response.json({ error: "غير مصرح" }, { status: 403 });

  const url = new URL(request.url);
  const userId = url.searchParams.get("userId");
  const conversationId = url.searchParams.get("conversationId");

  if (conversationId) {
    const conversation = await db.query.conversations.findFirst({ where: eq(conversations.id, conversationId) });
    if (!conversation) return Response.json({ error: "المحادثة غير موجودة" }, { status: 404 });
    const owner = await db.query.users.findFirst({ where: eq(users.id, conversation.userId) });
    const rows = await db.select().from(messages).where(eq(messages.conversationId, conversation.id)).orderBy(asc(messages.createdAt));
    return Response.json({
      user: owner
        ? {
            id: owner.id,
            username: owner.username,
            displayName: owner.displayName,
            role: owner.role,
            plan: owner.plan,
          }
        : null,
      conversation: {
        ...conversation,
        createdAt: conversation.createdAt.toISOString(),
        updatedAt: conversation.updatedAt.toISOString(),
        userDeletedAt: conversation.userDeletedAt?.toISOString() ?? null,
      },
      messages: rows.map((message) => ({
        ...message,
        createdAt: message.createdAt.toISOString(),
        updatedAt: message.updatedAt.toISOString(),
      })),
    });
  }

  if (!userId) return Response.json({ error: "اختر مستخدماً" }, { status: 400 });

  const owner = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!owner) return Response.json({ error: "المستخدم غير موجود" }, { status: 404 });

  const userConversations = await db
    .select()
    .from(conversations)
    .where(eq(conversations.userId, userId))
    .orderBy(desc(conversations.updatedAt));

  const firstConversation = userConversations[0];
  const rows = firstConversation
    ? await db.select().from(messages).where(eq(messages.conversationId, firstConversation.id)).orderBy(asc(messages.createdAt))
    : [];

  return Response.json({
    user: {
      id: owner.id,
      username: owner.username,
      displayName: owner.displayName,
      role: owner.role,
      plan: owner.plan,
    },
    conversations: userConversations.map((conversation) => ({
      ...conversation,
      createdAt: conversation.createdAt.toISOString(),
      updatedAt: conversation.updatedAt.toISOString(),
      userDeletedAt: conversation.userDeletedAt?.toISOString() ?? null,
    })),
    conversation: firstConversation
      ? {
          ...firstConversation,
          createdAt: firstConversation.createdAt.toISOString(),
          updatedAt: firstConversation.updatedAt.toISOString(),
          userDeletedAt: firstConversation.userDeletedAt?.toISOString() ?? null,
        }
      : null,
    messages: rows.map((message) => ({
      ...message,
      createdAt: message.createdAt.toISOString(),
      updatedAt: message.updatedAt.toISOString(),
    })),
  });
}
