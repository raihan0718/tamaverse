# Create Checkout Edge Function

Fungsi ini dipanggil Mini App ketika player menekan tombol Beli. Identitas player diverifikasi dari Supabase Auth JWT, harga dihitung dari katalog server, lalu dibuat token checkout sekali pakai untuk membuka chat @Nexorapaymbot.

- Source: `index.ts`
- Migration: `supabase/migrations/20261101000100_nexora_checkout_intents.sql`
- Deploy dilakukan bersama payment bot melalui GitHub Actions.

Pastikan migration dasar `20261101000000_nexora_orders.sql` dan migration checkout intents sudah diterapkan ke Supabase sebelum mengaktifkan alur checkout.
