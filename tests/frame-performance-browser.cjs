const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_DRIVER||'../.test-tools/Lib/site-packages/playwright/driver/package');
const root=path.resolve(__dirname,'..'),artifacts=path.join(root,'tests/artifacts'),args=process.argv.slice(2),ref=args.includes('--ref')?args[args.indexOf('--ref')+1]:null,label=args[0]||'current';const read=name=>ref?Promise.resolve(require('node:child_process').execFileSync('git',['show',ref+':'+name],{cwd:root})):fs.readFile(path.join(root,name));
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--enable-unsafe-swiftshader']});
 try{
  const context=await browser.newContext({viewport:{width:1280,height:800}}),page=await context.newPage(),errors=[];
  await context.addInitScript(()=>{window.doorCheck=(ok,message)=>{if(!ok)throw Error(message);};});
  const source=(await read('index.html')).toString('utf8').replace(/\r\n/g,'\n').replace('<script>\nconst T=10','<script>\nwindow.requestAnimationFrame=()=>0;let doorSeed=2026;Math.random=()=>{doorSeed=(Math.imul(doorSeed,1664525)+1013904223)>>>0;return doorSeed/4294967296};\nconst T=10');
  assert.ok(source.includes('window.requestAnimationFrame=()=>0'),'Deterministic fixture hook missing');
  await context.route('https://game.test/**',async route=>{const name=new URL(route.request().url()).pathname.slice(1);if(name==='assets/vehicles/1999_honda_civic_si.glb')return route.fulfill({body:await fs.readFile(path.join(root,name)),contentType:'model/gltf-binary'});if(!name)return route.fulfill({body:source,contentType:'text/html'});if(/^[\w-]+\.(js|css)$/.test(name))return route.fulfill({body:await read(name),contentType:name.endsWith('css')?'text/css':'text/javascript'});return route.fulfill({status:204});});
  await context.route(/^https:\/\/(cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net)\//,async route=>{try{return await route.fulfill({body:await fs.readFile(path.join(root,'.test-tools/cdn-cache',new URL(route.request().url()).pathname.split('/').pop())),contentType:'text/javascript'});}catch{return route.continue();}});
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto('https://game.test/',{timeout:90000});await page.waitForFunction('gameplay?.passengerJobs',null,{polling:50,timeout:60000});
  await fs.mkdir(artifacts,{recursive:true});
  const results=[],session=args.includes('--profile')?await context.newCDPSession(page):null;if(session)await session.send('Profiler.enable');
  for(const site of ['coast','downtown']){
   if(session)await session.send('Profiler.start');
   const result=await page.evaluate(site=>{
    const g=gameplay;graphics.mobile=false;g.settings.quality='high';g.settings.resolution=100;g.settings.pedestrians=64;g.settings.traffic=24;g.applySettings();
    const edge=site==='coast'?coastStart:roads.find(e=>e.a.x===340&&e.b.x===340&&e.a.z===165)||roads[0],p=lanePoint(edge,Math.floor(edge.points.length*.35));car=cars.find(v=>v.n==='Sedan');car.ai=null;Object.assign(car,{x:p.x,z:p.z,a:p.a,vx:0,vz:0,yr:0,dmg:0});Object.assign(P,{x:p.x,z:p.z,a:p.a});P.o.visible=false;ca=p.a;yo=0;pt=.2;camMode=0;cp.set(P.x-Math.cos(p.a)*11,4,P.z-Math.sin(p.a)*11);resetInput();for(let i=0;i<60;i++)step();worldStream.update(P.x,P.z,true);updateScenery();
    const render=()=>{g.interpolateVisual(.5);g.updatePovCabin();if(comp)comp.render();else r.render(S,cam);g.restoreVisual();};
    for(let i=0;i<8;i++)render();const gl=r.getContext();gl.finish();const original=r.info.autoReset;r.info.autoReset=false;const frames=[],simulation=[],rendering=[],calls=[],triangles=[];
    for(let i=0;i<60;i++){const start=performance.now();for(let k=0;k<2;k++){g.captureVisual();step();updParts();}const simEnd=performance.now();r.info.reset();render();gl.finish();const end=performance.now();frames.push(end-start);simulation.push(simEnd-start);rendering.push(end-simEnd);calls.push(r.info.render.calls);triangles.push(r.info.render.triangles);}
    r.info.autoReset=original;const stats=a=>{a.sort((a,b)=>a-b);return{median:a[Math.floor(a.length*.5)],p95:a[Math.floor(a.length*.95)],max:a[a.length-1]};};const ext=gl.getExtension('WEBGL_debug_renderer_info');
    return{site,frameMs:stats(frames),twoTicksMs:stats(simulation),renderAndGpuMs:stats(rendering),drawCalls:stats(calls),triangles:stats(triangles),width:r.domElement.width,height:r.domElement.height,cars:cars.length,peds:peds.length,cells:worldStream.active.size,renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER)};
   },site);if(session){const {profile}=await session.send('Profiler.stop');await fs.writeFile(path.join(artifacts,`frame-${label}-${site}.cpuprofile`),JSON.stringify(profile));const counts=new Map();for(const node of profile.nodes){const name=node.callFrame.functionName||'(anonymous)';counts.set(name,(counts.get(name)||0)+(node.hitCount||0));}console.log('PROFILE '+site+' '+JSON.stringify([...counts].sort((a,b)=>b[1]-a[1]).slice(0,18)));}results.push(result);console.log(JSON.stringify(result));
  }
  assert.deepEqual(errors,[]);await fs.writeFile(path.join(artifacts,`frame-performance-${label}.json`),JSON.stringify({reference:ref||'working-tree',samples:results,browserErrors:errors},null,2));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
