import { randomBytes } from "crypto";
import { db } from "@/db";
import { rechargeCodes } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { isPlanKey, PLAN_DEFINITIONS } from "@/lib/plans";

export const dynamic = "force-dynamic";

function makeCode(planType: string) {
  return `SYAI-${planType.toUpperCase()}-${randomBytes(4).toString("hex").toUpperCase()}`;
}

export async function POST(request: Request) {
  const admin = await getCurrentUser();
  if (!admin || admin.role !== "admin") return Response.json({ error: "غير مصرح" }, { status: 403 });

  const body = (await request.json().catch(() => null)) as { planType?: string; quantity?: number } | null;
  const planType = body?.planType ?? "day";
  const quantity = Math.min(50, Math.max(1, Number(body?.quantity ?? 1)));

  if (!isPlanKey(planType)) return Response.json({ error: "الباقة غير صحيحة" }, { status: 400 });

  const plan = PLAN_DEFINITIONS[planType];
  const values = Array.from({ length: quantity }).map(() => ({
    code: makeCode(planType),
    planType,
    durationMinutes: plan.durationMinutes,
    price: plan.price,
    status: "available",
    createdBy: admin.id,
  }));

  const created = await db.insert(rechargeCodes).values(values).returning();

  return Response.json({
    codes: created.map((code) => ({
      ...code,
      redeemedAt: code.redeemedAt?.toISOString() ?? null,
      createdAt: code.createdAt.toISOString(),
    })),
  });
}
