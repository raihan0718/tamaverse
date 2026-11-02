(() => {
  'use strict';

  const AUDIO_SRC = 'assets/audio/bgm-main.mp3';
  const STORAGE_KEY = 'tamaverse_bgm_settings';
  let audio;
  let started = false;

  function readSettings() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      return {
        muted: saved.muted === true,
        volume: Number.isFinite(Number(saved.volume)) ? Math.min(1, Math.max(0, Number(saved.volume))) : 1
      };
    } catch (_) {
      return { muted: false, volume: 1 };
    }
  }

  function saveSettings() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        muted: audio.muted,
        volume: audio.volume
      }));
    } catch (_) {}
  }

  function syncProfileControls() {
    const enabled = !audio.muted;
    const toggle = document.getElementById('profileBgmToggle');
    const status = document.getElementById('profileBgmStatus');
    const slider = document.getElementById('profileBgmVolume');
    const value = document.getElementById('profileBgmVolumeValue');
    if (toggle) {
      toggle.setAttribute('aria-pressed', String(enabled));
      toggle.textContent = enabled ? 'Music On' : 'Music Off';
      toggle.classList.toggle('is-on', enabled);
    }
    if (status) status.textContent = enabled ? 'Background music is enabled' : 'Background music is disabled';
    if (slider && document.activeElement !== slider) slider.value = String(audio.volume);
    if (value) value.textContent = Math.round(audio.volume * 100) + '%';
  }

  async function setEnabled(enabled) {
    audio.muted = !enabled;
    if (enabled) {
      try {
        await audio.play();
        started = true;
      } catch (_) {
        // Playback will begin after the next permitted user gesture.
      }
    } else {
      audio.pause();
    }
    saveSettings();
    syncProfileControls();
  }

  function mount() {
    if (document.getElementById('tamaverseBgm')) return;
    const settings = readSettings();
    audio = document.createElement('audio');
    audio.id = 'tamaverseBgm';
    audio.src = AUDIO_SRC;
    audio.loop = true;
    audio.preload = 'auto';
    audio.volume = settings.volume;
    audio.muted = settings.muted;
    audio.setAttribute('aria-label', 'Tamaverse background music');
    document.body.appendChild(audio);

    const style = document.createElement('style');
    style.textContent = `
      .profile-bgm-card{margin:15px 0;padding:17px;border:1px solid var(--border-color);border-radius:19px;background:var(--card-bg);box-shadow:0 7px 20px #3520440c}
      .profile-bgm-heading{display:flex;align-items:center;gap:11px;margin-bottom:15px}
      .profile-bgm-icon{display:grid;place-items:center;width:42px;height:42px;flex:none;border-radius:14px;background:linear-gradient(145deg,#e7d9ff,#f7d8e9);color:#70558e;font-size:21px}
      .profile-bgm-heading h3{margin:2px 0 3px;font:700 16px 'Space Grotesk',sans-serif;color:var(--text)}
      .profile-bgm-heading p{margin:0;color:var(--muted);font-size:10px}
      .profile-bgm-toggle-row{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:11px 0;border-top:1px solid var(--border-color)}
      .profile-bgm-toggle-row span{font-size:11px;font-weight:700;color:var(--text)}
      .profile-bgm-toggle{min-width:88px;padding:8px 13px;border:1px solid var(--border-color);border-radius:999px;background:var(--card-bg);color:var(--text);font:700 10px 'DM Sans',sans-serif;cursor:pointer}
      .profile-bgm-toggle.is-on{border-color:#9d82c8;background:linear-gradient(120deg,#e9ddff,#f8e0ec);color:#5c4677}
      .profile-bgm-volume-row{display:grid;grid-template-columns:1fr auto;align-items:center;gap:8px;margin-top:12px}
      .profile-bgm-volume-row label{font-size:11px;font-weight:700;color:var(--text)}
      .profile-bgm-volume-row output{font:700 11px 'Space Grotesk',sans-serif;color:var(--muted);font-variant-numeric:tabular-nums}
      #profileBgmVolume{grid-column:1/-1;width:100%;margin:3px 0 0;accent-color:#a987cb;cursor:pointer}
      .profile-bgm-status{margin:10px 0 0;color:var(--muted);font-size:10px}
    `;
    document.head.appendChild(style);

    document.addEventListener('click', event => {
      const toggle = event.target.closest('#profileBgmToggle');
      if (!toggle) return;
      setEnabled(audio.muted);
    });
    document.addEventListener('input', event => {
      if (event.target.id !== 'profileBgmVolume') return;
      audio.volume = Math.min(1, Math.max(0, Number(event.target.value)));
      saveSettings();
      syncProfileControls();
    });

    const firstGesture = () => {
      if (!audio.muted && audio.paused) {
        audio.play().then(() => { started = true; }).catch(() => {});
      }
      window.removeEventListener('pointerdown', firstGesture);
      window.removeEventListener('keydown', firstGesture);
    };
    window.addEventListener('pointerdown', firstGesture, { once: true, passive: true });
    window.addEventListener('keydown', firstGesture, { once: true });
    audio.addEventListener('play', syncProfileControls);
    audio.addEventListener('pause', syncProfileControls);
    audio.addEventListener('volumechange', syncProfileControls);
  }

  window.TAMAVERSE_AUDIO_SETTINGS = {
    markup() {
      const settings = readSettings();
      const enabled = !settings.muted;
      return `<section class="profile-bgm-card" aria-label="Background music settings">
        <div class="profile-bgm-heading">
          <span class="profile-bgm-icon" aria-hidden="true">♫</span>
          <div><span class="eyebrow">PERSONAL PREFERENCES</span><h3>Audio Settings</h3><p>Atur musik latar Tamaverse.</p></div>
        </div>
        <div class="profile-bgm-toggle-row">
          <span>Background Music</span>
          <button id="profileBgmToggle" class="profile-bgm-toggle ${enabled?'is-on':''}" type="button" aria-pressed="${enabled}">${enabled?'Music On':'Music Off'}</button>
        </div>
        <div class="profile-bgm-volume-row">
          <label for="profileBgmVolume">Volume</label>
          <output id="profileBgmVolumeValue">${Math.round(settings.volume*100)}%</output>
          <input id="profileBgmVolume" type="range" min="0" max="1" step="0.01" value="${settings.volume}">
        </div>
        <p class="profile-bgm-status" id="profileBgmStatus">${enabled?'Background music is enabled':'Background music is disabled'}</p>
      </section>`;
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount, { once: true });
  } else {
    mount();
  }
})();