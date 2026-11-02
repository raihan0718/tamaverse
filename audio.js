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
        volume: Number.isFinite(Number(saved.volume)) ? Math.min(1, Math.max(0, Number(saved.volume))) : 0.35
      };
    } catch (_) {
      return { muted: false, volume: 0.35 };
    }
  }

  function saveSettings(settings) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)); } catch (_) {}
  }

  function mount() {
    if (document.getElementById('tamaverseMusicControl')) return;

    audio = document.createElement('audio');
    audio.id = 'tamaverseBgm';
    audio.src = AUDIO_SRC;
    audio.loop = true;
    audio.preload = 'auto';
    audio.volume = readSettings().volume;
    audio.muted = readSettings().muted;
    audio.setAttribute('aria-label', 'Tamaverse background music');
    document.body.appendChild(audio);

    const style = document.createElement('style');
    style.textContent = `
      #tamaverseMusicControl{position:fixed;right:14px;bottom:calc(82px + env(safe-area-inset-bottom));z-index:9;display:flex;align-items:center;gap:8px}
      #tamaverseMusicToggle{display:flex;align-items:center;gap:7px;min-height:39px;padding:0 13px;border:1px solid #e7d8e8;border-radius:999px;background:#fffafc;color:#765477;box-shadow:0 5px 18px #62405b20;font:700 11px system-ui,sans-serif;cursor:pointer}
      #tamaverseMusicToggle .music-icon{font-size:15px}
      #tamaverseMusicPanel{display:none;align-items:center;gap:8px;padding:8px 11px;border:1px solid #e7d8e8;border-radius:14px;background:#fffafc;color:#765477;box-shadow:0 5px 18px #62405b20}
      #tamaverseMusicPanel.open{display:flex}
      #tamaverseMusicPanel label{font:700 9px system-ui,sans-serif;white-space:nowrap}
      #tamaverseMusicVolume{width:78px;accent-color:#b47cba}
      #tamaverseMusicControl button:focus-visible,#tamaverseMusicVolume:focus-visible{outline:2px solid #a978d3;outline-offset:3px}
      @media(max-width:380px){#tamaverseMusicControl{right:9px;bottom:calc(78px + env(safe-area-inset-bottom))}#tamaverseMusicToggle{min-height:36px;padding:0 11px}#tamaverseMusicVolume{width:62px}}
    `;
    document.head.appendChild(style);

    const root = document.createElement('div');
    root.id = 'tamaverseMusicControl';
    root.innerHTML = `
      <div id="tamaverseMusicPanel">
        <label for="tamaverseMusicVolume">VOLUME</label>
        <input id="tamaverseMusicVolume" type="range" min="0" max="1" step="0.01" value="${audio.volume}">
      </div>
      <button id="tamaverseMusicToggle" type="button" aria-pressed="false" aria-label="Aktifkan musik Tamaverse">
        <span class="music-icon" aria-hidden="true">♫</span><span class="music-label">Music off</span>
      </button>`;
    document.body.appendChild(root);

    const toggle = root.querySelector('#tamaverseMusicToggle');
    const panel = root.querySelector('#tamaverseMusicPanel');
    const volume = root.querySelector('#tamaverseMusicVolume');

    function syncButton() {
      const playing = !audio.paused && !audio.muted;
      toggle.setAttribute('aria-pressed', String(playing));
      toggle.setAttribute('aria-label', playing ? 'Matikan musik Tamaverse' : 'Aktifkan musik Tamaverse');
      toggle.querySelector('.music-icon').textContent = playing ? '♫' : '♪';
      toggle.querySelector('.music-label').textContent = playing ? 'Music on' : 'Music off';
    }

    async function startMusic() {
      if (started && !audio.paused) return;
      try {
        await audio.play();
        started = true;
        syncButton();
      } catch (error) {
        syncButton();
      }
    }

    toggle.addEventListener('click', async () => {
      panel.classList.toggle('open');
      if (audio.paused || audio.muted) {
        audio.muted = false;
        await startMusic();
      } else {
        audio.pause();
      }
      const settings = readSettings();
      settings.muted = audio.muted;
      settings.volume = audio.volume;
      saveSettings(settings);
      syncButton();
    });

    volume.addEventListener('input', () => {
      audio.volume = Number(volume.value);
      if (audio.volume > 0 && audio.muted) audio.muted = false;
      const settings = readSettings();
      settings.volume = audio.volume;
      settings.muted = audio.muted;
      saveSettings(settings);
      syncButton();
    });

    audio.addEventListener('play', syncButton);
    audio.addEventListener('pause', syncButton);
    audio.addEventListener('volumechange', syncButton);

    // Mobile browsers require a user gesture before audio can start.
    const firstGesture = () => {
      if (!started) startMusic();
      window.removeEventListener('pointerdown', firstGesture);
      window.removeEventListener('keydown', firstGesture);
    };
    window.addEventListener('pointerdown', firstGesture, { once: true, passive: true });
    window.addEventListener('keydown', firstGesture, { once: true });
    syncButton();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount, { once: true });
  } else {
    mount();
  }
})();
