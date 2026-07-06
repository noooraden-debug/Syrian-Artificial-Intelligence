import { eq } from "drizzle-orm";
import { db } from "@/db";
import { settings } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const admin = await getCurrentUser();
  if (!admin || admin.role !== "admin") return Response.json({ error: "غير مصرح" }, { status: 403 });
  
  const keyRow = await db.query.settings.findFirst({ where: eq(settings.key, "OPENROUTER_API_KEY") });
  // إرسال المفتاح كما هو ليتم عرضه
  return Response.json({ apiKey: keyRow?.value ?? "" });
}

export async function POST(request: Request) {
  const admin = await getCurrentUser();
  if (!admin || admin.role !== "admin") return Response.json({ error: "غير مصرح" }, { status: 403 });

  const { apiKey } = await request.json();
  if (!apiKey) return Response.json({ error: "المفتاح مطلوب" }, { status: 400 });

  await db
    .insert(settings)
    .values({ key: "OPENROUTER_API_KEY", value: apiKey })
    .onConflictDoUpdate({ target: settings.key, set: { value: apiKey } });

  return Response.json({ ok: true });
}
