(function(){'use strict';
 const marks={intro:31.8,breakout:7,linhuai:17,gift:8,'gift-hard':8,muster:14,return:13,finale:14};
 const stamp=t=>Math.floor(t/60).toString().padStart(2,'0')+':'+Math.floor(t%60).toString().padStart(2,'0');
 let active=null;
 document.querySelectorAll('article').forEach(a=>{
  const v=a.querySelector('video'),play=a.querySelector('.play'),seek=a.querySelector('.seek'),time=a.querySelector('.time'),mute=a.querySelector('.mute'),dialogue=a.querySelector('.dialogue');
  let loading=false,errorText='';
  const source=v.querySelector('source'),key=v.dataset.webSrc||source?.dataset.webSrc;
  function update(){play.textContent=loading?'载入中…':v.paused?'播放':'暂停';play.disabled=loading;dialogue.disabled=loading;seek.disabled=v.readyState<1;seek.max=Number.isFinite(v.duration)?v.duration:1;seek.value=v.currentTime||0;if(!loading)time.textContent=errorText||stamp(v.currentTime||0)+' / '+stamp(Number.isFinite(v.duration)?v.duration:0);mute.textContent=v.muted?'音效：关':'音效：开';}
  async function start(at){
    if(active&&active!==v)WebAssets.clearVideo(active);active=v;loading=true;errorText='';update();
    try{
      const ok=await WebAssets.setVideo(v,key,(done,total)=>{time.textContent='载入 '+Math.floor(done/total*100)+'%';});
      if(!ok||active!==v)return;
      if(v.readyState<1)await new Promise((resolve,reject)=>{
        const timer=setTimeout(()=>finish(new Error('影片解码超时')),15000);
        const loaded=()=>finish(),failed=()=>finish(new Error('影片未能解码'));
        function finish(error){clearTimeout(timer);v.removeEventListener('loadedmetadata',loaded);v.removeEventListener('error',failed);error?reject(error):resolve();}
        v.addEventListener('loadedmetadata',loaded,{once:true});v.addEventListener('error',failed,{once:true});
      });
      if(active!==v)return;if(at!==undefined){v.currentTime=at;a.scrollIntoView({behavior:'smooth',block:'start'});}else await v.play();
    }catch(error){if(error.name!=='AbortError'){errorText='加载失败，点击播放重试';WebAssets.clearVideo(v);}}
    finally{loading=false;update();}
  }
  play.onclick=()=>v.paused?start():v.pause();dialogue.onclick=()=>{v.pause();start(marks[a.id]);};
  seek.oninput=()=>{v.currentTime=Number(seek.value);update();};mute.onclick=()=>{v.muted=!v.muted;update();};
  for(const ev of ['loadedmetadata','timeupdate','play','pause','ended','emptied'])v.addEventListener(ev,update);update();
 });
})();
