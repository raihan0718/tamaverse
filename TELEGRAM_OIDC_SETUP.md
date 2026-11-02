# Telegram OIDC sign-in setup

The Mini App now uses Supabase Auth's custom OIDC provider `custom:telegram`. It does not trust `initDataUnsafe` for identity and does not mint Supabase sessions itself.

## 1. Create Telegram Login credentials

1. Open Telegram's `@BotFather` using the same bot that opens Tamaverse.
2. Open the bot's Mini App settings and choose **Login Widget**.
3. Switch to **OpenID Connect Login** if that option is shown.
4. Add this redirect URI:

   `https://uziyhbgxvdetzlujzozu.supabase.co/auth/v1/callback`

5. Save the Client ID and Client Secret shown by Telegram. Keep the Client Secret private; do not put it in the repository or client-side code.

## 2. Add Telegram as a Supabase Auth provider

In the Supabase Dashboard for project `uziyhbgxvdetzlujzozu`:

1. Open **Authentication → Sign In / Providers → Custom OAuth Providers**.
2. Add a new provider using **Auto-discovery (OIDC)**.
3. Set:
   - Identifier: `custom:telegram`
   - Name: `Telegram`
   - Issuer URL: `https://oauth.telegram.org`
   - Client ID: the value from Telegram Login
   - Client Secret: the value from Telegram Login
   - Scopes: `openid profile`
   - Email optional: enabled
4. Create and enable the provider.

## 3. Allow the Mini App redirect URL

In **Authentication → URL Configuration → Redirect URLs**, allow:

`https://tamaverse-pet-quest--raihanmilano07.replit.app/**`

Keep the Site URL set to the deployed Mini App URL.

## 4. Test

1. Open Tamaverse from the official Telegram bot button.
2. Complete Telegram's first-time consent/sign-in if prompted.
3. Confirm the Mini App returns and loads the same account on a second launch.
4. Confirm a normal browser visit without a Telegram Mini App launch is rejected.

The client expects the signed-in Supabase user to have `app_metadata.provider = custom:telegram`. Do not replace this with anonymous sign-in, a synthetic email/password, or manually generated Supabase sessions.
