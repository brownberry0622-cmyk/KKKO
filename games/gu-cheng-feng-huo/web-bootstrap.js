(async function(){'use strict';
  const panel=document.getElementById('webLoading'),text=document.getElementById('webLoadingText');
  try{
    const keys=JSON.parse(document.body.dataset.webPreload||'[]');
    await WebAssets.prepare(keys,(done,total)=>{text.textContent='正在准备原画 '+done+' / '+total+'…';});
    for(const el of document.querySelectorAll('[data-web-poster]'))el.poster=WebAssets.url(el.dataset.webPoster);
    for(const el of document.querySelectorAll('[data-web-href]'))el.href=WebAssets.url(el.dataset.webHref);
    for(const el of document.querySelectorAll('img[data-web-src],audio[data-web-src]'))el.src=WebAssets.url(el.dataset.webSrc);
    if(keys.includes('assets/scene-2.png'))document.documentElement.style.setProperty('--web-scene-2','url("'+WebAssets.url('assets/scene-2.png')+'")');
    for(const el of document.querySelectorAll('script[data-runtime]'))await WebAssets.script(el.dataset.runtime);
    panel.remove();
  }catch(error){
    console.error(error);text.textContent='加载失败：'+error.message+'。请确认所有网页文件已上传，或点击重新加载。';
    const button=document.createElement('button');button.textContent='重新加载';button.onclick=()=>location.reload();panel.appendChild(button);
  }
})();
