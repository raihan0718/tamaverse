import { createClient } from "npm:@supabase/supabase-js@2";

const url = Deno.env.get("SUPABASE_URL")!;
const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN3")!;
const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
const authClient = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });

const cors = {
  "Access-Control-Allow-Origin": "https://raihan0718.github.io",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Cache-Control": "no-store"
};
const reply = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { ...cors, "Content-Type": "application/json" }
});
const hex = (bytes: Uint8Array) => Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
async function hmac(key: ArrayBuffer | Uint8Array, value: string) {
  const cryptoKey = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(value)));
}
async function verifyInitData(raw: string) {
  if (!raw || raw.length > 8192) return null;
  const params = new URLSearchParams(raw);
  const hash = params.get("hash") || "";
  const authDate = Number(params.get("auth_date"));
  const userText = params.get("user") || "";
  const now = Math.floor(Date.now() / 1000);
  if (!/^[a-f0-9]{64}$/i.test(hash) || !userText || !Number.isSafeInteger(authDate) || authDate > now + 30 || now - authDate > 3600) return null;
  params.delete("hash");
  const check = Array.from(params.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => k + "=" + v).join("\n");
  const secret = await hmac(new TextEncoder().encode("WebAppData"), botToken);
  const expected = hex(await hmac(secret, check));
  let diff = expected.length ^ hash.length;
  for (let i = 0; i < Math.min(expected.length, hash.length); i++) diff |= expected.charCodeAt(i) ^ hash.toLowerCase().charCodeAt(i);
  if (diff !== 0) return null;
  try {
    const user = JSON.parse(userText);
    if (!Number.isSafeInteger(Number(user.id)) || Number(user.id) <= 0 || user.is_bot) return null;
    return { id: String(user.id), username: typeof user.username === "string" ? user.username : null,
      name: [user.first_name, user.last_name].filter(Boolean).join(" ").slice(0, 18) || "Penjelajah" };
  } catch { return null; }
}
// Supabase Auth enforces a 72-character password maximum. Keep this at 67 characters.
const randomPassword = () => hex(crypto.getRandomValues(new Uint8Array(32))) + "T9!";

async function findLegacyTelegramAccount(telegramId: string) {
  // Preserve accounts created by the previous custom:telegram OIDC flow.
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 500 });
    if (error) throw new Error("LEGACY_ACCOUNT_LOOKUP_FAILED");
    const match = data.users.find(user => {
      const identities = Array.isArray(user.identities) ? user.identities : [];
      const telegramIdentity = identities.some(identity =>
        identity.provider === "custom:telegram" &&
        String(identity.identity_data?.sub || identity.id || "") === telegramId
      );
      return user.app_metadata?.provider === "custom:telegram" &&
        (telegramIdentity || String(user.user_metadata?.telegram_user_id || "") === telegramId);
    });
    if (match) return match;
    if (data.users.length < 500) break;
  }
  return null;
}

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return reply({ error: "METHOD_NOT_ALLOWED" }, 405);
  const origin = req.headers.get("origin");
  if (origin && origin !== "https://raihan0718.github.io" && origin !== "https://tamaverse-pet-quest--raihanmilano07.replit.app") {
    return reply({ error: "ORIGIN_NOT_ALLOWED" }, 403);
  }
  let stage = "request";
  let authCreateDiagnostic: Record<string, unknown> | null = null;
  try {
    const body = await req.json();
    const tg = await verifyInitData(String(body?.initData || ""));
    if (!tg) return reply({ error: "INVALID_TELEGRAM_INIT_DATA" }, 401);
    stage = "telegram_link_lookup";
    const { data: found, error: lookupError } = await admin.from("tamaverse_telegram_links")
      .select("owner_id").eq("telegram_user_id", tg.id).maybeSingle();
    if (lookupError) throw new Error("TELEGRAM_LINK_LOOKUP_FAILED");

    const email = "telegram-" + tg.id + "@accounts.tamaverse.invalid";
    let ownerId = found?.owner_id || "";
    let createdId = "";
    if (!ownerId) {
      const legacyAccount = await findLegacyTelegramAccount(tg.id);
      if (legacyAccount) ownerId = legacyAccount.id;
    }
    if (!ownerId) {
      stage = "auth_create_user";
      const { data: created, error: createError } = await admin.auth.admin.createUser({
        email, password: randomPassword(), email_confirm: true,
        user_metadata: { display_name: tg.name, telegram_user_id: tg.id, telegram_username: tg.username }
      });
      if (createError || !created?.user) {
        authCreateDiagnostic = {
          code: createError?.code ?? null,
          message: createError?.message ?? null,
          status: createError?.status ?? null,
          name: createError?.name ?? null,
          hasUser: Boolean(created?.user)
        };
        console.error("telegram-auth createUser diagnostic", authCreateDiagnostic);
        throw new Error("TELEGRAM_ACCOUNT_CREATE_FAILED");
      }
      ownerId = created.user.id;
      createdId = ownerId;
    }
    if (!found) {
      stage = "telegram_link_insert";
      const { error: insertError } = await admin.from("tamaverse_telegram_links").insert({
        telegram_user_id: tg.id, telegram_username: tg.username, owner_id: ownerId
      });
      if (insertError) {
        const { data: raced } = await admin.from("tamaverse_telegram_links").select("owner_id").eq("telegram_user_id", tg.id).maybeSingle();
        if (raced?.owner_id) {
          if (createdId) await admin.auth.admin.deleteUser(createdId);
          ownerId = raced.owner_id;
        } else {
          if (createdId) await admin.auth.admin.deleteUser(createdId);
          throw new Error("TELEGRAM_ACCOUNT_LINK_FAILED");
        }
      }
    }

    stage = "login_activity_update";
    const { error: loginTrackError } = await admin.from("tamaverse_telegram_links")
      .update({ last_login_at: new Date().toISOString(), telegram_username: tg.username })
      .eq("telegram_user_id", tg.id);
    if (loginTrackError) throw new Error("LOGIN_ACTIVITY_TRACK_FAILED");

    const { data: botStart } = await admin.from("tamaverse_telegram_bot_starts")
      .select("started_at").eq("telegram_user_id", tg.id).maybeSingle();
    if (botStart?.started_at) {
      await admin.from("tamaverse_telegram_links")
        .update({ bot_started_at: botStart.started_at })
        .eq("telegram_user_id", tg.id);
    }

    stage = "auth_user_lookup";
    const { data: userResult, error: userError } = await admin.auth.admin.getUserById(ownerId);
    if (userError || !userResult?.user) throw new Error("TELEGRAM_ACCOUNT_NOT_FOUND");
    let account = userResult.user;
    if (!account.email) {
      const { data: updated, error } = await admin.auth.admin.updateUserById(ownerId, { email, email_confirm: true });
      if (error || !updated?.user) throw new Error("TELEGRAM_ACCOUNT_SETUP_FAILED");
      account = updated.user;
    }
    stage = "auth_metadata_update";
    const { error: metadataError } = await admin.auth.admin.updateUserById(ownerId, {
      app_metadata: { ...(account.app_metadata || {}), provider: "telegram", providers: ["telegram"], telegram_auth: true, telegram_user_id: tg.id },
      user_metadata: { ...(account.user_metadata || {}), display_name: tg.name, telegram_user_id: tg.id, telegram_username: tg.username }
    });
    if (metadataError) throw new Error("TELEGRAM_ACCOUNT_SETUP_FAILED");

    stage = "magiclink_generation";
    const { data: generated, error: generateError } = await admin.auth.admin.generateLink({ type: "magiclink", email: account.email || email });
    const tokenHash = generated?.properties?.hashed_token;
    if (generateError || !tokenHash) throw new Error("SESSION_ISSUE_FAILED");
    stage = "otp_session_exchange";
    const { data: sessionResult, error: sessionError } = await authClient.auth.verifyOtp({ token_hash: tokenHash, type: "magiclink" });
    if (sessionError || !sessionResult.session) throw new Error("SESSION_EXCHANGE_FAILED");

    return reply({ success: true, telegram_user_id: tg.id, session: {
      access_token: sessionResult.session.access_token, refresh_token: sessionResult.session.refresh_token
    } });
  } catch (error) {
    console.error("telegram-auth failed", { stage, message: error instanceof Error ? error.message : String(error), name: error instanceof Error ? error.name : null, authCreateDiagnostic });
    const message = error instanceof Error ? error.message : "INTERNAL_ERROR";
    return reply({
      error: message,
      diagnostic: authCreateDiagnostic ? {
        stage,
        code: authCreateDiagnostic.code ?? null,
        message: String(authCreateDiagnostic.message ?? "").slice(0, 180),
        status: authCreateDiagnostic.status ?? null
      } : { stage }
    }, 500);
  }
});
