const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../imported-civic.js'),'utf8');
function setup({protocol='http:',fetch:request,setTimeout:timer=setTimeout,clearTimeout:clear=clearTimeout}={}){
 const context=vm.createContext({URL,DataView,AbortController,location:{protocol},document:{baseURI:'http://city.test/game/index.html',getElementById:()=>({textContent:''})},fetch:request,setTimeout:timer,clearTimeout:clear});
 vm.runInContext(source+';globalThis.civic=ImportedCivic;',context);return context;
}
test('direct disk opening explains how to use the local server without attempting a blocked fetch',async()=>{
 const c=setup({protocol:'file:',fetch:()=>{throw Error('Should not fetch');}});assert.equal(await c.civic.load(),false);assert.match(c.civic.failureMessage(),/localhost:8000/);assert.equal(c.civic.error,'Civic file URL');
});
test('a missing local model reports the HTTP status and server restart/rebuild guidance',async()=>{
 const c=setup({fetch:async()=>({ok:false,status:404})});assert.equal(await c.civic.load(),false);assert.match(c.civic.failureMessage(),/404/);assert.match(c.civic.failureMessage(),/Restart/);
});
test('an HTML catch-all response is identified before it reaches the model decoder',async()=>{
 const c=setup({fetch:async()=>({ok:true,arrayBuffer:async()=>new TextEncoder().encode('<!doctype html>').buffer})});assert.equal(await c.civic.load(),false);assert.match(c.civic.failureMessage(),/returned a page/);
});
test('valid binary requests respect the hosted subdirectory and work without AbortSignal.timeout',async()=>{
 let called;const data=new ArrayBuffer(12);new DataView(data).setUint32(0,0x46546c67,true);
 const c=setup({fetch:async(url,options)=>{called={url,options};return{ok:true,arrayBuffer:async()=>data};}});assert.equal(await c.civic.readModel(),data);assert.equal(called.url,'http://city.test/game/assets/vehicles/1999_honda_civic_si.glb');assert.ok(called.options.signal instanceof AbortSignal);
});
test('connection failure keeps the original cause available in the model loading details',async()=>{
 const c=setup({fetch:async()=>{throw new TypeError('Failed to fetch');}});assert.equal(await c.civic.load(),false);assert.equal(c.civic.error,'Failed to fetch');assert.match(c.civic.failureMessage(),/Menu → Vehicle/);
});
test('a stalled download is aborted and reports a retryable timeout',async()=>{
 let expire;const c=setup({setTimeout:fn=>{expire=fn;return 1;},clearTimeout:()=>{},fetch:(_url,{signal})=>new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>reject(Error('Aborted'))))});const loaded=c.civic.load();expire();assert.equal(await loaded,false);assert.match(c.civic.failureMessage(),/timed out/);
});
