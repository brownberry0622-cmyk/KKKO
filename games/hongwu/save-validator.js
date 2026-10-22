// Each request runs in its own worker, using the same validators as the chapter.
globalThis.window=globalThis;
onmessage=event=>{
 try{
  const {chapter,state}=event.data;if(!Number.isInteger(chapter)||chapter<1||chapter>8)throw Error('章节编号无效');
  const lists={
   1:['chapter01-model','chapter01-content','model','content','risk-model','history-data','history-model','autochess','operations','adapter'],
   2:['content','sequences','model','history-data','history-model','autochess','operations','adapter'],
   3:['content','art','sequences','model','history-data','history-model','autochess','operations','caishi-model','adapter']};
  importScripts(...(lists[chapter]||['autochess','operations','chapter'+chapter+'-content','chapter'+chapter+'-model']).map(n=>'chapter'+chapter+'/'+n+'.js'));
  const M=chapter===1?CampaignModel:globalThis['Chapter'+chapter+'Model'];
  let next=state;if(M.migrate)next=M.migrate(next);if(!M.validate(next))throw Error('第'+chapter+'章记录未通过完整校验');
  postMessage({ok:true,chapter,state:next,phase:next.phase});
 }catch(error){postMessage({ok:false,error:error.message});}
};
