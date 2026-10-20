/* Shared planar contacts and four-wheel road support. No rendering dependencies. */
function vehicleCorners(v,x=v.x,z=v.z,a=v.a){
 const c=Math.cos(a),s=Math.sin(a),l=v.t.L/2,w=v.t.W/2;
 return [[l,w],[-l,w],[-l,-w],[l,-w]].map(([u,q])=>({x:x+c*u-s*q,z:z+s*u+c*q}));
}
function vehicleOverlap(A,B){
 const ca=Math.cos(A.a),sa=Math.sin(A.a),cb=Math.cos(B.a),sb=Math.sin(B.a),dx=B.x-A.x,dz=B.z-A.z;let depth=Infinity,normal;
 // Reject separated bodies using analytic projections, before allocating polygons.
 for(let axis=0;axis<4;axis++){
  const x=axis===0?ca:axis===1?-sa:axis===2?cb:-sb,z=axis===0?sa:axis===1?ca:axis===2?sb:cb;
  const ra=A.t.L/2*Math.abs(ca*x+sa*z)+A.t.W/2*Math.abs(-sa*x+ca*z),rb=B.t.L/2*Math.abs(cb*x+sb*z)+B.t.W/2*Math.abs(-sb*x+cb*z);
  const d=ra+rb-Math.abs(dx*x+dz*z);if(d<=0)return null;
  if(d<depth){depth=d;const sign=(B.x-A.x)*x+(B.z-A.z)*z<0?-1:1;normal={x:x*sign,z:z*sign};}
 }
 // Clip the intersection polygon; its centre gives a repeatable contact point.
 const pb=vehicleCorners(B);let polygon=vehicleCorners(A);
 for(let i=0;i<4&&polygon.length;i++){
  const p=pb[i],q=pb[(i+1)%4],side=r=>(q.x-p.x)*(r.z-p.z)-(q.z-p.z)*(r.x-p.x),out=[];
  for(let j=0;j<polygon.length;j++){const a=polygon[j],b=polygon[(j+1)%polygon.length],sa=side(a),sb=side(b);
   if(sa>=0)out.push(a);if((sa>=0)!==(sb>=0)){const t=sa/(sa-sb);out.push({x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t});}}
  polygon=out;
 }
 const point=polygon.length?{x:polygon.reduce((s,p)=>s+p.x,0)/polygon.length,z:polygon.reduce((s,p)=>s+p.z,0)/polygon.length}:{x:(A.x+B.x)/2,z:(A.z+B.z)/2};
 return {depth,normal,point};
}
function resolveVehicleContact(A,B){
 const hit=vehicleOverlap(A,B);if(!hit)return 0;
 const {normal:n,point:p}=hit,ma=1/A.t.m,mb=1/B.t.m,ia=1/(A.t.iz||A.t.m*(A.t.L**2+A.t.W**2)/12),ib=1/(B.t.iz||B.t.m*(B.t.L**2+B.t.W**2)/12);
 const ra={x:p.x-A.x,z:p.z-A.z},rb={x:p.x-B.x,z:p.z-B.z},cross=(r,n)=>r.x*n.z-r.z*n.x;
 const relative=()=>({x:B.vx-(B.yr||0)*rb.z-A.vx+(A.yr||0)*ra.z,z:B.vz+(B.yr||0)*rb.x-A.vz-(A.yr||0)*ra.x});
 const apply=(x,z)=>{A.vx-=x*ma;A.vz-=z*ma;B.vx+=x*mb;B.vz+=z*mb;A.yr=(A.yr||0)-(ra.x*z-ra.z*x)*ia;B.yr=(B.yr||0)+(rb.x*z-rb.z*x)*ib;};
 const rv=relative(),closing=rv.x*n.x+rv.z*n.z;let impact=0;
 if(closing<0){impact=-closing;const j=-(1.12)*closing/(ma+mb+cross(ra,n)**2*ia+cross(rb,n)**2*ib);apply(j*n.x,j*n.z);
  const tangent={x:-n.z,z:n.x},r=relative(),jt=-(r.x*tangent.x+r.z*tangent.z)/(ma+mb+cross(ra,tangent)**2*ia+cross(rb,tangent)**2*ib),friction=Math.max(-j*.5,Math.min(j*.5,jt));apply(friction*tangent.x,friction*tangent.z);}
 const correction=Math.max(0,hit.depth-.002)/(ma+mb)*.9;
 A.x-=n.x*correction*ma;A.z-=n.z*correction*ma;B.x+=n.x*correction*mb;B.z+=n.z*correction*mb;
 return impact;
}
function blockedVehicle(v,x,z,a=v.a){
 const c=Math.cos(a),s=Math.sin(a),nx=Math.ceil(v.t.L/.4),nz=Math.ceil(v.t.W/.4);
 for(let i=0;i<=nx;i++)for(let j=0;j<=nz;j++){
  const u=v.t.L*(i/nx-.5),q=v.t.W*(j/nz-.5);if(solid(x+c*u-s*q,z+s*u+c*q))return true;
 }return false;
}
function sweepVehicle(v,oldAngle,duration=DT){
 const distance=Math.hypot(v.vx,v.vz)*duration,turn=Math.atan2(Math.sin(v.a-oldAngle),Math.cos(v.a-oldAngle)),count=Math.max(1,Math.ceil((distance+Math.abs(turn)*v.t.L/2)/.16));
 if(distance<1e-12&&Math.abs(turn)<1e-12)return;
 const endAngle=v.a;v.a=oldAngle;let strongest=0,contact=null;
 for(let i=0;i<count;i++){
  const x=v.x+v.vx*duration/count,z=v.z+v.vz*duration/count,a=oldAngle+turn*(i+1)/count;
  if(!blockedVehicle(v,x,z,a)){v.x=x;v.z=z;v.a=a;continue;}
  // Binary search time of contact, including rotation, before applying a normal impulse.
  let lo=0,hi=1;const startA=v.a;
  for(let k=0;k<8;k++){const t=(lo+hi)/2;if(blockedVehicle(v,v.x+(x-v.x)*t,v.z+(z-v.z)*t,startA+(a-startA)*t))hi=t;else lo=t;}
  v.x+=(x-v.x)*lo;v.z+=(z-v.z)*lo;v.a=startA+(a-startA)*lo;
  const corners=vehicleCorners(v,v.x+(x-v.x)*.02,v.z+(z-v.z)*.02,v.a+(a-v.a)*.02),blocked=corners.filter(p=>solid(p.x,p.z));let p=blocked.length?{x:blocked.reduce((sum,p)=>sum+p.x,0)/blocked.length,z:blocked.reduce((sum,p)=>sum+p.z,0)/blocked.length}:null;
  if(!p){const c=Math.cos(a),s=Math.sin(a);outer:for(let u=-v.t.L/2;u<=v.t.L/2+.01;u+=.2)for(let q=-v.t.W/2;q<=v.t.W/2+.01;q+=.2){const test={x:x+c*u-s*q,z:z+s*u+c*q};if(solid(test.x,test.z)){p=test;break outer;}}}
  p=p||{x,z};const e=.04;let nx=Number(solid(p.x-e,p.z))-Number(solid(p.x+e,p.z)),nz=Number(solid(p.x,p.z-e))-Number(solid(p.x,p.z+e));
  if(!nx&&!nz){nx=v.x-x;nz=v.z-z;if(Math.hypot(nx,nz)<1e-6){nx=v.x-p.x;nz=v.z-p.z;}}
  const length=Math.hypot(nx,nz)||1;nx/=length;nz/=length;
  const rx=p.x-v.x,rz=p.z-v.z,inertia=v.t.iz||v.t.m*(v.t.L**2+v.t.W**2)/12,arm=rx*nz-rz*nx,velocity=(v.vx-(v.yr||0)*rz)*nx+(v.vz+(v.yr||0)*rx)*nz;
  if(velocity<0){const impulse=-1.08*velocity/(1/v.t.m+arm*arm/inertia);v.vx+=nx*impulse/v.t.m;v.vz+=nz*impulse/v.t.m;v.yr=(v.yr||0)+arm*impulse/inertia;
   if(-velocity>strongest){strongest=-velocity;contact=p;}}
  // Preserve travel tangent to the wall; never advance into occupied geometry.
  if(Math.abs(v.vx)+Math.abs(v.vz)<.02)break;
 }
 if(!blockedVehicle(v,v.x,v.z,endAngle))v.a=endAngle;
 if(strongest>3){hurt(v,strongest);sparks(contact.x,.6,contact.z,strongest);}if(v==car&&strongest>4)shake=Math.min(1.5,strongest/15);
}
function roadHeight(x,z){
 const surface=tile(x,z);if(surface===1)return .0015*Math.sin(x*1.8)*Math.sin(z*1.3);
 // The collision/road masks also identify the existing raised curb strip.
 if(typeof inMask!=='undefined'&&inMask(sidewalkMask,x,z)){
  const edge=[[-.25,0],[.25,0],[0,-.25],[0,.25]].some(([dx,dz])=>inMask(asphaltMask,x+dx,z+dz));return edge?.10:.004;
 }
 if(surface===5)return .12+.004*Math.sin(x*6);
 if(surface===0)return .025+.018*Math.sin(x*1.4)*Math.sin(z*1.1)+(typeof worldElevation==='function'?worldElevation(x,z):0);
 if(surface===3)return .012+.012*Math.sin(x*.8)*Math.sin(z*.7);return 0;
}
function supportWheels(v,h){
 const t=v.t,L=t.wb||t.L*.62,front=t.front||(t.dr==='F'?.58:.49),c=Math.cos(v.a),s=Math.sin(v.a),g=9.81;
 if(!v.contacts)v.contacts=[1,-1].flatMap(axle=>[-1,1].map(side=>({front:axle>0,u:axle>0?L*(1-front):-L*front,q:side*t.W*.43,omega:(v.vx*c+v.vz*s)/(t.r||.32),spin:0,height:null})));
 let total=0;
 for(const w of v.contacts){w.x=v.x+c*w.u-s*w.q;w.z=v.z+s*w.u+c*w.q;w.surface=tile(w.x,w.z);const height=roadHeight(w.x,w.z),staticLoad=t.m*g*(w.front?front:1-front)/2,rate=staticLoad/.10,body=(v.heave||0);
  const groundVelocity=w.height==null?0:Math.max(-1.5,Math.min(1.5,(height-w.height)/h));w.height=height;
  const damping=2*.72*Math.sqrt(rate*t.m/4),transfer=t.m*(t.cg||.5)*(v.ax||0)/L*(w.front?-.5:.5),lateral=-(v.ay||0)*t.m*(t.cg||.5)/t.W*Math.sign(w.q)*.5;
  w.load=Math.max(0,Math.min(staticLoad*3,staticLoad+rate*(height-body)+damping*(groundVelocity-(v.heaveVelocity||0))+transfer+lateral));
  w.compression=Math.max(-.1,Math.min(.15,height-body));total+=w.load;
 }
 v.heaveVelocity=(v.heaveVelocity||0)+(total/t.m-g)*h;v.heave=(v.heave||0)+v.heaveVelocity*h;
}
function wheelLongitudinal(w,u,requested,radius,cap,h,brake=0,lateral=0){
 // Implicit integration couples wheel inertia to tyre force without low-speed chatter.
 if(u===0&&w.omega===0&&requested===0){w.slip=0;w.gripScale=1;return 0;}
 const inertia=1.35,den=Math.max(Math.abs(u),2),old=w.omega,torque=requested*radius,force=omega=>{const raw=cap*Math.tanh((omega*radius-u)/den*9);return raw*Math.min(1,cap/Math.max(.01,Math.hypot(raw,lateral)));};
 const bound=(Math.abs(torque)+brake*radius+cap*radius)*h/inertia+1;let lo=Math.min(old,u/radius)-bound,hi=Math.max(old,u/radius)+bound;
 for(let i=0;i<22;i++){const mid=(lo+hi)/2,residual=mid-old-h*(torque-brake*radius*Math.sign(mid)-force(mid)*radius)/inertia;if(residual>0)hi=mid;else lo=mid;}
 w.omega=(lo+hi)/2;if(Math.abs(w.omega)<.0001)w.omega=0;w.slip=(w.omega*radius-u)/den;w.spin-=w.omega*h;
 const raw=cap*Math.tanh(w.slip*9);w.gripScale=Math.min(1,cap/Math.max(.01,Math.hypot(raw,lateral)));return raw*w.gripScale;
}
function sweepVehiclePair(A,B,previousA,previousB){
 if(vehicleOverlap(A,B))return resolveVehicleContact(A,B);
 if(!previousA||!previousB)return 0;
 const endA={x:A.x,z:A.z,a:A.a},endB={x:B.x,z:B.z,a:B.a},deltaA=Math.atan2(Math.sin(A.a-previousA.a),Math.cos(A.a-previousA.a)),deltaB=Math.atan2(Math.sin(B.a-previousB.a),Math.cos(B.a-previousB.a));
 const travel=Math.hypot(endA.x-previousA.x-endB.x+previousB.x,endA.z-previousA.z-endB.z+previousB.z)+Math.abs(deltaA)*A.t.L/2+Math.abs(deltaB)*B.t.L/2;
 if(travel<.2)return 0;
 const set=(v,p,e,da,t)=>{v.x=p.x+(e.x-p.x)*t;v.z=p.z+(e.z-p.z)*t;v.a=p.a+da*t;},count=Math.ceil(travel/.15);
 for(let i=1;i<=count;i++){
  const time=i/count;set(A,previousA,endA,deltaA,time);set(B,previousB,endB,deltaB,time);
  if(vehicleOverlap(A,B)){const impact=resolveVehicleContact(A,B);for(const v of [A,B]){const angle=v.a;v.a+=(v.yr||0)*DT*(1-time);sweepVehicle(v,angle,DT*(1-time));}return impact;}
 }
 Object.assign(A,endA);Object.assign(B,endB);return 0;
}
