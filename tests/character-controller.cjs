// Test the actual on-foot controller independently of rendering and traffic randomness.
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const source=html.slice(html.indexOf('function characterBlocked('),html.indexOf('function phys('));
function setup({solid=()=>false,cars=[],yaw=0}={}){
 const keys=new Set(),P={x:0,z:0,a:0,vx:0,vz:0,y:0,vy:0,ph:0,H:{body:{position:{}},tor:{rotation:{z:0}}},o:{position:{}}};
 const cp={x:-5,y:3,z:0,set(x,y,z){Object.assign(this,{x,y,z});}};
 const c=vm.createContext({P,cp,cam:{position:{copy(){}}},touch:{x:0,y:0},ca:yaw,yo:0,DT:1/60,PI:Math.PI,Math,solid,cars,tile:()=>0,pressed:k=>keys.has(k),clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),worldElevation:()=>0,anim:()=>{P.H.body.position.y=0;P.H.tor.rotation.z=0;}});
 vm.runInContext(source,c);return {c,P,keys,tick(n=1){for(let i=0;i<n;i++)c.moveCharacter();}};
}
test('all four keyboard directions follow the camera, including a rotated camera',()=>{
 for(const yaw of [0,Math.PI/2,-2])for(const [key,angle]of [['w',0],['d',Math.PI/2],['s',Math.PI],['a',-Math.PI/2]]){
  const s=setup({yaw});s.keys.add(key);s.tick(60);const a=Math.atan2(s.P.z,s.P.x)-yaw-angle;
  assert.ok(Math.abs(Math.atan2(Math.sin(a),Math.cos(a)))<1e-8);assert.ok(Math.hypot(s.P.x,s.P.z)>3);
 }
});
test('diagonals have the same top speed and sprint is faster than jogging',()=>{
 const a=setup(),b=setup(),s=setup();a.keys.add('w');b.keys.add('w');b.keys.add('d');s.keys.add('w');s.keys.add('shift');a.tick(120);b.tick(120);s.tick(120);
 assert.ok(Math.abs(Math.hypot(a.P.vx,a.P.vz)-Math.hypot(b.P.vx,b.P.vz))<1e-10);assert.ok(s.P.x>a.P.x*1.9);
 a.keys.clear();a.tick(20);assert.ok(Math.hypot(a.P.vx,a.P.vz)<.0001);
});
test('analog input stays proportional and uses the same camera basis',()=>{
 const s=setup({yaw:Math.PI/2});s.c.touch.y=.5;s.tick(90);assert.ok(Math.abs(s.P.x)<1e-9);assert.ok(s.P.z>2.7&&s.P.z<3);assert.ok(Math.abs(s.P.vz-.0325)<1e-7);
});
test('walls stop the capsule at its radius while permitting sliding',()=>{
 const s=setup({solid:(x,z)=>x>=2});s.keys.add('w');s.keys.add('d');s.tick(180);
 assert.ok(s.P.x<1.71&&s.P.x>1.6);assert.ok(s.P.z>7);assert.equal(s.c.characterBlocked(s.P.x,s.P.z),false);
});
test('rotated rectangular cars allow close approach beside doors without overlap',()=>{
 for(const a of [0,Math.PI/2,.7]){
  const v={x:0,z:0,a,t:{L:4.6,W:1.8}},s=setup({cars:[v]});
  assert.equal(s.c.characterBlocked(-Math.sin(a)*1.25,Math.cos(a)*1.25),false);
  assert.equal(s.c.characterBlocked(-Math.sin(a)*1.05,Math.cos(a)*1.05),true);
  assert.equal(s.c.characterBlocked(Math.cos(a)*2.5,Math.sin(a)*2.5),true);
 }
});
test('holding Jump launches once, lands, and requires release for another jump',()=>{
 const s=setup();s.keys.add(' ');let apex=0,launches=0,was=false;
 for(let i=0;i<180;i++){s.tick();if(s.P.y>0&&!was)launches++;was=s.P.y>0;apex=Math.max(apex,s.P.y);}
 assert.equal(launches,1);assert.ok(apex>.9&&apex<1.3);assert.equal(s.P.y,0);
 s.keys.delete(' ');s.tick();s.keys.add(' ');s.tick();assert.ok(s.P.y>0);
});
test('a fresh jump press just before landing buffers into the next takeoff',()=>{
 const s=setup();s.P.y=.015;s.P.vy=-.1;s.keys.add(' ');s.tick();assert.equal(s.P.y,0);s.tick();assert.ok(s.P.y>0);
});
test('turn speed is bounded and blocked movement does not advance the walk cycle',()=>{
 const s=setup();s.keys.add('s');s.tick();assert.ok(Math.abs(s.P.a)<=.161);
 const w=setup({solid:x=>x>=.31});w.keys.add('w');w.tick(100);const phase=w.P.ph;w.tick(60);assert.equal(w.P.ph,phase);assert.ok(w.P.moveBlend<.001);
});
test('chase camera retracts before walls and clears terrain',()=>{
 const s=setup({solid:x=>x<-2});s.c.constrainChaseCamera(0);assert.ok(s.c.cp.x>=-1.8);assert.ok(s.c.cp.y>=.3);
 const t=setup();t.c.cp.set(-5,-2,0);t.c.constrainChaseCamera(0);assert.ok(t.c.cp.y>=.3);
});
test('a car moving onto the character resolves to a clear nearby face',()=>{
 for(const a of [0,.7,Math.PI/2]){
  const s=setup({cars:[{x:0,z:0,a,t:{L:4.6,W:1.8}}]});s.c.resolveCharacterContacts();
  assert.equal(s.c.characterBlocked(s.P.x,s.P.z),false);assert.ok(Math.hypot(s.P.x,s.P.z)<1.3);
 }
});
test('car separation chooses a clear side instead of pushing through a wall',()=>{
 const s=setup({solid:(x,z)=>z>.95,cars:[{x:0,z:0,a:0,t:{L:4.6,W:1.8}}]});s.P.z=.2;s.c.resolveCharacterContacts();
 assert.equal(s.c.characterBlocked(s.P.x,s.P.z),false);assert.ok(s.P.z<0);
});
test('water prevents character traversal but does not obstruct the camera above it',()=>{
 const s=setup({solid:()=>true});s.c.tile=()=>4;
 assert.equal(s.c.characterBlocked(0,0),true);s.c.constrainChaseCamera(0);assert.equal(s.c.cp.x,-5);
});
