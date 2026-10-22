(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.CinematicFX=api;})(globalThis,function(){'use strict';
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
class Director{
 constructor(){this.time=0;this.stop=0;this.shake=0;this.reduced=false;this.trails=[];this.dust=[];this.lastTrail=-1;this.lastDust=-1;this.label=null;this.combo=0;this.comboUntil=0;}
 event(e){
  if(e.type==='hit'){
   const heavy=e.finisher||e.charged||['slam','counter','rush','mountedRush','bladeWave'].includes(e.kind);
   if(!this.reduced){this.stop=Math.max(this.stop,['arrow','rain','rush','mountedRush'].includes(e.kind)?0:heavy?.045:.022);this.shake=Math.max(this.shake,heavy?6.5:2.4);}
   this.combo=this.time<this.comboUntil?this.combo+1:1;this.comboUntil=this.time+1.4;
  }
  if(e.type==='slam'||e.type==='ogre'){if(!this.reduced){this.shake=7;this.stop=Math.max(this.stop,.05);}}
  if(e.type==='hurt'&&!this.reduced)this.shake=Math.max(this.shake,4);
  if(e.type==='skill'||e.type==='ogre'){this.label={text:e.type==='ogre'?'食 人 魔':({rush:'破 阵 贯 槊',mountedRush:'踏 阵 贯 槊',bladeFlurry:'回 风 三 叠',bladeWave:'断 阵 横 斩',lift:'挑 龙 震 地',fireShot:'贯 火 矢',arrowRain:'漫 天 箭 雨'})[e.kind],life:.7,maxLife:.7,red:e.type==='ogre'};}
 }
 advance(dt){this.time+=dt;this.stop=Math.max(0,this.stop-dt);this.shake=Math.max(0,this.shake-dt*38);for(const t of this.trails)t.life-=dt;for(const t of this.dust)t.life-=dt;this.trails=this.trails.filter(t=>t.life>0);this.dust=this.dust.filter(t=>t.life>0);if(this.label)this.label.life-=dt;}
 capture(p,pose){
  const rushing=p.dashLeft>0||(p.action&&['rush','mountedRush'].includes(p.action.kind)&&p.action.elapsed>(p.action.rushStart??.16)&&p.action.elapsed<(p.action.rushEnd??.66)+.01);
  if(rushing&&!p.dead&&this.time-this.lastTrail>=.04&&!this.reduced){this.lastTrail=this.time;this.trails.push({pose,x:p.x,y:p.y-p.z+3,facing:p.facing,life:.19,maxLife:.19});if(this.trails.length>6)this.trails.shift();}
  if(p.moving&&p.z===0&&!p.dead&&this.time-this.lastDust>=(p.running||rushing?.07:.17)){this.lastDust=this.time;this.dust.push({x:p.x,y:p.y+5,facing:p.facing,life:.35,maxLife:.35,seed:Math.floor(this.time*31)});if(this.dust.length>18)this.dust.shift();}
 }
 camera(){return this.reduced?{x:0,y:0}:{x:Math.sin(this.time*181)*this.shake,y:Math.cos(this.time*147)*this.shake*.55};}
 drawBehind(ctx,images,atlas,animation){
  ctx.save();for(const t of this.trails){ctx.save();ctx.filter='sepia(1) saturate(2) hue-rotate(120deg)';animation.draw(ctx,images,atlas,t.pose,t.x,t.y,t.facing,.25*t.life/t.maxLife);ctx.restore();}
  for(const d of this.dust){const q=1-d.life/d.maxLife;ctx.globalAlpha=(1-q)*.28;ctx.fillStyle='#d9c8a0';for(let i=0;i<5;i++){ctx.beginPath();ctx.ellipse(d.x-d.facing*(q*45+i*8),d.y-Math.sin(q*Math.PI)*9,(5+i*2)*(1+q),3+q*5,0,0,7);ctx.fill();}}
  ctx.restore();
 }
 drawOverlay(ctx){
  ctx.save();
  if(this.combo>1&&this.time<this.comboUntil){ctx.textAlign='right';ctx.font='italic 700 29px Georgia,serif';ctx.strokeStyle='#29251c';ctx.lineWidth=4;ctx.strokeText(this.combo+' 连击',1200,211);ctx.fillStyle='#ffe29a';ctx.fillText(this.combo+' 连击',1200,211);}
  if(this.label&&this.label.life>0){const l=this.label,q=1-l.life/l.maxLife;ctx.globalAlpha=Math.min(1,q*10,l.life*5);const x=640;
   const g=ctx.createLinearGradient(340,0,940,0);g.addColorStop(0,'#14212b00');g.addColorStop(.5,l.red?'#411b26dc':'#112731d9');g.addColorStop(1,'#14212b00');ctx.fillStyle=g;ctx.fillRect(340,180,600,53);
   ctx.textAlign='center';ctx.font='700 31px KaiTi,serif';ctx.fillStyle=l.red?'#ffc292':'#def8ff';ctx.fillText(l.text,x,217);
  }ctx.restore();
 }
}
return {Director};
});
