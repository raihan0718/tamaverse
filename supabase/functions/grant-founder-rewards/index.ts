import { createClient } from "npm:@supabase/supabase-js@2";

const env = (name: string) => {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing env: ${name}`);
  return value;
};

const SUPABASE_URL = env("SUPABASE_URL");
const SERVICE_ROLE_KEY = env("SUPABASE_SERVICE_ROLE_KEY");
const BOT_TOKEN = env("TELEGRAM_BOT_TOKEN3");
const FOUNDER_TELEGRAM_ID = String(env("ADMIN_TELEGRAM_ID"));

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function hex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function hmac(key: ArrayBuffer | Uint8Array, message: string): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  return new Uint8Array(await crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(message)));
}

async function verifyTelegramInitData(initData: string): Promise<string | null> {
  if (!initData || initData.length > 8192) return null;
  const params = new URLSearchParams(initData);
  const suppliedHash = params.get("hash");
  const authDate = Number(params.get("auth_date"));
  const userRaw = params.get("user");
  if (!suppliedHash || !/^[a-f0-9]{64}$/i.test(suppliedHash) || !userRaw) return null;
  if (!Number.isFinite(authDate) || Math.abs(Date.now() / 1000 - authDate) > 3600) return null;

  params.delete("hash");
  const checkString = Array.from(params.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

  const secretKey = await hmac(new TextEncoder().encode("WebAppData"), BOT_TOKEN);
  const calculatedHash = hex(await hmac(secretKey, checkString));
  if (calculatedHash.length !== suppliedHash.length) return null;
  let diff = 0;
  for (let i = 0; i < calculatedHash.length; i++) {
    diff |= calculatedHash.charCodeAt(i) ^ suppliedHash.toLowerCase().charCodeAt(i);
  }
  if (diff !== 0) return null;

  try {
    const user = JSON.parse(userRaw);
    return user?.id != null ? String(user.id) : null;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders() });
  }
  if (req.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405);

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const accessToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!accessToken) return json({ error: "AUTH_REQUIRED" }, 401);

    const { data: authData, error: authError } = await admin.auth.getUser(accessToken);
    if (authError || !authData.user || authData.user.is_anonymous !== true) {
      return json({ error: "INVALID_GAME_SESSION" }, 401);
    }

    const body = await req.json();
    const telegramId = await verifyTelegramInitData(String(body?.initData || ""));
    if (!telegramId) return json({ error: "INVALID_TELEGRAM_INIT_DATA" }, 401);
    if (telegramId !== FOUNDER_TELEGRAM_ID) return json({ success: true, founder: false });

    const { data: link, error: linkError } = await admin
      .from("tamaverse_telegram_links")
      .select("owner_id")
      .eq("telegram_user_id", telegramId)
      .maybeSingle();
    if (linkError) throw linkError;
    if (!link || String(link.owner_id) !== authData.user.id) {
      return json({ error: "TELEGRAM_ACCOUNT_NOT_LINKED" }, 403);
    }

    const ownerId = authData.user.id;
    const clientUid = `founder-nexora-${telegramId}`;
    const { data: existingPet, error: petReadError } = await admin
      .from("pets")
      .select("id")
      .eq("owner_id", ownerId)
      .eq("client_uid", clientUid)
      .maybeSingle();
    if (petReadError) throw petReadError;

    if (!existingPet) {
      const { error: petInsertError } = await admin.from("pets").insert({
        owner_id: ownerId,
        client_uid: clientUid,
        species: "sovereign-nexora",
        nickname: "Nexora",
        level: 1,
        xp: 0,
        hunger: 100,
        happiness: 100,
        energy: 100,
        cleanliness: 100,
        evolution: 0,
        is_active: false,
      });
      if (petInsertError) throw petInsertError;
    }

    const { data: premium, error: premiumReadError } = await admin
      .from("premium_inventory")
      .select("owned_frames")
      .eq("owner_id", ownerId)
      .maybeSingle();
    if (premiumReadError) throw premiumReadError;

    // Upsert also creates the inventory row for older accounts where the
    // auth trigger did not create one. On conflict, only supplied fields change.
    const frames = Array.isArray(premium?.owned_frames) ? premium.owned_frames : ["common"];
    const ownedFrames = frames.includes("royal-sovereign")
      ? frames
      : [...frames, "royal-sovereign"];
    const { error: frameError } = await admin.from("premium_inventory")
      .upsert({
        owner_id: ownerId,
        owned_frames: ownedFrames,
        updated_at: new Date().toISOString(),
      }, { onConflict: "owner_id" });
    if (frameError) throw frameError;

    return json({ success: true, founder: true, petGranted: true, frameGranted: true });
  } catch (error) {
    console.error("Founder grant failed:", error);
    return json({ error: "FOUNDER_GRANT_FAILED" }, 500);
  }
});

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}
function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders(), "Content-Type": "application/json" },
  });
}
