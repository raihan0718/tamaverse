// Centralized Telegram bot copy for Tamaverse.
// Text-only resource: does not contain payment processing or bot logic.

export const BOT_MESSAGES = {
  brand: "💎 NEXORA PAY • TAMAVERSE",
  welcome: "👋 Selamat datang di NEXORA PAY • TAMAVERSE!\\n\\nSilakan pilih menu yang ingin Anda buka:",
  menu: {
    topup: "💎 PILIH PAKET DIAMOND",
    uuid: "🔗 HUBUNGKAN AKUN",
    help: "📋 PANDUAN PENGGUNAAN",
    back: "⬅️ Kembali",
  },
  uuid: {
    prompt: "🔗 Hubungkan akun Tamaverse\\n\\nKirim UUID dari menu Profile dengan format berikut:\\n/uuid UUID_KAMU",
    invalid: "⚠️ UUID tidak ditemukan atau formatnya belum sesuai.\\n\\nBuka Tamaverse → Profile, salin TAMAVERSE USER ID, lalu kirim:\\n/uuid UUID_KAMU",
    notFound: "⚠️ UUID Tamaverse tidak ditemukan. Periksa kembali UUID pada menu Profile.",
    saved: "✅ UUID Tamaverse berhasil disimpan.\\n\\nAnda sekarang dapat memilih paket Diamond melalui menu Top Up.",
    alreadyLinked: "⚠️ Akun Telegram ini sudah terhubung ke UUID Tamaverse lain. Silakan hubungi admin jika perlu bantuan.",
    gameLinked: "⚠️ UUID Tamaverse ini sudah terhubung ke akun Telegram lain. Hubungi admin jika Anda merasa ini keliru.",
    saveFailed: "⚠️ UUID belum berhasil disimpan. Silakan coba kembali beberapa saat lagi.",
  },
  order: {
    choosePackage: "💎 Silakan pilih paket Diamond yang tersedia:",
    creating: "⏳ Sedang menyiapkan pesanan Anda. Mohon tunggu sebentar...",
    createFailed: "⚠️ Pesanan belum berhasil dibuat. Silakan coba kembali beberapa saat lagi.",
    created: (id: string, pack: string, diamonds: number, total: string) =>
      `✅ PESANAN BERHASIL DIBUAT\\n\\n🧾 ID Pesanan\\n${id}\\n\\n📦 Paket\\n${pack}\\n\\n💎 Jumlah Diamond\\n${diamonds} Diamond\\n\\n💳 Total Pembayaran\\nRp${total}\\n\\nSilakan pilih metode pembayaran yang tersedia.`,
    notActive: "⚠️ Pesanan tidak aktif atau tidak dapat ditemukan.",
    multipleActive: "⚠️ Anda memiliki lebih dari satu pesanan aktif. Silakan hubungi admin agar bukti dapat diperiksa pada pesanan yang tepat.",
    noneActive: "ℹ️ Belum ada pesanan aktif yang menunggu bukti.",
  },
  payment: {
    qrisSelected: (id: string) =>
      `💳 METODE PEMBAYARAN QRIS DIPILIH\\n\\n🧾 ID Pesanan\\n${id}\\n\\n⏳ Mohon tunggu sebentar. Admin sedang menyiapkan kode QRIS khusus untuk pesanan Anda dan akan memberikannya setelah tersedia.\\n\\nTerima kasih atas kesabaran Anda.`,
    gopayTitle: "💳 INFORMASI PEMBAYARAN",
    qrisCaption: "💳 QRIS PEMBAYARAN TAMAVERSE",
    proofPrompt: "📤 Jika sudah siap, tekan tombol KIRIM BUKTI PEMBAYARAN lalu kirim foto bukti Anda.",
    proofReceived: "✅ Bukti berhasil diterima. Admin akan memeriksanya terlebih dahulu. Diamond belum ditambahkan ke akun Anda.",
    proofFailed: "⚠️ Bukti belum dapat dikirim. Silakan coba kembali atau hubungi admin.",
    instructions: "📌 Ikuti instruksi yang diberikan admin. Jangan pernah membagikan PIN, kata sandi, atau kode OTP.",
  },
  admin: {
    newTicket: (id: string, telegramId: string, pack: string, diamonds: number) =>
      `🧾 PESANAN DIAMOND BARU\\n\\nID Pesanan: ${id}\\nTelegram: ${telegramId}\\nPaket: ${pack}\\nJumlah: ${diamonds} Diamond\\n\\n🟡 Status: Menunggu pemeriksaan admin.`,
    proofTitle: "📥 BUKTI PESANAN DITERIMA",
    reviewButtons: {
      approve: "✅ Approve",
      decline: "❌ Decline",
    },
    approve: (diamonds: number, id: string) =>
      `✅ PESANAN DISETUJUI\\n\\n💎 ${diamonds} Diamond telah ditambahkan.\\n🧾 ID Pesanan: ${id}`,
    rejected: (id: string) =>
      `⚠️ PEMBAYARAN TIDAK DAPAT DIPROSES\\n\\nMohon maaf, pesanan Anda belum dapat kami proses karena terdapat kendala atau ketidaksesuaian data.\\n\\n🧾 ID Pesanan: ${id}\\n\\nJika merasa terjadi kesalahan, silakan hubungi admin @ipnmesum untuk mendapatkan bantuan lebih lanjut.\\n\\nTerima kasih atas pengertiannya.\\n— Nexora Team`,
  },
  help: `📋 PANDUAN NEXORA • TAMAVERSE

🔗 /uuid UUID_KAMU
Hubungkan akun Tamaverse Anda menggunakan UUID dari menu Profile.

💎 /buy
Lihat pilihan paket Diamond yang tersedia.

📤 /proof ORDER_ID
Gunakan hanya jika diminta oleh bot atau admin untuk mengidentifikasi pesanan.

🛡️ Demi keamanan akun, jangan pernah membagikan kata sandi, PIN, atau kode OTP.`,
  errors: {
    unknownCommand: "⚠️ Perintah belum dikenali. Ketik /help untuk melihat panduan.",
    tryAgain: "⚠️ Terjadi kendala. Silakan coba kembali beberapa saat lagi.",
    contactAdmin: "ℹ️ Jika kendala masih berlanjut, silakan hubungi admin.",
  },
} as const;
