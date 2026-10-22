(function(root){'use strict';
const $=id=>document.getElementById(id);
function hud(w,visible){
 $('medicineBar').hidden=!visible;const p=w.player;
 for(const slot of [1,2]){const cd=p.medicineCooldowns[slot];$('medicineCd'+slot).textContent=cd>1e-8?cd.toFixed(1)+'s':slot===1&&p.hp>=p.maxHp?'满血':'就绪';$('medicine'+slot).classList.toggle('cooling',cd>0);$('medicine'+slot).style.setProperty('--cooldown',100*cd/20+'%');}
 $('hasteState').textContent=p.hasteLeft>0?'迅行 '+p.hasteLeft.toFixed(1)+'秒 · 攻速 / 移速 +40%':'';
}
function telegraph(c,e,time){
 if(e.dead||!['yinWindup','yinActive'].includes(e.state)||!e.move)return;
 const m=e.move,active=e.state==='yinActive',q=active?1:1-Math.max(0,e.timer)/m.windup;
 c.save();c.globalAlpha=active?.85:.5+.3*q;c.strokeStyle=active?'#ffebbc':'#ffbc65';c.fillStyle=active?'#b5312965':'#a427273d';c.lineWidth=3;c.setLineDash(active?[]:[13,8]);
 c.beginPath();
 if(m.id==='slam')c.ellipse(e.aim.x,e.aim.y,m.reach,m.lane,0,0,Math.PI*2);
 else if(m.id==='sweep')c.ellipse(e.attackOrigin.x,e.attackOrigin.y,m.reach,m.lane,0,0,Math.PI*2);
 else{const x=e.attackOrigin.x,left=e.attackDirection===1?x:x-m.reach;c.rect(left,e.attackOrigin.y-m.lane,m.reach,m.lane*2);}
 c.fill();c.stroke();c.setLineDash([]);
 const cx=m.id==='slam'?e.aim.x:e.attackOrigin.x+e.attackDirection*(m.id==='sweep'?0:m.reach*.5),cy=m.id==='slam'?e.aim.y:e.attackOrigin.y;
 c.strokeStyle='#ffe3aa';c.lineWidth=3;c.beginPath();c.arc(cx,cy,18,-Math.PI/2,-Math.PI/2+Math.PI*2*q);c.stroke();
 c.font='600 18px Microsoft YaHei';c.textAlign='center';c.lineWidth=5;c.strokeStyle='#1f101a';c.strokeText(m.name,cx,cy-m.lane-14);c.fillStyle='#ffdc97';c.fillText(m.name,cx,cy-m.lane-14);c.restore();
}
function bossCrest(c,e,time){
 if(e.dead)return;c.save();c.strokeStyle='#d99d6270';c.lineWidth=2;c.beginPath();c.ellipse(e.x,e.y+4,90,18,0,0,Math.PI*2);c.stroke();
 if(e.state==='yinEntrance'){c.font='600 32px KaiTi,serif';c.textAlign='center';c.strokeStyle='#1b1515';c.lineWidth=5;c.strokeText('尹 子 奇',e.x,e.y-220);c.fillStyle='#ffe0a1';c.fillText('尹 子 奇',e.x,e.y-220);}
 c.restore();
}
function heroAura(c,p,time){
 if(p.dead||p.hasteLeft<=0)return;c.save();c.strokeStyle='#9cdddab0';c.lineWidth=2;
 for(let i=0;i<3;i++){const phase=(time*1.4+i/3)%1;c.globalAlpha=(1-phase)*.65;c.beginPath();c.ellipse(p.x,p.y+5,35+phase*42,7+phase*9,0,0,Math.PI*2);c.stroke();}c.restore();
}
function effect(c,f){
 if(f.kind!=='medicine')return false;const q=1-f.life/f.maxLife;
 c.save();c.strokeStyle=f.slot===1?'#b3f4c9':'#9bdfeb';c.lineWidth=3;c.beginPath();c.ellipse(f.x,f.y+5,30+q*65,6+q*13,0,0,Math.PI*2);c.stroke();
 c.translate(f.x+45,f.y-160-q*25);c.fillStyle=f.slot===1?'#c8ba73':'#7ddad5';c.beginPath();c.roundRect(-7,-13,14,7,2);c.roundRect(-13,-6,26,31,8);c.fill();c.strokeStyle='#e8e4c3';c.lineWidth=2;c.beginPath();c.moveTo(-11,4);c.lineTo(11,4);c.stroke();c.restore();return true;
}
root.BattleUpgrades={hud,telegraph,bossCrest,heroAura,effect};
})(globalThis);
