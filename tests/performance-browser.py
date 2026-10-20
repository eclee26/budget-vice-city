"""Repeatable CPU benchmark. Run with the same Chrome/settings for before/after data.

Software-rendered browser timings do not predict FPS on the player's GPU.
"""
import argparse, json, os, statistics
from pathlib import Path
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright

parser=argparse.ArgumentParser()
parser.add_argument('--label',default='current')
args=parser.parse_args()
root=Path(__file__).resolve().parents[1]
artifacts=root/'tests'/'artifacts';artifacts.mkdir(exist_ok=True)
source=(root/'index.html').read_text(encoding='utf-8').replace('<script>\nconst T=10', '''<script>
window.requestAnimationFrame=()=>0;
let benchmarkSeed=12345;Math.random=()=>{benchmarkSeed=(1664525*benchmarkSeed+1013904223)>>>0;return benchmarkSeed/4294967296};
const T=10''')

def route(request):
    url=urlparse(request.request.url)
    if url.hostname!='game.test':
        cached=root/'.test-tools'/'cdn-cache'/Path(url.path).name
        if cached.exists():request.fulfill(body=cached.read_bytes(),content_type='text/javascript')
        else:request.continue_()
        return
    if url.path=='/':request.fulfill(body=source,content_type='text/html')
    elif url.path in ['/multiplayer.js','/multiplayer.css','/gameplay.js','/open-world.js','/world-streaming.js','/vehicle-dynamics.js','/structures.js','/traffic-signals.js','/world-detail.js','/driving.css']:
        request.fulfill(body=(root/url.path[1:]).read_text(encoding='utf-8'),content_type='text/css' if url.path.endswith('.css') else 'text/javascript')
    else:request.fulfill(status=204,body='')

with sync_playwright() as p:
    browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH'),headless=True,args=['--no-sandbox','--enable-unsafe-swiftshader'])
    page=browser.new_page(viewport={'width':1000,'height':700});page.route('**/*',route)
    page.goto('https://game.test/',wait_until='load');page.wait_for_function('gameplay!==null')
    result=page.evaluate('''()=>{
      car=cars[0];car.ai=null;P.o.visible=false;k.w=1;gameplay.settings.quality='low';gameplay.applySettings();
      for(let i=0;i<120;i++)step();
      const tick=[];for(let batch=0;batch<7;batch++){const start=performance.now();for(let i=0;i<60;i++){gameplay.captureVisual();step();updParts();}tick.push((performance.now()-start)/60);}
      const interpolation=[];for(let batch=0;batch<7;batch++){const start=performance.now();for(let i=0;i<180;i++){gameplay.captureVisual();gameplay.interpolateVisual(.5);gameplay.restoreVisual();}interpolation.push((performance.now()-start)/180);}
      return{tickMs:tick,interpolationMs:interpolation,cars:cars.length,objects:S.children.length};
    }''')
    result['medianTickMs']=statistics.median(result['tickMs'])
    result['medianInterpolationMs']=statistics.median(result['interpolationMs'])
    (artifacts/f'performance-{args.label}.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
    print(json.dumps(result),flush=True);browser.close()
