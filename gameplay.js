/* Gameplay systems extend the existing 60 Hz simulation and shared pause dialog. */
(() => {
  'use strict';
  const SAVE_KEY = 'bvc-progress-v1';
  const $ = id => document.getElementById(id);
  const finite = n => typeof n === 'number' && Number.isFinite(n);
  const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
  const speed = v => Math.hypot(v.vx, v.vz);
  const clock = seconds => {const tenths=Math.max(0,Math.round(seconds*10));return `${Math.floor(tenths/600)}:${((tenths%600)/10).toFixed(1).padStart(4,'0')}`;};
  const activities = {
    race: {name:'Coastal sprint', description:'Pass six checkpoints in order before the timer runs out.', count:6, limit:150},
    delivery: {name:'Parcel run', description:'Collect a parcel, then stop at the delivery point. Hold still at each stop.', count:2, limit:180},
    parking: {name:'Precision parking', description:'Park inside the marked bay, face the arrow, and hold still for three seconds.', count:1, limit:100},
    time: {name:'Time trial', description:'Reach four checkpoints. Beat your saved best time.', count:4, limit:100}
  };
  const profiles = {
    low:{pixel:.9, shadow:0, detail:55, vehicle:28, bloom:false},
    medium:{pixel:1.25, shadow:1024, detail:80, vehicle:42, bloom:false},
    high:{pixel:1.5, shadow:2048, detail:110, vehicle:60, bloom:true}
  };

  class DrivingGame {
    constructor() {
      this.settings = {quality:graphics.mobile?'medium':'high', resolution:100, fps:false,
        motion:!matchMedia('(prefers-reduced-motion: reduce)').matches};
      this.best = {}; this.completed = {}; this.history = [];
      this.lastVehicle = null; this.activity = null; this.result = null; this.transition = null;
      this.elapsed = 0; this.saveTimer = 0; this.lastSave = 0;
      this.session = Math.random().toString(36).slice(2); this.conflict = false;
      this.storageMessage = 'Progress saves automatically on this device.';
      this.pane = 'activities'; this.noticeUntil = 0; this.lastHudSecond = -1;
      this.frameCount = 0; this.frameStart = 0; this.lastFrame = 0;
      this.lastHorn = -1; this.lastGear = null;
    }

    init() {
      this.buildUI(); this.makeMarker(); this.restore(); this.applySettings();
      this.bind(); this.hud(); this.renderMenu();
      window.addEventListener('pagehide', () => this.save());
      document.addEventListener('visibilitychange', () => { if(document.hidden) this.save(); });
      window.addEventListener('storage', event => {
        if(event.key !== SAVE_KEY || !event.newValue) return;
        try { const data=JSON.parse(event.newValue); if(data.version===1&&finite(data.savedAt)&&data.session!==this.session && data.savedAt>this.lastSave) {
          this.conflict=true; this.storageMessage='Another tab saved progress. Autosave is paused here. Choose Save this drive to keep this tab’s progress.'; this.renderSaveStatus();
        }} catch { /* An invalid external save never interrupts the game. */ }
      });
    }

    buildUI() {
      const style=document.createElement('style');
      style.textContent=`
        :root{--scroll-thumb:#526975;--scroll-track:#101d29}*{scrollbar-color:var(--scroll-thumb) var(--scroll-track);scrollbar-width:thin}::-webkit-scrollbar{width:10px;height:10px}::-webkit-scrollbar-track{background:var(--scroll-track)}::-webkit-scrollbar-thumb{background:var(--scroll-thumb);border:2px solid var(--scroll-track);border-radius:8px}::-webkit-scrollbar-thumb:hover{background:#75909c}
        #controls-help{width:min(560px,calc(100vw - 24px));scrollbar-gutter:stable}.gp-tabs{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:4px;margin:0 0 18px}.gp-tabs button,.gp-button,.gp-quick button{min-height:44px;border:1px solid var(--line);border-radius:8px;background:transparent;padding:7px 10px;font-size:12px}.gp-tabs button{padding:7px 2px}.gp-tabs button[aria-pressed=true],.gp-button[aria-pressed=true]{background:#1d444c;border-color:var(--accent);color:var(--accent)}.gp-tabs button:hover,.gp-button:hover,.gp-quick button:hover{background:#ffffff14}button:active{filter:brightness(.88)}
        .gp-pane h2{font-size:18px;margin:0 0 12px}.gp-pane p{color:var(--muted);font-size:12px;line-height:1.6}.gp-activity{border-top:1px solid var(--line);padding:14px 0;display:grid;grid-template-columns:1fr auto;gap:8px 14px;align-items:center}.gp-activity h3{font-size:14px;margin:0}.gp-activity p{margin:4px 0 6px}.gp-activity small{color:var(--accent);font-variant-numeric:tabular-nums}.gp-primary{background:#20454b;border-color:var(--accent);color:var(--fg)}.gp-fields{display:grid;gap:16px;border:0;padding:0;margin:0}.gp-fields legend{font-size:14px;font-weight:600;margin-bottom:12px}.gp-row{display:flex;align-items:center;justify-content:space-between;gap:14px;min-height:44px}.gp-row select{max-width:60%;font:inherit;min-height:44px;color:var(--fg);background:#172b37;border:1px solid var(--line);border-radius:8px;padding:8px}.gp-row input[type=checkbox]{width:22px;height:22px;accent-color:var(--accent)}.gp-row input[type=range]{width:55%;min-height:44px;accent-color:var(--accent)}.gp-range{display:grid;grid-template-columns:1fr auto}.gp-range input[type=range]{grid-column:1/-1;width:100%}.gp-actions{display:flex;gap:8px;flex-wrap:wrap}.gp-quick{display:flex;gap:6px;pointer-events:auto;margin-top:10px}.gp-quick button{flex:1;padding:4px;font-size:11px}.gp-save{border-top:1px solid var(--line);margin-top:20px;padding-top:16px}.gp-muted{color:var(--muted)}
        #activity-hud{position:fixed;left:50%;top:12px;transform:translateX(-50%);width:300px;max-width:calc(100vw - 24px);background:var(--panel);border:1px solid var(--line);border-radius:var(--radius);padding:10px 12px;z-index:12}#activity-hud strong{font-size:13px}#activity-hud p{font-size:11px;line-height:1.5;margin:5px 0;color:var(--muted)}.gp-meter{display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:12px;font-variant-numeric:tabular-nums}#activity-menu{min-width:44px;min-height:44px;border:1px solid var(--line);border-radius:8px;background:transparent;font-size:11px}#fps-counter{position:fixed;bottom:12px;right:12px;font:11px ui-monospace,monospace;background:var(--panel);padding:7px;border-radius:6px;z-index:12;pointer-events:none}#game-notice{position:fixed;left:50%;top:48%;transform:translate(-50%,-50%);width:min(340px,calc(100vw - 32px));padding:14px 18px;background:var(--panel);border:1px solid var(--accent);border-radius:12px;z-index:20;font-size:13px;line-height:1.5;pointer-events:none;text-align:center}
        @media(max-width:900px){#activity-hud{top:auto;bottom:calc(230px + var(--safe-bottom));width:min(300px,calc(100vw - 24px))}}@media(max-height:500px) and (orientation:landscape){#activity-hud{top:auto;bottom:12px;width:min(300px,calc(100vw - 350px));padding:8px}#activity-hud p{margin:3px 0}.gp-quick{margin-top:6px}.gp-quick button{min-height:44px}#vehicle-name{font-size:12px}#controls-help{max-height:calc(100dvh - 20px)}}
        @media(forced-colors:active){*{scrollbar-color:auto}#activity-hud,#game-notice{border:1px solid CanvasText}}
      `;
      document.head.append(style);
      $('help-open').textContent='Menu'; $('help-open').title='Pause menu (H)'; $('help-title').textContent='Pause menu';
      const controls=document.createElement('section'); controls.id='gp-controls'; controls.className='gp-pane';
      const list=help.querySelector('.control-list'); controls.append(list);
      for(const note of [...help.querySelectorAll('.help-note')]) controls.append(note);
      list.insertAdjacentHTML('beforeend','<dt>Horn</dt><dd><kbd>B</kbd></dd><dt>Headlights</dt><dd><kbd>L</kbd> · Auto / on / off</dd><dt>Left / right signal</dt><dd><kbd>Z / X</kbd></dd><dt>Hazard lights</dt><dd><kbd>V</kbd></dd>');
      help.insertAdjacentHTML('beforeend',`<nav class="gp-tabs" aria-label="Pause menu sections">${['activities','vehicle','settings','controls'].map(name=>`<button type="button" data-pane="${name}" aria-pressed="false">${name[0].toUpperCase()+name.slice(1)}</button>`).join('')}</nav><p id="menu-feedback" role="status" style="min-height:1.5em;color:var(--muted);font-size:12px">Game paused. Choose a section.</p>
        <section id="gp-activities" class="gp-pane"><h2>Take a drive</h2><p id="activity-status" role="status">Enter a stopped car, then choose an activity. Checkpoints appear in the world and on the minimap.</p>${Object.entries(activities).map(([id,a])=>`<article class="gp-activity"><div><h3>${a.name}</h3><p>${a.description}</p><small id="best-${id}">No best time yet</small></div><button type="button" class="gp-button gp-primary" data-activity="${id}">Start</button></article>`).join('')}<button type="button" id="cancel-activity" class="gp-button" hidden>Cancel activity</button></section>
        <section id="gp-vehicle" class="gp-pane" hidden><h2>Vehicle</h2><p id="vehicle-menu-status">Enter a stopped car to use vehicle controls.</p><div class="gp-actions"><button type="button" id="vehicle-toggle" class="gp-button">Enter nearby car</button><button type="button" id="menu-lights" class="gp-button">Lights: Auto</button><button type="button" id="signal-left" class="gp-button" aria-pressed="false">Left signal · Z</button><button type="button" id="signal-right" class="gp-button" aria-pressed="false">Right signal · X</button><button type="button" id="signal-hazard" class="gp-button" aria-pressed="false">Hazards · V</button></div><p>Use B or the Horn button while driving. Stop before entering or leaving a car.</p></section>
        <section id="gp-settings" class="gp-pane" hidden><h2>Settings</h2><fieldset class="gp-fields"><legend>Graphics and feedback</legend><label class="gp-row" for="quality-setting">Graphics preset<select id="quality-setting"><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></label><label class="gp-row gp-range" for="resolution-setting">Render scale <output id="resolution-value">100%</output><input id="resolution-setting" type="range" min="50" max="100" step="5" value="100"></label><label class="gp-row" for="fps-setting">Show FPS<input id="fps-setting" type="checkbox"></label><label class="gp-row" for="motion-setting">Suspension and camera feedback<input id="motion-setting" type="checkbox"></label></fieldset><p>Lower the preset or render scale if the game feels slow. Menus remain crisp at every render scale.</p><div class="gp-save"><h2>Progress</h2><p id="save-status"></p><button type="button" id="save-progress" class="gp-button">Save this drive</button><p>Location, chosen car, settings, best times and active activity are saved here. Your car resumes at a standstill. No account is needed.</p></div></section>`);
      help.append(controls);
      $('vehicle-hud').insertAdjacentHTML('beforeend','<div class="gp-quick"><button type="button" id="horn-control" title="Horn (B)">Horn · B</button><button type="button" id="lights-control" title="Headlights (L)">Lights: Auto</button></div>');
      document.body.insertAdjacentHTML('beforeend','<section id="activity-hud" aria-label="Current driving activity" hidden><strong id="activity-name"></strong><p id="activity-target"></p><div class="gp-meter"><span id="activity-time"></span><button type="button" id="activity-menu">Menu</button></div></section><output id="fps-counter" aria-label="Rendering frame rate" hidden>— FPS</output><div id="game-notice" role="status" aria-live="polite" hidden></div>');
    }

    bind() {
      for(const button of help.querySelectorAll('[data-pane]')) button.onclick=()=>this.showPane(button.dataset.pane);
      for(const button of help.querySelectorAll('[data-activity]')) button.onclick=()=>this.startActivity(button.dataset.activity);
      $('cancel-activity').onclick=()=>this.finishActivity(false,'Activity cancelled.');
      $('activity-menu').onclick=()=>{this.showPane('activities');openHelp();};
      $('vehicle-toggle').onclick=()=>{this.act();if(this.transition)help.close();};
      $('horn-control').onclick=()=>this.horn();
      for(const id of ['lights-control','menu-lights']) $(id).onclick=()=>this.toggleLights();
      $('signal-left').onclick=()=>this.signal(-1); $('signal-right').onclick=()=>this.signal(1); $('signal-hazard').onclick=()=>this.signal(2);
      $('quality-setting').onchange=e=>{this.settings.quality=e.target.value;this.applySettings();this.save();};
      $('resolution-setting').oninput=e=>{this.settings.resolution=Number(e.target.value);this.applySettings();};
      $('resolution-setting').onchange=()=>this.save();
      $('fps-setting').onchange=e=>{this.settings.fps=e.target.checked;this.applySettings();this.save();};
      $('motion-setting').onchange=e=>{this.settings.motion=e.target.checked;this.save();};
      $('save-progress').onclick=()=>this.save(true);
      help.addEventListener('close',()=>{this.save();this.lastGear=car?.g??null;});
    }

    showPane(name) {
      if(!['activities','vehicle','settings','controls'].includes(name)) return;
      this.pane=name;
      for(const pane of help.querySelectorAll('.gp-pane')) pane.hidden=pane.id!==`gp-${name}`;
      for(const button of help.querySelectorAll('[data-pane]')){button.setAttribute('aria-pressed',String(button.dataset.pane===name));button.setAttribute('aria-controls',`gp-${button.dataset.pane}`);}
      this.renderMenu(); help.scrollTop=0;
    }
    menuOpened() { this.showPane(this.pane);$('menu-feedback').textContent='Game paused. Choose a section.'; }
    renderMenu() {
      for(const [kind,a] of Object.entries(activities)) {
        const n=this.completed[kind]||0;
        $(`best-${kind}`).textContent=this.best[kind]!==undefined?`Best ${clock(this.best[kind])} · ${n} completed`:'No best time yet';
        help.querySelector(`[data-activity="${kind}"]`).disabled=!car||!!this.transition||!!this.activity;
      }
      $('activity-status').textContent=this.activity?`${activities[this.activity.kind].name} is paused. Resume driving or cancel it below.`:this.result?.message||(!car?'Enter a stopped car, then choose an activity.':'Choose an activity. Follow the cyan checkpoint and minimap marker.');
      $('cancel-activity').hidden=!this.activity;
      $('vehicle-toggle').textContent=car?'Exit vehicle':'Enter nearby car';
      $('vehicle-toggle').disabled=!!this.transition||(car?speed(car)>=1:!this.nearbyCar());
      $('vehicle-menu-status').textContent=this.transition?'Vehicle interaction in progress.':car?`${car.n}${speed(car)>=1?' · Stop before getting out.':''}`:'Enter a stopped car to use vehicle controls.';
      for(const id of ['menu-lights','signal-left','signal-right','signal-hazard']) $(id).disabled=!car||!!this.transition;
      for(const [id,value] of [['signal-left',-1],['signal-right',1],['signal-hazard',2]]) $(id).setAttribute('aria-pressed',String(car?.ind===value));
      const lights=car?.lightsMode||'auto', label=`Lights: ${lights[0].toUpperCase()+lights.slice(1)}`;
      $('lights-control').textContent=$('menu-lights').textContent=label;
      this.renderSaveStatus();
    }
    renderSaveStatus() { if($('save-status').textContent!==this.storageMessage)$('save-status').textContent=this.storageMessage; }
    notify(message) { if(help.open){$('menu-feedback').textContent=message;return;}$('game-notice').textContent=message;$('game-notice').hidden=false;this.noticeUntil=performance.now()+3800; }

    key(key,event) {
      const actions={b:()=>this.horn(),l:()=>this.toggleLights(),z:()=>this.signal(-1),x:()=>this.signal(1),v:()=>this.signal(2)};
      if(!actions[key]) return false;
      event.preventDefault(); if(!event.repeat)actions[key](); return true;
    }

    applySettings() {
      const p=profiles[this.settings.quality]||profiles.medium;
      const ratio=Math.min(devicePixelRatio,p.pixel,graphics.mobile?1.25:1.5)*this.settings.resolution/100;
      r.setPixelRatio(ratio); if(comp)comp.setPixelRatio(ratio); rs();
      const size=graphics.mobile?Math.min(1024,p.shadow):p.shadow;
      r.shadowMap.enabled=size>0; sun.castShadow=size>0;
      if(size&&sun.shadow.mapSize.x!==size) {if(sun.shadow.map)sun.shadow.map.dispose();sun.shadow.map=null;sun.shadow.mapSize.set(size,size);sun.shadow.needsUpdate=true;}
      if(comp)for(const pass of comp.passes)if(pass instanceof THREE.UnrealBloomPass)pass.enabled=p.bloom;
      graphics.detailRange=Math.min(p.detail,graphics.mobile?70:110);graphics.vehicleRange=Math.min(p.vehicle,graphics.mobile?38:60);updateScenery();
      $('quality-setting').value=this.settings.quality;$('resolution-setting').value=this.settings.resolution;
      $('resolution-value').value=`${this.settings.resolution}%`;$('resolution-setting').setAttribute('aria-valuetext',`${this.settings.resolution} percent`);
      $('fps-setting').checked=this.settings.fps;$('motion-setting').checked=this.settings.motion;$('fps-counter').hidden=!this.settings.fps;
    }

    frame(now) {
      if(this.lastFrame&&now-this.lastFrame>1000){this.frameStart=now;this.frameCount=0;}
      this.lastFrame=now;this.frameCount++;
      if(!this.frameStart)this.frameStart=now;
      if(now-this.frameStart>=700){if(this.settings.fps)$('fps-counter').textContent=`${Math.round(this.frameCount*1000/(now-this.frameStart))} FPS`;this.frameCount=0;this.frameStart=now;}
      if(this.noticeUntil&&now>=this.noticeUntil){$('game-notice').hidden=true;this.noticeUntil=0;}
    }

    sound(kind) {
      if(!gameAudio.active())return;
      const c=gameAudio.ctx, now=c.currentTime, duration=kind==='horn'?.36:kind==='shift'?.075:.13;
      const frequencies=kind==='horn'?[350,440]:[kind==='shift'?95:135];
      for(const frequency of frequencies){const oscillator=c.createOscillator(),gain=c.createGain();oscillator.type=kind==='horn'?'triangle':'sine';oscillator.frequency.setValueAtTime(frequency,now);if(kind!=='horn')oscillator.frequency.exponentialRampToValueAtTime(45,now+duration);gain.gain.setValueAtTime(.0001,now);gain.gain.exponentialRampToValueAtTime(kind==='horn'?.12:.055,now+.012);gain.gain.exponentialRampToValueAtTime(.0001,now+duration);oscillator.connect(gain);gain.connect(gameAudio.master);oscillator.onended=()=>{oscillator.disconnect();gain.disconnect();};oscillator.start();oscillator.stop(now+duration+.01);}
    }
    horn() {if(!car||this.transition)return;const now=performance.now();if(now-this.lastHorn<500)return;this.lastHorn=now;this.sound('horn');}
    lightLevel(v) {return v?.lightsMode==='on'?1:v?.lightsMode==='off'?0:night;}
    toggleLights() {if(!car)return;const modes=['auto','on','off'];car.lightsMode=modes[(modes.indexOf(car.lightsMode||'auto')+1)%3];this.syncLights(car);this.hud();this.save();}
    syncLights(v) {
      if(!v.playerHead){v.playerHead=headMat.clone();v.o.traverse(mesh=>{if(mesh.isMesh&&mesh.material===headMat)mesh.material=v.playerHead;});}
      const level=this.lightLevel(v);v.playerHead.color.copy(HC).multiplyScalar(v.lightsMode==='off'?.025:.65+4*level);
    }
    signal(side) {if(!car)return;car.ind=car.ind===side?0:side;car.signalAngle=car.a;car.signalTurned=false;this.renderMenu();}

    nearbyCar() {let best=null,distance=6;for(const v of cars){const d=Math.hypot(v.x-P.x,v.z-P.z);if(d<distance&&speed(v)<1){best=v;distance=d;}}return best;}
    exitPoint(v,side) {
      for(const sign of [side,-side]) {const distance=Math.max(v.t.W/2+1.05,v.t.L*.55+.3),x=v.x-Math.sin(v.a)*distance*sign,z=v.z+Math.cos(v.a)*distance*sign;if(!solid(x,z)&&!cars.some(o=>o!==v&&Math.hypot(o.x-x,o.z-z)<o.t.L*.55))return{x,z,side:sign};}
      return null;
    }
    door(v,side) {
      if(v.n==='Bike')return null;
      v.doors ||= new Map();if(v.doors.has(side))return v.doors.get(side);
      const group=new THREE.Group(),length=Math.min(1.1,v.t.L*.25),paint=v.o.children.find(m=>m.isMesh&&m.material.isMeshPhysicalMaterial&&![GLASS,civicGlass,fdGlass,lampCoverMaterial].includes(m.material))?.material||carMat(v.t.paint||'#9fa8ae');group.position.set(v.t.L*.19,.86,side*(v.t.W/2+.025));v.o.add(group);
      bx(paint,length,.49,.035,-length/2,-.17,0,group);
      const pane=new THREE.Mesh(new THREE.PlaneGeometry(length*.82,.30),civicGlass);pane.position.set(-length*.51,.225,0);pane.material=civicGlass;pane.rotation.y=side<0?PI:0;group.add(pane);
      civicBar(group,[-length,.08,0],[-length*.87,.40,0],.025,paint);civicBar(group,[-length*.87,.40,0],[-.13,.40,0],.025,paint);civicBar(group,[-.13,.40,0],[0,.08,0],.025,paint);
      group.visible=false;v.doors.set(side,group);return group;
    }
    act() {
      if(this.transition)return;
      const exiting=!!car,v=car||this.nearbyCar();
      if(!v||speed(v)>=1){this.notify(car?'Stop before leaving the car.':'Move closer to a stopped car.');return;}
      const rightX=-Math.sin(v.a),rightZ=Math.cos(v.a),side=exiting?1:((P.x-v.x)*rightX+(P.z-v.z)*rightZ<0?-1:1),point=this.exitPoint(v,side);
      if(!point){this.notify('Both sides are blocked. Move the car before getting out.');return;}
      v.ai=null;v.vx=v.vz=0;v.yr=0;
      this.transition={v,exiting,point,from:{x:P.x,z:P.z},elapsed:0,door:this.door(v,point.side)};
      resetInput();this.sound('door');this.renderMenu();
    }
    beforeStep() {
      const t=this.transition;if(!t)return;
      t.elapsed+=DT;const phase=Math.min(1,t.elapsed/.95),open=Math.sin(Math.min(1,phase/.30)*PI/2)*Math.min(1,(1-phase)/.24);
      if(t.door){t.door.visible=open>.005;t.door.rotation.y=-t.point.side*open*1.12;}
      const u=clamp((phase-.20)/.58,0,1),seat={x:t.v.x,z:t.v.z};
      const start=t.exiting?seat:t.from,end=t.exiting?t.point:seat;
      P.x=start.x+(end.x-start.x)*u;P.z=start.z+(end.z-start.z)*u;P.a=t.v.a;
      P.o.visible=t.exiting?phase>.24:phase<.71;P.ph+=DT*8;anim(P.H,P.ph,u>0&&u<1?.6:0,false,false);P.H.tor.rotation.z=(t.exiting?1:-1)*Math.sin(u*PI)*.35;P.H.arms[0].sh.rotation.z=-.6*open;
      if(phase>=1){if(t.door)t.door.visible=false;P.H.tor.rotation.z=0;P.H.arms[0].sh.rotation.z=0;
        if(t.exiting){car=null;camMode=0;P.x=t.point.x;P.z=t.point.z;P.o.visible=true;t.v.o.visible=true;}
        else{car=t.v;this.lastVehicle=car;P.x=car.x;P.z=car.z;P.o.visible=false;this.lastGear=car.g;this.syncLights(car);}
        this.transition=null;this.sound('door');this.save();this.hud();
      }
    }

    tick() {
      this.elapsed+=DT;this.saveTimer+=DT;
      if(car){this.syncLights(car);if(this.lastGear!==null&&car.g!==this.lastGear&&speed(car)>2)this.sound('shift');this.lastGear=car.g;
        if(car.ind===-1||car.ind===1){if(Math.abs(wrap(car.a-(car.signalAngle??car.a)))>.35)car.signalTurned=true;if(car.signalTurned&&Math.abs(car.st)<.05)car.ind=0;}
      }else this.lastGear=null;
      for(const v of cars){if(v.playerHead&&v!==car)this.syncLights(v);const sp=speed(v),surface=tile(v.x,v.z),amplitude=sp>1?(surface===1?.003:surface===0?.014:.035):0;
        if(this.settings.motion&&sp>2&&v.lastFeedbackSurface!==undefined&&surface!==v.lastFeedbackSurface)v.heaveVelocity=(v.heaveVelocity||0)+(surface===0?.36:-.22)*Math.min(1,sp/12);v.lastFeedbackSurface=surface;v.feedbackDistance=(v.feedbackDistance||0)+sp*DT;const target=this.settings.motion?Math.sin(v.feedbackDistance*4.8)*amplitude+Math.sin(v.feedbackDistance*9.1)*amplitude*.35:0;
        v.heaveVelocity=(v.heaveVelocity||0)+((target-(v.heave||0))*80-(v.heaveVelocity||0)*12)*DT;v.heave=(v.heave||0)+v.heaveVelocity*DT;v.o.position.y=v.heave;
        for(const wheel of v.wheels)wheel.steer.position.y=(v.t.r||.32)-v.heave;
      }
      if(this.activity)this.updateActivity();
      if(this.saveTimer>=5){this.saveTimer=0;this.save();}
    }
    cameraFeedback() {
      if(!car||!this.settings.motion||this.transition)return;
      const brake=car.brk||0;cam.position.y+=(car.heave||0)*.4-brake*.06;
      cam.rotateZ(clamp(-(car.yr||0)*speed(car)*.0006,-.015,.015));
    }

    makeMarker() {
      this.marker=new THREE.Group();this.marker.visible=false;
      const material=new THREE.MeshBasicMaterial({color:lin('#76e4e1').multiplyScalar(2),transparent:true,opacity:.85,depthWrite:false});
      this.ring=new THREE.Mesh(new THREE.TorusGeometry(5,.065,6,48).rotateX(-PI/2),material);this.ring.position.y=.13;this.marker.add(this.ring);
      this.parking=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(6,.015,2.7)),new THREE.LineBasicMaterial({color:lin('#76e4e1').multiplyScalar(3)}));this.parking.position.y=.15;this.marker.add(this.parking);
      const arrowShape=new THREE.Shape();arrowShape.moveTo(.95,0);arrowShape.lineTo(-.5,.45);arrowShape.lineTo(-.25,0);arrowShape.lineTo(-.5,-.45);arrowShape.closePath();
      this.arrow=new THREE.Mesh(new THREE.ShapeGeometry(arrowShape).rotateX(-PI/2),material);this.arrow.position.y=.17;this.marker.add(this.arrow);S.add(this.marker);
    }

    route(kind) {
      const spec=activities[kind];let edge=null,dir=1,path=null,index=0,best=Infinity;
      for(const e of roads)for(const direction of [-1,1]){const lane=driveLane(e,direction);for(let i=0;i<lane.length;i+=3){const p=lane[i],distance=Math.hypot(p.x-car.x,p.z-car.z)+Math.abs(wrap(p.a-car.a))*7;if(distance<best){best=distance;edge=e;dir=direction;path=lane;index=i;}}}
      const targets=[],trace=[],visited=new Map();let distance=0,last=path[index],junctions=0;
      for(let guard=0;guard<8000&&targets.length<spec.count;guard++){
        if(index>=path.length){const node=dir>0?edge.b:edge.a,options=node.links.filter(e=>e!==edge);let candidates=(options.length?options:[edge]).map(e=>{const d=e.a===node?1:-1,lane=driveLane(e,d);return{e,d,lane,score:(visited.get(e)||0)*4+Math.abs(wrap(lane[0].a-last.a))};}).sort((a,b)=>a.score-b.score);
          const chosen=candidates[(++junctions%3===0&&candidates.length>1)?1:0];edge=chosen.e;dir=chosen.d;path=chosen.lane;index=0;visited.set(edge,(visited.get(edge)||0)+1);
        }
        const p=path[index++];distance+=Math.hypot(p.x-last.x,p.z-last.z);last=p;if(trace.length<1200&&guard%3===0)trace.push({x:p.x,z:p.z});
        if(distance<(kind==='parking'?40:70)||tile(p.x,p.z)!==1)continue;
        let point={x:p.x,z:p.z,a:p.a};
        if(kind==='parking') {let i=0,d=Infinity;edge.points.forEach((q,j)=>{const gap=Math.hypot(q.x-p.x,q.z-p.z);if(gap<d){d=gap;i=j;}});const bay=lanePoint(edge,i,dir,edge.width/2-1.75);if(nodes.some(n=>Math.hypot(bay.x-n.x,bay.z-n.z)<25))continue;point=bay;}
        if(cars.some(v=>v!==car&&!v.ai&&Math.hypot(v.x-point.x,v.z-point.z)<7))continue;
        if(kind==='parking'&&!this.clearFootprint(point,{L:6,W:2.7}))continue;
        targets.push({x:point.x,z:point.z,a:point.a});distance=0;
      }
      if(targets.length!==spec.count)throw new Error('No clear route is available. Move to another road and try again.');
      return{targets,trace};
    }

    startActivity(kind) {
      if(!activities[kind]||this.activity)return;
      if(!car||this.transition){$('activity-status').textContent='Enter a stopped car before starting an activity.';return;}
      if(car.dmg>150){$('activity-status').textContent='This car’s engine is disabled. Choose another car before starting.';return;}
      try{const route=this.route(kind);this.activity={kind,...route,index:0,elapsed:0,hold:0,limit:activities[kind].limit};this.result=null;this.save();help.close();resetInput();this.showTarget();this.notify(`${activities[kind].name} started. Follow the cyan marker.`);}catch(error){$('activity-status').textContent=error.message;}
    }
    showTarget() {
      const a=this.activity;if(!a){this.marker.visible=false;return;}
      const target=a.targets[a.index];this.marker.visible=true;this.marker.position.set(target.x,0,target.z);this.marker.rotation.y=-target.a;
      this.ring.visible=a.kind!=='parking';this.parking.visible=a.kind==='parking';this.arrow.visible=true;this.hud();
    }
    updateActivity() {
      const a=this.activity;if(!a)return;a.elapsed+=DT;
      if(a.elapsed>=a.limit){this.finishActivity(false,'Time is up. Open the menu to try again.');return;}
      if(car?.dmg>150){this.finishActivity(false,'The engine is disabled. Choose another car and try again.');return;}
      if(!car||this.transition){a.hold=0;return;}
      const target=a.targets[a.index],distance=Math.hypot(car.x-target.x,car.z-target.z);
      let reached=distance<6.5;
      if(a.kind==='parking'){const dx=car.x-target.x,dz=car.z-target.z,along=dx*Math.cos(target.a)+dz*Math.sin(target.a),across=-dx*Math.sin(target.a)+dz*Math.cos(target.a);reached=Math.abs(along)+Math.abs(Math.cos(car.a-target.a))*car.t.L/2+Math.abs(Math.sin(car.a-target.a))*car.t.W/2<2.94&&Math.abs(across)+Math.abs(Math.sin(car.a-target.a))*car.t.L/2+Math.abs(Math.cos(car.a-target.a))*car.t.W/2<1.29&&Math.abs(wrap(car.a-target.a))<.16&&speed(car)<.35;}
      else if(a.kind==='delivery')reached=distance<5&&speed(car)<.6;
      const hold=a.kind==='parking'?3:a.kind==='delivery'?1.5:0;a.hold=reached?a.hold+DT:0;
      if(reached&&a.hold+1e-8>=hold){a.index++;a.hold=0;if(a.index===a.targets.length){this.finishActivity(true,`${activities[a.kind].name} complete · ${clock(a.elapsed)}`);}else{this.notify(a.kind==='delivery'?'Parcel collected. Drive to the delivery point.':`Checkpoint ${a.index} cleared.`);this.showTarget();this.save();}}
      this.ring.scale.setScalar(1+Math.sin(this.elapsed*2)*.025);
    }
    finishActivity(success,message) {
      const a=this.activity;if(!a)return;
      if(success){this.best[a.kind]=Math.min(this.best[a.kind]??Infinity,a.elapsed);this.completed[a.kind]=(this.completed[a.kind]||0)+1;}
      this.result={kind:a.kind,success,message};this.history.unshift({kind:a.kind,success,time:a.elapsed});this.history.length=Math.min(this.history.length,12);
      this.activity=null;this.marker.visible=false;this.notify(message);this.save();this.hud();this.renderMenu();
    }

    hud() {
      const a=this.activity;$('activity-hud').hidden=!a;
      if(a){$('activity-name').textContent=activities[a.kind].name;const distance=car?Math.round(Math.hypot(car.x-a.targets[a.index].x,car.z-a.targets[a.index].z)):Math.round(Math.hypot(P.x-a.targets[a.index].x,P.z-a.targets[a.index].z));
        $('activity-target').textContent=a.kind==='parking'?`Park facing the arrow · hold ${a.hold.toFixed(1)} / 3.0 s`:a.kind==='delivery'?`${a.index===0?'Collect parcel':'Deliver parcel'} · ${distance} m · stop and hold`: `Checkpoint ${a.index+1} / ${a.targets.length} · ${distance} m`;
        $('activity-time').textContent=`${clock(Math.max(0,a.limit-a.elapsed))} remaining`;
      }
      $('horn-control').disabled=!car||!!this.transition;$('lights-control').disabled=!car||!!this.transition;
      const mode=car?.lightsMode||'auto';$('lights-control').textContent=`Lights: ${mode[0].toUpperCase()+mode.slice(1)}`;
      if(help.open)this.renderMenu();
    }
    drawMini(ctx,scale) {
      const a=this.activity;if(!a)return;ctx.save();ctx.strokeStyle='#76e4e1';ctx.lineWidth=1;ctx.globalAlpha=.7;ctx.beginPath();a.trace.forEach((p,i)=>i?ctx.lineTo(p.x*scale,p.z*scale):ctx.moveTo(p.x*scale,p.z*scale));ctx.stroke();const t=a.targets[a.index];ctx.globalAlpha=1;ctx.fillStyle='#76e4e1';ctx.beginPath();ctx.arc(t.x*scale,t.z*scale,3,0,PI*2);ctx.fill();ctx.restore();
    }

    clearFootprint(point,type) {
      if(!point||!finite(point.x)||!finite(point.z)||!finite(point.a)||point.x<2||point.z<2||point.x>N*T-2||point.z>N*T-2)return false;
      const fx=Math.cos(point.a),fz=Math.sin(point.a);for(const x of [-type.L/2,0,type.L/2])for(const z of [-type.W/2,0,type.W/2])if(solid(point.x+fx*x-fz*z,point.z+fz*x+fx*z))return false;return true;
    }
    snapshot() {
      const vehicle=car||this.lastVehicle;
      return{version:1,session:this.session,savedAt:Date.now(),position:{x:P.x,z:P.z,a:P.a},driving:!!car,vehicle:vehicle?{name:vehicle.n,x:vehicle.x,z:vehicle.z,a:vehicle.a,dmg:vehicle.dmg,lights:vehicle.lightsMode||'auto'}:null,
        camera:{mode:camMode,zoom:zm},settings:{...this.settings},best:{...this.best},completed:{...this.completed},activity:this.activity?JSON.parse(JSON.stringify(this.activity)):null,timeOfDay:tod};
    }
    save(manual=false) {
      if(this.transition){if(manual)this.notify('Wait for the vehicle interaction to finish, then save.');return false;}
      if(this.conflict&&!manual)return false;
      try{const data=this.snapshot();localStorage.setItem(SAVE_KEY,JSON.stringify(data));this.lastSave=data.savedAt;this.conflict=false;this.storageMessage='Saved on this device. Autosave is on.';this.renderSaveStatus();if(manual)this.notify('Drive saved on this device.');return true;}
      catch{this.storageMessage='Saving is unavailable in this browser. You can keep playing; allow site storage and choose Save this drive to retry.';this.renderSaveStatus();if(manual)this.notify('Could not save. You can keep playing.');return false;}
    }
    restore() {
      let data;try{const text=localStorage.getItem(SAVE_KEY);if(!text)return;data=JSON.parse(text);}catch{this.storageMessage='The previous save could not be read. A new drive has started.';return;}
      if(!data||data.version!==1){this.storageMessage='This save version is not supported. A new drive has started.';return;}
      const settings=data.settings||{};if(profiles[settings.quality])this.settings.quality=settings.quality;if(finite(settings.resolution))this.settings.resolution=clamp(Math.round(settings.resolution/5)*5,50,100);
      for(const key of ['fps','motion'])if(typeof settings[key]==='boolean')this.settings[key]=settings[key];
      for(const kind of Object.keys(activities)){if(finite(data.best?.[kind])&&data.best[kind]>=0&&data.best[kind]<=3600)this.best[kind]=data.best[kind];if(Number.isInteger(data.completed?.[kind])&&data.completed[kind]>=0)this.completed[kind]=Math.min(1000000,data.completed[kind]);}
      if(finite(data.timeOfDay))tod=((data.timeOfDay%1)+1)%1;
      if(this.clearFootprint(data.position,{L:.6,W:.6})){P.x=data.position.x;P.z=data.position.z;P.a=data.position.a;}
      const saved=data.vehicle;
      if(saved&&TY[saved.name]&&this.clearFootprint(saved,TY[saved.name])){const v=cars.find(v=>v.n===saved.name&&!v.ai)||mkCar(saved.name);v.ai=null;v.x=saved.x;v.z=saved.z;v.a=saved.a;v.vx=v.vz=v.yr=0;v.dmg=finite(saved.dmg)?clamp(saved.dmg,0,200):0;v.lightsMode=['auto','on','off'].includes(saved.lights)?saved.lights:'auto';this.lastVehicle=v;if(data.driving!==false){car=v;P.x=v.x;P.z=v.z;P.a=v.a;P.o.visible=false;}
        // Keep a restored car clear of randomly spawned traffic/parked cars.
        for(const other of cars)if(other!==v&&Math.hypot(other.x-v.x,other.z-v.z)<(v.t.L+other.t.L)*.55){if(other.ai)spawnAI(other);else{for(const e of roads){const p=lanePoint(e,Math.floor(e.points.length/2),1,e.width/2-1.7);if(this.clearFootprint(p,other.t)&&!cars.some(o=>o!==other&&Math.hypot(o.x-p.x,o.z-p.z)<8)){other.x=p.x;other.z=p.z;other.a=p.a;other.vx=other.vz=0;break;}}}}
        camMode=car&&Number.isInteger(data.camera?.mode)?clamp(data.camera.mode,0,2):0;this.syncLights(v);
      }
      if(finite(data.camera?.zoom))zm=clamp(data.camera.zoom,.5,2.2);
      const a=data.activity,spec=activities[a?.kind];
      if(spec&&Array.isArray(a.targets)&&a.targets.length===spec.count&&a.targets.every(p=>this.clearFootprint(p,{L:.1,W:.1}))&&Number.isInteger(a.index)&&a.index>=0&&a.index<a.targets.length&&finite(a.elapsed)&&a.elapsed>=0&&a.elapsed<spec.limit){this.activity={kind:a.kind,targets:a.targets.map(p=>({x:p.x,z:p.z,a:p.a})),trace:Array.isArray(a.trace)?a.trace.filter(p=>finite(p.x)&&finite(p.z)&&p.x>=0&&p.z>=0&&p.x<=N*T&&p.z<=N*T).slice(0,1200):[],index:a.index,elapsed:a.elapsed,limit:spec.limit,hold:0};this.showTarget();}
      ca=P.a;cp.set(P.x-Math.cos(P.a)*8,4,P.z-Math.sin(P.a)*8);this.lastSave=finite(data.savedAt)?data.savedAt:0;this.storageMessage='Your saved drive has been restored. Autosave is on.';
    }
  }
  gameplay=new DrivingGame();gameplay.init();
})();
