const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const c=vm.createContext({Math,Number});vm.runInContext(fs.readFileSync(path.join(__dirname,'../story-mission.js'),'utf8').split('class StoryMission')[0]+';globalThis.Run=LastLightState;',c);
const context={onFoot:true,near:true,stopped:true,atClinic:true,clear:true,eligible:true,vehicle:{name:'Sedan',damage:0}};
function loaded(mode='careful'){const r=new c.Run();r.start(mode);r.act('pickup',context);r.act('load',context);return r;}
const drive=(r,extra={})=>r.tick({stars:0,vehicle:{damage:0},driving:true,atClinic:false,stopped:false,speed:10,ax:0,ay:0,...extra},1/60);
test('both offers have distinct deadlines and bounded advertised pay',()=>{
 const careful=loaded(),urgent=loaded('urgent');assert.equal(c.Run.modes.careful.limit,600);assert.equal(c.Run.modes.urgent.limit,360);
 for(const r of[careful,urgent]){drive(r,{atClinic:true,stopped:true});r.act('unload',context);r.act('handoff',context);}assert.equal(careful.result.reward,1200);assert.equal(urgent.result.reward,1500);
});
test('pickup, loading and handoff cannot skip the connected objective sequence',()=>{
 const r=new c.Run();r.start('careful');assert.equal(r.act('handoff',context),false);assert.equal(r.act('load',context),false);
 assert.equal(r.act('pickup',{...context,onFoot:false}),false);assert.equal(r.act('pickup',{...context,near:false}),false);assert.equal(r.active.stage,'collect');
 assert.equal(r.act('pickup',context),true);assert.equal(r.act('load',{...context,stopped:false}),false);assert.equal(r.act('load',{...context,eligible:false}),false);assert.equal(r.act('load',context),true);assert.equal(r.active.stage,'drive');
 assert.equal(r.act('unload',context),false);drive(r,{atClinic:true,stopped:true});assert.equal(r.active.stage,'unload');assert.equal(r.act('unload',{...context,atClinic:false}),false);assert.equal(r.act('unload',context),true);assert.equal(r.act('handoff',{...context,clear:false}),false);assert.equal(r.act('handoff',context),true);
});
test('moving away from the clinic requires parking again',()=>{
 const r=loaded();drive(r,{atClinic:true,stopped:true});assert.equal(r.active.stage,'unload');drive(r);assert.equal(r.active.stage,'drive');
});
test('fresh vehicle damage and sustained harsh driving reduce cargo exactly once',()=>{
 const r=loaded();drive(r,{vehicle:{damage:10},ax:-9,ay:7});const first=r.active.integrity;assert.ok(first<78&&first>77);drive(r,{vehicle:{damage:10},ax:0,ay:0});assert.equal(r.active.integrity,first);
 for(let i=0;i<60;i++)drive(r,{vehicle:{damage:10},ax:-9,ay:7});assert.ok(r.active.integrity<first-1);assert.ok(r.active.integrity>0);
});
test('timeout, pursuit, destroyed cargo, disabled engine and lost car fail without pay',()=>{
 for(const [reason,context]of[['pursuit',{stars:2}],['cargo',{vehicle:{damage:60}}],['engine',{vehicle:{damage:151}}],['lost',{vehicle:null}]]){const r=loaded();drive(r,context);assert.equal(r.active,null);assert.equal(r.result.reason,reason);assert.equal(r.result.reward,0);}
 const r=loaded();r.active.elapsed=599.999;drive(r);assert.equal(r.result.reason,'timeout');assert.equal(r.result.reward,0);
});
test('the carried controller no longer inherits damage from the parked car',()=>{
 const r=loaded();drive(r,{atClinic:true,stopped:true});r.act('unload',context);drive(r,{vehicle:{damage:200}});assert.equal(r.active.stage,'deliver');assert.equal(r.active.integrity,100);
});
test('completion pays once and replays never create another payment',()=>{
 const r=loaded();drive(r,{atClinic:true,stopped:true});r.act('unload',context);r.act('handoff',context);assert.equal(r.result.reward,1200);assert.equal(r.finish(true,'delivered'),false);
 r.start('urgent');r.act('pickup',context);r.act('load',context);drive(r,{atClinic:true,stopped:true});r.act('unload',context);r.act('handoff',context);assert.equal(r.result.reward,0);assert.equal(r.completed,true);
});
test('every active stage restores its canonical progress, timer and cargo condition',()=>{
 for(const stage of['collect','carry','drive','unload','deliver']){const r=loaded();r.active.stage=stage;r.active.elapsed=52;r.active.integrity=73;const restored=new c.Run();assert.equal(restored.restore(r.snapshot()),true);assert.equal(restored.active.stage,stage);assert.equal(restored.active.elapsed,52);assert.equal(restored.active.integrity,73);}
});
test('completed progress survives reload without generating a new reward',()=>{
 const r=loaded();drive(r,{atClinic:true,stopped:true});r.act('unload',context);r.act('handoff',context);const restored=new c.Run();assert.equal(restored.restore(r.snapshot()),true);assert.equal(restored.completed,true);assert.equal(restored.active,null);restored.start('urgent');assert.equal(restored.completed,true);
});
test('malformed saves clear active progress instead of retaining an old mission',()=>{
 for(const patch of[{stage:'paid'},{mode:'free'},{elapsed:Infinity},{elapsed:-1},{elapsed:600},{integrity:101},{integrity:0},{lastDamage:NaN},{vehicleName:null}]){const r=loaded(),data=r.snapshot();Object.assign(data.active,patch);assert.equal(r.restore(data),false);assert.equal(r.active,null);}
});
