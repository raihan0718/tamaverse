(() => {
  const supabaseUrl = window.TAMAVERSE_SUPABASE?.url || '';
  const supabaseKey = window.TAMAVERSE_SUPABASE?.anonKey || '';

  if (!supabaseUrl || !supabaseKey || !window.supabase) {
    console.info('Supabase client is not configured for TAMAVERSE.');
    return;
  }

  const supabase = window.supabase.createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });

  window.TAMAVERSE_SUPABASE_CLIENT = supabase;

  async function ensureSupabaseUser() {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) {
        console.warn('Supabase session error:', error);
        return null;
      }

      if (session?.user) {
        return session.user;
      }

      const { data, error: signInError } = await supabase.auth.signInAnonymously();
      if (signInError) {
        console.warn('Supabase anonymous sign-in failed:', signInError);
        return null;
      }

      return data?.user || null;
    } catch (error) {
      console.warn('Supabase auth failed:', error);
      return null;
    }
  }

  async function savePlayerToSupabase() {
    if (!window.state || !supabase) {
      return;
    }

    const user = await ensureSupabaseUser();
    if (!user) {
      return;
    }

    try {
      const profilePayload = {
        id: user.id,
        display_name: window.state.player?.name || 'Penjelajah',
        avatar: window.state.player?.avatar || '🧙',
        level: Number(window.state.player?.level || 1),
        xp: Number(window.state.player?.xp || 0),
        rating: Number(window.state.player?.rating || 1000),
        wins: Number(window.state.player?.wins || 0),
        losses: Number(window.state.player?.losses || 0),
        draws: Number(window.state.player?.draws || 0),
      };

      const { error: profileError } = await supabase
        .from('profiles')
        .upsert(profilePayload, { onConflict: 'id' });

      if (profileError) {
        console.warn('Save profile failed:', profileError);
      }

      const inventoryPayload = {
        owner_id: user.id,
        coins: Number(window.state.player?.coins || 0),
        gems: Number(window.state.player?.gems || 0),
        snack: Number((window.state.items && window.state.items.snack) || 0),
        energy: Number((window.state.items && window.state.items.energy) || 0),
        training: Number((window.state.items && window.state.items.training) || 0),
        fragments: (window.state.items && window.state.items.fragments) || {},
      };

      const { error: inventoryError } = await supabase
        .from('inventory')
        .upsert(inventoryPayload, { onConflict: 'owner_id' });

      if (inventoryError) {
        console.warn('Save inventory failed:', inventoryError);
      }
    } catch (error) {
      console.warn('Supabase save failed:', error);
    }
  }

  async function loadPlayerFromSupabase() {
    if (!window.state || !supabase) {
      return;
    }

    const user = await ensureSupabaseUser();
    if (!user) {
      return;
    }

    try {
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (!profileError && profileData) {
        window.state.player.name = profileData.display_name || window.state.player.name;
        window.state.player.avatar = profileData.avatar || window.state.player.avatar;
        window.state.player.level = Number(profileData.level || 1);
        window.state.player.xp = Number(profileData.xp || 0);
        window.state.player.rating = Number(profileData.rating || 1000);
        window.state.player.wins = Number(profileData.wins || 0);
        window.state.player.losses = Number(profileData.losses || 0);
        window.state.player.draws = Number(profileData.draws || 0);
      }

      const { data: inventoryData, error: inventoryError } = await supabase
        .from('inventory')
        .select('*')
        .eq('owner_id', user.id)
        .maybeSingle();

      if (!inventoryError && inventoryData) {
        window.state.player.coins = Number(inventoryData.coins || window.state.player.coins || 0);
        window.state.player.gems = Number(inventoryData.gems || window.state.player.gems || 0);
        window.state.items = window.state.items || {};
        window.state.items.snack = Number(inventoryData.snack || window.state.items.snack || 0);
        window.state.items.energy = Number(inventoryData.energy || window.state.items.energy || 0);
        window.state.items.training = Number(inventoryData.training || window.state.items.training || 0);
        window.state.items.fragments = inventoryData.fragments || window.state.items.fragments || {};
      }
    } catch (error) {
      console.warn('Supabase load failed:', error);
    }
  }

  const originalSave = typeof window.save === 'function' ? window.save : null;
  if (originalSave) {
    window.save = function() {
      try {
        originalSave.call(window);
      } finally {
        savePlayerToSupabase().catch((error) => {
          console.warn('Cloud save failed:', error);
        });
      }
    };
  }

  const originalRender = typeof window.render === 'function' ? window.render : null;
  if (originalRender) {
    window.render = function() {
      if (!window.__tamaverseSupabaseLoaded) {
        window.__tamaverseSupabaseLoaded = true;
        loadPlayerFromSupabase().catch((error) => {
          console.warn('Cloud load failed:', error);
        });
      }

      return originalRender.apply(this, arguments);
    };
  }

  window.addEventListener('load', () => {
    loadPlayerFromSupabase().catch((error) => {
      console.warn('Supabase initial load failed:', error);
    });
  });
})();
