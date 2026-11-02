import { createClient } from "npm:@supabase/supabase-js@2";

/**
 * NEXORA PAY • TAMAVERSE  (@Nexorapaymbot)
 * Single-file Telegram bot — manual payment with admin approval.
 *
 * Alur: katalog → konfirmasi → order + topik forum admin → pilih QRIS/GoPay.
 * GoPay: instruksi otomatis → user mengirim bukti.
 * QRIS: admin mengirim QRIS → user mengirim bukti.
 * Admin memeriksa pembayaran lalu APPROVE/DECLINE; Diamond hanya dikredit setelah APPROVE.
 */

// ───────────────────────── CONFIG ─────────────────────────
function env(name: string, fallback?: string): string {
  const v = Deno.env.get(name) ?? fallback;
  if (v === undefined || v === "") throw new Error(`Missing env: ${name}`);
  return v;
}

const SUPABASE_URL = env("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = env("SUPABASE_SERVICE_ROLE_KEY");
const TELEGRAM_BOT_TOKEN = env("TELEGRAM_BOT_TOKEN2");
const TELEGRAM_WEBHOOK_SECRET = env("TELEGRAM_WEBHOOK_SECRET");
const ADMIN_FORUM_CHAT_ID = Number(env("ADMIN_FORUM_CHAT_ID", "-1004322036078"));
const ADMIN_TELEGRAM_ID = String(env("ADMIN_TELEGRAM_ID", "8906658395"));
const ORDER_TTL_MINUTES = Number(Deno.env.get("ORDER_TTL_MINUTES") ?? "120");

const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

// ───────────────────────── TYPES ─────────────────────────
// deno-lint-ignore no-explicit-any
type Any = any;
type Json = Record<string, unknown>;
type Status =
  | "PENDING"
  | "WAITING_ADMIN"
  | "WAITING_PAYMENT"
  | "PROOF_SUBMITTED"
  | "APPROVED"
  | "DECLINED"
  | "CANCELLED"
  | "EXPIRED";

interface Order {
  id: string;
  order_code: string;
  telegram_user_id: string;
  telegram_chat_id: number;
  telegram_username: string | null;
  owner_id: string;
  diamonds: number;
  price: number;
  payment_method: "QRIS" | "GOPAY" | null;
  status: Status;
  forum_chat_id: number | null;
  topic_thread_id: number | null;
  admin_message_id: number | null;
  proof_file_id: string | null;
  proof_file_unique_id: string | null;
  decline_reason: string | null;
  created_at: string;
  expires_at: string;
}

interface ActionResult {
  ok: boolean;
  text: string;
  stale?: boolean;
}

// ───────────────────────── DATA ─────────────────────────
const PACKAGES = [
  { diamonds: 5, price: 1_000, unit: 200 },
  { diamonds: 10, price: 1_800, unit: 180 },
  { diamonds: 25, price: 3_500, unit: 140 },
  { diamonds: 50, price: 5_000, unit: 100 },
  { diamonds: 100, price: 7_500, unit: 75 },
  { diamonds: 120, price: 10_800, unit: 90 },
  { diamonds: 300, price: 24_000, unit: 80 },
  { diamonds: 700, price: 49_000, unit: 70 },
] as const;

const ACTIVE: Status[] = ["PENDING", "WAITING_ADMIN", "WAITING_PAYMENT", "PROOF_SUBMITTED"];

const STATUS_LABEL: Record<Status, string> = {
  PENDING: "🕓 Pesanan dibuat",
  WAITING_ADMIN: "⏳ Menunggu info pembayaran",
  WAITING_PAYMENT: "💳 Menunggu bukti pembayaran",
  PROOF_SUBMITTED: "🧾 Bukti diterima, menunggu admin",
  APPROVED: "✅ Disetujui",
  DECLINED: "❌ Ditolak",
  CANCELLED: "🚫 Dibatalkan",
  EXPIRED: "⌛ Kedaluwarsa",
};

const money = (v: number) => new Intl.NumberFormat("id-ID").format(v);
const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }) + " WIB";

// ───────────────────────── TEKS ─────────────────────────
const TEXT = {
  welcome: "💎 NEXORA PAY • TAMAVERSE\n\nSelamat datang! Pilih menu:", 
  help: "📋 PANDUAN NEXORA\n\n" +
    "1️⃣ Hubungkan akun: kirim /uuid UUID_KAMU\n" +
    "2️⃣ Top Up Diamond: pilih paket → konfirmasi → pilih QRIS/GoPay\n" +
    "3️⃣ GoPay: instruksi langsung dikirim otomatis. QRIS: tunggu admin mengirim gambar QRIS\n" +
    "4️⃣ Kirim foto bukti ke chat ini\n" +
    "5️⃣ Tunggu admin memeriksa pembayaran\n\n" +
    "🛡️ Jangan pernah membagikan password, PIN, atau kode OTP.", 
  uuidPrompt: "🔗 HUBUNGKAN AKUN TAMAVERSE\n\n" +
    "Buka aplikasi Tamaverse → Profile → salin UUID.\n" +
    "Kirim ke chat ini dengan format:\n/uuid UUID_KAMU\n\n" +
    "Jangan bagikan password atau kode rahasia.",
  uuidInvalid: "⚠️ Format UUID belum sesuai.\nSalin UUID dari Tamaverse → Profile, lalu kirim:\n/uuid UUID_KAMU",
  uuidNotFound: "⚠️ UUID Tamaverse tidak ditemukan. Periksa kembali UUID dari menu Profile.",
  uuidAlreadyLinked: "⚠️ Akun Telegram ini sudah terhubung ke UUID Tamaverse lain. Hubungi admin jika perlu bantuan.",
  uuidGameLinked: "⚠️ UUID Tamaverse ini sudah terhubung ke akun Telegram lain.",
  uuidSaved: "✅ UUID Tamaverse berhasil terhubung!",
  needLink: "🔗 Hubungkan UUID Tamaverse dulu sebelum top up.\n\nKirim: /uuid UUID_KAMU",
  ticketFailed: "⚠️ Tiket pesanan gagal dibuat. Pesanan tidak tersimpan, silakan coba lagi sebentar lagi.",
  genericError: "⚠️ Terjadi kendala. Coba lagi beberapa saat.",
  unknown: "Perintah belum dikenali. Ketik /help untuk panduan.",
  noOrderForProof: "Belum ada pesanan yang menunggu bukti. Mulai dari menu Top Up Diamond.",
  notPrivate: "Gunakan bot ini lewat chat pribadi.",
};

// ───────────────────────── TELEGRAM HELPERS ─────────────────────────
async function tg<T = Any>(method: string, body: Json): Promise<T> {
  const res = await fetch(`${TELEGRAM_API}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const result = await res.json();
  if (!res.ok || !result.ok) {
    throw new Error(result.description || `Telegram ${method} failed`);
  }
  return result.result as T;
}

async function tgTry<T = Any>(method: string, body: Json): Promise<T | null> {
  try {
    return await tg<T>(method, body);
  } catch (e) {
    console.error(`tg ${method} failed:`, (e as Error).message);
    return null;
  }
}

const sendMessage = (chatId: number | string, text: string, extra: Json = {}) =>
  tg("sendMessage", { chat_id: chatId, text, ...extra });

const CLEAR_KB = { inline_keyboard: [] as unknown[] };

/** Edit pesan di tempat (hindari pesan duplikat); fallback kirim baru. */
async function show(chatId: number | string, messageId: number | undefined, text: string, markup?: Json) {
  if (messageId) {
    try {
      await tg("editMessageText", {
        chat_id: chatId,
        message_id: messageId,
        text,
        reply_markup: markup ?? CLEAR_KB,
      });
      return;
    } catch (e) {
      if (String((e as Error).message).includes("message is not modified")) return;
      await tgTry("editMessageReplyMarkup", {
        chat_id: chatId,
        message_id: messageId,
        reply_markup: CLEAR_KB,
      });
    }
  }
  await sendMessage(chatId, text, markup ? { reply_markup: markup } : {});
}

const sendTopic = (o: Order, text: string, extra: Json = {}) =>
  tgTry("sendMessage", {
    chat_id: o.forum_chat_id,
    message_thread_id: o.topic_thread_id,
    text,
    ...extra,
  });

const notifyUser = (o: Order, text: string, markup?: Json) =>
  tgTry("sendMessage", {
    chat_id: o.telegram_chat_id,
    text,
    ...(markup ? { reply_markup: markup } : {}),
  });

// ───────────────────────── KEYBOARDS ─────────────────────────
const homeMarkup = () => ({
  inline_keyboard: [
    [{ text: "💎 Top Up Diamond", callback_data: "m:topup" }],
    [{ text: "🔗 Hubungkan UUID", callback_data: "m:uuid" }],
    [{ text: "📜 Riwayat Pesanan", callback_data: "m:hist" }],
    [{ text: "📋 Bantuan", callback_data: "m:help" }],
  ],
});

const backMarkup = () => ({
  inline_keyboard: [[{ text: "⬅️ Menu utama", callback_data: "m:home" }]],
});

function packageMarkup() {
  const rows: Json[][] = [];
  for (let i = 0; i < PACKAGES.length; i += 2) {
    rows.push(
      PACKAGES.slice(i, i + 2).map((p) => ({
        text: `${p.diamonds} 💎 — Rp${money(p.price)}`,
        callback_data: `p:${p.diamonds}`,
      })),
    );
  }
  rows.push([{ text: "⬅️ Menu utama", callback_data: "m:home" }]);
  return { inline_keyboard: rows };
}

const methodMarkup = (code: string) => ({
  inline_keyboard: [
    [
      { text: "🟦 QRIS", callback_data: `pm:${code}:q` },
      { text: "🟩 GoPay", callback_data: `pm:${code}:g` },
    ],
    [{ text: "❌ Batalkan pesanan", callback_data: `x:${code}` }],
  ],
});

const cancelMarkup = (code: string) => ({
  inline_keyboard: [[{ text: "❌ Batalkan pesanan", callback_data: `x:${code}` }]],
});

const proofMarkup = (code: string) => ({
  inline_keyboard: [[
    { text: "✅ APPROVE", callback_data: `a:${code}` },
    { text: "❌ DECLINE", callback_data: `d:${code}` },
  ]],
});

function escapeHtml(value: string): string {
  const entities: Record<string, string> = {
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  };
  return value.replace(/[&<>"']/g, (ch) => entities[ch]);
}

async function sendGopayInstructions(o: Order): Promise<boolean> {
  const number = Deno.env.get("GOPAY_NUMBER")?.trim();
  const accountName = Deno.env.get("GOPAY_ACCOUNT_NAME")?.trim();
  if (!number || !accountName) {
    console.error("GoPay details missing: set GOPAY_NUMBER and GOPAY_ACCOUNT_NAME Supabase secrets.");
    return false;
  }
  const message =
    `🟩 <b>PEMBAYARAN GOPAY</b>\n\n` +
    `<b>GoPay :</b> <code>${escapeHtml(number)}</code>\n` +
    `<b>A/N     :</b> <b>${escapeHtml(accountName)}</b>\n\n` +
    `<b>Nominal :</b> Rp${money(o.price)}\n` +
    `<b>Order ID:</b> <code>${escapeHtml(o.order_code)}</code>\n\n` +
    `Silakan selesaikan pembayaran sesuai nominal di atas, lalu langsung kirim foto bukti pembayaran ke chat ini.\n\n` +
    `Admin akan memeriksa pembayaran sebelum Diamond ditambahkan.`;
  const sent = await tgTry("sendMessage", {
    chat_id: o.telegram_chat_id,
    text: message,
    parse_mode: "HTML",
    reply_markup: cancelMarkup(o.order_code),
  });
  return Boolean(sent);
}

// ───────────────────────── TEXT BUILDERS ─────────────────────────
function catalogueText() {
  return [
    "💎 DAFTAR HARGA DIAMOND",
    "",
    ...PACKAGES.map((p) => `${p.diamonds} 💎 — Rp${money(p.price)} (Rp${money(p.unit)}/Diamond)`),
    "",
    "Pilih paket untuk melanjutkan.",

  ].join("\n");
}

function adminHint(o: Order): string {
  if (o.status === "WAITING_ADMIN") {
    return o.payment_method === "QRIS"
      ? "➡️ Kirim gambar QRIS asli yang akan dipakai untuk pembayaran."
      : "➡️ Kirim instruksi pembayaran GoPay yang benar dan masih berlaku.";
  }
  if (o.status === "PENDING") return "User belum memilih metode.";
  if (o.status === "WAITING_PAYMENT") return "Info pembayaran sudah dikirim ke user.";
  if (o.status === "PROOF_SUBMITTED") return "Bukti sudah masuk. Gunakan APPROVE/DECLINE pada pesan bukti.";
  return "Pesanan selesai.";
}

function ticketText(o: Order): string {
  return [
    "🎫 TIKET PESANAN",

    "",
    `🧾 Order ID: ${o.order_code}`,
    `👤 Telegram ID: ${o.telegram_user_id}`,
    `🔖 Username: ${o.telegram_username ? "@" + o.telegram_username : "-"}`,
    `🔗 UUID: ${o.owner_id}`,
    `💎 Paket: ${o.diamonds} Diamond`,
    `💰 Nominal: Rp${money(o.price)}`,
    `💳 Metode: ${o.payment_method ?? "belum dipilih"}`,
    `📌 Status: ${STATUS_LABEL[o.status]}`,
    `🕒 Dibuat: ${fmtDate(o.created_at)}`,
    "",
    adminHint(o),
  ].join("\n");
}

function activeOrderView(o: Order): { text: string; markup: Json } {
  const head = `🧾 Pesanan aktif: ${o.order_code}\n💎 ${o.diamonds} Diamond · Rp${money(o.price)}\n📌 ${STATUS_LABEL[o.status]}\n\n`;
  if (o.status === "PENDING") {
    return { text: head + "Pilih metode pembayaran:", markup: methodMarkup(o.order_code) };
  }
  if (o.status === "WAITING_ADMIN") {
    return { text: head + (o.payment_method === "GOPAY"
      ? "Instruksi GoPay sedang disiapkan admin. Jika belum terkirim, admin akan membantu."
      : "Admin sedang menyiapkan QRIS."), markup: cancelMarkup(o.order_code) };
  }
  if (o.status === "WAITING_PAYMENT") {
    return { text: head + "Setelah membayar, kirim foto bukti pembayaran ke chat ini.", markup: cancelMarkup(o.order_code) };
  }
  return { text: head + "Bukti sudah diterima. Menunggu pemeriksaan admin.", markup: backMarkup() };
}

// ───────────────────────── DB HELPERS ─────────────────────────
async function getOrder(code: string): Promise<Order | null> {
  const { data, error } = await db.from("nexora_orders").select("*").eq("order_code", code).maybeSingle();
  if (error) throw error;
  return (data as Order | null) ?? null;
}

async function getActiveOrder(telegramId: string): Promise<Order | null> {
  const { data, error } = await db
    .from("nexora_orders")
    .select("*")
    .eq("telegram_user_id", telegramId)
    .in("status", ACTIVE)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as Order | null) ?? null;
}

/** Compare-and-swap status. null = status sudah bukan salah satu dari `from`. */
async function transition(
  code: string,
  from: Status[],
  to: Status,
  actor: string,
  note: string | null = null,
  extra: Json = {},
): Promise<Order | null> {
  const { data, error } = await db.rpc("nexora_transition", {
    p_code: code,
    p_from: from,
    p_to: to,
    p_actor: actor,
    p_note: note,
    p_extra: extra,
  });
  if (error) throw error;
  return (data as Order | null) ?? null;
}

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function genCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return "NXR-" + Array.from(bytes, (b) => ALPHABET[b % 32]).join("");
}

async function refreshTicket(o: Order) {
  if (!o.forum_chat_id || !o.admin_message_id) return;
  await tgTry("editMessageText", {
    chat_id: o.forum_chat_id,
    message_id: o.admin_message_id,
    text: ticketText(o),
  });
}

async function closeTopic(o: Order) {
  if (!o.forum_chat_id || !o.topic_thread_id) return;
  await tgTry("closeForumTopic", {
    chat_id: o.forum_chat_id,
    message_thread_id: o.topic_thread_id,
  });
}

/** Dipanggil setelah order masuk status akhir. */
async function afterTerminal(o: Order, topicNote: string) {
  await refreshTicket(o);
  await sendTopic(o, topicNote);
  await closeTopic(o);
}

async function expireStale() {
  const { data, error } = await db.rpc("nexora_expire_stale");
  if (error) {
    console.error("expire_stale failed:", error);
    return;
  }
  for (const o of (data ?? []) as Order[]) {
    await notifyUser(
      o,
      `⌛ Pesanan ${o.order_code} kedaluwarsa karena tidak diselesaikan tepat waktu.\nSilakan buat pesanan baru.`,
      homeMarkup(),
    );
    await afterTerminal(o, "⌛ Pesanan kedaluwarsa (otomatis).");
  }
}

// ───────────────────────── UUID LINKING ─────────────────────────
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type LinkResult = "ok" | "not_found" | "telegram_other" | "uuid_other" | "error";

/** Hubungkan Telegram ↔ UUID. Satu UUID hanya boleh ke satu Telegram, dan sebaliknya. */
async function ensureLink(telegramId: string, username: string, uuid: string): Promise<LinkResult> {
  const { data: authData, error: authError } = await db.auth.admin.getUserById(uuid);
  if (authError || !authData?.user) return "not_found";

  const { data: byTelegram, error: e1 } = await db
    .from("tamaverse_telegram_links")
    .select("owner_id")
    .eq("telegram_user_id", telegramId)
    .maybeSingle();
  if (e1) return "error";
  if (byTelegram && String(byTelegram.owner_id) !== uuid) return "telegram_other";

  const { data: byGame, error: e2 } = await db
    .from("tamaverse_telegram_links")
    .select("telegram_user_id")
    .eq("owner_id", uuid)
    .maybeSingle();
  if (e2) return "error";
  if (byGame && String(byGame.telegram_user_id) !== telegramId) return "uuid_other";

  const { error: saveError } = await db.from("tamaverse_telegram_links").upsert(
    { telegram_user_id: telegramId, telegram_username: username || null, owner_id: uuid },
    { onConflict: "telegram_user_id" },
  );
  if (saveError) {
    console.error("UUID link save failed:", saveError);
    return "error";
  }
  return "ok";
}

const LINK_MSG: Record<Exclude<LinkResult, "ok">, string> = {
  not_found: TEXT.uuidNotFound,
  telegram_other: TEXT.uuidAlreadyLinked,
  uuid_other: TEXT.uuidGameLinked,
  error: TEXT.genericError,
};

async function linkUuid(chatId: number | string, telegramId: string, username: string, supplied: string) {
  const uuid = supplied.trim().toLowerCase();
  if (!UUID_PATTERN.test(uuid)) {
    await sendMessage(chatId, TEXT.uuidInvalid);
    return;
  }
  const result = await ensureLink(telegramId, username, uuid);
  if (result !== "ok") {
    await sendMessage(chatId, LINK_MSG[result]);
    return;
  }
  await sendMessage(chatId, `${TEXT.uuidSaved}\n\nPilih menu berikut:`, { reply_markup: homeMarkup() });
}

// ───────────────────────── ORDER FLOW (USER) ─────────────────────────
async function showHistory(chatId: number, messageId: number | undefined, telegramId: string) {
  await expireStale();
  const { data, error } = await db
    .from("nexora_orders")
    .select("*")
    .eq("telegram_user_id", telegramId)
    .order("created_at", { ascending: false })
    .limit(10);
  if (error) throw error;
  const rows = (data ?? []) as Order[];
  const text = rows.length === 0
    ? "📜 RIWAYAT PESANAN\n\nBelum ada pesanan."
    : "📜 RIWAYAT PESANAN (10 terakhir)\n\n" +
      rows.map((o) =>
        `🧾 ${o.order_code}\n💎 ${o.diamonds} · Rp${money(o.price)} · ${o.payment_method ?? "-"}\n${STATUS_LABEL[o.status]}\n🕒 ${fmtDate(o.created_at)}`
      ).join("\n\n");
  await show(chatId, messageId, text, backMarkup());
}

async function showPackageDetail(chatId: number, messageId: number, amount: number) {
  const pack = PACKAGES.find((p) => p.diamonds === amount);
  if (!pack) return false;
  await show(
    chatId,
    messageId,
    `DETAIL PAKET\n\n💎 ${pack.diamonds} Diamond\n💰 Rp${money(pack.price)}\n📌 Rp${money(pack.unit)}/Diamond\n\nLanjutkan pesanan ini?`,
    {
      inline_keyboard: [
        [{ text: "✅ Konfirmasi pesanan", callback_data: `c:${pack.diamonds}` }],
        [{ text: "⬅️ Pilih paket lain", callback_data: "m:topup" }],
      ],
    },
  );
  return true;
}

type Pack = (typeof PACKAGES)[number];
type PayMethod = "QRIS" | "GOPAY";
type CreateResult =
  | { kind: "created"; order: Order }
  | { kind: "existing"; order: Order }
  | { kind: "failed" };

/**
 * Inti pembuatan pesanan + topik admin. Dipakai oleh alur manual (menu bot)
 * dan alur checkout dari Mini App. `method` terisi = metode sudah dipilih di Mini App,
 * lalu GoPay dikirim otomatis sedangkan QRIS menunggu admin.
 */
async function createOrderWithTopic(
  chatId: number,
  from: Any,
  ownerId: string,
  pack: Pack,
  method: PayMethod | null,
  source: "bot" | "miniapp",
): Promise<CreateResult> {
  const telegramId = String(from.id);

  const existing = await getActiveOrder(telegramId);
  if (existing) return { kind: "existing", order: existing };

  const code = genCode();
  const { data: ins, error: insErr } = await db
    .from("nexora_orders")
    .insert({
      order_code: code,
      telegram_user_id: telegramId,
      telegram_chat_id: chatId,
      telegram_username: from.username ?? null,
      owner_id: ownerId,
      diamonds: pack.diamonds,
      price: pack.price,
      status: "PENDING",
      source,
      expires_at: new Date(Date.now() + ORDER_TTL_MINUTES * 60_000).toISOString(),
    })
    .select("*")
    .single();

  if (insErr) {
    if (insErr.code === "23505") {
      // tap ganda / pesanan aktif sudah ada
      const again = await getActiveOrder(telegramId);
      if (again) return { kind: "existing", order: again };
    }
    throw insErr;
  }
  const order = ins as Order;

  // Buat topik forum. Gagal = pesanan dibatalkan, user diberi tahu jujur.
  const who = from.username ? `@${from.username}` : `id${telegramId}`;
  let threadId: number;
  try {
    const topic = await tg<{ message_thread_id: number }>("createForumTopic", {
      chat_id: ADMIN_FORUM_CHAT_ID,
      name: `${code} | ${who} | ${pack.diamonds}💎`.slice(0, 128),
    });
    threadId = topic.message_thread_id;
  } catch (e) {
    console.error("createForumTopic failed:", (e as Error).message);
    await transition(code, ["PENDING"], "CANCELLED", "system", "topic_create_failed").catch(() => null);
    await tgTry("sendMessage", {
      chat_id: ADMIN_TELEGRAM_ID,
      text: `⚠️ Gagal membuat topik untuk ${code}: ${(e as Error).message}\nCek: grup Forum aktif, bot admin + izin Manage Topics.`,
    });
    return { kind: "failed" };
  }

  // Satu pesanan = satu topik (hanya set bila belum ada topik)
  const { data: bound, error: bindErr } = await db
    .from("nexora_orders")
    .update({ forum_chat_id: ADMIN_FORUM_CHAT_ID, topic_thread_id: threadId })
    .eq("id", order.id)
    .is("topic_thread_id", null)
    .select("*")
    .maybeSingle();
  if (bindErr || !bound) {
    console.error("bind topic failed:", bindErr);
    await tgTry("deleteForumTopic", { chat_id: ADMIN_FORUM_CHAT_ID, message_thread_id: threadId });
    await transition(code, ["PENDING"], "CANCELLED", "system", "topic_bind_failed").catch(() => null);
    return { kind: "failed" };
  }
  let ready = bound as Order;

  // Metode sudah dipilih di Mini App → langsung WAITING_ADMIN
  if (method) {
    const upd = await transition(code, ["PENDING"], "WAITING_ADMIN", telegramId, source, { payment_method: method });
    if (upd) ready = upd;
  }

  const head = await tgTry<{ message_id: number }>("sendMessage", {
    chat_id: ADMIN_FORUM_CHAT_ID,
    message_thread_id: threadId,
    text: ticketText(ready),
  });
  if (head) {
    await db.from("nexora_orders").update({ admin_message_id: head.message_id }).eq("id", order.id);
    ready = { ...ready, admin_message_id: head.message_id };
  }

  if (method && ready.status === "WAITING_ADMIN") {
    if (method === "GOPAY" && await sendGopayInstructions(ready)) {
      const paidWait = await transition(code, ["WAITING_ADMIN"], "WAITING_PAYMENT", telegramId, source);
      if (paidWait) ready = paidWait;
      await refreshTicket(ready);
    }
    await sendTopic(
      ready,
      method === "GOPAY" && ready.status === "WAITING_PAYMENT"
        ? "📲 Instruksi GoPay otomatis sudah dikirim ke user. User dapat langsung mengirim bukti pembayaran."
        : `📲 Pesanan dari checkout game (Mini App). User sudah memilih ${method}.\n\n${adminHint(ready)}`,
    );
  }
  return { kind: "created", order: ready };
}

async function startOrder(chatId: number, messageId: number, from: Any, amount: number) {
  const pack = PACKAGES.find((p) => p.diamonds === amount);
  if (!pack) return false;
  const telegramId = String(from.id);

  await expireStale();

  const { data: link, error: linkErr } = await db
    .from("tamaverse_telegram_links")
    .select("owner_id")
    .eq("telegram_user_id", telegramId)
    .maybeSingle();
  if (linkErr) throw linkErr;
  if (!link) {
    await show(chatId, messageId, TEXT.needLink, backMarkup());
    return true;
  }

  const res = await createOrderWithTopic(chatId, from, String(link.owner_id), pack, null, "bot");
  if (res.kind === "existing") {
    const v = activeOrderView(res.order);
    await show(chatId, messageId, "ℹ️ Kamu masih punya pesanan aktif.\n\n" + v.text, v.markup);
    return true;
  }
  if (res.kind === "failed") {
    await show(chatId, messageId, TEXT.ticketFailed, backMarkup());
    return true;
  }

  await show(
    chatId,
    messageId,
    `✅ Pesanan dibuat\n\n🧾 Order ID: ${res.order.order_code}\n💎 ${pack.diamonds} Diamond\n💰 Rp${money(pack.price)}\n\nPilih metode pembayaran:` +

    methodMarkup(res.order.order_code),
  );
  return true;
}

const CHECKOUT_TOKEN = /^[A-Za-z0-9_-]{16,64}$/;

/** /start <token> dari Mini App: buat tiket langsung dengan data dari checkout intent. */
async function handleCheckoutStart(message: Any, token: string) {
  const chatId = message.chat.id;
  const from = message.from;
  const telegramId = String(from.id);

  await expireStale();

  const { data: intent, error } = await db
    .from("nexora_checkout_intents")
    .select("*")
    .eq("token", token)
    .maybeSingle();
  if (error) throw error;
  if (!intent) {
    await sendMessage(chatId, "⚠️ Link checkout tidak valid. Silakan pilih paket lagi dari game.");
    return;
  }

  // Idempoten: token yang sudah jadi pesanan hanya menampilkan pesanan itu ke pemiliknya.
  if (intent.order_id) {
    if (intent.claimed_by !== telegramId) {
      await sendMessage(chatId, "⚠️ Link checkout ini sudah dipakai.");
      return;
    }
    const { data: o } = await db.from("nexora_orders").select("*").eq("id", intent.order_id).maybeSingle();
    if (o && ACTIVE.includes((o as Order).status)) {
      const v = activeOrderView(o as Order);
      await sendMessage(chatId, "ℹ️ Pesanan dari checkout ini sudah dibuat.\n\n" + v.text, { reply_markup: v.markup });
    } else {
      await sendMessage(chatId, "ℹ️ Pesanan dari checkout ini sudah selesai.", { reply_markup: homeMarkup() });
    }
    return;
  }

  if (new Date(intent.expires_at).getTime() < Date.now()) {
    await sendMessage(chatId, "⌛ Link checkout sudah kedaluwarsa. Silakan pilih paket lagi dari game.");
    return;
  }

  // Harga selalu dari katalog server, bukan dari data klien.
  const pack = PACKAGES.find((p) => p.diamonds === intent.diamonds);
  const method: PayMethod | null = intent.method === "QRIS" ? "QRIS" : intent.method === "GOPAY" ? "GOPAY" : null;
  if (!pack || !method) {
    await sendMessage(chatId, "⚠️ Data checkout tidak valid. Silakan pilih paket lagi dari game.");
    return;
  }

  // Klaim atomik: hanya satu /start yang boleh memproses token ini.
  const { data: claimed, error: claimErr } = await db
    .from("nexora_checkout_intents")
    .update({ claimed_by: telegramId, claimed_at: new Date().toISOString() })
    .eq("token", token)
    .is("claimed_at", null)
    .is("order_id", null)
    .select("token")
    .maybeSingle();
  if (claimErr) throw claimErr;
  if (!claimed) {
    await sendMessage(chatId, "⏳ Checkout ini sedang diproses atau sudah dipakai.");
    return;
  }

  const release = () =>
    db.from("nexora_checkout_intents")
      .update({ claimed_by: null, claimed_at: null })
      .eq("token", token)
      .is("order_id", null);

  try {
    const linked = await ensureLink(telegramId, String(from.username ?? ""), String(intent.owner_id));
    if (linked !== "ok") {
      await release();
      await sendMessage(chatId, LINK_MSG[linked]);
      return;
    }

    const res = await createOrderWithTopic(chatId, from, String(intent.owner_id), pack, method, "miniapp");
    if (res.kind === "existing") {
      await release();
      const v = activeOrderView(res.order);
      await sendMessage(
        chatId,
        "ℹ️ Kamu masih punya pesanan aktif. Selesaikan atau batalkan dulu, lalu ulangi checkout dari game.\n\n" + v.text,
        { reply_markup: v.markup },
      );
      return;
    }
    if (res.kind === "failed") {
      await release();
      await sendMessage(chatId, TEXT.ticketFailed);
      return;
    }

    await db.from("nexora_checkout_intents").update({ order_id: res.order.id }).eq("token", token);
    const o = res.order;
    await sendMessage(
      chatId,
      `✅ Pesanan dibuat dari checkout game\n\n🧾 Order ID: ${o.order_code}\n💎 ${o.diamonds} Diamond\n💰 Rp${money(o.price)}\n💳 Metode: ${method}\n📌 ${STATUS_LABEL[o.status]}\n\n` +
        (method === "QRIS"
          ? "Admin sedang menyiapkan QRIS. Gambarnya akan dikirim ke chat ini."
          : o.status === "WAITING_PAYMENT"
            ? "Instruksi GoPay sudah dikirim. Silakan bayar sesuai nominal lalu kirim foto bukti ke chat ini."
            : "Instruksi GoPay otomatis belum terkirim. Admin akan membantu mengirimkan instruksi."),
      { reply_markup: cancelMarkup(o.order_code) },
    );
  } catch (e) {
    await release();
    throw e;
  }
}

async function chooseMethod(chatId: number, messageId: number, tgId: string, code: string, m: string, ack: Ack) {
  const o = await getOrder(code);
  if (!o || o.telegram_user_id !== tgId) return ack("Pesanan tidak ditemukan", true);
  if (o.status !== "PENDING") return ack("Tombol ini sudah tidak berlaku", true);
  const method = m === "q" ? "QRIS" : m === "g" ? "GOPAY" : null;
  if (!method) return ack("Metode tidak valid", true);

  const upd = await transition(code, ["PENDING"], "WAITING_ADMIN", tgId, null, { payment_method: method });
  if (!upd) return ack("Tombol ini sudah tidak berlaku", true);

  await ack("Metode dipilih");
  let ready = upd;
  if (method === "GOPAY") {
    const gopaySent = await sendGopayInstructions(upd);
    if (gopaySent) {
      const moved = await transition(code, ["WAITING_ADMIN"], "WAITING_PAYMENT", tgId, null);
      if (moved) ready = moved;
    }
  }
  await refreshTicket(ready);
  await sendTopic(
    ready,
    method === "GOPAY" && ready.status === "WAITING_PAYMENT"
      ? `💳 User memilih GoPay untuk ${code}. Instruksi otomatis sudah dikirim; tunggu bukti pembayaran dari user.`
      : `💳 User memilih ${method} untuk ${code}.\n\n${adminHint(ready)}`,
  );
  await show(
    chatId,
    messageId,
    method === "QRIS"
      ? `🟦 QRIS dipilih.\n\nAdmin sedang menyiapkan QRIS untuk pesanan ${code}. Kamu akan menerima gambarnya di chat ini.`
      : ready.status === "WAITING_PAYMENT"
        ? `🟩 GoPay dipilih.\n\nInstruksi pembayaran sudah dikirim. Silakan bayar sesuai nominal lalu kirim foto bukti ke chat ini.`
        : `🟩 GoPay dipilih.\n\nInstruksi GoPay belum bisa dikirim otomatis. Admin akan membantu mengirimkannya.`,
    cancelMarkup(code),
  );
}

async function cancelOrder(chatId: number, messageId: number, tgId: string, code: string, ack: Ack) {
  const o = await getOrder(code);
  if (!o || o.telegram_user_id !== tgId) return ack("Pesanan tidak ditemukan", true);
  const upd = await transition(code, ["PENDING", "WAITING_ADMIN", "WAITING_PAYMENT"], "CANCELLED", tgId, "cancelled_by_user");
  if (!upd) return ack(`Tidak bisa dibatalkan (${STATUS_LABEL[o.status]})`, true);
  await ack("Pesanan dibatalkan");
  await show(chatId, messageId, `🚫 Pesanan ${code} dibatalkan.`, homeMarkup());
  await afterTerminal(upd, "🚫 Pesanan dibatalkan oleh user.");
}

async function handleProof(message: Any) {
  const chatId = message.chat.id;
  const tgId = String(message.from.id);
  await expireStale();

  const o = await getActiveOrder(tgId);
  if (!o) {
    await sendMessage(chatId, TEXT.noOrderForProof, { reply_markup: homeMarkup() });
    return;
  }
  if (o.status === "PROOF_SUBMITTED") {
    await sendMessage(chatId, `🧾 Bukti untuk ${o.order_code} sudah diterima dan sedang diperiksa admin.`);
    return;
  }
  if (o.status !== "WAITING_PAYMENT") {
    await sendMessage(chatId, `Pesanan ${o.order_code} belum siap menerima bukti.\nStatus: ${STATUS_LABEL[o.status]}`);
    return;
  }

  const photo = message.photo[message.photo.length - 1];
  const { data: dup } = await db
    .from("nexora_orders")
    .select("order_code")
    .eq("proof_file_unique_id", photo.file_unique_id)
    .neq("id", o.id)
    .limit(1);
  const dupWarn = dup && dup.length > 0 ? `\n⚠️ Foto yang sama pernah dipakai di ${dup[0].order_code}.` : "";

  // Teruskan ke admin dulu; kalau gagal, status tidak berubah.
  const sent = await tgTry("sendPhoto", {
    chat_id: o.forum_chat_id,
    message_thread_id: o.topic_thread_id,
    photo: photo.file_id,
    caption: [
      `🧾 BUKTI PEMBAYARAN`,
      `Order: ${o.order_code}`,
      `User: ${o.telegram_username ? "@" + o.telegram_username : tgId} (${tgId})`,
      `Paket: ${o.diamonds} Diamond`,
      `Nominal: Rp${money(o.price)}`,
      `Metode: ${o.payment_method}`,
    ].join("\n") + dupWarn,
    reply_markup: proofMarkup(o.order_code),
  });
  if (!sent) {
    await sendMessage(chatId, "⚠️ Bukti belum bisa diteruskan ke admin. Coba kirim ulang sebentar lagi.");
    return;
  }

  const upd = await transition(o.order_code, ["WAITING_PAYMENT"], "PROOF_SUBMITTED", tgId, null, {
    proof_file_id: photo.file_id,
    proof_file_unique_id: photo.file_unique_id,
    proof_meta: {
      width: photo.width,
      height: photo.height,
      file_size: photo.file_size ?? null,
      message_id: message.message_id,
      received_at: new Date().toISOString(),
    },
  });
  if (!upd) {
    await tgTry("deleteMessage", { chat_id: o.forum_chat_id, message_id: sent.message_id });
    await sendMessage(chatId, "⚠️ Pesanan sudah tidak menunggu bukti.");
    return;
  }

  await refreshTicket(upd);
  await sendMessage(
    chatId,
    `✅ Bukti pembayaran untuk ${o.order_code} sudah diterima.\nAdmin akan memeriksa pembayaran sebelum menyetujui pesanan.`,
    { reply_markup: backMarkup() },
  );
}

// ───────────────────────── ADMIN ACTIONS ─────────────────────────
async function approveOrder(o: Order, adminId: string): Promise<ActionResult> {
  if (o.status !== "PROOF_SUBMITTED") {
    return { ok: false, stale: true, text: `Sudah diproses: ${STATUS_LABEL[o.status]}` };
  }

  const { data: au, error: ae } = await db.auth.admin.getUserById(o.owner_id);
  if (ae || !au?.user) {
    return { ok: false, text: "Akun Tamaverse tidak ditemukan. Status tidak diubah." };
  }

  const { data, error } = await db.rpc("nexora_approve_order", { p_code: o.order_code, p_actor: adminId });
  if (error) {
    console.error("approve rpc failed:", error);
    return { ok: false, text: "Gagal menambah Diamond. Status tidak diubah." };
  }
  if (!data?.ok) {
    const map: Record<string, ActionResult> = {
      invalid_status: { ok: false, stale: true, text: `Sudah diproses (${data?.status})` },
      already_credited: { ok: false, stale: true, text: "Diamond order ini sudah pernah dikredit." },
      link_mismatch: { ok: false, text: "UUID tidak lagi terhubung ke Telegram user ini." },
      not_found: { ok: false, text: "Pesanan tidak ditemukan." },
    };
    return map[data?.error as string] ?? { ok: false, text: "Gagal memproses." };
  }

  const fresh = await getOrder(o.order_code);
  if (fresh) {
    await afterTerminal(
      fresh,
      `✅ APPROVED oleh admin.\n💎 ${data.diamonds} Diamond ditambahkan. Saldo akun: ${data.balance_after}.`,
    );
    await notifyUser(
      fresh,
      `🎉 TOP UP BERHASIL!\n\n💎 ${data.diamonds} Diamond telah ditambahkan ke akun Tamaverse kamu.\nSaldo sekarang: ${data.balance_after} 💎\n\nTerima kasih sudah melakukan top up! ✨`,
      homeMarkup(),
    );
  }
  return { ok: true, text: "Disetujui ✅" };
}

async function declineOrder(o: Order, adminId: string, reason: string | null): Promise<ActionResult> {
  if (o.status !== "PROOF_SUBMITTED") {
    return { ok: false, stale: true, text: `Sudah diproses: ${STATUS_LABEL[o.status]}` };
  }
  const upd = await transition(o.order_code, ["PROOF_SUBMITTED"], "DECLINED", adminId, reason);
  if (!upd) return { ok: false, stale: true, text: "Sudah diproses." };

  await afterTerminal(upd, `❌ DECLINED oleh admin.${reason ? `\nAlasan: ${reason}` : ""}`);
  await notifyUser(
    upd,
    `❌ Pesanan ${upd.order_code} ditolak.${reason ? `\nAlasan: ${reason}` : ""}\n\nJika merasa ada kesalahan, hubungi admin.`,
    homeMarkup(),
  );
  return { ok: true, text: "Ditolak ❌" };
}

type Ack = (text?: string, alert?: boolean) => Promise<void>;

async function adminDecision(q: Any, kind: string, code: string, ack: Ack) {
  if (String(q.from.id) !== ADMIN_TELEGRAM_ID) return ack("Hanya admin yang boleh memakai tombol ini.", true);
  if (q.message?.chat?.id !== ADMIN_FORUM_CHAT_ID) return ack("Tombol ini hanya berlaku di grup admin.", true);

  const o = await getOrder(code);
  if (!o) return ack("Pesanan tidak ditemukan", true);
  const msgThread = q.message?.message_thread_id;
  if (msgThread !== undefined && o.topic_thread_id !== msgThread) {
    return ack("Tombol ini bukan milik topik ini.", true);
  }

  const adminId = String(q.from.id);
  const res = kind === "a" ? await approveOrder(o, adminId) : await declineOrder(o, adminId, null);
  await ack(res.text, !res.ok);
  if (res.ok || res.stale) {
    await tgTry("editMessageReplyMarkup", {
      chat_id: q.message.chat.id,
      message_id: q.message.message_id,
      reply_markup: CLEAR_KB,
    });
  }
}

/** Pesan di grup admin: info pembayaran dari admin, atau /tolak <alasan>. */
async function handleGroupMessage(message: Any) {
  if (message.chat?.id !== ADMIN_FORUM_CHAT_ID) return;
  const threadId = message.message_thread_id;
  if (!threadId) return;
  if (message.from?.is_bot || String(message.from?.id ?? "") !== ADMIN_TELEGRAM_ID) return;

  const { data, error } = await db
    .from("nexora_orders")
    .select("*")
    .eq("forum_chat_id", ADMIN_FORUM_CHAT_ID)
    .eq("topic_thread_id", threadId)
    .maybeSingle();
  if (error) throw error;
  const o = data as Order | null;
  if (!o) return;

  const reply = (text: string) => sendTopic(o, text, { reply_to_message_id: message.message_id });
  const text = String(message.text ?? message.caption ?? "").trim();
  const isPhoto = Array.isArray(message.photo) && message.photo.length > 0;

  if (/^\/tolak(@\w+)?(\s|$)/i.test(text)) {
    const reason = text.replace(/^\/tolak(@\w+)?\s*/i, "").trim() || null;
    const res = await declineOrder(o, ADMIN_TELEGRAM_ID, reason);
    if (!res.ok) await reply(res.text);
    return;
  }
  if (text.startsWith("/")) return;
  if (!isPhoto && !text) return;

  if (o.status !== "WAITING_ADMIN") {
    await reply(`Order ${o.order_code}: ${STATUS_LABEL[o.status]}. Tidak sedang menunggu info pembayaran.`);
    return;
  }

  const nominal = `💰 Nominal: Rp${money(o.price)}\n🧾 Order ID: ${o.order_code}`;
  let delivered: unknown = null;

  if (o.payment_method === "QRIS") {
    if (!isPhoto) {
      await reply("Order ini QRIS. Kirim gambar QRIS asli yang akan dipakai user untuk membayar.");
      return;
    }
    const photo = message.photo[message.photo.length - 1];
    delivered = await tgTry("sendPhoto", {
      chat_id: o.telegram_chat_id,
      photo: photo.file_id,
      caption: `🟦 INSTRUKSI PEMBAYARAN QRIS\n\n${nominal}\n\nSelesaikan pembayaran sesuai instruksi admin, lalu kirim foto bukti pembayaran ke chat ini.`,
      reply_markup: cancelMarkup(o.order_code),
    });
  } else if (o.payment_method === "GOPAY") {
    if (!text) {
      await reply("Order ini GoPay. Kirim instruksi pembayaran GoPay yang benar dan masih berlaku.");
      return;
    }
    delivered = await tgTry("sendMessage", {
      chat_id: o.telegram_chat_id,
      text: `🟩 INSTRUKSI PEMBAYARAN GOPAY\n\n${text.slice(0, 2500)}\n\n${nominal}\n\nSelesaikan pembayaran sesuai instruksi admin, lalu kirim foto bukti pembayaran ke chat ini.`,
      reply_markup: cancelMarkup(o.order_code),
    });
  } else {
    await reply("User belum memilih metode pembayaran.");
    return;
  }

  if (!delivered) {
    await reply("⚠️ Gagal mengirim ke user (mungkin bot diblokir). Status tidak diubah.");
    return;
  }

  const upd = await transition(o.order_code, ["WAITING_ADMIN"], "WAITING_PAYMENT", ADMIN_TELEGRAM_ID);
  if (!upd) {
    await reply("⚠️ Status pesanan sudah berubah; info sudah terkirim ke user tetapi status tidak diperbarui.");
    return;
  }
  await refreshTicket(upd);
  await reply(`✅ Info ${o.payment_method} diteruskan ke user. Status: ${STATUS_LABEL.WAITING_PAYMENT}.`);
}

// ───────────────────────── OWNER BALANCE MANAGER ─────────────────────────
type BalanceSession = {
  currency?: "diamond" | "coin"; operation?: "add" | "remove";
  target_id?: string; target_username?: string | null; owner_id?: string;
  amount?: number; reason?: string; stage?: "username" | "amount" | "reason" | "confirm";
};
const ownerOnly = (id: string) => id === ADMIN_TELEGRAM_ID;
const balanceMenu = () => ({ inline_keyboard: [
  [{text:"➕ Add Diamond",callback_data:"bal:diamond:add"},{text:"➖ Remove Diamond",callback_data:"bal:diamond:remove"}],
  [{text:"➕ Add Coin",callback_data:"bal:coin:add"},{text:"➖ Remove Coin",callback_data:"bal:coin:remove"}],
  [{text:"Cancel",callback_data:"bal:cancel"}],
]});
async function getBalanceSession(id:string):Promise<BalanceSession>{
  const {data,error}=await db.from("nexora_admin_sessions").select("session").eq("telegram_user_id",id).maybeSingle();
  if(error) throw error; return (data?.session ?? {}) as BalanceSession;
}
async function setBalanceSession(id:string,session:BalanceSession){
  const {error}=await db.from("nexora_admin_sessions").upsert({telegram_user_id:id,session,updated_at:new Date().toISOString()},{onConflict:"telegram_user_id"});
  if(error) throw error;
}
async function clearBalanceSession(id:string){
  const {error}=await db.from("nexora_admin_sessions").delete().eq("telegram_user_id",id);
  if(error) throw error;
}
async function beginBalanceSetup(chatId:number,id:string){
  if(!ownerOnly(id)) return;
  const {data,error}=await db.from("nexora_bot_settings").select("value").eq("key","balance_log_topic_id").maybeSingle();
  if(error) throw error;
  if(data?.value){ await sendMessage(chatId,"Topik NEXORA BALANCE LOG sudah terhubung."); return; }
  const topic=await tg<Any>("createForumTopic",{chat_id:ADMIN_FORUM_CHAT_ID,name:"NEXORA BALANCE LOG"});
  const {error:saveError}=await db.from("nexora_bot_settings").upsert({key:"balance_log_topic_id",value:String(topic.message_thread_id),updated_at:new Date().toISOString()},{onConflict:"key"});
  if(saveError) throw saveError;
  await sendMessage(chatId,"Topik NEXORA BALANCE LOG berhasil dibuat dan disimpan.");
}
async function beginBalance(chatId:number,id:string){
  if(!ownerOnly(id)) return;
  await clearBalanceSession(id);
  await sendMessage(chatId,"OWNER WALLET MANAGER\nPilih jenis perubahan saldo:",{reply_markup:balanceMenu()});
}
async function balanceCallback(q:Any,kind:string,a:string,b:string,ack:Ack){
  const id=String(q.from.id); if(!ownerOnly(id)) return ack("Owner only.",true);
  if(a==="cancel"){await clearBalanceSession(id);await ack("Dibatalkan.");return sendMessage(q.message.chat.id,"Proses perubahan saldo dibatalkan.");}
  if(!["diamond","coin"].includes(a)||!["add","remove"].includes(b)) return ack("Pilihan tidak valid.",true);
  await setBalanceSession(id,{currency:a as any,operation:b as any,stage:"username"});
  await ack();
  await sendMessage(q.message.chat.id,"Kirim username Telegram target (contoh: @username).\nPastikan username benar.");
}
async function handleBalanceText(chatId:number,id:string,text:string){
  if(!ownerOnly(id)) return false;
  const session=await getBalanceSession(id);
  if(!session.stage) return false;
  if(/^\/cancel/i.test(text)){await clearBalanceSession(id);await sendMessage(chatId,"Proses dibatalkan.");return true;}
  if(session.stage==="username"){
    const username=text.replace(/^@/,"").trim().toLowerCase();
    if(!/^[a-z0-9_]{5,32}$/.test(username)){await sendMessage(chatId,"Username tidak valid. Kirim ulang dengan format @username.");return true;}
    const {data,error}=await db.from("tamaverse_telegram_links").select("telegram_user_id,telegram_username,owner_id").ilike("telegram_username",username).limit(2);
    if(error) throw error;
    if(!data?.length){await sendMessage(chatId,"Akun dengan username itu belum terhubung ke Tamaverse. Cek username atau minta user menghubungkan akun.");return true;}
    if(data.length>1){await sendMessage(chatId,"Username tidak unik. Minta user memperbarui username Telegram lalu coba lagi.");return true;}
    await setBalanceSession(id,{...session,target_id:String(data[0].telegram_user_id),target_username:data[0].telegram_username,owner_id:data[0].owner_id,stage:"amount"});
    await sendMessage(chatId,"Target ditemukan: @"+(data[0].telegram_username||username)+"\nKirim jumlah "+(session.currency==="diamond"?"Diamond":"Coin")+" (angka bulat positif).");
    return true;
  }
  if(session.stage==="amount"){
    const amount=Number(text);
    if(!Number.isSafeInteger(amount)||amount<1||amount>1000000000){await sendMessage(chatId,"Jumlah tidak valid. Masukkan angka bulat 1 sampai 1.000.000.000.");return true;}
    await setBalanceSession(id,{...session,amount,stage:"reason"});
    await sendMessage(chatId,"Kirim alasan perubahan saldo (3–300 karakter).");
    return true;
  }
  if(session.stage==="reason"){
    if(text.length<3||text.length>300){await sendMessage(chatId,"Alasan harus 3–300 karakter. Coba lagi.");return true;}
    const col=session.currency==="diamond"?"diamonds":"coins";
    const {data,error}=await db.from("inventory").select(col).eq("owner_id",session.owner_id).maybeSingle();
    if(error) throw error;
    const before=Number(data?.[col]??0), after=before+(session.operation==="add"?1:-1)*Number(session.amount);
    if(after<0){await sendMessage(chatId,"Saldo tidak cukup untuk dikurangi. Saldo saat ini: "+before);return true;}
    const next={...session,reason:text,stage:"confirm" as const};
    await setBalanceSession(id,next);
    const curr=session.currency==="diamond"?"Diamond":"Coin";
    await sendMessage(chatId,"KONFIRMASI PERUBAHAN SALDO\n\nTarget: @"+(session.target_username||"unknown")+"\nTelegram ID: "+session.target_id+"\nAksi: "+(session.operation==="add"?"ADD":"REMOVE")+" "+curr+"\nJumlah: "+money(Number(session.amount))+"\nSaldo: "+money(before)+" → "+money(after)+"\nAlasan: "+text+"\n\nLanjutkan?",{reply_markup:{inline_keyboard:[[{text:"CONFIRM",callback_data:"bal:confirm"},{text:"CANCEL",callback_data:"bal:cancel"}]]}});
    return true;
  }
  if(session.stage==="confirm"){await sendMessage(chatId,"Gunakan tombol CONFIRM atau CANCEL.");return true;}
  return false;
}
async function confirmBalance(q:Any,ack:Ack){
  const id=String(q.from.id); if(!ownerOnly(id)) return ack("Owner only.",true);
  const session=await getBalanceSession(id);
  if(session.stage!=="confirm"||!session.target_id||!session.currency||!session.operation||!session.amount||!session.reason) return ack("Sesi tidak valid atau kedaluwarsa.",true);
  const {data:setting,error:settingError}=await db.from("nexora_bot_settings").select("value").eq("key","balance_log_topic_id").maybeSingle();
  if(settingError) throw settingError;
  if(!setting?.value) return ack("Topik log belum dibuat. Jalankan /balance_setup dulu.",true);
  await ack("Memproses perubahan saldo…");
  const {data,error}=await db.rpc("nexora_owner_adjust_balance",{
    p_actor_telegram_id:id,p_owner_telegram_id:session.target_id,p_currency:session.currency,
    p_operation:session.operation,p_amount:session.amount,p_reason:session.reason
  });
  if(error) throw error;
  const result=data as Any;
  const currency=session.currency==="diamond"?"Diamond":"Coin";
  const logText="WALLET BALANCE AUDIT\n\nTarget: @"+(result.username||"-")+" ("+result.telegram_user_id+")\nOwner UUID: "+result.owner_id+"\nAction: "+session.operation.toUpperCase()+" "+currency+"\nAmount: "+money(Number(result.amount))+"\nBalance: "+money(Number(result.balance_before))+" → "+money(Number(result.balance_after))+"\nReason: "+result.reason+"\nBy Owner: "+id+"\nTime: "+fmtDate(new Date().toISOString());
  await tg("sendMessage",{chat_id:ADMIN_FORUM_CHAT_ID,message_thread_id:Number(setting.value),text:logText});
  await clearBalanceSession(id);
  await sendMessage(q.message.chat.id,"Berhasil. Saldo "+currency+" @"+(result.username||"user")+" berubah dari "+money(Number(result.balance_before))+" menjadi "+money(Number(result.balance_after))+".\nAudit log sudah dikirim ke NEXORA BALANCE LOG.");
}

// ───────────────────────── ROUTERS ─────────────────────────
async function handleCallback(q: Any) {
  let answered = false;
  const ack: Ack = async (text, alert = false) => {
    if (answered) return;
    answered = true;
    await tgTry("answerCallbackQuery", {
      callback_query_id: q.id,
      ...(text ? { text, show_alert: alert } : {}),
    });
  };

  try {
    const chat = q.message?.chat;
    const mid = q.message?.message_id;
    if (!chat || !mid) return await ack("Pesan tidak ditemukan", true);

    const [kind, a, b] = String(q.data ?? "").split(":");

    if (kind === "a" || kind === "d") return await adminDecision(q, kind, a, ack);\n    if (kind === "bal") { if (a === "confirm") return await confirmBalance(q, ack); return await balanceCallback(q, kind, a, b, ack); }
    if (chat.type !== "private") return await ack(TEXT.notPrivate, true);

    const tgId = String(q.from.id);

    switch (kind) {
      case "m": {
        await ack();
        if (a === "home") return await show(chat.id, mid, TEXT.welcome, homeMarkup());
        if (a === "topup") return await show(chat.id, mid, catalogueText(), packageMarkup());
        if (a === "uuid") return await show(chat.id, mid, TEXT.uuidPrompt, backMarkup());
        if (a === "help") return await show(chat.id, mid, TEXT.help, backMarkup());
        if (a === "hist") return await showHistory(chat.id, mid, tgId);
        return;
      }
      case "p": {
        const okPack = await showPackageDetail(chat.id, mid, Number(a));
        await ack(okPack ? undefined : "Paket tidak valid", !okPack);
        return;
      }
      case "c": {
        await ack("Memproses…");
        if (!(await startOrder(chat.id, mid, q.from, Number(a)))) await show(chat.id, mid, "Paket tidak valid.", backMarkup());
        return;
      }
      case "pm":
        return await chooseMethod(chat.id, mid, tgId, a, b, ack);
      case "x":
        return await cancelOrder(chat.id, mid, tgId, a, ack);
      default:
        return await ack("Tombol tidak dikenali", true);
    }
  } finally {
    await ack();
  }
}

async function handleMessage(message: Any) {
  const chat = message.chat;
  if (!chat) return;

  if (chat.type !== "private") {
    await handleGroupMessage(message);
    return;
  }

  const chatId = chat.id;
  const telegramId = String(message.from?.id ?? "");
  const username = String(message.from?.username ?? "");
  const text = String(message.text ?? "").trim();
  if (!telegramId) return;

  if (Array.isArray(message.photo) && message.photo.length > 0) {
    await handleProof(message);
    return;
  }

  const startPayload = text.match(/^\/start(?:@\w+)?\s+(\S+)$/i);
  if (startPayload && CHECKOUT_TOKEN.test(startPayload[1])) {
    await handleCheckoutStart(message, startPayload[1]);
    return;
  }

  if (/^\/(start|menu|help)(@\w+)?(\s|$)/i.test(text)) {
    await sendMessage(chatId, TEXT.welcome, { reply_markup: homeMarkup() });
    return;
  }
  if (/^\/(buy|topup)(@\w+)?(\s|$)/i.test(text)) {
    await sendMessage(chatId, catalogueText(), { reply_markup: packageMarkup() });
    return;
  }
  if (/^\/(riwayat|history)(@\w+)?(\s|$)/i.test(text)) {
    await showHistory(chatId, undefined, telegramId);
    return;
  }
  if (/^\/uuid(@\w+)?(\s|$)/i.test(text)) {
    const uuid = text.split(/\s+/)[1] ?? "";
    if (!uuid) {
      await sendMessage(chatId, TEXT.uuidPrompt);
      return;
    }
    await linkUuid(chatId, telegramId, username, uuid);
    return;
  }
  if (UUID_PATTERN.test(text)) {
    await linkUuid(chatId, telegramId, username, text);
    return;
  }
  await sendMessage(chatId, TEXT.unknown, { reply_markup: homeMarkup() });
}

// ───────────────────────── WEBHOOK ─────────────────────────
Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return new Response("Nexora Tamaverse bot webhook ready", { status: 200 });
  }
  if (request.headers.get("x-telegram-bot-api-secret-token") !== TELEGRAM_WEBHOOK_SECRET) {
    return new Response("Unauthorized", { status: 401 });
  }

  let update: Any;
  try {
    update = await request.json();
  } catch {
    return new Response("Bad request", { status: 400 });
  }

  try {
    // Update duplikat (retry Telegram) dibuang lewat PK update_id
    if (typeof update.update_id === "number") {
      const { error } = await db.from("nexora_processed_updates").insert({ update_id: update.update_id });
      if (error?.code === "23505") return new Response("duplicate", { status: 200 });
      if (error) console.error("processed_updates insert failed:", error);
    }

    if (update.message) await handleMessage(update.message);
    if (update.callback_query) await handleCallback(update.callback_query);
  } catch (error) {
    console.error("Nexora webhook error:", error);
    const chatId = update?.message?.chat?.type === "private"
      ? update.message.chat.id
      : update?.callback_query?.message?.chat?.type === "private"
      ? update.callback_query.message.chat.id
      : null;
    if (chatId) await tgTry("sendMessage", { chat_id: chatId, text: TEXT.genericError });
  }

  // Selalu 200 agar Telegram tidak retry tanpa henti
  return new Response("ok", { status: 200 });
});
