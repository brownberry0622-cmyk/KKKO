(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.EquipmentCore=api;})(globalThis,function(){'use strict';
const SLOTS=Object.freeze({melee:'刀',spear:'长柄',bow:'弓',armor:'防具',boots:'战靴',charm:'护符'});
const RARITIES=Object.freeze([{name:'寻常',color:'#c7d1d0',scale:1},{name:'精良',color:'#75cbe7',scale:1.5},{name:'珍品',color:'#c9a2ff',scale:2},{name:'名器',color:'#f1ce81',scale:2.7}]);
const MODELS=Object.freeze({
 melee:['素铁横刀','乌鞘横刀','银错横刀','金装横刀'],
 spear:['白蜡长矛','乌杆马槊','银锋重槊','陌刀·摧阵'],
 bow:['桑木弓','乌角弓','银饰角弓','金装角弓'],
 armor:['玄铁札甲','朱漆札甲','银鳞明光甲','金饰明光甲'],
 boots:['乌皮战靴','赤革战靴','银护胫靴','金护胫靴'],
 charm:['铜符','青玉佩','白玉佩','金虎符']
});
function equipped(bag,slot){return bag?.items.find(it=>it.id===bag.equipped[slot]&&it.slot===slot)||null;}
function isModao(bag){return equipped(bag,'spear')?.rarity===3;}

const chance={infantry:.18,archer:.22,cavalry:.45};
const round=n=>Math.round(n*100)/100;
function create(slot,rarity=0,chapter=1,id='gear-1'){
 if(!SLOTS[slot])throw Error('Unknown equipment slot');
 rarity=Math.max(0,Math.min(3,Math.floor(rarity)));chapter=Math.max(1,Math.min(6,Math.floor(chapter)));
 const strength=RARITIES[rarity].scale*(1+(chapter-1)*.12),stats={};
 if(['melee','spear','bow'].includes(slot))stats.attack=round(.12*strength);
 if(slot==='armor'){stats.maxHp=Math.round(12*strength);stats.armor=round(.03*strength);}
 if(slot==='boots')stats.speed=round(.07*strength);
 if(slot==='charm'){stats.maxHp=Math.round(8*strength);stats.attack=round(.04*strength);}
 if(slot==='spear'&&rarity===3)stats.attack=round(.32*strength);
 return {id,slot,rarity,chapter,appearance:slot+'-'+rarity,name:RARITIES[rarity].name+'·'+MODELS[slot][rarity],stats};
}
function empty(){return {version:2,items:[],equipped:{},sequence:0,dryKills:0};}
function restore(raw){
 const bag=empty();if(!raw||!Array.isArray(raw.items))return bag;
 const ids=new Set();for(const it of raw.items){
  if(!it||!SLOTS[it.slot]||typeof it.id!=='string'||!/^gear-\d+$/.test(it.id)||ids.has(it.id))continue;
  if(!Number.isFinite(it.rarity)||!Number.isFinite(it.chapter))continue;
  const item=create(it.slot,it.rarity,it.chapter,it.id);bag.items.push(item);ids.add(item.id);bag.sequence=Math.max(bag.sequence,Number(it.id.slice(5)));
 }
 bag.sequence=Math.max(bag.sequence,Number.isSafeInteger(raw.sequence)?Math.max(0,raw.sequence):0);
 bag.dryKills=Number.isInteger(raw.dryKills)?Math.max(0,Math.min(7,raw.dryKills)):0;
 for(const slot of Object.keys(SLOTS)){const item=bag.items.find(it=>it.id===raw.equipped?.[slot]&&it.slot===slot);if(item)bag.equipped[slot]=item.id;}
 return bag;
}
function bonuses(bag,weapon){
 const out={attack:0,maxHp:0,armor:0,speed:0};
 for(const slot of [weapon,'armor','boots','charm']){const item=bag.items.find(it=>it.id===bag.equipped[slot]);if(item)for(const key of Object.keys(out))out[key]+=item.stats[key]||0;}
 out.armor=Math.min(.25,out.armor);out.speed=Math.min(.4,out.speed);return out;
}
function drop(bag,enemy,chapter,random){
 if(enemy.lootRolled)return null;enemy.lootRolled=true;
 const guaranteed=!!enemy.boss||bag.dryKills>=7;
 if(!guaranteed&&random()>chance[enemy.kind]){bag.dryKills++;return null;}
 bag.dryKills=0;
 // Fifth-chapter commander guarantees the capstone weapon before the finale.
 if(enemy.boss&&!enemy.trueBoss&&chapter===5)return create('spear',3,5,'gear-'+(++bag.sequence));
 const slots=Object.keys(SLOTS),slot=slots[Math.min(slots.length-1,Math.floor(random()*slots.length))];
 const roll=random(),rarity=enemy.trueBoss||enemy.boss&&chapter>=4&&roll<.18?3:enemy.boss?2:roll<.08?2:roll<.38?1:0;
 return create(slot,rarity,chapter,'gear-'+(++bag.sequence));
}
function describe(item){return Object.entries(item.stats).map(([k,v])=>k==='maxHp'?'生命上限 +'+v:({attack:'普攻与技能',armor:'敌方伤害减免',speed:'移动速度'}[k])+' +'+Math.round(v*100)+'%').join(' · ')+(item.slot==='spear'&&item.rarity===3?' · 人马俱碎：对骑兵直击×1.5 / 削韧×1.5 / 末段震倒':'' );}
return {SLOTS,RARITIES,MODELS,equipped,isModao,create,empty,restore,bonuses,drop,describe};});
