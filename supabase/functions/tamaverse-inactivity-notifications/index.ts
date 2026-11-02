import { createClient } from "npm:@supabase/supabase-js@2";
const url = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN3")!;
const cronSecret = Deno.env.get("TAMAVERSE_NOTIFICATION_CRON_SECRET")!;
const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const escapeHtml = (v: unknown) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

async function sendTelegram(chatId: string, message: string) {
  const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId, text: message, parse_mode: "HTML", disable_web_page_preview: true,
      reply_markup: { inline_keyboard: [[{ text: "🌈 Back to Tamaverse", web_app: { url: "https://raihan0718.github.io/tamaverse/" } }]] }
    })
  });
  const result = await response.json();
  if (!response.ok || !result.ok) throw new Error("TELEGRAM_DELIVERY_FAILED");
}

Deno.serve(async req => {
  if (req.method !== "POST") return Response.json({ error: "METHOD_NOT_ALLOWED" }, { status: 405 });
  if (!cronSecret || req.headers.get("x-tamaverse-cron-secret") !== cronSecret) return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });
  if (!botToken || !serviceKey) return Response.json({ error: "NOT_CONFIGURED" }, { status: 500 });
  try {
    const body = await req.json().catch(() => ({}));
    const testMode = body?.mode === "test";
    const testUsername = typeof body?.test_username === "string" ? body.test_username.trim().replace(/^@/, "") : "";
    if (testMode && !testUsername) return Response.json({ error: "TEST_USERNAME_REQUIRED" }, { status: 400 });
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    let query = admin.from("tamaverse_telegram_links").select("owner_id, telegram_user_id, telegram_username").not("bot_started_at", "is", null);
    if (testMode) query = query.ilike("telegram_username", testUsername);
    else query = query.not("last_login_at", "is", null).lt("last_login_at", cutoff);
    const { data: links, error } = await query;
    if (error) throw error;
    if (testMode && (links ?? []).length !== 1) return Response.json({ error: "TEST_ACCOUNT_NOT_FOUND_OR_NOT_UNIQUE" }, { status: 404 });
    let sent = 0, skipped = 0;
    const errors: string[] = [];
    for (const link of links ?? []) {
      if (!testMode) {
        const { data: claimed, error: claimError } = await admin.rpc("claim_tamaverse_inactivity_notification", { p_owner_id: link.owner_id });
        if (claimError) { errors.push("COOLDOWN_CLAIM_FAILED"); continue; }
        if (claimed !== true) { skipped++; continue; }
      }
      const { data: result } = await admin.auth.admin.getUserById(link.owner_id);
      const name = result?.user?.user_metadata?.display_name || result?.user?.user_metadata?.full_name || "Tama Pal";
      const message = testMode
        ? ["🧪 <b>Tamaverse notification test</b>", "", `Hiii, ${escapeHtml(name)}! 🐣💗`, "This is a private test message. Your inactivity reminder connection is working! ✨"].join("\n")
        : [
            "🌙 <b>A little note from Tamaverse!</b>", "",
            `Hiii, ${escapeHtml(name)}! 🐣💗`,
            "It's been a little while since your last visit...",
            "Your little world is waiting for you, and your companions would love to see you again! ✨", "",
            "Drop by whenever you're ready. Let's make more lovely memories together! 🌷"
          ].join("\n");
      try { await sendTelegram(String(link.telegram_user_id), message); sent++; }
      catch { errors.push("TELEGRAM_DELIVERY_FAILED"); }
    }
    return Response.json({ ok: true, sent, skipped, errors });
  } catch (error) {
    console.error("Inactivity notification run failed", error);
    return Response.json({ error: "NOTIFICATION_RUN_FAILED" }, { status: 500 });
  }
});
