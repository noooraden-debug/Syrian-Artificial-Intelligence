import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getCurrentUser, publicUser } from "@/lib/auth";
import { isPlanKey, PLAN_DEFINITIONS } from "@/lib/plans";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request) {
  const admin = await getCurrentUser();
  if (!admin || admin.role !== "admin") return Response.json({ error: "غير مصرح" }, { status: 403 });

  const body = (await request.json().catch(() => null)) as { userId?: string; action?: string; planType?: string } | null;
  const userId = body?.userId;
  if (!userId) return Response.json({ error: "المستخدم غير محدد" }, { status: 400 });

  const target = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!target) return Response.json({ error: "المستخدم غير موجود" }, { status: 404 });

  if (body?.action === "expire") {
    const [updated] = await db
      .update(users)
      .set({ plan: "free", subscriptionEndsAt: null, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return Response.json({ user: publicUser(updated) });
  }

  if (body?.action === "extend") {
    const planType = body.planType ?? "day";
    if (!isPlanKey(planType)) return Response.json({ error: "الباقة غير صحيحة" }, { status: 400 });
    const plan = PLAN_DEFINITIONS[planType];
    const start = target.subscriptionEndsAt && target.subscriptionEndsAt.getTime() > Date.now() ? target.subscriptionEndsAt : new Date();
    const subscriptionEndsAt = new Date(start.getTime() + plan.durationMinutes * 60 * 1000);
    const [updated] = await db
      .update(users)
      .set({ plan: "pro", subscriptionEndsAt, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return Response.json({ user: publicUser(updated) });
  }

  return Response.json({ error: "الإجراء غير معروف" }, { status: 400 });
}
