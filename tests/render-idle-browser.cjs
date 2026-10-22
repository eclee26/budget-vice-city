const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_DRIVER||'../.test-tools/Lib/site-packages/playwright/driver/package');
const root=path.resolve(__dirname,'..'),artifacts=path.join(root,'tests/artifacts');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--enable-unsafe-swiftshader']});
 try{
  const context=await browser.newContext({viewport:{width:1280,height:800}}),page=await context.newPage(),errors=[];
  await context.addInitScript(()=>{window.doorCheck=(ok,message)=>{if(!ok)throw Error(message);};});
  const source=(await fs.readFile(path.join(root,'index.html'),'utf8')).replace(/\r\n/g,'\n').replace('<script>\nconst T=10','<script>\nwindow.requestAnimationFrame=cb=>{window.testFrame=cb;return 0;};let doorSeed=2026;Math.random=()=>{doorSeed=(Math.imul(doorSeed,1664525)+1013904223)>>>0;return doorSeed/4294967296};\nconst T=10');
  assert.ok(source.includes('window.testFrame=cb'),'Deterministic fixture hook missing');
  await context.route('https://game.test/**',async route=>{const name=new URL(route.request().url()).pathname.slice(1);if(name==='assets/vehicles/1999_honda_civic_si.glb')return route.fulfill({body:await fs.readFile(path.join(root,name)),contentType:'model/gltf-binary'});if(!name)return route.fulfill({body:source,contentType:'text/html'});if(/^[\w-]+\.(js|css)$/.test(name))return route.fulfill({body:await fs.readFile(path.join(root,name)),contentType:name.endsWith('css')?'text/css':'text/javascript'});return route.fulfill({status:204});});
  await context.route(/^https:\/\/(cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net)\//,async route=>{try{return await route.fulfill({body:await fs.readFile(path.join(root,'.test-tools/cdn-cache',new URL(route.request().url()).pathname.split('/').pop())),contentType:'text/javascript'});}catch{return route.continue();}});
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto('https://game.test/',{timeout:90000});await page.waitForFunction('gameplay?.passengerJobs',null,{polling:50});
  await fs.mkdir(artifacts,{recursive:true});
  const report=await page.evaluate(()=>{
   const check=window.doorCheck,g=gameplay;check(comp,'Composer available');let renders=0;const original=comp.render;comp.render=function(...args){renders++;return original.apply(this,args);};const frame=()=>window.testFrame(simLast+17);
   for(let i=0;i<5;i++)frame();check(renders===5,'Active game renders every frame');const active=renders;
   openHelp();frame();const paused=renders,elapsed=g.elapsed;for(let i=0;i<15;i++)frame();check(renders===paused&&g.elapsed===elapsed,'Paused game reuses the unchanged canvas and simulation stays paused');check(g.frameCount===0,'Cached paused frames do not inflate FPS');
   g.settings.quality='medium';g.applySettings();frame();check(renders===paused+1,'Graphics change redraws the paused scene');frame();check(renders===paused+1,'Unchanged preview is then reused');
   g.hud();frame();check(renders===paused+2,'Interactive HUD actions can invalidate the scene');
   let hidden=true;Object.defineProperty(document,'hidden',{configurable:true,get:()=>hidden});help.close();const hiddenStart=renders;for(let i=0;i<5;i++)frame();check(renders===hiddenStart,'Hidden tab does not submit WebGL frames');hidden=false;frame();check(renders===hiddenStart+1,'Visible game resumes rendering');delete document.hidden;
   comp.render=original;return{activeFrames:active,cachedPausedFrames:15,settingsPreview:true,hiddenFramesSkipped:5,resumed:true};
  });assert.deepEqual(errors,[]);await fs.writeFile(path.join(artifacts,'render-idle.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
