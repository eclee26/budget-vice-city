/* Driving-focused sandbox: bounded police pool, economy and world services.
   All timers use simulation seconds; DrivingGame owns saves, notices and menus. */
class OpenWorld {
  constructor(game) {
    this.game=game; this.cash=500; this.heat=0; this.health=100;
    this.hidden=0; this.bust=0; this.immunity=0; this.crashCooldown=0;
    this.units=[]; this.lastKnown={x:P.x,z:P.z}; this.dispatch=0; this.seen=false;
    this.earned=0; this.escapes=0; this.distance=0; this.oldPosition=null; this.combo=0;
    this.nearMissed=new WeakSet(); this.service=null; this.serviceTarget=null;
    this.services=structurePlan.lots.filter(l=>['workshop','clinic','fuel'].includes(l.kind)).map(l=>{
      const a=l.access,dx=a.x-a.endX,dz=a.z-a.endZ,len=Math.hypot(dx,dz)||1;
      // At the road entrance, before any pumps or building colliders.
      return{kind:l.kind,x:a.endX+dx/len*2,z:a.endZ+dz/len*2,
        name:l.kind==='workshop'?'Harbor Auto':l.kind==='clinic'?'Coastside Clinic':l.variant?'Harbor Fuel':'Sunway Fuel'};
    });
    this.buildUI(); this.makeServiceMarkers();
  }
  buildUI() {
    document.getElementById('h').insertAdjacentHTML('beforeend',`<div id="sandbox-hud"><div class="sandbox-wallet"><span id="district-name">Coastside</span><strong id="cash-value">$500</strong></div><div class="sandbox-vitals"><span>Health</span><progress id="health-bar" value="100" max="100" aria-label="Player health"></progress><span id="health-value">100</span></div><div id="pursuit-hud" hidden><div id="wanted-stars" aria-label="Wanted level"></div><p id="pursuit-status"></p><progress id="escape-bar" value="0" max="1" aria-label="Pursuit escape progress"></progress></div><button type="button" id="service-action" hidden></button><p id="sandbox-tip">Earn cash from jobs. Q uses nearby services.</p></div>`);
    const pane=document.getElementById('gp-activities');
    pane.querySelector('h2').textContent='Jobs & free roam';
    pane.insertAdjacentHTML('beforeend',`<section class="sandbox-menu"><h2>Your city, your rules</h2><p>Complete jobs for cash, thread traffic for near-miss bonuses, or take on Hot cargo. Crashes, pedestrian collisions and stealing occupied cars attract police. Break line of sight, then stay hidden until the search ends.</p><p id="career-stats"></p><h3>City services</h3><p>Stop at a marked entrance and press Q or use the on-screen button. Services are unavailable during a pursuit. Fuel stations offer a $40 roadside tune-up; fuel consumption is not simulated.</p><div class="gp-actions" id="service-routes"></div><p id="service-route-status">Choose a destination to mark it on the map.</p><button type="button" class="gp-button" id="clear-service-route" hidden>Clear destination</button></section>`);
    for(const s of this.services){const b=document.createElement('button');b.type='button';b.className='gp-button';b.textContent=s.name;b.onclick=()=>{this.serviceTarget=s;this.renderMenu();this.game.notify(`${s.name} marked on the map. Stop at the entrance to use the service.`);};document.getElementById('service-routes').append(b);}
    document.getElementById('clear-service-route').onclick=()=>{this.serviceTarget=null;this.renderMenu();};
    document.getElementById('service-action').onclick=()=>this.interact();
    document.getElementById('gp-controls').querySelector('dl').insertAdjacentHTML('beforeend','<dt>Use nearby service</dt><dd><kbd>Q</kbd></dd>');
    for(const [id,reward] of Object.entries({race:650,delivery:400,parking:250,time:800})){
      const description=document.querySelector(`[data-activity="${id}"]`).previousElementSibling.querySelector('p');description.textContent=`$${reward.toLocaleString('en-US')} · ${description.textContent}`;
    }
  }
  makeServiceMarkers() {
    this.markerGeometry=new THREE.TorusGeometry(3.2,.075,5,32).rotateX(-Math.PI/2);
    this.markerMaterial=new THREE.MeshBasicMaterial({color:lin('#76e4e1'),transparent:true,opacity:.65,depthWrite:false});
    for(const s of this.services){s.mesh=new THREE.Mesh(this.markerGeometry,this.markerMaterial);s.mesh.position.set(s.x,.14,s.z);S.add(s.mesh);}
  }
  get stars(){return this.heat>0?Math.min(5,Math.ceil(this.heat)):0;}
  crime(amount,message) {
    if(this.immunity>0)return;
    const previous=this.stars;this.heat=Math.min(5,this.heat+amount);this.hidden=0;this.lastKnown={x:P.x,z:P.z};
    if(this.stars>previous)this.game.notify(`${message} · Wanted level ${this.stars}. Break line of sight.`,true);
  }
  collision(other,impact) {
    if(this.immunity>0||this.crashCooldown>0)return;
    this.crashCooldown=1.5;
    this.health=Math.max(0,this.health-Math.max(0,impact-5)*.6);
    if(!other.policeActive&&impact>5)this.crime(other.police?1.5:.45,other.police?'Police vehicle hit':'Traffic collision reported');
  }
  reward(kind) {
    const amount={race:650,delivery:400,parking:250,time:800,getaway:1800}[kind]||0;
    this.cash+=amount;this.earned+=amount;return amount;
  }
  snapshot(){return{cash:this.cash,health:this.health,heat:this.heat,earned:this.earned,escapes:this.escapes,distance:this.distance};}
  restore(data) {
    if(!data||typeof data!=='object')return;
    for(const [key,min,max] of [['cash',0,1e8],['health',1,100],['heat',0,5],['earned',0,1e9],['escapes',0,1e6],['distance',0,1e9]])
      if(typeof data[key]==='number'&&Number.isFinite(data[key]))this[key]=clamp(data[key],min,max);
  }
  lineClear(a,b) {
    const d=Math.hypot(a.x-b.x,a.z-b.z);
    for(let t=3;t<d-2;t+=3)if(solid(a.x+(b.x-a.x)*t/d,a.z+(b.z-a.z)*t/d))return false;
    return true;
  }
  makeUnit() {
    const v=mkCar('Sedan');v.police=true;
    // Own paint overrides: never recolour shared civilian materials.
    const paint=carMat('#e1e5e3').clone();
    v.o.traverse(o=>{if(o.isMesh&&o.material.isMeshPhysicalMaterial&&o.material!==GLASS&&o.material.clearcoat>.2)o.material=paint;});
    bx('#19232d',1.6,.10,.75,-.2,2.04,0,v.o);
    v.sirens=[-1,1].map(side=>{const material=new THREE.MeshBasicMaterial({color:side<0?'#ff4759':'#479bff',toneMapped:false});const mesh=bx(material,.65,.15,.31,-.2,2.15,side*.2,v.o);mesh.visible=false;return mesh;});
    const canvas=document.createElement('canvas');canvas.width=256;canvas.height=64;const c=canvas.getContext('2d');c.fillStyle='#172633';c.fillRect(0,0,256,64);c.fillStyle='#f4f2e8';c.font='bold 40px sans-serif';c.textAlign='center';c.fillText('POLICE',128,46);
    const material=new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(canvas),side:THREE.DoubleSide});
    for(const side of[-1,1]){const m=new THREE.Mesh(new THREE.PlaneGeometry(1.6,.4),material);m.position.set(-.1,.92,side*(v.t.W/2+.025));if(side<0)m.rotation.y=Math.PI;v.o.add(m);}
    this.units.push(v);return v;
  }
  dispatchUnit() {
    // Only dispatch on a vacant road outside the player's immediate view.
    const candidates=[];
    for(const e of roads)for(let i=15;i<e.points.length-15;i+=16){const p=lanePoint(e,i),d=Math.hypot(p.x-P.x,p.z-P.z);if(d>80&&d<155&&this.game.clearFootprint(p,TY.Sedan)&&!cars.some(v=>Math.hypot(v.x-p.x,v.z-p.z)<9))candidates.push(p);}
    if(!candidates.length)return;
    const v=this.units.find(v=>v!==car&&!v.policeActive&&Math.hypot(v.x-P.x,v.z-P.z)>75)||(this.units.length<3?this.makeUnit():null);if(!v)return;
    const p=candidates[Math.floor(R()*candidates.length)];Object.assign(v,{x:p.x,z:p.z,a:p.a,vx:0,vz:0,yr:0,dmg:0,ai:null,policeActive:true,repath:0,stuck:0,reverse:0,g:1});
    v.o.position.set(v.x,0,v.z);v.o.rotation.set(0,-v.a,0);v.o.visible=true;v.contacts=null;v.route=null;
  }
  nearestRoad(p) {
    let result=null,distance=Infinity;
    for(const e of roads)for(let i=0;i<e.points.length;i+=3){const q=e.points[i],d=Math.hypot(q.x-p.x,q.z-p.z);if(d<distance){distance=d;result={e,i};}}
    return result;
  }
  routeFor(v,target) {
    const from=this.nearestRoad(v),to=this.nearestRoad(target),cost=new Map(),previous=new Map(),open=new Set(nodes);
    for(const n of nodes)cost.set(n,Infinity);
    cost.set(to.e.a,to.i);cost.set(to.e.b,to.e.points.length-1-to.i);
    while(open.size){let n=null;for(const candidate of open)if(n===null||cost.get(candidate)<cost.get(n))n=candidate;open.delete(n);if(!Number.isFinite(cost.get(n)))break;
      for(const e of n.links){const other=e.a===n?e.b:e.a,c=cost.get(n)+e.points.length;if(c<cost.get(other)){cost.set(other,c);previous.set(other,{e,next:n});}}
    }
    const points=[],append=(e,start,end)=>{const dir=end>=start?1:-1;for(let i=start;dir>0?i<=end:i>=end;i+=dir*3)points.push(lanePoint(e,i,dir));};
    if(from.e===to.e){append(from.e,from.i,to.i);return points;}
    let n=cost.get(from.e.a)+from.i<cost.get(from.e.b)+from.e.points.length-from.i?from.e.a:from.e.b;
    append(from.e,from.i,n===from.e.a?0:from.e.points.length-1);
    for(let guard=0;guard<nodes.length&&previous.has(n);guard++){const{e,next}=previous.get(n);append(e,e.a===n?0:e.points.length-1,e.a===n?e.points.length-1:0);n=next;}
    append(to.e,n===to.e.a?0:to.e.points.length-1,to.i);return points;
  }
  drivePolice(v) {
    const sp=Math.hypot(v.vx,v.vz),distance=Math.hypot(v.x-P.x,v.z-P.z);
    v.repath-=DT;
    if(v.repath<=0){v.route=this.routeFor(v,this.lastKnown);v.routeIndex=0;v.repath=1.2;}
    const look=5+sp*.45;
    while(v.routeIndex<v.route.length-1&&Math.hypot(v.route[v.routeIndex].x-v.x,v.route[v.routeIndex].z-v.z)<look)v.routeIndex++;
    let target=v.route[v.routeIndex]||this.lastKnown;
    if(distance<32&&this.lineClear(v,P))target=P;
    const angle=Math.atan2(target.z-v.z,target.x-v.x)-v.a,da=Math.atan2(Math.sin(angle),Math.cos(angle));
    let desired=Math.min(21+this.stars*1.8,Math.sqrt(6/(Math.abs(da)/look+.008)));
    const fx=Math.cos(v.a),fz=Math.sin(v.a),probe=4+sp*.45;
    if(solid(v.x+fx*probe,v.z+fz*probe))desired=0;
    for(const other of cars)if(other!==v&&other!==car){const dx=other.x-v.x,dz=other.z-v.z,along=dx*fx+dz*fz;if(along>0&&along<5+sp*.65&&Math.abs(dz*fx-dx*fz)<2)desired=Math.min(desired,Math.max(0,along-5));}
    v.stuck=sp<.6?v.stuck+DT:0;
    if(v.stuck>3){v.reverse=1.3;v.stuck=0;}
    if(v.reverse>0){v.reverse-=DT;phys(v,0,1,-Math.sign(da),false);}
    else phys(v,clamp((desired-sp)*.3,0,1),clamp((sp-desired)*.4,0,1),clamp(Math.atan2(2*v.t.wb*Math.sin(da),look)/v.t.st,-1,1),false);
  }
  endPursuit() {
    this.heat=0;this.hidden=0;this.bust=0;this.seen=false;
    for(const v of this.units)if(v.policeActive){v.policeActive=false;v.sirens.forEach(m=>m.visible=false);
      const nearest=this.nearestRoad(v),dir=Math.cos(v.a-lanePoint(nearest.e,nearest.i).a)>=0?1:-1,path=driveLane(nearest.e,dir);let i=0,d=Infinity;path.forEach((p,j)=>{const gap=Math.hypot(v.x-p.x,v.z-p.z);if(gap<d){d=gap;i=j;}});v.ai={e:nearest.e,dir,path,i,stk:0};}
  }
  respawn(reason) {
    if(this.game.transition)return;
    const fee=Math.min(this.cash,reason==='BUSTED'?250:150);this.cash-=fee;
    if(this.game.activity)this.game.finishActivity(false,`${reason}. Job failed.`);
    this.endPursuit();this.immunity=8;this.health=100;resetInput();
    const old=car;car=null;if(old){old.vx=old.vz=old.yr=0;old.policeActive=false;old.o.visible=true;this.game.lastVehicle=old;}
    const lot=structurePlan.lots.find(l=>l.kind===(reason==='BUSTED'?'police':'clinic'));
    const origin=lot?{x:lot.access.endX,z:lot.access.endZ}:start;
    let point=null;
    for(let radius=3;radius<25&&!point;radius+=2)for(let j=0;j<16;j++){const p={x:origin.x+Math.cos(j*Math.PI/8)*radius,z:origin.z+Math.sin(j*Math.PI/8)*radius,a:0};if(this.game.clearFootprint(p,{L:.8,W:.8})&&!cars.some(v=>Math.hypot(v.x-p.x,v.z-p.z)<5)){point=p;break;}}
    point ||= start;P.x=point.x;P.z=point.z;P.y=P.vy=P.vx=P.vz=0;P.o.visible=true;P.o.position.set(P.x,0,P.z);camMode=0;this.game.visualPrevious=null;this.oldPosition=null;
    this.game.notify(`${reason} · $${fee} ${reason==='BUSTED'?'fine':'medical bill'}. Your last car remains in the city.`,true);this.game.save();updateHud();
  }
  interact() {
    const s=this.nearbyService();
    if(!s){this.game.notify('Stop at a fuel station, clinic or workshop entrance. Mark one in Jobs & free roam.');return;}
    if(this.game.transition)return;
    if(this.heat>0){this.game.notify('Lose the police before using city services.',true);return;}
    if(car&&Math.hypot(car.vx,car.vz)>.6){this.game.notify('Stop the car before using this service.');return;}
    if(this.game.activity){this.game.notify('Finish or cancel your job before using a service.');return;}
    const price=s.kind==='clinic'?75:s.kind==='workshop'?150:40;
    if(s.kind!=='clinic'&&!car){this.game.notify('Bring a car to use this service.');return;}
    if(s.kind==='clinic'?this.health>=100:car.dmg<1){this.game.notify(s.kind==='clinic'?'You are already healthy.':'This car does not need repairs.');return;}
    if(this.cash<price){this.game.notify(`You need $${price}. Complete a job to earn cash.`,true);return;}
    this.cash-=price;if(s.kind==='clinic')this.health=100;else{car.dmg=s.kind==='workshop'?0:Math.max(0,car.dmg-35);car.contacts=null;}
    this.serviceTarget=null;this.game.notify(`${s.kind==='clinic'?'Health restored':s.kind==='workshop'?'Vehicle repaired':'Quick tune-up complete'} · −$${price}`);this.game.save();this.hud();updateHud();
  }
  tick() {
    this.immunity=Math.max(0,this.immunity-DT);this.crashCooldown=Math.max(0,this.crashCooldown-DT);
    if(this.oldPosition&&car){const d=Math.hypot(P.x-this.oldPosition.x,P.z-this.oldPosition.z);if(d<5)this.distance+=d;}
    this.oldPosition={x:P.x,z:P.z};
    this.combo=Math.max(0,this.combo-DT);
    if(car&&Math.hypot(car.vx,car.vz)>13&&!this.game.transition){for(const other of cars)if(other!==car&&!other.police){const d=Math.hypot(car.x-other.x,car.z-other.z);if(d<4.5&&d>3&&!this.nearMissed.has(other)&&this.crashCooldown===0){this.nearMissed.add(other);this.cash+=25;this.earned+=25;this.combo=2;this.game.notify('Near miss · +$25');}}}
    for(const v of this.units){const flash=Math.floor(this.game.elapsed*7)%2;v.sirens.forEach((m,i)=>m.visible=v.policeActive&&i===flash);}
    if(this.health<=0){this.respawn('WASTED');return;}
    if(this.heat>0){
      this.dispatch-=DT;if(this.dispatch<=0){this.dispatch=3;if(this.units.filter(v=>v.policeActive).length<Math.min(3,this.stars))this.dispatchUnit();}
      const active=this.units.filter(v=>v.policeActive);
      this.seen=active.some(v=>Math.hypot(v.x-P.x,v.z-P.z)<90&&this.lineClear(v,P));
      if(this.seen){this.lastKnown={x:P.x,z:P.z};this.hidden=0;}else this.hidden+=DT;
      const pinned=active.some(v=>Math.hypot(v.x-P.x,v.z-P.z)<9&&this.lineClear(v,P))&&(!car||Math.hypot(car.vx,car.vz)<1.6);
      this.bust=pinned&&!this.game.transition?this.bust+DT:Math.max(0,this.bust-DT*2);
      if(this.bust>=5){this.respawn('BUSTED');return;}
      if(this.hidden>=18+this.stars*5){this.escapes++;this.endPursuit();this.game.notify('Pursuit escaped. You are off the radar.');this.game.save();}
    }
    for(const s of this.services)s.mesh.visible=Math.hypot(s.x-P.x,s.z-P.z)<65;
  }
  audio() {
    if(!gameAudio.ctx||!gameAudio.master)return;
    if(!this.sirenAudio){const c=gameAudio.ctx,oscillator=c.createOscillator(),gain=c.createGain();oscillator.type='sine';gain.gain.value=0;oscillator.connect(gain);gain.connect(gameAudio.master);oscillator.start();this.sirenAudio={oscillator,gain};}
    let nearest=Infinity;for(const v of this.units)if(v.policeActive&&v!==car)nearest=Math.min(nearest,Math.hypot(v.x-P.x,v.z-P.z));
    gameAudio.ramp(this.sirenAudio.gain.gain,gameAudio.active()?Math.max(0,1-nearest/110)*.11:0,.08);
    gameAudio.ramp(this.sirenAudio.oscillator.frequency,650+Math.sin(this.game.elapsed*5)*220,.04);
  }
  nearbyService() {
    let nearest=null,distance=11;
    for(const s of this.services){const d=Math.hypot(s.x-P.x,s.z-P.z);if(d<distance){distance=d;nearest=s;}}
    return nearest;
  }
  hud() {
    document.getElementById('cash-value').textContent='$'+Math.floor(this.cash).toLocaleString('en-US');
    document.getElementById('health-bar').value=this.health;document.getElementById('health-value').textContent=Math.ceil(this.health);
    const district=P.x<90?'Ocean Beach':P.x<170?'Coastside':P.z>330?'Harbor District':P.x>290?'Downtown':'Palm Gardens';
    document.getElementById('district-name').textContent=district;
    document.getElementById('pursuit-hud').hidden=this.heat===0;
    const stars=document.getElementById('wanted-stars');stars.textContent='★'.repeat(this.stars)+'☆'.repeat(5-this.stars);stars.setAttribute('aria-label',`Wanted level ${this.stars} of 5`);
    document.getElementById('pursuit-status').textContent=this.bust>0?`BUSTING · Move! ${Math.max(0,5-this.bust).toFixed(1)}s`:this.seen?'IN PURSUIT · Break line of sight':`SEARCHING · Stay hidden ${Math.max(0,Math.ceil(18+this.stars*5-this.hidden))}s`;
    document.getElementById('escape-bar').value=this.hidden/(18+this.stars*5);
    this.service=this.nearbyService();
    const button=document.getElementById('service-action');button.hidden=!this.service;
    if(this.service){const s=this.service;button.textContent=`Q · ${s.kind==='clinic'?'Restore health · $75':s.kind==='workshop'?'Repair car · $150':'Tune-up · $40'}`;}
    const tip=document.getElementById('sandbox-tip');tip.textContent=this.serviceTarget?`${this.serviceTarget.name} · ${Math.round(Math.hypot(P.x-this.serviceTarget.x,P.z-this.serviceTarget.z))} m · gold map marker`:this.heat>0?'Police use sight. Buildings can hide you.':'Jobs pay $250–$1,800 · Menu → Activities';
  }
  renderMenu() {
    document.getElementById('career-stats').textContent=`$${Math.floor(this.cash).toLocaleString('en-US')} cash · $${Math.floor(this.earned).toLocaleString('en-US')} earned · ${this.escapes} pursuits escaped · ${(this.distance/1000).toFixed(1)} km driven`;
    document.getElementById('service-route-status').textContent=this.serviceTarget?`Destination: ${this.serviceTarget.name}. Follow the gold map marker.`:'Choose a destination to mark it on the map.';
    document.getElementById('clear-service-route').hidden=!this.serviceTarget;
  }
  drawMini(ctx,scale) {
    ctx.save();
    if(this.heat>0){ctx.strokeStyle=this.seen?'#ff828d':'#ffd38a';ctx.globalAlpha=.5;ctx.beginPath();ctx.arc(this.lastKnown.x*scale,this.lastKnown.z*scale,90*scale,0,Math.PI*2);ctx.stroke();ctx.globalAlpha=1;}
    for(const v of this.units)if(v.policeActive){ctx.fillStyle=Math.floor(this.game.elapsed*5)%2?'#ff828d':'#76e4e1';ctx.beginPath();ctx.arc(v.x*scale,v.z*scale,2.5,0,Math.PI*2);ctx.fill();}
    if(this.serviceTarget){const s=this.serviceTarget;ctx.strokeStyle='#ffd38a';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(s.x*scale,s.z*scale,5,0,Math.PI*2);ctx.stroke();ctx.fillStyle='#ffd38a';ctx.fillRect(s.x*scale-1.5,s.z*scale-1.5,3,3);}
    ctx.restore();
  }
}
