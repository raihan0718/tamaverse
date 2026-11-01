import { createClient } from "npm:@supabase/supabase-js@2";

/**
 * POST /create-checkout   (dipanggil Mini App saat tombol Beli ditekan)
 * Header: Authorization: Bearer <access_token Supabase milik player>
 * Body:   { "diamonds": 120, "method": "QRIS" | "GOPAY" }
 * Balas:  { token, url, expires_at }   → arahkan player ke `url`
 *
 * Identitas (owner_id) selalu diambil dari JWT di server, bukan dari body.
 * Harga dihitung dari katalog di bawah — HARUS sama dengan PACKAGES di bot.
 */

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BOT_USERNAME = Deno.env.get("BOT_USERNAME") ?? "Nexorapaymbot";
const ALLOWED_ORIGIN = Deno.env.get("WEB_ORIGIN") ?? "*"; // isi dengan domain game lu
const INTENT_TTL_MINUTES = Number(Deno.env.get("INTENT_TTL_MINUTES") ?? "15");

const PRICES: Record<number, number> = {
  5: 1_000,
  10: 1_800,
  25: 3_500,
  50: 5_000,
  100: 7_500,
  120: 10_800,
  300: 24_000,
  700: 49_000,
};
const ACTIVE = ["PENDING", "WAITING_ADMIN", "WAITING_PAYMENT", "PROOF_SUBMITTED"];

const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const cors = {
  "access-control-allow-origin": ALLOWED_ORIGIN,
  "access-control-allow-headers": "authorization, content-type, apikey, x-client-info",
  "access-control-allow-methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "content-type": "application/json" },
  });

function newToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, ""); // 32 karakter, aman untuk deep link (maks 64)
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  // 1. Autentikasi player
  const jwt = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!jwt) return json({ error: "unauthorized" }, 401);
  const { data: auth, error: authErr } = await db.auth.getUser(jwt);
  if (authErr || !auth?.user) return json({ error: "unauthorized" }, 401);
  const ownerId = auth.user.id;

  // 2. Validasi input
  let body: { diamonds?: unknown; method?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: "bad_request" }, 400);
  }
  const diamonds = Number(body.diamonds);
  const method = body.method === "QRIS" || body.method === "GOPAY" ? body.method : null;
  const price = PRICES[diamonds];
  if (!price || !method) return json({ error: "invalid_package_or_method" }, 400);

  // 3. Sudah ada pesanan aktif? Beri tahu web lebih awal.
  const { data: link } = await db
    .from("tamaverse_telegram_links")
    .select("telegram_user_id")
    .eq("owner_id", ownerId)
    .maybeSingle();
  if (link) {
    const { data: active } = await db
      .from("nexora_orders")
      .select("order_code, status")
      .eq("telegram_user_id", String(link.telegram_user_id))
      .in("status", ACTIVE)
      .limit(1)
      .maybeSingle();
    if (active) return json({ error: "active_order", order_code: active.order_code, status: active.status }, 409);
  }

  // 4. Batasi spam: maksimal 5 intent per 10 menit per player
  const since = new Date(Date.now() - 10 * 60_000).toISOString();
  const { count } = await db
    .from("nexora_checkout_intents")
    .select("token", { count: "exact", head: true })
    .eq("owner_id", ownerId)
    .gte("created_at", since);
  if ((count ?? 0) >= 5) return json({ error: "too_many_requests" }, 429);

  // 5. Buang intent lama yang belum dipakai, lalu buat yang baru
  await db.from("nexora_checkout_intents").delete().eq("owner_id", ownerId).is("claimed_at", null);

  const token = newToken();
  const expiresAt = new Date(Date.now() + INTENT_TTL_MINUTES * 60_000).toISOString();
  const { error: insErr } = await db.from("nexora_checkout_intents").insert({
    token,
    owner_id: ownerId,
    diamonds,
    price,
    method,
    expires_at: expiresAt,
  });
  if (insErr) {
    console.error("create intent failed:", insErr);
    return json({ error: "server_error" }, 500);
  }

  return json({ token, url: `https://t.me/${BOT_USERNAME}?start=${token}`, expires_at: expiresAt });
});
