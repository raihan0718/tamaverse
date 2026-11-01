
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

  async function ensureSupabaseUser() {
    try {
      const { data: { session }, error } =
        await supabase.auth.getSession();

      if (error) throw error;

      let user = session?.user || null;

      if (!user) {
        const { data, error: signInError } =
          await supabase.auth.signInAnonymously();

        if (signInError) throw signInError;

        user = data?.user || null;
      }

      if (user) {
        window.TAMAVERSE_USER_ID = user.id;
      }

      return user;
    } catch (error) {
      console.warn('Supabase auth failed:', error);
      return null;
    }
  }

  async function savePlayerToSupabase() {
    if (!window.state || !supabase) return;

    const user = await ensureSupabaseUser();
    if (!user) return;

    try {
      const player = window.state.player || {};
      const items = window.state.items || {};

      const profilePayload = {
        id: user.id,
        display_name: player.name || 'Penjelajah',
        avatar: player.avatar || '🧙',
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
        coins: Number(player.coins || 0),
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

    try {
      const { data: profileData, error: profileError } =
        await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .maybeSingle();

      if (profileError) {
        console.warn('Load profile failed:', profileError);
      } else if (profileData) {
        window.state.player.name =
          profileData.display_name || window.state.player.name;
        window.state.player.avatar =
          profileData.avatar || window.state.player.avatar;
        window.state.player.level =
          Number(profileData.level || 1);
        window.state.player.xp =
          Number(profileData.xp || 0);
        window.state.player.rating =
          Number(profileData.rating || 1000);
        window.state.player.wins =
          Number(profileData.wins || 0);
        window.state.player.losses =
          Number(profileData.losses || 0);
        window.state.player.draws =
          Number(profileData.draws || 0);
        const telegramPhoto = window.Telegram?.WebApp?.initDataUnsafe?.user?.photo_url;
        if (telegramPhoto) window.state.player.avatar = telegramPhoto;
      }

      const { data: inventoryData, error: inventoryError } =
        await supabase
          .from('inventory')
          .select('*')
          .eq('owner_id', user.id)
          .maybeSingle();

      if (inventoryError) {
        console.warn('Load inventory failed:', inventoryError);
      } else if (inventoryData) {
        const player = window.state.player;
        window.state.items = window.state.items || {};

        player.coins = Number(
          inventoryData.coins ?? player.coins ?? 0
        );
        // Purchased Diamonds are server-credited and never included in client save payloads.
        player.diamonds = Number(
          inventoryData.diamonds ?? player.diamonds ?? 0
        );

        window.state.items.snack = Number(
          inventoryData.snack ?? window.state.items.snack ?? 0
        );
        window.state.items.energy = Number(
          inventoryData.energy ?? window.state.items.energy ?? 0
        );
        window.state.items.training = Number(
          inventoryData.training ?? window.state.items.training ?? 0
        );
        window.state.items.fragments =
          inventoryData.fragments || window.state.items.fragments || {};
      }

      const { data: dailyRewardData, error: dailyRewardError } = await supabase
        .from('daily_rewards')
        .select('last_claim_date, day')
        .eq('owner_id', user.id)
        .maybeSingle();
      if (dailyRewardError) {
        console.warn('Load daily rewards failed:', dailyRewardError);
      } else if (dailyRewardData) {
        const claimedDate = dailyRewardData.last_claim_date || '';
        window.state.dailyReward = {
          lastClaimDate: claimedDate,
          day: Number(dailyRewardData.day || 0)
        };
      }

      // Load premium ownership and consumable card balances from the protected table.
      const { data: premiumData, error: premiumError } = await supabase
        .from('premium_inventory')
        .select('rename_card_count, rename_pet_card_count, owned_frames')
        .eq('owner_id', user.id)
        .maybeSingle();
      if (premiumError) {
        console.warn('Load premium inventory failed:', premiumError);
      } else if (premiumData) {
        window.TAMAVERSE_PREMIUM_INVENTORY = {
          rename_card_count: Number(premiumData.rename_card_count || 0),
          rename_pet_card_count: Number(premiumData.rename_pet_card_count || 0),
          owned_frames: Array.isArray(premiumData.owned_frames) ? premiumData.owned_frames : ['common']
        };
      }

      // Refresh cloud pet XP/levels after authoritative online battle rewards.
      const { data: cloudPets, error: petsLoadError } = await supabase
        .from('pets')
        .select('client_uid, species, nickname, level, xp, is_active')
        .eq('owner_id', user.id);

      if (petsLoadError) {
        console.warn('Load pets failed:', petsLoadError);
      } else if (Array.isArray(cloudPets) && cloudPets.length) {
        const localPets = Array.isArray(window.state.pets) ? window.state.pets : [];
        cloudPets.forEach((cloudPet) => {
          const localPet = localPets.find((pet) => String(pet.uid) === String(cloudPet.client_uid));
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
          if (cloudPet.is_active) window.state.activePet = localPet.uid;
        });
      }
    } catch (error) {
      console.warn('Supabase load failed:', error);
    }

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

  // Load the account and cloud data once the page has loaded.
  window.addEventListener('load', () => {
    loadPlayerFromSupabase().catch((error) => {
      console.warn('Supabase initial load failed:', error);
    });
  });
})();
