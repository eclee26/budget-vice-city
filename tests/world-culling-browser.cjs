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
  const report=await page.evaluate(()=>{
   const check=window.doorCheck,g=gameplay,results=[];graphics.mobile=false;g.settings.quality='high';g.settings.resolution=100;g.applySettings();car=null;P.o.visible=false;
   const target=new THREE.WebGLRenderTarget(640,400),before=new Uint8Array(640*400*4),after=new Uint8Array(before.length);target.texture.encoding=THREE.LinearEncoding;
   const render=buffer=>{r.setRenderTarget(target);r.info.reset();r.render(S,cam);r.readRenderTargetPixels(target,0,0,640,400,buffer);return{calls:r.info.render.calls,triangles:r.info.render.triangles};};
   for(const [x,z,yaw]of [[120,80,0],[340,180,1.3],[340,380,3.1],[180,300,-1.5]]){
    P.x=x;P.z=z;worldStream.update(x,z,true);updateScenery();positionSun(x,z);cam.position.set(x,3,z);cam.lookAt(x+Math.cos(yaw)*30,2,z+Math.sin(yaw)*30);cam.updateMatrixWorld(true);
    const meshes=[...worldStream.active].flatMap(c=>c.group.children);check(meshes.every(m=>m.userData.instanceBounds),'Every streamed batch has bounds');for(const cell of worldStream.active){let i=0;for(const part of cell.parts.values()){const mesh=cell.group.children[i++];check(mesh.geometry===part.geometry,'Original geometry and GPU attributes remain shared');}}
    for(const mesh of meshes)mesh.frustumCulled=false;render(before);const unculled=render(before);
    for(const mesh of meshes)mesh.frustumCulled=true;const culled=render(after);
    let pixels=0,max=0;for(let i=0;i<before.length;i+=4){let differs=false;for(let c=0;c<4;c++){const d=Math.abs(before[i+c]-after[i+c]);max=Math.max(max,d);if(d>1)differs=true;}if(differs)pixels++;}
    check(pixels===0,'Culling changes visible pixels or shadows '+JSON.stringify({x,z,pixels,max}));results.push({x,z,yaw,unculled,culled,differentPixels:pixels,maxChannelDifference:max});
   }
   r.setRenderTarget(null);target.dispose();const total=key=>results.reduce((n,x)=>n+x[key].calls,0);check(total('culled')<total('unculled')*.9,'Culling reduces actual draw submissions');return{views:results,drawReduction:1-total('culled')/total('unculled')};
  });assert.deepEqual(errors,[]);await fs.writeFile(path.join(artifacts,'world-culling.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
