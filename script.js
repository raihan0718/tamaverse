 'use strict';

// Local cache is namespaced by verified Telegram account. The legacy unscoped key is intentionally left untouched.
const SAVE_KEY_PREFIX = 'tamaverse_save_v1:';
function accountSaveKey(telegramId = window.TAMAVERSE_TELEGRAM_ID) {
  const id = String(telegramId || '');
  return /^\d{1,24}$/.test(id) ? SAVE_KEY_PREFIX + id : null;
}
const species = [
  {id:'fluffin',name:'Mochi',emoji:'🟢',element:'Nature',rarity:'Common',stats:{hp:95,atk:15,def:12,spd:16},pool:['basic']},
  {id:'embercub',name:'Nivelle',emoji:'🐶',element:'Water',rarity:'Common',stats:{hp:88,atk:18,def:10,spd:17},pool:['basic']},
  {id:'bubblit',name:'Spriggo',emoji:'🦖',element:'Nature',rarity:'Common',stats:{hp:105,atk:13,def:15,spd:12},pool:['basic']},
  {id:'mossling',name:'Lumifae',emoji:'🐸',element:'Light',rarity:'Common',stats:{hp:100,atk:14,def:16,spd:10},pool:['basic']},
  {id:'voltkit',name:'Pyrris',emoji:'🐱',element:'Fire',rarity:'Rare',stats:{hp:90,atk:20,def:11,spd:20},pool:['basic']},
  {id:'coralyn',name:'Aqualune',emoji:'🦎',element:'Water',rarity:'Rare',stats:{hp:110,atk:17,def:18,spd:12},pool:['premium']},
  {id:'cinderowl',name:'Arcanix',emoji:'🧙',element:'Mystic',rarity:'Rare',stats:{hp:96,atk:19,def:14,spd:16},pool:['basic']},
  {id:'petalyn',name:'Aurelis',emoji:'🦊',element:'Light',rarity:'Rare',stats:{hp:92,atk:16,def:13,spd:21},pool:['premium']},
  {id:'lunabun',name:'Bitbelle',emoji:'🤖',element:'Tech',rarity:'Epic',stats:{hp:110,atk:20,def:17,spd:21},pool:['basic']},
  {id:'glacipup',name:'Bambloo',emoji:'🐼',element:'Nature',rarity:'Epic',stats:{hp:118,atk:22,def:18,spd:14},pool:['premium']},
  {id:'starwhale',name:'Solvyr',emoji:'🔥',element:'Light',rarity:'Legendary',stats:{hp:128,atk:23,def:20,spd:17},pool:['basic']},
  {id:'wyrmling',name:'Dravaryn',emoji:'🐉',element:'Fire',rarity:'Legendary',stats:{hp:116,atk:24,def:16,spd:22},pool:['premium']},
  {id:'sovereign-nexora',name:'Nexora',emoji:'🐉',element:'Crimson',rarity:'Sovereign',stats:{hp:132,atk:26,def:23,spd:19},pool:[],exclusive:'Founder'}
 ];
const petImages = {
  fluffin: 'assets/pets/slime.webp',
  embercub: 'assets/pets/ice-pup.webp',
  bubblit: 'assets/pets/sprout-dino.webp',
  mossling: 'assets/pets/glow-frog.webp',
  voltkit: 'assets/pets/fire-cat.webp',
  coralyn: 'assets/pets/axolotl.webp',
  cinderowl: 'assets/pets/wizard.webp',
  petalyn: 'assets/pets/golden-fox.webp',
  lunabun: 'assets/pets/robo-bunny.webp',
  glacipup: 'assets/pets/panda.webp',
  starwhale: 'assets/pets/phoenix.webp',
  wyrmling: 'assets/pets/dragon.webp',
  'sovereign-nexora': 'assets/pets/Soverign-Nexora.webp'
};
const leftFacingPetIds = new Set(['starwhale']);
function petFacesLeft(speciesId){return leftFacingPetIds.has(speciesId);}
function battlePetImage(speciesId,side,className=''){
  const flip=side==='player'?petFacesLeft(speciesId):!petFacesLeft(speciesId);
  return petImage(speciesId,className+(flip?' battle-face-flip':''));
}
function petImage(speciesId, className = '', eager = false) {
  const normalizedId = speciesId || 'fluffin';
  const pet = speciesById(normalizedId);
  const src = petImages[normalizedId] || petImages[pet.id] || petImages.fluffin;
  const loading = eager ? 'eager' : 'lazy';
  const priority = eager ? 'high' : 'low';
  return `<img class="pet-image ${esc(className)}" src="${src}?v=pet-arena-assets-20261101-1" alt="${esc(pet.name)}" loading="${loading}" decoding="async" fetchpriority="${priority}" onerror="this.onerror=null;this.style.visibility='hidden'">`;
}
const accessoryFrames = [
  {id:'common',name:'Glossy Blue',rarity:'Common',src:'assets/ui/Common-GlassyBlue.webp'},
  {id:'uncommon',name:'Sprout Green',rarity:'Uncommon',src:'assets/ui/Uncommon-SproutGreen_1.webp'},
  {id:'rare',name:'Sunny Amber',rarity:'Rare',src:'assets/ui/Rare-SunnyAmber.webp'},
  {id:'legendary',name:'Royal Violet',rarity:'Legendary',src:'assets/ui/Legendary-RoyalViolet.webp'},
  {id:'celestial',name:'Divine Princesses',rarity:'Celestial',src:'assets/ui/Celestial-DivinePrinceses.webp'},
  {id:'royal-sovereign',name:'Royal Sovereign',rarity:'Sovereign',src:'assets/ui/Exclusive-RoyalSoverign.webp',exclusive:'Founder'}
];
function accessoryFrameById(id){return accessoryFrames.find(frame=>frame.id===id)||accessoryFrames[0];}
let collectionTab='pets';
let storeTab='gacha';
let shopQuantities={food:1,energy:1,snack:1,training:1};
window.TAMAVERSE_PREMIUM_INVENTORY=window.TAMAVERSE_PREMIUM_INVENTORY||{rename_card_count:0,rename_pet_card_count:0,owned_frames:['common']};
function premiumInventory(){return window.TAMAVERSE_PREMIUM_INVENTORY||{rename_card_count:0,rename_pet_card_count:0,owned_frames:['common']};}
function ownsFrame(id){return id==='common'||(Array.isArray(premiumInventory().owned_frames)&&premiumInventory().owned_frames.includes(id));}

const eggs = [
  {id:'basic',name:'Pixie Egg',image:'assets/eggs/pixie.webp',price:100,description:'Telur ajaib berisi pet Common hingga Legendary.'},
  {id:'premium',name:'Astral Egg',image:'assets/eggs/astral.webp',price:5,description:'Telur astral eksklusif berisi pet Rare hingga Legendary.',currency:'diamond'}
];
function eggImage(eggId){
  const egg=eggs.find(item=>item.id===eggId);
  if(!egg?.image)return '🥚';
  const imagePath=egg.id==='basic'
    ?'/tamaverse/assets/eggs/pixie.webp'
    :'/tamaverse/assets/eggs/astral.webp';
  return `<img class="egg-art" src="${imagePath}" alt="${esc(egg.name)}" loading="lazy" decoding="async" fetchpriority="low" onerror="this.onerror=null;this.replaceWith(Object.assign(document.createElement('span'),{className:'egg-fallback',textContent:'🥚'}))">`;
}
const eggRates = {
  basic:{Common:60,Rare:28,Epic:8,Legendary:4},
  premium:{Rare:55,Epic:27,Legendary:18}
};
eggs.forEach(egg=>{egg.rates=eggRates[egg.id];});
const initialItems = {snack:3,energy:2,training:1};
let state = null;

Object.defineProperty(window, 'state', {
  configurable: true,
  get: () => state,
  set: (value) => { state = value; }
});

let page = 'home';
let selectedPetId = null;
let battle = null;
let huntingSkillCooldownTimer = null;
let onlineSkillClientReadyAt = 0;
let battleSection = 'online';
let toastTimer;
let petAnimation = 'idle';
let petAnimationTimer;
let pullInProgress = false;

const MAX_COINS = 2147483647;
function addCoins(amount){
  const reward=Number(amount);
  const current=Number(state?.player?.coins);
  if(!Number.isSafeInteger(reward)||reward<=0||!Number.isSafeInteger(current)||current<0)return 0;
  const accepted=Math.min(reward,MAX_COINS-current);
  state.player.coins=current+accepted;
  return accepted;
}

function save(){
  if(!state)return;
  const key = accountSaveKey();
  if(!key)return; // Never write shared device data before Telegram identity is verified.
  try{
    localStorage.setItem(key, JSON.stringify(state));
  }catch(e){
    showToast('Penyimpanan penuh. Hapus sebagian data browser.');
  }
}
function freshState(name){
  return {player:{id:'guest-'+Math.random().toString(36).slice(2,9),name:name||'Penjelajah',avatar:'🧙',level:1,xp:0,coins:300,diamonds:3,rating:1000,wins:0,losses:0,draws:0,streak:1,lastLogin:new Date().toDateString()},pets:[],activePet:null,equippedFrame:'common',items:{...initialItems,food:0,fragments:{}},gacha:{pityRare:0,pityEpic:0,lastFree:'',history:[]},quests:{date:new Date().toDateString(),progress:{feed:0,play:0,battle:0,win:0,egg:0},claimed:[]},dailyReward:{lastClaimDate:'',day:0},battleHistory:[],lastCareUpdate:Date.now(),createdAt:Date.now()};
}
function esc(value){return String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function petById(id){return state?.pets.find(p=>p.uid===id)||null;}
function activePet(){return petById(state?.activePet)||state?.pets[0]||null;}
function petSleeping(p){return !!(p?.sleeping&&p.sleepStartedAt);}
function petActivityBlocked(p){if(petSleeping(p)){showToast(`${p.name} sedang tidur. Bangunkan dulu untuk beraktivitas.`);return true;}return false;}
function battleMoodMessage(p){return `${p.name} sedang tidak di mood yang baik beri makan atau ganti pet yang lain`;}
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
    if(currentStage){currentStage.className=currentStage.className.replace(/pet-action-[\w-]+/g,'').trim();currentStage.classList.add('pet-action-idle');}
    const currentBubble=document.querySelector('.action-bubble');
    if(currentBubble)currentBubble.textContent='';
  },1800);
}
let introSequenceTimers=[];
let introSequenceToken=0;
function clearIntroSequence(){
  introSequenceToken++;
  introSequenceTimers.forEach(timer=>clearTimeout(timer));
  introSequenceTimers=[];
}
function showModal(html){document.getElementById('modalCard').innerHTML=html;document.getElementById('modalBackdrop').classList.remove('hidden');}
function closeModal(){if(state?.mainQuestProgress?.prologue==='in_progress')saveQuestCheckpoint('in_progress');clearIntroSequence();document.getElementById('modalBackdrop').classList.add('hidden');}
window.showTopupSuccessModal = function(diamonds){
  const amount = Math.max(0, Math.floor(Number(diamonds) || 0));
  showModal(`
    <div class="topup-success-modal">
      <div class="topup-success-icon">💎</div>
      <div class="topup-success-eyebrow">NEXORA PAYMENT</div>
      <h2>TOP UP BERHASIL!</h2>
      <p class="topup-success-copy">Diamond kamu berhasil ditambahkan ke wallet Tamaverse.</p>
      <div class="topup-success-amount">+${amount.toLocaleString('id-ID')} <span>DIAMOND</span></div>
      <p class="topup-success-thanks">Thank you for supporting Tamaverse!</p>
      <button class="button primary topup-success-close" type="button" onclick="closeModal()">Tutup</button>
      <div class="topup-success-note">Nexora loves you 💖</div>
    </div>
  `);
};
function openCurrencyExchange(){
  const balance=Math.max(0,Math.floor(Number(state?.player?.diamonds||0)));
  showModal(`<div class="currency-convert-modal">
    <div class="currency-convert-emblem">⇄</div>
    <div class="eyebrow">TAMAVERSE EXCHANGE</div>
    <h2 id="modalTitle">Convert Diamond</h2>
    <p class="subtle">Tukar diamond menjadi coin untuk kebutuhan petualanganmu.</p>
    <div class="currency-rate-card"><span>EXCHANGE RATE</span><strong>1 💎 <i>→</i> 500 ◈</strong></div>
    <label class="currency-input-label" for="diamondConvertAmount">JUMLAH DIAMOND</label>
    <div class="currency-input-wrap"><span>💎</span><input id="diamondConvertAmount" class="text-input" type="number" min="1" max="${balance}" step="1" value="${balance>0?1:0}" ${balance>0?'':'disabled'} oninput="updateCurrencyConversionPreview()"></div>
    <div class="currency-convert-preview"><span>YOU WILL RECEIVE</span><strong id="coinConvertPreview">${balance>0?'500':'0'} <small>COINS</small></strong></div>
    <p class="currency-balance-note">Diamond tersedia: <b>${balance.toLocaleString('id-ID')}</b></p>
    <div class="modal-actions"><button class="button secondary" data-action="close-modal">Cancel</button><button class="button" data-action="convert-diamonds" ${balance>0?'':'disabled'}>Convert</button></div>
  </div>`);
}
function updateCurrencyConversionPreview(){
  const input=document.getElementById('diamondConvertAmount');
  const output=document.getElementById('coinConvertPreview');
  if(!input||!output)return;
  const amount=Math.max(0,Math.floor(Number(input.value)||0));
  output.innerHTML=(amount*500).toLocaleString('id-ID')+' <small>COINS</small>';
  input.setCustomValidity(amount<1||amount>Number(input.max)?'Masukkan jumlah diamond yang tersedia.':'');
}
window.updateCurrencyConversionPreview=updateCurrencyConversionPreview;
function updateWallet(){document.getElementById('coinBalance').textContent=state?state.player.coins:0;document.getElementById('diamondBalance').textContent=state?state.player.diamonds:0;}
function applyTheme(){let dark=false;try{dark=localStorage.getItem('tamaverse_theme')==='dark';}catch(e){}document.body.dataset.theme=dark?'dark':'light';const button=document.querySelector('.theme-toggle');if(button){button.textContent=dark?'☀':'☾';button.setAttribute('aria-label',dark?'Gunakan tema terang':'Gunakan tema gelap');}}
function render(){
  const introActive=Boolean(state?.introStoryStarted&&!state?.introStoryCompleted);
  document.body.classList.toggle('game-intro-mode',introActive);
  document.body.classList.toggle('battle-fullscreen', Boolean(page === 'battle' && ((onlineRoom && ['playing','finished'].includes(onlineRoom.status)) || battle)));
  updateWallet(); document.querySelectorAll('.nav-item').forEach(b=>b.classList.toggle('active',b.dataset.page===page));
  const root=document.getElementById('mainContent');
  if(!state){root.innerHTML=welcomePage();return;}
  if(introActive){gameIntroIndex=Math.max(0,Math.min(gameIntroLines.length-1,Number(state.introStoryIndex)||0));root.innerHTML=gameIntroPage();return;}
  dailyReset();
  const pages={home:homePage,pets:petsPage,quest:mainQuestPage,gacha:gachaPage,shop:shopPage,battle:battlePage,ranking:rankingPage,profile:profilePage};
  root.innerHTML=(pages[page]||homePage)();
}
window.render = render;
const gameIntroLines=[
  {name:'Aeloria',portrait:'Aeloria.webp',text:'Oh! Kamu akhirnya tiba di Starfall Village. Kami sudah menunggumu.'},
  {name:'Kael',portrait:'Kael.webp',text:'Jangan terlalu cepat percaya, Aeloria. Kita bahkan belum tahu siapa dia.'},
  {name:'Miri',portrait:'Miri.webp',text:'Tunggu... cahaya kecil itu muncul lagi! Sepertinya pet barumu punya hubungan dengan bintang jatuh.'},
  {name:'Aeloria',portrait:'Aeloria.webp',text:'Apa pun yang terjadi, perjalananmu dimulai di sini. Selamat datang di Tamaverse!'}
];
let gameIntroIndex=0;
function gameIntroPage(){
  const line=gameIntroLines[Math.max(0,Math.min(gameIntroLines.length-1,gameIntroIndex))];
  const final=gameIntroIndex===gameIntroLines.length-1;
  return '<section class="game-intro-scene" style="background-image:url(assets/main-quest/locations/StarfallVillage.webp)">'+
    '<div class="game-intro-shade"></div>'+
    '<div class="game-intro-character-wrap"><img class="game-intro-character" src="assets/main-quest/npcs/'+line.portrait+'" alt="'+line.name+'"></div>'+
    '<div class="game-intro-dialogue" style="background-image:url(assets/main-quest/ui/DialogueBox.webp)">'+
      '<div class="game-intro-name">'+line.name+'</div>'+
      '<p>'+line.text+'</p>'+
      '<button class="game-intro-next" data-action="intro-story-next">'+(final?'Masuk ke Tamaverse':'Lanjutkan')+' <span>›</span></button>'+
      '<div class="game-intro-counter">'+(gameIntroIndex+1)+' / '+gameIntroLines.length+'</div>'+
    '</div>'+
  '</section>';
}
function advanceGameIntro(){
  if(!state?.introStoryStarted)return;
  if(gameIntroIndex<gameIntroLines.length-1){
    gameIntroIndex++;
    state.introStoryIndex=gameIntroIndex;
    save();
    render();
    return;
  }
  state.introStoryCompleted=true;
  state.introStoryStarted=false;
  state.introStoryIndex=gameIntroLines.length;
  page='home';
  save();
  render();
  showToast('Selamat datang di Tamaverse!');
}
function welcomePage(){return `<section class="page welcome"><div class="eyebrow">PETUALANGAN BARU DIMULAI</div><div class="welcome-art">${eggImage('basic')}</div><h1>Selamat datang di<br>TAMAVERSE</h1><p class="subtle">Rawat dan latih teman ajaibmu, buka telur dengan koin atau diamond, lalu bawa petmu ke battle untuk mendapat XP dan hadiah.</p><div class="card"><p>🎁 <b>Hadiah awal:</b> 1 telur gratis + 300 koin + 3 diamond</p><button class="button full" data-action="start">Mulai petualangan</button></div><p class="muted-label">Progres tersimpan di perangkat ini · Guest lokal</p></section>`;}
const mainQuestChapters=[
  {number:'PROLOGUE',title:'A Falling Star',place:'Starfall Village',image:'StarfallVillage.webp',description:'Sebuah cahaya jatuh dari langit. Sejak malam itu, kenangan mulai menghilang.',minLevel:1},
  {number:'CHAPTER 01',title:'The Forgotten Village',place:'Starfall Village',image:'StarfallVillage.webp',description:'Desa yang perlahan melupakan nama dan kisah penghuninya.',minLevel:3},
  {number:'CHAPTER 02',title:'Whispers of the Forest',place:'Whispering Forest',image:'WhisperingForest.webp',description:'Bisikan lama memanggil dari balik pepohonan.',minLevel:5},
  {number:'CHAPTER 03',title:'Pages That Never Existed',place:'Astral Library',image:'AstralLibrary.webp',description:'Ada halaman yang hilang dari sejarah dunia.',minLevel:8},
  {number:'CHAPTER 04',title:'The Memory Keeper',place:'Memory Sanctuary',image:'MemorySanctuary.webp',description:'Penjaga kenangan menyimpan jawaban yang tak mudah diterima.',minLevel:11},
  {number:'CHAPTER 05',title:'The Hollow Kingdom',place:'Hollow Kingdom',image:'HollowKingdom.webp',description:'Kerajaan sunyi menyembunyikan asal mula Great Silence.',minLevel:14},
  {number:'CHAPTER 06',title:'Beyond Memories',place:'The Forgotten Realm',image:'TheForgottenRealm.webp',description:'Di ujung ingatan, kebenaran terakhir menanti.',minLevel:18}
];
const prologueLines=[{"name":"Narator","speaker":"THE FALLING STAR","text":"Sebuah cahaya jatuh dari langit malam. Saat kamu membuka mata, kamu terbaring di jalan berbatu yang asing. Kamu tidak ingat bagaimana bisa sampai di sini."},{"name":"Aeloria","speaker":"AELORIA","portrait":"Aeloria.webp","text":"Hei! Kamu bisa mendengarku? Syukurlah. Aku menemukanmu di dekat gerbang desa. Apa kamu baik-baik saja?"},{"name":"Kamu","speaker":"A STRANGER","text":"Aku tidak tahu tempat apa ini. Tadi ada cahaya yang sangat terang, lalu semuanya menjadi gelap."},{"name":"Kael","speaker":"KAEL","portrait":"Kael.webp","text":"Aeloria, jangan langsung percaya. Kita bahkan tidak tahu dari mana orang ini datang."},{"name":"Aeloria","speaker":"AELORIA","portrait":"Aeloria.webp","text":"Namaku Aeloria. Ini Starfall Village. Kamu jatuh tepat di jalan masuk desa kami."},{"name":"Miri","speaker":"MIRI","portrait":"Miri.webp","text":"Tunggu sebentar... pet yang bersamamu memancarkan cahaya yang sama dengan bintang jatuh tadi."},{"name":"Miri","speaker":"MIRI","portrait":"Miri.webp","text":"Ada serpihan kecil menempel di bulunya. Ini Memory Fragment! Aku belum pernah melihatnya sedekat ini."},{"name":"Kael","speaker":"KAEL","portrait":"Kael.webp","text":"Jangan sentuh sembarangan. Sejak Great Silence, benda seperti itu selalu muncul sebelum sesuatu yang buruk terjadi."},{"name":"Aeloria","speaker":"AELORIA","portrait":"Aeloria.webp","text":"Great Silence adalah peristiwa yang membuat banyak orang kehilangan sebagian ingatan mereka. Desa ini masih mencoba pulih."},{"name":"Narator","speaker":"STARFALL VILLAGE","text":"Kamu melihat penduduk berjalan dengan wajah lelah. Beberapa rumah masih rusak, dan lonceng desa terdiam sejak malam bintang jatuh."},{"name":"Warga Desa","speaker":"A VILLAGER","text":"Aeloria! Tolong! Ada sesuatu bergerak di balik gerbang timur. Tanahnya sampai bergetar!"},{"name":"Kael","speaker":"KAEL","portrait":"Kael.webp","text":"Aku tahu suara itu. Kita harus membawa warga menjauh dari gerbang. Sekarang!"},{"name":"King Slime","speaker":"UNKNOWN CREATURE","asset":"assets/main-quest/monsters/slime-king.webp","text":"GROOO... FRAGMEN... BERIKAN... SEMUA... KENANGAN..."},{"name":"Miri","speaker":"MIRI","portrait":"Miri.webp","text":"Itu bukan slime biasa! Tubuhnya dipenuhi pecahan Memory Fragment yang menyatu menjadi satu."},{"name":"Aeloria","speaker":"AELORIA","portrait":"Aeloria.webp","text":"King Slime! Ia muncul dari wilayah reruntuhan. Jangan biarkan ia mendekati rumah-rumah warga!"},{"name":"Kael","speaker":"KAEL","portrait":"Kael.webp","text":"Aku akan mengarahkan warga ke alun-alun. Aeloria, lindungi Miri. Kamu, bisakah pet-mu bertarung?"},{"name":"Aeloria","speaker":"AELORIA","portrait":"Aeloria.webp","text":"Kita tidak punya banyak waktu. Percayalah pada pet-mu, dan jangan menyerah."},{"name":"Narator","speaker":"THE FIRST BATTLE","text":"King Slime menghadang jalan utama. Cahaya dari tubuhnya semakin terang. Pertarungan pertamamu di Starfall Village akan segera dimulai.","action":"battle"},{"name":"King Slime","speaker":"AFTER THE BATTLE","asset":"assets/main-quest/monsters/slime-king.webp","text":"Tidak... mungkin... kalian menghentikanku... untuk saat ini..."},{"name":"Aeloria","speaker":"AELORIA","portrait":"Aeloria.webp","text":"Apa maksudmu untuk saat ini? Siapa yang menyuruhmu menyerang desa kami?"},{"name":"King Slime","speaker":"KING SLIME","asset":"assets/main-quest/monsters/slime-king.webp","text":"Yang lebih besar... sedang terbangun... jauh di balik batas dunia..."},{"name":"King Slime","speaker":"KING SLIME","asset":"assets/main-quest/monsters/slime-king.webp","text":"Saat lonceng tanpa suara berbunyi... tidak akan ada tempat untuk bersembunyi..."},{"name":"Narator","speaker":"A FADING WARNING","text":"Cahaya King Slime meredup. Pecahan kristal terlepas dari tubuhnya, lalu monster itu menghilang menjadi titik-titik cahaya."},{"name":"Miri","speaker":"MIRI","portrait":"Miri.webp","text":"Lihat! Satu Memory Fragment tertinggal. Tapi... kenapa bayangannya menunjukkan langit yang gelap?"},{"name":"Kael","speaker":"KAEL","portrait":"Kael.webp","text":"Kita bisa membahasnya nanti. Banyak warga yang terluka dan gerbang timur rusak. Desa membutuhkan bantuan."},{"name":"Aeloria","speaker":"AELORIA","portrait":"Aeloria.webp","text":"Kamu sudah menyelamatkan kami. Tapi bisakah kamu tinggal sebentar dan membantu warga memulihkan desa?"},{"name":"Warga Desa","speaker":"HELP THE VILLAGERS","text":"Persediaan makanan dan obat-obatan berserakan di dekat alun-alun. Bisakah kamu membantu mengumpulkannya?","action":"help"},{"name":"Miri","speaker":"HELP THE VILLAGERS","portrait":"Miri.webp","text":"Terima kasih! Beberapa warga masih ketakutan. Temani mereka dan bantu menenangkan anak-anak yang terpisah dari keluarganya.","action":"help"},{"name":"Kael","speaker":"HELP THE VILLAGERS","portrait":"Kael.webp","text":"Gerbang timur perlu diperbaiki sebelum malam tiba. Bantu aku mengamankan papan dan perlengkapan yang tersisa.","action":"help"},{"name":"Noctis","speaker":"A VOICE IN THE DUSK","portrait":"Noctis.webp","text":"Jangan mengira King Slime adalah sumber semua ini. Ia hanya mengikuti panggilan yang bahkan tidak mampu ia pahami."},{"name":"Narator","speaker":"THE JOURNEY CONTINUES","text":"Starfall Village mulai pulih, tetapi peringatan King Slime terus terngiang. Aeloria meminta kamu tetap tinggal. Di kejauhan, sebuah lonceng yang telah lama diam bergerak sendiri. Perjalananmu baru saja dimulai."}];
let questLineIndex=0;
function saveQuestCheckpoint(status){
  if(!state)return;
  state.mainQuestProgress=state.mainQuestProgress||{};
  state.mainQuestCheckpoints=state.mainQuestCheckpoints||{};
  if(status)state.mainQuestProgress.prologue=status;
  state.mainQuestCheckpoints.prologue=Math.max(0,Math.min(prologueLines.length,questLineIndex));
  state.mainQuestUpdatedAt=Date.now();
  save();
}
function resumePrologue(){
  state.mainQuestProgress=state.mainQuestProgress||{};
  if(state.mainQuestProgress.prologue==='completed'){showToast('Prologue sudah diselesaikan.');return;}
  state.mainQuestProgress.prologue='in_progress';
  const checkpoint=Number(state.mainQuestCheckpoints?.prologue);
  questLineIndex=Number.isInteger(checkpoint)?Math.max(0,Math.min(prologueLines.length-1,checkpoint)):0;
  state.questStoryActive=true;saveQuestCheckpoint('in_progress');page='quest';render();
}
function questStoryPage(){
  questLineIndex=Math.max(0,Math.min(prologueLines.length-1,questLineIndex));
  const line=prologueLines[questLineIndex];
  const portraitSrc=line.asset||(line.portrait?'assets/main-quest/npcs/'+line.portrait:'');
  const character=portraitSrc?'<div class="game-intro-character-wrap"><img class="game-intro-character" src="'+esc(portraitSrc)+'" alt="'+esc(line.name)+'"></div>':'<div class="game-intro-character-wrap"></div>';
  const last=questLineIndex===prologueLines.length-1;
  const action=line.action==='battle'?'quest-battle':line.action==='help'?'quest-help':last?'quest-finish':'quest-next';
  const label=line.action==='battle'?'Mulai Battle':line.action==='help'?'Bantu Warga':last?'Selesaikan Prologue':'Lanjutkan';
  return '<section class="game-intro-scene" style="background-image:url(assets/main-quest/locations/StarfallVillage.webp)"><div class="game-intro-shade"></div>'+character+'<div class="game-intro-dialogue" style="background-image:url(assets/main-quest/ui/DialogueBox.webp)"><div class="game-intro-name">'+esc(line.name)+'</div><p>'+esc(line.text)+'</p><button class="game-intro-next" data-action="'+action+'">'+label+' <span>›</span></button><div class="game-intro-counter">'+(questLineIndex+1)+' / '+prologueLines.length+'</div></div></section>';
}
function showQuestLine(){state.questStoryActive=true;render();}
function advanceQuestLine(){if(questLineIndex>=prologueLines.length-1){completeQuestLine();return;}questLineIndex++;saveQuestCheckpoint('in_progress');render();}
function completeQuestLine(){if(state.mainQuestProgress?.prologue==='completed'){state.questStoryActive=false;render();return;}questLineIndex=prologueLines.length;state.questStoryActive=false;saveQuestCheckpoint('completed');render();showToast('Prologue selesai! Starfall Village kini menjadi rumah keduamu.');}
function mainQuestPage(){
  const chapters=mainQuestChapters;
  const progress=state.mainQuestProgress||{};
  const playerLevel=Math.max(1,Number(state.player.level)||1);
  const completed=chapters.filter((chapter,index)=>progress[chapter.number.toLowerCase().replace(/[^a-z0-9]+/g,'_')]==='completed'||(index===0&&progress.prologue==='completed')).length;
  let previousCompleted=true;
  const chapterCards=chapters.map((chapter,index)=>{
    const key=index===0?'prologue':chapter.number.toLowerCase().replace(/[^a-z0-9]+/g,'_');
    const isCompleted=progress[key]==='completed';
    const levelMet=playerLevel>=chapter.minLevel;
    const unlocked=previousCompleted&&levelMet;
    previousCompleted=isCompleted;
    const status=isCompleted?'COMPLETED':unlocked?(progress[key]==='in_progress'?'IN PROGRESS':'AVAILABLE'):!levelMet?'LEVEL LOCKED':'LOCKED';
    return `<article class="quest-chapter ${isCompleted?'is-completed':unlocked?'is-available':'is-locked'}">
      <img src="assets/main-quest/locations/${chapter.image}" alt="${chapter.place}" loading="lazy">
      <div class="quest-chapter-copy"><span class="quest-chapter-tag">${chapter.number} · ${status}</span><h3>${chapter.title}</h3><p>${chapter.description}</p><small>⌖ ${chapter.place} · Minimal Level ${chapter.minLevel}</small></div>
      <span class="quest-chapter-state">${isCompleted?'✓':unlocked?'✦':'🔒'}</span>
    </article>`;
  }).join('');
  return `<section class="page main-quest-page">
    <div class="quest-heading"><div class="eyebrow">TAMAVERSE STORY MODE</div><h1 class="page-title">The Lost Memories</h1><p class="subtle">Sebuah dunia kehilangan cahaya, warna, dan kenangannya. Temukan alasan di balik Great Silence.</p></div>
    <article class="quest-hero" style="background-image:linear-gradient(90deg,rgba(18,12,34,.92),rgba(18,12,34,.25)),url('assets/main-quest/locations/StarfallVillage.webp')">
      <div class="quest-hero-content"><span class="quest-kicker">A MYSTERY ADVENTURE</span><h2>THE LOST<br>MEMORIES</h2><p>Some memories were never meant to be forgotten.</p><span class="quest-hero-mark">✦</span></div>
    </article>
    <div class="quest-section-title"><div><span class="eyebrow">YOUR JOURNEY BEGINS</span><h2>Story Progress</h2></div><span class="quest-count">${completed} / ${chapters.length}</span></div>
    <article class="quest-feature-card">
      <img src="assets/main-quest/locations/StarfallVillage.webp" alt="Starfall Village">
      <div class="quest-feature-copy"><span class="quest-chapter-tag">PROLOGUE · ${progress.prologue==='completed'?'COMPLETED':playerLevel>=1?'AVAILABLE':'LEVEL LOCKED'}</span><h3>A Falling Star</h3><p>Sebuah bintang jatuh membawa awal dari misteri yang mengubah seluruh Tamaverse.</p><small>Minimal Level 1 · Level kamu ${playerLevel}</small><button class="button quest-start-button" data-action="quest-start" ${progress.prologue==='completed'?'disabled':''}> ${progress.prologue==='completed'?'Selesai':progress.prologue==='in_progress'?'Lanjutkan Petualangan':'Mulai Petualangan'} <span>→</span></button></div>
    </article>
    <div class="quest-section-title"><div><span class="eyebrow">UNRAVEL THE STORY</span><h2>Story Chapters</h2></div><span class="quest-count">${chapters.length} chapters</span></div>
    <div class="quest-chapter-list">${chapterCards}</div>
    <div class="quest-section-title"><div><span class="eyebrow">EXPLORE THE WORLD</span><h2>World Atlas</h2></div></div>
    <div class="quest-world-grid">${[
      ['Starfall Village','StarfallVillage.webp'],['Whispering Forest','WhisperingForest.webp'],['Astral Library','AstralLibrary.webp'],['Memory Sanctuary','MemorySanctuary.webp'],['Hollow Kingdom','HollowKingdom.webp'],['The Forgotten Realm','TheForgottenRealm.webp']
    ].map(([name,image])=>`<div class="quest-world-card"><img src="assets/main-quest/locations/${image}" alt="${name}" loading="lazy"><span>${name}</span></div>`).join('')}</div>
    <section class="quest-test-panel">
      <div><span class="quest-chapter-tag">DEVELOPER TOOLS</span><h3>Quest Test Mode</h3><p>Ulangi cerita untuk pengujian. Data player, pet, dan currency tidak akan dihapus.</p></div>
      <div class="quest-test-actions">
        <button class="button secondary" data-action="quest-test-reset" data-scope="prologue">Reset Prologue</button>
        <button class="button secondary" data-action="quest-test-reset" data-scope="all">Reset All Quest</button>
        <button class="button secondary" data-action="quest-test-opening">Test Opening Scene</button>
      </div>
    </section>
    <p class="quest-footnote">Setiap chapter memiliki level minimum dan battle cerita tersendiri. Kisah akan terus diperbarui.</p>
  </section>`;
}
function petActionLabel(action){return ({eat:'Yum! 🍓',play:'Having fun! ✨',bath:'Splash! 🫧',sleep:'Zzz... 🌙',train:'Go! 💪',greet:'Hello! ♥',idle:''})[action]||'';}
function emptyPets(){return `<div class="card empty"><div style="font-size:42px">🥚</div><p>Belum ada pet. Tetaskan telur pertamamu untuk memulai!</p><button class="button" data-action="start">Tetaskan telur gratis</button></div>`;}
function rarityRank(rarity){return ({Common:1,Rare:2,Epic:3,Legendary:4,Celestial:5,Sovereign:6})[rarity]||0;}
function petsPage(){
  // Founder-exclusive pets stay locked until this Telegram account is verified.
  const visiblePets=(state.pets||[]).filter(p=>p.species!=='sovereign-nexora'||window.TAMAVERSE_IS_FOUNDER===true);
  const owned=new Set(visiblePets.map(p=>p.species));
  const sortedPets=[...visiblePets].sort((a,b)=>rarityRank(speciesById(b.species).rarity)-rarityRank(speciesById(a.species).rarity));
  const undiscovered=species.filter(s=>!owned.has(s.id)).sort((a,b)=>{
    if(a.exclusive==='Founder'&&b.exclusive!=='Founder')return 1;
    if(b.exclusive==='Founder'&&a.exclusive!=='Founder')return -1;
    return rarityRank(b.rarity)-rarityRank(a.rarity);
  });
  const percent=species.length?Math.round(owned.size/species.length*100):0;
  const tabs='<div class="collection-tabs" role="tablist" aria-label="Collection categories">'+
    '<button class="collection-tab '+(collectionTab==='pets'?'active':'')+'" role="tab" aria-selected="'+(collectionTab==='pets')+'" data-action="collection-tab" data-tab="pets"><span>🐾</span><b>Pets</b><small>'+state.pets.length+' collected</small></button>'+
    '<button class="collection-tab '+(collectionTab==='accessories'?'active':'')+'" role="tab" aria-selected="'+(collectionTab==='accessories')+'" data-action="collection-tab" data-tab="accessories"><span>🖼️</span><b>Accessories</b><small>'+accessoryFrames.length+' frames</small></button></div>';
  const petContent='<div class="collection-overview"><div class="collection-overview-copy"><span class="eyebrow">YOUR DISCOVERY JOURNAL</span><h2>Every companion has a story.</h2><p>Collect, discover, and build your own little universe.</p></div><div class="collection-progress"><div class="collection-progress-ring" style="--collection-progress:'+percent+'%"><strong>'+percent+'%</strong></div><div><b>'+owned.size+' / '+species.length+'</b><small>Species discovered</small></div></div></div><div class="collection-section-head"><div><span class="eyebrow">YOUR COMPANIONS</span><h2>Collected pets</h2></div><span class="collection-count">'+state.pets.length+' OWNED</span></div>'+(sortedPets.length?'<div class="collection-grid">'+sortedPets.map(p=>petCard(p,true)).join('')+'</div>':emptyPets())+'<div class="collection-section-head collection-undiscovered-head"><div><span class="eyebrow">THE UNKNOWN</span><h2>Not discovered yet</h2></div><span class="collection-count">'+undiscovered.length+' MISSING</span></div><div class="collection-grid">'+undiscovered.map(s=>s.exclusive==='Founder'?'<article class="creature-card locked founder-exclusive-card"><div class="creature-thumb">'+petImage(s.id,'collection-pet-image')+'</div><h3>'+esc(s.name)+'</h3><p><span class="rarity rarity-'+s.rarity+'">'+s.rarity+'</span></p><span class="exclusive-label">FOUNDER EXCLUSIVE</span></article>':'<article class="creature-card locked"><div class="creature-thumb">❔</div><h3>???</h3><p>'+s.element+' · <span class="rarity rarity-'+s.rarity+'">'+s.rarity+'</span></p></article>').join('')+'</div>';
  const accessoryContent='<div class="collection-overview accessory-overview"><div class="collection-overview-copy"><span class="eyebrow">PERSONALIZE YOUR PET</span><h2>A frame for every style.</h2><p>Equip a frame you own to give your active companion a distinct look.</p></div><div class="collection-progress"><div class="collection-progress-icon">✧</div><div><b>'+accessoryFrames.filter(f=>ownsFrame(f.id)).length+' / '+accessoryFrames.length+'</b><small>Frames unlocked</small></div></div></div><div class="collection-section-head"><div><span class="eyebrow">FRAME GALLERY</span><h2>Your accessories</h2></div><span class="collection-count">'+accessoryFrames.length+' FRAMES</span></div><div class="accessory-grid">'+accessoryFrames.map(frame=>{const ownedFrame=ownsFrame(frame.id);const equipped=state.equippedFrame===frame.id;return '<article class="accessory-card '+(equipped?'equipped':'')+' '+(!ownedFrame?'locked':'')+' '+(frame.exclusive?'founder-exclusive-card':'')+'"><div class="accessory-art aura-'+frame.id+'"><img src="'+frame.src+'" alt="'+esc(frame.name)+' frame" loading="lazy" decoding="async">'+(!ownedFrame?'<span class="frame-lock">🔒</span>':'')+(equipped?'<span class="frame-equipped-tag">EQUIPPED</span>':'')+'</div><div class="accessory-info"><span class="rarity rarity-'+frame.rarity+'">'+frame.rarity+'</span><h3>'+esc(frame.name)+'</h3>'+(frame.exclusive?'<span class="exclusive-label">FOUNDER EXCLUSIVE</span>':'')+'<button class="accessory-equip '+(equipped?'is-equipped':'')+'" data-action="equip-frame" data-frame="'+frame.id+'" '+(!ownedFrame||equipped?'disabled':'')+'>'+(equipped?'✓ Equipped':ownedFrame?'Equip frame':frame.exclusive?'🔒 Founder Only':'Not Owned')+'</button></div></article>';}).join('')+'</div>';
  return '<section class="page collection-page"><div class="collection-page-heading"><div><div class="eyebrow">TAMAVERSE ARCHIVE</div><h1 class="page-title">Collection</h1><p class="subtle">Your companions, memories, and rare discoveries.</p></div><span class="collection-heading-mark">✧</span></div>'+tabs+(collectionTab==='accessories'?accessoryContent:petContent)+'</section>';
}
function petCard(p,owned){const s=speciesById(p.species);return `<button class="creature-card ${owned?'owned':''}" data-action="inspect" data-pet="${p.uid}"><div class="creature-thumb">${petImage(s.id, 'collection-pet-image')}</div><h3>${esc(p.name)} ${p.uid===state.activePet?'⭐':''}</h3><p>Lv.${p.level} · ${s.element}<br><span class="rarity rarity-${s.rarity}">${s.rarity}</span></p></button>`;}
function legacy_gachaPage(){return `<section class="page"><div class="eyebrow">TEMUKAN TEMAN BARU</div><h1 class="page-title">Telur ajaib</h1><p class="subtle">Basic: Common 60% · Rare 28% · Epic 8% · Legendary 4%. Premium: Rare 55% · Epic 27% · Legendary 18%. Pity Rare pada 10 pull, Epic pada 50 pull.</p><div class="notice">🎁 Gratis 1 Basic Egg setiap hari. Semua hadiah menggunakan mata uang dalam game—tanpa pembayaran asli.</div><div class="collection-grid">${eggs.map(e=>`<article class="card egg-card"><span class="egg-icon">${eggImage(e.id)}</span><h3>${e.name}</h3><p class="subtle">${e.description}</p><p class="muted-label">${e.currency==='diamond'?`💎 ${e.price} diamond`:`🪙 ${e.price} koin`}</p><button class="button full" data-action="pull" data-egg="${e.id}">Buka 1 telur</button></article>`).join('')}</div><div class="card" style="margin-top:12px"><div class="section-heading" style="margin-top:0"><h2>Hadiah gratis harian</h2></div><button class="button secondary full" data-action="freeegg">${state.gacha.lastFree===new Date().toDateString()?'Sudah diklaim hari ini':'Klaim Basic Egg gratis'}</button><div class="section-heading"><h2>Progress pity</h2></div><p class="subtle">Rare+: ${state.gacha.pityRare}/10 · Epic+: ${state.gacha.pityEpic}/50</p><div class="section-heading"><h2>Riwayat tarikan</h2></div>${state.gacha.history.length?state.gacha.history.slice(0,5).map(h=>{const s=speciesById(h.species||species.find(x=>x.name===h.name)?.id);return `<p class="subtle gacha-history-row"><span class="gacha-history-icon">${petImage(s.id,'history-pet-image')}</span><b>${esc(h.name)}</b> · <span class="rarity rarity-${h.rarity}">${h.rarity}</span></p>`;}).join(''):'<p class="subtle">Tarikanmu akan muncul di sini.</p>'}</div></section>`;}
function legacy_battlePage(){if(battle)return battleView();return `<section class="page"><div class="eyebrow">ARENA TAMAVERSE</div><h1 class="page-title">Battle</h1><p class="subtle">Latih petmu dalam pertarungan turn-based melawan lawan simulasi.</p><div class="card"><div style="font-size:42px;text-align:center;margin:8px">⚔️</div><h2 style="text-align:center">Practice Battle</h2><p class="subtle" style="text-align:center">Lawan AI lokal · Hadiah: 35 koin + XP saat menang</p><button class="button full" data-action="battle-start" data-mode="practice">Mulai latihan</button></div><div class="card" style="margin-top:12px"><h2>Simulated PvP</h2><p class="subtle">Mode demonstrasi melawan lawan sampel. Belum terhubung ke pemain sungguhan atau matchmaking online.</p><button class="button secondary full" data-action="battle-start" data-mode="simulated">Tantang lawan demo</button></div>${state.battleHistory.length?`<div class="section-heading"><h2>Battle terakhir</h2></div>${state.battleHistory.slice(0,4).map(b=>`<div class="card" style="margin:7px 0"><span>${b.result==='win'?'🏆':b.result==='draw'?'🤝':'💫'} ${b.result==='win'?'Menang':b.result==='draw'?'Seri':'Kalah'}</span><span style="float:right" class="muted-label">${new Date(b.date).toLocaleDateString('id-ID')}</span></div>`).join('')}`:''}<div class="notice">🛡️ Pertarungan dan rating tersimpan lokal. Hasil ini bukan ranking kompetitif online.</div></section>`;}


window.TAMAVERSE_RANKING_SORT =
  window.TAMAVERSE_RANKING_SORT || 'rating';

window.TAMAVERSE_RANKING_DATA =
  window.TAMAVERSE_RANKING_DATA || [];

window.TAMAVERSE_RANKING_LOADING = false;
window.TAMAVERSE_RANKING_ERROR = '';

async function loadGlobalRankings() {
  if (window.TAMAVERSE_RANKING_LOADING) return;

  const db = window.TAMAVERSE_SUPABASE_CLIENT;

  if (!db || typeof db.from !== 'function') {
    window.TAMAVERSE_RANKING_ERROR =
      'Supabase client belum tersedia atau tidak valid.';
    window.TAMAVERSE_RANKING_LOADING = false;

    if (typeof window.render === 'function') {
      window.render();
    }
    return;
  }

  window.TAMAVERSE_RANKING_LOADING = true;
  window.TAMAVERSE_RANKING_ERROR = '';

  try {
    const { data: profiles, error: profileError } =
      await db
  .from('profiles')
        .select('id, display_name, avatar, avatar_url, level, rating, wins, losses, playtime_seconds')
        .limit(500);

    if (profileError) throw profileError;

    window.TAMAVERSE_RANKING_DATA =
      (profiles || []).map(p => ({
        id: p.id,
        name: p.display_name || 'Player',
        avatar: p.avatar_url || p.avatar || '🐣',
        level: Number(p.level || 1),
        rating: Number(p.rating || 1000),
        wins: Number(p.wins || 0),
        losses: Number(p.losses || 0),
        playtime: Number(p.playtime_seconds || 0),
        me: p.id === window.TAMAVERSE_USER_ID
      }));

  } catch (error) {
    console.error('Global leaderboard failed:', error);
    window.TAMAVERSE_RANKING_ERROR =
      'Leaderboard gagal dimuat: ' +
      (error?.message || String(error));

  } finally {
    window.TAMAVERSE_RANKING_LOADING = false;

    if (typeof window.render === 'function') {
      window.render();
    }
  }
}

window.loadGlobalRankings = loadGlobalRankings;

window.setRankingSort = function (category) {
  const allowed = ['rating', 'level', 'wins', 'playtime'];
  if (!allowed.includes(category)) return;

  window.TAMAVERSE_RANKING_SORT = category;

  if (typeof window.render === 'function') {
    window.render();
  }
};

function formatPlaytime(value) {
  const total = Math.max(0, Math.floor(Number(value) || 0));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

function rankingPage() {
  const categories = [
    ['rating', 'Rating'],
    ['level', 'Level'],
    ['wins', 'Wins'],
    ['playtime', 'Playtime']
  ];
  const category = window.TAMAVERSE_RANKING_SORT || 'rating';
  const labels = {rating:'Rating Battle',level:'Level',wins:'Total Wins',playtime:'Playtime'};
  const data = window.TAMAVERSE_RANKING_DATA || [];

  if (!data.length && !window.TAMAVERSE_RANKING_LOADING && !window.TAMAVERSE_RANKING_ERROR) {
    loadGlobalRankings();
  }

  const rows = [...data].sort((a,b) => {
    const diff = Number(b[category] || 0) - Number(a[category] || 0);
    return diff || a.name.localeCompare(b.name);
  });
  const currentIndex = rows.findIndex(r => r.me);
  const current = currentIndex >= 0 ? rows[currentIndex] : null;
  const podium = rows.slice(0,3);
  const rest = rows.slice(3);
  const medal = ['🥇','🥈','🥉'];
  const metric = r => category === 'playtime' ? formatPlaytime(r.playtime) : Number(r[category] || 0).toLocaleString('id-ID');

  return `<section class="page ranking-page">
    <div class="ranking-heading">
      <div>
        <div class="eyebrow">TAMAVERSE LEADERBOARD</div>
        <h1 class="page-title">Hall of Fame</h1>
        <p class="subtle">Para petualang terbaik di dunia Tamaverse.</p>
      </div>
      <div class="ranking-heading-mark">✦</div>
    </div>

    <div class="ranking-hero">
      <div class="ranking-hero-glow"></div>
      <div class="ranking-hero-copy">
        <span class="ranking-live-tag"><i></i> GLOBAL RANKING</span>
        <h2>Rise to the top.</h2>
        <p>Pilih kategori dan lihat siapa yang memimpin leaderboard.</p>
      </div>
      <div class="ranking-hero-art" aria-hidden="true"><span>🏆</span><i>✦</i><b>✧</b></div>
    </div>

    <div class="ranking-filter-wrap">
      <div class="ranking-filter-label">RANKING CATEGORY</div>
      <div class="rank-tabs">
        ${categories.map(([key,label]) => `
          <button class="rank-tab ${category===key?'active':''}" onclick="window.setRankingSort('${key}')">
            ${key==='rating'?'✦':key==='level'?'⬆':key==='wins'?'⚔':'◈'} <span>${label}</span>
          </button>
        `).join('')}
      </div>
    </div>

    ${current ? `
      <div class="ranking-you-card">
        <div class="ranking-you-avatar">${playerAvatarMarkup(current.avatar,'ranking-avatar-photo')}</div>
        <div class="ranking-you-copy"><small>YOUR POSITION</small><b>${esc(current.name)}</b><span>${esc(labels[category])}</span></div>
        <div class="ranking-you-place"><small>RANK</small><strong>#${currentIndex+1}</strong></div>
      </div>
    ` : ''}

    ${window.TAMAVERSE_RANKING_LOADING && !data.length ? '<div class="ranking-state"><span class="ranking-loader"></span><b>Memuat leaderboard...</b><small>Sedang mengambil data pemain global</small></div>' : ''}
    ${window.TAMAVERSE_RANKING_ERROR ? `<div class="ranking-state ranking-error"><b>Leaderboard belum tersedia</b><small>${esc(window.TAMAVERSE_RANKING_ERROR)}</small></div>` : ''}
    ${!window.TAMAVERSE_RANKING_LOADING && !data.length && !window.TAMAVERSE_RANKING_ERROR ? '<div class="ranking-state"><b>Belum ada pemain</b><small>Jadilah salah satu petualang pertama di Tamaverse.</small></div>' : ''}

    ${podium.length ? `
      <div class="ranking-section-title"><div><small>THE ELITE THREE</small><h2>Top Players</h2></div><span>${rows.length} PLAYERS</span></div>
      <div class="ranking-podium">
        ${podium.map((r,i)=>`
          <article class="ranking-podium-card rank-place-${i+1} ${r.me?'is-you':''}">
            <div class="ranking-podium-medal">${medal[i]}</div>
            <div class="ranking-podium-avatar">${playerAvatarMarkup(r.avatar,'ranking-avatar-photo')}</div>
            <b class="ranking-podium-name">${esc(r.name)}${r.me?' · You':''}</b>
            <small>LEVEL ${Number(r.level||1)}</small>
            <strong class="ranking-podium-score">${metric(r)}</strong>
            <span class="ranking-podium-metric">${esc(labels[category])}</span>
            <div class="ranking-podium-base"><i></i></div>
          </article>
        `).join('')}
      </div>
    ` : ''}

    ${rest.length ? `
      <div class="ranking-section-title ranking-list-title"><div><small>KEEP CLIMBING</small><h2>Leaderboard</h2></div><span>RANK 04–${rows.length.toLocaleString('id-ID')}</span></div>
      <div class="ranking-list-card">
        ${rest.map((r,i)=>`
          <div class="ranking-list-row ${r.me?'is-you':''}">
            <div class="ranking-list-position">${String(i+4).padStart(2,'0')}</div>
            <div class="ranking-list-avatar">${playerAvatarMarkup(r.avatar,'ranking-avatar-photo')}</div>
            <div class="ranking-list-player"><b>${esc(r.name)}${r.me?' <small>YOU</small>':''}</b><span>Lv. ${Number(r.level||1)} · ${Number(r.wins||0)} wins</span></div>
            <strong>${metric(r)}<small>${esc(labels[category])}</small></strong>
          </div>
        `).join('')}
      </div>
    ` : ''}
    <div class="ranking-footnote">Ranking diperbarui dari data akun Tamaverse.</div>
  </section>`;
}

function legacy_profilePage(){const p=activePet();return `<section class="page"><div class="eyebrow">AKUN TAMAVERSE</div><h1 class="page-title">Profile & Tas</h1><div class="card profile-card"><div class="avatar">${state.player.avatar}</div><h2>${esc(state.player.name)}</h2><div class="user-id-box" style="margin:12px 0;padding:12px;background:var(--card-bg,#f4d4e3);border-radius:12px">
  <small class="muted-label">UUID AKUN TAMAVERSE</small>
  <p id="supabaseUserId" style="overflow-wrap:anywhere;margin:8px 0;color:var(--text-color,#302638)">
    ${esc(window.TAMAVERSE_USER_ID || 'Memuat ID...')}
  </p>
  <button class="button secondary full" data-action="copy-user-id">
    📋 Salin UUID
  </button>
  <button class="button primary full" data-action="create-telegram-link" style="margin-top:8px">
    🔗 Hubungkan Telegram Bot
  </button>
  <small class="muted-label">Salin UUID untuk identitas akun. Buka @Nexorapaymbot jika ingin menghubungkan akun.</small>
</div>
<div class="profile-stats"><div class="profile-stat"><strong>Lv. ${state.player.level}</strong><span>LEVEL PEMAIN</span></div><div class="profile-stat"><strong>${state.player.rating}</strong><span>RATING</span></div><div class="profile-stat"><strong>${state.player.wins}/${state.player.losses}/${state.player.draws}</strong><span>W/L/D</span></div><div class="profile-stat"><strong>${state.pets.length}/12</strong><span>KOLEKSI</span></div><div class="profile-stat"><strong>${state.player.streak} hari</strong><span>LOGIN STREAK</span></div><div class="profile-stat"><strong>${state.player.xp}/${state.player.level*100}</strong><span>PLAYER XP</span></div></div><button class="button secondary full" style="margin-top:13px" data-action="rename-player">✏️ Ubah nama</button></div><div class="section-heading"><h2>🎒 Inventori</h2></div><button class="button secondary full" data-action="inventory">🎒 Buka Inventori</button><div class="notice">☁️ Progres game disimpan di perangkat ini dan disinkronkan ke akun TAMAVERSE saat koneksi tersedia.</div><button class="button danger full" data-action="reset">Reset semua data</button></section>`;}
const dailyRewards=[
  {icon:'🪙',label:'50 koin',type:'coins',amount:50},
  {icon:'🍓',label:'2 camilan',type:'snack',amount:2},
  {icon:'🪙',label:'80 koin',type:'coins',amount:80},
  {icon:'💎',label:'1 diamond',type:'diamonds',amount:1},
  {icon:'⚡',label:'2 ramuan',type:'energy',amount:2},
  {icon:'🪙',label:'150 koin',type:'coins',amount:150},
  {icon:'🎁',label:'2 diamond + 100 koin',type:'grand',amount:0}
];
function dailyRewardDay(){
  const reward=state.dailyReward||{lastClaimDate:'',day:0};
  const today=new Date().toISOString().slice(0,10);
  if(reward.lastClaimDate===today)return reward.day||1;
  const yesterday=new Date(Date.now()-86400000).toISOString().slice(0,10);
  return reward.lastClaimDate===yesterday?(reward.day%7)+1:1;
}
function dailyRewardCard(){
  const reward=state.dailyReward||{lastClaimDate:'',day:0};
  const claimed=reward.lastClaimDate===new Date().toISOString().slice(0,10);
  const day=dailyRewardDay();
  return `<div class="card daily-reward-card"><div class="daily-reward-days">${dailyRewards.map((item,index)=>`<div class="daily-reward-day ${index+1===day?'today':''} ${claimed&&index+1===day?'claimed':''}"><span>${claimed&&index+1===day?'✓':item.icon}</span><small>Hari ${index+1}</small></div>`).join('')}</div><div class="daily-reward-footer"><div><b>${claimed?'Hadiah hari ini sudah diklaim':`Hadiah hari ${day}: ${dailyRewards[day-1].label}`}</b><p>${claimed?'Kembali besok untuk hadiah berikutnya.':'Klaim hadiah login hari ini!'}</p></div><button class="button" data-action="claim-daily" ${claimed?'disabled':''}>${claimed?'Diklaim':'Klaim'}</button></div></div>`;
}
async function spendDiamonds(amount,reason){
  const cost=Math.floor(Number(amount));
  if(!Number.isFinite(cost)||cost<1){showToast('Jumlah Diamond tidak valid.');return false;}
  const db=window.TAMAVERSE_SUPABASE_CLIENT;
  if(!db?.rpc||!window.TAMAVERSE_USER_ID){
    showToast('Akun belum tersambung. Diamond hanya bisa digunakan saat online.');
    return false;
  }
  try{
    // The database is authoritative; do not reject from a potentially stale local balance.
    const {data,error}=await db.rpc('tamaverse_spend_diamonds',{p_amount:cost,p_reason:reason});
    if(error)throw error;
    const result=Array.isArray(data)?data[0]:data;
    if(!result||result.success!==true)throw new Error('Pengeluaran Diamond gagal.');
    state.player.diamonds=Number(result.diamonds??state.player.diamonds);
    return true;
  }catch(error){
    console.error('Diamond spend failed:',error);
    const message=String(error?.message||'');
    showToast(message.includes('NOT_ENOUGH_DIAMONDS')?'Diamond tidak cukup.':message||'Pengeluaran Diamond gagal.');
    return false;
  }
}
async function claimDailyReward(){
  const db=window.TAMAVERSE_SUPABASE_CLIENT;
  if(!db?.rpc||!window.TAMAVERSE_USER_ID){
    showToast('Akun belum tersambung. Hadiah harian perlu diklaim saat online.');
    return;
  }
  try{
    const {data,error}=await db.rpc('tamaverse_claim_daily_reward');
    if(error)throw error;
    const result=Array.isArray(data)?data[0]:data;
    const day=Number(result?.day||0);
    const reward=dailyRewards[day-1];
    if(result?.success!==true||!reward)throw new Error('Hadiah harian tidak valid.');
    state.dailyReward={lastClaimDate:new Date().toISOString().slice(0,10),day};
    state.player.coins=Number(result.coins??state.player.coins);
    state.player.diamonds=Number(result.diamonds??state.player.diamonds);
    state.items.snack=Number(result.snack??state.items.snack??0);
    state.items.energy=Number(result.energy??state.items.energy??0);
    save();closeModal();render();showToast(`Hadiah Hari ${day} diklaim: ${reward.label}!`);
  }catch(error){
    console.error('Daily reward claim failed:',error);
    const message=String(error?.message||'');
    showToast(message.includes('DAILY_REWARD_ALREADY_CLAIMED')?'Hadiah hari ini sudah diklaim.':message||'Hadiah harian gagal diklaim.');
  }
}
function questPreview(){return questDefinitions().filter(q=>state.quests.active.includes(q.id)).slice(0,2).map(questRow).join('');}
function questDefinitions(){return [{id:'feed',title:'Beri makan pet',target:2,icon:'🍓',reward:35,xp:40,difficulty:'Mudah'},{id:'play',title:'Bermain bersama',target:2,icon:'💖',reward:35,xp:40,difficulty:'Mudah'},{id:'egg',title:'Buka telur',target:1,icon:'🥚',reward:40,xp:45,difficulty:'Normal'},{id:'battle',title:'Selesaikan battle 5x',target:5,icon:'⚔️',reward:50,xp:50,difficulty:'Sulit'},{id:'win',title:'Menangkan battle',target:1,icon:'🏆',reward:60,xp:60,difficulty:'Tantangan'}];}
function questList(){return questDefinitions().filter(q=>state.quests.active.includes(q.id)).map(questRow).join('');}
function questRow(q){const progress=state.quests.progress[q.id]||0,done=progress>=q.target,claimed=state.quests.claimed.includes(q.id),rebought=state.quests.rebought.includes(q.id);let action='';if(claimed)action=rebought?'<button class="button daily-quest-claim secondary" disabled>Limit</button>':`<button class="button daily-quest-claim secondary" data-action="rebuy-quest" data-quest="${q.id}">↻ 1 💎</button>`;else action=`<button class="button daily-quest-claim" data-action="claim" data-quest="${q.id}" ${!done?'disabled':''}>${done?'Klaim':'Belum'}</button>`;return `<div class="daily-quest-item"><span class="daily-quest-icon">${q.icon}</span><div class="daily-quest-info"><strong>${q.title}</strong><small>${Math.min(progress,q.target)}/${q.target} · ${q.difficulty} · 🪙 ${q.reward} · ✨ ${q.xp} XP</small><span class="daily-quest-track"><i style="width:${Math.min(100,progress/q.target*100)}%"></i></span></div>${action}</div>`;}
function startIntro(){
  clearIntroSequence();
  const sequenceToken=introSequenceToken;
  showModal(`<div class="hatch-egg intro-egg-stage"><div class="egg-crack-wrap">${eggImage('basic')}<span class="egg-crack-line"></span><span class="egg-spark">✦</span></div></div><div class="eyebrow" style="text-align:center">TELUR GRATIS</div><h2 id="modalTitle" style="text-align:center">Ada yang bergerak...</h2><p style="text-align:center">Telurnya mulai bergetar. Siap-siap menyambut teman barumu!</p>`);
  const eggWrap=document.querySelector('.egg-crack-wrap');
  const eggImageEl=eggWrap?.querySelector('img');
  if(!eggWrap)return;
  let started=false;
  const beginVisibleHatch=()=>{
    if(started||sequenceToken!==introSequenceToken||!eggWrap.isConnected)return;
    started=true;
    eggWrap.classList.add('is-running');
    [[1200,.18],[2500,.12],[3800,.075],[4600,.055]].forEach(([delay,speed])=>{
      introSequenceTimers.push(setTimeout(()=>{
        if(sequenceToken===introSequenceToken&&eggWrap.isConnected)eggWrap.style.animationDuration=`${speed}s`;
      },delay));
    });
    introSequenceTimers.push(setTimeout(()=>{
      if(sequenceToken!==introSequenceToken||!eggWrap.isConnected||document.getElementById('modalBackdrop').classList.contains('hidden'))return;
      showModal(`<div class="hatch-egg intro-pet-art pet-reveal">${petImage('fluffin','intro-pet-image')}</div><div class="eyebrow">WELCOME TO TAMAVERSE</div><h2 id="modalTitle">Mochi menetas!</h2><p>Isi nama pemain, pilih foto profil, lalu beri nama pet pertamamu.</p><div class="intro-avatar-picker"><span>FOTO PROFIL</span><label class="button secondary" for="starterAvatarFile">Pilih foto</label><input id="starterAvatarFile" class="visually-hidden" type="file" accept="image/*"><small>Foto Telegram akan dipakai otomatis jika tersedia.</small></div><label class="muted-label" for="starterPlayerName">NAMA PEMAIN</label><input class="text-input" id="starterPlayerName" maxlength="18" placeholder="Masukkan nama pemain" autocomplete="nickname" required><label class="muted-label" for="starterName">NAMA PET</label><input class="text-input" id="starterName" maxlength="18" value="Mochi" aria-label="Nama pet"><button class="button full" data-action="finish-intro">Ayo mulai!</button>`);
    },5000));
  };
  if(eggImageEl?.complete&&eggImageEl.naturalWidth>0)beginVisibleHatch();
  else if(eggImageEl){
    eggImageEl.addEventListener('load',beginVisibleHatch,{once:true});
    eggImageEl.addEventListener('error',beginVisibleHatch,{once:true});
    introSequenceTimers.push(setTimeout(beginVisibleHatch,1500));
  }else beginVisibleHatch();
}
function openNewPlayerBonusConfirmation(){
  showModal(`<div class="topup-success-modal">
    <div class="topup-success-icon">💎</div>
    <div class="topup-success-eyebrow">TAMAVERSE · LIMITED EVENT</div>
    <h2>100 DIAMOND GIFT</h2>
    <p class="topup-success-copy">Ada hadiah spesial untuk seluruh player Tamaverse! Kamu berhak menerima <b>100 Diamond</b> secara gratis.</p>
    <div class="topup-success-amount">+100 <span>DIAMOND</span></div>
    <p class="topup-success-thanks">Satu akun hanya dapat menerima hadiah ini satu kali selama periode event 2–11 November 2026.</p>
    <div class="modal-actions" style="display:grid;grid-template-columns:1fr 1fr;gap:9px">
      <button class="button secondary" type="button" data-action="close-modal">Nanti</button>
      <button class="button primary" type="button" data-action="accept-diamond-event">Terima</button>
    </div>
  </div>`);
}
function showNewPlayerBonusModal(amount=100){
  showModal(`<div class="topup-success-modal">
    <div class="topup-success-icon">💎</div>
    <div class="topup-success-eyebrow">TAMAVERSE · LIMITED EVENT</div>
    <h2>100 DIAMOND DROP!</h2>
    <p class="topup-success-copy">Terima kasih sudah jadi bagian dari Tamaverse. Ini hadiah spesial untuk seluruh player!</p>
    <div class="topup-success-amount">+${Number(amount).toLocaleString('id-ID')} <span>DIAMOND</span></div>
    <p class="topup-success-thanks">One player. One claim. A little more sparkle.</p>
    <button class="button primary topup-success-close" type="button" data-action="close-modal">Klaim berhasil</button>
  </div>`);
}
async function claimNewPlayerWelcomeBonus(){
  try{
    if(window.TAMAVERSE_AUTH_READY) await window.TAMAVERSE_AUTH_READY;
    if(typeof window.ensureTamaverseAuth!=='function') throw new Error('Autentikasi akun belum siap.');
    await window.ensureTamaverseAuth();
    const db=window.TAMAVERSE_SUPABASE_CLIENT;
    if(!db) throw new Error('Koneksi cloud belum tersedia.');
    const {data,error}=await db.rpc('tamaverse_claim_new_player_bonus');
    if(error) throw error;
    if(data?.success){
      state.player.diamonds=Number(data.diamonds??state.player.diamonds);
      save();
      render();
      showNewPlayerBonusModal(Number(data.bonus)||100);
      return true;
    }
    if(data?.already_claimed){
      state.player.diamonds=Number(data.diamonds??state.player.diamonds);
      save();
      render();
      showModal(`<div class="eyebrow">TAMAVERSE · LIMITED EVENT</div>
        <h2>Hadiah sudah diklaim</h2>
        <p class="subtle">Setiap player hanya punya satu kesempatan. Diamond bonus 100 sudah pernah masuk ke akun ini.</p>
        <button class="button full" data-action="close-modal">Oke, mengerti</button>`);
      return true;
    }
    if(data?.event_ended){
      showModal(`<div class="eyebrow">TAMAVERSE · LIMITED EVENT</div>
        <h2>Event telah berakhir</h2>
        <p class="subtle">Periode klaim 100 Diamond sudah selesai. Terima kasih sudah ikut meramaikan Tamaverse!</p>
        <button class="button full" data-action="close-modal">Tutup</button>`);
      return false;
    }
    if(data?.eligible===false){
      showModal(`<div class="eyebrow">TAMAVERSE · LIMITED EVENT</div>
        <h2>Event belum tersedia</h2>
        <p class="subtle">Periode klaim 100 Diamond adalah 2–11 November 2026.</p>
        <button class="button full" data-action="close-modal">Tutup</button>`);
      return false;
    }
    throw new Error('Respons klaim tidak dikenali dari server.');
  }catch(error){
    console.error('100 Diamond event claim failed:',error);
    const reason=String(error?.message||error||'Unknown error').slice(0,220);
    showModal(`<div class="eyebrow">TAMAVERSE · LIMITED EVENT</div>
      <h2>Klaim belum berhasil</h2>
      <p class="subtle">Server belum bisa memproses hadiah. Detail: ${esc(reason)}</p>
      <button class="button full" data-action="retry-new-player-bonus">Coba lagi</button>
      <button class="button secondary full" data-action="close-modal">Nanti saja</button>`);
    return false;
  }
}
async function finishIntro(){
  const playerName=(document.getElementById('starterPlayerName')?.value||'').trim().slice(0,18);
  const name=(document.getElementById('starterName')?.value||'Mochi').trim().slice(0,18)||'Mochi';
  if(!playerName){showToast('Nama pemain wajib diisi dulu.');document.getElementById('starterPlayerName')?.focus();return;}
  const finishButton=document.querySelector('[data-action="finish-intro"]');
  if(finishButton){finishButton.disabled=true;finishButton.textContent='Menyiapkan pet...';}
  const photo=window.Telegram?.WebApp?.initDataUnsafe?.user?.photo_url||'';
  const pendingAvatar=window.TAMAVERSE_PENDING_AVATAR||photo||'🧙';
  state=freshState(playerName);
  state.player.avatar=pendingAvatar;
  state.player.avatarUrl='';
  window.TAMAVERSE_PENDING_AVATAR='';
  const pet=createPet('fluffin',name);
  state.pets.push(pet);
  state.activePet=pet.uid;
  state.introStoryStarted=true;
  state.introStoryCompleted=false;
  state.introStoryIndex=0;
  closeModal();
  page='home';
  save();
  render();
  if(/^data:image\//i.test(pendingAvatar)){
    try{
      const url=await window.uploadTamaverseAvatar(pendingAvatar);
      state.player.avatarUrl=url;
      state.player.avatar=url;
      save();
      render();
    }catch(error){
      console.error('Starter avatar upload failed:',error);
      showToast('Game dimulai, tetapi foto belum tersinkron. Ganti foto lagi dari Profile.');
    }
  }
}
function legacy_createPet(speciesId,name){const s=speciesById(speciesId);return {uid:'pet-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,5),species:s.id,name:name||s.name,level:1,xp:0,hp:s.stats.hp,stats:{...s.stats},hunger:100,happiness:100,energy:80,cleanliness:100,evolution:0,fragments:0,sleeping:false,sleepStartedAt:0,careUpdatedAt:Date.now()};}
function addPet(speciesId){const s=speciesById(speciesId);const existing=state.pets.find(p=>p.species===speciesId);if(existing){state.items.fragments[speciesId]=(state.items.fragments[speciesId]||0)+1;addCoins(20);return {duplicate:true,pet:existing,s};}const p=createPet(speciesId,s.name);state.pets.push(p);if(!state.activePet)state.activePet=p.uid;return {duplicate:false,pet:p,s};}
function grantPetXP(p,amount){p.xp+=amount;while(p.xp>=p.level*40){p.xp-=p.level*40;p.level++;p.stats.hp+=5;p.stats.atk+=1;p.stats.def+=1;showToast(`${p.name} naik ke Level ${p.level}!`);}}
function playerXP(amount){const boostedAmount=Math.max(0,Math.round((Number(amount)||0)*1.3));state.player.xp+=boostedAmount;while(state.player.xp>=state.player.level*100){state.player.xp-=state.player.level*100;state.player.level++;addCoins(50);showToast(`Level pemain naik! Hadiah +50 koin.`);}}
function chooseRarity(){const r=Math.random()*100;return r<60?'Common':r<85?'Rare':r<97?'Epic':'Legendary';}
function legacy_pullEgg(id,free){const e=eggs.find(x=>x.id===id);if(!e)return;if(free&&state.gacha.lastFree===new Date().toDateString()){showToast('Telur gratis hari ini sudah diklaim.');return;}const currency=e.currency==='diamond'?'diamonds':'coins';const cost=free?0:e.price;if(state.player[currency]<cost){showToast(`Koin/diamond tidak cukup untuk ${e.name}.`);return;}if(!free)state.player[currency]-=cost;else state.gacha.lastFree=new Date().toDateString();
  const pool=species.filter(s=>s.pool.includes(id));let rarity=chooseRarity();if(state.gacha.pityRare>=9&&['Common'].includes(rarity))rarity='Rare';if(state.gacha.pityEpic>=49&&['Common','Rare'].includes(rarity))rarity='Epic';let candidates=pool.filter(s=>s.rarity===rarity);if(!candidates.length){const available=pool.filter(s=>s.rarity==='Common'||s.rarity==='Rare'||s.rarity==='Epic'||s.rarity==='Legendary');candidates=available;}const chosen=candidates[Math.floor(Math.random()*candidates.length)];state.gacha.pityRare=chosen.rarity==='Common'?state.gacha.pityRare+1:0;state.gacha.pityEpic=['Common','Rare'].includes(chosen.rarity)?state.gacha.pityEpic+1:0;state.quests.progress.egg++;const result=addPet(chosen.id);state.gacha.history.unshift({species:chosen.id,name:chosen.name,rarity:chosen.rarity,date:Date.now()});state.gacha.history=state.gacha.history.slice(0,20);save();render();showModal(`<div class="hatch-egg">${petImage(chosen.id, 'detail-pet-image')}✨</div><div class="eyebrow" style="text-align:center">TELUR MENETAS</div><h2 id="modalTitle" style="text-align:center">${result.duplicate?'Duplikat! Fragmen didapat':esc(chosen.name)}</h2><p style="text-align:center"><span class="rarity rarity-${chosen.rarity}">${chosen.rarity}</span> · ${chosen.element}<br>${result.duplicate?'+1 fragmen spesies dan 20 koin':'Teman baru masuk koleksimu!'}</p><div class="stats-row"><div class="stat-tile"><strong>${chosen.stats.hp}</strong><span>HP</span></div><div class="stat-tile"><strong>${chosen.stats.atk}</strong><span>ATK</span></div><div class="stat-tile"><strong>${chosen.stats.def}</strong><span>DEF</span></div></div><button class="button full" style="margin-top:14px" data-action="close-modal">Keren!</button>`);}
function buyItem(type,quantity=1){const shop={food:{name:'Apple',price:50},energy:{name:'Energy Potion',price:40},snack:{name:'Health Potion',price:60},training:{name:'Training Manual',price:120}};const item=shop[type];if(!item)return;const rawQty=Number(quantity);if(!Number.isSafeInteger(rawQty)||rawQty<1||rawQty>MAX_COINS){showToast('Jumlah pembelian tidak valid.');return;}const qty=rawQty;const total=item.price*qty;if(!Number.isSafeInteger(total)||total>MAX_COINS){showToast('Jumlah pembelian melewati batas.');return;}if(!Number.isSafeInteger(Number(state.player.coins))||state.player.coins<0){showToast('Saldo Coin tidak valid. Muat ulang akun.');return;}if(state.player.coins<total){showToast(`Koin tidak cukup. Butuh ${total} Coins untuk ${qty} ${item.name}.`);return;}state.player.coins-=total;if(type==='food')state.items.food=(state.items.food||0)+qty;else state.items[type]=(state.items[type]||0)+qty;shopQuantities[type]=1;save();render();showToast(`${qty} ${item.name} berhasil dibeli!`);}
const shopCatalog=[
  {id:'food',icon:'🍎',image:'assets/items/Apple.webp',name:'Apple',category:'CARE',desc:'Memulihkan Hunger companion sebanyak 50 poin.',price:50,owned:()=>state.items.food||0,tag:'Pet care'},
  {id:'energy',icon:'⚡',image:'assets/items/EnergyPotion.webp',name:'Energy Potion',category:'CARE',desc:'Memulihkan Energy companion sebanyak 30 poin.',price:40,owned:()=>state.items.energy||0,tag:'Energy'},
  {id:'snack',icon:'♥',image:'assets/items/HealthPotion.webp',name:'Health Potion',category:'BATTLE',desc:'Memulihkan HP companion saat pertarungan berlangsung.',price:60,owned:()=>state.items.snack||0,tag:'Battle item'},
  {id:'training',icon:'📘',image:'assets/items/TrainingManual.webp',name:'Training Manual',category:'TRAINING',desc:'Mengurangi biaya Energy saat melakukan Training.',price:120,owned:()=>state.items.training||0,tag:'Training'}
];
function shopPage(){
  const totalOwned=shopCatalog.reduce((sum,item)=>sum+Number(item.owned()||0),0);
  return `<section class="page shop-page">
    <div class="shop-page-heading"><div><span class="eyebrow">TAMAVERSE MARKET</span><h1 class="page-title">Shop</h1><p class="subtle">Everything your companion needs, all in one place.</p></div><span class="shop-heading-mark">✦</span></div>
    <div class="shop-hero">
      <div class="shop-hero-copy"><span class="shop-hero-label">SUPPLY DEPOT · 01</span><h2>Ready for your next adventure?</h2><p>Stock up on essentials for care, training, and battle.</p><div class="shop-hero-stats"><div><small>YOUR BALANCE</small><strong>🪙 ${Number(state.player.coins||0).toLocaleString('id-ID')}</strong></div><div><small>ITEMS OWNED</small><strong>${totalOwned}</strong></div></div></div>
      <div class="shop-hero-art"><span>🛍️</span><i>✦</i><b>✧</b></div>
    </div>
    <div class="shop-section-head"><div><span class="eyebrow">CURATED FOR YOUR JOURNEY</span><h2>Available supplies</h2></div><span class="shop-count">${shopCatalog.length} ITEMS</span></div>
    <div class="shop-catalog-grid">${shopCatalog.map(item=>{
      const qty=Math.max(1,Math.floor(Number(shopQuantities[item.id])||1));
      const affordable=Math.floor(Number(state.player.coins||0)/item.price);
      const total=qty*item.price;
      const canBuy=affordable>=qty;
      return `<article class="shop-product-card">
        <div class="shop-product-top"><span class="shop-product-category">${item.category}</span><span class="shop-product-owned">OWNED × ${Number(item.owned()||0)}</span></div>
        <div class="shop-product-art shop-art-${item.id}">${item.image?`<img src="${item.image}" alt="${item.name}" loading="lazy" decoding="async">`:`<span>${item.icon}</span>`}<i>✦</i></div>
        <div class="shop-product-info"><span class="shop-product-tag">${item.tag}</span><h3>${item.name}</h3><p>${item.desc}</p></div>
        <div class="shop-product-footer"><strong>🪙 ${item.price.toLocaleString('id-ID')} <small>/ item</small></strong>
          <div class="shop-quantity"><button class="shop-qty-btn" data-action="qty-minus" data-item="${item.id}" aria-label="Kurangi jumlah">−</button><b>${qty}</b><button class="shop-qty-btn" data-action="qty-plus" data-item="${item.id}" aria-label="Tambah jumlah">+</button><button class="shop-max-btn" data-action="qty-max" data-item="${item.id}">MAX</button></div>
          <div class="shop-buy-row"><span>Total <b>🪙 ${total.toLocaleString('id-ID')}</b></span><button class="button shop-buy-btn" data-action="buy" data-item="${item.id}" ${canBuy?'':'disabled'}>${canBuy?'Buy item':'Not enough'}</button></div>
        </div>
      </article>`;
    }).join('')}</div>
    <div class="shop-footer-note"><span>✧</span><div><b>Manage your supplies</b><p>Purchased items are added to your inventory and ready to use.</p><button class="button secondary" data-action="inventory">Open Inventory</button></div></div>
  </section>`;
}
function startBattle(mode){
  const p=activePet();
  if(!p){showToast('Kamu belum punya pet!');return;}
  if(petSleeping(p)){showToast(`${p.name} sedang tidur. Bangunkan dulu sebelum battle.`);return;}
  if(p.happiness<20){showToast(battleMoodMessage(p));return;}
  if(p.energy<25){showToast('Energi pet minimal 25 untuk battle.');return;}
  if(battle)return;
  p.energy=clamp(p.energy-25,0,100);p.careUpdatedAt=Date.now();
  const opponent=soloEnemyForWave(0);
  battle={mode:'practice',petId:p.uid,opponent,playerHP:p.stats.hp,enemyHP:opponent.stats.hp,turn:1,wave:1,clearedLevels:0,coinsEarned:0,xpEarned:0,skillUsed:false,enemySkillUsed:false,enemyItemUsed:false,defending:false,enemyDefending:false,phase:'player',busy:false,aiTimer:null,log:[`${p.name} memasuki Hunting Tower!`,`Level 1 · ${opponent.name} muncul!`],ended:false};
  save();render();
}
function soloEnemyForWave(index){
  const base=species[index%species.length];
  const tier=index;
  const hpScale=.68+tier*.115;
  const atkScale=.52+tier*.105;
  const defScale=.55+tier*.085;
  const enemyLevel=tier+1;
  return {...base,level:enemyLevel,name:base.name,stats:{
    ...base.stats,
    hp:Math.round(base.stats.hp*hpScale),
    atk:Math.max(3,Math.round(base.stats.atk*atkScale)),
    def:Math.max(2,Math.round(base.stats.def*defScale)),
    spd:Math.max(5,Math.round(base.stats.spd*(.75+tier*.025)))
  }};
}
function advanceHuntingLevel(){
  if(!battle||battle.ended)return;
  const cleared=battle.wave;
  battle.clearedLevels++;
  battle.coinsEarned+=10+cleared*2;
  battle.xpEarned+=40+cleared*5;
  if(cleared>=species.length){finishBattle('win');return;}
  battle.phase='transition';battle.busy=true;battle.actionFx='level-up';
  battle.log.push(`Level ${cleared} clear! Bersiap menuju level ${cleared+1}.`);
  save();render();
  battle.aiTimer=setTimeout(()=>{
    if(!battle||battle.ended||battle.phase!=='transition')return;
    const nextIndex=battle.wave;
    battle.wave++;
    battle.turn=1;
    battle.opponent=soloEnemyForWave(nextIndex);
    battle.enemyHP=battle.opponent.stats.hp;
    battle.enemySkillUsed=false;battle.enemyItemUsed=false;battle.enemyDefending=false;
    battle.phase='entering';battle.busy=true;battle.actionFx='level-enter';
    battle.log.push(`LEVEL ${battle.wave} · ${battle.opponent.name} memasuki arena!`);
    save();if(page==='battle')render();
    battle.aiTimer=setTimeout(()=>{if(!battle||battle.ended||battle.phase!=='entering')return;battle.phase='player';battle.busy=false;battle.actionFx='idle';save();if(page==='battle')render();},2100);
  },1500);
}
function elementMultiplier(a,b){const strong={Fire:'Nature',Nature:'Water',Water:'Fire',Light:'Fire'};if(strong[a]===b)return 1.25;if(strong[b]===a)return .8;return 1;}
function legacy_battleAction(move){
  if(!battle||battle.ended||battle.phase!=='player'||battle.busy)return;
  if(!['attack','skill','defend','item'].includes(move))return;
  if(move==='skill'&&battle.skillUsed){showToast('Skill sudah digunakan pada battle ini.');return;}
  const p=petById(battle.petId);if(!p)return;
  if(move==='item'&&Number(state.items.snack||0)<1){showToast('Item battle habis.');return;}
  battle.busy=true;
  const ps=speciesById(p.species),os=speciesById(battle.opponent.species);
  battle.actionFx=move;
  if(move==='attack'||move==='skill'){
    const guard=battle.enemyDefending?.45:1;
    const damage=Math.max(4,Math.round((p.stats.atk+(move==='skill'?10:0)-battle.opponent.stats.def*.35)*(0.85+Math.random()*.3)*elementMultiplier(ps.element,os.element)*guard));
    const finalDamage=Math.random()<.1?Math.round(damage*1.5):damage;
    battle.enemyHP=Math.max(0,battle.enemyHP-finalDamage);
    battle.log.push(`${p.name} ${move==='skill'?'menggunakan Skill':'menyerang'} dan memberi ${finalDamage} damage!`);
    battle.enemyDefending=false;
    if(move==='skill')battle.skillUsed=true;
  }else if(move==='defend'){
    battle.defending=true;
    battle.log.push(`${p.name} bersiap bertahan.`);
  }else{
    state.items.snack--;
    const healed=Math.min(25,Math.max(0,p.stats.hp-battle.playerHP));
    battle.playerHP=Math.min(p.stats.hp,battle.playerHP+25);
    battle.log.push(`${p.name} memakai Health Potion dan memulihkan ${healed} HP.`);
  }
  battle.log=battle.log.slice(-30);
  save();
  if(battle.enemyHP<=0){finishBattle('win');return;}
  battle.phase='ai';
  render();
  battle.aiTimer=setTimeout(runHuntingAiTurn,850);
}
function legacy_finishBattle(result){if(!battle||battle.ended)return;battle.ended=true;if(battle.aiTimer)clearTimeout(battle.aiTimer);const p=petById(battle.petId);if(result==='win'){state.player.wins++;state.player.rating+=battle.mode==='simulated'?12:5;addCoins(35);playerXP(50);grantPetXP(p,50);state.quests.progress.win++;showToast('Menang! +35 koin, XP pet & pemain.');}else if(result==='loss'){state.player.losses++;state.player.rating=Math.max(0,state.player.rating-5);grantPetXP(p,40);showToast('Kalah, tapi pet mendapat pengalaman.');}else{state.player.draws++;showToast('Battle berakhir seri.');}state.quests.progress.battle++;state.battleHistory.unshift({result,date:Date.now(),mode:battle.mode});state.battleHistory=state.battleHistory.slice(0,20);save();battle=null;render();showModal(`<div class="hatch-egg">${result==='win'?'🏆':result==='draw'?'🤝':'💫'}</div><h2 id="modalTitle" style="text-align:center">${result==='win'?'Kemenangan!':result==='draw'?'Seri!':'Pertarungan selesai'}</h2><p style="text-align:center">${result==='win'?'Hebat! Petmu memperoleh hadiah battle.':result==='draw'?'Pertarungan berakhir imbang.':'Jangan menyerah, petmu tetap mendapat XP.'}</p><button class="button full" data-action="close-modal">Lanjut</button>`);}
function legacy_inspectPet(uid){const p=petById(uid);if(!p)return;const s=speciesById(p.species);selectedPetId=uid;showModal(`<div class="pet-detail-art">${petImage(s.id, 'detail-pet-image', true)}</div><div class="eyebrow">${s.element} · ${s.rarity}</div><h2 id="modalTitle">${esc(p.name)} · Lv.${p.level}</h2><p>${s.name} · Evolusi ${p.evolution}/100</p><div class="stats-row"><div class="stat-tile"><strong>${p.stats.hp}</strong><span>HP</span></div><div class="stat-tile"><strong>${p.stats.atk}</strong><span>ATK</span></div><div class="stat-tile"><strong>${p.stats.def}</strong><span>DEF</span></div></div><div class="modal-actions"><button class="button secondary" data-action="nickname-pet">Ubah nama</button><button class="button" data-action="set-active" data-pet="${uid}">${uid===state.activePet?'Pet aktif':'Pilih aktif'}</button></div>`);}
function showDailyQuests(){
  showModal(`<div class="eyebrow">TAMAVERSE · DAILY MISSIONS</div><h2 id="modalTitle">Daily Quests</h2><p class="subtle">Selesaikan misi untuk mendapatkan Coins dan XP.</p><div class="daily-quest-list">${questList()}</div><button class="button secondary full" data-action="close-modal">Tutup</button>`);
}
function showInventory(){
  const fragments=Object.values(state.items.fragments||{}).reduce((a,b)=>a+b,0);
  const items=[
    {id:'food',icon:'🍎',image:'assets/items/Apple.webp',name:'Apple',desc:'Memulihkan Hunger +50',count:state.items.food||0,care:'feed',usable:true},
    {id:'snack',icon:'♥',image:'assets/items/HealthPotion.webp',name:'Health Potion',desc:'Memulihkan HP saat battle',count:state.items.snack||0,note:'Gunakan saat battle',usable:false},
    {id:'energy',icon:'⚡',image:'assets/items/EnergyPotion.webp',name:'Energy Potion',desc:'Memulihkan Energy +30',count:state.items.energy||0,care:'energy',usable:true},
    {id:'training',icon:'📘',image:'assets/items/TrainingManual.webp',name:'Training Manual',desc:'Mengurangi biaya Energy saat Training',count:state.items.training||0,note:'Otomatis digunakan saat Training',usable:false}
  ];
  showModal(`<div class="eyebrow">TAMAVERSE · INVENTORY</div><h2 id="modalTitle">Your Items</h2><p class="subtle">Pilih item untuk melihat detail dan tindakan.</p>
    <div class="inventory-grid">${items.map(item=>`<button class="inventory-item-card" data-action="inventory-item" data-item="${item.id}"><span class="inventory-item-icon">${item.image?`<img src="${item.image}" alt="${item.name}" loading="lazy" decoding="async">`:item.icon}</span><b>${item.name}</b><small>${item.desc}</small><span class="inventory-item-count">× ${item.count}</span></button>`).join('')}
    <div class="inventory-fragment-card"><span>🧩</span><div><b>Fragments</b><small>Total fragments terkumpul</small></div><strong>${fragments}</strong></div></div>
    <button class="button secondary full" data-action="close-modal">Tutup</button>`);
}
function showInventoryItem(type){
  const items={
    food:{icon:'🍎',image:'assets/items/Apple.webp',name:'Apple',desc:'Memulihkan Hunger pet sebanyak 50 poin.',count:state.items.food||0,care:'feed',usable:true},
    energy:{icon:'⚡',image:'assets/items/EnergyPotion.webp',name:'Energy Potion',desc:'Memulihkan Energy pet sebanyak 30 poin.',count:state.items.energy||0,care:'energy',usable:true},
    snack:{icon:'♥',image:'assets/items/HealthPotion.webp',name:'Health Potion',desc:'Item pemulih HP yang digunakan saat battle.',count:state.items.snack||0,note:'Item ini digunakan dari menu battle.',usable:false},
    training:{icon:'📘',image:'assets/items/TrainingManual.webp',name:'Training Manual',desc:'Mengurangi biaya Energy saat melakukan Training.',count:state.items.training||0,note:'Manual akan otomatis digunakan saat Training.',usable:false}
  };
  const item=items[type];if(!item)return;
  const p=activePet();
  const disabled=!item.usable||item.count<1||!p||(type==='food'&&petSleeping(p))||(type==='energy'&&(petSleeping(p)||p.energy>=100));
  const note=item.note||(item.count<1?'Item tidak tersedia.':!p?'Kamu belum memiliki pet aktif.':type==='food'&&petSleeping(p)?'Pet sedang tidur.':type==='energy'&&petSleeping(p)?'Pet sedang tidur.':type==='energy'&&p.energy>=100?'Energy pet sudah penuh.':'Siap digunakan.');
  showModal(`<div class="eyebrow">TAMAVERSE · ITEM DETAILS</div><div class="inventory-item-detail"><span class="inventory-detail-icon">${item.image?`<img src="${item.image}" alt="${item.name}" loading="lazy" decoding="async">`:item.icon}</span><h2 id="modalTitle">${item.name}</h2><p class="subtle">${item.desc}</p><div class="inventory-detail-count">Owned <b>× ${item.count}</b></div><p class="muted-label">${note}</p><button class="button full" data-action="inventory-use" data-care="${item.care||''}" ${disabled?'disabled':''}>Use</button><button class="button secondary full" data-action="inventory">Back to Inventory</button></div>`);
}
function showShop(){showModal(`<div class="eyebrow">TAMAVERSE STORE</div><h2 id="modalTitle">Perlengkapan pet</h2><p class="store-caption">Pilih jumlah, lalu beli item yang dibutuhkan.</p><div class="store-list">${[['food','🍎','Apple','50'],['energy','⚡','Energy Potion','40'],['snack','♥','Health Potion','60'],['training','📘','Training Manual','120']].map(x=>`<div class="quest-row store-item"><div class="store-item-info"><span class="store-item-icon">${x[1]}</span><span class="store-item-name"><strong>${x[2]}</strong><small>🪙 ${x[3]} / item</small></span></div><div class="store-quantity"><button class="button secondary store-step" data-action="qty-minus" data-item="${x[0]}" aria-label="Kurangi jumlah">−</button><strong id="buyQty-${x[0]}">1</strong><button class="button secondary store-step" data-action="qty-plus" data-item="${x[0]}" aria-label="Tambah jumlah">+</button><button class="button secondary store-max" data-action="qty-max" data-item="${x[0]}">Max</button></div><button class="button store-buy" data-action="buy" data-item="${x[0]}">Beli</button></div>`).join('')}</div><button class="button secondary full store-close" data-action="close-modal">Tutup</button>`);}
function doClaim(id){const q=questDefinitions().find(x=>x.id===id);if(!q||!state.quests.active.includes(id)||state.quests.claimed.includes(id)||(state.quests.progress[id]||0)<q.target)return;state.quests.claimed.push(id);addCoins(q.reward);playerXP(q.xp);save();render();showDailyQuests();showToast(`Quest selesai! +${q.reward} koin +${q.xp} XP pemain.`);}
async function rebuyQuest(id){const q=questDefinitions().find(x=>x.id===id);if(!q||!state.quests.active.includes(id)||!state.quests.claimed.includes(id)||state.quests.rebought.includes(id))return;if(!(await spendDiamonds(1,'quest_rebuy')))return;state.quests.claimed=state.quests.claimed.filter(x=>x!==id);state.quests.rebought.push(id);state.quests.progress[id]=0;save();render();showDailyQuests();showToast(`Quest ${q.title} aktif kembali!`);}
function resetGame(){showModal(`<div class="eyebrow">KONFIRMASI</div><h2 id="modalTitle">Hapus semua progres?</h2><p>Data lokal, pet, dan koin akan dihapus dari perangkat ini. Tindakan ini tidak bisa dibatalkan.</p><div class="modal-actions"><button class="button secondary" data-action="close-modal">Batal</button><button class="button danger" data-action="confirm-reset">Hapus data</button></div>`);}

// Keep daily actions rewarding without allowing unlimited local XP or currency farming.
function loadSave(key){
  if(!key)return null;
  try{
    const raw=localStorage.getItem(key);
    if(!raw)return null;
    const saved=JSON.parse(raw);
    if(!saved||!saved.player||!Array.isArray(saved.pets))return null;
    const normalized=normalizeSavedState(saved);
    // Persist the legacy-currency conversion immediately so a reload cannot
    // merge the same old Gems balance into Diamonds a second time.
    if(Object.prototype.hasOwnProperty.call(saved.player,'gems')){
      localStorage.setItem(key,JSON.stringify(normalized));
    }
    return normalized;
  }catch(error){console.warn('Save tidak dapat dibaca:',error);return null;}
}
window.loadTamaverseAccountSave = (telegramId) => loadSave(accountSaveKey(telegramId));
window.saveTamaverseLocalAccount = save;
window.createTamaverseFreshState = freshState;

function normalizeSavedState(saved){
  const base=freshState(saved.player.name);
  const previousPlayer=saved.player;
  const toLocalDay=value=>{
    if(!value)return '';
    const date=new Date(value);
    return Number.isNaN(date.getTime())?String(value):date.toDateString();
  };
  base.player={...base.player,...previousPlayer,
    // One-time migration: preserve the old Gems balance and merge it into Diamonds.
    diamonds:Math.max(0,Number(previousPlayer.diamonds)||0)+Math.max(0,Number(previousPlayer.gems)||0),
    rating:Number.isFinite(previousPlayer.rating)?previousPlayer.rating:(previousPlayer.battleRating||1000),
    lastLogin:toLocalDay(previousPlayer.lastLogin||previousPlayer.lastLoginDate)
  };
  delete base.player.gems;
  base.pets=saved.pets.map(oldPet=>{
    const speciesId=oldPet.species||oldPet.speciesId||species[0].id;
    const kind=speciesById(speciesId);
    const oldStats=oldPet.stats||{};
    return {
      uid:oldPet.uid||oldPet.id||`pet-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,5)}`,
      species:kind.id,name:(oldPet.name && oldPet.name.trim().toLowerCase()===speciesId.toLowerCase())?kind.name:(oldPet.name||oldPet.nickname||kind.name),
      level:Math.max(1,Number(oldPet.level)||1),xp:Math.max(0,Number(oldPet.xp)||0),
      hp:Number(oldStats.hp||oldPet.hp)||kind.stats.hp,
      stats:{
        hp:Number(oldStats.hp||oldPet.hp)||kind.stats.hp,
        atk:Number(oldStats.atk||oldPet.attack)||kind.stats.atk,
        def:Number(oldStats.def||oldPet.defense)||kind.stats.def,
        spd:Number(oldStats.spd||oldStats.speed||oldPet.speed)||kind.stats.spd
      },
      hunger:clamp(Number.isFinite(oldPet.hunger)?oldPet.hunger:100,0,100),
      happiness:clamp(Number.isFinite(oldPet.happiness)?oldPet.happiness:100,0,100),
      energy:clamp(Number.isFinite(oldPet.energy)?oldPet.energy:80,0,100),
      cleanliness:clamp(Number.isFinite(oldPet.cleanliness)?oldPet.cleanliness:80,0,100),
      sleeping:!!oldPet.sleeping&&Number.isFinite(Number(oldPet.sleepStartedAt))&&Number(oldPet.sleepStartedAt)>0,
      sleepStartedAt:Number.isFinite(Number(oldPet.sleepStartedAt))&&Number(oldPet.sleepStartedAt)>0?Number(oldPet.sleepStartedAt):0,
      careUpdatedAt:Number.isFinite(Number(oldPet.careUpdatedAt))&&Number(oldPet.careUpdatedAt)>0?Number(oldPet.careUpdatedAt):Date.now(),
      evolution:Number(oldPet.evolution)||Math.max(0,(Number(oldPet.evolutionStage)||1)-1)*25,
      fragments:Number(oldPet.fragments)||0
    };
  });
  base.activePet=saved.activePet||saved.activePetId||base.pets[0]?.uid||null;
  const oldItems=saved.items||{},oldInventory=saved.inventory||{};
  base.items={
    food:Number(oldItems.food??oldInventory.food??0),
    snack:Number(oldItems.snack??0),
    energy:Number(oldItems.energy??oldInventory.energy??0),
    training:Number(oldItems.training??oldInventory.training??0),
    fragments:{...(oldItems.fragments||oldInventory.fragments||{})}
  };
  const oldGacha=saved.gacha||{},oldPity=oldGacha.pity||{};
  base.gacha={
    pityRare:Number(oldGacha.pityRare??Math.max(0,...Object.values(oldPity).map(item=>Number(item.noRare)||0))),
    pityEpic:Number(oldGacha.pityEpic??Math.max(0,...Object.values(oldPity).map(item=>Number(item.noEpic)||0))),
    lastFree:oldGacha.lastFree||oldGacha.freeEggDate||'',
    history:Array.isArray(oldGacha.history)?oldGacha.history.map(item=>{
      const matched=species.find(s=>s.id===item.species)||species.find(s=>s.name===(item.name||item.result));
      return {
        species:matched?.id||'',
        name:item.name||item.result||matched?.name||'Pet',
        rarity:item.rarity||matched?.rarity||'Common',
        date:typeof item.date==='number'?item.date:Date.now()
      };
    }):[],
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
    claimed:Array.isArray(oldQuests.claimed)?oldQuests.claimed:[],
    active:Array.isArray(oldQuests.active)&&oldQuests.active.length?oldQuests.active:questDefinitions().map(q=>q.id).slice(0,4),
    rebought:Array.isArray(oldQuests.rebought)?oldQuests.rebought:[]
  };
  const today=new Date().toDateString();
  base.equippedFrame=accessoryFrames.some(frame=>frame.id===saved.equippedFrame)?saved.equippedFrame:'common';
  base.lastCareUpdate=Number(saved.lastCareUpdate)||Date.now();
  base.dailyReward=saved.dailyReward?{...saved.dailyReward,lastClaimDate:(()=>{const value=saved.dailyReward.lastClaimDate;if(!value)return '';if(/^\d{4}-\d{2}-\d{2}$/.test(value))return value;const d=new Date(value);return Number.isNaN(d.getTime())?'':[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');})()}:{lastClaimDate:'',day:0};
  base.battleHistory=Array.isArray(saved.battleHistory)?saved.battleHistory:[];
  base.introStoryStarted=saved.introStoryStarted===true;
  base.introStoryCompleted=saved.introStoryCompleted===true;
  base.introStoryIndex=Math.max(0,Math.floor(Number(saved.introStoryIndex)||0));
  return base;
}
function createPet(speciesId,name){
  const s=speciesById(speciesId);
  const now=Date.now();
  return {uid:'pet-'+now.toString(36)+'-'+Math.random().toString(36).slice(2,5),species:s.id,name:name||s.name,level:1,xp:0,hp:s.stats.hp,stats:{...s.stats},hunger:100,happiness:100,energy:80,cleanliness:100,evolution:0,fragments:0,careUpdatedAt:now};
}
// Build a local companion from a cloud pet row when this device has no matching save.
window.createTamaversePetFromCloud = function(cloudPet){
  const kind=species.find(item=>item.id===String(cloudPet?.species||''));
  if(!kind||!cloudPet?.client_uid)return null;
  const pet=createPet(kind.id,cloudPet.nickname||kind.name);
  pet.uid=String(cloudPet.client_uid);
  pet.careUpdatedAt=Date.parse(cloudPet.care_updated_at||'')||Date.now();
  pet.hunger=clamp(Number(cloudPet.hunger??100),0,100);
  pet.happiness=clamp(Number(cloudPet.happiness??100),0,100);
  pet.energy=clamp(Number(cloudPet.energy??80),0,100);
  pet.cleanliness=clamp(Number(cloudPet.cleanliness??100),0,100);
  pet.evolution=Math.max(0,Number(cloudPet.evolution)||0);
  return pet;
};
function clamp(value,min,max){return Math.min(Math.max(Number(value)||0,min),max);}
function statusMeter(label,icon,value){
  const safe=Math.round(clamp(Number(value)||0,0,100));
  const level=safe>=70?'Good':safe>=35?'Fair':'Low';
  const key=label.toLowerCase().replace(/[^a-z]+/g,'-');
  return `<div class="status-meter status-${key}">
    <div class="status-meter-top"><span class="status-icon">${icon}</span><span class="status-name">${label}</span><b>${safe}<small>/100</small></b></div>
    <div class="status-track"><span class="status-fill" style="width:${safe}%"></span></div>
    <small class="status-level">${level}</small>
  </div>`;
}
function homePage(){
  const p=activePet();
  if(!p)return `<section class="page"><h1 class="page-title">Rumah TAMAVERSE</h1>${emptyPets()}</section>`;
  const s=speciesById(p.species),xpPercent=Math.min(100,p.xp/(p.level*40)*100);
  const cleanStagePet=['fluffin','mossling','voltkit','starwhale'].includes(s.id);
  return `<section class="page home-page">
    <div class="player-card card"><div class="player-avatar">${playerAvatarMarkup(state.player.avatar)}</div>
      <div class="player-info"><div class="player-name">${esc(state.player.name)}</div><span class="pill">Lv. ${state.player.level}</span>
      <div class="player-xp"><span>${state.player.xp} / ${state.player.level*100} XP</span><div class="progress-track"><div class="progress-fill" style="width:${Math.min(100,state.player.xp/(state.player.level*100)*100)}%"></div></div></div></div>
    </div>
    <div class="section-heading universe-heading"><div><div class="eyebrow">YOUR LITTLE UNIVERSE</div><h1 class="page-title">Good day, ${esc(state.player.name)}!</h1></div><button class="icon-button profile-shortcut" data-action="go" data-page="profile" aria-label="Buka profil"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.5"></circle><path d="M4.8 20c.5-3.6 3.2-5.6 7.2-5.6s6.7 2 7.2 5.6"></path></svg></button></div>
    <section class="pet-stage pet-action-${petAnimation} frame-equipped-${state.equippedFrame}" aria-label="Your companion">
      <div class="stage-topline"><span><i></i> YOUR COMPANION</span><b>NO. 01 <em>✦</em></b></div>
      <div class="orbit orbit-one"></div><div class="orbit orbit-two"></div>
      <span class="stage-spark spark-one">✦</span><span class="stage-spark spark-two">✧</span><span class="stage-spark spark-three">✦</span>
      <div class="stage-caption"><span class="caption-kicker">A LITTLE FRIEND FROM</span><b>THE TAMAVERSE</b><span class="caption-line"></span></div>
      <span class="home-frame-aura aura-${state.equippedFrame}" aria-hidden="true"></span><div class="home-frame-ornaments aura-${state.equippedFrame}" aria-hidden="true"><i class="aura-ornament aura-ornament-top">✦ · ✧ · ✦</i><i class="aura-ornament aura-ornament-bottom">✧ · ✦ · ✧</i></div><img class="companion-frame-art" src="${accessoryFrameById(state.equippedFrame).src}" alt="" aria-hidden="true">
      <div class="pet-shadow"></div><div class="stage-pet pet-species-${s.id}" style="" aria-hidden="true"><span class="${cleanStagePet?'stage-creature stage-creature-clean':`creature stage-creature element-${s.element.toLowerCase()}`}">${petImage(s.id, 'stage-pet-image')}</span><span class="pet-heart">♥</span></div>
      <div class="companion-panel">
        <div class="companion-meta">
          <h2>${esc(p.name)}</h2>
          <span class="pill">LV. ${p.level}</span>${s.exclusive?'<span class="exclusive-label">FOUNDER EXCLUSIVE</span>':''}
        </div>
        <div class="companion-xp"><span>EXP</span><b>${p.xp} / ${p.level*40}</b></div>
        <div class="progress-track"><div class="progress-fill" style="width:${xpPercent}%"></div></div>
        <div class="companion-tools">
          <div class="compact-needs">
            ${statusMeter('Hunger','🍓',p.hunger)}${statusMeter('Mood','💖',p.happiness)}${statusMeter('Energy','⚡',p.energy)}${statusMeter('Clean','🫧',p.cleanliness)}
          </div>
          <div class="compact-care-label"><span>QUICK CARE</span></div>
          <div class="compact-care">
            <button class="care-action" data-action="inventory-use" data-care="feed" aria-label="Feed"><span class="care-icon">🍓</span><b>Feed</b></button>
            <button class="care-action" data-action="care" data-care="play" aria-label="Play"><span class="care-icon">💖</span><b>Play</b></button>
            <button class="care-action" data-action="care" data-care="clean" aria-label="Bath"><span class="care-icon">🫧</span><b>Bath</b></button>
            <button class="care-action" data-action="care" data-care="sleep" aria-label="${petSleeping(p)?'Wake Up':'Sleep'}"><span class="care-icon">${petSleeping(p)?'☀️':'🌙'}</span><b>${petSleeping(p)?'Wake Up':'Sleep'}</b></button>
            <button class="care-action" data-action="care" data-care="train" aria-label="Train"><span class="care-icon">🏋️</span><b>Train</b></button>
          </div>
        </div>
      </div>
    </section>
    <div class="home-feature-shortcuts">
      <button class="home-feature-tile" data-action="inventory" aria-label="Buka Inventory"><span class="home-feature-art inventory-art">🎒</span><b>Inventory</b><small>Item & fragments</small></button>
      <button class="home-feature-tile diamond-event-tile" data-action="claim-diamond-event" aria-label="Klaim 100 Diamond"><span class="home-feature-art reward-art">💎</span><b>100 Diamond Event</b><small>One-time gift · All players</small></button>
      <button class="home-feature-tile" data-action="daily-reward" aria-label="Buka Daily Reward"><span class="home-feature-art reward-art">🎁</span><b>Daily Reward</b><small>7-day login bonus</small></button>
      <button class="home-feature-tile" data-action="daily-quests" aria-label="Buka Daily Quests"><span class="home-feature-art quest-art">📜</span><b>Daily Quests</b><small>Missions & rewards</small></button>
      <button class="home-feature-tile" data-action="shop" aria-label="Buka Store"><span class="home-feature-art store-art">🛍️</span><b>Store</b><small>Items & supplies</small></button>
    </div>
    
  </section>`;
}
function doCare(kind){
  const p=activePet();
  if(!p){showToast('Tetaskan pet lebih dulu!');return;}
  if(kind==='sleep'&&petSleeping(p)){
    const elapsed=Math.max(0,Date.now()-p.sleepStartedAt);
    p.energy=clamp(p.energy+(elapsed/900000)*100,0,100);
    p.sleeping=false;p.sleepStartedAt=0;p.careUpdatedAt=Date.now();
    save();render();showToast(`${p.name} sudah bangun. Pemulihan energi dihentikan.`);return;
  }
  if(petActivityBlocked(p))return;
  if(kind==='energy'){
    if((state.items.energy||0)<1){showToast('Energy Potion habis. Beli di Store.');return;}
    if(p.energy>=100){showToast('Energi pet sudah penuh.');return;}
    state.items.energy--;p.energy=clamp(p.energy+30,0,100);triggerPetAnimation('energy');
    showToast('Energy Potion digunakan! Energy +30.');
  }else if(kind==='feed'){
    if(p.hunger>=100){showToast(`${p.name} belum lapar.`);return;}
    if((state.items.food||0)<1){showToast('Apple habis. Beli Apple di Store seharga 50 Coins.');return;}
    state.items.food--;triggerPetAnimation('eat');p.hunger=clamp(p.hunger+50,0,100);grantPetXP(p,40);
    if(state.quests?.progress)state.quests.progress.feed++;
    showToast(`${p.name} makan Apple! Hunger +50.`);
  }else if(kind==='play'){
    if(p.energy<10){showToast('Energi pet terlalu rendah untuk bermain.');return;}
    if(p.happiness>=100){showToast(`${p.name} sudah sangat bahagia!`);return;}
    triggerPetAnimation('play');p.happiness=clamp(p.happiness+22,0,100);p.energy=clamp(p.energy-10,0,100);grantPetXP(p,40);
    if(state.quests?.progress)state.quests.progress.play++;
    showToast('Waktu bermain menyenangkan! Energy -10.');
  }else if(kind==='clean'){
    if(p.cleanliness>=100){showToast(`${p.name} sudah bersih!`);return;}
    triggerPetAnimation('bath');p.cleanliness=100;showToast(`${p.name} jadi bersih dan segar!`);
  }else if(kind==='sleep'){
    if(p.energy>=100){showToast(`${p.name} sudah penuh energi.`);return;}
    p.sleeping=true;p.sleepStartedAt=Date.now();triggerPetAnimation('sleep');
    const recoveryMinutes=Math.max(1,Math.ceil((100-p.energy)*900000/100/60000));
    showToast(`${p.name} mulai tidur. Energi diperkirakan penuh dalam ${recoveryMinutes} menit.`);
  }else if(kind==='train'){
    const hasManual=(state.items.training||0)>0;
    const energyCost=hasManual?5:35;
    if(p.energy<energyCost){showToast(`Energi minimal ${energyCost}% untuk latihan${hasManual?' dengan Training Manual':''}.`);return;}
    if(hasManual)state.items.training--;
    triggerPetAnimation('train');grantPetXP(p,hasManual?70:45);p.energy=clamp(p.energy-energyCost,0,100);p.evolution=Math.min(100,p.evolution+12);
    showToast(hasManual?'Training Book digunakan! -5% Energy, +70 XP dan progres evolusi.':'Training tanpa Book! -35% Energy, +45 XP dan progres evolusi.');
  }else return;
  p.careUpdatedAt=Date.now();save();render();
}
function createDailyQuestState(date=new Date().toDateString()){
  const pool=questDefinitions();
  const active=pool.map(q=>q.id).sort(()=>Math.random()-.5).slice(0,4);
  return {date,active,progress:{feed:0,play:0,battle:0,win:0,egg:0},claimed:[],rebought:[]};
}
function dailyReset(){
  const today=new Date().toDateString();
  if(!state.quests||state.quests.date!==today)state.quests=createDailyQuestState(today);
  else{
    if(!Array.isArray(state.quests.active)||!state.quests.active.length)state.quests.active=questDefinitions().map(q=>q.id).slice(0,4);
    if(!Array.isArray(state.quests.claimed))state.quests.claimed=[];
    if(!Array.isArray(state.quests.rebought))state.quests.rebought=[];
    if(!state.quests.progress)state.quests.progress={};
  }
  if(!state.dailyReward)state.dailyReward={lastClaimDate:'',day:0};
  if(state.player.lastLogin!==today){
    const yesterday=new Date(Date.now()-86400000).toDateString();
    state.player.streak=state.player.lastLogin===yesterday?Math.max(1,(state.player.streak||1)+1):1;
    state.player.lastLogin=today;
  }
  const now=Date.now();
  // Care decay applies only to the currently equipped companion.
  // Newly collected/bench pets keep their care stats until selected.
  const p=activePet();
  if(p){
    p.careUpdatedAt=Number(p.careUpdatedAt)||now;
    const elapsed=Math.max(0,now-p.careUpdatedAt);
    if(petSleeping(p)){
      const sleepElapsed=Math.max(0,now-p.sleepStartedAt);
      p.energy=clamp(p.energy+(sleepElapsed/900000)*100,0,100);
      p.sleepStartedAt=now;
      if(p.energy>=100){p.energy=100;p.sleeping=false;p.sleepStartedAt=0;}
    }else{
      const cleanFactor=p.cleanliness<15?1.5:1;
      p.hunger=clamp(p.hunger-(elapsed/32400000)*100,0,100);
      p.happiness=clamp(p.happiness-(elapsed/43200000)*100*cleanFactor,0,100);
      p.cleanliness=clamp(p.cleanliness-(elapsed/28800000)*100,0,100);
    }
    p.careUpdatedAt=now;
  }
}

function raritySummary(rates){
  return Object.entries(rates).map(([rarity,rate])=>`${rarity} ${rate}%`).join(' · ');
}
function formatEggCost(egg,count=1){
  const total=egg.price*count;
  return `${egg.currency==='diamond'?'💎 '+total+' diamond':'🪙 '+total+' koin'}`;
}
function gachaPage(){
  const owned=new Set(state.pets.map(p=>p.species));
  const storeItems=[
    {icon:'🍎',name:'Apple',desc:'Memulihkan Hunger pet',price:50},
    {icon:'⚡',name:'Energy Potion',desc:'Memulihkan Energy pet',price:40},
    {icon:'♥',name:'Health Potion',desc:'Memulihkan HP saat battle',price:60},
    {icon:'📘',name:'Training Manual',desc:'Membantu proses Training',price:120}
  ];
  const tabs='<div class="collection-tabs store-tabs" role="tablist" aria-label="Shop categories">'+
    '<button class="collection-tab '+(storeTab==='gacha'?'active':'')+'" role="tab" aria-selected="'+(storeTab==='gacha')+'" data-action="store-tab" data-tab="gacha"><span>🥚</span><b>Gacha</b><small>Discover new pets</small></button>'+
    '<button class="collection-tab '+(storeTab==='diamond'?'active':'')+'" role="tab" aria-selected="'+(storeTab==='diamond')+'" data-action="store-tab" data-tab="diamond"><span>💎</span><b>Diamond</b><small>Top up balance</small></button>'+
    '<button class="collection-tab '+(storeTab==='premium'?'active':'')+'" role="tab" aria-selected="'+(storeTab==='premium')+'" data-action="store-tab" data-tab="premium"><span>💎</span><b>Premium</b><small>Cards & frames</small></button></div>';
  const gachaContent=`
    <p class="subtle collection-description">Basic: Common 60% · Rare 28% · Epic 8% · Legendary 4%. Special: Rare 55% · Epic 27% · Legendary 18%. Pity Rare pada 10 pull, Epic pada 50 pull.</p>
    <div class="notice">🎁 Gratis 1 Basic Egg setiap hari. Semua hadiah menggunakan mata uang dalam game—tanpa pembayaran asli.</div>
    <div class="collection-grid">${eggs.map(e=>{
      const pool=species.filter(sp=>sp.pool.includes(e.id));
      return `<article class="card egg-card">
        <span class="egg-icon">${eggImage(e.id)}</span><h3>${e.name}</h3>
        <p class="subtle">${e.description}</p>
        <p class="egg-rates"><b>Peluang:</b><br>${raritySummary(e.rates)}</p>
        <p class="egg-pool"><b>Isi telur:</b> ${pool.map(sp=>`<span class="pool-pet ${owned.has(sp.id)?'pool-owned':''}">${petImage(sp.id,'egg-pool-image')} ${esc(sp.name)}</span>`).join('')}</p>
        <p class="muted-label">${formatEggCost(e)}</p>
        <div class="egg-actions">
          <button class="button full" data-action="pull" data-egg="${e.id}">Buka 1</button>
          <button class="button secondary full" data-action="pull-ten" data-egg="${e.id}">Spin 5 · ${formatEggCost(e,5)}</button>
        </div>
      </article>`;
    }).join('')}</div>
    <div class="card gacha-details">
      <div class="section-heading"><h2>Hadiah gratis harian</h2></div>
      <button class="button secondary full" data-action="freeegg">${state.gacha.lastFree===new Date().toDateString()?'Sudah diklaim hari ini':'Klaim Basic Egg gratis'}</button>
      <div class="section-heading"><h2>Progress pity</h2></div>
      <p class="subtle">Rare+: ${state.gacha.pityRare}/10 · Epic+: ${state.gacha.pityEpic}/50</p>
      <div class="section-heading"><h2>Riwayat tarikan</h2></div>
      ${state.gacha.history.length?state.gacha.history.slice(0,5).map(h=>{const sp=speciesById(h.species||species.find(x=>x.name===h.name)?.id);const petName=h.name||sp.name;return `<p class="subtle gacha-history-row"><span class="gacha-history-icon">${petImage(sp.id,'history-pet-image')}</span><b>${esc(petName)}</b> · <span class="rarity rarity-${h.rarity||sp.rarity}">${h.rarity||sp.rarity}</span></p>`;}).join(''):'<p class="subtle">Tarikanmu akan muncul di sini.</p>'}
    </div>`;
  const diamondContent=`
    <div class="diamond-store-hero">
      <div class="diamond-store-orb">💎</div>
      <div><span class="eyebrow">TAMAVERSE TOP UP</span><h2>Diamond Store</h2><p class="subtle">Isi saldo Diamond untuk membuka lebih banyak hal di Tamaverse.</p></div>
      <div class="diamond-wallet"><small>DIAMOND BALANCE</small><strong>💎 ${Number(state.player.diamonds||0).toLocaleString('id-ID')}</strong></div>
    </div>
    <div class="notice">Pilih paket Diamond, lalu lanjutkan melalui Nexora Bot. Pastikan nominal pada tiket order sesuai dengan daftar harga resmi.</div>
    <div class="section-heading"><h2>Diamond Packages</h2><span class="muted-label">PRICE LIST · IDR</span></div>
    <div class="diamond-package-grid diamond-package-grid-all">
      ${[
        {amount:5,price:'Rp1.000',unit:'Rp200 / 💎'},
        {amount:10,price:'Rp1.800',unit:'Rp180 / 💎'},
        {amount:25,price:'Rp3.500',unit:'Rp140 / 💎'},
        {amount:50,price:'Rp5.000',unit:'Rp100 / 💎'},
        {amount:100,price:'Rp7.500',unit:'Rp75 / 💎'},
        {amount:120,price:'Rp10.800',unit:'Rp90 / 💎',featured:true},
        {amount:300,price:'Rp24.000',unit:'Rp80 / 💎'},
        {amount:700,price:'Rp49.000',unit:'Rp70 / 💎'}
      ].map((pack,index)=>`
        <article class="diamond-package-card ${pack.featured?'featured':''}">
          ${pack.featured?'<span class="diamond-popular">BEST VALUE</span>':''}
          <span class="diamond-package-icon">💎</span>
          <strong>${pack.amount.toLocaleString('id-ID')}</strong>
          <span class="diamond-package-label">Diamonds</span>
          <b class="diamond-package-price">${pack.price}</b>
          <span class="subtle diamond-unit-price">${pack.unit}</span>
          <button class="button full" type="button" data-action="diamond-purchase" data-amount="${pack.amount}" data-label="${pack.price}">Purchase</button>
        </article>`).join('')}
    </div>
    
    <div class="card diamond-history-card">
      <div class="section-heading"><h2>Riwayat Transaksi</h2><span class="muted-label">PAYMENT HISTORY</span></div>
      <div class="diamond-history-empty"><span>🧾</span><b>Riwayat belum tersedia</b><p class="subtle">Riwayat pembelian akan ditampilkan di sini setelah fitur riwayat akun aktif. Untuk saat ini, simpan bukti transaksi secara pribadi.</p></div>
    </div>`;
  const inv=premiumInventory();
  const premiumContent='<p class="subtle collection-description">Gunakan diamond untuk membeli kartu rename dan frame permanen. Frame yang sudah dibeli tersimpan di Collection.</p><div class="notice">💎 Saldo diamond: <b>'+Number(state.player.diamonds||0)+'</b></div><div class="accessory-grid store-item-grid">'+[
    {id:'rename_card',icon:'🪪',image:'assets/items/Rename.webp',name:'Rename Card',desc:'Kartu untuk mengganti nama pemain.',price:50,count:Number(inv.rename_card_count||0),unit:'cards'},
    {id:'rename_pet_card',icon:'🐾',image:'assets/items/RenamePet.webp',name:'Rename Pet Card',desc:'Kartu untuk mengganti nama companion.',price:50,count:Number(inv.rename_pet_card_count||0),unit:'cards'},
    {id:'frame_royal',icon:'👑',name:'Frame Royal',tier:'Legendary',src:'assets/ui/Legendary-RoyalViolet.webp',desc:'A permanent frame that gives your companion a royal look.',price:200,owned:ownsFrame('legendary')},
    {id:'frame_celestial',icon:'✨',name:'Frame Celestial',tier:'Celestial',src:'assets/ui/Celestial-DivinePrinceses.webp',desc:'A permanent frame that adds an elegant celestial look to your companion.',price:300,owned:ownsFrame('celestial')}
  ].map(item=>'<article class="accessory-card store-item-card '+(item.src?'store-frame-card':'')+'"><div class="'+(item.src?'store-frame-art':'store-item-art')+'">'+((item.src||item.image)?'<img src="'+(item.src||item.image)+'" alt="'+item.name+(item.src?' frame':'')+'" loading="lazy" decoding="async">':item.icon)+'</div><div class="accessory-info"><h3>'+item.name+'</h3>'+(item.tier?'<span class="rarity rarity-'+item.tier+' store-frame-tier">'+item.tier+'</span>':'')+'<p class="subtle">'+item.desc+'</p>'+(item.unit?'<b class="store-item-price">Owned: '+item.count+'</b>':'<b class="store-item-price">'+(item.owned?'✓ Owned':'Permanent unlock')+'</b>')+'<b class="store-item-price">💎 '+item.price+' diamonds</b><button class="button full" data-action="buy-premium" data-item="'+item.id+'" '+(item.owned?'disabled':'')+'>'+(item.owned?'Already owned':'Buy now')+'</button></div></article>').join('')+'</div>';
  return '<section class="page collection-page store-page"><div class="eyebrow">WELCOME TO TAMAVERSE</div><h1 class="page-title">Shop</h1><p class="subtle collection-description">Temukan teman baru dan perlengkapan untuk pet-mu.</p>'+tabs+(storeTab==='diamond'?diamondContent:storeTab==='premium'?premiumContent:gachaContent)+'</section>';
}
function battleView(){
  const p=petById(battle.petId);if(!p){battle=null;return battlePage();}
  const enemy=battle.opponent, mySpecies=speciesById(p.species);
  const hp=Math.max(0,battle.playerHP), ehp=Math.max(0,battle.enemyHP), max=Math.max(1,p.stats.hp), emax=Math.max(1,enemy.stats.hp);
  const log=Array.isArray(battle.log)?battle.log:[];
  const aiTurn=battle.phase==='ai', playerAction=battle.phase==='player-action', aiAction=battle.phase==='ai-action', transition=battle.phase==='transition'||battle.phase==='entering';
  const actionCooldown=battle.phase==='cooldown';
  const skillCooldown=Math.max(0,Math.ceil((Number(battle.skillReadyAt||0)-Date.now())/1000));
  if(huntingSkillCooldownTimer)clearTimeout(huntingSkillCooldownTimer);
  if(skillCooldown>0&&battle.phase==='player')huntingSkillCooldownTimer=setTimeout(()=>{if(battle&&page==='battle')render();},250);
  return `
    <section class="page online-battle-page battle-mode-screen solo-hunting-page">
      <div class="battle-mode-top">
        <button class="battle-exit" data-action="battle-cancel" type="button" aria-label="Leave hunting">←</button>
        <div><div class="eyebrow">SOLO HUNTING</div><h1>Hunting Tower</h1><small class="battle-wave-subtitle">LEVEL ${battle.wave} / ${species.length} · ${battle.clearedLevels} CLEARED</small></div>
        <div class="battle-turn-chip">TURN ${battle.turn}</div>
      </div>
      <div class="battle-scene battle-fx-${esc(battle.actionFx||'idle')}" aria-label="Solo hunting arena">
        <div class="arena-sky"><span class="arena-light light-one"></span><span class="arena-light light-two"></span></div>
        <div class="battle-turn-overlay ${transition?'wave-transition':''}"><b>${aiTurn?'BOT TURN':playerAction?'PLAYER ACTION':aiAction?'BOT ACTION':transition?(battle.phase==='entering'?'WAVE ARRIVAL':'LEVEL CLEAR!'):actionCooldown?'ACTION COMPLETE':'YOUR TURN'}</b><span>${aiTurn?'AI IS CHOOSING':playerAction?'PLAYER MOVE IN PROGRESS':aiAction?'AI MOVE IN PROGRESS':transition?(battle.phase==='entering'?'NEW MONSTER ENTERS':'NEXT OPPONENT ENTERING'):actionCooldown?'PREPARING NEXT TURN':'CHOOSE YOUR ACTION'}</span></div>
        <div class="arena-platform platform-player"></div><div class="arena-platform platform-enemy"></div>
        <div class="battle-side battle-player">
          <div class="battle-nameplate"><b>${esc(p.name)}</b><span>${esc(mySpecies.element)} · Lv.${p.level}</span></div>
          <div class="battle-sprite" data-species="${esc(p.species)}">${battlePetImage(p.species,'player','battle-pet-image')}</div>
          <div class="battle-hp-card"><div class="hp-value">${hp} / ${max} HP</div><div class="progress-track"><div class="progress-fill" style="width:${Math.min(100,hp/max*100)}%"></div></div><div class="battle-pet-caption"><b>${esc(p.name)}</b><span>Lv.${p.level}</span></div></div>
        </div>
        <div class="battle-side battle-enemy">
          <div class="battle-nameplate"><b>${esc(enemy.name)}</b><span>AI TIER · ${esc(enemy.rarity)}</span></div>
          <div class="battle-sprite" data-species="${esc(enemy.id)}">${battlePetImage(enemy.id,'enemy','battle-pet-image')}</div>
          <div class="battle-hp-card"><div class="hp-value">${ehp} / ${emax} HP</div><div class="progress-track"><div class="progress-fill enemy-hp" style="width:${Math.min(100,ehp/emax*100)}%"></div></div><div class="battle-pet-caption"><b>${esc(enemy.name)}</b><span>LEVEL ${battle.wave}</span></div></div>
        </div>
        <div class="battle-arena-controls">
          <div class="battle-action-status">${aiTurn||aiAction?'AI TURN — PLEASE WAIT':playerAction?'PLAYER ACTION — PLEASE WAIT':transition?(battle.phase==='entering'?'NEW MONSTER ENTERING — PLEASE WAIT':'LEVEL CLEAR — PREPARING NEXT OPPONENT'):actionCooldown?'ACTION COMPLETE — PLEASE WAIT':'YOUR TURN — CHOOSE ACTION'}</div>
          <div class="battle-action-grid">
            <button class="battle-action-btn battle-action-main" data-action="battle-action" data-move="attack" ${battle.busy||battle.phase!=='player'?'disabled':''}><span>⚔️</span>Attack</button>
            <button class="battle-action-btn battle-action-skill" data-action="battle-action" data-move="skill" ${battle.busy||battle.phase!=='player'||skillCooldown>0?'disabled':''}><span>✨</span>Skill${skillCooldown>0?` · ${skillCooldown}s`:''}</button>
            <button class="battle-action-btn battle-action-defend" data-action="battle-action" data-move="defend" ${battle.busy||battle.phase!=='player'?'disabled':''}><span>🛡️</span>Defend</button>
            <button class="battle-action-btn battle-action-item" data-action="battle-action" data-move="item" ${battle.busy||battle.phase!=='player'||!state.items.snack?'disabled':''}><img src="assets/items/HealthPotion.webp" alt="" style="width:22px;height:22px;object-fit:contain;vertical-align:middle;margin-right:6px">Item · ${state.items.snack}</button>
          </div>
        </div>
      </div>
      <div class="battle-log-panel"><div class="battle-log-heading">BATTLE LOG <span>TURN ${battle.turn}</span></div><div class="battle-log">${log.slice(-4).map(line=>`<div>• ${esc(line)}</div>`).join('')||'<div>Battle started. Choose your first action.</div>'}</div></div>
    </section>`;
}
function battlePage(){
  if (onlineRoom && ['playing','finished'].includes(onlineRoom.status)) return onlineBattleView();
  if (battle) return battleView();
  return `
    <section class="page battle-hub">
      <div class="eyebrow">TAMAVERSE ARENA</div><h1 class="page-title">Battle</h1>
      <p class="subtle">Pilih arena dan bawa companion-mu bertarung.</p>
      <div class="battle-hub-tabs" role="tablist" aria-label="Battle modes">
        <button class="battle-hub-tab ${battleSection==='online'?'active':''}" data-action="battle-section" data-section="online" role="tab" aria-selected="${battleSection==='online'}"><span class="battle-tab-code">PVP</span><b>Online</b><small>Player vs Player</small></button>
        <button class="battle-hub-tab ${battleSection==='solo'?'active':''}" data-action="battle-section" data-section="solo" role="tab" aria-selected="${battleSection==='solo'}"><span class="battle-tab-code">PVE</span><b>Solo / Hunting</b><small>Player vs Monster</small></button>
      </div>
      ${battleSection==='online' ? onlineBattlePage() : `
        <div class="battle-mode-banner solo-banner"><span class="battle-mode-icon solo-banner-pet">${petImage(activePet()?.species||species[0].id,"solo-hub-pet")}</span><div><div class="eyebrow">WILDERNESS MODE</div><h2>Solo Hunting</h2><p>Temui monster liar dan bertarung bergiliran melawan monster.</p></div></div>
        <div class="battle-turn-preview">
          <div><span class="turn-preview-icon turn-preview-pet">${battlePetImage(activePet()?.species||species[0].id,"player","solo-preview-pet")}</span><b>PLAYER</b><small>Your action</small></div>
          <span class="turn-preview-arrow">VS</span>
          <div><span class="turn-preview-icon turn-preview-pet">${battlePetImage(species[0].id,"enemy","solo-preview-pet")}</span><b>MONSTER</b><small>Wild opponent</small></div>
        </div>
        <div class="battle-option-card"><div class="battle-option-art solo-option-art">${battlePetImage(activePet()?.species||species[0].id,"player","solo-option-pet")}<span class="solo-option-vs">VS</span>${battlePetImage(species[0].id,"enemy","solo-option-pet")}</div><span class="pill">TURN-BASED · MONSTER</span><h3>Hunt in the Wild</h3><p>Serang, gunakan skill, bertahan, atau pulihkan HP. Monster memilih aksi secara acak pada gilirannya.</p><button class="button full" data-action="battle-start" data-mode="practice">Mulai Hunting</button></div>
        <div class="notice">Giliran berjalan bergantian: Player → Monster → Player. Monster tidak menyerang bersamaan dengan aksimu.</div>
      `}
      ${state.battleHistory.length ? `<div class="section-heading"><h2>Battle terakhir</h2></div>${state.battleHistory.slice(0,5).map(item=>`<div class="card battle-history-row"><span>${item.result==='win'?'WIN':item.result==='draw'?'DRAW':'LOSS'} · ${item.result==='win'?'Menang':item.result==='draw'?'Seri':'Kalah'}</span><span class="muted-label">${new Date(item.date).toLocaleDateString('id-ID')}</span></div>`).join('')}` : ''}
    </section>`;
}

async function consumeRenameCard(type){
 const db=window.TAMAVERSE_SUPABASE_CLIENT;if(!db||!window.TAMAVERSE_USER_ID)throw new Error('Akun belum tersambung ke server.');
 const {data,error}=await db.rpc('consume_tamaverse_rename_card',{p_card_type:type});if(error)throw error;
 const result=Array.isArray(data)?data[0]:data;if(!result||result.success===false)throw new Error('Kartu rename tidak dapat digunakan.');
 window.TAMAVERSE_PREMIUM_INVENTORY={...premiumInventory(),rename_card_count:Number(result.rename_card_count||0),rename_pet_card_count:Number(result.rename_pet_card_count||0)};
}
async function renamePlayerWithCard(){const name=(document.getElementById('playerNameInput')?.value||'').trim().slice(0,18);if(!name){showToast('Masukkan nama pemain.');return;}if(name===state.player.name){closeModal();return;}try{await consumeRenameCard('rename');state.player.name=name;closeModal();save();render();showToast('Nama pemain berhasil diperbarui.');}catch(error){console.error('Player rename failed:',error);showToast(error?.message||'Gagal mengganti nama.');}}
async function renameSelectedPet(){const pet=petById(selectedPetId),name=(document.getElementById('newPetName')?.value||'').trim().slice(0,18);if(!pet||!name){showToast('Masukkan nama pet.');return;}if(name===pet.name){closeModal();return;}try{await consumeRenameCard('rename_pet');pet.name=name;closeModal();save();render();showToast('Nama pet berhasil diperbarui.');}catch(error){console.error('Pet rename failed:',error);showToast(error?.message||'Gagal mengganti nama pet.');}}
function playerAvatarMarkup(value,className='player-avatar-photo'){
  const avatar=String(value||'🧙');
  return (/^https:\/\//i.test(avatar)||/^data:image\/(?:jpeg|png|webp);base64,/i.test(avatar))?`<img class="${className}" src="${esc(avatar)}" alt="Foto profil" referrerpolicy="no-referrer" onerror="this.replaceWith(document.createTextNode('🧙'))">`:esc(avatar);
}
function profileAvatarMarkup(sizeClass='profile-avatar-image'){return playerAvatarMarkup(state.player.avatar,sizeClass);}
function profilePage(){
  const p=state.player,wins=Number(p.wins||0),losses=Number(p.losses||0),draws=Number(p.draws||0);
  const userId=String(window.TAMAVERSE_USER_ID||'');
  const shortUserId=userId?(userId.length>16?userId.slice(0,8)+'…'+userId.slice(-4):userId):'Memuat ID...';
  const telegramUser=window.Telegram?.WebApp?.initDataUnsafe?.user;
  const telegramUsername=telegramUser?.username?'@'+String(telegramUser.username):'Belum diatur';
  const rankData=window.TAMAVERSE_RANKING_DATA||[];
  if(!rankData.length&&!window.TAMAVERSE_RANKING_LOADING&&!window.TAMAVERSE_RANKING_ERROR&&window.TAMAVERSE_SUPABASE_CLIENT)loadGlobalRankings();
  const ranked=[...rankData].sort((a,b)=>Number(b.rating||0)-Number(a.rating||0)||String(a.name||'').localeCompare(String(b.name||'')));
  const rankIndex=ranked.findIndex(player=>player.me||(userId&&player.id===userId));
  const globalRank=rankIndex>=0?'#'+(rankIndex+1):rankData.length?'Unranked':'—';
  return `<section class="page profile-page">
    <div class="profile-page-heading"><div><div class="eyebrow">TAMAVERSE ACCOUNT</div><h1 class="page-title">My Profile</h1><p class="subtle">Identitas dan perjalananmu di Tamaverse.</p></div><span class="profile-heading-spark">✦</span></div>
    <article class="profile-identity-card"><div class="profile-identity-orbit"></div>
      <div class="profile-avatar-shell">${profileAvatarMarkup()}</div>
      <div class="profile-identity-copy"><span class="profile-online-label"><i></i> PLAYER PROFILE</span><h2>${esc(p.name||'Player')}</h2>
        <p class="profile-telegram-id">${esc(telegramUsername)}</p><p class="profile-level-label">Level ${Number(p.level||1)} adventurer</p>
        <div class="profile-identity-buttons"><button class="profile-action-button" data-action="rename-player"><span>✎</span> Rename</button><button class="profile-action-button profile-change-button" data-action="pick-profile-photo"><span>▧</span> Change Profile</button></div></div>
      <div class="profile-uuid-row" title="UUID akun lengkap"><span class="profile-uuid-icon">◈</span><span class="profile-uuid-value">${esc(shortUserId)}</span><button class="profile-copy-uuid" data-action="copy-user-id" aria-label="Salin UUID lengkap" title="Salin UUID lengkap">⧉</button></div>
    </article>
    <input id="profileAvatarFile" class="visually-hidden" type="file" accept="image/*">
    <div class="profile-stats profile-battle-stats"><div class="profile-stat"><strong>${Number(p.rating||1000).toLocaleString('id-ID')}</strong><span>BATTLE RATING</span></div><div class="profile-stat"><strong>${globalRank}</strong><span>GLOBAL RANK</span></div><div class="profile-stat"><strong>${wins}</strong><span>WINS</span></div><div class="profile-stat"><strong>${losses}</strong><span>LOSSES</span></div><div class="profile-stat"><strong>${draws}</strong><span>DRAWS</span></div><div class="profile-stat profile-collection-stat"><strong>${state.pets.length}</strong><span>PET COLLECTION</span></div></div>
    ${window.TAMAVERSE_AUDIO_SETTINGS?.markup?.()||""}
    <div class="profile-action-card"><div><span class="eyebrow">NEED A HAND?</span><h3>Butuh bantuan?</h3><p>Hubungi tim support kalau ada kendala saat bermain.</p></div><a class="button profile-help-button" href="https://t.me/TamaSupportBot" target="_blank" rel="noopener"><span>📩</span> Help Center</a></div>
    <button class="button danger full profile-reset-button" data-action="reset">Reset semua data</button>
  </section>`;
}
function inspectPet(uid){
  const p=petById(uid);if(!p)return;
  if(p.species==='sovereign-nexora'&&window.TAMAVERSE_IS_FOUNDER!==true){showToast('Nexora hanya tersedia untuk akun Founder.');return;}
  const s=speciesById(p.species),active=activePet();
  selectedPetId=uid;
  const statRows=(pet,label)=>`<div class="comparison-pet"><b>${esc(label)}${pet.uid===state.activePet?' · Aktif':''}</b><span>HP ${pet.stats.hp}</span><span>ATK ${pet.stats.atk}</span><span>DEF ${pet.stats.def}</span><span>SPD ${pet.stats.spd}</span></div>`;
  const comparison=active&&active.uid!==p.uid?`<div class="comparison-grid">${statRows(p,p.name)}${statRows(active,active.name)}</div>`:`<div class="stats-row"><div class="stat-tile"><strong>${p.stats.hp}</strong><span>HP</span></div><div class="stat-tile"><strong>${p.stats.atk}</strong><span>ATK</span></div><div class="stat-tile"><strong>${p.stats.def}</strong><span>DEF</span></div></div><p class="subtle">Speed: ${p.stats.spd}</p>`;
  showModal(`<div class="pet-detail-art">${petImage(s.id, 'detail-pet-image', true)}</div><div class="eyebrow">${s.element} · ${s.rarity}</div><h2 id="modalTitle">${esc(p.name)} · Lv.${p.level}</h2>
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
  if(state.gacha.pityEpic>=49&&egg.rates.Epic&&['Common','Rare'].includes(rarity))return 'Epic';
  if(state.gacha.pityRare>=9&&egg.rates.Rare&&rarity==='Common')return 'Rare';
  return rarity;
}
function pullEgg(id,free=false){return runEggPulls(id,1,free);}
function showGachaRoll(egg,chosen,duplicate){
  const pool=species.filter(item=>item.pool.includes(egg.id));
  const targetIndex=20;
  const reel=Array.from({length:targetIndex},()=>pool[Math.floor(Math.random()*pool.length)]);
  reel.push(chosen);
  for(let i=0;i<6;i++)reel.push(pool[Math.floor(Math.random()*pool.length)]);
  const cards=reel.map((pet,index)=>`<div class="gacha-reel-card rarity-${pet.rarity} ${index===targetIndex?'winner':''}"><div class="gacha-reel-art">${petImage(pet.id,'gacha-reel-pet')}</div><b>${esc(pet.name)}</b><small>${pet.rarity}</small></div>`).join('');
  showModal(`<div class="gacha-roll-modal"><div class="eyebrow">TAMAVERSE · CASE OPENING</div><h2 id="modalTitle">Good luck!</h2><p class="subtle">Menentukan teman barumu...</p><div class="gacha-reel-window"><div class="gacha-reel-pointer"></div><div class="gacha-reel-track" id="gachaReelTrack">${cards}</div></div><div class="gacha-roll-status" id="gachaRollStatus">ROLLING...</div></div>`);
  const track=document.getElementById('gachaReelTrack');
  const viewport=document.querySelector('.gacha-reel-window');
  const winner=track?.children[targetIndex];
  if(!track||!viewport||!winner){showGachaResult(chosen,duplicate);return;}
  const offset=viewport.clientWidth/2-(winner.offsetLeft+winner.offsetWidth/2);
  track.style.transition='none';
  track.style.transform='translate3d(0,0,0)';
  requestAnimationFrame(()=>requestAnimationFrame(()=>{
    track.style.transition='transform 8.5s cubic-bezier(.10,.78,.12,1)';
    track.style.transform=`translate3d(${offset}px,0,0)`;
  }));
  setTimeout(()=>{
    const status=document.getElementById('gachaRollStatus');
    if(status)status.textContent='✨ FOUND!';
    const title=document.querySelector('.gacha-roll-modal h2');
    if(title)title.textContent='IT’S A MATCH!';
    setTimeout(()=>showGachaResult(chosen,duplicate),650);
  },8550);
}
function showBatchGachaRoll(egg,results){
  const pool=species.filter(item=>item.pool.includes(egg.id));
  const targetIndex=20;
  const reels=results.map(({chosen},spinIndex)=>{
    const reel=Array.from({length:targetIndex},()=>pool[Math.floor(Math.random()*pool.length)]);
    reel.push(chosen);
    for(let i=0;i<6;i++)reel.push(pool[Math.floor(Math.random()*pool.length)]);
    const cards=reel.map((pet,index)=>`<div class="gacha-reel-card rarity-${pet.rarity} ${index===targetIndex?'winner':''}"><div class="gacha-reel-art">${petImage(pet.id,'batch-reel-pet')}</div><b>${esc(pet.name)}</b></div>`).join('');
    return `<div class="batch-reel-row"><small>SPIN ${spinIndex+1}</small><div class="gacha-reel-window batch-reel-window"><div class="gacha-reel-pointer"></div><div class="gacha-reel-track batch-reel-track" id="batchReelTrack${spinIndex}">${cards}</div></div></div>`;
  }).join('');
  showModal(`<div class="gacha-roll-modal batch-roll-modal"><div class="eyebrow">TAMAVERSE · 5× CASE OPENING</div><h2 id="modalTitle">Good luck!</h2><p class="subtle">Lima telur diputar bersamaan...</p><div class="batch-reels">${reels}</div><div class="gacha-roll-status" id="gachaRollStatus">ROLLING...</div></div>`);
  const tracks=results.map((_,index)=>document.getElementById(`batchReelTrack${index}`));
  const viewports=[...document.querySelectorAll('.batch-reel-window')];
  if(tracks.some(track=>!track)||viewports.length!==5){showBatchGachaResult(results);return;}
  requestAnimationFrame(()=>requestAnimationFrame(()=>{
    tracks.forEach((track,index)=>{
      const winner=track.children[targetIndex],viewport=viewports[index];
      const offset=viewport.clientWidth/2-(winner.offsetLeft+winner.offsetWidth/2);
      track.style.transition='none';
      track.style.transform='translate3d(0,0,0)';
      requestAnimationFrame(()=>{
        track.style.transition='transform 8.5s cubic-bezier(.10,.78,.12,1)';
        track.style.transform=`translate3d(${offset}px,0,0)`;
      });
    });
  }));
  setTimeout(()=>{
    const status=document.getElementById('gachaRollStatus');
    if(status)status.textContent='✨ ALL 5 FOUND!';
    const title=document.querySelector('.batch-roll-modal h2');
    if(title)title.textContent='FIVE MATCHES!';
    setTimeout(()=>showBatchGachaResult(results),650);
  },8550);
}
function showBatchGachaResult(results){
  const counts={Common:0,Rare:0,Epic:0,Legendary:0},duplicates=results.filter(result=>result.duplicate).length;
  results.forEach(result=>counts[result.chosen.rarity]++);
  const list=results.map(({chosen,duplicate})=>`<div class="batch-result rarity-${chosen.rarity}"><span>${petImage(chosen.id,"batch-pet-image")}</span><b>${esc(chosen.name)}</b><small>${chosen.rarity} · ${chosen.element}${duplicate?' · +fragmen':''}</small><small class="batch-stats">HP ${chosen.stats.hp} · ATK ${chosen.stats.atk} · DEF ${chosen.stats.def} · SPD ${chosen.stats.spd}</small></div>`).join('');
  showModal(`<div class="eyebrow">HASIL 5 SPIN</div><h2 id="modalTitle">Telur menetas!</h2><p>${raritySummary(counts)} · ${duplicates} duplikat menghasilkan fragmen.</p><div class="batch-results">${list}</div><button class="button full" data-action="close-modal">Lanjut</button>`);
}
function showGachaResult(chosen,duplicate){
  showModal(`<div class="hatch-egg">${petImage(chosen.id,'detail-pet-image')}✨</div><div class="eyebrow" style="text-align:center">TELUR MENETAS</div><h2 id="modalTitle" style="text-align:center">${duplicate?'Duplikat! Fragmen didapat':esc(chosen.name)}</h2>
    <p style="text-align:center"><span class="rarity rarity-${chosen.rarity}">${chosen.rarity}</span> · ${chosen.element}<br>${duplicate?'+1 fragmen spesies dan 20 koin':'Teman baru masuk koleksimu!'}</p>
    <div class="stats-row stats-four"><div class="stat-tile"><strong>${chosen.stats.hp}</strong><span>HP</span></div><div class="stat-tile"><strong>${chosen.stats.atk}</strong><span>ATK</span></div><div class="stat-tile"><strong>${chosen.stats.def}</strong><span>DEF</span></div><div class="stat-tile"><strong>${chosen.stats.spd}</strong><span>SPD</span></div></div>
    <button class="button full" style="margin-top:14px" data-action="close-modal">Keren!</button>`);
}
async function runEggPulls(id,count,free=false){
  if(pullInProgress){showToast('Tarikan sedang diproses.');return;}
  const egg=eggs.find(item=>item.id===id);if(!egg)return;
  const pool=species.filter(item=>item.pool.includes(id));
  if(Object.keys(egg.rates).some(tier=>!pool.some(item=>item.rarity===tier))){showToast('Pool telur belum lengkap; tidak ada biaya yang diambil.');return;}
  if(free&&state.gacha.lastFree===new Date().toDateString()){showToast('Telur gratis hari ini sudah diklaim.');return;}
  const currency=egg.currency==='diamond'?'diamonds':'coins',cost=free?0:egg.price*count;
  if(state.player[currency]<cost){showToast(`Tidak cukup ${currency==='diamonds'?'diamond':'koin'} untuk tarikan ini.`);return;}
  pullInProgress=true;
  try{
    if(currency==='diamonds'&&!free){if(!(await spendDiamonds(cost,'astral_gacha')))return;}
    if(free)state.gacha.lastFree=new Date().toDateString();else if(currency!=='diamonds')state.player[currency]-=cost;
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
      showGachaRoll(egg,chosen,duplicate);
    }else{
      showBatchGachaRoll(egg,results);
    }
  }finally{pullInProgress=false;}
}
async function exchangeFragments(speciesId,reward){
  const costs={coins:{fragments:3,amount:30},training:{fragments:4,amount:1}};
  const option=costs[reward],available=state.items.fragments[speciesId]||0;
  if(!option||available<option.fragments){showToast('Fragmen spesies belum cukup.');return;}
  state.items.fragments[speciesId]-=option.fragments;
  if(reward==='coins')addCoins(option.amount);
  else state.items.training+=option.amount;
  save();render();showToast('Fragmen berhasil ditukar.');
}
function battleAction(move){
  if(!battle||battle.ended||battle.busy||battle.phase!=='player')return;
  if(!['attack','skill','defend','item'].includes(move))return;
  const now=Date.now();
  const playerSkillReadyAt=Number(battle.skillReadyAt||0);
  if(move==='skill'&&playerSkillReadyAt>now){
    showToast(`Skill cooldown: tunggu ${Math.ceil((playerSkillReadyAt-now)/1000)} detik.`);
    return;
  }
  const p=petById(battle.petId);if(!p)return;
  if(move==='item'&&Number(state.items.snack||0)<1){showToast('Camilan habis.');return;}
  const activeBattle=battle;
  const ps=speciesById(p.species);
  const log=activeBattle.log;
  activeBattle.busy=true;
  activeBattle.actionFx=move;

  if(move==='attack'||move==='skill'){
    const os=speciesById(activeBattle.opponent.species);
    const dodge=clamp(.035+(activeBattle.opponent.stats.spd-p.stats.spd)*.003,.01,.12);
    if(Math.random()<dodge)log.push(`${activeBattle.opponent.name} menghindari serangan ${p.name}.`);
    else{
      const bonus=move==='skill'?Math.max(4,Math.round(p.stats.atk*.22)):0;
      let damage=Math.max(3,Math.round((3+p.stats.atk*.43+bonus-activeBattle.opponent.stats.def*.16)*(0.9+Math.random()*.2)*elementMultiplier(ps.element,os.element)*(activeBattle.enemyDefending?.45:1)));
      if(Math.random()<.08)damage=Math.round(damage*1.35);
      activeBattle.enemyHP=Math.max(0,activeBattle.enemyHP-damage);
      log.push(`${p.name} ${move==='skill'?'menggunakan Skill':'menyerang'} dan memberi ${damage} damage.`);
    }
    activeBattle.enemyDefending=false;
    if(move==='skill')activeBattle.skillReadyAt=Date.now()+5000;
  }else if(move==='defend'){
    activeBattle.defending=true;
    log.push(`${p.name} bersiap bertahan.`);
  }else{
    state.items.snack--;
    const healed=Math.min(25,p.stats.hp-activeBattle.playerHP);
    activeBattle.playerHP+=healed;
    log.push(`${p.name} memakai Health Potion dan memulihkan ${healed} HP.`);
  }

  activeBattle.log=log.slice(-30);
  save();
  if(activeBattle.enemyHP<=0){advanceHuntingLevel();return;}

  // Keep the player's action visible for a full 1.5 seconds before the AI responds.
  activeBattle.phase='player-action';
  activeBattle.aiTimer=setTimeout(()=>{
    if(battle!==activeBattle||activeBattle.ended||activeBattle.phase!=='player-action')return;
    const enemy=activeBattle.opponent;
    const choices=['attack','attack','attack','defend'];
    if(Date.now()>=Number(activeBattle.enemySkillReadyAt||0))choices.push('skill');
    if(!activeBattle.enemyItemUsed&&activeBattle.enemyHP<=Math.ceil(enemy.stats.hp*.4))choices.push('item');
    const aiMove=choices[Math.floor(Math.random()*choices.length)];

    if(aiMove==='defend'){
      activeBattle.enemyDefending=true;
      log.push(`${enemy.name} memilih bertahan.`);
      activeBattle.actionFx='ai-defend';
    }else if(aiMove==='item'){
      activeBattle.enemyItemUsed=true;
      const healed=Math.min(Math.round(enemy.stats.hp*.16),enemy.stats.hp-activeBattle.enemyHP);
      activeBattle.enemyHP+=healed;
      log.push(`${enemy.name} memulihkan ${healed} HP.`);
      activeBattle.actionFx='ai-item';
    }else{
      const skill=aiMove==='skill';
      if(skill)activeBattle.enemySkillReadyAt=Date.now()+5000;
      const os=speciesById(enemy.species);
      const dodge=clamp(.025+(p.stats.spd-enemy.stats.spd)*.003,.01,.12);
      if(Math.random()<dodge)log.push(`${p.name} menghindari serangan ${enemy.name}.`);
      else{
        const bonus=skill?Math.max(3,Math.round(enemy.stats.atk*.18)):0;
        let damage=Math.max(2,Math.round((2+enemy.stats.atk*.43+bonus-p.stats.def*.16)*(0.9+Math.random()*.2)*elementMultiplier(os.element,ps.element)*(activeBattle.defending?.45:1)));
        if(Math.random()<.06)damage=Math.round(damage*1.3);
        activeBattle.playerHP=Math.max(0,activeBattle.playerHP-damage);
        log.push(`${enemy.name} ${skill?'menggunakan Skill':'menyerang'} dan memberi ${damage} damage.`);
      }
      activeBattle.actionFx=aiMove;
    }

    activeBattle.defending=false;
    activeBattle.turn++;
    activeBattle.log=log.slice(-30);
    activeBattle.phase='ai-action';
    activeBattle.busy=true;
    save();
    render();

    // Hold the AI action animation for 1.5 seconds before returning control.
    activeBattle.aiTimer=setTimeout(()=>{
      if(battle!==activeBattle||activeBattle.ended||activeBattle.phase!=='ai-action')return;
      if(activeBattle.playerHP<=0){finishBattle('loss');return;}
      activeBattle.phase='player';
      activeBattle.busy=false;
      activeBattle.actionFx='idle';
      render();
    },1500);
    render();
  },1500);
  render();
}
function finishBattle(result){
  if(!battle||battle.ended)return;
  dailyReset();battle.ended=true;if(battle.aiTimer)clearTimeout(battle.aiTimer);
  const completed={...battle};const p=petById(completed.petId);
  if(completed.mode==='practice'){
    const coins=Number(completed.coinsEarned||0),xp=Number(completed.xpEarned||0);
    addCoins(coins);
    if(xp>0)playerXP(xp);
    if(p&&completed.clearedLevels>0)grantPetXP(p,completed.clearedLevels*40);
    if(result==='win'){state.player.wins++;state.quests.progress.win++;}
    else if(result==='loss')state.player.losses++;
    showToast(`Hunting selesai · ${completed.clearedLevels} level · +${coins} Coins · +${xp} EXP`);
  }else if(result==='win'){
    state.player.wins++;state.player.rating+=completed.mode==='simulated'?12:5;addCoins(35);playerXP(50);grantPetXP(p,50);state.quests.progress.win++;
  }else if(result==='loss'){state.player.losses++;state.player.rating=Math.max(0,state.player.rating-5);grantPetXP(p,40);}
  else state.player.draws++;
  state.quests.progress.battle++;
  state.battleHistory.unshift({result,date:Date.now(),mode:completed.mode,clearedLevels:completed.clearedLevels||0});
  state.battleHistory=state.battleHistory.slice(0,20);
  save();battle=null;render();
  showModal(`<div class="hatch-egg">${result==='win'?'🏆':result==='draw'?'🤝':'💫'}</div><h2 id="modalTitle" style="text-align:center">${result==='win'?'Hunting Clear!':result==='draw'?'Hunting berakhir':'Hunting selesai'}</h2><p style="text-align:center">Kamu melewati <b>${completed.clearedLevels||0} level</b>.</p><div class="stats-row"><div class="stat-tile"><strong>🪙 ${completed.coinsEarned||0}</strong><span>Coins</span></div><div class="stat-tile"><strong>✨ ${completed.xpEarned||0}</strong><span>EXP</span></div><div class="stat-tile"><strong>${completed.clearedLevels||0}</strong><span>Level Clear</span></div></div><button class="button full" data-action="close-modal" style="margin-top:16px">Lanjut</button>`);
}
function batchPullConfirmation(egg){
  const currency=egg.currency==='diamond'?'diamond':'koin',cost=egg.price*5;
  showModal(`<div class="hatch-egg">${eggImage(egg.id)}</div><div class="eyebrow">KONFIRMASI TARIKAN</div><h2 id="modalTitle">Spin 5 ${egg.name}?</h2><p>Biaya total: ${cost} ${currency}. Tarif per telur: ${raritySummary(egg.rates)}. Pity berlaku di setiap tarikan.</p><div class="modal-actions"><button class="button secondary" data-action="close-modal">Batal</button><button class="button" data-action="confirm-batch" data-egg="${egg.id}">Konfirmasi spin 5</button></div>`);
}
function avatarPicker(){
  const avatars=['✨','🌙','🌿','⚡','🎀','🦊','🐸','🌸','🪄','☄️','🍓','🧙'];
  showModal(`<div class="eyebrow">AVATAR PEMAIN</div><h2 id="modalTitle">Pilih avatar</h2><div class="avatar-options">${avatars.map(avatar=>`<button class="avatar-option ${state.player.avatar===avatar?'selected':''}" data-action="set-avatar" data-avatar="${avatar}" aria-label="Pilih avatar ${avatar}">${avatar}</button>`).join('')}</div><button class="button secondary full" data-action="close-modal">Batal</button>`);
}

async function compressPlayerAvatar(file){if(!file||!file.type?.startsWith('image/'))throw new Error('Pilih file gambar yang valid.');if(file.size>8*1024*1024)throw new Error('Ukuran foto maksimal 8 MB.');const dataUrl=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error('Foto gagal dibaca.'));reader.readAsDataURL(file);});const image=await new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(new Error('Format foto tidak didukung.'));img.src=dataUrl;});const scale=Math.min(1,320/Math.max(image.width,image.height));const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.width*scale));canvas.height=Math.max(1,Math.round(image.height*scale));canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);return canvas.toDataURL('image/jpeg',0.78);}
document.addEventListener('change',async event=>{const input=event.target;if(!['starterAvatarFile','profileAvatarFile'].includes(input?.id)||!input.files?.[0])return;try{const avatar=await compressPlayerAvatar(input.files[0]);if(input.id==='starterAvatarFile'){window.TAMAVERSE_PENDING_AVATAR=avatar;showToast('Foto profil siap dipakai.');}else if(state){if(typeof window.uploadTamaverseAvatar!=='function')throw new Error('Layanan upload foto belum siap. Muat ulang aplikasi.');showToast('Mengunggah foto profil...');const url=await window.uploadTamaverseAvatar(avatar);state.player.avatarUrl=url;state.player.avatar=url;save();render();showToast('Foto profil berhasil disinkronkan!');}}catch(error){console.error('Avatar upload failed:',error);showToast(error?.message||'Gagal mengunggah foto.');}finally{input.value='';}});
async function purchasePremiumItem(itemId){
  const db=window.TAMAVERSE_SUPABASE_CLIENT;
  if(!db||!window.TAMAVERSE_USER_ID){showToast('Akun belum tersambung. Tunggu sinkronisasi lalu coba lagi.');return;}
  const costs={rename_card:50,rename_pet_card:50,frame_royal:200,frame_celestial:300};
  if(!Object.prototype.hasOwnProperty.call(costs,itemId))return;
  // Let the server validate the current wallet balance; the local value may be stale.
  try{
    const {data,error}=await db.rpc('purchase_tamaverse_premium_item',{p_item_id:itemId});
    if(error)throw error;
    const result=Array.isArray(data)?data[0]:data;
    if(!result||result.success!==true){showToast(result?.message||'Pembelian gagal.');return;}
    state.player.diamonds=Number(result.diamonds??state.player.diamonds);
    window.TAMAVERSE_PREMIUM_INVENTORY={rename_card_count:Number(result.rename_card_count||0),rename_pet_card_count:Number(result.rename_pet_card_count||0),owned_frames:Array.isArray(result.owned_frames)?result.owned_frames:['common']};
    save();render();showToast('Pembelian berhasil! Item masuk ke koleksi.');
  }catch(error){console.error('Premium purchase failed:',error);showToast(error?.message||'Pembelian gagal.');}
}
window.purchasePremiumItem=purchasePremiumItem;

async function convertDiamonds(button){
  const input=document.getElementById('diamondConvertAmount');
  const amount=Number(input?.value);
  const available=Math.floor(Number(state?.player?.diamonds)||0);
  if(!Number.isSafeInteger(amount)||amount<1||amount>available){
    showToast('Jumlah diamond tidak valid.');
    input?.focus();
    return;
  }
  const db=window.TAMAVERSE_SUPABASE_CLIENT;
  if(!db||!window.TAMAVERSE_USER_ID){
    showToast('Akun belum terhubung ke server. Coba masuk ulang.');
    return;
  }
  if(button?.disabled)return;
  if(button){button.disabled=true;button.textContent='Processing...';}
  try{
    const {data,error}=await db.rpc('tamaverse_convert_diamonds',{p_amount:amount});
    if(error)throw error;
    const result=Array.isArray(data)?data[0]:data;
    if(!result?.success||!Number.isFinite(Number(result.diamonds))||!Number.isFinite(Number(result.coins))){
      throw new Error('Respons konversi dari server tidak valid.');
    }
    state.player.diamonds=Number(result.diamonds);
    state.player.coins=Number(result.coins);
    save();
    closeModal();
    render();
    showToast(`Berhasil menukar ${amount} diamond menjadi ${(amount*500).toLocaleString('id-ID')} coin.`);
  }catch(error){
    console.error('Diamond conversion failed:',error);
    if(button){button.disabled=false;button.textContent='Convert';}
    const message=String(error?.message||'');
    if(message.includes('NOT_ENOUGH_DIAMONDS'))showToast('Diamond tidak mencukupi. Saldo sedang diperbarui.');
    else if(message.includes('AUTH_REQUIRED'))showToast('Sesi akun berakhir. Masuk ulang lalu coba lagi.');
    else if(message.includes('COIN_BALANCE_LIMIT'))showToast('Saldo Coin sudah mencapai batas maksimum.');
    else showToast('Convert gagal. Coba lagi sebentar.');
  }
}
document.addEventListener('click',event=>{
  const nav=event.target.closest('.nav-item');if(nav){const target=nav.dataset.page;const p=activePet();if(target==='battle'&&p&&petSleeping(p)){showToast(`${p.name} sedang tidur. Bangunkan dulu sebelum battle.`);return;}if(state?.mainQuestProgress?.prologue==='in_progress'){saveQuestCheckpoint('in_progress');closeModal();}page=target;render();return;}
  const btn=event.target.closest('[data-action]');if(!btn)return;const a=btn.dataset.action;
  if(a==='quest-start'){if((Number(state.player.level)||1)<1){showToast('Minimal Level 1 untuk memulai Prologue.');return;}resumePrologue();return;}if(a==='quest-next'){advanceQuestLine();return;}if(a==='quest-finish'){completeQuestLine();return;}if(a==='quest-test-reset'){const scope=btn.dataset.scope==='all'?'all':'prologue';showModal('<div class="eyebrow">QUEST TEST MODE</div><h2 id="modalTitle">Reset '+(scope==='all'?'semua quest':'Prologue')+'?</h2><p class="subtle">Ini hanya akan menghapus status dan checkpoint quest. Level, pet, coin, diamond, dan inventory tetap aman.</p><div class="modal-actions"><button class="button secondary" data-action="close-modal">Batal</button><button class="button" data-action="quest-test-confirm" data-scope="'+scope+'">Ya, reset quest</button></div>');return;}if(a==='quest-test-confirm'){const scope=btn.dataset.scope==='all'?'all':'prologue';state.mainQuestProgress=state.mainQuestProgress||{};state.mainQuestCheckpoints=state.mainQuestCheckpoints||{};if(scope==='all'){state.mainQuestProgress={};state.mainQuestCheckpoints={};}else{delete state.mainQuestProgress.prologue;delete state.mainQuestCheckpoints.prologue;}questLineIndex=0;save();closeModal();page='quest';render();showToast(scope==='all'?'Semua progres quest direset.':'Prologue siap dites ulang.');return;}if(a==='quest-test-opening'){state.introStoryStarted=true;state.introStoryCompleted=false;state.introStoryIndex=0;gameIntroIndex=0;save();closeModal();page='home';render();return;}if(a==='currency-convert'){openCurrencyExchange();return;}if(a==='diamond-store'){page='gacha';storeTab='diamond';render();return;}if(a==='convert-diamonds'){void convertDiamonds(btn);return;}if(a==='battle-section'){battleSection=btn.dataset.section==='solo'?'solo':'online';render();return;}if(a==='battle-cancel'){if(battle?.aiTimer)clearTimeout(battle.aiTimer);battle=null;render();return;}if(a==='collection-tab'){collectionTab=btn.dataset.tab==='accessories'?'accessories':'pets';render();return;}
  if(a==='store-tab'){storeTab=['diamond','premium'].includes(btn.dataset.tab)?btn.dataset.tab:'gacha';render();return;}
  if(a==='equip-frame'){const frame=accessoryFrameById(btn.dataset.frame);if(!ownsFrame(frame.id)){showToast('Frame ini masih terkunci. Beli dulu di Premium Store.');return;}state.equippedFrame=frame.id;save();render();showToast(frame.name+' frame equipped.');return;}
  if(a==='buy-premium'){purchasePremiumItem(btn.dataset.item);return;}
  if(a==='diamond-purchase'){
    const amount=Number(btn.dataset.amount);
    const prices={5:'Rp1.000',10:'Rp1.800',25:'Rp3.500',50:'Rp5.000',100:'Rp7.500',120:'Rp10.800',300:'Rp24.000',700:'Rp49.000'};
    if(!Object.prototype.hasOwnProperty.call(prices,amount))return;
    showModal(`<div class="eyebrow">TAMAVERSE · DIAMOND STORE</div>
      <h2 id="modalTitle">Purchase ${amount} Diamonds</h2>
      <p class="subtle">Paket ${amount} 💎 · ${prices[amount]}</p>
      <div class="card" style="margin:14px 0;text-align:center"><strong style="font-size:24px">💎 ${amount.toLocaleString('id-ID')}</strong><p class="muted-label">${prices[amount]}</p></div>
      <p class="notice">Pastikan akun Telegram sudah terhubung ke akun Tamaverse sebelum melanjutkan. Pembayaran hanya dilakukan setelah instruksi bot diterima.</p>
      <h3 style="margin:12px 0">Pilih metode pembayaran</h3>
      <div class="modal-actions" style="display:grid;grid-template-columns:1fr;gap:9px">
        <button class="button full" data-action="diamond-payment" data-amount="${amount}" data-method="qris">QRIS</button>
        <button class="button secondary full" data-action="diamond-payment" data-amount="${amount}" data-method="gopay">GoPay</button>
        <button class="button secondary full" data-action="close-modal">Batal</button>
      </div>`);
    return;
  }
  if(a==='diamond-payment'){
    const amount=Number(btn.dataset.amount);
    const method=btn.dataset.method;
    if(![5,10,25,50,100,120,300,700].includes(amount)||!['qris','gopay'].includes(method))return;
    closeModal();
    showToast('Menyiapkan checkout...');
    (async()=>{
      try{
        const db=window.TAMAVERSE_SUPABASE_CLIENT;
        if(!db?.functions?.invoke)throw new Error('Koneksi akun belum siap. Muat ulang Tamaverse lalu coba lagi.');
        if(typeof window.ensureTamaverseAuth!=='function')throw new Error('Autentikasi Telegram belum siap. Muat ulang Tamaverse.');
        await window.ensureTamaverseAuth();
        const {data,error}=await db.functions.invoke('create-checkout',{
          body:{diamonds:amount,method:method.toUpperCase()}
        });
        if(error)throw error;
        if(!data?.url)throw new Error(data?.error||'Link checkout gagal dibuat.');
        const tg=window.Telegram?.WebApp;
        if(tg?.openTelegramLink)tg.openTelegramLink(data.url);
        else window.location.href=data.url;
      }catch(error){
        console.error('Diamond checkout failed:',error);
        showToast(error?.message||'Checkout gagal dibuat. Coba lagi.');
      }
    })();
    return;
  }

  if(a==='online-leave'){event.stopImmediatePropagation();onlineLeaveRoom();return;}if(a==='online-result-dismiss'){event.stopImmediatePropagation();dismissOnlineResult();return;}
  if(a==='pick-profile-photo'){document.getElementById('profileAvatarFile')?.click();return;}if(a==='theme-toggle'){const next=document.body.dataset.theme==='dark'?'light':'dark';document.body.dataset.theme=next;try{localStorage.setItem('tamaverse_theme',next);}catch(e){showToast('Tema berubah, tetapi tidak dapat disimpan.');}applyTheme();return;}if(a==='start'){startIntro();return;}if(a==='finish-intro'){finishIntro();return;}if(a==='intro-story-next'){advanceGameIntro();return;}if(a==='retry-new-player-bonus'){claimNewPlayerWelcomeBonus();return;}if(a==='claim-diamond-event'){openNewPlayerBonusConfirmation();return;}if(a==='accept-diamond-event'){btn.disabled=true;btn.textContent='Memproses...';claimNewPlayerWelcomeBonus();return;}if(a==='close-modal'){closeModal();return;}if(a==='go'){const target=btn.dataset.page;const p=activePet();if(target==='battle'&&p&&petSleeping(p)){showToast(`${p.name} sedang tidur. Bangunkan dulu sebelum battle.`);return;}page=target;render();return;}if(a==='claim-daily'){claimDailyReward();return;}if(a==='care'){doCare(btn.dataset.care);return;}if(a==='inspect'){inspectPet(btn.dataset.pet);return;}if(a==='set-active'){
   const nextPet=petById(btn.dataset.pet);
   if(!nextPet)return;
   const now=Date.now();
   dailyReset(); // settle the outgoing active pet before pausing it
   state.activePet=nextPet.uid;
   nextPet.careUpdatedAt=now; // resume the selected pet from now
   closeModal();
   save();
   render();
   onlineUpdatePet();
   showToast('Pet aktif berhasil diganti.');
   return;
 }
if(a==='nickname-pet'){const p=petById(selectedPetId);if(!p)return;const count=Number(premiumInventory().rename_pet_card_count||0);showModal(`<div class="eyebrow">RENAME PET CARD</div><h2 id="modalTitle">Ganti nama companion</h2><p class="subtle">Gunakan Rename Pet Card. Kartu tersedia: <b>${count}</b></p><input class="text-input" id="newPetName" maxlength="18" value="${esc(p.name)}"><button class="button full" data-action="save-pet-name" ${count<1?'disabled':''}>Gunakan 1 Rename Pet Card</button>${count<1?'<button class="button secondary full" data-action="go-premium-store">Dapatkan kartu di Premium Store</button>':''}`);return;}if(a==='save-pet-name'){renameSelectedPet();return;}if(a==='rename-player'){const count=Number(premiumInventory().rename_card_count||0);showModal(`<div class="eyebrow">RENAME CARD</div><h2 id="modalTitle">Ganti nama pemain</h2><p class="subtle">Gunakan Rename Card. Kartu tersedia: <b>${count}</b></p><input class="text-input" id="playerNameInput" maxlength="18" value="${esc(state.player.name)}"><button class="button full" data-action="save-player-name" ${count<1?'disabled':''}>Gunakan 1 Rename Card</button>${count<1?'<button class="button secondary full" data-action="go-premium-store">Dapatkan kartu di Premium Store</button>':''}`);return;}if(a==='save-player-name'){renamePlayerWithCard();return;}if(a==='go-premium-store'){closeModal();page='shop';storeTab='premium';render();return;}if(a==='pull'){const e=eggs.find(x=>x.id===btn.dataset.egg);if(!e)return;const curr=e.currency==='diamond'?'diamond':'koin';showModal(`<div class="hatch-egg">${eggImage(e.id)}</div><h2 id="modalTitle">Buka ${e.name}?</h2><p>Biaya: ${e.price} ${curr}. Tarikan mengikuti tarif rarity yang ditampilkan.</p><div class="modal-actions"><button class="button secondary" data-action="close-modal">Batal</button><button class="button" data-action="confirm-pull" data-egg="${e.id}">Buka telur</button></div>`);return;}if(a==='confirm-pull'){const id=btn.dataset.egg;closeModal();pullEgg(id,false);return;}if(a==='freeegg'){pullEgg('basic',true);return;}if(a==='battle-start'){startBattle(btn.dataset.mode);return;}if(a==='battle-action'){battleAction(btn.dataset.move);return;}if(a==='claim'){doClaim(btn.dataset.quest);return;}if(a==='rebuy-quest'){rebuyQuest(btn.dataset.quest);return;}if(a==='daily-quests'){showDailyQuests();return;}if(a==='inventory-item'){showInventoryItem(btn.dataset.item);return;}if(a==='inventory-use'){const kind=btn.dataset.care;closeModal();doCare(kind);return;}if(a==='daily-reward'){showModal(`<div class="eyebrow">TAMAVERSE · DAILY BONUS</div><h2 id="modalTitle">Daily Reward</h2><p class="subtle">Login setiap hari untuk mengumpulkan hadiah 7 hari.</p>${dailyRewardCard()}<button class="button secondary full" data-action="close-modal">Tutup</button>`);return;}if(a==='inventory'){showInventory();return;}if(a==='shop'){page='shop';render();return;}if(a==='shop-back'){page='home';render();return;}if(a==='qty-minus'||a==='qty-plus'||a==='qty-max'){const type=btn.dataset.item;const prices={food:50,energy:40,snack:60,training:120};const price=prices[type];if(!price)return;const current=Math.max(1,Math.floor(Number(shopQuantities[type])||1));const affordable=Math.floor(state.player.coins/price);const next=a==='qty-max'?Math.max(1,affordable):a==='qty-plus'?Math.min(Math.max(1,affordable),current+1):Math.max(1,current-1);shopQuantities[type]=next;render();return;}if(a==='buy'){const type=btn.dataset.item;buyItem(type,shopQuantities[type]||1);return;}if(a==='reset'){resetGame();return;}if(a==='confirm-reset'){const accountKey=accountSaveKey();if(accountKey)localStorage.removeItem(accountKey);state=null;battle=null;page='home';closeModal();render();showToast('Save dihapus.');return;}
});
document.getElementById('modalBackdrop').addEventListener('click',e=>{if(e.target.id==='modalBackdrop')closeModal();});
document.addEventListener('click',event=>{
  const button=event.target.closest('[data-action]');if(!button)return;
  const action=button.dataset.action;

  if (action === 'online-random') {
    runOnlineAction('random', button, 'Searching...', onlineRandomMatch);
    return;
  }

  if (action === 'online-create') {
    runOnlineAction('create', button, 'Creating...', onlineCreateRoom);
    return;
  }

if (action === 'online-leave') {
  onlineLeaveRoom();
  return;
}

if (action === 'online-start-match') {
  runOnlineAction('start', button, 'Starting...', onlineStartMatch);
  return;
}
  if (action === 'online-battle-action') {
    runOnlineAction('battle', button, 'Sending...', () => onlineBattleAction(button.dataset.move));
    return;
  }

if (action === 'online-join-prompt') {
  showModal(`
    <div class="eyebrow">TAMAVERSE • ONLINE ARENA</div>
    <h2 id="modalTitle">Join Private Room</h2>
    <p class="subtle">Masukkan kode undangan dari temanmu untuk bergabung.</p>

    <div style="
      margin:18px 0;
      padding:16px;
      border-radius:16px;
      background:rgba(140,120,255,.10);
      border:1px solid rgba(140,120,255,.25);
    ">
      <label for="joinRoomCode" class="muted-label">ROOM INVITATION CODE</label>
      <input
        class="text-input"
        id="joinRoomCode"
        placeholder="Contoh: ABC123"
        maxlength="12"
        autocomplete="off"
        style="margin-top:9px;text-transform:uppercase;text-align:center;letter-spacing:3px;font-weight:700"
      >
    </div>

    <div class="modal-actions">
      <button class="button secondary" data-action="close-modal">Cancel</button>
      <button class="button" data-action="online-join-submit">Join Room →</button>
    </div>
  `);
  return;
}

if (action === 'online-join-submit') {
  const code = (document.getElementById('joinRoomCode')?.value || '').trim();
  if (!code) {
    showToast('Masukkan kode room terlebih dahulu.');
    return;
  }
  closeModal();
  runOnlineAction('join', button, 'Joining...', () => onlineJoinRoom(code));
  return;
}

  if (action === 'copy-online-link') {
    const input = document.getElementById('onlineInviteLink');
    if (input) {
      const fallbackCopy = () => {
        input.focus();
        input.select();
        try {
          const copied = document.execCommand('copy');
          showToast(copied ? 'Kode room berhasil disalin!' : 'Gagal menyalin kode room.');
        } catch (error) {
          showToast('Browser tidak mengizinkan penyalinan otomatis. Salin kode secara manual.');
        }
      };
      if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(input.value)
          .then(() => showToast('Kode room berhasil disalin!'))
          .catch(fallbackCopy);
      } else {
        fallbackCopy();
      }
    }
    return;
  }

  if(action==='pull-ten'){
    const egg=eggs.find(item=>item.id===button.dataset.egg);if(!egg)return;
    const currency=egg.currency==='diamond'?'diamonds':'coins';
    if(state.player[currency]<egg.price*5){showToast(`Perlu ${formatEggCost(egg,5)} untuk membuka 5 telur.`);return;}
    batchPullConfirmation(egg);
  }else if(action==='confirm-batch'){
    const id=button.dataset.egg;closeModal();runEggPulls(id,5,false);
  }else if(action==='avatar-picker'){
    avatarPicker();
  }else if(action==='set-avatar'){
    state.player.avatar=button.dataset.avatar;closeModal();save();render();showToast('Avatar diperbarui.');
  }else if(action==='exchange-fragment'){
    exchangeFragments(button.dataset.species,button.dataset.reward);
  }
});
document.addEventListener('click', async function(event) {
  const button = event.target.closest('[data-action="copy-user-id"]');
  if (!button) return;

  const id = window.TAMAVERSE_USER_ID;
  if (!id) {
    alert('User ID belum dimuat. Coba muat ulang game.');
    return;
  }

  try {
    await navigator.clipboard.writeText(id);
    alert('User ID berhasil disalin!');
  } catch (error) {
    const input = document.createElement('textarea');
    input.value = id;
    document.body.appendChild(input);
    input.select();
    const copied = document.execCommand('copy');
    input.remove();
    alert(copied ? 'User ID berhasil disalin!' : 'Gagal menyalin ID.');
  }
});

document.addEventListener('click', async function(event) {
  const button = event.target.closest('[data-action="create-telegram-link"]');
  if (!button) return;
  const client = window.TAMAVERSE_SUPABASE_CLIENT;
  if (!client || !window.TAMAVERSE_USER_ID) {
    alert('Akun cloud belum siap. Tunggu sebentar lalu coba lagi.');
    return;
  }
  button.disabled = true;
  const oldText = button.textContent;
  button.textContent = 'Membuat kode...';
  try {
    const { data, error } = await client.rpc('create_tamaverse_telegram_link_code');
    if (error) throw error;
    const code = String(data || '');
    try { await navigator.clipboard.writeText(code); } catch (_) {}
    alert('Kode Telegram: ' + code + '\\n\\nKirim ke @Nexorapaymbot dengan format:\\n/link ' + code + '\\n\\nBerlaku 10 menit.');
  } catch (error) {
    console.error('Telegram link code error:', error);
    alert('Gagal membuat kode: ' + (error.message || 'Coba lagi.'));
  } finally {
    button.disabled = false;
    button.textContent = oldText;
  }
});

try{
  const telegramApp=window.Telegram&&window.Telegram.WebApp;
  if(telegramApp){telegramApp.ready();telegramApp.expand();}
}catch(error){console.info('Telegram Mini App bridge is not available in this browser.');}
applyTheme();
render();


// =====================================
// TAMAVERSE ONLINE MATCHMAKING
// =====================================

let onlineRoom = null;
let onlineChannel = null;
let onlineRoomPoller = null;

const onlineActionLocks = new Set();
let onlineSkillCooldownTicker = null;
let onlineBattleFxTimer = null;
window.onlineBattleFx = 'idle';

async function runOnlineAction(key, button, loadingLabel, task) {
  if (onlineActionLocks.has(key)) return;
  onlineActionLocks.add(key);
  const originalLabel = button?.textContent;
  if (button) {
    button.disabled = true;
    if (loadingLabel) button.textContent = loadingLabel;
  }
  try {
    await task();
  } finally {
    onlineActionLocks.delete(key);
    if (button?.isConnected) {
      button.disabled = false;
      if (originalLabel !== undefined) button.textContent = originalLabel;
    }
  }
}


async function syncOnlinePetBeforeRoom() {
  const db = window.TAMAVERSE_SUPABASE_CLIENT;
  if (!db) throw new Error('Supabase belum terkoneksi.');
  const petData = getOnlinePetData();

  if (typeof window.savePlayerToSupabase === 'function') {
    await window.savePlayerToSupabase();
  }

  const userId = window.TAMAVERSE_USER_ID;
  // The queued cloud-save writer owns active-pet synchronization. Avoid a
  // second direct deactivate/activate sequence here, which could race with
  // another background save and violate pets_one_active_per_owner.
  const { data: selectedPet, error: verifyError } = await db
    .from('pets')
    .select('client_uid, is_active')
    .eq('owner_id', userId)
    .eq('client_uid', petData.pet_uid)
    .maybeSingle();
  if (verifyError) throw verifyError;
  if (!selectedPet?.is_active) {
    throw new Error('Pet pilihan belum tersimpan sebagai pet aktif di cloud. Muat ulang lalu pilih ulang pet.');
  }
}

async function onlineAuth() {
  const db = window.TAMAVERSE_SUPABASE_CLIENT;
  if (!db) throw new Error('Supabase belum terkoneksi.');

  if (typeof window.ensureTamaverseAuth !== 'function') {
    throw new Error('Autentikasi Telegram belum siap. Muat ulang Tamaverse.');
  }
  const user = await window.ensureTamaverseAuth();
  if (!user) throw new Error('Akun Telegram belum terhubung.');
  window.TAMAVERSE_USER_ID = user.id;
  return user;
}

function getOnlinePetData() {
  const selectedUid = state?.activePet;
  const pet = Array.isArray(state?.pets)
    ? state.pets.find(item => String(item.uid) === String(selectedUid))
    : null;
  if (!pet) throw new Error('Pet aktif tidak ditemukan. Pilih pet dari koleksi terlebih dahulu.');

  const sp = speciesById(pet.species);

  return {
    display_name: state.player.name || 'Player',
    pet_uid: String(pet.uid),
    name: pet.name,
    species: pet.species,
    level: Number(pet.level || 1),
    element: sp.element,
    stats: {
      hp: Number(pet.stats.hp || 100),
      atk: Number(pet.stats.atk || 10),
      def: Number(pet.stats.def || 5)
    }
  };
}


async function onlineBattleAction(move) {
  try {
    if (!onlineRoom?.id) throw new Error('Room tidak ditemukan.');
    const db = window.TAMAVERSE_SUPABASE_CLIENT;
    const { data, error } = await db.rpc('pvp_battle_action', { p_room_id: onlineRoom.id, p_action: move });
    if (error) throw error;
    const actionResult = Array.isArray(data) ? data[0] : data;
    if (!actionResult || typeof actionResult !== 'object') throw new Error('Server tidak mengembalikan status battle yang valid.');
    onlineRoom = { ...onlineRoom, ...actionResult };
    if(move==='skill')onlineSkillClientReadyAt=Date.now()+5000;
    window.onlineBattleFx = move;
    if (onlineBattleFxTimer) clearTimeout(onlineBattleFxTimer);
    onlineBattleFxTimer = setTimeout(() => { window.onlineBattleFx = 'idle'; if (onlineRoom?.id) render(); }, 1100);

    const { data: inventory, error: inventoryError } = await db.from('inventory').select('snack').eq('owner_id', window.TAMAVERSE_USER_ID).maybeSingle();
    if (!inventoryError && inventory) state.items.snack = Number(inventory.snack || 0);

    if (actionResult.status === 'finished' && typeof window.loadPlayerFromSupabase === 'function') {
      await window.loadPlayerFromSupabase();
    } else {
      render();
    }

    if (actionResult.status === 'finished') {
      const result = actionResult.battle_state?.result;
      const winner = actionResult.battle_state?.winner_id;
      const outcome = result === 'draw' ? 'Seri!' : winner === window.TAMAVERSE_USER_ID ? 'Kemenangan!' : 'Pertandingan selesai';
      showModal(`<div class="hatch-egg">${result === 'draw' ? '🤝' : winner === window.TAMAVERSE_USER_ID ? '🏆' : '💫'}</div>
        <h2 id="modalTitle" style="text-align:center">${outcome}</h2>
        <p style="text-align:center">${result === 'draw' ? 'Battle berakhir imbang.' : winner === window.TAMAVERSE_USER_ID ? 'Kamu mendapat 35 koin, rating, dan XP pet.' : 'Kamu mendapat XP pet. Coba lagi di pertandingan berikutnya.'}</p>
        <button class="button full" data-action="close-modal">Lanjut</button>`);
    } else {
      showToast('Aksi berhasil dikirim.');
    }
  } catch (error) {
    window.onlineBattleFx = 'idle';
    if (onlineBattleFxTimer) clearTimeout(onlineBattleFxTimer);
    console.error('Online battle action failed:', error);
    render();
    showToast(error.message || 'Aksi battle gagal.');
  }
}

function onlineBattleView() {
  const room = onlineRoom;
  const mineIsHost = room.host_id === window.TAMAVERSE_USER_ID;
  const mine = mineIsHost ? room.host_data : room.guest_data;
  const rival = mineIsHost ? room.guest_data : room.host_data;
  const bs = room.battle_state || {};
  const myHp = Math.max(0, Number(bs[mineIsHost ? 'host_hp' : 'guest_hp'] || 0));
  const rivalHp = Math.max(0, Number(bs[mineIsHost ? 'guest_hp' : 'host_hp'] || 0));
  const myMax = Math.max(1, Number(mine?.stats?.hp || 1));
  const rivalMax = Math.max(1, Number(rival?.stats?.hp || 1));
  const snackCount = Number(state.items.snack || 0);
  const snackUseful = myHp < myMax;
  const myTurn = room.current_turn === window.TAMAVERSE_USER_ID;
  const finished = room.status === 'finished';
  const mySpecies = speciesById(mine?.species);
  const rivalSpecies = speciesById(rival?.species);
  const log = Array.isArray(bs.log) ? bs.log : [];
  const turn = Number(bs.turn || 1);
  const latestAction = log.length ? log[log.length - 1] : null;
  const actionDamage = Number(latestAction?.damage || String(latestAction?.text || '').match(/(\\d+)\\s*damage/i)?.[1] || 0);
  const actionHeal = Number(latestAction?.heal || String(latestAction?.text || '').match(/memulihkan\\s+(\\d+)\\s+HP/i)?.[1] || 0);
  const actionActor = latestAction?.actor_id || null;
  const actionTarget = latestAction?.target_id || null;
  const actorIsMine = actionActor
    ? actionActor === window.TAMAVERSE_USER_ID
    : String(latestAction?.text || '').startsWith(String(mine?.name || mine?.display_name || '__no_match__'));
  const targetIsMine = actionTarget
    ? actionTarget === window.TAMAVERSE_USER_ID
    : actionDamage > 0 && !actorIsMine;
  const myFloat = actionDamage > 0 && targetIsMine
    ? { text: '-' + actionDamage, kind: 'damage' }
    : actionHeal > 0 && actorIsMine
      ? { text: '+' + actionHeal, kind: 'heal' } : null;
  const rivalFloat = actionDamage > 0 && !targetIsMine
    ? { text: '-' + actionDamage, kind: 'damage' }
    : actionHeal > 0 && !actorIsMine
      ? { text: '+' + actionHeal, kind: 'heal' } : null;
  const skillReadyKey = mineIsHost ? 'host_skill_ready_at' : 'guest_skill_ready_at';
  const serverSkillReadyAt = bs[skillReadyKey] ? Date.parse(bs[skillReadyKey]) : 0;
  const skillReadyAt = Math.max(serverSkillReadyAt || 0, onlineSkillClientReadyAt);
  const skillCooldown = Math.max(0, Math.ceil((skillReadyAt - Date.now()) / 1000));
  if (onlineSkillCooldownTicker) clearTimeout(onlineSkillCooldownTicker);
  if (skillCooldown > 0 && myTurn && !finished) onlineSkillCooldownTicker = setTimeout(() => {
    if (onlineRoom?.id === room.id && page === 'battle') render();
  }, 1000);
  return `
    <section class="page online-battle-page battle-mode-screen${finished ? " battle-finished" : ""}">
      <div class="battle-mode-top">
        <button class="battle-exit" data-action="online-leave" type="button" aria-label="Leave battle">←</button>
        <div><div class="eyebrow">TAMAVERSE ARENA</div><h1>Battle Match</h1></div>
        <div class="battle-turn-chip">TURN ${turn}</div>
      </div>
      <div class="battle-scene battle-fx-${esc(window.onlineBattleFx || 'idle')}${finished ? " battle-scene-finished" : ""}" aria-label="Online battle arena">
        <div class="arena-sky">
          <span class="arena-moon">✦</span>
          <span class="arena-cloud cloud-one">☁</span>
          <span class="arena-cloud cloud-two">☁</span>
          <span class="arena-light light-one"></span>
          <span class="arena-light light-two"></span>
        </div>
        <div class="battle-turn-overlay"><b>${finished ? (bs.result === "draw" ? "MATCH DRAW" : bs.winner_id === window.TAMAVERSE_USER_ID ? "YOU WIN" : "MATCH OVER") : myTurn ? "YOUR TURN" : "OPPONENT’S TURN"}</b><span>TURN ${turn}</span></div>
        <div class="arena-platform platform-player"></div>
        <div class="arena-platform platform-enemy"></div>
        <div class="battle-side battle-player">
          <div class="battle-nameplate">
            <b>${esc(mine?.name || mine?.display_name || 'Your Pet')}</b>
            <span>${esc(mySpecies.element || mine?.element || 'Unknown')} · Lv.${Number(mine?.level || 1)}</span>
          </div>
          <div class="battle-sprite" data-species="${esc(mine?.species || '')}">${battlePetImage(mine?.species, 'player', 'battle-pet-image')}</div>
          <span class="battle-effect effect-player"></span><span class="battle-impact impact-player"></span>${myFloat ? `<span class="battle-floating-number ${myFloat.kind}">${myFloat.text}</span>` : ""}
          <div class="battle-hp-card"><div class="hp-value">${myHp} / ${myMax} HP</div><div class="progress-track"><div class="progress-fill" style="width:${Math.min(100,myHp/myMax*100)}%"></div></div><div class="battle-pet-caption"><b>${esc(mine?.name || mine?.display_name || "Your Pet")}</b><span>Lv.${Number(mine?.level || 1)}</span></div></div>
        </div>
        
        <div class="battle-side battle-enemy">
          <div class="battle-nameplate">
            <b>${esc(rival?.name || rival?.display_name || 'Opponent Pet')}</b>
            <span>${esc(rivalSpecies.element || rival?.element || 'Unknown')} · Lv.${Number(rival?.level || 1)}</span>
          </div>
          <div class="battle-sprite" data-species="${esc(rival?.species || '')}">${battlePetImage(rival?.species, 'enemy', 'battle-pet-image')}</div>
          <span class="battle-effect effect-enemy"></span><span class="battle-impact impact-enemy"></span>${rivalFloat ? `<span class="battle-floating-number ${rivalFloat.kind}">${rivalFloat.text}</span>` : ""}
          <div class="battle-hp-card"><div class="hp-value">${rivalHp} / ${rivalMax} HP</div><div class="progress-track"><div class="progress-fill enemy-hp" style="width:${Math.min(100,rivalHp/rivalMax*100)}%"></div></div><div class="battle-pet-caption"><b>${esc(rival?.name || rival?.display_name || "Opponent Pet")}</b><span>Lv.${Number(rival?.level || 1)}</span></div></div>
        </div>
        <div class="battle-arena-controls">
          <div class="battle-action-status">${finished ? (bs.result === 'draw' ? 'MATCH DRAW' : bs.winner_id === window.TAMAVERSE_USER_ID ? '🏆 YOU WIN!' : 'MATCH OVER') : myTurn ? '✨ YOUR TURN — CHOOSE ACTION' : 'WAITING FOR OPPONENT...'}</div>
          ${finished ? '<button class="battle-action-btn battle-action-main" data-action="online-result-dismiss">Back to Battle</button>' : `
            <div class="battle-action-grid">
              <button class="battle-action-btn battle-action-main" data-action="online-battle-action" data-move="attack" ${myTurn ? '' : 'disabled'}><span>⚔️</span>Attack</button>
              <button class="battle-action-btn battle-action-skill" data-action="online-battle-action" data-move="skill" ${myTurn && skillCooldown === 0 ? '' : 'disabled'}><span>✨</span>Skill${skillCooldown > 0 ? ` · ${skillCooldown}s` : ''}</button>
              <button class="battle-action-btn battle-action-defend" data-action="online-battle-action" data-move="defend" ${myTurn ? '' : 'disabled'}><span>🛡️</span>Defend</button>
              <button class="battle-action-btn battle-action-item" data-action="online-battle-action" data-move="item" ${myTurn && snackCount > 0 && snackUseful ? '' : 'disabled'}><img src="assets/items/HealthPotion.webp" alt="" class="battle-item-image">Item · ${snackCount}</button>
            </div>
          `}
        </div>
      </div>
      <div class="battle-log-panel"><div class="battle-log-heading">BATTLE LOG <span>TURN ${turn}</span></div><div class="battle-log">${log.slice(-4).map(item => `<div>• ${esc(item.text || '')}</div>`).join('') || '<div>Battle dimulai. Pilih aksi pertamamu.</div>'}</div></div>
    </section>
  `;
}

let leavingOnlineRoom = false;

async function dismissOnlineResult() {
  const db = window.TAMAVERSE_SUPABASE_CLIENT;
  if (onlineChannel && db) { await db.removeChannel(onlineChannel); onlineChannel = null; }
  if (onlineRoomPoller) { clearInterval(onlineRoomPoller); onlineRoomPoller = null; }
  onlineRoom = null;
  page = 'battle';
  render();
  showToast('Kembali ke halaman Battle.');
}

async function onlineLeaveRoom() {
  if (leavingOnlineRoom) return;
  if (!onlineRoom?.id) {
    showToast('Room tidak ditemukan. Coba refresh game.');
    return;
  }

  leavingOnlineRoom = true;
  const leaveButton = document.querySelector('[data-action="online-leave"]');
  if (leaveButton) {
    leaveButton.disabled = true;
    leaveButton.textContent = 'Leaving...';
  }

  try {
    const db = window.TAMAVERSE_SUPABASE_CLIENT;
    if (!db) throw new Error('Supabase belum terkoneksi.');
    const roomId = onlineRoom.id;

    const { data, error } = await db.rpc('leave_pvp_room', {
      p_room_id: roomId
    });
    if (error) throw error;

    if (onlineChannel) {
      await db.removeChannel(onlineChannel);
      onlineChannel = null;
    }
    if (onlineRoomPoller) {
      clearInterval(onlineRoomPoller);
      onlineRoomPoller = null;
    }

    onlineRoom = null;
    leavingOnlineRoom = false;
    page = 'battle';
    render();

    showToast(
      data?.status === 'closed'
        ? 'Room ditutup karena host keluar.'
        : 'Kamu berhasil keluar dari room.'
    );
  } catch (error) {
    console.error('Leave online room failed:', error);
    leavingOnlineRoom = false;
    render();
    showToast(error.message || 'Gagal keluar dari room. Coba lagi.');
  }
}

async function onlineUpdatePet() {
  try {
    if (!onlineRoom?.id || onlineRoom.status === 'playing') return;

    const db = window.TAMAVERSE_SUPABASE_CLIENT;
    await syncOnlinePetBeforeRoom();

    const { error } = await db.rpc('update_pvp_pet', {
      p_room_id: onlineRoom.id,
      p_pet_data: getOnlinePetData()
    });

    if (error) throw error;

  } catch (error) {
    console.error('Update pet room:', error);
  }
}


async function onlineStartMatch() {
  try {
    const pet=activePet();if(!pet){showToast('Kamu belum punya pet!');return;}if(petSleeping(pet)){showToast(`${pet.name} sedang tidur. Bangunkan dulu sebelum battle.`);return;}if(pet.happiness<20){showToast(battleMoodMessage(pet));return;}if(pet.energy<25){showToast('Energi pet minimal 25 untuk battle.');return;}
    const db = window.TAMAVERSE_SUPABASE_CLIENT;
    const roomId = onlineRoom?.id || onlineRoom?.room_id;
    if (!roomId) throw new Error('Room tidak ditemukan.');

    await onlineAuth();

    // Reconfirm the host pet in cloud immediately before starting. Refreshing
    // the room snapshot also prevents an old pet_uid from being validated.
    await syncOnlinePetBeforeRoom();
    const { error: petUpdateError } = await db.rpc('update_pvp_pet', {
      p_room_id: roomId,
      p_pet_data: getOnlinePetData()
    });
    if (petUpdateError) throw petUpdateError;

    const { data, error } = await db.rpc('start_pvp_match', {
      p_room_id: roomId
    });

    if (error) throw error;
    const startedRoom = Array.isArray(data) ? data[0] : data;
    if (!startedRoom || typeof startedRoom !== 'object') throw new Error('Server tidak mengembalikan status match yang valid.');

    const active=activePet();if(active){active.energy=clamp(active.energy-25,0,100);active.careUpdatedAt=Date.now();save();}
    onlineRoom = { ...onlineRoom, ...startedRoom, id: startedRoom.room_id || startedRoom.id || roomId };
    render();
    showToast('Match dimulai!');
    subscribeOnlineRoom(onlineRoom.id);
  } catch (error) {
    console.error(error);
    showToast(error.message || 'Gagal memulai match.');
  }
}

async function onlineRandomMatch() {
  try {
    const pet=activePet();if(!pet){showToast('Kamu belum punya pet!');return;}if(petSleeping(pet)){showToast(`${pet.name} sedang tidur. Bangunkan dulu sebelum battle.`);return;}if(pet.happiness<20){showToast(battleMoodMessage(pet));return;}if(pet.energy<25){showToast('Energi pet minimal 25 untuk battle.');return;}
    await onlineAuth();
    await syncOnlinePetBeforeRoom();
    const db = window.TAMAVERSE_SUPABASE_CLIENT;

    const { data, error } = await db.rpc('find_random_match', {
      p_display_name: state.player.name || 'Player',
      p_pet_data: getOnlinePetData()
    });

    if (error) throw error;
    const matchResult = Array.isArray(data) ? data[0] : data;
    const roomId = matchResult?.room_id || matchResult?.id || matchResult?.room?.id;
    if (!roomId) throw new Error('Matchmaking tidak mengembalikan Room ID. Periksa RPC find_random_match.');

    const { data: roomRow, error: roomLoadError } = await db
      .from('pvp_rooms')
      .select('*')
      .eq('id', roomId)
      .single();
    if (roomLoadError) throw roomLoadError;

    onlineRoom = { ...roomRow, id: roomRow.id, matched: !!matchResult.matched };
    page = 'battle';
    render();

    if (matchResult.matched) {
      showToast('Lawan ditemukan! Room siap.');
    } else {
      showToast('Mencari lawan... tunggu pemain lain.');
    }
    await subscribeOnlineRoom(roomId);
  } catch (error) {
    console.error(error);
    showToast(error.message || 'Gagal mencari lawan.');
  }
}

async function onlineCreateRoom() {
  try {
    const pet=activePet();if(!pet){showToast('Kamu belum punya pet!');return;}if(petSleeping(pet)){showToast(`${pet.name} sedang tidur. Bangunkan dulu sebelum battle.`);return;}if(pet.happiness<20){showToast(battleMoodMessage(pet));return;}if(pet.energy<25){showToast('Energi pet minimal 25 untuk battle.');return;}
    await onlineAuth();
    await syncOnlinePetBeforeRoom();
    const db = window.TAMAVERSE_SUPABASE_CLIENT;

    const { data, error } = await db.rpc('create_pvp_room', {
      p_pet_data: getOnlinePetData()
    });

    if (error) throw error;
    const createResult = Array.isArray(data) ? data[0] : data;
    const roomId = createResult?.room_id || createResult?.id || createResult?.room?.id;
    if (!roomId) throw new Error('Create room tidak mengembalikan Room ID. Periksa RPC create_pvp_room.');

    const { data: roomRow, error: roomLoadError } = await db
      .from('pvp_rooms')
      .select('*')
      .eq('id', roomId)
      .single();
    if (roomLoadError) throw roomLoadError;

    onlineRoom = { ...roomRow, id: roomRow.id };
    page = 'battle';
    render();

    showToast('Private room berhasil dibuat. Bagikan kode room ke temanmu.');

    await subscribeOnlineRoom(roomId);
  } catch (error) {
    console.error(error);
    showToast(error.message || 'Gagal membuat room.');
  }
}

async function onlineJoinRoom(code) {
  try {
    await onlineAuth();
    await syncOnlinePetBeforeRoom();
    const db = window.TAMAVERSE_SUPABASE_CLIENT;

    const { data, error } = await db.rpc('join_pvp_room', {
      p_invite_code: code,
      p_pet_data: getOnlinePetData()
    });

    if (error) throw error;
    const joinResult = Array.isArray(data) ? data[0] : data;
    const roomId = joinResult?.room_id || joinResult?.id || joinResult?.room?.id;
    if (!roomId) throw new Error('Join room tidak mengembalikan Room ID. Periksa RPC join_pvp_room.');

    const { data: roomData, error: roomError } = await db
      .from('pvp_rooms')
      .select('*')
      .eq('id', roomId)
      .single();

    if (roomError) throw roomError;

    onlineRoom = roomData;
    page = 'battle';
    render();
    showToast('Berhasil masuk room!');
    await subscribeOnlineRoom(roomId);
  } catch (error) {
    console.error(error);
    showToast(error.message || 'Gagal masuk room.');
  }
}


async function refreshOnlineRoom(roomId, shouldRender = true) {
  const db = window.TAMAVERSE_SUPABASE_CLIENT;
  if (!db || !roomId) return null;

  const { data, error } = await db
    .from('pvp_rooms')
    .select('*')
    .eq('id', roomId)
    .maybeSingle();

  if (error) {
    console.warn('Refresh online room failed:', error);
    return null;
  }
  if (!data) return null;

  if (data.status === 'closed') {
    if (onlineChannel) {
      await db.removeChannel(onlineChannel);
      onlineChannel = null;
    }
    if (onlineRoomPoller) {
      clearInterval(onlineRoomPoller);
      onlineRoomPoller = null;
    }
    onlineRoom = null;
    if (page === 'battle') render();
    showToast('Host telah menutup room.');
    return data;
  }

  const previousRoomSnapshot = onlineRoom ? JSON.stringify(onlineRoom) : '';
  onlineRoom = { ...onlineRoom, ...data, id: data.id };
  const nextRoomSnapshot = JSON.stringify(onlineRoom);
  // Polling runs every 1.5s; avoid rebuilding the whole app when room data
  // has not changed, which causes visible black flashes on mobile WebViews.
  if (shouldRender && page === 'battle' && previousRoomSnapshot !== nextRoomSnapshot) render();
  return data;
}

async function subscribeOnlineRoom(roomId) {
  const db = window.TAMAVERSE_SUPABASE_CLIENT;
  if (!db || !roomId) return;

  if (onlineChannel) {
    await db.removeChannel(onlineChannel);
    onlineChannel = null;
  }
  if (onlineRoomPoller) {
    clearInterval(onlineRoomPoller);
    onlineRoomPoller = null;
  }

  onlineChannel = db
    .channel(`pvp-room-${roomId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'pvp_rooms',
        filter: `id=eq.${roomId}`
      },
      async payload => {
        const room = payload.new;
        if (!room || room.id !== roomId) return;

        if (room.status === 'closed') {
          if (onlineChannel) {
            await db.removeChannel(onlineChannel);
            onlineChannel = null;
          }
          if (onlineRoomPoller) {
            clearInterval(onlineRoomPoller);
            onlineRoomPoller = null;
          }
          onlineRoom = null;
          render();
          showToast('Host telah menutup room.');
          return;
        }

        const previousRoomSnapshot = onlineRoom ? JSON.stringify(onlineRoom) : '';
        onlineRoom = { ...onlineRoom, ...room, id: room.id };
        const nextRoomSnapshot = JSON.stringify(onlineRoom);
        if (room.status === 'finished' && typeof window.loadPlayerFromSupabase === 'function') {
          await window.loadPlayerFromSupabase();
          render();
        } else if (previousRoomSnapshot !== nextRoomSnapshot) {
          render();
        }

        if (room.status === 'ready') {
          showToast('Teman ditemukan! Room siap.');
        } else if (room.status === 'waiting' && room.guest_id === null) {
          showToast('Guest keluar. Room kembali menunggu pemain.');
        }
      }
    )
    .subscribe(async status => {
      if (status === 'SUBSCRIBED') {
        await refreshOnlineRoom(roomId, true);
      }
    });

  // Realtime is the fast path. Keep polling during active matches too:
  // it is the fallback when pvp_rooms is not enabled in the Realtime publication
  // or a client misses an event while the app is backgrounded.
  onlineRoomPoller = setInterval(async () => {
    if (!onlineRoom || onlineRoom.id !== roomId ||
        ['finished', 'closed'].includes(onlineRoom.status)) {
      clearInterval(onlineRoomPoller);
      onlineRoomPoller = null;
      return;
    }
    await refreshOnlineRoom(roomId, true);
  }, 1500);

  await refreshOnlineRoom(roomId, true);
}


function onlineBattlePage() {
  if (onlineRoom && ['playing', 'finished'].includes(onlineRoom.status)) return onlineBattleView();
  return `
    <section class="page">
      <div class="eyebrow">TAMAVERSE ONLINE ARENA</div>
      <h1 class="page-title">Online Match</h1>
      <div class="battle-online-hero">
        <div class="battle-online-hero-icon">🌐</div>
        <div class="battle-online-hero-copy">
          <span class="battle-online-live"><i></i> ONLINE ARENA</span>
          <h2>Find your rival</h2>
          <p>Hadapi pemain lain secara real-time. Buat room pribadi atau cari lawan secara acak.</p>
        </div>
        <div class="battle-online-spark">✦</div>
      </div>

      <div class="card battle-online-match-card">
        <h2>⚔️ Random Match</h2>
        <p class="subtle">Cari pemain lain secara acak.</p>
        <button class="button full" data-action="online-random">
          Cari lawan
        </button>
</div>
      <div class="card" style="
  margin-top:14px;
  padding:20px;
  border:1px solid rgba(140,120,255,.25);
  background:linear-gradient(145deg,rgba(115,90,220,.13),rgba(40,45,75,.08));
  border-radius:18px;
">
  <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px">
    <div style="
      width:44px;height:44px;border-radius:14px;
      display:grid;place-items:center;
      background:rgba(140,120,255,.18);
      font-size:22px;
    ">✦</div>
    <div>
      <h2 style="margin:0">Play with Friends</h2>
      <p class="subtle" style="margin:4px 0 0">Challenge someone in a private room.</p>
    </div>
  </div>

  <button class="button full" data-action="online-create">
    ✚ Create Private Room
  </button>

  <div style="
    display:flex;align-items:center;gap:10px;
    margin:17px 0;color:var(--muted,#888);
    font-size:11px;letter-spacing:2px;
  ">
    <span style="height:1px;flex:1;background:currentColor;opacity:.25"></span>
    OR JOIN WITH CODE
    <span style="height:1px;flex:1;background:currentColor;opacity:.25"></span>
  </div>

  <button class="button secondary full" data-action="online-join-prompt">
    Enter Room Code →
  </button>
</div>

     ${onlineRoom ? `
  <div class="card" style="margin-top:14px;padding:20px">
    <div class="eyebrow">${onlineRoom.room_type === 'public' ? 'RANDOM MATCH ROOM' : 'PRIVATE FRIEND ROOM'}</div>
    ${onlineRoom.room_type === 'public' ? '<h3>Random Match</h3>' : `<h3>Private Room</h3><div style="display:flex;gap:8px;align-items:center;margin:12px 0"><input id="onlineInviteLink" class="text-input" value="${esc(onlineRoom.invite_code || '')}" readonly aria-label="Kode private room" style="flex:1;min-width:0;text-align:center;letter-spacing:3px;font-weight:700"><button class="button" data-action="copy-online-link" type="button">Copy Code</button></div>`}

<div style="
  display:grid;
  grid-template-columns:1fr 1fr;
  gap:10px;
  margin:16px 0;
">
  ${[
    { label: 'HOST', data: onlineRoom.host_data },
    { label: 'GUEST', data: onlineRoom.guest_data }
  ].map(player => `
    <div class="card" style="padding:14px;margin:0">
      <div class="eyebrow">${player.label}</div>
      <h3 style="margin:8px 0">
        ${esc(player.data?.display_name || 'Waiting...')}
      </h3>
      <p class="subtle" style="margin:4px 0">
        Pet: ${esc(player.data?.name || '—')}
      </p>
      <p class="subtle" style="margin:4px 0">
        Level: ${player.data?.level || '—'}
      </p>
      <p class="subtle" style="margin:4px 0">
        Element: ${esc(player.data?.element || '—')}
      </p>
    </div>
  `).join('')}
</div>

    <p class="subtle">
      ${onlineRoom.status === 'ready'
        ? '2/2 Players Ready'
        : onlineRoom.status === 'playing'
          ? 'Match sedang berlangsung!'
          : '1/2 Players • Menunggu lawan...'}
    </p>

    ${onlineRoom.status === 'ready' &&
      onlineRoom.host_id === window.TAMAVERSE_USER_ID ? `
        <button class="button full" data-action="online-start-match">
          ⚔ Start Match
        </button>
      ` : ''}

    ${onlineRoom.status === 'ready' &&
      onlineRoom.host_id !== window.TAMAVERSE_USER_ID ? `
        <p class="subtle">Menunggu host memulai pertandingan...</p>
      ` : ''}

    ${onlineRoom.status === 'playing' ? onlineBattleView() : onlineRoom.status === 'finished' ? `<div class="card" style="margin-top:14px;padding:18px;text-align:center"><div class="eyebrow">MATCH COMPLETE</div><h2>Battle selesai</h2><p class="subtle">Hasil: ${onlineRoom.battle_state?.result === 'draw' ? 'Seri' : onlineRoom.battle_state?.winner_id === window.TAMAVERSE_USER_ID ? 'Menang' : 'Kalah'}</p><button class="button full" data-action="online-result-dismiss">Kembali ke Battle</button></div>` : ''}
<button
  class="button secondary full"
  style="margin-top:12px"
  data-action="online-leave"
>
  ${onlineRoom.room_type === 'public' && onlineRoom.status === 'waiting' ? 'Cancel Search' : 'Leave Room'}
</button>

  </div>
` : ''}
    </section>
  `;
}