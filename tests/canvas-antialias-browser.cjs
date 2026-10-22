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
  await context.addInitScript(()=>{localStorage.clear();Date.now=()=>1000000;});await page.setViewportSize({width:640,height:400});
  await fs.mkdir(artifacts,{recursive:true});
  const captures=[],attributes=[];
  for(const antialias of [true,false]){
   await context.route('https://game.test/',route=>route.fulfill({body:source.replace('antialias:!postProcessingAvailable','antialias:'+antialias),contentType:'text/html'}));await page.goto('https://game.test/',{timeout:90000});await page.waitForFunction('gameplay?.initialized',null,{polling:50});
   const data=await page.evaluate(()=>{const g=gameplay;g.settings.quality='high';g.settings.resolution=100;g.applySettings();for(const v of cars){v.ai=null;v.vx=v.vz=0;}for(let i=0;i<2;i++)step();P.x=340;P.z=190;worldStream.update(P.x,P.z,true);updateScenery();positionSun(P.x,P.z);cam.position.set(340,3,190);cam.lookAt(365,2,170);cam.updateMatrixWorld(true);comp.render();const gl=r.getContext(),pixels=new Uint8Array(gl.drawingBufferWidth*gl.drawingBufferHeight*4);gl.readPixels(0,0,gl.drawingBufferWidth,gl.drawingBufferHeight,gl.RGBA,gl.UNSIGNED_BYTE,pixels);return{pixels:Array.from(pixels),width:gl.drawingBufferWidth,height:gl.drawingBufferHeight,antialias:gl.getContextAttributes().antialias,fxaa:comp.passes.includes(aa)&&aa.enabled};});captures.push(data.pixels);delete data.pixels;attributes.push(data);
  }
  let changed=0,max=0;for(let i=0;i<captures[0].length;i+=4){let different=false;for(let k=0;k<4;k++){const delta=Math.abs(captures[0][i+k]-captures[1][i+k]);max=Math.max(max,delta);if(delta>1)different=true;}if(different)changed++;}
  const ratio=changed/(captures[0].length/4);assert.ok(attributes[0].antialias&&!attributes[1].antialias&&attributes.every(x=>x.fxaa),'FXAA retained while redundant canvas MSAA is removed');assert.ok(ratio<.001,'Final canvas pixels changed materially: '+JSON.stringify({changed,ratio,max}));
  await context.route('https://game.test/',route=>route.fulfill({body:source.replace('const postProcessingAvailable=!!(THREE.EffectComposer&&THREE.UnrealBloomPass&&THREE.ShaderPass);','const postProcessingAvailable=false;'),contentType:'text/html'}));await page.reload();await page.waitForFunction('gameplay?.initialized',null,{polling:50});assert.ok(await page.evaluate(()=>!comp&&r.getContext().getContextAttributes().antialias),'Direct-render fallback retains hardware antialiasing');
  assert.deepEqual(errors,[]);const report={attributes,changedPixelsOverOneChannelValue:changed,ratio,maxChannelDifference:max,fallbackAntialias:true};await fs.writeFile(path.join(artifacts,'canvas-antialias.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
