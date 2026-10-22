(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.CombatVFX=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
function random(seed,index){let n=(seed*374761393+index*668265263)|0;n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967296;}
function circle(ctx,x,y,r,color){ctx.fillStyle=color;ctx.beginPath();ctx.arc(x,y,Math.max(.1,r),0,Math.PI*2);ctx.fill();}
function impact(ctx,f,age,progress){
 const heavy=f.finisher||f.charged||['counter','slam','rush'].includes(f.attack);
 const cool=f.weapon==='spear'||f.attack==='jump',size=heavy?1.55:1;
 const color=cool?'#78defc':'#ffad39';ctx.scale(size,size);
 ctx.globalAlpha=Math.pow(1-progress,.72);
 if(age<.1){
  const v=1-age/.1;ctx.save();ctx.globalCompositeOperation='lighter';
  const g=ctx.createRadialGradient(0,0,0,0,0,65);g.addColorStop(0,'#ffffed');g.addColorStop(.3,color);g.addColorStop(1,'#ffad3900');
  ctx.globalAlpha=v*.7;ctx.fillStyle=g;ctx.fillRect(-65,-65,130,130);ctx.restore();
  ctx.fillStyle=color;ctx.beginPath();
  for(let i=0;i<20;i++){const a=i*Math.PI/10,r=i%2?8:29+random(f.seed,i)*28;ctx.lineTo(Math.cos(a)*r*(.8+progress),Math.sin(a)*r*.7);}ctx.closePath();ctx.fill();
  ctx.fillStyle='#fffff0';ctx.beginPath();ctx.moveTo(-34,-4);ctx.lineTo(-5,-6);ctx.lineTo(9,-38);ctx.lineTo(6,-4);ctx.lineTo(38,3);ctx.lineTo(5,6);ctx.lineTo(-9,32);ctx.lineTo(-6,4);ctx.closePath();ctx.fill();
 }
 ctx.strokeStyle=color;ctx.lineWidth=2*(1-progress)+.5;ctx.beginPath();ctx.ellipse(0,0,12+progress*48,7+progress*29,-.4,0,7);ctx.stroke();
 for(let i=0;i<(heavy?24:16);i++){
  const a=(random(f.seed,i+30)-.5)*5.3,v=110+random(f.seed,i+55)*300;
  const x=Math.cos(a)*v*age,y=Math.sin(a)*v*age+100*age*age,len=(8+random(f.seed,i+80)*20)*(1-progress);
  ctx.save();ctx.translate(x,y);ctx.rotate(a);ctx.fillStyle=i%3?color:'#fffcea';
  ctx.beginPath();ctx.moveTo(-len,0);ctx.lineTo(0,-1.5);ctx.lineTo(5,0);ctx.lineTo(0,1.5);ctx.closePath();ctx.fill();ctx.restore();
 }
}
function blood(ctx,f,age,progress){
 if(age<.16){
  const grow=1+age*5;ctx.globalAlpha=(1-age/.16)*.9;
  ctx.fillStyle='#a51c29';ctx.beginPath();
  for(let i=0;i<14;i++){const a=i*Math.PI/7,r=(i%2?7:16+random(f.seed,i)*11)*grow;ctx.lineTo(Math.cos(a)*r+6,Math.sin(a)*r*.58);}ctx.closePath();ctx.fill();
  circle(ctx,-1,0,5,'#67131f');
 }
 ctx.globalAlpha=Math.pow(1-progress,.65);
 for(let i=0;i<15;i++){
  const a=(random(f.seed,i+18)-.55)*1.8,speed=95+random(f.seed,i+45)*170;
  const vx=Math.cos(a)*speed,vy=Math.sin(a)*speed-42;
  const x=vx*age,y=vy*age+175*age*age,r=(1.4+random(f.seed,i+70)*2.3)*(1-progress*.65);
  const color=i%3===0?'#cf3938':i%3===1?'#9e1725':'#651321';
  ctx.save();ctx.translate(x,y);ctx.rotate(Math.atan2(vy+350*age,vx));
  ctx.fillStyle=color;ctx.beginPath();ctx.ellipse(0,0,r*(1.2+(1-progress)*1.1),r,0,0,7);ctx.fill();ctx.restore();
  if(i<5){ctx.strokeStyle=color;ctx.lineWidth=r*.6;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x-vx*.035,y-(vy+350*age)*.035);ctx.stroke();}
 }
}
function draw(ctx,f){
 if(f.kind!=='impact'&&f.kind!=='blood')return false;
 const progress=clamp(1-f.life/f.maxLife,0,1),age=progress*f.maxLife;
 ctx.save();ctx.translate(f.x,f.y);ctx.scale(f.direction||1,1);
 if(f.kind==='blood')blood(ctx,f,age,progress);else impact(ctx,f,age,progress);
 ctx.restore();return true;
}
function ribbon(ctx,reach,motion,width,color){
 ctx.fillStyle=color;ctx.beginPath();
 if(motion==='thrust'){
  ctx.moveTo(10,-width*.2);ctx.lineTo(reach-40,-width*.44);ctx.lineTo(reach,0);ctx.lineTo(reach-40,width*.4);ctx.lineTo(10,width*.2);
 }else if(motion==='slam'){
  ctx.moveTo(reach*.35,-115);ctx.bezierCurveTo(reach+35,-65,reach+18,30,reach*.83,72);
  ctx.quadraticCurveTo(reach*.88,9,reach*.35,-115+width);
 }else if(motion==='rise'){
  ctx.moveTo(8,68);ctx.bezierCurveTo(reach+60,50,reach+20,-80,reach*.68,-113);
  ctx.bezierCurveTo(reach+18,-23,reach-width,44,8,68);
 }else if(motion==='sweep'){
  ctx.moveTo(-12,-29);ctx.bezierCurveTo(reach*.7,-60,reach+30,-38,reach,5);
  ctx.bezierCurveTo(reach-22,38,reach*.48,40,-4,23);
  ctx.bezierCurveTo(reach*.62,28,reach+10,8,reach-20,-6);
  ctx.quadraticCurveTo(reach*.62,-36,-12,-29);
 }else{
  ctx.moveTo(10,-95);ctx.bezierCurveTo(reach+48,-62,reach+32,42,reach*.64,68);
  ctx.bezierCurveTo(reach+6,12,reach-width,-50,10,-95);
 }
 ctx.closePath();ctx.fill();
}
function drawSwing(ctx,f){
 if(!['slash','thrust','groundImpact','block','enemySlash'].includes(f.kind))return false;
 const q=clamp(f.life/f.maxLife,0,1),age=(1-q)*f.maxLife;ctx.save();ctx.globalAlpha=Math.pow(q,.65);
 ctx.translate(f.x,f.y);ctx.scale(f.facing||1,1);
 if(f.kind==='block'){
  ctx.strokeStyle='#b9faff';ctx.lineWidth=4*q;ctx.beginPath();ctx.arc(0,0,20+35*(1-q),-1.45,1.45);ctx.stroke();
  impact(ctx,{seed:3,attack:'block',weapon:'spear'},age,1-q);
 }else if(f.kind==='groundImpact'){
  const r=25+(1-q)*100;ctx.strokeStyle='#eccc97';ctx.lineWidth=4*q;
  ctx.beginPath();ctx.ellipse(0,0,r,r*.21,0,0,7);ctx.stroke();
  for(let i=0;i<14;i++){const a=i*2.399,rr=(1-q)*(40+i*6);ctx.fillStyle=i%2?'#aa8761':'#e1c79d';ctx.save();ctx.translate(Math.cos(a)*rr,Math.sin(a)*rr*.2-Math.sin((1-q)*Math.PI)*24);ctx.rotate(a);ctx.fillRect(-3,-3,4+q*6,3+q*4);ctx.restore();}
 }else{
  const reach=f.reach||100,motion=f.kind==='thrust'?'thrust':f.motion||'chop';
  const color=f.kind==='enemySlash'?'#dd7440':f.charged||f.finisher?'#ffad36':f.kind==='thrust'?'#4dd9f9':'#68d4ed';
  ctx.save();ctx.globalAlpha*=.28;ctx.scale(1.035,1.1);ribbon(ctx,reach,motion,34,color);ctx.restore();
  ribbon(ctx,reach,motion,26,color);ctx.save();ctx.scale(.97,.96);ribbon(ctx,reach,motion,13,'#e8ffff');ctx.restore();
  ctx.strokeStyle='#ffffff';ctx.lineWidth=1.5*q;ctx.beginPath();ctx.moveTo(22,0);if(motion==='thrust')ctx.lineTo(reach,0);else ctx.quadraticCurveTo(reach+10,-18,reach*.83,34);ctx.stroke();
  for(let i=0;i<7;i++){const x=reach*(.38+i*.09),y=Math.sin(i*2.4)*(28+40*(1-q));ctx.fillStyle=i%2?'#fbf9de':color;ctx.fillRect(x,y,5*q+1,2);}
 }
 ctx.restore();return true;
}
function drawEmbedded(ctx,p,x=p.x,y=p.y-p.z){
 if(!p.embedded||!p.embedded.length)return;
 ctx.save();
 for(let i=0;i<Math.min(6,p.embedded.length);i++){
  const arrow=p.embedded[i],side=(arrow.side||1)*(arrow.facing?p.facing/arrow.facing:1);
  const ax=x+side*(9+(i%2)*8),ay=y-(p.dead?22:p.mounted?133:88)+(i%3)*9;
  const tailX=ax+side*33,tailY=ay-18;
  ctx.strokeStyle='#1b1915';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(ax,ay);ctx.lineTo(tailX,tailY);ctx.stroke();
  ctx.strokeStyle='#dbbd82';ctx.lineWidth=2;ctx.stroke();ctx.strokeStyle='#eee7d5';ctx.beginPath();
  ctx.moveTo(tailX,tailY);ctx.lineTo(tailX-side*7,tailY-5);ctx.moveTo(tailX,tailY);ctx.lineTo(tailX-side*2,tailY+8);ctx.stroke();
 }ctx.restore();
}
return {draw,random,drawSwing,drawEmbedded,ribbon};
});
