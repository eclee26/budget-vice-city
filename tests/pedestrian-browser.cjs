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
  const behavior=await page.evaluate(()=>{
   const check=window.doorCheck,g=gameplay;
   const path=sidewalkRoutes.find(path=>path.length>60&&path.slice(25,35).every(q=>pedestrianAI.world.safe({x:q.x,z:q.z},q.x,q.z)));check(path,'Safe long sidewalk fixture');
   window.ambientPath=path;window.ambientOriginalPeds=[...peds];for(const p of peds)p.o.visible=false;
   const [a,b]=peds;peds.splice(0,peds.length,a,b);const point=path[30],fx=Math.cos(point.a),fz=Math.sin(point.a);window.ambientPoint=point;
   for(const v of cars){v.ai=null;v.x=v.z=-500;v.vx=v.vz=0;v.o.visible=false;}car=null;P.x=point.x+30;P.z=point.z+30;P.o.visible=false;
   for(const [p,along,dir]of[[a,0,1],[b,1.3,-1]]){Object.assign(p,{x:point.x+fx*along,z:point.z+fz*along,a:point.a+(dir<0?Math.PI:0),dn:0,fl:0});p.walk={path,i:30,dir};p.o.visible=true;pedestrianAI.reset(p);p.ambient.nextEvent=0;}
   for(let i=0;i<90;i++)pedestrianAI.tick(peds,cars,null,DT);
   check(a.ambient.mode==='talk'&&b.ambient.partner===a,'Natural paired conversation');
   for(const [p,q]of[[a,b],[b,a]])check(Math.cos(Math.atan2(q.z-p.z,q.x-p.x)-p.a)>.97,'Conversation facing');
   check(a.H.arms[a.ambient.id%2].el.rotation.z>.7,'Visible hand gesture');
   window.ambientRender=(focus=a)=>{positionSun(focus.x,focus.z);P.x=focus.x;P.z=focus.z;updateScenery();cam.position.set(focus.x-fx*4-fz*4,2.8,focus.z-fz*4+fx*4);cam.lookAt(focus.x,1.2,focus.z);cam.fov=48;cam.updateProjectionMatrix();if(comp)comp.render();else r.render(S,cam);};ambientRender();
   return{routeLength:path.length,conversation:true,facing:true};
  });
  await page.screenshot({path:path.join(artifacts,'pedestrians-conversation.png')});
  const reactions=await page.evaluate(()=>{
   const check=window.doorCheck,g=gameplay,[a,b]=peds,point=ambientPoint,fx=Math.cos(point.a),fz=Math.sin(point.a);
   const oldTime=pedestrianAI.time,oldPose=a.H.arms[0].el.rotation.z;help.showModal();advanceSimulation(performance.now()+1000);check(pedestrianAI.time===oldTime&&a.H.arms[0].el.rotation.z===oldPose,'Menu pauses behavior and gestures');help.close();
   pedestrianAI.resume(a);pedestrianAI.resume(b);b.x+=20;b.z+=20;P.x=point.x+30;P.z=point.z+30;
   const v=cars.find(v=>v.n==='Sedan')||mkCar('Sedan');Object.assign(v,{x:a.x-fx*5,z:a.z-fz*5,a:point.a,vx:0,vz:0});car=v;g.lastHorn=-1000;g.horn();check(a.ambient.lookUntil>pedestrianAI.time,'Horn control reaches pedestrian behavior');
   pedestrianAI.tick(peds,cars,null,DT);check(a.H.arms[1].el.rotation.z>1,'Horn startle pose');
   car=null;Object.assign(v,{x:a.x-fx*8,z:a.z-fz*8,vx:fx*8,vz:fz*8});pedestrianAI.tick(peds,cars,null,DT);check(a.ambient.mode==='flee','Nonplayer approaching car prompts escape');
   for(let i=0;i<45;i++){pedestrianAI.tick(peds,cars,null,DT);check(!solid(a.x,a.z)&&!inMask(asphaltMask,a.x,a.z),'Escape stays on safe pavement');}
   v.x=v.z=-500;v.vx=v.vz=0;for(let i=0;i<150;i++)pedestrianAI.tick(peds,cars,null,DT);check(a.ambient.mode==='walk'&&a.walk.path===ambientPath,'Walking route survives escape');
   Object.assign(a,{x:point.x,z:point.z,a:point.a,dn:0,fl:0});pedestrianAI.reset(a);Object.assign(v,{x:a.x+fz*(v.t.W/2+.8),z:a.z-fx*(v.t.W/2+.8),a:point.a,vx:fx*5,vz:fz*5});pedestrianAI.tick(peds,cars,null,DT);check(!a.dn&&a.ambient.mode!=='flee','Parallel car beside sidewalk causes no false hit or panic');
   v.x=a.x;v.z=a.z;pedestrianAI.tick(peds,cars,null,DT);check(a.dn>0,'Actual footprint collision knocks pedestrian down');v.x=v.z=-500;v.vx=v.vz=0;const from={x:a.x,z:a.z};for(let i=0;i<402;i++)pedestrianAI.tick(peds,cars,null,DT);check(!a.dn&&a.ambient.mode==='recover'&&Math.hypot(a.x-from.x,a.z-from.z)<4,'Pedestrian gets up in place');ambientRender(a);
   return{paused:true,horn:true,trafficPrediction:true,safeEscape:true,routeResumed:true,noFalseHit:true,recoveryInPlace:true};
  });
  await page.screenshot({path:path.join(artifacts,'pedestrians-recovery.png')});
  await page.reload();await page.waitForFunction('gameplay?.sandbox',null,{polling:50});
  const performanceReport=await page.evaluate(()=>{
   const check=window.doorCheck,g=gameplay;g.settings.pedestrians=128;g.settings.traffic=48;g.applyPopulation();const before={geometries:r.info.memory.geometries,textures:r.info.memory.textures,programs:r.info.programs.length};
   const samples=[],states=new Set();for(let i=0;i<1800;i++){const start=performance.now();pedestrianAI.tick(peds,cars,null,DT);samples.push(performance.now()-start);for(const p of peds)states.add(p.ambient.mode);}
   samples.sort((a,b)=>a-b);const median=samples[Math.floor(samples.length*.5)],p95=samples[Math.floor(samples.length*.95)];check(median<8&&p95<16,'Ambient CPU budget: '+JSON.stringify({median,p95}));
   check(states.has('walk')&&(states.has('look')||states.has('stretch')),'Natural idle events occur during sustained walking');
   check(peds.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.z)&&!solid(p.x,p.z)),'Population positions finite and outside solids');
   for(let i=0;i<3;i++){g.settings.pedestrians=0;g.applyPopulation();g.settings.pedestrians=128;g.applyPopulation();}
   check(peds.every(p=>p.ambient.mode==='walk'&&!p.ambient.partner),'Reused actors reset social state');
   return{pedestrians:peds.length,traffic:cars.filter(v=>v.ai).length,medianMs:median,p95Ms:p95,maxMs:Math.max(...samples),states:[...states],resourcesBefore:before,resourcesAfter:{geometries:r.info.memory.geometries,textures:r.info.memory.textures,programs:r.info.programs.length}};
  });
  assert.deepEqual(errors,[]);const report={behavior,reactions,performance:performanceReport,browserErrors:errors};await fs.writeFile(path.join(artifacts,'pedestrian-review.json'),JSON.stringify(report,null,2));console.log('PASS ambient conversations, traffic/horn responses, pause, recovery, pooling and CPU budget '+JSON.stringify(report));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
