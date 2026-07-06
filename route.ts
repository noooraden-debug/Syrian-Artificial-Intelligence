import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { rechargeCodes, users } from "@/db/schema";
import { getCurrentUser, publicUser } from "@/lib/auth";
import { buildUsagePayload } from "@/lib/usage";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "يرجى تسجيل الدخول" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { code?: string } | null;
  const code = body?.code?.trim().toUpperCase();
  if (!code) return Response.json({ error: "أدخل كود الشحن" }, { status: 400 });

  const rechargeCode = await db.query.rechargeCodes.findFirst({
    where: and(eq(rechargeCodes.code, code), eq(rechargeCodes.status, "available")),
  });

  if (!rechargeCode) return Response.json({ error: "الكود غير صحيح أو مستخدم مسبقاً" }, { status: 404 });

  const currentEnd = user.subscriptionEndsAt && user.subscriptionEndsAt.getTime() > Date.now() ? user.subscriptionEndsAt : new Date();
  const newEnd = new Date(currentEnd.getTime() + rechargeCode.durationMinutes * 60 * 1000);

  const [updatedUser] = await db
    .update(users)
    .set({ plan: "pro", subscriptionEndsAt: newEnd, updatedAt: new Date() })
    .where(eq(users.id, user.id))
    .returning();

  await db
    .update(rechargeCodes)
    .set({ status: "redeemed", redeemedBy: user.id, redeemedAt: new Date() })
    .where(eq(rechargeCodes.id, rechargeCode.id));

  const finalUser = updatedUser ?? user;
  return Response.json({ user: publicUser(finalUser), usage: await buildUsagePayload(finalUser) });
}
