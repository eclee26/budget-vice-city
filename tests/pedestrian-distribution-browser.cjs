const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_DRIVER||'../.test-tools/Lib/site-packages/playwright/driver/package');
const root=path.resolve(__dirname,'..'),artifacts=path.join(root,'tests/artifacts');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--enable-unsafe-swiftshader']});
 try{
  const context=await browser.newContext({viewport:{width:1280,height:800}}),page=await context.newPage(),errors=[];
  await context.addInitScript(()=>{window.doorCheck=(ok,message)=>{if(!ok)throw Error(message);};});
  const source=(await fs.readFile(path.join(root,'index.html'),'utf8')).replace(/\r\n/g,'\n').replace('<script>\nconst T=10','<script>\nwindow.requestAnimationFrame=()=>0;let doorSeed=2026;Math.random=()=>{doorSeed=(Math.imul(doorSeed,1664525)+1013904223)>>>0;return doorSeed/4294967296};\nconst T=10');
  assert.ok(source.includes('window.requestAnimationFrame=()=>0'),'Deterministic fixture hook missing');
  await context.route('https://game.test/**',async route=>{const name=new URL(route.request().url()).pathname.slice(1);if(name==='assets/vehicles/1999_honda_civic_si.glb')return route.fulfill({body:await fs.readFile(path.join(root,name)),contentType:'model/gltf-binary'});if(!name)return route.fulfill({body:source,contentType:'text/html'});if(/^[\w-]+\.(js|css)$/.test(name))return route.fulfill({body:await fs.readFile(path.join(root,name)),contentType:name.endsWith('css')?'text/css':'text/javascript'});return route.fulfill({status:204});});
  await context.route(/^https:\/\/(cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net)\//,async route=>{try{return await route.fulfill({body:await fs.readFile(path.join(root,'.test-tools/cdn-cache',new URL(route.request().url()).pathname.split('/').pop())),contentType:'text/javascript'});}catch{return route.continue();}});
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto('https://game.test/',{timeout:90000});await page.waitForFunction('gameplay?.passengerJobs',null,{polling:50});
  await fs.mkdir(artifacts,{recursive:true});
  const initial=await page.evaluate(()=>{
   const check=window.doorCheck;updateScenery();positionSun(P.x,P.z);const a=P.a;cam.position.set(P.x-Math.cos(a)*10,3.5,P.z-Math.sin(a)*10);cam.lookAt(P.x+Math.cos(a)*18,1.5,P.z+Math.sin(a)*18);cam.updateProjectionMatrix();
   const count=d=>peds.filter(p=>Math.hypot(p.x-P.x,p.z-P.z)<d).length;check(count(70)>=24&&count(95)>=48,'Active neighborhood is populated');
   window.populationRender=()=>{r.info.autoReset=false;r.info.reset();if(comp)comp.render();else r.render(S,cam);const stats={...r.info.render};r.info.autoReset=true;return stats;};
   const render=populationRender();check(render.calls<2300&&render.triangles<2200000,'Populated scene rendering budget');return{total:peds.length,near40:count(40),near70:count(70),near95:count(95),render,crowd:{...pedestrianCrowd.stats},programs:r.info.programs.length};
  });
  await page.screenshot({path:path.join(artifacts,'pedestrian-distribution-after.png')});
  const parity=await page.evaluate(()=>{
   const check=window.doorCheck;for(const v of cars){v.ai=null;v.vx=v.vz=0;}for(let i=0;i<120;i++)pedestrianAI.tick(peds,cars,null,DT);
   for(const [i,mode]of ['stretch','greet','recover'].entries())pedestrianAI.world.pose(peds[i],{...peds[i].ambient,mode,until:pedestrianAI.time+.45},0,0,pedestrianAI.time);
   const gl=r.getContext(),read=()=>{const pixels=new Uint8Array(r.domElement.width*r.domElement.height*4);gl.readPixels(0,0,r.domElement.width,r.domElement.height,gl.RGBA,gl.UNSIGNED_BYTE,pixels);return pixels;};
   pedestrianCrowd.setEnabled(false);const original=populationRender(),before=read();pedestrianCrowd.setEnabled(true);const upload=gl.bufferSubData;let uploadBytes=0,uploadCalls=0;gl.bufferSubData=function(...args){const source=args[2];uploadBytes+=args.length>=5?(args[4]||source.length-(args[3]||0))*(source.BYTES_PER_ELEMENT||1):source?.byteLength||0;uploadCalls++;return upload.apply(this,args);};const batched=populationRender(),after=read();gl.bufferSubData=upload;check(uploadBytes<300000,'Crowd uploads only active instance ranges: '+uploadBytes);
   let difference=0,changed=0;for(let i=0;i<before.length;i+=4){let maximum=0;for(let j=0;j<3;j++){const d=Math.abs(before[i+j]-after[i+j]);difference+=d;maximum=Math.max(maximum,d);}if(maximum>6)changed++;}
   const meanError=difference/(before.length/4*3),changedFraction=changed/(before.length/4);check(meanError<1&&changedFraction<.02,'Batched appearance differs: '+JSON.stringify({meanError,changedFraction}));
   check(original.calls-batched.calls>200,'Crowd batching reduces draw submissions');const offsets=new Map(),matrix=new THREE.Matrix4(),color=new THREE.Color();let checked=0;
   for(const p of peds)if(p.o.visible)for(const source of pedestrianCrowd.parts(p)){if(!source.visible)continue;const mesh=source.mesh,batch=pedestrianCrowd.batches.get(mesh.geometry),index=offsets.get(batch)||0;batch.getMatrixAt(index,matrix);batch.getColorAt(index,color);offsets.set(batch,index+1);check(matrix.elements.every((v,i)=>Math.abs(v-mesh.matrixWorld.elements[i])<.00004),'Original joint transform preserved');check(Math.max(Math.abs(color.r-mesh.material.color.r),Math.abs(color.g-mesh.material.color.g),Math.abs(color.b-mesh.material.color.b))<1e-6,'Original linear color preserved');checked++;}
   const samples=[];for(let i=0;i<120;i++){const start=performance.now();pedestrianCrowd.update(peds);samples.push(performance.now()-start);}samples.sort((a,b)=>a-b);return{original,batched,meanError,changedFraction,checkedParts:checked,uploadBytes,uploadCalls,medianUploadMs:samples[60]};
  });
  const travel=await page.evaluate(()=>{
   const check=window.doorCheck,identities=new Set(peds),results=[];for(const v of cars){v.ai=null;v.vx=v.vz=0;}car=null;P.o.visible=false;
   const points=[[350,120],[350,370],[150,360],[125,35]],count=d=>peds.filter(p=>Math.hypot(p.x-P.x,p.z-P.z)<d).length;let verifiedMoves=0;
   for(const [x,z]of points){const candidates=roads.flatMap(e=>e.points.filter((p,i)=>i%8===0)),focus=candidates.reduce((best,p)=>Math.hypot(p.x-x,p.z-z)<Math.hypot(best.x-x,best.z-z)?p:best);P.x=focus.x;P.z=focus.z;cam.position.set(P.x-10,4,P.z-8);cam.lookAt(P.x+20,1.4,P.z+12);cam.updateProjectionMatrix();updateScenery();
    for(let tick=0;tick<420;tick++){pedestrianPopulation.tick(peds,cars,P,DT);for(const move of pedestrianPopulation.stats.lastMoved){check(Math.hypot(move.from.x-P.x,move.from.z-P.z)>145,'Original actor was far outside draw range');check(pedestrianPopulation.hidden(move.to,P),'New position outside rendered view');check(Math.hypot(move.to.x-P.x,move.to.z-P.z)>=55,'No close appearance');verifiedMoves++;}pedestrianAI.tick(peds,cars,null,DT);if(tick%12===0)updateScenery();}
    check(count(125)>=40&&count(95)>=18,'Neighborhood refills during travel: '+JSON.stringify({x:P.x,z:P.z,near95:count(95),near125:count(125)}));check(peds.every(p=>identities.has(p)&&!solid(p.x,p.z)),'Reuses clear resident actors');positionSun(P.x,P.z);worldStream.update(P.x,P.z,true);populationRender();results.push({x:P.x,z:P.z,near70:count(70),near95:count(95),near125:count(125)});
   }
   const before=pedestrianPopulation.stats.recycled,positions=peds.map(p=>[p.x,p.z]);help.showModal();advanceSimulation(performance.now()+1000);check(pedestrianPopulation.stats.recycled===before&&peds.every((p,i)=>p.x===positions[i][0]&&p.z===positions[i][1]),'Menus pause neighborhood recycling');help.close();
   return{neighborhoods:results,verifiedMoves,actorCount:identities.size};
  });
  await page.screenshot({path:path.join(artifacts,'pedestrian-distribution-travel.png')});
  const pooling=await page.evaluate(()=>{
   const check=window.doorCheck,g=gameplay;g.settings.pedestrians=128;g.applyPopulation();populationRender();const ids=new Set(peds),buffers=[...pedestrianCrowd.batches.values()].map(b=>({mesh:b.uuid,matrix:b.instanceMatrix,color:b.instanceColor,capacity:b.instanceMatrix.count}));
   check(peds.length===128,'Maximum population available');for(let i=0;i<3;i++){g.settings.pedestrians=0;g.applyPopulation();populationRender();check(pedestrianCrowd.stats.actors===0&&[...pedestrianCrowd.batches.values()].every(b=>b.count===0),'Zero density leaves no ghost instances');g.settings.pedestrians=128;g.applyPopulation();populationRender();check(peds.every(p=>ids.has(p)),'Reuses actor rigs');}
   check([...pedestrianCrowd.batches.values()].every((b,i)=>b.uuid===buffers[i].mesh&&b.instanceMatrix===buffers[i].matrix&&b.instanceColor===buffers[i].color&&b.instanceMatrix.count===buffers[i].capacity),'Reuses fixed crowd buffers');
   return{maximum:peds.length,crowd:{...pedestrianCrowd.stats},buffers:buffers.map(b=>b.capacity),programs:r.info.programs.length};
  });
  assert.deepEqual(errors,[]);const report={initial,parity,travel,pooling,browserErrors:errors};await fs.writeFile(path.join(artifacts,'pedestrian-distribution.json'),JSON.stringify(report,null,2));console.log('PASS local residents, hidden recycling, pixel/pose parity, draw submissions, pause and buffer reuse '+JSON.stringify(report));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
