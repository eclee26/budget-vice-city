"""Settings population sliders: browser state and actor lifecycle regressions."""
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
    elif url.path=='/assets/vehicles/1999_honda_civic_si.glb':request.fulfill(body=(root/url.path[1:]).read_bytes(),content_type='model/gltf-binary')
    elif url.path in ['/multiplayer.js','/multiplayer.css','/gameplay.js','/open-world.js','/story-mission.js','/gltf-loader.js','/imported-civic.js','/character-art.js','/pedestrian-crowd.js','/pedestrian-ai.js','/vehicle-doors.js','/world-streaming.js','/vehicle-dynamics.js','/structures.js','/traffic-signals.js','/world-detail.js','/driving.css']:
        request.fulfill(body=(root/url.path[1:]).read_text(encoding='utf-8'),content_type='text/css' if url.path.endswith('.css') else 'text/javascript')
    else:request.fulfill(status=204,body='')

with sync_playwright() as p:
    browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH'),headless=True,args=['--enable-unsafe-swiftshader'])
    context=browser.new_context(viewport={'width':1100,'height':800});context.route('**/*',route)
    page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('console',lambda m:errors.append(m.text) if m.type=='error' else None)
    page.goto('https://game.test/',wait_until='load');page.wait_for_function('gameplay!==null',polling=50)
    def slider(name,value):
        page.locator('#'+name+'-setting').evaluate("(el,v)=>{el.value=v;el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));}",value)
    def counts():
        return page.evaluate('({peds:peds.length,traffic:cars.filter(v=>v.ai&&!v.police&&!v.policeActive).length})')
    assert counts()=={'peds':64,'traffic':24},counts()
    page.keyboard.press('h');page.locator('[data-pane="settings"]').click()
    page.locator('#pedestrians-setting').focus();page.keyboard.press('ArrowRight');assert counts()['peds']==72
    slider('pedestrians',128);slider('traffic',48);assert counts()=={'peds':128,'traffic':48},counts()
    page.locator('#traffic-setting').scroll_into_view_if_needed();page.screenshot(path=str(artifacts/'population-settings-desktop.png'))
    # Zero removes ambient actors while protecting a claimed vehicle and fixed parking.
    result=page.evaluate("""()=>{
      const v=cars.find(v=>v.ai);car=v;v.ai=null;gameplay.lastVehicle=v;
      const parked=cars.filter(o=>!o.ai);window.populationProtected=parked;return{parked:parked.length};
    }""")
    page.evaluate('gameplay.frame(performance.now()+2000)');assert counts()=={'peds':128,'traffic':48}
    assert page.evaluate('cars.includes(car)&&populationProtected.every(v=>cars.includes(v))')
    slider('pedestrians',0);slider('traffic',0);assert counts()=={'peds':0,'traffic':0}
    assert page.evaluate('cars.includes(car)&&populationProtected.every(v=>cars.includes(v)&&v.o.parent===S)')
    assert page.locator('#population-status').inner_text()=='0 pedestrians · 0 traffic cars active.'
    page.reload(wait_until='load');page.wait_for_function('gameplay!==null',polling=50);assert counts()=={'peds':0,'traffic':0}
    assert page.evaluate('!!car&&gameplay.settings.pedestrians===0&&gameplay.settings.traffic===0')
    page.keyboard.press('h');page.locator('[data-pane="settings"]').click()
    slider('pedestrians',128);slider('traffic',48)
    identity=page.evaluate("""()=>{window.pedIdentity=new Set(peds);window.carIdentity=new Set(cars.filter(v=>v.ai));return{peds:peds.length,traffic:carIdentity.size};}""")
    for i in range(3):
        slider('pedestrians',0);slider('traffic',0);slider('pedestrians',128);slider('traffic',48)
        assert page.evaluate('peds.every(p=>pedIdentity.has(p))&&cars.filter(v=>v.ai).every(v=>carIdentity.has(v))')
        assert counts()==identity
    assert page.evaluate('cars.filter(v=>v.ai).every(v=>Math.hypot(v.x-P.x,v.z-P.z)>=55&&!blockedVehicle(v,v.x,v.z,v.a))')
    page.evaluate('for(let i=0;i<180;i++)step();if(!cars.every(v=>Number.isFinite(v.x)&&Number.isFinite(v.z)&&Number.isFinite(v.rpm)))throw Error("Invalid populated traffic physics");')
    # Saved settings restore; malformed numbers cannot bypass finite stepped limits.
    slider('pedestrians',80);slider('traffic',32);page.reload(wait_until='load');page.wait_for_function('gameplay!==null',polling=50);assert counts()=={'peds':80,'traffic':32}
    page.evaluate("gameplay.save=()=>false;const d=JSON.parse(localStorage.getItem('bvc-progress-v1'));d.settings.pedestrians=9999;d.settings.traffic=-8;localStorage.setItem('bvc-progress-v1',JSON.stringify(d));")
    page.reload(wait_until='load');page.wait_for_function('gameplay!==null',polling=50);assert counts()=={'peds':128,'traffic':0}
    page.set_viewport_size({'width':390,'height':844});page.keyboard.press('h');page.locator('[data-pane="settings"]').click()
    for name in ['pedestrians','traffic']:
        el=page.locator('#'+name+'-setting');el.scroll_into_view_if_needed();box=el.bounding_box();assert box['x']>=0 and box['x']+box['width']<=390 and box['height']>=44,box
        assert el.get_attribute('aria-valuetext')
    page.screenshot(path=str(artifacts/'population-settings-narrow.png'))
    page.keyboard.press('Escape');page.evaluate('for(let i=0;i<90;i++)step();gameplay.captureVisual();gameplay.interpolateVisual(.5);gameplay.restoreVisual();')
    assert not errors,errors
    print('PASS: live sliders, keyboard, 0/max, owned-car protection, pooled reuse, safe spawns, saved values, validation and narrow viewport '+json.dumps(result),flush=True)
    browser.close()
