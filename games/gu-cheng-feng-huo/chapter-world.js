(function(root,factory){const api=typeof module==='object'&&module.exports?factory(require('./engine.js'),require('./chapter-data.js'),require('./yin-boss.js')):factory(root.BattleCore,root.ChapterData,root.YinBoss);if(typeof module==='object'&&module.exports)module.exports=api;else root.ChapterCore=api;})(globalThis,function(Core,Data,Yin){'use strict';
const {CFG,clamp,distance}=Core,sign=x=>x<0?-1:1;
const EquipmentRestore=(typeof module==='object'&&module.exports?require('./equipment.js'):globalThis.EquipmentCore).restore;
class ChapterWorld extends Core.World{
 constructor(options={}){
  const plan=Data.getChapter(options.chapter||1),mode=Data.difficulty(options.difficulty||options.carry?.difficulty);
  super({...options,spawn:false,scene:plan.scene,scrolling:true,width:plan.width});
  this.plan=plan;this.chapter=plan.id;this.difficulty=mode.id;this.escortCapacity=mode.riders;this.campaignFlags={fingerLost:false,horsesGifted:0,reinforcements:0,returned:false,finished:false};this.armyStrength=0;this.supportJoined=false;this.wound=null;this.startX=plan.startX;this.exitX=plan.exitX;this.player.x=this.startX;this.player.mounted=true;
  this.allies=[];this.wave=-1;this.waveCleared=-1;this.chapterClock=0;this.partyDamage=0;this.rallied=false;this.batchNumber=0;this.nextBatchAt=null;this.finalPhase="blockade";this.finaleTriggered=false;
  for(let i=0;i<mode.riders;i++){
   const a=super.spawn('cavalry',this.startX-170-(i%6)*105,480+Math.floor(i/6)*34);this.enemies.pop();
   Object.assign(a,{id:'ally'+(i+1),team:'ally',role:'escort',formation:i,engaged:true,facing:1,timer:.3+(i%6)*.17,damage:15,hp:100,maxHp:100,deployed:false,targetId:null});this.allies.push(a);
  }
  plan.formations.forEach((zone,group)=>{
   let column=0;
   for(const kind of ['infantry','archer','cavalry'])for(let i=0;i<zone[kind];i++){
    const e=super.spawn(kind,zone.x+(column%5)*62+(kind==='archer'?220:0),480+Math.floor(column/5)*40);
    Object.assign(e,{group,team:'enemy',deployed:false,engaged:false,damage:CFG[kind].damage,timer:.3+(column%5)*.21});column++;
   }
  });
  const boss=super.spawn('cavalry',plan.boss.x,560);Object.assign(boss,{boss:true,name:plan.boss.name,group:plan.formations.length-1,team:'enemy',deployed:false,engaged:false,hp:plan.boss.hp,maxHp:plan.boss.hp,damage:plan.boss.damage,timer:1.1});this.boss=boss;
  if(this.chapter===6){const yin=super.spawn('cavalry',plan.boss.x+360,560);Object.assign(yin,{boss:true,trueBoss:true,name:'尹子奇',group:plan.formations.length-1,team:'enemy',deployed:false,engaged:false,hp:plan.boss.hp*10,maxHp:plan.boss.hp*10,damage:35,state:'yinEntrance',timer:2.4,moveIndex:0});this.trueBoss=yin;}
  for(const e of this.enemies)if(e.boss)this.initToughness(e);
  this.total=this.enemies.length;this.startedWithEnemies=true;
  this.restoreCarry(options.carry);if(this.chapter>=5&&this.campaignFlags.reinforcements)this.joinSupport();this.deployAlliedPair();this.message(plan.opening,5);this.events=[];
  if(options.carry?.duelPractice){for(const e of this.enemies)if(!e.trueBoss){e.dead=true;e.hp=0;e.deployed=false;}this.wave=plan.formations.length-1;this.waveCleared=this.wave-1;this.player.x=plan.formations.at(-1).trigger+180;this.startX=this.player.x;this.player.mounted=false;this.combatAllies.forEach((a,i)=>{a.x=this.player.x-180-(i%3)*90;a.y=480+Math.floor(i/3)*52;});this.deployYin();}
 }
 get livingAllies(){return this.allies.filter(a=>!a.dead);}
 get combatAllies(){return this.livingAllies.filter(a=>a.deployed);}
 get reserveRiders(){return this.livingAllies.filter(a=>a.kind==='cavalry'&&!a.deployed);}
 get escortSurvivors(){return this.livingAllies.filter(a=>a.role!=='support');}
 get supportSurvivors(){return this.livingAllies.filter(a=>a.role==='support');}
 get activeEnemies(){return this.enemies.filter(e=>e.deployed&&!e.dead);}
 get wavePending(){return this.enemies.filter(e=>e.group===this.wave&&!e.dead&&!e.trueBoss);}
 get gateX(){const plan=this.plan;return this.wave<0?plan.formations[0].trigger+180:this.wave<plan.formations.length?plan.formations[this.wave].x+800:this.arena.right;}
 playerRight(){return this.activeEnemies.length||this.wavePending.length?Math.min(this.arena.right,this.gateX):this.arena.right;}
 activateWave(index){
  const plan=this.plan;
  if(index<0||index>=plan.formations.length||index<=this.wave||this.status!=='playing')return false;
  this.wave=index;this.batchNumber=0;this.nextBatchAt=null;this.deployEnemyBatch();
  this.emit('wave',{wave:index,boss:index===plan.formations.length-1});return true;
 }
 deployAlliedPair(){
  // A surviving member holds the current pair's place; never top up one loss.
  if(this.combatAllies.some(a=>a.kind==='cavalry'))return false;
  const pair=this.reserveRiders.slice(0,2);
  pair.forEach((a,i)=>{a.deployed=true;a.engaged=true;a.formation=i;a.x=clamp(this.player.x-this.player.facing*(160+i*105),this.arena.left,this.arena.right);a.y=500+i*96;a.state='approach';a.timer=.6+i*.25;});
  if(pair.length)this.emit('allyBatch',{count:pair.length,reserve:this.reserveRiders.length});return pair.length>0;
 }
 deployEnemyBatch(){
  if(this.status!=='playing'||this.activeEnemies.length)return false;
  const pending=this.wavePending.filter(e=>!e.deployed&&!e.boss),batch=[];
  // Mix infantry, archers and cavalry; at most six enemies and two riders.
  for(let round=0;round<6&&batch.length<6;round++)for(const kind of ['infantry','archer','cavalry']){
   if(batch.length>=6)break;if(kind==='cavalry'&&batch.filter(e=>e.kind===kind).length>=2)continue;
   const e=pending.find(e=>e.kind===kind&&!batch.includes(e));if(e)batch.push(e);
  }
  if(!batch.length&&!this.boss.dead&&!this.boss.deployed&&this.boss.group===this.wave)batch.push(this.boss);
  if(!batch.length)return false;
  const z=this.plan.formations[this.wave];this.batchNumber++;this.nextBatchAt=null;
  batch.forEach((e,i)=>{e.deployed=true;e.engaged=true;e.x=clamp(Math.max(z.x,this.player.x+430)+(i%3)*95+(e.kind==='archer'?110:0),z.trigger,Math.min(this.arena.right,z.x+690));e.y=480+Math.floor(i/3)*102+(i%3)*18;e.timer=.65+i*.13;});
  this.message(batch[0].boss?this.boss.name+'现身 · 冲锋150，留意地面预警':z.name+' · 第'+this.batchNumber+'批 / '+batch.length+'名敌兵',3);
  this.emit('enemyBatch',{wave:this.wave,batch:this.batchNumber,count:batch.length});return true;
 }
 deployYin(){
  const e=this.trueBoss;if(!e||e.deployed||!this.boss.dead||this.status!=='playing')return false;
  e.deployed=true;e.engaged=true;e.x=clamp(this.player.x+350,this.plan.formations.at(-1).trigger,this.arena.right-110);e.y=560;e.facing=-1;e.state='yinEntrance';e.timer=2.4;
  this.finalPhase='duel';this.nextBatchAt=null;this.player.ogreLeft=0;
  this.message('尹子奇亲临 · 生命10000 · 将其打至10%进入终章',4.2);this.emit('yinEntrance',{x:e.x,y:e.y});return true;
 }
 finishYinDuel(){
  if(this.finaleTriggered||this.player.dead)return false;
  this.dropEquipment(this.trueBoss);this.pickupEquipment(true);this.finaleTriggered=true;this.finalPhase='fall';this.trueBoss.hp=this.trueBoss.maxHp*.1;
  this.releaseControlled();this.clearInput();this.player.action=null;this.player.ogreLeft=0;this.player.dashLeft=0;
  this.trueBoss.burns=[];this.trueBoss.state='recover';this.projectiles=[];
  this.status='won';this.endedAt=this.time;this.emit('yinRepelled');this.emit('won');return true;
 }
 chooseTarget(e){
  const candidates=e.team==='ally'?this.activeEnemies:[this.player,...this.combatAllies].filter(t=>!t.dead);
  let target=null,best=Infinity;
  for(const t of candidates){if(e.team==='ally'&&Math.abs(t.x-this.player.x)>1100)continue;const score=distance(e,t)+(t.id===e.targetId?-55:0);if(score<best){target=t;best=score;}}
  e.targetId=target?.id||null;return target;
 }
 damageAlly(a,amount,kind,arrowId,sourceX){
  if(a.dead)return 'dead';if(!a.deployed||this.status!=='playing')return 'inactive';const damage=amount*(kind==='arrow'?(CFG[a.kind].arrowMultiplier||1):1);
  a.hp=Math.max(0,a.hp-damage);a.flash=.15;a.stun=.05;
  if(arrowId)a.embedded.push(arrowId);
  this.effects.push({kind:kind==='arrow'?'blood':'impact',attack:kind,x:a.x,y:a.y-100,direction:sign(a.x-sourceX),life:.3,maxLife:.3,seed:++this.fxSequence});
  this.float(a.x,a.y-150,'−'+damage,'#95cce6');this.emit('allyHurt',{target:a.id,x:a.x,y:a.y,damage});
  if(a.hp===0){a.dead=true;a.state='dead';a.deathTime=this.time;a.moving=false;this.emit('allyFallen',{target:a.id});}
  return 'hit';
 }
 strike(e,t,amount,kind,arrowId){
  if(!t||t.dead||this.status!=='playing'||e.team==='ally'&&!e.deployed)return;
  if(e.team==='ally')return this.damageEnemy(t,amount,kind,arrowId,null,{power:1,burn:false,weapon:'spear',ally:true,source:e.id});
  return t.id==='hero'?this.damagePlayer(amount,e.x,kind,arrowId):this.damageAlly(t,amount,kind,arrowId,e.x);
 }
 damageEnemy(e,amount,kind,arrowId,contact,mods=this.offense()){
  if(!e.deployed||this.status!=='playing'||e.dead)return 0;
  if(e.trueBoss){if(e.state==='yinEntrance')return 0;const multiplier=this.damageMultiplier(e,kind,mods);amount=Math.min(amount,Math.max(0,e.hp-e.maxHp*.1)/multiplier);}
  const before=this.events.length,damage=super.damageEnemy(e,amount,kind,arrowId,contact,mods);
  if(mods.ally){this.stats.dealt-=damage;this.partyDamage+=damage;for(let i=before;i<this.events.length;i++)this.events[i].actor='ally';}
  if(e.trueBoss&&e.hp<=e.maxHp*.1+1e-7)this.finishYinDuel();
  return damage;
 }
 damagePlayer(...args){return this.status==='playing'?super.damagePlayer(...args):'inactive';}
 isEnemyActive(e){return this.status==='playing'&&super.isEnemyActive(e)&&!(e.trueBoss&&e.state==='yinEntrance');}
 tickEnemy(e,dt){if(!e.deployed||this.status!=='playing')return;if(e.trueBoss)Yin.tick(this,e,dt);else this.tickCombatant(e,dt);}
 tickCombatant(e,dt){
  if(e.team!=='ally')this.tickBurns(e);
  e.hardStun=Math.max(0,e.hardStunUntil-this.time);e.flash=Math.max(0,e.flash-dt);e.stun=Math.max(0,e.stun-dt);e.moving=false;
  if(e.controlled)return;
  if(!e.dead&&e.knockdownLeft>0){e.knockdownLeft=Math.max(0,e.knockdownLeft-dt);if(e.knockdownLeft>0)e.state=e.knockdownLeft<=CFG.riseDuration?'rising':'knocked';else{e.state='recover';e.timer=.65;}return;}
  if(e.dead||this.player.dead||!this.aiEnabled||e.hardStun>0)return;
  if(e.stun>0&&e.kind!=='cavalry')return;
  const p=this.chooseTarget(e);e.timer-=dt;
  if(!p||this.status!=='playing'){
   if(e.team==='ally')this.followFormation(e,dt);return;
  }
  if(e.state==='recover'){if(e.timer<=0){e.state='approach';e.timer=.15;}return;}
  const dx=p.x-e.x,dy=p.y-e.y;
  if(e.kind==='infantry'){
   if(e.state==='windup'){
    if(e.timer<=0){const locked=this.actor(e.attackTargetId);if(locked&&!locked.dead&&Math.abs(locked.x-e.x)<92&&Math.abs(locked.y-e.y)<38&&(locked.x-e.x)*e.attackDirection>=-10&&locked.z<36)this.strike(e,locked,e.damage,'melee');
     this.effects.push({kind:'enemySlash',x:e.x+e.attackDirection*35,y:e.y-65,facing:e.attackDirection,life:.2,maxLife:.2});this.emit('enemySwing',{x:e.x,y:e.y,weapon:'melee'});e.state='recover';e.timer=CFG.infantry.recovery;}return;
   }
   e.facing=sign(dx);if(Math.abs(dx)<72&&Math.abs(dy)<27&&e.timer<=0){e.state='windup';e.timer=CFG.infantry.windup;e.attackDirection=e.facing;e.attackTargetId=p.id;}else this.enemyMove(e,p.x-e.facing*61,p.y,CFG.infantry.speed,dt);
  }else if(e.kind==='archer'){
   if(e.state==='aim'){if(e.timer<=0){this.enemyShot(e);e.state='recover';e.timer=CFG.archer.recovery;}return;}
   e.facing=sign(dx);if(e.ammo<=0){e.state='empty';this.enemyMove(e,e.x-sign(dx)*120,e.y+sign(dy)*-25,60,dt);return;}
   if(Math.abs(dx)<220)this.enemyMove(e,e.x-sign(dx)*100,e.y,CFG.archer.speed,dt);
   else if(Math.abs(dy)>45||Math.abs(dx)>640)this.enemyMove(e,p.x-sign(dx)*340,p.y,CFG.archer.speed,dt);
   else if(e.timer<=0){e.state='aim';e.timer=CFG.archer.windup;e.attackDirection=e.facing;e.attackTarget={x:p.x,y:p.y,z:p.z};}
  }else{
   if(e.state==='chargeWindup'){if(e.timer<=0){e.state='charge';e.timer=1.85;e.chargeHit=false;this.emit('charge',{x:e.x,y:e.y,target:e.id,actor:e.team});}return;}
   if(e.state==='charge'){
    const oldX=e.x;e.x+=e.attackDirection*CFG.cavalry.chargeSpeed*dt;e.moving=true;
    const targets=e.team==='ally'?this.activeEnemies:[this.player,...this.combatAllies];
    const crossed=targets.filter(t=>!t.dead&&t.x>=Math.min(oldX,e.x)-65&&t.x<=Math.max(oldX,e.x)+65&&Math.abs(t.y-e.y)<38&&t.z<48).sort((a,b)=>Math.abs(a.x-oldX)-Math.abs(b.x-oldX));
    if(!e.chargeHit&&crossed.length){e.chargeHit=true;this.strike(e,crossed[0],e.damage,'charge');}
    if(e.timer<=0||e.x<this.arena.left+10||e.x>this.arena.right-10){e.x=clamp(e.x,this.arena.left+10,this.arena.right-10);e.state='recover';e.timer=CFG.cavalry.recovery;}
    return;
   }
   e.facing=sign(dx);
   if(Math.abs(dy)>18)this.enemyMove(e,e.x,p.y,95,dt);
   else if(Math.abs(dx)<235)this.enemyMove(e,e.x-sign(dx)*130,e.y,105,dt);
   else if(e.timer<=0){e.state='chargeWindup';e.timer=CFG.cavalry.windup;e.attackDirection=e.facing;e.chargeHit=false;}
  }
 }
 actor(id){return id==='hero'?this.player:this.allies.find(a=>a.id===id)||this.enemies.find(e=>e.id===id);}
 enemyMove(e,x,y,speed,dt){
  const plan=this.plan;
  super.enemyMove(e,x,y,speed,dt);
  // Retreating archers must stay reachable on their side of a locked line.
  if(e.team==='enemy'&&e.deployed)e.x=clamp(e.x,Math.max(this.arena.left,plan.formations[e.group].trigger-900),Math.min(this.arena.right,plan.formations[e.group].x+690));
 }
 followFormation(a,dt){
  if(a.state!=='approach'){a.state='approach';a.timer=.25;}
  const facing=this.player.facing,rank=a.formation%7,row=Math.floor(a.formation/7)%6;
  const x=clamp(this.player.x-facing*(155+rank*105),this.arena.left,this.arena.right),y=480+row*34;
  const gap=Math.abs(a.x-x);this.enemyMove(a,x,y,a.kind==='infantry'?(gap>180?220:CFG.infantry.speed):(gap>180?CFG.hero.mountedRunSpeed:CFG.cavalry.speed),dt);a.facing=a.moving?a.facing:facing;
 }
 tickArrows(dt){
  if(this.status!=='playing')return;
  for(const a of this.projectiles){
   if(this.status!=='playing')break;if(a.dead)continue;const old={x:a.x,y:a.y,z:a.z};a.x+=a.vx*dt;a.y+=a.vy*dt;a.z+=a.vz*dt;a.life-=dt;
   const targets=a.owner==='hero'?this.activeEnemies:[this.player,...this.combatAllies].filter(t=>!t.dead);
   targets.sort((l,r)=>Math.abs(l.x-old.x)-Math.abs(r.x-old.x));
   for(const t of targets){
    if(a.hitIds?.has(t.id))continue;const radius=t.kind==='cavalry'?45:22;
    if(t.x<Math.min(old.x,a.x)-radius||t.x>Math.max(old.x,a.x)+radius)continue;
    const progress=clamp((t.x-old.x)/(a.x-old.x||1),0,1),y=old.y+(a.y-old.y)*progress,z=old.z+(a.z-old.z)*progress;
    const top=t.z+(t.knockdownLeft>CFG.riseDuration?45:t.kind==='cavalry'?165:138)+(t.mounted?28:0);
    if(Math.abs(y-t.y)>27||z<t.z+12||z>top)continue;
    if(a.owner==='hero'){this.damageEnemy(t,a.damage,'arrow',a.piercing?null:a.id,{x:clamp(a.x,t.x-radius,t.x+radius),y:y-z,direction:sign(a.vx)},a);a.hitIds.add(t.id);a.lastTarget=t;}
    else if(t.id==='hero')this.damagePlayer(a.damage,t.x-sign(a.vx)*80,'arrow',a.id);
    else this.damageAlly(t,a.damage,'arrow',a.id,t.x-sign(a.vx)*80);
    if(!a.piercing){a.dead=true;break;}
   }
   if(a.life<=0||a.x<-50||a.x>this.width+50||a.y<400||a.y>700||a.z<0)a.dead=true;
   if(a.dead&&a.piercing&&a.lastTarget)a.lastTarget.embedded.push(a.id);
  }this.projectiles=this.projectiles.filter(a=>!a.dead);
 }
 nearbyCorpse(){
  const p=this.player;return [...this.enemies,...this.allies].filter(e=>e.dead&&e.embedded.length&&distance(p,e)<=CFG.pickupRadius).sort((a,b)=>distance(p,a)-distance(p,b))[0]||null;
 }
 step(dt){
  const plan=this.plan;
  if(this.paused||this.status!=='playing')return;
  if(this.wave<0&&this.player.x>=plan.formations[0].trigger)this.activateWave(0);
  if(this.wave>=0&&this.activeEnemies.length===0&&this.wavePending.length){if(this.nextBatchAt===null)this.nextBatchAt=this.time+1.25;if(this.time>=this.nextBatchAt)this.deployEnemyBatch();}
  if(this.wave>=0&&this.activeEnemies.length===0&&this.wavePending.length===0&&this.waveCleared<this.wave){this.waveCleared=this.wave;if(this.chapter===5&&this.campaignFlags.reinforcements)this.armyStrength=Math.max(1000,3000-400*(this.waveCleared+1));this.message(plan.formations[this.wave].name+'已破 · 集结继续向右',3);}
  if(this.waveCleared===this.wave&&this.wave<plan.formations.length-1&&this.player.x>=plan.formations[this.wave+1].trigger)this.activateWave(this.wave+1);
  this.tickWound(Math.min(.05,Math.max(0,dt)));
  if(this.player.dead)return;
  super.step(dt);
  if(this.status!=='playing')return;
  if(this.chapter===6&&this.boss.dead&&!this.trueBoss.deployed)this.deployYin();
  this.deployAlliedPair();
  for(const ally of this.combatAllies){if(this.status!=='playing')break;this.tickCombatant(ally,Math.min(.05,Math.max(0,dt)));}
  // Keep the player at the current defensive line until it has been broken.
  if(this.activeEnemies.length||this.wavePending.length)this.player.x=Math.min(this.player.x,this.gateX);
  if(this.wave===plan.formations.length-1&&this.enemies.every(e=>e.dead)&&!this.rallied){this.rallied=true;this.player.ogreLeft=0;this.message(plan.boss.name+'已败 · 向右抵达'+plan.destination+'！',5);}
 }

 restoreCarry(carry){
  if(!carry||typeof carry!=='object')return;
  const p=this.player,c=carry.player||{};
  const number=(v,fallback,min,max)=>Number.isFinite(v)?clamp(v,min,max):fallback;
  for(const slot of [1,2])p.medicineCooldowns[slot]=number(c.medicineCooldowns?.[slot],0,0,20);p.hasteLeft=number(c.hasteLeft,0,0,8);
  this.gear=EquipmentRestore(carry.gear);this.refreshGear();
  p.hp=number(c.hp,100,0,p.maxHp);p.ammo=number(c.ammo,15,0,15)|0;
  if(['melee','spear','bow'].includes(c.weapon))p.weapon=c.weapon;
  if(['melee','spear'].includes(c.lastMelee))p.lastMelee=c.lastMelee;
  if(typeof c.mounted==='boolean')p.mounted=c.mounted;
  p.embedded=Array.isArray(c.embedded)?c.embedded.map((e,i)=>({...e,id:'carried-arrow-'+i})):[];
  if(Array.isArray(carry.allies)){
   const source=carry.allies.filter(a=>a&&Number.isFinite(a.hp)&&a.hp>0);
   const roster=[...source.filter(a=>a.role!=='support').slice(0,this.escortCapacity),...source.filter(a=>a.role==='support').slice(0,12)];
   this.allies=[];let deployedRiders=0;roster.forEach((a,i)=>{const kind=a.kind==='infantry'?'infantry':'cavalry',hp=kind==='cavalry'&&!(carry.combatVersion>=5)?a.hp*.5:a.hp;const actor=this.addFriendly(kind,a.role==='support'?'support':'escort',number(hp,100,1,kind==='infantry'?80:100),a.embedded,i);if(kind==='cavalry'&&(carry.combatVersion>=5)&&a.deployed===true&&deployedRiders<2){actor.deployed=true;actor.formation=deployedRiders++;actor.x=p.x-160-actor.formation*105;actor.y=500+actor.formation*96;}});
  }
  this.campaignFlags={fingerLost:!!carry.fingerLost,horsesGifted:carry.horsesGifted>0?Data.difficulty(this.difficulty).horses:0,reinforcements:carry.reinforcements===3000?3000:0,returned:!!carry.returned,finished:!!carry.finished};this.armyStrength=number(carry.armyStrength,this.campaignFlags.reinforcements,0,3000);this.supportJoined=!!carry.supportJoined;
  if(carry.wound&&this.campaignFlags.fingerLost){const elapsed=number(carry.wound.elapsed,0,0,180);this.wound={elapsed,ticks:Math.min(18,Math.floor((elapsed+1e-7)/10)),duration:180};}
  if(p.hp===0){p.dead=true;this.status='lost';}
 }
 exportCarry(){return {combatVersion:6,gear:JSON.parse(JSON.stringify(this.gear)),difficulty:this.difficulty,armyStrength:this.armyStrength,supportJoined:this.supportJoined,reinforcements:this.campaignFlags.reinforcements,returned:this.campaignFlags.returned,finished:this.campaignFlags.finished,player:{medicineCooldowns:{...this.player.medicineCooldowns},hasteLeft:this.player.hasteLeft,hp:this.player.hp,ammo:this.player.ammo,weapon:this.player.weapon,lastMelee:this.player.lastMelee,mounted:this.player.mounted,embedded:this.player.embedded.map(e=>({...e}))},allies:this.livingAllies.map(a=>({hp:a.hp,maxHp:a.maxHp,deployed:a.deployed,kind:a.kind,role:a.role||'escort',embedded:a.embedded.slice()})),fingerLost:this.campaignFlags.fingerLost,wound:this.wound?{...this.wound}:null,horsesGifted:this.campaignFlags.horsesGifted};}
 storyDamage(amount,label){
  const p=this.player;if(p.dead)return;
  const dealt=Math.min(amount,p.hp);p.hp=Math.max(0,p.hp-amount);p.flash=.18;this.stats.taken+=dealt;
  this.float(p.x,p.y-p.z-175,label+' −'+amount,'#e79886');this.emit('wound',{damage:dealt});
  if(p.hp===0){p.dead=true;p.ogreLeft=0;this.status='lost';this.endedAt=this.time;this.releaseControlled();p.action=null;this.emit('lost');this.clearInput();}
 }
 applyFingerInjury(){
  if(this.campaignFlags.fingerLost)return false;
  this.campaignFlags.fingerLost=true;this.wound={elapsed:0,ticks:0,duration:180};this.storyDamage(20,'断指');return true;
 }
 tickWound(dt){
  const w=this.wound;if(!w||this.player.dead||w.elapsed>=180||this.paused||this.status!=='playing')return;
  w.elapsed=Math.min(180,w.elapsed+Math.max(0,dt));
  while(w.ticks<18&&(w.ticks+1)*10<=w.elapsed+1e-7){w.ticks++;this.storyDamage(2,'伤势');if(this.player.dead)break;}
 }
 grantHorses(){if(this.campaignFlags.horsesGifted>0)return false;this.campaignFlags.horsesGifted=Data.difficulty(this.difficulty).horses;this.message('获赠战马 '+this.campaignFlags.horsesGifted+' 匹 · 已记入行军补给',5);return true;}
 addFriendly(kind,role,hp,embedded,index=this.allies.length){
  const a=super.spawn(kind,this.player.x-160-(index%7)*88,480+(Math.floor(index/7)%6)*30);this.enemies.pop();
  Object.assign(a,{id:'ally'+(index+1),team:'ally',role,formation:index,engaged:true,facing:1,timer:.3+(index%6)*.17,damage:kind==='cavalry'?15:CFG[kind].damage,deployed:kind!=='cavalry',targetId:null,maxHp:kind==='cavalry'?100:CFG[kind].hp,hp:hp??(kind==='cavalry'?100:CFG[kind].hp),embedded:Array.isArray(embedded)?embedded.slice():[]});this.allies.push(a);return a;
 }
 grantReinforcements(){if(this.campaignFlags.reinforcements)return false;this.campaignFlags.reinforcements=3000;this.armyStrength=3000;return true;}
 joinSupport(){if(this.supportJoined)return false;this.supportJoined=true;for(let i=0;i<12;i++)this.addFriendly(i<6?'infantry':'cavalry','support');return true;}
 returnToCity(){if(this.campaignFlags.returned)return false;this.campaignFlags.returned=true;this.armyStrength=1000;return true;}
 finishCampaign(){if(this.campaignFlags.finished)return false;this.campaignFlags.finished=true;return true;}


 snapshot(){return {...super.snapshot(),chapter:this.chapter,difficulty:this.difficulty,armyStrength:this.armyStrength,escortCapacity:this.escortCapacity,wound:this.wound?{...this.wound}:null,campaignFlags:{...this.campaignFlags},wave:this.wave,waveCleared:this.waveCleared,partyDamage:this.partyDamage,activeRiders:this.combatAllies.filter(a=>a.kind==='cavalry').length,reserveRiders:this.reserveRiders.length,batchNumber:this.batchNumber,finalPhase:this.finalPhase,trueBossHp:this.trueBoss?.hp,finaleTriggered:this.finaleTriggered,bossHp:this.boss.hp,allies:this.allies.map(a=>({id:a.id,deployed:a.deployed,hp:a.hp,maxHp:a.maxHp,damage:a.damage,x:a.x,y:a.y,state:a.state,dead:a.dead,embedded:a.embedded.length}))};}
}
return {ChapterWorld,plan:Data.chapter};
});
