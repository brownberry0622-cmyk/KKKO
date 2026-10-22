(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.YinBoss=api;})(globalThis,function(){'use strict';
const MOVES=Object.freeze([
 {id:'cleave',name:'断岳重劈',windup:.95,active:.24,recovery:1.15,damage:30*(7/6),multiplier:7/6,reach:270,lane:52,hits:[.10]},
 {id:'charge',name:'破阵疾冲',windup:1.15,active:.9,recovery:1.65,damage:30*(1.5),multiplier:1.5,reach:630,lane:40,hits:[]},
 {id:'sweep',name:'回身横扫',windup:1.1,active:.3,recovery:1.4,damage:30*(1),multiplier:1,reach:240,lane:95,hits:[.16]},
 {id:'triple',name:'连环三槊',windup:1.0,active:1.4,recovery:1.5,damage:30*(.5),multiplier:.5,reach:330,lane:50,hits:[.10,.68,1.26]},
 {id:'slam',name:'踏地震击',windup:1.4,active:.4,recovery:1.8,damage:30*(4/3),multiplier:4/3,reach:235,lane:100,hits:[.32]}
].map(Object.freeze));
const sign=x=>x<0?-1:1,clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
function begin(w,e,move){
 const target=w.chooseTarget(e);if(!target)return false;
 e.move=move;e.state='yinWindup';e.timer=move.windup;e.attackDirection=sign(target.x-e.x);e.facing=e.attackDirection;
 e.attackOrigin={x:e.x,y:e.y};e.aim={x:clamp(target.x,e.x-500,e.x+500),y:target.y};e.hitIds=new Set();e.hitIndex=0;e.activeAge=0;
 w.emit('yinWindup',{target:e.id,move:move.id,x:e.x,y:e.y});return true;
}
function impact(w,e,oldX){
 const m=e.move,targets=[w.player,...w.combatAllies].filter(t=>!t.dead);
 for(const t of targets){
  const dx=(t.x-e.x)*e.attackDirection,dy=t.y-e.y;
  let inside=m.id==='sweep'?Math.hypot((t.x-e.x)/m.reach,dy/m.lane)<=1:
   m.id==='slam'?Math.hypot((t.x-e.aim.x)/m.reach,(t.y-e.aim.y)/m.lane)<=1:
   m.id==='charge'?t.x>=Math.min(oldX,e.x)-60&&t.x<=Math.max(oldX,e.x)+60&&Math.abs(dy)<=m.lane:
   dx>=-12&&dx<=m.reach&&Math.abs(dy)<=m.lane;
  if(inside&&t.z<55&&!e.hitIds.has(t.id)){e.hitIds.add(t.id);w.strike(e,t,(e.basicAttack||30)*m.multiplier,m.id==='charge'?'charge':'melee');}
 }
 if(m.id==='charge')return;
 if(m.id==='slam'){w.skillEffect('skillSlam',{x:e.aim.x,y:e.aim.y,reach:m.reach},.7);w.emit('slam',{x:e.aim.x,y:e.aim.y});}
 else{w.effects.push({kind:m.id==='triple'?'thrust':'enemySlash',x:e.x,y:e.y-90,facing:e.attackDirection,reach:m.reach,life:.25,maxLife:.25});w.emit('enemySwing',{x:e.x,y:e.y,weapon:'spear'});}
}
function tick(w,e,dt){
 if(e.dead||!e.deployed||w.status!=='playing')return;
 w.tickBurns(e);if(w.status!=='playing')return;
 e.flash=Math.max(0,e.flash-dt);e.stun=Math.max(0,e.stun-dt);e.hardStun=Math.max(0,e.hardStunUntil-w.time);e.moving=false;
 if(e.controlled)return;
 if(e.knockdownLeft>0){e.knockdownLeft=Math.max(0,e.knockdownLeft-dt);e.state=e.knockdownLeft>.4?'knocked':e.knockdownLeft>0?'rising':'recover';if(!e.knockdownLeft){e.timer=.75;e.move=null;}return;}
 if(w.player.dead||!w.aiEnabled||e.hardStun>0)return;
 e.timer-=dt;
 if(['yinEntrance','recover'].includes(e.state)){if(e.timer<=0){e.state='approach';e.timer=.25;e.move=null;}return;}
 if(e.state==='yinWindup'){
  if(e.timer<=0){e.state='yinActive';e.timer=e.move.active;e.activeAge=0;e.hitIndex=0;e.hitIds.clear();if(e.move.id==='charge')w.emit('charge',{x:e.x,y:e.y,target:e.id});}return;
 }
 if(e.state==='yinActive'){
  const m=e.move,oldX=e.x;e.activeAge=Math.min(m.active,e.activeAge+dt);
  if(m.id==='charge'){e.x=clamp(e.x+e.attackDirection*700*dt,w.arena.left+20,w.arena.right-20);e.moving=true;impact(w,e,oldX);}
  else if(m.id==='slam'){const q=Math.min(1,e.activeAge/.3);e.x=e.attackOrigin.x+(e.aim.x-e.attackOrigin.x)*q;e.y=e.attackOrigin.y+(e.aim.y-e.attackOrigin.y)*q;e.z=58*Math.sin(Math.PI*q);}
  while(e.hitIndex<m.hits.length&&e.activeAge+1e-8>=m.hits[e.hitIndex]){e.hitIndex++;e.hitIds.clear();impact(w,e,oldX);}
  if(e.timer<=0){e.state='recover';e.timer=m.recovery;e.z=0;}return;
 }
 const target=w.chooseTarget(e);if(!target)return;
 e.facing=sign(target.x-e.x);
 if(Math.abs(target.x-e.x)>530||Math.abs(target.y-e.y)>35)w.enemyMove(e,target.x-e.facing*220,target.y,145,dt);
 else if(e.timer<=0){
  // Close strikes approach their actual reach before committing; warnings never track the target.
  const m=MOVES[e.moveIndex%MOVES.length];
  if(['cleave','triple','sweep'].includes(m.id)&&Math.abs(target.x-e.x)>m.reach-35)w.enemyMove(e,target.x-e.facing*(m.reach-65),target.y,150,dt);
  else{e.moveIndex++;begin(w,e,m);}
 }
}
return {MOVES,begin,tick};
});
