(function(root){'use strict';
const preparations={
 repair:{id:'repair',name:'整备优先',equipment:9,training:1,routeKnown:false,blocks:['整备','整备','操练'],description:'补牢握柄、整好兵器，再合练一次。',cost:'3个准备时段 · 可用装备9套 · 操练1级'},
 drill:{id:'drill',name:'操练优先',equipment:8,training:2,routeKnown:false,blocks:['整备','操练','操练'],description:'修好急用装备，把余下时段用于分组与轮换。',cost:'3个准备时段 · 可用装备8套 · 操练2级'},
 scout:{id:'scout',name:'踏看优先',equipment:8,training:1,routeKnown:true,blocks:['整备','操练','踏看'],description:'看清溪沟和侧路，记住能带人折返的地方。',cost:'3个准备时段 · 可用装备8套 · 操练1级 · 侧路已知'}
};
const tactics={front:{id:'front',name:'正面掩护',minutes:60,fatigue:18,description:'以盾队守住通路，接到人后按序撤回。'},side:{id:'side',name:'侧路接应',minutes:120,fatigue:8,description:'沿已踏看的溪沟绕行，用一份绳具辅助通行。'},cover:{id:'cover',name:'交替掩护',minutes:90,fatigue:10,description:'两组轮换掩护，消耗六支箭，带人退回。'}};
function initial(){return {schema:1,phase:'intro',intro:0,preparation:null,tactic:null,turn:0,men:9,wounded:0,rescued:0,equipment:6,training:0,routeKnown:false,arrows:12,tools:2,fatigue:0,minutes:0,ledger:[],pendingPV:null,seen:[],lastResult:null};}
function copy(s){return JSON.parse(JSON.stringify(s));}
function log(s,type,text,delta){s.ledger.push({id:s.ledger.length+1,type,text,delta});}
function prepare(s,id){if(s.phase!=='prepare'||!preparations[id])throw Error('当前不可提交整备方案');const n=copy(s),p=preparations[id];n.preparation=id;n.equipment=p.equipment;n.training=p.training;n.routeKnown=p.routeKnown;n.minutes+=90;n.phase='prepPV';n.pendingPV='prep-'+id;n.lastResult={title:'帐下九夫',text:p.name+'已完成；九名部下仍归郭部编制。'};log(n,'准备',p.blocks.join(' → '),{minutes:90,equipment:p.equipment-s.equipment,training:p.training-s.training,routeKnown:p.routeKnown});return n;}
function forecast(s,id){const t=tactics[id];if(!t)return {allowed:false,reason:'未知方案'};let reason='';if(!s.preparation)reason='尚未完成准备';else if(id==='side'&&!s.routeKnown)reason='必须先踏看侧路';else if(id==='side'&&s.tools<1)reason='缺少一份可用绳具';else if(id==='cover'&&s.training<2)reason='需要操练2级';else if(id==='cover'&&s.arrows<6)reason='至少需要六支箭';return {...t,minutes:id==='front'&&s.equipment<9?75:t.minutes,fatigue:id==='front'&&s.equipment===9?12:t.fatigue,allowed:!reason,reason,wounded:id==='front'&&s.equipment+s.training<10?1:0,arrows:id==='cover'?6:0,tools:id==='side'?1:0};}
function dispatch(s,id){if(s.phase!=='mission')throw Error('当前不在行动准备阶段');const f=forecast(s,id);if(!f.allowed)throw Error(f.reason);const n=copy(s);n.tactic=id;n.phase='tactical';n.turn=0;log(n,'军令',f.name+'：接回应退军士，不追击。',{});return n;}
const steps=['布置掩护','接应第一人','接应余下两人','掩护队后撤','清点并回营'];
function advance(s){if(s.phase!=='tactical'||s.turn>=5)throw Error('无可推进的行动');const n=copy(s),f=forecast(s,s.tactic),index=s.turn;n.turn++;const delta={minutes:f.minutes/5,fatigue:f.fatigue/5,arrows:0,tools:0,wounded:0,rescued:0};
 if(s.tactic==='side'&&index===0){delta.tools=-1;n.tools--;}
 if(s.tactic==='cover'&&(index===0||index===2)){delta.arrows=-3;n.arrows-=3;}
 if(index===1){delta.rescued=1;n.rescued=1;if(f.wounded){delta.wounded=1;n.wounded=1;}}
 if(index===2){delta.rescued=2;n.rescued=3;}
 n.minutes+=delta.minutes;n.fatigue=Number((n.fatigue+delta.fatigue).toFixed(2));log(n,'执行',steps[index],delta);
 if(n.turn===5){n.phase='resultPV';n.pendingPV='return-'+s.tactic+(n.wounded?'-wound':'');n.lastResult={title:'接应归营',text:n.wounded?'三名应接军士已交回本部；九名部下中一人负伤，留营照料。':'三名应接军士已交回本部；九名部下全部归队。'};}
 return n;
}
function finishPV(s){if(!['prepPV','resultPV'].includes(s.phase))throw Error('当前没有待结算的PV');const n=copy(s);if(!n.seen.includes(n.pendingPV))n.seen.push(n.pendingPV);n.pendingPV=null;n.phase=s.phase==='prepPV'?'prepared':'complete';return n;}
function next(s){const n=copy(s);if(n.phase==='intro'){n.intro++;if(n.intro>=4)n.phase='prepare';}else if(n.phase==='prepared')n.phase='mission';else throw Error('当前不可继续');return n;}
function validate(s){if(!s||s.schema!==1||!['intro','prepare','prepPV','prepared','mission','tactical','resultPV','complete'].includes(s.phase))return false;
 if(!Array.isArray(s.ledger)||!Array.isArray(s.seen)||s.men!==9||!Number.isInteger(s.turn)||s.turn<0||s.turn>5)return false;
 for(const key of ['intro','wounded','rescued','equipment','training','arrows','tools','fatigue','minutes'])if(!Number.isFinite(s[key])||s[key]<0)return false;
 if(s.equipment>9||s.training>2||s.wounded>1||s.rescued>3||s.arrows>12||s.tools>2||s.intro>4)return false;
 if(s.preparation!==null&&!preparations[s.preparation]||s.tactic!==null&&!tactics[s.tactic])return false;
 if(['prepPV','resultPV'].includes(s.phase)&&typeof s.pendingPV!=='string')return false;
 return true;}
root.Chapter01Model=Object.freeze({initial,copy,prepare,forecast,dispatch,advance,finishPV,next,validate,preparations,tactics,steps});
})(typeof window!=='undefined'?window:globalThis);
