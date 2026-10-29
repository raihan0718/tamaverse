'use strict';

// TAMAVERSE prototype: all progress is stored on this device only.
const SAVE_KEY = 'tamaverse_save_v1';
const species = [
  {id:'fluffin',name:'Fluffin',emoji:'🐰',element:'Nature',rarity:'Common',stats:{hp:95,atk:15,def:12,spd:16},pool:['basic','forest']},
  {id:'embercub',name:'Embercub',emoji:'🦊',element:'Fire',rarity:'Common',stats:{hp:88,atk:18,def:10,spd:17},pool:['basic','mystic']},
  {id:'bubblit',name:'Bubblit',emoji:'🐸',element:'Water',rarity:'Common',stats:{hp:105,atk:13,def:15,spd:12},pool:['basic','aqua']},
  {id:'mossling',name:'Mossling',emoji:'🦎',element:'Nature',rarity:'Common',stats:{hp:100,atk:14,def:16,spd:10},pool:['basic','forest','celestial']},
  {id:'voltkit',name:'Voltkit',emoji:'🐱',element:'Light',rarity:'Rare',stats:{hp:90,atk:20,def:11,spd:20},pool:['basic','aqua','mystic']},
  {id:'coralyn',name:'Coralyn',emoji:'🐠',element:'Water',rarity:'Rare',stats:{hp:110,atk:17,def:18,spd:12},pool:['forest','aqua']},
  {id:'cinderowl',name:'Cinderowl',emoji:'🦉',element:'Fire',rarity:'Rare',stats:{hp:96,atk:19,def:14,spd:16},pool:['basic','mystic']},
  {id:'petalyn',name:'Petalyn',emoji:'🦋',element:'Nature',rarity:'Rare',stats:{hp:92,atk:16,def:13,spd:21},pool:['forest','celestial']},
  {id:'lunabun',name:'Lunabun',emoji:'🐇',element:'Light',rarity:'Epic',stats:{hp:110,atk:20,def:17,spd:21},pool:['basic','forest','mystic','celestial']},
  {id:'glacipup',name:'Glacipup',emoji:'🐺',element:'Water',rarity:'Epic',stats:{hp:118,atk:22,def:18,spd:14},pool:['aqua','celestial']},
  {id:'starwhale',name:'Starwhale',emoji:'🐳',element:'Light',rarity:'Legendary',stats:{hp:128,atk:23,def:20,spd:17},pool:['basic','forest','aqua','celestial']},
  {id:'wyrmling',name:'Wyrmling',emoji:'🐉',element:'Fire',rarity:'Legendary',stats:{hp:116,atk:24,def:16,spd:22},pool:['mystic','celestial']}
];
const eggs = [
  {id:'basic',name:'Basic Egg',emoji:'🥚',price:100,gem:0,description:'Teman-teman pemula dari berbagai elemen.'},
  {id:'forest',name:'Forest Egg',emoji:'🌿',price:150,gem:0,description:'Makhluk mungil penghuni hutan ajaib.'},
  {id:'aqua',name:'Aqua Egg',emoji:'💧',price:2,gem:0,description:'Pet air yang tenang dan tangguh.',currency:'gem'},
  {id:'mystic',name:'Mystic Egg',emoji:'🔮',price:220,gem:0,description:'Energi misterius dengan peluang pet spesial.'},
  {id:'celestial',name:'Celestial Egg',emoji:'🌙',price:5,gem:0,description:'Telur langit berisi makhluk langka.',currency:'gem'}
];
const eggRates = {
  basic:{Common:60,Rare:25,Epic:12,Legendary:3},
  forest:{Common:50,Rare:30,Epic:16,Legendary:4},
  aqua:{Common:48,Rare:32,Epic:15,Legendary:5},
  mystic:{Common:42,Rare:30,Epic:20,Legendary:8},
  celestial:{Common:30,Rare:36,Epic:24,Legendary:10}
};
eggs.forEach(egg=>{egg.rates=eggRates[egg.id];});
const initialItems = {snack:3,energy:2,training:1};
let state = loadSave();

Object.defineProperty(window, 'state', {
  configurable: true,
  get: () => state,
  set: (value) => { state = value; }
});

let page = 'home';
let selectedPetId = null;
let battle = null;
let toastTimer;
let petAnimation = 'idle';
let petAnimationTimer;
let pullInProgress = false;

function save(){ if(state) { try { localStorage.setItem(SAVE_KEY,JSON.stringify(state)); } catch(e){ showToast('Penyimpanan penuh. Hapus sebagian data browser.'); } } }
function freshState(name){
  return {player:{id:'guest-'+Math.random().toString(36).slice(2,9),name:name||'Penjelajah',avatar:'🧙',level:1,xp:0,coins:300,gems:3,rating:1000,wins:0,losses:0,draws:0,streak:1,lastLogin:new Date().toDateString()},pets:[],activePet:null,items:{...initialItems,fragments:{}},gacha:{pityRare:0,pityEpic:0,lastFree:'',history:[]},quests:{date:new Date().toDateString(),progress:{feed:0,play:0,battle:0,win:0,egg:0},claimed:[]},careUses:{date:new Date().toDateString(),feed:0,play:0,train:0},dailyReward:{lastClaimDate:'',day:0},battleHistory:[],lastCareUpdate:Date.now(),createdAt:Date.now()};
}
function esc(value){return String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function petById(id){return state?.pets.find(p=>p.uid===id)||null;}
function activePet(){return petById(state?.activePet)||state?.pets[0]||null;}
function speciesById(id){return species.find(s=>s.id===id)||species[0];}
function showToast(message){const el=document.getElementById('toast');el.textContent=message;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),2300);}
function triggerPetAnimation(action){
  petAnimation=action;
  clearTimeout(petAnimationTimer);
  const stage=document.querySelector('.pet-stage');
  if(stage){stage.className=stage.className.replace(/pet-action-[\w-]+/g,'').trim();stage.classList.add(`pet-action-${action}`);}
  const bubble=document.querySelector('.action-bubble');
  if(bubble)bubble.textContent=petActionLabel(action);
  petAnimationTimer=setTimeout(()=>{
    petAnimation='idle';
    const currentStage=document.querySelector('.pet-stage');
    if(currentStage){currentStage.className=currentStage.className.replace(/pet-action-[\\w-]+/g,'').trim();currentStage.classList.add('pet-action-idle');}
    const currentBubble=document.querySelector('.action-bubble');
    if(currentBubble)currentBubble.textContent='';
  },1800);
}
function showModal(html){document.getElementById('modalCard').innerHTML=html;document.getElementById('modalBackdrop').classList.remove('hidden');}
function closeModal(){document.getElementById('modalBackdrop').classList.add('hidden');}
function updateWallet(){document.getElementById('coinBalance').textContent=state?state.player.coins:0;document.getElementById('gemBalance').textContent=state?state.player.gems:0;}
function applyTheme(){let dark=false;try{dark=localStorage.getItem('tamaverse_theme')==='dark';}catch(e){}document.body.dataset.theme=dark?'dark':'light';const button=document.querySelector('.theme-toggle');if(button){button.textContent=dark?'☀':'☾';button.setAttribute('aria-label',dark?'Gunakan tema terang':'Gunakan tema gelap');}}
function render(){
  updateWallet(); document.querySelectorAll('.nav-item').forEach(b=>b.classList.toggle('active',b.dataset.page===page));
  const root=document.getElementById('mainContent');
  if(!state){root.innerHTML=welcomePage();return;}
  dailyReset();
  const pages={home:homePage,pets:petsPage,gacha:gachaPage,battle:battlePage,ranking:rankingPage,profile:profilePage};
  root.innerHTML=(pages[page]||homePage)(); save();
}
function welcomePage(){return `<section class="page welcome"><div class="eyebrow">PETUALANGAN BARU DIMULAI</div><div class="welcome-art">🥚✨</div><h1>Selamat datang di<br>TAMAVERSE</h1><p class="subtle">Rawat dan latih teman ajaibmu, buka telur dengan koin atau gem, lalu bawa petmu ke battle untuk mendapat XP dan hadiah.</p><div class="card"><p>🎁 <b>Hadiah awal:</b> 1 telur gratis + 300 koin + 3 gem</p><button class="button full" data-action="start">Mulai petualangan</button></div><p class="muted-label">Progres tersimpan di perangkat ini · Guest lokal</p></section>`;}
function petActionLabel(action){return ({eat:'Yum! 🍓',play:'Having fun! ✨',bath:'Splash! 🫧',sleep:'Zzz... 🌙',train:'Go! 💪',greet:'Hello! ♥',idle:''})[action]||'';}
function emptyPets(){return `<div class="card empty"><div style="font-size:42px">🥚</div><p>Belum ada pet. Tetaskan telur pertamamu untuk memulai!</p><button class="button" data-action="start">Tetaskan telur gratis</button></div>`;}
function petsPage(){const owned=new Set(state.pets.map(p=>p.species));return `<section class="page"><div class="eyebrow">KOLEKSI PET</div><h1 class="page-title">Teman-temanmu</h1><p class="subtle">${owned.size}/12 spesies terkumpul · Pilih pet untuk melihat detail atau menjadikannya aktif.</p>${state.pets.length?`<div class="collection-grid">${state.pets.map(p=>petCard(p,true)).join('')}</div>`:''}<div class="section-heading"><h2>Belum ditemukan</h2></div><div class="collection-grid">${species.filter(s=>!owned.has(s.id)).map(s=>`<article class="creature-card locked"><div class="creature-thumb">❔</div><h3>???</h3><p>${s.element} · <span class="rarity rarity-${s.rarity}">${s.rarity}</span></p></article>`).join('')}</div></section>`;}
function petCard(p,owned){const s=speciesById(p.species);return `<button class="creature-card ${owned?'owned':''}" data-action="inspect" data-pet="${p.uid}"><div class="creature-thumb">${s.emoji}</div><h3>${esc(p.name)} ${p.uid===state.activePet?'⭐':''}</h3><p>Lv.${p.level} · ${s.element}<br><span class="rarity rarity-${s.rarity}">${s.rarity}</span></p></button>`;}
function gachaPage(){return `<section class="page"><div class="eyebrow">TEMUKAN TEMAN BARU</div><h1 class="page-title">Telur ajaib</h1><p class="subtle">Tarif dasar: Common 60% · Rare 25% · Epic 12% · Legendary 3%. Pity Rare pada 10 pull, Epic pada 50 pull.</p><div class="notice">🎁 Gratis 1 Basic Egg setiap hari. Semua hadiah menggunakan mata uang dalam game—tanpa pembayaran asli.</div><div class="collection-grid">${eggs.map(e=>`<article class="card egg-card"><span class="egg-icon">${e.emoji}</span><h3>${e.name}</h3><p class="subtle">${e.description}</p><p class="muted-label">${e.currency==='gem'?`💎 ${e.price} gem`:`🪙 ${e.price} koin`}</p><button class="button full" data-action="pull" data-egg="${e.id}">Buka 1 telur</button></article>`).join('')}</div><div class="card" style="margin-top:12px"><div class="section-heading" style="margin-top:0"><h2>Hadiah gratis harian</h2></div><button class="button secondary full" data-action="freeegg">${state.gacha.lastFree===new Date().toDateString()?'Sudah diklaim hari ini':'Klaim Basic Egg gratis'}</button><div class="section-heading"><h2>Progress pity</h2></div><p class="subtle">Rare+: ${state.gacha.pityRare}/10 · Epic+: ${state.gacha.pityEpic}/50</p><div class="section-heading"><h2>Riwayat tarikan</h2></div>${state.gacha.history.length?state.gacha.history.slice(0,5).map(h=>`<p class="subtle">${h.emoji} ${esc(h.name)} · <span class="rarity rarity-${h.rarity}">${h.rarity}</span></p>`).join(''):'<p class="subtle">Tarikanmu akan muncul di sini.</p>'}</div></section>`;}
function battlePage(){if(battle)return battleView();return `<section class="page"><div class="eyebrow">ARENA TAMAVERSE</div><h1 class="page-title">Battle</h1><p class="subtle">Latih petmu dalam pertarungan turn-based melawan lawan simulasi.</p><div class="card"><div style="font-size:42px;text-align:center;margin:8px">⚔️</div><h2 style="text-align:center">Practice Battle</h2><p class="subtle" style="text-align:center">Lawan AI lokal · Hadiah: 35 koin + XP saat menang</p><button class="button full" data-action="battle-start" data-mode="practice">Mulai latihan</button></div><div class="card" style="margin-top:12px"><h2>Simulated PvP</h2><p class="subtle">Mode demonstrasi melawan lawan sampel. Belum terhubung ke pemain sungguhan atau matchmaking online.</p><button class="button secondary full" data-action="battle-start" data-mode="simulated">Tantang lawan demo</button></div>${state.battleHistory.length?`<div class="section-heading"><h2>Battle terakhir</h2></div>${state.battleHistory.slice(0,4).map(b=>`<div class="card" style="margin:7px 0"><span>${b.result==='win'?'🏆':b.result==='draw'?'🤝':'💫'} ${b.result==='win'?'Menang':b.result==='draw'?'Seri':'Kalah'}</span><span style="float:right" class="muted-label">${new Date(b.date).toLocaleDateString('id-ID')}</span></div>`).join('')}`:''}<div class="notice">🛡️ Pertarungan dan rating tersimpan lokal. Hasil ini bukan ranking kompetitif online.</div></section>`;}
function battleView(){const p=petById(battle.petId),ps=speciesById(p.species),os=speciesById(battle.opponent.species);const fx=battle.actionFx||'idle';return `<section class="page"><div class="eyebrow">${battle.mode==='simulated'?'SIMULATED PVP · DEMO':'PRACTICE BATTLE'}</div><h1 class="page-title">Arena</h1><div class="battle-scene battle-fx-${fx}" aria-label="Arena pertarungan"><div class="arena-sky"><span class="arena-moon">✦</span><span class="arena-cloud cloud-one">☁</span><span class="arena-cloud cloud-two">☁</span><span class="arena-light light-one"></span><span class="arena-light light-two"></span></div><div class="arena-banner"><span>✨ TAMAVERSE ARENA ✨</span><b>TURN ${battle.turn}</b></div><div class="arena-platform platform-player"></div><div class="arena-platform platform-enemy"></div><div class="battle-side battle-player"><div class="battle-nameplate"><b>${esc(p.name)}</b><span>Lv.${p.level} · ${ps.element}</span></div><div class="battle-sprite">${ps.emoji}</div><span class="battle-effect effect-player">${fx==='skill'?'✨':''}</span><span class="battle-impact impact-player">${fx==='skill'?'SKILL!':''}</span><div class="battle-hp-card"><div class="hp-label"><b>YOUR PET</b><span>${Math.max(0,battle.playerHP)} / ${p.stats.hp} HP</span></div><div class="progress-track"><div class="progress-fill" style="width:${Math.max(0,battle.playerHP/p.stats.hp*100)}%"></div></div></div></div><div class="arena-vs">VS</div><div class="battle-side battle-enemy"><div class="battle-nameplate"><b>${esc(battle.opponent.name)}</b><span>Lv.${battle.opponent.level} · ${os.element}</span></div><div class="battle-sprite">${os.emoji}</div><span class="battle-effect effect-enemy">${fx==='skill'?'💥':''}</span><span class="battle-impact impact-enemy">${fx==='skill'?'HIT!':''}</span><div class="battle-hp-card"><div class="hp-label"><b>OPPONENT</b><span>${Math.max(0,battle.enemyHP)} / ${battle.opponent.stats.hp} HP</span></div><div class="progress-track"><div class="progress-fill enemy-hp" style="width:${Math.max(0,battle.enemyHP/battle.opponent.stats.hp*100)}%"></div></div></div></div></div><div class="section-heading"><h2>Aksimu</h2></div><div class="button-row"><button class="button" data-action="battle-action" data-move="attack">⚔️ Attack</button><button class="button soft" data-action="battle-action" data-move="skill" ${battle.skillUsed?'disabled':''}>✨ Skill</button><button class="button secondary" data-action="battle-action" data-move="defend">🛡️ Defend</button><button class="button secondary" data-action="battle-action" data-move="item" ${state.items.snack<1?'disabled':''}>🍓 Item (${state.items.snack})</button></div><p class="muted-label">Skill sekali per battle · Maksimum 30 giliran</p><div class="section-heading"><h2>Battle log</h2><span class="pill">Giliran ${battle.turn}</span></div><div class="battle-log" id="battleLog">${battle.log.slice(-7).map(x=>`<div>• ${esc(x)}</div>`).join('')}</div></section>`;}
function rankingPage(){const demo=[{name:'LunaStar',avatar:'🌙',level:18,rating:1840,wins:45,losses:8},{name:'MochiPop',avatar:'🍡',level:15,rating:1620,wins:32,losses:11},{name:'RinBloom',avatar:'🌸',level:13,rating:1490,wins:28,losses:14}];const me={name:state.player.name,avatar:state.player.avatar,level:state.player.level,rating:state.player.rating,wins:state.player.wins,losses:state.player.losses,me:true};const rows=[...demo,me].sort((a,b)=>b.rating-a.rating);return `<section class="page"><div class="eyebrow">PAPAN PERINGKAT</div><h1 class="page-title">Ranking</h1><div class="notice">📡 Data demo lokal—bukan leaderboard global sungguhan. Peringkat online memerlukan backend bersama.</div><div class="card"><div style="text-align:center;font-size:31px">🥇　🥈　🥉</div><div class="rank-row"><span>🏅</span><span>Rating Battle-mu</span><b>${state.player.rating}</b></div>${rows.map((r,i)=>`<div class="rank-row ${r.me?'rank-me':''}"><b>#${i+1}</b><span><span class="rank-avatar">${r.avatar}</span> ${esc(r.name)}${r.me?' (kamu)':''}<br><span class="muted-label">Lv.${r.level} · ${r.wins} menang / ${r.losses} kalah</span></span><b>${r.rating}</b></div>`).join('')}</div></section>`;}
function profilePage(){const p=activePet();return `<section class="page"><div class="eyebrow">AKUN LOKAL</div><h1 class="page-title">Profile & Tas</h1><div class="card profile-card"><div class="avatar">${state.player.avatar}</div><h2>${esc(state.player.name)}</h2><p>Guest · ID ${esc(state.player.id)}</p><div class="profile-stats"><div class="profile-stat"><strong>Lv. ${state.player.level}</strong><span>LEVEL PEMAIN</span></div><div class="profile-stat"><strong>${state.player.rating}</strong><span>RATING</span></div><div class="profile-stat"><strong>${state.player.wins}/${state.player.losses}/${state.player.draws}</strong><span>W/L/D</span></div><div class="profile-stat"><strong>${state.pets.length}/12</strong><span>KOLEKSI</span></div><div class="profile-stat"><strong>${state.player.streak} hari</strong><span>LOGIN STREAK</span></div><div class="profile-stat"><strong>${state.player.xp}/${state.player.level*100}</strong><span>PLAYER XP</span></div></div><button class="button secondary full" style="margin-top:13px" data-action="rename-player">✏️ Ubah nama</button></div><div class="section-heading"><h2>🎒 Inventori</h2></div><div class="card"><div class="rank-row"><span>🍓</span><span>Camilan<br><small class="muted-label">Memulihkan lapar saat battle</small></span><b>${state.items.snack}</b></div><div class="rank-row"><span>⚡</span><span>Ramuan energi<br><small class="muted-label">Pulihkan energi pet +30</small></span><b>${state.items.energy}</b></div><div class="rank-row"><span>🏋️</span><span>Buku latihan<br><small class="muted-label">Latihan ekstra untuk pet</small></span><b>${state.items.training}</b></div><div class="rank-row"><span>🧩</span><span>Fragmen spesies<br><small class="muted-label">Duplikat dari gacha</small></span><b>${Object.values(state.items.fragments).reduce((a,b)=>a+b,0)||0}</b></div><button class="button secondary full" data-action="shop">Buka toko item</button></div><div class="section-heading"><h2>🎯 Quest harian</h2></div>${questList()}<div class="notice">☁️ Save tersimpan hanya di browser/perangkat ini. Hapus data browser bisa menghapus progres.</div><button class="button danger full" data-action="reset">Reset semua data</button></section>`;}
const dailyRewards=[
  {icon:'🪙',label:'50 koin',type:'coins',amount:50},
  {icon:'🍓',label:'2 camilan',type:'snack',amount:2},
  {icon:'🪙',label:'80 koin',type:'coins',amount:80},
  {icon:'💎',label:'1 gem',type:'gems',amount:1},
  {icon:'⚡',label:'2 ramuan',type:'energy',amount:2},
  {icon:'🪙',label:'150 koin',type:'coins',amount:150},
  {icon:'🎁',label:'2 gem + 100 koin',type:'grand',amount:0}
];
function dailyRewardDay(){
  const reward=state.dailyReward||{lastClaimDate:'',day:0};
  const today=new Date().toDateString();
  if(reward.lastClaimDate===today)return reward.day||1;
  const yesterday=new Date(Date.now()-86400000).toDateString();
  return reward.lastClaimDate===yesterday?(reward.day%7)+1:1;
}
function dailyRewardCard(){
  const reward=state.dailyReward||{lastClaimDate:'',day:0};
  const claimed=reward.lastClaimDate===new Date().toDateString();
  const day=dailyRewardDay();
  return `<div class="card daily-reward-card"><div class="daily-reward-days">${dailyRewards.map((item,index)=>`<div class="daily-reward-day ${index+1===day?'today':''} ${claimed&&index+1===day?'claimed':''}"><span>${claimed&&index+1===day?'✓':item.icon}</span><small>Hari ${index+1}</small></div>`).join('')}</div><div class="daily-reward-footer"><div><b>${claimed?'Hadiah hari ini sudah diklaim':`Hadiah hari ${day}: ${dailyRewards[day-1].label}`}</b><p>${claimed?'Kembali besok untuk hadiah berikutnya.':'Klaim hadiah login hari ini!'}</p></div><button class="button" data-action="claim-daily" ${claimed?'disabled':''}>${claimed?'Diklaim':'Klaim'}</button></div></div>`;
}
function claimDailyReward(){
  const today=new Date().toDateString();
  if(!state.dailyReward)state.dailyReward={lastClaimDate:'',day:0};
  if(state.dailyReward.lastClaimDate===today){showToast('Hadiah hari ini sudah diklaim.');return;}
  const day=dailyRewardDay();
  const reward=dailyRewards[day-1];
  if(reward.type==='coins')state.player.coins+=reward.amount;
  else if(reward.type==='gems')state.player.gems+=reward.amount;
  else if(reward.type==='grand'){state.player.gems+=2;state.player.coins+=100;}
  else state.items[reward.type]=(state.items[reward.type]||0)+reward.amount;
  state.dailyReward={lastClaimDate:today,day};
  save();render();showToast(`Hadiah Hari ${day} diklaim: ${reward.label}!`);
}
function questPreview(){const q=questDefinitions().slice(0,2);return q.map(x=>questRow(x)).join('');}
function questDefinitions(){return [{id:'feed',title:'Beri makan pet',target:2,icon:'🍓',reward:35},{id:'play',title:'Bermain bersama',target:2,icon:'💖',reward:35},{id:'battle',title:'Selesaikan battle',target:1,icon:'⚔️',reward:50},{id:'win',title:'Menangkan battle',target:1,icon:'🏆',reward:60},{id:'egg',title:'Buka telur',target:1,icon:'🥚',reward:40}];}
function questList(){return questDefinitions().map(questRow).join('');}
function questRow(q){const progress=state.quests.progress[q.id]||0,done=progress>=q.target,claimed=state.quests.claimed.includes(q.id);return `<div class="card quest-row"><div><b>${q.icon} ${q.title}</b><p>${Math.min(progress,q.target)}/${q.target} · Hadiah 🪙 ${q.reward}</p></div><button class="button ${claimed?'secondary':''}" data-action="claim" data-quest="${q.id}" ${!done||claimed?'disabled':''}>${claimed?'Selesai':done?'Klaim':'Belum'}</button></div>`;}
function startIntro(){showModal(`<div class="hatch-egg">🥚</div><div class="eyebrow" style="text-align:center">TELUR GRATIS</div><h2 id="modalTitle" style="text-align:center">Ada yang bergerak...</h2><p style="text-align:center">Keajaiban pertamamu sedang menetas!</p>`);setTimeout(()=>{if(!document.getElementById('modalBackdrop').classList.contains('hidden'))showModal(`<div class="hatch-egg">✨🐰✨</div><div class="eyebrow">PET PERTAMAMU</div><h2 id="modalTitle">Fluffin menetas!</h2><p>Fluffin adalah teman Nature yang setia. Beri nama panggilan untuk petmu.</p><input class="text-input" id="starterName" maxlength="18" value="Fluffin" aria-label="Nama pet"><button class="button full" data-action="finish-intro">Ayo mulai!</button>`);},1100);}
function finishIntro(){const name=(document.getElementById('starterName')?.value||'Fluffin').trim().slice(0,18)||'Fluffin';state=freshState('Penjelajah');const pet=createPet('fluffin',name);state.pets.push(pet);state.activePet=pet.uid;closeModal();page='home';save();render();showToast('Selamat datang! 300 koin dan 3 gem sudah jadi milikmu.');}
function createPet(speciesId,name){const s=speciesById(speciesId);return {uid:'pet-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,5),species:s.id,name:name||s.name,level:1,xp:0,hp:s.stats.hp,stats:{...s.stats},hunger:75,happiness:75,energy:80,cleanliness:80,evolution:0,fragments:0};}
function addPet(speciesId){const s=speciesById(speciesId);const existing=state.pets.find(p=>p.species===speciesId);if(existing){state.items.fragments[speciesId]=(state.items.fragments[speciesId]||0)+1;state.player.coins+=20;return {duplicate:true,pet:existing,s};}const p=createPet(speciesId,s.name);state.pets.push(p);if(!state.activePet)state.activePet=p.uid;return {duplicate:false,pet:p,s};}
function grantPetXP(p,amount){p.xp+=amount;while(p.xp>=p.level*40){p.xp-=p.level*40;p.level++;p.stats.hp+=5;p.stats.atk+=1;p.stats.def+=1;showToast(`${p.name} naik ke Level ${p.level}!`);}}
function playerXP(amount){state.player.xp+=amount;while(state.player.xp>=state.player.level*100){state.player.xp-=state.player.level*100;state.player.level++;state.player.coins+=50;showToast(`Level pemain naik! Hadiah +50 koin.`);}}
function doCare(kind){const p=activePet();if(!p){showToast('Tetaskan pet lebih dulu!');return;}const dailyLimit={feed:5,play:5,train:4};if(dailyLimit[kind]&&state.careUses[kind]>=dailyLimit[kind]){showToast(`Batas ${kind==='feed'?'makan':kind==='play'?'bermain':'latihan'} harian tercapai.`);return;}if(kind==='feed'){if(p.hunger>=100){showToast(`${p.name} belum lapar.`);return;}triggerPetAnimation('eat');p.hunger=Math.min(100,p.hunger+25);state.careUses.feed++;grantPetXP(p,4);state.quests.progress.feed++;showToast(`${p.name} makan dengan lahap! +4 XP`);}else if(kind==='play'){if(p.energy<15){showToast('Energi pet terlalu rendah untuk bermain.');return;}if(p.happiness>=100){showToast(`${p.name} sudah sangat bahagia!`);return;}triggerPetAnimation('play');p.happiness=Math.min(100,p.happiness+22);p.energy=Math.max(0,p.energy-15);state.careUses.play++;grantPetXP(p,4);state.quests.progress.play++;showToast(`Waktu bermain yang menyenangkan! +4 XP`);}else if(kind==='clean'){if(p.cleanliness>=100){showToast(`${p.name} sudah bersih!`);return;}triggerPetAnimation('bath');p.cleanliness=100;showToast(`${p.name} jadi bersih dan segar!`);}else if(kind==='sleep'){if(p.energy>=100){showToast(`${p.name} sudah penuh energi.`);return;}triggerPetAnimation('sleep');p.energy=Math.min(100,p.energy+35);showToast(`${p.name} beristirahat. Energi +35.`);}else if(kind==='train'){if(p.energy<20){showToast('Energi minimal 20 untuk latihan.');return;}triggerPetAnimation('train');state.careUses.train++;if(state.items.training>0){state.items.training--;grantPetXP(p,14);p.energy-=20;p.evolution=Math.min(100,p.evolution+8);showToast('Latihan selesai! +14 XP dan progres evolusi.');}else{grantPetXP(p,6);p.energy-=20;p.evolution=Math.min(100,p.evolution+4);showToast('Latihan selesai! +6 XP.');}}save();render();}
function chooseRarity(){const r=Math.random()*100;return r<60?'Common':r<85?'Rare':r<97?'Epic':'Legendary';}
function pullEgg(id,free){const e=eggs.find(x=>x.id===id);if(!e)return;if(free&&state.gacha.lastFree===new Date().toDateString()){showToast('Telur gratis hari ini sudah diklaim.');return;}const currency=e.currency==='gem'?'gems':'coins';const cost=free?0:e.price;if(state.player[currency]<cost){showToast(`Koin/gem tidak cukup untuk ${e.name}.`);return;}if(!free)state.player[currency]-=cost;else state.gacha.lastFree=new Date().toDateString();
  const pool=species.filter(s=>s.pool.includes(id));let rarity=chooseRarity();if(state.gacha.pityRare>=9&&['Common'].includes(rarity))rarity='Rare';if(state.gacha.pityEpic>=49&&['Common','Rare'].includes(rarity))rarity='Epic';let candidates=pool.filter(s=>s.rarity===rarity);if(!candidates.length){const available=pool.filter(s=>s.rarity==='Common'||s.rarity==='Rare'||s.rarity==='Epic'||s.rarity==='Legendary');candidates=available;}const chosen=candidates[Math.floor(Math.random()*candidates.length)];state.gacha.pityRare=chosen.rarity==='Common'?state.gacha.pityRare+1:0;state.gacha.pityEpic=['Common','Rare'].includes(chosen.rarity)?state.gacha.pityEpic+1:0;state.quests.progress.egg++;const result=addPet(chosen.id);state.gacha.history.unshift({name:chosen.name,emoji:chosen.emoji,rarity:chosen.rarity,date:Date.now()});state.gacha.history=state.gacha.history.slice(0,20);save();render();showModal(`<div class="hatch-egg">${chosen.emoji}✨</div><div class="eyebrow" style="text-align:center">TELUR MENETAS</div><h2 id="modalTitle" style="text-align:center">${result.duplicate?'Duplikat! Fragmen didapat':esc(chosen.name)}</h2><p style="text-align:center"><span class="rarity rarity-${chosen.rarity}">${chosen.rarity}</span> · ${chosen.element}<br>${result.duplicate?'+1 fragmen spesies dan 20 koin':'Teman baru masuk koleksimu!'}</p><div class="stats-row"><div class="stat-tile"><strong>${chosen.stats.hp}</strong><span>HP</span></div><div class="stat-tile"><strong>${chosen.stats.atk}</strong><span>ATK</span></div><div class="stat-tile"><strong>${chosen.stats.def}</strong><span>DEF</span></div></div><button class="button full" style="margin-top:14px" data-action="close-modal">Keren!</button>`);}
function buyItem(type){const shop={snack:{name:'Camilan',price:25},energy:{name:'Ramuan energi',price:40},training:{name:'Buku latihan',price:60}};const item=shop[type];if(!item)return;if(state.player.coins<item.price){showToast('Koin tidak cukup.');return;}state.player.coins-=item.price;state.items[type]++;save();closeModal();render();showToast(`${item.name} dibeli!`);}
function startBattle(mode){const p=activePet();if(!p){showToast('Kamu belum punya pet!');return;}if(battle)return;const pool=species.filter(s=>s.id!==p.species);const os=pool[Math.floor(Math.random()*pool.length)];const opponent={...os,level:Math.max(1,p.level),name:mode==='simulated'?['PixelPaw','StarMochi','DemoRanger'][Math.floor(Math.random()*3)]:`${os.name} liar`,stats:{...os.stats,hp:Math.round(os.stats.hp*(0.8+p.level*.08)),atk:os.stats.atk+p.level-1}};battle={mode,petId:p.uid,opponent,playerHP:p.stats.hp,enemyHP:opponent.stats.hp,turn:1,skillUsed:false,defending:false,log:[`${p.name} memasuki arena!`,`Lawan ${opponent.name} muncul!`],ended:false};render();}
function elementMultiplier(a,b){const strong={Fire:'Nature',Nature:'Water',Water:'Fire',Light:'Fire'};if(strong[a]===b)return 1.25;if(strong[b]===a)return .8;return 1;}
function battleAction(move){if(!battle||battle.ended)return;if(move==='skill'&&battle.skillUsed){showToast('Skill sudah digunakan pada battle ini.');return;}const p=petById(battle.petId);if(!p)return;const ps=speciesById(p.species),os=speciesById(battle.opponent.species);battle.actionFx=move;let log=battle.log;let damage=0;if(move==='attack'||move==='skill'){damage=Math.max(4,Math.round((p.stats.atk+(move==='skill'?10:0)-battle.opponent.stats.def*.35)*(0.85+Math.random()*.3)*elementMultiplier(ps.element,os.element)));if(Math.random()<.1)damage=Math.round(damage*1.5);battle.enemyHP-=damage;log.push(`${p.name} ${move==='skill'?'menggunakan Skill':'menyerang'} dan memberi ${damage} damage!`);if(move==='skill')battle.skillUsed=true;}else if(move==='defend'){battle.defending=true;log.push(`${p.name} bersiap bertahan.`);}else if(move==='item'){if(state.items.snack<1){showToast('Camilan habis.');return;}state.items.snack--;battle.playerHP=Math.min(p.stats.hp,battle.playerHP+25);log.push(`${p.name} memakai camilan dan memulihkan HP!`);}
  if(battle.enemyHP<=0){finishBattle('win');return;}const incoming=Math.max(3,Math.round((battle.opponent.stats.atk-p.stats.def*.3)*(0.85+Math.random()*.3)*elementMultiplier(os.element,ps.element)*(battle.defending?.45:1)));battle.playerHP-=incoming;battle.defending=false;log.push(`${battle.opponent.name} menyerang, ${incoming} damage.`);battle.turn++;if(battle.playerHP<=0){finishBattle('loss');return;}if(battle.turn>30){finishBattle('draw');return;}battle.log=log.slice(-30);render();}
function finishBattle(result){if(!battle||battle.ended)return;battle.ended=true;const p=petById(battle.petId);if(result==='win'){state.player.wins++;state.player.rating+=battle.mode==='simulated'?12:5;state.player.coins+=35;playerXP(25);grantPetXP(p,20);state.quests.progress.win++;showToast('Menang! +35 koin, XP pet & pemain.');}else if(result==='loss'){state.player.losses++;state.player.rating=Math.max(0,state.player.rating-5);grantPetXP(p,8);showToast('Kalah, tapi pet mendapat pengalaman.');}else{state.player.draws++;showToast('Battle berakhir seri.');}state.quests.progress.battle++;state.battleHistory.unshift({result,date:Date.now(),mode:battle.mode});state.battleHistory=state.battleHistory.slice(0,20);save();battle=null;render();showModal(`<div class="hatch-egg">${result==='win'?'🏆':result==='draw'?'🤝':'💫'}</div><h2 id="modalTitle" style="text-align:center">${result==='win'?'Kemenangan!':result==='draw'?'Seri!':'Pertarungan selesai'}</h2><p style="text-align:center">${result==='win'?'Hebat! Petmu memperoleh hadiah battle.':result==='draw'?'Pertarungan berakhir imbang.':'Jangan menyerah, petmu tetap mendapat XP.'}</p><button class="button full" data-action="close-modal">Lanjut</button>`);}
function inspectPet(uid){const p=petById(uid);if(!p)return;const s=speciesById(p.species);selectedPetId=uid;showModal(`<div class="hatch-egg">${s.emoji}</div><div class="eyebrow">${s.element} · ${s.rarity}</div><h2 id="modalTitle">${esc(p.name)} · Lv.${p.level}</h2><p>${s.name} · Evolusi ${p.evolution}/100</p><div class="stats-row"><div class="stat-tile"><strong>${p.stats.hp}</strong><span>HP</span></div><div class="stat-tile"><strong>${p.stats.atk}</strong><span>ATK</span></div><div class="stat-tile"><strong>${p.stats.def}</strong><span>DEF</span></div></div><div class="modal-actions"><button class="button secondary" data-action="nickname-pet">Ubah nama</button><button class="button" data-action="set-active" data-pet="${uid}">${uid===state.activePet?'Pet aktif':'Pilih aktif'}</button></div>`);}
function showShop(){showModal(`<div class="eyebrow">TOKO LOKAL</div><h2 id="modalTitle">Perlengkapan pet</h2><p>Belanja memakai koin dalam game.</p>${[['snack','🍓 Camilan','25'],['energy','⚡ Ramuan energi','40'],['training','🏋️ Buku latihan','60']].map(x=>`<div class="quest-row"><span>${x[1]} · 🪙 ${x[2]}</span><button class="button" data-action="buy" data-item="${x[0]}">Beli</button></div>`).join('')}<button class="button secondary full" data-action="close-modal">Tutup</button>`);}
function doClaim(id){const q=questDefinitions().find(x=>x.id===id);if(!q||state.quests.claimed.includes(id)||(state.quests.progress[id]||0)<q.target)return;state.quests.claimed.push(id);state.player.coins+=q.reward;playerXP(10);save();render();showToast(`Quest selesai! +${q.reward} koin +10 XP pemain.`);}
function resetGame(){showModal(`<div class="eyebrow">KONFIRMASI</div><h2 id="modalTitle">Hapus semua progres?</h2><p>Data lokal, pet, dan koin akan dihapus dari perangkat ini. Tindakan ini tidak bisa dibatalkan.</p><div class="modal-actions"><button class="button secondary" data-action="close-modal">Batal</button><button class="button danger" data-action="confirm-reset">Hapus data</button></div>`);}

// Keep daily actions rewarding without allowing unlimited local XP or currency farming.
function loadSave(){
  try{
    const raw=localStorage.getItem(SAVE_KEY);
    if(!raw)return null;
    const saved=JSON.parse(raw);
    if(!saved||!saved.player||!Array.isArray(saved.pets))return null;
    return normalizeSavedState(saved);
  }catch(error){console.warn('Save tidak dapat dibaca:',error);return null;}
}
function normalizeSavedState(saved){
  const base=freshState(saved.player.name);
  const previousPlayer=saved.player;
  const toLocalDay=value=>{
    if(!value)return '';
    const date=new Date(value);
    return Number.isNaN(date.getTime())?String(value):date.toDateString();
  };
  base.player={...base.player,...previousPlayer,
    rating:Number.isFinite(previousPlayer.rating)?previousPlayer.rating:(previousPlayer.battleRating||1000),
    lastLogin:toLocalDay(previousPlayer.lastLogin||previousPlayer.lastLoginDate)
  };
  base.pets=saved.pets.map(oldPet=>{
    const speciesId=oldPet.species||oldPet.speciesId||species[0].id;
    const kind=speciesById(speciesId);
    const oldStats=oldPet.stats||{};
    return {
      uid:oldPet.uid||oldPet.id||`pet-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,5)}`,
      species:kind.id,name:oldPet.name||oldPet.nickname||kind.name,
      level:Math.max(1,Number(oldPet.level)||1),xp:Math.max(0,Number(oldPet.xp)||0),
      hp:Number(oldStats.hp||oldPet.hp)||kind.stats.hp,
      stats:{
        hp:Number(oldStats.hp||oldPet.hp)||kind.stats.hp,
        atk:Number(oldStats.atk||oldPet.attack)||kind.stats.atk,
        def:Number(oldStats.def||oldPet.defense)||kind.stats.def,
        spd:Number(oldStats.spd||oldStats.speed||oldPet.speed)||kind.stats.spd
      },
      hunger:Number.isFinite(oldPet.hunger)?oldPet.hunger:35,
      happiness:Number.isFinite(oldPet.happiness)?oldPet.happiness:75,
      energy:Number.isFinite(oldPet.energy)?oldPet.energy:80,
      cleanliness:Number.isFinite(oldPet.cleanliness)?oldPet.cleanliness:80,
      evolution:Number(oldPet.evolution)||Math.max(0,(Number(oldPet.evolutionStage)||1)-1)*25,
      fragments:Number(oldPet.fragments)||0
    };
  });
  base.activePet=saved.activePet||saved.activePetId||base.pets[0]?.uid||null;
  const oldItems=saved.items||{},oldInventory=saved.inventory||{};
  base.items={
    snack:Number(oldItems.snack??oldInventory.food??0),
    energy:Number(oldItems.energy??oldInventory.energy??0),
    training:Number(oldItems.training??oldInventory.training??0),
    fragments:{...(oldItems.fragments||oldInventory.fragments||{})}
  };
  const oldGacha=saved.gacha||{},oldPity=oldGacha.pity||{};
  base.gacha={
    pityRare:Number(oldGacha.pityRare??Math.max(0,...Object.values(oldPity).map(item=>Number(item.noRare)||0))),
    pityEpic:Number(oldGacha.pityEpic??Math.max(0,...Object.values(oldPity).map(item=>Number(item.noEpic)||0))),
    lastFree:oldGacha.lastFree||oldGacha.freeEggDate||'',
    history:Array.isArray(oldGacha.history)?oldGacha.history.map(item=>({
      name:item.name||item.result||speciesById(item.species).name,
      emoji:item.emoji||speciesById(item.species).emoji,
      rarity:item.rarity||speciesById(item.species).rarity,
      date:typeof item.date==='number'?item.date:Date.now()
    })):[],
  };
  const oldQuests=saved.quests||{};
  base.quests={
    date:oldQuests.date||new Date().toDateString(),
    progress:oldQuests.progress?{...base.quests.progress,...oldQuests.progress}:{
      feed:Number(oldQuests.feedPet?.progress)||0,
      play:Number(oldQuests.playPet?.progress)||0,
      battle:Number(oldQuests.battle?.progress)||0,
      win:Number(oldQuests.battleWin?.progress)||0,
      egg:Number(oldQuests.hatchEgg?.progress)||0
    },
    claimed:Array.isArray(oldQuests.claimed)?oldQuests.claimed:[]
  };
  const today=new Date().toDateString();
  base.careUses=saved.careUses?{...base.careUses,...saved.careUses,date:toLocalDay(saved.careUses.date)}:
    {date:today,feed:0,play:0,train:0,battleRewards:0};
  base.lastCareUpdate=Number(saved.lastCareUpdate)||Date.now();
  base.dailyReward=saved.dailyReward||{lastClaimDate:'',day:0};
  base.battleHistory=Array.isArray(saved.battleHistory)?saved.battleHistory:[];
  return base;
}
function createPet(speciesId,name){
  const s=speciesById(speciesId);
  return {uid:'pet-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,5),species:s.id,name:name||s.name,level:1,xp:0,hp:s.stats.hp,stats:{...s.stats},hunger:35,happiness:75,energy:80,cleanliness:80,evolution:0,fragments:0};
}
function clamp(value,min,max){return Math.min(Math.max(Number(value)||0,min),max);}
function statusMeter(label,icon,value){
  const safe=clamp(Number(value)||0,0,100);
  return `<div class="status-meter"><div><span>${icon} ${label}</span><b>${safe}/100</b></div><div class="progress-track"><div class="progress-fill ${label==='Hunger'?'hunger-fill':''}" style="width:${safe}%"></div></div></div>`;
}
function homePage(){
  const p=activePet();
  if(!p)return `<section class="page"><h1 class="page-title">Rumah TAMAVERSE</h1>${emptyPets()}</section>`;
  const s=speciesById(p.species),xpPercent=Math.min(100,p.xp/(p.level*40)*100);
  return `<section class="page home-page">
    <div class="player-card card"><div class="player-avatar">${state.player.avatar}</div>
      <div class="player-info"><div class="player-name">${esc(state.player.name)}</div><span class="pill">Lv. ${state.player.level}</span>
      <div class="player-xp"><span>${state.player.xp} / ${state.player.level*100} XP</span><div class="progress-track"><div class="progress-fill" style="width:${Math.min(100,state.player.xp/(state.player.level*100)*100)}%"></div></div></div></div>
      <button class="coin-pill" data-action="go" data-page="profile" aria-label="Buka inventori">🪙 <b>${state.player.coins.toLocaleString('id-ID')}</b><span>＋</span></button>
    </div>
    <div class="section-heading universe-heading"><div><div class="eyebrow">YOUR LITTLE UNIVERSE</div><h1 class="page-title">Good day, ${esc(state.player.name)}!</h1></div><button class="icon-button" data-action="go" data-page="profile" aria-label="Buka profil">☾</button></div>
    <section class="pet-stage pet-action-${petAnimation}" data-action="pet-tap" aria-label="Sentuh untuk menyapa ${esc(p.name)}">
      <div class="stage-topline"><span><i></i> YOUR COMPANION</span><b>/ 01</b></div><div class="orbit orbit-one"></div><div class="orbit orbit-two"></div>
      <span class="stage-spark spark-one">✦</span><span class="stage-spark spark-two">✧</span><span class="stage-spark spark-three">✦</span>
      <div class="pet-shadow"></div><div class="stage-pet" aria-hidden="true"><span class="creature stage-creature element-${s.element.toLowerCase()}"><span class="face-emoji">${s.emoji}</span></span><span class="pet-heart">♥</span></div><div class="action-bubble">${petActionLabel(petAnimation)}</div>
      <div class="companion-panel"><div class="companion-meta"><div><div class="eyebrow">${s.element} · ${s.rarity}</div><h2>${esc(p.name)}</h2></div><span class="pill">Lv. ${p.level}</span></div>
        <div class="companion-xp"><span>Companion level</span><b>${p.xp} / ${p.level*40} XP</b></div><div class="progress-track"><div class="progress-fill" style="width:${xpPercent}%"></div></div>
        <div class="stage-stats"><span>🍓 Lapar ${p.hunger}%</span><span>💖 ${p.happiness}%</span><span>⚡ ${p.energy}%</span><span>🫧 ${p.cleanliness}%</span></div>
      </div>
    </section>
    <div class="status-panel">${statusMeter('Hunger','🍓',p.hunger)}${statusMeter('Bahagia','💖',p.happiness)}${statusMeter('Energi','⚡',p.energy)}${statusMeter('Kebersihan','🫧',p.cleanliness)}</div>
    <div class="section-heading care-heading"><h2>Care for ${esc(p.name)}</h2><span class="muted-label">Aksi harian terbatas</span></div>
    <div class="care-actions"><button class="care-action" data-action="care" data-care="feed"><span>🍓</span><b>Feed</b></button><button class="care-action" data-action="care" data-care="play"><span>💖</span><b>Play</b></button><button class="care-action" data-action="care" data-care="clean"><span>🫧</span><b>Bath</b></button><button class="care-action" data-action="care" data-care="sleep"><span>🌙</span><b>Sleep</b></button><button class="care-action" data-action="care" data-care="train"><span>🏋️</span><b>Train</b></button></div>
    <div class="section-heading care-heading"><h2>🎁 Daily reward</h2><span class="muted-label">7-day login bonus</span></div>${dailyRewardCard()}
    <div class="quick-actions home-quick"><button class="button secondary" data-action="go" data-page="pets">🐾 Collection</button><button class="button secondary" data-action="go" data-page="gacha">🥚 Gacha</button><button class="button secondary" data-action="go" data-page="battle">⚔️ Battle</button><button class="button secondary" data-action="go" data-page="profile">🎒 Inventory & quests</button></div>
    <div class="section-heading"><h2>Daily quests</h2><button class="text-button" data-action="go" data-page="profile">See all</button></div>${questPreview()}
  </section>`;
}
function doCare(kind){
  const p=activePet();if(!p){showToast('Tetaskan pet lebih dulu!');return;}
  const limits={feed:5,play:5,train:4};
  if(limits[kind]&&state.careUses[kind]>=limits[kind]){showToast('Batas aksi harian tercapai.');return;}
  if(kind==='feed'){
    if(p.hunger<=0){showToast(`${p.name} sudah kenyang.`);return;}
    triggerPetAnimation('eat');p.hunger=clamp(p.hunger-25,0,100);state.careUses.feed++;grantPetXP(p,4);state.quests.progress.feed++;showToast(`${p.name} makan dengan lahap! Lapar turun, +4 XP.`);
  }else if(kind==='play'){
    if(p.energy<15){showToast('Energi pet terlalu rendah untuk bermain.');return;}
    if(p.happiness>=100){showToast(`${p.name} sudah sangat bahagia!`);return;}
    triggerPetAnimation('play');p.happiness=clamp(p.happiness+22,0,100);p.energy=clamp(p.energy-15,0,100);state.careUses.play++;grantPetXP(p,4);state.quests.progress.play++;showToast('Waktu bermain menyenangkan! +4 XP.');
  }else if(kind==='clean'){
    if(p.cleanliness>=100){showToast(`${p.name} sudah bersih!`);return;}
    triggerPetAnimation('bath');p.cleanliness=100;showToast(`${p.name} jadi bersih dan segar!`);
  }else if(kind==='sleep'){
    if(p.energy>=100){showToast(`${p.name} sudah penuh energi.`);return;}
    triggerPetAnimation('sleep');p.energy=clamp(p.energy+35,0,100);showToast('Pet beristirahat. Energi +35.');
  }else if(kind==='train'){
    if(state.careUses.train>=limits.train){showToast('Batas latihan harian tercapai.');return;}
    if(p.energy<20){showToast('Energi minimal 20 untuk latihan.');return;}
    triggerPetAnimation('train');state.careUses.train++;
    if(state.items.training>0){state.items.training--;grantPetXP(p,14);p.evolution=clamp(p.evolution+8,0,100);showToast('Latihan selesai! +14 XP dan progres evolusi.');}
    else{grantPetXP(p,6);p.evolution=clamp(p.evolution+4,0,100);showToast('Latihan selesai! +6 XP.');}
    p.energy=clamp(p.energy-20,0,100);
  }else return;
  save();render();
}
function dailyReset(){
  const today=new Date().toDateString();
  if(!state.quests||state.quests.date!==today)state.quests={date:today,progress:{feed:0,play:0,battle:0,win:0,egg:0},claimed:[]};
  if(!state.careUses||state.careUses.date!==today)state.careUses={date:today,feed:0,play:0,train:0,battleRewards:0};
  if(!Number.isFinite(state.careUses.battleRewards))state.careUses.battleRewards=0;
  if(!state.dailyReward)state.dailyReward={lastClaimDate:'',day:0};
  if(state.player.lastLogin!==today){
    const yesterday=new Date(Date.now()-86400000).toDateString();
    state.player.streak=state.player.lastLogin===yesterday?Math.max(1,(state.player.streak||1)+1):1;
    state.player.lastLogin=today;
  }
  const now=Date.now(),lastUpdate=Number(state.lastCareUpdate)||now;
  const elapsedHours=Math.floor((now-lastUpdate)/3600000);
  if(elapsedHours>0){
    state.pets.forEach(p=>{
      p.hunger=clamp(p.hunger+elapsedHours*4,0,100);
      p.cleanliness=clamp(p.cleanliness-elapsedHours*3,0,100);
      p.happiness=clamp(p.happiness-elapsedHours*2,0,100);
      p.energy=clamp(p.energy+elapsedHours*4,0,100);
    });
    state.lastCareUpdate=lastUpdate+elapsedHours*3600000;
  }
}
function raritySummary(rates){
  return Object.entries(rates).map(([rarity,rate])=>`${rarity} ${rate}%`).join(' · ');
}
function formatEggCost(egg,count=1){
  const total=egg.price*count;
  return `${egg.currency==='gem'?'💎 '+total+' gem':'🪙 '+total+' koin'}`;
}
function gachaPage(){
  const owned=new Set(state.pets.map(p=>p.species));
  const featured=eggs.find(e=>e.id==='mystic');
  return `<section class="page">
    <div class="eyebrow">TEMUKAN TEMAN BARU</div><h1 class="page-title">Telur ajaib</h1>
    <p class="subtle">Peluang ditampilkan per telur dan diterapkan langsung pada setiap tarikan. Semua gacha memakai mata uang permainan, tanpa pembayaran uang sungguhan.</p>
    <div class="featured-banner"><div><span class="eyebrow">TELUR PILIHAN</span><h2>${featured.emoji} ${featured.name}</h2><p>${featured.description}</p><small>${raritySummary(featured.rates)}</small></div><button class="button" data-action="pull" data-egg="${featured.id}">Lihat telur</button></div>
    <div class="notice">Pity bersama: Rare atau lebih baik dijamin paling lambat tarikan ke-10. Epic atau lebih baik dijamin paling lambat tarikan ke-50.</div>
    <div class="collection-grid">${eggs.map(e=>{
      const pool=species.filter(s=>s.pool.includes(e.id));
      return `<article class="card egg-card"><span class="egg-icon">${e.emoji}</span><h3>${e.name}</h3><p class="subtle">${e.description}</p>
        <p class="egg-rates"><b>Peluang:</b><br>${raritySummary(e.rates)}<br><b>Total 100%</b></p>
        <p class="egg-pool"><b>Isi telur:</b> ${pool.map(s=>`<span class="pool-pet ${owned.has(s.id)?'pool-owned':''}" title="${esc(s.name)}">${s.emoji} ${esc(s.name)}</span>`).join('')}</p>
        <p class="muted-label">${formatEggCost(e)}</p>
        <div class="egg-actions"><button class="button full" data-action="pull" data-egg="${e.id}">Buka 1</button><button class="button secondary full" data-action="pull-ten" data-egg="${e.id}">Buka 10 · ${formatEggCost(e,10)}</button></div>
      </article>`;
    }).join('')}</div>
    <div class="card gacha-details"><div class="section-heading" style="margin-top:0"><h2>Telur gratis harian</h2></div>
      <button class="button secondary full" data-action="freeegg" ${state.gacha.lastFree===new Date().toDateString()?'disabled':''}>${state.gacha.lastFree===new Date().toDateString()?'Sudah diklaim hari ini':'Klaim Basic Egg gratis'}</button>
      <div class="section-heading"><h2>Progress pity</h2></div><p class="subtle">Rare+: ${state.gacha.pityRare}/10 · Epic+: ${state.gacha.pityEpic}/50</p>
      <div class="section-heading"><h2>Riwayat tarikan</h2></div>
      ${state.gacha.history.length?`<div class="pull-history">${state.gacha.history.slice(0,8).map(h=>`<div class="rank-row"><span>${h.emoji}</span><span>${esc(h.name)}<br><small class="muted-label">${new Date(h.date).toLocaleString('id-ID')}</small></span><b class="rarity rarity-${h.rarity}">${h.rarity}</b></div>`).join('')}</div>`:'<p class="subtle">Tarikanmu akan muncul di sini.</p>'}
    </div>
    <div class="notice">Save dan hadiah disimpan di perangkat ini. Gacha lokal bisa diubah lewat browser; hadiah aman untuk multiplayer memerlukan validasi server.</div>
  </section>`;
}
function battlePage(){
  if(battle)return battleView();
  const rewarded=state.careUses.battleRewards||0;
  return `<section class="page"><div class="eyebrow">ARENA TAMAVERSE</div><h1 class="page-title">Battle</h1>
    <p class="subtle">Pertarungan turn-based melawan lawan AI lokal. Hadiah progres dibatasi lima battle per hari.</p>
    <div class="card"><div style="font-size:42px;text-align:center;margin:8px">⚔️</div><h2 style="text-align:center">Practice Battle</h2>
      <p class="subtle" style="text-align:center">Lawan AI lokal · Hadiah menang: 35 koin + XP</p><button class="button full" data-action="battle-start" data-mode="practice">Mulai latihan</button></div>
    <div class="card" style="margin-top:12px"><h2>Simulated PvP</h2><p class="subtle">Mode demo melawan lawan sampel. Belum terhubung ke pemain sungguhan atau matchmaking online.</p><button class="button secondary full" data-action="battle-start" data-mode="simulated">Tantang lawan demo</button></div>
    <div class="notice">Hadiah XP dan koin tersedia pada ${Math.max(0,5-rewarded)} battle berikutnya hari ini. Semua hasil dan rating hanya tersimpan lokal.</div>
    ${state.battleHistory.length?`<div class="section-heading"><h2>Battle terakhir</h2></div>${state.battleHistory.slice(0,5).map(item=>`<div class="card battle-history-row"><span>${item.result==='win'?'🏆':item.result==='draw'?'🤝':'💫'} ${item.result==='win'?'Menang':item.result==='draw'?'Seri':'Kalah'}</span><span class="muted-label">${new Date(item.date).toLocaleDateString('id-ID')}</span></div>`).join('')}`:''}
  </section>`;
}
function profilePage(){
  const fragments=Object.entries(state.items.fragments||{}).filter(([,count])=>count>0);
  const fragmentTotal=fragments.reduce((sum,[,count])=>sum+count,0);
  const fragmentRows=fragments.length?fragments.map(([id,count])=>{
    const s=speciesById(id);
    return `<div class="fragment-row"><div><b>${s.emoji} ${s.name}</b><span>${count} fragmen</span></div>
      <div class="fragment-actions">
        <button class="button secondary" data-action="exchange-fragment" data-species="${id}" data-reward="coins" ${count<3?'disabled':''}>3 → 30 koin</button>
        <button class="button secondary" data-action="exchange-fragment" data-species="${id}" data-reward="gems" ${count<5?'disabled':''}>5 → 1 gem</button>
        <button class="button secondary" data-action="exchange-fragment" data-species="${id}" data-reward="training" ${count<4?'disabled':''}>4 → 1 buku</button>
      </div></div>`;
  }).join(''):'<p class="subtle">Fragmen dari pet duplikat akan muncul di sini.</p>';
  return `<section class="page"><div class="eyebrow">AKUN LOKAL</div><h1 class="page-title">Profil & Tas</h1>
    <div class="card profile-card"><div class="avatar">${state.player.avatar}</div><h2>${esc(state.player.name)}</h2><p>Guest · ID ${esc(state.player.id)}</p>
      <div class="profile-stats"><div class="profile-stat"><strong>Lv. ${state.player.level}</strong><span>LEVEL PEMAIN</span></div><div class="profile-stat"><strong>${state.player.rating}</strong><span>RATING</span></div><div class="profile-stat"><strong>${state.player.wins}/${state.player.losses}/${state.player.draws}</strong><span>W/L/D</span></div><div class="profile-stat"><strong>${new Set(state.pets.map(p=>p.species)).size}/12</strong><span>KOLEKSI</span></div><div class="profile-stat"><strong>${state.player.streak} hari</strong><span>LOGIN STREAK</span></div><div class="profile-stat"><strong>${state.player.xp}/${state.player.level*100}</strong><span>PLAYER XP</span></div></div>
      <div class="profile-edit-actions"><button class="button secondary" data-action="rename-player">✏️ Ubah nama</button><button class="button secondary" data-action="avatar-picker">🙂 Ubah avatar</button></div>
    </div>
    <div class="section-heading"><h2>🎒 Inventori</h2></div><div class="card">
      <div class="rank-row"><span>🍓</span><span>Camilan<br><small class="muted-label">Memulihkan HP saat battle</small></span><b>${state.items.snack}</b></div>
      <div class="rank-row"><span>⚡</span><span>Ramuan energi<br><small class="muted-label">Pulihkan energi pet</small></span><b>${state.items.energy}</b></div>
      <div class="rank-row"><span>🏋️</span><span>Buku latihan<br><small class="muted-label">Latihan ekstra untuk pet</small></span><b>${state.items.training}</b></div>
      <button class="button secondary full" data-action="shop">Buka toko item</button>
    </div>
    <div class="section-heading"><h2>🧩 Tukar fragmen</h2><span class="muted-label">${fragmentTotal} total</span></div>
    <div class="card"><p class="subtle">Fragmen hanya berasal dari duplikat. Tukarkan fragmen dari spesies yang sama dengan salah satu hadiah berikut.</p>${fragmentRows}</div>
    <div class="section-heading"><h2>🎯 Quest harian</h2></div>${questList()}
    <div class="notice">Save, battle, dan ranking hanya lokal di browser ini. Akun bersama dan leaderboard online memerlukan backend tepercaya.</div>
    <button class="button danger full" data-action="reset">Reset semua data</button></section>`;
}
function inspectPet(uid){
  const p=petById(uid);if(!p)return;
  const s=speciesById(p.species),active=activePet();
  selectedPetId=uid;
  const statRows=(pet,label)=>`<div class="comparison-pet"><b>${esc(label)}${pet.uid===state.activePet?' · Aktif':''}</b><span>HP ${pet.stats.hp}</span><span>ATK ${pet.stats.atk}</span><span>DEF ${pet.stats.def}</span><span>SPD ${pet.stats.spd}</span></div>`;
  const comparison=active&&active.uid!==p.uid?`<div class="comparison-grid">${statRows(p,p.name)}${statRows(active,active.name)}</div>`:`<div class="stats-row"><div class="stat-tile"><strong>${p.stats.hp}</strong><span>HP</span></div><div class="stat-tile"><strong>${p.stats.atk}</strong><span>ATK</span></div><div class="stat-tile"><strong>${p.stats.def}</strong><span>DEF</span></div></div><p class="subtle">Speed: ${p.stats.spd}</p>`;
  showModal(`<div class="hatch-egg">${s.emoji}</div><div class="eyebrow">${s.element} · ${s.rarity}</div><h2 id="modalTitle">${esc(p.name)} · Lv.${p.level}</h2>
    <p>${s.name} · Evolusi ${p.evolution}/100 · XP ${p.xp}/${p.level*40}</p><div class="section-heading"><h2>Perbandingan stat</h2></div>${comparison}
    <div class="modal-actions"><button class="button secondary" data-action="nickname-pet">Ubah nama</button><button class="button" data-action="set-active" data-pet="${uid}">${uid===state.activePet?'Pet aktif':'Pilih aktif'}</button></div>`);
}
function chooseRarityForEgg(egg){
  const rates=egg.rates;
  const total=Object.values(rates).reduce((sum,value)=>sum+value,0);
  let roll=Math.random()*total,rarity='Legendary';
  for(const tier of ['Common','Rare','Epic','Legendary']){
    roll-=rates[tier]||0;
    if(roll<0){rarity=tier;break;}
  }
  if(state.gacha.pityEpic>=49&&['Common','Rare'].includes(rarity))return 'Epic';
  if(state.gacha.pityRare>=9&&rarity==='Common')return 'Rare';
  return rarity;
}
function pullEgg(id,free=false){return runEggPulls(id,1,free);}
function runEggPulls(id,count,free=false){
  if(pullInProgress){showToast('Tarikan sedang diproses.');return;}
  const egg=eggs.find(item=>item.id===id);if(!egg)return;
  const pool=species.filter(item=>item.pool.includes(id));
  const tiers=['Common','Rare','Epic','Legendary'];
  if(tiers.some(tier=>!pool.some(item=>item.rarity===tier))){showToast('Pool telur belum lengkap; tidak ada biaya yang diambil.');return;}
  if(free&&state.gacha.lastFree===new Date().toDateString()){showToast('Telur gratis hari ini sudah diklaim.');return;}
  const currency=egg.currency==='gem'?'gems':'coins',cost=free?0:egg.price*count;
  if(state.player[currency]<cost){showToast(`Tidak cukup ${currency==='gems'?'gem':'koin'} untuk tarikan ini.`);return;}
  pullInProgress=true;
  try{
    if(free)state.gacha.lastFree=new Date().toDateString();else state.player[currency]-=cost;
    const results=[];
    for(let index=0;index<count;index++){
      const rarity=chooseRarityForEgg(egg);
      const candidates=pool.filter(item=>item.rarity===rarity);
      const chosen=candidates[Math.floor(Math.random()*candidates.length)];
      state.gacha.pityRare=chosen.rarity==='Common'?state.gacha.pityRare+1:0;
      state.gacha.pityEpic=['Common','Rare'].includes(chosen.rarity)?state.gacha.pityEpic+1:0;
      state.quests.progress.egg++;
      const added=addPet(chosen.id);
      results.push({chosen,duplicate:added.duplicate});
      state.gacha.history.unshift({name:chosen.name,emoji:chosen.emoji,rarity:chosen.rarity,date:Date.now()+index});
    }
    state.gacha.history=state.gacha.history.slice(0,50);
    save();render();
    if(count===1){
      const {chosen,duplicate}=results[0];
      showModal(`<div class="hatch-egg">${chosen.emoji}✨</div><div class="eyebrow" style="text-align:center">TELUR MENETAS</div><h2 id="modalTitle" style="text-align:center">${duplicate?'Duplikat! Fragmen didapat':esc(chosen.name)}</h2>
        <p style="text-align:center"><span class="rarity rarity-${chosen.rarity}">${chosen.rarity}</span> · ${chosen.element}<br>${duplicate?'+1 fragmen spesies dan 20 koin':'Teman baru masuk koleksimu!'}</p>
        <div class="stats-row stats-four"><div class="stat-tile"><strong>${chosen.stats.hp}</strong><span>HP</span></div><div class="stat-tile"><strong>${chosen.stats.atk}</strong><span>ATK</span></div><div class="stat-tile"><strong>${chosen.stats.def}</strong><span>DEF</span></div><div class="stat-tile"><strong>${chosen.stats.spd}</strong><span>SPD</span></div></div>
        <button class="button full" style="margin-top:14px" data-action="close-modal">Keren!</button>`);
    }else{
      const counts={Common:0,Rare:0,Epic:0,Legendary:0},duplicates=results.filter(result=>result.duplicate).length;
      results.forEach(result=>counts[result.chosen.rarity]++);
      const list=results.map(({chosen,duplicate})=>`<div class="batch-result rarity-${chosen.rarity}"><span>${chosen.emoji}</span><b>${esc(chosen.name)}</b><small>${chosen.rarity} · ${chosen.element}${duplicate?' · +fragmen':''}</small><small class="batch-stats">HP ${chosen.stats.hp} · ATK ${chosen.stats.atk} · DEF ${chosen.stats.def} · SPD ${chosen.stats.spd}</small></div>`).join('');
      showModal(`<div class="eyebrow">HASIL 10 TARIKAN</div><h2 id="modalTitle">Telur menetas!</h2><p>${raritySummary(counts)} · ${duplicates} duplikat menghasilkan fragmen.</p><div class="batch-results">${list}</div><button class="button full" data-action="close-modal">Lanjut</button>`);
    }
  }finally{pullInProgress=false;}
}
function exchangeFragments(speciesId,reward){
  const costs={coins:{fragments:3,amount:30},gems:{fragments:5,amount:1},training:{fragments:4,amount:1}};
  const option=costs[reward],available=state.items.fragments[speciesId]||0;
  if(!option||available<option.fragments){showToast('Fragmen spesies belum cukup.');return;}
  state.items.fragments[speciesId]-=option.fragments;
  if(reward==='coins')state.player.coins+=option.amount;
  else if(reward==='gems')state.player.gems+=option.amount;
  else state.items.training+=option.amount;
  save();render();showToast('Fragmen berhasil ditukar.');
}
function battleAction(move){
  if(!battle||battle.ended)return;
  if(move==='skill'&&battle.skillUsed){showToast('Skill sudah digunakan pada battle ini.');return;}
  const p=petById(battle.petId);if(!p)return;
  const ps=speciesById(p.species),os=speciesById(battle.opponent.species),log=battle.log;
  battle.actionFx=move;
  if(move==='attack'||move==='skill'){
    const enemyDodge=clamp(.04+(battle.opponent.stats.spd-p.stats.spd)*.005,.02,.18);
    if(Math.random()<enemyDodge){
      log.push(`${battle.opponent.name} menghindari serangan ${p.name}.`);
    }else{
      const skillBonus=move==='skill'?5:0;
      let damage=Math.max(4,Math.round((4+p.stats.atk*.5+skillBonus-battle.opponent.stats.def*.2)*(0.85+Math.random()*.3)*elementMultiplier(ps.element,os.element)));
      const critChance=clamp(.07+(p.stats.spd-battle.opponent.stats.spd)*.006,.03,.2);
      if(Math.random()<critChance){damage=Math.round(damage*1.5);log.push('Serangan kritis!');}
      battle.enemyHP-=damage;
      log.push(`${p.name} ${move==='skill'?'menggunakan Skill':'menyerang'} dan memberi ${damage} damage!`);
    }
    if(move==='skill')battle.skillUsed=true;
  }else if(move==='defend'){
    battle.defending=true;log.push(`${p.name} bersiap bertahan.`);
  }else if(move==='item'){
    if(state.items.snack<1){showToast('Camilan habis.');return;}
    state.items.snack--;battle.playerHP=Math.min(p.stats.hp,battle.playerHP+25);log.push(`${p.name} memakai camilan dan memulihkan HP!`);
  }else return;
  if(battle.enemyHP<=0){finishBattle('win');return;}
  const playerDodge=clamp(.04+(p.stats.spd-os.stats.spd)*.005,.02,.18);
  if(Math.random()<playerDodge){
    log.push(`${p.name} menghindari serangan ${battle.opponent.name}.`);
  }else{
    const incoming=Math.max(3,Math.round((4+battle.opponent.stats.atk*.5-p.stats.def*.2)*(0.85+Math.random()*.3)*elementMultiplier(os.element,ps.element)*(battle.defending?.45:1)));
    battle.playerHP-=incoming;log.push(`${battle.opponent.name} menyerang, ${incoming} damage.`);
  }
  battle.defending=false;battle.turn++;
  if(battle.playerHP<=0){finishBattle('loss');return;}
  if(battle.turn>30){finishBattle('draw');return;}
  battle.log=log.slice(-30);render();
}
function finishBattle(result){
  if(!battle||battle.ended)return;
  dailyReset();battle.ended=true;
  const p=petById(battle.petId);
  const rewardAllowed=state.careUses.battleRewards<5;
  if(rewardAllowed)state.careUses.battleRewards++;
  if(result==='win'){
    state.player.wins++;
    if(rewardAllowed){state.player.rating+=battle.mode==='simulated'?12:5;state.player.coins+=35;playerXP(25);grantPetXP(p,20);showToast('Menang! +35 koin, XP pet & pemain.');}
    else showToast('Menang! Hadiah battle harian sudah mencapai batas.');
    state.quests.progress.win++;
  }else if(result==='loss'){
    state.player.losses++;
    if(rewardAllowed){state.player.rating=Math.max(0,state.player.rating-5);grantPetXP(p,8);}
    showToast(rewardAllowed?'Kalah, tapi pet mendapat pengalaman.':'Hadiah battle harian sudah mencapai batas.');
  }else{
    state.player.draws++;showToast('Battle berakhir seri.');
  }
  state.quests.progress.battle++;
  state.battleHistory.unshift({result,date:Date.now(),mode:battle.mode});
  state.battleHistory=state.battleHistory.slice(0,20);
  save();battle=null;render();
  showModal(`<div class="hatch-egg">${result==='win'?'🏆':result==='draw'?'🤝':'💫'}</div><h2 id="modalTitle" style="text-align:center">${result==='win'?'Kemenangan!':result==='draw'?'Seri!':'Pertarungan selesai'}</h2><p style="text-align:center">${result==='win'?'Hebat! Petmu memperoleh hadiah battle.':result==='draw'?'Pertarungan berakhir imbang.':'Jangan menyerah, petmu tetap mendapat XP.'}</p><button class="button full" data-action="close-modal">Lanjut</button>`);
}
function batchPullConfirmation(egg){
  const currency=egg.currency==='gem'?'gem':'koin',cost=egg.price*10;
  showModal(`<div class="hatch-egg">${egg.emoji}</div><div class="eyebrow">KONFIRMASI TARIKAN</div><h2 id="modalTitle">Buka 10 ${egg.name}?</h2><p>Biaya total: ${cost} ${currency}. Tarif per telur: ${raritySummary(egg.rates)}. Pity berlaku di setiap tarikan.</p><div class="modal-actions"><button class="button secondary" data-action="close-modal">Batal</button><button class="button" data-action="confirm-batch" data-egg="${egg.id}">Konfirmasi buka 10</button></div>`);
}
function avatarPicker(){
  const avatars=['✨','🌙','🌿','⚡','🎀','🦊','🐸','🌸','🪄','☄️','🍓','🧙'];
  showModal(`<div class="eyebrow">AVATAR PEMAIN</div><h2 id="modalTitle">Pilih avatar</h2><div class="avatar-options">${avatars.map(avatar=>`<button class="avatar-option ${state.player.avatar===avatar?'selected':''}" data-action="set-avatar" data-avatar="${avatar}" aria-label="Pilih avatar ${avatar}">${avatar}</button>`).join('')}</div><button class="button secondary full" data-action="close-modal">Batal</button>`);
}

document.addEventListener('click',event=>{
  const nav=event.target.closest('.nav-item');if(nav){page=nav.dataset.page;render();return;}
  const btn=event.target.closest('[data-action]');if(!btn)return;const a=btn.dataset.action;
  if(a==='theme-toggle'){const next=document.body.dataset.theme==='dark'?'light':'dark';document.body.dataset.theme=next;try{localStorage.setItem('tamaverse_theme',next);}catch(e){showToast('Tema berubah, tetapi tidak dapat disimpan.');}applyTheme();return;}if(a==='start'){startIntro();return;}if(a==='finish-intro'){finishIntro();return;}if(a==='close-modal'){closeModal();return;}if(a==='go'){page=btn.dataset.page;render();return;}if(a==='claim-daily'){claimDailyReward();return;}if(a==='care'){doCare(btn.dataset.care);return;}if(a==='pet-tap'){triggerPetAnimation('greet');showToast(`${activePet()?.name||'Pet'} menyapamu!`);return;}if(a==='inspect'){inspectPet(btn.dataset.pet);return;}if(a==='set-active'){state.activePet=btn.dataset.pet;closeModal();save();render();showToast('Pet aktif berhasil diganti.');return;}if(a==='nickname-pet'){const p=petById(selectedPetId);if(!p)return;showModal(`<div class="eyebrow">NAMA PET</div><h2 id="modalTitle">Ganti nama</h2><input class="text-input" id="newPetName" maxlength="18" value="${esc(p.name)}"><button class="button full" data-action="save-pet-name">Simpan nama</button>`);return;}if(a==='save-pet-name'){const p=petById(selectedPetId);const n=(document.getElementById('newPetName')?.value||'').trim().slice(0,18);if(p&&n){p.name=n;closeModal();save();render();showToast('Nama pet diperbarui.');}return;}if(a==='rename-player'){showModal(`<div class="eyebrow">PROFIL LOKAL</div><h2 id="modalTitle">Ubah nama pemain</h2><input class="text-input" id="playerNameInput" maxlength="18" value="${esc(state.player.name)}"><button class="button full" data-action="save-player-name">Simpan</button>`);return;}if(a==='save-player-name'){const n=(document.getElementById('playerNameInput')?.value||'').trim().slice(0,18);if(n){state.player.name=n;closeModal();save();render();showToast('Nama profil diperbarui.');}return;}if(a==='pull'){const e=eggs.find(x=>x.id===btn.dataset.egg);if(!e)return;const curr=e.currency==='gem'?'gem':'koin';showModal(`<div class="hatch-egg">${e.emoji}</div><h2 id="modalTitle">Buka ${e.name}?</h2><p>Biaya: ${e.price} ${curr}. Tarikan mengikuti tarif rarity yang ditampilkan.</p><div class="modal-actions"><button class="button secondary" data-action="close-modal">Batal</button><button class="button" data-action="confirm-pull" data-egg="${e.id}">Buka telur</button></div>`);return;}if(a==='confirm-pull'){const id=btn.dataset.egg;closeModal();pullEgg(id,false);return;}if(a==='freeegg'){pullEgg('basic',true);return;}if(a==='battle-start'){startBattle(btn.dataset.mode);return;}if(a==='battle-action'){battleAction(btn.dataset.move);return;}if(a==='claim'){doClaim(btn.dataset.quest);return;}if(a==='shop'){showShop();return;}if(a==='buy'){buyItem(btn.dataset.item);return;}if(a==='reset'){resetGame();return;}if(a==='confirm-reset'){localStorage.removeItem(SAVE_KEY);state=null;battle=null;page='home';closeModal();render();showToast('Save dihapus.');return;}
});
document.getElementById('modalBackdrop').addEventListener('click',e=>{if(e.target.id==='modalBackdrop')closeModal();});
document.addEventListener('click',event=>{
  const button=event.target.closest('[data-action]');if(!button)return;
  const action=button.dataset.action;
  if(action==='pull-ten'){
    const egg=eggs.find(item=>item.id===button.dataset.egg);if(!egg)return;
    const currency=egg.currency==='gem'?'gems':'coins';
    if(state.player[currency]<egg.price*10){showToast(`Perlu ${formatEggCost(egg,10)} untuk membuka 10 telur.`);return;}
    batchPullConfirmation(egg);
  }else if(action==='confirm-batch'){
    const id=button.dataset.egg;closeModal();runEggPulls(id,10,false);
  }else if(action==='avatar-picker'){
    avatarPicker();
  }else if(action==='set-avatar'){
    state.player.avatar=button.dataset.avatar;closeModal();save();render();showToast('Avatar diperbarui.');
  }else if(action==='exchange-fragment'){
    exchangeFragments(button.dataset.species,button.dataset.reward);
  }
});
try{
  const telegramApp=window.Telegram&&window.Telegram.WebApp;
  if(telegramApp){telegramApp.ready();telegramApp.expand();}
}catch(error){console.info('Telegram Mini App bridge is not available in this browser.');}
applyTheme();
render();
