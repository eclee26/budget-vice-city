// Exercise the production passenger state machine without a GPU or ambient randomness.
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const text=fs.readFileSync(path.join(__dirname,'../open-world.js'),'utf8');
function setup(){
 const v={n:'Sedan',x:10,z:10,a:0,dmg:0,vx:0,vz:0,ax:0,ay:0,t:{L:4.6,W:1.8},doors:new Map()},a={kind:'taxi',index:0,hold:0,elapsed:0,limit:240,targets:[{x:10,z:10,a:0,curb:{x:10,z:13,a:0}},{x:200,z:10,a:0,curb:{x:200,z:13,a:0}}]};
 const g={activity:a,completed:{},transition:null,sandbox:{stars:0,heat:0,crime(){}},notify(){},showTarget(){},save(){},clearFootprint:()=>true,door(v,side){if(!v.doors.has(side))v.doors.set(side,{visible:false,rotation:{y:0}});return v.doors.get(side);}};
 const c=vm.createContext({Math,vehicleDoorSpec:()=>({rear:0,front:v.t.L*.16}),setVehicleDoor(v,side,angle){const door=g.door(v,side);v.doorState={};door.visible=angle>.005;door.rotation.y=angle;},DT:1/60,car:v,cars:[v],P:{x:10,z:10},anim(){},tile:()=>0,worldElevation:()=>0,vehicleOverlap:()=>false});
 vm.runInContext(text.slice(text.indexOf('class PassengerJobs'))+';globalThis.Jobs=PassengerJobs;',c);
 const jobs=new c.Jobs(g);jobs.ensureActor=()=>{jobs.phase=0;jobs.actor={g:{visible:false,position:{x:0,z:0,set(x,y,z){Object.assign(this,{x,y,z});}},rotation:{set(){}}},tor:{rotation:{},scale:{y:1}},arms:[{sh:{rotation:{}},el:{rotation:{}}},{sh:{rotation:{}},el:{rotation:{}}}]};};
 jobs.seat=()=>{jobs.actor.seated=true;jobs.actor.g.visible=true;jobs.anchored=true;};g.finishActivity=(success,message)=>{g.result={success,message};g.activity=null;jobs.finish(a,success);};jobs.start(a);
 return{v,a,g,c,jobs,tick(n=1){for(let i=0;i<n&&g.activity;i++){a.elapsed+=1/60;jobs.update(a);}}};
}
test('boarding requires a continuous two-second curbside stop',()=>{
 const s=setup();s.tick(60);assert.equal(s.a.index,0);assert.equal(s.v.doors.get(1).visible,true);
 s.v.vx=1;s.tick();assert.equal(s.a.hold,0);assert.equal(s.v.doors.get(1).visible,false);assert.equal(s.jobs.actor.g.position.z,13);
 s.v.vx=0;s.tick(120);assert.equal(s.a.index,1);assert.equal(s.jobs.actor.seated,true);assert.equal(s.jobs.actor.g.visible,true);assert.equal(s.v.doors.get(1).visible,false);
});
test('blocked passenger walking space prevents boarding',()=>{
 const s=setup();s.g.clearFootprint=()=>false;s.tick(180);assert.equal(s.a.index,0);assert.equal(s.a.hold,0);assert.equal(s.jobs.actor.g.position.z,13);
});
test('comfort accounts for new onboard damage and sustained harsh driving',()=>{
 const s=setup();s.v.dmg=20;s.tick(120);assert.equal(s.a.passenger.comfort,100);
 s.v.dmg=25;s.tick();assert.ok(Math.abs(s.a.passenger.comfort-94)<1e-8);
 s.v.vx=12;s.v.ax=-9;s.tick(120);assert.ok(Math.abs(s.a.passenger.comfort-82)<1e-7);
 const damaged=s.a.passenger.comfort;s.v.vx=s.v.ax=0;s.tick(60);assert.equal(s.a.passenger.comfort,damaged);
});
test('zero comfort and serious pursuits fail without a successful handoff',()=>{
 const s=setup();s.tick(120);s.v.dmg=100;s.tick();assert.equal(s.g.result.success,false);assert.match(s.g.result.message,/dangerous/);assert.equal(s.jobs.actor.g.visible,false);
 const p=setup();p.g.sandbox.stars=2;p.tick();assert.equal(p.g.result.success,false);assert.equal(p.jobs.actor.g.visible,false);
});
test('hitting the waiting passenger fails the pickup and reports the collision',()=>{
 const s=setup();let reported=false;s.g.sandbox.crime=()=>reported=true;s.v.z=13;s.v.vx=3;s.tick();
 assert.equal(s.g.result.success,false);assert.match(s.g.result.message,/Passenger hit/);assert.equal(reported,true);assert.equal(s.jobs.actor.g.visible,false);
});
test('drop-off requires a stop, shows alighting and starts a bounded departure',()=>{
 const s=setup();s.tick(120);s.v.x=200;s.c.P.x=200;s.v.vx=3;s.tick(30);assert.equal(s.a.hold,0);
 s.v.vx=0;s.tick(60);assert.equal(s.jobs.actor.g.visible,true);assert.equal(s.g.activity,s.a);s.tick(60);assert.equal(s.g.result.success,true);assert.ok(s.jobs.departure);
 for(let i=0;i<361;i++)s.jobs.tick();assert.equal(s.jobs.departure,null);assert.equal(s.jobs.actor.g.visible,false);
});
test('fare rewards comfort and time without exceeding the advertised range',()=>{
 const s=setup();assert.equal(s.jobs.fare(s.a),750);s.a.elapsed=120;s.a.passenger.comfort=50;assert.equal(s.jobs.fare(s.a),550);s.a.elapsed=240;s.a.passenger.comfort=0;assert.equal(s.jobs.fare(s.a),350);
});
test('leaving the booked car closes the passenger door and clears the actor',()=>{
 const s=setup();s.tick(60);s.c.car=null;s.tick();assert.equal(s.g.result.success,false);assert.equal(s.v.doors.get(1).visible,false);assert.equal(s.jobs.actor.g.visible,false);
});
test('restoring an onboard ride preserves comfort and rejects invalid state',()=>{
 const s=setup();s.a.index=1;
 assert.equal(s.jobs.restore(s.a,{name:'Maya',vehicleName:'Sedan',comfort:62}),true);assert.equal(s.jobs.actor.seated,true);assert.equal(s.jobs.actor.g.visible,true);assert.equal(s.a.passenger.comfort,62);
 for(const comfort of [-1,0,101,Infinity,NaN,'100'])assert.equal(s.jobs.restore(s.a,{name:'Maya',vehicleName:'Sedan',comfort}),false);
 assert.equal(s.jobs.restore(s.a,{name:'Maya',vehicleName:'Bike',comfort:50}),false);
});
