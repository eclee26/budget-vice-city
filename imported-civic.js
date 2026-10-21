/* User-supplied GLB. The source geometry and textures remain shared between cars.
   Credits and the source asset's terms are recorded in THIRD_PARTY_ASSETS.md. */
const ImportedCivic={
  name:'1999 Honda Civic Si',parts:null,promise:null,error:null,
  load(){
    if(this.promise)return this.promise;
    this.stage='loading';document.getElementById('boot-status').textContent='Loading the 1999 Civic Si…';this.promise=fetch('assets/vehicles/1999_honda_civic_si.glb',{signal:AbortSignal.timeout(15000)}).then(response=>{if(!response.ok)throw Error('Civic model HTTP '+response.status);return response.arrayBuffer();}).then(buffer=>{this.stage='decoding';return new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(Error('Civic model decoding timed out')),15000);new THREE.GLTFLoader().parse(buffer,'assets/vehicles/',value=>{clearTimeout(timeout);resolve(value);},error=>{clearTimeout(timeout);reject(error);});});}).then(gltf=>{
      this.stage='normalizing';const root=gltf.scene;root.updateMatrixWorld(true);
      const bounds=new THREE.Box3().setFromObject(root),size=bounds.getSize(new THREE.Vector3()),scale=4.45/size.z;
      // Source is centimetre-scaled twice, with its nose on +Z. Game cars face +X.
      const transform=new THREE.Matrix4().makeRotationY(Math.PI/2).multiply(new THREE.Matrix4().makeScale(scale,scale,scale));
      transform.setPosition(-(bounds.min.z+bounds.max.z)*scale/2,-bounds.min.y*scale,(bounds.min.x+bounds.max.x)*scale/2);
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
        const name=mesh.name,wheel=!/steering/.test(name)&&(/_wheel_/.test(name)||/^polySurface/.test(name)),steering=/steering_wheel/.test(name);
        const center=geometry.boundingBox.getCenter(new THREE.Vector3());
        const role=/_body_body_|_body_black_|_body_rubber_trim_/.test(name)?1:/glass[LR]F_window/.test(name)?2:/_mirror[LR]_/.test(name)?3:0;
        geometry.userData.doorKey='imported-si:'+name;
        this.parts.push({name,geometry,material,wheel,steering,center,role,tail:/_tail_light_lod0_/.test(name),reverse:/_reverse_light_lod0_/.test(name)});
      });
      // Keep one canonical, world-space geometry per part; release source buffers.
      const disposed=new Set();root.traverse(m=>{if(!m.isMesh)return;if(!disposed.has(m.geometry)){disposed.add(m.geometry);m.geometry.dispose();}if(!disposed.has(m.material)){disposed.add(m.material);m.material.dispose();}});
      this.stage='loaded';this.bounds={length:4.45,width:size.x*scale,height:size.y*scale};return true;
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
    for(const [key,parts]of wheelSets){const bounds=new THREE.Box3();for(const p of parts)bounds.union(p.geometry.boundingBox);const center=bounds.getCenter(new THREE.Vector3()),steer=new THREE.Group(),spin=new THREE.Group();steer.position.set(center.x,v.t.r,center.z);steer.add(spin);v.o.add(steer);const wheel={steer,spin,front:center.x>0};v.wheels.push(wheel);for(const p of parts)wheelParent.set(p,spin);}
    const tail=this.parts.find(p=>p.tail),reverse=this.parts.find(p=>p.reverse);v.tm.dispose();v.rm.dispose();
    v.tm=new THREE.MeshBasicMaterial({map:tail?.material.map||null,color:0x440000,toneMapped:false});v.rm=new THREE.MeshBasicMaterial({map:reverse?.material.map||null,color:0x111111,toneMapped:false});
    for(const p of this.parts){
      const parent=p.wheel?wheelParent.get(p):p.steering?steering:v.o,mesh=new THREE.Mesh(p.geometry,p.tail?v.tm:p.reverse?v.rm:p.material);mesh.name=p.name;mesh.castShadow=!p.material.transparent;mesh.receiveShadow=!p.material.transparent;
      if(p.wheel)mesh.position.copy(parent.parent.position).multiplyScalar(-1);else if(p.steering)mesh.position.copy(steering.position).multiplyScalar(-1);
      if(p.role)mesh.userData.doorSource=p.role;parent.add(mesh);
    }
    // Retain the common physical-light and indicator owners.
    for(const side of[-1,1])for(const front of[true,false]){const lamp=bx(ambMat,.045,.055,.13,(front?1:-1)*(v.t.L/2-.07),front?.66:.64,side*.69,v.o);lamp.side_=side;lamp.visible=false;lamp.castShadow=false;v.il.push(lamp);}
    v.importedView={steering,paint:this.parts.find(p=>p.material.name==='CarPaint')?.material};optimizeVehicleRendering(v);prepareVehicleDoors(v);v.detailsNear=true;this.stage='attached';
  },
  animate(v){if(v.importedView)v.importedView.steering.rotation.x=-v.st*9;}
};
