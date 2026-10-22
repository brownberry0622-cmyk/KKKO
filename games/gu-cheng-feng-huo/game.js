(function(){
"use strict";
const {World,CFG,COMBOS,SCENES,LABEL,clamp,distance}=BattleCore;
const $=id=>document.getElementById(id);
const canvas=$("battle"),ctx=canvas.getContext("2d");
const images={},allyImages={},bossImages={};let world=new World({ai:false,scrolling:true}),started=false,menuOpen=true,ready=false;
const scrollCamera=new ScrollCamera.Camera(world.width);
let director=new AnimationCore.Director(),feedback=new CinematicFX.Director();
const timeline=new MotionCore.FixedClock(),presenter=new MotionCore.Presenter();let renderAlpha=1,renderHero=null;
const soundscape=new BattleAudio.Soundscape(WAR_AUDIO_BANK);let pageFocused=true,avWasPaused=false;
const renderStats={seconds:0,frames:0,ms:0,fps:0,cost:0};
let chapterCheckpoint=null,currentChapter=1,currentDifficulty="easy";
let currentOptions={mode:"mixed",ai:true,scrolling:true},lastTime=0,accumulator=0,sound=true,helpWasPaused=false;
const CONTROL=new Set(["KeyW","KeyS","KeyA","KeyD","KeyJ","KeyK","KeyQ","KeyE","KeyL","KeyH","KeyN","KeyF","KeyB","KeyU","KeyI","KeyO","Space","Digit1","Digit2","Numpad1","Numpad2"]);
const SOURCES={linhuai:'road-linhuai-final.png',zhenyuan:'road-zhenyuan.png',ally:'ally-cavalry-anim.png',boss:'boss-cavalry-anim.png',hero:"hero-atlas.png",mounted:"hero-mounted.png",infantry:"infantry.png",archer:"archer.png",cavalry:"cavalry.png"};
for(const [id,sheet] of Object.entries(ANIMATION_ATLAS))SOURCES[id]=sheet.file;
for(let i=0;i<6;i++)SOURCES["scene"+i]="scene-"+i+".png";
let loaded=0;
Promise.all(Object.entries(SOURCES).map(([name,file])=>new Promise((resolve,reject)=>{
 const im=new Image();im.onload=()=>{images[name]=im;loaded++;$("loadingText").textContent="原画已准备 "+loaded+" / "+Object.keys(SOURCES).length;resolve();};
 im.onerror=()=>reject(new Error(file));im.src=WebAssets.url('assets/'+file);
}))).then(()=>{
 Object.assign(allyImages,images,{'cavalry-anim':images.ally});Object.assign(bossImages,images,{'cavalry-anim':images.boss});
 EquipmentUI.setAssets(images,ANIMATION_ATLAS);ready=true;StoryFlow.assetsReady();$("startBtn").disabled=false;$("startBtn").textContent="进入所选章节";
 $("loadingText").textContent="键盘操作 · 点击开始后进入战斗";$("statusLine").textContent="网页原画已就绪 · PV 按需加载";
}).catch(e=>{$("loadingText").textContent="素材载入失败："+e.message+"。请保留 assets 文件夹，并完整解压后打开。";$("statusLine").textContent="素材缺失";});
function initAudio(){soundscape.setEnabled(sound);if(sound)soundscape.unlock().then(()=>setText('audioState',soundscape.status()));}
function saveAV(){try{localStorage.setItem('nanji-av',JSON.stringify({volume:soundscape.volume,ambience:soundscape.ambienceVolume,reduced:feedback.reduced}));}catch(_){}}
let avSaved={};try{avSaved=JSON.parse(localStorage.getItem('nanji-av')||'{}')||{};}catch(_){}
soundscape.setVolume(Number.isFinite(avSaved.volume)?avSaved.volume:.65);soundscape.setAmbience(Number.isFinite(avSaved.ambience)?avSaved.ambience:.27);
feedback.reduced=typeof avSaved.reduced==='boolean'?avSaved.reduced:window.matchMedia('(prefers-reduced-motion: reduce)').matches;
$('volume').value=Math.round(soundscape.volume*100);$('ambienceVolume').value=Math.round(soundscape.ambienceVolume*100);$('gentle').checked=feedback.reduced;
function updateAV(){setText('volumeValue',Math.round(soundscape.volume*100)+'%');setText('ambienceValue',Math.round(soundscape.ambienceVolume*100)+'%');setText('audioState',soundscape.status());setText('flowState',renderStats.fps?'最近画面：'+Math.round(renderStats.fps)+' 帧/秒 · 每帧处理约 '+renderStats.cost.toFixed(1)+' 毫秒':'开始试玩后显示当前设备的画面流畅度');}
$('volume').oninput=()=>{soundscape.setVolume(Number($('volume').value)/100);saveAV();updateAV();};
$('ambienceVolume').oninput=()=>{soundscape.setAmbience(Number($('ambienceVolume').value)/100);saveAV();updateAV();};
$('gentle').onchange=()=>{feedback.reduced=$('gentle').checked;feedback.stop=0;feedback.shake=0;feedback.trails=[];saveAV();};
$('avBtn').onclick=()=>{if(!$('gearLayer').hidden)return;avWasPaused=world.paused;if(started&&!menuOpen){world.paused=true;world.clearInput();}soundscape.setActive(false);$('avLayer').hidden=false;updateAV();};
$('closeAV').onclick=()=>{$('avLayer').hidden=true;if(started&&!menuOpen){world.paused=avWasPaused;if(!world.paused)canvas.focus();}};
updateAV();
let gearWasPaused=false;
function closeGear(){
 $('gearLayer').hidden=true;world.paused=gearWasPaused;world.clearInput();timeline.reset();presenter.capture(world);if(!world.paused)canvas.focus();
}
function openGear(){
 if(!started||menuOpen||StoryFlow.blocking()||world.status!=='playing'||!$('helpLayer').hidden||!$('avLayer').hidden)return;
 if(!$('gearLayer').hidden){closeGear();return;}
 gearWasPaused=world.paused;world.paused=true;world.clearInput();soundscape.setActive(false);timeline.reset();
 $('gearTip').textContent='更换装备保留生命百分比；战斗与计时已暂停。';EquipmentUI.render(world);$('gearLayer').hidden=false;$('closeGear').focus();
}
$('gearBtn').onclick=openGear;$('closeGear').onclick=closeGear;
function newBattle(fromSettings=false,chapter=null,carry=null,difficulty=null){
 if(!ready)return;
 if(fromSettings)currentOptions={mode:$("mode").value,ai:$("ai").checked,scrolling:$("layout").value==="scroll"};
 const lastScene=world.scene;let scene=Math.floor(Math.random()*6);if(started&&scene===lastScene)scene=(scene+1+Math.floor(Math.random()*5))%6;
 if(chapter!==null){currentChapter=chapter;chapterCheckpoint=CampaignState.clone(carry);currentDifficulty=ChapterData.difficulty(difficulty).id;}
 world=new ChapterCore.ChapterWorld({ai:true,chapter:currentChapter,difficulty:currentDifficulty,carry:CampaignState.clone(chapterCheckpoint)});currentOptions={ai:true,scrolling:true};started=true;menuOpen=false;accumulator=0;timeline.reset();presenter.capture(world);scrollCamera.reset(world.width);
 const reduced=feedback.reduced;director=new AnimationCore.Director();feedback=new CinematicFX.Director();feedback.reduced=reduced;soundscape.stop();
 $("pauseBtn").textContent="暂停 P";
 ["menu","pauseLayer","lossLayer","helpLayer","avLayer","gearLayer","winBanner"].forEach(id=>$(id).hidden=true);
 $("hud").hidden=false;initAudio();canvas.focus();buildRoute();updateHUD();$("storyEnd").hidden=true;StoryFlow.inBattle();
}
StoryFlow.attach((id,carry,difficulty)=>newBattle(false,id,carry,difficulty));
function pause(value,reason){
 if(!started||menuOpen||world.status!=="playing")return;
 world.paused=value;world.clearInput();accumulator=0;timeline.reset();presenter.capture(world);if(value)soundscape.setActive(false);
 $("pauseLayer").hidden=!value;$("pauseTitle").textContent=reason||"已暂停";$("pauseBtn").textContent=value?"继续 P":"暂停 P";
 if(!value){$("helpLayer").hidden=true;canvas.focus();initAudio();}
}
function backMenu(){
 world.paused=true;world.clearInput();menuOpen=true;soundscape.setActive(false);
 ["pauseLayer","lossLayer","helpLayer","avLayer","gearLayer","winBanner"].forEach(id=>$(id).hidden=true);
 $("hud").hidden=true;$("notice").hidden=true;$("menu").hidden=false;$("startBtn").focus();StoryFlow.menu();
}
$("startBtn").onclick=()=>StoryFlow.select();
["restartBtn","winRestart","lossRestart"].forEach(id=>$(id).onclick=()=>newBattle(false));
$("pauseBtn").onclick=()=>pause(!world.paused);$("resumeBtn").onclick=()=>pause(false);
$("backMenuBtn").onclick=backMenu;$("lossMenu").onclick=backMenu;
$("helpBtn").onclick=()=>{if(!$("gearLayer").hidden)return;
 helpWasPaused=world.paused;if(started&&!menuOpen){world.paused=true;world.clearInput();}
 $("helpLayer").hidden=false;
};
$("closeHelp").onclick=()=>{
 $("helpLayer").hidden=true;
 if(started&&!menuOpen){world.paused=helpWasPaused;if(!world.paused)canvas.focus();}
};
$("soundBtn").onclick=()=>{sound=!sound;$("soundBtn").textContent="音效 "+(sound?"开":"关");$("soundBtn").setAttribute("aria-pressed",String(sound));soundscape.setEnabled(sound);if(sound)initAudio();};
$("fullBtn").onclick=()=>{
 const promise=document.fullscreenElement?document.exitFullscreen():$("stage").requestFullscreen();
 if(promise&&promise.catch)promise.catch(()=>world.message("当前浏览器不支持全屏，可放大窗口试玩"));
};
canvas.addEventListener("pointerdown",()=>{if(started&&!world.paused){canvas.focus();initAudio();}});
window.addEventListener("keydown",e=>{
 if(!$('gearLayer').hidden){
  if(['Escape','Tab'].includes(e.code)&&!e.repeat){e.preventDefault();closeGear();}else if(CONTROL.has(e.code)||['KeyP','KeyR'].includes(e.code))e.preventDefault();return;
 }
 if(e.code==='Tab'&&!e.repeat&&started&&!menuOpen&&!StoryFlow.blocking()){e.preventDefault();openGear();return;}
 if(e.code==="Escape"&&!$("avLayer").hidden){e.preventDefault();$("closeAV").click();return;}
 if(e.code==="Escape"&&!$("helpLayer").hidden){e.preventDefault();$("closeHelp").click();return;}
 if(StoryFlow.blocking()||!started||menuOpen||!$("helpLayer").hidden||!$("avLayer").hidden)return;
 if(["KeyP","Escape"].includes(e.code)&&!e.repeat){e.preventDefault();pause(!world.paused);return;}
 if(e.code==="KeyR"&&!e.repeat){e.preventDefault();newBattle(false);return;}
 if(CONTROL.has(e.code)){
  e.preventDefault();if(!world.paused&&world.status!=="lost"&&!e.repeat){if(sound&&soundscape.ctx?.state!=='running')initAudio();world.down(e.code);}
 }
},{passive:false});
window.addEventListener("keyup",e=>{if(CONTROL.has(e.code)){
 if(e.code==='KeyK'&&world.player.guard&&!world.player.action)director.event('hero',world.player.weapon==='spear'?(world.player.mounted?'spear-mounted-unguard':'spear-unguard'):(world.player.mounted?'mounted-unguard':'hero-unguard'));
 world.up(e.code);if(started&&!menuOpen)e.preventDefault();
}});
window.addEventListener("focus",()=>{pageFocused=true;});
window.addEventListener("blur",()=>{pageFocused=false;soundscape.setActive(false);if(started&&!menuOpen&&!world.paused&&world.status!=="lost")pause(true,"窗口失焦 · 已暂停");});
document.addEventListener("visibilitychange",()=>{if(document.hidden&&started&&!menuOpen&&!world.paused)pause(true,"切到后台 · 已暂停");});
function setText(id,text){if($(id).textContent!==String(text))$(id).textContent=String(text);}
function buildRoute(){
 $('routeEnemies').replaceChildren(...world.enemies.filter(e=>e.boss||e.deployed!==false).map(e=>{const dot=document.createElement('i');dot.dataset.enemy=e.id;dot.title=LABEL[e.kind];return dot;}));
}
function updateRoute(){
 $('routeHud').hidden=!world.scrolling;
 if(!world.scrolling)return;
 const p=world.player,alive=world.enemies.filter(e=>!e.dead),percent=Math.round(clamp((p.x-(world.startX||260))/(world.exitX-(world.startX||260)),0,1)*100);
 setText('routeText','行程 '+percent+'% · '+(world.chapter?(world.wave<0?'出发集结':world.activeEnemies.length?world.plan.formations[world.wave].name:'继续向右突围'):(alive.length?'清敌后抵达右侧出口':'敌兵已清，向右前进')));
 $('routeHero').style.left=100*p.x/world.width+'%';$('routeFill').style.width=100*p.x/world.width+'%';
 $('routeView').style.left=100*scrollCamera.x/world.width+'%';$('routeView').style.width=100*1280/world.width+'%';
 for(const dot of $('routeEnemies').children){const e=world.enemies.find(e=>e.id===dot.dataset.enemy);dot.style.left=100*e.x/world.width+'%';dot.classList.toggle('defeated',e.dead);}
}
function updateHUD(){updateRoute();BattleUpgrades.hud(world,started&&!menuOpen&&!StoryFlow.blocking()&&!world.paused&&world.status==='playing');
 if(world.chapter){ChapterUI.update(world);if(world.status==='won')StoryFlow.complete(world);}
 const p=world.player;
 setText("hpText",CombatBalance.round(p.hp)+" / "+p.maxHp);$("hpFill").style.width=(100*p.hp/p.maxHp)+"%";
 setText("ammoText",p.ammo);setText("weaponText",p.weapon==="bow"?"弓箭 · E 返回"+(p.lastMelee==="spear"?"马槊":"刀"):p.weapon==="spear"?(EquipmentCore.isModao(world.gear)?"陌刀 · E 切刀":"马槊 · E 切刀"):"刀 · E 切马槊");
 $("skillBar").hidden=!started||menuOpen||StoryFlow.blocking();
 const bow=p.weapon==='bow',spear=p.weapon==='spear',names={U:bow?'贯火矢':spear?'破阵贯槊':'回风三叠',I:bow?'漫天箭雨':spear?'挑龙震地':'断阵横斩',O:'食人魔'};
 const details={U:bow?'普攻×1 · 穿透 / 叠火':spear?'普攻×4 · 直线带敌前冲':'3段×0.9 · 近身连续斩',I:bow?'普攻×1 · 僵直1.5秒':spear?'挑×1 + 砸×2 · 范围击倒':'普攻×3.5 · 宽幅击退',O:'8秒×1.5 · 近战吸血10%'};
 for(const key of ['U','I','O']){
  setText('skillName'+key,names[key]);setText('skillDetail'+key,details[key]);
  const cd=p.cooldowns[key];setText('skillCd'+key,cd>0?cd.toFixed(1)+'s':bow&&key!=='O'&&p.ammo===0?'缺箭':'就绪');
  $('skill'+key).classList.toggle('cooling',cd>0);$('skill'+key).style.setProperty('--cooldown',100*cd/(key==='O'?15:8)+'%');
 }
 setText('ogreState',p.ogreLeft>0?'食人魔 '+p.ogreLeft.toFixed(1)+'s · 每秒−当前生命5% · 灼烧单层 '+Math.round(CombatBalance.burnRate(p.hp,p.maxHp)*100)+'%':'');
 $('ogreState').hidden=p.ogreLeft<=0;
 const chain=COMBOS[p.weapon];
 setText("attackText",p.action&&p.action.name?p.action.name+' · '+CombatBalance.round(p.action.damage*(p.action.power||1))+'伤害':chain&&p.comboNext>1&&world.time<=p.comboUntil?'再按 J → '+chain[p.comboNext-1].name:chain?chain.map(a=>a.name).join(' → '):'J 射箭 · 每箭'+CombatBalance.round(world.basicDamage('bow')));
 setText("embeddedText",'身上箭 '+p.embedded.length+(p.embedded.length?' · B 拔1支 / −5生命':''));
 setText("horseText",p.dashLeft>0?"冲刺":p.running?(p.mounted?"疾驰":"奔跑"):(p.mounted?"骑乘慢行":"步行"));
 setText("sceneText",world.chapter?world.plan.title:SCENES[world.scene]);setText("sceneMode",world.chapter?world.plan.subtitle+" · "+ChapterData.difficulty(world.difficulty).name:world.scrolling?"横向关卡 · 四屏行程":"单屏演武");
 setText("enemyText",world.chapter?"阻击 "+Math.max(0,world.wave+1)+" / "+world.plan.formations.length+" · 当面敌军 "+world.activeEnemies.length+(world.wavePending?.length>world.activeEnemies.length?' · 候阵 '+(world.wavePending.length-world.activeEnemies.length):''):"敌兵 "+world.enemies.filter(e=>!e.dead).length+" / "+world.total);
 setText("statusLine",started?((world.paused?"已暂停":world.status==="lost"?"本轮战败":world.status==="won"?"本轮全清":"战斗中")+" · "+(currentOptions.ai?"敌人主动进攻":"静止目标")+" · 伤害 "+CombatBalance.round(world.stats.dealt)):ready?"网页原画已就绪 · PV 按需加载":"载入原画中");
 $("notice").hidden=menuOpen||StoryFlow.blocking()||!world.notice||world.time>world.notice.until;
 if(!$("notice").hidden)setText("notice",world.notice.text);
 $("winBanner").hidden=world.chapter||world.status!=="won"||menuOpen||world.paused;
 if(world.status==="won")setText("winStats","用时 "+Math.floor(world.endedAt??world.time)+"s · 承伤 "+world.stats.taken+" · 回收 "+world.stats.recovered+" 箭");
 if(world.status==="lost"&&!menuOpen&&!StoryFlow.blocking()&&director.elapsed('hero')>=.68){
  $("lossLayer").hidden=false;setText("lossStats","击败 "+world.stats.kills+" / "+world.total+" 名敌兵 · 累计造成 "+CombatBalance.round(world.stats.dealt)+" 伤害");
 }
}
function text(txt,x,y,size=14,color="#fff",align="center"){
 ctx.font='600 '+size+'px "Microsoft YaHei",sans-serif';ctx.textAlign=align;
 ctx.lineWidth=3;ctx.strokeStyle="#142023dd";ctx.strokeText(txt,x,y);ctx.fillStyle=color;ctx.fillText(txt,x,y);
}
function ellipse(x,y,rx,ry,color){ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.fillStyle=color;ctx.fill();}
function sprite(im,source,x,y,w,h,facing=1,rotation=0,alpha=1){
 if(!im)return;
 ctx.save();ctx.translate(x,y);ctx.rotate(rotation);ctx.scale(facing===1?-1:1,1);ctx.globalAlpha=alpha;
 if(source)ctx.drawImage(im,...source,-w/2,-h,w,h);else ctx.drawImage(im,-w/2,-h,w,h);
 ctx.restore();
}
function heroPose(p){
 const skillPose=SkillVFX.pose(p);if(skillPose)return director.choose(p,{id:skillPose.clip.id,time:skillPose.time,token:p.action.token||p.action});
 if(p.weapon==='spear')return spearPose(p);
 if(p.dead)return director.choose(p,{id:'hero-death'});
 const kind=p.action&&p.action.kind,bow=p.weapon==='bow';
 if(kind){
  let id=kind==='shoot'?(p.mounted?'mounted-shoot':p.z>5?'hero-airbow':'hero-shoot'):
   kind==='jump'?(p.mounted?'mounted-melee':'hero-airslash'):
   kind==='pickup'?'hero-pickup':(p.mounted?'mounted-':'hero-')+kind;
  if(kind==='melee')id=AnimationCore.attackClip(p.action,p.mounted);
  return director.choose(p,{id,time:p.action.elapsed,token:p.action.token||p.action});
 }
 if(p.stun>0)return director.choose(p,{id:p.mounted?'mounted-hurt':'hero-hurt',time:.2-p.stun});
 if(p.guard)return director.choose(p,{id:p.mounted?'mounted-guard':'hero-guard'});
 if(p.dashLeft>0)return director.choose(p,{id:p.mounted?'mounted-run':bow?'bow-dash':'hero-dash',time:.2-p.dashLeft});
 if(p.z>0)return director.choose(p,{id:p.mounted?'mounted-run':bow?'bow-jump':'hero-jump',time:clamp((520-p.vz)/1500,0,.7)});
 const transition=director.transition(p.id);
 if(transition)return director.choose(p,transition);
 if(p.mounted)return director.choose(p,p.weapon==='bow'?{id:'mounted-shoot',time:.06,still:true}:p.moving?{id:p.running?'mounted-run':'mounted-walk'}:{id:'mounted-melee',time:.32,still:true});
 return director.choose(p,{id:p.moving?(bow?(p.running?'bow-run':'bow-walk'):(p.running?'hero-run':'hero-walk')):(bow?'hero-bowidle':'hero-idle')});
}
function spearPose(p){
 if(p.dead)return director.choose(p,{id:'spear-death'});
 const prefix=p.mounted?'spear-mounted-':'spear-';
 if(p.action){const kind=p.action.kind;
  const id=kind==='melee'?AnimationCore.attackClip(p.action,p.mounted):kind==='pickup'?'spear-pickup':kind==='jump'?(p.mounted?'spear-mounted-melee':'spear-airslash'):prefix+kind;
  return director.choose(p,{id,time:p.action.elapsed,token:p.action.token||p.action});
 }
 if(p.stun>0)return director.choose(p,{id:prefix+'hurt',time:.2-p.stun});
 if(p.guard)return director.choose(p,{id:prefix+'guard'});
 if(p.dashLeft>0)return director.choose(p,{id:p.mounted?prefix+'run':'spear-dash',time:.2-p.dashLeft});
 if(p.z>0)return director.choose(p,{id:p.mounted?prefix+'run':'spear-jump',time:clamp((520-p.vz)/1500,0,.7)});
 const transition=director.transition(p.id);
 if(transition&&transition.id.startsWith('spear-'))return director.choose(p,transition);
 return director.choose(p,{id:prefix+(p.moving?(p.running?'run':'walk'):'idle')});
}
function drawHero(p){
 const x=p.x,y=p.y-p.z;
 ellipse(p.x,p.y+3,p.mounted?66:32,p.mounted?13:8,"#08171ca6");
 ctx.strokeStyle="#a4e6bd77";ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(p.x,p.y+3,p.mounted?65:30,9,0,0,7);ctx.stroke();
 SkillVFX.heroBack(ctx,p,world.time,feedback.reduced);
 const flicker=p.invulnerable>0&&Math.floor(world.time*22)%2?0.65:1;
 AnimationCore.draw(ctx,EquipmentVisuals.images(images,ANIMATION_ATLAS,world.gear,p.weapon),EquipmentVisuals.atlas(),heroPose(p),x,y+3,p.facing,p.dead?.8:flicker,p.ogreLeft>0?1.08:1);
 CombatVFX.drawEmbedded(ctx,p,x,y);
 if(p.dead)return;
 if(p.dashLeft>0){
  ctx.strokeStyle="#f3e7bd88";ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(x-p.facing*30,y-55);ctx.lineTo(x-p.facing*100,y-40);ctx.stroke();
 }
 if(p.guard||p.guardSession&&p.action&&p.action.kind==="counter"){
  const gy=y-(p.mounted?185:190),ratio=p.guardLeft/CFG.guardWindow;
  ctx.fillStyle="#102126dc";ctx.fillRect(x-48,gy,96,10);ctx.strokeStyle="#bcb992";ctx.strokeRect(x-48,gy,96,10);
  ctx.fillStyle=ratio>0?"#efd07b":"#748d94";ctx.fillRect(x-46,gy+2,92*ratio,6);
  text(ratio>0?"J 反击":"格挡中",x,gy-8,13,ratio>0?"#ffdf90":"#b7dbe1");
  ctx.strokeStyle="#a5e8f3b0";ctx.lineWidth=3;ctx.beginPath();ctx.arc(x+p.facing*25,y-65,49,p.facing===1?-1.2:1.9,p.facing===1?1.2:4.4);ctx.stroke();
 }
}
function enemyRect(e){
 return e.kind==="infantry"?{src:[0,330,1024,940],w:168,h:154}:e.kind==="archer"?{src:[0,20,1024,1495],w:115,h:168}:{src:null,w:268,h:179};
}
function drawAttached(e,dead){
 const count=e.embedded.length;if(!count)return;
 const shown=Math.min(count,6);
 for(let i=0;i<shown;i++){
  const deathProgress=dead?Math.min(1,(world.time-e.deathTime)/.64):e.knockdownLeft>0?1:0;
  const x=e.x+(i-(shown-1)/2)*8,y=e.y-e.z-(78-deathProgress*54)-(i%2)*7;
  ctx.strokeStyle="#decba0";ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x-22,y-29);ctx.stroke();
  ctx.strokeStyle="#eef0dc";ctx.beginPath();ctx.moveTo(x-22,y-29);ctx.lineTo(x-20,y-20);ctx.moveTo(x-22,y-29);ctx.lineTo(x-13,y-27);ctx.stroke();
 }
 if(dead){
  const glow=.65+Math.sin(world.time*4)*.2;
  ellipse(e.x,e.y+6,42,7,"rgba(222,196,112,"+glow*.25+")");
  text("箭 ×"+count,e.x,e.y+26,12,"#f1da95");
 }
}
function enemyPose(e){
 const kind=e.kind;
 if(e.trueBoss&&['yinEntrance','yinWindup','yinActive'].includes(e.state)){const winding=e.state!=='yinActive';return director.choose(e,{id:winding?'cavalry-ready':'cavalry-charge',time:winding?Math.max(0,(e.move?.windup||2.4)-e.timer):e.activeAge,token:e.state+(e.move?.id||'')});}
 if(e.dead)return director.choose(e,{id:kind+'-death',time:world.time-e.deathTime});
 if(e.controlled)return director.choose(e,{id:kind+'-hurt',time:.12,token:e.controlled});
 if(e.knockdownLeft>0){const pose=AnimationCore.downPose(e,CFG.knockdownDuration,CFG.riseDuration);return director.choose(e,{id:pose.clip.id,time:pose.time});}
 if(e.hardStun>0)return director.choose(e,{id:kind+'-hurt',time:.12});
 const transition=director.transition(e.id);
 if(transition)return director.choose(e,transition);
 if(kind==='infantry'&&e.state==='windup')return director.choose(e,{id:'infantry-windup',time:CFG.infantry.windup-e.timer});
 if(kind==='archer'&&e.state==='aim')return director.choose(e,{id:'archer-aim',time:CFG.archer.windup-e.timer});
 if(kind==='cavalry'&&e.state==='chargeWindup')return director.choose(e,{id:'cavalry-ready',time:CFG.cavalry.windup-e.timer});
 if(kind==='cavalry'&&e.state==='charge')return director.choose(e,{id:'cavalry-charge'});
 if(e.state==='recover')return director.choose(e,{id:kind+'-recover',time:CFG[kind].recovery-e.timer});
 if(kind==='archer'&&e.ammo===0&&!e.moving)return director.choose(e,{id:'archer-empty'});
 if(kind==='cavalry')return director.choose(e,{id:e.moving?'cavalry-charge':'cavalry-ready',...(e.moving?{}:{time:0})});
 return director.choose(e,{id:kind+'-walk',token:kind+(e.moving?'-moving':'-still'),...(e.moving?{}:{time:0,still:true})});
}
function drawEnemy(e){
 const r=enemyRect(e),friendly=e.team==='ally';
 ellipse(e.x,e.y+4,e.kind==="cavalry"?69:28,e.kind==="cavalry"?13:8,"#08171c9e");
 if(e.trueBoss){ctx.save();ctx.filter='saturate(1.2) brightness(.87)';}
 if(friendly&&e.kind==='infantry'){ctx.save();ctx.filter='hue-rotate(130deg) saturate(.6)';}
 AnimationCore.draw(ctx,friendly?allyImages:e.boss?bossImages:images,ANIMATION_ATLAS,enemyPose(e),e.x,e.y-e.z+3,e.facing,e.dead?.6:e.flash>0?.65:1,friendly?.70:e.trueBoss?1.3:e.boss?1.12:1);
 if(friendly&&e.kind==='infantry')ctx.restore();if(e.trueBoss){ctx.restore();BattleUpgrades.bossCrest(ctx,e,world.time);}
 if(friendly){ctx.strokeStyle='#91c7e280';ctx.lineWidth=1.5;ctx.beginPath();ctx.ellipse(e.x,e.y+3,42,6,0,0,7);ctx.stroke();if(e.hp<e.maxHp&&!e.dead){ctx.fillStyle='#122a32';ctx.fillRect(e.x-20,e.y-148,40,4);ctx.fillStyle='#8bcadd';ctx.fillRect(e.x-20,e.y-148,40*e.hp/e.maxHp,4);}if(e.formation===0&&!e.dead)text('唐军骑兵',e.x,e.y-164,12,'#b5e4f2');drawAttached(e,e.dead);return;}
 if(e.dead){drawAttached(e,true);return;}
 drawAttached(e,false);
 SkillVFX.enemyFire(ctx,e,world.time);
 const top=e.y-e.z-r.h-17,w=e.kind==="cavalry"?100:78;
 ctx.fillStyle="#101f20dc";ctx.fillRect(e.x-w/2,top,w,7);ctx.fillStyle=e.kind==="cavalry"?"#d29454":"#bd5346";ctx.fillRect(e.x-w/2+1,top+1,(w-2)*e.hp/e.maxHp,5);
 if(!world.chapter||e.boss||e.flash>0)text((e.name||LABEL[e.kind])+" "+CombatBalance.round(e.hp)+"/"+e.maxHp,e.x,top-8,11,e.kind==="cavalry"?"#ffcf83":"#f3dfc4");
 if(e.burns.length)text('灼烧 ×'+e.burns.length,e.x,top-29,12,'#ffb667');
 if(e.hardStun>0&&!e.controlled&&!e.knockdownLeft)text('僵直 '+e.hardStun.toFixed(1)+'s',e.x,e.y-45,12,'#b5e7ff');
 if(e.controlled)text(e.controlled==='lift'?'挑空':'拖拽',e.x,e.y-e.z-42,12,'#ffe7ae');
 if(e.knockdownLeft>0)text(e.state==='rising'?'起身中':'倒地 '+e.knockdownLeft.toFixed(1)+'s',e.x,e.y-35,13,'#f7d995');
 if(e.kind==="archer"&&(!world.chapter||e.ammo===0))text(e.ammo?"箭 "+e.ammo+"/10":"箭已用尽",e.x,top+23,10,e.ammo?"#d8d3b5":"#a9bbb5");
 if(e.state==="windup"||e.state==="aim"){
  text(e.state==="aim"?"拉弓":"起手",e.x,top-25,11,"#ffcb68");
  ctx.strokeStyle="#f5b55499";ctx.lineWidth=2;ctx.beginPath();ctx.arc(e.x,e.y+3,32,-Math.PI,0);ctx.stroke();
 }
 if(e.state==="chargeWindup")text("即将冲锋",e.x,top-27,13,"#ffe396");
 if(e.state==="recover"&&e.kind==="cavalry")text("收势",e.x,top-27,11,"#a4d8d0");
}
function drawTelegraphs(){
 if(world.trueBoss?.deployed)BattleUpgrades.telegraph(ctx,world.trueBoss,world.time);
 for(const e of world.enemies){
  if(e.dead||e.deployed===false||e.state!=="chargeWindup"||!scrollCamera.visible(e.x,1100))continue;
  const reach=CFG.cavalry.chargeSpeed*1.85;
  const left=e.attackDirection===1?e.x:Math.max(world.arena.left,e.x-reach);
  const width=e.attackDirection===1?Math.min(world.arena.right-e.x,reach):e.x-left;
  ctx.fillStyle="rgba(190,62,36,"+(.15+.12*Math.sin(world.time*13))+")";ctx.fillRect(left,e.y-26,width,52);
  ctx.strokeStyle="#ffad5ca8";ctx.lineWidth=2;ctx.setLineDash([15,12]);ctx.strokeRect(left,e.y-26,width,52);ctx.setLineDash([]);
 }
}
function drawArrow(a){
 SkillVFX.arrow(ctx,a,world.time);
 const px=a.x,py=a.y-a.z,angle=Math.atan2(a.vy-a.vz,a.vx);
 ctx.save();ctx.translate(px,py);ctx.rotate(angle);
 ctx.strokeStyle=a.owner==="hero"?"#f6e2ac":"#f0ad7b";ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-32,0);ctx.lineTo(9,0);ctx.stroke();
 ctx.fillStyle="#e6edf0";ctx.beginPath();ctx.moveTo(14,0);ctx.lineTo(5,-4);ctx.lineTo(5,4);ctx.closePath();ctx.fill();
 ctx.strokeStyle="#eee5c3";ctx.beginPath();ctx.moveTo(-30,0);ctx.lineTo(-35,-5);ctx.moveTo(-29,0);ctx.lineTo(-35,5);ctx.stroke();ctx.restore();
}
function drawEffects(){
 for(const f of world.effects){
  ctx.save();ctx.globalAlpha=Math.max(0,f.life/f.maxLife);
  if(BattleUpgrades.effect(ctx,f)||SkillVFX.effect(ctx,f)||CombatVFX.draw(ctx,f)||CombatVFX.drawSwing(ctx,f)){ctx.restore();continue;}
  if(f.kind==="text")text(f.text,f.x,f.y,20,f.color);
  else if(f.kind==="thrust"){
   ctx.translate(f.x,f.y);ctx.scale(f.facing||1,1);
   const reach=f.reach,fade=f.life/f.maxLife;
   ctx.strokeStyle=f.counter?'#ffe2a0':'#cef4fa';ctx.lineWidth=f.counter?7:4;
   ctx.beginPath();ctx.moveTo(24,6);ctx.lineTo(reach,0);ctx.stroke();
   ctx.strokeStyle='#f8ffff';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(reach-30,-9*fade);ctx.lineTo(reach,0);ctx.lineTo(reach-30,9*fade);ctx.stroke();
  }else if(f.kind==="slash"||f.kind==="enemySlash"){
   ctx.translate(f.x,f.y);ctx.scale(f.facing||1,1);
   if(f.reach)ctx.scale(f.reach/100,1);
   ctx.strokeStyle=f.kind==="enemySlash"?"#ffc196":f.counter?"#ffe1a1":"#ebfaf4";
   ctx.lineWidth=f.counter?10:f.combo===2?8:6;ctx.beginPath();ctx.arc(f.reach?24:-26,2,72,-1.1,1.08);ctx.stroke();
   ctx.lineWidth=2;ctx.strokeStyle="#fff9e8";ctx.beginPath();ctx.arc(f.reach?27:-23,3,64,-1.2,.95);ctx.stroke();
  }else if(f.kind==="block"){
   ctx.strokeStyle="#bbf7ff";ctx.lineWidth=3;
   for(let i=0;i<8;i++){const a=i*Math.PI/4;ctx.beginPath();ctx.moveTo(f.x+Math.cos(a)*8,f.y+Math.sin(a)*8);ctx.lineTo(f.x+Math.cos(a)*23,f.y+Math.sin(a)*23);ctx.stroke();}
  }ctx.restore();
 }
}
function draw(){
 ctx.clearRect(0,0,1280,720);
 const camera=feedback.camera();ctx.save();ctx.translate(camera.x,camera.y);
 const bg=images["scene"+world.scene];
 if(world.chapter)ChapterUI.background(ctx,images,scrollCamera.x,world);else ScrollScene.background(ctx,bg,scrollCamera.x,world.scene);
 const top=ctx.createLinearGradient(0,0,0,200);top.addColorStop(0,"#071520c9");top.addColorStop(1,"#07152000");ctx.fillStyle=top;ctx.fillRect(0,0,1280,200);
 const bottom=ctx.createLinearGradient(0,630,0,720);bottom.addColorStop(0,"#06141400");bottom.addColorStop(1,"#0614147d");ctx.fillStyle=bottom;ctx.fillRect(0,630,1280,90);
 ctx.save();ctx.translate(-scrollCamera.x,0);
 if(world.chapter)ChapterUI.scenery(ctx,world,scrollCamera);else if(world.scrolling)ScrollScene.scenery(ctx,world,scrollCamera);
 EquipmentUI.drawLoot(ctx,world,scrollCamera);drawTelegraphs();BattleUpgrades.heroAura(ctx,world.player,world.time);feedback.drawBehind(ctx,EquipmentVisuals.images(images,ANIMATION_ATLAS,world.gear,world.player.weapon),EquipmentVisuals.atlas(),AnimationCore);
 const entities=[...world.enemies.filter(e=>e.deployed!==false).map(e=>presenter.entity(e,renderAlpha)),...(world.allies||[]).filter(e=>e.deployed!==false).map(e=>presenter.entity(e,renderAlpha)),renderHero||world.player].sort((a,b)=>a.y-b.y||(a.dead?-1:1));
 entities.filter(e=>scrollCamera.visible(e.x,300)).forEach(e=>e.kind==="hero"?drawHero(e):drawEnemy(e));
 world.projectiles.filter(a=>scrollCamera.visible(a.x,180)).forEach(a=>drawArrow(presenter.entity(a,renderAlpha)));drawEffects();
 const corpse=world.nearbyCorpse();
 if(corpse&&!world.player.dead&&!world.player.mounted&&started){
  const p=renderHero||world.player;text(p.ammo===15?"箭囊已满":"N 拾箭 ×"+Math.min(15-p.ammo,corpse.embedded.length),p.x,p.y-p.z-206,14,"#ffe39a");
 }
 if(started&&world.player.weapon==="bow"&&!world.player.dead){
  const p=renderHero||world.player;ctx.fillStyle="#f5da8aaa";ctx.beginPath();ctx.moveTo(p.x+p.facing*62,p.y-p.z-62);ctx.lineTo(p.x+p.facing*73,p.y-p.z-58);ctx.lineTo(p.x+p.facing*62,p.y-p.z-54);ctx.fill();
 }
 ctx.restore();ctx.restore();if(started&&!menuOpen){feedback.drawOverlay(ctx);drawEdgeHints();}
}
function drawEdgeHints(){
 if(!world.scrolling||world.player.dead)return;
 for(const side of [-1,1]){
  const enemies=world.enemies.filter(e=>!e.dead&&e.deployed!==false&&(side<0?e.x<scrollCamera.x-60:e.x>scrollCamera.x+1340));
  if(!enemies.length)continue;
  const x=side<0?57:1223;text(side<0?'◀ 敌兵':'敌兵 ▶',x,337,14,'#ebbd84');
 }
}
function consumeEvents(){
 const events=world.events.splice(0);events.forEach(e=>{
  if(e.actor!=='ally')feedback.event(e);soundscape.event(e,world);if(['wave','enemyBatch','yinEntrance'].includes(e.type))buildRoute();
  if(e.type==='mount')director.event('hero',world.player.weapon==='spear'?(world.player.mounted?'spear-mounted-idle':'spear-draw'):(world.player.mounted?'hero-mount':'hero-dismount'));
  if(e.type==='switch')director.event('hero',e.mode==='spear'?(world.player.mounted?'spear-mounted-idle':'spear-draw'):(world.player.mounted?'mounted-idle':e.mode==='bow'?'hero-drawbow':'hero-drawsaber'));
  if(e.type==='land'&&!world.player.mounted)director.event('hero',world.player.weapon==='spear'?'spear-land':world.player.weapon==='bow'?'bow-land':'hero-land');
  if(e.type==='hurt')director.event('hero',world.player.weapon==='spear'?(world.player.mounted?'spear-mounted-hurt':'spear-hurt'):(world.player.mounted?'mounted-hurt':'hero-hurt'));
  if(e.type==='hit'){const target=world.enemies.find(t=>t.id===e.target);if(target&&world.canControl(target)&&!target.knockdownLeft)director.event(target.id,target.kind+'-hurt');}
  if(e.type==='getup')director.transitions.delete(e.target);
 });
}
let hudClock=0;
function loop(now){
 const frameStart=performance.now(),rawDt=lastTime?(now-lastTime)/1000:0;
 const dt=Math.max(0,Math.min(.1,rawDt));lastTime=now;
 const active=started&&!world.paused&&!menuOpen&&!StoryFlow.blocking();
 soundscape.setActive((active||StoryFlow.introSound())&&pageFocused&&!document.hidden,world.scene);soundscape.setListener(scrollCamera.x+640,1280);
 if(active)feedback.advance(dt);
 if(active&&world.status!=='lost'){
  const result=timeline.tick(dt,step=>{
   presenter.capture(world);world.step(step);director.advance(step);consumeEvents();
   const stop=feedback.stop;feedback.stop=0;if(stop>0)presenter.capture(world);return stop;
  });
  renderAlpha=result.alpha;director.renderOffset=timeline.hold>0?0:(renderAlpha-1)*timeline.step;
 }else{
  timeline.reset();renderAlpha=1;director.renderOffset=0;presenter.capture(world);
  if(active&&world.status==='lost')director.advance(dt);
 }
 consumeEvents();renderHero=presenter.entity(world.player,renderAlpha);
 if(active&&world.status==="playing")scrollCamera.update(renderHero,dt);
 if(active){feedback.capture(renderHero,heroPose(renderHero));soundscape.update(world);}
 draw();hudClock+=dt;if(hudClock>=1/30||!active){updateHUD();hudClock=0;}
 if(active&&rawDt>0&&rawDt<.5){renderStats.seconds+=rawDt;renderStats.frames++;renderStats.ms+=performance.now()-frameStart;if(renderStats.seconds>=2){renderStats.fps=renderStats.frames/renderStats.seconds;renderStats.cost=renderStats.ms/renderStats.frames;renderStats.seconds=0;renderStats.frames=0;renderStats.ms=0;}}
 requestAnimationFrame(loop);
}
window.getBattleSnapshot=()=>({...world.snapshot(),story:StoryFlow.state(),cameraX:scrollCamera.x,screenX:world.player.x-scrollCamera.x});
requestAnimationFrame(loop);
})();
