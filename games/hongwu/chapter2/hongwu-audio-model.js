(function(root){'use strict';
const tracks=Object.freeze({illness:{title:'道中灯影',mood:'低回 · 返濠养病'},gather:{title:'定远集众',mood:'克制渐起 · 整军谋事'},advance:{title:'滁阳晓行',mood:'向前 · 合伍进取'},defend:{title:'瓦梁归路',mood:'悲壮坚守 · 护民归城'},haozhou:{title:'濠州初起',mood:'克制 · 初起 · 渐生希望'},caishiji:{title:'采石破浪',mood:'上扬慷慨 · 破局向前'},hongdu:{title:'洪都孤城',mood:'悲壮坚守 · 承压不屈'},siege:{title:'濠城寒更',mood:'克制悲壮 · 疲兵守望'},departure:{title:'南行初曙',mood:'渐起希望 · 轻装向南'},poyang:{title:'鄱阳决澜',mood:'上扬慷慨 · 决战昂扬'}});
const battles={caishiji_battle:{year:1355,track:'caishiji'},hongdu_defense:{year:1363,track:'hongdu'},poyang_battle:{year:1363,track:'poyang'}};
function resolve(snapshot={}){
 if(snapshot.storyNode==='haozhou_siege' && [1352,1353].includes(snapshot.year))return 'siege';if(snapshot.storyNode==='haozhou_departure' && snapshot.year===1353)return 'departure';if([1353,1354].includes(snapshot.year)&&snapshot.nodeStatus==='active'&&/^chapter2_(illness|gather|advance|defend)$/.test(snapshot.storyNode))return snapshot.storyNode.slice(9);const b=battles[snapshot.storyNode];
 // The date alone, selected enemy, map position, or a completed battle cannot trigger a war score.
 if(b&&snapshot.year===b.year&&snapshot.nodeStatus==='active')return b.track;
 return (!snapshot.storyNode||snapshot.storyNode==='haozhou_service')&&(!snapshot.year||snapshot.year===1352||snapshot.year===1353)?'haozhou':null;
}
function cleanSettings(s={}){const volume=(v,d)=>typeof v==='number'&&Number.isFinite(v)?Math.max(0,Math.min(1,v)):d;return {music:volume(s.music,.48),fx:volume(s.fx,.8),muted:s.muted===true,fxMuted:s.fxMuted===true};}
function target(state){
 if(!state.unlocked||state.hidden||state.pv||state.muted)return {track:null,gain:0};
 const track=tracks[state.audition]?state.audition:resolve(state.snapshot);
 return {track,gain:state.music*(state.reading && !state.audition ? .36 : 1)};
}
const api={tracks,resolve,cleanSettings,target};if(typeof module!=='undefined')module.exports=api;else root.HongwuAudioModel=api;
})(typeof window!=='undefined'?window:globalThis);
