(function(root){'use strict';
const C=root.CampaignContent,O=root.Operations,copy=O.clone;
const clamp=(v,a=0,b=100)=>Math.min(b,Math.max(a,v));
const CH=C.chapter,SCHEMA=CH*10+1;
const BUDGET=Number.isFinite(C.budget)?C.budget:Math.ceil(C.nodes.reduce((n,e)=>n+Math.max(...Object.values(e.choiceEffects).map(c=>c.cost)),0)*1.25)+20;
const SUPPORT=C.supportBudget||60,current=s=>C.nodes[s.node];
const canon=n=>String(n).replace(/（.*?）/g,'').trim();
const phasePost=s=>['pv','result','complete'].includes(s.phase);
function initial(entry){
 const base={schema:SCHEMA,chapter:CH,node:0,phase:'brief',choice:null,op:null,pendingPV:null,frame:0,seen:[],log:[],reports:[],monthlySeen:[],
  grain:entry?.grain??1200,parts:100,cloth:100,fatigue:entry?.fatigue??20,wounded:entry?.wounded??0,equipment:entry?.equipment??88,cohesion:entry?.cohesion??72,
  houseGrain:entry?.houseGrain??120,projectFund:BUDGET,hours:0,fieldStores:120,convoys:8,careSupplies:SUPPORT,supportUsed:0,
  controlled:[...new Set([...(C.initialControlled||[]),...(entry?.controlled||[])])],met:[...new Set([...(C.initialMet||[]),...(entry?.met||[])])],
  retired:[...new Set([...(C.deathLocks||[]),...(entry?.retired||[])])],whereabouts:{...(entry?.whereabouts||{}),...(C.initialWhereabouts||{})},
  aliases:{...(entry?.aliases||{}),...(C.initialAliases||{})},authority:C.initialAuthority||'吴王 · 应天',checkpoint:null,
  entry:entry?'承接上章的军仓、家账与人物去向':'本章独立开局 · 战术与军需均为演算预算'};
 return base;
}
function importPrevious(v){
 const ids=C.previousIDs||[],count=ids.length||C.previousNodeCount;
 if(!v||!count||!Array.isArray(v.reports)||v.reports.length!==count)throw Error('这不是上一章的完整承接记录。');
 if(v.schema!==undefined){if(v.schema!==(CH-1)*10+1||v.phase!=='complete'||v.node!==count-1)throw Error('请先完成上一章全部主线。');}
 else if(v.chapter!==CH||v.year!==C.previousYear)throw Error('承接章节或年份不符。');
 if(ids.length&&ids.some((id,i)=>v.reports[i]?.id!==id))throw Error('上一章事件次序不完整。');
 for(const k of ['grain','fatigue','wounded','equipment','cohesion','houseGrain'])if(!Number.isFinite(v[k])||v[k]<0||v[k]>1e7)throw Error('承接记录缺少有效的'+k);
 if(v.fatigue>100||v.equipment>100||v.cohesion>100||v.wounded>1000)throw Error('承接人物状态超出范围。');
 for(const k of ['met','retired','controlled'])if(!Array.isArray(v[k])||v[k].some(x=>typeof x!=='string'))throw Error('承接人物与城池记录不完整。');
 if(v.whereabouts&&typeof v.whereabouts!=='object')throw Error('人物去向无效。');
 const n=initial(v);n.log.push({node:'entry',text:'继承上一章资源和去向；另核本章项目额度'+BUDGET+'、野战补给票120、后勤办理额度'+SUPPORT+'。这些是游戏预算，不是史载军粮或兵额。'});return n;
}
function spec(s){const e=current(s),cfg=C.play[e.play]||C.play.audience;return {...cfg,id:e.id,title:e.title,brief:e.playBrief||e.body,teams:e.teams||cfg.teams,lanes:e.lanes||cfg.lanes,cards:e.cards,battleKind:e.battleKind,objective:e.objective,reliefAt:e.reliefAt||260,factionLabel:e.pov+'所部',arrivalText:e.arrivalText,firstLandingText:e.firstLandingText,reliefCavalry:!!e.reliefCavalry,nightRaid:!!e.nightRaid};}
function condition(s){return s.fatigue>=75?'疲军掉队：体力不足25，须交办轮换。':s.equipment<45?'器械失修：齐备低于45%，须补修。':s.wounded>=80?'医棚拥挤：待养达到80，须转运照护。':s.fieldStores<=8?'粮道告急：野战补给票不足9，须安排补给队。':s.cohesion<35?'队伍离散：凝聚低于35，须点名整队。':'';}
function support(s,kind){
 if(!['brief','result'].includes(s.phase))throw Error('当前军令已经下达，请在节点交接时办理军需。');
 if(!['rest','repair','care','convoy','muster'].includes(kind))throw Error('没有这项军需。');
 if(s.careSupplies<1)throw Error('本章后勤办理额度用尽。');
 if(kind==='repair'&&s.parts<5||kind==='care'&&s.cloth<5)throw Error('材料不足。');
 if(kind==='convoy'&&(s.convoys<1||s.projectFund<3))throw Error('补给队或项目额度不足。');
 if(kind==='rest'&&s.fatigue===0||kind==='repair'&&s.equipment===100||kind==='care'&&s.wounded===0||kind==='muster'&&s.cohesion===100||kind==='convoy'&&s.fieldStores>=120)throw Error('当前无需此项办理。');
 const n=copy(s);n.careSupplies--;n.hours+=kind==='convoy'?18:12;n.supportUsed++;
 if(kind==='rest')n.fatigue=clamp(n.fatigue-35);
 if(kind==='repair'){n.parts-=5;n.equipment=clamp(n.equipment+30);}
 if(kind==='care'){n.cloth-=5;n.wounded=Math.max(0,n.wounded-25);}
 if(kind==='convoy'){n.projectFund-=3;n.convoys--;n.fieldStores=Math.min(120,n.fieldStores+30);}
 if(kind==='muster'){n.cohesion=clamp(n.cohesion+25);n.fatigue=clamp(n.fatigue+3);}
 const label={rest:'轮换：疲劳−35',repair:'补修：修材−5，齐备+30',care:'照护转运：布料−5，25名待养交后方继续休养，不计即时治愈',convoy:'补给队到营：项目−3，补给票+30，补给队次数−1',muster:'点名整队：凝聚+25，疲劳+3'}[kind];
 n.log.push({node:current(n).id,text:label+'；后勤额度−1，办理'+(kind==='convoy'?18:12)+'小时。'});return n;
}
function forecast(s,choice){if(!['steady','urgent'].includes(choice))throw Error('未知方案。');return {choice,name:current(s).choices[choice],...current(s).choiceEffects[choice],allowed:!condition(s)};}
function begin(s,choice){
 if(s.phase!=='brief')throw Error('已经开始当前节点。');if(condition(s))throw Error(condition(s));const f=forecast(s,choice);
 if(s.projectFund<f.cost)throw Error('项目授权余额不足。');const n=copy(s);n.checkpoint=copy({...s,checkpoint:null});n.choice=choice;n.phase='operations';n.projectFund-=f.cost;n.fatigue=clamp(n.fatigue+f.fatigue);n.cohesion=clamp(n.cohesion+(f.cohesion||0));n.hours+=f.hours;n.fieldStores-=current(s).play==='battle'?3:1;n.op=O.initial(spec(n),n);
 if(n.op.chess)n.op=O.tick(n.op,{type:'formation',value:choice==='steady'?'screen':'wedge'},spec(n));
 n.log.push({node:current(n).id,text:f.name+'：项目−'+f.cost+'，办理'+f.hours+'小时，疲劳'+(f.fatigue>0?'+':'')+f.fatigue+'；野战补给票−'+(current(s).play==='battle'?3:1)+'。'});return n;
}
function tick(s,order){if(s.phase!=='operations')throw Error('不在现场指挥阶段。');const n=copy(s);n.op=O.tick(n.op,order,spec(n));return n;}
function retry(s){if(s.phase!=='operations'||s.op.status!=='failed'||!s.checkpoint)throw Error('当前不能重整。');return copy(s.checkpoint);}
function applyChanges(n,e){
 const c=e.changes||{};for(const p of e.foreground||[])if(p&&!n.met.includes(p))n.met.push(p);
 for(const p of c.meet||[])if(!n.met.includes(p))n.met.push(p);
 for(const p of [...(e.exits||[]),...(c.retire||[])])if(!n.retired.includes(p))n.retired.push(p);
 Object.assign(n.whereabouts,c.whereabouts||{});for(const d of e.exitDetails||[])n.whereabouts[d.name]=d.state;
 for(const [p,status]of Object.entries(n.whereabouts))if(/^dead|已故|战死|去世|处死|病逝/.test(status)&&!n.retired.includes(p))n.retired.push(p);
 for(const p of [...(e.cities||[]),...(c.control||[])])if(!n.controlled.includes(p))n.controlled.push(p);
 for(const p of [...(e.losses||[]),...(c.lose||[])])n.controlled=n.controlled.filter(x=>x!==p);
 if(c.authority)n.authority=c.authority;Object.assign(n.aliases,c.aliases||{});
 for(const r of C.monthly||[])if(r.after===e.id&&!n.monthlySeen.includes(r.id)){n.monthlySeen.push(r.id);n.log.push({node:r.id,text:'当期政务：'+r.event});}
 return n;
}
function finish(s){
 if(s.phase!=='operations'||s.op.status!=='won')throw Error('先完成现场目标。');const n=copy(s),e=current(n),r=n.op.receipt;
 n.fatigue=clamp(n.fatigue+r.fatigue);n.wounded+=r.wounded;n.equipment=clamp(n.equipment-r.wear);n.hours+=r.extraMinutes/60;
 n.reports.push({id:e.id,choice:n.choice,...r,orders:n.op.history});n.log.push({node:e.id,text:'现场交接：'+r.rounds+'窗口，新增待养'+r.wounded+'，额外'+r.extraMinutes+'分钟。'});
 applyChanges(n,e);n.phase='pv';n.pendingPV=e.id+'-'+n.choice;n.frame=0;return n;
}
function frame(s){if(s.phase!=='pv')throw Error('没有待看片段。');const n=copy(s);n.frame=Math.min(C.films[s.pendingPV].length,n.frame+1);return n;}
function finishPV(s){if(s.phase!=='pv'||s.frame<C.films[s.pendingPV].length)throw Error('先看完本段分镜。');const n=copy(s);if(!n.seen.includes(n.pendingPV))n.seen.push(n.pendingPV);n.pendingPV=null;n.phase='result';return n;}
function next(s){if(s.phase!=='result')throw Error('先完成本段叙事。');const n=copy(s);if(n.node===C.nodes.length-1){n.phase='complete';return n;}n.node++;n.phase='brief';n.choice=null;n.op=null;n.frame=0;n.checkpoint=null;n.supportUsed=0;return n;}
function validate(s){try{
 if(!s||s.schema!==SCHEMA||s.chapter!==CH||!Number.isInteger(s.node)||s.node<0||s.node>=C.nodes.length||!['brief','operations','pv','result','complete'].includes(s.phase))return false;
 for(const k of ['seen','log','reports','monthlySeen','controlled','met','retired'])if(!Array.isArray(s[k]))return false;
 for(const k of ['whereabouts','aliases'])if(!s[k]||typeof s[k]!=='object'||Array.isArray(s[k])||Object.values(s[k]).some(v=>typeof v!=='string'))return false;
 for(const k of ['grain','parts','cloth','fatigue','wounded','equipment','cohesion','houseGrain','projectFund','hours','frame','careSupplies','fieldStores','convoys'])if(!Number.isFinite(s[k])||s[k]<0||s[k]>1e7)return false;
 if(s.fatigue>100||s.equipment>100||s.cohesion>100||s.projectFund>BUDGET||s.wounded>1000||s.parts>100||s.cloth>100||s.careSupplies>SUPPORT||s.fieldStores>120||s.convoys>8)return false;
 if(['met','retired','controlled','seen','monthlySeen'].some(k=>s[k].some(x=>typeof x!=='string')||new Set(s[k]).size!==s[k].length))return false;
 if(s.reports.length!==s.node+(phasePost(s)?1:0)||s.reports.some((r,i)=>r.id!==C.nodes[i].id||!['steady','urgent'].includes(r.choice)))return false;
 if(s.seen.length!==s.node+(['result','complete'].includes(s.phase)?1:0)||s.seen.some((id,i)=>id!==C.nodes[i].id+'-'+s.reports[i]?.choice))return false;
 if(s.phase==='brief'&&(s.choice!==null||s.op!==null||s.pendingPV!==null))return false;
 if(s.phase!=='brief'&&!['steady','urgent'].includes(s.choice))return false;
 if(s.op&&!O.validate(s.op,spec(s)))return false;if(phasePost(s)&&s.op?.status!=='won')return false;
 if(s.phase==='pv'&&s.pendingPV!==current(s).id+'-'+s.choice||s.phase!=='pv'&&s.pendingPV!==null)return false;
 if(!Number.isInteger(s.frame)||s.frame>(C.films[current(s).id+'-'+s.choice]?.length||0))return false;
 if(s.phase==='complete'&&s.node!==C.nodes.length-1)return false;
 if((C.deathLocks||[]).some(p=>!s.retired.includes(p)))return false;
 for(let i=0;i<s.reports.length;i++){const changes=C.nodes[i].changes||{};for(const p of changes.retire||[])if(!s.retired.includes(p))return false;}
 return true;
 }catch{return false;}}
root.CampaignModel={initial,importPrevious,current,spec,forecast,condition,support,begin,tick,retry,finish,frame,finishPV,next,validate,budget:BUDGET,supportBudget:SUPPORT};root['Chapter'+CH+'Model']=root.CampaignModel;
if(typeof module!=='undefined')module.exports=root.CampaignModel;
})(globalThis);
