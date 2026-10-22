const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict'),{pathToFileURL}=require('node:url');
const {chromium}=require(process.env.PLAYWRIGHT_DRIVER||'../.test-tools/Lib/site-packages/playwright/driver/package');
const root=path.resolve(__dirname,'..');
(async()=>{
 const {createGameServer}=await import('../server.mjs'),server=createGameServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--enable-unsafe-swiftshader']});
 try{
  const context=await browser.newContext(),page=await context.newPage(),errors=[];
  await context.addInitScript(()=>{window.requestAnimationFrame=()=>0;Object.defineProperty(AbortSignal,'timeout',{value:undefined,configurable:true});});
  await context.route(/^https:\/\/(cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net)\//,async route=>route.fulfill({body:await fs.readFile(path.join(root,'.test-tools/cdn-cache',new URL(route.request().url()).pathname.split('/').pop())),contentType:'text/javascript'}));
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto('http://127.0.0.1:'+server.address().port,{timeout:90000});await page.waitForFunction('gameplay?.initialized',null,{polling:50,timeout:60000});
  assert.ok(await page.evaluate(()=>!!cars.find(v=>v.n===ImportedCivic.name)?.importedView&&ImportedCivic.error===null),'Real local HTTP server loads the GLB without AbortSignal.timeout');
  await page.goto(pathToFileURL(path.join(root,'index.html')).href,{timeout:90000});await page.waitForFunction('gameplay?.initialized',null,{polling:50,timeout:60000});
  assert.ok(await page.evaluate(()=>!ImportedCivic.parts&&ImportedCivic.error==='Civic file URL'&&gameBoot.done&&document.getElementById('gp-vehicle').textContent.includes('localhost:8000')),'Direct disk opening explains the server requirement and stays playable');
  assert.deepEqual(errors,[]);console.log('PASS real local HTTP model load, older timeout-API compatibility and direct-file guidance');
 }finally{await browser.close();server.shutdown();}
})().catch(error=>{console.error(error);process.exitCode=1;});
