// Shared procedural scenery: no downloaded textures, per-frame meshes or extra lights.
function cityDistrict(x,z){return x<205?'coast':z>345?'harbor':Math.hypot((x-345)*.85,z-235)<100?'downtown':'garden'}
function cityBuildingKind(x,z,variant){const district=cityDistrict(x,z),mix=variant%100;
 if(district==='coast')return mix<63?'house':mix<89?'store':'bar';
 if(district==='downtown')return mix<57?'office':mix<91?'apartment':'store';
 if(district==='harbor')return mix<40?'warehouse':mix<65?'store':mix<85?'apartment':'house';
 return mix<56?'house':mix<78?'apartment':mix<94?'store':'bar';
}

function curtainWallMaterial(){
 if(curtainWallMaterial.cache)return curtainWallMaterial.cache;
 const material=surfaceFinish(new THREE.MeshStandardMaterial({color:lin('#516d7a'),metalness:.52,roughness:.2,envMapIntensity:1.05}),'curtain-glass'),compile=material.onBeforeCompile;
 material.customProgramCacheKey=()=> 'curtain-wall-v1';material.onBeforeCompile=sh=>{compile(sh);sh.fragmentShader=sh.fragmentShader.replace('#include <roughnessmap_fragment>',`
 vec2 glazingUV=vec2(detailUV.x/1.35,vSurfacePosition.y/3.6);vec2 glazing=fract(glazingUV);vec2 ga=max(fwidth(glazingUV),vec2(.001));
 vec2 frameEdge=1.0-smoothstep(vec2(.012),vec2(.012)+ga,min(glazing,1.0-glazing));float mullion=max(frameEdge.x,frameEdge.y);
 float roomHash=fract(sin(dot(floor(glazingUV),vec2(12.989,78.23)))*43758.54);
 diffuseColor.rgb*=.67+roomHash*.36;diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.15,.19,.20),mullion);
 #include <roughnessmap_fragment>
 roughnessFactor=mix(.18,.55,mullion);`)};return curtainWallMaterial.cache=material;
}

function buildCityArchitecture(kind,ctx){
 if(!['office','apartment','warehouse'].includes(kind))return false;
 const{part,record,w,d,variant,cream,trim,roof,warmWindow,houseRoof}=ctx,W=w-1.2,D=d-1.4,front=D/2,style=variant%3;
 record.district=cityDistrict(record.x,record.z);record.footprintW=W;record.footprintD=D;record.cityArchitecture=true;
 const stone='#b7b7ac',metal='#3f4c4c',brick='#8d5c49';
 const parapet=(ww,dd,y,px=0,pz=0)=>{part(stone,ww,.45,.18,px,y+.12,pz+dd/2);part(stone,ww,.45,.18,px,y+.12,pz-dd/2);for(const side of[-1,1])part(stone,.18,.45,dd,px+side*ww/2,y+.12,pz)};
 const door=(px,pz,width=1.6)=>{part(metal,width+.2,2.9,.12,px,1.45,pz);part(warmWindow,width,2.65,.14,px,1.4,pz+.07);part(trim,.06,2.65,.18,px,1.4,pz+.1);part(cream,width+1.1,.18,.8,px,3.05,pz-.15)};
 const windows=(width,height,depth,px,py,pz,color,floors)=>part(bMat(color,floors,Math.max(1,Math.round(width/8))),width,height,depth,px,py,pz);
 if(kind==='warehouse'){
  const h=5.2;record.roofHeight=h;record.style=['Dock warehouse','Motor depot','Brick workshop'][style];
  part(style===2?brick:'#8e9690',W,h,D,0,h/2,0);part('#4b4d4c',W+.35,1.25,D+.35,0,h,0,houseRoof);
  for(const x of W>12?[-W*.25,W*.25]:[0]){part('#3f4c4c',3.25,3.6,.13,x,1.8,front+.025);for(let y=.3;y<3.6;y+=.35)part('#818d88',3.15,.045,.16,x,y,front+.08);part(cream,3.5,.12,.5,x,3.7,front-.1)}
  part(buildingSign(['HARBOR LOGISTICS','COAST MOTOR WORKS','BAY STORAGE'][style],'#344749','#e8dfc9'),Math.min(W-1,9),.8,.1,0,4.55,front+.08);
  for(const side of[-1,1]){part(metal,.12,h,.12,side*(W/2-.18),h/2,front+.1);part(cream,.22,.3,.3,side*(W/2-.18),3.8,front+.15)}return true;
 }
 if(kind==='office'){
  const floors=5+variant%4,h=floors*3.6,color=['#adb0aa','#839392','#a39787'][style];record.roofHeight=h;record.style=['Stepped glass office','Limestone civic tower','Brick city hotel'][style];
  // A wider podium and recessed upper floors replace repeated needle-like boxes.
  part(style===2?brick:stone,W,4,D,0,2,0);const upperW=W-(style===0?1.4:.6),upperD=D-.8,upperH=h-4;
  if(style===0)part(curtainWallMaterial(),upperW,upperH,upperD,0,4+upperH/2,-.15);
  else windows(upperW,upperH,upperD,0,4+upperH/2,-.15,style===2?'#a39787':color,floors-1);
  if(style===0){const crownH=3.6;part(roof,upperW-1.4,crownH,upperD-1.3,0,h+crownH/2,-.35);part(metal,upperW-1.2,.2,upperD-1.1,0,h+crownH,-.35);record.roofHeight=h+crownH;}
  else{for(const side of[-1,1])part(style===2?brick:cream,.32,h-4,.3,side*(upperW/2-.4),4+(h-4)/2,upperD/2-.13);
   if(style===1)for(let x=-upperW/2+2;x<upperW/2-1;x+=2.2)part(cream,.12,h-4,.15,x,4+(h-4)/2,upperD/2-.08);}
  parapet(upperW,upperD,h,0,-.15);part(stone,W+.15,.23,D+.15,0,4.05,0);
  for(const x of[-W*.32,W*.32]){part(metal,W*.27,2.65,.16,x,1.8,front+.03);part(warmWindow,W*.25,2.45,.17,x,1.8,front+.07);part(trim,.07,2.45,.2,x,1.8,front+.1)}door(0,front+.07);
  part(buildingSign(['BAYVIEW FINANCIAL','COASTAL HOUSE','THE MERIDIAN'][style],'#344749','#dfd6bc'),Math.min(W-1,8),.55,.12,0,3.65,front+.12);
 }else{
  const floors=3+variant%3,h=floors*3.15,color=['#d4cbb9','#a8aaa5','#b7a58b'][style];record.roofHeight=h;record.style=['Balcony court','Brick corner flats','Terrace apartments'][style];
  windows(W,h,D,0,h/2,0,style===1?'#ad9685':color,floors);part(stone,W+.12,.22,D+.12,0,3.05,0);parapet(W,D,h);
  const count=W>12?3:2,balconyWidth=(W-1)/count;
  for(let floor=1;floor<floors;floor++)for(let bay=0;bay<count;bay++){const x=(bay-(count-1)/2)*balconyWidth,y=floor*3.15;
   part(stone,balconyWidth-.28,.15,.72,x,y,front+.25);part(metal,balconyWidth-.35,.055,.055,x,y+.92,front+.58);part(metal,balconyWidth-.35,.045,.045,x,y+.38,front+.58);
   for(let bar=0;bar<5;bar++)part(metal,.035,.84,.035,x+(bar-2)*(balconyWidth-.4)/4,y+.51,front+.58);
   for(const side of[-1,1])part(style===1?brick:cream,.14,.94,.7,x+side*(balconyWidth-.28)/2,y+.52,front+.26);
  }
  door(0,front+.09);part(buildingSign(['BAYVIEW COURT','PALM RESIDENCES','GARDEN TERRACES'][style],'#47564c','#eee6d3'),Math.min(W-1,6),.42,.1,0,2.91,front+.15);
 }
 return true;
}

function palmFrondGeometry(){
 const p=[],uv=[],tri=(a,b,c)=>{p.push(...a,...b,...c);uv.push(0,0,.5,1,1,0)},spine=t=>[t*4.6,Math.sin(t*Math.PI)*.65-t*t*1.35,0];
 for(let i=0;i<23;i++){const t=(i+1)/24,a=spine(t),b=spine(Math.min(1,t+.065)),length=Math.sin(t*Math.PI)**.65*.83;
  for(const side of[-1,1]){const tip=[a[0]-.28,a[1]-.16,side*length],mid=[a[0]+.17,a[1]-.025,side*length*.48];tri(a,mid,tip);tri(a,b,mid)}
 }
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.computeVertexNormals();return g;
}

function finishTerrain(material){
 surfaceFinish(material,'terrain');const compile=material.onBeforeCompile,grass=landscapeTexture();
 material.customProgramCacheKey=()=> 'landscape-v1';
 material.onBeforeCompile=sh=>{compile(sh);sh.uniforms.landscapeGrain={value:grass};sh.fragmentShader='uniform sampler2D landscapeGrain;\n'+sh.fragmentShader.replace('#include <alphatest_fragment>',`
 // The terrain atlas is a land mask. Let the same ocean surface show inside it.
 if(diffuseColor.b>diffuseColor.g*1.12&&diffuseColor.b>diffuseColor.r*1.8)discard;
 #include <alphatest_fragment>`).replace('#include <roughnessmap_fragment>',`
 // Grass, sand and paved lots inherit the atlas mask, but share metre-scale detail.
 float grassy=step(diffuseColor.r*1.045,diffuseColor.g)*step(diffuseColor.b*1.12,diffuseColor.g);
 float grain=texture2D(landscapeGrain,detailUV*.25).r;
 float mottling=texture2D(landscapeGrain,detailUV*.027).r;
 diffuseColor.rgb*=mix(.94+grain*.15,.38+grain*.72+mottling*.28,grassy);
 diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*vec3(.91,1.02,.82),grassy*.45);
 float wood=step(diffuseColor.g*1.6,diffuseColor.r)*step(diffuseColor.b*1.8,diffuseColor.g);
 float sand=step(diffuseColor.g*1.05,diffuseColor.r)*step(diffuseColor.b*1.14,diffuseColor.g)*(1.0-wood);
 float ripple=sin(detailUV.y*2.7+sin(detailUV.x*.24)*1.7);
 diffuseColor.rgb*=mix(1.0,.93+micro*.12+ripple*.025,sand);
 vec2 plankUV=vec2(detailUV.x/3.0+mod(floor(detailUV.y/.18),3.0)/3.0,detailUV.y/.18);
 vec2 plankCell=fract(plankUV),plankAA=max(fwidth(plankUV),vec2(.0001));
 vec2 plankEdge=smoothstep(vec2(.006,.012),vec2(.006,.012)+plankAA,min(plankCell,1.0-plankCell));
 float woodGrain=texture2D(surfaceGrain,vec2(detailUV.x*.15,detailUV.y*3.0)).r;
 diffuseColor.rgb*=mix(1.0,(.78+woodGrain*.3)*mix(.55,1.0,plankEdge.x*plankEdge.y),wood);
 #include <roughnessmap_fragment>`)};return material;
}

function landscapeTexture(){
 const c=document.createElement('canvas');c.width=c.height=512;const x=c.getContext('2d');let seed=42691;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
 x.fillStyle='#818181';x.fillRect(0,0,512,512);
 for(let i=0;i<90;i++){const px=random()*512,py=random()*512,r=15+random()*48;for(const ox of[-512,0,512])for(const oy of[-512,0,512]){const g=x.createRadialGradient(px+ox,py+oy,0,px+ox,py+oy,r);g.addColorStop(0,i%2?'#a4a4a445':'#24242435');g.addColorStop(1,'#80808000');x.fillStyle=g;x.fillRect(px+ox-r,py+oy-r,r*2,r*2)}}
 for(let i=0;i<26000;i++){const px=random()*512,py=random()*512,v=35+Math.floor(random()*175);x.strokeStyle=`rgba(${v},${v},${v},.55)`;x.lineWidth=.4+random()*.8;x.beginPath();x.moveTo(px,py);x.quadraticCurveTo(px+random()*3-1,py-2,px+random()*6-3,py-3-random()*6);x.stroke()}
 const map=new THREE.CanvasTexture(c);map.wrapS=map.wrapT=THREE.RepeatWrapping;map.anisotropy=graphics.anisotropy;return map;
}

function coastalWaterMaterial(){
 const material=new THREE.MeshStandardMaterial({color:lin('#17627c'),roughness:.26,metalness:.18,envMapIntensity:.75});material.extensions={derivatives:true};
 material.onBeforeCompile=sh=>{sh.uniforms.waterTime=WIND;sh.vertexShader='varying vec3 vWaterWorld;\n'+sh.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvWaterWorld=(modelMatrix*vec4(transformed,1.0)).xyz;');
 sh.fragmentShader='uniform float waterTime;varying vec3 vWaterWorld;\n'+sh.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
 float wave=sin(vWaterWorld.x*.65+vWaterWorld.z*.29+waterTime*.8)*sin(vWaterWorld.z*.83-vWaterWorld.x*.24-waterTime*.55)*(1.0-smoothstep(45.0,180.0,length(vViewPosition)));
 float swell=sin(vWaterWorld.x*.047+vWaterWorld.z*.071+waterTime*.22);
 diffuseColor.rgb*=.84+.12*swell+.09*wave;`)
 .replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
 normal=normalize(normal+vec3(dFdx(wave)*.28,dFdy(wave)*.28,0.0));`)};return material;
}

function facadeTextureCanvases(w,e){
 const scale=2;w.canvas.width=e.canvas.width=512;w.canvas.height=e.canvas.height=1024;w.scale(scale,scale);e.scale(scale,scale);
 w.fillStyle='#e7e4dd';w.fillRect(0,0,256,512);e.fillStyle='#000';e.fillRect(0,0,256,512);
 for(let y=0;y<8;y++)for(let x=0;x<4;x++){
  const X=x*64,Y=y*64,lit=(x*13+y*7)%5<2;
  w.fillStyle='#b1b2ab';w.fillRect(X,Y+61,64,3);
  w.fillStyle='#969d99';w.fillRect(X+9,Y+12,46,42);w.fillStyle='#363e3e';w.fillRect(X+11,Y+14,42,38);
  const glass=w.createLinearGradient(X+12,Y+15,X+50,Y+50);glass.addColorStop(0,'#526875');glass.addColorStop(.48,'#273f4b');glass.addColorStop(.5,'#304956');glass.addColorStop(1,'#16252e');
  w.fillStyle=glass;w.fillRect(X+13,Y+16,38,34);
  // Recessed reveals, slender mullions and curtains give windows depth at street level.
  w.fillStyle='#718181';w.fillRect(X+31,Y+16,1,34);w.fillRect(X+13,Y+32,38,1);
  if((x+y)%3===0){w.fillStyle='#6b7775';w.fillRect(X+14,Y+17,8,32);for(let i=0;i<3;i++){w.fillStyle=i%2?'#7c8580':'#5c6b69';w.fillRect(X+14+i*2,Y+17,1,32)}}
  w.fillStyle='#e0ded5';w.fillRect(X+8,Y+54,48,2);w.fillStyle='#747d7c';w.fillRect(X+10,Y+56,44,2);
  if(lit){e.fillStyle=(x+y)%2?'#a58353':'#8a9686';e.fillRect(X+14,Y+17,36,32);e.fillStyle='#000';e.fillRect(X+31,Y+17,2,32);e.fillRect(X+14,Y+32,36,2);e.fillRect(X+14,Y+17,7,32)}
 }
}

function windowInteriorMaps(){
 const canvases=[document.createElement('canvas'),document.createElement('canvas')];
 canvases.forEach((canvas,index)=>{canvas.width=canvas.height=512;const c=canvas.getContext('2d');for(let room=0;room<4;room++){c.save();c.translate(room%2*256,Math.floor(room/2)*256);const g=c.createLinearGradient(0,0,0,256);
  g.addColorStop(0,index?'#bcb8a2':'#3b5866');g.addColorStop(.6,index?'#8f8b7a':'#253f4c');g.addColorStop(1,index?'#646359':'#152c39');c.fillStyle=g;c.fillRect(0,0,256,256);
  c.fillStyle=index?'#888678':'#334a52';c.beginPath();c.moveTo(0,0);c.lineTo(49,35);c.lineTo(49,225);c.lineTo(0,256);c.fill();
  c.fillStyle=index?'#a4a18e':'#3a5058';c.beginPath();c.moveTo(256,0);c.lineTo(209,35);c.lineTo(209,225);c.lineTo(256,256);c.fill();
  c.fillStyle=index?'#43463f':'#1b303a';
  if(room===0){c.fillRect(69,157,118,42);c.fillRect(62,174,132,35);c.fillRect(74,208,9,18);c.fillRect(174,208,9,18);c.fillStyle=index?'#d1cdb1':'#53666b';c.fillRect(74,165,50,20);c.fillRect(132,165,45,20)}
  if(room===1){c.fillRect(60,174,138,10);c.fillRect(73,184,7,46);c.fillRect(178,184,7,46);c.fillRect(103,127,54,37);c.fillStyle=index?'#a7b7af':'#547783';c.fillRect(108,132,44,27);c.fillStyle=index?'#555e51':'#273f3c';c.fillRect(178,128,10,42);c.beginPath();c.ellipse(183,124,17,26,.2,0,PI*2);c.fill()}
  if(room===2){for(let y=78;y<200;y+=37){c.fillStyle=index?'#625b4d':'#233a40';c.fillRect(58,y,144,6);for(let k=0;k<6;k++){c.fillStyle=index?(k%2?'#aca284':'#7d8e83'):(k%2?'#43565a':'#2f4d58');c.fillRect(64+k*22,y-27,15,25)}}}
  if(room===3){c.fillStyle=index?'#69777a':'#2d414d';c.fillRect(65,67,128,145);for(let y=70;y<211;y+=9){c.fillStyle=index?'#b6bbb0':'#51616b';c.fillRect(65,y,128,3)}}
  for(const side of[0,1])for(let i=0;i<8;i++){c.fillStyle=index?(i%2?'#575b51':'#7c7f6c'):(i%2?'#4b6267':'#384f57');c.fillRect(side?211+i*5:i*5,8,5,237)}
  c.strokeStyle=index?'#202b2a':'#182d36';c.lineWidth=9;c.strokeRect(2,2,252,252);c.lineWidth=5;c.beginPath();c.moveTo(128,0);c.lineTo(128,256);c.stroke();c.restore();
 }});
 const maps=canvases.map(c=>{const map=new THREE.CanvasTexture(c);map.encoding=THREE.sRGBEncoding;map.anisotropy=graphics.anisotropy;return map});return{map:maps[0],emissiveMap:maps[1]};
}

function finishWindowInteriors(material){
 material.customProgramCacheKey=()=> 'room-atlas-v1';material.onBeforeCompile=sh=>{
  sh.vertexShader='varying float vRoomSeed;\n'+sh.vertexShader.replace('#include <uv_vertex>',`#include <uv_vertex>
 vec4 roomCenter=vec4(0.0,0.0,0.0,1.0);
 #ifdef USE_INSTANCING
 roomCenter=instanceMatrix*roomCenter;
 #endif
 roomCenter=modelMatrix*roomCenter;vRoomSeed=fract(sin(dot(roomCenter.xyz,vec3(12.989,4.141,78.233)))*43758.545);
 #ifdef USE_UV
 float roomTile=floor(vRoomSeed*4.0);vUv=(vUv*.94+.03)*.5+vec2(mod(roomTile,2.0),floor(roomTile/2.0))*.5;
 #endif`);
  sh.fragmentShader='varying float vRoomSeed;\n'+sh.fragmentShader.replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
 totalEmissiveRadiance*=step(.24,vRoomSeed)*(.7+.3*vRoomSeed);`);
 };return material;
}

function worldContactTexture(){
 const c=document.createElement('canvas');c.width=c.height=128;const x=c.getContext('2d'),im=x.createImageData(128,128);
 for(let y=0;y<128;y++)for(let z=0;z<128;z++){const d=Math.max(Math.abs(z-63.5),Math.abs(y-63.5))/64,a=1-THREE.MathUtils.smoothstep(d,.48,1),i=(y*128+z)*4;im.data[i+3]=Math.round(a*100)}
 x.putImageData(im,0,0);return new THREE.CanvasTexture(c);
}

function cloudTexture(){
 const c=document.createElement('canvas');c.width=512;c.height=256;const ctx=c.getContext('2d');
 for(let i=0;i<28;i++){const x=80+(i*97%350),y=90+(i*31%70),r=25+(i*17%36),g=ctx.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,'rgba(255,255,255,.24)');g.addColorStop(.45,'rgba(255,255,255,.16)');g.addColorStop(1,'rgba(255,255,255,0)');ctx.fillStyle=g;ctx.fillRect(x-r,y-r,r*2,r*2)}
 return new THREE.CanvasTexture(c);
}

function foliageCluster(){
 const canvas=document.createElement('canvas');canvas.width=canvas.height=128;const ctx=canvas.getContext('2d');
 for(let i=0;i<13;i++){const a=i*2.399,r=12+Math.sqrt(i)*11,x=64+Math.cos(a)*r,y=64+Math.sin(a)*r;
  ctx.save();ctx.translate(x,y);ctx.rotate(a);const gradient=ctx.createLinearGradient(-15,0,15,0);gradient.addColorStop(0,'#bdc9a8');gradient.addColorStop(.5,'#eef0db');gradient.addColorStop(1,'#9ead8c');ctx.fillStyle=gradient;ctx.beginPath();ctx.ellipse(0,0,17,7,0,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#8f9f7e';ctx.lineWidth=.65;ctx.beginPath();ctx.moveTo(-14,0);ctx.lineTo(14,0);ctx.stroke();ctx.restore();
 }
 const map=new THREE.CanvasTexture(canvas);map.encoding=THREE.sRGBEncoding;map.anisotropy=graphics.anisotropy;
 const positions=[],normals=[],uvs=[],colors=[];let seed=7419;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
 const corner=new THREE.Vector3(),q=new THREE.Quaternion(),e=new THREE.Euler();
 for(let i=0;i<42;i++){const angle=random()*Math.PI*2,y=random()*2-1,r=Math.sqrt(1-y*y)*Math.cbrt(.3+random()*.7),center=new THREE.Vector3(Math.cos(angle)*r,y*.9,Math.sin(angle)*r),normal=center.clone().normalize(),tint=.68+(y+1)*.14;
  for(let plane=0;plane<2;plane++){q.setFromEuler(e.set(random()*Math.PI,plane*Math.PI/2+random(),random()*Math.PI));const size=.48+random()*.24;
   for(const [x,z]of[[-1,-1],[1,-1],[-1,1],[1,-1],[1,1],[-1,1]]){corner.set(x*size/2,z*size/2,0).applyQuaternion(q).add(center);positions.push(corner.x,corner.y,corner.z);normals.push(normal.x,normal.y,normal.z);uvs.push((x+1)/2,(z+1)/2);colors.push(tint,tint,tint)}
  }
 }
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));return{geometry,map};
}

function enrichCityWorld(add){
 const stats={beachUmbrellas:0,lifeguardTowers:0,sailboats:0,busShelters:0,streetSigns:0},timber=wallMat('#90714f'),steel=mat('#3f4c4c'),cream=wallMat('#dedbd2'),pole=new THREE.CylinderGeometry(.5,.5,1,8);
 const glass=new THREE.MeshStandardMaterial({color:lin('#58777b'),metalness:.2,roughness:.16,envMapIntensity:.8}),shelterGlass=new THREE.MeshStandardMaterial({color:lin('#8da7a3'),metalness:.08,roughness:.13,envMapIntensity:.8,transparent:true,opacity:.32,depthWrite:false});
 const frame=(x,z,angle)=>{const c=Math.cos(angle),s=Math.sin(angle);return(g,m,px,py,pz,sx,sy,sz,shadow=true)=>add(g,m,x+c*px+s*pz,py,z-s*px+c*pz,sx,sy,sz,angle,shadow)};
 const canopy=new THREE.ConeGeometry(1,1,12,1,true).toNonIndexed(),cp=canopy.attributes.position,colors=[];
 for(let i=0;i<cp.count;i++){const a=Math.atan2(cp.getZ(i),cp.getX(i)),sector=Math.floor((a+PI)*6/PI),c=lin(sector%2?'#e4d8b9':'#455e54');colors.push(c.r,c.g,c.b)}
 canopy.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));const canvas=new THREE.MeshStandardMaterial({vertexColors:true,roughness:1,side:THREE.DoubleSide});
 for(const z of[54,91,127,179,318,361,406,438])for(const x of[67,74]){
  if(tile(x,z)!==3||inMask(clearanceMask,x,z)||palms.some(p=>Math.hypot(p[0]-x,p[1]-z)<3))continue;
  const f=frame(x,z,.2+z*.03);f(pole,cream,0,1.15,0,.07,2.3,.07);f(canopy,canvas,0,2.26,0,1.65,.65,1.65);structureCollider({x,z,angle:0,kind:'beach-umbrella'},0,0,.18,.18);
  for(const side of[-1,1]){f(box,timber,side*.82,.32,.25,.65,.12,1.65);f(box,cream,side*.82,.40,.25,.55,.04,1.48);for(const end of[-1,1])f(box,steel,side*.82,.17,.25+end*.63,.06,.3,.08)}stats.beachUmbrellas++;
 }
 for(const z of[151,343]){const x=70;if(tile(x,z)!==3)continue;const angle=PI/2,f=frame(x,z,angle),lot={x,z,angle,kind:'lifeguard'};
  for(const side of[-1,1])for(const end of[-1,1]){f(box,timber,side*1.35,1.4,end*1.2,.22,2.8,.22);structureCollider(lot,side*1.35,end*1.2,.28,.28)}
  f(box,timber,0,2.7,0,3.5,.18,3.2);f(box,cream,0,3.2,-1.4,3.3,.9,.1);
  for(const side of[-1,1]){f(box,cream,side*1.6,3.2,0,.1,.9,2.8);for(const end of[-1,1])f(box,timber,side*1.6,3.9,end*1.4,.11,2.1,.11)}
  f(houseRoof,wallMat('#81523f'),0,4.85,0,4.1,.7,3.8);f(box,buildingSign('LIFEGUARD','#eee4cb','#7a3c32'),0,3.12,1.65,2.6,.45,.1);
  for(let step=0;step<8;step++)f(box,timber,0,.17+step*.34,4.6-step*.39,1,.12,.45);
  structureCollider(lot,0,3.25,1,3.1);stats.lifeguardTowers++;
 }
 const hull=new THREE.SphereGeometry(1,16,8),sail=new THREE.BufferGeometry();sail.setAttribute('position',new THREE.Float32BufferAttribute([0,0,0,0,1,0,.64,.07,.03,0,0,0,.64,.07,.03,.5,0,.06],3));sail.computeVertexNormals();
 const sailMat=new THREE.MeshStandardMaterial({color:lin('#e4dfce'),roughness:.9,side:THREE.DoubleSide}),hullMat=mat('#d8d9ce');
 for(const [x,z,angle]of[[-28,95,.4],[28,82,-.3],[19,365,.8]]){const f=frame(x,z,angle);f(hull,hullMat,0,-.24,0,5,.65,1.35);f(box,timber,0,.22,0,6,.12,1.9);f(box,glass,-1,.65,0,2,1,1.3);f(pole,steel,.25,5.3,0,.07,10,.07);f(sail,sailMat,.25,.6,0,7,10,1);stats.sailboats++;}
 // Shelters sit outside the walking strip and preserve all reserved site access.
 const clear=(x,z,angle)=>{const c=Math.cos(angle),s=Math.sin(angle);return[-2.35,0,2.35].every(a=>[-1.15,1.15].every(b=>{const px=x+c*a+s*b,pz=z-s*a+c*b;return tile(px,pz)===0&&!inMask(sidewalkMask,px,pz)&&!structurePlan.tiles.has(Math.floor(px/T)+','+Math.floor(pz/T))&&!structureSolid(px,pz)}))};
 for(const road of roads){if(road.width<18||stats.busShelters>=7)continue;const i=Math.floor(road.points.length*.57),p=lanePoint(road,i,1,road.width/2+ROAD.sidewalk+1.7),center=road.points[i],angle=Math.atan2(center.x-p.x,center.z-p.z);if(!clear(p.x,p.z,angle)||nodes.some(n=>Math.hypot(n.x-p.x,n.z-p.z)<24))continue;
  const f=frame(p.x,p.z,angle),lot={x:p.x,z:p.z,angle,kind:'bus-shelter'};
  f(box,cream,0,.065,0,4.5,.12,2);f(box,steel,0,2.65,0,4.5,.14,2.2);f(box,shelterGlass,0,1.48,-.83,4.1,2.15,.045,false);
  for(const side of[-1,1]){f(box,steel,side*2,1.35,-.77,.09,2.6,.09);structureCollider(lot,side*2,-.77,.16,.16)}
  for(let k=0;k<3;k++)f(box,timber,0,.55,-.2+k*.16,2.7,.08,.12);f(box,timber,0,.92,-.38,2.7,.55,.07);
  for(const side of[-1,1])f(box,steel,side*1.05,.3,-.04,.07,.5,.5);
  f(box,buildingSign('COAST TRANSIT  /  04','#344e55','#eee8d7'),0,2.45,.99,3.9,.3,.04);
  sceneryRecords.push({x:p.x,z:p.z,y:0,angle,tag:'bus-shelter'});stats.busShelters++;
 }
 for(let index=0;index<nodes.length;index++){const n=nodes[index];if(n.links.length<3)continue;const offset=Math.max(...n.links.map(e=>e.width))/2+3.5,x=n.x+offset,z=n.z+offset;
  if(tile(x,z)!==0||inMask(sidewalkMask,x,z)||structurePlan.tiles.has(Math.floor(x/T)+','+Math.floor(z/T))||structureSolid(x,z))continue;const f=frame(x,z,0);
  f(pole,steel,0,1.65,0,.08,3.3,.08);f(box,buildingSign(['BAY AVENUE','PALM STREET','HARBOR WAY','GARDEN DRIVE'][index%4],'#304e46','#eee9da'),0,3.05,0,2.45,.34,.06);stats.streetSigns++;
 }
 // The lighthouse is a readable coastal landmark, with a lantern gallery and bands.
 const lighthouse=frame(15,205,0),red=wallMat('#8d4436'),disc=new THREE.CylinderGeometry(1,1,1,24),cap=new THREE.ConeGeometry(1,1,24),ring=new THREE.TorusGeometry(1,.018,5,32).rotateX(PI/2);
 for(const y of[5,11]){const radius=2.2-y/16*.6;lighthouse(disc,red,0,y,0,radius+.06,1.3,radius+.06)}
 for(let step=0;step<3;step++)lighthouse(disc,cream,0,.12+step*.2,0,3.1-step*.25,.22,3.1-step*.25);
 lighthouse(disc,steel,0,16.1,0,2.3,.17,2.3);lighthouse(ring,steel,0,17.05,0,2.2,1,2.2);
 for(let i=0;i<12;i++){const a=i*PI/6;lighthouse(pole,steel,Math.cos(a)*2.2,16.6,Math.sin(a)*2.2,.045,.95,.045);if(i%2===0)lighthouse(pole,steel,Math.cos(a)*1.7,17.25,Math.sin(a)*1.7,.08,2.2,.08)}
 lighthouse(cap,red,0,18.8,0,2.15,1.2,2.15);lighthouse(pole,steel,0,19.65,0,.08,.65,.08);
 const lantern=new THREE.MeshBasicMaterial({color:lin('#ffe6b0').multiplyScalar(2.5),toneMapped:false});lighthouse(pole,lantern,0,17.2,0,.45,1,.45);
 for(const y of[3,8,13])for(const side of[-1,1])lighthouse(box,glass,side*(2.2-y/16*.6),y,0,.055,.8,.42);
 for(const side of[-1,1]){const z=245+side*(ROAD.bridge/2+.5);for(let x=17;x<96;x+=4)add(box,cream,x,.64,z,.16,1.05,.22);for(const y of[.65,1.12])add(box,steel,55,y,z,79,.055,.06)}
 const rock=new THREE.IcosahedronGeometry(1,1),rockMat=surfaceFinish(new THREE.MeshStandardMaterial({color:lin('#78786c'),roughness:1}),'stone');
 for(const [x,z]of[[57,56],[57,126],[57,346],[57,425],[42,185],[42,304]])for(let i=0;i<5;i++)add(rock,rockMat,x+(i%2)*1.1,.15+(i%3)*.15,z+(i-2)*1.35,1.3+(i%3)*.28,.7+(i%2)*.3,1.2,i*.81);
 return stats;
}

function buildWorldDetail(){
 const stats={trees:0,streetTrees:0,shrubs:0,grass:0,facades:0,benches:0,shore:0},random=(()=>{let seed=824953;return()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296}})();
 // Repeated trim shares batches; foliage uses bounded cells for camera/shadow culling.
 const batches=new Map(),add=(geometry,material,x,y,z,sx,sy,sz,angle=0,shadow=true)=>{
  const sign=material.userData.sign;if(sign)material=buildingSign(sign.text,sign.bg,sign.fg,sx/sy);
  const spatial=geometry.userData.worldVegetation,cx=spatial?Math.floor(x/80)*80+40:0,cz=spatial?Math.floor(z/80)*80+40:0,key=geometry.uuid+material.uuid+(spatial?':'+cx+','+cz:'');let b=batches.get(key);if(!b){b={geometry,material,shadow,spatial,cx,cz,matrices:[]};batches.set(key,b)}
  b.matrices.push(new THREE.Matrix4().compose(new THREE.Vector3(x-cx,y,z-cz),new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),angle),new THREE.Vector3(sx,sy,sz)));
 };
 const foliage=foliageCluster(),canopy=foliage.geometry;canopy.userData.worldVegetation=true;
 const leaves=['#48633c','#607747','#3f6650'].map(c=>new THREE.MeshStandardMaterial({map:foliage.map,alphaTest:.4,side:THREE.DoubleSide,color:lin(c),vertexColors:true,roughness:.94,envMapIntensity:.22}));
 const bark=surfaceFinish(new THREE.MeshStandardMaterial({color:lin('#645447'),roughness:1}),'bark'),trunk=new THREE.CylinderGeometry(.13,.24,1,7);
 const safe=(x,z,radius)=>tile(x,z)===0&&!structurePlan.tiles.has(Math.floor(x/T)+','+Math.floor(z/T))&&[-1,0,1].every(a=>[-1,0,1].every(b=>!inMask(clearanceMask,x+a*radius,z+b*radius)&&tile(x+a*radius,z+b*radius)===0));
 for(let z=14;z<N*T-10;z+=9)for(let x=106;x<N*T-10;x+=9){const px=x+(random()-.5)*5,pz=z+(random()-.5)*5;if(random()>.52||!safe(px,pz,3.1)||palms.some(p=>Math.hypot(px-p[0],pz-p[1])<5))continue;
  const h=4+random()*3,size=1.65+random()*.8,leaf=leaves[stats.trees%3];stats.trees++;
  structureCollider({x:px,z:pz,angle:0,kind:'tree'},0,0,.42,.42);
  add(trunk,bark,px,h*.45,pz,1,h*.9,1);
  for(let c=0;c<5;c++){const a=c*2.4,dx=Math.cos(a)*size*.49,dz=Math.sin(a)*size*.49,cy=h+(c===0?.6:-.3)+random()*.5;add(canopy,leaf,px+dx,cy,pz+dz,size*(.8+random()*.25),size*(.8+random()*.3),size,random()*6);}
 }
 // Street trees occupy the verge beyond the walking path, with clear junction sightlines.
 const planted=[];
 for(const road of roads){if(road.width===ROAD.bridge)continue;for(let i=20;i<road.points.length-20;i+=30)for(const side of[-1,1]){
  const p=lanePoint(road,i,1,side*(road.width/2+ROAD.sidewalk+2.5)),x=p.x,z=p.z;
  if(x<100||tile(x,z)!==0||structurePlan.tiles.has(Math.floor(x/T)+','+Math.floor(z/T))||nodes.some(n=>Math.hypot(n.x-x,n.z-z)<19)||lamps.some(l=>Math.hypot(l[0]-x,l[1]-z)<3.4)||planted.some(p=>Math.hypot(p[0]-x,p[1]-z)<12))continue;
  if([-1,1].some(a=>[-1,1].some(b=>tile(x+a*1.8,z+b*1.8)!==0||inMask(sidewalkMask,x+a*1.8,z+b*1.8))))continue;
  planted.push([x,z]);const leaf=leaves[stats.streetTrees%3],h=4.6+random()*.8;stats.streetTrees++;
  add(trunk,bark,x,h*.42,z,.85,h*.84,.85);structureCollider({x,z,angle:0,kind:'tree'},0,0,.38,.38);
  for(let j=0;j<3;j++){const a=j*2.1;add(canopy,leaf,x+Math.cos(a)*.65,h+j*.16,z+Math.sin(a)*.65,1.55,1.8,1.55,a)}
 }}
 // Low shrubs and grass stay in non-drivable planted ground, clear of civic access.
 const grassGeo=new THREE.BufferGeometry(),gp=[];
 for(let i=0;i<7;i++){const a=i*2.399,w=.035,h=.23+(i%3)*.095,x=Math.sin(a)*.16,z=Math.cos(a)*.16;gp.push(x-w,0,z,x+w,0,z,x+Math.sin(a)*.13,h,z+Math.cos(a)*.12)}
 grassGeo.setAttribute('position',new THREE.Float32BufferAttribute(gp,3));grassGeo.computeVertexNormals();grassGeo.userData.worldVegetation=true;
 const grassMat=new THREE.MeshStandardMaterial({color:lin('#657448'),roughness:1,side:THREE.DoubleSide});
 for(let z=8;z<N*T-6;z+=3.1)for(let x=95;x<N*T-6;x+=3.1){const px=x+random()*2,pz=z+random()*2;if(random()>.44||!safe(px,pz,.65))continue;
  if(random()<.045){const s=.35+random()*.5;add(canopy,leaves[1],px,s*.65,pz,s,s*.75,s,0);stats.shrubs++;}
  else{add(grassGeo,grassMat,px,.025,pz,1,1+random(),1,random()*6,false);stats.grass++;}
 }
 // Ground contact, parapets, roof equipment, floor ledges, shutters and rain pipes.
 const contact=new THREE.MeshBasicMaterial({map:worldContactTexture(),color:0x000000,transparent:true,depthWrite:false,opacity:.62,polygonOffset:true,polygonOffsetFactor:-1});
 const concrete=wallMat('#b5b4a9'),dark=mat('#555d5b'),metal=mat('#747d79'),terracotta=wallMat('#82614a');
 for(const b of buildings){
  if(!['house','house2','store','bar','apartment','office','mall'].includes(b.kind))continue;
  const c=Math.cos(b.angle),s=Math.sin(b.angle),local=(g,m,x,y,z,sx,sy,sz)=>{const wx=b.x+c*x+s*z,wz=b.z-s*x+c*z;add(g,m,wx,y,wz,sx,sy,sz,b.angle)};
  // Use the actual ordinary-building width; civic lots manage their own landscaping.
  const w=b.footprintW||(b.kind==='mall'?b.w-1:['house','house2'].includes(b.kind)?7.6:8.8),d=b.footprintD||(b.kind==='mall'?b.d-1:b.kind==='house'?6.6:b.kind==='house2'?6.7:8.2),h=b.roofHeight||(b.kind==='office'?(5+b.variant%7)*3.8:b.kind==='apartment'?(3+b.variant%4)*3.4:b.height);
  add(flatDetail,contact,b.x,.018,b.z,w+3,1,d+3,b.angle,false);
  if(b.kind==='apartment'||b.kind==='office'){
   if(!b.cityArchitecture){for(const side of[-1,1]){local(box,concrete,side*(w/2-.12),h+.08,0,.22,.55,d);local(box,concrete,0,h+.08,side*(d/2-.12),w,.55,.22)}
    for(let y=3.4;y<h-2;y+=b.kind==='office'?3.8:3.4)for(const side of[-1,1])local(box,concrete,side*(w/2+.025),y,0,.1,.1,d+.08);
    local(box,dark,w/2+.04,h*.48,-d*.3,.1,h*.94,.1);}
   for(let i=0;i<2;i++){local(box,metal,-2+i*3,h+.45,-1.5,1.5,.65,1.9);for(let j=0;j<4;j++)local(box,dark,-2+i*3,h+.8,-2.1+j*.38,1.25,.025,.15)}
  }
  if(b.kind==='house'||b.kind==='house2'){
   local(box,concrete,0,.025,4.25,1.4,.045,1.5);
   for(let run=5;run<18;run+=1){const px=b.x+s*run,pz=b.z+c*run;if(inMask(asphaltMask,px,pz)||tile(px,pz)===4||structurePlan.tiles.has(Math.floor(px/T)+','+Math.floor(pz/T)))break;if(tile(px,pz)===2&&(Math.floor(px/T)!==Math.floor(b.x/T)||Math.floor(pz/T)!==Math.floor(b.z/T)))break;local(box,concrete,0,.022,run,1.25,.035,1.02);if(inMask(sidewalkMask,px,pz))break}
   local(box,terracotta,0,.18,-.3,w+.12,.32,d+.12);
   for(const side of[-1,1]){local(box,dark,side*(w/2+.035),1.8,-.3,.09,3.4,.09);
    for(const y of b.kind==='house2'?[1.65,4.55]:[1.8]){local(box,concrete,side*(w/2+.025),y,.8,.12,1.5,1.65);local(box,warmWindow,side*(w/2+.1),y,.8,.035,1.25,1.4);local(box,concrete,side*(w/2+.14),y-.72,.8,.26,.09,1.8)}
    local(box,metal,side*(w/2+.05),1.6,-1.4,.12,1.25,1.15);for(let k=0;k<4;k++)local(box,dark,side*(w/2+.12),1.2+k*.22,-1.4,.02,.045,1.0);
    local(box,terracotta,side*(w*.33),.23,d/2+.2,1.1,.45,.45);local(canopy,leaves[1],side*(w*.33),.61,d/2+.2,.57,.4,.36,'window-planter');
    for(let j=0;j<4;j++){const px=side*4.35,pz=-2.6+j*1.5,wx=b.x+c*px+s*pz,wz=b.z-s*px+c*pz;if(tile(wx,wz)===2&&!inMask(clearanceMask,wx,wz))local(canopy,leaves[0],px,.5,pz,.48,.56,.85)}
   }
  }
  stats.facades++;
 }
 // Boardwalk furniture, paired bollards and beach planting, all outside foot travel.
 const wood=surfaceFinish(new THREE.MeshStandardMaterial({color:lin('#71543b'),roughness:.9}),'wood'),iron=mat('#323d3c');
 for(let z=30;z<455;z+=32){const x=87;if(tile(x,z)!==5||inMask(asphaltMask,x,z))continue;stats.benches++;
  for(let k=0;k<4;k++)sceneryPart(box,wood,x,.55,z+(k-1.5)*.13,1.9,.09,.1,0,'bench');
  for(let k=0;k<3;k++)sceneryPart(box,wood,x,.78+k*.14,z-.31,1.9,.1,.08,0,'bench');
  for(const side of[-1,1])sceneryPart(box,iron,x+side*.7,.29,z,.08,.5,.65,0,'bench');
  sceneryPart(box,iron,x+2,.45,z,.43,.9,.43,0,'bin');sceneryPart(box,metal,x+2,.92,z,.49,.06,.49,0,'bin');
 }
 // Thin broken swash lines along sand/water boundaries, following the tile coast.
 const foam=new THREE.MeshStandardMaterial({color:lin('#cee3da'),transparent:true,opacity:.28,roughness:1,depthWrite:false});
 for(let j=0;j<N;j++)for(let i=0;i<N;i++)if(m[j][i]===3){for(const [di,dj]of[[1,0],[-1,0],[0,1],[0,-1]])if(m[j+dj]?.[i+di]===4){const x=(i+.5)*T+di*T*.49,z=(j+.5)*T+dj*T*.49;for(let k=0;k<3;k++){const dx=dj*(k-1)*3.2,dz=di*(k-1)*3.2;add(flatDetail,foam,x+dx,.005,z+dz,dj?2.9:.16,1,di?2.9:.16,0,false);stats.shore++}}}
 Object.assign(stats,enrichCityWorld(add));
 const spatialGeometry=new Map();
 for(const b of batches.values()){if(!b.matrices.length)continue;let geometry=b.geometry;
  if(b.spatial){if(!spatialGeometry.has(geometry.uuid)){const clone=geometry.clone();clone.boundingSphere=new THREE.Sphere(new THREE.Vector3(0,8,0),70);spatialGeometry.set(geometry.uuid,clone)}geometry=spatialGeometry.get(geometry.uuid)}
  const mesh=new THREE.InstancedMesh(geometry,b.material,b.matrices.length);b.matrices.forEach((m,i)=>mesh.setMatrixAt(i,m));mesh.castShadow=b.shadow;mesh.receiveShadow=!b.material.transparent;
  if(b.spatial){mesh.position.set(b.cx,0,b.cz);mesh.frustumCulled=true;mesh.userData.worldVegetation=true}
  if(b.material===contact)mesh.renderOrder=-4;S.add(mesh)}
 return stats;
}
