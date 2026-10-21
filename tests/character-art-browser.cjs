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
   const check=window.doorCheck;for(const child of S.children)if(!child.isLight&&child!==sun.target)child.visible=false;
   for(const element of document.body.children)if(element!==r.domElement&&!['SCRIPT','STYLE','LINK'].includes(element.tagName))element.style.visibility='hidden';
   S.background=lin('#b4b9b5');S.fog=null;positionSun(0,0);sun.intensity=1.85;
   const floor=new THREE.Mesh(new THREE.PlaneGeometry(30,30).rotateX(-Math.PI/2),new THREE.MeshStandardMaterial({color:lin('#8b938c'),roughness:1}));floor.receiveShadow=true;floor.position.y=-.004;S.add(floor);
   window.characterModels=[];const results=[],geometries=new Set(),styles=['bob','tied','part','crop','curl'];
   for(const build of ['lean','regular','sturdy'])for(const hairStyle of styles)for(const garment of ['tee','polo','shirt','jacket']){
    const H=mkHuman({skin:'#c68a62',hair:'#3b2416',shirt:'#496878',pants:'#3d4550',shoe:'#d3ccbb',height:1.8,build,hairStyle,garment,long:['bob','tied'].includes(hairStyle)});H.g.rotation.y=-Math.PI;H.g.visible=false;H.g.updateMatrixWorld(true);
    const bounds=new THREE.Box3().setFromObject(H.g);check(bounds.min.y>=-.001,'Shoes below ground');check(Math.abs(bounds.max.y-1.8)<.002,'Character height calibration '+JSON.stringify({build,hairStyle,garment,max:bounds.max.y}));
    let triangles=0,parts=0;H.g.traverse(mesh=>{if(mesh.isMesh){geometries.add(mesh.geometry.uuid);triangles+=(mesh.geometry.index?mesh.geometry.index.count:mesh.geometry.attributes.position.count)/3;parts++;check([...mesh.geometry.attributes.position.array,...mesh.geometry.attributes.normal.array].every(Number.isFinite),'Finite geometry and normals');const point=new THREE.Vector3();for(let i=0;i<mesh.geometry.attributes.position.count;i++){point.fromBufferAttribute(mesh.geometry.attributes.position,i).applyMatrix4(mesh.matrixWorld);check(Math.hypot(point.x,point.z)<=H.radius+.002,'Standing character fits its personal-space radius');}}});
    check(parts<=65&&triangles<6500,'Character detail budget');results.push({build,hairStyle,garment,parts,triangles,height:bounds.max.y});characterModels.push(H);
   }
   check(geometries.size===10,'Shared geometry family count');
   const first=characterModels.find(H=>H.build==='regular'&&H.garment==='shirt'&&H.hairStyle==='part'),other=characterModels.find(H=>H.build==='lean'),otherMaterial=other.paint.shirt[0].mesh.material,otherColor=otherMaterial.color.getHex();
   const palette={skin:'#8d5a3b',hair:'#1b1410',shirt:'#a37e66',pants:'#354237',shoe:'#2b2f35'};setHumanPalette(first,palette);
   for(const [channel,parts]of Object.entries(first.paint))for(const {mesh,tone}of parts)check(mesh.material===mat(humanTone(palette[channel],tone)),'Outfit and trim recolor together');check(other.paint.shirt[0].mesh.material===otherMaterial&&otherMaterial.color.getHex()===otherColor,'Shared materials not mutated');
   window.characterArtRender=()=>{if(comp)comp.render();else r.render(S,cam);};
   const clothing=['tee','polo','shirt','jacket','tee'],colors=['#9c7763','#576f65','#4e687a','#414750','#ad9873'];
   for(let i=0;i<styles.length;i++){const H=characterModels.find(H=>H.hairStyle===styles[i]&&H.garment===clothing[i]&&H.build===['lean','regular','sturdy','regular','lean'][i]);H.g.visible=true;H.g.position.z=(i-2)*.95;setHumanPalette(H,{skin:SK[i],hair:HR[i],shirt:colors[i],pants:PN[i],shoe:'#d3ccbb'});}
   cam.position.set(-5.8,1.6,0);cam.lookAt(0,1,0);cam.fov=36;cam.updateProjectionMatrix();characterArtRender();window.characterHero=first;return{variants:results,sharedGeometries:geometries.size,browserErrors:[]};
  });
  await page.screenshot({path:path.join(artifacts,'characters-wardrobe.png')});
  await page.evaluate(()=>{for(const H of characterModels)H.g.visible=false;const H=characterHero;H.g.visible=true;H.g.position.set(0,0,0);H.g.rotation.y=-Math.PI*.85;cam.position.set(-1.2,1.58,.10);cam.lookAt(0,1.53,0);cam.fov=35;cam.updateProjectionMatrix();characterArtRender();});
  await page.screenshot({path:path.join(artifacts,'character-portrait.png')});
  await page.evaluate(()=>{const H=characterHero;for(const eye of H.eyes)eye.scale.y=.003;characterArtRender();});
  await page.screenshot({path:path.join(artifacts,'character-blink.png')});
  await page.evaluate(()=>{for(const H of characterModels)if(H.g.visible){for(const eye of H.eyes)eye.scale.y=.02;H.g.rotation.y=0;}cam.position.set(-1.2,1.58,.1);characterArtRender();});
  await page.screenshot({path:path.join(artifacts,'character-hair-back.png')});
  assert.deepEqual(errors,[]);await fs.writeFile(path.join(artifacts,'character-art.json'),JSON.stringify(report,null,2));console.log('PASS 60 wardrobe/build/hair variants, height/floor bounds, shared geometry, recoloring and detail budget '+JSON.stringify({variants:report.variants.length,sharedGeometries:report.sharedGeometries,maxParts:Math.max(...report.variants.map(v=>v.parts)),maxTriangles:Math.max(...report.variants.map(v=>v.triangles))}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
