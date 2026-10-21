const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const c=vm.createContext({Math,Map,Set});vm.runInContext(fs.readFileSync(path.join(__dirname,'../pedestrian-ai.js'),'utf8')+';globalThis.Controller=AmbientPedestrians;',c);
const vehicle=(x=0,z=0,vx=0,vz=0,a=0)=>({x,z,vx,vz,a,t:{L:5.2,W:2.2}});
const ped=(x=0,z=0,a=0)=>({x,z,a,pace:.025,ph:0,dn:0,fl:0,vx:0,vz:0});
function setup(extra={}){let collisions=0,relocations=0;const world={random:()=>.5,safe:()=>true,pose(){},collision(){collisions++;},relocate(p){p.x=100;relocations++;},...extra},ai=new c.Controller(world);return{ai,world,get collisions(){return collisions;},get relocations(){return relocations;},run(peds,cars=[],frames=1,player=null){for(let i=0;i<frames;i++)ai.tick(peds,cars,player,1/60);}};}
test('prediction distinguishes approaching, departing, reverse and parallel cars',()=>{
 const v=vehicle(0,0,8),p=ped(10,0);assert.ok(c.pedestrianVehicleThreat(p,v));
 assert.equal(c.pedestrianVehicleThreat(ped(-8,0),v),null);assert.equal(c.pedestrianVehicleThreat(ped(4,3),v),null);
 assert.ok(c.pedestrianVehicleThreat(ped(-8,0),vehicle(0,0,-8)));
 const turned=vehicle(0,0,0,8,Math.PI/2);assert.ok(c.pedestrianVehicleThreat(ped(0,10),turned));
});
test('standing beside a long car does not cause a false pedestrian impact',()=>{
 const s=setup(),p=ped(0,1.8);s.run([p],[vehicle(0,0,5)]);assert.equal(p.dn,0);assert.equal(s.collisions,0);assert.notEqual(p.ambient.mode,'flee');
});
test('any approaching vehicle prompts lateral escape while retaining the sidewalk route',()=>{
 const s=setup(),p=ped(8,0),route={path:Array.from({length:30},(_,x)=>({x,z:0})),i:8,dir:1};p.walk=route;
 s.run([p],[vehicle(0,0,8)]);assert.equal(p.ambient.mode,'flee');assert.ok(Math.abs(p.z)>0);assert.equal(p.walk,route);
 s.run([p],[],180);assert.equal(p.ambient.mode,'walk');assert.equal(p.walk,route);
});
test('a real impact reports once, then the pedestrian recovers in place',()=>{
 const s=setup(),p=ped(0,0);p.fl=60;s.run([p],[vehicle(0,0,5)]);assert.equal(s.collisions,1);assert.equal(p.fl,0);assert.ok(p.dn>0);
 s.run([p],[],401);assert.equal(p.dn,0);assert.equal(p.ambient.mode,'recover');assert.equal(s.relocations,0);assert.ok(p.x<3);
 s.run([p],[],60);assert.equal(p.ambient.mode,'walk');
});
test('a car blocking recovery keeps the pedestrian down without visible teleporting',()=>{
 const s=setup(),p=ped(0,0);s.ai.reset(p);p.dn=1;s.run([p],[vehicle()],2);assert.ok(p.dn>0);assert.equal(s.relocations,0);assert.equal(p.x,0);
});
test('a failed distant relocation keeps the blocked pedestrian down for another retry',()=>{
 const s=setup({safe:()=>false,canRelocate:()=>true,relocate:()=>false}),p=ped(0,0);s.ai.reset(p);p.dn=1;s.run([p]);assert.ok(p.dn>0);assert.equal(p.x,0);assert.equal(p.ambient.mode,'down');
});
test('fast knockdown motion is swept in short steps and stops before a wall',()=>{
 const s=setup({safe:(p,x)=>x<.5||x>.8}),p=ped(0,0);s.ai.reset(p);p.dn=100;p.ambient.knockX=100;s.run([p]);assert.ok(p.x<.5,p.x);
});
test('horn reactions are bounded by distance, direction, simulation time and cooldown',()=>{
 const s=setup(),near=ped(5,2),behind=ped(-5,0),far=ped(25,0),v=vehicle();
 s.ai.horn(v,[near,behind,far]);assert.equal(near.ambient.lookUntil,1.25);assert.equal(behind.ambient,undefined);assert.equal(far.ambient,undefined);
 s.ai.time=.5;s.ai.horn(v,[near]);assert.equal(near.ambient.lookUntil,1.25);s.ai.time=5;s.ai.horn(v,[near]);assert.equal(near.ambient.lookUntil,6.25);
});
test('head-on walkers pass with personal space and keep making progress',()=>{
 const s=setup({safe:(p,x,z)=>Math.abs(z)<1}),a=ped(-3,0),b=ped(3,0,Math.PI);let closest=Infinity;
 for(let i=0;i<260;i++){s.run([a,b]);closest=Math.min(closest,Math.hypot(a.x-b.x,a.z-b.z));}
 assert.ok(closest>=.49,closest);assert.ok(a.x>1&&b.x<-1,JSON.stringify([a,b]));assert.ok(Math.abs(a.z)<1&&Math.abs(b.z)<1);
});
test('nearby pedestrians converse briefly, face each other and resume their routes',()=>{
 const s=setup(),a=ped(0,0),b=ped(0,1.3);s.ai.reset(a);s.ai.reset(b);a.ambient.nextEvent=b.ambient.nextEvent=0;
 s.run([a,b]);assert.equal(a.ambient.mode,'talk');assert.equal(b.ambient.mode,'talk');assert.equal(a.ambient.partner,b);assert.equal(a.vx,0);
 s.run([a,b],[],280);assert.equal(a.ambient.mode,'walk');assert.equal(b.ambient.mode,'walk');assert.equal(a.ambient.partner,null);
});
test('removed or reset conversation partners release the other participant',()=>{
 const s=setup(),a=ped(0,0),b=ped(0,1.3);s.ai.reset(a);s.ai.reset(b);a.ambient.nextEvent=b.ambient.nextEvent=0;s.run([a,b]);
 s.run([a]);assert.equal(a.ambient.mode,'walk');assert.equal(a.ambient.partner,null);
 a.ambient.mode=b.ambient.mode='talk';a.ambient.partner=b;b.ambient.partner=a;s.ai.reset(b);assert.equal(a.ambient.mode,'walk');assert.equal(a.ambient.partner,null);
});
test('greeting a nearby stationary player has a cooldown and does not prevent walking',()=>{
 const s=setup(),p=ped(0,0),player={x:2,z:0,vx:0,vz:0};s.run([p],[],1,player);assert.equal(p.ambient.mode,'greet');
 s.run([p],[],120,player);assert.equal(p.ambient.mode,'walk');assert.ok(p.x>1);
});
test('walkers leave personal space around a stationary on-foot player',()=>{
 const s=setup({safe:(p,x,z)=>Math.abs(z)<1}),p=ped(-3,0),player={x:0,z:0,vx:0,vz:0};let closest=Infinity;
 for(let i=0;i<350;i++){s.run([p],[],1,player);closest=Math.min(closest,Math.hypot(p.x-player.x,p.z-player.z));}
 assert.ok(closest>=.49,closest);assert.ok(p.x>1,p.x);
});
test('larger body radii retain enough space while walkers pass each other',()=>{
 const s=setup({safe:(p,x,z)=>Math.abs(z)<1}),a=ped(-3,0),b=ped(3,0,Math.PI);a.radius=b.radius=.36;let closest=Infinity;
 for(let i=0;i<320;i++){s.run([a,b]);closest=Math.min(closest,Math.hypot(a.x-b.x,a.z-b.z));}assert.ok(closest>=.71,closest);assert.ok(a.x>1&&b.x<-1);
});
test('blocked paths wait or turn back and do not cross the supplied collision boundary',()=>{
 const s=setup({safe:(p,x,z)=>x<=1&&Math.abs(z)<.3}),p=ped(0,0);p.walk={path:[{x:0,z:0},{x:1,z:0},{x:2,z:0}],i:0,dir:1};
 s.run([p],[],300);assert.ok(p.x<=1&&Math.abs(p.z)<.3);assert.ok(Number.isFinite(p.a));
});
test('a pedestrian overlapping a parked car can step out instead of remaining trapped',()=>{
 const s=setup(),p=ped(0,.9,Math.PI/2);s.run([p],[vehicle()],60);assert.ok(p.z>1.4,p.z);assert.equal(p.dn,0);
});
