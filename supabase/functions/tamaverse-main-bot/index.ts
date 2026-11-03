const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN3");
const WEBHOOK_SECRET = Deno.env.get("TELEGRAM_WEBHOOK_SECRET3") ?? "";
const APP_URL = "https://raihan0718.github.io/tamaverse/";
const API = BOT_TOKEN ? `https://api.telegram.org/bot${BOT_TOKEN}` : "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ADMIN_TELEGRAM_ID = Deno.env.get("TAMAVERSE_BOT_ADMIN_ID") ?? "";

type TgMessage = {
  message_id: number;
  chat: { id: number; type?: string };
  from?: { id?: number; first_name?: string; username?: string };
  text?: string;
};
type TgUpdate = {
  update_id: number;
  message?: TgMessage;
  callback_query?: {
    id: string;
    data?: string;
    message?: { message_id: number; chat: { id: number } };
    from?: { id?: number; first_name?: string };
  };
};

const mainKeyboard = {
  inline_keyboard: [
    [{ text: "🌈 Open Tamaverse", web_app: { url: APP_URL } }],
    [{ text: "✨ About Tamaverse", callback_data: "about" }, { text: "🐣 How to play", callback_data: "guide" }],
    [{ text: "📜 Commands", callback_data: "commands" }, { text: "💌 Help & support", callback_data: "support" }],
  ],
};

const pages: Record<string, { text: string; keyboard?: unknown }> = {
  home: {
    text: "🌙 *Welcome to Tamaverse!*\n\nH hii, Tama Pals! So happy to see you here! 🌷\nYour little adventure with adorable companions starts right here. Ready to explore? 🥚✨\n\nPick a little corner to visit:",
    keyboard: mainKeyboard,
  },
  about: {
    text: "🌷 *A little about Tamaverse*\n\nTamaverse is a cozy little world where you can meet companions, take care of them, collect adorable pets, and enjoy your own adventure! 🐣💗\n\nEvery companion has a story. Let’s make lovely memories together! ✨",
    keyboard: { inline_keyboard: [[{ text: "🌈 Open Tamaverse", web_app: { url: APP_URL } }], [{ text: "‹ Back to menu", callback_data: "home" }]] },
  },
  guide: {
    text: "📖 *TAMAVERSE — HOW TO PLAY*\n\nPanduan lengkap buat mulai petualanganmu. Pilih bagian yang mau kamu pelajari:",
    keyboard: { inline_keyboard: [
      [{ text: "🏠 Home", callback_data: "guide_home" }, { text: "🐾 Collection", callback_data: "guide_collection" }],
      [{ text: "🛍 Shop", callback_data: "guide_shop" }, { text: "🥚 Gacha", callback_data: "guide_gacha" }],
      [{ text: "⚔️ Battle", callback_data: "guide_battle" }, { text: "🏆 Ranking", callback_data: "guide_ranking" }],
      [{ text: "👤 Profile", callback_data: "guide_profile" }, { text: "💗 Pet Care", callback_data: "guide_care" }],
      [{ text: "🌈 Open Tamaverse", web_app: { url: APP_URL } }],
      [{ text: "‹ Back to menu", callback_data: "home" }]
    ] },
  },
  guide_home: {
    text: "🏠 *HOME — PUSAT AKTIVITASMU*\n\nHome adalah halaman utama tempat kamu melihat companion yang sedang aktif. Di sini kamu bisa memantau Hunger, Mood, Energy, dan Cleanliness, melihat level serta XP pet, lalu melakukan aktivitas perawatan dan training. Pet yang sedang digunakan mengalami perubahan status care seiring waktu; pet yang tidak dipakai menyimpan statusnya sampai dipilih kembali.",
    keyboard: { inline_keyboard: [[{ text: "💗 Cara merawat pet", callback_data: "guide_care" }], [{ text: "‹ Panduan lainnya", callback_data: "guide" }]] },
  },
  guide_collection: {
    text: "🐾 *COLLECTION — KOLEKSI COMPANION*\n\nCollection menyimpan semua pet yang sudah kamu miliki dan daftar spesies yang belum ditemukan. Kamu bisa melihat detail companion, rarity, level, dan memilih pet yang ingin dijadikan aktif. Tab Accessories berisi frame untuk tampilan companion; frame yang belum dimiliki akan tetap terkunci.\n\n*Cara mendapatkan pet:* buka Shop → Gacha, lalu tarik Pixie Egg atau Astral Egg. Pet baru akan masuk ke Collection. Jika mendapat spesies yang sudah dimiliki, hasilnya menjadi duplicate dan dikonversi menjadi fragmen serta bonus koin.",
    keyboard: { inline_keyboard: [[{ text: "🥚 Cara Gacha", callback_data: "guide_gacha" }], [{ text: "‹ Panduan lainnya", callback_data: "guide" }]] },
  },
  guide_shop: {
    text: "🛍 *SHOP — PERLENGKAPAN PET*\n\nShop adalah tempat membeli item memakai koin untuk membantu perawatan, training, dan battle.\n\n• Apple — 50 koin, memulihkan 50 Hunger.\n• Energy Potion — 40 koin, memulihkan 30 Energy.\n• Health Potion — 60 koin, item pemulih HP saat battle.\n• Training Manual — 120 koin, membuat Training lebih hemat Energy.\n\nDiamond dan item premium tersedia di bagian Shop terkait.",
    keyboard: { inline_keyboard: [[{ text: "💗 Cara merawat pet", callback_data: "guide_care" }, { text: "⚔️ Cara battle", callback_data: "guide_battle" }], [{ text: "‹ Panduan lainnya", callback_data: "guide" }]] },
  },
  guide_gacha: {
    text: "🥚 *GACHA — DAPATKAN COMPANION BARU*\n\nGacha adalah sistem untuk menemukan pet secara acak dari egg. Buka Shop → Gacha, pilih egg, lalu tekan tombol pull.\n\n• *Pixie Egg:* 100 koin per pull. Peluang: Common 60%, Rare 28%, Epic 8%, Legendary 4%.\n• *Astral Egg:* 5 Diamonds per pull. Peluang: Rare 55%, Epic 27%, Legendary 18%.\n\nAda satu klaim egg gratis per hari. Hasil gacha langsung masuk Collection. Jika mendapat spesies yang sama, kamu menerima duplicate reward.",
    keyboard: { inline_keyboard: [[{ text: "🐾 Lihat Collection", callback_data: "guide_collection" }], [{ text: "‹ Panduan lainnya", callback_data: "guide" }]] },
  },
  guide_battle: {
    text: "⚔️ *BATTLE — UJI KEKUATAN COMPANION*\n\nBattle punya dua mode:\n• *Online (PvP):* melawan pemain lain. Kamu bisa mencari lawan secara acak atau menggunakan room pribadi.\n• *Solo / Hunting (PvE):* melawan Monster untuk memperoleh reward.\n\n*Cara battle:*\n1. Pilih pet aktif yang ingin dibawa bertarung.\n2. Buka Battle dan pilih Online atau Solo / Hunting.\n3. Untuk Online, cari lawan atau buat/gabung room. Untuk Solo, mulai Hunting.\n4. Saat giliranmu, pilih aksi yang tersedia seperti menyerang atau menggunakan skill.\n5. Perhatikan HP dan Energy; gunakan item pemulih bila diperlukan.\n6. Pertarungan berjalan bergiliran sampai salah satu pihak kalah.\n\nSiapkan kondisi pet sebelum masuk arena.",
    keyboard: { inline_keyboard: [[{ text: "🛍 Item battle", callback_data: "guide_shop" }, { text: "💗 Pet Care", callback_data: "guide_care" }], [{ text: "‹ Panduan lainnya", callback_data: "guide" }]] },
  },
  guide_ranking: {
    text: "🏆 *RANKING — PAPAN PERINGKAT*\n\nRanking menampilkan pemain Tamaverse berdasarkan beberapa kategori: Rating Battle, Level, Total Wins, dan Playtime. Pilih kategori untuk melihat siapa yang berada di posisi teratas dan membandingkan progresmu dengan pemain lain.",
    keyboard: { inline_keyboard: [[{ text: "⚔️ Pelajari Battle", callback_data: "guide_battle" }], [{ text: "‹ Panduan lainnya", callback_data: "guide" }]] },
  },
  guide_profile: {
    text: "👤 *PROFILE — IDENTITAS PEMAIN*\n\nProfile menyimpan identitas dan statistik akunmu, seperti nama pemain, username Telegram, level, catatan performa, dan posisi ranking. Kamu juga bisa mengatur foto profil. Simpan UUID akunmu untuk keperluan identifikasi atau bantuan. Jangan bagikan kode verifikasi atau informasi sensitif.",
    keyboard: { inline_keyboard: [[{ text: "🏆 Lihat fungsi Ranking", callback_data: "guide_ranking" }], [{ text: "‹ Panduan lainnya", callback_data: "guide" }]] },
  },
  guide_care: {
    text: "💗 *PET CARE — RAWAT COMPANION-MU*\n\n• *Hunger:* berkurang seiring waktu. Beli Apple di Shop lalu gunakan Feed untuk memulihkan 50 poin Hunger.\n• *Mood:* jaga dengan rutin berinteraksi dan bermain bersama pet.\n• *Energy:* dipakai untuk aktivitas seperti Play, Training, dan Battle. Energy Potion memulihkan 30 poin.\n• *Cleanliness:* kebersihan pet ikut memengaruhi kondisi dan Mood.\n\n*Training:* tanpa Training Manual, Training memberi +45 XP dan memakai 35% Energy. Dengan Training Manual, Training memberi +70 XP dan memakai 5% Energy. Manual dibeli di Shop seharga 120 koin.\n\n*Sleep:* gunakan saat pet perlu memulihkan Energy. Saat tidur, aktivitas tertentu tidak bisa dilakukan sampai pet dibangunkan. Cek status pet di Home secara berkala.",
    keyboard: { inline_keyboard: [[{ text: "🛍 Buka Shop", callback_data: "guide_shop" }, { text: "🏠 Tentang Home", callback_data: "guide_home" }], [{ text: "‹ Panduan lainnya", callback_data: "guide" }]] },
  },
  commands: {
    text: "💌 *A few handy commands*\n\n/start — say hello and open the menu 🌷\n/menu — show the main menu 🏡\n/help — get a little help 🧸\n/about — learn about Tamaverse ✨\n/game — jump into the game 🥚\n/support — contact our support team 💗",
    keyboard: { inline_keyboard: [[{ text: "‹ Back to menu", callback_data: "home" }]] },
  },
  support: {
    text: "🧸 *Need a little help?*\n\nOh no, something not working as expected? No worries! We’re happy to help. 🌷\n\nTell our support team what happened and share a screenshot if it helps explain the issue. Please don’t share private account details or verification codes. 💌\n\nWe’ll do our best to help you out. See you there, Tama Pal! ✨",
    keyboard: { inline_keyboard: [[{ text: "💌 Chat with @TamaSupportBot", url: "https://t.me/TamaSupportBot" }], [{ text: "‹ Back to menu 🌷", callback_data: "home" }]] },
  },
};

async function telegram(method: string, body: Record<string, unknown>) {
  if (!API) throw new Error("Missing TELEGRAM_BOT_TOKEN3");
  const response = await fetch(`${API}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const result = await response.json();
  if (!response.ok || !result.ok) {
    console.error("Telegram API error", method, result);
    throw new Error(`Telegram API request failed: ${method}`);
  }
  return result;
}

async function recordBotStart(telegramUserId: number) {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) throw new Error("Supabase service configuration missing");
  const response = await fetch(`${SUPABASE_URL}/rest/v1/tamaverse_telegram_bot_starts`, {
    method: "POST",
    headers: {
      "apikey": SERVICE_ROLE_KEY,
      "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      "Prefer": "resolution=merge-duplicates"
    },
    body: JSON.stringify({ telegram_user_id: String(telegramUserId), started_at: new Date().toISOString() })
  });
  if (!response.ok) throw new Error("Could not record Telegram bot start");

  const linked = await fetch(
    `${SUPABASE_URL}/rest/v1/tamaverse_telegram_links?telegram_user_id=eq.${telegramUserId}`,
    {
      method: "PATCH",
      headers: {
        "apikey": SERVICE_ROLE_KEY,
        "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
        "Prefer": "return=minimal"
      },
      body: JSON.stringify({ bot_started_at: new Date().toISOString() })
    }
  );
  if (!linked.ok) throw new Error("Could not update Telegram notification permission");
}


async function getBroadcastRecipients(): Promise<string[]> {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) throw new Error("Supabase service configuration missing");
  const ids = new Set<string>();
  let offset = 0;
  while (true) {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/tamaverse_telegram_bot_starts?select=telegram_user_id&order=telegram_user_id.asc&limit=1000&offset=${offset}`, {
      headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}` }
    });
    if (!response.ok) throw new Error("Could not load broadcast recipients");
    const rows = await response.json() as Array<{ telegram_user_id: string }>;
    for (const row of rows) if (row.telegram_user_id) ids.add(String(row.telegram_user_id));
    if (rows.length < 1000) break;
    offset += rows.length;
  }
  return [...ids];
}

async function copyBroadcastMessage(sourceChatId: number, sourceMessageId: number, recipientId: string) {
  return telegram("copyMessage", { chat_id: Number(recipientId), from_chat_id: sourceChatId, message_id: sourceMessageId });
}

async function send(chatId: number, text: string, replyMarkup?: unknown) {
  return telegram("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "Markdown",
    disable_web_page_preview: true,
    ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
  });
}

async function showPage(chatId: number, messageId: number, page: string) {
  const selected = pages[page] ?? pages.home;
  return telegram("editMessageText", {
    chat_id: chatId,
    message_id: messageId,
    text: selected.text,
    parse_mode: "Markdown",
    disable_web_page_preview: true,
    ...(selected.keyboard ? { reply_markup: selected.keyboard } : {}),
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "GET") {
    return Response.json({ ok: true, service: "tamaverse-main-bot", configured: Boolean(BOT_TOKEN) });
  }
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  if (!BOT_TOKEN) return Response.json({ ok: false, error: "Bot token is not configured" }, { status: 500 });

  if (WEBHOOK_SECRET) {
    const supplied = req.headers.get("x-telegram-bot-api-secret-token") ?? "";
    if (supplied !== WEBHOOK_SECRET) return new Response("Unauthorized", { status: 401 });
  }

  let update: TgUpdate;
  try {
    update = await req.json();
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  try {
    if (update.callback_query) {
      const query = update.callback_query;
      const chatId = query.message?.chat.id;
      const messageId = query.message?.message_id;
      const data = query.data ?? "home";
      if (data.startsWith("broadcast_send:")) {
        if (!ADMIN_TELEGRAM_ID || String(query.from?.id ?? "") !== ADMIN_TELEGRAM_ID || chatId !== Number(ADMIN_TELEGRAM_ID)) {
          await telegram("answerCallbackQuery", { callback_query_id: query.id, text: "Akses ditolak.", show_alert: true });
          return Response.json({ ok: true });
        }
        const sourceMessageId = Number(data.slice(15));
        if (!Number.isInteger(sourceMessageId) || sourceMessageId < 1 || !chatId) {
          await telegram("answerCallbackQuery", { callback_query_id: query.id, text: "Pesan tidak valid.", show_alert: true });
          return Response.json({ ok: true });
        }
        await telegram("answerCallbackQuery", { callback_query_id: query.id, text: "Broadcast dimulai." });
        if (messageId) await telegram("editMessageText", { chat_id: chatId, message_id: messageId, text: "⏳ Broadcast sedang diproses..." });
        const recipients = await getBroadcastRecipients();
        let sent = 0;
        let failed = 0;
        for (const recipient of recipients) {
          try { await copyBroadcastMessage(chatId, sourceMessageId, recipient); sent++; }
          catch { failed++; }
          await new Promise((resolve) => setTimeout(resolve, 40));
        }
        await send(chatId, `✅ *Broadcast selesai*\n\nTerkirim: ${sent}\nGagal: ${failed}\nTotal terdaftar: ${recipients.length}`);
        return Response.json({ ok: true });
      }
      await telegram("answerCallbackQuery", { callback_query_id: query.id });
      if (chatId && messageId) await showPage(chatId, messageId, data);
      return Response.json({ ok: true });
    }

    const message = update.message;
    if (!message?.chat?.id) return Response.json({ ok: true });
    const chatId = message.chat.id;
    const isAdmin = Boolean(ADMIN_TELEGRAM_ID) && String(message.from?.id ?? "") === ADMIN_TELEGRAM_ID && chatId === Number(ADMIN_TELEGRAM_ID) && message.chat.type === "private";
    if (!message.text && !isAdmin) return Response.json({ ok: true });
    const command = (message.text ?? "").trim().split(/\s+/)[0].split("@")[0].toLowerCase();
    const firstName = (message.from?.first_name ?? "there").replace(/[<>]/g, "");
    if (isAdmin && command !== "/start" && command !== "/menu" && !command.startsWith("/")) {
      const recipients = await getBroadcastRecipients();
      await send(chatId, `📣 *Konfirmasi broadcast*\n\nPesan akan disalin ke *${recipients.length}* pengguna yang pernah menekan /start.\n\nLanjutkan?`, {
        inline_keyboard: [[{ text: "✅ Kirim ke semua", callback_data: `broadcast_send:${message.message_id}` }], [{ text: "✖️ Batal", callback_data: "home" }]]
      });
      return Response.json({ ok: true });
    }

    switch (command) {
      case "/start":
        await recordBotStart(chatId);
        await send(chatId, `🌙 *Hey, ${firstName}!*\n\nWelcome to *Tamaverse* — a cozy universe for your virtual-pet journey.\n\nReady to meet your companion and explore? Pick a menu below.`, mainKeyboard);
        break;
      case "/menu":
        await send(chatId, `🌙 *Hey, ${firstName}!*\\n\\nWelcome back to *Tamaverse* — ready to visit your little companions? Pick a menu below.`, mainKeyboard);
        break;
      case "/about":
        await send(chatId, pages.about.text, pages.about.keyboard);
        break;
      case "/help":
        await send(chatId, pages.support.text, pages.support.keyboard);
        break;
      case "/game":
        await send(chatId, "🎮 Your Tamaverse adventure is just one tap away! Ready, set, hatch! 🐣✨", { inline_keyboard: [[{ text: "Open Tamaverse", web_app: { url: APP_URL } }], [{ text: "‹ Main menu", callback_data: "home" }]] });
        break;
      case "/support":
        await send(chatId, pages.support.text, pages.support.keyboard);
        break;
      default:
        await send(chatId, "I didn't recognize that command. Use /menu to see what I can do.", mainKeyboard);
    }
  } catch (error) {
    console.error("Update handling failed", error);
    // Return 200 so Telegram does not retry an update indefinitely after a transient API failure.
  }
  return Response.json({ ok: true });
});
