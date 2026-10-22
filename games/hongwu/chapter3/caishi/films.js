(function(root){'use strict';
const shot=(art,speaker,text,fx='stream',near='cloth',seconds=3.8)=>({art,speaker,text,fx,near,seconds});
const titles={'prepare-signal':'旗鼓已定，候令开舟','prepare-hull':'舟具整备，稳渡大江','dispatch-wave':'军令已下，船队出发','repair-wave':'留泊抢修','landing-covered':'常遇春先登','landing-exposed':'先登已成，急需接应','counter-reserve':'后队出发，接续岸头','counter-volley':'舟师齐射，压住反扑','counter-hold':'收紧岸头，稳住阵脚','victory-orderly':'兵甲接续，江岸立足','victory-costly':'渡江得岸，代价尚存','care-repair':'渡船修缮','care-rest':'诸队轮换','care-care':'伤员安置'};
function film(id,s){const names=s.preps.map(x=>root.CaishiModel.PREPS[x].name).join('、'),w=root.CaishiModel.wounded(s);let a=[];
switch(id){
case 'prepare-signal':a=[shot('scout-water','舟师军士','江面开阔，前后各舟须看得见旗。','stream','rope'),shot('signals','传令军士','旗起开舟，旗收候令。各舟听清！','wind','wood'),s.preps.includes('arrows')?shot('loading-wave','舟师军士','箭械先点清，再依次登船。','wood','buckle'):shot('hull-check','舟师军士','船缝已补，缆绳再试一遍。','creak','rope'),shot('caishi-1','朱元璋','常遇春先登，各队随后接应。','stream','cloth')];break;
case 'prepare-hull':a=[shot('hull-check','舟师军士','船板吃力，先把这一道缝填紧。','creak','wood'),shot('loading-wave','传令军士','补好船具，备足箭械。各舟依次候令。','wood','rope'),shot('scout-water','廖永安 · 画外','水路我来照应，岸头还要靠诸军接上。','stream','cloth')];break;
case 'dispatch-wave':a=[shot('loading-wave','传令军士','按军令登舟，军械与人马分载。','wood','buckle'),shot('signals','舟师军士','松缆！看清前舟，不要挤在一处。','wind','rope'),shot('caishi-1','朱元璋','空舟回来，再接后队。','stream','creak')];break;
case 'repair-wave':a=[shot('hull-check','舟师军士','先把漏缝找出来，木料别用错了地方。','creak','wood'),shot('repair-return','修船军士','水已舀出，这一段板再钉牢。','stream','wood'),shot('signals','传令军士','修船留泊，其他各舟照令往返。','wind','cloth')];break;
case 'landing-covered':a=[shot('caishi-5','廖永安','弓手压住岸上，给先登队让出地方！','bow','creak'),shot('caishi-3','常遇春','遇春愿先登！','stream','stone'),shot('reinforcement','军士','岸上有了人，后舟跟上！','stream','buckle'),shot('supplies-ashore','传令军士',s.delivered?'军械已经接到岸头，接下来护住卸载处。':'军械还在后面，先把卸载处守住。','wood','rope')];break;
case 'landing-exposed':a=[shot('caishi-2','军士','岸上箭急！靠紧船舷！','bow','wood'),shot('caishi-3','常遇春','随我登岸！','stream','stone'),shot('isolated-shore','先登军士','把盾连起来，后队还得接上。','wind','buckle'),shot('signals','传令军士','岸头已立旗，请速调接应！','cloth','wood')];break;
case 'counter-reserve':a=[shot('isolated-shore','先登军士','岸后又有人过来了，稳住！','wind','buckle'),shot('loading-wave','传令军士','后队上船，立即接应！','wood','rope'),shot('scout-water','舟师军士','这一趟催桨赶路，下一轮接岸。','stream','creak')];break;
case 'counter-volley':a=[shot('isolated-shore','先登军士','护住两侧，别叫他们压回江边！','wind','buckle'),shot('caishi-5','廖永安','箭向岸后，替前队压住来敌！','bow','wood'),shot('signals','传令军士','齐射令已传出，各舟航次不停。','cloth','rope')];break;
case 'counter-hold':a=[shot('isolated-shore','先登军士','盾靠紧，长兵在后！','wind','buckle'),shot('supplies-ashore','军士','挪开卸下的器械，让出守阵的位置。','wood','rope'),shot('signals','传令军士','先守岸头，再候前进号令。','cloth','wood')];break;
case 'victory-orderly':a=[shot('reinforcement','军士','后队跟上来了！','stream','stone'),shot('supplies-ashore','转运军士','船往回送，军械往上搬。','wood','rope'),shot('caishi-4','朱元璋','各队合上，不许散追。','wind','buckle'),shot('caishi-6','朱元璋','江岸立住了，再整诸军。','wind','cloth')];break;
case 'victory-costly':a=[shot('isolated-shore','军士','前队疲了，后队接住位置。','wind','buckle'),shot('reinforcement','军士','还能走的跟上，伤者先扶到岸后。','stream','cloth'),shot('repair-return','舟师军士','破船留泊，先堵住进水处。','stream','wood'),shot('caishi-6','朱元璋','岸是拿下了，人和船都要照看。','wind','cloth')];break;
case 'care-repair':a=[shot('hull-check','舟师军士','先查受损最重的船。','creak','rope'),shot('repair-return','修船军士','这块木料用在漏处，修好了再试。','stream','wood'),shot('supplies-ashore','转运军士','船具修复一批，往后接续就多一分余地。','wood','rope')];break;
case 'care-rest':a=[shot('reinforcement','军士','前队退到岸后，后队接岗。','stream','stone'),shot('rest-watch','军士','盔先解下，喝口水。待会儿再换你们。','wind','bowl'),shot('supplies-ashore','转运军士','轮休的时候，守哨与卸载都照旧。','wood','cloth')];break;
case 'care-care':a=[shot('reinforcement','军士','把伤者扶上来，别落在江边。','stream','cloth'),shot('wounded-care','照护军士','先登记伤处，再分处安置。','wind','wrap'),shot('rest-watch','传令军士','待养者不再列入可战名册，回营继续照护。','wind','paper')];break;
default:throw Error('找不到分镜 '+id);
}
const results=id.startsWith('prepare')?'本次准备：'+names+'。':id.startsWith('landing')?'上岸可战 '+root.CaishiModel.strength(s)+' 人；已卸軍械 '+s.delivered+' 箱。':id==='dispatch-wave'?s.log.filter(x=>x.round===s.round&&x.text.includes('出发')).map(x=>x.text).join(' '):id.startsWith('counter')?'反扑强度 '+Math.round(s.reserve)+'；箭矢余 '+s.arrows+' 份。':id.startsWith('victory')?'用时 '+s.round+' 轮；上岸可战 '+root.CaishiModel.strength(s)+' 人；待养 '+w+' 人。':id==='care-care'?'登记安置 '+s.care+' 名待养者，可战人数不即时恢复。':id==='care-rest'?'各队疲劳减少12，剩余战后安排 '+s.careLeft+' 项。':'修缮已入账；木料余 '+s.wood+'。';
return {id,title:titles[id],shots:a,result:results};}
root.CaishiFilms={film,titles};
})(globalThis);
