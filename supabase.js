
(() => {
  const supabaseUrl = window.TAMAVERSE_SUPABASE?.url || '';
  const supabaseKey = window.TAMAVERSE_SUPABASE?.anonKey || '';

  if (!supabaseUrl || !supabaseKey || !window.supabase) {
    console.info('Supabase client is not configured for TAMAVERSE.');
    return;
  }

  const supabase = window.supabase.createClient(
    supabaseUrl,
    supabaseKey,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    }
  );

  window.TAMAVERSE_SUPABASE_CLIENT = supabase;
  async function uploadTamaverseAvatar(dataUrl) {
    const user = await ensureSupabaseUser();
    if (!user) throw new Error('Akun belum tersambung ke Supabase.');
    if (typeof dataUrl !== 'string' || !/^data:image\/jpeg;base64,/i.test(dataUrl)) {
      throw new Error('Format foto hasil kompresi tidak valid.');
    }
    const blob = await (await fetch(dataUrl)).blob();
    if (!blob.size || blob.size > 5 * 1024 * 1024) throw new Error('Ukuran foto setelah kompresi maksimal 5 MB.');
    const path = user.id + '/avatar-' + Date.now() + '.jpg';
    const { error: uploadError } = await supabase.storage.from('player-avatars')
      .upload(path, blob, { contentType: 'image/jpeg', upsert: false, cacheControl: '3600' });
    if (uploadError) throw uploadError;
    const { data: publicData } = supabase.storage.from('player-avatars').getPublicUrl(path);
    const avatarUrl = publicData?.publicUrl;
    if (!avatarUrl) throw new Error('URL foto gagal dibuat.');
    const { error: profileError } = await supabase.from('profiles')
      .update({ avatar_url: avatarUrl, avatar: '🧙' }).eq('id', user.id);
    if (profileError) throw profileError;
    return avatarUrl;
  }
  window.uploadTamaverseAvatar = uploadTamaverseAvatar;


  let telegramAuthReady = false;
  let telegramAuthPromise = null;
  let verifiedTelegramId = "";

  async function ensureSupabaseUser() {
    if (!telegramAuthReady || !verifiedTelegramId) {
      throw new Error("Akun Telegram belum terverifikasi.");
    }
    const { data: userData, error } = await supabase.auth.getUser();
    if (error) throw error;
    const user = userData?.user;
    const isTelegramUser = user?.app_metadata?.telegram_auth === true
      && String(user?.app_metadata?.telegram_user_id || "") === verifiedTelegramId;
    if (!user || user.is_anonymous === true || !isTelegramUser) {
      throw new Error("Sesi Telegram tidak valid. Silakan buka ulang Tamaverse dari bot.");
    }
    window.TAMAVERSE_USER_ID = user.id;
    return user;
  }

  window.ensureTamaverseAuth = ensureSupabaseUser;

  async function initializeTelegramAuth() {
    const gate = document.getElementById("telegramAuthGate");
    const status = document.getElementById("telegramAuthStatus");
    const retry = document.getElementById("telegramAuthRetry");
    const setStatus = (message) => { if (status) status.textContent = message; };
    const showFailure = (message) => {
      if (gate) gate.dataset.state = "error";
      setStatus(message || "Autentikasi gagal. Coba buka kembali dari bot Tamaverse.");
      if (retry) retry.hidden = false;
    };

    try {
      if (gate) { gate.hidden = false; gate.dataset.state = "loading"; }
      if (retry) retry.hidden = true;
      setStatus("Memverifikasi retina matamu...");

      const telegram = window.Telegram?.WebApp;
      const initData = typeof telegram?.initData === "string" ? telegram.initData : "";
      if (!initData) {
        throw new Error("Buka Tamaverse melalui tombol Open Tamaverse di bot Telegram.");
      }

      const { data: authResult, error: authError } = await supabase.functions.invoke("telegram-auth", {
        body: { initData }
      });
      if (authError) {
        let detail = "";
        try {
          const response = authError.context;
          if (response && typeof response.clone === "function") {
            const payload = await response.clone().json().catch(() => null);
            const base = payload?.error || payload?.message || "";
            const diag = payload?.diagnostic;
            const diagText = diag ? [
              diag.stage ? "stage=" + diag.stage : "",
              diag.code ? "code=" + diag.code : "",
              diag.message ? "detail=" + String(diag.message).slice(0, 180) : "",
              diag.status ? "status=" + diag.status : ""
            ].filter(Boolean).join(" | ") : "";
            detail = [base, diagText].filter(Boolean).join(" — ");
            if (!detail) detail = "HTTP " + response.status;
          }
        } catch (_) {}
        console.error("Telegram auth function failed:", {
          name: authError.name,
          message: authError.message,
          detail,
          error: authError
        });
        const safeDetail = String(detail || authError.message || "Koneksi ke layanan autentikasi gagal").slice(0, 160);
        throw new Error("Login gagal: " + safeDetail + ". Coba muat ulang Tamaverse.");
      }
      if (!authResult?.session?.access_token || !authResult?.session?.refresh_token || !authResult?.telegram_user_id) {
        throw new Error(authResult?.error || "Server tidak mengembalikan sesi akun Telegram yang valid.");
      }

      setStatus("Retina terdeteksi, bersiap masuk ke dunia baru...");
      const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
        access_token: authResult.session.access_token,
        refresh_token: authResult.session.refresh_token
      });
      if (sessionError) throw sessionError;

      const user = sessionData?.user;
      const returnedTelegramId = String(authResult.telegram_user_id);
      const isTelegramUser = user?.app_metadata?.telegram_auth === true
        && String(user?.app_metadata?.telegram_user_id || "") === returnedTelegramId;
      if (!user || user.is_anonymous === true || !isTelegramUser) {
        await supabase.auth.signOut({ scope: "local" });
        throw new Error("Identitas Telegram tidak cocok dengan akun Tamaverse.");
      }

      verifiedTelegramId = returnedTelegramId;
      telegramAuthReady = true;
      window.TAMAVERSE_USER_ID = user.id;
      window.TAMAVERSE_TELEGRAM_ID = returnedTelegramId;
      setStatus("Retina terdeteksi, bersiap masuk ke dunia baru...");
      await loadPlayerFromSupabase();
      if (gate) {
        gate.dataset.state = "ready";
        window.setTimeout(() => { gate.hidden = true; }, 250);
      }
      return user;
    } catch (error) {
      telegramAuthReady = false;
      verifiedTelegramId = "";
      window.TAMAVERSE_USER_ID = null;
      window.TAMAVERSE_TELEGRAM_ID = null;
      console.error("Telegram auto-authentication failed:", error);
      showFailure(error?.message);
      throw error;
    }
  }

  function startTelegramAuth() {
    if (telegramAuthPromise) return telegramAuthPromise;
    telegramAuthPromise = initializeTelegramAuth().catch((error) => {
      telegramAuthPromise = null;
      throw error;
    });
    return telegramAuthPromise;
  }

  window.TAMAVERSE_AUTH_READY = new Promise((resolve, reject) => {
    window.addEventListener("load", () => {
      startTelegramAuth().then(resolve, reject);
    }, { once: true });
  });

  window.addEventListener("load", () => {
    const retry = document.getElementById("telegramAuthRetry");
    retry?.addEventListener("click", () => {
      if (retry) retry.hidden = true;
      startTelegramAuth().catch(() => {});
    });
  }, { once: true });

  async function savePlayerToSupabase() {
    if (!window.state || !supabase) return;

    const user = await ensureSupabaseUser();
    if (!user) return;

    try {
      const player = window.state.player || {};
      const items = window.state.items || {};
      const coinBalance = Number(player.coins);
      if (!Number.isSafeInteger(coinBalance) || coinBalance < 0 || coinBalance > 2147483647) {
        console.warn('Cloud save skipped: Coin balance is outside the supported integer range.');
        return;
      }

      const profilePayload = {
        id: user.id,
        display_name: player.name || 'Penjelajah',
        avatar: /^https:\/\//i.test(String(player.avatar || '')) || /^data:image\//i.test(String(player.avatar || '')) ? '🧙' : (player.avatar || '🧙'),
        avatar_url: player.avatarUrl || (/^https:\/\//i.test(String(player.avatar || '')) ? player.avatar : null),
        level: Number(player.level || 1),
        xp: Number(player.xp || 0),
        rating: Number(player.rating || 1000),
        wins: Number(player.wins || 0),
        losses: Number(player.losses || 0),
        draws: Number(player.draws || 0),
      };

      // The auth trigger creates the profile row; authenticated clients have UPDATE,
      // not INSERT, permission on profiles.
      const { data: savedProfile, error: profileError } = await window.TAMAVERSE_SUPABASE_CLIENT
        .from('profiles')
        .update(profilePayload)
        .eq('id', user.id)
        .select('id')
        .maybeSingle();

      if (profileError) {
        console.warn('Save profile failed:', profileError);
      } else if (!savedProfile) {
        console.warn('Save profile skipped: account profile row is missing.');
      }

      const inventoryPayload = {
        owner_id: user.id,
        coins: coinBalance,
        // Diamonds are authoritative in Supabase and are changed only by secure RPCs.
        snack: Number(items.snack || 0),
        energy: Number(items.energy || 0),
        training: Number(items.training || 0),
        fragments: items.fragments || {},
      };

      // Auth signup trigger + schema backfill guarantee this row exists.
      // Update only client-owned fields: never upsert or overwrite the server Diamond balance.
      const { data: savedInventory, error: inventoryError } = await window.TAMAVERSE_SUPABASE_CLIENT
        .from('inventory')
        .update(inventoryPayload)
        .eq('owner_id', user.id)
        .select('owner_id')
        .maybeSingle();

      if (inventoryError) {
        console.warn('Save inventory failed:', inventoryError);
      } else if (!savedInventory) {
        console.warn('Save inventory skipped: account inventory row is missing.');
      }

      // Sync the local pet collection without deleting existing cloud rows.
      const pets = Array.isArray(window.state.pets) ? window.state.pets : [];

      if (pets.length > 0) {
        // Keep ordinary background saves from racing the explicit active-pet
        // selection used by online matchmaking and start_pvp_match.
        const petsPayload = pets
          .filter((pet) => pet && pet.uid && pet.species)
          .map((pet) => ({
            owner_id: user.id,
            client_uid: String(pet.uid),
            species: String(pet.species),
            nickname: String(pet.name || pet.species).slice(0, 40),
            level: Math.max(1, Number(pet.level) || 1),
            xp: Math.max(0, Number(pet.xp) || 0),
            hunger: Math.min(100, Math.max(0, Number(pet.hunger) || 0)),
            happiness: Math.min(100, Math.max(0, Number(pet.happiness) || 0)),
            energy: Math.min(100, Math.max(0, Number(pet.energy) || 0)),
            cleanliness: Math.min(100, Math.max(0, Number(pet.cleanliness) || 0)),
            evolution: Math.max(0, Number(pet.evolution) || 0),
            is_active: String(pet.uid) === String(window.state.activePet),
          }));

        if (petsPayload.length > 0) {
          const { error: petsError } = await supabase
            .from('pets')
            .upsert(petsPayload, { onConflict: 'owner_id,client_uid' });

          if (petsError) {
            console.warn('Save pets failed:', petsError);
          }
        }
      }
    } catch (error) {
      console.warn('Supabase save failed:', error);
    }
  }

  window.savePlayerToSupabase = savePlayerToSupabase;

  async function loadPlayerFromSupabase() {
    if (!window.state || !supabase) return;

    const user = await ensureSupabaseUser();
    if (!user) return;

    window.TAMAVERSE_USER_ID = user.id;
    setupDiamondWalletSync(user.id);

    // Founder reward verification runs in the background so it cannot hold the lobby.
    const founderGrantPromise = (async () => {
      try {
        const initData = window.Telegram?.WebApp?.initData || '';
        const { data, error } = await supabase.functions.invoke(
          'grant-founder-rewards',
          { body: { initData } }
        );
        if (error) {
          console.warn('[Founder] Reward check failed:', error);
          return false;
        }
        return Boolean(data?.success && data?.founder);
      } catch (error) {
        console.warn('[Founder] Reward check unavailable:', error);
        return false;
      }
    })();

    try {
      // Independent cloud reads run together instead of waiting one by one.
      const [profileResult, inventoryResult, dailyResult, premiumResult, petsResult] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
        supabase.from('inventory').select('*').eq('owner_id', user.id).maybeSingle(),
        supabase.from('daily_rewards').select('last_claim_date, day').eq('owner_id', user.id).maybeSingle(),
        supabase.from('premium_inventory').select('rename_card_count, rename_pet_card_count, owned_frames').eq('owner_id', user.id).maybeSingle(),
        supabase.from('pets').select('client_uid, species, nickname, level, xp, is_active').eq('owner_id', user.id)
      ]);

      const { data: profileData, error: profileError } = profileResult;
      if (profileError) console.warn('Load profile failed:', profileError);
      else if (profileData) {
        window.state.player.name = profileData.display_name || window.state.player.name;
        window.state.player.avatarUrl = profileData.avatar_url || '';
        window.state.player.avatar = window.state.player.avatarUrl || profileData.avatar || window.state.player.avatar;
        window.state.player.level = Number(profileData.level || 1);
        window.state.player.xp = Number(profileData.xp || 0);
        window.state.player.rating = Number(profileData.rating || 1000);
        window.state.player.wins = Number(profileData.wins || 0);
        window.state.player.losses = Number(profileData.losses || 0);
        window.state.player.draws = Number(profileData.draws || 0);
        const telegramPhoto = window.Telegram?.WebApp?.initDataUnsafe?.user?.photo_url;
        if (telegramPhoto && !window.state.player.avatarUrl && !profileData.avatar_url) window.state.player.avatar = telegramPhoto;
      }

      const { data: inventoryData, error: inventoryError } = inventoryResult;
      if (inventoryError) console.warn('Load inventory failed:', inventoryError);
      else if (inventoryData) {
        const player = window.state.player;
        window.state.items = window.state.items || {};
        player.coins = Number(inventoryData.coins ?? player.coins ?? 0);
        player.diamonds = Number(inventoryData.diamonds ?? player.diamonds ?? 0);
        window.state.items.snack = Number(inventoryData.snack ?? window.state.items.snack ?? 0);
        window.state.items.energy = Number(inventoryData.energy ?? window.state.items.energy ?? 0);
        window.state.items.training = Number(inventoryData.training ?? window.state.items.training ?? 0);
        window.state.items.fragments = inventoryData.fragments || window.state.items.fragments || {};
      }

      const { data: dailyRewardData, error: dailyRewardError } = dailyResult;
      if (dailyRewardError) console.warn('Load daily rewards failed:', dailyRewardError);
      else if (dailyRewardData) {
        window.state.dailyReward = {
          lastClaimDate: dailyRewardData.last_claim_date || '',
          day: Number(dailyRewardData.day || 0)
        };
      }

      const { data: premiumData, error: premiumError } = premiumResult;
      if (premiumError) console.warn('Load premium inventory failed:', premiumError);
      else if (premiumData) {
        window.TAMAVERSE_PREMIUM_INVENTORY = {
          rename_card_count: Number(premiumData.rename_card_count || 0),
          rename_pet_card_count: Number(premiumData.rename_pet_card_count || 0),
          owned_frames: Array.isArray(premiumData.owned_frames) ? premiumData.owned_frames : ['common']
        };
      }

      const { data: cloudPets, error: petsLoadError } = petsResult;
      if (petsLoadError) console.warn('Load pets failed:', petsLoadError);
      else if (Array.isArray(cloudPets) && cloudPets.length) {
        const localPets = Array.isArray(window.state.pets) ? window.state.pets : [];
        const activeCloudPets = cloudPets
          .filter(pet => pet.is_active)
          .sort((a, b) => String(a.client_uid).localeCompare(String(b.client_uid)));
        const previousActiveUid = String(window.state.activePet || '');
        const resolvedActiveCloudPet = activeCloudPets.length === 1
          ? activeCloudPets[0]
          : activeCloudPets.find(pet => String(pet.client_uid) === previousActiveUid)
            || activeCloudPets[0] || null;
        cloudPets.forEach((cloudPet) => {
          let localPet = localPets.find((pet) => String(pet.uid) === String(cloudPet.client_uid));
          if (!localPet && cloudPet.species === 'sovereign-nexora') {
            localPet = {
              uid: String(cloudPet.client_uid), species: cloudPet.species,
              name: cloudPet.nickname || 'Nexora', level: Number(cloudPet.level || 1),
              xp: Number(cloudPet.xp || 0), hp: 132,
              stats: { hp: 132, atk: 26, def: 23, spd: 19 },
              hunger: 100, happiness: 100, energy: 100, cleanliness: 100,
              evolution: 0, fragments: 0
            };
            localPets.push(localPet);
          }
          if (!localPet) return;
          const oldLevel = Math.max(1, Number(localPet.level) || 1);
          const newLevel = Math.max(1, Number(cloudPet.level) || 1);
          const levelGain = newLevel - oldLevel;
          if (levelGain > 0) {
            localPet.stats = localPet.stats || {};
            localPet.stats.hp = Number(localPet.stats.hp || 0) + 5 * levelGain;
            localPet.stats.atk = Number(localPet.stats.atk || 0) + levelGain;
            localPet.stats.def = Number(localPet.stats.def || 0) + levelGain;
            localPet.hp = localPet.stats.hp;
          }
          localPet.level = newLevel;
          localPet.xp = Math.max(0, Number(cloudPet.xp) || 0);
          if (cloudPet.nickname) localPet.name = cloudPet.nickname;
          if (resolvedActiveCloudPet && String(cloudPet.client_uid) === String(resolvedActiveCloudPet.client_uid)) {
            window.state.activePet = localPet.uid;
          }
        });
      }
    } catch (error) {
      console.warn('Supabase load failed:', error);
    }

    // Apply founder-only rewards after the lobby has already become available.
    founderGrantPromise.then((founderGrant) => {
      if (!founderGrant) return;
      window.TAMAVERSE_PREMIUM_INVENTORY = window.TAMAVERSE_PREMIUM_INVENTORY || {
        rename_card_count: 0, rename_pet_card_count: 0, owned_frames: ['common']
      };
      const ownedFrames = window.TAMAVERSE_PREMIUM_INVENTORY.owned_frames || ['common'];
      if (!ownedFrames.includes('royal-sovereign')) {
        window.TAMAVERSE_PREMIUM_INVENTORY.owned_frames = [...ownedFrames, 'royal-sovereign'];
      }
      window.state.pets = Array.isArray(window.state.pets) ? window.state.pets : [];
      const founderPetUid = 'founder-nexora-' + String(window.Telegram?.WebApp?.initDataUnsafe?.user?.id || '');
      if (!window.state.pets.some((pet) => pet.species === 'sovereign-nexora')) {
        window.state.pets.push({
          uid: founderPetUid, species: 'sovereign-nexora', name: 'Nexora',
          level: 1, xp: 0, hp: 132, stats: { hp: 132, atk: 26, def: 23, spd: 19 },
          hunger: 100, happiness: 100, energy: 100, cleanliness: 100,
          evolution: 0, fragments: 0
        });
      }
      try { localStorage.setItem('tamaverse_save_v1', JSON.stringify(window.state)); } catch (error) {
        console.warn('Founder reward local save failed:', error);
      }
      if (typeof window.render === 'function') window.render();
    });
    // Update the ID if its element is already on the page.
    const idElement = document.getElementById('supabaseUserId');

    if (idElement) {
      idElement.textContent = user.id;
    }

    // Refresh the UI after the ID and cloud data are available.
    if (typeof window.render === 'function') {
      window.render();
    }
  }

  window.loadPlayerFromSupabase = loadPlayerFromSupabase;

  // Active Playtime: count only while the app is visible, sync in short secure batches.
  let playtimeLastTick = document.visibilityState === 'visible' ? Date.now() : 0;
  let playtimePendingSeconds = 0;
  let playtimeSyncBusy = false;

  async function syncActivePlaytime(force = false) {
    if (playtimeSyncBusy || !supabase || !window.TAMAVERSE_USER_ID) return;
    if (document.visibilityState === 'visible' && playtimeLastTick) {
      const elapsed = Math.max(0, Math.floor((Date.now() - playtimeLastTick) / 1000));
      if (elapsed > 0) {
        playtimePendingSeconds += elapsed;
        playtimeLastTick = Date.now();
      }
    }
    if (!force && playtimePendingSeconds < 60) return;
    if (playtimePendingSeconds < 1) return;

    const batch = Math.min(90, playtimePendingSeconds);
    playtimeSyncBusy = true;
    try {
      const { error } = await supabase.rpc('add_tamaverse_playtime', { p_seconds: batch });
      if (error) throw error;
      playtimePendingSeconds -= batch;
      if (window.page === 'ranking' && typeof window.loadGlobalRankings === 'function') {
        window.loadGlobalRankings();
      }
    } catch (error) {
      console.warn('Active Playtime sync failed:', error);
    } finally {
      playtimeSyncBusy = false;
    }
  }

  window.setInterval(() => syncActivePlaytime(false), 15000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      syncActivePlaytime(true);
      playtimeLastTick = 0;
    } else {
      playtimeLastTick = Date.now();
    }
  });
  window.addEventListener('pagehide', () => syncActivePlaytime(true));
  window.addEventListener('focus', () => {
    if (document.visibilityState === 'visible') playtimeLastTick = Date.now();
  });

  // Profile updates are the realtime path for all leaderboard categories.
  let leaderboardChannel = null;
  function setupLeaderboardRealtime() {
    if (leaderboardChannel || !supabase) return;
    leaderboardChannel = supabase
      .channel('tamaverse-global-leaderboard')
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'profiles'
      }, () => {
        if (typeof window.loadGlobalRankings === 'function') window.loadGlobalRankings();
      })
      .subscribe(status => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.warn('Leaderboard Realtime unavailable; periodic refresh remains active.');
        }
      });
  }
  setupLeaderboardRealtime();
  window.setInterval(() => {
    if (document.visibilityState === 'visible' &&
        document.querySelector('.ranking-page') &&
        typeof window.loadGlobalRankings === 'function') {
      window.loadGlobalRankings();
    }
  }, 30000);


  // Keep the displayed Diamond balance in sync with the server wallet.
  // Realtime is the fast path; focus/visibility refresh is the reliable fallback
  // when the app was backgrounded while a top-up was approved in Telegram.
  let diamondWalletChannel = null;
  let diamondRefreshInFlight = false;

  async function refreshDiamondBalance() {
    if (!window.state || !supabase || diamondRefreshInFlight) return null;
    diamondRefreshInFlight = true;
    try {
      const user = await ensureSupabaseUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from('inventory')
        .select('diamonds')
        .eq('owner_id', user.id)
        .maybeSingle();

      if (error) throw error;
      if (!data || !Number.isFinite(Number(data.diamonds))) return null;

      const balance = Math.max(0, Number(data.diamonds));
      const previous = Number(window.state.player?.diamonds ?? 0);
      window.state.player.diamonds = balance;

      if (balance !== previous) {
        if (typeof window.render === 'function') window.render();
        if (balance > previous && typeof window.showTopupSuccessModal === 'function') {
            const added = balance - previous;
            window.showTopupSuccessModal(added);
          }
        // Persist the refreshed display locally without ever writing Diamonds
        // back to Supabase; the cloud save payload intentionally omits them.
        try {
          const key = 'tamaverse_save_v1';
          const raw = localStorage.getItem(key);
          if (raw) {
            const saved = JSON.parse(raw);
            if (saved && saved.player) {
              saved.player.diamonds = balance;
              localStorage.setItem(key, JSON.stringify(saved));
            }
          }
        } catch (storageError) {
          console.warn('Local Diamond cache refresh failed:', storageError);
        }
      }
      return balance;
    } catch (error) {
      console.warn('Diamond wallet refresh failed:', error);
      return null;
    } finally {
      diamondRefreshInFlight = false;
    }
  }

  async function setupDiamondWalletSync(userId) {
    if (!userId || diamondWalletChannel) return;

    diamondWalletChannel = supabase
      .channel('tamaverse-diamond-wallet-' + userId)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'inventory',
          filter: 'owner_id=eq.' + userId
        },
        (payload) => {
          const value = Number(payload.new?.diamonds);
          if (!Number.isFinite(value) || !window.state?.player) return;
          const balance = Math.max(0, value);
          const previous = Number(window.state.player.diamonds ?? 0);
          if (previous === balance) return;
          window.state.player.diamonds = balance;
          if (typeof window.render === 'function') window.render();
          if (balance > previous && typeof window.showTopupSuccessModal === 'function') {
            const added = balance - previous;
            window.showTopupSuccessModal(added);
          }
        }
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.warn('Diamond Realtime unavailable; wallet will refresh when the app returns to foreground.');
        }
      });
  }

  window.refreshTamaverseDiamondBalance = refreshDiamondBalance;

  window.addEventListener('focus', () => {
    refreshDiamondBalance();
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') refreshDiamondBalance();
  });

  // Keep the existing local save and also save to Supabase.
  const originalSave =
    typeof window.save === 'function' ? window.save : null;

  if (originalSave) {
    window.save = function() {
      try {
        return originalSave.apply(this, arguments);
      } finally {
        savePlayerToSupabase().catch((error) => {
          console.warn('Cloud save failed:', error);
        });
      }
    };
  }

  // Telegram authentication owns startup and loads cloud data after a verified session is set.
})();
