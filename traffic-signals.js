/* Simulation-timed junction lights: no timers or extra scene lights. */
const SIGNAL_TIMING={green:18,amber:3,clearance:2};
function signalPhase(node,tick=trafficTick){
 const half=SIGNAL_TIMING.green+SIGNAL_TIMING.amber+SIGNAL_TIMING.clearance,cycle=half*2,time=((tick/60+node.signal.offset)%cycle+cycle)%cycle,axis=time<half?0:1,elapsed=time%half;
 return{axis,state:elapsed<SIGNAL_TIMING.green?'green':elapsed<SIGNAL_TIMING.green+SIGNAL_TIMING.amber?'amber':'red'};
}
function signalState(node,edge,tick=trafficTick){
 if(!node.signal)return'green';const phase=signalPhase(node,tick),approach=node.signal.approaches.get(edge);return approach&&approach.axis===phase.axis?phase.state:'red';
}
function initTrafficSignals(selected){
 return selected.map((node,index)=>{
  const radius=Math.max(...node.links.map(e=>e.width))/2+4.5;node.signal={offset:index*7,approaches:new Map(),radius,lastPhase:null};
  for(const edge of node.links){const dir=edge.b===node?1:-1;let i=dir>0?edge.points.length-1:0;
   while(i>=0&&i<edge.points.length&&Math.hypot(edge.points[i].x-node.x,edge.points[i].z-node.z)<radius)i-=dir;
   i=Math.max(0,Math.min(edge.points.length-1,i));const stop=lanePoint(edge,i,dir),axis=Math.abs(Math.cos(stop.a))>Math.abs(Math.sin(stop.a))?0:1;
   node.signal.approaches.set(edge,{edge,dir,stop,axis});
  }return node;
 });
}
function trafficSignalRule(v){
 const A=v.ai;let approach=A.signalApproach;
 if(approach){const p=approach.stop,passed=(v.x-p.x)*Math.cos(p.a)+(v.z-p.z)*Math.sin(p.a);if(passed>approach.node.signal.radius+22){A.signalApproach=null;approach=null;}}
 if(!approach){const node=A.dir>0?A.e.b:A.e.a;if(node.signal&&Math.hypot(node.x-v.x,node.z-v.z)<65){const data=node.signal.approaches.get(A.e);approach=A.signalApproach={...data,node,committed:false};}}
 if(!approach)return{hold:false,approach:null};
 const p=approach.stop,fx=Math.cos(p.a),fz=Math.sin(p.a),remaining=(p.x-v.x)*fx+(p.z-v.z)*fz-v.t.L/2,sp=Math.max(0,v.vx*fx+v.vz*fz),state=signalState(approach.node,approach.edge);
 // Cars already inside clear the junction; amber only stops cars with room to brake.
 if(remaining<-.35||state==='green'&&remaining<=0||state==='amber'&&remaining<sp*sp/8+sp*.35+1)approach.committed=true;
 const hold=!approach.committed&&state!=='green';
 if(hold&&A.claim===approach.node){if(junctionClaims.get(A.claim)?.owner===v)junctionClaims.delete(A.claim);A.claim=null;}
 return{hold,remaining,state,approach};
}
function drawSignalMapMarkings(context,scale){
 context.save();context.scale(scale,scale);context.fillStyle=ROAD.edge;
 for(const node of trafficSignals)for(const {edge,stop}of node.signal.approaches.values()){
  const laneOffset=edge.width*(edge.width===ROAD.boulevard?.34:.25);
  context.save();context.translate(stop.x,stop.z);context.rotate(stop.a);context.fillRect(-.2,-laneOffset+.3,.4,edge.width/2-.6);
  for(let forward=1.2;forward<3.1;forward+=.65)context.fillRect(forward,-laneOffset-edge.width/2+.4,.35,edge.width-.8);context.restore();
 }context.restore();
}
function buildTrafficSignals(){
 const steel=mat('#555c5c'),housing=mat('#171c1c'),paint=new THREE.MeshStandardMaterial({color:lin(ROAD.edge),roughness:.93,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-3}),lensGeometry=new THREE.CircleGeometry(.115,12).rotateY(-PI/2),matrix=new THREE.Matrix4();
 const colours=['#ff342d','#ffbe37','#48e297'].map(lin);
 for(const node of trafficSignals){
  const group=new THREE.Group();group.position.set(node.x,0,node.z);S.add(group);node.signal.group=group;node.signal.lenses=[];
  const metal=[],shells=[],stripes=[],lensTransforms=[[],[]];
  const transform=(p,x,y,z,sx,sy,sz)=>new THREE.Matrix4().makeRotationY(-p.a).setPosition(p.x-node.x,0,p.z-node.z).multiply(new THREE.Matrix4().makeScale(sx,sy,sz).setPosition(x,y,z));
  for(const {edge,stop,axis}of node.signal.approaches.values()){
   const laneOffset=edge.width*(edge.width===ROAD.boulevard?.34:.25),pole=edge.width/2+1.25-laneOffset;metal.push(transform(stop,.65,2.7,pole,.16,5.4,.16),transform(stop,.65,5.35,pole/2,.13,.13,pole+.2));
   shells.push(transform(stop,.65,4.6,0,.27,1.13,.40));lensTransforms[axis].push(transform(stop,.505,0,0,1,1,1));
   stripes.push(transform(stop,0,.025,edge.width/4-laneOffset,.4,.018,edge.width/2-.6));
   for(let forward=1.2;forward<3.1;forward+=.65)stripes.push(transform(stop,forward,.023,-laneOffset,.35,.016,edge.width-.8));
  }
  const instances=(geometry,material,transforms)=>{if(!transforms.length)return null;const mesh=new THREE.InstancedMesh(geometry,material,transforms.length);transforms.forEach((m,i)=>mesh.setMatrixAt(i,m));mesh.castShadow=false;mesh.receiveShadow=false;mesh.frustumCulled=false;group.add(mesh);return mesh;};
  instances(box,steel,metal);instances(box,housing,shells);instances(box,paint,stripes);
  for(let axis=0;axis<2;axis++)for(let colour=0;colour<3;colour++){
   const material=new THREE.MeshBasicMaterial({color:colours[colour].clone().multiplyScalar(.035),toneMapped:false}),transforms=lensTransforms[axis].map(m=>{matrix.makeTranslation(0,4.94-colour*.34,0);return m.clone().multiply(matrix);});
   instances(lensGeometry,material,transforms);node.signal.lenses.push({axis,colour,material});
  }
 }
}
function updateTrafficSignals(){
 for(const node of trafficSignals){const phase=signalPhase(node),key=phase.axis+phase.state,range=graphics.mobile?140:210;node.signal.group.visible=Math.hypot(node.x-P.x,node.z-P.z)<range;
  if(key===node.signal.lastPhase)continue;node.signal.lastPhase=key;
  for(const lens of node.signal.lenses){const state=lens.axis===phase.axis?phase.state:'red',on=lens.colour===(state==='red'?0:state==='amber'?1:2);lens.material.color.set(lens.colour===0?'#ff342d':lens.colour===1?'#ffbe37':'#48e297').convertSRGBToLinear().multiplyScalar(on?2.8:.035);}
 }
}
