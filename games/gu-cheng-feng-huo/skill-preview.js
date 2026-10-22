(function(){'use strict';
const $=id=>document.getElementById(id),ctx=$('trial').getContext('2d'),images={},C=BattleCore;
let world,last=0,playing=true,ready=false,accumulator=0,schedule=[],queued=null,feedback=new CinematicFX.Director(),auditionUntil=0;
const presenter=new MotionCore.Presenter();let director=new AnimationCore.Director(),alpha=1,lastUI=-1;
const soundscape=new BattleAudio.Soundscape(WAR_AUDIO_BANK);soundscape.setEnabled(false);soundscape.setAmbience(.16);
const descriptions={"bladeJ": "刀五段，每段以装备后的刀普攻结算，尾段击倒。", "spearJ": "马槊四段，每段以装备后的槊普攻结算，尾段击倒。", "bladeU": "回风三叠：三次近身宽幅斩击，每次0.9倍刀普攻，短步前进75。", "spearU": "破阵贯槊：4倍槊普攻，直线前冲320，带敌贯穿。", "bladeI": "断阵横斩：3.5倍刀普攻，前方宽幅斩击，击退并击倒；不挑空。", "spearI": "挑龙震地：挑空1倍槊普攻，再砸地2倍；两段命中各自计算装备和食人魔增益。", "bowU": "贯火矢：1倍弓普攻，穿透并附火，消耗1箭。每层持续5秒；单层按敌人当前血量2%～10%/秒，南霁云越残血越强，叠层合计上限10%。", "bowI": "漫天箭雨：1倍弓普攻，消耗1箭；前方大片区域僵直1.5秒。Boss须先破韧才能受控制。", "ogre": "食人魔：红墨缠身，8秒伤害×1.5，每秒消耗自身当前生命5%；近战按实际扣血的10%吸血，命中附火。本例用三叠斩和横斩展示吸血。"};
function tap(code){world.down(code);world.up(code);}
function reset(run=true){
 if(!ready)return;world=new C.World({spawn:false,ai:false,scene:0});world.player.x=240;world.player.y=535;schedule=[];accumulator=0;queued=null;feedback=new CinematicFX.Director();director=new AnimationCore.Director();alpha=1;lastUI=-1;soundscape.stop();
 const mode=$('demo').value,p=world.player;
 if(mode.startsWith('spear'))world.switchWeapon('spear');if(mode.startsWith('bow'))world.switchWeapon('bow');
 if(mode.endsWith('J')){world.spawn('cavalry',370,535);world.spawn('archer',880,580);}
 else if(mode.endsWith('U')&&!mode.startsWith('bow')){world.spawn('infantry',355,535);world.spawn('cavalry',630,535);world.spawn('archer',965,598);}
 else if(mode.endsWith('I')&&!mode.startsWith('bow')){world.spawn('infantry',355,535);world.spawn('archer',490,570);world.spawn('cavalry',615,535);}
 else if(mode==='ogre'){p.hp=60;world.spawn('cavalry',350,535);world.spawn('cavalry',430,570);schedule=[{at:0,key:'KeyO'},{at:.1,key:'KeyU'},{at:1.25,key:'KeyI'},{at:2.4,key:'KeyJ'}];}
 else {world.spawn('infantry',400,535);world.spawn('cavalry',670,535);world.spawn('archer',mode==='bowI'?795:910,mode==='bowI'?620:535);world.spawn('infantry',1050,465);}
 if(mode!=='ogre')schedule=[{at:0,key:mode.endsWith('I')?'KeyI':mode.endsWith('J')?'KeyJ':'KeyU'}];
 presenter.capture(world);$('description').textContent=descriptions[mode];playing=run;$('pause').textContent=playing?'暂停':'继续';
}
function previewPose(p){const pose=SkillVFX.pose(p)||AnimationCore.sample(p.action&&p.action.kind==='melee'?AnimationCore.attackClip(p.action,p.mounted):p.dead?'hero-death':p.action&&p.action.kind==='shoot'?'hero-shoot':p.weapon==='spear'?'spear-idle':p.weapon==='bow'?'hero-bowidle':'hero-idle',p.action?p.action.elapsed:world.time);return director.choose(p,{id:pose.clip.id,time:pose.time,token:p.action?(p.action.token||p.action):pose.clip.id});}
function step(silent=false){for(const item of schedule)if(!item.done&&world.time+1e-8>=item.at){tap(item.key);item.done=true;}
 const a=world.player.action;if($('demo').value.endsWith('J')&&a&&a.kind==='melee'&&a.combo<C.COMBOS[world.player.weapon].length&&a.elapsed>.08&&queued!==a){tap('KeyJ');queued=a;}
 presenter.capture(world);world.step(1/60);director.advance(1/60);feedback.advance(1/60);for(const e of world.events.splice(0)){feedback.event(e);if(!silent)soundscape.event(e,world);}feedback.capture(world.player,previewPose(world.player));if(!silent)soundscape.update(world);
}
function label(t,x,y,size=14,color='#e5d3ac'){ctx.fillStyle=color;ctx.font=size+'px Microsoft YaHei';ctx.textAlign='center';ctx.strokeStyle='#102027';ctx.lineWidth=3;ctx.strokeText(t,x,y);ctx.fillText(t,x,y);}
function draw(){if(!world)return;ctx.clearRect(0,0,1280,620);const p=presenter.entity(world.player,alpha),a=p.action;
 ctx.save();const camera=feedback.camera();ctx.translate(camera.x,camera.y);
 if(images.background){ctx.globalAlpha=.32;ctx.drawImage(images.background,0,-90,1280,720);ctx.globalAlpha=1;ctx.fillStyle='#14242a77';ctx.fillRect(0,0,1280,620);}
 feedback.drawBehind(ctx,images,ANIMATION_ATLAS,AnimationCore);
 ctx.strokeStyle='#667b6844';ctx.lineWidth=1;for(let y=465;y<=610;y+=35){ctx.beginPath();ctx.moveTo(50,y);ctx.lineTo(1230,y);ctx.stroke();}
 label(a?a.name:$('demo').selectedOptions[0].textContent,640,48,26);label('同一套战斗判定 · 可回看每一帧',640,78,12,'#91adae');
 for(const e of [...world.enemies.map(e=>presenter.entity(e,alpha)),p].sort((a,b)=>a.y-b.y)){
  ctx.fillStyle='#0a141b77';ctx.beginPath();ctx.ellipse(e.x,e.y+5,e.kind==='cavalry'||e.mounted?65:30,8,0,0,7);ctx.fill();
  if(e===p){
   SkillVFX.heroBack(ctx,p,world.time);const pose=previewPose(p);
   AnimationCore.draw(ctx,images,ANIMATION_ATLAS,pose,p.x,p.y-p.z,p.facing,1,p.ogreLeft>0?1.08:1);
   label('南霁云 · '+CombatBalance.round(p.hp)+' / 100',p.x,p.y+43,13);if(p.ogreLeft>0)label('食人魔 '+p.ogreLeft.toFixed(1)+'s',p.x,p.y-247,15,'#ffb278');
  }else{
   const pose=e.dead?AnimationCore.sample(e.kind+'-death',world.time-e.deathTime):e.controlled?AnimationCore.sample(e.kind+'-hurt',.14):e.knockdownLeft>0?AnimationCore.downPose(e):e.hardStun>0?AnimationCore.sample(e.kind+'-hurt',.14):AnimationCore.sample(e.kind+(e.kind==='cavalry'?'-ready':'-walk'),0);
   AnimationCore.draw(ctx,images,ANIMATION_ATLAS,director.choose(e,{id:pose.clip.id,time:pose.time}),e.x,e.y-e.z,-1);SkillVFX.enemyFire(ctx,e,world.time);
   const state=e.dead?'倒下':e.controlled==='lift'?'挑空':e.controlled==='rush'?'拖拽':e.knockdownLeft>0?'倒地':e.hardStun>0?'僵直 '+e.hardStun.toFixed(1)+'s':'站立';
   label(C.LABEL[e.kind]+' '+CombatBalance.round(e.hp)+' / '+e.maxHp,e.x,e.y-e.z-195,12);label(state,e.x,e.y-e.z-174,12,'#b3dce7');
   if(e.burns.length)label('灼烧 ×'+e.burns.length,e.x,e.y-e.z-215,14,'#ffb874');
  }
 }
 for(const a of world.projectiles.map(a=>presenter.entity(a,alpha))){SkillVFX.arrow(ctx,a,world.time);ctx.strokeStyle='#f8d5a3';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(a.x,a.y-a.z);ctx.lineTo(a.x-30*Math.sign(a.vx),a.y-a.z);ctx.stroke();}
 for(const f of world.effects){if(SkillVFX.effect(ctx,f)||CombatVFX.draw(ctx,f)||CombatVFX.drawSwing(ctx,f))continue;if(f.kind==='text'){ctx.save();ctx.globalAlpha=f.life/f.maxLife;label(f.text,f.x,f.y,18,f.color);ctx.restore();}}
 ctx.restore();
 if(playing&&lastUI>=0&&world.time-lastUI<1/20)return;lastUI=world.time;
 $('time').textContent=world.time.toFixed(2)+'s';$('seek').value=world.time;
 $('result').textContent='累计伤害 '+CombatBalance.round(world.stats.dealt)+' · '+(a?a.name:'当前动作结束');
 $('heroState').textContent='南霁云 '+CombatBalance.round(p.hp)+'/100 · 箭囊 '+p.ammo+'/15 · 食人魔 '+p.ogreLeft.toFixed(1)+'s';
 $('cd').textContent=['U','I','O'].map(k=>k+' 冷却 '+p.cooldowns[k].toFixed(1)+'s').join('　');
 $('targets').replaceChildren(...world.enemies.map(e=>{const line=document.createElement('p');line.textContent=C.LABEL[e.kind]+'：'+CombatBalance.round(e.hp)+'/'+e.maxHp+' · 灼烧 '+e.burns.length+'层 · '+(e.dead?'倒下':e.controlled==='lift'?'挑空':e.controlled==='rush'?'拖拽':e.knockdownLeft>0?'倒地':e.hardStun>0?'僵直 '+e.hardStun.toFixed(1)+'s':'站立');return line;}));
}
$('demo').onchange=()=>{auditionUntil=0;$('audioReview').pause();reset();};$('replay').onclick=()=>{auditionUntil=0;$('audioReview').pause();reset();};$('pause').onclick=()=>{playing=!playing;auditionUntil=0;$('audioReview').pause();if(!playing)soundscape.setActive(false);$('pause').textContent=playing?'暂停':'继续';};
$('step').onclick=()=>{playing=false;$('pause').textContent='继续';if(world&&world.time<9)step();alpha=1;director.renderOffset=0;draw();};
$('seek').oninput=()=>{const t=Number($('seek').value);auditionUntil=0;soundscape.setActive(false);reset(false);for(let n=0;n<Math.round(t*60);n++)step(true);alpha=1;director.renderOffset=0;draw();};
$('audioToggle').onchange=async()=>{soundscape.setEnabled($('audioToggle').checked);if($('audioToggle').checked)await soundscape.unlock();$('audioStatus').textContent=soundscape.status();};
$('demoVolume').oninput=()=>soundscape.setVolume(Number($('demoVolume').value)/100);
for(const b of document.querySelectorAll('[data-sound]'))b.onclick=async()=>{playing=false;$('pause').textContent='继续';$('audioReview').pause();$('audioToggle').checked=true;soundscape.setEnabled(true);await soundscape.unlock();auditionUntil=performance.now()+2600;soundscape.setActive(true);soundscape.play(b.dataset.sound,{gain:.8,rate:1});$('audioStatus').textContent='试听：'+b.textContent+' · '+soundscape.status();};
$('audioReview').onplay=()=>{playing=false;$('pause').textContent='继续';auditionUntil=0;soundscape.setActive(false);};
window.addEventListener('blur',()=>{playing=false;$('pause').textContent='继续';auditionUntil=0;soundscape.setActive(false);$('audioReview').pause();});
document.addEventListener('visibilitychange',()=>{if(document.hidden){playing=false;auditionUntil=0;soundscape.setActive(false);$('audioReview').pause();$('pause').textContent='继续';}});
const background=new Image();background.onload=()=>{images.background=background;};background.src=WebAssets.url('assets/scene-0.png');
Promise.all(Object.entries(ANIMATION_ATLAS).map(([id,s])=>new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>{images[id]=im;resolve();};im.onerror=reject;im.src=WebAssets.url('assets/'+s.file);}))).then(()=>{ready=true;$('replay').disabled=false;$('replay').textContent='重新演武';reset();}).catch(()=>{$('result').textContent='原画载入失败';});
function loop(now){const dt=last?Math.min(.08,(now-last)/1000):0;last=now;soundscape.setActive((playing||now<auditionUntil)&&!document.hidden);if(world&&playing&&world.time<9){accumulator+=dt*Number($('speed').value);while(accumulator>=1/60&&world.time<9){step();accumulator-=1/60;}if(world.time>=9){playing=false;$('pause').textContent='继续';}}alpha=playing?Math.min(1,accumulator*60):1;director.renderOffset=playing?(alpha-1)/60:0;draw();requestAnimationFrame(loop);}requestAnimationFrame(loop);
})();
