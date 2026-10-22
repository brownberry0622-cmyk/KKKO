(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MotionCore=api;})(globalThis,function(){'use strict';
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
class FixedClock{
 constructor(){this.step=1/60;this.accumulator=0;this.hold=0;}
 reset(){this.accumulator=0;this.hold=0;}
 tick(rawDelta,simulate){
  const dt=clamp(rawDelta,0,.1),frozen=Math.min(dt,this.hold);this.hold-=frozen;this.accumulator+=dt-frozen;
  let steps=0;
  while(this.accumulator+1e-10>=this.step&&steps<6){
   this.accumulator=Math.max(0,this.accumulator-this.step);steps++;
   const stop=clamp(simulate(this.step)||0,0,.08);
   if(stop){const used=Math.min(stop,this.accumulator);this.accumulator-=used;this.hold=stop-used;if(this.hold>0)break;}
  }
  return {steps,elapsed:steps*this.step,alpha:this.hold>0?1:clamp(this.accumulator/this.step,0,1)};
 }
}
function capture(e){return {x:e.x,y:e.y,z:e.z,action:e.action,elapsed:e.action?.elapsed,timer:e.timer,knockdownLeft:e.knockdownLeft};}
class Presenter{
 constructor(){this.previous=new Map();}
 capture(world){this.previous.clear();for(const e of [world.player,...world.enemies,...(world.allies||[]),...world.projectiles])this.previous.set(e.id,capture(e));}
 entity(e,alpha){
  const old=this.previous.get(e.id),a=clamp(alpha,0,1),v={...e};
  if(old){for(const k of ['x','y','z'])if(Number.isFinite(e[k])&&Number.isFinite(old[k]))v[k]=old[k]+(e[k]-old[k])*a;
   // Interpolate countdowns only while the same state continues, never across a reset.
   for(const k of ['timer','knockdownLeft'])if(Number.isFinite(old[k])&&Number.isFinite(e[k])&&old[k]>=e[k]&&old[k]-e[k]<.1)v[k]=old[k]+(e[k]-old[k])*a;
  }
  if(e.action)v.action={...e.action,token:e.action,elapsed:old?.action===e.action?old.elapsed+(e.action.elapsed-old.elapsed)*a:e.action.elapsed};
  return v;
 }
}
return {FixedClock,Presenter};
});
