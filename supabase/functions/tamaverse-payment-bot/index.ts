import { createClient } from "npm:@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN2")!;
const adminId = Deno.env.get("TELEGRAM_ADMIN_ID")!;
const webhookSecret = Deno.env.get("TELEGRAM_WEBHOOK_SECRET")!;
const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
const api = (method: string) => `https://api.telegram.org/bot${botToken}/${method}`;

async function telegram(method: string, body: Record<string, unknown>) {
  const res = await fetch(api(method), {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok || !data.ok) throw new Error(data.description || "Telegram API error");
  return data.result;
}
async function say(chatId: number | string, text: string, extra: Record<string, unknown> = {}) {
  return telegram("sendMessage", { chat_id: chatId, text, ...extra });
}
const money = (n: number) => new Intl.NumberFormat("id-ID").format(n);
const isAdmin = (id: number) => String(id) === adminId;
const packages: Record<string, { label: string; diamonds: number }> = {
  "1": { label: "Starter", diamonds: 50 },
  "2": { label: "Popular", diamonds: 120 },
  "3": { label: "Value Pack", diamonds: 300 },
  "4": { label: "Mega Pack", diamonds: 700 },
};
const help = `NEXORA • TAMAVERSE DIAMOND TOP-UP

/link KODE — hubungkan akun game
/buy — buat tiket top-up
/proof ORDER_ID — kirim bukti pembayaran dengan foto

Pilih paket:
/buy 1 — 50 Diamonds
/buy 2 — 120 Diamonds
/buy 3 — 300 Diamonds
/buy 4 — 700 Diamonds

Pembayaran diproses manual oleh admin. Jangan kirim data rahasia atau PIN.`;

async function handleMessage(m: any) {
  const chatId = m.chat?.id;
  const telegramId = String(m.from?.id ?? "");
  const username = m.from?.username ?? "";
  const text = String(m.text ?? m.caption ?? "").trim();
  if (!chatId || !telegramId || m.chat?.type !== "private") return;

  if (text.startsWith("/start") || text === "/help") {
    await say(chatId, help);
    return;
  }

  if (text.startsWith("/link")) {
    const code = text.split(/\s+/)[1];
    if (!code) { await say(chatId, "Format: /link KODE\nBuat kode dari menu Profile Tamaverse. Kode berlaku 10 menit."); return; }
    const { data, error } = await db.rpc("consume_tamaverse_telegram_link_code", {
      p_code: code, p_telegram_user_id: telegramId, p_telegram_username: username,
    });
    if (error) { await say(chatId, "Gagal menghubungkan akun: " + error.message); return; }
    await say(chatId, "Akun Tamaverse berhasil dihubungkan. Sekarang gunakan /buy untuk membuat tiket.");
    return;
  }

  if (text.startsWith("/buy")) {
    const choice = text.split(/\s+/)[1];
    if (!choice) {
      await say(chatId, "Pilih paket dengan perintah berikut:\n/buy 1 — 50 Diamonds\n/buy 2 — 120 Diamonds\n/buy 3 — 300 Diamonds\n/buy 4 — 700 Diamonds");
      return;
    }
    const pack = packages[choice];
    if (!pack) { await say(chatId, "Paket tidak valid. Gunakan /buy untuk melihat pilihan."); return; }
    const packageId = ({ "1": "starter_50", "2": "popular_120", "3": "value_300", "4": "mega_700" } as Record<string,string>)[choice];
    const { data, error } = await db.rpc("create_tamaverse_diamond_order", {
      p_telegram_user_id: telegramId, p_package_id: packageId,
    });
    if (error) { await say(chatId, error.message.includes("TELEGRAM_NOT_LINKED") ? "Akun belum terhubung. Buat kode di Profile Tamaverse, lalu kirim /link KODE." : "Tiket gagal dibuat: " + error.message); return; }
    await say(chatId, `Tiket berhasil dibuat!\nOrder: ${data.id}\nPaket: ${pack.label}\nDiamond: ${pack.diamonds}\nStatus: Menunggu admin\n\nAdmin akan mengirim nominal dan instruksi pembayaran di chat ini. Jangan membayar sebelum menerima instruksi.`);
    await say(adminId, `TIKET DIAMOND BARU\nOrder: ${data.id}\nTelegram: ${telegramId} (@${username || "-"})\nPaket: ${pack.label} — ${pack.diamonds} Diamonds\n\nAtur harga: /price ${data.id} NOMINAL_RUPIAH`);
    return;
  }

  if (text.startsWith("/proof")) {
    const orderId = text.split(/\s+/)[1];
    const photos = m.photo;
    if (!orderId || !photos?.length) {
      await say(chatId, "Kirim foto bukti dengan caption:\n/proof ORDER_ID\nPastikan order sudah menerima instruksi pembayaran.");
      return;
    }
    const fileId = photos[photos.length - 1].file_id;
    const { data, error } = await db.rpc("submit_tamaverse_diamond_proof", {
      p_order_id: orderId, p_telegram_user_id: telegramId, p_file_id: fileId,
    });
    if (error) { await say(chatId, "Bukti belum bisa dikirim: " + error.message); return; }
    await say(chatId, "Bukti diterima. Admin akan memeriksa transaksi secara manual. Diamond belum ditambahkan.");
    await say(adminId, `BUKTI PEMBAYARAN MASUK\nOrder: ${data.id}\nTelegram: ${telegramId}\nNominal: Rp${money(data.amount_idr)}\nDiamond: ${data.diamonds}\n\nPeriksa transaksi di dashboard pembayaran. Setelah benar, gunakan /paid ${data.id}`);
    await telegram("sendPhoto", { chat_id: adminId, photo: fileId, caption: `Bukti order ${data.id} dari Telegram ${telegramId}` });
    return;
  }

  if (isAdmin(Number(telegramId))) {
    const parts = text.split(/\s+/);
    const command = parts[0];
    if (command === "/price") {
      const orderId = parts[1]; const amount = Number(parts[2]);
      if (!orderId || !Number.isSafeInteger(amount) || amount < 1) { await say(chatId, "Format: /price ORDER_ID NOMINAL_RUPIAH"); return; }
      const { data, error } = await db.rpc("set_tamaverse_diamond_order_payment", {
        p_order_id: orderId, p_amount_idr: amount, p_admin_note: null,
      });
      if (error) { await say(chatId, "Gagal mengatur harga: " + error.message); return; }
      await say(data.telegram_user_id, `Instruksi pembayaran Tamaverse\nOrder: ${data.id}\nDiamond: ${data.diamonds}\nTotal: Rp${money(data.amount_idr)}\n\nSilakan hubungi admin untuk QRIS/instruksi pembayaran. Setelah membayar, kirim foto dengan caption /proof ${data.id}. Jangan kirim PIN atau OTP.`);
      await say(chatId, "Nominal tersimpan. Silakan kirim instruksi QRIS secara manual ke pemain.");
      return;
    }
    if (command === "/paid") {
      const orderId = parts[1];
      if (!orderId) { await say(chatId, "Format: /paid ORDER_ID"); return; }
      const { data, error } = await db.rpc("approve_tamaverse_diamond_order", { p_order_id: orderId });
      if (error) { await say(chatId, "Kredit gagal: " + error.message); return; }
      await say(data.telegram_user_id, `Pembayaran terverifikasi. ${data.diamonds} Diamonds telah ditambahkan ke akun Tamaverse kamu.\nOrder: ${orderId}`);
      await say(chatId, `Order ${orderId} selesai. ${data.diamonds} Diamonds dikreditkan.`);
      return;
    }
    if (command === "/check") {
      const orderId = parts[1];
      if (!orderId) { await say(chatId, "Format: /check ORDER_ID"); return; }
      const { data, error } = await db.from("diamond_orders").select("*").eq("id", orderId).maybeSingle();
      if (error || !data) { await say(chatId, "Order tidak ditemukan."); return; }
      await say(chatId, `Order: ${data.id}\nPlayer UUID: ${data.owner_id}\nTelegram: ${data.telegram_user_id}\nDiamond: ${data.diamonds}\nNominal: ${data.amount_idr ? "Rp" + money(data.amount_idr) : "belum diatur"}\nStatus: ${data.status}`);
      if (data.proof_file_id) await telegram("sendPhoto", { chat_id: chatId, photo: data.proof_file_id, caption: `Bukti order ${data.id}` });
      return;
    }
    if (command === "/cancel") {
      const orderId = parts[1];
      if (!orderId) { await say(chatId, "Format: /cancel ORDER_ID"); return; }
      const { data, error } = await db.rpc("set_tamaverse_diamond_order_status", { p_order_id: orderId, p_status: "cancelled" });
      if (error) { await say(chatId, "Gagal membatalkan: " + error.message); return; }
      await say(data.telegram_user_id, `Order ${orderId} dibatalkan oleh admin.`);
      await say(chatId, "Order dibatalkan.");
      return;
    }
  }

  if (m.photo?.length && text.startsWith("/proof")) return;
  await say(chatId, "Perintah tidak dikenali. Ketik /help untuk panduan.");
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Tamaverse bot webhook ready", { status: 200 });
  if (req.headers.get("x-telegram-bot-api-secret-token") !== webhookSecret) {
    return new Response("Unauthorized", { status: 401 });
  }
  try {
    const update = await req.json();
    if (update.message) await handleMessage(update.message);
    return new Response("ok", { status: 200 });
  } catch (error) {
    console.error("Telegram webhook error:", error);
    return new Response("Webhook error", { status: 200 });
  }
});
