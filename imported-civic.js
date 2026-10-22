/* User-supplied GLB. The source geometry and textures remain shared between cars.
   Credits and the source asset's terms are recorded in THIRD_PARTY_ASSETS.md. */
const ImportedCivic={
  name:'1999 Honda Civic Si',parts:null,promise:null,error:null,
  async readModel(){
    if(location.protocol==='file:')throw Error('Civic file URL');
    this.url=new URL(this.path||'assets/vehicles/1999_honda_civic_si.glb',document.baseURI).href;
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
    try{
      const response=await fetch(this.url,{signal:controller.signal});
      if(!response.ok)throw Error('Civic model HTTP '+response.status);
      const buffer=await response.arrayBuffer();
      if(buffer.byteLength<12||new DataView(buffer).getUint32(0,true)!==0x46546c67)throw Error('Civic response is not a GLB');
      return buffer;
    }catch(error){if(controller.signal.aborted)throw Error('Civic download timed out');throw error;}
    finally{clearTimeout(timer);}
  },
  failureMessage(){
    if(this.error==='Civic file URL')return 'To load the Civic, start the local game server and open http://localhost:8000. Opening index.html directly blocks model loading.';
    if(/HTTP 404/.test(this.error))return 'The local server is missing the Civic model file (404). Restart the server or rebuild its Docker image, then reload.';
    if(this.variant&&/not a GLB/.test(this.error))return 'The server returned an invalid model. Check that '+this.path+' is included and served as a file.';
    if(/not a GLB/.test(this.error))return 'The server returned a page instead of the Civic model. Check that assets/vehicles/1999_honda_civic_si.glb is included and served as a file.';
    if(/timed out/.test(this.error))return 'Loading the Civic timed out. Check the local connection, then reload to retry.';
    return 'The Civic model request failed. Check the model loading details in Menu → Vehicle. A simplified car is available.';
  },
  load(){
    if(this.promise)return this.promise;
    this.stage='loading';document.getElementById('boot-status').textContent='Loading '+this.name+'…';this.promise=this.readModel().then(buffer=>{this.stage='decoding';return new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(Error('Civic model decoding timed out')),15000);new THREE.GLTFLoader().parse(buffer,new URL('./',this.url).href,value=>{clearTimeout(timeout);resolve(value);},error=>{clearTimeout(timeout);reject(error);});});}).then(gltf=>{
      this.stage='normalizing';const root=gltf.scene;root.updateMatrixWorld(true);
      const bounds=new THREE.Box3().setFromObject(root),size=bounds.getSize(new THREE.Vector3()),scale=(this.length||4.45)/size.z;
      // Normalize the source bounds and configured nose direction to game +X.
      const transform=new THREE.Matrix4().makeRotationY(this.rotation??Math.PI/2).multiply(new THREE.Matrix4().makeScale(scale,scale,scale));
      const center=bounds.getCenter(new THREE.Vector3()).applyMatrix4(transform);transform.setPosition(-center.x,-bounds.min.y*scale,-center.z);
      const materials=new Map();this.parts=[];
      root.traverse(mesh=>{
        if(!mesh.isMesh)return;
        const geometry=mesh.geometry.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(transform,mesh.matrixWorld));
        geometry.computeBoundingBox();geometry.computeBoundingSphere();
        let material=materials.get(mesh.material);
        if(!material){
          material=mesh.material.clone();
          // r128 transmission requires a separate scene pass; ordinary transparent
          // glass preserves the window textures in this game's composer instead.
          if(material.transmission){material.transmission=0;material.transparent=true;material.opacity=.24;material.depthWrite=false;material.side=THREE.DoubleSide;}
          if(material.transparent)material.depthWrite=false;
          material.envMapIntensity=.65;materials.set(mesh.material,material);
        }
        const name=mesh.name,wheel=this.variant?this.isWheel(name):!/steering/.test(name)&&(/_wheel_/.test(name)||/^polySurface/.test(name)),steering=/steering_wheel/.test(name);
        const center=geometry.boundingBox.getCenter(new THREE.Vector3());
        const role=this.variant?this.doorRole(mesh.material.name):/_body_body_|_body_black_|_body_rubber_trim_/.test(name)?1:/glass[LR]F_window/.test(name)?2:/_mirror[LR]_/.test(name)?3:0;
        geometry.userData.doorKey=this.name+':'+name;
        this.parts.push({name,geometry,material,wheel,steering,center,role,tail:this.variant==='coupe'?name==='Mesh4_CIVIC13_luz2_0':/_tail_light_lod0_/.test(name),reverse:/_reverse_light_lod0_/.test(name)});
      });
      if(this.variant)prepareAdditionalCivicParts(this);
      // Keep one canonical, world-space geometry per part; release source buffers.
      const disposed=new Set();root.traverse(m=>{if(!m.isMesh)return;if(!disposed.has(m.geometry)){disposed.add(m.geometry);m.geometry.dispose();}if(!disposed.has(m.material)){disposed.add(m.material);m.material.dispose();}});
      this.lamps=this.parts.filter(p=>/_glass[LR]HL_detail_glass_clear_/.test(p.name)).map(p=>new THREE.Vector3(p.geometry.boundingBox.max.x+.025,p.center.y,p.center.z));if(this.variant)this.lamps=[-1,1].map(side=>new THREE.Vector3(this.length/2-.08,.72,side*.65));this.stage='loaded';this.bounds={length:this.length||4.45,width:size.x*scale,height:size.y*scale};return true;
    }).catch(error=>{this.parts=null;this.error=String(error.message||error);return false;});
    return this.promise;
  },
  attach(v){
    if(!this.parts||v.importedView)return;
    this.stage='attaching';v.o.clear();v.wheels.length=0;v.il.length=0;v.doorState=null;v.doors=null;v.lowModel=null;v.highParts=null;v.visualDetails=[];
    const steering=new THREE.Group(),steerParts=this.parts.filter(p=>p.steering),steerBounds=new THREE.Box3();
    for(const p of steerParts)steerBounds.union(p.geometry.boundingBox);
    steering.position.copy(steerBounds.getCenter(new THREE.Vector3()));v.o.add(steering);
    const wheelSets=new Map();
    for(const p of this.parts.filter(p=>p.wheel)){const key=(p.center.x>0?'front':'rear')+(p.center.z>0?'right':'left');if(!wheelSets.has(key))wheelSets.set(key,[]);wheelSets.get(key).push(p);}
    const wheelParent=new Map();
    for(const [key,parts]of wheelSets){const bounds=new THREE.Box3();for(const p of parts)bounds.union(p.geometry.boundingBox);const center=bounds.getCenter(new THREE.Vector3()),steer=new THREE.Group(),spin=new THREE.Group();steer.position.copy(center);steer.add(spin);v.o.add(steer);const wheel={steer,spin,front:center.x>0};v.wheels.push(wheel);for(const p of parts)wheelParent.set(p,spin);}
    const tail=this.parts.find(p=>p.tail),reverse=this.parts.find(p=>p.reverse);v.tm.dispose();v.rm.dispose();
    v.tm=new THREE.MeshBasicMaterial({map:tail?.material.map||null,color:0x440000,toneMapped:false});v.rm=new THREE.MeshBasicMaterial({map:reverse?.material.map||null,color:0x111111,toneMapped:false});
    for(const p of this.parts){
      const parent=p.wheel?wheelParent.get(p):p.steering?steering:v.o,mesh=new THREE.Mesh(p.geometry,p.tail?v.tm:p.reverse?v.rm:p.material);mesh.name=p.name;mesh.castShadow=!p.material.transparent;mesh.receiveShadow=!p.material.transparent;
      if(p.wheel)mesh.position.copy(parent.parent.position).multiplyScalar(-1);else if(p.steering)mesh.position.copy(steering.position).multiplyScalar(-1);
      if(p.role)mesh.userData.doorSource=p.role;parent.add(mesh);
    }
    // Retain the common physical-light and indicator owners.
    for(const side of[-1,1])for(const front of[true,false]){const lamp=bx(ambMat,.045,.055,.13,(front?1:-1)*(v.t.L/2-.07),front?.66:.64,side*.69,v.o);lamp.side_=side;lamp.visible=false;lamp.castShadow=false;v.il.push(lamp);}
    v.importedView={steering,lamps:this.lamps,paint:this.parts.find(p=>p.material.name===(this.paintMaterial||'CarPaint'))?.material};if(this.variant)for(const side of[-1,1]){if(this.variant==='fd2')bx(v.tm,.025,.06,.16,-v.t.L/2+.22,.84,side*.63,v.o);bx(v.rm,.025,.04,.08,-v.t.L/2+.20,.69,side*.48,v.o);}
    optimizeVehicleRendering(v);prepareVehicleDoors(v);v.detailsNear=true;this.stage='attached';
  },
  animate(v){if(v.importedView)v.importedView.steering.rotation.x=-v.st*9;}
};

// Each supplied model has its own source axes, materials and wheel layout.
function prepareAdditionalCivicParts(model){
  if(model.variant!=='fd2')return;
  const parts=[];
  for(const p of model.parts){
    if(!p.wheel){parts.push(p);continue;}
    // The FD2 stores each axle's two wheels in a single mesh. Split triangles
    // by side so steering and rolling use four independent pivots.
    const geometry=p.geometry,index=geometry.index,a=geometry.attributes.position;
    for(const side of[-1,1]){
      const indices=[],count=index?index.count:a.count;
      for(let i=0;i<count;i+=3){const ids=[0,1,2].map(k=>index?index.getX(i+k):i+k);if(Math.sign(ids.reduce((n,id)=>n+a.getZ(id),0))===side)indices.push(...ids);}
      const split=geometry.clone();split.setIndex(indices); // Bounds must only include this wheel's vertices.
      const bounds=new THREE.Box3();for(const id of indices)bounds.expandByPoint(new THREE.Vector3().fromBufferAttribute(a,id));
      split.boundingBox=bounds;split.boundingSphere=bounds.getBoundingSphere(new THREE.Sphere());
      parts.push({...p,name:p.name+':'+side,geometry:split,center:bounds.getCenter(new THREE.Vector3())});
    }
    geometry.dispose();
  }
  model.parts=parts;
}
const ImportedCivicCoupe=Object.assign(Object.create(ImportedCivic),{
  name:'2012 Honda Civic Si Coupe',path:'assets/vehicles/2012_honda_civic_si_coupe.glb',variant:'coupe',length:4.47,
  parts:null,promise:null,error:null,paintMaterial:'CIVIC13',
  isWheel:name=>/_(CIVIC13_rin|llanta|disk)_/.test(name),
  doorRole:name=>name==='CIVIC13'||name==='CIVIC13_plast'?1:/^(glass|vidrios)$/.test(name)?2:0
});
const ImportedCivicFD2=Object.assign(Object.create(ImportedCivic),{
  name:'2009 Honda Civic Type R FD2 Custom',path:'assets/vehicles/2009_honda_civic_type_r_fd2_custom.glb',variant:'fd2',length:4.54,rotation:-Math.PI/2,
  parts:null,promise:null,error:null,paintMaterial:'Bodyunrefunblend11Mtl',
  isWheel:name=>/Object_(8|9)$/.test(name),
  doorRole:name=>name==='Bodyunrefunblend11Mtl'?1:/^Glass/.test(name)?2:0
});
const ImportedVehicles=[ImportedCivic,ImportedCivicCoupe,ImportedCivicFD2];
function importedVehicleModel(name){return ImportedVehicles.find(model=>model.name===name);}
