# Nexora • Tamaverse bot — audit notes

## Current source of truth
- Bot source: `supabase/functions/tamaverse-payment-bot/index.ts`
- SQL file currently in repository root: `20261101000000_nexora_orders.sql`

**Important:** the current bot source still uses the legacy `diamond_orders` table and legacy RPCs (for example, `create_tamaverse_diamond_order` and `approve_tamaverse_diamond_order`). The SQL file defines a separate `nexora_orders` schema and different RPCs. They are **not interchangeable**.

Do not apply the Nexora SQL migration or deploy the bot as a matched pair until a reviewed migration/adapter is prepared and tested against the actual production wallet schema. This README does not authorize changing payment methods, prices, proof handling, approvals, or Diamond credit.

## Environment variables currently read by the bot
| Name | Required | Purpose |
|---|---:|---|
| `SUPABASE_URL` | yes | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | Supabase service-role key; keep secret |
| `TELEGRAM_BOT_TOKEN2` | yes | Telegram bot token; keep secret |
| `TELEGRAM_ADMIN_ID` | yes | Telegram numeric admin ID |
| `TELEGRAM_WEBHOOK_SECRET` | yes | Must match Telegram webhook `secret_token` |

The current source hardcodes the admin forum chat ID as `-1004322036078`. The names `ADMIN_TELEGRAM_ID`, `ADMIN_FORUM_CHAT_ID`, `SANDBOX_MODE`, and `ORDER_TTL_MINUTES` documented in an earlier draft are not read by this source.

## Existing behavior and scope
The current bot contains account linking, menus, Telegram forum topics, order creation, QRIS/GoPay instructions, proof submission, admin approval/decline, and Diamond credit. Those order/payment operations are deliberately not modified by this non-payment cleanup.

## Deployment status
No deployment or live Telegram/Supabase test is performed by this repository edit. Before deploying, verify the database schema and RPCs used by the bot match the target Supabase project. Never put service-role keys or bot tokens in source control.
