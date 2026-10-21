/* Shared, code-native character surfaces retain the metre-based joint rig. */
function humanProfile(points,segments=12){return new THREE.LatheGeometry(points.map(([r,y])=>new THREE.Vector2(r,y)),segments);}
function createHumanGeometry(){
  const c=humanProfile([[0,-.5],[.74,-.5],[.98,-.08],[.95,.5],[0,.5]],10),
    t=humanProfile([[0,-.5],[.86,-.5],[.88,-.4],[.97,0],[1.12,.28],[1.08,.45],[1.2,.5],[0,.5]]),
    s=new THREE.SphereGeometry(1,10,8),d=new THREE.SphereGeometry(1,8,4),face=new THREE.SphereGeometry(1,14,10),h=new THREE.SphereGeometry(1,16,10,0,Math.PI*2,0,1),f=new THREE.BoxGeometry(1,1,1,3,2,2);
  let p=face.attributes.position;for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i),jaw=1-.22*Math.max(0,(-y-.15)/.85);p.setXYZ(i,x*(x>0?.96+.06*Math.max(0,y):.98),y,z*jaw);}face.computeVertexNormals();
  p=h.attributes.position;for(let row=0;row<=10;row++)for(let column=0;column<=16;column++){
    const phi=column/16*Math.PI*2,front=Math.max(0,-Math.cos(phi)),theta=row/10*(2.24-1.18*front**3),x=-Math.cos(phi)*Math.sin(theta),y=Math.cos(theta),z=Math.sin(phi)*Math.sin(theta),i=row*17+column;
    p.setXYZ(i,x,y,z);h.attributes.normal.setXYZ(i,x,y,z);
  }
  p=f.attributes.position;const inner=new THREE.Vector3(),delta=new THREE.Vector3();for(let i=0;i<p.count;i++){inner.set(Math.max(-.38,Math.min(.38,p.getX(i))),Math.max(-.38,Math.min(.38,p.getY(i))),Math.max(-.38,Math.min(.38,p.getZ(i))));delta.set(p.getX(i),p.getY(i),p.getZ(i)).sub(inner).normalize().multiplyScalar(.12).add(inner);if(delta.x>0&&delta.y>0)delta.y*=1-delta.x*.5;p.setXYZ(i,delta.x,delta.y,delta.z);}f.computeVertexNormals();
  const belt=new THREE.CylinderGeometry(1,1,1,16,1,true),pelvis=humanProfile([[0,-.5],[.9,-.5],[1,0],[.82,.5],[0,.5]],12);return{c,s,h,t,face,f,d,belt,pelvis};
}
const humanToneCache=new Map();
function humanTone(color,tone=0){
  if(!tone)return color;const key=color+':'+tone;if(!humanToneCache.has(key))humanToneCache.set(key,'#'+new THREE.Color(color).lerp(new THREE.Color(tone>0?'#ffffff':'#111820'),Math.abs(tone)).getHexString());return humanToneCache.get(key);
}
function humanPart(H,channel,geometry,color,sx,sy,sz,x,y,z,parent,tone=0){
  const mesh=pt_(geometry,humanTone(color,tone),sx,sy,sz,x,y,z,parent);
  if(channel){if(!H.paint[channel])H.paint[channel]=[];H.paint[channel].push({mesh,tone});}return mesh;
}
function setHumanPalette(H,colors){
  for(const [channel,parts]of Object.entries(H.paint||{}))if(colors[channel])for(const {mesh,tone}of parts)mesh.material=mat(humanTone(colors[channel],tone));
}
function humanShirtFront(y,z,depth,width){
  const profile=[[-.5,.86],[-.4,.88],[0,.97],[.28,1.12],[.45,1.08],[.5,1.2]],v=Math.max(-.5,Math.min(.5,(y-.36)/.56));let radius=profile[0][1];
  for(let i=1;i<profile.length;i++)if(v<=profile[i][0]){const a=profile[i-1],b=profile[i];radius=a[1]+(b[1]-a[1])*(v-a[0])/(b[0]-a[0]);break;}
  return .13*depth*radius*Math.sqrt(Math.max(0,1-(z/(.2*width*radius))**2));
}
function humanClothLine(H,points,color,tone,width,parent,depth,bodyWidth){
  const up=new THREE.Vector3(0,1,0);
  for(let i=1;i<points.length;i++){const [ay,az]=points[i-1],[by,bz]=points[i],a=new THREE.Vector3(humanShirtFront(ay,az,depth,bodyWidth)+.004,ay,az),b=new THREE.Vector3(humanShirtFront(by,bz,depth,bodyWidth)+.004,by,bz),delta=b.clone().sub(a),middle=a.clone().add(b).multiplyScalar(.5);
    const mesh=humanPart(H,'shirt',box,color,width,delta.length(),width,middle.x,middle.y,middle.z,parent,tone);mesh.quaternion.setFromUnitVectors(up,delta.normalize());}
}
