import * as T from './vendor/three.module.js';
import {findRoute} from './navigation.js';
const root=document.getElementById('world3d'),canvas=document.getElementById('worldCanvas'),hint=document.getElementById('worldHint');
let renderer,scene,camera,player,active=false,where='camp',target=null,points=[],colliders=[],keys={},destination=null,yaw=0,zoom=8.5,clock=0,last=0,walkSound=0,callback=null,drag=null;
let currentSceneKey=null;
let route=[],routeLine=null,selectedPoint=null,overview=false;
const ink=0x343d34,paper=0xd8cbaa,red=0x863d30,materials=new Map();

function surfaceTexture(color){const c=document.createElement('canvas');c.width=c.height=128;const ctx=c.getContext('2d');ctx.fillStyle='#'+color.toString(16).padStart(6,'0');ctx.fillRect(0,0,128,128);for(let i=0;i<240;i++){const x=(i*43.19)%128,y=(i*27.73)%128;ctx.fillStyle=i%2?'rgba(46,42,26,.09)':'rgba(245,237,204,.09)';ctx.fillRect(x,y,1+i%5,1);}const wood=[0x746043,0x756246,0x81704e,0xa49067,0x867255,0x7a684b,0x887354,0x817456,0x79664a,0x8a7755,0xa79268,0x9b7a56];if(wood.includes(color)){ctx.strokeStyle='rgba(55,47,31,.18)';ctx.lineWidth=1;for(let x=4;x<128;x+=12){ctx.beginPath();ctx.moveTo(x,0);ctx.bezierCurveTo(x+6,40,x-4,80,x,128);ctx.stroke();}}else{ctx.strokeStyle='rgba(43,43,28,.035)';for(let i=0;i<128;i+=4){ctx.beginPath();ctx.moveTo(i,0);ctx.lineTo(i,128);ctx.stroke();}}const texture=new T.CanvasTexture(c);texture.colorSpace=T.SRGBColorSpace;return texture;}
function mat(c){if(!materials.has(c))materials.set(c,new T.MeshLambertMaterial({map:surfaceTexture(c),flatShading:true}));return materials.get(c);}
function box(w,h,d,c,x=0,y=0,z=0,parent=scene){const mesh=new T.Mesh(new T.BoxGeometry(w,h,d),mat(c));mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;}
function cylinder(a,b,h,c,x,y,z,parent=scene,n=8){const m=new T.Mesh(new T.CylinderGeometry(a,b,h,n),mat(c));m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
function ball(r,c,x,y,z,parent=scene,sx=1,sy=1,sz=1){const m=new T.Mesh(new T.SphereGeometry(r,12,8),mat(c));m.scale.set(sx,sy,sz);m.position.set(x,y,z);m.castShadow=true;parent.add(m);return m;}
function line(points,c=ink,parent=scene){const g=new T.BufferGeometry().setFromPoints(points.map(p=>new T.Vector3(...p)));const l=new T.Line(g,new T.LineBasicMaterial({color:c,transparent:true,opacity:.7}));parent.add(l);return l;}
function label(text,x,y,z){const el=document.createElement('button');el.className='world-label';el.textContent=text;document.getElementById('worldLabels').append(el);return {el,p:new T.Vector3(x,y,z)};}
function character(x,z,type='soldier'){
 const profile=window.Chapter8WorldContent.people.find(p=>p.id===type),hash=profile?window.Chapter8WorldContent.people.indexOf(profile):0;
 const g=new T.Group();g.position.set(x,0,z);scene.add(g);const clothes=type==='zhu'?(window.CampaignUI.snapshot().authority.includes('皇帝')?0x9a783e:0x303d34):type==='ma'?0x765c4b:profile?[0x526355,0x736348,0x536272,0x786652,0x485d5a,0x807356][hash%6]:type==='ma'?0xc9bda1:type==='scholar'?0x777267:type==='zhu'?0x4a4a3e:0x66705d;
 const hips=box(.53,.38,.34,clothes,0,.86,0,g);cylinder(.3,.38,.57,clothes,0,.9,0,g);
 const torso=cylinder(.29,.32,.65,clothes,0,1.26,0,g,12);torso.scale.z=.69;
 if(type==='zhu'){for(const side of[-1,1]){const panel=cylinder(.12,.13,.58,0x807053,side*.22,1.28,.08,g,8);panel.name='hemp-vest';panel.scale.z=.45;line([[side*.31,1.57,.1],[side*.3,1.05,.11]],0x544c39,g);}}
 const c1=box(.065,.37,.032,0xe7dab9,-.04,1.42,.192,g);c1.rotation.z=-.48;
 const c2=box(.065,.35,.034,0xe7dab9,.08,1.42,.195,g);c2.rotation.z=.48;
 cylinder(.11,.12,.17,0xc29f78,0,1.65,0,g);
 ball(.235,0xc7a780,0,1.91,.016,g,.84,1.17,.84);
 ball(.2,0x383a30,0,2.075,-.01,g,1.05,.55,1.08);
 if(type==='zhu'){cylinder(.233,.227,.15,0x383a30,0,2.025,0,g,12);const tail=box(.12,.42,.05,0x383a30,.16,1.8,-.21,g);tail.rotation.z=.2;ball(.065,0x383a30,.2,2.04,-.1,g);}
 if(type==='zhu'){for(let band=0;band<3;band++){const pts=[];for(let j=0;j<=14;j++){const a=j/14*Math.PI*2;pts.push([Math.sin(a)*.235,1.995+band*.04,Math.cos(a)*.235]);}line(pts,0x633627,g);}}
 if(type==='ma'){ball(.11,0x30342c,0,2.04,-.23,g);cylinder(.32,.42,.83,clothes,0,.55,0,g);line([[-.15,1.98,.18],[-.06,1.99,.21]],ink,g);line([[.06,1.99,.21],[.15,1.98,.18]],ink,g);}
 if(type==='zhu'||type==='ma'){for(const x of [-.09,.09]){ball(.02,ink,x,1.92,.199,g,1,.55,.3);}line([[-.075,1.81,.205],[.072,1.81,.205]],0x926b50,g);ball(.038,0xc7a780,0,1.884,.208,g,.7,1,.7);}
 const limbs=[];
 for(const side of [-1,1]){
  const leg=new T.Group();leg.position.set(side*.17,.8,0);g.add(leg);cylinder(.108,.09,.63,0x544f40,0,-.3,0,leg,10);for(let w=0;w<3;w++)cylinder(.103,.103,.037,0xada383,0,-.45-w*.07,0,leg,10);ball(.14,0x746145,0,-.72,.09,leg,.87,.4,1.55);limbs.push(leg);
  const arm=new T.Group();arm.position.set(side*.38,1.5,0);g.add(arm);cylinder(.12,.10,.50,clothes,0,-.22,0,arm,10);ball(.12,clothes,0,0,0,arm);cylinder(.105,.10,.075,0xd1c2a0,0,-.46,0,arm,10);ball(.09,0xc7a780,0,-.52,0,arm);limbs.push(arm);
 }
 box(.68,.09,.4,0x514438,0,1.015,0,g);g.userData.role=type;g.userData.limbs=limbs;if(type==='zhu'||type==='officer'||profile?.type==='officer')dress(g);if(profile){g.scale.y=['xu','tang','hu','chang'].includes(type)?1.10:profile.bodyScale||1;g.scale.x=type==='hu'||type==='chang'?1.17:1;for(const xx of[-.085,.085])ball(.022,ink,xx,1.92,.21,g,1,.55,.35);ball(.04,0xc7a780,0,1.875,.218,g,.65,1,.6);if(!['xu','deng','wenzhong'].includes(type)&&!['ma','child','woman','infant','youth'].includes(profile.type)){ball(.083,0x39392f,0,1.756,.13,g,1,1.2,.65);}if(profile.type==='child'){g.scale.setScalar(profile.bodyScale||.52);}if(profile.type==='scholar'){box(.34,.22,.32,0x303b36,0,2.14,0,g);cylinder(.34,.40,.90,clothes,0,.56,0,g);}}return g;
}
function fence(x,z,length,axis='x'){for(let i=0;i<length;i++){const xx=x+(axis==='x'?i:0),zz=z+(axis==='z'?i:0);cylinder(.055,.07,1.45,0x776449,xx,.72,zz);const spear=new T.Mesh(new T.ConeGeometry(.095,.22,4),mat(0x776449));spear.position.set(xx,1.53,zz);scene.add(spear);}const b=box(axis==='x'?length:0.12,.11,axis==='z'?length:.12,0x665741,x+(axis==='x'?length/2-.5:0),.85,z+(axis==='z'?length/2-.5:0));}
function roof(x,z,w,d,y,color=0x676853){const shape=new T.Shape();shape.moveTo(-w/2,0);shape.lineTo(0,1.55);shape.lineTo(w/2,0);shape.closePath();const geo=new T.ExtrudeGeometry(shape,{depth:d,bevelEnabled:false});const m=new T.Mesh(geo,mat(color));m.position.set(x,y,z-d/2);m.castShadow=true;scene.add(m);line([[x-w/2,y,z-d/2],[x,y+1.55,z-d/2],[x+w/2,y,z-d/2]]);}
function house(x,z,w=5,d=4){box(w,2.6,d,0xb7a684,x,1.3,z);roof(x,z,w+.7,d+.8,2.6);box(.95,1.9,.04,0x504b39,x,.95,z+d/2+.03);for(const dx of [-w*.31,w*.31]){box(.8,.65,.04,0x5e6452,x+dx,1.55,z+d/2+.04);for(let j=-1;j<=1;j++)box(.035,.64,.08,0x927950,x+dx+j*.22,1.55,z+d/2+.08);}colliders.push({x,z,w:w/2+.4,d:d/2+.4});}
function tent(x,z){roof(x,z,3.5,4.2,.12,0xa69974);for(const side of[-1,1])cylinder(.04,.04,1.8,0x65563f,x+side*1.65,.9,z+2.1);colliders.push({x,z,w:2,d:2.4});}
function tree(x,z,scale=1){cylinder(.15,.28,4*scale,0x777259,x,2*scale,z);for(let i=0;i<5;i++){const a=i*2.4;ball(1.5*scale,0x8c9476,x+Math.sin(a)*scale,4*scale+(i%2)*.4,z+Math.cos(a)*scale,scene,1,.42,.9);}colliders.push({x,z,w:.6,d:.6});}
function flag(x,z){cylinder(.04,.06,4,0x63543d,x,2,z);box(1.35,.9,.035,red,x+.69,3.45,z);}
function rack(x,z){for(const dx of[-.9,.9])box(.12,1.3,.13,0x79664a,x+dx,.65,z);box(2.2,.1,.13,0x79664a,x,.95,z);for(let j=0;j<5;j++){const shaft=cylinder(.025,.025,2.05,0x8a7755,x-.8+j*.4,1.02,z+.06);const tip=new T.Mesh(new T.ConeGeometry(.065,.24,4),mat(0x606b61));tip.position.set(x-.8+j*.4,2.15,z+.06);scene.add(tip);}}
function sack(x,z){ball(.45,0xb5a37a,x,.35,z,scene,.82,1.1,.75);cylinder(.13,.21,.17,0x8f7a53,x,.79,z);}
function table(x,z){box(2.6,.13,1.25,0x887354,x,.88,z);for(const dx of[-1,1])for(const dz of[-.43,.43])box(.1,.85,.1,0x66583e,x+dx,.42,z+dz);colliders.push({x,z,w:1.65,d:.95});}

function marker(id,name,x,z,type='soldier',story=false){
 const object=type==='object',person=object?null:character(x,z,type);if(person){person.rotation.y=Math.PI*.2;colliders.push({x,z,w:.42,d:.42,person:true});}
 const tag=label(name,x,object?1.85:2.65,z);tag.el.classList.toggle('facility',object);tag.el.classList.toggle('story',story);
 const p={id,name,x,z,tag,person,story};tag.el.onclick=()=>selectPoint(p);points.push(p);
 const ring=new T.Mesh(new T.RingGeometry(.55,.63,32),new T.MeshBasicMaterial({color:story?0xba873a:0x697257,side:T.DoubleSide,transparent:true,opacity:.7}));ring.rotation.x=-Math.PI/2;ring.position.set(x,.035,z);scene.add(ring);p.ring=ring;return p;
}
function beam(a,b,r=.055,c=0x746043){const va=new T.Vector3(...a),vb=new T.Vector3(...b),m=cylinder(r,r,va.distanceTo(vb),c,0,0,0);m.position.copy(va.clone().add(vb).multiplyScalar(.5));m.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),vb.sub(va).normalize());return m;}
function posts(x,z,w,d,h){for(const dx of[-w/2,w/2])for(const dz of[-d/2,d/2])cylinder(.08,.11,h,0x756246,x+dx,h/2,z+dz);}
function commandTent(x,z){posts(x,z,5.8,4.6,2.9);box(6,.25,5,0x867255,x,.13,z);roof(x,z,6.7,5.6,2.9,0x9d8c66);box(5.8,2.6,.08,0xaaa080,x,1.6,z-2.3);for(const dx of[-2.8,2.8]){box(.08,2.6,4.6,0xaaa080,x+dx,1.6,z);box(1.4,2.45,.09,0x9b7a56,x+dx*.65,1.6,z+2.3);}flag(x-3.6,z+2.5);flag(x+3.6,z+2.5);table(x,z+2.5);box(1.3,.02,.7,0xd2c299,x,.96,z+2.5);for(let i=0;i<4;i++)line([[x-.5+i*.3,.98,z+2.2],[x-.2+i*.3,.98,z+2.7]],0x827353);colliders.push({x,z,w:3.2,d:2.8});}
function barracks(x,z){posts(x,z,6,4,1.9);roof(x,z,6.8,4.8,1.9,0x96936b);box(6,1.6,.1,0xb0a17a,x,.85,z-2);for(const dx of[-3,3])box(.1,1.6,4,0xb0a17a,x+dx,.85,z);for(let i=0;i<4;i++){box(.85,.16,2.1,0x7c6e4f,x-2+i*1.3,.22,z+.35);box(.8,.18,.32,0xc4b48d,x-2+i*1.3,.38,z-.35);}for(let i=0;i<14;i++)beam([x-3.3+i*.5,1.93,z+2.45],[x-3.3+i*.5,1.93,z+2.68],.025,0xaea77b);colliders.push({x,z,w:3.4,d:2.4});}
function granary(x,z){posts(x,z,3.8,3.7,2.8);box(4,.2,4,0x81704e,x,.9,z);for(let i=0;i<10;i++)box(4,.16,.12,i%2?0xbaa67d:0xa49067,x,1.1+i*.16,z-1.8);for(const dx of[-1.9,1.9])for(let i=0;i<10;i++)box(.12,.16,3.6,0xa79268,x+dx,1.1+i*.16,z);roof(x,z,4.8,4.8,2.85,0xa19c71);for(let i=0;i<5;i++)sack(x-1.3+i*.65,z+1.6);for(let i=0;i<3;i++)box(1.5,.25,1.2-i*.15,0x96805b,x,.15+i*.23,z+2.4-i*.4);colliders.push({x,z,w:2.5,d:2.25});}
function armory(x,z){posts(x,z,5,3.5,2.6);roof(x,z,5.8,4.3,2.6,0x737965);rack(x-1,z+.45);box(1.2,.6,.9,0x737363,x+1.45,.3,z+1);box(.9,.22,.48,0x555f59,x+1.45,.74,z+1);cylinder(.65,.8,.5,0x84735b,x+1.4,.25,z-1);cylinder(.42,.48,.03,0xa9552f,x+1.4,.53,z-1);beam([x-.4,.8,z+1.7],[x+1.5,.8,z+1.7],.07);colliders.push({x,z,w:2.8,d:2.1});}
function infirmary(x,z){posts(x,z,5,3.8,2.3);roof(x,z,5.7,4.6,2.3,0xcec4a1);box(5,1.8,.05,0xc9ba98,x,1.3,z-1.9);box(.05,1.6,3.8,0xc9ba98,x-2.5,1.25,z);for(const dx of[-1.3,1.3]){box(1.25,.2,2.4,0x8c7856,x+dx,.45,z);box(1.16,.11,2.1,0xd6c9aa,x+dx,.61,z);box(.9,.17,.38,0xa39576,x+dx,.72,z-.7);}cylinder(.45,.32,.15,0x776b54,x+2,.75,z+2.3);colliders.push({x,z,w:2.9,d:2.2});}
function kitchen(x,z){posts(x,z,4,3.8,2.4);const cover=box(4.6,.12,4.4,0x897a59,x,2.55,z);cover.rotation.z=.07;box(1.8,.9,1.5,0x998466,x,.45,z+.4);box(.7,.45,.03,0x584a38,x,.35,z+1.17);ball(.63,0x4e5147,x,.91,z+.4,scene,1,.45,1);cylinder(.5,.5,.02,0xb5aa7b,x,1.01,z+.4);cylinder(.23,.27,2.6,0x918367,x+.6,1.3,z-.7);for(let i=0;i<4;i++)beam([x-1.4+i*.17,.12,z+1.5],[x-1.4+i*.17,.12,z+2.5],.075);colliders.push({x,z,w:2.3,d:2.1});}
function tower(x,z){posts(x,z,2,2,5);box(2.6,.15,2.6,0x7a684b,x,4,z);roof(x,z,3.2,3.2,5.2,0x737b61);for(let i=0;i<8;i++)box(.8,.07,.08,0xa08c65,x, .45+i*.46,z+1.2);for(const dx of[-.48,.48])beam([x+dx,0,z+1.5],[x+dx,4,z+1.1],.05);for(const dz of[-1,1])beam([x-1,.2,z+dz],[x+1,4,z+dz],.06);colliders.push({x,z,w:1.5,d:1.6});}
const campFacilities=[['fatigue','营房 · 轮休',-8,-3.1],['grain','粮棚 · 配给',8,-3.1],['equipment','武备棚 · 检修',-8,5.4],['medical','医棚 · 照护',8,5.4],['grain','伙房 · 粮情',-8,13.4]];
function goalAnchor(kind,g){if(['hill','siege','memorial'].includes(kind))return [0,-4,true];if(['harbor','shore'].includes(kind))return [0,-3,false];if(['river','stockade','council','city','fort','ravine'].includes(kind))return g?.id==='execute'?[4,4,true]:[-2,-4,g?.id==='journal'];if(g?.facility&&kind==='camp'){const f=campFacilities.find(x=>x[0]===g.facility);return [f[2],f[3],true];}if(kind==='camp')return [0,-7.3,g?.id==='journal'];if(g?.id==='execute')return ({home:[4,5,true],wall:[6,5,true],compound:[5,3,true],market:[-7,4,true],village:[7,6,true],gate:[8,6,true],road:[0,-5,true]})[kind];return ({home:[0,-2,false],wall:[0,-8,false],compound:[0,-4,false],market:[0,-4,false],village:[0,-4,false],gate:[0,-7,false],road:[0,-5,false]})[kind];}
function selectPoint(p){if(!available())return;selectedPoint=p;if(distance(p.x,p.z)<2.7){interact(p.id);return;}const approach=p.person?.visible?{x:p.x,z:p.z+1.55}:{x:p.x,z:p.z+.45};navigate(approach,p.name);}
function clearAt(x,z){return Math.abs(x)<18&&z>-18&&z<18&&!colliders.some(b=>Math.abs(x-b.x)<b.w+.28&&Math.abs(z-b.z)<b.d+.28);}
function clearRoute(){route=[];destination=null;if(routeLine){scene.remove(routeLine);routeLine.geometry.dispose();routeLine.material.dispose();routeLine=null;}}
function navigate(dest,name='目标位置'){clearRoute();const plan=findRoute({x:player.position.x,z:player.position.z},dest,colliders);if(!plan.length){hint.textContent='此处不能直达，请选择建筑前的交互牌。';return;}route=plan.map(p=>new T.Vector3(p.x,0,p.z));destination=route.shift();routeLine=line([[player.position.x,.06,player.position.z],...[destination,...route].map(v=>[v.x,.06,v.z])],0xb78c43);hint.textContent='前往'+name+' · 可随时用方向键接管';}

function ship(x,z,small=false){const width=small?1.5:2.2,length=small?5:7;box(width,.55,length,0x746043,x,.28,z);for(const side of[-1,1]){box(.12,.65,length,0x8a7755,x+side*width/2,.66,z);const end=box(width,.65,1.8,0x746043,x,.65,z+side*length/2);end.rotation.x=side*.4;}for(let j=-3;j<=3;j++)box(width,.045,.07,0xa79268,x,.58,z+j*.75);cylinder(.08,.1,5.3,0x756246,x,2.8,z);for(let j=0;j<6;j++){const sail=box(2.25,.57,.07,0xc0ac80,x+1.2,2+j*.47,z);sail.rotation.y=.12;box(2.35,.025,.11,0x867255,x+1.2,2+j*.47,z);}for(const dx of[-1,1])beam([x+dx*width/2,.75,z+1],[x+dx*(width+1.5),.13,z+3],.035);}

function environment(kind){
 const floor=new T.Mesh(new T.PlaneGeometry(90,90),mat(kind==='wall'?0xb6b59e:paper));floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;scene.add(floor);
 box(5,.015,50,0xc6b28b,0,.012,0);for(let j=0;j<140;j++){const gx=Math.sin(j*7.21)*20,gz=Math.cos(j*12.9)*20;if(Math.abs(gx)<3)continue;line([[gx,.02,gz],[gx-.13,.26,gz+.04],[gx+.05,.1,gz]],0x989974);}for(let i=0;i<90;i++){const x=Math.sin(i*31.23)*28,z=Math.cos(i*9.31)*28;if(Math.abs(x)<3)continue;line([[x,.028,z],[x+.2,.033,z+.17],[x+.65,.026,z+.09]],0xb4ab8c);}
 for(let i=0;i<16;i++){const a=i*.39;const m=new T.Mesh(new T.ConeGeometry(9,6+(i%4)*2,5),mat(i%2?0xa0aa90:0xaeb69e));m.position.set(Math.sin(a)*65,1,Math.cos(a)*65);scene.add(m);}
 if(kind==='hill'){for(const x of [-10,10])for(let j=0;j<4;j++){ball(2.4,0x969b83,x+(j%2)*2,.8,-12+j*7,scene,1.25,.7,1.2);colliders.push({x:x+(j%2)*2,z:-12+j*7,w:2.6,d:2.7});}for(let j=0;j<6;j++){box(5,.08,1.4,0xb6aa88,0,.08,-15+j*2.4);}tree(-15,9,1.5);tree(14,-8,1.3);table(4,2);flag(-5,-7);rack(6,7);}
 else if(kind==='siege'){box(38,4.8,3,0x90937e,0,2.4,-27);for(let x=-17;x<18;x+=3)box(1.5,.6,3,0x90937e,x,5.1,-27);box(4.5,3.7,3.3,0x534e3f,0,1.8,-26.8);fence(-15,-12,11);fence(4,-12,11);tower(-13,-9);commandTent(-10,7);infirmary(11,8);table(4,2);for(let i=0;i<8;i++)sack(7+i*.6,-5);flag(8,-10);}
 else if(kind==='memorial'){house(0,-12,11,6);table(0,-7.8);for(let i=-2;i<=2;i++)box(.38,.85,.16,0x4e4438,i*.8,1.2,-8.5);cylinder(.4,.3,.35,0x635c47,0,1.1,-7.8);for(const x of [-11,11]){tree(x,-8,1.9);box(1.2,2.1,.35,0x8b8e7c,x,1.05,-2);colliders.push({x,z:-2,w:.7,d:.4});}table(5,5);box(1,.04,.7,0xd9cca9,5,1.02,5);}
 else if(['harbor','shore'].includes(kind)){box(46,.04,20,0x86a79f,0,.035,-14);colliders.push({x:0,z:-14,w:23,d:10});for(let i=0;i<17;i++)line([[-22+i*2.9,.075,-9-i%4],[-20+i*2.9,.075,-9.2-i%4]],0xc4d1b5);for(let i=0;i<3;i++)ship(-12+i*12,-13-i%2*3,kind==='shore');for(let j=0;j<12;j++)box(9,.15,.32,0xa49067,-1,.16,-4+j*.32);posts(-1,-2,8,3,1.1);for(const x of[-5,3])for(let j=0;j<4;j++)cylinder(.13,.2,1.5,0x81704e,x,.75,-4+j*1.1);commandTent(-11,2);granary(11,1);armory(-10,12);infirmary(10,11);for(let i=0;i<6;i++)sack(6+i*.65,-2);flag(-6,-2);table(4,3);tree(-18,10,1.4);}else if(kind==='river'){
 box(43,.035,7,0x829e96,0,.032,-12);for(let i=0;i<8;i++)ball(.48,0x8e8d76,Math.sin(i*1.2),.09,-8.4-i*.92,scene,1.4,.22,.8);
 for(let i=0;i<12;i++){line([[-20+i*3.2,.065,-11],[-18+i*3.2,.065,-11.15]],0xb4c6b3);}
 tree(-10,-1,1.5);tree(11,4,1.2);posts(-9,8,4,3,2.6);roof(-9,8,5,4,2.6,0x9d9678);table(4,2);sack(7,4);fence(-12,-18,9);fence(4,-18,9);tower(11,-17);colliders.push({x:0,z:-12,w:18,d:3.3});
 }else if(kind==='stockade'){
 fence(-14,-15,29);fence(-14,-15,29,'z');fence(14,-15,29,'z');fence(-14,14,10);fence(5,14,10);tower(-11,-10);barracks(7,-10);commandTent(-7,-6);for(let i=0;i<4;i++){sack(7+i*.65,5);rack(7+i*1.2,10);}table(4,2);flag(0,-13);
 }else if(kind==='council'){
 house(0,-12,9,5);table(0,-7);box(1.8,.02,.8,0xe4d4ad,0,.97,-7);for(let i=0;i<4;i++)box(.8,.2,.35,0xb4a17b,6,.18+i*.22,-7);granary(10,-10);tree(-12,-7,1.4);infirmary(-10,6);table(4,2);box(1.3,.035,.75,0xddc89f,4,.99,2);fence(-15,-16,30);flag(-6,-9);sack(9,4);
 }else if(kind==='city'){
 for(const x of[-10,10]){box(14,4,3,0x8d917c,x,2,-13);for(let j=-6;j<=6;j+=2)box(1.2,.7,3,0x8d917c,x+j,4.3,-13);colliders.push({x,z:-13,w:7.5,d:2});}box(6,1.1,3,0x8d917c,0,4.5,-13);roof(0,-13,8,5,5.1);house(-10,-3,6,4);granary(10,-3);posts(-10,7,5,3,2.6);box(5.4,.12,3.5,0xa39874,-10,2.7,7);table(-10,7);sack(-12,10);sack(-9,10);infirmary(10,8);table(4,2);flag(-4,-11);
 }else if(kind==='fort'){
 box(28,1.9,4.5,0x9c9777,0,.9,-12);box(4.5,1.5,16,0xa8a081,-14,.7,-6);colliders.push({x:0,z:-12,w:14.3,d:2.55},{x:-14,z:-6,w:2.6,d:8});for(let i=0;i<12;i++){box(.16,1.1,.16,0x74664c,-12+i*2.1,2.2,-11);beam([-12+i*2.1,.3,-8.5],[-12+i*2.1,1.8,-10.4],.07);}infirmary(9,8);kitchen(-8,6);table(4,2);for(let i=0;i<5;i++)sack(-7+i*.6,-5);flag(11,-10);for(let i=0;i<4;i++)character(-4+i*1.4,11,i%2?'ma':'soldier');
 }else if(kind==='ravine'){
 box(5,.025,46,0x7f9e93,-12,.035,0);colliders.push({x:-12,z:0,w:2.7,d:18});for(let i=0;i<7;i++){ball(2.4,0xaaa88a,-17,.4,-15+i*5,scene,1,.4,1.3);tree(11+Math.sin(i)*2,-13+i*4,1.1);}for(let i=0;i<3;i++)tent(7+i*4,-15);fence(-3,-13,10);table(4,2);flag(9,-11);box(2,.035,7,0xa6936d,-12,.06,7);for(let i=0;i<10;i++)line([[-8,.08,-13+i*2.8],[-7.8,.7,-13+i*2.8]],0x96997a);
 }else if(kind==='camp'){commandTent(0,-12);barracks(-8,-6.5);granary(8,-6.5);armory(-8,2);infirmary(8,2);kitchen(-8,10);tower(11,11);fence(-14,-16,29);fence(-14,-15,30,'z');fence(14,-15,30,'z');for(let i=0;i<4;i++)character(4+i*1.4,12);}
 else if(kind==='home'){house(0,-12,10,6);house(-12,-2,5,7);house(12,-2,5,7);for(const x of [-8,8]){posts(x,-6,3,8,2.7);roof(x,-6,4,9,2.7,0x888c7b);}table(5,3);for(let i=0;i<4;i++)box(.6,.045,.35,0xd6c8a7,4.5+i*.25,1.0+i*.06,3);box(3,.08,4,0x9da994,-7,.08,5);colliders.push({x:-7,z:5,w:1.7,d:2.2});tree(-11,10,1.6);cylinder(.55,.7,.8,0x92917a,9,.4,8);box(1.1,.6,.7,0x8c7754,7,.3,-8);}
 else if(kind==='wall'){box(29,3.5,2.2,0x898c79,0,1.75,-12);for(let x=-14;x<=14;x+=2.1)box(1.2,.75,2.1,0x858774,x,3.88,-12);colliders.push({x:0,z:-12,w:15,d:1.65});for(let i=0;i<5;i++)box(3,.24,1,0x99947b,8,i*.24,-7-i);armory(-9,-5);table(6,3);infirmary(-9,8);for(let i=0;i<5;i++)sack(10+i*.55,7);flag(-12,-10);for(let i=0;i<8;i++)tent(-16+i*5,-32);}
 else if(kind==='compound'){house(-6,-7,5,5);house(7,-9,5,5);box(.9,1.5,.08,0x564e3b,-6,1,-4.4);for(let i=0;i<4;i++)box(.055,1.3,.1,0x928367,-6.3+i*.2,1.1,-4.3);fence(-12,7,10);fence(3,7,10);fence(-12,-12,25);rack(-9,3);box(1.8,.18,3,0x817456,6,.3,1);flag(-11,-11);for(let i=0;i<3;i++)character(-5+i*1.2,5);}
 else if(kind==='market'){house(-9,-8,6,4);house(8,-9,6,5);table(-7,2);table(7,2);posts(-7,2,3.5,2,2.3);box(4,.09,2.7,0xad8b5d,-7,2.4,2);cylinder(.38,.3,.3,0x8d7350,-7,1.06,2);beam([6,1.35,2],[8,1.35,2],.025);for(let i=0;i<12;i++)sack((i<6?-9:7)+i%3,5+Math.floor(i%6/3));tree(-13,7);box(5,.025,50,0x8eaba0,22,.025,0);for(let i=0;i<4;i++)character(-10+i*5,10);}
 else if(kind==='village'){house(-8,-7,6,4);barracks(8,-8);cylinder(.7,.8,.7,0x8d947b,-5,.35,3);posts(-5,3,1.6,1.2,2.3);beam([-5,2.3,3],[-5,.5,3],.018);house(-11,8,4,4);tree(-12,-1,1.3);table(7,4);rack(10,7);for(let i=0;i<8;i++)character(-5+i*1.4,11);for(let i=0;i<6;i++)sack(11+i%2,-13+Math.floor(i/2));}
 else if(kind==='gate'){for(const x of[-10,10]){box(14,4,3,0x8d917c,x,2,-12);for(let j=-6;j<=6;j+=2)box(1.2,.7,3,0x8d917c,x+j,4.3,-12);colliders.push({x,z:-12,w:7.5,d:2});}box(6,1.4,3,0x8d917c,0,4,-12);roof(0,-12,8,5,4.7);for(let i=0;i<8;i++)character(-6+i*1.6,-7);flag(-4,-10);table(8,4);}
 else{tree(-9,-4,1.5);tree(9,8,1.25);box(6,.025,60,0x8eaaa0,17,.026,0);for(let i=0;i<12;i++)cylinder(.025,.04,.9+(i%3)*.2,0xa7a17c,13+Math.sin(i)*2,.5,-13+i*2);house(-15,-15);}
}
function init(){if(renderer)return;renderer=new T.WebGLRenderer({canvas,antialias:true,alpha:false});renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.outputColorSpace=T.SRGBColorSpace;camera=new T.PerspectiveCamera(47,1,.1,140);new ResizeObserver(resize).observe(root);requestAnimationFrame(loop);}
function dispose(){if(!scene)return;scene.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material&&![...materials.values()].includes(o.material)){if(o.material.dispose)o.material.dispose();}});document.getElementById('worldLabels').replaceChildren();}
function open(kind,goal,onInteract){
 try{init();}catch(e){document.getElementById('worldError').hidden=false;document.getElementById('worldError').textContent='此设备未能启用三维画面。请在支持 WebGL 的浏览器打开。'+e.message;root.hidden=false;return;}
 const snap=window.Chapter8UI.snapshot(),sceneKey=snap.node+':'+snap.phase+':'+snap.retired.join(',');
 if(scene&&where===kind&&currentSceneKey===sceneKey){target=goal;callback=onInteract;root.hidden=false;active=true;document.body.classList.add('in-world');updateGoal(goal||{id:'journal',name:'查阅主线竹简'});resize();canvas.focus();return;}
 dispose();scene=new T.Scene();scene.background=new T.Color(0xdcd5be);scene.fog=new T.Fog(0xdcd5be,27,90);scene.add(new T.HemisphereLight(0xfff3cd,0x667462,1.7));const sun=new T.DirectionalLight(0xffead0,1.7);sun.position.set(-16,27,8);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-25,right:25,top:25,bottom:-25,near:1,far:80});sun.shadow.bias=-.0007;scene.add(sun);
 currentSceneKey=sceneKey;where=kind;target=goal;callback=onInteract;points=[];colliders=[];keys={};destination=null;clock=0;yaw=0;zoom=10.5;route=[];routeLine=null;selectedPoint=null;
 environment(kind);player=character(0,6,window.Chapter8UI.playerId(kind));player.rotation.y=Math.PI;
 camera.position.set(0,4.5,6+zoom);camera.lookAt(0,1.22,6);camera.updateMatrixWorld();
 
 if(goal){const a=goalAnchor(kind,goal);marker(goal.id,goal.name,a[0],a[1],a[2]?'object':goal.type||'soldier',true);}
 if(kind==='camp')campFacilities.forEach(([id,name,x,z])=>marker('facility:'+id,name,x,z,'object'));
 else{const extra={harbor:[['grain','船粮仓',11,4]],shore:[['equipment','登岸武备',-10,14]],river:[['fatigue','歇脚棚',-9,10.3]],stockade:[['equipment','兵械架',7,11.7]],council:[['medical','照护处',-10,9.4]],city:[['grain','城中粮仓',10,.1],['medical','医棚',10,11.4]],fort:[['medical','撤离医棚',9,11.4],['grain','伙房',-8,9.4]],ravine:[['cohesion','合队传令',4,4]],wall:[['equipment','武备检视',-9,-1.7],['medical','医棚照护',-9,11.1]],village:[['fatigue','临时营房',8,-4.7]],home:[['grain','家粮专账',7,-5.7]]}[kind]||[];extra.forEach(([id,name,x,z])=>marker('facility:'+id,name,x,z,'object'));marker('observe','查看'+({river:'渡口石滩',stockade:'营门围栅',council:'案牍器具',city:'城中街市',fort:'土垒工事',ravine:'涧侧地势',home:'家中器物',wall:'守城工事',market:'量米器具',village:'乡间农具',gate:'城门',compound:'拘押院落',road:'道路'}[kind]||'场所'),-4,1,'object');}
 const council=(kind===Chapter8Content.nodes[snap.node].scene?window.Chapter8WorldContent.nodes[snap.node].cast:kind==='home'?['zhubiao']:[]).filter(id=>kind==='home'&&Chapter8Content.nodes[snap.node].scene!=='home'?id==='zhubiao':window.Chapter8WorldModel.active(snap,window.Chapter8WorldModel.person(id))).slice(0,4);council.forEach((id,i)=>marker('person:'+id,window.Chapter8WorldModel.person(id).name,-5+i*5,4,id));
 marker('ambient',kind==='home'?'查看家中书案':kind==='memorial'?'查看祭告簿':'与军民交谈',4,-.5,['home','memorial'].includes(kind)?'object':'soldier');
 const nav=document.getElementById('worldFacilities');nav.replaceChildren();points.filter(p=>p.id.startsWith('facility:')).forEach(p=>{const b=document.createElement('button');b.textContent=p.name+' ↗';b.onclick=()=>selectPoint(p);nav.append(b);});
 const mini=document.querySelector('.world-map svg');mini.querySelectorAll('.mini-fixture').forEach(x=>x.remove());for(const c of colliders.filter(c=>!c.person)){const b=document.createElementNS('http://www.w3.org/2000/svg','rect');b.setAttribute('class','mini-fixture');b.setAttribute('x',50+(c.x-c.w)*2);b.setAttribute('y',50+(c.z-c.d)*2);b.setAttribute('width',c.w*4);b.setAttribute('height',c.d*4);b.setAttribute('fill','#718068');mini.insertBefore(b,document.getElementById('worldMiniDot'));}
root.hidden=false;active=true;document.body.classList.add('in-world');document.getElementById('worldTitle').textContent={hill:'山道 · 阵前踏看',siege:'城外 · 围军阵地',memorial:'祠前 · 名籍与祭告',harbor:'舟师码头 · 帆樯与转运',shore:'江岸 · 水陆指挥处',river:'江边渡口',stockade:'当期营寨 · 外栅',council:'幕府 · 军议处',city:'城门 · 军民街市',fort:'当期驻守营垒',ravine:'涧侧 · 阵前地形',camp:'诸军 · 受任营地',home:'应天 · 家',wall:'守区 · 城防',compound:'当期院落 · 门内',market:'当期城镇 · 市集',village:'乡里 · 村落',gate:'当期城门阵地',road:'当期行军道'}[kind]||kind;
 document.getElementById('worldObjective').textContent=goal?'当前目标：'+goal.name:'自由查看场所';document.getElementById('worldGo').disabled=!goal;document.getElementById('worldRoute').textContent='';
 hint.textContent='WASD / 方向键行走 · 拖动转向 · 点击地面行走 · 走近后按 E';
 document.getElementById('worldPosition').textContent='位置 0.0，6.0';resize();canvas.focus();
}
function close(){active=false;keys={};destination=null;root.hidden=true;document.body.classList.remove('in-world');document.getElementById('mainQuest').focus();}

function updateGoal(goal){if(!active)return;if(player&&player.userData.role!=='ma')dress(player);keys={};clearRoute();const p=points.find(x=>x.story),a=goalAnchor(where,goal);target=goal;
 if(p){const old=colliders.find(x=>x.person&&x.x===p.x&&x.z===p.z);if(old)colliders.splice(colliders.indexOf(old),1);p.id=goal.id;p.name=goal.name;p.x=a[0];p.z=a[1];p.tag.p.set(p.x,a[2]?1.85:2.65,p.z);p.tag.el.textContent=goal.name;p.tag.el.classList.toggle('facility',a[2]);if(!a[2]&&p.person?.userData.role!==(goal.type||'soldier')){if(p.person){scene.remove(p.person);p.person.traverse(o=>o.geometry?.dispose());}p.person=character(p.x,p.z,goal.type||'soldier');}if(p.person){if(p.person.userData.role==='officer')dress(p.person);p.person.visible=!a[2];p.person.position.set(p.x,0,p.z);if(!a[2])colliders.push({x:p.x,z:p.z,w:.42,d:.42,person:true});}p.ring.position.set(p.x,.035,p.z);}
 else marker(goal.id,goal.name,a[0],a[1],a[2]?'object':goal.type||'soldier',true);
 document.getElementById('worldObjective').textContent='当前目标：'+goal.name;document.getElementById('worldGo').disabled=false;
}
function resize(){if(!renderer)return;const w=root.clientWidth,h=root.clientHeight;if(w&&h){renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}}
function distance(x,z){return Math.hypot(player.position.x-x,player.position.z-z);}
function available(){return active&&!document.querySelector('dialog[open]')&&!document.hidden;}
function interact(id){if(!available())return;const p=points.find(x=>x.id===id);if(!p||distance(p.x,p.z)>2.7)return;keys={};destination=null;if(callback)callback(id);}
function walk(dx,dz){const nx=player.position.x+dx,nz=player.position.z+dz;if(clearAt(nx,player.position.z))player.position.x=nx;if(clearAt(player.position.x,nz))player.position.z=nz;}
function loop(time){requestAnimationFrame(loop);const dt=Math.min((time-last)/1000,.05);last=time;if(!active||!scene)return;const allowed=available();let dx=0,dz=0;
 if(allowed){dx=(keys.KeyD||keys.ArrowRight?1:0)-(keys.KeyA||keys.ArrowLeft?1:0);dz=(keys.KeyS||keys.ArrowDown?1:0)-(keys.KeyW||keys.ArrowUp?1:0);
  if(dx||dz){clearRoute();const a=dx*Math.cos(yaw)+dz*Math.sin(yaw),b=dz*Math.cos(yaw)-dx*Math.sin(yaw);dx=a;dz=b;}
  else if(destination){dx=destination.x-player.position.x;dz=destination.z-player.position.z;if(Math.hypot(dx,dz)<.16){destination=route.shift()||null;dx=dz=0;if(!destination){if(routeLine){scene.remove(routeLine);routeLine.geometry.dispose();routeLine.material.dispose();routeLine=null;}hint.textContent='已到达 · 按 E 或点击近处交互牌';}}}
 }
 const moving=Math.hypot(dx,dz)>.01;if(moving){const l=Math.hypot(dx,dz),speed=(keys.ShiftLeft?4.4:2.8)*dt;const before=player.position.clone();walk(dx/l*speed,dz/l*speed);player.rotation.y=Math.atan2(dx,dz);clock+=dt*8;walkSound+=before.distanceTo(player.position);if(walkSound>.9){walkSound=0;window.HongwuWorldSound?.step(where);}}
 for(let i=0;i<4;i++)player.userData.limbs[i].rotation.x=moving?Math.sin(clock+(i<2?0:Math.PI))*(i%2?.28:.4):0;
 const cp=overview?new T.Vector3(19,26,27):new T.Vector3(player.position.x+Math.sin(yaw)*zoom,4.5,player.position.z+Math.cos(yaw)*zoom);camera.position.lerp(cp,Math.min(1,dt*9));if(overview)camera.lookAt(0,0,0);else camera.lookAt(player.position.x,1.22,player.position.z);
 let nearest=null;for(const p of points){const v=p.tag.p.clone().project(camera);p.tag.el.style.left=(v.x*.5+.5)*root.clientWidth+'px';p.tag.el.style.top=(-v.y*.5+.5)*root.clientHeight+'px';p.tag.el.hidden=v.z>1||v.z<0;const d=distance(p.x,p.z);p.tag.el.classList.toggle('near',d<2.7);p.tag.el.classList.toggle('selected',p===selectedPoint);p.tag.el.innerHTML=p.name+'<small>'+(d<2.7?'E · '+(p.person?.visible?'交谈':'查看'):(d.toFixed(0)+'步 · 点击前往'))+'</small>';if(p.story)document.getElementById('worldRoute').textContent='目标距离 '+d.toFixed(0)+'步'+(destination?' · 行走中':'');if(d<2.7&&(!nearest||d<nearest.d))nearest={p,d};}
 const ib=document.getElementById('worldInteract');ib.disabled=!nearest;ib.textContent=nearest?'E · '+nearest.p.name:'走近人物 / 标记';ib.onclick=()=>nearest&&interact(nearest.p.id);
 document.getElementById('worldPosition').textContent='位置 '+player.position.x.toFixed(1)+'，'+player.position.z.toFixed(1);
 document.getElementById('worldMiniDot').setAttribute('cx',50+player.position.x*2);document.getElementById('worldMiniDot').setAttribute('cy',50+player.position.z*2);
 renderer.render(scene,camera);
}
document.addEventListener('keydown',e=>{if(!available())return;if(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','ShiftLeft'].includes(e.code)){keys[e.code]=true;e.preventDefault();}if(e.code==='KeyE'){const n=points.filter(p=>distance(p.x,p.z)<2.7).sort((a,b)=>distance(a.x,a.z)-distance(b.x,b.z))[0];if(n)interact(n.id);e.preventDefault();}if(e.code==='KeyM'||e.code==='Escape'){close();e.preventDefault();}});
document.addEventListener('keyup',e=>delete keys[e.code]);window.addEventListener('blur',()=>{keys={};destination=null;});document.addEventListener('visibilitychange',()=>{if(document.hidden){keys={};destination=null;}});
canvas.addEventListener('pointerdown',e=>{drag={x:e.clientX,y:e.clientY,last:e.clientX,moved:false};canvas.setPointerCapture(e.pointerId);});
canvas.addEventListener('pointermove',e=>{if(!drag)return;const d=e.clientX-drag.last;drag.last=e.clientX;if(Math.hypot(e.clientX-drag.x,e.clientY-drag.y)>5)drag.moved=true;if(drag.moved)yaw-=d*.007;});
canvas.addEventListener('pointerup',e=>{if(drag&&!drag.moved&&available()){const r=canvas.getBoundingClientRect(),ray=new T.Raycaster();ray.setFromCamera(new T.Vector2((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1),camera);const dest=new T.Vector3();if(ray.ray.intersectPlane(new T.Plane(new T.Vector3(0,1,0),0),dest)){selectedPoint=null;navigate(dest);}}drag=null;});
canvas.addEventListener('wheel',e=>{zoom=Math.max(5,Math.min(12,zoom+e.deltaY*.007));e.preventDefault();},{passive:false});
document.querySelectorAll('[data-move]').forEach(b=>{const code=b.dataset.move;b.onpointerdown=e=>{b.setPointerCapture(e.pointerId);keys[code]=true;e.preventDefault();};b.onpointerup=b.onpointercancel=()=>delete keys[code];b.onlostpointercapture=()=>delete keys[code];});
document.getElementById('worldOverview').onclick=()=>{overview=!overview;document.getElementById('worldOverview').textContent=overview?'人物跟随':'俯看营地';};
document.getElementById('worldGo').onclick=()=>{const p=points.find(p=>p.story);if(p)selectPoint(p);};document.getElementById('worldCampLedger').onclick=()=>window.FullChapter.open('ledger');
document.getElementById('worldBack').onclick=close;document.getElementById('worldJournal').onclick=()=>window.FullChapter.open();document.getElementById('worldSound').onclick=()=>window.HongwuAudio.openSettings();
window.ChapterWorld={open,close,updateGoal,getPlace:()=>where,isOpen:()=>active};


// Role and scene determine practical dress, not an invented exact equipment grant date.
function dress(g){
 const a=window.Chapter8UI?.appearance(where);if(g.userData.outfit===a?.key)return;
 if(g.userData.gear){g.remove(g.userData.gear);g.userData.gear.traverse(o=>o.geometry?.dispose());g.userData.gear=null;}
 for(const part of g.children)if(part.name==='hemp-vest')part.visible=a?.key==='travel';
 g.userData.outfit=a?.key;if(!a?.armored)return;
 const gear=new T.Group();g.add(gear);g.userData.gear=gear;
 // Curved rows of independently laced rectangular plates, front and back.
 for(const face of[-1,1])for(let row=0;row<7;row++)for(let col=-3;col<=3;col++){
  const x=col*.081,z=face*(.222-Math.abs(col)*.01),y=1.55-row*.077;
  box(.073,.091,.024,0x59645c,x,y,z,gear);
  if(row%2===0)for(const dx of[-.019,.019])ball(.009,0xb4a079,x+dx,y+.025,z+face*.016,gear);
 }
 for(const side of[-1,1]){for(let row=0;row<3;row++)box(.20,.075,.36,0x5f675d,side*(.31+row*.018),1.55-row*.07,0,gear);for(let row=0;row<4;row++)for(let col=-2;col<=2;col++)box(.077,.075,.025,0x59645c,col*.085,.99-row*.07,side*.23,gear);}
 // Plain rounded iron bowl; red cloth remains at brow and as tie behind the helmet.
 ball(.252,0x626e64,0,2.075,-.01,gear,1,.76,1.06);cylinder(.254,.254,.042,0x424d45,0,2.027,-.01,gear,16);
 for(let row=0;row<4;row++)for(let col=-3;col<=3;col++)box(.066,.07,.026,0x59645c,col*.062,1.99-row*.068,-.211,gear);
 cylinder(.038,.075,.13,0x5a6158,0,2.29,-.01,gear);box(.06,.59,.07,0x423a2c,-.38,.84,.07,gear);box(.17,.04,.12,0x746145,-.38,1.12,.07,gear);
 if(a.winter){cylinder(.18,.21,.13,0x9d957b,0,1.69,0,gear,12);for(const side of[-1,1])box(.13,.25,.18,0x88846d,side*.34,1.17,0,gear);}
 g.userData.outfit=a.key;
}
