(function(root){'use strict';
const $=id=>document.getElementById(id),Gear=root.EquipmentCore;
function node(tag,text,cls){const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;}
let art=null,previewWeapon='spear';
function setAssets(images,atlas){art={images,atlas};}
function itemIcon(item,size=64){const e=node('canvas',undefined,'gear-icon');e.width=e.height=size*2;e.style.width=e.style.height=size+'px';e.setAttribute('role','img');e.setAttribute('aria-label',item.name+'外观');const c=e.getContext('2d');c.scale(2,2);root.EquipmentVisuals.icon(c,item,size/2,size/2,size*.9);return e;}
function preview(world){
 let area=$('gearPreview');if(!area){area=node('div',undefined,'gear-preview');area.id='gearPreview';$('gearSummary').after(area);}area.replaceChildren();
 const c=node('canvas');c.width=900;c.height=480;c.setAttribute('role','img');c.setAttribute('aria-label','南霁云当前穿戴装备预览');area.append(c);
 const detail=node('div');detail.append(node('b','当前穿戴外观'),node('p','武器、甲胄、护靴和腰佩随装备变化。'));
 for(const [k,label] of [['melee','刀'],['spear','长柄'],['bow','弓']]){const b=node('button',label);b.classList.toggle('selected',previewWeapon===k);b.onclick=()=>{previewWeapon=k;preview(world);};detail.append(b);}area.append(detail);
 if(art){const ctx=c.getContext('2d');ctx.scale(2,2);ctx.fillStyle='#12252a';ctx.fillRect(0,0,450,240);const pose=root.AnimationCore.sample(previewWeapon==='spear'?'spear-idle':previewWeapon==='bow'?'hero-bowidle':'hero-idle',0);root.AnimationCore.draw(ctx,root.EquipmentVisuals.images(art.images,art.atlas,world.gear,previewWeapon),root.EquipmentVisuals.atlas(),pose,210,218,1,1,1);}
}
function render(world){
 preview(world);
 const p=world.player,b=world.gearBonuses();
 $('gearSummary').textContent='生命 '+CombatBalance.round(p.hp)+' / '+p.maxHp+'　刀 '+CombatBalance.round(world.basicDamage('melee'))+'　槊 '+CombatBalance.round(world.basicDamage('spear'))+'　箭 '+CombatBalance.round(world.basicDamage('bow'))+'　减伤 '+Math.round(b.armor*100)+'%　移速 +'+Math.round(b.speed*100)+'%';
 $('gearCount').textContent=world.gear.items.length+' 件 · '+(root.MobileGame?'点“拾装”收取战利品':'F 拾取战利品');
 $('gearSlots').replaceChildren();
 for(const [slot,title] of Object.entries(Gear.SLOTS)){
  const item=world.gear.items.find(it=>it.id===world.gear.equipped[slot]),box=node('div',undefined,'gear-equipped');
  if(item)box.append(itemIcon(item,48));
  box.append(node('small',title),node('b',item?.name||'未装备'),node('p',item?Gear.describe(item):'基础装备仍可战斗'));
  if(item){box.style.setProperty('--rarity',Gear.RARITIES[item.rarity].color);const btn=node('button','卸下');btn.onclick=()=>{world.unequipItem(slot);render(world);};box.append(btn);}
  $('gearSlots').append(box);
 }
 const bag=$('gearItems');bag.replaceChildren();
 if(!world.gear.items.length){bag.append(node('p','击败敌军后可能掉落装备。走近光柱按 F 收入背包；每 8 次未获掉落的击杀保底一件，Boss 必掉珍品及以上，第五章必掉陌刀。','gear-empty'));return;}
 for(const item of [...world.gear.items].sort((a,b)=>b.rarity-a.rarity||b.chapter-a.chapter)){
  const equipped=world.gear.equipped[item.slot]===item.id,row=node('div',undefined,'gear-item');row.style.setProperty('--rarity',Gear.RARITIES[item.rarity].color);
  const detail=node('div');detail.append(node('b',item.name),node('small',Gear.SLOTS[item.slot]+' · 第'+item.chapter+'章战利品'),node('p',Gear.describe(item)));
  const old=world.gear.items.find(it=>it.id===world.gear.equipped[item.slot]);if(old&&!equipped)detail.append(node('small','当前：'+Gear.describe(old),'gear-compare'));
  const btn=node('button',equipped?'已装备':'装备');btn.disabled=equipped;
  btn.onclick=()=>{if(!world.equipItem(item.id))$('gearTip').textContent='当前动作未结束。请关闭背包，收招落地后再更换。';else $('gearTip').textContent='已装备 '+item.name+'。同槽替换，原装备仍保留在背包。';render(world);};
  row.append(itemIcon(item,56),detail,btn);bag.append(row);
 }
}
function drawLoot(ctx,world,camera){
 for(const d of world.loot){if(!camera.visible(d.x,100))continue;
  const color=Gear.RARITIES[d.item.rarity].color,near=BattleCore.distance(d,world.player)<=120,phase=world.time*3;
  ctx.save();ctx.translate(d.x,d.y);ctx.globalAlpha=.8;
  const g=ctx.createLinearGradient(0,-90,0,8);g.addColorStop(0,color+'00');g.addColorStop(1,color+'99');ctx.fillStyle=g;ctx.fillRect(-11,-90,22,98);
  ctx.strokeStyle=color;ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(0,5,21+Math.sin(phase)*3,7,0,0,Math.PI*2);ctx.stroke();
  ctx.translate(0,-15-Math.sin(phase)*3);ctx.fillStyle='#14272c';ctx.strokeStyle=color;ctx.beginPath();ctx.moveTo(0,-13);ctx.lineTo(15,0);ctx.lineTo(0,13);ctx.lineTo(-15,0);ctx.closePath();ctx.fill();ctx.stroke();
  root.EquipmentVisuals.icon(ctx,d.item,0,0,32);ctx.fillStyle=color;ctx.textAlign='center';
  if(near){ctx.font='bold 13px Microsoft YaHei';ctx.lineWidth=4;ctx.strokeStyle='#102126';ctx.strokeText('F 拾取 '+d.item.name,0,-105);ctx.fillText('F 拾取 '+d.item.name,0,-105);}ctx.restore();
 }
}
root.EquipmentUI={render,drawLoot,setAssets,itemIcon};})(globalThis);
