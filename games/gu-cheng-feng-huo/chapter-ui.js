(function(root){'use strict';const $=id=>document.getElementById(id);
function label(ctx,value,x,y,size=18,color='#ecd5a6'){ctx.font='600 '+size+'px Microsoft YaHei';ctx.textAlign='center';ctx.lineWidth=4;ctx.strokeStyle='#101d20';ctx.strokeText(value,x,y);ctx.fillStyle=color;ctx.fillText(value,x,y);}
function background(ctx,images,x,world){
 if(world.chapter>=4){ScrollScene.background(ctx,images['scene'+world.scene],x,world.scene);return;}
 if(world.chapter===2){ScrollScene.background(ctx,images.linhuai,x,1);return;}
 if(world.chapter===3){ScrollScene.background(ctx,images.zhenyuan,x,2);if(x>5450){ctx.save();ctx.globalAlpha=Math.min(1,(x-5450)/750);ScrollScene.background(ctx,images.scene2,x,2);ctx.restore();}return;}
 // Move from the burning gate through encampments, then to open ground.
 const phase=x<1800?0:x<5400?3:2,blend=180;
 const before=x<1800?0:x<5400?0:3,edge=x<1800?0:x<5400?1800:5400;
 ScrollScene.background(ctx,images['scene'+phase],x,phase);
 if(phase!==before&&x-edge<blend){ctx.save();ctx.globalAlpha=1-(x-edge)/blend;ScrollScene.background(ctx,images['scene'+before],x,before);ctx.restore();}
 // Flags and smoke in the distance suggest a surrounding force, not countable fighters.
 ctx.save();ctx.fillStyle='#19232755';for(let i=0;i<15;i++){const px=i*123-((x*.7)%123);ctx.fillRect(px,275+(i%3)*12,2,103);ctx.beginPath();ctx.moveTo(px,275+(i%3)*12);ctx.lineTo(px+27,286+(i%3)*12);ctx.lineTo(px,301+(i%3)*12);ctx.fill();}ctx.restore();
}
function scenery(ctx,world,camera){
 const plan=world.plan;
 for(let i=0;i<plan.formations.length;i++){const z=plan.formations[i];if(!camera.visible(z.trigger,170))continue;ctx.save();ctx.strokeStyle='#443b2b';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(z.trigger,451);ctx.lineTo(z.trigger,308);ctx.stroke();ctx.fillStyle=i<=world.waveCleared?'#274e5b':'#722f25';ctx.fillRect(z.trigger,310,74,99);label(ctx,String(i+1),z.trigger+36,365,26);label(ctx,z.name,z.trigger+36,295,16);ctx.restore();}
 if((world.activeEnemies.length||world.wavePending.length)&&camera.visible(world.gateX,80)){ctx.save();ctx.strokeStyle='#cf8f5680';ctx.setLineDash([12,15]);ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(world.gateX,462);ctx.lineTo(world.gateX,650);ctx.stroke();ctx.setLineDash([]);label(ctx,'击破本段封锁',world.gateX,434,16);ctx.restore();}
 if(camera.visible(world.exitX,160)){label(ctx,plan.destination+' →',world.exitX-40,358,28);label(ctx,world.boss.dead?'前路已开，速行！':'击破最后封锁',world.exitX-40,394,16);}
}
function update(world){
 const count=world.escortSurvivors.length,totalHp=world.escortSurvivors.reduce((sum,a)=>sum+a.hp,0);
 $('armyHud').hidden=!world.campaignFlags.reinforcements||world.status!=='playing'||world.paused||StoryFlow.blocking();$('armyHud').textContent='援军行列约 '+world.armyStrength+' 人 · 身边援兵 '+world.supportSurvivors.length+' / 12';
 $('woundHud').hidden=!world.wound||world.wound.elapsed>=180||world.status!=='playing'||world.paused||StoryFlow.blocking();if(world.wound){const w=world.wound;$('woundHud').textContent='断指伤势 · 剩余 '+Math.ceil(180-w.elapsed)+' 秒 / 下次 −2：'+Math.max(0,Math.ceil((w.ticks+1)*10-w.elapsed))+' 秒';}
 $('partyHud').hidden=world.status!=='playing'||world.paused||StoryFlow.blocking();$('partyTitle').textContent=ChapterData.difficulty(world.difficulty).name+' · 随行精骑';$('partyCount').textContent='在阵 '+world.combatAllies.filter(a=>a.kind==='cavalry').length+' / 2 · 候补 '+world.reserveRiders.length+' · 随行幸存 '+count+' / '+world.escortCapacity;$('partyHealth').style.setProperty('--party',100*totalHp/(world.escortCapacity*100)+'%');
 const boss=world.trueBoss?.deployed?world.trueBoss:world.boss;$('bossName').textContent=boss.name;$('bossHud').classList.toggle('true-boss',!!boss.trueBoss);$('bossMove').textContent=boss.trueBoss?(boss.state==='yinEntrance'?'敌军主将亲临 · 降至10%接入终章':boss.state==='yinWindup'?boss.move.name+' · 起手 '+Math.max(0,boss.timer).toFixed(1)+'秒':boss.state==='yinActive'?boss.move.name+' · 避开预警范围':boss.state==='recover'?'收势 '+Math.max(0,boss.timer).toFixed(1)+'秒 · 趁隙反击':'五式轮转 · 注意地面预警'):'冲锋150 · 生命1000 · 箭矢命中×2';$('bossHud').hidden=!boss.deployed||boss.dead||world.paused||StoryFlow.blocking();$('bossValue').textContent=Math.ceil(boss.hp)+' / '+boss.maxHp;$('bossFill').style.width=100*boss.hp/boss.maxHp+'%';
 const broken=boss.toughness===0;$('bossHud').classList.toggle('broken',broken);$('toughnessFill').style.width=100*boss.toughness/boss.toughnessMax+'%';
 $('toughnessText').textContent=broken?'破韧 '+Math.max(0,boss.brokenUntil-world.time).toFixed(1)+'秒 · 可控制 / 无减伤':'韧性 '+Math.ceil(boss.toughness)+' / '+boss.toughnessMax+' · 免控 / 减伤10%';
}
root.ChapterUI={background,scenery,update};
})(globalThis);
