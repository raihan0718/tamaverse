import { createClient } from "npm:@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN2")!;
const adminId = Deno.env.get("TELEGRAM_ADMIN_ID")!;
const webhookSecret = Deno.env.get("TELEGRAM_WEBHOOK_SECRET")!;
const ticketGroupId = "-1004322036078";
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

async function createOrderTopic(orderId: string, label: string, diamonds: number, telegramId: string) {
  const topic = await telegram("createForumTopic", {
    chat_id: ticketGroupId,
    name: `🟡 ORDER ${orderId.slice(0, 8).toUpperCase()} • ${diamonds} 💎`,
  });
  const threadId = Number(topic.message_thread_id);
  const { error } = await db.from("diamond_orders")
    .update({ telegram_topic_id: threadId })
    .eq("id", orderId);
  if (error) throw new Error("Topic dibuat tetapi gagal menyimpan ID: " + error.message);
  await telegram("sendMessage", {
    chat_id: ticketGroupId,
    message_thread_id: threadId,
    text: `TIKET DIAMOND BARU\nOrder: ${orderId}\nTelegram: ${telegramId}\nPaket: ${label} — ${diamonds} Diamonds\nStatus: Menunggu nominal dari admin.`,
  });
  return threadId;
}

async function sendOrderTopic(orderId: string, text: string, extra: Record<string, unknown> = {}) {
  const { data, error } = await db.from("diamond_orders")
    .select("telegram_topic_id")
    .eq("id", orderId)
    .maybeSingle();
  if (error) throw new Error("Gagal mencari Topic order: " + error.message);
  if (!data?.telegram_topic_id) throw new Error("TOPIC_NOT_FOUND");
  return telegram("sendMessage", {
    chat_id: ticketGroupId,
    message_thread_id: data.telegram_topic_id,
    text,
    ...extra,
  });
}
const money = (n: number) => new Intl.NumberFormat("id-ID").format(n);
const isAdmin = (id: number) => String(id) === adminId;
const packages: Record<string, { label: string; diamonds: number; price: number; packageId: string }> = {
  "1": { label: "Mini", diamonds: 5, price: 2000, packageId: "mini_5" },
  "2": { label: "Basic", diamonds: 10, price: 4000, packageId: "basic_10" },
  "3": { label: "Plus", diamonds: 25, price: 8000, packageId: "plus_25" },
  "4": { label: "Pro", diamonds: 50, price: 12000, packageId: "pro_50" },
  "5": { label: "Max", diamonds: 100, price: 20000, packageId: "max_100" },
};
const help = `NEXORA • TAMAVERSE DIAMOND TOP-UP

Gunakan tombol menu untuk memilih paket Diamond dan mengikuti instruksi pembayaran.

Jika ingin membuka menu utama, kirim /start.
Pembayaran diproses manual oleh admin. Jangan kirim data rahasia, PIN, atau OTP.`;

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
  if (payload.startsWith("proofready:")) {
    const orderId = payload.slice("proofready:".length);
    const { data: order, error } = await db.from("diamond_orders")
      .select("id,telegram_user_id,status,payment_method")
      .eq("id", orderId).eq("telegram_user_id", id).maybeSingle();
    if (error || !order || order.status !== "waiting_payment" || !["gopay", "qris"].includes(order.payment_method)) {
      await telegram("answerCallbackQuery", { callback_query_id: q.id, text: "Order tidak aktif atau tidak ditemukan." });
      return;
    }
    await telegram("answerCallbackQuery", { callback_query_id: q.id, text: "Silakan kirim foto bukti di chat ini." });
    await say(chatId, "Silakan kirim foto bukti pembayaran untuk order " + order.id + ". Tidak perlu mengetik perintah atau Order ID.");
    return;
  }
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
    await say(chatId, "PILIH NOMINAL DIAMOND\n\nDaftar harga paket Tamaverse (mode pratinjau):\nPilih tombol untuk melihat detail paket. Belum ada pesanan atau pembayaran yang dibuat dari menu ini.", { reply_markup: { inline_keyboard: [
      [{ text: "5 💎 — Rp1.000", callback_data: "packageinfo:5" }, { text: "10 💎 — Rp1.800", callback_data: "packageinfo:10" }],
      [{ text: "25 💎 — Rp3.500", callback_data: "packageinfo:25" }, { text: "50 💎 — Rp5.000", callback_data: "packageinfo:50" }],
      [{ text: "120 💎 — Rp10.800", callback_data: "packageinfo:120" }],
      [{ text: "300 💎 — Rp24.000", callback_data: "packageinfo:300" }],
      [{ text: "700 💎 — Rp49.000", callback_data: "packageinfo:700" }],
      [{ text: "⬅️ Kembali", callback_data: "menu:home" }]
    ] } }); return;
  }
  if (payload === "menu:uuid") {
    await answer("Silakan kirim UUID");
    await say(chatId, "🔗 HUBUNGKAN AKUN TAMAVERSE\n\nKirim UUID akun kamu langsung ke chat ini, tanpa /uuid.\n\nCara melihat UUID:\n1. Buka aplikasi Tamaverse.\n2. Masuk ke menu Profile.\n3. Cari bagian UUID.\n4. Salin ID tersebut, lalu kirim ke chat ini.\n\nPastikan UUID yang dikirim benar dan jangan bagikan password atau kode rahasia.");
    return;
  }
  if (payload === "menu:help") { await answer("Panduan"); await say(chatId, help, { reply_markup: { inline_keyboard: [[{ text: "💎 Top Up Diamond", callback_data: "menu:topup" }]] } }); return; }
  if (payload.startsWith("packageinfo:")) {
    const amount = Number(payload.split(":")[1]);
    const prices: Record<number, number> = { 5: 1000, 10: 1800, 25: 3500, 50: 5000, 120: 10800, 300: 24000, 700: 49000 };
    const price = prices[amount];
    if (!price) { await answer("Paket tidak valid"); return; }
    await answer("Detail paket");
    await say(chatId, `DETAIL PAKET TAMAVERSE\n\n💎 ${amount} Diamonds\nHarga katalog: Rp${money(price)}\n\nPilih metode untuk melihat ringkasan pilihan. Pratinjau ini tidak membuat pesanan atau instruksi pembayaran.`, { reply_markup: { inline_keyboard: [
      [{ text: "🟦 QRIS", callback_data: `methodpreview:${amount}:qris` }, { text: "🟩 GoPay", callback_data: `methodpreview:${amount}:gopay` }],
      [{ text: "⬅️ Kembali ke Paket", callback_data: "menu:topup" }]
    ] } });
    return;
  }
  if (payload.startsWith("methodpreview:")) {
    const [, rawAmount, method] = payload.split(":");
    const amount = Number(rawAmount);
    const prices: Record<number, number> = { 5: 1000, 10: 1800, 25: 3500, 50: 5000, 120: 10800, 300: 24000, 700: 49000 };
    const price = prices[amount];
    if (!price || !["qris", "gopay"].includes(method)) { await answer("Pilihan tidak valid"); return; }
    await answer("Metode dipilih");
    await say(chatId, `RINGKASAN PILIHAN · PRATINJAU\n\n💎 Paket: ${amount} Diamonds\n💰 Harga katalog: Rp${money(price)}\n💳 Metode: ${method.toUpperCase()}\n\nIni hanya pratinjau tampilan. Belum ada order, tiket admin, QRIS, atau instruksi GoPay yang dibuat. Jangan melakukan pembayaran berdasarkan pesan ini.`, { reply_markup: { inline_keyboard: [
      [{ text: "⬅️ Ganti metode", callback_data: `packageinfo:${amount}` }],
      [{ text: "📦 Ganti paket", callback_data: "menu:topup" }]
    ] } });
    return;
  }
  if (payload.startsWith("pack:")) {
    const choice = payload.split(":")[1], pack = packages[choice];
    if (!pack) { await answer("Paket tidak valid"); return; }
    const { data: link, error: linkError } = await db.from("tamaverse_telegram_links").select("owner_id").eq("telegram_user_id", id).maybeSingle();
    if (linkError) { await answer("Gagal memeriksa akun"); await say(chatId, "Akun belum bisa diperiksa. Coba lagi beberapa saat."); return; }
    if (!link) { await answer("UUID belum terhubung"); await say(chatId, "UUID belum terdeteksi. Hubungkan akun dulu.", { reply_markup: { inline_keyboard: [[{ text: "🔗 Hubungkan UUID", callback_data: "menu:uuid" }], [{ text: "⬅️ Menu utama", callback_data: "menu:home" }]] } }); return; }

    await answer("Memproses pesanan...");
    const progress = await say(chatId, "⏳ Sedang membuat tiket Diamond kamu...");
    const { data, error } = await db.rpc("create_tamaverse_diamond_order", { p_telegram_user_id: id, p_package_id: pack.packageId });
    if (error) {
      await telegram("editMessageText", { chat_id: chatId, message_id: progress.message_id, text: "Tiket gagal dibuat.\n" + error.message });
      return;
    }
    const { error: priceError } = await db.rpc("set_tamaverse_diamond_order_payment", { p_order_id: data.id, p_amount_idr: pack.price, p_admin_note: null });
    if (priceError) { await telegram("editMessageText", { chat_id: chatId, message_id: progress.message_id, text: "Gagal menetapkan harga: " + priceError.message }); return; }
    await telegram("editMessageText", { chat_id: chatId, message_id: progress.message_id, text: `TIKET BERHASIL DIBUAT\nOrder: ${data.id}\nPaket: ${pack.label}\nDiamond: ${pack.diamonds}\nTotal: Rp${money(pack.price)}\n\nPilih metode pembayaran:`, reply_markup: { inline_keyboard: [
      [{ text: "GoPay", callback_data: "method:gopay:" + data.id }],
      [{ text: "QRIS", callback_data: "method:qris:" + data.id }]
    ] } });
    try { await createOrderTopic(data.id, pack.label, pack.diamonds, id); }
    catch (e) { console.error("Order topic creation failed:", e); await say(ticketGroupId, `Order ${data.id}: gagal membuat Topic — ${String(e)}`); }
    return;
  }
  if (payload.startsWith("method:")) {
    const [, method, orderId] = payload.split(":");
    if (method !== "gopay" && method !== "qris") { await answer("Metode tidak valid"); return; }
    const { data: order } = await db.from("diamond_orders").select("id,telegram_user_id,diamonds,amount_idr,status").eq("id", orderId).eq("telegram_user_id", id).maybeSingle();
    if (!order || order.status !== "waiting_payment") { await answer("Order tidak valid"); return; }
    const { error } = await db.from("diamond_orders").update({ payment_method: method, updated_at: new Date().toISOString() }).eq("id", orderId);
    if (error) { await answer("Gagal menyimpan metode"); return; }
    await answer("Metode dipilih");
    if (method === "gopay") await say(chatId, `PEMBAYARAN GOPAY
Order: ${order.id}
Diamond: ${order.diamonds}
Total: Rp${money(order.amount_idr)}
Nomor GoPay: 087722860530
A/N: Raihan Rizki Milano

Setelah pembayaran, tekan tombol di bawah untuk mengirim foto bukti.`, { reply_markup: { inline_keyboard: [[{ text: "📤 KIRIM BUKTI PEMBAYARAN", callback_data: "proofready:" + order.id }]] } });
    else {
      await say(chatId, `Metode QRIS dipilih untuk order ${order.id}. Admin akan mengirim QRIS khusus transaksi ini ke chat pribadi lu setelah mengunggahnya di Topic tiket.`);
      try { await sendOrderTopic(orderId, "Pemain memilih QRIS. Admin: kirim foto QRIS khusus order ini langsung ke Topic ini."); } catch (e) { console.error(e); }
    }
    return;
  }
  if (payload.startsWith("approve:")) {
    if (!isAdmin(Number(id))) { await answer("Khusus admin"); return; }
    const orderId = payload.split(":")[1];
    await answer("Memproses persetujuan...");
    const { data: orderMeta, error: metaError } = await db.from("diamond_orders")
      .select("telegram_topic_id")
      .eq("id", orderId)
      .maybeSingle();
    if (metaError) { await say(chatId, "Data pesanan gagal diperiksa: " + metaError.message); return; }

    const { data, error } = await db.rpc("approve_tamaverse_diamond_order", { p_order_id: orderId });
    if (error) { await say(chatId, "Persetujuan gagal: " + error.message); return; }

    await say(data.telegram_user_id,
      `🎉 PEMBELIAN BERHASIL!\n\n💎 ${data.diamonds} Diamond telah berhasil ditambahkan ke akun Tamaverse Anda.\n🧾 ID Pesanan: ${orderId}\n\nTerima kasih telah melakukan pembelian. Selamat bermain!`);
    await say(chatId, `✅ PESANAN DISETUJUI\n+${data.diamonds} Diamond dikreditkan.\nID: ${orderId}`);

    if (orderMeta?.telegram_topic_id) {
      try {
        await telegram("deleteForumTopic", {
          chat_id: ticketGroupId,
          message_thread_id: orderMeta.telegram_topic_id,
        });
        await say(chatId, `🗑️ Topic pesanan ${orderId.slice(0, 8).toUpperCase()} berhasil dihapus.`);
      } catch (deleteError) {
        console.error("Could not delete approved order topic:", deleteError);
        await say(chatId, `⚠️ Pesanan berhasil disetujui, tetapi Topic gagal dihapus. Silakan hapus manual.\nID: ${orderId}`);
      }
    } else {
      await say(chatId, `⚠️ ID Topic tidak ditemukan untuk pesanan ${orderId}. Silakan periksa Topic secara manual.`);
    }
    return;
  }
  if (payload.startsWith("decline:")) {
    if (!isAdmin(Number(id))) { await answer("Khusus admin"); return; }
    const orderId = payload.slice("decline:".length).trim();
    if (!orderId) { await answer("ID order tidak valid"); return; }

    const { data: order, error: lookupError } = await db.from("diamond_orders")
      .select("id,telegram_user_id,telegram_topic_id")
      .eq("id", orderId)
      .maybeSingle();
    if (lookupError || !order?.telegram_user_id) {
      await answer("Data order tidak ditemukan");
      await say(chatId, "Order tidak ditemukan. Tidak ada perubahan yang dilakukan.");
      return;
    }

    await telegram("answerCallbackQuery", { callback_query_id: q.id, text: "Memproses penolakan..." });

    const { data: cancelled, error: cancelError } = await db.rpc(
      "set_tamaverse_diamond_order_status",
      { p_order_id: orderId, p_status: "cancelled" }
    );
    if (cancelError || !cancelled) {
      await say(chatId, "Order gagal dibatalkan. Topic tidak dihapus. Detail: " + (cancelError?.message || "Order tidak ditemukan."));
      return;
    }

    await say(order.telegram_user_id,
      `⚠️ PEMBAYARAN TIDAK DAPAT DIPROSES

Mohon maaf, bukti pembayaran untuk pesanan ini belum dapat diproses.
Order lama telah dibatalkan. Untuk melakukan top-up kembali, tekan tombol di bawah atau kirim /start untuk membuka menu utama.
Jika membutuhkan bantuan, hubungi @ipnmesum.

— Nexora Team`,
      { reply_markup: { inline_keyboard: [
        [{ text: "💎 Kembali ke Menu Top Up", callback_data: "menu:topup" }],
        [{ text: "🏠 Menu Utama", callback_data: "menu:home" }]
      ] } });

    let topicDeleted = false;
    if (order.telegram_topic_id) {
      try {
        await telegram("deleteForumTopic", {
          chat_id: ticketGroupId,
          message_thread_id: order.telegram_topic_id,
        });
        topicDeleted = true;
      } catch (deleteError) {
        console.error("Could not delete declined order topic:", deleteError);
      }
    }

    await say(chatId,
      `❌ ORDER DITOLAK & DIBATALKAN
Order: ${orderId}
Customer sudah diberi tahu dan bisa top-up ulang dengan /buy.
Topic: ${topicDeleted ? "berhasil dihapus" : "tidak ditemukan atau gagal dihapus"}.`);

    if (chatId && q.message?.message_id) {
      try {
        await telegram("deleteMessage", { chat_id: chatId, message_id: q.message.message_id });
      } catch (error) {
        console.error("Could not delete declined proof message:", error);
      }
    }
    return;
  }
  if (payload.startsWith("price:")) {
    if (id !== adminId) { await answer("Khusus admin"); return; }
    const [, orderId, raw] = payload.split(":"); const amount = Number(raw);
    if (![5000,10000,15000,20000,25000,50000].includes(amount)) { await answer("Nominal tidak valid"); return; }
    await answer("Menyimpan harga...");
    const { data, error } = await db.rpc("set_tamaverse_diamond_order_payment", { p_order_id: orderId, p_amount_idr: amount, p_admin_note: null });
    if (error) { await say(chatId, "Gagal mengatur harga: " + error.message); return; }
    await say(data.telegram_user_id, `INSTRUKSI PEMBAYARAN TAMAVERSE\nOrder: ${data.id}\nDiamond: ${data.diamonds}\nTotal: Rp${money(data.amount_idr)}\n\nIkuti instruksi pembayaran dari admin. Setelah membayar, kirim foto bukti dengan caption /proof ${data.id}. Jangan kirim PIN atau OTP.`);
    try {
      await sendOrderTopic(orderId, `Harga ditetapkan: Rp${money(amount)}\nKirim instruksi QRIS/pembayaran secara manual kepada pemain.`);
    } catch (topicError) { console.error("Could not post price update to order topic:", topicError); }
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
  if (!chatId || !telegramId) return;

  if (m.chat?.type !== "private") {
    if (text === "/chatid" || text.startsWith("/chatid@")) {
      await say(chatId, `INFO GRUP
ID: ${chatId}
Nama: ${m.chat?.title || "-"}
Tipe: ${m.chat?.type || "-"}
Bot: ${(await telegram("getMe", {})).username}`);
      return;
    }
    // Admin posts a per-order QRIS image directly inside that order's forum Topic.
    if (isAdmin(Number(telegramId)) && m.message_thread_id && m.photo?.length) {
      const { data: order, error } = await db.from("diamond_orders")
        .select("id,telegram_user_id,diamonds,amount_idr,status,payment_method")
        .eq("telegram_topic_id", m.message_thread_id)
        .maybeSingle();
      if (error || !order) {
        await say(chatId, "QRIS tidak terkirim: tiket order tidak ditemukan untuk Topic ini.");
        return;
      }
      if (order.status !== "waiting_payment" || order.payment_method !== "qris") {
        await say(chatId, "QRIS tidak terkirim. Pastikan pemain sudah memilih metode QRIS dan order masih menunggu pembayaran.");
        return;
      }
      const photo = m.photo[m.photo.length - 1].file_id;
      await telegram("sendPhoto", {
        chat_id: order.telegram_user_id,
        photo,
        caption: `QRIS PEMBAYARAN TAMAVERSE
Order: ${order.id}
Diamond: ${order.diamonds}
Total: Rp${money(order.amount_idr)}

Setelah pembayaran, tekan tombol di bawah untuk mengirim foto bukti.`,
        reply_markup: { inline_keyboard: [[{ text: "📤 KIRIM BUKTI PEMBAYARAN", callback_data: "proofready:" + order.id }]] },
      });
      await say(chatId, `QRIS order ${order.id} berhasil diteruskan ke chat pribadi pemain.`);
      return;
    }
    return;
  }

  if (text.startsWith("/start") || text === "/help") {
    const startPayload = text.startsWith("/start") ? (text.split(/\\s+/)[1] || "") : "";
    const handoff = /^tv_(50|120|300|700)_(qris|gopay)$/i.exec(startPayload);
    if (handoff) {
      const [, rawAmount, rawMethod] = handoff;
      const amount = Number(rawAmount);
      const method = rawMethod.toLowerCase() === "qris" ? "QRIS" : "GoPay";
      await say(chatId,
        `NEXORA PAY • TAMAVERSE

Pilihan dari Tamaverse berhasil diterima.

Paket: ${amount} Diamonds
Metode pilihan: ${method}

Ini hanya konfirmasi pilihan dari aplikasi. Untuk informasi dan bantuan, gunakan menu di bawah.`,
        { reply_markup: { inline_keyboard: [
          [{ text: "📋 Panduan", callback_data: "menu:help" }],
          [{ text: "🏠 Menu Utama", callback_data: "menu:home" }]
        ] } });
      return;
    }
    await say(chatId, "NEXORA PAY • TAMAVERSE\n\nSelamat datang! Pilih menu:", { reply_markup: { inline_keyboard: [
      [{ text: "💎 Top Up Diamond", callback_data: "menu:topup" }],
      [{ text: "🔗 Hubungkan UUID", callback_data: "menu:uuid" }],
      [{ text: "📋 Panduan", callback_data: "menu:help" }]
    ] } });
    return;
  }

  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (text.startsWith("/uuid") || uuidPattern.test(text.trim())) {
    const uuid = text.startsWith("/uuid") ? text.split(/\s+/)[1]?.trim() : text.trim();
    if (!uuid || !uuidPattern.test(uuid)) {
      await say(chatId, "UUID belum terdeteksi atau formatnya salah.\nBuka Tamaverse > Profile, salin UUID, lalu kirim:\n/uuid UUID_KAMU");
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
    await say(chatId, "✅ UUID Tamaverse berhasil terhubung!\n\nSekarang pilih menu berikut:", { reply_markup: { inline_keyboard: [
      [{ text: "💎 Top Up Diamond", callback_data: "menu:topup" }],
      [{ text: "📋 Panduan", callback_data: "menu:help" }]
    ] } });
    return;
  }

  if (text.startsWith("/link")) {
    await say(chatId, "Sekarang tidak perlu kode pairing. Kirim UUID Tamaverse dengan format:\n/uuid UUID_KAMU");
    return;
  }

  if (text.startsWith("/buy")) {
    const choice = text.split(/\s+/)[1];
    if (!choice) {
      await say(chatId, "PILIH NOMINAL DIAMOND\n\nDaftar harga paket Tamaverse (mode pratinjau):\nPilih tombol untuk melihat detail paket. Belum ada pesanan atau pembayaran yang dibuat dari menu ini.", { reply_markup: { inline_keyboard: [
        [{ text: "5 💎 — Rp1.000", callback_data: "packageinfo:5" }, { text: "10 💎 — Rp1.800", callback_data: "packageinfo:10" }],
        [{ text: "25 💎 — Rp3.500", callback_data: "packageinfo:25" }, { text: "50 💎 — Rp5.000", callback_data: "packageinfo:50" }],
        [{ text: "120 💎 — Rp10.800", callback_data: "packageinfo:120" }],
        [{ text: "300 💎 — Rp24.000", callback_data: "packageinfo:300" }],
        [{ text: "700 💎 — Rp49.000", callback_data: "packageinfo:700" }],
        [{ text: "⬅️ Menu utama", callback_data: "menu:home" }]
      ] } });
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
    const priceButtons = { reply_markup: { inline_keyboard: [
      [5000,10000,15000].map(n => ({ text: "Rp" + money(n), callback_data: "price:" + data.id + ":" + n })),
      [20000,25000,50000].map(n => ({ text: "Rp" + money(n), callback_data: "price:" + data.id + ":" + n }))
    ] } };
    try {
      await createOrderTopic(data.id, pack.label, pack.diamonds, telegramId);
      await sendOrderTopic(data.id, "Pilih nominal pembayaran:", priceButtons);
    } catch (topicError) {
      console.error("Order topic creation failed:", topicError);
      await say(adminId, `TOPIC GAGAL DIBUAT — ORDER ${data.id}\n${String(topicError)}\nSilakan tindak lanjuti manual.`, priceButtons);
    }
    return;
  }

  if (m.photo?.length) {
    const fileId = m.photo[m.photo.length - 1].file_id;
    let orderId = text.startsWith("/proof") ? text.split(/\\s+/)[1] : null;
    if (!orderId) {
      const { data: activeOrders, error: orderLookupError } = await db.from("diamond_orders")
        .select("id")
        .eq("telegram_user_id", telegramId)
        .eq("status", "waiting_payment")
        .in("payment_method", ["gopay", "qris"])
        .limit(2);
      if (orderLookupError) { await say(chatId, "Order aktif gagal diperiksa. Coba lagi."); return; }
      if (!activeOrders?.length) { await say(chatId, "Belum ada pesanan aktif yang menunggu bukti pembayaran."); return; }
      if (activeOrders.length > 1) { await say(chatId, "Ada lebih dari satu pesanan aktif. Hubungi admin agar bukti masuk ke tiket yang tepat."); return; }
      orderId = activeOrders[0].id;
    }
    const { data, error } = await db.rpc("submit_tamaverse_diamond_proof", {
      p_order_id: orderId, p_telegram_user_id: telegramId, p_file_id: fileId,
    });
    if (error) { await say(chatId, "Bukti belum bisa dikirim: " + error.message); return; }
    await say(chatId, "Bukti diterima. Admin akan memeriksa transaksi secara manual. Diamond belum ditambahkan.");
    const proofCaption = `BUKTI PEMBAYARAN MASUK
Order: ${data.id}
Telegram: ${telegramId}
Nominal: Rp${money(data.amount_idr)}
Diamond: ${data.diamonds}

Periksa transaksi lalu tekan Approve jika valid.`;
    try {
      const { data: order } = await db.from("diamond_orders").select("telegram_topic_id").eq("id", data.id).maybeSingle();
      if (order?.telegram_topic_id) {
        await telegram("sendPhoto", { chat_id: ticketGroupId, message_thread_id: order.telegram_topic_id, photo: fileId, caption: proofCaption, reply_markup: { inline_keyboard: [[{ text: "✅ APPROVE PAYMENT", callback_data: "approve:" + data.id }, { text: "❌ DECLINE", callback_data: "decline:" + data.id }]] } });
      } else {
        await say(adminId, proofCaption);
        await telegram("sendPhoto", { chat_id: adminId, photo: fileId, caption: `Bukti order ${data.id} dari Telegram ${telegramId}`, reply_markup: { inline_keyboard: [[{ text: "✅ APPROVE PAYMENT", callback_data: "approve:" + data.id }, { text: "❌ DECLINE", callback_data: "decline:" + data.id }]] } });
      }
    } catch (topicError) { console.error("Could not forward proof to order topic:", topicError); }
    return;
  }
  if (text.startsWith("/proof")) {
    await say(chatId, "Sekarang cukup tekan tombol KIRIM BUKTI PEMBAYARAN lalu kirim fotonya tanpa caption.");
    return;
  }

  if (isAdmin(Number(telegramId))) {
    const parts = text.split(/\s+/);
    const command = parts[0];
    if (command === "/testtopic") {
      let stage = "getMe";
      let me: any = null;
      try {
        me = await telegram("getMe", {});
        stage = "getChat";
        const group = await telegram("getChat", { chat_id: ticketGroupId });
        stage = "createForumTopic";
        const topic = await telegram("createForumTopic", {
          chat_id: ticketGroupId,
          name: "TEST BOT CONNECTION",
        });
        stage = "sendMessage";
        await telegram("sendMessage", {
          chat_id: ticketGroupId,
          message_thread_id: topic.message_thread_id,
          text: "Koneksi Topic NexoraPay berhasil. Bot dapat membuat dan mengirim pesan ke Topic.",
        });
        await say(chatId, `TEST BERHASIL. Token aktif: @${me.username}; grup terbaca: ${group.title || group.id}; message_thread_id: ${topic.message_thread_id}`);
      } catch (error) {
        console.error("Topic diagnostic failed at " + stage + ":", error);
        const identity = me ? `Token aktif: @${me.username} (ID: ${me.id}).\n` : "Token aktif: tidak berhasil diverifikasi.\n";
        await say(chatId, `TEST TOPIC GAGAL pada tahap ${stage}.\n${identity}Detail: ${String(error)}`);
      }
      return;
    }
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
