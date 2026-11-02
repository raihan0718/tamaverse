import { createClient } from "npm:@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN3")!;
const cronSecret = Deno.env.get("TAMAVERSE_NOTIFICATION_CRON_SECRET")!;
const admin = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});

const escapeHtml = (value: unknown) => String(value ?? "")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;");

function statusLine(label: string, emoji: string, value: number) {
  return `${emoji} <b>${label}:</b> ${Math.round(value)}%`;
}

async function sendTelegram(chatId: string, text: string) {
  const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
      reply_markup: {
        inline_keyboard: [[{
          text: "🌈 Open Tamaverse",
          web_app: { url: "https://raihan0718.github.io/tamaverse/" }
        }]]
      }
    })
  });
  const result = await response.json();
  if (!response.ok || !result.ok) {
    console.error("Pet-care Telegram delivery failed", result);
    throw new Error("TELEGRAM_DELIVERY_FAILED");
  }
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return Response.json({ error: "METHOD_NOT_ALLOWED" }, { status: 405 });
  if (!cronSecret || req.headers.get("x-tamaverse-cron-secret") !== cronSecret) {
    return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  if (!botToken || !serviceKey) {
    return Response.json({ error: "NOT_CONFIGURED" }, { status: 500 });
  }

  try {
    const { data: links, error: linksError } = await admin
      .from("tamaverse_telegram_links")
      .select("owner_id, telegram_user_id")
      .not("bot_started_at", "is", null);
    if (linksError) throw linksError;

    let sent = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const link of links ?? []) {
      const { data: pets, error: petsError } = await admin
        .from("pets")
        .select("nickname, hunger, happiness, cleanliness")
        .eq("owner_id", link.owner_id)
        .eq("is_active", true)
        .limit(1);
      if (petsError) {
        errors.push("PET_LOOKUP_FAILED");
        continue;
      }

      const activePet = (pets ?? [])[0];
      const needsCare = activePet && (
        Number(activePet.hunger) < 10 ||
        Number(activePet.happiness) < 10 ||
        Number(activePet.cleanliness) < 10
      ) ? [activePet] : [];
      if (!needsCare.length) {
        skipped++;
        continue;
      }

      const { data: claimed, error: claimError } = await admin.rpc(
        "claim_tamaverse_pet_care_notification",
        { p_owner_id: link.owner_id }
      );
      if (claimError) {
        errors.push("COOLDOWN_CLAIM_FAILED");
        continue;
      }
      if (claimed !== true) {
        skipped++;
        continue;
      }

      const petBlocks = needsCare.map(pet => {
        const lines = [`<b>🐾 ${escapeHtml(pet.nickname || "Your little buddy")}</b>`];
        if (Number(pet.hunger) < 10) lines.push(statusLine("Hunger", "🍓", Number(pet.hunger)));
        if (Number(pet.happiness) < 10) lines.push(statusLine("Mood", "🧸", Number(pet.happiness)));
        if (Number(pet.cleanliness) < 10) lines.push(statusLine("Bath", "🫧", Number(pet.cleanliness)));
        return lines.join("\n");
      });

      const message = [
        "🌷 <b>A tiny reminder from Tamaverse!</b>",
        "",
        "Hiii, Tama Pal! 🐣💗",
        "Your little companion needs some extra love and care~",
        "",
        petBlocks.join("\n\n"),
        "",
        "Come back and give your active companion some cuddly care! ✨",
        "🌙 Your Tamaverse friend misses you!"
      ].join("\n");

      try {
        await sendTelegram(String(link.telegram_user_id), message);
        sent++;
      } catch {
        errors.push("TELEGRAM_DELIVERY_FAILED");
      }
    }

    return Response.json({ ok: true, sent, skipped, errors });
  } catch (error) {
    console.error("Pet-care notification run failed", error);
    return Response.json({ error: "NOTIFICATION_RUN_FAILED" }, { status: 500 });
  }
});
