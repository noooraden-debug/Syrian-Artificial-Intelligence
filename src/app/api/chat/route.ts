import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { conversations, messages, settings } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { generateSimulatedAssistantReply } from "@/lib/ai";
import { FREE_DAILY_LIMIT, isProActive } from "@/lib/plans";
import { buildUsagePayload, getDailyUserMessageCount } from "@/lib/usage";

export const dynamic = "force-dynamic";

async function findOwnedConversation(userId: string, conversationId?: string | null) {
  if (conversationId) {
    const existing = await db.query.conversations.findFirst({
      where: and(
        eq(conversations.id, conversationId),
        eq(conversations.userId, userId),
        eq(conversations.isUserDeleted, false),
      ),
    });
    if (existing) return existing;
  }

  return db.query.conversations.findFirst({
    where: and(eq(conversations.userId, userId), eq(conversations.isUserDeleted, false)),
    orderBy: desc(conversations.updatedAt),
  });
}

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "يرجى تسجيل الدخول" }, { status: 401 });

  const url = new URL(request.url);
  const conversation = await findOwnedConversation(user.id, url.searchParams.get("conversationId"));
  if (!conversation) return Response.json({ conversation: null, messages: [], usage: await buildUsagePayload(user) });

  const rows = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conversation.id))
    .orderBy(asc(messages.createdAt));

  return Response.json({
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
    usage: await buildUsagePayload(user),
  });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "يرجى تسجيل الدخول" }, { status: 401 });

  const formData = await request.formData();
  const prompt = String(formData.get("message") ?? "").trim();
  const conversationId = String(formData.get("conversationId") ?? "").trim() || null;
  const file = formData.get("file");
  const proActive = isProActive(user);

  if (!prompt && !(file instanceof File && file.size > 0)) {
    return Response.json({ error: "اكتب رسالة أو أرفق ملفاً" }, { status: 400 });
  }

  if (file instanceof File && file.size > 0 && !proActive) {
    return Response.json({ error: "رفع الملفات متاح فقط لمشتركي Pro" }, { status: 403 });
  }

  if (!proActive) {
    const usedToday = await getDailyUserMessageCount(user.id);
    if (usedToday >= FREE_DAILY_LIMIT) {
      return Response.json({ error: "انتهت رسائلك المجانية لهذا اليوم. يمكنك الترقية إلى Pro للرسائل المفتوحة." }, { status: 429 });
    }
  }

  let conversation = await findOwnedConversation(user.id, conversationId);
  if (!conversation) {
    const title = (prompt || (file instanceof File ? file.name : "محادثة جديدة")).slice(0, 48) || "محادثة جديدة";
    const [created] = await db
      .insert(conversations)
      .values({ userId: user.id, title, isUserDeleted: false, adminNotifiedClear: false })
      .returning();
    conversation = created;
  }

  const attachmentMeta = file instanceof File && file.size > 0 ? { name: file.name, type: file.type, size: file.size } : null;

  await db.insert(messages).values({
    conversationId: conversation.id,
    userId: user.id,
    role: "user",
    source: "user",
    content: prompt || `طلب تحليل المرفق: ${attachmentMeta?.name ?? "ملف"}`,
    attachmentMeta,
  });

  // محاولة جلب المفتاح من الإعدادات
  const apiKeyRow = await db.query.settings.findFirst({ where: eq(settings.key, "OPENROUTER_API_KEY") });
  const apiKey = apiKeyRow?.value;

  let replyText = "";
  if (apiKey) {
      // الاتصال الفعلي بالذكاء الاصطناعي
      try {
          const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${apiKey.trim()}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "openai/gpt-4o-mini",
              messages: [
                { role: "system", content: "You are a helpful AI assistant. Provide accurate, current, and helpful information in Arabic." },
                { role: "user", content: prompt || "مرحباً" }
              ],
            }),
          });
          
          if (!response.ok) {
              const errData = await response.json();
              throw new Error(JSON.stringify(errData));
          }
          
          const data = await response.json();
          replyText = data.choices[0].message.content;
      } catch (e) {
          replyText = "خطأ في الاتصال: " + (e instanceof Error ? e.message : "غير معروف");
      }
  } else {
      replyText = await generateSimulatedAssistantReply(prompt || "طلب تحليل", proActive);
  }

  await db.insert(messages).values({
    conversationId: conversation.id,
    userId: user.id,
    role: "assistant",
    source: "ai",
    content: replyText,
    attachmentMeta: null,
  });

  const [updatedConversation] = await db
    .update(conversations)
    .set({
      title: conversation.title === "محادثة جديدة" && prompt ? prompt.slice(0, 48) : conversation.title,
      updatedAt: new Date(),
    })
    .where(eq(conversations.id, conversation.id))
    .returning();

  const rows = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conversation.id))
    .orderBy(asc(messages.createdAt));

  const refreshedUser = await getCurrentUser();

  return Response.json({
    conversation: {
      ...(updatedConversation ?? conversation),
      createdAt: (updatedConversation ?? conversation).createdAt.toISOString(),
      updatedAt: (updatedConversation ?? conversation).updatedAt.toISOString(),
      userDeletedAt: (updatedConversation ?? conversation).userDeletedAt?.toISOString() ?? null,
    },
    messages: rows.map((message) => ({
      ...message,
      createdAt: message.createdAt.toISOString(),
      updatedAt: message.updatedAt.toISOString(),
    })),
    usage: await buildUsagePayload(refreshedUser ?? user),
  });
}

export async function DELETE(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "يرجى تسجيل الدخول" }, { status: 401 });

  const url = new URL(request.url);
  const conversationId = url.searchParams.get("conversationId");
  if (!conversationId) return Response.json({ error: "المحادثة غير محددة" }, { status: 400 });

  const conversation = await findOwnedConversation(user.id, conversationId);
  if (!conversation) return Response.json({ error: "المحادثة غير موجودة" }, { status: 404 });

  await db
    .update(conversations)
    .set({
      isUserDeleted: true,
      adminNotifiedClear: true,
      userDeletedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(conversations.id, conversation.id));

  return Response.json({ ok: true, usage: await buildUsagePayload(user) });
}
