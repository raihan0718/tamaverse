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

/uuid UUID — hubungkan akun Tamaverse
/buy — buat tiket top-up
/proof ORDER_ID — kirim bukti pembayaran dengan foto

Pilih paket:
/buy 1 — 50 Diamonds
/buy 2 — 120 Diamonds
/buy 3 — 300 Diamonds
/buy 4 — 700 Diamonds

Pertama kali, kirim UUID dari menu Profile Tamaverse dengan format:
/uuid UUID_KAMU

Pembayaran diproses manual oleh admin. Jangan kirim data rahasia atau PIN.`;

async function handleCallback(q: any) {
  const id = String(q.from?.id ?? "");
  const chatId = q.message?.chat?.id;
  const payload = String(q.data ?? "");
  const answer = async (text: string) => {
    await telegram("answerCallbackQuery", { callback_query_id: q.id, text });
    if (chatId && q.message?.message_id) {
      try {
        await telegram("deleteMessage", { chat_id: chatId, message_id: q.message.message_id });
      } catch (error) {
        console.error("Could not delete previous button message:", error);
      }
    }
  };
  if (payload === "menu:home") {
    await answer("Menu utama");
    await say(chatId, "NEXORA PAY • TAMAVERSE", { reply_markup: { inline_keyboard: [
      [{ text: "💎 Top Up Diamond", callback_data: "menu:topup" }],
      [{ text: "🔗 Hubungkan UUID", callback_data: "menu:uuid" }],
      [{ text: "📋 Panduan", callback_data: "menu:help" }]
    ] } }); return;
  }
  if (payload === "menu:topup") {
    await answer("Pilih paket");
    await say(chatId, "PILIH NOMINAL DIAMOND", { reply_markup: { inline_keyboard: [
      [{ text: "50 Diamonds", callback_data: "pack:1" }, { text: "120 Diamonds", callback_data: "pack:2" }],
      [{ text: "300 Diamonds", callback_data: "pack:3" }, { text: "700 Diamonds", callback_data: "pack:4" }],
      [{ text: "⬅️ Kembali", callback_data: "menu:home" }]
    ] } }); return;
  }
  if (payload === "menu:uuid") { await answer("Hubungkan akun"); await say(chatId, "Kirim UUID Tamaverse dengan format:\n/uuid UUID_KAMU"); return; }
  if (payload === "menu:help") { await answer("Panduan"); await say(chatId, help, { reply_markup: { inline_keyboard: [[{ text: "💎 Top Up Diamond", callback_data: "menu:topup" }]] } }); return; }
  if (payload.startsWith("pack:")) {
    const choice = payload.split(":")[1], pack = packages[choice];
    if (!pack) { await answer("Paket tidak valid"); return; }
    if (id === adminId) { await answer("Admin tidak dapat membuat order pemain"); return; }
    const { data: link } = await db.from("tamaverse_telegram_links").select("owner_id").eq("telegram_user_id", id).maybeSingle();
    if (!link) { await answer("UUID belum terhubung"); await say(chatId, "UUID belum terdeteksi. Hubungkan akun dulu.", { reply_markup: { inline_keyboard: [[{ text: "🔗 Hubungkan UUID", callback_data: "menu:uuid" }]] } }); return; }
    await answer("Membuat tiket...");
    const packageId = ({ "1": "starter_50", "2": "popular_120", "3": "value_300", "4": "mega_700" } as Record<string,string>)[choice];
    const { data, error } = await db.rpc("create_tamaverse_diamond_order", { p_telegram_user_id: id, p_package_id: packageId });
    if (error) { await say(chatId, "Tiket gagal dibuat: " + error.message); return; }
    await say(chatId, `TIKET BERHASIL DIBUAT\nOrder: ${data.id}\nPaket: ${pack.label}\nDiamond: ${pack.diamonds}\nStatus: Menunggu instruksi pembayaran admin.\n\nJangan membayar sebelum menerima instruksi resmi.`);
    await say(adminId, `TIKET DIAMOND BARU\nOrder: ${data.id}\nTelegram: ${id}\nPaket: ${pack.label} — ${pack.diamonds} Diamonds\n\nPilih nominal pembayaran:`, { reply_markup: { inline_keyboard: [
      [5000,10000,15000].map(n => ({ text: "Rp" + money(n), callback_data: "price:" + data.id + ":" + n })),
      [20000,25000,50000].map(n => ({ text: "Rp" + money(n), callback_data: "price:" + data.id + ":" + n }))
    ] } }); return;
  }
  if (payload.startsWith("price:")) {
    if (id !== adminId) { await answer("Khusus admin"); return; }
    const [, orderId, raw] = payload.split(":"); const amount = Number(raw);
    if (![5000,10000,15000,20000,25000,50000].includes(amount)) { await answer("Nominal tidak valid"); return; }
    await answer("Menyimpan harga...");
    const { data, error } = await db.rpc("set_tamaverse_diamond_order_payment", { p_order_id: orderId, p_amount_idr: amount, p_admin_note: null });
    if (error) { await say(chatId, "Gagal mengatur harga: " + error.message); return; }
    await say(data.telegram_user_id, `INSTRUKSI PEMBAYARAN TAMAVERSE\nOrder: ${data.id}\nDiamond: ${data.diamonds}\nTotal: Rp${money(data.amount_idr)}\n\nIkuti instruksi pembayaran dari admin. Setelah membayar, kirim foto bukti dengan caption /proof ${data.id}. Jangan kirim PIN atau OTP.`);
    await say(chatId, `Harga tersimpan: Rp${money(amount)}\nOrder: ${orderId}\nKirim instruksi pembayaran secara manual.`);
    return;
  }
  await answer("Tombol tidak dikenali");
}

async function handleMessage(m: any) {
  const chatId = m.chat?.id;
  const telegramId = String(m.from?.id ?? "");
  const username = m.from?.username ?? "";
  const text = String(m.text ?? m.caption ?? "").trim();
  if (!chatId || !telegramId || m.chat?.type !== "private") return;

  if (text.startsWith("/start") || text === "/help") {
    await say(chatId, "NEXORA PAY • TAMAVERSE\n\nSelamat datang! Pilih menu:", { reply_markup: { inline_keyboard: [
      [{ text: "💎 Top Up Diamond", callback_data: "menu:topup" }],
      [{ text: "🔗 Hubungkan UUID", callback_data: "menu:uuid" }],
      [{ text: "📋 Panduan", callback_data: "menu:help" }]
    ] } });
    return;
  }

  if (text.startsWith("/uuid")) {
    const uuid = text.split(/\s+/)[1]?.trim();
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuid || !uuidPattern.test(uuid)) {
      await say(chatId, "UUID belum terdeteksi atau formatnya salah.\nBuka Tamaverse > Profile, salin TAMAVERSE USER ID, lalu kirim:\n/uuid UUID_KAMU");
      return;
    }

    const { data: authData, error: authError } = await db.auth.admin.getUserById(uuid);
    if (authError || !authData?.user) {
      await say(chatId, "UUID Tamaverse tidak ditemukan. Periksa kembali UUID dari menu Profile lalu kirim /uuid UUID_KAMU.");
      return;
    }

    const { data: existingByTelegram, error: lookupError } = await db
      .from("tamaverse_telegram_links")
      .select("owner_id")
      .eq("telegram_user_id", telegramId)
      .maybeSingle();
    if (lookupError) {
      await say(chatId, "Gagal memeriksa akun. Coba lagi beberapa saat.");
      return;
    }
    if (existingByTelegram && existingByTelegram.owner_id !== uuid) {
      await say(chatId, "Akun Telegram ini sudah terhubung ke UUID Tamaverse lain. Hubungi admin jika perlu menggantinya.");
      return;
    }

    const { data: existingByGame, error: gameLookupError } = await db
      .from("tamaverse_telegram_links")
      .select("telegram_user_id")
      .eq("owner_id", uuid)
      .maybeSingle();
    if (gameLookupError) {
      await say(chatId, "Gagal memeriksa akun. Coba lagi beberapa saat.");
      return;
    }
    if (existingByGame && existingByGame.telegram_user_id !== telegramId) {
      await say(chatId, "UUID Tamaverse ini sudah terhubung ke akun Telegram lain. Hubungi admin jika itu akun milikmu.");
      return;
    }

    const { error: linkError } = await db.from("tamaverse_telegram_links").upsert({
      telegram_user_id: telegramId,
      telegram_username: username || null,
      owner_id: uuid,
    }, { onConflict: "telegram_user_id" });
    if (linkError) {
      await say(chatId, "UUID belum berhasil disimpan. Coba lagi atau hubungi admin.");
      return;
    }
    await say(chatId, "UUID Tamaverse berhasil disimpan! Sekarang kamu bisa gunakan /buy untuk memilih paket Diamond.");
    return;
  }

  if (text.startsWith("/link")) {
    await say(chatId, "Sekarang tidak perlu kode pairing. Kirim UUID Tamaverse dengan format:\n/uuid UUID_KAMU");
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
    if (error) { await say(chatId, error.message.includes("TELEGRAM_NOT_LINKED") ? "UUID belum terdeteksi. Masukkan UUID Tamaverse terlebih dahulu dengan format /uuid UUID_KAMU." : "Tiket gagal dibuat: " + error.message); return; }
    await say(chatId, `Tiket berhasil dibuat!\nOrder: ${data.id}\nPaket: ${pack.label}\nDiamond: ${pack.diamonds}\nStatus: Menunggu admin\n\nAdmin akan mengirim nominal dan instruksi pembayaran di chat ini. Jangan membayar sebelum menerima instruksi.`);
    await say(adminId, `TIKET DIAMOND BARU\nOrder: ${data.id}\nTelegram: ${telegramId} (@${username || "-"})\nPaket: ${pack.label} — ${pack.diamonds} Diamonds\n\nPilih nominal pembayaran:`, { reply_markup: { inline_keyboard: [
      [5000,10000,15000].map(n => ({ text: "Rp" + money(n), callback_data: "price:" + data.id + ":" + n })),
      [20000,25000,50000].map(n => ({ text: "Rp" + money(n), callback_data: "price:" + data.id + ":" + n }))
    ] } });
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
    if (update.callback_query) await handleCallback(update.callback_query);
    return new Response("ok", { status: 200 });
  } catch (error) {
    console.error("Telegram webhook error:", error);
    return new Response("Webhook error", { status: 200 });
  }
});
