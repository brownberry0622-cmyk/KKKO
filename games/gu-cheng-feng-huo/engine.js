(function(root,factory){
  const api=typeof module==='object'&&module.exports?factory(require('./balance.js'),require('./equipment.js')):factory(root.CombatBalance,root.EquipmentCore);
  if(typeof module==="object"&&module.exports)module.exports=api;
  else root.BattleCore=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(Balance,Gear){
"use strict";
const CFG=Object.freeze({
  width:1280,height:720,arena:{left:65,right:1215,top:465,bottom:640},
  hero:{hp:100,melee:10,jump:20,counter:30,arrow:20,ammo:15,speed:150,runSpeed:280,mountedSpeed:310,mountedRunSpeed:520},
  infantry:{hp:80,damage:8,speed:92,windup:.58,recovery:1.0},
  archer:{hp:50,damage:20,ammo:10,speed:76,windup:.85,recovery:2.0},
  cavalry:{hp:200,damage:30,arrowMultiplier:2,speed:100,chargeSpeed:550,windup:.95,recovery:1.3},
  meleeReach:100,secondReach:180,spearReach:240,mountedReachBonus:35,counterReachBonus:25,comboWindow:.55,
  spearDamageMultiplier:1.5,mountedChargeMultiplier:2,knockdownDuration:1.5,riseDuration:.4,pullArrowDamage:5,
  inputBuffer:.18,guardWindow:.8,runHoldThreshold:.22,arrowSpeed:740,enemyArrowSpeed:455,pickupRadius:105
});
const MEDICINE=Object.freeze({heal:20,cooldown:20,duration:8,attackRate:1.4,moveRate:1.4});
const SKILLS=Object.freeze({cooldown:8,ogreCooldown:15,ogreDuration:8,ogreCostRate:Balance.OGRE.selfRate,ogrePower:Balance.OGRE.power,
  rushDistance:320,rushStart:.16,rushEnd:.66,liftAt:.2,slamAt:.9,slamRadius:240,
  rainReach:600,rainWidth:115,rainStun:1.5,burnTicks:Balance.BURN.seconds});
const COMBOS=Object.freeze({
  melee:Object.freeze([
    {name:"撩",reach:100,activeAt:.14,duration:.4,motion:"rise"},
    {name:"砍",reach:180,activeAt:.18,duration:.48,motion:"chop"},
    {name:"抹",reach:145,activeAt:.12,duration:.36,motion:"sweep"},
    {name:"刺",reach:205,activeAt:.18,duration:.46,motion:"thrust"},
    {name:"力劈华山",reach:160,activeAt:.3,duration:.68,motion:"slam",finisher:true}
  ].map(Object.freeze)),
  spear:Object.freeze([
    {name:"刺",reach:240,activeAt:.18,duration:.46,motion:"thrust"},
    {name:"掠",reach:220,activeAt:.22,duration:.52,motion:"sweep"},
    {name:"挑",reach:200,activeAt:.2,duration:.5,motion:"rise"},
    {name:"砸",reach:180,activeAt:.32,duration:.72,motion:"slam",finisher:true}
  ].map(Object.freeze))
});
const STAGE=Object.freeze({width:5120,alertRange:580,exitInset:240});
const SCENES=["三十骑破围 · 城外大道","临淮拒宴 · 府衙宴厅","真源赠马 · 驿站马场","宁陵会师 · 城外军营","血路返城 · 夜围通道","孤城终战 · 残垣长街"];
const LABEL={infantry:"步兵",archer:"弓兵",cavalry:"精英骑兵"};
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const sign=v=>v<0?-1:1;
const distance=(a,b)=>Math.hypot(a.x-b.x,(a.y-b.y)*1.3);
class World{
  constructor(options={}){
    this.random=options.random||Math.random;
    this.options=options;
    this.scrolling=options.scrolling===true;
    this.width=Math.max(CFG.width,Number.isFinite(options.width)?options.width:this.scrolling?STAGE.width:CFG.width);
    this.arena={...CFG.arena,right:this.width-65};this.exitX=this.width-STAGE.exitInset;this.clearedAt=null;
    this.time=0;this.endedAt=null;this.nextId=1;this.projectiles=[];this.enemies=[];this.effects=[];this.events=[];
    this.held=new Set();this.turnIntent=null;this.lastHorizontal=1;this.presses=[];this.buffered=null;this.guardRequested=false;this.lInput=null;this.fxSequence=0;this.status="playing";this.paused=false;
    this.scene=Number.isInteger(options.scene)?clamp(options.scene,0,5):Math.floor(this.random()*6);
    this.aiEnabled=options.ai!==false;
    this.gear=Gear.empty();this.loot=[];
    this.stats={dealt:0,taken:0,shots:0,recovered:0,pulled:0,blocks:0,counters:0,kills:0};
    this.player={id:"hero",kind:"hero",x:260,y:560,z:0,vz:0,facing:1,hp:100,maxHp:100,ammo:15,
      weapon:"melee",lastMelee:"melee",comboNext:1,comboUntil:0,mounted:false,action:null,guard:false,guardSession:false,guardLeft:0,
      invulnerable:0,stun:0,dashLeft:0,dashCooldown:0,dashVector:{x:1,y:0},moving:false,running:false,
      mountCooldown:0,flash:0,embedded:[],dead:false,medicineCooldowns:{1:0,2:0},hasteLeft:0,cooldowns:{U:0,I:0,O:0},ogreLeft:0,ogreAge:0,ogreTicks:0};
    if(options.spawn!==false){
      const mode=options.mode||"mixed";
      const kinds=mode==="mixed"?["infantry","archer","cavalry"]:[mode];
      kinds.forEach((kind,i)=>this.spawn(kind,this.scrolling?(kinds.length===1?this.width*.53:this.width*[.19,.49,.80][i]):kinds.length===1?800:720+i*180,kinds.length===1?560:(this.scrolling?[560,515,590]:[560,500,610])[i]));
    }
    this.total=this.enemies.length;this.startedWithEnemies=this.total>0;
    this.message(this.scrolling?"向右突围 · 镜头随行 · 清除沿途敌兵后抵达出口":"U / I 武器技能 · O 食人魔 · F 拾装备 · Tab 背包",4);
  }
  spawn(kind,x,y){
    if(!CFG[kind]||kind==="hero")throw Error("Unknown enemy kind");
    const e={id:"e"+this.nextId++,kind,x,y,z:0,facing:-1,hp:CFG[kind].hp,maxHp:CFG[kind].hp,
      ammo:kind==="archer"?10:0,state:"approach",timer:.6+this.random()*.4,
      stun:0,flash:0,moving:false,dead:false,embedded:[],chargeHit:false,attackTarget:null,
      engaged:!this.scrolling,attackDirection:-1,deathTime:0,knockdownLeft:0,burns:[],hardStun:0,hardStunUntil:0,controlled:null};
    this.enemies.push(e);return e;
  }
  emit(type,data={}){this.events.push({type,time:this.time,x:this.player.x,y:this.player.y,...data});if(this.events.length>100)this.events.shift();}
  message(text,duration=2){this.notice={text,until:this.time+duration};this.emit("notice",{text});}
  float(x,y,text,color="#fff0b3"){this.effects.push({kind:"text",x,y,text,color,life:.9,maxLife:.9});}
  down(code){
    if(this.held.has(code)||this.paused||this.player.dead)return;
    this.held.add(code);
    if(code==="KeyA"||code==="KeyD"){this.lastHorizontal=code==="KeyA"?-1:1;this.turnIntent=this.lastHorizontal;}
    if(code==="KeyL")this.lInput={since:this.time,long:false,cancelled:this.player.stun>0||this.player.guard};
    this.presses.push(code);
  }
  up(code){
    if(code==="KeyL"){
      const input=this.lInput;
      if(input&&!input.cancelled&&!input.long&&this.time-input.since<CFG.runHoldThreshold&&!this.paused&&!this.player.dead)
        this.presses.push("DashTap");
      this.lInput=null;this.player.running=false;
    }
    this.held.delete(code);
    if(code==="KeyK"){this.guardRequested=false;const p=this.player;p.guard=false;p.guardSession=false;p.guardLeft=0;}
  }
  clearInput(){this.guardRequested=false;this.buffered=null;this.held.clear();this.turnIntent=null;this.presses=[];this.lInput=null;this.resetCombo();this.player.running=false;this.player.guard=false;this.player.guardSession=false;this.player.guardLeft=0;}
  horizontalAxis(){
    const left=this.held.has("KeyA"),right=this.held.has("KeyD");
    return left&&right?this.lastHorizontal:right?1:left?-1:0;
  }
  takeFacing(){
    const direction=this.horizontalAxis()||this.turnIntent||this.player.facing;
    this.turnIntent=null;this.player.facing=direction;return direction;
  }
  steerAttack(){
    const p=this.player,a=p.action;if(!a||p.dead||p.stun>0||a.charged)return;
    const ordinary=['melee','jump','counter','shoot'].includes(a.kind);
    const beforeContact=!a.resolved;
    const recovering=ordinary&&a.resolved&&a.elapsed>=a.activeAt+.045;
    if(!beforeContact&&!recovering)return;
    if(!ordinary&&!['rush','lift','bladeFlurry','bladeWave','fireShot','arrowRain'].includes(a.kind))return;
    const direction=this.horizontalAxis()||this.turnIntent;if(!direction)return;
    p.facing=direction;this.turnIntent=null;
    // Released projectiles and already resolved hit boxes keep their direction.
    if(beforeContact)a.facing=direction;
  }
  modaoStrike(e,kind,mods={}){return !mods.ally&&!['burn','arrow','rain'].includes(kind)&&(mods.weapon||this.player.weapon)==='spear'&&Gear.isModao(this.gear);}
  resetCombo(){const p=this.player;p.comboNext=1;p.comboUntil=0;if(p.action){p.action.comboQueued=false;p.action.comboCancelled=true;}}
  basicDamage(weapon=this.player.weapon){return Balance.BASE[weapon]*(1+Gear.bonuses(this.gear,weapon).attack);}
  skillDamage(name,weapon=this.player.weapon){return this.basicDamage(weapon)*Balance.MULT[name];}
  gearBonuses(){return Gear.bonuses(this.gear,this.player.weapon);}
  refreshGear(){
    const p=this.player,oldMax=p.maxHp;p.maxHp=CFG.hero.hp+this.gearBonuses().maxHp;
    // Preserve the fraction of life: swapping armor cannot create healing.
    p.hp=Math.min(p.maxHp,p.hp/oldMax*p.maxHp);
  }
  equipItem(id){
    const p=this.player,item=this.gear.items.find(it=>it.id===id);
    if(!item||p.dead||this.status!=='playing')return false;
    if(p.action||p.stun>0||p.dashLeft>0||p.z>0){this.message('收招落地后可更换装备');return false;}
    this.gear.equipped[item.slot]=item.id;this.refreshGear();this.emit('equipment',{id});return true;
  }
  unequipItem(slot){
    if(!this.gear.equipped[slot]||this.player.dead||this.player.action||this.player.stun>0||this.player.dashLeft>0||this.player.z>0||this.status!=='playing')return false;
    delete this.gear.equipped[slot];this.refreshGear();return true;
  }
  dropEquipment(e){
    const item=Gear.drop(this.gear,e,this.chapter||1,this.random);if(!item)return null;
    const loot={item,x:e.x,y:e.y};this.loot.push(loot);this.emit('lootDrop',{item:item.name,x:e.x,y:e.y});return loot;
  }
  pickupEquipment(all=false){
    if(this.player.dead||(!all&&(this.paused||this.status!=='playing')))return 0;
    const picked=this.loot.filter(d=>all||distance(d,this.player)<=120);
    if(!picked.length){if(!all)this.message('走近地上的装备，按 F 拾取');return 0;}
    for(const d of picked)this.gear.items.push(d.item);
    this.loot=this.loot.filter(d=>!picked.includes(d));
    this.message('装备已收入背包 ×'+picked.length+' · Tab 查看 / 装备',3);this.emit('lootPickup',{count:picked.length});return picked.length;
  }
  initToughness(e){e.toughnessMax=e.trueBoss?Balance.TOUGHNESS.yin:Balance.TOUGHNESS.commander;e.toughness=e.toughnessMax;e.brokenUntil=0;}
  armored(e){return !!e.boss&&e.toughness>0;}
  canControl(e){return this.isEnemyActive(e)&&!this.armored(e);}
  damageMultiplier(e,kind,mods={}){return (['arrow','rain'].includes(kind)&&e.kind==='cavalry'?2:1)*(kind==='burn'?1:(mods.power||1))*(this.modaoStrike(e,kind,mods)&&e.kind==='cavalry'?1.5:1)*(this.armored(e)?1-Balance.TOUGHNESS.reduction:1);}
  chipToughness(e,raw,kind){
    if(!this.armored(e)||kind==='burn'||raw<=0)return;
    e.toughness=Math.max(0,e.toughness-raw*Balance.toughnessScale(kind));
    if(e.toughness===0){
      e.brokenUntil=this.time+Balance.TOUGHNESS.breakSeconds;e.controlled=null;e.knockdownLeft=0;e.z=0;e.move=null;e.state='recover';e.timer=.4;e.hardStunUntil=this.time+.4;e.chargeHit=true;
      this.float(e.x,e.y-210,'破韧 · 4秒','#c1f4ff');this.skillEffect('toughnessBreak',{x:e.x,y:e.y-80},.65);this.emit('toughnessBreak',{target:e.id});
    }
  }
  tickToughness(e){
    if(!e.boss||e.dead||e.deployed===false||e.toughness>0||this.time+1e-8<e.brokenUntil)return;
    e.toughness=e.toughnessMax;e.brokenUntil=0;e.controlled=null;e.knockdownLeft=0;e.hardStunUntil=0;e.hardStun=0;e.stun=0;e.z=0;e.move=null;e.state='recover';e.timer=.5;
    this.emit('toughnessRestored',{target:e.id});
  }
  playerRight(){return this.arena.right;}
  attackReach(weapon=this.player.weapon,combo=1,kind="melee",mounted=this.player.mounted){
    const chain=COMBOS[weapon]||COMBOS.melee;
    return (kind==="melee"?chain[clamp(combo-1,0,chain.length-1)].reach:chain[0].reach)
      +(mounted?CFG.mountedReachBonus:0)+(kind==="counter"?CFG.counterReachBonus:0);
  }
  attackDamage(weapon,kind="melee",charged=false){
    const mult=kind==='counter'?Balance.MULT.counter:kind==='jump'?Balance.MULT.jump:1;
    return this.basicDamage(weapon)*mult*(charged?(weapon==='spear'?Balance.MULT.mountedSpear:Balance.MULT.mountedBlade):1);
  }
  isFree(){const p=this.player;return !p.dead&&!p.action&&p.stun<=0&&p.dashLeft<=0;}
  beginGuard(){
    const p=this.player;if(!this.isFree()||p.z>1||p.vz>0)return false;
    this.guardRequested=false;this.resetCombo();p.guard=true;p.guardSession=true;p.guardLeft=CFG.guardWindow;p.running=false;
    if(this.lInput)this.lInput.cancelled=true;
    this.emit("guard");return true;
  }
  beginAttack(){
    const p=this.player;
    const charged=p.mounted&&p.dashLeft>0&&!p.action&&!p.dead&&p.stun<=0&&!p.guard&&p.z===0&&p.weapon!=="bow";
    if(!this.isFree()&&!charged){
      const a=p.action;
      if(a&&a.kind==="melee"&&!a.charged&&!a.comboCancelled&&p.z===0&&!p.dead&&p.stun<=0){a.comboQueued=true;return true;}
      return false;
    }
    if(charged&&p.weapon==='spear')return this.beginMountedRush();
    let kind;
    if(p.guard){
      if(p.guardLeft<=0)return false;
      kind="counter";p.guardLeft=0;p.guard=false;this.stats.counters++;
    }else kind=p.weapon==="bow"?"shoot":p.z>10||p.vz>0?"jump":"melee";
    if(kind==="shoot"&&p.ammo<=0){this.message("箭囊已空 · 走近留箭尸体，按 N 回收");return false;}
    const chain=COMBOS[p.weapon]||COMBOS.melee;
    const combo=charged?(p.weapon==="melee"?2:1):kind==="melee"&&p.comboNext>1&&this.time<=p.comboUntil?p.comboNext:1;
    const move=chain[combo-1];
    // Windup follows the latest direction; the contact snapshot stays immutable afterward.
    const facing=charged?p.facing:this.takeFacing();
    this.resetCombo();
    const timing=charged?[.1,.42]:kind==="melee"?[move.activeAt,move.duration]:{jump:[.12,.43],counter:[.16,.57],shoot:[.25,.52]}[kind];
    p.action={kind,weapon:p.weapon,combo,facing,...this.offense(),elapsed:0,activeAt:timing[0],duration:timing[1],resolved:false,
      reach:this.attackReach(p.weapon,combo,kind),comboQueued:false,charged,
      damage:kind==="shoot"?this.basicDamage("bow"):this.attackDamage(p.weapon,kind,charged),name:charged?(p.weapon==="melee"?"骑冲劈砍":"骑冲刺击"):kind==="melee"?move.name:kind==="jump"?"跳跃攻击":kind==="counter"?"格挡反击":"射箭",
      motion:charged?(p.weapon==="melee"?"chop":"thrust"):kind==="melee"?move.motion:p.weapon==="spear"?"thrust":"chop",
      finisher:kind==="melee"&&!charged&&!!move.finisher};p.running=false;
    if(this.lInput)this.lInput.cancelled=true;
    if(kind==="counter")p.invulnerable=Math.max(p.invulnerable,.57);
    this.emit("attackStart",{kind,weapon:p.weapon,combo,facing,name:p.action.name,charged});return true;
  }
  beginMountedRush(){
    const p=this.player;this.resetCombo();p.dashLeft=0;p.running=false;if(this.lInput)this.lInput.cancelled=true;
    p.action={kind:'mountedRush',weapon:'spear',name:'踏阵贯槊',elapsed:0,duration:.68,activeAt:.08,resolved:false,
      origin:p.x,facing:p.facing,reach:180,distance:400,rushStart:.08,rushEnd:.5,targets:[],hitIds:new Set(),charged:true,damage:this.skillDamage('mountedSpear','spear'),...this.offense()};
    this.emit('skill',{key:'J',kind:'mountedRush'});return true;
  }
  useMedicine(slot){
    const p=this.player;
    if(![1,2].includes(slot)||p.dead||this.paused||this.status!=="playing")return false;
    if(p.medicineCooldowns[slot]>1e-8){this.message((slot===1?'酒壶':'迅行药剂')+'冷却 '+p.medicineCooldowns[slot].toFixed(1)+' 秒');return false;}
    if(slot===1&&p.hp>=p.maxHp){this.message('生命已满 · 酒壶未消耗');return false;}
    p.medicineCooldowns[slot]=MEDICINE.cooldown;
    if(slot===1){const healed=Math.min(MEDICINE.heal,p.maxHp-p.hp);p.hp+=healed;this.float(p.x,p.y-p.z-190,'饮酒 +'+healed,'#a5efd2');}
    else{p.hasteLeft=MEDICINE.duration;this.float(p.x,p.y-p.z-190,'迅行 · 攻速 / 移速 +40%','#a4e3ff');}
    this.skillEffect('medicine',{x:p.x,y:p.y,slot},.75);this.emit('medicine',{slot});return true;
  }
  isEnemyActive(e){return !e.dead&&e.deployed!==false;}
  offense(){return {power:this.player.ogreLeft>0?SKILLS.ogrePower:1,burn:this.player.ogreLeft>0};}
  skillEffect(kind,data,life=.6){this.effects.push({kind,...data,life,maxLife:life,seed:++this.fxSequence});}
  releaseControlled(){
    for(const e of this.enemies)if(e.controlled){e.controlled=null;e.z=0;if(!e.dead){e.state="recover";e.timer=.5;e.hardStunUntil=Math.max(e.hardStunUntil,this.time+.2);e.hardStun=e.hardStunUntil-this.time;}}
  }
  castSkill(key){
    const p=this.player;
    if(!["U","I","O"].includes(key)||!this.isFree()||p.guard||p.z>0||p.vz>0)return false;
    if(key==="O"&&(this.status==="won"||this.clearedAt!==null)){this.message("本轮已清场 · R 再战后可使用食人魔");return false;}
    if(p.cooldowns[key]>1e-8){this.message(key+" 冷却 "+p.cooldowns[key].toFixed(1)+" 秒");return false;}
    if(key!=="O"&&p.weapon==="bow"&&p.ammo<=0){this.message("箭囊已空 · 技能需要 1 支箭");return false;}
    this.takeFacing();this.resetCombo();p.running=false;if(this.lInput)this.lInput.cancelled=true;
    p.cooldowns[key]=key==="O"?SKILLS.ogreCooldown:SKILLS.cooldown;
    if(key==="O"){
      p.ogreLeft=SKILLS.ogreDuration;p.ogreAge=0;p.ogreTicks=0;
      this.skillEffect("ogreBurst",{x:p.x,y:p.y},.85);
      this.message("食人魔 · 伤害 ×1.5 / 近战吸血10% · 每秒消耗当前生命5%",3);
      this.emit("ogre");return true;
    }
    const bow=p.weapon==='bow',spear=p.weapon==='spear';
    const kind=bow?(key==='U'?'fireShot':'arrowRain'):spear?(key==='U'?'rush':'lift'):(key==='U'?'bladeFlurry':'bladeWave');
    const spec={rush:['破阵贯槊',.86,.16,'spearRush'],lift:['挑龙震地',1.2,.2,'lift'],bladeFlurry:['回风三叠',.98,.14,'bladeFlurry'],bladeWave:['断阵横斩',.95,.38,'bladeWave'],fireShot:['贯火矢',.8,.34,'fireShot'],arrowRain:['漫天箭雨',.8,.34,'arrowRain']}[kind];
    p.action={kind,weapon:p.weapon,name:spec[0],elapsed:0,duration:spec[1],activeAt:spec[2],resolved:false,slammed:false,
      hitIds:new Set(),targets:[],origin:p.x,facing:p.facing,reach:spear?220:kind==='bladeWave'?340:180,
      bladeHit:0,baseDamage:this.basicDamage(),damage:this.skillDamage(spec[3]),...this.offense()};
    this.emit("skill",{key,kind:p.action.kind});return true;
  }
  addBurn(e){
    if(!this.isEnemyActive(e))return;
    if(!e.burns.length)e.burnNext=this.time+1;
    e.burns.push({until:this.time+SKILLS.burnTicks});this.emit('burnApplied',{target:e.id,stacks:e.burns.length});
  }
  tickBurns(e){
    if(!e.burns.length||!this.isEnemyActive(e))return;
    while(e.burnNext<=this.time+1e-8&&e.burns.length&&this.isEnemyActive(e)){
      const tick=e.burnNext,stacks=e.burns.filter(b=>b.until+1e-8>=tick).length;e.burnNext+=1;
      if(stacks){const rate=Math.min(Balance.BURN.maxRate,Balance.burnRate(this.player.hp,this.player.maxHp)*stacks);this.damageEnemy(e,e.hp*rate,'burn',null,null,{power:1,burn:false});}
      e.burns=e.dead?[]:e.burns.filter(b=>b.until>tick+1e-8);
    }
  }
  tickOgre(dt){
    const p=this.player;if(p.ogreLeft<=0||p.dead)return;
    p.ogreAge=Math.min(SKILLS.ogreDuration,p.ogreAge+dt);
    while(p.ogreTicks<SKILLS.ogreDuration&&p.ogreTicks+1<=p.ogreAge+1e-8){
      p.ogreTicks++;const cost=p.hp*SKILLS.ogreCostRate;p.hp-=cost;this.stats.taken+=cost;
      this.float(p.x,p.y-p.z-180,"焚身 −"+Balance.round(cost),"#fa967b");
      if(p.hp===0){this.releaseControlled();p.dead=true;p.action=null;p.ogreLeft=0;this.status="lost";this.endedAt=this.time;this.clearInput();this.emit("lost");return;}
    }
    p.ogreLeft=Math.max(0,SKILLS.ogreDuration-p.ogreAge);
    if(p.ogreLeft<1e-8)p.ogreLeft=0;
  }
  resolveSkill(a){
    const p=this.player;
    if(a.kind==="fireShot"){this.playerShot(true,a);return;}
    if(a.kind==="arrowRain"){
      p.ammo--;this.stats.shots++;const arrowId="a"+this.nextId++;
      const targets=this.enemies.filter(e=>this.isEnemyActive(e)&&(e.x-p.x)*a.facing>=40&&(e.x-p.x)*a.facing<=SKILLS.rainReach&&Math.abs(e.y-p.y)<=SKILLS.rainWidth)
        .sort((l,r)=>Math.abs(l.x-p.x)-Math.abs(r.x-p.x));
      // Only the one physical arrow can be recovered; the other rain streaks are an effect.
      targets.forEach((e,i)=>{this.damageEnemy(e,a.damage,"rain",i===0?arrowId:null,null,a);if(this.canControl(e)){e.hardStun=SKILLS.rainStun;e.hardStunUntil=this.time+SKILLS.rainStun;e.state="recover";e.timer=.4;e.chargeHit=true;e.attackTarget=null;}});
      this.skillEffect("arrowRain",{x:p.x,y:p.y,facing:a.facing,reach:SKILLS.rainReach,burn:a.burn},.95);
      this.emit("arrowRain");return;
    }
    if(a.kind==='bladeWave'){
      for(const e of this.enemies){const dx=(e.x-p.x)*a.facing;
        if(this.isEnemyActive(e)&&dx>=-30&&dx<=a.reach&&Math.abs(e.y-p.y)<=100){
          this.damageEnemy(e,a.damage,'bladeWave',null,null,a);
          if(this.canControl(e)){e.x=clamp(e.x+a.facing*90,this.arena.left,this.arena.right);this.knockDown(e);}
        }
      }
      this.skillEffect('bladeWave',{x:p.x,y:p.y-65,facing:a.facing,reach:a.reach},.55);this.emit('swing',{weapon:'melee',finisher:true});return;
    }
    if(a.kind==="lift"){
      for(const e of this.enemies){const dx=(e.x-p.x)*a.facing;
        if(this.isEnemyActive(e)&&dx>=-12&&dx<=a.reach&&Math.abs(e.y-p.y)<=65){
          this.damageEnemy(e,a.baseDamage*Balance.MULT.lift,"lift",null,null,a);
          if(this.canControl(e)){e.controlled="lift";e.knockdownLeft=0;e.state="airborne";a.targets.push(e);}
        }
      }
      this.skillEffect("skillRise",{x:p.x,y:p.y-70,facing:a.facing,reach:a.reach},.45);
    }
  }
  tickSkill(a,dt){
    const p=this.player;
    if(a.kind==='bladeFlurry'){
      const moments=[.14,.39,.66];
      while(a.bladeHit<moments.length&&a.elapsed+1e-8>=moments[a.bladeHit]){
        const hit=a.bladeHit++;p.x=clamp(p.x+a.facing*25,this.arena.left,this.playerRight());
        for(const e of this.enemies)if(this.isEnemyActive(e)&&(e.x-p.x)*a.facing>=-65&&(e.x-p.x)*a.facing<=a.reach&&Math.abs(e.y-p.y)<=82)this.damageEnemy(e,a.damage,'bladeFlurry',null,null,a);
        this.skillEffect('bladeArc',{x:p.x,y:p.y-70,facing:a.facing,reach:a.reach,hit},.28);this.emit('swing',{weapon:'melee',combo:hit+1});
      }
    }
    const rushStart=a.rushStart??SKILLS.rushStart,rushEnd=a.rushEnd??SKILLS.rushEnd;
    if(['rush','mountedRush'].includes(a.kind)&&!a.released&&a.elapsed>=rushStart){
      const q=clamp((a.elapsed-rushStart)/(rushEnd-rushStart),0,1),oldX=p.x;
      p.x=clamp(a.origin+a.facing*(a.distance||SKILLS.rushDistance)*q,this.arena.left,this.playerRight());
      if(a.elapsed<=rushEnd+dt){
        for(const e of this.enemies){const dx=(e.x-oldX)*a.facing;
          if(this.isEnemyActive(e)&&!a.hitIds.has(e.id)&&dx>=-12&&dx<=a.reach+Math.abs(p.x-oldX)&&Math.abs(e.y-p.y)<=48){
            a.hitIds.add(e.id);this.damageEnemy(e,a.damage,a.kind,null,null,a);
            if(this.canControl(e)){e.controlled="rush";e.knockdownLeft=0;e.state="carried";a.targets.push({enemy:e,offset:clamp((e.x-p.x)*a.facing,50,a.reach)});}
          }
        }
      }
      for(const t of a.targets)if(!t.enemy.dead&&t.enemy.controlled==='rush'){t.enemy.x=clamp(p.x+a.facing*t.offset,this.arena.left,this.arena.right);t.enemy.y=p.y;t.enemy.z=0;}
      if(a.elapsed>=rushEnd){this.releaseControlled();a.released=true;}
    }
    if(a.kind==="lift"&&a.resolved&&!a.slammed){
      const q=clamp((a.elapsed-SKILLS.liftAt)/(SKILLS.slamAt-SKILLS.liftAt),0,1);
      for(const e of a.targets)if(!e.dead&&e.controlled==='lift')e.z=190*Math.sin(q*Math.PI);
      if(a.elapsed+1e-8>=SKILLS.slamAt){
        a.slammed=true;this.releaseControlled();const x=clamp(p.x+a.facing*160,this.arena.left,this.arena.right);
        for(const e of this.enemies)if(this.isEnemyActive(e)&&Math.hypot((e.x-x)/SKILLS.slamRadius,(e.y-p.y)/100)<=1){
          this.damageEnemy(e,a.baseDamage*Balance.MULT.slam,"slam",null,null,a);if(!e.dead)this.knockDown(e);
        }
        this.skillEffect("skillSlam",{x,y:p.y,reach:SKILLS.slamRadius},.7);this.emit("slam");
      }
    }
  }
  switchWeapon(mode){
    if(!["melee","spear","bow"].includes(mode)||!this.isFree()||this.player.guard)return false;
    const p=this.player;this.resetCombo();p.weapon=mode;if(mode!=="bow")p.lastMelee=mode;
    this.message(mode==="spear"?"马槊 · 刺 → 掠 → 挑 → 砸 · 每段 "+Balance.round(this.basicDamage("spear")):mode==="melee"?"刀 · 撩 → 砍 → 抹 → 刺 → 力劈华山 · 每段 "+Balance.round(this.basicDamage("melee")):"弓箭 · E 返回"+(p.lastMelee==="spear"?"马槊":"刀"));
    this.emit("switch",{mode});return true;
  }
  pickup(){
    const p=this.player;
    if(!this.isFree()||p.z>1||p.guard||p.mounted){
      this.message(p.mounted?"先按 H 下马，再按 N 拾箭":"落地并结束当前动作后可拾箭");return 0;
    }
    const corpse=this.nearbyCorpse();
    if(!corpse){this.message("走近插着箭的尸体，再按 N 拾取");return 0;}
    const amount=Math.min(corpse.embedded.length,15-p.ammo);
    if(amount<=0){this.message("箭囊已满 15/15 · 尸体上的箭仍保留");return 0;}
    corpse.embedded.splice(0,amount);p.ammo+=amount;this.stats.recovered+=amount;
    p.action={kind:"pickup",elapsed:0,duration:.28,activeAt:1,resolved:true};
    this.float(p.x,p.y-120,"+"+amount+" 箭","#92e3b5");this.emit("pickup",{amount});
    this.message("回收 "+amount+" 支箭 · "+p.ammo+"/15");return amount;
  }
  nearbyCorpse(){
    const p=this.player;
    return this.enemies.filter(e=>e.dead&&e.embedded.length&&distance(e,p)<=CFG.pickupRadius)
      .sort((a,b)=>distance(a,p)-distance(b,p)||a.id.localeCompare(b.id))[0]||null;
  }
  pullArrow(){
    const p=this.player;
    if(!this.isFree()||p.guard||p.z>1){this.message("落地并结束当前动作后可拔箭");return false;}
    if(!p.embedded.length){this.message("身上没有可回收的箭");return false;}
    if(p.ammo>=CFG.hero.ammo){this.message("箭囊已满 · 身上箭保留，不扣生命");return false;}
    this.resetCombo();p.running=false;if(this.lInput)this.lInput.cancelled=true;
    p.action={kind:"pull",elapsed:0,activeAt:.24,duration:.48,resolved:false};
    this.message("正在拔箭 · 回收 1 支，生命 −5");return true;
  }
  resolvePull(){
    const p=this.player;if(p.dead||!p.embedded.length||p.ammo>=CFG.hero.ammo)return;
    p.embedded.shift();p.ammo++;this.stats.recovered++;this.stats.pulled++;
    p.hp=Math.max(0,p.hp-CFG.pullArrowDamage);this.stats.taken+=CFG.pullArrowDamage;p.flash=.18;
    this.float(p.x,p.y-p.z-155,"拔箭 −5 / +1 箭","#edbd89");this.emit("pull",{damage:5,amount:1});
    if(p.hp===0){p.dead=true;p.action=null;p.ogreLeft=0;this.status="lost";this.endedAt=this.time;this.emit("lost");this.clearInput();}
  }
  // A single latest-intent buffer bridges recovery; it never skips an active frame.
  handlePress(code){
    const p=this.player;
    if(code==='KeyK'){this.buffered=null;this.resetCombo();this.guardRequested=this.held.has(code);return this.guardRequested&&this.beginGuard();}
    // Supplies do not erase a queued strike or its intended turn.
    if(['Digit1','Numpad1','Digit2','Numpad2'].includes(code))return this.performPress(code);
    const ok=this.performPress(code);
    if(ok){this.buffered=null;return true;}
    const supported=['KeyJ','KeyQ','KeyE','WeaponCycle','Space','DashTap','KeyU','KeyI','KeyO','KeyH','KeyN','KeyB'];
    if(!p.dead&&!this.paused&&supported.includes(code)&&(p.action||p.stun>0||p.dashLeft>0||p.z>0)){
      if(code!=='KeyJ')this.resetCombo();
      this.buffered={code,until:this.time+CFG.inputBuffer};
    }
    return false;
  }
  flushInput(){
    const p=this.player;
    if(p.dead){this.buffered=null;return;}
    if(this.guardRequested&&this.held.has('KeyK')&&!p.guard&&!p.guardSession&&this.isFree()&&p.z===0&&p.vz===0)this.beginGuard();
    const b=this.buffered;if(!b)return;
    if(this.time>b.until+1e-8){this.buffered=null;return;}
    if(!this.isFree())return;
    const airborne=['Space','KeyU','KeyI','KeyO','KeyH','KeyN','KeyB'].includes(b.code)&&(p.z>0||p.vz>0);
    if(airborne)return;
    this.buffered=null;this.performPress(b.code);
  }
  performPress(code){
    const p=this.player;if(p.dead)return false;
    if(['Digit1','Numpad1','Digit2','Numpad2'].includes(code))return this.useMedicine(Number(code.slice(-1)));
    if(code==='KeyJ')return this.beginAttack();
    if(code==='WeaponCycle')return this.switchWeapon(p.weapon==='melee'?'spear':p.weapon==='spear'?'bow':'melee');
    if(code==='KeyQ')return this.switchWeapon('bow');
    if(code==='KeyE')return this.switchWeapon(p.weapon==='bow'?p.lastMelee:p.weapon==='melee'?'spear':'melee');
    if(code==='KeyF')return this.pickupEquipment()>0;
    if(code==='KeyN')return this.pickup()>0;
    if(code==='KeyB')return this.pullArrow();
    if(['KeyU','KeyI','KeyO'].includes(code))return this.castSkill(code.slice(3));
    if(code==='Space'&&this.isFree()&&p.z===0&&p.vz===0&&!p.guard){
      this.resetCombo();p.vz=520;this.emit('jump');return true;
    }
    if(code==='KeyH'&&this.isFree()&&p.z===0&&p.vz===0&&!p.guard&&p.mountCooldown<=0){
      this.resetCombo();p.mounted=!p.mounted;p.mountCooldown=.4;this.message(p.mounted?'已骑乘 · 短按 L 冲刺中点 J：刀劈砍×2 / 槊贯穿×1.5':'已下马');this.emit('mount');return true;
    }
    if(code==='DashTap'&&this.isFree()&&!p.guard&&p.dashCooldown<=0){
      this.resetCombo();let x=this.horizontalAxis();
      let y=Number(this.held.has('KeyS'))-Number(this.held.has('KeyW'));
      if(!x&&!y)x=p.facing;
      const len=Math.hypot(x,y);p.dashVector={x:x/len,y:y/len};
      if(x)p.facing=sign(x);p.dashLeft=.2;p.dashCooldown=.75;p.running=false;
      p.invulnerable=Math.max(p.invulnerable,.2);this.emit('dash');return true;
    }
    return false;
  }
  resolveMelee(kind,action=this.player.action){
    const p=this.player;
    const facing=action?.facing||p.facing;
    const weapon=action&&action.weapon||p.weapon,combo=action&&action.combo||1;
    const reach=action&&action.reach||this.attackReach(weapon,combo,kind);
    const amount=action&&action.damage||this.attackDamage(weapon,kind);
    const motion=action&&action.motion||COMBOS[weapon=== "spear"?"spear":"melee"][combo-1].motion;
    this.effects.push({kind:motion==="thrust"?"thrust":"slash",x:p.x,y:p.y-p.z-(p.mounted?105:64),facing,
      reach,combo,motion,finisher:!!(action&&action.finisher),charged:!!(action&&action.charged),counter:kind==="counter",weapon,life:.22,maxLife:.22});
    this.emit("swing",{kind,weapon,combo,finisher:!!(action&&action.finisher),charged:!!(action&&action.charged)});
    for(const e of this.enemies){
      const dx=(e.x-p.x)*facing;
      if(this.isEnemyActive(e)&&dx>=-12&&dx<=reach+(e.kind==="cavalry"?35:0)&&Math.abs(e.y-p.y)<42&&p.z<140){
        this.damageEnemy(e,amount,kind,null,null,action||this.offense());if(action&&action.finisher&&!e.dead)this.knockDown(e);
      }
    }
  }
  knockDown(e){
    if(!this.canControl(e))return false;
    e.knockdownLeft=CFG.knockdownDuration;e.state="knocked";e.stun=0;e.timer=0;e.moving=false;
    e.chargeHit=true;e.attackTarget=null;
    this.effects.push({kind:"groundImpact",x:e.x,y:e.y+3,life:.45,maxLife:.45});
    this.float(e.x,e.y-130,"击倒","#f4d794");this.emit("knockdown",{target:e.id});return true;
  }
  playerShot(fire=false,mods=this.offense()){
    const p=this.player;if(p.ammo<=0)return;
    p.ammo--;this.stats.shots++;
    const facing=mods.facing||p.facing;
    const speed=CFG.arrowSpeed,x=p.x+facing*25,z=60+p.z+(p.mounted?25:0);
    const target=this.enemies.filter(e=>this.isEnemyActive(e)&&(e.x-p.x)*facing>0&&Math.abs(e.y-p.y)<58&&Math.abs(e.x-p.x)<=CFG.arrowSpeed*2)
      .sort((a,b)=>Math.abs(a.x-p.x)-Math.abs(b.x-p.x))[0];
    const flight=target?Math.max(.12,Math.abs(target.x-x)/speed):1;
    const a={id:"a"+this.nextId++,owner:"hero",x,y:p.y,z,vx:facing*speed,
      vy:target?(target.y-p.y)/flight:0,vz:target?((target.kind==="cavalry"?88:60)-z)/flight:(p.z>0?-90:0),
      damage:fire?(mods.damage||this.skillDamage("fireShot","bow")):(mods.damage||this.basicDamage("bow")),weapon:"bow",life:2.0,dead:false,fire,piercing:fire,hitIds:new Set(),lastTarget:null,power:mods.power,burn:fire||mods.burn};
    this.projectiles.push(a);this.emit("arrow",{fire,enchanted:mods.burn});
  }
  enemyShot(e){
    if(e.ammo<=0||e.dead)return false;
    e.ammo--;
    const target=e.attackTarget||this.player;
    const x=e.x+e.attackDirection*20,speed=CFG.enemyArrowSpeed;
    const flight=Math.max(.25,Math.abs(target.x-x)/speed);
    this.projectiles.push({id:"a"+this.nextId++,owner:e.id,x,y:e.y,z:65,
      vx:e.attackDirection*speed,vy:(target.y-e.y)/flight,
      vz:((target.z||0)+58-65)/flight,damage:20,life:2.8,dead:false});
    this.emit("enemyArrow",{x:e.x,y:e.y});return true;
  }
  damageEnemy(e,amount,kind,arrowId,contact,mods=this.offense()){
    if(e.dead)return 0;
    const arrow=["arrow","rain"].includes(kind),burn=kind==="burn";
    e.engaged=true;const raw=amount*(arrow&&e.kind==='cavalry'?2:1)*(burn?1:(mods.power||1));
    const dealt=Math.min(e.hp,Math.max(0,amount*this.damageMultiplier(e,kind,mods)));
    this.chipToughness(e,raw*(this.modaoStrike(e,kind,mods)?1.5:1),kind);
    if(arrowId)e.embedded.push(arrowId);
    e.hp=Math.max(0,e.hp-dealt);if(!burn){e.flash=.14;if(this.canControl(e))e.stun=e.kind==="cavalry"?.05:.18;}
    if(!burn&&this.canControl(e)&&e.kind!=="cavalry"&&(e.state==="windup"||e.state==="aim")){e.state="recover";e.timer=.55;}
    this.stats.dealt+=dealt;
    if(this.modaoStrike(e,kind,mods)&&dealt>0){
      this.skillEffect('modaoHit',{x:e.x,y:e.y-55,facing:mods.facing||this.player.facing,heavy:!!mods.finisher||!!mods.charged},.42);
      if(e.kind==='cavalry')this.float(e.x,e.y-e.z-155,'人马俱碎','#ffe0a0');
      if(mods.finisher&&e.hp>0&&this.canControl(e)){e.x=clamp(e.x+(mods.facing||this.player.facing)*45,this.arena.left,this.arena.right);}
    }
    const direction=contact?contact.direction:sign(e.x-this.player.x);
    const life=kind==="arrow"?.58:kind==="counter"?.4:.3;
    if(!burn)this.effects.push({kind:arrow?"blood":"impact",attack:kind,weapon:mods.weapon||this.player.weapon,finisher:!!mods.finisher,charged:!!mods.charged,
      x:contact?contact.x:e.x-direction*12,y:contact?contact.y:e.y-(e.kind==="cavalry"?104:76),
      direction,target:e.id,life,maxLife:life,seed:++this.fxSequence});
    this.float(e.x+(burn?60:30),e.y-e.z-(e.kind==="cavalry"?125:112),(burn?"灼烧 ":"")+String(Balance.round(dealt))+(arrow&&e.kind==="cavalry"?" 弱点":""),kind==="counter"?"#ffe49d":"#ffcf9c");
    this.emit(burn?"burnTick":"hit",{target:e.id,damage:dealt,kind,x:e.x,y:e.y-e.z,weapon:mods.weapon||this.player.weapon,finisher:!!mods.finisher,charged:!!mods.charged});
    if(!burn&&mods.burn)this.addBurn(e);
    const meleeHit=!arrow&&!burn&&!mods.ally&&(mods.weapon||this.player.weapon)!=='bow';
    if(this.player.ogreLeft>0&&!this.player.dead&&meleeHit&&dealt>0){
      const heal=Math.min(this.player.maxHp-this.player.hp,dealt*Balance.OGRE.leech);
      this.player.hp+=heal;if(heal>0){this.float(this.player.x,this.player.y-145,'吸血 +'+Balance.round(heal),'#f2acbf');this.emit('leech',{amount:heal});this.skillEffect('leech',{x:this.player.x,y:this.player.y-70},.4);}
    }
    if(e.hp===0){e.burns=[];e.controlled=null;e.z=0;e.dead=true;e.state="dead";e.deathTime=this.time;this.stats.kills++;this.dropEquipment(e);this.emit("kill",{kind:e.kind});}
    return dealt;
  }
  damagePlayer(amount,sourceX,kind,arrowId){
    const p=this.player;if(p.dead)return "dead";
    const inFront=(sourceX-p.x)*p.facing>=-5;
    if(p.guard&&p.z<1&&inFront){
      this.stats.blocks++;this.float(p.x,p.y-150,"格挡","#a6e4ed");this.emit("block");
      this.effects.push({kind:"block",x:p.x+p.facing*32,y:p.y-70,life:.18,maxLife:.18});
      return "blocked";
    }
    if(p.invulnerable>0)return "evaded";
    amount*=1-this.gearBonuses().armor;
    p.hp=Math.max(0,p.hp-amount);p.flash=.2;p.stun=.2;p.invulnerable=.46;
    this.guardRequested=false;this.buffered=null;this.turnIntent=null;this.releaseControlled();this.resetCombo();p.guard=false;p.guardSession=false;p.guardLeft=0;p.action=null;p.dashLeft=0;p.running=false;
    if(this.lInput)this.lInput.cancelled=true;
    p.x=clamp(p.x+sign(p.x-sourceX)*10,this.arena.left,this.arena.right);
    this.stats.taken+=amount;if(arrowId)p.embedded.push({id:arrowId,side:sign(sourceX-p.x),facing:p.facing,slot:p.embedded.length});
    this.float(p.x,p.y-p.z-175,"-"+Balance.round(amount),"#ff8080");this.emit("hurt",{damage:amount,kind});
    if(p.hp===0){p.dead=true;p.ogreLeft=0;this.status="lost";this.endedAt=this.time;this.emit("lost");this.clearInput();}
    return "hit";
  }
  tickPlayer(dt){
    const p=this.player;
    for(const key of ["invulnerable","stun","dashCooldown","mountCooldown","flash"])p[key]=Math.max(0,p[key]-dt);
    for(const key of ["U","I","O"])p.cooldowns[key]=Math.max(0,p.cooldowns[key]-dt);
    for(const slot of [1,2])p.medicineCooldowns[slot]=Math.max(0,p.medicineCooldowns[slot]-dt);
    const hasteTime=Math.min(dt,p.hasteLeft);
    p.hasteLeft=Math.max(0,p.hasteLeft-dt);
    this.tickOgre(dt);
    p.guardLeft=Math.max(0,p.guardLeft-dt);
    if(p.dead)return;
    if(this.lInput&&this.held.has("KeyL")&&this.time-this.lInput.since+1e-8>=CFG.runHoldThreshold)this.lInput.long=true;
    if(p.vz||p.z>0){
      p.vz-=1500*dt;p.z+=p.vz*dt;
      if(p.z<=0){p.z=0;p.vz=0;this.emit("land");}
    }
    if(p.action){
      this.steerAttack();
      const a=p.action;a.elapsed+=dt+(["melee","jump","counter","shoot"].includes(a.kind)?hasteTime*(MEDICINE.attackRate-1):0);
      if(!a.resolved&&a.elapsed>=a.activeAt){
        a.resolved=true;
        if(["rush","mountedRush","lift","bladeFlurry","bladeWave","fireShot","arrowRain"].includes(a.kind))this.resolveSkill(a);
        else if(a.kind==="shoot")this.playerShot(false,a);else if(a.kind==="pull")this.resolvePull();else if(a.kind!=="pickup")this.resolveMelee(a.kind);
      }
      this.tickSkill(a,dt);
      if(p.dead)return;
      if(a.elapsed>=a.duration){
        this.releaseControlled();
        p.action=null;
        if(a.kind==="melee"&&!a.charged&&!a.comboCancelled&&p.z===0){
          p.comboNext=a.combo<COMBOS[a.weapon].length?a.combo+1:1;p.comboUntil=this.time+CFG.comboWindow;
          if(a.comboQueued)this.beginAttack();
        }
        if(p.guardSession&&this.held.has("KeyK")&&p.z===0)p.guard=true;
      }
    }
    p.moving=false;p.running=false;
    if(!p.action&&p.stun<=0&&p.dashLeft<=0&&this.turnIntent)this.takeFacing();
    if(p.dashLeft>0){
      p.dashLeft=Math.max(0,p.dashLeft-dt);
      p.x+=p.dashVector.x*(p.mounted?940:680)*dt;p.y+=p.dashVector.y*350*dt;p.moving=true;
    }else if(p.stun<=0&&!(p.action&&["rush","mountedRush","lift","bladeFlurry","bladeWave","fireShot","arrowRain"].includes(p.action.kind))){
      let dx=this.horizontalAxis();
      let dy=Number(this.held.has("KeyS"))-Number(this.held.has("KeyW"));
      p.running=!!(this.held.has("KeyL")&&this.lInput&&this.lInput.long&&!p.guard&&!p.action&&p.z===0);
      if(p.running&&!dx&&!dy)dx=p.facing;
      const len=Math.hypot(dx,dy);
      if(len){
        dx/=len;dy/=len;
        const baseSpeed=p.mounted?(p.running?CFG.hero.mountedRunSpeed:CFG.hero.mountedSpeed):(p.running?CFG.hero.runSpeed:CFG.hero.speed);
        const speed=baseSpeed*(1+this.gearBonuses().speed)*(p.guard?.28:p.action?.22:1)*(dt>0?1+hasteTime/dt*(MEDICINE.moveRate-1):1);
        p.x+=dx*speed*dt;p.y+=dy*speed*.6*dt;
        if(dx&&!p.action){p.facing=sign(dx);this.turnIntent=null;}p.moving=true;
      }
    }
    p.x=clamp(p.x,this.arena.left,this.playerRight());p.y=clamp(p.y,this.arena.top,this.arena.bottom);
  }
  enemyMove(e,x,y,speed,dt){
    const dx=x-e.x,dy=y-e.y,mag=Math.hypot(dx,dy*1.4);
    if(mag>2){e.x+=dx/mag*speed*dt;e.y+=dy/mag*speed*dt;e.moving=true;if(Math.abs(dx)>1)e.facing=sign(dx);}
    e.x=clamp(e.x,this.arena.left,this.arena.right);e.y=clamp(e.y,this.arena.top,this.arena.bottom);
  }
  tickEnemy(e,dt){
    this.tickBurns(e);
    e.hardStun=Math.max(0,e.hardStunUntil-this.time);
    e.flash=Math.max(0,e.flash-dt);e.stun=Math.max(0,e.stun-dt);e.moving=false;
    if(e.controlled)return;
    if(this.isEnemyActive(e)&&e.knockdownLeft>0){
      e.knockdownLeft=Math.max(0,e.knockdownLeft-dt);
      if(e.knockdownLeft>0)e.state=e.knockdownLeft<=CFG.riseDuration?"rising":"knocked";
      else{e.state="recover";e.timer=.65;e.stun=0;this.emit("getup",{target:e.id});}
      return;
    }
    if(e.dead||this.player.dead||!this.aiEnabled||e.hardStun>0)return;
    if(this.scrolling&&!e.engaged){if(Math.abs(this.player.x-e.x)>STAGE.alertRange)return;e.engaged=true;}
    if(e.stun>0&&e.kind!=="cavalry")return;
    const p=this.player,dx=p.x-e.x,dy=p.y-e.y;
    e.timer-=dt;
    if(e.state==="recover"){
      if(e.timer<=0){e.state="approach";e.timer=.15;}
      return;
    }
    if(e.kind==="infantry"){
      if(e.state==="windup"){
        if(e.timer<=0){
          if(Math.abs(p.x-e.x)<92&&Math.abs(p.y-e.y)<38&&(p.x-e.x)*e.attackDirection>=-10&&p.z<36)
            this.damagePlayer(8,e.x,"melee");
          this.effects.push({kind:"enemySlash",x:e.x+e.attackDirection*35,y:e.y-65,facing:e.attackDirection,life:.2,maxLife:.2});
          this.emit("enemySwing",{x:e.x,y:e.y,weapon:"melee"});
          e.state="recover";e.timer=CFG.infantry.recovery;
        }return;
      }
      e.facing=sign(dx);
      if(Math.abs(dx)<72&&Math.abs(dy)<27&&e.timer<=0){e.state="windup";e.timer=CFG.infantry.windup;e.attackDirection=e.facing;}
      else this.enemyMove(e,p.x-e.facing*61,p.y,CFG.infantry.speed,dt);
    }else if(e.kind==="archer"){
      if(e.state==="aim"){
        if(e.timer<=0){this.enemyShot(e);e.state="recover";e.timer=CFG.archer.recovery;}return;
      }
      e.facing=sign(dx);
      if(e.ammo<=0){e.state="empty";this.enemyMove(e,e.x-sign(dx)*120,dy>0?e.y-25:e.y+25,60,dt);return;}
      if(Math.abs(dx)<220)this.enemyMove(e,e.x-sign(dx)*100,e.y,CFG.archer.speed,dt);
      else if(Math.abs(dy)>45||Math.abs(dx)>640)this.enemyMove(e,p.x-sign(dx)*340,p.y,CFG.archer.speed,dt);
      else if(e.timer<=0){e.state="aim";e.timer=CFG.archer.windup;e.attackDirection=e.facing;e.attackTarget={x:p.x,y:p.y,z:p.z};}
    }else if(e.kind==="cavalry"){
      if(e.state==="chargeWindup"){
        if(e.timer<=0){e.state="charge";e.timer=1.85;e.chargeHit=false;this.emit("charge",{x:e.x,y:e.y,target:e.id});}return;
      }
      if(e.state==="charge"){
        const oldX=e.x;e.x+=e.attackDirection*CFG.cavalry.chargeSpeed*dt;e.moving=true;
        const crosses=p.x>=Math.min(oldX,e.x)-65&&p.x<=Math.max(oldX,e.x)+65;
        if(!e.chargeHit&&crosses&&Math.abs(dy)<38&&p.z<48){
          e.chargeHit=true;this.damagePlayer(30,oldX,"charge");
        }
        if(e.timer<=0||e.x<this.arena.left+10||e.x>this.arena.right-10){e.x=clamp(e.x,this.arena.left+10,this.arena.right-10);e.state="recover";e.timer=CFG.cavalry.recovery;}
        return;
      }
      e.facing=sign(dx);
      if(Math.abs(dy)>18)this.enemyMove(e,e.x,p.y,95,dt);
      else if(Math.abs(dx)<235)this.enemyMove(e,e.x-sign(dx)*130,e.y,105,dt);
      else if(e.timer<=0){e.state="chargeWindup";e.timer=CFG.cavalry.windup;e.attackDirection=e.facing;e.chargeHit=false;}
    }
  }
  tickArrows(dt){
    for(const a of this.projectiles){
      if(a.dead)continue;
      const old={x:a.x,y:a.y,z:a.z};
      a.x+=a.vx*dt;a.y+=a.vy*dt;a.z+=a.vz*dt;a.life-=dt;
      const candidates=a.owner==="hero"?this.enemies.filter(e=>!e.dead):[this.player].filter(p=>!p.dead);
      candidates.sort((l,r)=>Math.abs(l.x-old.x)-Math.abs(r.x-old.x));
      for(const target of candidates){
        if(a.hitIds&&a.hitIds.has(target.id))continue;
        const radius=target.kind==="cavalry"?45:22;
        const low=Math.min(old.x,a.x)-radius,high=Math.max(old.x,a.x)+radius;
        if(target.x<low||target.x>high)continue;
        const t=clamp((target.x-old.x)/(a.x-old.x||1),0,1);
        const y=old.y+(a.y-old.y)*t,z=old.z+(a.z-old.z)*t;
        const bottom=target.z+12,top=target.z+(target.knockdownLeft>CFG.riseDuration?45:target.kind==="cavalry"?165:138)+(target.mounted?28:0);
        if(Math.abs(y-target.y)>27||z<bottom||z>top)continue;
        if(a.owner==="hero"){
          this.damageEnemy(target,a.damage,"arrow",a.piercing?null:a.id,
            {x:clamp(a.x,target.x-radius,target.x+radius),y:y-z,direction:sign(a.vx)},a);
          a.hitIds.add(target.id);a.lastTarget=target;
        }
        else this.damagePlayer(a.damage,target.x-sign(a.vx)*80,"arrow",a.id);
        if(!a.piercing){a.dead=true;break;}
      }
      if(a.life<=0||a.x<-50||a.x>this.width+50||a.y<400||a.y>700||a.z<0)a.dead=true;
      if(a.dead&&a.piercing&&a.lastTarget)a.lastTarget.embedded.push(a.id);
    }
    this.projectiles=this.projectiles.filter(a=>!a.dead);
  }
  step(dt){
    if(this.paused)return;
    dt=clamp(dt,0,.05);this.time+=dt;
    for(const e of this.enemies)this.tickToughness(e);
    const presses=this.presses.splice(0);for(const code of presses)this.handlePress(code);
    this.tickPlayer(dt);this.flushInput();
    for(const e of this.enemies)this.tickEnemy(e,dt);
    this.tickArrows(dt);
    for(const effect of this.effects){effect.life-=dt;if(effect.kind==="text")effect.y-=24*dt;}
    this.effects=this.effects.filter(f=>f.life>0);
    if(this.status==="playing"&&this.startedWithEnemies&&this.enemies.every(e=>e.dead)){
      if(this.clearedAt===null){this.clearedAt=this.time;this.player.ogreLeft=0;this.projectiles=this.projectiles.filter(a=>a.owner==='hero');if(this.scrolling)this.message('沿途敌兵已清 · 继续向右抵达出口',5);}
      if(this.scrolling&&this.player.x<this.exitX-40)return;
      this.pickupEquipment(true);this.buffered=null;this.status="won";this.endedAt=this.time;this.player.ogreLeft=0;this.projectiles=this.projectiles.filter(a=>a.owner==="hero");
      this.message(this.scrolling?"已突破封锁，抵达出口！可回头拾箭 · R 随机再战":"本轮全清！仍可按 N 回收箭矢 · R 随机再战",10);this.emit("won");
    }
  }
  snapshot(){
    return {width:this.width,scrolling:this.scrolling,exitX:this.exitX,clearedAt:this.clearedAt,scene:this.scene,status:this.status,paused:this.paused,time:this.time,
      player:{hp:this.player.hp,maxHp:this.player.maxHp,basicDamage:this.basicDamage(),ammo:this.player.ammo,x:this.player.x,y:this.player.y,z:this.player.z,
        facing:this.player.facing,attackFacing:this.player.action?.facing||null,weapon:this.player.weapon,mounted:this.player.mounted,running:this.player.running,dashing:this.player.dashLeft>0,guard:this.player.guard,guardLeft:this.player.guardLeft,
        action:this.player.action?this.player.action.kind:null,combo:this.player.action?this.player.action.combo:null,
        reach:this.player.action?this.player.action.reach:this.attackReach(),embedded:this.player.embedded.length,
        charged:!!(this.player.action&&this.player.action.charged),medicineCooldowns:{...this.player.medicineCooldowns},hasteLeft:this.player.hasteLeft,cooldowns:{...this.player.cooldowns},ogreLeft:this.player.ogreLeft},
      enemies:this.enemies.map(e=>({id:e.id,kind:e.kind,hp:e.hp,ammo:e.ammo,x:e.x,y:e.y,state:e.state,dead:e.dead,z:e.z,burns:e.burns.length,toughness:e.toughness,toughnessMax:e.toughnessMax,brokenUntil:e.brokenUntil,hardStun:e.hardStun,knockdownLeft:e.knockdownLeft,embedded:e.embedded.length})),
      gear:JSON.parse(JSON.stringify(this.gear)),loot:this.loot.length,projectiles:this.projectiles.length,stats:{...this.stats}};
  }
}
return {World,CFG,MEDICINE,STAGE,SKILLS,COMBOS,SCENES,LABEL,clamp,distance};
});

