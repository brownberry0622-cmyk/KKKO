(function(){'use strict';
const M=HongwuAudioModel,$=id=>document.getElementById(id),panel=$('soundDialog'),video=$('chVideo');
const KEY='hongwu-audio-settings-v03';let prefs=M.cleanSettings(),ctx=null,current=null,sequence=0,loading=null,unlocked=false,audition=null,hidden=document.hidden,pv=false,reviewPV=false,reading=false,error='',fading=[];
let snapshot={year:1352,storyNode:'haozhou_service',nodeStatus:'active'};
const buffers=new Map(),offsets=new Map();
try{prefs=M.cleanSettings(JSON.parse(localStorage.getItem(KEY)||'{}'));}catch(_){/* Readable defaults when browser storage is unavailable. */}
const mapButton=document.createElement('button');mapButton.id='mapSound';mapButton.className='top-button audio-map-button';mapButton.setAttribute('aria-label','声音设置');mapButton.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4Z M16 8q4 4 0 8 M19 5q7 7 0 14"/></svg><span>开启声音</span>';document.querySelector('.top-right').prepend(mapButton);
const chapterButton=document.createElement('button');chapterButton.id='chSound';chapterButton.textContent='声音';$('chShowGallery').before(chapterButton);
$('soundTracks').innerHTML=Object.entries(M.tracks).map(([id,t])=>`<button data-track="${id}" aria-pressed="false"><b>${t.title}</b><small>${t.mood}</small><span>试听 →</span></button>`).join('');
function persist(){try{localStorage.setItem(KEY,JSON.stringify(prefs));}catch(_){} }
function state(){return {...prefs,unlocked,hidden,pv,reading,audition,snapshot};}
function paint(){
 const id=audition||M.resolve(snapshot),t=M.tracks[id]||{title:'此阶段待配乐',mood:'保留该剧情节点，待对应配乐接入'},active=!!current&&!hidden&&!pv&&!prefs.muted&&unlocked&&prefs.music>0;
 $('soundMode').textContent=audition?'制作试听 · 不改主线':'当前剧情 · '+(snapshot.storyNode==='haozhou_service'?'濠州帐下':snapshot.storyNode==='haozhou_siege'?'濠州城守':snapshot.storyNode==='haozhou_departure'?'离濠南行':'战役进行中');
 $('soundTrack').textContent=t.title;$('soundMood').textContent=t.mood;
 let status=error||(!unlocked?'点击开启声音，伴随地图进入军中。':prefs.muted?'已全部静音':hidden?'页面已离开，声音暂停':pv?'PV画面音效中 · 地图配乐已退下':loading?'正在载入配乐…':prefs.music===0?'背景音乐音量为零':active?(audition?'正在试听 · ':'正在播放 · ')+t.title+(reading&&!audition?'（对白时收低）':''):'配乐待播放');
 $('soundStatus').textContent=status;mapButton.querySelector('span').textContent=!unlocked?'开启声音':prefs.muted?'声音已静音':active?'声音 · 乐':'声音设置';mapButton.dataset.active=String(active);
 $('soundEnable').textContent=unlocked?(error?'重试播放':'声音已开启'):'开启声音';$('soundEnable').disabled=unlocked&&!error;
 $('soundMute').textContent=prefs.muted?'恢复声音':'全部静音';$('soundMute').setAttribute('aria-pressed',String(prefs.muted));$('soundRestore').hidden=!audition;
 $('musicVolume').value=Math.round(prefs.music*100);$('musicValue').textContent=Math.round(prefs.music*100)+'%';$('fxVolume').value=Math.round(prefs.fx*100);$('fxValue').textContent=Math.round(prefs.fx*100)+'%';
 panel.querySelectorAll('[data-track]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.track===audition)));
 $('chPVMute').textContent=prefs.fxMuted?'开启音效':'静音';
 if(pv&&!video.error)$('chPVStatus').textContent=(prefs.muted||prefs.fxMuted?'音效已静音':'画面音效')+' · 地图配乐已退下 · 无配音';
}
function ramp(g,value,seconds){const t=ctx.currentTime;g.gain.cancelAndHoldAtTime(t);g.gain.linearRampToValueAtTime(value,t+seconds);}
function stopCurrent(seconds=.25){
 if(!current||!ctx)return;const old=current;current=null;offsets.set(old.id,(old.offset+ctx.currentTime-old.started)%old.buffer.duration);ramp(old.gain,0,seconds);
 old.source.stop(ctx.currentTime+seconds+.015);fading.push(old);old.source.onended=()=>{old.source.disconnect();old.gain.disconnect();fading=fading.filter(x=>x!==old);};
}
async function getBuffer(id){
 if(buffers.has(id))return buffers.get(id);
 const response=await fetch('assets/audio/music/'+id+'.mp3');if(!response.ok)throw Error('配乐文件未找到');
 const b=await ctx.decodeAudioData(await response.arrayBuffer());buffers.set(id,b);return b;
}
function videoLevel(){const level=prefs.fx;video.volume=level;video.muted=prefs.muted||prefs.fxMuted;}
async function update(){
 const token=++sequence;videoLevel();const wanted=M.target(state());
 if(!ctx||!wanted.track){loading=null;stopCurrent(.18);if(ctx)for(const old of fading){ramp(old.gain,0,.12);try{old.source.stop(ctx.currentTime+.14);}catch(_){}}paint();return;}
 if(current&&current.id===wanted.track){loading=null;ramp(current.gain,wanted.gain,.45);paint();return;}
 stopCurrent(1.3);loading=wanted.track;paint();
 try{
  const b=await getBuffer(wanted.track);if(token!==sequence)return;
  const desired=M.target(state());if(desired.track!==wanted.track)return;
  const source=ctx.createBufferSource(),gain=ctx.createGain();source.buffer=b;source.loop=true;source.connect(gain);gain.connect(ctx.destination);gain.gain.value=0;
  const offset=offsets.get(wanted.track)||0;current={id:wanted.track,source,gain,buffer:b,offset,started:ctx.currentTime};source.start(0,offset);ramp(gain,desired.gain,1.3);loading=null;error='';paint();
 }catch(e){if(token!==sequence)return;loading=null;error='配乐未能载入，请点击“重试播放”。';paint();}
}
async function unlock(){
 try{if(!ctx)ctx=new(window.AudioContext||window.webkitAudioContext)();await ctx.resume();unlocked=ctx.state==='running';error='';update();}catch(_){error='浏览器尚未允许声音，请点击“开启声音”。';paint();}
}
function open(){if(!panel.open)panel.showModal();paint();}
mapButton.onclick=()=>{unlock();open();};chapterButton.onclick=()=>{unlock();open();};
$('soundEnable').onclick=unlock;$('soundClose').onclick=()=>panel.close();
panel.addEventListener('keydown',e=>{if(e.key==='Escape')e.stopPropagation();});
panel.addEventListener('close',()=>{if(audition){audition=null;update();}});
$('soundMute').onclick=()=>{prefs.muted=!prefs.muted;persist();unlock();};
$('musicVolume').oninput=e=>{prefs.music=Number(e.target.value)/100;persist();update();};
$('fxVolume').oninput=e=>{prefs.fx=Number(e.target.value)/100;prefs.fxMuted=false;persist();update();};
$('chPVMute').onclick=()=>{prefs.fxMuted=!prefs.fxMuted;persist();videoLevel();paint();};
video.addEventListener('volumechange',()=>{if(prefs.muted){if(!video.muted)video.muted=true;return;}prefs.fx=video.volume;prefs.fxMuted=video.muted;persist();paint();});
$('soundRestore').onclick=()=>{audition=null;update();};
panel.querySelectorAll('[data-track]').forEach(b=>b.onclick=()=>{audition=b.dataset.track;prefs.muted=false;persist();unlock();});
// The first ordinary interaction is an audio gesture; a saved mute preference is respected.
const firstGesture=()=>{if(!unlocked)unlock();};document.addEventListener('pointerdown',firstGesture,{once:true});document.addEventListener('keydown',firstGesture,{once:true});
function refreshContext(){const nextPV=reviewPV||$('chPV').open,nextReading=$('chShell').open||$('chHistory').open;if(nextPV!==pv||nextReading!==reading){pv=nextPV;reading=nextReading;update();}}
for(const d of [$('chPV'),$('chShell'),$('chHistory')])new MutationObserver(refreshContext).observe(d,{attributes:true,attributeFilter:['open']});
document.addEventListener('visibilitychange',()=>{hidden=document.hidden;if(hidden){if(!video.paused)video.pause();update();if(ctx)ctx.suspend();}else if(ctx&&unlocked){ctx.resume().then(update).catch(()=>{unlocked=false;paint();});}else paint();});
// Only committed story nodes affect actual campaign music; reviewing factions or panning never does.
document.addEventListener('hongwu:snapshot-committed',e=>{const s=e.detail;if(!s||!Number.isInteger(s.year)||s.year<1352||s.year>1368)return;snapshot={year:s.year,storyNode:s.storyNode||'haozhou_service',nodeStatus:s.nodeStatus||'active'};audition=null;update();});
window.HongwuAudio={setReviewPV:active=>{reviewPV=!!active;refreshContext();},resolve:M.resolve,openSettings:open,fxSettings:()=>({...prefs,unlocked,hidden,pv,reading})};paint();
})();
