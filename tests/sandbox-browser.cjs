/* Uses the Playwright driver installed for the existing Python browser checks.
   Run with node tests/sandbox-browser.cjs. Override PLAYWRIGHT_DRIVER if needed. */
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_DRIVER||'../.test-tools/Lib/site-packages/playwright/driver/package');
const root=path.resolve(__dirname,'..'),artifacts=path.join(__dirname,'artifacts');
(async()=>{
  await fs.mkdir(artifacts,{recursive:true});
  const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--enable-unsafe-swiftshader']});
  try{
    const context=await browser.newContext({viewport:{width:1440,height:900},ignoreHTTPSErrors:true});
    let source=await fs.readFile(path.join(root,'index.html'),'utf8');
    source=source.replace(/\r\n/g,'\n').replace('<script>\nconst T=10','<script>\nwindow.requestAnimationFrame=()=>0;let seed=2026;Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};\nconst T=10');
    assert.ok(source.includes('window.requestAnimationFrame=()=>0'),'Deterministic fixture hook missing');
    await context.route('https://game.test/**',async route=>{const name=new URL(route.request().url()).pathname.slice(1);if(name==='assets/vehicles/1999_honda_civic_si.glb')return route.fulfill({body:await fs.readFile(path.join(root,name)),contentType:'model/gltf-binary'});if(!name)return route.fulfill({body:source,contentType:'text/html'});if(/^[\w-]+\.(js|css)$/.test(name))return route.fulfill({body:await fs.readFile(path.join(root,name)),contentType:name.endsWith('css')?'text/css':'text/javascript'});return route.fulfill({status:204});});
    await context.route(/^https:\/\/(cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net)\//,async route=>{const file=path.join(root,'.test-tools','cdn-cache',new URL(route.request().url()).pathname.split('/').pop());try{return await route.fulfill({body:await fs.readFile(file),contentType:'text/javascript'});}catch{return route.continue();}});
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
    await page.goto('https://game.test/',{waitUntil:'load',timeout:90000});
    await page.waitForFunction('gameplay?.sandbox&&gameplay.sandbox.services.length===4',null,{polling:50,timeout:60000});
    const checks=await page.evaluate(()=>{
      const g=gameplay,s=g.sandbox,ok=(condition,message)=>{if(!condition)throw Error(message);};
      ok(s.cash===500&&s.health===100,'New career state');
      car=cars.find(v=>v.n==='Kaze R');car.ai=null;P.x=car.x;P.z=car.z;P.o.visible=false;g.lastVehicle=car;
      for(const v of cars)if(v!==car)v.ai=null;
      const initial=s.cash;g.startActivity('race');ok(g.activity?.kind==='race','Race starts');
      while(g.activity){const a=g.activity,t=a.targets[a.index];car.x=t.x;car.z=t.z;car.vx=car.vz=0;g.updateActivity();}
      ok(s.cash===initial+650,'Race pays once');g.finishActivity(true,'duplicate');ok(s.cash===initial+650,'No duplicate reward');
      g.startActivity('getaway');ok(s.stars===2&&g.activity?.kind==='getaway','Getaway dispatch');
      for(let i=0;i<3;i++){const a=g.activity,t=a.targets[a.index];car.x=t.x;car.z=t.z;car.vx=car.vz=0;g.updateActivity();}
      ok(g.activity.escape&&!g.marker.visible,'Cargo requires escape');g.updateActivity();ok(!!g.activity,'Cannot complete with wanted level');
      s.endPursuit();g.updateActivity();ok(!g.activity&&s.cash===initial+650+1800,'Getaway pays after escape');
      P.x=car.x;P.z=car.z;s.crime(2,'Test dispatch');s.dispatchUnit();ok(s.units.length>0&&s.units[0].policeActive,'Police dispatched');
      const unit=s.units[0],route=s.routeFor(unit,P);ok(route.length>4&&route.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.z)),'Road graph pursuit route');
      const before={x:unit.x,z:unit.z};for(let i=0;i<180;i++)s.drivePolice(unit);ok(Math.hypot(unit.x-before.x,unit.z-before.z)>2,'Police can drive');
      ok(Number.isFinite(unit.x)&&Number.isFinite(unit.st),'Pursuit physics finite');
      s.health=80;s.cash=2000;s.endPursuit();const service=s.services.find(p=>p.kind==='workshop');P.x=service.x;P.z=service.z;car.x=P.x;car.z=P.z;car.vx=car.vz=0;car.dmg=100;
      s.interact();ok(s.cash===1850&&car.dmg===0,'Workshop repair and price: '+JSON.stringify({cash:s.cash,dmg:car.dmg,heat:s.heat,activity:g.activity,service:s.service,notice:document.getElementById('game-notice').textContent}));s.interact();ok(s.cash===1850,'Healthy car does not charge');
      car.dmg=50;s.heat=1;s.interact();ok(s.cash===1850&&car.dmg===50,'Wanted service refusal');s.endPursuit();s.cash=10;s.interact();ok(s.cash===10&&car.dmg===50,'Insufficient funds preserve state');
      s.cash=1500;s.health=64;g.save();ok(JSON.parse(localStorage.getItem('bvc-progress-v1')).sandbox.health===64,'Career saved in canonical save');
      s.restore({cash:-100,heat:Infinity,health:NaN});ok(s.cash===0&&s.heat===0&&s.health===64,'Malformed career fields bounded');
      s.cash=1500;s.health=64;g.save();
      s.crime(1,'Test');const fine=s.cash;s.respawn('BUSTED');ok(!car&&s.heat===0&&s.health===100&&s.cash===fine-250,'Bust consequence');ok(!solid(P.x,P.z),'Respawn clear');
      // An actual five-second capture rather than only calling the consequence.
      s.immunity=0;s.heat=1;unit.policeActive=true;unit.x=P.x+6;unit.z=P.z;unit.vx=unit.vz=0;
      s.bust=4.99;s.tick();ok(s.heat===0&&s.immunity>0,'Capture timer triggers bust');
      s.immunity=0;s.heat=2;s.units.forEach(v=>{v.policeActive=false;});s.dispatch=99;s.hidden=28;s.tick();ok(s.heat===0&&s.escapes===1,'Hidden search expires');
      g.hud();updateHud();return{cash:s.cash,escapes:s.escapes,policePool:s.units.length,routePoints:route.length,checks:17};
    });
    await page.keyboard.press('h');await page.locator('[data-pane="activities"]').click();await page.locator('#service-routes button').first().click();
    assert.match(await page.locator('#service-route-status').textContent(),/Destination:/);
    await page.screenshot({path:path.join(artifacts,'sandbox-jobs.png')});await page.keyboard.press('Escape');assert.equal(await page.evaluate('help.open'),false);
    // Restore/save integration including old saves and invalid optional career data.
    await page.evaluate('gameplay.sandbox.cash=4321;gameplay.sandbox.health=73;gameplay.save()');await page.reload({waitUntil:'load'});await page.waitForFunction('gameplay?.sandbox',null,{polling:50});
    assert.equal(await page.evaluate('gameplay.sandbox.cash'),4321);assert.equal(await page.evaluate('gameplay.sandbox.health'),73);
    await page.evaluate(`car=cars.find(v=>v.n==='Kaze R');car.ai=null;car.dmg=0;P.x=car.x;P.z=car.z;P.o.visible=false;gameplay.sandbox.immunity=0;gameplay.sandbox.crime(2,'Police dispatched');gameplay.sandbox.dispatchUnit();gameplay.sandbox.hud();updateHud();dayNight();updateScenery();cam.position.set(P.x-9,4,P.z-7);cam.lookAt(P.x,1,P.z);if(comp)comp.render();else r.render(S,cam);`);
    await page.screenshot({path:path.join(artifacts,'sandbox-pursuit.png')});
    const frozen=await page.evaluate('gameplay.sandbox.hidden');await page.keyboard.press('h');await page.evaluate('advanceSimulation(simLast+1000)');assert.equal(await page.evaluate('gameplay.sandbox.hidden'),frozen);await page.keyboard.press('Escape');
    await page.setViewportSize({width:390,height:844});await page.evaluate('enableTouch();rs();gameplay.hud();updateHud();if(comp)comp.render();else r.render(S,cam)');await page.screenshot({path:path.join(artifacts,'sandbox-mobile.png')});
    assert(await page.locator('#sandbox-hud').isVisible());assert.equal(await page.evaluate('document.documentElement.scrollWidth>innerWidth'),false);
    await page.setViewportSize({width:844,height:390});await page.evaluate('rs();if(comp)comp.render();else r.render(S,cam)');await page.screenshot({path:path.join(artifacts,'sandbox-landscape.png')});
    assert.deepEqual(errors,[]);await fs.writeFile(path.join(artifacts,'sandbox-review.json'),JSON.stringify({checks,browserErrors:errors},null,2));console.log('PASS sandbox browser:',checks);
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
