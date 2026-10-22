(function(){
const base=JSON.parse(JSON.stringify(DATA.factions)),baseLocations=JSON.parse(JSON.stringify(DATA.locations));
const zhang={id:'zhang',name:'张士诚部',short:'张',tag:'1353年兴起',color:'#826444',where:'淮东 · 白驹场一带',leader:'张士诚',kind:'activity',xy:[949,718],offset:[90,15],activity:'至正十三年起事，活动由盐场向泰州、兴化、高邮发展。本章只显示当年兴起的资料入口，未把全年成果前置为当前领土。',scope:'该年活动起点示意；当前精确月日、营址与兵额未落实，不绘制整片确控疆域。',source:'《明史》卷123 张士诚传；仅据年序',url:'https://zh.wikisource.org/wiki/明史/卷123'};
DATA.factions.push(zhang);
const b=document.createElement('button');b.className='faction-button';b.dataset.faction='zhang';b.style.setProperty('--faction',zhang.color);b.setAttribute('aria-pressed','false');b.innerHTML='<span class="dot">张</span><span><strong>张士诚部</strong><small>1353年兴起</small></span>';b.onclick=()=>selectFaction('zhang');$('factionList').append(b);
const outer=el('g',{class:'faction-marker','data-id':'zhang',transform:'translate(949 718)'},$('markers')),fixed=el('g',{},outer);el('line',{x1:0,y1:0,x2:104,y2:30,stroke:zhang.color},fixed);el('circle',{r:4,fill:zhang.color},fixed);const fl=el('g',{transform:'translate(90 15)'},fixed);el('path',{d:'M0 0H29V30L14.5 36 0 30Z',fill:zhang.color,stroke:'#efddb3'},fl);el('text',{x:14,y:23,'text-anchor':'middle',class:'sigil'},fl).textContent='张';el('text',{class:'label'},fl).textContent='张士诚部';el('text',{class:'city'},fl).textContent='淮东';outer.onclick=()=>selectFaction('zhang');markerRefs.push({node:fixed,f:zhang});
let snap=null;
function apply(s){
 snap=s;const e=CampaignModel.current(s),year=e?.year||1352,late=s.episode>=1;DATA.snapshot.year=year;DATA.snapshot.era=year===1352?'至正十二年':'至正十三年';
 base.forEach(f=>Object.assign(DATA.factions.find(x=>x.id===f.id),JSON.parse(JSON.stringify(f))));
 baseLocations.forEach(f=>Object.assign(DATA.locations.find(x=>x.id===f.id),JSON.parse(JSON.stringify(f))));
 const x=DATA.factions.find(f=>f.id==='xuzhou');
 if(late){x.name='入濠的彭、赵诸部';x.short='彭';x.tag='徐州失守后入濠';x.xy=[813,729];x.where='濠州 · 来归诸部';x.leader='彭大 / 彭氏部与赵均用';x.activity='徐州失守，彭、赵诸部入濠。救郭采用《明史》的彭大叙事；其后彭大卒、彭早住领其众。具体人物时序分歧见本章“史”。';x.scope='与城中原有诸部并处，不把徐州仍画作其现有根据地。驻营相对位置仅为阅读排布。';x.offset=[10,-80];x.url='https://zh.wikisource.org/wiki/明史/卷122';x.source='《明史》卷122；《实录》卷一异文另见任务“史”';
 const loc=DATA.locations.find(p=>p.id==='xuzhou');loc.faction='yuan';loc.full='徐州 · 元军攻取之后';loc.kind='历史变动';loc.desc='原起义诸部败出，彭、赵入濠。此处只供查看，不属于朱重八。';}
 const guo=DATA.factions.find(f=>f.id==='guo');if(e?.id.startsWith('siege'))guo.activity='城中诸部共同守濠。朱重八只统领受任小队和局部防区，不能调度全城各部。';
 if(s.episode>=5)guo.activity='元军解围之后，郭部仍在濠州。朱重八为郭家筹粮，随后归乡募兵；所有兵粮按所属分别记账。';
 if(year===1353){const t=DATA.factions.find(f=>f.id==='tianwan');t.activity='至正十三年，天完遭元军进攻。具体当月驻处与得失尚待核定；蕲水保留为历史活动锚，不据此断言当前确控。';t.scope='不将1352年的全年扩张范围当成1353年当月实际领土。';}
 for(const m of markerRefs){m.node.parentElement.setAttribute('transform','translate('+m.f.xy.join(' ')+')');m.node.parentElement.setAttribute('aria-label',m.f.name);const tip=m.node.querySelector('title');if(tip)tip.textContent=m.f.name;m.node.querySelector('.sigil').textContent=m.f.short;m.node.querySelector('.label').textContent=m.f.name;m.node.querySelector('.city').textContent=m.f.where;}
 const xnode=markerRefs.find(m=>m.f.id==='xuzhou').node;xnode.querySelector('g').setAttribute('transform','translate('+x.offset.join(' ')+')');xnode.querySelector('line').setAttribute('x2',x.offset[0]+14);xnode.querySelector('line').setAttribute('y2',x.offset[1]+15);
 zoneRefs.forEach(z=>{if(z.dataset.id==='xuzhou')z.style.display=late?'none':'';if(z.dataset.id==='tianwan')z.style.display=year===1353?'none':'';});
 $('factionList').querySelectorAll('[data-faction]').forEach(btn=>{const f=DATA.factions.find(x=>x.id===btn.dataset.faction);btn.querySelector('strong').textContent=f.name;btn.querySelector('.dot').textContent='';btn.querySelector('.dot').dataset.sign=f.short;});
 b.hidden=year!==1353;outer.style.display=year===1353?'':'none';document.querySelector('.rail-title i').textContent=year===1353?'八部':'七部';
 document.querySelector('.player .eyebrow').textContent=s.phase==='complete'?'离濠 · 南行之始':e?e.date:'濠州 · 帐下初立';
 $('map').setAttribute('aria-label',year+'年章节局势示意，可拖动与缩放');
 document.querySelectorAll('#provinceLabels text').forEach(t=>{if(t.textContent==='本年闰三月新设'||t.textContent==='1352年闰三月置')t.textContent=year===1352?'本年闰三月新设':'1352年闰三月置';});
 if(state.selected)renderDetail();
}
const previousDetail=renderDetail;
renderDetail=function(){previousDetail();if(!snap)return;const f=DATA.factions.find(x=>x.id===state.selected);if(!f)return;if(state.tab==='military'){
 const r=snap.phase==='opening'?snap.opening:snap;const own=f.id==='guo';
 $('detailBody').innerHTML='<span class="stat-label">'+(own?'朱重八受任范围 · 当前推演账':'史料核定范围')+'</span>'+(own?'<div class="stats"><div><span>当前兵员口径</span><b>'+(snap.handed?(snap.followers?'24名同行':'兵员已移交'):snap.recruits?snap.recruits+'名新募':'9名部下')+'</b></div><div><span>独立领地</span><b>0</b></div><div><span>待养伤员</span><b>'+r.wounded+'</b></div><div><span>疲劳</span><b>'+r.fatigue+'</b></div><div><span>本队公粮</span><b>'+snap.grain+'</b></div><div><span>郭家粮</span><b>'+snap.houseGrain+'</b></div></div><p>以上仅是玩家经手范围，不是整个郭部的总兵额。离濠行粮另计 '+snap.travelGrain+' 份。</p>':'<div class="field"><span>兵额</span><strong>所查材料未落实本时点精确数</strong></div><div class="field"><span>存粮</span><strong>未模拟，不以示例数字冒充史载</strong></div><div class="field"><span>调度</span><strong>不在朱重八权限内</strong></div><p>'+f.activity+'</p>')+'<div class="fact-note">人物与活动可据文本核对；地图锚点、省界和范围仍为概略表达，不据此计算真实领土面积。</div>';
 }};
const oldSelect=selectFaction;selectFaction=function(id){oldSelect(id);$('statusLine').textContent='正在查阅：'+DATA.factions.find(f=>f.id===id).name+' · '+DATA.snapshot.year;};
window.ChapterMap={apply};
})();
