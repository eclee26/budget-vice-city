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
   const g=gameplay,s=g.story,check=window.doorCheck;check(s.sites,'Authored sites available');
   for(const v of cars){v.ai=null;v.vx=v.vz=0;}car=null;P.o.visible=true;
   window.storyPlace=p=>{P.x=p.x;P.z=p.z+1.3;P.o.position.set(P.x,worldElevation(P.x,P.z),P.z);P.a=-Math.PI/2;P.o.rotation.y=-P.a;updateScenery();s.syncVisual();g.hud();};
   window.storyView=p=>{storyPlace(p);positionSun(P.x,P.z);cam.position.set(p.x+5,3.1,p.z+6);cam.lookAt(p.x,1,p.z);cam.fov=48;cam.updateProjectionMatrix();if(comp)comp.render();else r.render(S,cam);};
   window.storyIDs=[...s.contacts.map(c=>c.H.g.uuid),s.case.uuid,s.ring.uuid];
   storyPlace(s.sites.contact);return s.sites;
  });
  await page.keyboard.press('q');assert.equal(await page.locator('#controls-help').evaluate(e=>e.open),true);
  await page.screenshot({path:path.join(artifacts,'story-briefing.png')});
  await page.locator('#story-careful').click();
  await page.evaluate(()=>{doorCheck(gameplay.story.active.stage==='collect','Offer accepted through UI');storyView(gameplay.story.sites.pickup);});
  await page.screenshot({path:path.join(artifacts,'story-pickup.png')});
  await page.keyboard.press('q');
  await page.evaluate(()=>{
   const g=gameplay,s=g.story;doorCheck(s.carrying&&s.case.parent===P.H.body,'Visible carried controller');P.o.updateMatrixWorld(true);for(const [i,arm]of P.H.arms.entries()){const hand=new THREE.Vector3(0,-.29,0).applyMatrix4(arm.el.matrixWorld),grip=new THREE.Vector3(0,.20,(i?1:-1)*.11).applyMatrix4(s.case.matrixWorld);doorCheck(hand.distanceTo(grip)<.15,'Hands reach case handle '+hand.distanceTo(grip));}g.startActivity('courier');doorCheck(!g.activity,'Story excludes repeatable jobs');
   const v=cars.find(v=>v.n==='Kaze R');window.storyCar=v;
   const point=roads.flatMap(rd=>rd.points).find(p=>g.clearFootprint({x:p.x,z:p.z,a:0},{L:9,W:7})&&Math.hypot(p.x-s.sites.pickup.x,p.z-s.sites.pickup.z)<250&&!cars.some(o=>o!==v&&Math.hypot(o.x-p.x,o.z-p.z)<10));doorCheck(point,'Clear loading site');
   Object.assign(v,{x:point.x,z:point.z,a:0,dmg:0,vx:0,vz:0});v.o.position.set(v.x,worldElevation(v.x,v.z),v.z);v.o.rotation.set(0,0,0);v.o.visible=true;
   const exit=g.exitPoint(v,-1);doorCheck(exit,'Clear front door');storyPlace({x:exit.x,z:exit.z-1.3});g.act();doorCheck(!g.transition&&!car,'Cannot enter holding cargo');
   storyView({x:s.rear(v).x,z:s.rear(v).z-1.3});
  });
  await page.screenshot({path:path.join(artifacts,'story-carry.png')});
  await page.keyboard.press('q');
  await page.evaluate(()=>{
   const g=gameplay,s=g.story,v=storyCar;doorCheck(s.active.stage==='drive'&&s.vehicle===v&&g.lastVehicle===v,'Loading books vehicle');doorCheck(s.case.parent===S,'Loaded cargo leaves hands');
   const exit=g.exitPoint(v,-1);storyPlace({x:exit.x,z:exit.z-1.3});g.act();doorCheck(g.transition,'Actual entry starts');for(let i=0;i<60;i++)g.beforeStep();doorCheck(car===v&&!g.transition,'Entry finishes');
   const old={x:v.x,z:v.z};k.w=1;for(let i=0;i<30;i++)step();delete k.w;doorCheck(Math.hypot(v.x-old.x,v.z-old.z)>.05,'Loaded car moves under real throttle');v.vx=v.vz=v.ax=v.ay=0;const before=s.active.elapsed;openHelp();advanceSimulation(performance.now()+1000);doorCheck(s.active.elapsed===before,'Briefing pauses timer');help.close();
   v.dmg=10;s.tick();doorCheck(Math.abs(s.active.integrity-78)<.01,'Crash damages controller');g.save();
  });
  await page.reload();await page.waitForFunction('gameplay?.story',null,{polling:50});
  await page.evaluate(()=>{
   const g=gameplay,s=g.story;doorCheck(s.active?.stage==='drive'&&s.vehicle===car&&s.active.integrity===78,'Loaded mission/car/condition restores');
   for(const v of cars){v.ai=null;v.vx=v.vz=0;}const v=car,p=s.sites.parking;Object.assign(v,{x:p.x,z:p.z,a:p.a,vx:0,vz:0,ax:0,ay:0});v.o.position.set(v.x,worldElevation(v.x,v.z),v.z);v.o.rotation.set(0,-v.a,0);P.x=v.x;P.z=v.z;s.tick();doorCheck(s.active.stage==='unload','Stopped car reaches clinic');g.act();doorCheck(g.transition,'Actual exit starts');for(let i=0;i<60;i++)g.beforeStep();doorCheck(!car&&!g.transition,'Actual exit finishes');
   const rear=s.rear(v);P.x=rear.x;P.z=rear.z;P.o.position.set(P.x,worldElevation(P.x,P.z),P.z);s.syncVisual();g.hud();
  });
  await page.keyboard.press('q');
  await page.evaluate(()=>{doorCheck(gameplay.story.active.stage==='deliver'&&gameplay.story.carrying,'Unloaded by Q');gameplay.save();});
  await page.reload();await page.waitForFunction('gameplay?.story',null,{polling:50});
  const report=await page.evaluate(()=>{
   const g=gameplay,s=g.story;doorCheck(s.active?.stage==='deliver'&&!car,'Carried handoff restores');s.syncVisual();doorCheck(s.case.parent===P.H.body,'Carried prop restores');
   window.storyCash=g.sandbox.cash;const p=s.sites.doctor;P.x=p.x;P.z=p.z+1.3;P.o.position.set(P.x,worldElevation(P.x,P.z),P.z);P.o.visible=true;updateScenery();positionSun(P.x,P.z);cam.position.set(p.x+5,3.1,p.z+6);cam.lookAt(p.x,1,p.z);s.syncVisual();g.hud();if(comp)comp.render();else r.render(S,cam);return{sites:null,integrity:s.active.integrity};
  });
  await page.screenshot({path:path.join(artifacts,'story-clinic.png')});
  await page.keyboard.press('q');
  report.reward=await page.evaluate(()=>{const g=gameplay,s=g.story;doorCheck(!s.active&&s.run.completed&&s.run.result.success,'Clinic handoff completes');const reward=s.run.result.reward;doorCheck(g.sandbox.cash===storyCash+reward&&reward===1134,'Condition-adjusted payment');s.settle();doorCheck(g.sandbox.cash===storyCash+reward,'Settlement idempotent');return reward;});
  await page.reload();await page.waitForFunction('gameplay?.story',null,{polling:50});
  await page.evaluate(()=>{const s=gameplay.story;doorCheck(s.run.completed&&!s.active,'Completion restores');const cash=gameplay.sandbox.cash;s.settle();doorCheck(gameplay.sandbox.cash===cash,'Reload never repays');const ids=[...s.contacts.map(c=>c.H.g.uuid),s.case.uuid,s.ring.uuid];for(let i=0;i<3;i++){s.run.start('urgent');s.finish(false,'cancelled');}doorCheck(JSON.stringify(ids)===JSON.stringify([...s.contacts.map(c=>c.H.g.uuid),s.case.uuid,s.ring.uuid]),'Retries reuse actors, prop and marker');s.run.start('careful');s.guide=true;gameplay.hud();});
  report.layouts=[];
  for(const viewport of [{width:320,height:740},{width:390,height:844},{width:844,height:390}]){
   await page.setViewportSize(viewport);await page.evaluate(()=>{enableTouch();rs();const s=gameplay.story,p=s.sites.pickup;P.x=p.x;P.z=p.z+1.3;s.syncVisual();gameplay.hud();});
   report.layouts.push(await page.evaluate(()=>{const el=document.getElementById('story-action'),b=el.getBoundingClientRect();doorCheck(!el.hidden&&b.width>=44&&b.height>=44&&b.left>=0&&b.right<=innerWidth&&b.bottom<=innerHeight,'Touch mission action fits viewport');const h=document.getElementById('activity-hud').getBoundingClientRect();for(const id of ['h','mm','stick','pedals']){const o=document.getElementById(id).getBoundingClientRect();doorCheck(!(h.x<o.right&&h.right>o.x&&h.y<o.bottom&&h.bottom>o.y),'Mission panel clears '+id+' '+innerWidth+' '+JSON.stringify({hud:{x:h.x,y:h.y,w:h.width,h:h.height},other:{x:o.x,y:o.y,w:o.width,h:o.height}}));}return{width:innerWidth,height:innerHeight,button:{x:b.x,y:b.y,width:b.width,height:b.height}};}));
   await page.screenshot({path:path.join(artifacts,`story-mobile-${viewport.width}x${viewport.height}.png`)});
  }
  assert.deepEqual(errors,[]);report.sites=initial;await fs.writeFile(path.join(artifacts,'story-mission.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
