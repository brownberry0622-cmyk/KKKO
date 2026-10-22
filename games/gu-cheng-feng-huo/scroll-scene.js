(function(root){'use strict';
const palettes=[['#b09a76','#ead0a0'],['#706450','#d5bd81'],['#958367','#efd4a0'],['#889080','#d2cdbc'],['#445664','#9fb2c5'],['#777c79','#c7bba6']];
function background(ctx,image,cameraX,scene){
 ctx.save();ctx.fillStyle='#243638';ctx.fillRect(0,0,1280,720);
 if(image){
  // Alternating mirrored tiles share exactly the same edge pixels at every seam.
  const first=Math.floor((cameraX-10)/1280),last=Math.floor((cameraX+1290)/1280);
  for(let i=first;i<=last;i++){const x=i*1280-cameraX;ctx.save();ctx.translate(x+(Math.abs(i)%2?1280:0),0);if(Math.abs(i)%2)ctx.scale(-1,1);ctx.drawImage(image,0,0,1280,720);ctx.restore();}
 }
 // Distant drifting haze gives a second depth layer independent of the ground.
 const tint=scene===4?'#8fb1c313':'#dac7a20e';
 for(let i=-1;i<4;i++){const x=i*570-((cameraX*.28)%570);const g=ctx.createRadialGradient(x,170,5,x,170,340);g.addColorStop(0,tint);g.addColorStop(1,'#aab9bc00');ctx.fillStyle=g;ctx.fillRect(x-340,30,680,280);}
 ctx.restore();
}
function label(ctx,t,x,y,size=17,color='#f3dba3'){ctx.font='600 '+size+'px Microsoft YaHei';ctx.textAlign='center';ctx.lineWidth=4;ctx.strokeStyle='#19272be6';ctx.strokeText(t,x,y);ctx.fillStyle=color;ctx.fillText(t,x,y);}
function flag(ctx,x,y,n,time,color='#913f32'){
 ctx.save();ctx.translate(x,y);ctx.strokeStyle='#473d30';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(0,-155);ctx.stroke();
 const wave=Math.sin(time*2+String(n).charCodeAt(0))*5;ctx.fillStyle=color;ctx.strokeStyle='#c4a76b';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(0,-153);ctx.lineTo(69,-148+wave);ctx.lineTo(62,-72+wave*.4);ctx.lineTo(32,-84);ctx.lineTo(0,-78);ctx.closePath();ctx.fill();ctx.stroke();label(ctx,n,32,-110,24,'#efd7a1');ctx.restore();
}
function scenery(ctx,world,camera){
 const colors=palettes[world.scene],time=world.time;
 // World-space road details reveal actual travel without changing combat lanes.
 const start=Math.floor((camera.x-120)/230),end=Math.ceil((camera.x+1400)/230);
 for(let i=start;i<=end;i++){const x=i*230+Math.sin(i*3.7)*38,y=670+Math.sin(i*1.6)*17;ctx.save();ctx.globalAlpha=.42;ctx.strokeStyle=colors[0];ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(x-26,y);ctx.lineTo(x+24,y+2);ctx.moveTo(x+40,y+9);ctx.lineTo(x+63,y+8);ctx.stroke();ctx.fillStyle=colors[1];ctx.beginPath();ctx.ellipse(x+15,y-5,7,2,0,0,7);ctx.fill();ctx.restore();}
 const markers=[{x:410,n:'出'},{x:world.width*.35,n:'壹'},{x:world.width*.67,n:'贰'}];
 for(const m of markers)if(camera.visible(m.x,100))flag(ctx,m.x,451,m.n,time);
 const x=world.exitX;if(camera.visible(x,220)){
  const clear=world.enemies.every(e=>e.dead);flag(ctx,x-74,452,'归',time,clear?'#42796e':'#786440');flag(ctx,x+74,452,'路',time,clear?'#42796e':'#786440');
  ctx.save();ctx.strokeStyle=clear?'#dbdb9e88':'#d9c19a55';ctx.lineWidth=3;ctx.setLineDash([11,13]);ctx.beginPath();ctx.moveTo(x,466);ctx.lineTo(x,650);ctx.stroke();ctx.setLineDash([]);label(ctx,'突围出口',x,242,24);label(ctx,clear?'向前通过':'清除沿途敌兵',x,274,14);ctx.restore();
 }
}
root.ScrollScene={background,scenery};
})(globalThis);
