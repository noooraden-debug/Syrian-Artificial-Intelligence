import { eq } from "drizzle-orm";
import { db } from "@/db";
import { conversations, messages } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request) {
  const admin = await getCurrentUser();
  if (!admin || admin.role !== "admin") return Response.json({ error: "غير مصرح" }, { status: 403 });

  const body = (await request.json().catch(() => null)) as { messageId?: string; content?: string } | null;
  const messageId = body?.messageId;
  const content = body?.content?.trim();

  if (!messageId || !content) return Response.json({ error: "الرسالة أو المحتوى غير محدد" }, { status: 400 });

  const message = await db.query.messages.findFirst({ where: eq(messages.id, messageId) });
  if (!message) return Response.json({ error: "الرسالة غير موجودة" }, { status: 404 });
  if (message.role !== "assistant") return Response.json({ error: "يمكن تعديل ردود المساعد فقط" }, { status: 400 });

  const [updated] = await db
    .update(messages)
    .set({ content, source: "admin-edited", updatedAt: new Date() })
    .where(eq(messages.id, messageId))
    .returning();

  await db.update(conversations).set({ updatedAt: new Date() }).where(eq(conversations.id, message.conversationId));

  return Response.json({
    message: updated
      ? { ...updated, createdAt: updated.createdAt.toISOString(), updatedAt: updated.updatedAt.toISOString() }
      : null,
  });
}

export async function POST(request: Request) {
  const admin = await getCurrentUser();
  if (!admin || admin.role !== "admin") return Response.json({ error: "غير مصرح" }, { status: 403 });

  const body = (await request.json().catch(() => null)) as { conversationId?: string; content?: string } | null;
  const conversationId = body?.conversationId;
  const content = body?.content?.trim();

  if (!conversationId || !content) return Response.json({ error: "المحادثة أو الرد غير محدد" }, { status: 400 });

  const conversation = await db.query.conversations.findFirst({ where: eq(conversations.id, conversationId) });
  if (!conversation) return Response.json({ error: "المحادثة غير موجودة" }, { status: 404 });

  const [created] = await db
    .insert(messages)
    .values({
      conversationId,
      userId: conversation.userId,
      role: "assistant",
      source: "admin-live",
      content,
      attachmentMeta: null,
    })
    .returning();

  await db.update(conversations).set({ updatedAt: new Date() }).where(eq(conversations.id, conversationId));

  return Response.json({
    message: { ...created, createdAt: created.createdAt.toISOString(), updatedAt: created.updatedAt.toISOString() },
  });
}
