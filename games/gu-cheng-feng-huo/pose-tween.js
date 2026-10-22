(function(root){'use strict';
// Warp each existing key pose toward the other pose before compositing. The
// original atlases remain untouched; the small motion meshes are read-only data.
let renderer=null,failed=false;const fields=new Map();
function shader(gl,type,source){const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;}
function create(){
 const canvas=document.createElement('canvas');canvas.width=512;canvas.height=288;
 const gl=canvas.getContext('webgl',{alpha:true,premultipliedAlpha:true,antialias:false,preserveDrawingBuffer:true});if(!gl)return null;
 const program=gl.createProgram();gl.attachShader(program,shader(gl,gl.VERTEX_SHADER,`
 attribute vec2 point;attribute vec2 motion;uniform float progress;varying vec2 original;
 void main(){original=point;vec2 p=point+motion*progress;gl_Position=vec4(p.x/256.0-1.0,1.0-p.y/144.0,0.0,1.0);}`));
 gl.attachShader(program,shader(gl,gl.FRAGMENT_SHADER,`
 precision mediump float;varying vec2 original;uniform sampler2D sprite;uniform vec4 rect;uniform vec2 anchor;uniform vec2 dimensions;uniform float scale;uniform float opacity;
 void main(){vec2 local=(original-vec2(256.0,260.0))/scale+anchor;
 if(local.x<0.0||local.y<0.0||local.x>=rect.z||local.y>=rect.w)discard;
 vec4 p=texture2D(sprite,(rect.xy+local)/dimensions);gl_FragColor=vec4(p.rgb*p.a,p.a)*opacity;}`));
 gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));gl.useProgram(program);
 const indices=[];for(let y=0;y<18;y++)for(let x=0;x<32;x++){const a=y*33+x,b=a+1,c=a+33,d=c+1;indices.push(a,b,c,b,d,c);}
 const index=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,index);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(indices),gl.STATIC_DRAW);
 const points=[];for(let y=0;y<19;y++)for(let x=0;x<33;x++)points.push(x*16,y*16);
 const point=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,point);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(points),gl.STATIC_DRAW);
 const pLoc=gl.getAttribLocation(program,'point');gl.enableVertexAttribArray(pLoc);gl.vertexAttribPointer(pLoc,2,gl.FLOAT,false,0,0);
 const motion=gl.createBuffer(),mLoc=gl.getAttribLocation(program,'motion');gl.enableVertexAttribArray(mLoc);
 const uniforms={};for(const k of ['progress','rect','anchor','dimensions','scale','opacity'])uniforms[k]=gl.getUniformLocation(program,k);
 gl.uniform1i(gl.getUniformLocation(program,'sprite'),0);gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE);gl.clearColor(0,0,0,0);
 canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();failed=true;});
 return {canvas,gl,motion,mLoc,uniforms,count:indices.length,textures:new Map()};
}
function pair(a,b){
 const data=root.POSE_FLOW_DATA;if(!data)return null;
 const left=a.sheet+':'+a.frame,right=b.sheet+':'+b.frame,direct=left+'>'+right,reverse=right+'>'+left;
 const key=data.pairs[direct]?direct:data.pairs[reverse]?reverse:null;if(!key)return null;
 let flow=fields.get(key);if(!flow){const bytes=atob(data.pairs[key]),half=33*19*2,all=new Float32Array(bytes.length);for(let i=0;i<bytes.length;i++){const n=bytes.charCodeAt(i);all[i]=(n>127?n-256:n)/2;}flow=[all.subarray(0,half),all.subarray(half)];fields.set(key,flow);}
 return key===direct?flow:[flow[1],flow[0]];
}
function layer(r,images,atlas,p,flow,progress,opacity){
 const {gl,uniforms:u}=r,meta=atlas[p.sheet],f=meta.frames[p.frame],im=images[p.sheet];if(!im)throw Error('Missing pose');
 let texture=r.textures.get(im);if(!texture){texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,texture);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,false);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,im);r.textures.set(im,texture);}else gl.bindTexture(gl.TEXTURE_2D,texture);
 gl.bindBuffer(gl.ARRAY_BUFFER,r.motion);gl.bufferData(gl.ARRAY_BUFFER,flow,gl.DYNAMIC_DRAW);gl.vertexAttribPointer(r.mLoc,2,gl.FLOAT,false,0,0);
 gl.uniform1f(u.progress,progress);gl.uniform1f(u.opacity,opacity);gl.uniform4fv(u.rect,f.rect);gl.uniform2fv(u.anchor,f.anchor);gl.uniform2fv(u.dimensions,meta.size);gl.uniform1f(u.scale,f.scale||root.AnimationCore.scaleFor(p.sheet));
 gl.drawElements(gl.TRIANGLES,r.count,gl.UNSIGNED_SHORT,0);
}
function draw(ctx,images,atlas,ls,alpha){
 if(failed||ls.length!==2)return false;const flow=pair(ls[0],ls[1]);if(!flow)return false;
 try{
  if(!renderer)renderer=create();if(!renderer){failed=true;return false;}
  const r=renderer;r.gl.clear(r.gl.COLOR_BUFFER_BIT);
  // Keep one crisp contour for most of the trajectory. A narrow dissolve only
  // bridges occluded details near the centre of a geometrically aligned pose.
  const q=ls[1].weight,t=Math.max(0,Math.min(1,(q-.44)/.12)),fade=t*t*(3-2*t);
  if(fade<1)layer(r,images,atlas,ls[0],flow[0],q,1-fade);
  if(fade>0)layer(r,images,atlas,ls[1],flow[1],1-q,fade);
  ctx.globalAlpha=alpha;ctx.drawImage(r.canvas,-256,-260);return true;
 }catch(_){failed=true;return false;}
}
function releaseImages(images){if(!renderer)return;for(const im of Object.values(images)){const tex=renderer.textures.get(im);if(tex){renderer.gl.deleteTexture(tex);renderer.textures.delete(im);}}}
root.PoseTween={releaseImages,draw,status:()=>failed?'fallback':renderer?'motion-mesh':'ready',pair};
})(globalThis);
