/* Road-facing civic lots and shared, instanced neighbourhood architecture. */
function planStructureLots(){
 const lots=[],tiles=new Set(),ground=new Map(),solids=new Map();
 const specs=[['fuel',0,3,2,160,200],['fuel',1,3,2,390,340],['police',0,2,2,275,220],['playground',0,2,2,150,350],['playground',1,2,2,350,120],['clinic',0,2,2,280,400],['workshop',0,2,2,390,260]];
 const nearest=(x,z)=>{let best=null,distance=Infinity;for(const road of roads)for(let k=0;k<road.points.length;k+=8){const p=road.points[k],d=Math.hypot(p.x-x,p.z-z);if(d<distance){distance=d;best=p;}}return{angle:Math.round(Math.atan2(best.x-x,best.z-z)/(PI/2))*PI/2,distance,point:best};};
 for(const[kind,variant,cw,cd,preferredX,preferredZ]of specs){let best=null,score=Infinity;
  for(let rotation=0;rotation<2;rotation++){const nx=rotation?cd:cw,nz=rotation?cw:cd;
   for(let j=3;j<N-nz-2;j++)for(let i=10;i<N-nx-2;i++){
    let clear=true;for(let z=j;z<j+nz&&clear;z++)for(let x=i;x<i+nx;x++)if(![0,2].includes(m[z][x])||mallTiles.has(x+','+z)||tiles.has(x+','+z)||inMask(clearanceMask,(x+.5)*T,(z+.5)*T)){clear=false;break;}
    if(!clear)continue;const x=(i+nx/2)*T,z=(j+nz/2)*T;if(lots.some(l=>Math.hypot(l.x-x,l.z-z)<48))continue;
    const face=nearest(x,z);if((Math.abs(Math.sin(face.angle))>.5)!==!!rotation||face.distance>Math.max(cw,cd)*T/2+27)continue;
    const width=kind==='playground'?2.4:6,access={x:x+Math.sin(face.angle)*(cd*T/2-.5),z:z+Math.cos(face.angle)*(cd*T/2-.5),endX:face.point.x,endZ:face.point.z,width},accessTiles=new Set(),length=Math.hypot(access.endX-access.x,access.endZ-access.z)||1,dx=(access.endX-access.x)/length,dz=(access.endZ-access.z)/length;
    for(let run=0;run<=length;run+=1)for(const side of[-width/2,0,width/2]){const gx=Math.floor((access.x+dx*run-dz*side)/T),gz=Math.floor((access.z+dz*run+dx*side)/T),key=gx+','+gz;if(gx<0||gz<0||gx>=N||gz>=N||mallTiles.has(key)||tiles.has(key)){clear=false;break;}accessTiles.add(key);}
    if(!clear)continue;
    const value=Math.hypot(x-preferredX,z-preferredZ)+face.distance*.7;
    if(value<score){score=value;best={kind,variant,i,j,nx,nz,x,z,w:cw*T,d:cd*T,angle:face.angle,access,accessTiles};}
   }
  }
  if(!best)continue;lots.push(best);for(let z=best.j;z<best.j+best.nz;z++)for(let x=best.i;x<best.i+best.nx;x++){m[z][x]=0;tiles.add(x+','+z);ground.set(z*N+x,best);}
  for(const key of best.accessTiles){const[x,z]=key.split(',').map(Number);m[z][x]=0;tiles.add(key);ground.set(z*N+x,best);}
 }
 return{lots,tiles,ground,solids};
}
function structurePaved(lot,x,z){
 if(lot.kind==='playground')return false;
 const c=Math.cos(lot.angle),s=Math.sin(lot.angle),dx=x-lot.x,dz=z-lot.z;
 if(Math.abs(c*dx-s*dz)<=lot.w/2&&Math.abs(s*dx+c*dz)<=lot.d/2)return true;
 const a=lot.access,ax=a.endX-a.x,az=a.endZ-a.z,t=Math.max(0,Math.min(1,((x-a.x)*ax+(z-a.z)*az)/(ax*ax+az*az||1)));
 return Math.hypot(x-a.x-ax*t,z-a.z-az*t)<=a.width/2;
}
function structureCollider(lot,x,z,w,d){
 const c=Math.cos(lot.angle),s=Math.sin(lot.angle),cx=lot.x+c*x+s*z,cz=lot.z-s*x+c*z,hw=(Math.abs(c)*w+Math.abs(s)*d)/2,hd=(Math.abs(s)*w+Math.abs(c)*d)/2;
 const collider={minX:cx-hw,maxX:cx+hw,minZ:cz-hd,maxZ:cz+hd,kind:lot.kind};
 for(let j=Math.floor(collider.minZ/T);j<=Math.floor(collider.maxZ/T);j++)for(let i=Math.floor(collider.minX/T);i<=Math.floor(collider.maxX/T);i++){const key=j*N+i;if(!structurePlan.solids.has(key))structurePlan.solids.set(key,[]);structurePlan.solids.get(key).push(collider);}
}
function structureSolid(x,z){const list=structurePlan.solids.get(Math.floor(z/T)*N+Math.floor(x/T));if(list)for(const b of list)if(x>=b.minX&&x<=b.maxX&&z>=b.minZ&&z<=b.maxZ)return true;return false;}
function structureGeometry(){return structureGeometry.cache||(structureGeometry.cache={pole:new THREE.CylinderGeometry(.5,.5,1,8),slide:new THREE.BoxGeometry(1,.075,3.3).rotateX(.43)});}
function buildVariedStructure(kind,ctx){
 if(!['house2','fuel','police','playground','clinic','workshop'].includes(kind))return false;
 const{part,record,x,z,w,d,variant,angle,cream,trim,c,roof,houseRoof,warmWindow}=ctx,geo=structureGeometry(),lot={x,z,w,d,kind,angle};
 record.variant=variant;const block=(colour,sx,sy,sz,px,py,pz,collision=false,geometry)=>{part(colour,sx,sy,sz,px,py,pz,geometry);if(collision)structureCollider(lot,px,pz,sx,sz);};
 const window=(px,py,pz,ww=1.5,hh=1.3)=>{part(trim,ww+.18,hh+.18,.12,px,py,pz);part(warmWindow,ww,hh,.15,px,py,pz+.035);part(cream,.045,hh,.17,px,py,pz+.07);};
 const sign=(text,bg,fg,sx,sy,px,py,pz)=>part(buildingSign(text,bg,fg),sx,sy,.08,px,py,pz);
 if(kind==='house2'){
  const style=variant%5;record.style=['Gabled porch','Brick duplex','Balcony modern','Twin gable','Veranda terrace'][style];
  // The occupied tile already owns house collisions; all details stay within it.
  block(style===1?'#8d5c49':c,7.6,3.05,6.7,0,1.525,-.35);
  const upperWidth=style===2?6.5:7.6,upperX=style===2?-.55:0;block(style===1?cream:c,upperWidth,2.85,6.5,upperX,4.475,-.45);
  part(trim,7.85,.16,6.95,0,3.08,-.35);
  if(style===2){part(roof,7.1,.22,7,-.55,6.02,-.45);part(trim,7.4,.14,7.25,-.55,6.17,-.45);}
  else if(style===3){for(const side of[-1,1])part('#4b4d4c',4.05,1.5,7.1,side*1.92,5.95,-.45,houseRoof);}
  else part(style===1?'#4b4d4c':'#81523f',8.3,1.65,7.3,0,5.95,-.45,houseRoof);
  part('#644736',1.15,2.35,.15,style===1?1.6:0,1.175,3.04);
  for(const py of[1.65,4.55])for(const px of[-2.4,2.4])window(px,py,2.94,1.45,1.25);
  if(style===1){part('#644736',1.0,2.35,.15,-1.6,1.175,3.05);part(trim,.18,5.8,.2,0,2.9,3.01);}
  if(style===0||style===4){const span=style===4?7.7:4.3;part(cream,span,.18,1.4,0,2.75,3.5);for(const px of[-span/2+.2,span/2-.2])part(trim,.18,2.7,.18,px,1.35,4.02);part(cream,span,.18,1.55,0,.09,3.6);}
  if(style===2||style===4){part(trim,6.6,.16,1.0,0,3.14,3.18);part('#4c5754',6.6,.055,.055,0,4.04,3.64);for(let i=0;i<10;i++)part('#4c5754',.045,.8,.045,-3.2+i*.71,3.64,3.64);}
  if(style===3){part('#8d5c49',.6,2.0,.7,2.8,6.1,-1.8);part(trim,2.4,.15,1.2,0,2.9,3.45);}
  return true;
 }
 if(kind==='fuel'){
  const brand=variant%2===0?{name:'SUNWAY FUEL',colour:'#254d79',accent:'#d3a345'}:{name:'HARBOR FUEL',colour:'#285849',accent:'#dedbd2'};record.brand=brand.name;
  block(cream,18,3.8,5,0,1.9,-6,true);part(roof,18.6,.22,5.6,0,3.91,-6);
  for(const px of[-6,0,6])window(px,1.9,-3.44,4.7,2.1);sign('SHOP',brand.colour,'#fff3de',3,.55,0,3.35,-3.39);
  part(cream,23,.34,8,0,4.7,1.6);part(brand.colour,23,.45,.22,0,4.63,5.65);part(brand.accent,23,.12,.25,0,4.34,5.68);
  sign(brand.name,brand.colour,'#fff3de',9,.65,0,4.65,5.8);
  for(const px of[-9,9])for(const pz of[-1.2,4.4])block('#a8aaa5',.24,4.5,.24,px,2.25,pz,true);
  for(const px of[-6,0,6]){block('#bcbcb4',1.75,.18,2.1,px,.09,1.6,true);block(brand.colour,.85,1.25,.55,px,.80,1.6,true);part(cream,.90,.60,.60,px,1.72,1.6);part('#17272b',.65,.25,.035,px,1.85,1.925);sign('UNLEADED',brand.colour,'#e6e5df',.76,.15,px,1.45,1.93);for(const side of[-1,1]){part('#1b2022',.035,.90,.04,px+side*.5,1.05,1.64);part('#242c2e',.07,.20,.06,px+side*.48,1.48,1.93);}}
  block(brand.colour,.25,5,.25,-12,2.5,5.3,true);sign(brand.name,brand.colour,'#fff3de',3,1.2,-12,4.5,5.4);sign('OPEN 24H',brand.colour,brand.accent,3,.65,-12,3.4,5.4);
  return true;
 }
 if(kind==='playground'){
  record.name=variant?'Palm Gardens':'Coastside Park';
  for(const side of[-1,1]){block('#626e60',.09,.9,17,side*8.8,.45,0,true);for(let i=0;i<6;i++)part('#626e60',.12,1.05,.12,side*8.8,.525,-8+i*3.2);}
  block('#626e60',17.6,.9,.09,0,.45,-8.7,true);
  sign(record.name.toUpperCase(),'#3e5146','#eee9dc',5,.7,0,1.15,8.5);
  // A swing set, raised slide/play tower, sandpit and benches form distinct silhouettes.
  for(const px of[-6,-1])for(const pz of[-2,0])block('#555f63',.16,2.8,.16,px,1.4,pz,true);
  part('#555f63',5.3,.16,.16,-3.5,2.8,-1);
  for(const px of[-5,-2]){for(const side of[-1,1])part('#646b6b',.025,1.9,.025,px+side*.28,1.77,-1);block('#3b4344',.75,.07,.4,px,.79,-1,true);}
  for(const px of[3,5])for(const pz of[-4,-2])block('#8d7355',.13,2.4,.13,px,1.2,pz,true);
  block('#b38a55',2.25,.12,2.25,4,2.05,-3,true);part('#3e5146',2.7,1.1,2.7,4,2.8,-3,houseRoof);
  part('#b39a4d',1,1,1,4,1.35,.0,geo.slide);structureCollider(lot,4,.1,1.3,3.5);
  for(let i=0;i<6;i++)part('#8d7355',1,.16,.3,4,.22+i*.32,-5.4+i*.22);
  part('#b7a58b',4,.06,3,-3,.04,4.1);for(const side of[-1,1])block('#8d7355',4.2,.18,.15,-3,.11,4.1+side*1.6,true);
  for(const px of[-6,6]){block('#7f6950',2.2,.13,.55,px,.48,5.6,true);part('#7f6950',2.2,.42,.09,px,.82,5.85);for(const side of[-1,1])part('#555f63',.09,.45,.5,px+side*.8,.23,5.6);}
  return true;
 }
 if(kind==='police'){
  record.name='Coastal Police';block('#a8aaa5',15,6.8,10,0,3.4,-3,true);part(cream,15.6,.25,10.6,0,6.92,-3);part('#29455f',15,.65,.18,0,3.3,2.1);
  for(const py of[1.8,5])for(const px of[-5,0,5])window(px,py,2.08,2.7,1.7);
  part('#233c50',2.3,2.8,.20,0,1.4,2.19);part(trim,5,.22,2.3,0,3.9,2.8);sign('COASTAL POLICE','#233c50','#f4f0df',9,.9,0,6.1,2.23);
  block('#909792',.16,7,.16,7,3.5,5.8,true);part('#29455f',1.6,.8,.045,7.75,6.2,5.8);part('#c3ab6a',.22,.28,.08,7.75,6.2,5.84);
  for(const px of[-5,5]){part('#e5e3dc',3,.025,.12,px,.025,6.8);part('#e5e3dc',.12,.025,3,px-1.5,.025,5.35);}
  part('#555f63',.06,2,.06,-4,8.05,-4);return true;
 }
 if(kind==='clinic'){
  record.name='Coastside Clinic';block('#dedbd2',14.5,4.6,10,0,2.3,-3,true);part('#647478',15,.22,10.5,0,4.7,-3);
  for(const px of[-5,5])window(px,2,2.08,3.5,2);part('#40575b',2.4,2.8,.2,0,1.4,2.12);part(trim,5,.18,2.2,0,3.3,2.8);
  sign('COASTSIDE CLINIC','#46565a','#f2efe3',8,.8,0,4.05,2.23);part('#914941',.35,1.35,.15,-6,3.7,2.24);part('#914941',1.35,.35,.16,-6,3.7,2.25);return true;
 }
 record.name='Harbor Auto';block('#a39787',15.5,4.9,10,0,2.45,-3,true);part(roof,16.1,.24,10.6,0,5.02,-3);
 for(const px of[-4,4]){part('#626969',5.7,3.4,.12,px,1.7,2.08);for(let i=0;i<10;i++)part('#898b87',5.5,.055,.15,px,.25+i*.32,2.12);}
 sign('HARBOR AUTO','#3e5146','#eee9dc',10,.8,0,4.3,2.2);part('#b7a58b',5,.06,3,-4,.04,5);part('#b7a58b',5,.06,3,4,.04,5);return true;
}
