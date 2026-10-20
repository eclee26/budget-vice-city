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
parser.add_argument('--only-pov', action='store_true')
parser.add_argument('--only-headlights', action='store_true')
parser.add_argument('--only-structures', action='store_true')
parser.add_argument('--only-traffic', action='store_true')
parser.add_argument('--only-exit', action='store_true')
parser.add_argument('--only-signals', action='store_true')
args=parser.parse_args()
root=Path(__file__).resolve().parents[1]
source=(root/'index.html').read_text(encoding='utf-8').replace('<script>\nconst T=10','<script>\nwindow.requestAnimationFrame=cb=>{window.nextFrame=cb;return 0};\nconst T=10')
artifacts=root/'tests'/'artifacts'
artifacts.mkdir(exist_ok=True)
errors=[]
def route(request):
    url=urlparse(request.request.url)
    if url.hostname=='game.test':
        if url.path in ['/','/index.html']: request.fulfill(body=source,content_type='text/html')
        elif url.path=='/live.html': request.fulfill(body=(root/'index.html').read_text(encoding='utf-8'),content_type='text/html')
        elif url.path in ['/multiplayer.js','/multiplayer.css','/gameplay.js','/open-world.js','/world-streaming.js','/vehicle-dynamics.js','/structures.js','/traffic-signals.js','/world-detail.js','/driving.css']: request.fulfill(body=(root/url.path[1:]).read_text(encoding='utf-8'),content_type='text/css' if url.path.endswith('.css') else 'text/javascript')
        else: request.fulfill(status=204,body='')
    elif args.assets and (args.assets/Path(url.path).name).exists():
        request.fulfill(body=(args.assets/Path(url.path).name).read_text(encoding='utf-8'),content_type='text/javascript')
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
    page.keyboard.press('l');steps(page,1);assert page.evaluate("car.lightsMode==='on'&&headlights.every(light=>light.intensity===HEADLIGHT_BEAM.intensity)")
    page.keyboard.press('l');steps(page,1);assert page.evaluate("car.lightsMode==='off'&&headlights.every(light=>light.intensity===0)")
    page.keyboard.press('z');assert page.evaluate('car.ind===-1')
    page.keyboard.press('x');assert page.evaluate('car.ind===1')
    page.keyboard.press('v');assert page.evaluate('car.ind===2')
    page.keyboard.press('b');assert page.evaluate('gameplay.lastHorn>=0')
    page.evaluate('''()=>{carFx(car);if(!car.il.every(light=>light.visible))throw new Error('Hazards missing');}''')
    page.keyboard.press('h');assert page.evaluate('help.open')
    assert page.locator('#gp-activities').is_visible()
    page.locator('[data-pane="settings"]').click();page.locator('#quality-setting').select_option('low')
    assert page.evaluate('!r.shadowMap.enabled&&graphics.detailRange===55')
    page.locator('#resolution-setting').fill('60');page.locator('#resolution-setting').dispatch_event('change')
    assert page.evaluate('gameplay.settings.resolution===60&&Math.abs(r.getPixelRatio()-.54)<.00001')
    page.locator('#fps-setting').check();page.evaluate('gameplay.frame(10000);gameplay.frame(10750)');assert page.locator('#fps-counter').is_visible()
    page.locator('#quality-setting').select_option('high');page.locator('#resolution-setting').fill('100');page.locator('#resolution-setting').dispatch_event('change')
    assert page.evaluate('r.shadowMap.enabled&&sun.shadow.mapSize.x===2048&&Math.abs(aa.uniforms.inverseResolution.value.x-1/(innerWidth*r.getPixelRatio()))<1e-10')
    render(page);page.screenshot(path=str(artifacts/'gameplay-settings.png'))
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
    steps(page,1);page.screenshot(path=str(artifacts/'gameplay-mobile.png'))
    for width,height in [(320,740),(390,844),(844,390)]:
      page.set_viewport_size({'width':width,'height':height});page.evaluate('rs();gameplay.hud()')
      assert page.evaluate('''()=>{const a=document.getElementById('activity-hud').getBoundingClientRect(),s=document.getElementById('stick').getBoundingClientRect(),p=document.getElementById('pedals').getBoundingClientRect();const overlap=(x,y)=>x.left<y.right&&x.right>y.left&&x.top<y.bottom&&x.bottom>y.top;return a.left>=0&&a.right<=innerWidth&&!overlap(a,s)&&!overlap(a,p)}''')
      page.evaluate('gameplay.notify("Checkpoint cleared. Follow the next target.")')
      assert page.evaluate('''()=>{const n=document.getElementById('game-notice').getBoundingClientRect(),a=document.getElementById('activity-hud').getBoundingClientRect(),p=document.getElementById('touch-actions').getBoundingClientRect();const overlap=(x,y)=>x.left<y.right&&x.right>y.left&&x.top<y.bottom&&x.bottom>y.top;return n.left>=0&&n.right<=innerWidth&&n.bottom<=innerHeight&&!overlap(n,a)&&!overlap(n,p)}''')
      page.locator('#activity-menu').tap();page.locator('[data-pane="controls"]').tap();assert page.locator('.control-list').is_visible();page.locator('#help-close').tap()
    # Preserve simultaneous steering/pedals and camera touch pointers.
    page.set_viewport_size({'width':390,'height':844});page.evaluate('rs()');cdp=context.new_cdp_session(page)
    def center(id):
      box=page.locator('#'+id).bounding_box();return {'x':box['x']+box['width']/2,'y':box['y']+box['height']/2}
    stick={**center('stick'),'id':1};stick['x']+=25;gas={**center('accelerator'),'id':2};look={'x':220,'y':390,'id':3}
    cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[stick,gas,look]});assert page.evaluate("touch.x>.4&&pressed('w')&&drag===1")
    cdp.send('Input.dispatchTouchEvent',{'type':'touchCancel','touchPoints':[]});assert page.evaluate("touch.x===0&&!pressed('w')&&drag===0")
    print('PASS mobile: menu/actions/settings, activities, narrow/landscape layout, simultaneous steering/gas/camera and cancellation',flush=True);page.close()

def run_improvements(context):
    page=load(context)
    assert page.locator('#game-boot').is_hidden()
    page.evaluate('''()=>{for(const v of cars)v.ai=null;const v=cars.find(v=>v.n==='Sedan');P.x=v.x-Math.sin(v.a)*4;P.z=v.z+Math.cos(v.a)*4;gameplay.hud();}''')
    assert page.locator('#interaction-prompt').is_visible()
    assert page.evaluate("!S.children.some(o=>o.type==='BoxHelper')")
    page.locator('#interaction-prompt').click();steps(page,65);assert page.evaluate('!!car')
    # Map toggles on keyboard and button; Tab remains available to focus controls.
    page.keyboard.press('g');assert page.locator('#map-toggle').get_attribute('aria-expanded')=='true'
    assert page.evaluate('document.getElementById("mm").width===600')
    page.locator('#map-toggle').click();assert page.locator('#map-toggle').get_attribute('aria-expanded')=='false'
    page.keyboard.press('h');page.locator('[data-pane="settings"]').click()
    page.locator('#units-setting').select_option('mph');page.locator('#steering-setting').fill('125');page.locator('#steering-setting').dispatch_event('change')
    page.locator('#camera-setting').fill('150');page.locator('#camera-setting').dispatch_event('change')
    page.locator('#shake-setting').uncheck();page.locator('#blur-setting').uncheck();page.locator('#motion-setting').uncheck()
    page.keyboard.press('Escape');steps(page,1)
    assert page.locator('.unit').inner_text()=='MPH'
    assert page.evaluate('gameplay.settings.steering===1.25&&gameplay.settings.cameraSensitivity===1.5&&!gameplay.settings.shake&&!gameplay.settings.blur')
    # Interpolation changes only rendered transforms and restores authoritative state.
    page.evaluate('''()=>{gameplay.captureVisual();const buffer=gameplay.visualPrevious,p=buffer[0].position;gameplay.captureVisual();if(buffer!==gameplay.visualPrevious||p!==gameplay.visualPrevious[0].position)throw Error('Interpolation allocated a new pose buffer');}''')
    page.evaluate('''()=>{gameplay.captureVisual();car.o.position.x+=2;cam.position.x+=2;const x=car.o.position.x,cx=cam.position.x,physics=car.x;gameplay.interpolateVisual(.5);if(Math.abs(car.o.position.x-(x-1))>.001||Math.abs(cam.position.x-(cx-1))>.001)throw Error('Interpolation failed');if(car.x!==physics)throw Error('Interpolation changed physics');gameplay.restoreVisual();if(car.o.position.x!==x||cam.position.x!==cx)throw Error('Render state not restored');}''')
    page.evaluate("gameplay.startActivity('race');car.dmg=105;gameplay.activity.elapsed=7;")
    # Recovery keeps damage and elapsed challenge time, clears motion and uses an unoccupied road.
    page.keyboard.press('h');page.locator('[data-pane="vehicle"]').click();page.locator('#recover-vehicle').click()
    assert page.evaluate('car.dmg===105&&gameplay.activity.elapsed===7&&Math.hypot(car.vx,car.vz)===0&&tile(car.x,car.z)===1&&!blockedVehicle(car,car.x,car.z)&&!cars.some(v=>v!==car&&vehicleOverlap(car,v))')
    page.keyboard.press('Escape');steps(page,1);assert page.locator('#rpm-bar').is_visible()
    page.evaluate('gameplay.notify("Routine driving message")');assert page.evaluate('document.getElementById("game-notice").getBoundingClientRect().top>innerHeight/2')
    page.evaluate('gameplay.save()');page.reload(wait_until='load');page.wait_for_function('gameplay!==null')
    assert page.evaluate("gameplay.settings.units==='mph'&&gameplay.settings.steering===1.25&&gameplay.settings.cameraSensitivity===1.5&&!gameplay.settings.blur&&!gameplay.settings.shake")
    render(page);page.screenshot(path=str(artifacts/'driving-improvements.png'));page.close()
    print('PASS improvements: entry prompt without wireframe, map, units, settings persistence, interpolation, recovery and instruments',flush=True)

def run_loading_failure(browser):
    context=browser.new_context();context.route('**/*',route)
    context.route('**/three.min.js',lambda request: request.abort())
    page=context.new_page();page.goto('https://game.test/',wait_until='load')
    assert page.locator('#boot-retry').is_visible()
    assert 'could not start' in page.locator('#boot-title').inner_text()
    context.close();print('PASS loading failure: readable graphics error and retry action',flush=True)

def run_live_frames(browser):
    context=browser.new_context(viewport={'width':1000,'height':700});context.route('**/*',route)
    page=context.new_page();watch(page);page.goto('https://game.test/live.html',wait_until='load');page.wait_for_function('gameplay!==null')
    page.keyboard.press('e');page.wait_for_function('!!car&&!gameplay.transition',timeout=60000)
    page.keyboard.down('w');page.wait_for_function('Math.hypot(car.vx,car.vz)>3',timeout=60000);page.keyboard.up('w')
    assert page.evaluate('gameplay.elapsed>1&&!!gameplay.visualPrevious&&gameplay.visualCurrent===null')
    page.keyboard.press('h');page.wait_for_function('help.open');elapsed=page.evaluate('gameplay.elapsed')
    page.wait_for_timeout(250);assert page.evaluate('gameplay.elapsed')==elapsed
    page.keyboard.press('Escape');page.wait_for_function('!help.open&&gameplay.elapsed>'+str(elapsed))
    page.screenshot(path=str(artifacts/'live-driving.png'));context.close()
    print('PASS live frames: real animation loop, driving, interpolation restoration and pause/resume',flush=True)

def run_headlights(context):
    page=load(context)
    page.evaluate('''()=>{
      if(headlights.length!==2||headlights.some(l=>l.castShadow))throw Error('Expected two inexpensive low beams');
      for(const v of cars)for(const heading of [0,Math.PI/2,-2.4])for(const pitch of [-.055,0,.055]){
        car=v;v.lightsMode='on';v.o.position.set(220,.08,220);v.o.rotation.set(.06,-heading,pitch);updateHeadlights();
        const left=headlights[0],right=headlights[1];if(left.position.distanceTo(right.position)<v.t.W*.5)throw Error('Beams must originate at separate lamps');
        for(const light of headlights){const dx=light.target.position.x-light.position.x,dz=light.target.position.z-light.position.z,dy=light.target.position.y-light.position.y;
          if(Math.abs(Math.hypot(dx,dz)-5)>.001||dy>=0)throw Error('Beam must aim downward at road five metres ahead');
          if(HEADLIGHT_BEAM.cutoff<=0||HEADLIGHT_BEAM.cutoffSoft<=HEADLIGHT_BEAM.cutoff||HEADLIGHT_BEAM.spread<.5)throw Error('Expected a wide beam with downward cutoff');}
      }
      const v=cars.find(v=>v.n==='Sedan')||cars[0],p=lanePoint(roads[0],Math.floor(roads[0].points.length/2));car=v;v.ai=null;v.x=p.x;v.z=p.z;v.a=p.a;v.vx=v.vz=0;v.contacts=null;v.o.visible=true;P.x=v.x;P.z=v.z;P.a=v.a;P.o.visible=false;v.lightsMode='on';tod=.02;step();
      cam.position.set(v.x-Math.cos(v.a)*8,4.3,v.z-Math.sin(v.a)*8);cam.lookAt(v.x+Math.cos(v.a)*5,0,v.z+Math.sin(v.a)*5);cam.updateMatrixWorld();updateHeadlights();if(fin)fin.uniforms.ex.value=.98+.32*night;
      gameplay.captureVisual();v.o.position.x+=.25;gameplay.interpolateVisual(.5);updateHeadlights();
      const dx=headlights[0].position.x-v.o.position.x,dz=headlights[0].position.z-v.o.position.z;if(Math.hypot(dx,dz)>v.t.L)throw Error('Light did not follow rendered pose');gameplay.restoreVisual();updateHeadlights();
    }''')
    # Probe the actual shader output: the ground/shoulder must be lit and an
    # otherwise identical surface above the lamps must remain dark.
    page.evaluate('''()=>{
      const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(25,1,.01,50),target=new THREE.WebGLRenderTarget(32,32),pixels=new Uint8Array(4),oldTarget=r.getRenderTarget();
      const geometry=new THREE.PlaneGeometry(.25,.25),material=new THREE.MeshStandardMaterial({color:0x333333,roughness:1}),panel=new THREE.Mesh(geometry,material);panel.rotation.y=-Math.PI/2;scene.add(panel);
      for(const side of [-1,1]){const light=new THREE.SpotLight(0xe5eeff,HEADLIGHT_BEAM.intensity,HEADLIGHT_BEAM.range,.65,.3,1.3);light.position.set(0,.78,side*.6);light.target.position.set(5,.012,side*.6);scene.add(light,light.target);}
      const probe=(y,z)=>{panel.position.set(10,y,z);camera.position.set(0,y,z);camera.lookAt(10,y,z);r.setRenderTarget(target);r.render(scene,camera);r.readRenderTargetPixels(target,16,16,1,1,pixels);return pixels[0]+pixels[1]+pixels[2];};
      try{const core=probe(.08,0),shoulder=probe(.08,2.5),above=probe(1.1,0);if(core<30||shoulder<core*.2)throw Error('Beam does not spread across the road');if(above>Math.max(3,core*.02))throw Error('Light leaks above the low-beam cutoff');
        scene.add(new THREE.AmbientLight(0xffffff,.3));for(const light of scene.children)if(light.isSpotLight){light.intensity=0;light.position.set(0,0,0);light.target.position.set(0,0,0);}if(probe(.08,0)<15)throw Error('Disabled lamps corrupt ambient shading');}
      finally{r.setRenderTarget(oldTarget);geometry.dispose();material.dispose();target.dispose();}
    }''')
    render(page);page.screenshot(path=str(artifacts/'headlights-night.png'))
    page.evaluate("car.lightsMode='off';updateHeadlights();if(headlights.some(l=>l.intensity!==0))throw Error('Off beams still illuminate');car=null;updateHeadlights();if(headlights.some(l=>l.intensity!==0))throw Error('Unoccupied beams still illuminate');")
    page.close();print('PASS headlights: dual lamp origins, 5 m road targets, wide surface illumination, downward cutoff, pitch/heading, interpolated poses and off/exit states',flush=True)

def run_pov(context):
    page=load(context)
    page.evaluate('''()=>{const v=cars.find(v=>v.n==='Sedan')||cars[0];v.ai=null;car=v;P.x=v.x;P.z=v.z;P.o.visible=false;camMode=0;step();}''')
    for mode in [1,2,3]:
        page.keyboard.press('c');steps(page,1);assert page.evaluate('camMode')==mode
    assert page.evaluate('gameplay.povCabin.visible&&!car.o.visible&&cam.fov===58')
    page.evaluate('''()=>{const eye=cam.position.clone().sub(car.o.position).applyQuaternion(car.o.quaternion.clone().invert());if(Math.abs(eye.x+.30*car.t.L/4.55)>.025||Math.abs(eye.z+.40*car.t.W/1.82)>.025)throw Error('POV not in driver seat');const old=zm;document.getElementById('world').dispatchEvent(new WheelEvent('wheel',{deltaY:120}));if(zm!==old)throw Error('POV zoom moved the seat');yo=.6;pt=.1;step();if(!Number.isFinite(cam.position.y))throw Error('Invalid look-around pose');}''')
    page.evaluate('''()=>{yo=pt=0;gameplay.settings.motion=false;car.st=.2;gameplay.updatePovCabin();if(Math.abs(gameplay.povWheel.rotation.x+1.8)>.001)throw Error('Steering wheel not animated');gameplay.save();}''')
    page.reload(wait_until='load');page.wait_for_function('gameplay!==null');steps(page,1)
    assert page.evaluate('camMode===3&&cam.fov===58&&gameplay.povCabin.visible&&!gameplay.settings.motion')
    render(page);page.screenshot(path=str(artifacts/('driver-pov-mobile.png' if page.evaluate('navigator.maxTouchPoints>0') else 'driver-pov.png')))
    page.keyboard.press('h');page.locator('[data-pane="vehicle"]').click()
    assert page.locator('#menu-camera').inner_text()=='Camera: Driver POV'
    page.locator('#menu-camera').click();assert page.evaluate('camMode===0');page.keyboard.press('Escape');steps(page,1)
    assert page.evaluate('car.o.visible&&!gameplay.povCabin.visible')
    # Every model has a finite eye pose; the bike gets handlebars instead of a car cabin.
    page.evaluate('''()=>{for(const v of cars){car=v;v.ai=null;camMode=3;yo=pt=0;step();if(![cam.position.x,cam.position.y,cam.position.z].every(Number.isFinite)||cam.fov!==58)throw Error('Invalid model POV');if(gameplay.povBike.visible!==(v.n==='Bike'))throw Error('Wrong cabin variant');}car=null;gameplay.updatePovCabin();if(gameplay.povCabin.visible)throw Error('Cabin remains on foot');}''')
    page.close();print('PASS POV: camera cycle, eye position, steering, fixed FOV, look-around, menu, persistence, model variants and exit cleanup',flush=True)

def run_structures(context):
    page=load(context)
    summary=page.evaluate('''()=>{
      const lots=structurePlan.lots,houses=buildings.filter(b=>b.kind==='house2'),styles=new Set(houses.map(b=>b.variant%5));
      if(lots.length!==9||styles.size!==5||houses.some(b=>b.height<6))throw Error('Missing civic lot or two-storey house variation');
      if(new Set(buildings.filter(b=>b.kind==='fuel').map(b=>b.brand)).size!==2)throw Error('Fuel brands missing');
      for(const lot of lots){
        for(let j=lot.j;j<lot.j+lot.nz;j++)for(let i=lot.i;i<lot.i+lot.nx;i++)if(mallTiles.has(i+','+j)||!structurePlan.tiles.has(i+','+j))throw Error('Lot reservation mismatch');
        const a=lot.access,dx=a.endX-a.x,dz=a.endZ-a.z,d=Math.hypot(dx,dz)||1;
        for(let step=0;step<=d;step+=.5){const x=a.x+dx*step/d,z=a.z+dz*step/d;if(solid(x,z))throw Error('Blocked access: '+lot.kind);}
        if(lot.kind==='fuel'){const c=Math.cos(lot.angle),s=Math.sin(lot.angle),point=(x,z)=>({x:lot.x+c*x+s*z,z:lot.z-s*x+c*z});const forecourt=point(0,7),pump=point(0,1.6);if(tile(forecourt.x,forecourt.z)!==1||solid(forecourt.x,forecourt.z)||!solid(pump.x,pump.z))throw Error('Fuel forecourt/pump collision mismatch');
          for(let step=0;step<=d;step+=1){const x=a.x+dx*step/d,z=a.z+dz*step/d,v={t:TY.Sedan,x,z,a:Math.atan2(dz,dx)};if(blockedVehicle(v,x,z))throw Error('Driveway too narrow for a sedan');}}
      }
      for(const list of structurePlan.solids.values())for(const b of list)for(const x of[b.minX,b.maxX])for(const z of[b.minZ,b.maxZ])if(inMask(asphaltMask,x,z)||inMask(sidewalkMask,x,z))throw Error('Structure blocks a road/sidewalk');
      return{lots:lots.map(l=>({kind:l.kind,x:l.x,z:l.z})),twoStoreyHouses:houses.length,houseVariations:styles.size,collisionCells:structurePlan.solids.size};
    }''')
    for kind in ['fuel','police','playground','clinic','workshop','house2']:
        variants=[0,1] if kind=='fuel' else list(range(5)) if kind=='house2' else [0]
        for variant in variants:
            page.evaluate('''({kind,variant})=>{const b=buildings.find(b=>b.kind===kind&&(kind==='house2'?b.variant%5===variant:b.variant===variant)),a=b.angle,c=Math.cos(a),s=Math.sin(a);car=null;P.x=b.x;P.z=b.z;P.o.visible=false;tod=.4;dayNight();positionSun(P.x,P.z);updateScenery();gameplay.hud();cam.fov=60;cam.updateProjectionMatrix();cam.position.set(b.x+c*14+s*25,kind==='house2'?11:15,b.z-s*14+c*25);cam.lookAt(b.x,kind==='house2'?3:1.5,b.z);if(comp){fin.uniforms.ex.value=.98+.32*night;comp.render();}else r.render(S,cam);}''',{'kind':kind,'variant':variant})
            page.screenshot(path=str(artifacts/f'structure-{kind}-{variant}.png'))
    print('PASS structures',json.dumps(summary),flush=True);page.close()

def run_traffic_signals(context):
    page=load(context)
    result=page.evaluate('''()=>{
      const locals=roads.filter(e=>e.width===10);if(locals.length!==5||!roads.some(e=>e.width===18)||!roads.some(e=>e.width===22))throw Error('Missing width variety');
      for(const e of locals)for(const dir of[-1,1])for(let i=25;i<e.points.length-25;i+=15){const p=lanePoint(e,i,dir),v={t:TY.Van,...p};if(tile(p.x,p.z)!==1||blockedVehicle(v,p.x,p.z))throw Error('Narrow lane clearance failed');}
      for(const node of trafficSignals)for(const [second,axis,state]of [[0,0,'green'],[18.5,0,'amber'],[21.5,0,'red'],[23.5,1,'green'],[41.5,1,'amber'],[44.5,1,'red']]){
        const tick=(second-node.signal.offset)*60,phase=signalPhase(node,tick);if(phase.axis!==axis||phase.state!==state)throw Error('Signal timing mismatch');
        for(const [edge,a]of node.signal.approaches)if(signalState(node,edge,tick)!==(a.axis===axis?state:'red'))throw Error('Conflicting signal directions');
      }
      for(const v of cars)v.ai=null;obs=[];junctionClaims.clear();const node=trafficSignals[0],a=[...node.signal.approaches.values()].find(a=>a.axis===1),fx=Math.cos(a.stop.a),fz=Math.sin(a.stop.a);
      const make=(gap,sp)=>{const v=mkCar('Sedan');v.x=a.stop.x-fx*(gap+v.t.L/2);v.z=a.stop.z-fz*(gap+v.t.L/2);v.a=a.stop.a;v.vx=fx*sp;v.vz=fz*sp;const path=driveLane(a.edge,a.dir);let index=0,distance=Infinity;path.forEach((p,i)=>{const d=Math.hypot(p.x-v.x,p.z-v.z);if(d<distance){distance=d;index=i;}});v.ai={e:a.edge,dir:a.dir,path,i:index,stk:0};return v;};
      trafficTick=0;const bot=make(32,10);let minimum=Infinity;for(let i=0;i<600;i++){aiDrive(bot);minimum=Math.min(minimum,(a.stop.x-bot.x)*fx+(a.stop.z-bot.z)*fz-bot.t.L/2);}
      if(minimum<-.2||Math.hypot(bot.vx,bot.vz)>.15||bot.ai.stk!==0)throw Error('Red-light stop failed: '+minimum);
      trafficTick=23.5*60;junctionClaims.clear();let crossed=false;for(let i=0;i<350;i++){aiDrive(bot);if((bot.x-a.stop.x)*fx+(bot.z-a.stop.z)*fz>10)crossed=true;}if(!crossed)throw Error('Traffic did not resume on green');
      trafficTick=41.5*60;const far=make(28,5),near=make(2,10);if(!trafficSignalRule(far).hold||trafficSignalRule(near).hold)throw Error('Amber dilemma handling failed');
      trafficTick=0;const clearing=make(-1,5);if(trafficSignalRule(clearing).hold)throw Error('Clearing traffic stopped inside junction');
      const old=trafficTick;openHelp();advanceSimulation(simLast+1000);if(trafficTick!==old)throw Error('Signal clock advanced while paused');help.close();
      P.x=node.x;P.z=node.z;P.o.visible=false;car=null;tod=.4;dayNight();positionSun(P.x,P.z);updateScenery();updateTrafficSignals();updateHud();
      // Ground markings must remain visible above the depth-biased road ribbons.
      const target=new THREE.WebGLRenderTarget(64,64),probeCam=new THREE.OrthographicCamera(-3,3,3,-3,.1,50),pixel=new Uint8Array(4),oldTarget=r.getRenderTarget();probeCam.position.set(a.stop.x,30,a.stop.z);probeCam.up.set(0,0,-1);probeCam.lookAt(a.stop.x,0,a.stop.z);probeCam.updateMatrixWorld();
      try{r.setRenderTarget(target);r.render(S,probeCam);const sample=(x,z)=>{const p=new THREE.Vector3(x,.04,z).project(probeCam);r.readRenderTargetPixels(target,Math.max(0,Math.min(63,Math.floor((p.x*.5+.5)*64))),Math.max(0,Math.min(63,Math.floor((p.y*.5+.5)*64))),1,1,pixel);return pixel[0]+pixel[1]+pixel[2];};const line=sample(a.stop.x,a.stop.z),road=sample(a.stop.x-fx*.9,a.stop.z-fz*.9);if(line<road*1.25)throw Error('Stop line hidden by road surface');}finally{r.setRenderTarget(oldTarget);target.dispose();}
      cam.position.set(a.stop.x-fx*18,7,a.stop.z-fz*18);cam.lookAt(node.x,1.3,node.z);cam.fov=60;cam.updateProjectionMatrix();if(comp){fin.uniforms.ex.value=.98+.32*night;comp.render();}else r.render(S,cam);
      return{localRoads:locals.length,signalJunctions:trafficSignals.length,minimumStopLineGap:minimum,greenResume:crossed};
    }''')
    page.screenshot(path=str(artifacts/'traffic-signals.png'))
    page.evaluate('''()=>{const e=roads.find(e=>e.width===10&&Math.abs(e.b.z-e.a.z)<1),p=lanePoint(e,Math.floor(e.points.length/2));P.x=p.x;P.z=p.z;positionSun(P.x,P.z);updateScenery();updateTrafficSignals();updateHud();cam.position.set(p.x-Math.cos(p.a)*18-Math.sin(p.a)*4.5,7,p.z-Math.sin(p.a)*18+Math.cos(p.a)*4.5);cam.lookAt(p.x+Math.cos(p.a)*20,0,p.z+Math.sin(p.a)*20);if(comp)comp.render();else r.render(S,cam);}''')
    page.screenshot(path=str(artifacts/'narrow-neighbourhood-road.png'));page.close();print('PASS signals and narrow roads',json.dumps(result),flush=True)

def run_vehicle_signals(context):
    page=load(context)
    result=page.evaluate('''()=>{
      const g=gameplay,check=(c,m)=>{if(!c)throw Error(m)};resetInput();
      for(const v of cars){v.ai=null;v.policeActive=false;v.ind=0;v.vx=v.vz=v.yr=0;}
      const selected=Object.keys(TY).map(name=>cars.find(v=>v.n===name)||mkCar(name));
      let modes=0;
      for(const v of selected){car=v;P.x=v.x;P.z=v.z;P.a=v.a;g.transition=null;v.ind=0;updateScenery();
        check(v.il.length>0,'Indicator meshes missing: '+v.n);
        for(let i=0;i<120;i++){trafficTick++;carFx(v);updateScenery();check(v.il.every(l=>!l.visible),'Off lamps revived by detail refresh: '+v.n);}
        for(const mode of[-1,1,2]){
          g.signal(mode);const start=trafficTick;
          for(let tick=0;tick<108;tick++){trafficTick=start+tick;carFx(v);updateScenery();const on=tick%54<27;check(v.il.every(l=>l.visible===(on&&(mode===2||l.side_===mode))),'Blink cadence/side changed by LOD: '+v.n);}
          g.signal(mode);check(v.ind===0&&v.il.every(l=>!l.visible),'Toggle off did not update lamps immediately: '+v.n);
          for(let tick=0;tick<60;tick++){trafficTick++;carFx(v);updateScenery();check(v.il.every(l=>!l.visible),'Off state did not persist: '+v.n);}
          modes++;
        }
        g.signal(2);const epoch=trafficTick;car=null;P.x=v.x+220;P.z=v.z+220;updateScenery();check(v.il.every(l=>!l.visible),'Hidden-body lamps remain visible');
        car=v;P.x=v.x;P.z=v.z;updateScenery();check(trafficTick===epoch&&v.il.every(l=>l.visible),'Returning detail changed blink phase');g.signal(2);
      }
      return{models:selected.length,modes,cycleSeconds:.9,refreshCannotEnableOffLights:true};
    }''')
    page.keyboard.press('z');assert page.evaluate('car.ind===-1')
    page.keyboard.press('z');assert page.evaluate('car.ind===0&&car.il.every(l=>!l.visible)')
    page.keyboard.press('h');page.locator('[data-pane="vehicle"]').click()
    page.locator('#signal-hazard').click();assert page.evaluate('car.ind===2&&car.il.every(l=>l.visible)')
    page.locator('#signal-hazard').click();assert page.locator('#signal-hazard').get_attribute('aria-pressed')=='false'
    assert page.evaluate('car.ind===0&&car.il.every(l=>!l.visible)')
    page.evaluate('updateScenery()');assert page.evaluate('car.il.every(l=>!l.visible)')
    page.locator('#signal-left').click()
    pause=page.evaluate('({tick:trafficTick,lights:car.il.map(l=>l.visible)})')
    page.evaluate('advanceSimulation(simLast+1000);carFx(car);updateScenery()')
    assert page.evaluate('({tick:trafficTick,lights:car.il.map(l=>l.visible)})')==pause
    page.locator('#signal-left').click();page.keyboard.press('Escape');steps(page,120)
    assert page.evaluate('car.ind===0&&car.il.every(l=>!l.visible)')
    page.close();print('PASS vehicle indicators: stable cadence, side selection, off/LOD, keyboard/menu and pause '+json.dumps(result),flush=True)

def run_vehicle_exit(context):
    page=load(context)
    result=page.evaluate('''()=>{
      const g=gameplay,check=(c,m)=>{if(!c)throw Error(m)};
      resetInput();for(const v of cars){v.ai=null;v.policeActive=false;v.vx=v.vz=v.yr=0;}
      const selected=['Sedan','Kaze R','Honda Civic FD 2009','Bike'].map(name=>cars.find(v=>v.n===name)||mkCar(name));
      let point=null;
      for(const e of roads)for(let i=30;i<e.points.length-30;i+=12){const p=lanePoint(e,i,1,0);if(g.clearFootprint({...p,a:0},{L:9,W:9})&&!cars.some(v=>Math.hypot(v.x-p.x,v.z-p.z)<14)){point=p;break;}if(point)break;}
      check(!!point,'No clear vehicle-exit test location');let count=0;
      for(const v of selected)for(const a of[0,Math.PI/2,Math.PI,-Math.PI/2]){
        Object.assign(v,{x:point.x,z:point.z,a,vx:.1,vz:0,yr:0,g:1,thr:.7,brk:.6,hold:17,contacts:null});
        car=v;P.x=v.x;P.z=v.z;P.a=v.a;P.o.visible=false;g.transition=null;
        const x=v.x,z=v.z;g.act();check(g.transition?.exiting&&g.transition.point.side===-1,'Exit must select left side');
        if(v.n!=='Bike')check(g.transition.door.position.z<0&&g.transition.door.position.x>0,'Wrong door');
        let frames=0;while(g.transition&&frames++<70){k.s=1;step();check(Math.hypot(v.x-x,v.z-z)<1e-6,'Car moved during exit');check(v.g===1,'Exit selected reverse');}
        check(!car&&!g.transition&&frames>=50,'Exit did not finish');resetInput();
        const dx=P.x-v.x,dz=P.z-v.z,along=dx*Math.cos(a)+dz*Math.sin(a),lateral=-dx*Math.sin(a)+dz*Math.cos(a);
        check(lateral<-v.t.W/2,'Player did not leave on the left');if(v.n!=='Bike')check(along>0,'Player did not leave through front door');
        for(let i=0;i<60;i++)step();check(Math.hypot(v.x-x,v.z-z)<1e-6&&v.g===1,'Parked car creeps after exit');count++;
        v.x=point.x+40+count*8;v.z=point.z;v.vx=v.vz=0;
      }
      const v=selected[0];Object.assign(v,{x:point.x,z:point.z,a:0,vx:0,vz:0,yr:0,g:-1,thr:.5,hold:17});car=v;P.x=v.x;P.z=v.z;g.act();
      while(g.transition)step();for(let i=0;i<60;i++)step();check(v.g===-1&&Math.hypot(v.x-point.x,v.z-point.z)<1e-6,'Reverse gear exit creeps');
      car=v;P.x=v.x;P.z=v.z;const left=g.exitPoint(v,-1,true),right=g.exitPoint(v,1,true);check(left&&right,'Blocked-door fixture requires two clear sides');
      const original=structurePlan.solids;structurePlan.solids=new Map([...original].map(([key,list])=>[key,[...list]]));
      try{structureCollider({x:left.x,z:left.z,angle:0,kind:'test-wall'},0,0,1.5,1.5);g.act();check(car===v&&!g.transition,'Blocked left door switched sides');check(document.getElementById('game-notice').textContent.includes('front-left'),'Blocked-door feedback missing');}
      finally{structurePlan.solids=original;}
      resetInput();g.act();for(let i=0;i<30;i++)step();check(g.transition?.door.rotation.y<0,'Left door must swing outward');
      return{headingsAndModels:count,reverseExit:true,blockedLeft:true,maxPositionDrift:0};
    }''')
    render(page);page.screenshot(path=str(artifacts/'vehicle-front-left-exit.png'))
    page.close();print('PASS front-left exit and stationary parking brake '+json.dumps(result),flush=True)

with sync_playwright() as p:
    executable=os.environ.get('CHROMIUM_PATH') or shutil.which('chromium')
    browser=p.chromium.launch(**({'executable_path':executable} if executable else {}),headless=True,args=['--no-sandbox','--enable-unsafe-swiftshader'])
    if args.only_signals:
        signals=browser.new_context(viewport={'width':1100,'height':720});signals.route('**/*',route);run_vehicle_signals(signals)
        assert not errors,errors
        browser.close();print('PASS: no vehicle-indicator browser errors');raise SystemExit(0)
    if args.only_exit:
        exiting=browser.new_context(viewport={'width':1100,'height':720});exiting.route('**/*',route);run_vehicle_exit(exiting)
        assert not errors,errors
        browser.close();print('PASS: no vehicle-exit browser errors');raise SystemExit(0)
    if args.only_traffic:
        traffic=browser.new_context(viewport={'width':1100,'height':720});traffic.route('**/*',route);run_traffic_signals(traffic)
        assert not errors,errors
        browser.close();print('PASS: no traffic browser or shader errors');raise SystemExit(0)
    if args.only_structures:
        for seed in [17,2026]:
            structures=browser.new_context(viewport={'width':1100,'height':720});structures.add_init_script(f'let structureSeed={seed};Math.random=()=>{{structureSeed=(Math.imul(1664525,structureSeed)+1013904223)>>>0;return structureSeed/4294967296}};');structures.route('**/*',route);run_structures(structures);structures.close()
        assert not errors,errors
        browser.close();print('PASS: no structure browser or shader errors');raise SystemExit(0)
    if args.only_headlights:
        lighting=browser.new_context(viewport={'width':1100,'height':720});lighting.route('**/*',route);run_headlights(lighting)
        assert not errors,errors
        browser.close();print('PASS: no headlight browser or shader errors');raise SystemExit(0)
    pov=browser.new_context(viewport={'width':1100,'height':720});pov.route('**/*',route);run_pov(pov)
    if args.only_pov:
        mobile_pov=browser.new_context(viewport={'width':390,'height':844},has_touch=True,is_mobile=True,reduced_motion='reduce');mobile_pov.route('**/*',route);run_pov(mobile_pov)
        assert not errors,errors
        browser.close();print('PASS: no POV browser or shader errors');raise SystemExit(0)
    exiting=browser.new_context(viewport={'width':1100,'height':720});exiting.route('**/*',route);run_vehicle_exit(exiting)
    signals=browser.new_context(viewport={'width':1100,'height':720});signals.route('**/*',route);run_vehicle_signals(signals)
    desktop=browser.new_context(viewport={'width':1100,'height':720});desktop.route('**/*',route);run_desktop(desktop)
    improved=browser.new_context(viewport={'width':1100,'height':720});improved.route('**/*',route);run_improvements(improved)
    lighting=browser.new_context(viewport={'width':1100,'height':720});lighting.route('**/*',route);run_headlights(lighting)
    mobile=browser.new_context(viewport={'width':390,'height':844},has_touch=True,is_mobile=True,device_scale_factor=2,reduced_motion='reduce');mobile.route('**/*',route);run_mobile(mobile)
    run_live_frames(browser)
    assert not errors,errors
    run_loading_failure(browser)
    browser.close();print('PASS: no browser or shader errors')
