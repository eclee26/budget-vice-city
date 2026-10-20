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
    if url.hostname!='game.test':request.continue_();return
    if url.path=='/':request.fulfill(body=source,content_type='text/html')
    elif url.path in ['/gameplay.js','/vehicle-dynamics.js','/structures.js','/traffic-signals.js','/world-detail.js','/driving.css']:
        request.fulfill(body=(root/url.path[1:]).read_text(encoding='utf-8'),content_type='text/css' if url.path.endswith('.css') else 'text/javascript')
    else:request.fulfill(status=204,body='')

with sync_playwright() as p:
    browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH'),headless=True,args=['--enable-unsafe-swiftshader'])
    page=browser.new_page(viewport={'width':1440,'height':900});page.route('**/*',route);errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('console',lambda m:errors.append(m.text) if m.type=='error' else None)
    page.goto('https://game.test/',wait_until='load',timeout=60000);page.wait_for_function('gameplay!==null',timeout=60000)
    stats=page.evaluate('worldDetailStats');assert stats['trees']>30 and stats['grass']>200 and stats['facades']>100,stats
    assert stats['beachUmbrellas']>=8 and stats['lifeguardTowers']==2 and stats['sailboats']==3 and stats['busShelters']>=2,stats
    district=page.evaluate('''()=>{
      const city=buildings.filter(b=>b.cityArchitecture),wide=city.filter(b=>b.w>10||b.d>10),styles=new Set(city.map(b=>b.style));
      if(wide.length<15||styles.size<8||!city.some(b=>b.kind==='warehouse'))throw Error('Missing city footprint/style variety');
      for(const b of city){const c=Math.cos(b.angle),s=Math.sin(b.angle);for(const x of[-b.footprintW/2,0,b.footprintW/2])for(const z of[-b.footprintD/2,0,b.footprintD/2])if(tile(b.x+c*x+s*z,b.z-s*x+c*z)!==2)throw Error('Building exceeds reserved occupied tiles');}
      const foliage=S.children.filter(o=>o.userData.worldVegetation),matrix=new THREE.Matrix4(),p=new THREE.Vector3(),scale=new THREE.Vector3(),q=new THREE.Quaternion();
      if(foliage.length<10)throw Error('Vegetation is not spatially batched');
      for(const mesh of foliage){if(!mesh.frustumCulled||!mesh.geometry.boundingSphere)throw Error('Missing foliage culling bounds');for(let i=0;i<mesh.count;i++){mesh.getMatrixAt(i,matrix);matrix.decompose(p,q,scale);if(p.distanceTo(mesh.geometry.boundingSphere.center)+Math.max(scale.x,scale.y,scale.z)*1.6>mesh.geometry.boundingSphere.radius)throw Error('Foliage instance exceeds culling bounds');}}
      for(const list of structurePlan.solids.values())for(const b of list)for(const x of[b.minX,b.maxX])for(const z of[b.minZ,b.maxZ])if(inMask(asphaltMask,x,z)||inMask(sidewalkMask,x,z))throw Error('Scenery blocks road/sidewalk');
      return{wideBuildings:wide.length,architectureStyles:styles.size,foliageBatches:foliage.length,districts:[...new Set(buildings.map(b=>cityDistrict(b.x,b.z)))]};
    }''')
    views=[('residential-day','house2',.43),('downtown-day','office',.43),('apartments-day','apartment',.43),('harbor-day','warehouse',.43),('coast-day','coast',.43),('beach-day','beach',.43),('lighthouse-day','lighthouse',.43),('transit-day','transit',.43),('park-day','playground',.43),('fuel-dusk','fuel',.735),('residential-night','house2',.9)]
    budgets=[]
    for name,kind,time in views:
        result=page.evaluate('''([kind,time])=>{
          let candidates=buildings.filter(b=>b.kind===kind);if(kind==='house2')candidates=candidates.filter(b=>cityDistrict(b.x,b.z)==='coast');
          let b=kind==='coast'?{...lanePoint(coastStart,80),angle:0}:kind==='beach'?{x:70,z:151,angle:PI/2}:kind==='lighthouse'?{x:15,z:205,angle:PI/4}:kind==='transit'?sceneryRecords.find(p=>p.tag==='bus-shelter'):candidates[Math.floor(candidates.length*.4)],street=null;
          if(['house2','office','apartment','warehouse'].includes(kind)){
            const ranked=candidates.map(b=>{let p=null,dist=Infinity;for(const e of roads)for(let i=6;i<e.points.length-6;i+=8){const q=e.points[i],d=Math.hypot(q.x-b.x,q.z-b.z);if(d<dist){dist=d;p=q}}
              let blocked=false;for(let t=0;t<Math.max(0,dist-11);t+=1)if(solid(p.x+(b.x-p.x)*t/dist,p.z+(b.z-p.z)*t/dist))blocked=true;
              return{b,p,score:(blocked?10000:0)+Math.abs(dist-21)};}).sort((a,b)=>a.score-b.score);b=ranked[0].b;street=ranked[0].p;
          }
          for(const v of cars)v.ai=null;car=null;P.o.visible=false;P.x=b.x;P.z=b.z;tod=time;
          dayNight();positionSun(P.x,P.z);updateScenery();ambient(14);updateTrafficSignals();
          const c=Math.cos(b.angle),s=Math.sin(b.angle),distance=kind==='office'?22:kind==='fuel'?25:16;
          cam.position.set(b.x+s*distance+c*7,kind==='office'?6:3.2,b.z+c*distance-s*7);cam.lookAt(b.x,kind==='office'?10:2.7,b.z);cam.fov=58;cam.updateProjectionMatrix();
          if(kind==='coast'){cam.position.set(b.x-Math.cos(b.a)*14,4.5,b.z-Math.sin(b.a)*14);cam.lookAt(b.x+Math.cos(b.a)*20,1.5,b.z+Math.sin(b.a)*20)}
          if(street){cam.position.set(street.x,kind==='office'?4.5:3,street.z);cam.lookAt(b.x,kind==='office'?b.roofHeight*.4:3,b.z)}
          if(kind==='transit'){cam.position.set(b.x+s*8+c*3,2.2,b.z+c*8-s*3);cam.lookAt(b.x,1.2,b.z)}
          if(kind==='lighthouse'){cam.position.set(b.x+24,6,b.z+22);cam.lookAt(b.x,9,b.z)}
          r.info.autoReset=false;r.info.reset();if(comp){fin.uniforms.ex.value=.98+.32*night;fin.uniforms.blur.value=0;comp.render()}else r.render(S,cam);
          const result={kind,calls:r.info.render.calls,triangles:r.info.render.triangles,textures:r.info.memory.textures,geometries:r.info.memory.geometries};r.info.autoReset=true;return result;
        }''',[kind,time])
        budgets.append(result);page.screenshot(path=str(artifacts/f'world-{name}.png'))
        # Includes the composer, directional shadows and existing detailed car models.
        assert result['calls']<2300 and result['triangles']<2200000,result
    assert not errors,errors
    report={'scenery':stats,'districts':district,'renderBudgets':budgets}
    (artifacts/'world-review.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
    print('PASS: seeded world renders at day/dusk/night, no WebGL errors; '+json.dumps(report),flush=True)
    browser.close()
