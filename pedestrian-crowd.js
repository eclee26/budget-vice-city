/* Flatten the existing ambient rigs into shared geometry batches. The original
   joint transforms and linear material colors are preserved at every render. */
class PedestrianCrowd{
  constructor(scene,geometries,limit=128){
    this.scene=scene;this.limit=limit;this.enabled=true;this.batches=new Map();this.records=new WeakMap();
    this.stats={actors:0,parts:0,batches:geometries.length,capacity:limit*32,milliseconds:0};
    this.material=new THREE.MeshStandardMaterial({color:0xffffff,roughness:.75});
    for(const geometry of geometries){
      const mesh=new THREE.InstancedMesh(geometry,this.material,this.stats.capacity);mesh.count=0;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);mesh.instanceColor=new THREE.InstancedBufferAttribute(new Float32Array(this.stats.capacity*3),3);mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
      mesh.frustumCulled=false;mesh.castShadow=true;mesh.receiveShadow=false;mesh.userData.pedestrianBatch=true;scene.add(mesh);this.batches.set(geometry,mesh);
    }
  }
  parts(p){
    let parts=this.records.get(p);if(parts)return parts;parts=[];
    p.o.traverse(mesh=>{if(mesh.isMesh){if(!this.batches.has(mesh.geometry))throw Error('Unknown ambient rig geometry');parts.push({mesh,visible:mesh.visible});mesh.visible=!this.enabled&&mesh.visible;}});
    this.records.set(p,parts);return parts;
  }
  update(peds){
    const start=performance.now();for(const batch of this.batches.values()){batch.count=0;batch.visible=this.enabled;}
    let actors=0,parts=0;
    for(const p of peds){const sources=this.parts(p);for(const source of sources)source.mesh.visible=!this.enabled&&source.visible;
      if(!this.enabled||!p.o.visible||p.o.parent!==this.scene)continue;actors++;if(actors>this.limit)throw Error('Ambient actor limit exceeded');
      for(const source of sources){if(!source.visible)continue;const mesh=source.mesh,batch=this.batches.get(mesh.geometry),i=batch.count++;
        if(i>=batch.instanceMatrix.count)throw Error('Ambient crowd capacity exceeded');batch.setMatrixAt(i,mesh.matrixWorld);batch.setColorAt(i,mesh.material.color);parts++;
      }
    }
    for(const batch of this.batches.values())if(batch.count){
      batch.instanceMatrix.updateRange.offset=0;batch.instanceMatrix.updateRange.count=batch.count*16;batch.instanceMatrix.needsUpdate=true;
      batch.instanceColor.updateRange.offset=0;batch.instanceColor.updateRange.count=batch.count*3;batch.instanceColor.needsUpdate=true;
    }
    Object.assign(this.stats,{actors,parts,milliseconds:performance.now()-start});
  }
  // QA can compare original and shared rendering without rebuilding actors.
  setEnabled(enabled){this.enabled=!!enabled;}
}
