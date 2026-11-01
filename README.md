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
