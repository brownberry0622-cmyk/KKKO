(function(root){'use strict';
const ch=root.Chapter3Model?3:root.Chapter2Model?2:1,M=root.Chapter3Model||root.Chapter2Model||root.CampaignModel,B={...M},copy=Operations.clone;
const tables={
1:{prepare:['duty','九夫分工',['修械','合练','踏看'],['持械组','号令组','踏看组']],opening:['battle','接人归营',['前行','护送','察路']],marriage:['audience','成家与嫌隙'],rescue:['battle','援兵开路与护送'],siege1:['duty','城防轮值',['守望','修缮','运粮']],siege2:['battle','春日城防',['换哨','修栅','配给']],siege3:['duty','替守交接',['接守','加固','伤员']],salt:['escort','怀远运粮'],recruit:['duty','新军合伍',['核籍','修械','训练']],departure:['escort','交兵之后，少众南行']},
2:{return:['escort','病中折返'],envoy:['audience','渡口问讯'],stockade:['escort','缚帅之后，分队护送出寨',['引路','护送','察看']],hengjian:['battle','横涧进营',['正面','侧门','归路']],muster:['duty','军民分籍',['军籍','民户','救济']],lishanchang:['audience','善长入幕'],li:['audience','善长入幕'],chuzhou:['battle','滁州接应',['城门','接应线','外屏']],guo:['audience','郭帅阅军'],liuhe:['battle','瓦梁援救与撤民'],ravine:['battle','涧侧伏兵',['涧口','侧伏','城中接应']]},
3:{hezhou:['duty','和州合军筑城',['城工','军令','粮道']],hostage:['audience','徐达为质'],hezhoufight:['battle','和阳通饷',['新塘','高望','饷道']],succession:['audience','郭帅身后军令'],chang:['audience','遇春投军'],chaohu:['battle','巢湖舟队出险'],caishi:['battle','采石渡江',['先登','接应','后队'],['常遇春先登队','徐达接应队','汤和后队']],taiping:['civic','太平立足',['军纪','仓储','安民']],taipingfight:['battle','水陆夹击',['姑孰口','正面','侧后']],setback:['battle','败阵收队'],watergate:['battle','水寨突破',['牵制舟','破栅舟','接应舟']],fangshan:['battle','方山纳众',['营门','侧营','归降通路']],jiqing:['battle','水陆取集庆',['蒋山','城前','水路']]}};
const key=s=>ch===1?(s.phase==='opening'?(s.opening.phase==='prepare'?'prepare':'opening'):M.current(s).id):M.current(s).id;
function spec(s){const id=s.op?.id||key(s),a=tables[ch][id]||['audience',M.current(s)?.title||'军中交办'];return {id,battleKind:ch===1&&['opening','rescue'].includes(id)||ch===2&&id==='liuhe'||ch===3&&id==='setback'?'escortbattle':ch===1&&id==='siege2'?'defense':ch===3&&id==='chaohu'?'rescue':undefined,reliefAt:ch===1?220:300,factionLabel:ch===1?'朱重八所领郭部军士':'朱元璋部',mode:a[0],title:a[1],lanes:ch===1&&id==='prepare'?({repair:['器械点验','修整握柄','合练'],drill:['急用修补','号令操练','轮换操练'],scout:['整备','操练','侧路踏看']}[s.op?.choice]||a[2]):a[2]||['先务','接应','后勤'],teams:a[3]||(a[0]==='civic'?['文书吏','仓吏','安民吏']:['前组','中组','后组']),max:a[0]==='audience'?7:12,par:a[0]==='escort'?5:6,brief:a[0]==='battle'?'先布阵，部队随后自动交锋；可暂停改变军令。军需已按选择的方案预留，实际战损于收队时结算。':a[0]==='escort'?'按地段调整前行、护送与察看。目标必须送到，不能用连续点击略过途中安排。':a[0]==='audience'?'先让事情说清，再落实职掌。人物的来归与史载结局固定，会面次序由你安排。':'每组只能承担一处事务。比较熟练工、轮换和空岗的代价，完成三项交接。'};}
function attach(n,id,kind){n.op={id,kind,applied:false,state:null};const p=spec(n);if(p.mode==='caishi')n.op.caishi=CaishiModel.initial();else n.op.state=Operations.initial(p,ch===1&&n.phase==='opening'?n.opening:n);return n;}
if(ch<3){M.choose=(s,id)=>attach(B.choose(s,id),key(s),'execute');}else M.choose=(s,id)=>{if(!M.forecast(s,id)?.allowed)throw Error('请先完成军议并核准所需军粮');const n=attach(copy(s),key(s),'choose');n.op.choice=id;return n;};
if(ch===1)M.opening=(s,action,id)=>{if(action==='prepare'){if(s.opening.phase!=='prepare'||!Chapter01Model.preparations[id])throw Error('尚不能安排整备');const n=attach(copy(s),'prepare','prepare');n.op.choice=id;n.op.state=Operations.initial(spec(n),n.opening);return n;}const n=B.opening(s,action,id);return action==='dispatch'?attach(n,'opening','opening'):n;};
M.opsTurn=(s,order)=>{if(!s.op||s.op.applied||s.op.caishi)throw Error('不在布置窗口');const n=copy(s);n.op.state=Operations.tick(n.op.state,order,spec(s));return n;};
M.opsRetry=s=>{if(s.op?.state?.status!=='failed')throw Error('仅失败的推演可重置');const n=copy(s);n.op.state=Operations.initial(spec(s),ch===1&&s.phase==='opening'?s.opening:s);return n;};
function costs(n,r){const u=ch===1&&n.phase==='opening'?n.opening:n;const extra={minutes:r.extraMinutes,fatigue:r.fatigue,wounded:0};const cap=ch===1?(n.phase==='opening'?1:9):ch===2?n.party:300;extra.wounded=Math.min(Math.max(0,cap-u.wounded),r.wounded);u.fatigue=Math.min(ch===1?1000:100,u.fatigue+extra.fatigue);u.wounded+=extra.wounded;if(ch===3){n.hours+=r.extraMinutes/60;n.casualties+=extra.wounded;n.equipment=Math.max(0,n.equipment-r.wear);delete extra.minutes;extra.hours=r.extraMinutes/60;extra.equipment=-r.wear;}else u.minutes+=r.extraMinutes;const text='新版现场布置：'+r.rounds+'个窗口；额外劳顿与待养按实际编制入账。项目额度属于本次现场账，不增发全军物资。';if(ch===1&&n.phase==='opening')u.ledger.push({id:u.ledger.length+1,type:'现场布置',text,delta:extra});else n.log.push({seq:n.log.length+1,n:n.log.length+1,node:key(n),text,delta:extra});n.operationReports=n.operationReports||[];n.operationReports.push({id:n.op.id,receipt:r,orders:n.op.state?.history||n.op.caishi?.log||[]});}
M.opsFinish=s=>{if(!s.op||s.op.applied)throw Error('此笔已经交接');const a=s.op;let n=copy(s),r;
 if(a.caishi){if(!CaishiModel.validate(a.caishi)||a.caishi.phase!=='result')throw Error('先完成渡江和战后安排');const v=CaishiModel.outcome(a.caishi);r={rounds:v.round,extraMinutes:Math.max(0,v.round-7)*15,fatigue:v.fatigue,wounded:v.wounded,wear:Math.ceil((100-v.shipCondition)/10),integrity:v.shipCondition};}else{if(a.state.status!=='won')throw Error('现场目标尚未完成');r=a.state.receipt;}
 if(ch===3){if(!a.basePaid)n=B.choose(n,a.choice);else if(n.phase==='failed'){n.phase='battle';n.battle.status='planning';}if(n.phase==='battle'){n.battle.status='won';B.settle(n);}n.op=a;costs(n,r);n.op.applied=true;return n;}
 if(a.kind==='prepare'){n=B.opening(n,'prepare',a.choice);n.op=a;costs(n,r);n.op.applied=true;return n;}
 if(!a.costed){costs(n,r);n.op.costed=true;}
 for(let i=0;i<12;i++){if(n.risk?.incident||n.risk?.pendingPV)break;if(ch===1&&n.phase==='opening'){if(n.opening.phase!=='tactical')break;n=B.opening(n,'advance');}else{if(n.phase!=='execute')break;n=B.advance(n,0);}}
 if(!(ch===1&&n.phase==='opening'?n.opening.phase==='tactical':n.phase==='execute'))n.op.applied=true;return n;
};
M.opsCaishi=(s,v)=>{if(ch!==3||s.op?.id!=='caishi'||s.op.applied||!CaishiModel.validate(v))throw Error('渡江记录无效');const n=copy(s);n.op.caishi=copy(v);return n;};
M.next=(s,...args)=>{const n=B.next(s,...args);if((ch===1?n.episode!==s.episode:n.node!==s.node)||n.phase==='complete'){delete n.op;if(n.checkpoint)delete n.checkpoint.op;}return n;};
M.validate=(s,...args)=>{try{if(!B.validate(s,...args))return false;if(!s.op)return true;if(typeof s.op.applied!=='boolean'||!tables[ch][s.op.id])return false;if(s.op.caishi)return ch===3&&s.op.id==='caishi'&&CaishiModel.validate(s.op.caishi);if(s.op.applied)return Operations.validateArchived(s.op.state,s.op.id);const m=migrate(s);return Operations.validate(m.op.state,spec(m));}catch{return false;}};

function migrate(s){
 if(!B.validate(s))return s;
 const id=s.op?.id||key(s);if(!tables[ch][id]||spec(s).mode!=='battle')return s;
 const ongoing=s.op&&!s.op.applied||!s.op&&(s.phase==='execute'||ch===1&&s.phase==='opening'&&s.opening.phase==='tactical'||ch===3&&['battle','failed'].includes(s.phase));
 if(!ongoing)return s;
 if(s.op?.state?.chess&&s.op.state.chess.kind===AutoChess.scenario(spec(s))&&s.op.state.chess.gate!==undefined)return s;
 const n=copy(s),old=copy(s.op||s.battle||{}),child=s.op?.caishi;
 if(!n.op)n.op={id,kind:ch===3?'choose':ch===1&&s.phase==='opening'?'opening':'execute',choice:s.choice,basePaid:ch===3,applied:false};
 n.op.legacyArchive=old;n.op.state=Operations.initial(spec(n),ch===1&&n.phase==='opening'?n.opening:n);delete n.op.caishi;
 const b=n.op.state.chess;b.imported=true;
 if(child){b.firstLanded=child.firstLanded;b.delivered=Math.min(2,child.delivered);n.op.state.legacyRound=child.round;n.op.state.legacyLoss=Math.max(0,200-child.units.reduce((v,u)=>v+u.hp,0));const ratio=child.units.reduce((v,u)=>v+u.hp,0)/200;for(const u of b.units.filter(u=>u.side==='friend'&&u.role!=='supply'))u.hp=Math.max(1,Math.round(u.hp*ratio));if(b.delivered)b.units.filter(u=>u.role==='supply').slice(0,b.delivered).forEach(u=>u.escaped=true);if(b.firstLanded){const u=b.units.find(u=>u.id==='f0');u.x=10;u.y=4;u.landed=true;}}
 else if(old.state?.chess){n.op.state.legacyRound=old.state.round;n.op.state.legacyLoss=old.state.loss;for(const u of b.units.filter(u=>u.side==='friend'&&u.role!=='supply')){const v=old.state.chess.units.find(v=>v.id===u.id);if(v)u.hp=Math.max(1,Math.round(u.max*v.hp/v.max));}}
 else if(old.state?.units||s.battle?.units){const units=old.state?.units||s.battle.units;n.op.state.legacyRound=old.state?.round||s.battle?.round||0;n.op.state.legacyLoss=old.state?.loss||0;for(const u of b.units.filter(u=>u.side==='friend'&&u.role!=='supply'))u.hp=Math.max(1,Math.round(u.hp*(units[u.group]?.hp??100)/100));}
 n.op.state.events=['已承接旧记录的消耗、损伤与渡江进展；本次交锋改用棋盘重新部署，既有选择不重复扣款。'];return n;
}
M.migrate=migrate;

root.OperationAdapter={chapter:ch,spec,active:s=>!!s.op&&!s.op.applied};
})(globalThis);
