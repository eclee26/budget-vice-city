const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_DRIVER||'../.test-tools/Lib/site-packages/playwright/driver/package');
const root=path.resolve(__dirname,'..');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--enable-unsafe-swiftshader']});
 try{
  const context=await browser.newContext({viewport:{width:1280,height:800}}),errors=[];
  const source=(await fs.readFile(path.join(root,'index.html'),'utf8')).replace(/\r\n/g,'\n').replace('<script>\nconst T=10','<script>\nwindow.requestAnimationFrame=()=>0;\nconst T=10');
  assert.ok(source.includes('window.requestAnimationFrame=()=>0'),'Deterministic fixture hook missing');
  await context.route('https://game.test/**',async route=>{const name=new URL(route.request().url()).pathname.slice(1);if(name==='assets/vehicles/1999_honda_civic_si.glb')return route.fulfill({body:await fs.readFile(path.join(root,name)),contentType:'model/gltf-binary'});if(!name)return route.fulfill({body:source,contentType:'text/html'});if(/^[\w-]+\.(js|css)$/.test(name))return route.fulfill({body:await fs.readFile(path.join(root,name)),contentType:name.endsWith('css')?'text/css':'text/javascript'});return route.fulfill({status:204});});
  await context.route(/^https:\/\/(cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net)\//,async route=>{const file=path.join(root,'.test-tools','cdn-cache',new URL(route.request().url()).pathname.split('/').pop());try{return await route.fulfill({body:await fs.readFile(file),contentType:'text/javascript'});}catch{return route.continue();}});
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto('https://game.test/',{timeout:90000});await page.waitForFunction('gameplay?.sandbox',null,{polling:50});
  await page.evaluate(()=>{
   for(const v of cars)v.ai=null;
   const p=nodes.find(p=>{for(let x=-5;x<=5;x++)for(let z=-5;z<=5;z++)if(characterBlocked(p.x+x,p.z+z))return false;return true;});
   if(!p)throw Error('No clear test junction');window.characterTestOrigin={x:p.x,z:p.z};
   window.characterFootsteps=0;const footstep=gameAudio.footstep.bind(gameAudio);gameAudio.footstep=landing=>{characterFootsteps++;footstep(landing);};
   Object.assign(P,{x:p.x,z:p.z,y:0,vy:0,vx:0,vz:0,a:0});ca=yo=0;cp.set(P.x-5,3,P.z);resetInput();
  });
  await page.keyboard.down('d');await page.evaluate(()=>{for(let i=0;i<60;i++)step();});await page.keyboard.up('d');
  const sideways=await page.evaluate(()=>({x:P.x-characterTestOrigin.x,z:P.z-characterTestOrigin.z,heading:ca+yo}));
  assert.ok(Math.abs(sideways.x)<.01&&sideways.z>3&&Math.abs(sideways.heading)<.001,'D moves sideways without spinning camera');
  await page.evaluate(()=>{resetInput();Object.assign(P,{x:characterTestOrigin.x,z:characterTestOrigin.z,vx:0,vz:0});yo=Math.PI/2;});
  await page.keyboard.down('w');await page.evaluate(()=>{for(let i=0;i<60;i++)step();});await page.keyboard.up('w');
  assert.ok(await page.evaluate(()=>Math.abs(P.x-characterTestOrigin.x)<.01&&P.z-characterTestOrigin.z>3),'W follows orbit direction');
  await page.keyboard.down(' ');const jumps=await page.evaluate(()=>{let count=0,air=false,apex=0;for(let i=0;i<150;i++){step();if(P.y>0&&!air)count++;air=P.y>0;apex=Math.max(apex,P.y);}return{count,apex,ground:P.y};});await page.keyboard.up(' ');
  assert.equal(jumps.count,1);assert.equal(jumps.ground,0);assert.ok(jumps.apex>.9&&jumps.apex<1.3);
  assert.ok(await page.evaluate(()=>{const before=gameAudio.voices;gameAudio.muted=true;gameAudio.footstep();const silent=gameAudio.voices===before;gameAudio.muted=false;return characterFootsteps>2&&silent;}),'Gait/landing sounds run and honor mute');
  await page.evaluate(()=>{resetInput();enableTouch();Object.assign(P,{x:characterTestOrigin.x,z:characterTestOrigin.z,vx:0,vz:0});ca=yo=0;touch.x=.5;for(let i=0;i<60;i++)step();resetInput();});
  assert.ok(await page.evaluate(()=>P.z-characterTestOrigin.z>1.5&&Math.abs(P.x-characterTestOrigin.x)<.01),'Touch shares camera basis');
  await fs.mkdir(path.join(root,'tests/artifacts'),{recursive:true});
  await page.evaluate(()=>{document.body.classList.remove('touch-enabled');P.o.visible=true;const y=worldElevation(P.x,P.z);cam.position.set(P.x-3,y+2.2,P.z+3);cam.lookAt(P.x,y+1,P.z);if(comp)comp.render();else r.render(S,cam);});
  await page.screenshot({path:path.join(root,'tests/artifacts/character-controller-desktop.png')});
  await page.setViewportSize({width:390,height:844});await page.evaluate(()=>{enableTouch();rs();if(comp)comp.render();else r.render(S,cam);});
  await page.screenshot({path:path.join(root,'tests/artifacts/character-controller-mobile.png')});
  await page.evaluate(()=>{ca=.8;yo=.4;gameplay.save();});await page.reload();await page.waitForFunction('gameplay?.sandbox',null,{polling:50});
  assert.ok(await page.evaluate(()=>Math.abs(ca+yo-1.2)<.0001),'On-foot camera heading survives reload');
  assert.deepEqual(errors,[]);await fs.writeFile(path.join(root,'tests/artifacts/character-review.json'),JSON.stringify({sideways,jumps,cameraRelativeKeyboard:true,cameraRelativeTouch:true,browserErrors:errors},null,2));
  console.log('PASS character browser controls, jump, animation and desktop/mobile renders');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
