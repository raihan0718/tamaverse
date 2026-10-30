function normalizeSavedState(saved){
  const base=freshState(saved.player.name);
  const previousPlayer=saved.player;
  const defaultQuestProgress={feed:0,play:0,battle:0,win:0,egg:0};
  const defaultCareUses={date:new Date().toDateString(),feed:0,play:0,train:0,battleRewards:0};
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
  const questProgress = oldQuests.progress
    ? { ...defaultQuestProgress, ...oldQuests.progress }
    : {
        feed:Number(oldQuests.feedPet?.progress)||0,
        play:Number(oldQuests.playPet?.progress)||0,
        battle:Number(oldQuests.battle?.progress)||0,
        win:Number(oldQuests.battleWin?.progress)||0,
        egg:Number(oldQuests.hatchEgg?.progress)||0
      };
  base.quests={
    date:oldQuests.date||new Date().toDateString(),
    progress:questProgress,
    claimed:Array.isArray(oldQuests.claimed)?oldQuests.claimed:[]
  };
  const today=new Date().toDateString();
  base.careUses=saved.careUses?{...defaultCareUses,...saved.careUses,date:toLocalDay(saved.careUses.date)||today}:{...defaultCareUses,date:today};
  base.lastCareUpdate=Number(saved.lastCareUpdate)||Date.now();
  base.dailyReward=saved.dailyReward||{lastClaimDate:'',day:0};
  base.battleHistory=Array.isArray(saved.battleHistory)?saved.battleHistory:[];
  return base;
}
