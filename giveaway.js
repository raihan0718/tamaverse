(() => {
  'use strict';
  const ADMIN_TELEGRAM_ID = '8906658395';
  const db = () => window.TAMAVERSE_SUPABASE_CLIENT;
  const isAdmin = () => String(window.TAMAVERSE_TELEGRAM_ID || window.Telegram?.WebApp?.initDataUnsafe?.user?.id || '') === ADMIN_TELEGRAM_ID;
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const format = value => Number(value || 0).toLocaleString('id-ID');
  const itemNames = {food:'Apple',energy:'Energy Potion',snack:'Health Potion',training:'Training Manual',rename_card:'Rename Card',rename_pet_card:'Rename Pet Card',frame_legendary:'Royal Frame',frame_celestial:'Celestial Frame'};
  const dbCall = async (name,args={}) => {
    if (!db() || !window.TAMAVERSE_USER_ID || typeof window.ensureTamaverseAuth !== 'function') throw new Error('Akun Telegram belum siap. Muat ulang Tamaverse dari Telegram.');
    await window.ensureTamaverseAuth();
    const {data,error}=await db().rpc(name,args);
    if(error) throw error;
    return data;
  };
  const notify = message => typeof window.showToast==='function' ? window.showToast(message) : alert(message);
  const getShareUrl = code => {const url=new URL(window.location.href);url.searchParams.set('giveaway',code);url.hash='';return url.toString();};
  const rewardLabel = row => row.reward_type==='diamonds' ? format(row.diamonds)+' 💎 / pemain' : format(row.item_quantity)+' × '+(itemNames[row.item_key]||row.item_key);
  const expiryDefault = () => {const d=new Date(Date.now()+7*86400000);d.setMinutes(d.getMinutes()-d.getTimezoneOffset());return d.toISOString().slice(0,16);};

  function panelMarkup(){
    return `
      <section id="tamaverseGiveawayAdmin" class="card" style="margin-top:18px;padding:18px">
        <div class="eyebrow">TAMAVERSE ADMIN</div><h2 style="margin:4px 0 8px">🎁 Giveaway Manager</h2>
        <p class="subtle">Buat link Diamond atau item. Satu akun hanya bisa klaim sekali; kuota dan kedaluwarsa bisa diatur.</p>
        <form id="tamaverseGiveawayForm" style="display:grid;gap:10px;margin-top:14px">
          <label class="muted-label" for="giveawayTitle">NAMA GIVEAWAY</label>
          <input class="text-input" id="giveawayTitle" maxlength="80" value="Tamaverse Giveaway" required>
          <label class="muted-label" for="giveawayRewardType">JENIS HADIAH</label>
          <select class="text-input" id="giveawayRewardType"><option value="diamonds">💎 Diamonds</option><option value="item">🎒 Item</option></select>
          <div id="giveawayDiamondFields"><label class="muted-label" for="giveawayDiamonds">DIAMOND PER PEMAIN</label><input class="text-input" id="giveawayDiamonds" type="number" min="1" max="100000" step="1" value="10"></div>
          <div id="giveawayItemFields" hidden>
            <label class="muted-label" for="giveawayItemKey">PILIH ITEM</label>
            <select class="text-input" id="giveawayItemKey">
              <option value="food">Apple</option><option value="energy">Energy Potion</option><option value="snack">Health Potion</option><option value="training">Training Manual</option><option value="rename_card">Rename Card</option><option value="rename_pet_card">Rename Pet Card</option><option value="frame_legendary">Royal Frame</option><option value="frame_celestial">Celestial Frame</option>
            </select>
            <label class="muted-label" for="giveawayItemQuantity">JUMLAH ITEM PER PEMAIN</label><input class="text-input" id="giveawayItemQuantity" type="number" min="1" max="10000" step="1" value="1">
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
            <div><label class="muted-label" for="giveawayLimit">KUOTA PEMAIN</label><input class="text-input" id="giveawayLimit" type="number" min="1" max="1000000" step="1" value="20" required></div>
            <div><label class="muted-label" for="giveawayExpiry">KEDALUWARSA</label><input class="text-input" id="giveawayExpiry" type="datetime-local" value="${expiryDefault()}" required></div>
          </div>
          <button class="button full" id="giveawayCreateButton" type="submit">Buat Link Giveaway</button>
        </form>
        <div id="tamaverseGiveawayCreated" hidden style="margin-top:14px"></div>
        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:20px"><h3 style="margin:0">Riwayat Giveaway</h3><button class="button secondary" type="button" data-giveaway-action="refresh">Refresh</button></div>
        <div id="tamaverseGiveawayList" style="display:grid;gap:10px;margin-top:10px"><p class="subtle">Memuat giveaway...</p></div>
      </section>`;
  }

  async function loadGiveaways(){
    const host=document.getElementById('tamaverseGiveawayList');if(!host)return;
    host.innerHTML='<p class="subtle">Memuat giveaway...</p>';
    try{
      const rows=await dbCall('tamaverse_list_giveaways');
      if(!Array.isArray(rows)||!rows.length){host.innerHTML='<p class="subtle">Belum ada giveaway.</p>';return;}
      host.innerHTML=rows.map(row=>{
        const url=getShareUrl(row.code),expired=new Date(row.expires_at).toLocaleString('id-ID');
        const status=!row.is_active?'Dibatalkan':new Date(row.expires_at)<=new Date()?'Kedaluwarsa':row.claimed_count>=row.quota?'Kuota habis':'Aktif';
        return `<article class="card" style="padding:12px">
          <div style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start"><div><b>${escapeHtml(row.title)}</b><div class="subtle" style="font-size:12px;margin-top:3px">${escapeHtml(rewardLabel(row))} · ${format(row.claimed_count)} / ${format(row.quota)} klaim</div></div><span class="pill">${status}</span></div>
          <div class="subtle" style="font-size:12px;margin:7px 0">Berlaku sampai: ${escapeHtml(expired)}</div>
          <div style="font-size:12px;overflow-wrap:anywhere;padding:8px;border-radius:10px;background:rgba(150,120,180,.09)">${escapeHtml(url)}</div>
          <div style="display:flex;gap:8px;margin-top:9px;flex-wrap:wrap"><button class="button secondary" type="button" data-giveaway-action="copy" data-url="${escapeHtml(url)}">Salin Link</button>${row.is_active?'<button class="button danger" type="button" data-giveaway-action="deactivate" data-id="'+escapeHtml(row.id)+'">Nonaktifkan</button>':''}</div>
        </article>`;
      }).join('');
    }catch(error){host.innerHTML='<p class="subtle">Gagal memuat: '+escapeHtml(error.message||error)+'</p>';}
  }

  function mountAdminPanel(){
    if(!isAdmin()||!document.querySelector('.profile-page')||document.getElementById('tamaverseGiveawayAdmin'))return;
    const profile=document.querySelector('.profile-page'),wrap=document.createElement('div');wrap.innerHTML=panelMarkup();
    profile.insertBefore(wrap.firstElementChild,profile.querySelector('.profile-reset-button')||null);
    loadGiveaways();
  }
  function mountClaimPanel(code){
    if(!code||document.getElementById('tamaverseGiveawayClaim'))return;
    const root=document.getElementById('mainContent');if(!root)return;
    const panel=document.createElement('section');panel.id='tamaverseGiveawayClaim';panel.className='card';
    panel.style.cssText='margin:12px 16px;padding:18px;border:1px solid rgba(170,130,210,.35)';
    panel.innerHTML='<div class="eyebrow">TAMAVERSE · COMMUNITY GIFT</div><h2 style="margin:5px 0">🎁 Giveaway</h2><p class="subtle" id="tamaverseGiveawayDescription">Memeriksa hadiah...</p><button class="button full" type="button" data-giveaway-action="claim" data-code="'+escapeHtml(code)+'" disabled>Memuat hadiah...</button><p class="subtle" id="tamaverseGiveawayClaimStatus" style="margin-top:8px"></p>';
    root.prepend(panel);
    loadClaimPreview(code);
  }
  async function loadClaimPreview(code){
    const panel=document.getElementById('tamaverseGiveawayClaim');if(!panel)return;
    const button=panel.querySelector('[data-giveaway-action="claim"]'),desc=document.getElementById('tamaverseGiveawayDescription');
    try{
      const row=await dbCall('tamaverse_get_giveaway',{p_code:code});
      desc.textContent=row.title+' · '+rewardLabel(row)+' · '+format(row.claimed_count)+'/'+format(row.quota)+' klaim';
      if(!row.is_active||row.expired||row.sold_out){button.textContent=row.sold_out?'Kuota giveaway habis':row.expired?'Giveaway kedaluwarsa':'Giveaway nonaktif';return;}
      button.disabled=false;button.textContent='Klaim Hadiah';
    }catch(error){desc.textContent='Tidak dapat memuat hadiah. '+(error.message||'');button.textContent='Coba muat ulang';button.disabled=false;}
  }
  async function refreshInventory(){
    const client=db();if(!client||!window.TAMAVERSE_USER_ID)return;
    const owner=window.TAMAVERSE_USER_ID;
    const [inv,prem]=await Promise.all([
      client.from('inventory').select('*').eq('owner_id',owner).maybeSingle(),
      client.from('premium_inventory').select('rename_card_count,rename_pet_card_count,owned_frames').eq('owner_id',owner).maybeSingle()
    ]);
    if(inv.error)throw inv.error;
    if(inv.data){
      window.state=window.state||{};
      window.state.items=window.state.items||{};
      window.state.player=window.state.player||{};
      window.state.player.coins=Number(inv.data.coins??window.state.player.coins??0);
      window.state.player.diamonds=Number(inv.data.diamonds??window.state.player.diamonds??0);
      for(const key of ['food','snack','energy','training'])window.state.items[key]=Number(inv.data[key]??window.state.items[key]??0);
    }
    if(prem.error)throw prem.error;
    if(prem.data)window.TAMAVERSE_PREMIUM_INVENTORY={rename_card_count:Number(prem.data.rename_card_count||0),rename_pet_card_count:Number(prem.data.rename_pet_card_count||0),owned_frames:prem.data.owned_frames||['common']};
    window.save?.();window.render?.();
  }
  async function claim(code,button){
    const status=document.getElementById('tamaverseGiveawayClaimStatus');button.disabled=true;button.textContent='Memproses klaim...';
    try{
      const result=await dbCall('tamaverse_claim_giveaway',{p_code:code});
      await refreshInventory();
      const panel=document.getElementById('tamaverseGiveawayClaim');
      if(panel)panel.innerHTML='<div class="eyebrow">GIVEAWAY BERHASIL</div><h2>🎉 Hadiah diterima!</h2><p>'+escapeHtml(result.reward_type==='diamonds'?format(result.diamonds_received)+' 💎':format(result.item_quantity)+' × '+(itemNames[result.item_key]||result.item_key))+' sudah masuk ke inventory kamu.</p>';
    }catch(error){
      if(status)status.textContent=error.message||'Klaim gagal. Coba lagi.';
      button.disabled=false;button.textContent='Coba Klaim Lagi';
    }
  }

  document.addEventListener('change',event=>{
    if(event.target?.id!=='giveawayRewardType')return;
    const item=event.target.value==='item';
    document.getElementById('giveawayDiamondFields').hidden=item;
    document.getElementById('giveawayItemFields').hidden=!item;
  });
  document.addEventListener('submit',async event=>{
    if(event.target?.id!=='tamaverseGiveawayForm')return;
    event.preventDefault();
    const button=document.getElementById('giveawayCreateButton'),created=document.getElementById('tamaverseGiveawayCreated');
    const rewardType=document.getElementById('giveawayRewardType').value,title=document.getElementById('giveawayTitle').value.trim();
    const quota=Number(document.getElementById('giveawayLimit').value),expiry=new Date(document.getElementById('giveawayExpiry').value);
    if(!Number.isSafeInteger(quota)||quota<1||!Number.isFinite(expiry.getTime())||expiry.getTime()<=Date.now()){notify('Periksa kuota dan waktu kedaluwarsa.');return;}
    const diamonds=rewardType==='diamonds'?Number(document.getElementById('giveawayDiamonds').value):null;
    const itemKey=rewardType==='item'?document.getElementById('giveawayItemKey').value:null;
    const itemQuantity=rewardType==='item'?Number(document.getElementById('giveawayItemQuantity').value):null;
    if(rewardType==='diamonds'&&(!Number.isSafeInteger(diamonds)||diamonds<1||diamonds>100000)){notify('Jumlah Diamond tidak valid.');return;}
    if(rewardType==='item'&&(!Number.isSafeInteger(itemQuantity)||itemQuantity<1||itemQuantity>10000)){notify('Jumlah item tidak valid.');return;}
    button.disabled=true;button.textContent='Membuat giveaway...';
    try{
      const row=await dbCall('tamaverse_create_giveaway',{p_title:title,p_reward_type:rewardType,p_diamonds:diamonds,p_item_key:itemKey,p_item_quantity:itemQuantity,p_quota:quota,p_expires_at:expiry.toISOString()});
      const url=getShareUrl(row.code);created.hidden=false;
      created.innerHTML='<article class="card" style="padding:12px"><b>Link giveaway berhasil dibuat!</b><p class="subtle">'+escapeHtml(rewardLabel(row))+' × kuota '+format(row.quota)+'</p><input class="text-input" readonly value="'+escapeHtml(url)+'"><button class="button full" type="button" data-giveaway-action="copy" data-url="'+escapeHtml(url)+'" style="margin-top:8px">Salin Link untuk Dibagikan</button></article>';
      event.target.reset();document.getElementById('giveawayTitle').value='Tamaverse Giveaway';document.getElementById('giveawayExpiry').value=expiryDefault();
      await loadGiveaways();
    }catch(error){notify('Gagal membuat giveaway: '+(error.message||error));}
    finally{button.disabled=false;button.textContent='Buat Link Giveaway';}
  });
  document.addEventListener('click',async event=>{
    const button=event.target.closest('[data-giveaway-action]');if(!button)return;
    const action=button.dataset.giveawayAction;
    if(action==='copy'){
      const url=button.dataset.url||'';
      try{await navigator.clipboard.writeText(url);notify('Link giveaway berhasil disalin.');}
      catch(_){notify('Salin link ini secara manual: '+url);}
    }else if(action==='refresh')loadGiveaways();
    else if(action==='deactivate'){
      button.disabled=true;
      try{await dbCall('tamaverse_update_giveaway',{p_giveaway_id:button.dataset.id,p_quota:1000000,p_expires_at:new Date(Date.now()+365*86400000).toISOString(),p_is_active:false});await loadGiveaways();notify('Giveaway dinonaktifkan.');}
      catch(error){notify('Gagal menonaktifkan: '+(error.message||error));button.disabled=false;}
    }else if(action==='claim')await claim(button.dataset.code,button);
  });
  const observer=new MutationObserver(()=>mountAdminPanel());
  window.addEventListener('DOMContentLoaded',()=>{const root=document.getElementById('mainContent');if(root)observer.observe(root,{childList:true});mountAdminPanel();});
  window.addEventListener('load',async()=>{
    const code=new URLSearchParams(window.location.search).get('giveaway');if(!code)return;
    if(!/^[a-f0-9]{64}$/i.test(code))return;
    try{if(window.TAMAVERSE_AUTH_READY)await window.TAMAVERSE_AUTH_READY;mountClaimPanel(code.toLowerCase());}
    catch(_){mountClaimPanel(code.toLowerCase());const status=document.getElementById('tamaverseGiveawayClaimStatus');if(status)status.textContent='Login belum berhasil. Coba buka ulang link setelah akun terverifikasi.';}
  });
})();