(function(root){'use strict';
const O=root.Chapter01Model,copy=s=>JSON.parse(JSON.stringify(s));
const episodes=[
{id:'marriage',chapter:3,title:'成家与嫌隙',date:'1352 · 濠州帐下',year:1352,scene:'home',contacts:['ma','guo'],options:{rest:{name:'及时劝解，留一时段歇息',steps:['向郭子兴陈明城中利害','往见诸帅，维持往来','回家歇息'],summary:'三个时段，90分钟；疲劳降低12，最低为0。'},watch:{name:'劝解之后，核实营门交接',steps:['向郭子兴陈明城中利害','往见诸帅，维持往来','核实各处营门与换哨'],summary:'三个时段，90分钟；保留疲劳，获得营门线索。救郭时少一次重复查问。'}}},
{id:'rescue',chapter:4,title:'闻难救郭',date:'1352 · 秋',year:1352,scene:'compound',contacts:['messenger','family','peng'],options:{direct:{name:'援兵一到，立即清路',steps:['确认拘押处','随援兵清开通道','揭瓦破屋','解开拘械','扶郭归家'],summary:'共120分钟；有营门线索则90分钟。疲劳+18；本次固定情境新增1名伤员。'},escort:{name:'先备护送，再行营救',steps:['备齐担架与裹伤布','确认拘押处','随援兵清开通道','揭瓦破屋','解械并护送'],summary:'共150分钟；有营门线索则120分钟。领用并消耗裹伤布2份；疲劳+12，无新增伤员。'}}},
{id:'siege1',chapter:5,title:'围城数月 · 接守',date:'1352 · 冬',year:1352,scene:'wall',contacts:['watchman'],options:{full:{name:'足食轮换',steps:['领本窗口粮料','六人守望、二人修缮、一人歇息','轮换两昼夜'],summary:'10人口径×2日×1份粮=20份。两日疲劳+4；修材−4，防御维持55。'},lean:{name:'减粮守望',steps:['领本窗口粮料','七人守望、二人修缮','轮换两昼夜'],summary:'10人口径×2日×0.8份粮=16份。疲劳+24；修材−4，防御维持55；多留4份粮。'}}},
{id:'siege2',chapter:5,title:'围城数月 · 粮尽',date:'1353 · 春',year:1353,scene:'wall',contacts:['rationer'],options:{full:{name:'足食轮换',steps:['核对本窗口粮料','六人守望、二人修缮、一人歇息','守完两昼夜'],summary:'粮−20，疲劳+4，修材−4；不从郭家私仓取粮。'},lean:{name:'减粮守望',steps:['核对本窗口粮料','七人守望、二人修缮','守完两昼夜'],summary:'粮−16，疲劳+24，修材−4。少食多留粮，但守军更疲惫。'}}},
{id:'siege3',chapter:5,title:'围城数月 · 替守',date:'1353 · 五月前后',year:1353,scene:'wall',contacts:['relief'],options:{rotate:{name:'先以预备队接替疲兵',steps:['点齐替守人员','交接受损门栅','分段换下疲兵','核点轮值与伤员'],summary:'用时120分钟，修材−2，疲劳−12（最低0）；保留箭矢，无新增伤员。'},press:{name:'原班稳住，立即加固',steps:['原班守住门栅','调取木料','集中加固','核点轮值与伤员'],summary:'用时60分钟，修材−2，疲劳+14；若执行前疲劳≥50，新增1名伤员，伤员归营休养。'}}},
{id:'salt',chapter:6,title:'以盐易米',date:'1353 · 解围之后',year:1353,scene:'market',contacts:['ma_supply','trader'],options:{fast:{name:'赶路取米',steps:['领盐十二份、行粮三十六份','出程一日','在怀远量盐换米','归程第一日','归程第二日与交仓'],summary:'10人、3日；郭家起始粮100，支出36，带回66，结余130；疲劳+24。峰值负重86/100。'},steady:{name:'缓行护粮',steps:['领盐十二份、行粮三十六份','出程两日','在怀远量盐换米','归程第一日','归程第二日与交仓'],summary:'10人、4日；郭家起始粮100，支出36，带回56，结余120；疲劳+12。峰值负重76/100。'}}},
{id:'recruit',chapter:7,title:'归乡募兵',date:'1353 · 六月前后',year:1353,scene:'village',contacts:['villager','xuda'],options:{repair:{name:'先补装备，再合伍',steps:['核验首批二百人','核验次批二百人','核验余下三百人','领取整备粮械','三日整备并复点'],summary:'以700人为演算代表数；装备420→500，操练1；粮3000−2100=900。疲劳+8。'},train:{name:'少修急用，多练轮换',steps:['核验首批二百人','核验次批二百人','核验余下三百人','领取整备粮械','四日训练并复点'],summary:'以700人为演算代表数；装备420→460，操练2；粮3000−2800=200。疲劳+12。'}}},
{id:'departure',chapter:8,title:'交兵离濠',date:'1353 · 南趋定远',year:1353,scene:'gate',contacts:['receiver','ma_farewell','xuda_depart'],options:{full:{name:'领足四日行粮',steps:['将七百人与剩余粮械交他将','核准同行与行粮','分担四日行粮','辞家与营中同袍','离开濠州'],summary:'另领100份授权行粮，25人口径可支4日；负重疲劳+16。离城时不预扣后两日。'},light:{name:'轻装携三日行粮',steps:['将七百人与剩余粮械交他将','核准同行与行粮','留粮二十五份、携三日粮','辞家与营中同袍','离开濠州'],summary:'另领75份授权行粮，留25份；25人口径可支3日；负重疲劳+8。'}}}
];
function initial(){return {schema:10,opening:O.initial(),phase:'opening',episode:-1,contacts:[],metOpening:false,choice:null,step:0,pendingPV:null,seen:[],log:[],minutes:0,fatigue:0,wounded:0,married:false,gateClue:false,bandages:0,wall:55,grain:0,material:0,houseGrain:0,salt:0,carried:0,recruits:0,equipment:0,training:0,followers:0,handed:0,travelGrain:0,decisions:[],checkpoint:null,prologueSeen:false};}
function record(n,text,delta={}){n.log.push({seq:n.log.length+1,episode:n.episode<0?'opening':episodes[n.episode].id,text,delta});}
function add(n,delta,text){for(const[k,v]of Object.entries(delta)){n[k]=Math.round((n[k]+v)*100)/100;if(n[k]<0)throw Error('物料不足：'+k);}record(n,text,delta);}
function current(s){return episodes[s.episode]||null;}
function opening(s,action,id){if(s.phase!=='opening')throw Error('已离开开篇任务');const n=copy(s);if(action==='meet'){n.metOpening=true;return n;}if(!s.metOpening)throw Error('请先在军营与郭部传令者交谈');if(!['next','prepare','dispatch','advance','finishPV'].includes(action))throw Error('未知军令');n.opening=O[action](s.opening,id);return n;}
function enterEpisode(n,i){n.episode=i;n.phase='story';n.contacts=[];n.choice=null;n.step=0;n.pendingPV=null;
 const e=episodes[i];
 if(e.id==='marriage'){n.married=true;record(n,'郭子兴以所抚马氏妻重八；家宅入口开放。婚礼细节为复原。');}
 if(e.id==='siege1'){if(n.wounded)add(n,{wounded:-n.wounded},'秋冬间伤员经留营照护恢复；非过场瞬间治愈。');add(n,{fatigue:-Math.min(n.fatigue,10)},'入冬前轮休，疲劳恢复10以内。');add(n,{grain:30,material:8},'郭部军仓拨两日防区粮30、修材8；公粮另账。');}
 if(e.id==='siege2'){const need=90*10;record(n,'冬至春期间，例行军粮分批拨付900份、消耗900份；只记录本队10人口径的90日过渡，天数是玩法预算。',{routineIssued:need,routineConsumed:need});add(n,{fatigue:-Math.min(n.fatigue,18),grain:20,material:4},'期间轮休恢复18以内；下一窗口军仓拨粮20、修材4。');}
 if(e.id==='siege3'){record(n,'由春转至解围前：例行拨粮450、消耗450（45日过渡预算）；并非围城精确日数。',{routineIssued:450,routineConsumed:450});add(n,{fatigue:-Math.min(n.fatigue,10),material:2},'轮休恢复10以内，军仓另拨修材2。');}
 if(e.id==='salt'){record(n,'元军退去，按所采用史序解除城守；无论资源优劣，不能靠属性提前逼退元军。');add(n,{grain:-n.grain,material:-n.material},'余下防区公粮与修材交回军仓。');add(n,{houseGrain:100,salt:12},'郭家授权专账：起始粮100、盐12。只为郭家筹粮，不是全城仓储。');if(n.wounded)add(n,{wounded:-n.wounded},'解围后留营照护结束，替守伤员恢复；换粮另组10人，不调未愈者。');}
 n.checkpoint=copy({...n,checkpoint:null});return n;
}
function startLater(s){if(s.phase!=='opening'||s.opening.phase!=='complete')throw Error('先完成接应归营');const n=copy(s);n.minutes=s.opening.minutes;n.fatigue=s.opening.fatigue;n.wounded=s.opening.wounded;n.seen=[...s.opening.seen];record(n,'开篇累计账转入：九夫编制、伤员与疲劳继续保留。',{minutes:n.minutes,fatigue:n.fatigue,wounded:n.wounded});return enterEpisode(n,0);}
function contact(s,id){const e=current(s);if(!e||s.phase!=='story'||e.contacts[s.contacts.length]!==id)throw Error('请依主线顺序确认消息');const n=copy(s);n.contacts.push(id);record(n,'已交谈并核实：'+id);if(n.contacts.length===e.contacts.length)n.phase='choose';return n;}
function forecast(s,id){const e=current(s),o=e?.options[id];if(!o)return {allowed:false,reason:'未知方案'};
 let reason='';if(s.phase!=='choose')reason='请先完成当前人物交谈';if(e.id.startsWith('siege')&&e.id!=='siege3'&&(s.grain<(id==='full'?20:16)||s.material<4))reason='粮料不足，可回到本节点检查点';if(e.id==='siege3'&&s.material<2)reason='木料不足';
 let summary=o.summary;
 if(e.id==='rescue')summary+=' 当前实际用时'+((id==='direct'?120:150)-(s.gateClue?30:0))+'分钟。';
 if(e.id==='siege3'&&id==='press')summary+=' 当前疲劳'+s.fatigue+'，预计新增伤员'+(s.fatigue>=50?1:0)+'。';
 if(e.id==='departure')summary+=' 即将交出本部粮'+s.grain+'、装备'+s.equipment+'。';
 return {...o,allowed:!reason,reason,summary};
}
function choose(s,id){const f=forecast(s,id);if(!f.allowed)throw Error(f.reason);const n=copy(s);n.choice=id;n.phase='execute';n.step=0;n.decisions.push({episode:current(s).id,choice:id});record(n,'下令：'+f.name);return n;}
function advance(s){if(s.phase!=='execute')throw Error('当前没有可执行命令');const n=copy(s),e=current(s),id=s.choice,k=s.step,steps=e.options[id].steps;n.step++;record(n,steps[k]);
 if(e.id==='marriage'){add(n,{minutes:30},'准备时段');if(k===2){if(id==='rest')add(n,{fatigue:-Math.min(n.fatigue,12)},'一时段歇息');else{n.gateClue=true;record(n,'营门交接已查实；这条线索不会取消随后发生的拘郭事件。');}}}
 if(e.id==='rescue'){add(n,{minutes:((id==='direct'?120:150)-(s.gateClue?30:0))/steps.length},'营救用时');if(id==='escort'&&k===0)add(n,{bandages:2},'郭家授权领出裹伤布2份');if(k===steps.length-1)add(n,{fatigue:id==='direct'?18:12,wounded:id==='direct'?1:0,bandages:id==='escort'?-2:0},'郭子兴归家；核对护送代价');}
 if(e.id==='siege1'||e.id==='siege2'){if(k===2)add(n,{grain:id==='full'?-20:-16,material:-4,fatigue:id==='full'?4:24,minutes:2880},'两昼夜结算：防御修复12与耗损12相抵，维持55');}
 if(e.id==='siege3'&&k===steps.length-1)add(n,{minutes:id==='rotate'?120:60,material:-2,fatigue:id==='rotate'?-Math.min(n.fatigue,12):14,wounded:id==='press'&&s.fatigue>=50?1:0},'替守结算；只是守住受任防区，不宣称击溃围城大军');
 if(e.id==='salt'){
  if(k===0)add(n,{houseGrain:-36,carried:36},'郭家行粮领出；盐12随队');
  if(k===1)add(n,{carried:id==='fast'?-10:-20,minutes:id==='fast'?1440:2880},'出程按日耗粮，未交易前不能食用未来换得的米');
  if(k===2){if(n.carried+60>100)throw Error('负重超过100份');add(n,{salt:-12,carried:60},'12份盐按1:5换60份米；比价与运力均为玩法参数');}
  if(k===3||k===4)add(n,{carried:-10,minutes:1440},'归程一日：10人各耗粮1份');
  if(k===4)add(n,{houseGrain:n.carried,carried:-n.carried,fatigue:id==='fast'?24:12},'全部余粮交郭家入仓');
 }
 if(e.id==='recruit'){
  if(k<3)add(n,{recruits:k===2?300:200},'分批点验登记；七百是演算代表值，史文有七百余人');
  if(k===3)add(n,{grain:3000,equipment:420},'郭部授权新募队整备公粮3000、可用装备420；九夫不另叠加为709');
  if(k===4)add(n,{grain:id==='repair'?-2100:-2800,equipment:id==='repair'?80:40,training:id==='repair'?1:2,minutes:id==='repair'?4320:5760,fatigue:id==='repair'?8:12},'招募后整备结算；受镇抚之职按史序推进');
 }
 if(e.id==='departure'){
  if(k===0){n.handed=n.recruits;add(n,{recruits:-n.recruits,grain:-n.grain,equipment:-n.equipment},'七百人与剩余粮械属他将；交接不变成个人领地');}
  if(k===1){n.followers=24;record(n,'采用“徐达等二十四人”同行口径；加主角一人，行粮计算按25口，非声称有完整花名册。');}
  if(k===2)add(n,{travelGrain:id==='full'?100:75,fatigue:id==='full'?16:8},'独立授权行粮预算100份；'+(id==='full'?'领足100':'领75、留25')+'，不侵占已移交粮械');
 }
 if(n.step===steps.length){n.phase='pv';n.pendingPV=e.id+'-'+id;}return n;
}
function finishPV(s){if(s.phase!=='pv'||!s.pendingPV)throw Error('无待完成片段');const n=copy(s);if(!n.seen.includes(n.pendingPV))n.seen.push(n.pendingPV);n.pendingPV=null;n.phase='result';return n;}
function next(s){if(s.phase!=='result')throw Error('请先完成本段结果PV');const n=copy(s);if(s.episode===episodes.length-1){n.phase='complete';n.checkpoint=null;record(n,'第一章止于首次离濠。实录记中途遇疾复还；第二章承接，不虚构已经攻取定远。');return n;}return enterEpisode(n,s.episode+1);}
function restore(s){if(!s.checkpoint)throw Error('此处无章节检查点');const n=copy(s.checkpoint);n.seen=[...s.seen];n.checkpoint=copy(s.checkpoint);record(n,'玩家回到本节点检查点，撤销本节点选择；这是重新推演。');return n;}
function handoff(s){if(s.phase!=='complete')throw Error('尚未完成第一章');return {chapter:2,entry:'首次离濠，中途遇疾复还待续',protagonist:'朱重八',year:1353,followers:s.followers,mouths:25,travelGrain:s.travelGrain,daysOfFood:s.travelGrain/25,fatigue:s.fatigue,wounded:s.wounded,handedTroops:s.handed,independentTerritory:0,houseGrain:s.houseGrain,sourceNote:'徐达等二十四人采用24名同行者加主角的演算口径；无伪造完整花名册。',decisions:s.decisions};}
function validate(s){if(!s||s.schema!==10||!O.validate(s.opening)||!['opening','story','choose','execute','pv','result','complete'].includes(s.phase))return false;if(!Number.isInteger(s.episode)||s.episode< -1||s.episode>=episodes.length)return false;if(!Array.isArray(s.log)||!Array.isArray(s.contacts)||!Array.isArray(s.seen)||!Array.isArray(s.decisions))return false;
 for(const k of ['minutes','fatigue','wounded','bandages','wall','grain','material','houseGrain','salt','carried','recruits','equipment','training','followers','handed','travelGrain','step'])if(!Number.isFinite(s[k])||s[k]<0)return false;
 if(s.phase==='opening')return s.episode===-1;const e=current(s);if(!e||s.contacts.some((id,i)=>e.contacts[i]!==id))return false;if(['choose','execute','pv','result','complete'].includes(s.phase)&&s.contacts.length!==e.contacts.length)return false;if(['execute','pv','result','complete'].includes(s.phase)&&!e.options[s.choice])return false;if(s.step>(e.options[s.choice]?.steps.length||0))return false;if(s.phase==='pv'&&s.pendingPV!==e.id+'-'+s.choice)return false;return s.recruits<=700&&s.wounded<=9&&s.followers<=24&&s.carried<=100&&s.travelGrain<=100;
}
root.CampaignModel={initial,current,opening,startLater,contact,forecast,choose,advance,finishPV,next,restore,handoff,validate,episodes,copy};
})(typeof window!=='undefined'?window:globalThis);
