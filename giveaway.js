(() => {
  'use strict';

  const ADMIN_TELEGRAM_ID = '8906658395';
  const db = () => window.TAMAVERSE_SUPABASE_CLIENT;
  const isAdmin = () => String(window.TAMAVERSE_TELEGRAM_ID || window.Telegram?.WebApp?.initDataUnsafe?.user?.id || '') === ADMIN_TELEGRAM_ID;
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[ch]));
  const format = (value) => Number(value || 0).toLocaleString('id-ID');
  const call = async (name, args = {}) => {
    if (!db() || !window.TAMAVERSE_USER_ID || typeof window.ensureTamaverseAuth !== 'function') {
      throw new Error('Akun Telegram belum siap. Muat ulang Tamaverse dari Telegram.');
    }
    await window.ensureTamaverseAuth();
    const { data, error } = await db().rpc(name, args);
    if (error) throw error;
    return data;
  };
  const notify = (message) => {
    if (typeof window.showToast === 'function') window.showToast(message);
    else alert(message);
  };
  const getShareUrl = (code) => {
    const url = new URL(window.location.href);
    url.searchParams.set('giveaway', code);
    url.hash = '';
    return url.toString();
  };

  function panelMarkup() {
    return `
      <section id="tamaverseGiveawayAdmin" class="card" style="margin-top:18px;padding:18px">
        <div class="eyebrow">TAMAVERSE ADMIN</div>
        <h2 style="margin:4px 0 8px">💎 Diamond Giveaway</h2>
        <p class="subtle">Buat satu link publik untuk banyak pemain. Kuota dan masa berlaku ditentukan di sini.</p>
        <form id="tamaverseGiveawayForm" style="display:grid;gap:10px;margin-top:14px">
          <label class="muted-label" for="giveawayTitle">NAMA GIVEAWAY</label>
          <input class="text-input" id="giveawayTitle" maxlength="80" value="Diamond Giveaway" required>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
            <div><label class="muted-label" for="giveawayDiamonds">DIAMOND / PEMAIN</label><input class="text-input" id="giveawayDiamonds" type="number" min="1" max="1000000000" step="1" placeholder="100" required></div>
            <div><label class="muted-label" for="giveawayLimit">KUOTA PEMAIN</label><input class="text-input" id="giveawayLimit" type="number" min="1" max="1000000" step="1" placeholder="20" required></div>
          </div>
          <label class="muted-label" for="giveawayExpiry">KEDALUWARSA (OPSIONAL)</label>
          <input class="text-input" id="giveawayExpiry" type="datetime-local">
          <button class="button full" id="giveawayCreateButton" type="submit">Buat Link Giveaway</button>
        </form>
        <div id="tamaverseGiveawayCreated" hidden style="margin-top:14px"></div>
        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:20px">
          <h3 style="margin:0">Riwayat Giveaway</h3>
          <button class="button secondary" type="button" data-giveaway-action="refresh">Refresh</button>
        </div>
        <div id="tamaverseGiveawayList" style="display:grid;gap:10px;margin-top:10px"><p class="subtle">Memuat giveaway...</p></div>
      </section>`;
  }

  async function loadGiveaways() {
    const host = document.getElementById('tamaverseGiveawayList');
    if (!host) return;
    host.innerHTML = '<p class="subtle">Memuat giveaway...</p>';
    try {
      const rows = await call('tamaverse_list_diamond_giveaways');
      if (!Array.isArray(rows) || !rows.length) {
        host.innerHTML = '<p class="subtle">Belum ada giveaway yang dibuat.</p>';
        return;
      }
      host.innerHTML = rows.map(row => {
        const url = getShareUrl(row.code);
        const expired = row.expires_at ? new Date(row.expires_at).toLocaleString('id-ID') : 'Tidak ada';
        const status = row.status === 'active' ? 'Aktif' : row.status === 'completed' ? 'Kuota habis' : row.status === 'expired' ? 'Kedaluwarsa' : 'Dibatalkan';
        return `<article class="card" style="padding:12px">
          <div style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start">
            <div><b>${escapeHtml(row.title)}</b><div class="subtle" style="font-size:12px;margin-top:3px">${format(row.diamonds)} 💎 / pemain · ${format(row.claim_count)} / ${format(row.max_claims)} klaim</div></div>
            <span class="pill">${status}</span>
          </div>
          <div class="subtle" style="font-size:12px;margin:7px 0">Berlaku sampai: ${escapeHtml(expired)}</div>
          <div style="font-size:12px;overflow-wrap:anywhere;padding:8px;border-radius:10px;background:rgba(150,120,180,.09)">${escapeHtml(url)}</div>
          <div style="display:flex;gap:8px;margin-top:9px;flex-wrap:wrap">
            <button class="button secondary" type="button" data-giveaway-action="copy" data-url="${escapeHtml(url)}">Salin Link</button>
            ${row.status === 'active' ? `<button class="button danger" type="button" data-giveaway-action="cancel" data-id="${escapeHtml(row.id)}">Batalkan</button>` : ''}
          </div>
        </article>`;
      }).join('');
    } catch (error) {
      host.innerHTML = '<p class="subtle">Gagal memuat: ' + escapeHtml(error.message || error) + '</p>';
    }
  }

  function mountAdminPanel() {
    if (!isAdmin() || !document.querySelector('.profile-page') || document.getElementById('tamaverseGiveawayAdmin')) return;
    const profile = document.querySelector('.profile-page');
    const panel = document.createElement('div');
    panel.innerHTML = panelMarkup();
    profile.insertBefore(panel.firstElementChild, profile.querySelector('.profile-reset-button') || null);
    loadGiveaways();
  }

  function mountClaimPanel(code) {
    if (!code || document.getElementById('tamaverseGiveawayClaim')) return;
    const root = document.getElementById('mainContent');
    if (!root) return;
    const panel = document.createElement('section');
    panel.id = 'tamaverseGiveawayClaim';
    panel.className = 'card';
    panel.style.cssText = 'margin:12px 16px;padding:18px;border:1px solid rgba(170,130,210,.35)';
    panel.innerHTML = `
      <div class="eyebrow">TAMAVERSE · COMMUNITY GIFT</div>
      <h2 style="margin:5px 0">🎁 Diamond Giveaway</h2>
      <p class="subtle">Ada hadiah Diamond yang menunggumu. Setiap akun hanya bisa klaim satu kali untuk giveaway ini.</p>
      <button class="button full" type="button" data-giveaway-action="claim" data-code="${escapeHtml(code)}">Claim Diamonds</button>
      <p class="subtle" id="tamaverseGiveawayClaimStatus" style="margin-top:8px"></p>`;
    root.prepend(panel);
  }

  async function claim(code, button) {
    const status = document.getElementById('tamaverseGiveawayClaimStatus');
    button.disabled = true;
    button.textContent = 'Memproses klaim...';
    try {
      const result = await call('tamaverse_claim_diamond_giveaway', { p_code: code });
      if (window.state?.player) window.state.player.diamonds = Number(result.balance);
      if (typeof window.render === 'function') window.render();
      mountClaimPanel(code);
      const panel = document.getElementById('tamaverseGiveawayClaim');
      if (panel) {
        panel.innerHTML = `<div class="eyebrow">GIVEAWAY BERHASIL</div><h2>+ ${format(result.diamonds)} 💎</h2><p>Diamond sudah masuk ke wallet kamu. Saldo sekarang: ${format(result.balance)} 💎</p>`;
      }
    } catch (error) {
      if (status) status.textContent = error.message || 'Klaim gagal. Coba lagi.';
      button.disabled = false;
      button.textContent = 'Coba Klaim Lagi';
    }
  }

  document.addEventListener('submit', async (event) => {
    if (event.target?.id !== 'tamaverseGiveawayForm') return;
    event.preventDefault();
    const form = event.target;
    const button = document.getElementById('giveawayCreateButton');
    const created = document.getElementById('tamaverseGiveawayCreated');
    const diamonds = Number(document.getElementById('giveawayDiamonds')?.value);
    const maxClaims = Number(document.getElementById('giveawayLimit')?.value);
    const title = String(document.getElementById('giveawayTitle')?.value || '').trim();
    const expiryValue = document.getElementById('giveawayExpiry')?.value;
    if (!Number.isSafeInteger(diamonds) || diamonds < 1 || !Number.isSafeInteger(maxClaims) || maxClaims < 1) {
      notify('Isi jumlah diamond dan kuota dengan angka bulat yang valid.');
      return;
    }
    let expiresAt = null;
    if (expiryValue) {
      const date = new Date(expiryValue);
      if (!Number.isFinite(date.getTime()) || date.getTime() <= Date.now()) {
        notify('Waktu kedaluwarsa harus berada di masa depan.');
        return;
      }
      expiresAt = date.toISOString();
    }
    button.disabled = true;
    button.textContent = 'Membuat giveaway...';
    try {
      const row = await call('tamaverse_create_diamond_giveaway', {
        p_diamonds: diamonds,
        p_max_claims: maxClaims,
        p_expires_at: expiresAt,
        p_title: title
      });
      const url = getShareUrl(row.code);
      created.hidden = false;
      created.innerHTML = `<article class="card" style="padding:12px"><b>Link giveaway berhasil dibuat!</b><p class="subtle">${format(row.diamonds)} 💎 × ${format(row.max_claims)} pemain</p><input class="text-input" readonly value="${escapeHtml(url)}" id="tamaverseGiveawayShareUrl"><button class="button full" type="button" data-giveaway-action="copy" data-url="${escapeHtml(url)}" style="margin-top:8px">Salin Link untuk Dibagikan</button></article>`;
      form.reset();
      document.getElementById('giveawayTitle').value = 'Diamond Giveaway';
      await loadGiveaways();
    } catch (error) {
      notify('Gagal membuat giveaway: ' + (error.message || error));
    } finally {
      button.disabled = false;
      button.textContent = 'Buat Link Giveaway';
    }
  });

  document.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-giveaway-action]');
    if (!button) return;
    const action = button.dataset.giveawayAction;
    if (action === 'copy') {
      const url = button.dataset.url || '';
      try {
        await navigator.clipboard.writeText(url);
        notify('Link giveaway berhasil disalin.');
      } catch (_) {
        const input = document.getElementById('tamaverseGiveawayShareUrl');
        if (input) { input.focus(); input.select(); notify(document.execCommand('copy') ? 'Link disalin.' : 'Salin link secara manual.'); }
        else notify('Salin link secara manual: ' + url);
      }
    } else if (action === 'refresh') {
      loadGiveaways();
    } else if (action === 'cancel') {
      if (!confirm('Batalkan giveaway ini? Link tidak bisa digunakan lagi.')) return;
      button.disabled = true;
      try {
        await call('tamaverse_cancel_diamond_giveaway', { p_giveaway_id: button.dataset.id });
        await loadGiveaways();
        notify('Giveaway berhasil dibatalkan.');
      } catch (error) {
        notify('Gagal membatalkan: ' + (error.message || error));
        button.disabled = false;
      }
    } else if (action === 'claim') {
      await claim(button.dataset.code, button);
    }
  });

  const observer = new MutationObserver(() => mountAdminPanel());
  window.addEventListener('DOMContentLoaded', () => {
    const root = document.getElementById('mainContent');
    if (root) observer.observe(root, { childList: true });
    mountAdminPanel();
  });

  window.addEventListener('load', async () => {
    const code = new URLSearchParams(window.location.search).get('giveaway');
    if (!code) return;
    if (!/^[a-z0-9]{8,16}$/i.test(code)) return;
    try {
      if (window.TAMAVERSE_AUTH_READY) await window.TAMAVERSE_AUTH_READY;
      mountClaimPanel(code.toUpperCase());
    } catch (error) {
      mountClaimPanel(code.toUpperCase());
      const status = document.getElementById('tamaverseGiveawayClaimStatus');
      if (status) status.textContent = 'Login belum berhasil. Buka kembali link giveaway setelah akun terverifikasi.';
    }
  });
})();