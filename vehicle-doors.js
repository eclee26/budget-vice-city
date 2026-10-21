/* Geometry partitions preserve the original closed vehicle and reveal real
   front-door apertures during animation. Shared fragments are cached by shape. */
const vehicleDoorCache=new Map(),vehicleDoorGlass=new Map();
const vehicleDoorStats={prepared:0,cacheEntries:0,triangles:0,milliseconds:0};
function vehicleDoorSpec(t,name){
  const van=name==='Van',roof=van?.4+t.H:t.civic?civicProfiles[t.civic].roof:1.49;
  return{rear:van?.65:t.civic?-.195:-.18,front:van?2.30:t.civic?civicProfiles[t.civic].front-.10:1.08,bottom:van?.42:.28,top:roof-.03,inner:t.W*.33,outer:t.W*.7,hingeZ:t.W/2};
}
function doorSourceRole(key){
  if(/curved-window|door-glass|sideglass/.test(key))return 2;
  if(/flank|:side:|shoulder|waist-rail/.test(key))return 1;
  if(/handle|mirror|window-seal|windowseal/.test(key))return 3;
  return 0;
}
function doorSplitPolygon(poly,axis,limit,keepGreater){
  const inside=[],outside=[];if(!poly.length)return{inside,outside};
  const value=v=>(v[axis]-limit)*(keepGreater?1:-1);
  for(let i=0;i<poly.length;i++){
    const a=poly[i],b=poly[(i+1)%poly.length],da=value(a),db=value(b),ia=da>=-1e-9,ib=db>=-1e-9;
    (ia?inside:outside).push(a);
    if(ia!==ib){const u=da/(da-db),v=a.map((x,k)=>x+(b[k]-x)*u);inside.push(v);outside.push(v);}
  }
  return{inside,outside};
}
function doorPartitionPolygon(poly,box){
  let inside=poly;const outside=[];
  for(const [axis,limit,greater]of [[0,box[0],true],[0,box[1],false],[1,box[2],true],[1,box[3],false],[2,box[4],true],[2,box[5],false]]){
    const split=doorSplitPolygon(inside,axis,limit,greater);if(split.outside.length>=3)outside.push(split.outside);inside=split.inside;if(inside.length<3)break;
  }
  return{inside:inside.length>=3?inside:[],outside};
}
function doorWritePolygon(output,poly,reverse=false,side=0){
  for(let i=1;i<poly.length-1;i++){
    const tri=reverse?[poly[0],poly[i+1],poly[i]]:[poly[0],poly[i],poly[i+1]];
    const a=tri[0],b=tri[1],c=tri[2],ux=b[0]-a[0],uy=b[1]-a[1],uz=b[2]-a[2],vx=c[0]-a[0],vy=c[1]-a[1],vz=c[2]-a[2];
    if(Math.hypot(uy*vz-uz*vy,uz*vx-ux*vz,ux*vy-uy*vx)<1e-11)continue;
    for(const v of tri){const n=Math.hypot(v[3],v[4],v[5])||1;output.push(v[0],v[1],v[2]-side*.032,v[3]/n*(reverse?-1:1),v[4]/n*(reverse?-1:1),v[5]/n*(reverse?-1:1),v[6],v[7]);}
  }
}
function doorBuffer(values){
  if(!values.length)return null;const geometry=new THREE.BufferGeometry(),p=[],n=[],uv=[];
  for(let i=0;i<values.length;i+=8){p.push(values[i],values[i+1],values[i+2]);n.push(values[i+3],values[i+4],values[i+5]);uv.push(values[i+6],values[i+7]);}
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(p,3));geometry.setAttribute('normal',new THREE.Float32BufferAttribute(n,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.computeBoundingBox();geometry.computeBoundingSphere();return geometry;
}
function doorPartitionMesh(mesh,spec,role){
  mesh.updateMatrix();const matrix=mesh.matrix.clone(),geometry=mesh.geometry;
  const sourceFlags=geometry.userData.doorSources;if(!role&&(!sourceFlags||!sourceFlags.some(flag=>flag>0)))return null;
  const key=(geometry.userData.doorKey||geometry.uuid)+':'+matrix.elements.join(',')+':'+JSON.stringify(spec)+':'+role;
  if(vehicleDoorCache.has(key))return vehicleDoorCache.get(key);
  const a=geometry.attributes,p=a.position,index=geometry.index,normalMatrix=new THREE.Matrix3().getNormalMatrix(matrix),point=new THREE.Vector3(),normal=new THREE.Vector3();
  const fixed=[],left=[],right=[],innerLeft=[],innerRight=[],count=index?index.count:p.count;
  let extracted=0;
  for(let i=0;i<count;i+=3){
    const ids=[0,1,2].map(k=>index?index.getX(i+k):i+k),sourceRole=role||(sourceFlags?sourceFlags[ids[0]]:0),tri=ids.map(id=>{
      point.fromBufferAttribute(p,id).applyMatrix4(matrix);normal.set(a.normal?a.normal.getX(id):0,a.normal?a.normal.getY(id):1,a.normal?a.normal.getZ(id):0).applyMatrix3(normalMatrix).normalize();
      return[point.x,point.y,point.z,normal.x,normal.y,normal.z,a.uv?a.uv.getX(id):0,a.uv?a.uv.getY(id):0];
    });
    if(!sourceRole){doorWritePolygon(fixed,tri);continue;}
    let pending=[tri];
    for(const side of[-1,1]){
      const box=[spec.rear,spec.front,spec.bottom,spec.top,side<0?-spec.outer:spec.inner,side<0?-spec.inner:spec.outer],remaining=[];
      for(const poly of pending){
        if([0,1,2].some(axis=>poly.every(v=>v[axis]<box[axis*2])||poly.every(v=>v[axis]>box[axis*2+1]))){remaining.push(poly);continue;}
        const split=doorPartitionPolygon(poly,box);remaining.push(...split.outside);
        if(split.inside.length){doorWritePolygon(side<0?left:right,split.inside);if(sourceRole===1)doorWritePolygon(side<0?innerLeft:innerRight,split.inside,true,side);extracted++;}
      }
      pending=remaining;
    }
    for(const poly of pending)doorWritePolygon(fixed,poly);
  }
  const result=extracted?{fixed:doorBuffer(fixed),left:doorBuffer(left),right:doorBuffer(right),innerLeft:doorBuffer(innerLeft),innerRight:doorBuffer(innerRight),base:matrix,inverse:matrix.clone().invert()}:null;
  vehicleDoorCache.set(key,result);vehicleDoorStats.cacheEntries=vehicleDoorCache.size;if(result)vehicleDoorStats.triangles+=(fixed.length+left.length+right.length+innerLeft.length+innerRight.length)/24;
  return result;
}
function vehicleDoorCandidates(v){
  return v.o.children.filter(m=>m.isMesh&&!m.userData.vehicleDoorGenerated&&(m.userData.doorSource||m.geometry.userData.doorSources||m.geometry.type==='PlaneGeometry'));
}
function prepareVehicleDoors(v){
  if(v.n==='Bike')return;const start=performance.now(),spec=vehicleDoorSpec(v.t,v.n);
  for(const source of vehicleDoorCandidates(v)){
    if(source.userData.vehicleDoorPlan)continue;
    const role=source.userData.doorSource||(source.geometry.type==='PlaneGeometry'?3:0);
    const partition=doorPartitionMesh(source,spec,role);source.userData.vehicleDoorPlan={partition};
    if(partition&&source.material.transparent&&!vehicleDoorGlass.has(source.material)){const glass=source.material.clone();glass.side=THREE.DoubleSide;vehicleDoorGlass.set(source.material,glass);}
  }
  vehicleDoorStats.prepared++;vehicleDoorStats.milliseconds+=performance.now()-start;
}
function vehicleDoorMaterialProxies(){
  const group=new THREE.Group();group.visible=false;
  for(const material of vehicleDoorGlass.values())group.add(new THREE.Mesh(box,material));return group;
}
function ensureVehicleDoors(v){
  if(v.n==='Bike')return null;if(v.doorState)return v.doorState;
  prepareVehicleDoors(v);const spec=vehicleDoorSpec(v.t,v.n),root=new THREE.Group(),doors=new Map(),sources=[];root.userData.vehicleDoorGenerated=true;v.o.add(root);
  for(const side of[-1,1]){const group=new THREE.Group();group.position.set(spec.front,0,side*spec.hingeZ);group.visible=false;group.userData.vehicleDoorGenerated=true;root.add(group);doors.set(side,group);}
  for(const source of vehicleDoorCandidates(v)){
    const partition=source.userData.vehicleDoorPlan?.partition;if(!partition)continue;
    const entry={source,partition,fixed:null,parts:[]};
    if(partition.fixed){entry.fixed=new THREE.Mesh(partition.fixed,source.material);entry.fixed.castShadow=source.castShadow;entry.fixed.receiveShadow=source.receiveShadow;entry.fixed.matrixAutoUpdate=false;root.add(entry.fixed);}
    for(const side of[-1,1])for(const [geometry,inside]of[[side<0?partition.left:partition.right,false],[side<0?partition.innerLeft:partition.innerRight,true]]){
      if(!geometry)continue;const material=inside?civicTrim:vehicleDoorGlass.get(source.material)||source.material,mesh=new THREE.Mesh(geometry,material);mesh.castShadow=source.castShadow;mesh.receiveShadow=source.receiveShadow;mesh.matrixAutoUpdate=false;doors.get(side).add(mesh);entry.parts.push({mesh,side});
    }
    sources.push(entry);
  }
  root.visible=false;v.doors=doors;v.doorState={root,doors,sources,spec,angles:new Map([[-1,0],[1,0]]),open:false,delta:new THREE.Matrix4(),hinge:new THREE.Matrix4()};
  return v.doorState;
}
function syncVehicleDoors(v){
  const s=v.doorState;if(!s)return;const near=v.detailsNear!==false;
  s.root.visible=s.open&&near;
  for(const entry of s.sources){
    entry.source.userData.doorOriginalMasked=s.open;entry.source.visible=near&&!s.open;
    if(!s.open)continue;entry.source.updateMatrix();s.delta.multiplyMatrices(entry.source.matrix,entry.partition.inverse);
    if(entry.fixed){entry.fixed.matrix.copy(s.delta);entry.fixed.matrixWorldNeedsUpdate=true;}
    for(const {mesh,side}of entry.parts){s.hinge.makeTranslation(-s.spec.front,0,-side*s.spec.hingeZ);mesh.matrix.multiplyMatrices(s.hinge,s.delta);mesh.matrixWorldNeedsUpdate=true;}
  }
}
function setVehicleDoor(v,side,angle){
  const state=ensureVehicleDoors(v);if(!state)return null;state.angles.set(side,angle);state.open=[...state.angles.values()].some(a=>Math.abs(a)>.005);
  for(const [sign,group]of state.doors){group.rotation.y=state.angles.get(sign)||0;group.visible=state.open;}
  syncVehicleDoors(v);return state.doors.get(side);
}
