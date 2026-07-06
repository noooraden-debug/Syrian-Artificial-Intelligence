"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { PLAN_DEFINITIONS, WHATSAPP_NUMBER, formatSyp, type PlanKey } from "@/lib/plans";

type PublicUser = {
  id: string;
  username: string;
  displayName: string;
  role: string;
  plan: string;
  subscriptionEndsAt: string | null;
  isOnline: boolean;
  lastSeenAt: string;
  createdAt: string;
};

type Usage = {
  usedToday: number;
  freeDailyLimit: number;
  remainingToday: number | null;
  proActive: boolean;
  subscriptionEndsAt: string | null;
};

type Conversation = {
  id: string;
  userId: string;
  title: string;
  isUserDeleted: boolean;
  adminNotifiedClear: boolean;
  userDeletedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type ChatMessage = {
  id: string;
  conversationId: string;
  userId: string | null;
  role: string;
  source: string;
  content: string;
  attachmentMeta: { name: string; type: string; size: number } | null;
  createdAt: string;
  updatedAt: string;
};

type AdminUser = PublicUser & { planLabel: string; isOnline: boolean };
type AdminCode = {
  id: string;
  code: string;
  planType: string;
  durationMinutes: number;
  price: number;
  status: string;
  redeemedBy: string | null;
  redeemedAt: string | null;
  createdAt: string;
};

type AdminOverview = {
  users: AdminUser[];
  conversations: Conversation[];
  codes: AdminCode[];
};

const planEntries = Object.entries(PLAN_DEFINITIONS) as Array<[PlanKey, (typeof PLAN_DEFINITIONS)[PlanKey]]>;

function SyriaFlag() {
  return (
    <div className="relative h-12 w-20 overflow-hidden rounded-xl border border-white/30 shadow-2xl shadow-emerald-900/40">
      <div className="h-1/3 bg-emerald-600" />
      <div className="flex h-1/3 items-center justify-center gap-2 bg-white text-[10px] text-red-600">
        <span>★</span>
        <span>★</span>
        <span>★</span>
      </div>
      <div className="h-1/3 bg-black" />
      <div className="absolute inset-0 bg-gradient-to-br from-white/30 to-transparent" />
    </div>
  );
}

function timeLeft(target: string | null) {
  if (!target) return "غير مفعل";
  const diff = new Date(target).getTime() - Date.now();
  if (diff <= 0) return "منتهي";
  const days = Math.floor(diff / 86_400_000);
  const hours = Math.floor((diff % 86_400_000) / 3_600_000);
  const minutes = Math.floor((diff % 3_600_000) / 60_000);
  const seconds = Math.floor((diff % 60_000) / 1000);
  if (days > 0) return `${days} يوم ${hours} ساعة ${minutes} دقيقة`;
  if (hours > 0) return `${hours} ساعة ${minutes} دقيقة ${seconds} ث`;
  return `${minutes} دقيقة ${seconds} ث`;
}

function makeWhatsappUrl(user: PublicUser | null, planKey: PlanKey) {
  const plan = PLAN_DEFINITIONS[planKey];
  const text = `*🤖 طلب شحن باقة دردشة الذكاء الاصطناعي في سوريا*\n\n*👤 بيانات العميل*\n• الاسم: ${user?.displayName ?? "زائر"}\n• اسم المستخدم: ${user?.username ?? "غير مسجل"}\n• رقم الحساب: ${user?.id ?? "غير متوفر"}\n\n*💎 الباقة المطلوبة*\n• ${plan.label}\n• السعر: ${formatSyp(plan.price)}\n• المدة: ${plan.durationMinutes} دقيقة\n\n*✅ أرجو تفعيل الباقة وإرسال كود الشحن* 🚀🇸🇾`;
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;
}

async function apiJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options);
  const data = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw new Error(data.error || "حدث خطأ غير متوقع");
  return data;
}

function StatCard({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.08] p-4 shadow-2xl shadow-black/10 backdrop-blur">
      <p className="text-xs text-slate-300">{label}</p>
      <p className={`mt-2 text-lg font-black ${tone ?? "text-white"}`}>{value}</p>
    </div>
  );
}

export default function HomePage() {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversation, setCurrentConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [mode, setMode] = useState<"login" | "register">("login");
  const [auth, setAuth] = useState({ username: "", displayName: "", password: "", remember: true });
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [redeemCode, setRedeemCode] = useState("");
  const [tick, setTick] = useState(0);

  const [adminOverview, setAdminOverview] = useState<AdminOverview | null>(null);
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);
  const [adminConversations, setAdminConversations] = useState<Conversation[]>([]);
  const [adminConversation, setAdminConversation] = useState<Conversation | null>(null);
  const [adminMessages, setAdminMessages] = useState<ChatMessage[]>([]);
  const [adminReply, setAdminReply] = useState("");
  const [editMessage, setEditMessage] = useState<{ id: string; content: string } | null>(null);
  const [codePlan, setCodePlan] = useState<PlanKey>("day");
  const [codeQuantity, setCodeQuantity] = useState(1);
  const [generatedCodes, setGeneratedCodes] = useState<AdminCode[]>([]);

  const bottomRef = useRef<HTMLDivElement | null>(null);

  const isAdmin = user?.role === "admin";
  const proActive = Boolean(usage?.proActive || isAdmin);

  const usageLabel = useMemo(() => {
    if (!usage) return "...";
    if (proActive) return `Pro مفتوح • متبقي: ${timeLeft(usage.subscriptionEndsAt)}`;
    return `${usage.remainingToday ?? 0}/${usage.freeDailyLimit} رسائل مجانية متبقية اليوم`;
  }, [usage, proActive, tick]);

  async function refreshMe(loadLatestChat = true) {
    const data = await apiJson<{ user: PublicUser | null; usage?: Usage; conversations?: Conversation[] }>("/api/me");
    setUser(data.user);
    setUsage(data.usage ?? null);
    setConversations(data.conversations ?? []);
    if (data.user && loadLatestChat) {
      const first = data.conversations?.[0];
      if (first) await loadChat(first.id);
      else {
        setCurrentConversation(null);
        setMessages([]);
      }
    }
    if (data.user?.role === "admin") await loadAdminOverview();
  }

  async function loadChat(conversationId?: string) {
    const query = conversationId ? `?conversationId=${encodeURIComponent(conversationId)}` : "";
    const data = await apiJson<{ conversation: Conversation | null; messages: ChatMessage[]; usage: Usage }>(`/api/chat${query}`);
    setCurrentConversation(data.conversation);
    setMessages(data.messages);
    setUsage(data.usage);
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 30);
  }

  async function loadAdminOverview() {
    const data = await apiJson<AdminOverview>("/api/admin/overview");
    setAdminOverview(data);
  }

  async function loadAdminMessages(userId?: string, conversationId?: string) {
    const url = conversationId
      ? `/api/admin/messages?conversationId=${encodeURIComponent(conversationId)}`
      : `/api/admin/messages?userId=${encodeURIComponent(userId ?? "")}`;
    const data = await apiJson<{
      user: AdminUser | null;
      conversations?: Conversation[];
      conversation: Conversation | null;
      messages: ChatMessage[];
    }>(url);
    setAdminUser(data.user);
    setAdminConversations(data.conversations ?? adminConversations);
    setAdminConversation(data.conversation);
    setAdminMessages(data.messages);
  }

  useEffect(() => {
    refreshMe().catch(() => undefined);
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => setTick((value) => value + 1), 1000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  async function submitAuth(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setNotice("");
    try {
      const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/register";
      const data = await apiJson<{ user: PublicUser; usage: Usage }>(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(auth),
      });
      setUser(data.user);
      setUsage(data.usage);
      setNotice("");
      setBusy(false);
      void refreshMe(false).catch(() => undefined);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "تعذر الدخول");
      setBusy(false);
    }
  }

  async function logout() {
    await apiJson("/api/auth/logout", { method: "POST" });
    setUser(null);
    setUsage(null);
    setMessages([]);
    setConversations([]);
    setCurrentConversation(null);
    setAdminOverview(null);
  }

  async function sendMessage(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setNotice("");
    try {
      const formData = new FormData();
      formData.set("message", chatInput);
      if (currentConversation) formData.set("conversationId", currentConversation.id);
      if (file) formData.set("file", file);
      const data = await apiJson<{ conversation: Conversation; messages: ChatMessage[]; usage: Usage }>("/api/chat", {
        method: "POST",
        body: formData,
      });
      setCurrentConversation(data.conversation);
      setMessages(data.messages);
      setUsage(data.usage);
      setChatInput("");
      setFile(null);
      await refreshMe(false);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "تعذر إرسال الرسالة");
    } finally {
      setBusy(false);
    }
  }

  async function clearChat() {
    if (!currentConversation) return;
    setBusy(true);
    try {
      await apiJson(`/api/chat?conversationId=${currentConversation.id}`, { method: "DELETE" });
      setMessages([]);
      setCurrentConversation(null);
      setNotice("تم مسح السجل من حسابك فقط، وسيبقى ظاهراً في لوحة الإدارة مع إشعار حذف.");
      await refreshMe(false);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "تعذر مسح الدردشة");
    } finally {
      setBusy(false);
    }
  }

  async function redeem() {
    setBusy(true);
    setNotice("");
    try {
      const data = await apiJson<{ user: PublicUser; usage: Usage }>("/api/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: redeemCode }),
      });
      setUser(data.user);
      setUsage(data.usage);
      setRedeemCode("");
      setNotice("تم تفعيل باقة Pro بنجاح 💎");
      await refreshMe(false);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "تعذر تفعيل الكود");
    } finally {
      setBusy(false);
    }
  }

  async function generateCodes() {
    setBusy(true);
    try {
      const data = await apiJson<{ codes: AdminCode[] }>("/api/admin/codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planType: codePlan, quantity: codeQuantity }),
      });
      setGeneratedCodes(data.codes);
      await loadAdminOverview();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "تعذر توليد الأكواد");
    } finally {
      setBusy(false);
    }
  }

  async function saveEditedMessage() {
    if (!editMessage || !adminConversation) return;
    await apiJson("/api/admin/message", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messageId: editMessage.id, content: editMessage.content }),
    });
    setEditMessage(null);
    await loadAdminMessages(undefined, adminConversation.id);
  }

  async function sendAdminReply() {
    if (!adminConversation || !adminReply.trim()) return;
    await apiJson("/api/admin/message", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversationId: adminConversation.id, content: adminReply }),
    });
    setAdminReply("");
    await loadAdminMessages(undefined, adminConversation.id);
  }

  async function adminUserAction(action: "extend" | "expire", planType: PlanKey = "day") {
    if (!adminUser) return;
    await apiJson("/api/admin/user", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: adminUser.id, action, planType }),
    });
    await loadAdminOverview();
    await loadAdminMessages(adminUser.id);
  }

  return (
    <main dir="rtl" className="min-h-screen overflow-hidden bg-[#050816] text-white">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.32),transparent_32%),radial-gradient(circle_at_20%_20%,rgba(239,68,68,0.18),transparent_30%),linear-gradient(135deg,#050816_0%,#0f172a_55%,#111827_100%)]" />
      <div className="pointer-events-none fixed inset-0 opacity-[0.08] [background-image:linear-gradient(#fff_1px,transparent_1px),linear-gradient(90deg,#fff_1px,transparent_1px)] [background-size:44px_44px]" />

      <section className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 rounded-[2rem] border border-white/10 bg-white/[0.07] p-4 shadow-2xl shadow-emerald-950/30 backdrop-blur-xl md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <SyriaFlag />
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.28em] text-emerald-300">بوابة ذكية مدمجة للعمل داخل سوريا</p>
              <h1 className="mt-1 text-2xl font-black md:text-4xl">دردشة الذكاء الاصطناعي في سوريا</h1>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-4 py-2 text-emerald-100">🛡️ VPN خادمي/بوابة وسيطة مفعّلة</span>
            {user ? (
              <>
                <span className="rounded-full border border-white/10 bg-white/10 px-4 py-2">مرحباً {user.displayName}</span>
                <button onClick={logout} className="rounded-full bg-white px-4 py-2 font-bold text-slate-950 transition hover:bg-emerald-200">خروج</button>
              </>
            ) : null}
          </div>
        </header>

        {!user ? (
          <div className="grid flex-1 items-center gap-8 lg:grid-cols-[1.15fr_0.85fr]">
            <section className="rounded-[2.5rem] border border-white/10 bg-white/[0.07] p-7 shadow-2xl shadow-black/30 backdrop-blur-xl md:p-10">
              <div className="mb-6 inline-flex rounded-full border border-emerald-300/20 bg-emerald-300/10 px-4 py-2 text-sm text-emerald-100">🇸🇾 واجهة عربية احترافية • بدون VPN على جهاز المستخدم</div>
              <h2 className="text-4xl font-black leading-tight md:text-6xl">اسأل، ارفع ملفاتك مع Pro، واحصل على إجابات ذكية عميقة.</h2>
              <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-300">التطبيق يعمل عبر خادم وسيط مدمج: المستخدم يفتح الموقع فقط، والدردشة تمر من الخادم بواجهة سريعة وآمنة مع باقات مرنة وتجربة Pro متقدمة.</p>
              <div className="mt-8 grid gap-4 sm:grid-cols-3">
                <StatCard label="المجاني" value="10 رسائل/يوم" />
                <StatCard label="Pro" value="رسائل ومرفقات مفتوحة" tone="text-emerald-300" />
                <StatCard label="الاتصال" value="بوابة خادمية مدمجة" tone="text-sky-200" />
              </div>
            </section>

            <form onSubmit={submitAuth} className="rounded-[2.5rem] border border-white/10 bg-slate-950/70 p-6 shadow-2xl shadow-emerald-950/40 backdrop-blur-xl">
              <div className="mb-6 flex rounded-2xl bg-white/10 p-1">
                <button type="button" onClick={() => setMode("login")} className={`flex-1 rounded-xl px-4 py-3 font-bold transition ${mode === "login" ? "bg-emerald-400 text-slate-950" : "text-slate-300"}`}>تسجيل الدخول</button>
                <button type="button" onClick={() => setMode("register")} className={`flex-1 rounded-xl px-4 py-3 font-bold transition ${mode === "register" ? "bg-emerald-400 text-slate-950" : "text-slate-300"}`}>إنشاء حساب</button>
              </div>
              <label className="mb-3 block text-sm text-slate-300">اسم المستخدم</label>
              <input value={auth.username} onChange={(e) => setAuth({ ...auth, username: e.target.value })} className="mb-4 w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 outline-none ring-emerald-400/40 transition focus:ring-4" placeholder="اكتب اسم المستخدم" />
              {mode === "register" ? (
                <>
                  <label className="mb-3 block text-sm text-slate-300">الاسم الظاهر</label>
                  <input value={auth.displayName} onChange={(e) => setAuth({ ...auth, displayName: e.target.value })} className="mb-4 w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 outline-none ring-emerald-400/40 transition focus:ring-4" placeholder="اسمك" />
                </>
              ) : null}
              <label className="mb-3 block text-sm text-slate-300">كلمة المرور</label>
              <input type="password" value={auth.password} onChange={(e) => setAuth({ ...auth, password: e.target.value })} className="mb-4 w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 outline-none ring-emerald-400/40 transition focus:ring-4" placeholder="••••••••" />
              <label className="mb-6 flex cursor-pointer items-center gap-3 text-sm text-slate-300">
                <input type="checkbox" checked={auth.remember} onChange={(e) => setAuth({ ...auth, remember: e.target.checked })} className="h-5 w-5 accent-emerald-400" />
                تذكرني على هذا الجهاز
              </label>
              <button disabled={busy} className="w-full rounded-2xl bg-gradient-to-l from-emerald-400 to-lime-300 px-5 py-4 font-black text-slate-950 shadow-xl shadow-emerald-500/20 transition hover:scale-[1.01] disabled:opacity-60">{busy ? "جارٍ التنفيذ..." : mode === "login" ? "دخول الآن" : "إنشاء الحساب"}</button>
              {notice ? <p className="mt-4 rounded-2xl border border-red-300/20 bg-red-400/10 p-3 text-sm text-red-100">{notice}</p> : null}
            </form>
          </div>
        ) : (
          <div className="grid flex-1 gap-6 xl:grid-cols-[290px_minmax(0,1fr)_360px]">
            <aside className="space-y-4 rounded-[2rem] border border-white/10 bg-white/[0.07] p-4 backdrop-blur-xl">
              <div className="rounded-3xl bg-gradient-to-br from-emerald-400/20 to-white/5 p-4">
                <p className="text-sm text-slate-300">حالة حسابك</p>
                <h2 className="mt-1 text-xl font-black">{proActive ? "💎 Pro / مفتوح" : "🆓 مجاني"}</h2>
                <p className="mt-2 text-sm leading-6 text-emerald-100">{usageLabel}</p>
              </div>
              <button onClick={() => { setCurrentConversation(null); setMessages([]); }} className="w-full rounded-2xl bg-emerald-400 px-4 py-3 font-black text-slate-950">+ محادثة جديدة</button>
              <div>
                <p className="mb-3 text-sm font-bold text-slate-300">سجل الدردشة</p>
                <div className="max-h-72 space-y-2 overflow-auto pr-1">
                  {conversations.length === 0 ? <p className="rounded-2xl bg-white/5 p-3 text-sm text-slate-400">لا يوجد سجل بعد.</p> : null}
                  {conversations.map((conversation) => (
                    <button key={conversation.id} onClick={() => loadChat(conversation.id)} className={`w-full rounded-2xl border p-3 text-right text-sm transition ${currentConversation?.id === conversation.id ? "border-emerald-300 bg-emerald-300/15" : "border-white/10 bg-white/5 hover:bg-white/10"}`}>
                      <span className="line-clamp-1 font-bold">{conversation.title}</span>
                      <span className="mt-1 block text-xs text-slate-400">{new Date(conversation.updatedAt).toLocaleString("ar-SY")}</span>
                    </button>
                  ))}
                </div>
              </div>
              {currentConversation ? <button onClick={clearChat} disabled={busy} className="w-full rounded-2xl border border-red-300/30 bg-red-500/10 px-4 py-3 font-bold text-red-100">مسح الدردشة من حسابي</button> : null}
            </aside>

            <section className="flex min-h-[680px] flex-col rounded-[2rem] border border-white/10 bg-slate-950/60 shadow-2xl shadow-black/30 backdrop-blur-xl">
              <div className="border-b border-white/10 p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-2xl font-black">المساعد الذكي السوري</h2>
                    <p className="mt-1 text-sm text-slate-400">الردود النصية متاحة للجميع، والمرفقات والردود العميقة لمشتركي Pro.</p>
                  </div>
                  <span className="rounded-full bg-emerald-400/10 px-4 py-2 text-sm text-emerald-200">● اتصال نشط عبر الخادم</span>
                </div>
              </div>
              <div className="flex-1 space-y-4 overflow-auto p-5">
                {messages.length === 0 ? (
                  <div className="grid h-full place-items-center text-center">
                    <div>
                      <div className="mx-auto mb-4 grid h-20 w-20 place-items-center rounded-3xl bg-emerald-400/15 text-4xl">🤖</div>
                      <h3 className="text-2xl font-black">ابدأ محادثتك الآن</h3>
                      <p className="mt-2 max-w-lg text-slate-400">اسأل أي سؤال. إن كنت Pro يمكنك إرفاق صورة أو ملف أو فيديو وطلب التحليل أو اقتراح التعديل.</p>
                    </div>
                  </div>
                ) : null}
                {messages.map((message) => (
                  <div key={message.id} className={`flex ${message.role === "user" ? "justify-start" : "justify-end"}`}>
                    <div className={`max-w-[85%] rounded-[1.5rem] p-4 shadow-lg ${message.role === "user" ? "bg-white text-slate-950" : "bg-gradient-to-br from-emerald-500 to-lime-300 text-slate-950"}`}>
                      <p className="whitespace-pre-wrap leading-8">{message.content}</p>
                      {message.attachmentMeta ? <p className="mt-3 rounded-xl bg-slate-950/10 px-3 py-2 text-xs">📎 {message.attachmentMeta.name}</p> : null}
                      <p className="mt-2 text-xs opacity-60">{message.source === "admin-live" || message.source === "admin-edited" ? "AI" : message.role === "assistant" ? "AI" : "أنت"}</p>
                    </div>
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>
              <form onSubmit={sendMessage} className="border-t border-white/10 p-4">
                {notice ? <p className="mb-3 rounded-2xl bg-amber-400/10 p-3 text-sm text-amber-100">{notice}</p> : null}
                {file ? <p className="mb-3 rounded-2xl bg-emerald-400/10 p-3 text-sm text-emerald-100">📎 {file.name} <button type="button" onClick={() => setFile(null)} className="mr-2 text-red-200">إزالة</button></p> : null}
                <div className="flex flex-col gap-3 md:flex-row">
                  <label className={`grid cursor-pointer place-items-center rounded-2xl border px-4 py-3 font-bold ${proActive ? "border-emerald-300/30 bg-emerald-300/10 text-emerald-100" : "border-white/10 bg-white/5 text-slate-500"}`}>
                    📎
                    <input disabled={!proActive} type="file" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                  </label>
                  <input value={chatInput} onChange={(e) => setChatInput(e.target.value)} className="min-h-14 flex-1 rounded-2xl border border-white/10 bg-white/10 px-4 outline-none ring-emerald-400/40 transition focus:ring-4" placeholder="اكتب سؤالك هنا..." />
                  <button disabled={busy} className="rounded-2xl bg-emerald-400 px-8 py-3 font-black text-slate-950 disabled:opacity-60">إرسال</button>
                </div>
              </form>
            </section>

            <aside className="space-y-4 rounded-[2rem] border border-white/10 bg-white/[0.07] p-4 backdrop-blur-xl">
              <div>
                <h3 className="text-xl font-black">الباقات والشحن</h3>
                <p className="mt-1 text-sm text-slate-400">اختر باقة وسيتم فتح واتساب برسالة جاهزة لرقم الإدارة.</p>
              </div>
              <div className="grid gap-3">
                {planEntries.map(([key, plan]) => (
                  <a key={key} target="_blank" rel="noreferrer" href={makeWhatsappUrl(user, key)} className="rounded-3xl border border-white/10 bg-white/5 p-4 transition hover:border-emerald-300/50 hover:bg-emerald-300/10">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-black">{plan.badge}</p>
                      <p className="text-emerald-200">{formatSyp(plan.price)}</p>
                    </div>
                    <p className="mt-2 text-sm text-slate-400">اطلب الشحن عبر واتساب</p>
                  </a>
                ))}
              </div>
              <div className="rounded-3xl border border-emerald-300/20 bg-emerald-300/10 p-4">
                <p className="mb-3 font-bold">تفعيل كود الشحن</p>
                <input value={redeemCode} onChange={(e) => setRedeemCode(e.target.value)} className="mb-3 w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 outline-none" placeholder="SYAI-DAY-XXXX" />
                <button onClick={redeem} disabled={busy} className="w-full rounded-2xl bg-white px-4 py-3 font-black text-slate-950">تفعيل</button>
              </div>
              <div className="rounded-3xl bg-white/5 p-4 text-sm leading-7 text-slate-300">
                <b className="text-white">ملاحظة تقنية:</b> لا يمكن للمتصفح تشغيل VPN حقيقي داخل ملف HTML، لذلك تم تنفيذ بوابة اتصال خادمية مدمجة تجعل المستخدم لا يحتاج VPN على جهازه لاستخدام الدردشة داخل التطبيق.
              </div>
            </aside>
          </div>
        )}

        {isAdmin ? (
          <section className="relative rounded-[2.5rem] border border-red-300/20 bg-red-950/20 p-5 shadow-2xl shadow-red-950/20 backdrop-blur-xl">
            <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-bold text-red-200">لوحة الإدارة</p>
                <h2 className="text-3xl font-black">إدارة النظام والاشتراكات</h2>
              </div>
              <button onClick={loadAdminOverview} className="rounded-2xl bg-red-200 px-5 py-3 font-black text-red-950">تحديث اللوحة</button>
            </div>
            <div className="grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)_360px]">
              <div className="rounded-3xl border border-white/10 bg-slate-950/50 p-4">
                <h3 className="mb-3 font-black">المشتركين</h3>
                <div className="max-h-[520px] space-y-2 overflow-auto">
                  {adminOverview?.users.map((item) => (
                    <button key={item.id} onClick={() => loadAdminMessages(item.id)} className={`w-full rounded-2xl border p-3 text-right transition ${adminUser?.id === item.id ? "border-red-200 bg-red-200/10" : "border-white/10 bg-white/5"}`}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold">{item.displayName}</span>
                        <span className={`h-3 w-3 rounded-full ${item.isOnline ? "bg-emerald-400 shadow-[0_0_16px_#34d399]" : "bg-slate-500"}`} />
                      </div>
                      <p className="mt-1 text-xs text-slate-400">@{item.username} • {item.planLabel}</p>
                      <p className="mt-1 text-xs text-slate-500">{item.isOnline ? "نشط الآن" : `خامل • ${new Date(item.lastSeenAt).toLocaleString("ar-SY")}`}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-slate-950/50 p-4">
                <div className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h3 className="font-black">رسائل المستخدم</h3>
                    <p className="text-sm text-slate-400">{adminUser ? `${adminUser.displayName} @${adminUser.username}` : "اختر مستخدماً من القائمة"}</p>
                  </div>
                  {adminUser ? (
                    <div className="flex flex-wrap gap-2">
                      <button onClick={() => adminUserAction("extend", "day")} className="rounded-xl bg-emerald-300 px-3 py-2 text-sm font-bold text-slate-950">تمديد يوم</button>
                      <button onClick={() => adminUserAction("expire")} className="rounded-xl bg-red-300 px-3 py-2 text-sm font-bold text-red-950">إنهاء Pro</button>
                    </div>
                  ) : null}
                </div>
                <div className="mb-3 flex gap-2 overflow-auto pb-2">
                  {adminConversations.map((conversation) => (
                    <button key={conversation.id} onClick={() => loadAdminMessages(undefined, conversation.id)} className={`shrink-0 rounded-xl border px-3 py-2 text-sm ${adminConversation?.id === conversation.id ? "border-emerald-300 bg-emerald-300/10" : "border-white/10 bg-white/5"}`}>
                      {conversation.adminNotifiedClear ? "🧹 " : ""}{conversation.title.slice(0, 18)}
                    </button>
                  ))}
                </div>
                <div className="max-h-[520px] space-y-3 overflow-auto rounded-2xl bg-black/20 p-3">
                  {adminMessages.map((message) => (
                    <div key={message.id} className={`rounded-2xl p-3 ${message.role === "assistant" ? "bg-emerald-300/10" : "bg-white/10"}`}>
                      <div className="mb-2 flex items-center justify-between gap-3 text-xs text-slate-400">
                        <span>{message.role === "assistant" ? `المساعد (${message.source})` : "المستخدم"}</span>
                        <span>{new Date(message.createdAt).toLocaleString("ar-SY")}</span>
                      </div>
                      {editMessage?.id === message.id ? (
                        <div className="space-y-2">
                          <textarea value={editMessage.content} onChange={(e) => setEditMessage({ ...editMessage, content: e.target.value })} className="min-h-28 w-full rounded-xl bg-slate-950 p-3 outline-none" />
                          <div className="flex gap-2">
                            <button onClick={saveEditedMessage} className="rounded-xl bg-emerald-300 px-3 py-2 font-bold text-slate-950">حفظ</button>
                            <button onClick={() => setEditMessage(null)} className="rounded-xl bg-white/10 px-3 py-2 font-bold">إلغاء</button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <p className="whitespace-pre-wrap leading-7">{message.content}</p>
                          {message.attachmentMeta ? <p className="mt-2 rounded-xl bg-white/10 p-2 text-xs">📎 {message.attachmentMeta.name}</p> : null}
                          {message.role === "assistant" ? <button onClick={() => setEditMessage({ id: message.id, content: message.content })} className="mt-3 rounded-xl bg-white px-3 py-2 text-sm font-bold text-slate-950">تعديل إجابة AI</button> : null}
                        </>
                      )}
                    </div>
                  ))}
                </div>
                {adminConversation ? (
                  <div className="mt-3 rounded-2xl bg-white/5 p-3">
                    <textarea value={adminReply} onChange={(e) => setAdminReply(e.target.value)} className="min-h-24 w-full rounded-xl bg-slate-950 p-3 outline-none" placeholder="اكتب رداً سيظهر للمستخدم كأنه من الذكاء الاصطناعي..." />
                    <button onClick={sendAdminReply} className="mt-2 w-full rounded-xl bg-emerald-300 px-4 py-3 font-black text-slate-950">إرسال كـ AI</button>
                  </div>
                ) : null}
              </div>

              <div className="space-y-4 rounded-3xl border border-white/10 bg-slate-950/50 p-4">
                <h3 className="font-black">توليد أكواد الشحن</h3>
                <select value={codePlan} onChange={(e) => setCodePlan(e.target.value as PlanKey)} className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 outline-none">
                  {planEntries.map(([key, plan]) => <option key={key} value={key}>{plan.label} - {formatSyp(plan.price)}</option>)}
                </select>
                <input type="number" min={1} max={50} value={codeQuantity} onChange={(e) => setCodeQuantity(Number(e.target.value))} className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 outline-none" />
                <button onClick={generateCodes} className="w-full rounded-2xl bg-red-200 px-4 py-3 font-black text-red-950">توليد الأكواد</button>
                {generatedCodes.length ? (
                  <div className="rounded-2xl bg-emerald-300/10 p-3">
                    <p className="mb-2 font-bold text-emerald-100">الأكواد الجديدة</p>
                    <div className="space-y-2">
                      {generatedCodes.map((code) => <p key={code.id} className="rounded-xl bg-black/30 p-2 font-mono text-sm text-emerald-200">{code.code}</p>)}
                    </div>
                  </div>
                ) : null}
                <div className="rounded-2xl bg-white/5 p-3">
                  <p className="mb-2 font-bold text-slate-200">مفتاح API للذكاء الاصطناعي</p>
                  <input id="api-key-input" type="text" className="w-full p-2 mb-2 bg-black/50 rounded-lg text-sm font-mono" placeholder="sk-or-v1-..." />
                  <button onClick={async () => {
                    const el = document.getElementById("api-key-input") as HTMLInputElement;
                    const key = el?.value;
                    if(key) {
                        await apiJson("/api/admin/settings", { method: "POST", body: JSON.stringify({ apiKey: key }) });
                        alert("تم حفظ المفتاح");
                    }
                  }} className="w-full bg-emerald-500 rounded-lg p-2 text-sm font-bold text-black">حفظ المفتاح</button>
                  <script dangerouslySetInnerHTML={{__html: `
                    fetch('/api/admin/settings').then(r=>r.json()).then(d=>{
                        const el = document.getElementById('api-key-input');
                        if(el) el.value = d.apiKey;
                    });
                  `}} />
                </div>
                <div>
                  <p className="mb-2 font-bold">آخر الأكواد</p>
                  <div className="max-h-72 space-y-2 overflow-auto">
                    {adminOverview?.codes.map((code) => (
                      <div key={code.id} className="rounded-2xl bg-white/5 p-3 text-sm">
                        <p className="font-mono text-emerald-200">{code.code}</p>
                        <p className="mt-1 text-slate-400">{code.planType} • {formatSyp(code.price)} • {code.status === "available" ? "متاح" : "مستخدم"}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>
        ) : null}
      </section>
    </main>
  );
}
