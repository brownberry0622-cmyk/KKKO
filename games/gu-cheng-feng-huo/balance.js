(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.CombatBalance=api;})(globalThis,function(){'use strict';
// All offensive actions derive from the equipped weapon's ordinary attack.
// HP-based burn and self-cost are explicit exceptions requested for this build.
const BASE=Object.freeze({melee:10,spear:15,bow:20});
const MULT=Object.freeze({jump:2,counter:3,mountedBlade:2,mountedSpear:1.5,bladeFlurry:.9,bladeWave:3.5,spearRush:4,lift:1,slam:2,fireShot:1,arrowRain:1});
const TOUGHNESS=Object.freeze({commander:100,yin:300,reduction:.1,breakSeconds:4});
const OGRE=Object.freeze({selfRate:.05,leech:.1,power:1.5});
const BURN=Object.freeze({minRate:.02,maxRate:.1,lowHealth:.2,seconds:5});
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const round=v=>Math.round((v+Number.EPSILON)*100)/100;
function burnRate(hp,maxHp){return BURN.minRate+(BURN.maxRate-BURN.minRate)*clamp((1-hp/Math.max(1,maxHp))/(1-BURN.lowHealth),0,1);}
function toughnessScale(kind){return kind==='counter'?2:kind==='slam'||kind==='bladeWave'?1.6:kind==='rain'?.5:1;}
return {BASE,MULT,TOUGHNESS,OGRE,BURN,round,burnRate,toughnessScale};});
