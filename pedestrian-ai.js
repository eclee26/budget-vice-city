/* Ambient behavior uses simulation time only. Geometry and drawing stay owned
   by the city; no timers, actors or materials are created by this controller. */
function pedestrianAngle(a){return Math.atan2(Math.sin(a),Math.cos(a));}
function pedestrianVehicleDistance(p,v){
  const c=Math.cos(v.a),s=Math.sin(v.a),dx=p.x-v.x,dz=p.z-v.z;
  const x=Math.abs(dx*c+dz*s)-v.t.L/2,z=Math.abs(dz*c-dx*s)-v.t.W/2;
  return Math.hypot(Math.max(0,x),Math.max(0,z))+Math.min(0,Math.max(x,z));
}
function pedestrianVehicleThreat(p,v,horizon=1.2){
  const c=Math.cos(v.a),s=Math.sin(v.a),dx=p.x-v.x,dz=p.z-v.z;
  const x=dx*c+dz*s,z=dz*c-dx*s,rx=(p.vx||0)-(v.vx||0),rz=(p.vz||0)-(v.vz||0);
  const velocities=[rx*c+rz*s,rz*c-rx*s],positions=[x,z],extents=[v.t.L/2+.55,v.t.W/2+.55];
  let enter=0,leave=horizon;
  for(let axis=0;axis<2;axis++){
    const velocity=velocities[axis],position=positions[axis],extent=extents[axis];
    if(Math.abs(velocity)<1e-7){if(Math.abs(position)>extent)return null;continue;}
    const a=(-extent-position)/velocity,b=(extent-position)/velocity;
    enter=Math.max(enter,Math.min(a,b));leave=Math.min(leave,Math.max(a,b));if(enter>leave)return null;
  }
  return enter<=horizon&&leave>=0?{time:enter,side:z>=0?1:-1}:null;
}
class AmbientPedestrians{
  constructor(world){this.world=world;this.time=0;this.serial=0;this.grid=new Map();this.active=new Set();this.stats={walking:0,idle:0,talking:0,fleeing:0,down:0};}
  reset(p){
    this.release(p);p.ambient={id:++this.serial,mode:'walk',until:0,nextEvent:this.time+8+this.world.random()*18,nextGreeting:0,look:null,lookUntil:0,blocked:0};p.vx=p.vz=0;
    return p.ambient;
  }
  release(p){
    const state=p.ambient,partner=state?.partner;
    if(partner?.ambient?.partner===p){partner.ambient.partner=null;partner.ambient.mode='walk';partner.ambient.nextEvent=this.time+10;}
    if(state)state.partner=null;
  }
  resume(p){const state=p.ambient;this.release(p);state.mode='walk';state.nextEvent=this.time+10+this.world.random()*18;state.blocked=0;}
  nearby(p){
    const result=[],x=Math.floor(p.x/3),z=Math.floor(p.z/3);
    for(let i=x-1;i<=x+1;i++)for(let j=z-1;j<=z+1;j++){const bucket=this.grid.get(i+','+j);if(bucket)for(const other of bucket)if(other!==p&&!other.dn)result.push(other);}
    return result;
  }
  horn(v,peds){
    const c=Math.cos(v.a),s=Math.sin(v.a);
    for(const p of peds){const dx=p.x-v.x,dz=p.z-v.z,d=Math.hypot(dx,dz);if(p.dn||d>18||dx*c+dz*s<-.5)continue;
      const state=p.ambient||this.reset(p);if((state.hornCooldown||0)>this.time)continue;
      state.hornCooldown=this.time+4;state.look={x:v.x,z:v.z};state.lookUntil=this.time+1.25;state.startleUntil=this.time+.55;
    }
  }
  routeHeading(p){
    const w=p.walk;if(!w||w.path.length<2)return p.a;
    let best=w.i,distance=Infinity;
    for(let i=Math.max(0,w.i-8);i<=Math.min(w.path.length-1,w.i+8);i++){
      const q=w.path[i],d=(p.x-q.x)**2+(p.z-q.z)**2;if(d<distance){best=i;distance=d;}
    }
    w.i=best;if((w.i===0&&w.dir<0||w.i===w.path.length-1&&w.dir>0)&&distance<.8)w.dir*=-1;
    const q=w.path[Math.max(0,Math.min(w.path.length-1,w.i+w.dir*2))];return Math.atan2(q.z-p.z,q.x-p.x);
  }
  event(p,neighbors){
    const state=p.ambient;if(this.time<state.nextEvent)return;
    state.nextEvent=this.time+10+this.world.random()*18;
    const partner=neighbors.find(q=>q.ambient?.mode==='walk'&&q.ambient.nextEvent<=this.time+6&&Math.hypot(q.x-p.x,q.z-p.z)>.85&&Math.hypot(q.x-p.x,q.z-p.z)<1.9&&this.world.safe(p,(p.x+q.x)/2,(p.z+q.z)/2));
    if(partner){const until=this.time+2.5+this.world.random()*2;
      for(const [a,b]of[[p,partner],[partner,p]]){a.ambient.mode='talk';a.ambient.partner=b;a.ambient.until=until;a.vx=a.vz=0;}
    }else if(this.world.random()<.45){state.mode=this.world.random()<.5?'look':'stretch';state.until=this.time+1.5+this.world.random()*1.5;}
  }
  chooseStep(p,heading,speed,neighbors,cars,dt){
    let best=null,bestScore=Infinity;
    for(const offset of[0,-.55,.55,-1.05,1.05,-1.57,1.57,Math.PI]){
      const a=heading+offset,dx=Math.cos(a),dz=Math.sin(a),x=p.x+dx*speed*dt,z=p.z+dz*speed*dt,look=.48+speed*.25;
      if(!this.world.safe(p,x,z)||!this.world.safe(p,p.x+dx*look,p.z+dz*look))continue;
      if(cars.some(v=>{if(Math.hypot(v.x-p.x,v.z-p.z)>=v.t.L+3)return false;const gap=pedestrianVehicleDistance({x,z},v);return gap<Math.max(.28,p.radius||0)&&gap<=pedestrianVehicleDistance(p,v)+1e-6;}))continue;
      let score=Math.abs(offset)*.22,clear=true;
      for(const other of neighbors){const distance=Math.hypot(x-other.x,z-other.z),old=Math.hypot(p.x-other.x,p.z-other.z);
        if(distance<(p.radius||.25)+(other.radius||.25)&&distance<old-1e-5){clear=false;break;}
        const ahead=Math.hypot(p.x+dx*look-other.x,p.z+dz*look-other.z);score+=Math.max(0,1.05-ahead)**2*3;
      }
      if(!clear)continue;if(score<bestScore){best={x,z,a};bestScore=score;}if(score<.001)break;
    }
    return best;
  }
  tick(peds,cars,player,dt,extras=[]){
    this.time+=dt;this.grid.clear();this.active.clear();for(const key of Object.keys(this.stats))this.stats[key]=0;
    for(const p of peds){this.active.add(p);if(!p.ambient)this.reset(p);const key=Math.floor(p.x/3)+','+Math.floor(p.z/3);if(!this.grid.has(key))this.grid.set(key,[]);this.grid.get(key).push(p);}
    for(const p of peds){
      let state=p.ambient;
      if(p.dn){this.release(p);state.mode='down';p.dn=Math.max(0,p.dn-dt*60);
        const parts=Math.max(1,Math.ceil(Math.hypot(state.knockX||0,state.knockZ||0)*dt/.12));
        for(let i=0;i<parts;i++){const x=p.x+(state.knockX||0)*dt/parts,z=p.z+(state.knockZ||0)*dt/parts;if(!this.world.safe(p,x,z))break;p.x=x;p.z=z;}
        state.knockX=(state.knockX||0)*Math.pow(.9,dt*60);state.knockZ=(state.knockZ||0)*Math.pow(.9,dt*60);p.vx=p.vz=0;
        if(!p.dn){
          if(this.world.safe(p,p.x,p.z)&&cars.every(v=>pedestrianVehicleDistance(p,v)>Math.max(.3,p.radius||0))){state.mode='recover';state.until=this.time+.9;state.nextEvent=this.time+15;}
          else if(this.world.canRelocate?.(p)&&this.world.relocate(p)!==false){state=this.reset(p);}
          else p.dn=30;
        }
        if(p.dn){this.stats.down++;this.world.pose(p,state,0,dt,this.time);continue;}
      }
      let threat=null,threatCar=null;
      for(const v of cars){
        const speed=Math.hypot(v.vx,v.vz);if(speed<2.5||Math.hypot(p.x-v.x,p.z-v.z)>v.t.L+speed*1.2+2)continue;
        if(speed>4&&pedestrianVehicleDistance(p,v)<(p.radius||.24)){this.release(p);state.mode='down';p.fl=0;p.dn=400;state.knockX=v.vx*1.4;state.knockZ=v.vz*1.4;p.vx=p.vz=0;this.world.collision(v,p);break;}
        const risk=pedestrianVehicleThreat(p,v);if(risk&&(!threat||risk.time<threat.time)){threat=risk;threatCar=v;}
      }
      if(p.dn){this.stats.down++;this.world.pose(p,state,0,dt,this.time);continue;}
      if(threat){this.release(p);state.mode='flee';state.until=this.time+1.8;state.escape=threatCar.a+threat.side*Math.PI/2;state.look={x:threatCar.x,z:threatCar.z};state.lookUntil=this.time+1.2;}
      else if(p.fl>0&&state.mode!=='flee'){this.release(p);state.mode='flee';state.until=this.time+p.fl/60;state.escape=p.a;}
      if(state.mode==='flee'&&this.time>=state.until){p.fl=0;this.resume(p);}
      if(state.partner&&(!this.active.has(state.partner)||state.partner.dn||state.partner.ambient?.partner!==p))this.resume(p);
      if(['talk','look','stretch','greet','recover'].includes(state.mode)&&this.time>=state.until)this.resume(p);
      const neighbors=this.nearby(p);for(const extra of extras)if(Math.hypot(extra.x-p.x,extra.z-p.z)<3.5)neighbors.push(extra);if(player&&Math.hypot(player.x-p.x,player.z-p.z)<3.5)neighbors.push(player);
      if(state.mode==='walk'){
        if(player&&this.time>=state.nextGreeting&&Math.hypot(player.x-p.x,player.z-p.z)>1.1&&Math.hypot(player.x-p.x,player.z-p.z)<3.3&&Math.hypot(player.vx||0,player.vz||0)<.035&&Math.cos(Math.atan2(player.z-p.z,player.x-p.x)-p.a)>.1){
          state.mode='greet';state.until=this.time+.85;state.nextGreeting=this.time+18;state.look={x:player.x,z:player.z};state.lookUntil=this.time+1.3;
        }else this.event(p,neighbors);
      }
      let heading=state.mode==='flee'?state.escape:this.routeHeading(p),speed=0;
      if(state.mode==='walk'||state.mode==='flee'){
        if(!p.walk&&state.mode==='walk'&&this.world.random()<dt*.6)heading=p.a+(this.world.random()-.5)*1.4;
        const wanted=state.mode==='flee'?3.8:p.pace*60,step=this.chooseStep(p,heading,wanted,neighbors,cars,dt),oldX=p.x,oldZ=p.z;
        if(step){p.x=step.x;p.z=step.z;heading=step.a;state.blocked=0;}else state.blocked+=dt;
        if(state.blocked>2&&state.mode==='walk'&&p.walk){p.walk.dir*=-1;state.blocked=0;}
        p.vx=(p.x-oldX)/dt;p.vz=(p.z-oldZ)/dt;speed=Math.hypot(p.vx,p.vz);
      }else{p.vx=p.vz=0;if(state.partner)heading=Math.atan2(state.partner.z-p.z,state.partner.x-p.x);}
      p.a+=Math.max(-dt*6,Math.min(dt*6,pedestrianAngle(heading-p.a)));p.ph+=speed*dt*2.6;p.fl=state.mode==='flee'?Math.max(1,(state.until-this.time)*60):0;
      if(state.mode==='flee')this.stats.fleeing++;else if(state.mode==='talk')this.stats.talking++;else if(state.mode==='walk')this.stats.walking++;else this.stats.idle++;
      this.world.pose(p,state,speed,dt,this.time);
    }
  }
}

/* Keep a bounded pool near the active neighborhood. Sites are sampled once;
   actors move only between clear sites outside the rendered view. */
class PedestrianPopulation{
  constructor(world){
    this.world=world;this.sites=[];this.cells=new Map();this.elapsed=0;this.cursor=0;
    this.stats={sites:0,placements:0,recycled:0,rejected:0,lastMoved:[],milliseconds:0};
    for(const path of world.routes)for(let i=2;i<path.length-2;i+=3)this.add({...path[i],path,i});
    for(const site of world.freeSites)this.add({...site,path:null});this.stats.sites=this.sites.length;
  }
  add(site){const key=Math.floor(site.x/32)+','+Math.floor(site.z/32);if(!this.cells.has(key))this.cells.set(key,[]);this.cells.get(key).push(site);this.sites.push(site);}
  nearby(focus,min,max){
    const result=[];for(let x=Math.floor((focus.x-max)/32);x<=Math.floor((focus.x+max)/32);x++)for(let z=Math.floor((focus.z-max)/32);z<=Math.floor((focus.z+max)/32);z++){
      const sites=this.cells.get(x+','+z);if(!sites)continue;for(const site of sites){const distance=Math.hypot(site.x-focus.x,site.z-focus.z);if(distance>=min&&distance<=max)result.push(site);}
    }return result;
  }
  hidden(site,focus){return Math.hypot(site.x-focus.x,site.z-focus.z)>this.world.drawRange()+7||!this.world.visible(site);}
  place(p,peds,cars,focus,{initial=false}={}){
    const start=performance.now(),min=initial?8:Math.min(55,this.world.drawRange()-20),max=initial?(this.world.drawRange()<80?80:95):125;
    if(!initial)this.world.prepareView();
    const limits=initial?[max,160,700]:[this.world.drawRange()-3,max,180];
    for(const radius of limits){
      const sites=this.nearby(focus,min,radius),sidewalk=sites.filter(s=>s.path),green=sites.filter(s=>!s.path);
      for(let attempt=0;attempt<128&&sites.length;attempt++){
        const preferred=this.world.random()<.85?sidewalk:green,pool=preferred.length?preferred:sites,site=pool[Math.floor(this.world.random()*pool.length)];
        if(!initial&&!this.hidden(site,focus)||!this.world.safe(site,p))continue;
        if(peds.some(other=>other!==p&&Math.hypot(other.x-site.x,other.z-site.z)<1.15))continue;
        if(cars.some(v=>pedestrianVehicleDistance(site,v)<.5))continue;
        if(peds.filter(other=>other!==p&&Math.hypot(other.x-site.x,other.z-site.z)<8).length>=5)continue;
        const facing=this.world.random(),dir=facing<.5?-1:1;p.x=site.x;p.z=site.z;p.a=site.path?(site.a||0)+(dir<0?Math.PI:0):facing*Math.PI*2;p.walk=site.path?{path:site.path,i:site.i,dir}:null;
        p.dn=p.fl=p.vx=p.vz=0;this.world.reset(p);this.stats.placements++;this.stats.milliseconds+=performance.now()-start;return true;
      }
    }
    this.stats.rejected++;this.stats.milliseconds+=performance.now()-start;return false;
  }
  tick(peds,cars,focus,dt){
    this.elapsed+=dt;this.stats.lastMoved=[];if(this.elapsed<.25)return;this.elapsed%=.25;
    let attempted=0;this.world.prepareView();
    for(let checked=0;checked<peds.length&&attempted<3;checked++){
      const p=peds[this.cursor++%peds.length],distance=Math.hypot(p.x-focus.x,p.z-focus.z);
      if(distance<145||p.dn||p.fl||p.ambient?.partner||['greet','recover','flee'].includes(p.ambient?.mode))continue;
      if(p.o.visible&&distance<this.world.drawRange()+2&&this.world.visible(p))continue;
      const from={x:p.x,z:p.z};attempted++;if(this.place(p,peds,cars,focus)){this.stats.lastMoved.push({index:peds.indexOf(p),from,to:{x:p.x,z:p.z}});this.stats.recycled++;}
    }
  }
}
