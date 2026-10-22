(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ScrollCamera=api;})(globalThis,function(){'use strict';
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
class Camera{
 constructor(width=5120,viewport=1280){this.width=width;this.viewport=viewport;this.x=0;this.target=0;}
 reset(width=this.width){this.width=Math.max(this.viewport,width);this.x=0;this.target=0;}
 update(player,dt){
  if(dt<=0)return this.x;
  const max=Math.max(0,this.width-this.viewport),left=this.viewport*.40,right=this.viewport*.53;
  // A horizontal dead zone avoids jitter from facing, jumping and small adjustments.
  this.target=clamp(this.target,player.x-right,player.x-left);this.target=clamp(this.target,0,max);
  this.x+=(this.target-this.x)*(1-Math.exp(-9*Math.min(dt,.1)));
  // Dash/skill movement must never outrun the visible frame, even after a slow frame.
  this.x=clamp(this.x,Math.max(0,player.x-this.viewport+140),Math.min(max,Math.max(0,player.x-140)));
  this.x=clamp(this.x,0,max);if(Math.abs(this.target-this.x)<.02)this.x=this.target;
  return this.x;
 }
 seek(player){this.target=this.x=clamp(player.x-this.viewport*.465,0,Math.max(0,this.width-this.viewport));return this.x;}
 visible(x,padding=220){return x>=this.x-padding&&x<=this.x+this.viewport+padding;}
 screenX(worldX){return worldX-this.x;}
 worldX(screenX){return screenX+this.x;}
}
return {Camera};
});
