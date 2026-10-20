"""World cell lifetime, terrain support, LOD and repeated-travel GPU budgets."""
from pathlib import Path
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright
import json, os

root=Path(__file__).resolve().parents[1]
artifacts=root/'tests'/'artifacts'; artifacts.mkdir(exist_ok=True)
source=(root/'index.html').read_text(encoding='utf-8').replace('<script>\nconst T=10','''<script>
window.requestAnimationFrame=()=>0;let reviewSeed=2026;Math.random=()=>{reviewSeed=(Math.imul(reviewSeed,1664525)+1013904223)>>>0;return reviewSeed/4294967296};
const T=10''')

def route(request):
    u=urlparse(request.request.url)
    if u.hostname=='game.test':
        if u.path=='/':request.fulfill(body=source,content_type='text/html')
        elif u.path.endswith(('.js','.css')):
            request.fulfill(body=(root/u.path[1:]).read_bytes(),content_type='text/css' if u.path.endswith('.css') else 'text/javascript')
        else:request.fulfill(status=204,body='')
    else:
        cached=root/'.test-tools'/'cdn-cache'/Path(u.path).name
        if cached.exists():request.fulfill(body=cached.read_bytes(),content_type='text/javascript')
        else:request.continue_()

with sync_playwright() as p:
    browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH'),headless=True,args=['--no-sandbox','--enable-unsafe-swiftshader'])
    try:
        page=browser.new_page(viewport={'width':1100,'height':720});page.route('**/*',route)
        errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.on('console',lambda m:errors.append(m.text) if m.type=='error' else None)
        page.goto('https://game.test/',wait_until='load',timeout=60000);page.wait_for_function('gameplay!==null',timeout=60000)
        result=page.evaluate('''()=>{
          const check=(c,m)=>{if(!c)throw Error(m)},s=worldStream;
          check(s.stats.totalCells>20&&s.active.size<=12,'High detail chunk budget');
          check(gardenHills.features.length===2,'Two reserved garden hills');
          const parking=buildings.filter(b=>b.kind==='parking');check(parking.length===2&&parking.every(b=>b.spaces===14),'Parking capacity');
          for(const e of roads)for(let i=0;i<e.points.length;i+=5)check(worldElevation(e.points[i].x,e.points[i].z)===0,'Terrain intersects a road');
          for(const hill of gardenHills.features){check(Math.abs(worldElevation(hill.x,hill.z)-hill.height)<1e-8,'Hill summit');check(worldElevation(hill.x+hill.radius,hill.z)===0,'Hill edge');check(roadHeight(hill.x,hill.z)>hill.height-.03,'Physical hill height');}
          const pos=terrainGeometry.attributes.position;for(let i=0;i<pos.count;i+=23)check(Math.abs(pos.getY(i)-worldElevation(pos.getX(i)+240,pos.getZ(i)+240))<1e-5,'Terrain mesh/collision height mismatch');
          const hill=gardenHills.features[0],v=mkCar('Sedan');v.x=hill.x;v.z=hill.z+4;v.a=0;v.heave=roadHeight(v.x,v.z);v.contacts=null;
          for(let i=0;i<180;i++)phys(v,0,0,0,true);
          check(Number.isFinite(v.heave)&&v.heave>hill.height-.9,'Vehicle spring support on hill');
          v.x=hill.x+8;updateTerrainPose(v);check(Math.abs(v.groundPitch)>.05,'Vehicle follows terrain slope');
          const building=buildings.find(b=>b.kind==='office'),collision=solid(building.x,building.z),records=s.stats.definitions;
          gameplay.settings.quality='low';gameplay.settings.resolution=50;gameplay.applySettings();
          const points=[[110,80],[340,60],[400,220],[340,400],[150,380],[250,230]],passes=[];
          for(let pass=0;pass<3;pass++){
            for(const [x,z]of points){P.x=x;P.z=z;s.update(x,z,true);updateScenery();s.update(x,z,true);check(s.active.size<=6,'Low detail chunk budget');check(s.active.size< s.stats.totalCells,'Whole map at full detail');check(s.stats.instanceBuffers===[...s.active].reduce((n,c)=>n+c.group.children.length,0),'Instance-buffer accounting');
              cam.position.set(x-10,4,z-8);cam.lookAt(x+20,3,z+20);if(comp)comp.render();else r.render(S,cam);
            }
            passes.push({...r.info.memory,instanceBuffers:s.stats.instanceBuffers,loaded:s.active.size});
          }
          check(s.stats.loads>12&&s.stats.unloads>12,'Cells actually load and unload');check(records===s.stats.definitions,'Travel duplicates definitions');check(solid(building.x,building.z)===collision,'Unloading changes collision');
          check(passes[2].textures<=passes[1].textures+1&&passes[2].geometries<=passes[1].geometries+1,'GPU resources grow across identical loops');
          const far=cars.find(c=>Math.hypot(c.x-P.x,c.z-P.z)>100);if(far)check(far.lowModel.visible&&!far.highParts.some(p=>p.visible),'Distant vehicle does not use LOD');
          gameplay.settings.quality='high';gameplay.settings.resolution=100;gameplay.applySettings();
          const gl=r.getContext(),ext=gl.getExtension('WEBGL_debug_renderer_info');
          return{stream:{...s.stats},passes,hills:gardenHills.features,parking:parking.map(b=>({name:b.name,spaces:b.spaces})),renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),webgl2:r.capabilities.isWebGL2};
        }''')
        print('PASS: terrain support, parking, streamed cell lifetime, LOD and bounded repeated-travel resources',flush=True)
        views=[('garden','garden',.43),('parking','parking',.43),('skyline','skyline',.735),('garden-night','garden',.9)]
        for name,kind,time in views:
            page.evaluate('''([kind,time])=>{
              const b=kind==='garden'?gardenHills.features[0]:kind==='parking'?structurePlan.lots.find(l=>l.kind==='parking'):{x:285,z:235};
              P.x=b.x;P.z=b.z;car=null;P.o.visible=false;tod=time;dayNight();updateScenery();worldStream.update(P.x,P.z,true);positionSun(P.x,P.z);ambient(16);
              if(kind==='parking'){const a=b.angle;cam.position.set(b.x+Math.sin(a)*25+Math.cos(a)*6,6,b.z+Math.cos(a)*25-Math.sin(a)*6);cam.lookAt(b.x,1.8,b.z);}
              else if(kind==='garden'){cam.position.set(b.x-21,6,b.z+20);cam.lookAt(b.x,2.5,b.z);}
              else{cam.position.set(b.x-35,25,b.z-50);cam.lookAt(345,23,235);}
              cam.fov=58;cam.updateProjectionMatrix();if(comp){fin.uniforms.ex.value=.98+.32*night;fin.uniforms.blur.value=0;comp.render();}else r.render(S,cam);
            }''',[kind,time]);page.screenshot(path=str(artifacts/f'streaming-{name}.png'))
        assert not errors,errors
        result['browserErrors']=errors;(artifacts/'streaming-review.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
        print('PASS: representative screenshots; '+json.dumps(result),flush=True)
    finally:browser.close()
