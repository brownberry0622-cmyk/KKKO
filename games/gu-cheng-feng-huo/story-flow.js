(function(root){'use strict';
const $=id=>document.getElementById(id),video=$('introVideo');
let storage=null;try{storage=root.localStorage;}catch(_){}
let saved=CampaignState.read(storage),state='menu',ready=false,start=null,pending=null,activeChapter=1,activeDifficulty='easy',checkpoint=null,preview=false,worldRef=null,completeShown=false,clip=null,soundOn=true;
const clips={intro:{file:'序章.mp4',poster:'intro-poster.jpg',title:'序章 · 粮尽援绝'},breakout:{file:'transition-breakout.mp4',poster:'poster-breakout.jpg',title:'第一章 · 破围赴临淮'},linhuai:{file:'临淮拒宴.mp4',poster:'linhuai-poster.jpg',title:'第二章 · 临淮拒宴'},gift:{file:'真源赠马.mp4',poster:'gift-poster.jpg',title:'第三章 · 真源赠马'},muster:{file:'transition-muster.mp4',poster:'poster-muster.jpg',title:'第四章 · 宁陵会师'},return:{file:'transition-return.mp4',poster:'poster-return.jpg',title:'第五章 · 雾开睢阳'},finale:{file:'transition-finale.mp4',poster:'poster-finale.jpg',title:'第六章 · 孤城终章'}};
const stamp=s=>String(Math.floor(s/60)).padStart(2,'0')+':'+String(Math.floor(s%60)).padStart(2,'0');
const selectedDifficulty=()=>ChapterData.difficulty($('difficultySelect').value).id;
function describeDifficulty(){const d=ChapterData.difficulty(selectedDifficulty());$('difficultyHint').textContent=d.name+'：开场随行 '+d.riders+' 骑 · 真源赠马 '+d.horses+' 匹。兵种生命、伤害与技能数值不变。';}
function refresh(){saved=CampaignState.read(storage);$('continueCampaign').hidden=!saved;$('continueCampaign').disabled=!!saved&&saved.completed===6;const d=ChapterData.difficulty(saved?.difficulty);$('continueCampaign').textContent=saved?.completed===6?'全篇已完成 · '+d.name:'继续主线 · 第'+(saved?.chapter||1)+'章 · '+d.name;
 $('saveHint').textContent=saved?(saved.completed===6?'六章求援路已完结。可重开征程或独立试玩。':'已保存第'+saved.chapter+'章章首进度 · '+d.name+(saved.migrated?'（已读取旧版进度）':'')+'。'):'先选择难度，再从序章开始；也可独立试玩任意章节。';describeDifficulty();}
function menu(){state='menu';pending=null;clip=null;WebAssets.clearVideo(video);['introLayer','storyEnd','pauseLayer','lossLayer','hud','partyHud','armyHud','bossHud','skillBar','woundHud','medicineBar','notice'].forEach(id=>$(id).hidden=true);$('menu').hidden=false;refresh();}
function begin(id,carry,practice=false,difficulty='easy'){
 const mode=ChapterData.difficulty(difficulty).id;
 if(!ready||!start){pending={id,carry:CampaignState.clone(carry),practice,difficulty:mode};state='loading';$('menu').hidden=false;$('loadingText').textContent='正在准备关卡原画…';return;}
 pending=null;activeChapter=id;activeDifficulty=mode;checkpoint=CampaignState.clone(carry);preview=practice;completeShown=false;worldRef=null;
 if(!preview)CampaignState.write(storage,id,carry,Math.max(0,id-1),mode);
 state='chapter';start(id,CampaignState.clone(carry),mode);
}
function status(){const t=video.currentTime||0,total=Number.isFinite(video.duration)?video.duration:0;$('introTime').textContent=stamp(t)+' / '+stamp(total);$('introProgress').max=total||1;$('introProgress').value=t;$('introPause').textContent=video.paused?'继续动画':'暂停动画';$('introAudio').textContent=video.muted?'开启 PV 音效':'关闭 PV 音效';}
async function play(){
 const requested=clip;if(!requested)return;$('introRetry').hidden=true;
 try{
  const ok=await WebAssets.setVideo(video,'assets/'+requested.file,(done,total)=>{if(clip===requested)$('introState').textContent='正在载入过场 '+Math.floor(done/total*100)+'% · 可随时跳过';});
  if(!ok||clip!==requested)return;
  $('introState').textContent='字幕与环境音版';await video.play();if(clip===requested)status();
 }catch(error){if(clip!==requested||error.name==='AbortError')return;$('introRetry').hidden=false;$('introState').textContent='点击继续播放重试，或跳过剧情';status();}
}
function cue(){if(clip?.story&&clip.key==='linhuai'&&(video.currentTime||0)>=58.6789583333&&worldRef)worldRef.applyFingerInjury();}
function applyStory(key){if(!worldRef)return;if(key==='linhuai')worldRef.applyFingerInjury();if(key==='gift')worldRef.grantHorses();if(key==='muster')worldRef.grantReinforcements();if(key==='return')worldRef.returnToCity();if(key==='finale')worldRef.finishCampaign();}
function finish(){if(state!=='cinematic'||!clip)return;const done=clip;clip=null;state='transition';WebAssets.clearVideo(video);$('introLayer').hidden=true;if(done.story)applyStory(done.key);done.after();}
function playClip(key,after,story=false,difficulty=selectedDifficulty()){
 const base=clips[key]||clips.intro,mode=ChapterData.difficulty(difficulty);const spec=key==='gift'&&mode.id==='hard'?{...base,file:'transition-gift-hard.mp4',poster:'poster-gift-hard.jpg'}:base;
 clip={key,after,story,file:spec.file};state='cinematic';['menu','storyEnd','pauseLayer','lossLayer','hud','partyHud','armyHud','bossHud','woundHud','skillBar','medicineBar','notice'].forEach(id=>$(id).hidden=true);
 $('introLayer').hidden=false;$('cinematicTitle').textContent=spec.title+' · '+mode.name;
 $('introState').textContent=key==='intro'?'史实序章 · 本局随行 '+mode.riders+' 骑':key==='linhuai'?(story?'断指伤势将保留 · 无配音动态漫版':'重看不改变角色状态 · 无配音动态漫版'):key==='gift'?'本局补给 '+mode.horses+' 匹 · 字幕与环境音版':'字幕与环境音版 · '+(story?'跳过仍结算剧情':'重看不改变角色状态');
 $('skipIntro').textContent=story?'跳过剧情，继续 →':key==='intro'?'跳过 / 继续 →':'跳过 / 返回 →';
 WebAssets.clearVideo(video);video.poster=WebAssets.url('assets/'+spec.poster);video.muted=!soundOn;video.volume=.85;$('introRetry').hidden=true;play();
}
function ending(world){
 worldRef=world;if(world.player.dead){state='chapter';$('introLayer').hidden=true;$('hud').hidden=false;$('lossStats').textContent='伤势导致生命耗尽 · 重试恢复本章出发状态';$('lossLayer').hidden=false;return;}
 state='complete';const plan=world.plan,carry=world.exportCarry(),mode=ChapterData.difficulty(world.difficulty);
 if(!preview)CampaignState.write(storage,plan.next||6,carry,plan.id,mode.id);
 $('endEyebrow').textContent=plan.title+' · '+mode.name+(preview?' / 独立试玩':'');$('endTitle').textContent=plan.endTitle;$('endDescription').textContent=plan.endText;
 $('endStats').textContent='击破敌军 '+world.stats.kills+' / '+world.total+' · 随行精骑 '+world.escortSurvivors.length+' / '+world.escortCapacity+(world.finaleTriggered?' · 尹子奇已逼退（10%）':'')+' · 南霁云生命 '+CombatBalance.round(world.player.hp)+' / '+world.player.maxHp+' · 背包装备 '+world.gear.items.length+' 件';
 const messages={1:'重围已破，向临淮继续求援。',2:'断指已扣20生命；随后180秒有效战斗时间内，每10秒扣2点。',3:'获赠战马 '+world.campaignFlags.horsesGifted+' 匹，已记入补给。赠马不增加骑兵人数。',4:'廉坦三千步骑加入援军。下一章由身边12名步骑援兵参与战斗。',5:'大军约1000人进入睢阳。关卡中的身边队伍与大军叙事数值分别记录。',6:'全六章已完成。睢阳陷落为历史结局，终章战斗不改写这一结局。'};
 $('endMechanic').textContent=messages[plan.id];$('endNext').textContent=plan.next?'下一章：'+ChapterData.getChapter(plan.next).title:'全篇完 · 可选择其他难度再走求援路';$('nextChapter').hidden=!plan.next;$('nextChapter').textContent='继续 · '+(plan.next?ChapterData.getChapter(plan.next).title:'');
 ['hud','partyHud','armyHud','bossHud','skillBar','woundHud','medicineBar','notice'].forEach(id=>$(id).hidden=true);$('storyEnd').hidden=false;refresh();
}
$('skipIntro').onclick=finish;$('introRetry').onclick=()=>{WebAssets.clearVideo(video);play();};$('introPause').onclick=()=>{if(video.paused)play();else video.pause();status();};$('introAudio').onclick=()=>{soundOn=video.muted;video.muted=!soundOn;status();};
$('difficultySelect').onchange=describeDifficulty;
$('duelPractice').onclick=()=>{const d=selectedDifficulty();begin(6,{...CampaignState.previewCarry(6,d),duelPractice:true},true,d);};
$('replayIntro').onclick=()=>playClip('intro',menu);
$('watchPV').onclick=()=>playClip($('pvSelect').value,menu);
$('newCampaign').onclick=()=>{const d=selectedDifficulty();playClip('intro',()=>begin(1,null,false,d),false,d);};
$('continueCampaign').onclick=()=>{refresh();if(saved&&saved.completed<6)begin(saved.chapter,saved.carry,false,saved.difficulty);};
$('nextChapter').onclick=()=>{if(state==='complete'&&worldRef?.plan.next)begin(worldRef.plan.next,worldRef.exportCarry(),preview,activeDifficulty);};
$('chapterReplay').onclick=()=>begin(activeChapter,checkpoint,preview,activeDifficulty);
$('endingIntro').onclick=()=>{const w=worldRef;playClip(w.plan.transition,()=>ending(w),false,activeDifficulty);};$('endingMenu').onclick=menu;
video.addEventListener('timeupdate',()=>{status();cue();});video.addEventListener('ended',finish);video.addEventListener('play',status);video.addEventListener('pause',status);
video.addEventListener('error',()=>{if(!clip)return;$('introRetry').hidden=false;$('introState').textContent='动画未载入。可重试或跳过；剧情效果仍会保留。';});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&state==='cinematic')video.pause();});
root.StoryFlow={attach(fn){start=fn;if(pending&&ready)begin(pending.id,pending.carry,pending.practice,pending.difficulty);},assetsReady(){ready=true;if(pending&&start)begin(pending.id,pending.carry,pending.practice,pending.difficulty);},blocking:()=>state!=='chapter',introSound:()=>false,
 inBattle(){state='chapter';completeShown=false;$('introLayer').hidden=true;WebAssets.clearVideo(video);},
 complete(world){if(completeShown||world.status!=='won')return;completeShown=true;worldRef=world;activeDifficulty=world.difficulty;world.clearInput();playClip(world.plan.transition,()=>ending(world),true,activeDifficulty);},
 select(){const id=Number($('chapterSelect').value),d=selectedDifficulty();begin(id,CampaignState.previewCarry(id,d),true,d);},menu,replay(){begin(activeChapter,checkpoint,preview,activeDifficulty);},state:()=>({state,chapter:activeChapter,difficulty:activeDifficulty,preview,clip:clip?.key||null})};
menu();
})(globalThis);
