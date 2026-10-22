(function(root){'use strict';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
let gentle=false;
function pose(p){
 const a=p.action;if(!a||!['rush','mountedRush','lift','bladeFlurry','bladeWave','fireShot','arrowRain'].includes(a.kind))return null;
 const spear=p.weapon==='spear',prefix=(p.mounted?'mounted-':'')+(spear?'spear':'blade')+'-chain-';
 if(a.kind==='bladeFlurry'){
  const i=a.elapsed<.27?0:a.elapsed<.54?1:2,n=[1,3,2][i],start=[0,.27,.54][i],hit=[.14,.12,.12][i],length=[.27,.27,.44][i],active=[.14,.12,.18][i],duration=[.4,.36,.48][i],t=a.elapsed-start;
  return AnimationCore.sample(prefix+n,t<hit?t*active/hit:active+(t-hit)*(duration-active)/(length-hit));
 }
 if(a.kind==='bladeWave')return AnimationCore.sample(prefix+'3',a.elapsed<.38?a.elapsed*.12/.38:.12+(a.elapsed-.38)*.24/.57);
 if(['rush','mountedRush'].includes(a.kind)){
  const start=a.rushStart??.16,end=a.rushEnd??.66;
  return AnimationCore.sample(prefix+'1',a.elapsed<start?a.elapsed*.18/start:a.elapsed<end?.18+.12*(a.elapsed-start)/(end-start):.3+.16*(a.elapsed-end)/(a.duration-end));
 }
 if(a.kind==='lift')return a.elapsed<(spear?.58:.6)?AnimationCore.sample(prefix+(spear?'3':'1'),a.elapsed*(spear?1:.7)):
   AnimationCore.sample(prefix+(spear?'4':'5'),a.elapsed-(spear?.58:.6));
 return AnimationCore.sample(p.mounted?'mounted-shoot':'hero-shoot',a.elapsed<.34?a.elapsed*.25/.34:.25+a.elapsed-.34);
}
function flame(ctx,x,y,h,w,t,color='#ed7a32'){
 ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(x-w,y);
 ctx.bezierCurveTo(x-w*1.8,y-h*.4,x+w*Math.sin(t)*.8,y-h*.6,x+w*.2,y-h);
 ctx.bezierCurveTo(x+w*.5,y-h*.48,x+w*1.8,y-h*.3,x+w,y);ctx.closePath();ctx.fill();
}
function heroBack(ctx,p,time,reduced=false){
 gentle=!!reduced;
 const a=p.action,x=p.x,y=p.y-p.z;
 // Windup gathers toward the weapon; recovery leaves only a short ground wake.
 if(a&&['rush','mountedRush','lift','bladeFlurry','bladeWave','fireShot','arrowRain'].includes(a.kind)){
  const warm=['bladeFlurry','bladeWave','fireShot'].includes(a.kind),ink=p.ogreLeft>0?'#da487b':warm?'#eab96e':'#8bdeec';
  const q=clamp(a.elapsed/a.activeAt,0,1),charging=!a.resolved;
  ctx.save();ctx.translate(x,y-(p.mounted?48:0));ctx.scale(a.facing,1);
  if(charging){
   ctx.globalAlpha=(gentle?.32:.6)*q;ctx.strokeStyle=ink;ctx.lineWidth=1.5;
   ctx.beginPath();ctx.ellipse(0,0,24+q*35,7+q*9,0,Math.PI*.12,Math.PI*1.85);ctx.stroke();
   const count=gentle?6:12;for(let i=0;i<count;i++){const r=(1-q)*80+16,theta=i/count*Math.PI*2+time*1.4;ctx.beginPath();ctx.moveTo(32+Math.cos(theta)*r,-68+Math.sin(theta)*r*.55);ctx.lineTo(32+Math.cos(theta)*(r+12),-68+Math.sin(theta)*(r+12)*.55);ctx.stroke();}
   ctx.globalAlpha=q*.8;ctx.fillStyle=ink;ctx.beginPath();ctx.arc(30,-65,2+q*4,0,7);ctx.fill();
   if(a.kind==='arrowRain'){ctx.globalAlpha=.14*q;ctx.fillStyle=ink;ctx.beginPath();ctx.ellipse(300,0,275,100,0,0,7);ctx.fill();ctx.globalAlpha=.4*q;ctx.setLineDash([12,10]);ctx.stroke();}
  }
  if(a.kind==='lift'&&a.resolved&&!a.slammed){const t=clamp((a.elapsed-.2)/.7,0,1);ctx.strokeStyle=ink;ctx.lineWidth=gentle?1:2;ctx.globalAlpha=.5;for(let i=0;i<3;i++){ctx.beginPath();ctx.moveTo(100+i*28,-45);ctx.quadraticCurveTo(165+i*26,-110,140+i*22,-45-170*Math.sin(t*Math.PI));ctx.stroke();}}
  ctx.restore();
 }
 ctx.save();
 if(p.ogreLeft>0&&!p.dead){
  // Crimson ink rises from the feet, wrapping the existing human silhouette.
  const pulse=.6+Math.sin(time*6)*.13,g=ctx.createRadialGradient(x,y-82,18,x,y-82,145);
  g.addColorStop(0,'#aa113f48');g.addColorStop(.6,'#740c2a24');g.addColorStop(1,'#370b2300');ctx.fillStyle=g;ctx.fillRect(x-150,y-245,300,265);
  ctx.translate(x,y-(p.mounted?30:0));ctx.globalAlpha=pulse;
  for(let i=0;i<7;i++){
    const side=i%2?1:-1,base=side*(26+i*6),sway=Math.sin(time*3.1+i)*18;
    ctx.strokeStyle=i%3?'#bb244e':'#ef728b';ctx.lineWidth=i%3?5:1.8;
    ctx.beginPath();ctx.moveTo(base,12);ctx.bezierCurveTo(base+side*45,-60,base-side*40+sway,-125,base+side*20+sway,-207-i%3*13);ctx.stroke();
  }
  for(let k=0;k<3;k++){ctx.strokeStyle=k===0?'#f36e8a':'#8e2445';ctx.lineWidth=2-k*.4;ctx.beginPath();ctx.ellipse(0,-24-k*39,67-k*7,13+k*8,Math.sin(time*2+k)*.4,0,Math.PI*2);ctx.stroke();}
  for(let i=0;i<26;i++){const q=(time*.38+i*.061)%1;ctx.globalAlpha=(1-q)*.65;ctx.fillStyle=i%3?'#a92852':'#ffc2cc';ctx.beginPath();ctx.ellipse(Math.sin(i*4+time*.8)*60,-q*230,1.5,3.5+q*3,-.4,0,7);ctx.fill();}
  // Two narrow red after-images imply speed without covering face or weapon.
  ctx.globalAlpha=.24;ctx.strokeStyle='#bd2755';ctx.lineWidth=7;
  for(let k=1;k<=2;k++){ctx.beginPath();ctx.moveTo(-p.facing*k*20,-10);ctx.quadraticCurveTo(-p.facing*(30+k*19),-75,-p.facing*k*20,-148);ctx.stroke();}

 }
 ctx.restore();
 if(a&&['rush','mountedRush'].includes(a.kind)&&a.elapsed>=(a.rushStart||.16)&&a.elapsed<=(a.rushEnd||.66)+.04){
  ctx.save();ctx.translate(x,y-65);ctx.scale(a.facing,1);
  const g=ctx.createLinearGradient(-180,0,a.reach,0);g.addColorStop(0,'#badafa00');g.addColorStop(.65,'#bff6ff77');g.addColorStop(1,'#fff6c6');
  ctx.strokeStyle=g;ctx.lineWidth=5;for(let i=0;i<5;i++){ctx.beginPath();ctx.moveTo(-180-i*13,(i-2)*12);ctx.lineTo(a.reach-i*22,(i-2)*3);ctx.stroke();}
  ctx.globalAlpha=.85;CombatVFX.ribbon(ctx,a.reach,'thrust',28,'#64dfff');CombatVFX.ribbon(ctx,a.reach,'thrust',10,'#f5fffb');
  ctx.strokeStyle='#c1f4ff';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(a.reach*.45,0,18,63,0,0,7);ctx.stroke();
  ctx.restore();
 }
}
function enemyFire(ctx,e,time){
 if(e.dead||!e.burns.length)return;ctx.save();ctx.globalAlpha=.78;
 for(let i=0;i<Math.min(9,3+e.burns.length);i++)flame(ctx,e.x-25+i*8,e.y-e.z-8,30+Math.sin(time*10+i)**2*30,6,time*4+i,i%2?'#ef8438':'#bf3e25');
 for(let i=0;i<6;i++){const q=(time*1.5+i*.17)%1;ctx.fillStyle=i%2?'#fff3a3':'#ffa849';ctx.fillRect(e.x+Math.sin(i*4+time)*26,e.y-e.z-20-q*85,2,4);}
 ctx.restore();
}
function arrow(ctx,a,time){
 if(!a.fire&&!a.burn)return;ctx.save();ctx.translate(a.x,a.y-a.z);ctx.rotate(Math.atan2(a.vy-a.vz,a.vx));
 const g=ctx.createLinearGradient(-78,0,14,0);g.addColorStop(0,'#ff593500');g.addColorStop(.7,'#f77332af');g.addColorStop(1,'#fff3a5');
 ctx.fillStyle=g;ctx.beginPath();ctx.moveTo(16,0);ctx.lineTo(-65,-7-Math.sin(time*24)*3);ctx.lineTo(-42,0);ctx.lineTo(-77,8);ctx.closePath();ctx.fill();
 ctx.fillStyle='#fff3b4';ctx.beginPath();ctx.moveTo(20,0);ctx.lineTo(-10,-5);ctx.lineTo(-31,0);ctx.lineTo(-8,5);ctx.closePath();ctx.fill();
 for(let i=0;i<9;i++){const q=(time*7+i*.13)%1;ctx.fillStyle=i%2?'#ffc35b':'#dc5426';ctx.fillRect(-15-q*108,Math.sin(i*4)*q*15,4*(1-q),2);}
 ctx.restore();
}
function timeSafe(seed){return (seed||0)%7;}
function effect(ctx,f){
 if(!['ogreBurst','skillRise','skillSlam','arrowRain','bladeArc','bladeWave','toughnessBreak','leech','modaoHit'].includes(f.kind))return false;
 const q=clamp(1-f.life/f.maxLife,0,1);ctx.save();ctx.translate(f.x,f.y);ctx.globalAlpha=1-q;
 if(f.kind==='modaoHit'){
  ctx.scale(f.facing,1);const strength=f.heavy?1.4:1,r=(18+q*85)*strength;
  ctx.strokeStyle='#fff1c4';ctx.lineWidth=(f.heavy?5:3)*(1-q);ctx.beginPath();ctx.moveTo(-22,-95*(1-q));ctx.lineTo(23,48);ctx.stroke();
  ctx.strokeStyle='#d5ab67';ctx.lineWidth=1.8;ctx.beginPath();ctx.ellipse(0,43,r,r*.18,0,0,7);ctx.stroke();
  for(let i=0;i<(gentle?6:14);i++){const a=i*2.4;ctx.save();ctx.translate(Math.cos(a)*r*.8,Math.sin(a)*r*.32-Math.sin(q*Math.PI)*35);ctx.rotate(a+q*3);ctx.fillStyle=i%3?'#a9b7ba':'#efd49b';ctx.strokeStyle='#27373c';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(-4,-3);ctx.lineTo(5,-2);ctx.lineTo(2,5);ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();}
 }else if(f.kind==='bladeArc'||f.kind==='bladeWave'){
  ctx.scale(f.facing,1);const wide=f.kind==='bladeWave';ctx.translate(wide?q*85:0,0);
  CombatVFX.ribbon(ctx,f.reach,wide?'sweep':f.hit===0?'rise':f.hit===1?'sweep':'chop',wide?52:35,'#e8b27a');
  CombatVFX.ribbon(ctx,f.reach*.97,wide?'sweep':f.hit===0?'rise':f.hit===1?'sweep':'chop',wide?18:10,'#fff6cf');
  ctx.strokeStyle='#d9f2ed';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(f.reach*.35,0,f.reach*.6,wide?83:61,-.2,-1.5,1.4);ctx.stroke();
  // Dark ink separates the outer blade trail from the pale battlefield.
  ctx.globalAlpha=(1-q)*.35;ctx.strokeStyle='#23353b';ctx.lineWidth=wide?6:3;ctx.beginPath();ctx.ellipse(f.reach*.38,8,f.reach*.61,wide?90:68,-.2,-1.5,1.3);ctx.stroke();
  ctx.globalAlpha=(1-q)*.85;ctx.strokeStyle='#ffe5ad';ctx.lineWidth=1.5;
  for(let i=0;i<(gentle?4:12);i++){const theta=-1.25+i*.22,rr=f.reach*(.5+q*.12);ctx.beginPath();ctx.moveTo(f.reach*.35+Math.cos(theta)*rr,Math.sin(theta)*(wide?83:61));ctx.lineTo(f.reach*.35+Math.cos(theta)*(rr+16+q*20),Math.sin(theta)*(wide?88:66));ctx.stroke();}
 }else if(f.kind==='toughnessBreak'){
  ctx.strokeStyle='#bff4ff';ctx.lineWidth=3*(1-q);for(let i=0;i<14;i++){const a=i*Math.PI/7;ctx.beginPath();ctx.moveTo(Math.cos(a)*(28+q*100),Math.sin(a)*(30+q*60));ctx.lineTo(Math.cos(a)*(48+q*130),Math.sin(a)*(55+q*80));ctx.stroke();}
 }else if(f.kind==='leech'){
  ctx.strokeStyle='#f59cb8';ctx.lineWidth=2;for(let i=0;i<3;i++){ctx.beginPath();ctx.arc(0,0,50*(1-q)+i*8,timeSafe(f.seed)+i*2,timeSafe(f.seed)+i*2+1.4);ctx.stroke();}
 }else if(f.kind==='arrowRain'){
  ctx.scale(f.facing,1);ctx.fillStyle=f.burn?'#ed622118':'#cceaff12';ctx.beginPath();ctx.ellipse(f.reach*.5,0,f.reach*.47,110,0,0,7);ctx.fill();
  for(let i=0;i<(gentle?23:46);i++){
   const x=45+(i*137%535),ground=-105+(i*71%215),phase=clamp((q-(i%7)*.045)/.65,0,1);
   const y=ground-410*(1-phase);ctx.strokeStyle=f.burn?'#ff9e52':'#6bcfea';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(x-29,y-105);ctx.lineTo(x,y);ctx.stroke();ctx.strokeStyle=f.burn?'#ffefd1':'#f4ffff';ctx.lineWidth=1.5;
   ctx.beginPath();ctx.moveTo(x-20,y-70);ctx.lineTo(x,y);ctx.lineTo(x-6,y-6);ctx.stroke();
   if(phase>=.9){ctx.strokeStyle=f.burn?'#ffbb74':'#d6f5ff';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(x,ground,9+(phase-.9)*65,3+(phase-.9)*15,0,0,7);ctx.stroke();ctx.beginPath();ctx.moveTo(x-7,ground-5);ctx.lineTo(x,ground-19);ctx.lineTo(x+8,ground-5);ctx.stroke();}
  }
 }else if(f.kind==='skillRise'){
  ctx.scale(f.facing,1);CombatVFX.ribbon(ctx,f.reach,'rise',42,'#51cde8');CombatVFX.ribbon(ctx,f.reach*.97,'rise',18,'#f3ffff');ctx.strokeStyle='#dcf8ff';ctx.lineWidth=7*(1-q)+1;ctx.beginPath();ctx.moveTo(28,54);ctx.bezierCurveTo(f.reach+50,45,f.reach+10,-150,90,-200);ctx.stroke();
  ctx.strokeStyle='#e5b562';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(45,58);ctx.quadraticCurveTo(f.reach+50,-15,95,-190);ctx.stroke();
 }else{
  const ogre=f.kind==='ogreBurst',r=(ogre?170:f.reach)*(Math.min(1,q*2));
  ctx.strokeStyle=ogre?'#cb3561':'#f9cd87';ctx.lineWidth=5*(1-q)+1;
  for(let k=0;k<3;k++){ctx.beginPath();ctx.ellipse(0,-k*4,r*(1-k*.16),r*.24,0,0,7);ctx.stroke();}
  if(!ogre){
   ctx.strokeStyle='#423324';ctx.lineWidth=3;for(let k=0;k<11;k++){const a=k*2.4;ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(Math.cos(a)*r*.5,Math.sin(a)*r*.1);ctx.lineTo(Math.cos(a+.08)*r,Math.sin(a+.08)*r*.23);ctx.stroke();}
   if(q<.35){ctx.save();ctx.globalCompositeOperation='lighter';ctx.fillStyle='#fff3bf';ctx.beginPath();ctx.moveTo(-r*.55,0);ctx.lineTo(-r*.35,-90*(1-q));ctx.lineTo(-12,-45);ctx.lineTo(0,-150*(1-q));ctx.lineTo(23,-34);ctx.lineTo(r*.4,-95*(1-q));ctx.lineTo(r*.6,0);ctx.closePath();ctx.fill();ctx.restore();}
  }
  for(let i=0;i<26;i++){const a=i*Math.PI*2/26,rr=r*(.65+(i%4)*.12);ctx.fillStyle=i%2?'#e8c392':'#574e42';ctx.save();ctx.translate(Math.cos(a)*rr,Math.sin(a)*rr*.23-Math.sin(q*Math.PI)*(25+i%5*9));ctx.rotate(a+q*3);ctx.fillRect(-4,-3,8+(i%3)*3,5+(i%2)*3);ctx.restore();}
  if(ogre){ctx.strokeStyle='#ee749c';ctx.lineWidth=3;for(let i=0;i<12;i++){const a=i*Math.PI/6;ctx.beginPath();ctx.moveTo(Math.cos(a)*r*.5,Math.sin(a)*r*.5-80);ctx.lineTo(Math.cos(a)*r,Math.sin(a)*r-80);ctx.stroke();}}

 }
 ctx.restore();return true;
}
root.SkillVFX={pose,heroBack,enemyFire,arrow,effect};
})(globalThis);
