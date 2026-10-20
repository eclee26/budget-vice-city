"""Two independent browser clients against the actual game server (npm start)."""
from pathlib import Path
import os,json,re,time
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright

root=Path(__file__).resolve().parents[1];artifacts=root/'tests'/'artifacts';artifacts.mkdir(exist_ok=True)
base=os.environ.get('MULTIPLAYER_URL','http://127.0.0.1:8010')

with sync_playwright() as p:
    browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH'),headless=True,args=['--enable-unsafe-swiftshader'])
    errors=[]
    def client(name,room):
        context=browser.new_context(viewport={'width':1100,'height':800})
        context.add_init_script('window.requestAnimationFrame=()=>0')
        def route(request):
            u=urlparse(request.request.url);cached=root/'.test-tools'/'cdn-cache'/Path(u.path).name
            if u.hostname not in ['127.0.0.1','localhost'] and cached.exists():request.fulfill(body=cached.read_bytes(),content_type='text/javascript')
            else:request.continue_()
        context.route(re.compile(r'https://(?:cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net)/'),route);page=context.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
        print('Loading '+name,flush=True);page.goto(base+'/?room='+room,wait_until='load');page.wait_for_function('gameplay?.multiplayer',polling=100)
        print('Joining '+name,flush=True);page.locator('#online-open').click();page.locator('#online-name').fill(name);page.locator('#online-connect').click()
        page.wait_for_function('gameplay.multiplayer.online',polling=100);print('Connected '+name,flush=True);return context,page
    room='TEST'+str(int(time.time()));ac,a=client('Alice',room);bc,b=client('Bob',room);cc,c=client('Other','OTHER'+str(int(time.time())))
    a.wait_for_function('gameplay.multiplayer.peers.size===1',polling=100);b.wait_for_function('gameplay.multiplayer.peers.size===1',polling=100)
    assert a.evaluate('JSON.stringify(m)')==b.evaluate('JSON.stringify(m)')
    print('Testing chat',flush=True);a.keyboard.press('Escape');b.keyboard.press('Escape')
    a.keyboard.press('t');a.locator('#chat-input').fill('<img src=x onerror=alert(1)> Hello everyone!');a.locator('#chat-send').click()
    b.keyboard.press('t');b.wait_for_function('document.getElementById("chat-messages").textContent.includes("Hello everyone!")',polling=100)
    assert b.locator('#chat-messages img').count()==0
    assert not c.locator('#chat-messages').inner_text().find('Hello everyone!')>=0
    b.locator('#chat-input').fill('w a s d e c h');assert b.evaluate('!k.w&&!k.a&&!k.s&&!k.d&&!k.e&&!k.c&&!k.h')
    b.locator('#chat-input').fill('Draft survives reconnect')
    print('Testing reconnect',flush=True);bc.set_offline(True);b.wait_for_function('!gameplay.multiplayer.online',polling=100);assert b.locator('#online-open').inner_text()=='Reconnecting…';bc.set_offline(False);b.wait_for_function('gameplay.multiplayer.online',timeout=12000,polling=100)
    assert b.locator('#chat-input').input_value()=='Draft survives reconnect'
    assert b.locator('#chat-messages li').filter(has_text='Hello everyone!').count()==1
    # Authoritative peer state drives a separate remote render object, never local AI.
    print('Testing remote vehicles',flush=True);x=a.evaluate("""()=>{const v=cars.find(v=>v.n==='Sedan'),p=lanePoint(coastStart,105);car=v;v.ai=null;v.x=p.x;v.z=p.z;v.a=p.a;v.o.position.set(v.x,0,v.z);P.x=v.x;P.z=v.z;return v.x;}""")
    b.wait_for_function('Array.from(gameplay.multiplayer.peers.values()).some(p=>p.state?.vehicle==="Sedan")',polling=100)
    b.evaluate('gameplay.multiplayer.frame(performance.now()+100)')
    assert b.evaluate('Array.from(gameplay.multiplayer.peers.values()).every(p=>p.vehicle&&p.vehicle.n==="Sedan"&&!cars.includes(p.vehicle)&&Number.isFinite(p.vehicle.o.position.x))')
    a.evaluate('car.x+=4;P.x=car.x')
    b.wait_for_function('(x)=>Math.abs(Array.from(gameplay.multiplayer.peers.values())[0].state.x-x)<.1',arg=x+4,polling=100)
    a.evaluate('car=null;P.o.visible=true;P.o.position.set(P.x,0,P.z)')
    b.wait_for_function('Array.from(gameplay.multiplayer.peers.values())[0].state.vehicle===null',polling=100);b.evaluate('gameplay.multiplayer.frame(performance.now()+200)')
    assert b.evaluate('Array.from(gameplay.multiplayer.peers.values())[0].H.g.visible')
    print('Capturing UI',flush=True);a.locator('#chat-close').click();a.locator('#online-open').click();a.locator('#online-invite').scroll_into_view_if_needed();a.screenshot(path=str(artifacts/'multiplayer-room.png'))
    b.evaluate('gameplay.multiplayer.render();if(comp)comp.render();else r.render(S,cam)');b.screenshot(path=str(artifacts/'multiplayer-global-chat.png'))
    b.set_viewport_size({'width':390,'height':844});b.evaluate('rs();gameplay.multiplayer.render();if(comp)comp.render();else r.render(S,cam)');b.locator('#chat-input').scroll_into_view_if_needed();b.screenshot(path=str(artifacts/'multiplayer-chat-mobile.png'))
    box=b.locator('#world-chat').bounding_box();assert box['x']>=0 and box['x']+box['width']<=390,box
    a.locator('#online-leave').click();b.wait_for_function('gameplay.multiplayer.peers.size===0',polling=100)
    assert a.evaluate('!gameplay.multiplayer.session&&gameplay.multiplayer.peers.size===0&&gameplay.multiplayer.carPool.length===0')
    b.evaluate('gameplay.multiplayer.leave();for(let i=0;i<60;i++)step()')
    # A failed join stays reviewable and retryable, with editable inputs.
    c.locator('#online-leave').click()
    c.route('**/api/join',lambda route:route.fulfill(status=503,json={'error':'Server unavailable. Try again.'}))
    c.locator('#online-connect').click();c.wait_for_function('document.getElementById("online-status").textContent.includes("Server unavailable")',polling=100)
    assert c.locator('#online-connect').is_enabled() and c.evaluate('!gameplay.multiplayer.session')
    c.locator('#online-name').fill('');c.locator('#online-connect').click();assert c.locator('#online-name').get_attribute('aria-invalid')=='true'
    assert not errors,errors
    (artifacts/'multiplayer-review.json').write_text(json.dumps({'clients':3,'sharedLayout':True,'chatIsolation':True,'textOnlyChat':True,'reconnectAndDraft':True,'remoteFootAndCar':True,'leaveCleanup':True,'retryableJoinFailure':True,'mobileWidth':390,'browserErrors':errors},indent=2),encoding='utf-8')
    print('PASS: independent clients, shared layout, room presence/isolation, safe global chat, reconnect/draft/dedup, driven car/on-foot replication, mobile chat and leave cleanup',flush=True)
    browser.close()
