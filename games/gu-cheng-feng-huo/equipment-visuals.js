(function(root){'use strict';
const Gear=root.EquipmentCore,Anchors=root.EquipmentAnchors;
const colors=[{metal:'#a7b3b7',dark:'#404c50',gold:'#9c7851',cloth:'#3d5055'}, {metal:'#b9d7df',dark:'#223b47',gold:'#d39a58',cloth:'#814638'}, {metal:'#eef7ff',dark:'#445c74',gold:'#d0c4a7',cloth:'#849ba7'}, {metal:'#fff1c6',dark:'#382e3e',gold:'#e9b75a',cloth:'#ae894c'}];
let lastKey='',derived={},proxy=null,skinAtlas=null;
function rgb(hex){return [1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));}
function key(bag,weapon){return Object.keys(Gear.SLOTS).map(s=>{const i=Gear.equipped(bag,s);return i?i.appearance+':'+i.chapter:'-';}).join('|');}
function path(c,pts,fill,stroke='#17272b',width=1.8){c.beginPath();pts.forEach((p,i)=>i?c.lineTo(...p):c.moveTo(...p));c.closePath();c.fillStyle=fill;c.fill();if(stroke){c.strokeStyle=stroke;c.lineWidth=width;c.stroke();}}
// One shared design draws inventory icons, world loot and held weapon blades.
function blade(c,length,slot,rarity){
 const p=colors[rarity],modao=slot==='spear'&&rarity===3;
 if(modao){
  // Long straight double-edged blade with a central ridge, not a spearhead.
  const L=length,width=10;
  path(c,[[0,-7],[10,-width],[L-22,-width*.87],[L,0],[L-22,width*.87],[10,width],[0,7]],'#e7edf1','#19282e',2.1);
  path(c,[[8,0],[L,0],[L-22,width*.87],[10,width],[0,7]],'#718795',null);
  c.strokeStyle='#fcffff';c.lineWidth=1.4;c.beginPath();c.moveTo(12,-7);c.lineTo(L-24,-7);c.lineTo(L-4,0);c.stroke();
  c.strokeStyle='#405866';c.lineWidth=2;c.beginPath();c.moveTo(16,0);c.lineTo(L-23,0);c.stroke();
  c.fillStyle='#cb9e54';c.strokeStyle='#342b23';c.lineWidth=2;c.fillRect(-6,-13,7,26);c.strokeRect(-6,-13,7,26);
  c.fillStyle='#5b3c29';c.fillRect(-16,-5,10,10);return;
 }
 const width=modao?13:slot==='spear'?8+rarity*1.5:6+rarity*1.7;
 if(slot==='spear'&&!modao){path(c,[[0,-5],[length*.48,-width],[length,0],[length*.48,width],[0,5]],p.metal);path(c,[[0,0],[length,0],[length*.48,width],[0,5]],p.dark,null);}
 else {path(c,[[0,-width],[length*.85,-width*.8],[length,0],[length*.9,width*.3],[0,width]],p.metal);path(c,[[0,1],[length,0],[length*.9,width*.3],[0,width]],p.dark,null);}
 c.strokeStyle='#ffffffbc';c.lineWidth=1.2;c.beginPath();c.moveTo(3,-width*.65);c.lineTo(length*.82,-width*.5);c.stroke();
 c.fillStyle=p.gold;c.strokeStyle='#211d22';c.lineWidth=1.3;c.fillRect(-5,-width-4,6,width*2+8);c.strokeRect(-5,-width-4,6,width*2+8);
 if(rarity>0){for(let i=0;i<rarity;i++){c.fillStyle=p.gold;c.fillRect(9+i*8,-2,3,4);}}
}
function icon(ctx,item,x,y,size=52){
 const r=item?.rarity||0,s=item?.slot||'melee',p=colors[r];ctx.save();ctx.translate(x,y);ctx.scale(size/64,size/64);
 if(s==='melee'||s==='spear'){
  ctx.rotate(-.66);ctx.translate(-15,0);ctx.strokeStyle='#251d19';ctx.lineWidth=s==='spear'?5:7;ctx.beginPath();ctx.moveTo(s==='spear'?-18:-7,0);ctx.lineTo(4,0);ctx.stroke();
  ctx.strokeStyle=p.gold;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(s==='spear'?-18:-7,0);ctx.lineTo(4,0);ctx.stroke();ctx.translate(4,0);ctx.scale(.5,.5);blade(ctx,s==='spear'?(r===3?72:54):69,s,r);
 }else if(s==='bow'){
  ctx.strokeStyle=p.dark;ctx.lineWidth=7;ctx.beginPath();ctx.moveTo(10,-27);ctx.bezierCurveTo(-25,-15,7,-4,-8,0);ctx.bezierCurveTo(7,4,-25,15,10,27);ctx.stroke();ctx.strokeStyle=p.gold;ctx.lineWidth=3;ctx.stroke();ctx.lineWidth=.9;ctx.strokeStyle=p.metal;ctx.beginPath();ctx.moveTo(10,-27);ctx.lineTo(10,27);ctx.stroke();
  for(let i=0;i<=r;i++){ctx.fillStyle=p.metal;ctx.fillRect(-9,-17+i*9,5,3);}
 }else if(s==='armor'){
  path(ctx,[[-10,-25],[-25,-20],[-29,-6],[-18,-4],[-17,25],[17,25],[18,-4],[29,-6],[25,-20],[10,-25],[7,-17],[-7,-17]],p.cloth);
  ctx.strokeStyle=p.gold;ctx.lineWidth=1.4;for(let y=-8;y<25;y+=7)for(let x=-14;x<15;x+=7){ctx.strokeRect(x,y,6,6);}
  if(r>=2){for(const x of [-8,8]){ctx.fillStyle=p.metal;ctx.beginPath();ctx.ellipse(x,-9,7,9,0,0,7);ctx.fill();ctx.stroke();}}
  else{ctx.strokeStyle=p.metal;ctx.beginPath();ctx.moveTo(0,-16);ctx.lineTo(0,24);ctx.stroke();}
 }else if(s==='boots'){
  for(const x of [-12,12]){ctx.save();ctx.translate(x,0);path(ctx,[[-7,-25],[8,-25],[8,15],[12,19],[10,25],[-15,25],[-16,19],[-6,13]],p.dark);ctx.fillStyle=p.gold;ctx.fillRect(-7,-25,15,4);ctx.fillRect(-15,23,25,3);if(r>=2)path(ctx,[[-5,-17],[6,-17],[5,10],[-4,13]],p.metal);ctx.restore();}
 }else{
  ctx.strokeStyle='#b54e49';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(0,-28);ctx.lineTo(0,-10);ctx.moveTo(0,11);ctx.lineTo(-4,28);ctx.moveTo(0,11);ctx.lineTo(5,28);ctx.stroke();
  if(r===3){path(ctx,[[-18,-8],[-8,-13],[5,-11],[16,-16],[21,-5],[13,4],[5,5],[1,13],[-4,13],[-6,4],[-16,4]],p.gold);ctx.fillStyle=p.dark;ctx.fillRect(13,-9,3,3);}
  else{path(ctx,[[0,-16],[12,-6],[10,12],[0,17],[-10,12],[-12,-6]],['#ae8957','#7db8a0','#e9ecce'][r]);ctx.strokeStyle=p.dark;ctx.lineWidth=1.6;ctx.strokeRect(-4,-5,8,12);}
 }
 ctx.restore();
}
function skin(source,sheet,id,bag){
 const armor=Gear.equipped(bag,'armor'),boots=Gear.equipped(bag,'boots'),charm=Gear.equipped(bag,'charm');
 const weaponSlot=id.includes('spear')?'spear':null;
 const canvas=document.createElement('canvas');canvas.width=source.width;canvas.height=source.height;
 const c=canvas.getContext('2d',{willReadFrequently:true});c.drawImage(source,0,0);
 const W=canvas.width,paint=c.createImageData(W,canvas.height),cut=c.createImageData(W,canvas.height),torso=[];
 const masks=root.EquipmentMaterials[id];
 const unpack=value=>Uint8Array.from(atob(value),ch=>ch.charCodeAt(0));
 for(let n=0;n<sheet.frames.length;n++){
  const m=masks[n],t=m.torso;torso[n]=t;
  for(const [slot,item] of [['armor',armor],['boots',boots]])if(item&&t){
   const bytes=unpack(m[slot]),view=new DataView(bytes.buffer),p=colors[item.rarity],tone=rgb(slot==='armor'?p.cloth:item.rarity>=2?p.metal:p.dark),metal=rgb(p.metal);
   for(let i=0;i<bytes.length;i+=6){const at=view.getUint32(i,true),x=at%W,y=Math.floor(at/W),light=bytes[i+4]*3/(slot==='armor'?155:190),dst=at*4;
    const plate=slot==='armor'?(y%9<2||x%10<1?.64:1):(y%9<2?.7:1);
    for(let k=0;k<3;k++)paint.data[dst+k]=Math.min(255,tone[k]*light*plate+(slot==='armor'&&item.rarity>=2?12:0));
    if(slot==='armor'&&item.rarity>=2){const q=((x-(t[0]+(x<t[0]?-10:10)))/10)**2+((y-t[1]+12)/14)**2;if(q<1)for(let k=0;k<3;k++)paint.data[dst+k]=metal[k]*(.52+.38*Math.sqrt(1-q));}
    paint.data[dst+3]=bytes[i+5];
   }
  }
  const item=Gear.equipped(bag,weaponSlot||'melee');if(item&&Anchors.data[id]?.[n]){for(const mask of [m.erase,...(weaponSlot==='spear'&&item.rarity===3?[m.modaoTrim||'']:[])]){const bytes=unpack(mask),view=new DataView(bytes.buffer);for(let i=0;i<bytes.length;i+=4)cut.data[view.getUint32(i,true)*4+3]=255;}}
 }
 const layer=document.createElement('canvas');layer.width=W;layer.height=canvas.height;const lc=layer.getContext('2d');lc.putImageData(paint,0,0);c.drawImage(layer,0,0);lc.putImageData(cut,0,0);c.globalCompositeOperation='destination-out';c.drawImage(layer,0,0);c.globalCompositeOperation='source-over';
 for(let n=0;n<sheet.frames.length;n++){
  const f=sheet.frames[n],a=Anchors.data[id]?.[n],slot=weaponSlot||'melee',item=Gear.equipped(bag,slot),t=torso[n];
  c.save();c.beginPath();c.rect(...f.rect);c.clip();
  if(a&&item&&!(slot==='spear'&&item.rarity===3)){const [gx,gy,tx,ty]=a,len=Math.hypot(tx-gx,ty-gy);c.save();c.translate(gx,gy);c.rotate(Math.atan2(ty-gy,tx-gx));blade(c,len,slot,item.rarity);c.restore();}
  const bow=Gear.equipped(bag,'bow'),ba=Anchors.bows[id]?.[n];
  if(bow&&ba){const [gx,gy,tx,ty]=ba; c.save();c.translate(gx,gy);c.rotate(Math.atan2(ty-gy,tx-gx)+Math.PI/2);const len=Math.hypot(tx-gx,ty-gy);c.strokeStyle=colors[bow.rarity].metal;c.lineWidth=2.5;
   for(let s=0;s<=bow.rarity;s++){const q=.25+s*.13;c.beginPath();c.moveTo(-8,-len*q);c.lineTo(0,-len*q+3);c.stroke();}c.fillStyle=colors[bow.rarity].gold;c.fillRect(-6,9,6,13);c.restore();}
  if(t&&charm){c.save();c.translate(t[0]+1,t[1]+20);icon(c,charm,0,0,18);c.restore();}
  c.restore();
 }
 if(weaponSlot==='spear'&&Gear.isModao(bag)){
  // Expanded cells leave real space for the long blade in every orientation.
  const expanded=document.createElement('canvas');expanded.width=2560;expanded.height=Math.ceil(sheet.frames.length/4)*512;const out=expanded.getContext('2d');
  sheet.frames.forEach((f,n)=>{const [sx,sy,w,h]=f.rect,ox=n%4*640+(640-w)/2,oy=Math.floor(n/4)*512+(512-h)/2;
   out.drawImage(canvas,sx,sy,w,h,ox,oy,w,h);const a=Anchors.data[id]?.[n];if(!a)return;const [gx,gy,tx,ty]=a;
   out.save();out.beginPath();out.rect(n%4*640,Math.floor(n/4)*512,640,512);out.clip();out.translate(ox+gx-sx,oy+gy-sy);out.rotate(Math.atan2(ty-gy,tx-gx));blade(out,145,'spear',3);out.restore();
  });return expanded;
 }
 return canvas;
}
function images(base,atlas,bag,weapon){
 const k=key(bag,weapon);if(k!==lastKey||!proxy){root.PoseTween?.releaseImages(derived);derived={};lastKey=k;skinAtlas={...atlas};
 if(Gear.isModao(bag))for(const id of Object.keys(atlas).filter(id=>id.startsWith('hero-spear'))){const s=atlas[id];skinAtlas[id]={...s,size:[2560,Math.ceil(s.frames.length/4)*512],frames:s.frames.map((f,n)=>({...f,rect:[n%4*640,Math.floor(n/4)*512,640,512],anchor:[f.anchor[0]+(640-f.rect[2])/2,f.anchor[1]+(512-f.rect[3])/2]}))};}
 proxy=new Proxy(base,{get(target,id){if(typeof id!=='string'||!id.startsWith('hero-')||!atlas[id]||!target[id])return target[id];if(!derived[id])derived[id]=skin(target[id],atlas[id],id,bag);return derived[id];}});}
 return proxy;
}
root.EquipmentVisuals={images,icon,colors,key,skin,blade,atlas:()=>skinAtlas};
})(globalThis);
