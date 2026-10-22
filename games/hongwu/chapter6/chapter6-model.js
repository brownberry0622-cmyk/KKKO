(function(root){'use strict';
const C=Chapter6Content,copy=Operations.clone,clamp=(v,a=0,b=100)=>Math.min(b,Math.max(a,v)),current=s=>C.nodes[s.node];
const canon=n=>n.replace(/（.*?）/g,'').replace('詹书／詹同','詹同').trim();
function initial(entry){const w={...C.initialWhereabouts,...(entry?.whereabouts||{})};w['徐达']='应天受任，随后督庐州与荆湘';w['冯国胜']='在世，按当期军职留任';w['廖永安']='被拘苏州，不可调遣';w['陈理']='据武昌，尚未出降';w['张定边']='在武昌辅陈理';
 return {schema:61,node:0,phase:'brief',choice:null,op:null,pendingPV:null,frame:0,seen:[],log:[],reports:[],monthlySeen:[],grain:entry?.grain??1200,parts:100,cloth:100,fatigue:entry?.fatigue??20,wounded:entry?.wounded??0,equipment:entry?.equipment??88,cohesion:entry?.cohesion??72,houseGrain:entry?.houseGrain??120,projectFund:140,hours:0,controlled:[...new Set(entry?.controlled||C.initialControlled)],met:[...new Set(entry?.met||C.initialMet)],retired:[...new Set([...C.deathLocks,'廖永安',...(entry?.retired||[])])].filter(n=>!['徐达','冯国胜'].includes(n)),whereabouts:w,authority:'吴国公 · 尚待正月奉位',chenSurrendered:false,checkpoint:null,supportUsed:0,careSupplies:36,entry:entry?'第五章承接':'第六章独立开局（演算预算）'};}
function importFifth(v){if(v?.schema===51){if(v.phase!=='complete'||v.node!==53)throw Error('请先完成第五章的全部主线');}else if(v?.chapter!==6||v.year!==1363||!Array.isArray(v.reports)||v.reports.length!==54)throw Error('这不是第五章的完整承接记录');
 for(const k of ['grain','fatigue','wounded','equipment','cohesion','houseGrain'])if(!Number.isFinite(v[k])||v[k]<0||v[k]>1e7)throw Error('承接记录缺少有效的'+k);
 if(v.fatigue>100||v.wounded>1000||v.equipment>100||v.cohesion>100)throw Error('人物状态超出范围');
 for(const k of ['met','retired'])if(!Array.isArray(v[k])||v[k].some(x=>typeof x!=='string'))throw Error('人物承接名单不完整');
 if(v.controlled&&(!Array.isArray(v.controlled)||v.controlled.some(x=>typeof x!=='string')))throw Error('城池记录不完整');
 const n=initial(v);n.controlled=n.controlled.filter(x=>!['武昌','赣州','宝庆','温州','永州'].includes(x));n.log.push({node:'entry',text:'承接第五章粮账、体力、待养与人物去向。本章另核140项目额度、36次后勤服务，为玩法预算；徐达等调离不等于死亡。'});return n;}
function spec(s){const e=current(s),cfg=C.play[e.play]||C.play.audience;return {...cfg,id:e.id,title:e.title,brief:e.playBrief,teams:e.teams||cfg.teams,lanes:e.lanes||cfg.lanes,cards:e.cards,battleKind:e.battleKind,objective:e.objective,reliefAt:e.reliefAt,factionLabel:e.pov+'所部'};}
function condition(s){return s.fatigue>=75?'疲军掉队：体力不足25，须先委派轮换。':s.equipment<45?'器械失修：齐备低于45%，须先补修。':s.wounded>=80?'医棚拥挤：待养达到80，须先转运照护。':'';}
function support(s,kind){if(!['brief','result'].includes(s.phase))throw Error('只能在节点间交办军需');if(!['rest','repair','care'].includes(kind))throw Error('没有这项军需');if(s.careSupplies<1)throw Error('本章后勤服务额度用尽');if(kind==='repair'&&s.parts<5||kind==='care'&&s.cloth<5)throw Error('材料不足');if(kind==='rest'&&s.fatigue===0||kind==='repair'&&s.equipment===100||kind==='care'&&s.wounded===0)throw Error('当前无需此项办理');const n=copy(s);n.careSupplies--;n.hours+=12;n.supportUsed++;if(kind==='rest')n.fatigue=clamp(n.fatigue-35);if(kind==='repair'){n.parts-=5;n.equipment=clamp(n.equipment+30);}if(kind==='care'){n.cloth-=5;n.wounded=Math.max(0,n.wounded-25);}n.log.push({node:current(n).id,text:({rest:'军府轮换：疲劳−35',repair:'军械有司补修：修材−5，齐备+30',care:'医棚转运：布料−5，25名待养转交后方，未算即刻治愈'})[kind]+'；12小时，后勤额度−1。'});return n;}
function forecast(s,choice){if(!['steady','urgent'].includes(choice))throw Error('未知方案');return {choice,name:current(s).choices[choice],...current(s).choiceEffects[choice],allowed:!condition(s)};}
function begin(s,choice){if(s.phase!=='brief')throw Error('已经开始当前节点');if(condition(s))throw Error(condition(s));const f=forecast(s,choice);if(s.projectFund<f.cost)throw Error('项目授权余额不足');const n=copy(s);n.checkpoint=copy({...s,checkpoint:null});n.choice=choice;n.phase='operations';n.projectFund-=f.cost;n.fatigue=clamp(n.fatigue+f.fatigue);n.cohesion=clamp(n.cohesion+f.cohesion);n.hours+=f.hours;n.op=Operations.initial(spec(n),n);
 if(n.op.chess){n.op=Operations.tick(n.op,{type:'formation',value:choice==='steady'?'screen':'wedge'},spec(n));if(n.op.chess.kind==='defense'&&choice==='urgent')for(const u of n.op.chess.units.filter(u=>u.side==='friend'&&!u.escaped))n.op=Operations.tick(n.op,{type:'order',id:u.id,order:'advance'},spec(n));}
 n.log.push({node:current(n).id,text:f.name+'：项目额度−'+f.cost+'，办理'+f.hours+'小时，疲劳'+(f.fatigue>0?'+':'')+f.fatigue+'。'});return n;}
function tick(s,o){if(s.phase!=='operations')throw Error('不在现场指挥阶段');const n=copy(s);n.op=Operations.tick(n.op,o,spec(n));return n;}
function retry(s){if(s.phase!=='operations'||s.op.status!=='failed'||!s.checkpoint)throw Error('当前不能重整');return copy(s.checkpoint);}
function monthly(n){const done=new Set(n.reports.map(r=>r.id));for(const r of C.monthly)if(r.month<=current(n).month&&done.has(r.after)&&!n.monthlySeen.includes(r.id)){n.monthlySeen.push(r.id);n.log.push({node:r.id,text:'当月政务：'+r.event});}return n;}
function finish(s){if(s.phase!=='operations'||s.op.status!=='won')throw Error('先完成现场目标');const n=copy(s),e=current(n),r=n.op.receipt;n.fatigue=clamp(n.fatigue+r.fatigue);n.wounded+=r.wounded;n.equipment=clamp(n.equipment-r.wear);n.hours+=r.extraMinutes/60;n.reports.push({id:e.id,choice:n.choice,...r,orders:n.op.history});n.log.push({node:e.id,text:'现场交接：'+r.rounds+'窗口，新增待养'+r.wounded+'，额外'+r.extraMinutes+'分钟。'});
 for(const p of e.cast.split(/[、，]/).map(canon))if(p&&!n.met.includes(p))n.met.push(p);
 for(const p of e.exits||[])if(!n.retired.includes(p))n.retired.push(p);for(const d of e.exitDetails||[])n.whereabouts[d.name]=d.state;
 for(const p of e.cities||[])if(!n.controlled.includes(p))n.controlled.push(p);
 if(e.id==='C6-01')n.authority='吴王 · 应天中书省';if(e.id==='C6-04A')n.chenSurrendered=true;
 if(e.id==='C6-06A')n.whereabouts['徐达']='庐州既下，准备转荆湘';if(e.id==='C6-06C')n.whereabouts['常遇春']='赣州围军，尚未接管城池';if(e.id==='C6-06D')n.whereabouts['徐达']='荆湘战区';if(e.id==='C6-F03')n.whereabouts['朱文忠']='升右丞，仍在浙东';
 n.phase='pv';n.pendingPV=e.id+'-'+n.choice;n.frame=0;monthly(n);return n;}
function frame(s){if(s.phase!=='pv')throw Error('没有待看片段');const n=copy(s);n.frame=Math.min(C.films[s.pendingPV].length,n.frame+1);return n;}
function finishPV(s){if(s.phase!=='pv'||s.frame<C.films[s.pendingPV].length)throw Error('先看完本段分镜');const n=copy(s);if(!n.seen.includes(n.pendingPV))n.seen.push(n.pendingPV);n.pendingPV=null;n.phase='result';return n;}
function next(s){if(s.phase!=='result')throw Error('先完成本段叙事');const n=copy(s);if(n.node===C.nodes.length-1){n.phase='complete';return n;}n.node++;n.phase='brief';n.choice=null;n.op=null;n.frame=0;n.checkpoint=null;n.supportUsed=0;monthly(n);return n;}
function validate(s){try{if(!s||s.schema!==61||!Number.isInteger(s.node)||s.node<0||s.node>=C.nodes.length||!['brief','operations','pv','result','complete'].includes(s.phase)||!['seen','log','reports','monthlySeen','controlled','met','retired'].every(k=>Array.isArray(s[k]))||!s.whereabouts||typeof s.whereabouts!=='object'||typeof s.chenSurrendered!=='boolean')return false;
 for(const k of ['grain','parts','cloth','fatigue','wounded','equipment','cohesion','houseGrain','projectFund','hours','frame','careSupplies'])if(!Number.isFinite(s[k])||s[k]<0||s[k]>1e7)return false;
 if(s.fatigue>100||s.equipment>100||s.cohesion>100||s.projectFund>140||s.frame>(C.films[current(s).id+'-'+s.choice]?.length||0)||s.wounded>1000||s.parts>100||s.cloth>100||s.careSupplies>36)return false;
 if(s.phase!=='brief'&&!['steady','urgent'].includes(s.choice))return false;if(s.op&&!Operations.validate(s.op,spec(s)))return false;
 if(s.phase==='pv'&&s.pendingPV!==current(s).id+'-'+s.choice||s.phase!=='pv'&&s.pendingPV!==null)return false;if(['pv','result','complete'].includes(s.phase)&&s.op?.status!=='won')return false;if(s.phase==='complete'&&s.node!==C.nodes.length-1)return false;
 if(s.controlled.some(p=>['赣州','宝庆','温州','永州'].includes(p)))return false;if(s.controlled.includes('武昌')!==s.chenSurrendered)return false;
 if(C.deathLocks.some(p=>!s.retired.includes(p)))return false;
 return true;}catch{return false;}}
root.Chapter6Model={initial,importFifth,current,spec,forecast,condition,support,begin,tick,retry,finish,frame,finishPV,next,validate};if(typeof module!=='undefined')module.exports=root.Chapter6Model;
})(globalThis);
