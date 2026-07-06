export type PlanKey = "hour" | "day" | "week" | "month";

export const FREE_DAILY_LIMIT = 10;
export const WHATSAPP_NUMBER = "963957869853";

export const PLAN_DEFINITIONS: Record<
  PlanKey,
  {
    label: string;
    durationMinutes: number;
    price: number;
    badge: string;
  }
> = {
  hour: {
    label: "باقة ساعة",
    durationMinutes: 60,
    price: 2000,
    badge: "⚡ ساعة Pro",
  },
  day: {
    label: "باقة يوم",
    durationMinutes: 60 * 24,
    price: 5000,
    badge: "☀️ يوم Pro",
  },
  week: {
    label: "باقة أسبوع",
    durationMinutes: 60 * 24 * 7,
    price: 15000,
    badge: "💎 أسبوع Pro",
  },
  month: {
    label: "باقة شهر",
    durationMinutes: 60 * 24 * 30,
    price: 25000,
    badge: "👑 شهر Pro",
  },
};

export function isPlanKey(value: string): value is PlanKey {
  return Object.hasOwn(PLAN_DEFINITIONS, value);
}

export function isProActive(user: { role: string; subscriptionEndsAt: Date | null }) {
  if (user.role === "admin") return true;
  return Boolean(user.subscriptionEndsAt && user.subscriptionEndsAt.getTime() > Date.now());
}

export function currentPlanLabel(user: { role: string; plan: string; subscriptionEndsAt: Date | null }) {
  if (user.role === "admin") return "مدير بصلاحيات كاملة";
  if (isProActive(user)) return "Pro نشط";
  return "مجاني - 10 رسائل يومياً";
}

export function formatSyp(price: number) {
  return `${price.toLocaleString("ar-SY")} ل.س`;
}
