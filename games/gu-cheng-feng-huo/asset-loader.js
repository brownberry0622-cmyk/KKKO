(function(root){'use strict';
  const base=new URL('.',document.currentScript.src),entries=root.WEB_ASSET_MANIFEST;
  const cache=new Map(),pending=new Map(),parts=new Map(),videoStates=new WeakMap();
  const abortError=()=>new DOMException('素材加载已取消','AbortError');
  function script(file,signal){return new Promise((resolve,reject)=>{
    const s=document.createElement('script');let timer;
    function done(error){clearTimeout(timer);signal?.removeEventListener('abort',cancel);s.remove();error?reject(error):resolve();}
    const cancel=()=>done(abortError());
    s.src=new URL(file,base).href;s.onload=()=>done();s.onerror=()=>done(new Error('无法加载 '+file));
    if(signal?.aborted){reject(abortError());return;}signal?.addEventListener('abort',cancel,{once:true});
    timer=setTimeout(()=>done(new Error('素材下载超时，请重试')),120000);document.head.appendChild(s);
  });}
  function accept(key,index,encoded){
    const data=parts.get(key);if(!data)return;
    const binary=atob(encoded),bytes=new Uint8Array(binary.length);
    for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
    data[index]=bytes;
  }
  function get(key,onProgress){
    if(cache.has(key))return Promise.resolve(cache.get(key));
    const entry=entries[key];if(!entry)return Promise.reject(new Error('缺少素材 '+key));
    if(!entry.parts){const url=new URL(key,base).href;cache.set(key,url);return Promise.resolve(url);}
    if(pending.has(key))return pending.get(key).promise;
    const controller=new AbortController(),data=[];parts.set(key,data);
    const promise=(async()=>{
      let total=0;
      for(let i=0;i<entry.parts.length;i++){
        await script(entry.parts[i],controller.signal);
        if(controller.signal.aborted)throw abortError();
        if(!data[i])throw new Error('素材分片损坏 '+entry.parts[i]);
        total+=data[i].length;onProgress?.(total,entry.bytes);
      }
      if(total!==entry.bytes)throw new Error('素材长度不完整 '+key);
      const url=URL.createObjectURL(new Blob(data,{type:entry.type}));cache.set(key,url);return url;
    })().finally(()=>{parts.delete(key);pending.delete(key);});
    pending.set(key,{controller,promise});return promise;
  }
  function release(key){
    pending.get(key)?.controller.abort();
    const url=cache.get(key);if(url?.startsWith('blob:'))URL.revokeObjectURL(url);cache.delete(key);
  }
  function clearVideo(video){
    const old=videoStates.get(video);videoStates.delete(video);
    video.pause();video.removeAttribute('src');video.load();if(old)release(old.key);
  }
  function setVideo(video,key,onProgress){
    const old=videoStates.get(video);if(old?.key===key)return old.promise;
    clearVideo(video);const state={key};videoStates.set(video,state);
    state.promise=get(key,onProgress).then(url=>{
      if(videoStates.get(video)!==state)return false;
      video.src=url;video.load();return true;
    }).catch(error=>{if(videoStates.get(video)===state)videoStates.delete(video);throw error;});
    return state.promise;
  }
  async function prepare(keys,progress){
    let next=0,complete=0;
    async function worker(){while(next<keys.length){const key=keys[next++];await get(key);progress?.(++complete,keys.length);}}
    await Promise.all(Array.from({length:Math.min(3,keys.length)},worker));
  }
  root.WebAssets={accept,get,release,prepare,setVideo,clearVideo,script,
    url(key){if(!cache.has(key))throw new Error('素材未准备 '+key);return cache.get(key);}};
})(globalThis);
