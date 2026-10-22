(function(root,factory){const a=factory();if(typeof module==='object'&&module.exports)module.exports=a;else root.BattleAudio=a;})(globalThis,function(){'use strict';
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
function route(e){
 if(e.type==='allyHurt')return {name:'metal',variant:true,gain:.25};
 if(e.type==='enemySwing')return {name:'saber',variant:true,gain:.4};
 if(e.type==='swing')return {name:e.weapon==='spear'?'spear':'saber',variant:true,gain:e.finisher||e.charged?1:.7};
 if(e.type==='hit')return {name:['arrow','rain'].includes(e.kind)?'flesh':'metal',variant:!['arrow','rain'].includes(e.kind),gain:e.finisher||e.kind==='counter'?.94:.72};
 if(e.type==='skill')return ['rush','mountedRush'].includes(e.kind)?{name:'rush',gain:.9}:e.kind==='bladeWave'?{name:'saber',variant:true,gain:.85}:e.kind==='lift'?{name:'spear',variant:true,gain:.85}:e.kind==='fireShot'?{name:'draw',gain:.7}:null;
 if(e.type==='attackStart'&&e.kind==='shoot')return {name:'draw',gain:.65};
 const map={arrow:['bow',.8],enemyArrow:['bow',.45],arrowRain:['rain',.9],block:['block',.85],hurt:['flesh',.7],dash:['rush',.62],slam:['slam',.95],ogre:['ogre',.85],burnTick:['burn',.16],land:['step',.65],jump:['gear',.32],switch:['gear',.5],pickup:['gear',.4],lootPickup:['gear',.5],toughnessBreak:['metal',.8],medicine:['gear',.5],yinEntrance:['horn',.65],pull:['flesh',.35],mount:['gear',.6],won:['horn',.5],lost:['drum',.55],charge:['rush',.42]};
 const r=map[e.type];return r?{name:r[0],gain:r[1],variant:['step','metal'].includes(r[0])}:null;
}
class Soundscape{
 constructor(bank,Context){this.bank=bank;this.Context=Context;this.ctx=null;this.buffers={};this.enabled=true;this.volume=.65;this.ambienceVolume=.27;this.active=false;this.voices=new Set();this.last=new Map();this.walk=new Map();this.serial=0;this.listenerX=640;this.viewport=1280;this.ambient=null;this.loading=null;this.error=null;}
 async unlock(){
  if(!this.enabled)return false;
  try{
   if(!this.ctx){const Constructor=this.Context||(typeof window!=='undefined'&&(window.AudioContext||window.webkitAudioContext));if(!Constructor)throw Error('当前浏览器不支持 Web Audio');
    this.ctx=new Constructor();this.master=this.ctx.createGain();this.fx=this.ctx.createGain();this.bed=this.ctx.createGain();const limiter=this.ctx.createDynamicsCompressor();
    limiter.threshold.value=-10;limiter.knee.value=14;limiter.ratio.value=5;limiter.attack.value=.003;limiter.release.value=.14;
    this.fx.connect(this.master);this.bed.connect(this.master);this.master.connect(limiter);limiter.connect(this.ctx.destination);
    this.loading=Promise.all(Object.entries(this.bank).map(async([name,b64])=>{const bytes=Uint8Array.from(atob(b64),c=>c.charCodeAt(0));this.buffers[name]=await this.ctx.decodeAudioData(bytes.buffer);}));
   }
   await this.ctx.resume();await this.loading;this.error=null;this.sync();return true;
  }catch(e){this.error=e.message;return false;}
 }
 setEnabled(value){this.enabled=!!value;if(!value)this.stop();this.sync();}
 setActive(value,scene=0){const changed=this.active!==!!value;this.active=!!value;this.scene=scene;if(!value&&changed)this.stop();this.sync();}
 setVolume(value){this.volume=clamp(value,0,1);this.sync();}
 setAmbience(value){this.ambienceVolume=clamp(value,0,1);this.sync();}
 sync(){
  if(!this.ctx)return;const on=this.enabled&&this.active;
  this.master.gain.setTargetAtTime(on?this.volume:0,this.ctx.currentTime,.035);
  this.bed.gain.setTargetAtTime(this.ambienceVolume*(this.scene===1?.4:1),this.ctx.currentTime,.12);
  if(on&&!this.ambient&&this.buffers.ambience){const s=this.ctx.createBufferSource();s.buffer=this.buffers.ambience;s.loop=true;s.connect(this.bed);s.start();this.ambient=s;}
 }
 stop(){for(const v of this.voices){try{v.source.stop();}catch(_){}v.source.disconnect();v.gain.disconnect();if(v.pan)v.pan.disconnect();}this.voices.clear();this.walk.clear();this.last.clear();if(this.ambient){try{this.ambient.stop();}catch(_){}this.ambient.disconnect();this.ambient=null;}}
 play(name,options={}){
  if(!this.enabled||!this.active||!this.ctx||this.ctx.state!=='running')return false;
  const variant=options.variant?this.serial++%3:null,key=variant===null?name:name+variant,buffer=this.buffers[key];if(!buffer)return false;
  const now=this.ctx.currentTime,limit=name==='burn'?.14:name==='metal'||name==='flesh'?.04:.025;
  if(now-(this.last.get(name)??-99)<limit)return false;this.last.set(name,now);
  if(this.voices.size>=24){const first=this.voices.values().next().value;first.source.stop();first.source.disconnect();first.gain.disconnect();if(first.pan)first.pan.disconnect();this.voices.delete(first);}
  const source=this.ctx.createBufferSource(),gain=this.ctx.createGain(),pan=this.ctx.createStereoPanner?this.ctx.createStereoPanner():null;
  source.buffer=buffer;source.playbackRate.value=options.rate||(.97+((this.serial++*17)%9)*.0075);gain.gain.value=options.gain??.7;
  source.connect(gain);if(pan){pan.pan.value=clamp(options.pan||0,-.8,.8);gain.connect(pan);pan.connect(this.fx);}else gain.connect(this.fx);
  const v={source,gain,pan};this.voices.add(v);source.onended=()=>{this.voices.delete(v);source.disconnect();gain.disconnect();if(pan)pan.disconnect();};source.start();return true;
 }
 setListener(center,width=1280){this.listenerX=center;this.viewport=width;}
 spatial(x){const d=(x-this.listenerX)/(this.viewport*.5);return {pan:clamp(d*.7,-.8,.8),gain:clamp(1-Math.max(0,Math.abs(d)-.7)*.65,0,1)};}
 event(e,world){const r=route(e);if(!r)return false;const at=this.spatial(e.x??world?.player.x??this.listenerX);if(at.gain<=0)return false;
  const result=this.play(r.name,{...r,gain:r.gain*at.gain,pan:at.pan});if(e.type==='arrow'&&(e.fire||e.enchanted))this.play('fire',{gain:.55*at.gain,pan:at.pan});return result;}
 update(world){
  if(!this.active||!this.enabled)return;
  for(const e of [world.player,...world.enemies,...(world.allies||[])]){
   const mobile=!e.dead&&e.z===0&&!e.knockdownLeft&&!e.controlled&&e.moving;
   if(!mobile){this.walk.delete(e.id);continue;}
   const mounted=e.mounted||e.kind==='cavalry',interval=mounted?(e.running||e.state==='charge'?.24:.4):e.running?.26:.43;
   if(world.time-(this.walk.get(e.id)??-99)>=interval){this.walk.set(e.id,world.time);const at=this.spatial(e.x);if(at.gain>0)this.play(mounted?'hoof':'step',{variant:true,gain:(e.kind==='hero'?.6:.3)*at.gain,pan:at.pan});}
  }
 }
 status(){return this.error?'音频不可用：'+this.error:!this.enabled?'声音已关闭':!this.ctx?'点击开始以启用声音':Object.keys(this.buffers).length+'组战场音效已就绪';}
}
return {Soundscape,route};
});
