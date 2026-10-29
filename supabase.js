
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
