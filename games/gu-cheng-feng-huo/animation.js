(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.AnimationCore=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const clips={};
function clip(id,label,sheet,frames,duration,loop=false,times){clips[id]={id,label,sheet,frames,duration,loop,times:times||frames.map((_,i)=>i*duration/frames.length)};}
clip('hero-idle','南霁云 · 呼吸待机','hero-react',[12,13,14,15],1.6,true);
clip('hero-walk','南霁云 · 行走循环','hero-move',[0,1,2,3],.64,true);
clip('hero-run','南霁云 · 奔跑循环','hero-move',[4,5,6,7],.48,true);
clip('hero-dash','南霁云 · 冲刺起落','hero-move',[8,9,10,11],.2);
clip('hero-jump','南霁云 · 起跳与落地','hero-move',[12,13,14,15],.7);
clip('hero-land','南霁云 · 落地缓冲','hero-move',[15,12],.13);
clip('bow-walk','南霁云 · 持弓行走','hero-bow-move',[0,1,2,3],.64,true);
clip('bow-run','南霁云 · 持弓奔跑','hero-bow-move',[4,5,6,7],.48,true);
clip('bow-dash','南霁云 · 持弓冲刺','hero-bow-move',[8,9,10,11],.2);
clip('bow-jump','南霁云 · 持弓跳跃','hero-bow-move',[12,13,14,15],.7);
clip('bow-land','南霁云 · 持弓落地','hero-bow-move',[15,12],.13);
clip('hero-melee','南霁云 · 普攻与收刀','hero-combat',[0,1,2,3,12,13,14,15],.4,false,[0,.06,.14,.21,.26,.30,.34,.38]);
clip('hero-melee2','南霁云 · 刀二段长距横斩','hero-combat',[8,9,10,12,13,14,15],.48,false,[0,.08,.18,.25,.32,.39,.45]);
clip('hero-counter','南霁云 · 格挡反击','hero-combat',[8,9,10,11,12,13,14,15],.57,false,[0,.08,.16,.25,.34,.42,.49,.54]);
clip('hero-guard','南霁云 · 抬刀格挡','hero-combat',[4,5,6,7],.24);
clip('hero-unguard','南霁云 · 放下格挡','hero-combat',[7,6,5,4],.16);
clip('hero-shoot','南霁云 · 搭箭拉弓放箭','hero-bow',[0,1,2,3],.52,false,[0,.07,.16,.25]);
clip('hero-airslash','南霁云 · 空中斩击','hero-bow',[4,5,6,7],.43,false,[0,.055,.12,.28]);
clip('hero-airbow','南霁云 · 空中射箭','hero-bow',[8,9,10,11],.52,false,[0,.07,.16,.25]);
clip('hero-drawbow','南霁云 · 收刀取弓','hero-bow',[12,13,14,15],.24);
clip('hero-drawsaber','南霁云 · 收弓拔刀','hero-bow',[15,14,13,12],.24);
clip('hero-bowidle','南霁云 · 持弓待机','hero-bow',[14],1,true);
clip('hero-pickup','南霁云 · 俯身拔箭入囊','hero-react',[0,1,2,3],.28);
clip('hero-hurt','南霁云 · 受击复位','hero-react',[4,5,6,7],.3);
clip('hero-death','南霁云 · 失衡倒地','hero-react',[8,9,10,11],.68);
clip('hero-mount','南霁云 · 踩镫上马','hero-mount',[0,1,2,3],.4);
clip('hero-dismount','南霁云 · 收势下马','hero-mount',[12,13,14,15],.4);
clip('mounted-idle','南霁云 · 骑乘待机','hero-mount',[8,9,10,11],1.5,true);
clip('mounted-run','南霁云 · 策马疾行','hero-mount',[4,5,6,7],.42,true);
clip('mounted-walk','南霁云 · 骑乘慢行','hero-mount',[8,9,10,11],.72,true);
clip('mounted-melee','南霁云 · 马上挥刀','hero-mount-combat',[0,1,2,3],.4,false,[0,.06,.14,.26]);
clip('mounted-melee2','南霁云 · 马上刀二段','hero-mount-combat',[1,0,2,3],.48,false,[0,.08,.18,.34]);
clip('mounted-shoot','南霁云 · 马上射箭','hero-mount-combat',[4,5,6,7],.52,false,[0,.07,.16,.25]);
clip('mounted-guard','南霁云 · 马上格挡','hero-mount-combat',[8,9],.18);
clip('mounted-unguard','南霁云 · 马上卸挡','hero-mount-combat',[9,8],.15);
clip('mounted-counter','南霁云 · 马上反击','hero-mount-combat',[9,10,11,9],.57,false,[0,.07,.16,.40]);
clip('mounted-hurt','南霁云 · 骑乘受击','hero-mount-combat',[12,13,14,15],.3);
clip('infantry-walk','步兵 · 接近循环','infantry-anim',[0,1,2,3],.7,true);
clip('infantry-attack','步兵 · 起手劈斩收势','infantry-anim',[4,5,6,7,0],1,false,[0,.28,.58,.72,.9]);
clip('infantry-windup','步兵 · 蓄势','infantry-anim',[4,5],.58,false,[0,.32]);
clip('infantry-recover','步兵 · 命中与收势','infantry-anim',[6,7,0],1,false,[0,.15,.34]);
clip('infantry-hurt','步兵 · 受击硬直','infantry-anim',[8,9,10,11],.3);
clip('infantry-death','步兵 · 跌倒终态','infantry-anim',[12,13,14,15],.64);
clip('archer-walk','弓兵 · 后撤循环','archer-anim',[0,1,2,3],.7,true);
clip('archer-attack','弓兵 · 搭箭放箭','archer-anim',[4,5,6,7,0],1.3,false,[0,.25,.57,.85,1.12]);
clip('archer-aim','弓兵 · 拉弓蓄势','archer-anim',[4,5,6],.85);
clip('archer-recover','弓兵 · 放箭收弓','archer-anim',[7,0],2,false,[0,.3]);
clip('archer-empty','弓兵 · 空箭囊反馈','archer-anim',[8,9],.6);
clip('archer-hurt','弓兵 · 中箭踉跄','archer-anim',[10,11],.26);
clip('archer-death','弓兵 · 倒地终态','archer-anim',[12,13,14,15],.68);
clip('cavalry-ready','骑兵 · 冲锋预备','cavalry-anim',[0,1,2,3],.95);
clip('cavalry-charge','骑兵 · 四拍冲锋','cavalry-anim',[4,5,6,7],.36,true);
clip('cavalry-recover','骑兵 · 减速收势','cavalry-anim',[8,9,0],1.3,false,[0,.2,.48]);
clip('cavalry-hurt','骑兵 · 受箭踉跄','cavalry-anim',[10,11],.24);
clip('cavalry-death','骑兵 · 人马倒地','cavalry-anim',[12,13,14,15],.8);

clip('spear-idle','马槊 · 持槊待机','hero-spear',[0],1,true);
clip('spear-walk','马槊 · 步行','hero-spear',[0,1,2,3],.64,true);
clip('spear-run','马槊 · 奔跑','hero-spear',[4,5,6,7],.48,true);
clip('spear-dash','马槊 · 冲刺','hero-spear',[4,5,6,7],.2);
clip('spear-melee','马槊 · 长距突刺','hero-spear',[8,9,10,11,0],.4,false,[0,.06,.14,.25,.35]);
clip('spear-guard','马槊 · 架槊格挡','hero-spear',[12,13],.18);
clip('spear-unguard','马槊 · 卸挡','hero-spear',[13,12,15],.16);
clip('spear-counter','马槊 · 格挡反刺','hero-spear',[12,13,14,15],.57,false,[0,.08,.16,.4]);
clip('spear-draw','马槊 · 持槊就位','hero-spear',[15,0],.2);
clip('spear-jump','马槊 · 跳跃','hero-spear-support',[8,9,8],.7,false,[0,.12,.4]);
clip('spear-airslash','马槊 · 空中突刺','hero-spear-support',[8,9,8],.43,false,[0,.12,.3]);
clip('spear-land','马槊 · 落地缓冲','hero-spear-support',[8],.13);
clip('spear-hurt','马槊 · 受击','hero-spear-support',[10],.3);
clip('spear-pickup','马槊 · 拾箭','hero-spear-support',[11],.28);
clip('spear-death','马槊 · 倒地','hero-spear-support',[12,13,14,15],.68);
clip('spear-mounted-idle','马槊 · 骑乘待机','hero-spear-support',[0],1,true);
clip('spear-mounted-walk','马槊 · 骑乘慢行','hero-spear-support',[0,1,2,3],.72,true);
clip('spear-mounted-run','马槊 · 骑乘疾驰','hero-spear-support',[0,1,2,3],.42,true);
clip('spear-mounted-melee','马槊 · 马上突刺','hero-spear-support',[4,5,6,7],.4,false,[0,.06,.14,.27]);
clip('spear-mounted-counter','马槊 · 马上反刺','hero-spear-support',[4,5,6,7],.57,false,[0,.08,.16,.4]);
clip('spear-mounted-guard','马槊 · 马上格挡','hero-spear-support',[3],.18);
clip('spear-mounted-unguard','马槊 · 马上卸挡','hero-spear-support',[3,0],.15);
clip('spear-mounted-hurt','马槊 · 骑乘受击','hero-spear-support',[3],.3);

const bladeTiming=[[.14,.4],[.18,.48],[.12,.36],[.18,.46],[.3,.68]];
const spearTiming=[[.18,.46],[.22,.52],[.2,.5],[.32,.72]];
const bladeNames=['撩','砍','抹','刺','力劈华山'],spearNames=['刺','掠','挑','砸'];
for(const [weapon,timings,names,sheet] of [['blade',bladeTiming,bladeNames,'hero-blade-chain'],['spear',spearTiming,spearNames,'hero-spear-chain']]){
 timings.forEach(([active,duration],i)=>{
  clip(weapon+'-chain-'+(i+1),(weapon==='blade'?'刀':'马槊')+' · '+(i+1)+'段 '+names[i],sheet,[i*4,i*4+1,i*4+2,i*4+3],duration,false,[0,active*.45,active,active+(duration-active)*.48]);
  clip('mounted-'+weapon+'-chain-'+(i+1),'骑乘'+(weapon==='blade'?'刀':'马槊')+' · '+names[i],weapon==='blade'?'hero-mount-combat':'hero-spear-support',weapon==='blade'?[0,1,2,3]:[4,5,6,7],duration,false,[0,active*.45,active,active+(duration-active)*.48]);
 });
}
clip('mounted-blade-charge','骑冲 · 刀劈砍（双倍）','hero-mount-combat',[0,1,2,3],.42,false,[0,.045,.1,.27]);
clip('mounted-spear-charge','骑冲 · 马槊贯穿（1.5倍）','hero-spear-support',[4,5,6,7],.42,false,[0,.045,.1,.27]);
clip('hero-pull','南霁云 · 拔回身上箭','hero-react',[4,5,6,7],.48,false,[0,.12,.24,.37]);
clip('spear-pull','马槊 · 拔回身上箭','hero-spear-support',[10,11,10],.48,false,[0,.12,.32]);
clip('mounted-pull','骑乘 · 拔回身上箭','hero-mount-combat',[12,13,14,15],.48);
clip('spear-mounted-pull','骑乘马槊 · 拔回身上箭','hero-spear-support',[3,0],.48);
for(const kind of ['infantry','archer','cavalry']){
 clip(kind+'-knockdown',({infantry:'步兵',archer:'弓兵',cavalry:'骑兵'})[kind]+' · 击倒',kind+'-anim',[12,13,14,15],.3);
 clip(kind+'-getup',({infantry:'步兵',archer:'弓兵',cavalry:'骑兵'})[kind]+' · 起身',kind+'-anim',[15,14,13,12,0],.4);
}
function attackClip(action,mounted=false){
 const weapon=action.weapon==='spear'?'spear':'blade';
 return action.charged?'mounted-'+weapon+'-charge':(mounted?'mounted-':'')+weapon+'-chain-'+action.combo;
}
function downPose(e,duration=1.5,rise=.4){return e.knockdownLeft>rise?sample(e.kind+'-knockdown',duration-e.knockdownLeft):sample(e.kind+'-getup',rise-e.knockdownLeft);}

const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
function sample(id,time){
 const c=clips[id];if(!c)throw Error('Unknown animation '+id);
 const t=c.loop?((time%c.duration)+c.duration)%c.duration:Math.max(0,Math.min(c.duration,time));
 let index=0;for(let i=1;i<c.times.length;i++)if(t+1e-8>=c.times[i])index=i;
 const pose={sheet:c.sheet,frame:c.frames[index],index,time:t,clip:c};
 // Blend only from an already displayed key pose: never reveal a future release/contact.
 const previous=index>0?index-1:c.loop?c.frames.length-1:-1;
 const interval=(c.times[index+1]||c.duration)-c.times[index];
 const gait=c.loop&&/(walk|run|charge)$/.test(id)&&typeof PoseTween!=='undefined'&&PoseTween.status()!=='fallback';
 const window=gait?interval:Math.min(c.loop?.045:.032,interval*.65);
 const contact=(/chain-|charge$|melee|counter|airslash/.test(id)&&!c.loop&&index===2)||(/shoot|airbow/.test(id)&&index===3)||(/^(infantry|archer)-recover$/.test(id)&&index===0)||id==='archer-attack'&&index===3;
 if(!contact&&previous>=0&&c.frames[previous]!==pose.frame&&window>0){
  const weight=gait?Math.max(0,Math.min(1,(t-c.times[index])/window)):smooth((t-c.times[index])/window);
  if(weight<1)pose.layers=[{sheet:c.sheet,frame:c.frames[previous],weight:1-weight},{sheet:c.sheet,frame:pose.frame,weight}];
 }
 // Root-anchored secondary motion removes long frozen holds without moving the hit box.
 const phase=t/c.duration*Math.PI*2;
 if(c.loop&&/(walk|run|charge)$/.test(id))pose.transform={y:-Math.abs(Math.sin(phase*2))*1.8,rotate:Math.sin(phase)*.009};
 else if(c.loop&&/idle$/.test(id))pose.transform={sy:1+Math.sin(phase)*.006};
 return pose;
}
function scaleFor(sheet){return sheet.includes('mount')||sheet==='cavalry-anim'?.76:sheet.startsWith('hero')?.65:.67;}
function layers(p){return p.layers||[{sheet:p.sheet,frame:p.frame,weight:1}];}
function mixPose(from,to,weight){
 const combined=new Map();
 for(const [p,w] of [[from,1-weight],[to,weight]])for(const l of layers(p)){
  const key=l.sheet+':'+l.frame,old=combined.get(key);combined.set(key,{...l,weight:(old?old.weight:0)+l.weight*w});
 }
 const ls=[...combined.values()].filter(l=>l.weight>.001).sort((a,b)=>b.weight-a.weight).slice(0,4),total=ls.reduce((n,l)=>n+l.weight,0);
 ls.forEach(l=>l.weight/=total);
 const a=from.transform||{},b=to.transform||{},transform={};
 for(const k of ['x','y','rotate','sx','sy']){const base=k==='sx'||k==='sy'?1:0;transform[k]=(a[k]??base)*(1-weight)+(b[k]??base)*weight;}
 return {...to,layers:ls,transform};
}
const scratch=new WeakMap();
function drawFrame(ctx,images,atlas,p,weight=1){
 const sheet=atlas[p.sheet],im=images[p.sheet];if(!sheet||!im)return;
 const f=sheet.frames[p.frame],s=f.scale||scaleFor(p.sheet);ctx.globalAlpha=weight;
 ctx.drawImage(im,...f.rect,-f.anchor[0]*s,-f.anchor[1]*s,f.rect[2]*s,f.rect[3]*s);
}
function draw(ctx,images,atlas,pose,x,y,facing=1,alpha=1,zoom=1){
 if(!pose)return;
 const ls=layers(pose).filter(l=>l.weight>.001),tr=pose.transform||{};
 ctx.save();ctx.translate(x+(tr.x||0),y+(tr.y||0));ctx.scale((facing===1?-1:1)*zoom,zoom);ctx.rotate(tr.rotate||0);ctx.scale(tr.sx||1,tr.sy||1);
 if(ls.length===1){drawFrame(ctx,images,atlas,ls[0],alpha);}
 else if(typeof PoseTween!=='undefined'&&PoseTween.draw(ctx,images,atlas,ls,alpha)){}
 else {
  let buffer=scratch.get(ctx);
  if(!buffer&&(typeof OffscreenCanvas!=='undefined'||typeof document!=='undefined')){
   const canvas=typeof OffscreenCanvas!=='undefined'?new OffscreenCanvas(512,288):Object.assign(document.createElement('canvas'),{width:512,height:288});
   buffer={canvas,ctx:canvas.getContext('2d')};scratch.set(ctx,buffer);
  }
  if(buffer){
   const c=buffer.ctx;c.setTransform(1,0,0,1,0,0);c.clearRect(0,0,512,288);c.save();c.translate(256,260);c.globalCompositeOperation='lighter';
   for(const l of ls)drawFrame(c,images,atlas,l,l.weight);c.restore();ctx.globalAlpha=alpha;ctx.drawImage(buffer.canvas,-256,-260);
  }else for(const l of ls)drawFrame(ctx,images,atlas,l,l.weight*alpha);
 }
 ctx.restore();
}
class Director{
 constructor(){this.clock=0;this.renderOffset=0;this.states=new Map();this.transitions=new Map();}
 get now(){this.lastNow=Math.max(this.lastNow||0,this.clock+this.renderOffset);return this.lastNow;}
 event(id,clip){this.transitions.set(id,{clip,at:this.clock});}
 advance(dt){this.clock+=Math.max(0,dt);}
 choose(e,descriptor){
  let v=this.states.get(e.id);
  const token=descriptor.token||descriptor.id;
  if(!v||v.token!==token||v.id!==descriptor.id||v.facing!==e.facing){
   const previous=v,oldClip=previous&&clips[previous.id],nextClip=clips[descriptor.id];
   const gait=oldClip&&oldClip.loop&&nextClip.loop&&!previous.still&&!descriptor.still&&/(walk|run|charge)$/.test(oldClip.id)&&/(walk|run|charge)$/.test(nextClip.id);
   const phase=gait?((this.now-previous.start)%oldClip.duration)/oldClip.duration:0;
   v={id:descriptor.id,token,facing:e.facing,still:descriptor.still,start:this.now-phase*nextClip.duration,at:this.now,from:previous&&previous.facing===e.facing?previous.pose:null};this.states.set(e.id,v);
  }
  const time=descriptor.time===undefined?this.now-v.start:descriptor.time;
  let p=sample(descriptor.id,time);if(descriptor.still)p={...p,layers:undefined,transform:undefined};
  const blend=/death|hurt|knockdown/.test(descriptor.id)?.045:/guard|chain|shoot/.test(descriptor.id)?.06:.10;
  if(v.from&&this.now-v.at<blend)p=mixPose(v.from,p,smooth((this.now-v.at)/blend));
  else v.from=null;
  v.pose=p;return p;
 }
 transition(id){const t=this.transitions.get(id);if(t&&this.clock-t.at<clips[t.clip].duration)return {id:t.clip,time:Math.max(0,this.now-t.at)};if(t)this.transitions.delete(id);return null;}
 elapsed(id){const s=this.states.get(id);return s?Math.max(0,this.now-s.start):0;}
}
return {clips,sample,scaleFor,draw,Director,attackClip,downPose,mixPose};
});
