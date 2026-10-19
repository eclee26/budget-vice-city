"""Run with python tests/gameplay-browser.py --assets /path/to/cached-three-scripts.
Requires Python Playwright and Chromium. CDN requests use the cache when supplied.
The fixture owns a real origin so local saves and reloads exercise browser storage.
"""
from pathlib import Path
from urllib.parse import urlparse
import argparse, json, os, shutil
from playwright.sync_api import sync_playwright

parser=argparse.ArgumentParser()
parser.add_argument('--assets', type=Path)
args=parser.parse_args()
root=Path(__file__).resolve().parents[1]
source=(root/'index.html').read_text().replace('<script>\nconst T=10','<script>\nwindow.requestAnimationFrame=cb=>{window.nextFrame=cb;return 0};\nconst T=10')
errors=[]
def route(request):
    url=urlparse(request.request.url)
    if url.hostname=='game.test':
        if url.path in ['/','/index.html']: request.fulfill(body=source,content_type='text/html')
        elif url.path=='/gameplay.js': request.fulfill(body=(root/'gameplay.js').read_text(),content_type='text/javascript')
        else: request.fulfill(status=204,body='')
    elif args.assets and (args.assets/Path(url.path).name).exists():
        request.fulfill(body=(args.assets/Path(url.path).name).read_text(),content_type='text/javascript')
    else: request.continue_()
def watch(page):
    page.on('pageerror',lambda e: errors.append(str(e)))
    page.on('console',lambda m: errors.append(m.text) if m.type=='error' else None)
def render(page): page.evaluate('if(comp)comp.render();else r.render(S,cam)')
def steps(page,n):
    page.evaluate('n=>{for(let i=0;i<n;i++)step()}',n);render(page)
def load(context):
    page=context.new_page();watch(page);page.goto('https://game.test/',wait_until='load',timeout=60000)
    page.wait_for_function('gameplay!==null',polling=50);return page

def run_desktop(context):
    page=load(context)
    assert page.evaluate('gameplay.activity===null&&car===null')
    page.evaluate('''()=>{for(const v of cars)v.ai=null;const v=cars.find(v=>v.t.civic==='fd');P.x=v.x-Math.sin(v.a)*3;P.z=v.z+Math.cos(v.a)*3;}''')
    page.keyboard.press('e');assert page.evaluate('!!gameplay.transition&&!car')
    steps(page,20);assert page.evaluate('gameplay.transition.door.visible')
    steps(page,45);assert page.evaluate("car.t.civic==='fd'&&!gameplay.transition&&!P.o.visible")
    selected=page.evaluate('car.n')
    page.wait_for_function("gameAudio.ctx&&gameAudio.ctx.state==='running'",polling=50)
    page.keyboard.press('l');steps(page,1);assert page.evaluate("car.lightsMode==='on'&&spot.intensity===8")
    page.keyboard.press('l');steps(page,1);assert page.evaluate("car.lightsMode==='off'&&spot.intensity===0")
    page.keyboard.press('z');assert page.evaluate('car.ind===-1')
    page.keyboard.press('x');assert page.evaluate('car.ind===1')
    page.keyboard.press('v');assert page.evaluate('car.ind===2')
    page.keyboard.press('b');assert page.evaluate('gameplay.lastHorn>=0')
    page.evaluate('''()=>{const old=Date.now;Date.now=()=>0;carFx(car);Date.now=old;if(!car.il.every(light=>light.visible))throw new Error('Hazards missing');}''')
    page.keyboard.press('h');assert page.evaluate('help.open')
    assert page.locator('#gp-activities').is_visible()
    page.locator('[data-pane="settings"]').click();page.locator('#quality-setting').select_option('low')
    assert page.evaluate('!r.shadowMap.enabled&&graphics.detailRange===55')
    page.locator('#resolution-setting').fill('60');page.locator('#resolution-setting').dispatch_event('change')
    assert page.evaluate('gameplay.settings.resolution===60&&Math.abs(r.getPixelRatio()-.54)<.00001')
    page.locator('#fps-setting').check();page.evaluate('gameplay.frame(10000);gameplay.frame(10750)');assert page.locator('#fps-counter').is_visible()
    page.locator('#quality-setting').select_option('high');page.locator('#resolution-setting').fill('100');page.locator('#resolution-setting').dispatch_event('change')
    assert page.evaluate('r.shadowMap.enabled&&sun.shadow.mapSize.x===2048&&Math.abs(aa.uniforms.inverseResolution.value.x-1/(innerWidth*r.getPixelRatio()))<1e-10')
    render(page);page.screenshot(path='/tmp/gameplay-settings.png')
    page.locator('[data-pane="activities"]').click();page.locator('[data-activity="race"]').click();assert page.evaluate("!help.open&&gameplay.activity.kind==='race'")
    # Menu/hidden time never consumes a challenge timer.
    page.keyboard.press('h');assert page.evaluate('help.open')
    elapsed=page.evaluate('gameplay.activity.elapsed');page.evaluate('advanceSimulation(simLast+500)');assert page.evaluate('gameplay.activity.elapsed')==elapsed
    page.keyboard.press('Escape')
    # Pass each real generated checkpoint and confirm best times/completion records.
    page.evaluate('''()=>{while(gameplay.activity){const a=gameplay.activity,t=a.targets[a.index];if(tile(t.x,t.z)!==1)throw new Error('Off-road checkpoint');car.x=t.x;car.z=t.z;car.vx=car.vz=0;gameplay.updateActivity();}if(!gameplay.result.success)throw new Error('Race failed');}''')
    assert page.evaluate('gameplay.completed.race===1&&Number.isFinite(gameplay.best.race)&&!gameplay.marker.visible')
    page.evaluate("gameplay.startActivity('delivery')")
    page.evaluate('''()=>{const a=gameplay.activity,t=a.targets[0];car.x=t.x;car.z=t.z;car.vx=4;for(let i=0;i<100;i++)gameplay.updateActivity();if(a.index!==0||a.hold!==0)throw new Error('Moving delivery accepted');car.vx=car.vz=0;for(let i=0;i<91;i++)gameplay.updateActivity();if(a.index!==1)throw new Error('Pickup not accepted');const end=a.targets[1];car.x=end.x;car.z=end.z;for(let i=0;i<91;i++)gameplay.updateActivity();}''')
    assert page.evaluate('gameplay.completed.delivery===1')
    page.evaluate("gameplay.startActivity('parking')")
    page.evaluate('''()=>{const a=gameplay.activity,t=a.targets[0];car.x=t.x;car.z=t.z;car.a=t.a+.5;car.vx=car.vz=0;for(let i=0;i<190;i++)gameplay.updateActivity();if(a.hold!==0)throw new Error('Wrong-way parking accepted');car.a=t.a;for(let i=0;i<181;i++)gameplay.updateActivity();}''')
    assert page.evaluate('gameplay.completed.parking===1')
    page.evaluate("gameplay.startActivity('time');gameplay.activity.elapsed=gameplay.activity.limit-.01;gameplay.updateActivity()")
    assert page.evaluate('!gameplay.result.success&&!gameplay.best.time')
    # Persist an active activity, chosen car, location and preferences through reload.
    page.evaluate("gameplay.startActivity('time');gameplay.activity.elapsed=12;gameplay.activity.index=1;gameplay.settings.resolution=75;gameplay.applySettings();gameplay.save(true)")
    saved=page.evaluate('JSON.parse(localStorage.getItem("bvc-progress-v1"))')
    page.reload(wait_until='load');page.wait_for_function('gameplay!==null',polling=50)
    assert page.evaluate('car.n')==selected
    assert page.evaluate("gameplay.activity.kind==='time'&&gameplay.activity.index===1&&gameplay.activity.elapsed===12&&gameplay.settings.resolution===75&&gameplay.completed.race===1&&Math.hypot(car.vx,car.vz)===0")
    assert abs(page.evaluate('car.x')-saved['vehicle']['x'])<.001
    # Save failures and multi-tab conflicts stay playable and have retry guidance.
    page.evaluate('''()=>{const write=Storage.prototype.setItem;Storage.prototype.setItem=()=>{throw new DOMException('Full','QuotaExceededError')};if(gameplay.save(true))throw new Error('Denied save claimed success');Storage.prototype.setItem=write;}''')
    assert 'unavailable' in page.locator('#save-status').inner_text()
    page.evaluate('''()=>{window.dispatchEvent(new StorageEvent('storage',{key:'bvc-progress-v1',newValue:JSON.stringify({version:1,session:'another-tab',savedAt:Date.now()+1000})}));}''')
    assert page.evaluate('gameplay.conflict&&!gameplay.save()')
    page.evaluate('gameplay.save(true)');assert page.evaluate('!gameplay.conflict')
    page.evaluate("gameplay.finishActivity(false,'Cancelled in test.');car.vx=car.vz=0;gameplay.act()")
    steps(page,35);assert page.evaluate('gameplay.transition.exiting&&P.o.visible&&Math.hypot(P.x-car.x,P.z-car.z)>.1')
    steps(page,30);assert page.evaluate('!car&&!gameplay.transition&&P.o.visible')
    page.evaluate('gameplay.save()');page.reload(wait_until='load');page.wait_for_function('gameplay!==null',polling=50)
    assert page.evaluate('car===null&&gameplay.lastVehicle!==null')
    assert page.evaluate('gameplay.lastVehicle.n')==selected
    # Corrupt saves fall back to a playable world without executing or trusting values.
    page.evaluate("gameplay.save=()=>false;localStorage.setItem('bvc-progress-v1','{not json')");page.reload(wait_until='load');page.wait_for_function('gameplay!==null',polling=50)
    assert page.evaluate('car===null&&Number.isFinite(P.x)')
    assert 'could not be read' in page.locator('#save-status').inner_text()
    print('PASS desktop: entry/door/exit, horn/lights/signals, presets/resolution/FPS, all activities, pause, save/reload, denied/corrupt storage and cross-tab conflict',flush=True)
    # Predictive following and junction priority on production AI.
    data=page.evaluate('''()=>{
      for(const v of cars)v.ai=null;const straight=roads.filter(e=>{const a=e.points[0],b=e.points.at(-1),length=Math.hypot(b.x-a.x,b.z-a.z);return length>100&&e.points.every(p=>Math.abs((p.x-a.x)*(b.z-a.z)-(p.z-a.z)*(b.x-a.x))/length<.05)}).sort((a,b)=>b.points.length-a.points.length)[0];
      const path=driveLane(straight,1),a=path[15],b=path[65],bot=mkCar('Sedan'),obstacle=mkCar('Sedan');bot.x=a.x;bot.z=a.z;bot.a=a.a;bot.vx=Math.cos(a.a)*10;bot.vz=Math.sin(a.a)*10;bot.ai={e:straight,dir:1,path,i:15,stk:0};obstacle.x=b.x;obstacle.z=b.z;obstacle.a=b.a;obs=[bot,obstacle];let minimum=Infinity;
      for(let i=0;i<420;i++){trafficTick++;aiDrive(bot);minimum=Math.min(minimum,Math.hypot(bot.x-obstacle.x,bot.z-obstacle.z));}
      if(minimum<5||Math.hypot(bot.vx,bot.vz)>1)throw new Error('Predictive following failed: '+minimum);
      const node=nodes.find(n=>n.links.length>2);junctionClaims.clear();obs=[];const followers=node.links.slice(0,2).map(e=>{const dir=e.b===node?1:-1,lane=driveLane(e,dir),p=lane.at(-12),v=mkCar('Sedan');v.x=p.x;v.z=p.z;v.a=p.a;v.ai={e,dir,path:lane,i:lane.length-12,stk:0};return v});trafficTick++;aiDrive(followers[0]);aiDrive(followers[1]);if(junctionClaims.get(node)?.owner!==followers[0]||followers[1].ai.targetSpeed!==0)throw new Error('Junction priority failed');
      return{minimumFollowingDistance:minimum,stoppedSpeed:Math.hypot(bot.vx,bot.vz),junctionYield:true};}''')
    print('PASS traffic',json.dumps(data),flush=True)
    page.close()

def run_mobile(context):
    page=load(context)
    assert page.evaluate('gameplay.settings.motion===false')
    page.locator('#enter-control').tap();steps(page,65);assert page.evaluate('!!car')
    page.locator('#horn-control').tap();page.locator('#lights-control').tap();assert page.evaluate("car.lightsMode==='on'")
    page.locator('#help-open').tap();page.locator('[data-pane="settings"]').tap();page.locator('#quality-setting').select_option('low')
    assert page.evaluate('graphics.detailRange===55&&!r.shadowMap.enabled')
    page.locator('[data-pane="vehicle"]').tap();page.locator('#signal-hazard').tap();assert page.evaluate('car.ind===2')
    page.locator('[data-pane="activities"]').tap();page.locator('[data-activity="time"]').tap();assert page.evaluate('!!gameplay.activity&&!help.open')
    steps(page,1);page.screenshot(path='/tmp/gameplay-mobile.png')
    for width,height in [(320,740),(390,844),(844,390)]:
      page.set_viewport_size({'width':width,'height':height});page.evaluate('rs();gameplay.hud()')
      assert page.evaluate('''()=>{const a=document.getElementById('activity-hud').getBoundingClientRect(),s=document.getElementById('stick').getBoundingClientRect(),p=document.getElementById('pedals').getBoundingClientRect();const overlap=(x,y)=>x.left<y.right&&x.right>y.left&&x.top<y.bottom&&x.bottom>y.top;return a.left>=0&&a.right<=innerWidth&&!overlap(a,s)&&!overlap(a,p)}''')
      page.locator('#activity-menu').tap();page.locator('[data-pane="controls"]').tap();assert page.locator('.control-list').is_visible();page.locator('#help-close').tap()
    # Preserve simultaneous steering/pedals and camera touch pointers.
    page.set_viewport_size({'width':390,'height':844});page.evaluate('rs()');cdp=context.new_cdp_session(page)
    def center(id):
      box=page.locator('#'+id).bounding_box();return {'x':box['x']+box['width']/2,'y':box['y']+box['height']/2}
    stick={**center('stick'),'id':1};stick['x']+=25;gas={**center('accelerator'),'id':2};look={'x':220,'y':390,'id':3}
    cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[stick,gas,look]});assert page.evaluate("touch.x>.4&&pressed('w')&&drag===1")
    cdp.send('Input.dispatchTouchEvent',{'type':'touchCancel','touchPoints':[]});assert page.evaluate("touch.x===0&&!pressed('w')&&drag===0")
    print('PASS mobile: menu/actions/settings, activities, narrow/landscape layout, simultaneous steering/gas/camera and cancellation',flush=True);page.close()

with sync_playwright() as p:
    executable=os.environ.get('CHROMIUM_PATH') or shutil.which('chromium')
    browser=p.chromium.launch(**({'executable_path':executable} if executable else {}),headless=True,args=['--no-sandbox','--enable-unsafe-swiftshader'])
    desktop=browser.new_context(viewport={'width':1100,'height':720});desktop.route('**/*',route);run_desktop(desktop)
    mobile=browser.new_context(viewport={'width':390,'height':844},has_touch=True,is_mobile=True,device_scale_factor=2,reduced_motion='reduce');mobile.route('**/*',route);run_mobile(mobile)
    assert not errors,errors
    browser.close();print('PASS: no browser or shader errors')
