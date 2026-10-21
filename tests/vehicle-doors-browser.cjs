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
  await context.route('https://game.test/**',async route=>{const name=new URL(route.request().url()).pathname.slice(1);if(!name)return route.fulfill({body:source,contentType:'text/html'});if(/^[\w-]+\.(js|css)$/.test(name))return route.fulfill({body:await fs.readFile(path.join(root,name)),contentType:name.endsWith('css')?'text/css':'text/javascript'});return route.fulfill({status:204});});
  await context.route(/^https:\/\/(cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net)\//,async route=>{try{return await route.fulfill({body:await fs.readFile(path.join(root,'.test-tools/cdn-cache',new URL(route.request().url()).pathname.split('/').pop())),contentType:'text/javascript'});}catch{return route.continue();}});
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto('https://game.test/',{timeout:90000});await page.waitForFunction('gameplay?.passengerJobs');
  await fs.mkdir(artifacts,{recursive:true});
  const report=await page.evaluate(()=>{
   const check=window.doorCheck,g=gameplay;
   if(g.activity)g.finishActivity(false,'Door inspection');
   for(const v of cars){v.ai=null;v.o.visible=false;}
   const renderScene=()=>{const target=r.getRenderTarget();try{r.setRenderTarget(comp?.readBuffer||null);r.render(S,cam);}finally{r.setRenderTarget(target);}};
   const results=[],point=lanePoint(roads[0],Math.floor(roads[0].points.length/2),1,0);positionSun(point.x,point.z);
   const allVisible=mesh=>{for(let p=mesh;p;p=p.parent)if(!p.visible)return false;return true;};
   const ray=(v,side,y,meshes)=>{v.o.updateMatrixWorld(true);const spec=vehicleDoorSpec(v.t,v.n),x=(spec.front+spec.rear)/2;
    const origin=new THREE.Vector3(x,y,side*(v.t.W/2+1)).applyMatrix4(v.o.matrixWorld),direction=new THREE.Vector3(0,0,-side).transformDirection(v.o.matrixWorld);
    const r=new THREE.Raycaster(origin,direction,0,1.55);return r.intersectObjects(meshes.filter(allVisible),false);};
   const names=Object.keys(TY).filter(n=>n!=='Bike');
   for(const name of names){
    const v=cars.find(v=>v.n===name)||mkCar(name);car=v;Object.assign(v,{x:point.x,z:point.z,a:0,vx:0,vz:0});P.x=v.x;P.z=v.z;v.o.visible=true;v.o.position.set(v.x,worldElevation(v.x,v.z),v.z);v.o.rotation.set(0,0,0);v.detailsNear=true;updateScenery();
    const original=v.o.children.filter(m=>m.isMesh),originalGeometry=original.map(m=>m.geometry.uuid),visibleBefore=original.filter(m=>m.visible).length;
    const state=ensureVehicleDoors(v);check(state.sources.length>0,name+' needs moving original surfaces');
    check(original.every((m,i)=>m.geometry.uuid===originalGeometry[i]),name+' original geometry untouched');check(original.filter(m=>m.visible).length===visibleBefore,name+' closed visibility unchanged');
    const y=name==='Van'?1.1:.65;
    for(const side of[-1,1]){
     check(ray(v,side,y,state.sources.map(e=>e.source)).length>0,name+' closed skin exists '+side);
     const glazingY=name==='Van'?1.8:1.2;check(ray(v,side,glazingY,state.sources.filter(e=>e.source.material.transparent).map(e=>e.source)).length>0,name+' original glazing exists '+side);
     setVehicleDoor(v,side,side*1.12);updateScenery();
     const fixed=state.sources.map(e=>e.fixed).filter(Boolean),sideClosed=state.doors.get(-side).children;
     check(ray(v,side,y,fixed).length===0,name+' open body aperture '+side);check(ray(v,side,glazingY,fixed).length===0,name+' glass clears aperture '+side);
     check(ray(v,side,y,state.doors.get(side).children).length===0,name+' door moved away from aperture '+side);
     check(ray(v,-side,y,[...fixed,...sideClosed]).length>0,name+' opposite door stays closed '+side);
     check(state.sources.every(e=>!e.source.visible),name+' detail refresh preserves aperture');
     check(state.doors.get(side).children.some(m=>m.material.transparent),name+' glazing is on hinged door');
     setVehicleDoor(v,-side,-side*.7);check(state.angles.get(side)!==0&&state.angles.get(-side)!==0,name+' independent doors');setVehicleDoor(v,-side,0);setVehicleDoor(v,side,0);
     check(original.filter(m=>m.visible).length===visibleBefore,name+' closing restores original render');
    }
    const entries=vehicleDoorCache.size,children=v.o.children.length;
    for(let i=0;i<30;i++){setVehicleDoor(v,1,1);setVehicleDoor(v,1,0);}
    check(vehicleDoorCache.size===entries&&v.o.children.length===children,name+' reopen does not allocate geometry');
    setVehicleDoor(v,1,1);v.detailsNear=false;syncVehicleDoors(v);check(!state.root.visible&&state.sources.every(e=>!e.source.visible),name+' low detail hides high detail door');v.detailsNear=true;syncVehicleDoors(v);
    const entry=state.sources.find(e=>e.fixed);entry.source.rotation.z+=.015;entry.source.position.y-=.02;syncVehicleDoors(v);const expected=entry.source.matrix.clone().multiply(entry.partition.inverse);check(entry.fixed.matrix.elements.every((x,i)=>Math.abs(x-expected.elements[i])<1e-10),name+' fragments follow body damage');entry.source.rotation.z-=.015;entry.source.position.y+=.02;setVehicleDoor(v,1,0);
    cam.position.set(v.x+4.4,2.7,v.z+5);cam.lookAt(v.x+.3,1.1,v.z);renderScene();const closedCost={...r.info.render},programs=r.info.programs.length;
    setVehicleDoor(v,1,1.12);const start=performance.now();renderScene();const openingMs=performance.now()-start,openCost={...r.info.render};check(openingMs<1000,name+' opening stalls');check(r.info.programs.length===programs,name+' opening compiles shaders');
    check(openCost.calls-closedCost.calls<45&&openCost.triangles-closedCost.triangles<15000,name+' door render budget');setVehicleDoor(v,1,0);renderScene();check(r.info.render.calls===closedCost.calls&&r.info.render.triangles===closedCost.triangles,name+' closed door render cost restored');
    results.push({name,sources:state.sources.length,hingedMeshes:state.doors.get(1).children.length,openingMs,extraCalls:openCost.calls-closedCost.calls,extraTriangles:openCost.triangles-closedCost.triangles});v.o.visible=false;
   }
   window.inspectDoor=(name,side=1)=>{for(const v of cars)v.o.visible=false;const v=cars.find(v=>v.n===name);car=v;v.o.visible=true;v.detailsNear=true;setVehicleDoor(v,side,side*1.12);P.x=v.x;P.z=v.z;cam.position.set(v.x+4.4,2.7,v.z+side*5);cam.lookAt(v.x+.3,1.1,v.z);cam.fov=48;cam.updateProjectionMatrix();g.povCabin.visible=false;if(comp)comp.render();else r.render(S,cam);};
   return{models:results,cache:{...vehicleDoorStats},programs:r.info.programs.length};
  });
  for(const name of['Sedan','Honda Civic FD 2009','Van']){await page.evaluate(name=>inspectDoor(name),name);await page.screenshot({path:path.join(artifacts,'doors-'+name.replace(/\W+/g,'-')+'.png')});}
  assert.deepEqual(errors,[]);await fs.writeFile(path.join(artifacts,'vehicle-doors.json'),JSON.stringify(report,null,2));console.log('PASS real door apertures, hinged glazing, closed shape, LOD, damage and cache stability '+JSON.stringify(report));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
