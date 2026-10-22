(function(){'use strict';
const map={
 travel:{label:'红巾行装',asset:'assets/portraits/redturban-1352-service.webp',detail:'束红巾、灰布袍与便装行囊。道中遇疾和返濠养病时卸甲；并非重新回到僧人身份。'},
 camp:{label:'营中常服',asset:'assets/chapter2/portrait-camp.webp',detail:'红巾、素布交领袍、束带。整军与案牍场景穿便于活动的常服，不把所有非战斗场景都画成披甲列阵。'},
 armor:{label:'临阵披甲',asset:'assets/chapter2/portrait-armor.webp',detail:'灰袍外着铁札甲，配朴素铁盔、护肩与下垂护片，保留红巾标识。取同代形制复原，不声称是朱元璋本人的传世盔甲。'},
 winter:{label:'冬季援守',asset:'assets/chapter2/portrait-winter.webp',detail:'厚布内层与颈巾外披札甲，配铁盔。瓦梁援守与滁州涧伏采用冬装；寒时平民与军士也增加衣层。'}
};
function state(s,place){const id=Chapter2Content.nodes[s.node].id;let key=['hengjian','chuzhou'].includes(id)?'armor':['liuhe','ravine'].includes(id)?'winter':['muster','li','guo'].includes(id)?'camp':'travel';if(place&&['home','council','camp'].includes(place))key=s.node<3?'travel':'camp';return {...map[key],key,armored:['armor','winter'].includes(key),winter:key==='winter'};}
function apply(s){const a=state(s);for(const id of['playerPortrait','portraitDetailImage']){const p=document.getElementById(id);p.src=a.asset;p.alt='朱元璋 · '+a.label;}document.querySelector('.player h2').textContent='朱元璋';document.getElementById('portraitName').textContent='朱元璋';document.getElementById('portraitYear').textContent=Chapter2Content.nodes[s.node].date+' · 青年';document.getElementById('portraitStage').textContent=a.label;document.getElementById('portraitDescription').textContent=a.detail+' 具体获甲、换装日期未见确证，按场合安排。';document.getElementById('portraitButton').setAttribute('aria-label','查看朱元璋当前形象：'+a.label);document.getElementById('portraitButton').dataset.stage=a.key;const p=document.getElementById('portraitPhase');if(p)p.textContent='字国瑞 · '+a.label;}
window.Chapter2Wardrobe={state,apply};
})();
