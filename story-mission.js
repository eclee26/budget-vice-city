/* Last Light is an authored encounter, independent of repeatable driving jobs.
   The state machine contains no rendering, wall-clock timers or DOM access. */
class LastLightState{
  static modes={careful:{limit:600,base:900},urgent:{limit:360,base:1200}};
  static stages=['collect','carry','drive','unload','deliver'];
  constructor(){this.active=null;this.completed=false;this.best=null;this.result=null;}
  start(mode){if(this.active||!LastLightState.modes[mode])return false;this.active={mode,stage:'collect',elapsed:0,integrity:100,lastDamage:0,vehicleName:null};this.result=null;return true;}
  act(action,c){
    const a=this.active;if(!a||!c.onFoot||!c.near)return false;
    if(action==='pickup'&&a.stage==='collect')a.stage='carry';
    else if(action==='load'&&a.stage==='carry'&&c.vehicle&&c.stopped&&c.eligible){a.stage='drive';a.vehicleName=c.vehicle.name;a.lastDamage=c.vehicle.damage;}
    else if(action==='unload'&&a.stage==='unload'&&c.stopped&&c.atClinic)a.stage='deliver';
    else if(action==='handoff'&&a.stage==='deliver'&&c.clear)return this.finish(true,'delivered');
    else return false;return true;
  }
  tick(c,dt){
    const a=this.active;if(!a)return;a.elapsed+=dt;
    if(a.elapsed>=LastLightState.modes[a.mode].limit)return this.finish(false,'timeout');
    if(c.stars>=2)return this.finish(false,'pursuit');
    if(['drive','unload'].includes(a.stage)){
      if(!c.vehicle)return this.finish(false,'lost');if(c.vehicle.damage>150)return this.finish(false,'engine');
      a.integrity=Math.max(0,a.integrity-Math.max(0,c.vehicle.damage-a.lastDamage)*2.2);a.lastDamage=c.vehicle.damage;
      if(c.driving&&c.speed>5)a.integrity=Math.max(0,a.integrity-(Math.max(0,-c.ax-5)+Math.max(0,Math.abs(c.ay)-5))*.20*dt);
      if(a.integrity<=0)return this.finish(false,'cargo');
      if(a.stage==='drive'&&c.driving&&c.atClinic&&c.stopped)a.stage='unload';
      else if(a.stage==='unload'&&!c.atClinic)a.stage='drive';
    }
  }
  finish(success,reason){
    const a=this.active;if(!a)return false;const reward=success&&!this.completed?LastLightState.modes[a.mode].base+Math.round(a.integrity*3):0;
    this.result={success,reason,reward,time:a.elapsed,integrity:a.integrity,mode:a.mode};if(success){this.completed=true;this.best=Math.min(this.best??Infinity,a.elapsed);}this.active=null;return true;
  }
  snapshot(){return{version:1,active:this.active?{...this.active}:null,completed:this.completed,best:this.best,result:this.result?{...this.result}:null};}
  restore(data){
    this.active=null;this.result=null;if(!data||data.version!==1)return false;this.completed=data.completed===true;this.best=Number.isFinite(data.best)&&data.best>0&&data.best<=600?data.best:null;
    const r=data.result;if(r&&typeof r.success==='boolean'&&['delivered','timeout','pursuit','lost','engine','cargo','cancelled','recovered','wasted','busted','contact'].includes(r.reason)&&LastLightState.modes[r.mode]&&Number.isFinite(r.time)&&r.time>=0&&r.time<=600&&Number.isFinite(r.integrity)&&r.integrity>=0&&r.integrity<=100)this.result={success:r.success,reason:r.reason,mode:r.mode,time:r.time,integrity:r.integrity,reward:Number.isFinite(r.reward)?Math.max(0,Math.min(1500,Math.floor(r.reward))):0};
    const a=data.active;if(!a)return true;
    if(!LastLightState.modes[a.mode]||!LastLightState.stages.includes(a.stage)||!Number.isFinite(a.elapsed)||a.elapsed<0||a.elapsed>=LastLightState.modes[a.mode].limit||!Number.isFinite(a.integrity)||a.integrity<=0||a.integrity>100||!Number.isFinite(a.lastDamage)||a.lastDamage<0||a.lastDamage>200||a.vehicleName!==null&&typeof a.vehicleName!=='string'||['drive','unload'].includes(a.stage)&&!a.vehicleName)return false;
    this.active={mode:a.mode,stage:a.stage,elapsed:a.elapsed,integrity:a.integrity,lastDamage:a.lastDamage,vehicleName:a.vehicleName};return true;
  }
}

class StoryMission{
  constructor(game){
    this.game=game;this.run=new LastLightState();this.guide=false;this.vehicle=null;this.route=[];this.routeTime=0;this.sites=this.plan();this.contacts=[];this.dialogue='';
    this.buildUI();if(this.sites)this.buildWorld();
  }
  get active(){return this.run.active;}
  get carrying(){return this.active&&['carry','deliver'].includes(this.active.stage);}
  local(lot,x,z){const c=Math.cos(lot.angle),s=Math.sin(lot.angle);return{x:lot.x+c*x+s*z,z:lot.z-s*x+c*z,a:Math.PI/2-lot.angle};}
  plan(){
    const lot=kind=>structurePlan.lots.find(l=>l.kind===kind),workshop=lot('workshop'),clinic=lot('clinic'),fuel=lot('fuel');if(!workshop||!clinic||!fuel)return null;
    const choose=(l,points)=>points.map(([x,z])=>this.local(l,x,z)).find(p=>this.game.clearFootprint(p,{L:1.2,W:1.2})&&!cars.some(v=>pedestrianVehicleDistance(p,v)<.8));
    const contact=choose(workshop,[[-4,5],[4,5],[0,6],[-6,7]]),doctor=choose(clinic,[[2,4.8],[-2,4.8],[0,5.5]]),pickup=choose(fuel,[[3,-1.8],[-3,-1.8],[8,-2],[-8,-2]]),parking=this.game.sandbox.services.find(s=>s.kind==='clinic');
    return contact&&doctor&&pickup&&parking?{contact,doctor,pickup,parking:{x:parking.x,z:parking.z,a:doctor.a}}:null;
  }
  buildUI(){
    const $=id=>document.getElementById(id),tab=document.createElement('button');tab.type='button';tab.dataset.pane='story';tab.textContent='Story';tab.setAttribute('aria-pressed','false');document.querySelector('.gp-tabs').append(tab);
    document.getElementById('controls-help').insertAdjacentHTML('beforeend',`<section id="gp-story" class="gp-pane" hidden><h2>Last Light</h2><p class="story-speaker">Inez · Harbor Auto</p><p id="story-dialogue"></p><p id="story-summary" role="status"></p><div class="gp-actions"><button id="story-mark" class="gp-button">Meet Inez</button><button id="story-careful" class="gp-button">Careful run · 10 min · up to $1,200</button><button id="story-urgent" class="gp-button">Urgent run · 6 min · up to $1,500</button><button id="story-cancel" class="gp-button" hidden>Abandon mission</button></div><p>Talk on foot. Collect the controller, load it at the rear of a stopped car with at least 40% condition (not a bike), drive it to the clinic, then carry it to Dr. Vale. Damage and harsh driving reduce cargo condition. Two wanted stars, a disabled loaded car, recovering the loaded car or running out of time end the mission. Replay after completion pays no additional reward.</p></section>`);
    const intro=document.createElement('article');intro.className='gp-activity';intro.innerHTML='<div><h3>Last Light · Story</h3><p>Meet Inez at Harbor Auto. A clinic needs its backup controller before the evening handover.</p></div><button type="button" class="gp-button" id="story-open">View</button>';$('gp-activities').insertBefore(intro,$('gp-activities').firstElementChild.nextElementSibling);
    $('activity-target').insertAdjacentHTML('afterend','<div id="story-cargo" hidden><label>Module condition <progress id="story-integrity" max="100" value="100" aria-label="Module condition"></progress><span id="story-integrity-value">100%</span></label></div>');$('activity-hud').insertAdjacentHTML('beforeend','<button type="button" id="story-action" hidden></button>');
    $('story-open').onclick=()=>this.game.showPane('story');$('story-mark').onclick=()=>{if(!this.sites)return;this.guide=true;this.game.sandbox.serviceTarget=null;help.close();resetInput();this.game.hud();this.game.notify('Inez marked in gold. Meet her on foot at Harbor Auto.');};
    $('story-careful').onclick=()=>this.accept('careful');$('story-urgent').onclick=()=>this.accept('urgent');$('story-cancel').onclick=()=>this.finish(false,'cancelled');$('story-action').onclick=()=>this.interact();
  }
  buildWorld(){
    for(const [key,name,look]of[['contact','INEZ',{skin:'#c68a62',hair:'#1b1410',shirt:'#577169',pants:'#303b44',shoe:'#5d5244',long:true,hairStyle:'tied',garment:'jacket'}],['doctor','DR. VALE',{skin:'#8d5a3b',hair:'#68615a',shirt:'#dddcd1',pants:'#3d4652',shoe:'#353b3e',hairStyle:'crop',garment:'shirt'}]]){
      const H=mkHuman({...look,height:key==='contact'?1.72:1.8}),p=this.sites[key];H.g.position.set(p.x,worldElevation(p.x,p.z),p.z);H.g.rotation.y=-p.a;H.g.visible=false;
      const canvas=document.createElement('canvas');canvas.width=256;canvas.height=64;const ctx=canvas.getContext('2d');ctx.fillStyle='#17252de8';ctx.fillRect(0,0,256,64);ctx.font='bold 28px sans-serif';ctx.textAlign='center';ctx.fillStyle='#ffd38a';ctx.fillText(name,128,42);const texture=new THREE.CanvasTexture(canvas),label=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,depthWrite:false,toneMapped:false}));label.position.y=2.2;label.scale.set(1.3,.325,1);H.g.add(label);this.contacts.push({key,H,p,texture,cooldown:0});
    }
    this.case=new THREE.Group();const frame=mat('#35424a'),panel=mat('#b7a578');bx(panel,.24,.30,.36,0,0,0,this.case);for(const side of[-1,1]){bx(frame,.25,.035,.37,0,side*.13,0,this.case);bx(frame,.25,.30,.025,0,0,side*.17,this.case);}civicBar(this.case,[0,.15,-.11],[0,.20,-.11],.018,frame);civicBar(this.case,[0,.20,-.11],[0,.20,.11],.018,frame);civicBar(this.case,[0,.20,.11],[0,.15,.11],.018,frame);this.case.visible=false;S.add(this.case);
    this.ring=new THREE.Mesh(new THREE.TorusGeometry(1.5,.045,5,40).rotateX(-Math.PI/2),new THREE.MeshBasicMaterial({color:lin('#ffd38a'),transparent:true,opacity:.75,depthWrite:false}));this.ring.visible=false;S.add(this.ring);
  }
  near(p,r=2.6){if(!p)return false;const d=Math.hypot(P.x-p.x,P.z-p.z);if(d>=r)return false;for(let i=.25;i<d;i+=.25){const x=P.x+(p.x-P.x)*i/d,z=P.z+(p.z-P.z)*i/d;if(solid(x,z)||!car&&cars.some(v=>pedestrianVehicleDistance({x,z},v)<.1))return false;}return true;}
  eligible(v){return v&&v.n!=='Bike'&&!v.police&&!v.ai&&100-Math.round(v.dmg/1.5)>=40&&cars.includes(v);}
  rear(v){return{x:v.x-Math.cos(v.a)*(v.t.L/2+.9),z:v.z-Math.sin(v.a)*(v.t.L/2+.9),a:v.a};}
  loadCar(){return cars.filter(v=>this.eligible(v)&&this.game.clearFootprint(this.rear(v),{L:.8,W:.8})&&!cars.some(other=>other!==v&&pedestrianVehicleDistance(this.rear(v),other)<.5)).sort((a,b)=>Math.hypot(this.rear(a).x-P.x,this.rear(a).z-P.z)-Math.hypot(this.rear(b).x-P.x,this.rear(b).z-P.z))[0]||null;}
  target(){
    if(!this.sites||!this.active&&!this.guide&&!this.near(this.sites.contact))return null;const stage=this.active?.stage;
    if(!stage)return this.sites.contact;if(stage==='collect')return this.sites.pickup;if(stage==='carry'){const v=this.loadCar();return v?this.rear(v):this.sites.pickup;}
    if(stage==='deliver')return this.sites.doctor;if(stage==='unload')return this.vehicle?this.rear(this.vehicle):this.sites.parking;
    return !car&&this.vehicle?this.rear(this.vehicle):this.sites.parking;
  }
  prompt(){
    if(!this.sites||this.game.transition)return null;const a=this.active,foot=!car;
    if(!a){if(this.game.activity)return null;if(this.near(this.sites.contact))return{action:'talk',label:this.contacts.find(c=>c.key==='contact')?.cooldown?'Inez is recovering · wait':foot?'Talk to Inez':'Step out to talk to Inez',enabled:foot&&!this.contacts.find(c=>c.key==='contact')?.cooldown};return null;}
    if(a.stage==='collect'&&this.near(this.sites.pickup))return{action:'pickup',label:foot?'Collect controller':'Step out to collect controller',enabled:foot};
    if(a.stage==='carry'){const v=this.loadCar();if(v&&this.near(this.rear(v)))return{action:'load',vehicle:v,label:Math.hypot(v.vx,v.vz)<.5?'Load controller · '+v.n:'Wait for the car to stop',enabled:foot&&Math.hypot(v.vx,v.vz)<.5};}
    if(a.stage==='unload'&&this.vehicle&&(car===this.vehicle||this.near(this.rear(this.vehicle))))return{action:'unload',label:foot?'Unload controller':'Park, step out and walk to the rear',enabled:foot&&this.near(this.rear(this.vehicle))&&Math.hypot(this.vehicle.vx,this.vehicle.vz)<.5};
    if(a.stage==='deliver'&&this.near(this.sites.doctor))return{action:'handoff',label:this.game.sandbox.heat>0?'Lose the police before the handoff':'Hand controller to Dr. Vale',enabled:foot&&this.game.sandbox.heat===0};return null;
  }
  interact(){
    const p=this.prompt();if(!p)return false;if(!p.enabled){this.game.notify(p.label);return true;}
    if(p.action==='talk'){this.guide=true;this.game.sandbox.serviceTarget=null;this.game.showPane('story');openHelp();return true;}
    const before=this.active?.stage,valid=this.run.act(p.action,{onFoot:!car,near:true,stopped:true,eligible:this.eligible(p.vehicle),vehicle:p.vehicle?{name:p.vehicle.n,damage:p.vehicle.dmg}:null,atClinic:this.atClinic(),clear:this.game.sandbox.heat===0});
    if(valid){if(p.action==='load'){this.vehicle=p.vehicle;this.game.lastVehicle=p.vehicle;}this.changed(before);}return true;
  }
  accept(mode){
    if(!this.sites||this.active||this.game.activity||this.game.transition||car||!this.near(this.sites.contact)||this.contacts.find(c=>c.key==='contact')?.cooldown||this.game.sandbox.heat>0){this.game.notify('Meet Inez on foot with no wanted level, and finish any active job.');return;}
    if(this.run.start(mode)){this.guide=true;this.vehicle=null;this.game.sandbox.serviceTarget=null;help.close();resetInput();this.changed(null);}
  }
  beforeEnter(v){if(this.carrying){this.game.notify('Load the controller at a stopped car’s rear with Q before entering.');return false;}if(this.active&&this.vehicle&&v!==this.vehicle){this.game.notify('The controller is in your booked '+this.vehicle.n+'. Return to it.');return false;}return true;}
  atClinic(){return !!this.vehicle&&Math.hypot(this.vehicle.x-this.sites.parking.x,this.vehicle.z-this.sites.parking.z)<16;}
  line(){return this.active?{collect:'Inez: The spare controller is waiting outside the fuel shop. Pick it up on foot.',carry:'Inez: Load it at the rear of a parked car. The contacts inside are fragile.',drive:'Inez: Get it to the clinic. Crashes and harsh driving damage the controller.',unload:'Dr. Vale: Park there. Step out and bring the controller to the entrance.',deliver:'Dr. Vale: Over here. Hand me the controller when you are clear of the police.'}[this.active.stage]:'Inez: The clinic’s backup controller failed. Our spare is at the fuel shop. Can you collect it and hand it to Dr. Vale at the clinic entrance?';}
  changed(before){
    if(!this.active){this.settle();return;}if(this.active.stage!==before){this.dialogue=this.line();this.routeTime=0;this.syncVisual();this.game.notify(this.dialogue);this.game.save();this.game.hud();}
  }
  tick(){
    if(!this.sites)return;for(const c of this.contacts){c.cooldown=Math.max(0,c.cooldown-DT);const hitter=c.cooldown===0&&cars.find(v=>Math.hypot(v.vx,v.vz)>3&&pedestrianVehicleDistance(c.p,v)<c.H.radius);if(hitter){c.cooldown=8;if(hitter===car)this.game.sandbox.crime(1.3,'Contact collision reported');if(this.active)this.finish(false,'contact');}}
    this.syncVisual();
    if(this.active?.stage==='collect'&&cars.some(v=>Math.hypot(v.vx,v.vz)>2&&pedestrianVehicleDistance(this.sites.pickup,v)<.22))this.finish(false,'cargo');
    const a=this.active;if(a){const before=a.stage,v=this.vehicle;this.run.tick({stars:this.game.sandbox.stars,vehicle:v&&cars.includes(v)?{damage:v.dmg}:null,driving:car===v,atClinic:this.atClinic(),stopped:v?Math.hypot(v.vx,v.vz)<.5:false,speed:v?Math.hypot(v.vx,v.vz):0,ax:v?.ax||0,ay:v?.ay||0},DT);if(this.active?.stage!==before)this.changed(before);}
    this.carryPose();
    this.routeTime-=DT;const target=this.target();if(target&&this.routeTime<=0){this.route=this.game.sandbox.routeFor(P,target).slice(0,1200);this.routeTime=2;}
    if(this.carrying)P.H.tor.rotation.z=0;
  }
  carryPose(){if(!this.carrying)return;P.H.tor.rotation.z=0;P.H.tor.scale.y=1;for(const [i,arm]of P.H.arms.entries()){arm.sh.rotation.z=.35;arm.sh.rotation.x=(i?1:-1)*.16;arm.el.rotation.z=1;}}
  syncVisual(){
    if(!this.sites)return;for(const c of this.contacts){const near=Math.hypot(c.p.x-P.x,c.p.z-P.z)<80;c.H.g.visible=near;if(near&&!help.open){anim(c.H,this.game.elapsed*.6,0,false,false);c.H.tor.scale.y=1+Math.sin(this.game.elapsed*1.5)*.004;c.H.g.rotation.y=-c.p.a;c.H.head.rotation.y=-Math.max(-.6,Math.min(.6,pedestrianAngle(Math.atan2(P.z-c.p.z,P.x-c.p.x)-c.p.a)));for(const eye of c.H.eyes)eye.scale.y=.02*((this.game.elapsed%4.8)>4.65?.15:1);if(c.cooldown>0)c.H.arms[0].sh.rotation.z=-1.8;}}
    const a=this.active,target=this.target();this.ring.visible=!!target;this.ring.position.set(target?.x||0,.13+worldElevation(target?.x||0,target?.z||0),target?.z||0);
    this.case.visible=!!a;if(!a)return;
    if(this.carrying){this.carryPose();if(this.case.parent!==P.H.body)P.H.body.add(this.case);this.case.scale.setScalar(1/P.o.scale.x);this.case.position.set(.38,1.08,0);this.case.quaternion.identity();}
    else{this.case.scale.setScalar(1);if(this.case.parent!==S)S.add(this.case);if(a.stage==='collect'){this.case.position.set(this.sites.pickup.x,worldElevation(this.sites.pickup.x,this.sites.pickup.z)+.17,this.sites.pickup.z);this.case.rotation.set(0,-this.sites.pickup.a,0);}else if(this.vehicle){this.case.visible=Math.hypot(this.vehicle.x-P.x,this.vehicle.z-P.z)<80;this.case.position.set(-this.vehicle.t.L*.12,Math.max(.7,cabinSeating(this.vehicle.t,this.vehicle.n).floor+.17),0).applyQuaternion(this.vehicle.o.quaternion).add(this.vehicle.o.position);this.case.quaternion.copy(this.vehicle.o.quaternion);}}
  }
  finish(success,reason){if(this.run.finish(success,reason))this.settle();}
  settle(){
    const r=this.run.result;if(!r||this.settled===r)return;this.settled=r;if(r.reward){this.game.sandbox.cash+=r.reward;this.game.sandbox.earned+=r.reward;}
    this.guide=false;this.vehicle=null;this.route=[];for(const [i,arm]of P.H.arms.entries()){arm.sh.rotation.z=0;arm.sh.rotation.x=(i?1:-1)*.07;arm.el.rotation.z=.15;}if(this.case){this.case.visible=false;S.add(this.case);}if(this.ring)this.ring.visible=false;
    this.dialogue=r.success?`Dr. Vale: Backup restored. You got it here in time. ${r.reward?'Payment: $'+r.reward+'.':'Replay complete; no additional payment.'}`:`Inez: ${StoryMission.failures[r.reason]||'The run ended.'} Meet me when you want to retry.`;
    this.game.notify(this.dialogue,!r.success);this.game.save();this.game.hud();this.game.renderMenu();
  }
  static failures={timeout:'We missed the handover.',pursuit:'The police pursuit made the handoff unsafe.',lost:'We lost the car carrying the controller.',engine:'The loaded car’s engine is disabled.',cargo:'The controller was damaged beyond use.',cancelled:'You abandoned the run.',recovered:'The loaded car was recovered; the run is over.',wasted:'You were incapacitated.',busted:'You were arrested.',contact:'A contact was hit.'};
  renderMenu(){
    const $=id=>document.getElementById(id);if(!$('story-summary'))return;const a=this.active,near=!car&&this.near(this.sites?.contact),available=!!this.sites;
    $('story-dialogue').textContent=this.dialogue||this.line();$('story-summary').textContent=!available?'This city layout has no clear mission sites.':a?this.objective():'Meet Inez on foot to choose the careful or urgent run.'+(this.run.completed?' Completed · replays pay no additional reward.':'');
    if(!a&&this.game.sandbox.heat>0)$('story-summary').textContent='Lose the police before Inez can offer this mission.';else if(!a&&this.game.activity)$('story-summary').textContent='Finish or cancel your current job before accepting Last Light.';
    $('story-open').textContent=this.run.completed?'Replay':'View';
    for(const mode of ['careful','urgent']){$('story-'+mode).hidden=!!a;$('story-'+mode).disabled=!available||!near||!!this.game.activity||this.game.sandbox.heat>0;$('story-'+mode).textContent=(mode==='careful'?'Careful run · 10 min':'Urgent run · 6 min')+(this.run.completed?' · replay':mode==='careful'?' · up to $1,200':' · up to $1,500');}
    $('story-mark').hidden=!!a;$('story-mark').disabled=!available||!!this.game.activity;$('story-cancel').hidden=!a;
  }
  objective(){const a=this.active;if(!a)return'Meet Inez at Harbor Auto · on foot';return{collect:'Collect the controller at the fuel shop · on foot',carry:'Load at the rear of a stopped car · 40% condition needed',drive:car!==this.vehicle?'Return to the car carrying the controller':'Drive the controller to Coastside Clinic',unload:car?'Park, step out, then walk to the rear':'Unload the controller at the car’s rear',deliver:'Carry the controller to Dr. Vale · on foot'}[a.stage];}
  remaining(){const seconds=Math.max(0,Math.ceil(LastLightState.modes[this.active.mode].limit-this.active.elapsed));return Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0');}
  hud(){
    const $=id=>document.getElementById(id),a=this.active,target=this.target(),show=!!target&&!this.game.activity;$('story-cargo').hidden=!a;$('story-action').hidden=true;if(!show)return;
    $('sandbox-tip').textContent='Gold marker · Last Light';$('activity-hud').hidden=false;$('passenger-status').hidden=true;$('activity-name').textContent='Last Light';$('activity-target').textContent=this.objective()+' · '+Math.round(Math.hypot(target.x-P.x,target.z-P.z))+' m';$('activity-time').textContent=a?this.remaining()+' remaining':'Story encounter';
    if(a){$('story-integrity').value=a.integrity;$('story-integrity-value').textContent=Math.round(a.integrity)+'%';}
    const prompt=this.prompt();$('story-action').hidden=!prompt;if(prompt){$('story-action').textContent='Q · '+prompt.label;$('story-action').disabled=!prompt.enabled;$('service-action').hidden=true;}
  }
  drawMini(ctx,scale){const target=this.target();if(!target)return;ctx.save();ctx.strokeStyle='#ffd38a';ctx.fillStyle='#ffd38a';ctx.lineWidth=1;ctx.beginPath();this.route.forEach((p,i)=>i?ctx.lineTo(p.x*scale,p.z*scale):ctx.moveTo(p.x*scale,p.z*scale));ctx.stroke();ctx.beginPath();ctx.arc(target.x*scale,target.z*scale,3,0,Math.PI*2);ctx.fill();ctx.restore();}
  obstacles(){if(!this.sites)return[];if(!this.avoidContacts)this.avoidContacts=this.contacts.map(c=>({x:c.p.x,z:c.p.z,radius:c.H.radius}));return this.active?.stage==='collect'?[...this.avoidContacts,{...this.sites.pickup,radius:.22}]:this.avoidContacts;}
  blocks(x,z,radius){return this.obstacles().some(p=>Math.hypot(x-p.x,z-p.z)<radius+p.radius);}
  snapshot(){return this.run.snapshot();}
  restore(data){
    if(!data)return;if(!this.run.restore(data)){this.run.active=null;this.dialogue='The saved mission was invalid. Meet Inez to restart; no reward was paid.';return;}
    this.settled=this.run.result;
    if(this.active){if(this.game.activity||car&&this.carrying){this.run.active=null;this.dialogue='The saved mission conflicted with the current job or carrying state. Meet Inez to restart.';return;}if(!this.sites){this.run.active=null;return;}if(['drive','unload'].includes(this.active.stage)){const v=this.game.lastVehicle;if(!v||v.n!==this.active.vehicleName||v.n==='Bike'){this.run.finish(false,'lost');this.dialogue='The loaded mission car could not be restored. Meet Inez to restart.';return;}this.vehicle=v;this.active.lastDamage=v.dmg;}this.guide=true;this.dialogue=this.line();}
  }
}
