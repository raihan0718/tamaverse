
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

      const { error: profileError } = await window.TAMAVERSE_SUPABASE_CLIENT
  .from('profiles')
        .upsert(profilePayload, { onConflict: 'id' });

      if (profileError) {
        console.warn('Save profile failed:', profileError);
      }

      const inventoryPayload = {
        owner_id: user.id,
        coins: Number(player.coins || 0),
        gems: Number(player.gems || 0),
        snack: Number(items.snack || 0),
        energy: Number(items.energy || 0),
        training: Number(items.training || 0),
        fragments: items.fragments || {},
      };

      const { error: inventoryError } = await window.TAMAVERSE_SUPABASE_CLIENT
  .from('inventory')
        .upsert(inventoryPayload, { onConflict: 'owner_id' });

      if (inventoryError) {
        console.warn('Save inventory failed:', inventoryError);
      }

      // Sync the local pet collection without deleting existing cloud rows.
      const pets = Array.isArray(window.state.pets) ? window.state.pets : [];

      if (pets.length > 0) {
        const { error: deactivateError } = await supabase
          .from('pets')
          .update({ is_active: false })
          .eq('owner_id', user.id);

        if (deactivateError) {
          console.warn('Deactivate previous active pet failed:', deactivateError);
        }

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
        player.gems = Number(
          inventoryData.gems ?? player.gems ?? 0
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
