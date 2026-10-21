"""Seeded street-level visual review and WebGL budget checks for the world pass."""
from pathlib import Path
from urllib.parse import urlparse
import json, os
from playwright.sync_api import sync_playwright

root=Path(__file__).resolve().parents[1]
artifacts=root/'tests'/'artifacts';artifacts.mkdir(exist_ok=True)
source=(root/'index.html').read_text(encoding='utf-8').replace('<script>\nconst T=10', '''<script>
window.requestAnimationFrame=()=>0;
let reviewSeed=2026;Math.random=()=>{reviewSeed=(Math.imul(reviewSeed,1664525)+1013904223)>>>0;return reviewSeed/4294967296};
const T=10''')

def route(request):
    url=urlparse(request.request.url)
    if url.hostname!='game.test':
        cached=root/'.test-tools'/'cdn-cache'/Path(url.path).name
        if cached.exists():request.fulfill(body=cached.read_bytes(),content_type='text/javascript')
        else:request.continue_()
        return
    if url.path=='/':request.fulfill(body=source,content_type='text/html')
    elif url.path in ['/multiplayer.js','/multiplayer.css','/gameplay.js','/open-world.js','/character-art.js','/pedestrian-crowd.js','/pedestrian-ai.js','/vehicle-doors.js','/world-streaming.js','/vehicle-dynamics.js','/structures.js','/traffic-signals.js','/world-detail.js','/driving.css']:
        request.fulfill(body=(root/url.path[1:]).read_text(encoding='utf-8'),content_type='text/css' if url.path.endswith('.css') else 'text/javascript')
    else:request.fulfill(status=204,body='')


with sync_playwright() as p:
    browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH'),headless=True,args=['--enable-unsafe-swiftshader'])
    page=browser.new_page(viewport={'width':1280,'height':720});page.route('**/*',route)
    errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto('https://game.test/',wait_until='load');page.wait_for_function('gameplay!==null')
    result=page.evaluate("""()=>{
      if(ROAD.sidewalk!==3.2||peds.length!==64||cars.filter(v=>v.ai).length!==24)throw Error('Population/width target missing');
      if(sidewalkRoutes.length<20)throw Error('Too few continuous sidewalk routes');
      const walkers=peds.filter(p=>p.walk),start=walkers.map(p=>({x:p.x,z:p.z}));
      if(walkers.length<45)throw Error('Too few sidewalk pedestrians');
      for(const path of sidewalkRoutes)for(let i=0;i<path.length;i++){
        const p=path[i];if(inMask(asphaltMask,p.x,p.z)||solid(p.x,p.z))throw Error('Unsafe sidewalk waypoint');
        if(i&&Math.hypot(p.x-path[i-1].x,p.z-path[i-1].z)>2)throw Error('Discontinuous route');
      }
      // Hold traffic during the sidewalk test so fleeing does not interrupt the route.
      for(const v of cars){v.ai=null;v.vx=v.vz=0;}
      for(let tick=0;tick<600;tick++){
        step();for(const p of walkers)if(inMask(asphaltMask,p.x,p.z)||solid(p.x,p.z))throw Error('Walker entered road or building');
      }
      const moved=walkers.filter((p,i)=>Math.hypot(p.x-start[i].x,p.z-start[i].z)>3).length;
      if(moved<walkers.length*.7)throw Error('Most sidewalk walkers are stuck: '+moved+'/'+walkers.length);
      car=null;P.x=walkers[0].x;P.z=walkers[0].z;updateScenery();tod=.45;dayNight();
      cam.position.set(P.x-6,3.5,P.z+7);cam.lookAt(P.x,1.5,P.z);r.render(S,cam);
      return{sidewalkWidth:ROAD.sidewalk,pedestrians:peds.length,cars:cars.length,sidewalkWalkers:walkers.length,routes:sidewalkRoutes.length,moved};
    }""")
    page.screenshot(path=str(artifacts/'population-sidewalk.png'))
    page.reload(wait_until='load');page.wait_for_function('gameplay!==null')
    traffic=page.evaluate("""()=>{
      const moving=cars.filter(v=>v.ai),start=moving.map(v=>({x:v.x,z:v.z}));
      for(let i=0;i<600;i++)step();
      const progressed=moving.filter((v,i)=>Math.hypot(v.x-start[i].x,v.z-start[i].z)>5).length;
      if(progressed<16)throw Error('Dense traffic is stuck: '+progressed);
      if(!cars.every(v=>Number.isFinite(v.x)&&Number.isFinite(v.z)))throw Error('Invalid car position');
      return{traffic:moving.length,progressed};
    }""")
    mobile=browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
    mobile.route('**/*',route);mp=mobile.new_page();mp.goto('https://game.test/',wait_until='load');mp.wait_for_function('gameplay!==null')
    mobile_counts=mp.evaluate("""()=>({peds:peds.length,traffic:cars.filter(v=>v.ai).length})""")
    assert mobile_counts=={'peds':48,'traffic':18},mobile_counts
    result.update({'traffic':traffic,'mobile':mobile_counts})
    assert not errors,errors
    print('PASS: '+json.dumps(result),flush=True)
    browser.close()
