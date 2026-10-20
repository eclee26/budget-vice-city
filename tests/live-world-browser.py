"""Live 1280x720 RAF samples on the actual reported browser GPU.
Results describe this machine, not a universal hardware performance guarantee.
"""
from pathlib import Path
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright
import json, os

root=Path(__file__).resolve().parents[1];artifacts=root/'tests'/'artifacts';artifacts.mkdir(exist_ok=True)
source=(root/'index.html').read_text(encoding='utf-8').replace('<script>\nconst T=10','<script>\nlet liveSeed=2026;Math.random=()=>{liveSeed=(Math.imul(liveSeed,1664525)+1013904223)>>>0;return liveSeed/4294967296};\nconst T=10')
def route(request):
    u=urlparse(request.request.url)
    if u.hostname=='game.test':
        if u.path=='/':request.fulfill(body=source,content_type='text/html')
        elif u.path.endswith(('.js','.css')):request.fulfill(body=(root/u.path[1:]).read_bytes(),content_type='text/css' if u.path.endswith('.css') else 'text/javascript')
        else:request.fulfill(status=204,body='')
    else:
        f=root/'.test-tools'/'cdn-cache'/Path(u.path).name
        if f.exists():request.fulfill(body=f.read_bytes(),content_type='text/javascript')
        else:request.continue_()
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH'),headless=True,args=['--no-sandbox','--enable-unsafe-swiftshader'])
    try:
        page=browser.new_page(viewport={'width':1280,'height':720});page.route('**/*',route);errors=[]
        page.on('pageerror',lambda e:errors.append(str(e)))
        page.goto('https://game.test/',wait_until='load',timeout=60000);page.wait_for_function('gameplay!==null',timeout=60000)
        results=[]
        for quality,kind in [('high','coast'),('high','downtown'),('low','downtown')]:
            page.evaluate('''([quality,kind])=>{
              resetInput();gameplay.settings.quality=quality;gameplay.settings.resolution=100;gameplay.applySettings();
              const e=kind==='coast'?coastStart:roads.find(e=>e.a.x===340&&e.b.x===340&&e.a.z===165),p=lanePoint(e,Math.floor(e.points.length*.35));
              car=cars.find(v=>v.n==='Sedan');car.ai=null;Object.assign(car,{x:p.x,z:p.z,a:p.a,vx:0,vz:0,yr:0,dmg:0});P.x=p.x;P.z=p.z;P.a=p.a;ca=p.a;yo=0;pt=.2;camMode=0;P.o.visible=false;
              worldStream.update(P.x,P.z,true);updateScenery();cp.set(P.x-Math.cos(p.a)*11,4,P.z-Math.sin(p.a)*11);gameplay.visualPrevious=null;
            }''',[quality,kind])
            # Warm-up is outside the measured window.
            page.wait_for_timeout(3000)
            result=page.evaluate('''()=>new Promise(resolve=>{
              const samples=[],start=performance.now();let last=start;
              function sample(now){samples.push(now-last);last=now;if(now-start<10000){requestAnimationFrame(sample);return;}
                samples.sort((a,b)=>a-b);const gl=r.getContext(),ext=gl.getExtension('WEBGL_debug_renderer_info');
                resolve({fps:samples.length*1000/(now-start),medianFrameMs:samples[Math.floor(samples.length*.5)],p95FrameMs:samples[Math.floor(samples.length*.95)],maxFrameMs:samples[samples.length-1],framesOver50Ms:samples.filter(n=>n>50).length,frames:samples.length,seconds:(now-start)/1000,renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),renderWidth:r.domElement.width,renderHeight:r.domElement.height,loadedCells:worldStream.active.size,geometries:r.info.memory.geometries,textures:r.info.memory.textures});
              }requestAnimationFrame(sample);
            })''')
            result.update(quality=quality,scene=kind);results.append(result);print(json.dumps(result),flush=True)
        assert not errors,errors
        (artifacts/'live-world-performance.json').write_text(json.dumps({'viewport':[1280,720],'samples':results,'browserErrors':errors},indent=2),encoding='utf-8')
    finally:browser.close()
