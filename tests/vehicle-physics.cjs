// Run with: node --test tests/vehicle-physics.cjs (no packages required).
// Exercise the production model on a flat, obstacle-free road, without WebGL.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
const source=html.slice(html.indexOf('const TY='),html.indexOf('const lit='))+html.slice(html.indexOf('const G9='),html.indexOf('function step()'));
function model(surface=1){
 const c=vm.createContext({Math,PI:Math.PI,R:()=>.5,tile:()=>surface,solid:()=>false,hurt:()=>{},sparks:()=>{},car:null,shake:0});
 vm.runInContext(source+';globalThis.types=TY;globalThis.tick=phys;',c);
 return c;
}
function vehicle(c,speed=0,type='Sedan'){
 return {t:c.types[type],n:type,x:0,z:0,a:0,vx:speed,vz:0,st:0,roll:0,pitch:0,dmg:0,ai:null};
}
function speed(v){return Math.hypot(v.vx,v.vz)}
function stop(c){const v=vehicle(c,100/3.6);let ticks=0;while(speed(v)>.1&&ticks<600){c.tick(v,0,1,0,false);ticks++}return {distance:v.x,v,ticks}}
test('sedan accelerates and brakes within ordinary dry-road passenger-car ranges',()=>{
 const c=model(),v=vehicle(c);let ticks=0;while(speed(v)<100/3.6&&ticks<1200){c.tick(v,1,0,0,false);ticks++}
 assert.ok(ticks/60>7&&ticks/60<12,`0–100 km/h: ${ticks/60}s`);
 const braking=stop(c);assert.ok(braking.distance>32&&braking.distance<45,`100–0 km/h: ${braking.distance}m`);assert.ok(speed(braking.v)<.1);assert.ok(braking.v.vx>=0);
 console.log(`Sedan: 0–100 km/h ${(ticks/60).toFixed(2)}s; 100–0 km/h ${braking.distance.toFixed(2)}m`);
});
test('front-wheel drive retains steering under acceleration and settles after release',()=>{
 const c=model(),v=vehicle(c,10);for(let i=0;i<60;i++)c.tick(v,1,0,.7,false);
 assert.ok(v.a>.36&&v.a<.8,`heading after 1s: ${v.a}`);assert.ok(speed(v)>10);
 for(let i=0;i<180;i++)c.tick(v,.2,0,0,false);
 assert.ok(Math.abs(v.yr)<.04,`yaw after releasing steering: ${v.yr}`);assert.ok(Math.abs(v.roll)<.01);
});
test('reverse selects at rest, accelerates backward and reverses steering direction',()=>{
 const c=model(),v=vehicle(c);for(let i=0;i<120;i++)c.tick(v,0,1,0,false);
 assert.equal(v.g,-1);assert.ok(v.vx<-.5);const angle=v.a;
 for(let i=0;i<30;i++)c.tick(v,0,1,.5,false);assert.ok(v.a<angle);
});
test('Civics have usable engine curves and the SiR trades low-RPM torque for high-RPM power',()=>{
 const c=model(),fd=c.types['Honda Civic FD 2009'],fb=c.types['Honda Civic FB 2013'],sir=c.types['Honda Civic SiR 1997'];
 assert.ok(fd&&fb&&sir);assert.ok(c.torqueAt(fd,2000)>c.torqueAt(sir,2000));assert.ok(c.torqueAt(fb,2000)>c.torqueAt(sir,2000));
 const power=t=>Math.max(...Array.from({length:100},(_,i)=>{const rpm=900+(t.red-900)*i/99,torque=c.torqueAt(t,rpm);assert.ok(Number.isFinite(torque)&&torque>0);return torque*rpm/9549}));
 assert.ok(power(sir)>power(fd));assert.ok(sir.red>fd.red&&sir.m<fd.m);
 const times=[];for(const name of['Honda Civic FD 2009','Honda Civic FB 2013','Honda Civic SiR 1997']){const v=vehicle(c,0,name);let ticks=0;while(speed(v)<100/3.6&&ticks<1200){c.tick(v,1,0,0,false);ticks++}assert.ok(ticks/60>6&&ticks/60<13,`${name}: acceleration out of range`);times.push(ticks)}
 assert.ok(times[2]<times[0]&&times[2]<times[1]);
});
test('parked vehicles stay still and lower-grip ground increases stopping distance',()=>{
 const c=model(),v=vehicle(c);for(let i=0;i<600;i++)c.tick(v,0,0,0,true);
 assert.equal(v.x,0);assert.equal(v.z,0);assert.equal(speed(v),0);
 assert.ok(stop(model(0)).distance>stop(model()).distance*1.2);
});
test('all vehicle types remain finite through acceleration, turns and handbraking',()=>{
 const c=model();for(const name of Object.keys(c.types)){
  const v=vehicle(c,0,name);for(let i=0;i<1200;i++){
   c.tick(v,i<900?.7:0,i>=900?1:0,Math.sin(i/90)*.65,i>700&&i<740);
   for(const field of ['x','z','a','vx','vz','yr','st','roll','pitch','rpm'])assert.ok(Number.isFinite(v[field]),`${name}: ${field}`);
   assert.ok(speed(v)<100,`${name}: unrealistic speed`);assert.ok(Math.abs(v.yr)<8,`${name}: unstable yaw`);
  }
 }
});
test('forward, reverse and glancing wall impacts emit effects without stopping physics',()=>{
 for(const name of Object.keys(model().types))for(const direction of[-1,1])for(const sideSpeed of[0,7]){
  const c=model(),v=vehicle(c,direction*20,name),wall=v.t.L/2+.1,effects=[];
  v.vz=sideSpeed;c.car=v;c.solid=(x)=>direction*x>=wall;
  c.hurt=(car,impact)=>{car.dmg+=impact*2.2};c.sparks=(...args)=>effects.push(args);
  c.tick(v,0,0,0,false);
  assert.ok(v.dmg>0,`${name}: collision must apply damage`);
  assert.equal(effects.length,1,`${name}: collision must emit sparks`);
  assert.equal(Math.sign(effects[0][0]-v.x),direction,`${name}: sparks must appear at the struck end`);
  assert.ok(effects[0].every(Number.isFinite));assert.ok(c.shake>0);
  for(let i=0;i<120;i++)c.tick(v,0,0,0,false);
  for(const field of['x','z','a','vx','vz','yr'])assert.ok(Number.isFinite(v[field]),`${name}: ${field} after collision`);
 }
});
const clockSource=html.slice(html.indexOf('let simLast='),html.indexOf('(function loop(now='));
function clock(){const c=model(),v=vehicle(c);let ticks=0;
 Object.assign(c,{performance:{now:()=>0},help:{open:false},document:{hidden:false},step:()=>{c.tick(v,1,0,0,false);ticks++},updParts:()=>{},ambient:()=>{},mini:()=>{}});
 vm.runInContext(clockSource,c);return{c,v,count:()=>ticks};
}
test('30, 60 and 144 FPS produce identical 10-second driving results',()=>{
 const results=[];for(const fps of[30,60,144]){const run=clock();for(let i=1;i<=fps*10;i++)run.c.advanceSimulation(i*1000/fps);assert.equal(run.count(),600);results.push(run.v)}
 for(const v of results.slice(1)){assert.ok(Math.abs(v.x-results[0].x)<1e-8);assert.ok(Math.abs(v.vx-results[0].vx)<1e-8)}
});
test('Help, hidden tabs and long frame gaps do not fast-forward the simulation',()=>{
 const run=clock();run.c.advanceSimulation(1000/60);assert.equal(run.count(),1);
 run.c.help.open=true;run.c.advanceSimulation(5000);assert.equal(run.count(),1);
 run.c.help.open=false;run.c.advanceSimulation(5000+1000/60);assert.equal(run.count(),2);
 run.c.document.hidden=true;run.c.advanceSimulation(20000);assert.equal(run.count(),2);
 run.c.document.hidden=false;run.c.advanceSimulation(30000);assert.ok(run.count()<=8);
});
