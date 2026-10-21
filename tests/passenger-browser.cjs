const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_DRIVER||'../.test-tools/Lib/site-packages/playwright/driver/package');
const root=path.resolve(__dirname,'..'),artifacts=path.join(root,'tests/artifacts');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--enable-unsafe-swiftshader']});
 try{
  const context=await browser.newContext({viewport:{width:1280,height:800}}),page=await context.newPage(),errors=[];
  await context.addInitScript(()=>{window.passengerCheck=(ok,message)=>{if(!ok)throw Error(message);};});
  const source=(await fs.readFile(path.join(root,'index.html'),'utf8')).replace(/\r\n/g,'\n').replace('<script>\nconst T=10','<script>\nwindow.requestAnimationFrame=()=>0;let passengerSeed=2026;Math.random=()=>{passengerSeed=(Math.imul(passengerSeed,1664525)+1013904223)>>>0;return passengerSeed/4294967296};\nconst T=10');
  assert.ok(source.includes('window.requestAnimationFrame=()=>0'),'Deterministic fixture hook missing');
  await context.route('https://game.test/**',async route=>{const name=new URL(route.request().url()).pathname.slice(1);if(name==='assets/vehicles/1999_honda_civic_si.glb')return route.fulfill({body:await fs.readFile(path.join(root,name)),contentType:'model/gltf-binary'});if(!name)return route.fulfill({body:source,contentType:'text/html'});if(/^[\w-]+\.(js|css)$/.test(name))return route.fulfill({body:await fs.readFile(path.join(root,name)),contentType:name.endsWith('css')?'text/css':'text/javascript'});return route.fulfill({status:204});});
  await context.route(/^https:\/\/(cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net)\//,async route=>{try{return await route.fulfill({body:await fs.readFile(path.join(root,'.test-tools/cdn-cache',new URL(route.request().url()).pathname.split('/').pop())),contentType:'text/javascript'});}catch{return route.continue();}});
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto('https://game.test/',{timeout:90000});await page.waitForFunction('gameplay?.passengerJobs',null,{polling:50});
  await fs.mkdir(artifacts,{recursive:true});
  await page.evaluate(()=>{
   window.passengerCheck=(ok,message)=>{if(!ok)throw Error(message);};const g=gameplay,s=g.sandbox;
   for(const v of cars)v.ai=null;
   car=cars.find(v=>v.n==='Bike')||mkCar('Bike');g.startActivity('taxi');passengerCheck(!g.activity,'Bike must be refused');
   car=cars.find(v=>v.n==='Kaze R');car.dmg=110;g.startActivity('taxi');passengerCheck(!g.activity,'Damaged car must be refused');
   car.dmg=92;g.startActivity('taxi');passengerCheck(!g.activity,'39 percent condition must be refused');car.dmg=90.4;g.startActivity('taxi');passengerCheck(g.activity?.kind==='taxi','Displayed 40 percent condition must be accepted');g.finishActivity(false,'Boundary check');
   car.dmg=0;s.heat=1;g.startActivity('taxi');passengerCheck(!g.activity,'Wanted driver must be refused');s.endPursuit();g.lastVehicle=car;P.x=car.x;P.z=car.z;P.o.visible=false;updateHud();
  });
  await page.keyboard.press('h');await page.locator('[data-pane="activities"]').click();await page.locator('[data-activity="taxi"]').click();
  const pickup=await page.evaluate(()=>{
   const g=gameplay,a=g.activity;passengerCheck(a?.kind==='taxi','Passenger job starts through menu');
   passengerCheck(a.targets.length===2&&a.targets.every(t=>g.passengerJobs.validTarget(t)&&tile(t.curb.x,t.curb.z)!==1),'Safe curbside participants');
   passengerCheck(Math.hypot(a.targets[1].x-a.targets[0].x,a.targets[1].z-a.targets[0].z)>=130,'Distinct destination');
   window.passengerCash=g.sandbox.cash;g.save();return JSON.parse(JSON.stringify(a.targets[0]));
  });
  await page.reload();await page.waitForFunction('gameplay?.passengerJobs',null,{polling:50});
  await page.evaluate(()=>{
   const g=gameplay,a=g.activity;passengerCheck(a?.kind==='taxi'&&a.index===0&&a.passenger.name==='Maya','Pickup stage restores');
   for(const v of cars)v.ai=null;
   window.passengerPlace=(index=gameplay.activity.index)=>{const t=gameplay.activity.targets[index],v=car;Object.assign(v,{x:t.x,z:t.z,a:t.a,vx:0,vz:0,yr:0,ax:0,ay:0});P.x=v.x;P.z=v.z;v.o.position.set(v.x,worldElevation(v.x,v.z),v.z);v.o.rotation.set(0,-v.a,0);updateScenery();updateHud();};
   window.passengerRender=()=>{const v=car,fx=Math.cos(v.a),fz=Math.sin(v.a);cam.position.set(v.x-fx*7-fz*4,3.2,v.z-fz*7+fx*4);cam.lookAt(v.x,1,v.z);gameplay.hud();if(comp)comp.render();else r.render(S,cam);};
   passengerPlace(0);car.vx=Math.cos(car.a)*4;car.vz=Math.sin(car.a)*4;for(let i=0;i<30;i++)g.updateActivity();passengerCheck(a.index===0&&a.hold===0,'Moving pickup refused');
   car.vx=car.vz=0;car.a+=Math.PI;for(let i=0;i<30;i++)g.updateActivity();passengerCheck(a.hold===0,'Wrong-facing pickup refused');car.a=a.targets[0].a;
   car.x=a.targets[0].curb.x;car.z=a.targets[0].curb.z;g.updateActivity();g.hud();passengerCheck(a.hold===0&&document.getElementById('activity-target').textContent.includes('path blocked'),'Blocked passenger path has actionable feedback');passengerPlace(0);
   g.updateActivity();passengerRender();
  });
  await page.screenshot({path:path.join(artifacts,'passenger-pickup.png')});
  await page.evaluate(()=>{for(let i=0;i<48;i++)gameplay.updateActivity();passengerCheck(gameplay.activity.index===0&&gameplay.passengerJobs.actor.g.visible&&car.doors.get(1).visible,'Visible boarding and right door');passengerRender();});
  await page.screenshot({path:path.join(artifacts,'passenger-boarding.png')});
  await page.evaluate(()=>{
   const g=gameplay,a=g.activity,elapsed=a.elapsed,hold=a.hold;openHelp();advanceSimulation(performance.now()+1000);passengerCheck(a.elapsed===elapsed&&a.hold===hold,'Menu pauses boarding and timer');help.close();
   for(let i=0;i<75;i++)g.updateActivity();passengerCheck(a.index===1&&g.passengerJobs.actor.seated&&g.passengerJobs.actor.g.visible&&!car.doors.get(1).visible,'Passenger boards and door closes');
   const comfort=a.passenger.comfort;car.dmg+=10;car.ax=-9;car.ay=7;car.vx=12;for(let i=0;i<120;i++)g.updateActivity();
   passengerCheck(a.passenger.comfort<comfort-20&&a.passenger.comfort>40,'Crashes/harsh driving reduce comfort');car.vx=car.vz=car.ax=car.ay=0;g.save();window.passengerSavedComfort=a.passenger.comfort;
  });
  const cabinChecks=await page.evaluate(()=>{
   const g=gameplay,j=g.passengerJobs,booked=car,motion=g.settings.motion,results=[];g.settings.motion=false;
   for(const name of Object.keys(TY).filter(n=>n!=='Bike')){
    let v=cars.find(v=>v.n===name);if(!v){v=mkCar(name);cars.push(v);}const oldPosition=v.o.position.clone(),oldQuaternion=v.o.quaternion.clone();
    car=v;j.vehicle=v;
    for(const heading of [0,Math.PI/2,2.7]){
     v.o.position.set(P.x,.12,P.z);v.o.rotation.set(.08,-heading,-.04);j.seat();v.o.updateMatrixWorld(true);j.actor.g.updateMatrixWorld(true);
     const inv=v.o.matrixWorld.clone().invert(),bounds=new THREE.Box3(),matrix=new THREE.Matrix4();
     j.actor.g.traverse(mesh=>{if(!mesh.isMesh||!mesh.visible)return;if(!mesh.geometry.boundingBox)mesh.geometry.computeBoundingBox();bounds.union(mesh.geometry.boundingBox.clone().applyMatrix4(matrix.multiplyMatrices(inv,mesh.matrixWorld)));});
     const layout=j.layout;passengerCheck(bounds.max.y<=layout.roof-.02,`${name}: head clips roof (${bounds.max.y})`);passengerCheck(bounds.min.y>=layout.floor-.025,`${name}: feet penetrate floor (${bounds.min.y})`);passengerCheck(bounds.min.z>0&&bounds.max.z<v.t.W*.43,`${name}: passenger crosses cabin side`);
     passengerCheck(j.actor.seated&&j.belt.visible&&!j.label.visible,'Seated belt/label state');
     for(const transfer of [0,.2,.45,.6,.8,1]){
      j.seat(transfer);j.actor.g.updateMatrixWorld(true);const poseBounds=new THREE.Box3();
      j.actor.g.traverse(mesh=>{if(mesh.isMesh&&mesh.visible){if(!mesh.geometry.boundingBox)mesh.geometry.computeBoundingBox();poseBounds.union(mesh.geometry.boundingBox.clone().applyMatrix4(matrix.multiplyMatrices(inv,mesh.matrixWorld)));}});
      passengerCheck(poseBounds.min.y>=-.01,`${name}: transfer feet penetrate road`);
      if(j.visualLocal.z<v.t.W*.38)passengerCheck(poseBounds.max.y<=layout.roof-.02,`${name}: transfer head clips roof`);
     }
     results.push({name,heading,top:bounds.max.y,feet:bounds.min.y,roof:layout.roof,floor:layout.floor});
    }
    v.o.position.copy(oldPosition);v.o.quaternion.copy(oldQuaternion);
   }
   car=booked;j.vehicle=booked;g.settings.motion=motion;j.seat();
   g.captureVisual();booked.o.position.x+=.5;booked.o.rotation.y-=.08;g.interpolateVisual(.5);g.updatePovCabin();
   const expected=j.visualLocal.clone().applyQuaternion(booked.o.quaternion).add(booked.o.position);passengerCheck(expected.distanceTo(j.actor.g.position)<1e-8,'Passenger follows interpolated car');passengerCheck(1-Math.abs(j.actor.g.quaternion.dot(booked.o.quaternion))<1e-8,'Passenger follows body roll/pitch');g.restoreVisual();booked.o.position.set(booked.x,worldElevation(booked.x,booked.z),booked.z);booked.o.rotation.set(0,-booked.a,0);g.updatePovCabin();
   camMode=3;yo=1.20;pt=.02;g.povCamera();g.updatePovCabin();booked.o.visible=false;passengerCheck(g.povCabin.visible&&j.actor.g.visible,'Passenger visible in POV');if(comp)comp.render();else r.render(S,cam);return results;
  });
  await page.screenshot({path:path.join(artifacts,'passenger-seated-pov.png')});
  const cabinCost=await page.evaluate(()=>{
   const g=gameplay,j=g.passengerJobs,head=j.actor.head.rotation.y,eyes=j.actor.eyes.map(e=>e.scale.y);openHelp();advanceSimulation(performance.now()+1000);g.updatePovCabin();passengerCheck(j.actor.head.rotation.y===head&&j.actor.eyes.every((e,i)=>e.scale.y===eyes[i]),'Pause holds rider face pose');help.close();
   const oldReset=r.info.autoReset;r.info.autoReset=false;
   const measure=visible=>{j.actor.g.visible=visible;r.info.reset();if(comp)comp.render();else r.render(S,cam);return{calls:r.info.render.calls,triangles:r.info.render.triangles};};
   const hidden=measure(false),visible=measure(true);r.info.autoReset=oldReset;
   passengerCheck(visible.calls-hidden.calls<=70&&visible.triangles-hidden.triangles<10000,'Single rider render budget');return{hidden,visible,additionalCalls:visible.calls-hidden.calls,additionalTriangles:visible.triangles-hidden.triangles};
  });
  await page.evaluate(()=>{camMode=2;gameplay.updatePovCabin();passengerCheck(gameplay.povCabin.visible,'Occupied cockpit has interior context');camMode=0;yo=0;pt=.2;car.o.visible=true;gameplay.updatePovCabin();passengerRender();});
  await page.screenshot({path:path.join(artifacts,'passenger-seated-exterior.png')});
  const saved=await page.evaluate(()=>({comfort:gameplay.activity.passenger.comfort,cash:gameplay.sandbox.cash}));
  await page.reload();await page.waitForFunction('gameplay?.passengerJobs',null,{polling:50});
  await page.evaluate(saved=>{
   const g=gameplay,a=g.activity;passengerCheck(a?.kind==='taxi'&&a.index===1&&g.passengerJobs.actor.seated&&g.passengerJobs.actor.g.visible&&Math.abs(a.passenger.comfort-saved.comfort)<1e-6,'Riding stage/comfort restore');
   for(const v of cars)v.ai=null;
   const t=a.targets[1];Object.assign(car,{x:t.x,z:t.z,a:t.a,vx:0,vz:0,yr:0,ax:0,ay:0});P.x=t.x;P.z=t.z;car.o.position.set(t.x,0,t.z);car.o.rotation.set(0,-t.a,0);updateScenery();updateHud();
   for(let i=0;i<60;i++)g.updateActivity();passengerCheck(a.index===1&&g.passengerJobs.actor.g.visible,'Visible drop-off before payout');
   cam.position.set(t.x-Math.cos(t.a)*7-Math.sin(t.a)*4,3.2,t.z-Math.sin(t.a)*7+Math.cos(t.a)*4);cam.lookAt(t.x,1,t.z);g.hud();if(comp)comp.render();else r.render(S,cam);
  },saved);
  await page.screenshot({path:path.join(artifacts,'passenger-dropoff.png')});
  const completed=await page.evaluate(saved=>{
   const g=gameplay;for(let i=0;i<62;i++)g.updateActivity();const cash=g.sandbox.cash,paid=cash-saved.cash;
   passengerCheck(!g.activity&&g.result.success&&g.completed.taxi===1&&paid>=350&&paid<750,'Graded payout');g.finishActivity(true,'duplicate');passengerCheck(g.sandbox.cash===cash,'Reward paid once');
   const actor=g.passengerJobs.actor.g.uuid,texture=g.passengerJobs.labelTexture.uuid;for(let i=0;i<361;i++)g.passengerJobs.tick();passengerCheck(!g.passengerJobs.actor.g.visible,'Passenger leaves after drop-off');
   return{paid,comfort:saved.comfort,actor,texture,cash};
  },saved);
  await page.evaluate(completed=>{
   const g=gameplay;car.dmg=0;g.sandbox.endPursuit();g.startActivity('taxi');passengerCheck(g.activity?.passenger.name==='Jonas','Next passenger changes');passengerCheck(g.passengerJobs.actor.g.uuid===completed.actor&&g.passengerJobs.labelTexture.uuid===completed.texture,'Actor and label resources reused');
   passengerCheck(!g.passengerJobs.actor.longHair.visible&&g.passengerJobs.outfitParts.shirt[0].material===mat(PassengerJobs.outfits[1].shirt),'Passenger outfit/hair change without mutating shared colors');
   g.finishActivity(false,'Cancelled');passengerCheck(!g.passengerJobs.actor.g.visible&&g.sandbox.cash===completed.cash,'Cancel cleans up without fare');
   g.startActivity('taxi');g.activity.elapsed=239.999;g.updateActivity();passengerCheck(!g.activity&&!g.result.success,'Timeout');
   g.startActivity('taxi');g.sandbox.heat=2;g.updateActivity();passengerCheck(!g.activity&&!g.result.success,'Serious pursuit fails job');g.sandbox.endPursuit();
   g.startActivity('taxi');g.recoverVehicle();passengerCheck(!g.activity&&!g.result.success,'Recovery ends job');
   g.startActivity('taxi');const v=car;car=null;g.updateActivity();passengerCheck(!g.activity&&!g.result.success,'Leaving booked car ends job');car=v;g.lastVehicle=v;
   g.startActivity('taxi');g.activity.passenger.comfort=999;g.save();
  },completed);
  await page.reload();await page.waitForFunction('gameplay?.passengerJobs',null,{polling:50});
  assert.ok(await page.evaluate(()=>!gameplay.activity&&gameplay.result?.message.includes('invalid')),'Corrupt passenger save is rejected');
  await page.evaluate(()=>{for(const v of cars)v.ai=null;car.dmg=0;gameplay.sandbox.endPursuit();gameplay.startActivity('taxi');gameplay.hud();});
  for(const [width,height]of [[390,844],[320,740],[844,390]]){
   await page.setViewportSize({width,height});
   const layout=await page.evaluate(()=>{enableTouch();rs();updateHud();if(comp)comp.render();else r.render(S,cam);const rect=id=>{const r=document.getElementById(id).getBoundingClientRect();return{x:r.x,y:r.y,right:r.right,bottom:r.bottom};};return{hud:rect('activity-hud'),map:rect('mm'),stick:rect('stick'),pedals:rect('pedals'),player:rect('h'),direction:document.getElementById('target-direction').hidden?null:rect('target-direction')};});
   const h=layout.hud,overlaps=b=>h.x<b.right&&h.right>b.x&&h.y<b.bottom&&h.bottom>b.y;
   await page.screenshot({path:path.join(artifacts,`passenger-mobile-${width}x${height}.png`)});
   assert.ok(h.x>=0&&h.y>=0&&h.right<=width+.1&&h.bottom<=height+.1,`HUD in bounds ${width}`);
   for(const id of ['map','stick','pedals','player'])assert.ok(!overlaps(layout[id]),`Mission HUD overlaps ${id} at ${width}x${height}: ${JSON.stringify(layout)}`);
   if(layout.direction){const d=layout.direction;assert.ok(d.x>=h.x&&d.right<=h.right&&d.y>=h.y&&d.bottom<=h.bottom,'Navigation hint remains inside activity panel');}
  }
  assert.deepEqual(errors,[]);await fs.writeFile(path.join(artifacts,'passenger-review.json'),JSON.stringify({pickup,saved,completed,cabinChecks,cabinCost,transferPoses:cabinChecks.length*6,layouts:[[390,844],[320,740],[844,390]],browserErrors:errors},null,2));
  console.log('PASS passenger mission: route, actor/doors, driving grade, payout, reload, failures, resource reuse and touch layouts');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
