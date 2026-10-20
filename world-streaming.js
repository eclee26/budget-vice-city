/* Fixed-size procedural-world streaming. Collision data never unloads.
   Cells own instance buffers only; geometry/materials remain shared. */
class WorldStreamer {
  constructor(scene) {
    this.scene=scene;this.cells=new Map();this.cellSize=80;this.active=new Set();
    this.skyline=null;this.records=[];this.matrix=new THREE.Matrix4();this.q=new THREE.Quaternion();
    this.axis=new THREE.Vector3(0,1,0);this.position=new THREE.Vector3();this.scale=new THREE.Vector3();
    this.stats={definitions:0,totalCells:0,loadedCells:0,loads:0,unloads:0,instanceBuffers:0,peakInstanceBuffers:0};
  }
  cell(x,z) {
    const i=Math.floor(x/this.cellSize),j=Math.floor(z/this.cellSize),key=i+','+j;
    let cell=this.cells.get(key);if(!cell){cell={key,x:i*this.cellSize+40,z:j*this.cellSize+40,parts:new Map(),group:null};this.cells.set(key,cell);}return cell;
  }
  register(geometry,material,matrices,castShadow=true,receiveShadow=true) {
    const materialKey=Array.isArray(material)?material.map(m=>m.uuid).join(','):material.uuid;
    for(const matrix of matrices){const cell=this.cell(matrix.elements[12],matrix.elements[14]),key=geometry.uuid+':'+materialKey+':'+castShadow+':'+receiveShadow;
      let part=cell.parts.get(key);if(!part){part={geometry,material,matrices:[],castShadow,receiveShadow};cell.parts.set(key,part);}
      part.matrices.push(matrix);this.stats.definitions++;
    }
    this.stats.totalCells=this.cells.size;
  }
  makeSkyline(records) {
    this.records=records;const material=new THREE.MeshStandardMaterial({color:0xffffff,roughness:.9,metalness:.05});
    this.skyline=new THREE.InstancedMesh(box,material,records.length*2);this.skyline.frustumCulled=false;this.skyline.receiveShadow=true;
    const color=new THREE.Color();for(let i=0;i<records.length;i++){const b=records[i],hex=b.kind==='office'?'#7e9394':b.kind==='warehouse'?'#8a8b7d':b.kind==='house2'||b.kind==='house'?'#b0aa96':'#a7aa9e';color.copy(lin(hex));this.skyline.setColorAt(i*2,color);this.skyline.setColorAt(i*2+1,color.multiplyScalar(.79));}
    this.scene.add(this.skyline);this.refreshSkyline();
  }
  load(cell) {
    if(cell.group)return;
    const group=new THREE.Group();group.userData.worldChunk=cell.key;
    for(const part of cell.parts.values()){
      const mesh=new THREE.InstancedMesh(part.geometry,part.material,part.matrices.length);
      for(let i=0;i<part.matrices.length;i++)mesh.setMatrixAt(i,part.matrices[i]);
      // r128 instance bounds are not inferred from the instance matrices.
      mesh.frustumCulled=false;mesh.castShadow=part.castShadow;mesh.receiveShadow=part.receiveShadow;group.add(mesh);
    }
    cell.group=group;this.scene.add(group);this.active.add(cell);this.stats.loads++;this.stats.instanceBuffers+=group.children.length;
    this.stats.peakInstanceBuffers=Math.max(this.stats.peakInstanceBuffers,this.stats.instanceBuffers);
  }
  unload(cell) {
    if(!cell.group)return;
    this.scene.remove(cell.group);
    for(const mesh of cell.group.children){if(typeof mesh.dispose==='function')mesh.dispose();else mesh.dispatchEvent({type:'dispose'});}
    this.stats.instanceBuffers-=cell.group.children.length;cell.group=null;this.active.delete(cell);this.stats.unloads++;
  }
  update(x,z,force=false) {
    const quality=typeof gameplay!=='undefined'?gameplay?.settings.quality:null;
    const range=quality==='low'?90:quality==='medium'?120:150,budget=quality==='low'?6:quality==='medium'?9:12;
    let changed=false;
    const candidates=[...this.cells.values()].filter(cell=>Math.hypot(cell.x-x,cell.z-z)<range+57);
    candidates.sort((a,b)=>(Math.hypot(a.x-x,a.z-z)-(a.group?12:0))-(Math.hypot(b.x-x,b.z-z)-(b.group?12:0)));
    const desired=new Set(candidates.slice(0,budget));
    for(const cell of this.active)if(!desired.has(cell)){this.unload(cell);changed=true;}
    const pending=candidates.filter(cell=>desired.has(cell)&&!cell.group);
    // Small batches amortize creation during driving. Explicit force is for loading/QA.
    for(let i=0;i<Math.min(pending.length,force?pending.length:2);i++){this.load(pending[i]);changed=true;}
    this.stats.loadedCells=this.active.size;if(changed)this.refreshSkyline();
  }
  refreshSkyline() {
    if(!this.skyline)return;
    for(let i=0;i<this.records.length;i++){const b=this.records[i],cell=this.cell(b.x,b.z),loaded=!!cell.group||b.kind==='parking';
      const h=b.height||b.roofHeight||5,w=b.footprintW||Math.max(4,b.w-1.2),d=b.footprintD||Math.max(4,b.d-1.4);
      this.q.setFromAxisAngle(this.axis,b.angle||0);
      this.position.set(b.x,h*.45,b.z);this.scale.set(loaded?0:w,loaded?0:h*.9,loaded?0:d);this.matrix.compose(this.position,this.q,this.scale);this.skyline.setMatrixAt(i*2,this.matrix);
      this.position.y=h*.95;this.scale.set(loaded?0:w*.86,loaded?0:h*.1,loaded?0:d*.86);this.matrix.compose(this.position,this.q,this.scale);this.skyline.setMatrixAt(i*2+1,this.matrix);
    }
    this.skyline.instanceMatrix.needsUpdate=true;
  }
}

/* Reserve small garden hills before buildings/trees are generated. Roads, civic
   driveways and mall reservations remain completely flat and unobstructed. */
function planGardenHills() {
  const features=[],reserved=new Set();
  for(const [preferredX,preferredZ]of [[182,225],[383,372]]){
    let best=null,score=Infinity;
    for(let j=5;j<N-4;j++)for(let i=11;i<N-4;i++){
      const x=(i+.5)*T,z=(j+.5)*T,radius=17;let clear=true;
      if(features.some(f=>Math.hypot(f.x-x,f.z-z)<80))continue;
      for(let gz=j-2;gz<=j+2&&clear;gz++)for(let gx=i-2;gx<=i+2;gx++){
        const key=gx+','+gz;if(mallTiles.has(key)||structurePlan.tiles.has(key)||reserved.has(key)||![0,2].includes(m[gz][gx])){clear=false;break;}
        for(const dx of[-4.5,0,4.5])for(const dz of[-4.5,0,4.5])if(inMask(clearanceMask,(gx+.5)*T+dx,(gz+.5)*T+dz))clear=false;
      }
      if(!clear)continue;const value=Math.hypot(x-preferredX,z-preferredZ);if(value<score){score=value;best={x,z,radius,height:features.length?2.6:3.4,i,j};}
    }
    if(best){features.push(best);for(let j=best.j-2;j<=best.j+2;j++)for(let i=best.i-2;i<=best.i+2;i++){m[j][i]=0;reserved.add(i+','+j);}}
  }
  return{features,reserved};
}
function worldElevation(x,z) {
  if(typeof gardenHills==='undefined')return 0;
  let height=0;for(const hill of gardenHills.features){const q=((x-hill.x)**2+(z-hill.z)**2)/(hill.radius*hill.radius);if(q<1)height+=hill.height*(1-q)**3;}return height;
}

function buildGardenLandmarks(add) {
  const stone=wallMat('#b3ad9b'),wood=wallMat('#7d6349'),steel=mat('#414e4b'),rock=new THREE.IcosahedronGeometry(1,1),rockMaterial=surfaceFinish(new THREE.MeshStandardMaterial({color:lin('#777d6c'),roughness:1}),'stone');
  for(const [index,hill]of gardenHills.features.entries()){
    for(let i=0;i<48;i++){const angle=i*Math.PI*2/48,x=hill.x+Math.cos(angle)*20,z=hill.z+Math.sin(angle)*20;add(box,stone,x,.045,z,2.66,.08,1.5,-angle-Math.PI/2);}
    // Summit seating faces the city. Low rocks have physical collision footprints.
    for(const side of[-1,1]){const x=hill.x+side*3,z=hill.z;add(box,wood,x,.5,z,2.1,.13,.55);add(box,wood,x,.82,z-.24,2.1,.5,.08);for(const end of[-1,1])add(box,steel,x+end*.8,.25,z,.08,.5,.5);structureCollider({x,z,angle:0,kind:'garden-bench'},0,0,2.1,.6);}
    const sign=buildingSign(index?'PALM RIDGE GARDENS':'BAYVIEW GARDENS','#3d5549','#eee8d5');add(box,sign,hill.x,.95,hill.z+21,5,.65,.1);
    for(const side of[-1,1]){add(box,steel,hill.x+side*2,.52,hill.z+21,.12,1.04,.12);structureCollider({x:hill.x+side*2,z:hill.z+21,angle:0,kind:'garden-sign'},0,0,.16,.16);}
    for(let i=0;i<5;i++){const a=i*1.3,x=hill.x+Math.cos(a)*10,z=hill.z+Math.sin(a)*10;add(rock,rockMaterial,x,.30,z,1.05,.65,.8,a);structureCollider({x,z,angle:0,kind:'garden-rock'},0,0,1.3,1.3);}
  }
  // Distant, inaccessible headlands frame the city instead of an empty horizon.
  const geometry=new THREE.PlaneGeometry(900,220,70,20).rotateX(-Math.PI/2),p=geometry.attributes.position;
  for(let i=0;i<p.count;i++){const x=p.getX(i),z=p.getZ(i),edge=Math.sin((z+110)/220*Math.PI);p.setY(i,Math.max(0,edge)*(16+12*Math.sin(x*.016)+9*Math.sin(x*.037+1))+(z+110)*.015);}
  geometry.computeVertexNormals();const material=surfaceFinish(new THREE.MeshStandardMaterial({color:lin('#64745d'),roughness:1}),'grass');
  const mountains=new THREE.Mesh(geometry,material);mountains.position.set(300,-1,650);mountains.receiveShadow=true;S.add(mountains);
  return{gardenHills:gardenHills.features.length,headlands:1};
}

function optimizeVehicleRendering(v) {
  // Merge static opaque parts by model/material; retain independent lights,
  // transparent windows, turn indicators and wheel transforms.
  if(v.t.civic!=='fd'){
    for(const wheel of v.wheels)fdBatchGroup(v,wheel.spin,'vehicle:'+v.n+':wheel:'+Math.sign(wheel.steer.position.z));
    fdBatchGroup(v,v.o,'vehicle:'+v.n+':body');
  }
  const paint=v.o.children.find(o=>o.isMesh&&o.material.isMeshPhysicalMaterial&&o.material!==GLASS&&o.material!==civicGlass)?.material||carMat('#a3a7aa'),t=v.t;
  const group=new THREE.Group();bx(paint,t.L,.62,t.W,0,.64,0,group);
  if(v.n!=='Bike')bx(GLASS,t.L*.47,v.n==='Van'?1.3:.46,t.W*.81,-.24,v.n==='Van'?1.5:1.17,0,group);
  bx(headMat,.06,.12,t.W*.72,t.L/2,.79,0,group);bx(v.tm,.06,.12,t.W*.72,-t.L/2,.8,0,group);
  const wheels=new THREE.InstancedMesh(box,RUB,4),matrix=new THREE.Matrix4();let i=0;
  for(const x of[-1,1])for(const z of[-1,1]){matrix.makeScale(.65,.65,.22);matrix.setPosition(x*t.L*.31,.33,z*t.W*.48);wheels.setMatrixAt(i++,matrix);}wheels.castShadow=true;group.add(wheels);
  v.highParts=[...v.o.children];v.lowModel=group;group.visible=false;v.o.add(group);
}

function updateTerrainPose(v) {
  const c=Math.cos(v.a),s=Math.sin(v.a),length=v.t.wb||v.t.L*.62,width=v.t.W*.85;
  const front=worldElevation(v.x+c*length/2,v.z+s*length/2),rear=worldElevation(v.x-c*length/2,v.z-s*length/2);
  const right=worldElevation(v.x-s*width/2,v.z+c*width/2),left=worldElevation(v.x+s*width/2,v.z-c*width/2);
  v.groundPitch=Math.atan2(front-rear,length);v.groundRoll=-Math.atan2(right-left,width);
}

// One owner for indicator visibility. Detail refreshes must not enable lamps.
// A 54-tick cycle gives 450 ms on / 450 ms off, pausing with simulation time.
function updateVehicleIndicators(v) {
  const state=v.ind===-1||v.ind===1||v.ind===2?v.ind:0;
  if(v.indicatorState!==state){v.indicatorState=state;v.indicatorEpoch=trafficTick;}
  const on=state!==0&&(trafficTick-v.indicatorEpoch)%54<27,detailed=v===car||v.detailsNear!==false;
  for(const light of v.il)light.visible=detailed&&on&&(state===2||state===light.side_);
}
