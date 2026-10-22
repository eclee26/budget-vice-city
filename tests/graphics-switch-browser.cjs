/* Diagnose synchronous GL work while changing presets. Includes every measured frame. */
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_DRIVER||'../.test-tools/Lib/site-packages/playwright/driver/package');
const args=process.argv.slice(2),live=args.includes('--live'),mobile=args.includes('--mobile'),recordOnly=args.includes('--record-only');
const root=path.resolve(__dirname,'..'),label=args.find(a=>!a.startsWith('--'))||'current';
if(!/^[a-z0-9-]+$/i.test(label))throw Error('Use a simple alphanumeric report label');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--enable-unsafe-swiftshader']});
 try{
  const viewport=mobile?{width:390,height:844}:{width:1280,height:720};
  const context=await browser.newContext({viewport,hasTouch:mobile,isMobile:mobile,deviceScaleFactor:mobile?2:1}),page=await context.newPage(),errors=[];
  const source=(await fs.readFile(path.join(root,'index.html'),'utf8')).replace(/\r\n/g,'\n').replace('<script>\nconst T=10',`<script>\n${live?'':'window.requestAnimationFrame=()=>0;'}let graphicsSeed=2026;Math.random=()=>{graphicsSeed=(Math.imul(graphicsSeed,1664525)+1013904223)>>>0;return graphicsSeed/4294967296};\nconst T=10`);
  assert.ok(source.includes('let graphicsSeed=2026'),'Seeded fixture hook missing');
  assert.equal(source.includes('window.requestAnimationFrame=()=>0'),!live,'Render-loop fixture mode mismatch');
  await context.route('https://game.test/**',async route=>{const name=new URL(route.request().url()).pathname.slice(1);if(name==='assets/vehicles/1999_honda_civic_si.glb')return route.fulfill({body:await fs.readFile(path.join(root,name)),contentType:'model/gltf-binary'});if(!name)return route.fulfill({body:source,contentType:'text/html'});if(/^[\w-]+\.(js|css)$/.test(name))return route.fulfill({body:await fs.readFile(path.join(root,name)),contentType:name.endsWith('css')?'text/css':'text/javascript'});return route.fulfill({status:204});});
  await context.route(/^https:\/\/(cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net)\//,async route=>{const file=path.join(root,'.test-tools','cdn-cache',new URL(route.request().url()).pathname.split('/').pop());try{return await route.fulfill({body:await fs.readFile(file),contentType:'text/javascript'});}catch{return route.continue();}});
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto('https://game.test/',{timeout:90000});await page.waitForFunction('gameplay?.sandbox',null,{polling:50});
  const cdp=await context.newCDPSession(page);if(!live){await cdp.send('Profiler.enable');await cdp.send('Profiler.start');}
  await page.evaluate(live=>{
   window.glTimings={};window.slowGL=[];window.graphicsStage='setup';
   const gl=r.getContext();for(const name of live?[]:['compileShader','linkProgram','getProgramParameter','getShaderParameter','getProgramInfoLog','getShaderInfoLog','getUniformLocation','bufferData','texImage2D','texSubImage2D','drawElements','drawArrays']){
    const original=gl[name];if(!original)continue;glTimings[name]={count:0,totalMs:0,maxMs:0};
    gl[name]=function(...args){const start=performance.now();try{return original.apply(this,args);}finally{const ms=performance.now()-start,entry=glTimings[name];entry.count++;entry.totalMs+=ms;entry.maxMs=Math.max(entry.maxMs,ms);if(ms>20)slowGL.push({stage:graphicsStage,name,ms,parameter:name==='getProgramParameter'?args[1]:undefined});}};
   }
   const edge=roads.find(e=>e.a.x===340&&e.b.x===340&&e.a.z===165)||roads[0],p=lanePoint(edge,Math.floor(edge.points.length*.35));
   car=cars.find(v=>v.n==='Sedan');car.ai=null;Object.assign(car,{x:p.x,z:p.z,a:p.a,vx:0,vz:0,yr:0,dmg:0});Object.assign(P,{x:p.x,z:p.z,a:p.a});ca=p.a;yo=0;pt=.2;camMode=0;P.o.visible=false;cp.set(P.x-Math.cos(p.a)*11,4,P.z-Math.sin(p.a)*11);
   worldStream.update(P.x,P.z,true);updateScenery();
   window.graphicsStats=()=>{const gl=r.getContext(),ext=gl.getExtension('WEBGL_debug_renderer_info');return{programs:r.info.programs.length,geometries:r.info.memory.geometries,textures:r.info.memory.textures,cells:worldStream.active.size,shadowUpdates:sun.shadow.autoUpdate,shadowMap:!!sun.shadow.map,shadowSize:sun.shadow.mapSize.x,shadowBias:sun.shadow.bias,shaderErrorsEnabled:r.debug.checkShaderErrors,renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER)};};
   if(live)openHelp();
  },live);
  const stages=[];
  for(const quality of ['high','low','medium','high','low']){
   const result=live?await page.evaluate(quality=>new Promise(resolve=>{
    const frames=[],start=performance.now();let last=start;
    const sample=now=>{graphics.frameDirty=true;frames.push(now-last);last=now;if(now-start<3000){requestAnimationFrame(sample);return;}const sorted=[...frames].sort((a,b)=>a-b);resolve({quality,applyMs,frames,maxFrameMs:Math.max(...frames),fps:frames.length*1000/(now-start),p95FrameMs:sorted[Math.floor(sorted.length*.95)],...graphicsStats()});};
    requestAnimationFrame(sample);gameplay.settings.quality=quality;gameplay.applySettings();const applyMs=performance.now()-start;
   }),quality):await page.evaluate(quality=>{
    graphicsStage=quality;const start=performance.now();gameplay.settings.quality=quality;gameplay.applySettings();const applyMs=performance.now()-start,frames=[];
    for(let i=0;i<12;i++){const begin=performance.now();step();if(comp)comp.render();else r.render(S,cam);frames.push(performance.now()-begin);}
    return{quality,applyMs,frames,maxFrameMs:Math.max(...frames),...graphicsStats()};
   },quality);stages.push(result);console.log(JSON.stringify({...result,frames:live?`Recorded ${result.frames.length} intervals`:result.frames}));
   if(!live&&[1,2,4].includes(stages.length))await page.screenshot({path:path.join(root,`tests/artifacts/graphics-switch-${label}-${quality}${stages.length===4?'-restored':''}.png`)});
  }
  const lighting=[];
  if(!live)for(const [name,time]of [['night',.04],['day',.45],['dusk',.748],['night-again',.9]]){
    const result=await page.evaluate(({name,time})=>{tod=time;dayNight();gameplay.settings.quality='high';gameplay.applySettings();const settingShadowUpdates=sun.shadow.autoUpdate;graphicsStage=name;const frames=[];for(let i=0;i<12;i++){const start=performance.now();step();if(comp)comp.render();else r.render(S,cam);frames.push(performance.now()-start);}return{name,frames,maxFrameMs:Math.max(...frames),sunVisible:sun.visible,sunIntensity:sun.intensity,settingShadowUpdates,shadowUpdates:sun.shadow.autoUpdate,...graphicsStats()};},{name,time});
    lighting.push(result);console.log(JSON.stringify({lighting:name,maxFrameMs:result.maxFrameMs,programs:result.programs,sunIntensity:result.sunIntensity,shadowUpdates:result.shadowUpdates}));
    if(['night','day'].includes(name))await page.screenshot({path:path.join(root,`tests/artifacts/graphics-switch-${label}-${name}.png`)});
  }
  const profile=live?null:(await cdp.send('Profiler.stop')).profile;
  const report={viewport:[viewport.width,viewport.height],mobile,live,stages,lighting,...await page.evaluate(()=>({glTimings,slowGL,preparation:worldStream.preparation||null})),browserErrors:errors};
  await fs.mkdir(path.join(root,'tests/artifacts'),{recursive:true});
  await fs.writeFile(path.join(root,`tests/artifacts/graphics-switch-${label}.json`),JSON.stringify(report,null,2));
  if(profile)await fs.writeFile(path.join(root,`tests/artifacts/graphics-switch-${label}.cpuprofile`),JSON.stringify(profile));
  assert.deepEqual(errors,[]);
  if(!recordOnly)for(const stage of stages){assert.ok(stage.maxFrameMs<1000&&stage.applyMs<1000,`${stage.quality}: preset switch blocked for a second`);assert.equal(stage.programs,stages[0].programs,'Preset switch created shader variants');assert.equal(stage.shaderErrorsEnabled,true);if(stage.quality==='low'){assert.equal(stage.shadowUpdates,false);assert.equal(stage.shadowMap,false);}else{assert.equal(stage.shadowUpdates,true);assert.equal(stage.shadowMap,true);assert.equal(stage.shadowSize,mobile?1024:stage.quality==='high'?2048:1024);}}
  if(!recordOnly)for(const phase of lighting){assert.ok(phase.maxFrameMs<1000,`${phase.name}: lighting transition blocked for a second`);assert.equal(phase.programs,stages[0].programs,'Lighting transition created new programs');assert.equal(phase.sunVisible,true);assert.equal(phase.shadowUpdates,phase.sunIntensity>0);assert.equal(phase.settingShadowUpdates,phase.sunIntensity>0,'Night preset changed shadow updates before the next simulation tick');}
  console.log(recordOnly?'Saved diagnostic evidence':'PASS preset switches: bounded waits, stable programs, shadow release/restore and shader diagnostics');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
