const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../world-streaming.js'),'utf8').split('/* Reserve small garden hills')[0];
function fixture(mode='success'){
 const disposed=[],targets=[];
 class Group{constructor(){this.children=[];}add(o){this.children.push(o);}}
 class Mesh{constructor(geometry,material){Object.assign(this,{geometry,material});}dispose(){disposed.push(this);}}
 const THREE={Group,InstancedMesh:Mesh,Matrix4:class{},Quaternion:class{},Vector3:class{}};
 const scene={children:[],add(o){this.children.push(o);},remove(o){this.children.splice(this.children.indexOf(o),1);}};
 const ctx=vm.createContext({THREE,Map,Set,performance});vm.runInContext(source+';globalThis.Streamer=WorldStreamer;',ctx);
 const streamer=new ctx.Streamer(scene),material={uuid:'material',dispose(){throw Error('Shared material disposed');}},geometry={attributes:{normal:{itemSize:3}},dispose(){throw Error('Shared geometry disposed');}};
 const part={geometry,material,castShadow:true,receiveShadow:true};streamer.cells.set('0,0',{parts:new Map([['a',part],['b',part]])});streamer.cells.set('1,0',{parts:new Map([['c',{...part,geometry:{attributes:{color:{itemSize:4}}}}]])});
 const prior={name:'prior',texture:{encoding:3001}},target={name:'composer',texture:{encoding:3000}};let current=prior;
 const renderer={info:{programs:[]},outputEncoding:3001,getRenderTarget:()=>current,setRenderTarget(t){targets.push(t);current=t;},compile(scene){assert.equal(current,target);assert.equal(scene.children.length,1);assert.equal(scene.children[0].visible,false);assert.equal(scene.children[0].children.length,2);if(mode==='throw')throw Error('Driver error');this.info.programs.push({diagnostics:{runnable:mode!=='shader-error'}});}};
 return{streamer,renderer,scene,prior,target,disposed,targets};
}
test('preparation deduplicates styles, uses composer encoding and retains streaming state',()=>{
 const s=fixture(),before=JSON.stringify(s.streamer.stats),result=s.streamer.prepareMaterials(s.renderer,{},s.target);
 assert.equal(result.proxies,2);assert.equal(result.programsAfter,1);assert.equal(result.targetEncoding,3000);assert.equal(s.renderer.getRenderTarget(),s.prior);assert.equal(s.scene.children.length,0);assert.equal(s.disposed.length,2);assert.equal(JSON.stringify(s.streamer.stats),before);
});
test('driver exceptions restore the target and dispose proxies',()=>{
 const s=fixture('throw');assert.throws(()=>s.streamer.prepareMaterials(s.renderer,{},s.target),/Driver error/);assert.equal(s.renderer.getRenderTarget(),s.prior);assert.equal(s.scene.children.length,0);assert.equal(s.disposed.length,2);
});
test('a failed shader remains a preparation failure and cleans up',()=>{
 const s=fixture('shader-error');assert.throws(()=>s.streamer.prepareMaterials(s.renderer,{},s.target),/material compilation failed/);assert.equal(s.renderer.getRenderTarget(),s.prior);assert.equal(s.disposed.length,2);
});
