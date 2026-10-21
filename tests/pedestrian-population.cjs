const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const c=vm.createContext({Math,Map,Set,performance});vm.runInContext(fs.readFileSync(path.join(__dirname,'../pedestrian-ai.js'),'utf8')+';globalThis.Population=PedestrianPopulation;',c);
function setup(extra={}){
 let seed=2026,resets=0;const routes=[];for(let z=-90;z<=90;z+=12)routes.push(Array.from({length:121},(_,i)=>({x:i*2-120,z,a:0})));
 const world={routes,freeSites:[],random:()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;},drawRange:()=>95,prepareView(){},visible:p=>p.x>0,safe:()=>true,reset(p){resets++;p.ambient={mode:'walk'};},...extra};
 const population=new c.Population(world);return{population,world,get resets(){return resets;}};
}
const ped=(x=500,z=500)=>({x,z,o:{visible:false},ambient:{mode:'walk'},dn:0,fl:0});
test('initial residents concentrate locally with clear personal space and valid route state',()=>{
 const s=setup(),peds=[];for(let i=0;i<64;i++){const p=ped();peds.push(p);assert.ok(s.population.place(p,peds,[],{x:0,z:0},{initial:true}));}
 assert.equal(s.resets,64);assert.ok(peds.every(p=>Math.hypot(p.x,p.z)<=95&&Math.hypot(p.x,p.z)>=8));assert.ok(peds.filter(p=>Math.hypot(p.x,p.z)<70).length>=20);
 for(const p of peds){assert.equal(p.walk.path[p.walk.i].x,p.x);assert.ok(p.walk.dir===1||p.walk.dir===-1);for(const q of peds)if(p!==q)assert.ok(Math.hypot(p.x-q.x,p.z-q.z)>=1.15);}
});
test('live additions stay distant and outside view or beyond the draw range',()=>{
 const s=setup(),peds=[];for(let i=0;i<32;i++){const p=ped();peds.push(p);assert.ok(s.population.place(p,peds,[],{x:0,z:0}));assert.ok(Math.hypot(p.x,p.z)>=55);assert.ok(p.x<=0||Math.hypot(p.x,p.z)>102);}
});
test('unsafe terrain, cars and occupied sites are rejected without changing the actor',()=>{
 const s=setup({safe:()=>false}),p=ped(500,500);assert.equal(s.population.place(p,[p],[],{x:0,z:0}),false);assert.equal(p.x,500);assert.equal(p.z,500);assert.equal(s.resets,0);
 const v={x:0,z:0,a:0,t:{L:1000,W:1000}},t=setup();assert.equal(t.population.place(p,[p],[v],{x:0,z:0}),false);
});
test('recycling keeps the same actors and limits work to three attempts per interval',()=>{
 const s=setup(),peds=Array.from({length:20},(_,i)=>ped(400,i*3)),identities=[...peds];s.population.tick(peds,[],{x:0,z:0},.25);
 assert.equal(s.population.stats.recycled,3);assert.equal(s.population.stats.lastMoved.length,3);assert.ok(peds.every((p,i)=>p===identities[i]));
 assert.ok(s.population.stats.lastMoved.every(m=>Math.hypot(m.from.x,m.from.z)>145&&Math.hypot(m.to.x,m.to.z)>=55));
});
test('nearby, actually visible, injured, frightened and social residents are preserved',()=>{
 const s=setup({drawRange:()=>250,visible:()=>true}),near=ped(30,0),visible=ped(160,0),down=ped(350,0),flee=ped(350,3),talk=ped(350,6),recover=ped(350,9);
 visible.o.visible=true;down.dn=100;flee.fl=60;talk.ambient.partner={};recover.ambient.mode='recover';const peds=[near,visible,down,flee,talk,recover],before=peds.map(p=>[p.x,p.z]);
 s.population.tick(peds,[],{x:0,z:0},.25);assert.equal(s.population.stats.recycled,0);assert.deepEqual(peds.map(p=>[p.x,p.z]),before);
});
test('recycling uses simulation time and has no work before its interval',()=>{
 const s=setup(),p=ped();s.population.tick([p],[],{x:0,z:0},.1);s.population.tick([p],[],{x:0,z:0},.1);assert.equal(p.x,500);assert.equal(s.resets,0);
 s.population.tick([p],[],{x:0,z:0},.05);assert.equal(s.resets,1);
});
test('a fully blocked neighborhood keeps retry work bounded',()=>{
 let checked=0;const s=setup({safe(){checked++;return false;}}),peds=Array.from({length:128},(_,i)=>ped(500,i));s.population.tick(peds,[],{x:0,z:0},.25);
 assert.equal(s.population.stats.rejected,3);assert.ok(checked<=1152,checked);assert.equal(s.population.stats.recycled,0);
});
test('an empty site inventory fails without loops or invalid coordinates',()=>{
 const s=setup({routes:[],freeSites:[]}),p=ped();assert.equal(s.population.place(p,[p],[],{x:0,z:0},{initial:true}),false);assert.equal(p.x,500);
});

test('mobile replenishment can use hidden sites inside its shorter draw range',()=>{
 const s=setup({drawRange:()=>65}),peds=[];for(let i=0;i<16;i++){const p=ped();peds.push(p);assert.ok(s.population.place(p,peds,[],{x:0,z:0}));assert.ok(Math.hypot(p.x,p.z)>=45);}
 assert.ok(peds.filter(p=>Math.hypot(p.x,p.z)<65).length>=8);
});
test('placement checks the selected resident body radius at the candidate site',()=>{
 let checked=false;const s=setup({safe(site,resident){assert.equal(resident.radius,.35);checked=true;return true;}}),p=ped();p.radius=.35;assert.ok(s.population.place(p,[p],[],{x:0,z:0},{initial:true}));assert.ok(checked);
});
