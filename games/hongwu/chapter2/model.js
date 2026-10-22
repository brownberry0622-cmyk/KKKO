(function(root){'use strict';
const C=root.Chapter2Content,copy=s=>JSON.parse(JSON.stringify(s)),clamp=(n,a=0,b=100)=>Math.max(a,Math.min(b,n));
const fields=['grain','reserve','parts','cloth','material','minutes','fatigue','wounded','cohesion','equipment','party','army','civilianSample','aidIssued','aidUsed','returnedGrain','horsesReturned','tacticalErrors'];
function current(s){return C.nodes[s.node];}
function log(s,text,delta={}){s.log.push({seq:s.log.length+1,node:current(s)?.id||'entry',text,delta});}
function add(s,delta,text){const applied={};for(const[k,v]of Object.entries(delta)){let next=s[k]+v;if(['fatigue','cohesion','equipment'].includes(k))next=clamp(next);if(next<0||!Number.isFinite(next))throw Error('资源不足：'+k);applied[k]=Math.round((next-s[k])*100)/100;s[k]=Math.round(next*100)/100;}log(s,text,applied);}
function initial(entry){
 const v=entry||{travelGrain:100,fatigue:24,wounded:0,followers:24,houseGrain:120};
 const s={schema:20,identityReviewed:false,node:0,phase:'story',contact:0,choice:null,step:0,pendingPV:null,seen:[],decisions:[],log:[],checkpoint:null,entry:{mode:entry?'chapter1':'standalone',travelGrain:v.travelGrain,fatigue:v.fatigue,wounded:v.wounded,houseGrain:v.houseGrain,followers:24},grain:v.travelGrain,reserve:600,parts:12,cloth:18,material:36,minutes:0,fatigue:clamp(v.fatigue),wounded:v.wounded,cohesion:65,equipment:88,party:25,army:24,civilianSample:0,aidIssued:0,aidUsed:0,returnedGrain:0,horsesReturned:0,tacticalErrors:0,authority:'retinue',cityHeld:false,risk:{fired:{},care:{},incident:null,cared:0},last:null};
 log(s,entry?'由第一章已完成记录承接；原存档不改动。':'第二章独立开局：100份行粮、疲劳24、无伤员；这是明示的标准承接样本。');
 log(s,'本章郭部授权应急额度：粮600份、修料12、裹伤布18、木料36。各节点执行队领粮另记；非史载库存。',{reserve:600,parts:12,cloth:18,material:36});
 if(v.fatigue>100)log(s,'第一章累计疲劳折算为第二章0—100体力表，原累计值保留在承接记录。');
 s.checkpoint=copy(s);return s;
}
function importFirst(v){
 if(v?.schema===10){if(v.phase!=='complete'||![7,8].includes(v.episode)||v.followers!==24||v.handed!==700)throw Error('请先完成第一章并导出完整存档；此文件尚未到首次离濠。');v={...v,travelGrain:v.travelGrain};}
 else if(v?.chapter!==2||v?.mouths!==25||v?.followers!==24||v?.handedTroops!==700)throw Error('此文件不是第一章完成存档或第二章承接记录。');
 if(![75,100].includes(v.travelGrain)||!Number.isFinite(v.fatigue)||v.fatigue<0||v.fatigue>1000||!Number.isInteger(v.wounded)||v.wounded<0||v.wounded>9||!Number.isFinite(v.houseGrain)||v.houseGrain<0)throw Error('承接数值不合法，未导入。');
 return initial(v);
}
function ready(s){if(s.risk.incident||s.pendingPV)throw Error('先处理营务或看完当前PV。');}
function talk(s){ready(s);if(s.phase!=='story')throw Error('当前不在交谈阶段');const n=copy(s);n.contact++;if(n.contact>=current(s).lines.length)n.phase='choose';return n;}
function effect(s,id){const o=current(s).options[id];if(!o)return null;const d={};for(const[k,v]of Object.entries(o.cost))d[k]=['grain','parts','cloth','material'].includes(k)?-v:v;return d;}
function forecast(s,id){const o=current(s).options[id];if(!o)return {allowed:false,reason:'未知方案'};const d=effect(s,id);let reason='';if(s.phase!=='choose')reason='先完成交谈';for(const[k,v]of Object.entries(d))if(s[k]+v<0)reason='所需'+({grain:'口粮',parts:'修料',cloth:'裹伤布',material:'木料'}[k]||k)+'不足，可先检查营务或返回检查点';const projected=copy(s);for(const[k,v]of Object.entries(d))projected[k]=['fatigue','cohesion','equipment'].includes(k)?clamp(s[k]+v):s[k]+v;return {...o,delta:d,after:projected,allowed:!reason,reason};}
function choose(s,id){ready(s);const f=forecast(s,id);if(!f.allowed)throw Error(f.reason);const n=copy(s);n.choice=id;n.phase='execute';n.step=0;n.tacticalErrors=0;n.decisions.push({node:current(s).id,choice:id});log(n,'下令：'+f.name);return n;}
const tactics={
 hengjian:[['隐蔽察看','直接暴露队形'],['等待侧队信号','未候后队先行'],['合击营门','追逐远处退兵']],
 chuzhou:[['确认接应位置','忽略接应标记'],['先联络后队','抢先挤入通路'],['收束军伍入城','追散离城兵马']],
 liuhe:[['查看垒上缺口','仅查看远处旗号'],['先放老幼前行','让辎重堵住出口'],['两翼护送撤离','前队全数离开']],
 ravine:[['伏在涧侧','提前站出涧口'],['等来兵渡涧','尚未渡涧便发'],['接应城中出兵','各队自行追远']]
};
function commands(s){const t=tactics[current(s).id];return t&&s.step<3?t[s.step]:null;}
function settleHistorical(n){const id=current(n).id;
 if(id==='return'){log(n,'返濠后半月养病：郭部另支25口×15日=375份、同期用尽；不扣郭家旧账。',{convalescenceIssued:375,convalescenceUsed:375});add(n,{minutes:21600,fatigue:-Math.min(n.fatigue,48),wounded:-n.wounded},'半月休养结束，历史疾病渐缓；同行伤员经过这一时段照护恢复。');n.risk.cared=0;}
 if(id==='envoy')log(n,'留香囊为信，费聚留察；渡口不成为个人领地。');
 if(id==='stockade'){n.army=3000;n.authority='field';log(n,'按史载三千壮士显示招集规模。三百人为本次郭部调用队，未重复加为3300。');}
 if(id==='hengjian'){n.army=20000;log(n,'横涧入营、张知院退；按史载精壮二万标记整军规模。原三千与该数不机械累加；军民七万单作史料叙述。');}
 if(id==='muster'){n.civilianSample=60;add(n,{aidIssued:180,aidUsed:180},'安顿军民演算窗口：另批60口×3日=180份救济粮，并悉数发放；不混入军粮。');}
 if(id==='chuzhou'){n.cityHeld=true;log(n,'按所采编年攻取滁州。军营、城门、仓储管理入口开放；仍在郭部统属下，不称独立国家。');}
 if(id==='guo'){n.army=30000;log(n,'郭子兴来滁阅军时，实录记部众三万余；以30000作约数标记。郭另带万众不合并算作主角新增私兵。');n.authority='restricted';log(n,'郭部主帅收回征讨调度权。余下经营与交流继续开放，当前不可自由发兵。');}
 if(id==='liuhe'){n.authority='authorized';n.civilianSample=60;add(n,{aidIssued:180,aidUsed:180},'瓦梁撤离队样本60口另领3日粮180份并发放；已护送回滁，不虚称史载全部撤民仅60人。');}
 if(id==='ravine'){add(n,{horsesReturned:12},'战术样本所获12匹马悉数归还，马匹净入库0；12为演算数，不冒充史载获马总数。');}
}
function detect(n){if(n.risk.incident)return;const id=current(n).id;const list=[['fatigue',n.fatigue>=60],['grain',n.grain/n.party<=1],['equipment',n.equipment<70],['cohesion',n.cohesion<45],['medical',n.wounded-n.risk.cared>=3]];for(const[k,yes]of list){if(yes&&!n.risk.fired[id+':'+k]){n.risk.fired[id+':'+k]=true;n.risk.incident={kind:k,resume:n.phase};if(k==='fatigue')add(n,{wounded:Math.min(1,n.party-n.wounded)},'低体力情境：一人落伍受伤，待养；并非新造历史事件。');if(k==='grain')add(n,{fatigue:5},'一日粮以下：配给核对造成劳顿。');if(k==='equipment')add(n,{equipment:-1},'装备低值：发现损坏一批，可用率再降1个百分点。');if(k==='cohesion')add(n,{minutes:30},'协同低值：号令传递失误，停队重整30分钟。');if(k==='medical')add(n,{minutes:20},'待照护伤员累积，安置伤员20分钟。');return;}}}
function advance(s,command){ready(s);if(s.phase!=='execute')throw Error('没有可执行命令');const n=copy(s),e=current(s),o=e.options[s.choice],cmd=commands(s);if(cmd){if(![0,1].includes(command))throw Error('请在战术图选择本步命令');log(n,'战术执行：'+cmd[command]);if(command===1){n.tacticalErrors++;add(n,{minutes:30,fatigue:4,cohesion:-4,wounded:1},'信号或接应失误，及时纠正并继续历史目标；本队承受实际代价。');}}
 log(n,o.steps[s.step]);n.step++;
 if(n.step===o.steps.length){add(n,effect(n,n.choice),'本段已完成，按已确认方案结算。');settleHistorical(n);n.phase='pv';n.pendingPV=e.id+'-'+n.choice;n.last={node:e.id,choice:n.choice,tacticalErrors:n.tacticalErrors};detect(n);}return n;
}
const careNames={fatigue:'疲兵轮休',grain:'口粮告急',equipment:'器械检修',cohesion:'号令重整',medical:'伤员照护'};
function careOptions(s,k){const hurt=Math.max(0,s.wounded-s.risk.cared),ratio=s.party;const options={
 fatigue:[{id:'rest',name:'停队轮休',delta:{minutes:120,fatigue:-25},pv:'care-fatigue-rest'},{id:'rotate',name:'短歇轮换',delta:{minutes:45,fatigue:-12},pv:'care-fatigue-rotate'}],
 grain:[{id:'supply',name:'请领核准应急粮',delta:{minutes:60,grain:ratio,reserve:-ratio},pv:'care-grain-supply'},{id:'ration',name:'重排配给、后队减负',delta:{minutes:90,fatigue:10},pv:'care-grain-ration'}],
 equipment:[{id:'repair',name:'领修料补械',delta:{minutes:90,parts:-2,equipment:12},pv:'care-equipment-repair'},{id:'pair',name:'调换急用兵械',delta:{minutes:90,fatigue:8,cohesion:2},pv:'care-equipment-pair'}],
 cohesion:[{id:'rest',name:'重新传令合队',delta:{minutes:90,cohesion:20,fatigue:3},pv:'cohesion-rest'},{id:'rotate',name:'分伍核对口令',delta:{minutes:45,cohesion:10,fatigue:5},pv:'cohesion-rotate'}],
 medical:[{id:'treat',name:'领布安排照护',delta:{minutes:60,cloth:-Math.max(1,Math.ceil(hurt/2)),fatigue:-5},pv:'care-medical-treat',care: hurt},{id:'carry',name:'轮换人手护送',delta:{minutes:90,fatigue:6},pv:'care-medical-carry',care:hurt}]
 };return (options[k]||[]).map(o=>({...o,allowed:Object.entries(o.delta).every(([f,v])=>['fatigue','cohesion','equipment'].includes(f)||s[f]+v>=0)&&(!(s.phase==='execute')||Object.entries(effect(s,s.choice)).every(([f,v])=>!['grain','parts','cloth','material'].includes(f)||s[f]+(o.delta[f]||0)+v>=0))}));}
function care(s,k,id){if(s.pendingPV&&!s.risk.incident)throw Error('先完成当前PV');if(s.phase==='complete')throw Error('本章已结算');if(s.risk.incident&&s.risk.incident.kind!==k)throw Error('先处理当前急报');const tag=current(s).id+':'+k;if(!s.risk.incident&&s.risk.care[tag])throw Error('本节点该类主动营务已用过');if(!s.risk.incident&&k==='medical'&&s.wounded<=s.risk.cared)throw Error('没有待照护伤员');const o=careOptions(s,k).find(x=>x.id===id);if(!o?.allowed)throw Error('物料不足，请选择不耗物料的替代安排');const n=copy(s);add(n,o.delta,careNames[k]+'：'+o.name);if(o.care)n.risk.cared=Math.min(n.wounded,n.risk.cared+o.care);n.risk.care[tag]=true;n.risk.incident=null;n.careResume={phase:n.phase,pv:n.pendingPV};n.pendingPV=o.pv;n.phase='carepv';return n;}
function finishPV(s){if(s.risk.incident)throw Error('先处理急报');if(!s.pendingPV||!['pv','carepv'].includes(s.phase))throw Error('没有待结束PV');const n=copy(s);if(!n.seen.includes(n.pendingPV))n.seen.push(n.pendingPV);n.pendingPV=null;if(n.phase==='carepv'){n.phase=n.careResume.phase;n.pendingPV=n.careResume.pv;delete n.careResume;detect(n);}else n.phase='result';return n;}
function next(s){ready(s);if(s.phase!=='result')throw Error('先完成结果PV');const n=copy(s);if(s.node===C.nodes.length-1){n.phase='complete';n.checkpoint=null;log(n,'第二章结束：滁州得完；1355和州与渡江尚未发生。');return n;}n.node++;n.phase='story';n.contact=0;n.choice=null;n.step=0;n.last=null;n.tacticalErrors=0;const e=current(n);if(n.grain)add(n,{grain:-n.grain,returnedGrain:n.grain},'前段未用任务公粮交回军仓；不可挪为私储。');n.party=e.party;add(n,{grain:e.ration},'本节点核准执行队'+e.party+'口、任务粮'+e.ration+'份；其余全军常规支给不纳入本队账。');if(n.wounded>=n.party)throw Error('执行队伤员超额');if(e.id==='envoy')log(n,'第一章同行24人不等于此次使团11名随员；其余人员留营。');if(e.id==='hengjian')log(n,'整军七日期间常规支给另账；接下来只演算120人前队任务耗用。');if(e.id==='guo'){add(n,{fatigue:-Math.min(n.fatigue,18),wounded:-n.wounded},'滁州驻守期间轮休与持续照护：前段伤员归养后恢复；非即时药物治愈。');n.risk.cared=0;}if(e.id==='liuhe'){n.authority='authorized';log(n,'经劝说郭子兴授权救六合，取得本次救援调度权。');}n.checkpoint=copy({...n,checkpoint:null});return n;}
function restore(s){if(!s.checkpoint)throw Error('无本节点检查点');const n=copy(s.checkpoint);n.checkpoint=copy(s.checkpoint);n.seen=[...s.seen];n.identityReviewed=!!s.identityReviewed;log(n,'返回本节点检查点，撤销这一节点的演算代价。');return n;}
function validate(s,checkpoint=false){
 if(!s||s.schema!==20||!Number.isInteger(s.node)||s.node<0||s.node>=C.nodes.length||!['story','choose','execute','pv','carepv','result','complete'].includes(s.phase))return false;
 if(fields.some(k=>!Number.isFinite(s[k])||s[k]<0)||s.fatigue>100||s.equipment>100||s.cohesion>100||s.wounded>s.party||s.grain>100000||s.reserve>100000||s.minutes>1e8)return false;
 if(!Array.isArray(s.log)||!Array.isArray(s.seen)||!Array.isArray(s.decisions)||!s.risk||!s.risk.fired||!s.risk.care||!Number.isFinite(s.risk.cared)||s.risk.cared<0||s.risk.cared>s.wounded)return false;
 const e=current(s);if(!Number.isInteger(s.contact)||s.contact<0||s.contact>e.lines.length||!Number.isInteger(s.step)||s.step<0||s.step>4||s.party!==e.party)return false;
 const base=s.phase==='carepv'?s.careResume?.phase:s.phase;if(!['story','choose','execute','pv','result','complete'].includes(base))return false;
 if(base==='story'&&s.contact>=e.lines.length||base!=='story'&&s.contact!==e.lines.length)return false;
 if(['execute','pv','result','complete'].includes(base)&&!e.options[s.choice])return false;
 if(base==='execute'&&s.step>=4||['pv','result','complete'].includes(base)&&s.step!==4)return false;
 if(base==='pv'&&(s.phase==='carepv'?s.careResume.pv:s.pendingPV)!==e.id+'-'+s.choice)return false;
 if(s.phase==='carepv'&&!/^(care-(fatigue-(rest|rotate)|grain-(supply|ration)|equipment-(repair|pair)|medical-(treat|carry))|cohesion-(rest|rotate))$/.test(s.pendingPV))return false;
 if(!['pv','carepv'].includes(s.phase)&&s.pendingPV!==null)return false;
 if(s.phase==='complete'&&s.node!==9)return false;
 if(s.risk.incident&&!careNames[s.risk.incident.kind])return false;
 if(s.checkpoint&&!checkpoint&&!validate(s.checkpoint,true))return false;return true;
}
function handoff(s){if(s.phase!=='complete')throw Error('尚未完成第二章');return {chapter:3,entry:'1354冬滁城得完，1355取和州待续',year:1354,protagonist:'朱元璋',authority:s.authority,city:'滁州',troopsReported:s.army,commandSample:s.party,grain:s.grain,reserve:s.reserve,fatigue:s.fatigue,wounded:s.wounded,equipment:s.equipment,cohesion:s.cohesion,horsesOwnedFromBattle:0,houseGrain:s.entry.houseGrain,decisions:s.decisions};}
root.Chapter2Model={initial,importFirst,current,talk,forecast,choose,advance,commands,finishPV,next,restore,validate,copy,care,careOptions,careNames,handoff,detect};
})(typeof window!=='undefined'?window:globalThis);
