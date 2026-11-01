# Nexora • Tamaverse bot (SANDBOX)

## File
- `supabase/functions/tamaverse-payment-bot/index.ts` — seluruh bot (1 file)
- `supabase/functions/create-checkout/index.ts` — dipanggil Mini App saat tombol Beli
- `supabase/migrations/20261101000000_nexora_orders.sql` — schema baru (additive)
- `supabase/migrations/20261101000100_nexora_checkout_intents.sql` — tabel checkout intent (jalankan setelah yang pertama)

## Environment variables
| Nama | Wajib | Keterangan |
|---|---|---|
| `SUPABASE_URL` | ya | otomatis di Edge Functions |
| `SUPABASE_SERVICE_ROLE_KEY` | ya | otomatis di Edge Functions |
| `TELEGRAM_BOT_TOKEN2` | ya | token bot (nama sama dengan versi lama) |
| `TELEGRAM_WEBHOOK_SECRET` | ya | harus sama dengan `secret_token` di setWebhook |
| `ADMIN_FORUM_CHAT_ID` | tidak | default `-1004322036078` |
| `ADMIN_TELEGRAM_ID` | tidak | default `8906658395` |
| `SANDBOX_MODE` | tidak | default aktif; `false` untuk menghilangkan label sandbox |
| `ORDER_TTL_MINUTES` | tidak | default `120` |
| `BOT_USERNAME` | tidak | khusus `create-checkout`, default `Nexorapaymbot` |
| `WEB_ORIGIN` | tidak | khusus `create-checkout`, isi domain game (CORS), default `*` |
| `INTENT_TTL_MINUTES` | tidak | khusus `create-checkout`, default `15` |

## Setup
1. Jalankan migration. **Baca blok "WALLET" paling atas dulu**: tabel saldo Diamond asli tidak terlihat oleh saya, jadi migration membuat `tamaverse_wallets` bila belum ada. Kalau saldo lu ada di tabel lain, ubah blok "KREDIT SALDO" di `nexora_approve_order()`.
2. Deploy function: `supabase functions deploy tamaverse-payment-bot --no-verify-jwt`
3. Set webhook (wajib `allowed_updates` dan `secret_token`):
   `https://api.telegram.org/bot<TOKEN>/setWebhook?url=<FUNCTION_URL>&secret_token=<SECRET>&allowed_updates=["message","callback_query"]`
4. Grup admin: Supergroup + Topics aktif, bot jadi admin dengan izin **Manage Topics**.
   Bot hanya menerima semua pesan grup bila ia admin.

## Struktur database
- `nexora_orders`: pesanan + status + id topik + referensi bukti. Unique index: satu pesanan aktif per user, satu topik per pesanan.
- `nexora_order_events`: riwayat status, diisi trigger otomatis.
- `nexora_diamond_ledger`: `order_id` UNIQUE, jadi satu order hanya bisa kredit sekali.
- `nexora_processed_updates`: dedup `update_id` Telegram.
- Trigger `nexora_guard_status` menolak perpindahan status di luar alur.
- Fungsi `nexora_transition` (compare-and-swap), `nexora_approve_order` (atomik), `nexora_expire_stale`. Semua hanya bisa dipanggil `service_role`.

## Alur
`PENDING` → (user pilih metode) `WAITING_ADMIN` → (admin kirim QRIS foto / info GoPay teks di topik) `WAITING_PAYMENT` → (user kirim foto) `PROOF_SUBMITTED` → APPROVE `APPROVED` / DECLINE `DECLINED`.
User bisa `CANCELLED` sebelum bukti dikirim. `EXPIRED` otomatis setelah TTL (dicek saat ada interaksi; PROOF_SUBMITTED tidak expire).

Keputusan desain yang perlu lu tahu:
- Satu pesanan aktif per user. Tap ganda tidak membuat order kedua.
- Tombol APPROVE/DECLINE ada di pesan bukti (bukan di header tiket), karena baru relevan setelah bukti masuk. Alternatif: `/tolak alasan` di topik untuk decline dengan alasan.
- Topik ditutup otomatis saat pesanan selesai/batal/expired.
- Foto bukti yang sama dipakai di order lain tidak diblokir (supaya dummy bisa dipakai ulang saat tes), tapi admin diberi peringatan.

## Status pengujian (jujur)
Sudah: type-check TypeScript mode `--strict` dengan shim tipe Deno/Supabase (lolos tanpa error).
**Belum dijalankan:** migration di Postgres, webhook ke Telegram, pembuatan topik, dan seluruh alur end-to-end. Gua nggak punya akses ke Supabase/Telegram lu dari sini.

Checklist uji manual (urut):
1. `/start`, semua tombol menu, tap tombol berulang tidak mengirim pesan dobel
2. `/uuid` valid, invalid, UUID sudah dipakai Telegram lain
3. Pilih paket → konfirmasi → topik muncul dengan nama `NXR-… | @user | N💎`; tap Konfirmasi 2x cepat = 1 order, 1 topik
4. Matikan izin Manage Topics → user dapat pesan gagal, order jadi CANCELLED
5. QRIS: admin kirim foto di topik → user menerima foto + nominal + Order ID
6. GoPay: admin kirim teks → diteruskan ke user
7. Admin kirim foto ke order GoPay / teks ke order QRIS → ditolak dengan petunjuk
8. User kirim foto saat tidak ada order / status salah → pesan penolakan
9. Kirim bukti → muncul di topik yang benar dengan tombol
10. Non-admin tekan APPROVE → ditolak
11. APPROVE → saldo bertambah, ledger terisi, tekan lagi → "sudah diproses"
12. DECLINE dan `/tolak alasan` → status DECLINED, user diberi tahu
13. Kirim ulang update yang sama (replay) → diabaikan
14. Ubah `expires_at` ke masa lalu → status EXPIRED

## Checkout dari Mini App → bot
Deploy: `supabase functions deploy create-checkout --no-verify-jwt` (JWT divalidasi di dalam fungsi; tanpa flag ini preflight CORS ditolak).

Di Mini App, saat tombol Beli ditekan:
```js
const res = await fetch(`${SUPABASE_URL}/functions/v1/create-checkout`, {
  method: "POST",
  headers: {
    "content-type": "application/json",
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${(await supabase.auth.getSession()).data.session.access_token}`,
  },
  body: JSON.stringify({ diamonds, method }), // method: "QRIS" | "GOPAY"
});
const data = await res.json();
if (res.status === 409) { /* data.error === "active_order": suruh player selesaikan pesanan aktif di bot */ }
else if (res.ok) {
  if (window.Telegram?.WebApp) { Telegram.WebApp.openTelegramLink(data.url); Telegram.WebApp.close(); }
  else window.location.href = data.url;
}
```
Alur di bot: `/start <token>` → cek token (belum dipakai, belum expired) → hubungkan Telegram↔UUID otomatis → buat order + topik admin dengan paket & metode dari intent → status langsung `WAITING_ADMIN` → admin kirim QRIS/info GoPay di topik → sisanya sama seperti sebelumnya (bukti, APPROVE/DECLINE).

Keamanan: identitas dari JWT di server, harga dari katalog server, token acak 32 karakter sekali pakai (klaim atomik) dengan TTL 15 menit. Katalog harga ada di dua tempat (`PACKAGES` di bot dan `PRICES` di create-checkout) karena bot wajib satu file; ubah keduanya sekaligus. Link checkout jangan dibagikan: siapa pun yang membukanya lebih dulu akan terhubung ke akun itu.

Tambahan checklist uji: (15) tap Beli → bot langsung membuat tiket tanpa menu; (16) buka link yang sama dua kali → tidak ada order kedua; (17) link expired ditolak; (18) player dengan pesanan aktif dapat 409 di web; (19) UUID sudah terhubung ke Telegram lain ditolak.
