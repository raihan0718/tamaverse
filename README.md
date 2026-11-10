# TAMAVERSE

TAMAVERSE is a mobile-first, no-login virtual pet RPG prototype built with plain HTML, CSS, and JavaScript. It has no paid services, package installs, or API keys.

## Run it

- In Replit, start the project preview. The project serves `index.html`.
- To run it on a computer with Python, use `python3 -m http.server 5000 --bind 0.0.0.0`, then open the server's page in a browser.
- On Android, use the Replit preview or open the hosted project URL in your browser. Use the same browser each time; progress is saved in that browser's `localStorage`.

Do not clear the browser's site data if you want to keep your save. Clearing it removes the local guest profile and game progress.

## Prototype limits

The guest ID, pets, gacha, battles, rating, and sample ranking are local-only and can be edited in the browser. They are not secure accounts, online multiplayer, or a global leaderboard. Real shared progress and competitive rewards require a trusted backend.

The app detects Telegram's Mini App bridge when Telegram provides it, but it does not implement Telegram login, bots, matchmaking, or server validation.

## Main files

- `index.html` — app shell and navigation
- `styles.css` — responsive interface and animations
- `script.js` — game rules, local save, pets, gacha, quests, and battles


## Telegram Diamond top-up backend

The manual top-up bot is separate from the existing admin currency bot.

### Supabase setup (adult/admin account)

1. Open the Supabase SQL Editor for project `uziyhbgxvdetzlujzozu`.
2. Run the complete `supabase-diamond-ticket.sql` migration once.
3. In Supabase Edge Function secrets, set:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `TELEGRAM_BOT_TOKEN2` (token for `@Nexorapaymbot`, never commit it)
   - `TELEGRAM_ADMIN_ID` (the admin's numeric Telegram user ID)
   - `TELEGRAM_WEBHOOK_SECRET` (a long random secret; keep it private)
4. Install the Supabase CLI, log in, link this project, then deploy:
   ```sh
   supabase login
   supabase link --project-ref uziyhbgxvdetzlujzozu
   supabase functions deploy tamaverse-payment-bot
   ```
   The function has `verify_jwt = false` in `supabase/config.toml`; Telegram webhook requests are instead checked against `TELEGRAM_WEBHOOK_SECRET`.
5. Set the Telegram webhook from a trusted terminal. Set the same secret value used in Supabase:
   ```sh
   export TELEGRAM_BOT_TOKEN2='BOT_TOKEN'
   export TELEGRAM_WEBHOOK_SECRET='WEBHOOK_SECRET'
   curl -sS -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN2}/setWebhook" \
     -d "url=https://uziyhbgxvdetzlujzozu.supabase.co/functions/v1/tamaverse-payment-bot" \
     -d "secret_token=${TELEGRAM_WEBHOOK_SECRET}"
   ```
   Never paste either secret into GitHub, the game client, or a public chat.
6. Open the Tamaverse Profile, tap **Hubungkan Telegram Bot**, then send `/link KODE` to `@Nexorapaymbot`. Use `/buy` to create a ticket.

### Admin ticket commands

- `/price ORDER_ID NOMINAL_RUPIAH` — set the amount for an order; send QRIS instructions separately.
- `/check ORDER_ID` — inspect order and view submitted proof.
- `/cancel ORDER_ID` — cancel an eligible order.
- `/paid ORDER_ID` — credit Diamonds only after independently verifying the payment in the payment provider dashboard.

A screenshot is not proof of settlement by itself. Verify the actual incoming transaction before using `/paid`. Payment handling and merchant accounts must be managed by an authorized adult. The old admin bot remains separate and continues to use `TELEGRAM_BOT_TOKEN`, not `TELEGRAM_BOT_TOKEN2`.

### Current limitations

Package prices are not preset. The admin sets each order's amount manually. QRIS is sent manually; no payment gateway, dynamic QRIS generation, or automatic settlement webhook is configured. The bot and function source are committed, but deployment and live Telegram testing are still required.

## Public Diamond Giveaway

The public giveaway flow uses a server-side Supabase migration and the existing verified Telegram account session.

1. Run `supabase/migrations/20261110000100_public_diamond_giveaways.sql` in the Supabase SQL Editor for project `uziyhbgxvdetzlujzozu`.
2. Confirm the owner/admin Telegram account is the existing owner ID `8906658395` used by the current owner-only tools.
3. Deploy the GitHub Pages update. The page loads `giveaway.js` after `supabase.js`.
4. Open Tamaverse with the owner Telegram account, then Profile → Diamond Giveaway.
5. Set the Diamond amount per player, maximum number of claims, and optionally an expiry date/time. Create the link and share it.
6. Players open the link in Telegram, verify their account, then press **Claim Diamonds**.

Security behavior:
- The database checks admin identity; hiding the UI is not the security boundary.
- Claiming locks the giveaway row, checks expiry/quota, and credits the authenticated account in one database transaction.
- A unique constraint allows one claim per account per giveaway.
- Giveaway tables are not directly readable or writable by browser clients; access is through restricted RPC functions.
- Cancellation stops future claims. Already credited Diamonds are not clawed back.

Manual verification:
- Create a small test giveaway (e.g. 2 Diamonds, 2 claims, expiry in 10 minutes).
- Claim once from two different Telegram accounts; both should receive 2 Diamonds.
- Try a second claim from either account; it must be rejected.
- Try a third account after the quota is full; it must be rejected.
- Create an already-expired test by setting a short expiry and waiting; claims must be rejected.
- Cancel an active test giveaway; its link must stop working.

The migration and frontend source being committed does not mean the SQL has been applied to Supabase or the live flow has been tested. Run the migration and complete the manual checks before announcing a live giveaway.
