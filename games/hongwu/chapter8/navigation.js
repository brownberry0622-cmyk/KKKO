// Deterministic grid routing; movement and routing use the same expanded footprints.
export function findRoute(start,end,colliders){
 const clear=(x,z)=>Math.abs(x)<18&&Math.abs(z)<18&&!colliders.some(b=>Math.abs(x-b.x)<b.w+.38&&Math.abs(z-b.z)<b.d+.38);
 const near=(p,max)=>{let best=null,d=Infinity;for(let x=-17;x<=17;x++)for(let z=-17;z<=17;z++){const n=Math.hypot(x-p.x,z-p.z);if(n<d&&n<=max&&clear(x,z)){best={x,z};d=n;}}return best;};
 const a=near(start,2),b=near(end,2.5);if(!a||!b)return [];
 const key=p=>p.x+','+p.z,k0=key(a),kt=key(b),open=[{...a,g:0,f:0}],scores=new Map([[k0,0]]),parents=new Map(),done=new Set();
 while(open.length){open.sort((a,b)=>a.f-b.f);const c=open.shift(),ck=key(c);if(done.has(ck))continue;if(ck===kt){const path=[b];let at=ck;while(at!==k0){at=parents.get(at);const[x,z]=at.split(',').map(Number);path.push({x,z});}path.reverse();if(clear(end.x,end.z)&&Math.hypot(end.x-b.x,end.z-b.z)<1.4)path.push({x:end.x,z:end.z});return path;}
 done.add(ck);for(const[dx,dz]of[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){const n={x:c.x+dx,z:c.z+dz},nk=key(n);if(!clear(n.x,n.z)||done.has(nk)||dx&&dz&&(!clear(c.x+dx,c.z)||!clear(c.x,c.z+dz)))continue;const g=c.g+Math.hypot(dx,dz);if(g>=(scores.get(nk)??Infinity))continue;scores.set(nk,g);parents.set(nk,ck);open.push({...n,g,f:g+Math.hypot(n.x-b.x,n.z-b.z)});}}
 return [];
}
