/* Shared-city free roam. Network actors never enter local AI/physics arrays. */
class CityMultiplayer {
  constructor(game) {
    this.game=game;this.session=null;this.peers=new Map();this.carPool=[];this.seen=new Set();this.generation=0;this.online=false;this.lastFrame=performance.now();this.pendingState=false;
    this.buildUI();this.timer=setInterval(()=>this.sendState(),120);
    addEventListener('pagehide',()=>this.leave(false));
    addEventListener('offline',()=>{if(this.session&&this.online)this.reconnect(this.generation,0);});
    addEventListener('online',()=>{if(this.session&&!this.online){clearTimeout(this.retry);this.stream(this.generation);}});
  }
  buildUI() {
    const $=id=>document.getElementById(id),pane=document.createElement('section');pane.id='gp-online';pane.className='gp-pane';pane.hidden=true;
    pane.innerHTML=`<h2>Play together</h2><p>Join the same room to explore the coast with friends. Everyone in your room can read global chat.</p><form id="online-join" novalidate><label for="online-name">Your name</label><input id="online-name" aria-describedby="online-status" autocomplete="nickname" maxlength="20" required placeholder="Driver"><label for="online-room">Room code</label><input id="online-room" autocomplete="off" maxlength="20" required pattern="[-A-Za-z0-9_]{3,20}" aria-describedby="online-room-help online-status"><p id="online-room-help">Use the same 3–20 character code as your friends.</p><button id="online-connect" type="submit" class="gp-button gp-primary">Join room</button></form><p id="online-status" role="status" aria-live="polite">Single-player · not connected.</p><div id="online-session" hidden><p id="online-room-title"></p><label for="online-invite">Invite link</label><input id="online-invite" readonly><div class="gp-actions"><button id="online-copy" class="gp-button" type="button">Copy invite</button><button id="online-leave" class="gp-button" type="button">Leave room</button></div><h3>Players <span id="online-count"></span></h3><ul id="online-roster"></ul><p>Free roam and chat are shared. NPC traffic, parked-car ownership, jobs and police stay local. Other players’ vehicles pass through yours.</p></div>`;
    help.append(pane);const tab=document.createElement('button');tab.type='button';tab.dataset.pane='online';tab.textContent='Online';tab.setAttribute('aria-pressed','false');help.querySelector('.gp-tabs').append(tab);
    document.body.insertAdjacentHTML('beforeend',`<button id="online-open" type="button" class="help-button" aria-controls="gp-online">Online</button><button id="chat-toggle" type="button" class="help-button" aria-controls="world-chat" aria-expanded="false" hidden>Chat · T</button><section id="world-chat" aria-label="Room global chat" hidden><div class="chat-header"><strong>Everyone in room</strong><button id="chat-close" type="button" aria-label="Close chat">×</button></div><ol id="chat-messages" role="log" aria-label="Room messages" aria-live="polite" aria-relevant="additions"></ol><form id="chat-form" novalidate><label class="chat-label" for="chat-input">Message everyone</label><input id="chat-input" maxlength="240" autocomplete="off" placeholder="Message everyone…"><button id="chat-send" type="submit">Send</button></form><p id="chat-status" role="status"></p></section><div id="online-labels" aria-hidden="true"></div>`);
    const params=new URL(location.href).searchParams;$('online-room').value=(params.get('room')||'COAST').slice(0,20);
    try{$('online-name').value=localStorage.getItem('bvc-online-name')||'';}catch{}
    $('online-open').onclick=()=>{this.game.showPane('online');openHelp();};
    $('online-join').onsubmit=e=>{e.preventDefault();this.join();};$('online-leave').onclick=()=>this.leave();
    $('online-copy').onclick=async()=>{try{await navigator.clipboard.writeText($('online-invite').value);this.status('Invite copied. Send it to your friends.');}catch{$('online-invite').focus();$('online-invite').select();this.status('Select and copy the invite link above.');}};
    $('chat-toggle').onclick=()=>this.toggleChat();$('chat-close').onclick=()=>this.toggleChat(false);$('chat-form').onsubmit=e=>{e.preventDefault();this.chat();};
    $('chat-input').onkeydown=e=>{e.stopPropagation();if(e.key==='Escape'){e.preventDefault();this.toggleChat(false);}};
    document.addEventListener('keydown',e=>{if(e.defaultPrevented||e.isComposing||e.ctrlKey||e.altKey||e.metaKey||help.open||e.target.closest('input,textarea,[contenteditable=true]'))return;if(e.key.toLowerCase()==='t'&&this.session){e.preventDefault();this.toggleChat(true);}});
    help.addEventListener('close',()=>{$('online-open').textContent=this.online?`Online · ${this.peers.size+1}`:'Online';});
  }
  status(text) {document.getElementById('online-status').textContent=text;}
  async request(path,data,session=this.session) {
    const response=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json',...(session?{Authorization:'Bearer '+session.token}:{})},body:JSON.stringify(data),signal:AbortSignal.timeout(8000)});
    const result=await response.json().catch(()=>({error:'Multiplayer needs the game server. Start it with npm start, or open the hosted game address.'}));
    if(!response.ok)throw Object.assign(new Error(result.error||'The server could not complete this request.'),{status:response.status});return result;
  }
  async join() {
    const $=id=>document.getElementById(id),name=$('online-name').value.trim(),room=$('online-room').value.trim().toUpperCase();
    $('online-name').setAttribute('aria-invalid',String(!name));$('online-room').setAttribute('aria-invalid',String(!/^[-A-Z0-9_]{3,20}$/.test(room)));
    if(!name||!/^[-A-Z0-9_]{3,20}$/.test(room)){this.status('Enter your name and a room code of 3–20 letters, numbers, underscores or hyphens.');(!name?$('online-name'):$('online-room')).focus();return;}
    if(this.joining||this.session)return;this.joining=true;const generation=++this.generation;$('online-connect').disabled=true;this.status('Joining room…');
    try {
      const session=await this.request('/api/join',{name,room,world:'coast-2026-v1'},null);
      if(generation!==this.generation){this.request('/api/leave',{},session).catch(()=>{});return;}
      this.session=session;this.seen.clear();$('chat-messages').replaceChildren();this.online=false;
      try{localStorage.setItem('bvc-online-name',name);}catch{}
      $('online-session').hidden=false;$('online-join').hidden=true;$('online-room-title').textContent=`Room ${session.room} · up to ${session.limit} players`;
      const invite=new URL(location.href);invite.search='';invite.hash='';invite.searchParams.set('room',session.room);$('online-invite').value=invite.href;
      $('chat-toggle').hidden=false;this.chatEnabled(false);this.stream(generation);this.sendState();
    }catch(error){if(generation===this.generation)this.status(error.name==='TimeoutError'?'The server did not respond. Try joining again.':error.message||'Could not reach the game server. Try again.');}
    finally{if(generation===this.generation){this.joining=false;$('online-connect').disabled=false;}}
  }
  async stream(generation,attempt=0) {
    if(!this.session||generation!==this.generation)return;
    this.streamAbort?.abort();const controller=new AbortController();this.streamAbort=controller;
    try {
      const response=await fetch('/api/events',{headers:{Authorization:'Bearer '+this.session.token},signal:controller.signal});
      if(!response.ok)throw Object.assign(new Error('Session ended.'),{status:response.status});
      const opened=performance.now();this.streamOpened=opened;this.online=true;this.status(`Connected to ${this.session.room}. Share the invite link to bring friends.`);this.chatEnabled(true);document.getElementById('chat-status').textContent='';
      const reader=response.body.getReader(),decoder=new TextDecoder();let buffer='';
      while(generation===this.generation){const {value,done}=await reader.read();if(done)throw new Error('Connection closed.');buffer+=decoder.decode(value,{stream:true});if(buffer.length>262144)throw new Error('Invalid server stream.');let end;
        while((end=buffer.indexOf('\n\n'))!==-1){const block=buffer.slice(0,end);buffer=buffer.slice(end+2);const event=block.split('\n').find(l=>l.startsWith('event: '))?.slice(7),data=block.split('\n').find(l=>l.startsWith('data: '))?.slice(6);if(data)this.receive(event,JSON.parse(data));}
      }
    }catch(error){
      if(generation!==this.generation||controller.signal.aborted)return;
      if(performance.now()-(this.streamOpened||performance.now())>5000)attempt=0;
      this.reconnect(generation,attempt,error);
    }
  }
  reconnect(generation,attempt,error={}) {
    if(generation!==this.generation||!this.session)return;this.streamAbort?.abort();clearTimeout(this.retry);this.online=false;this.chatEnabled(false);
    for(const p of this.peers.values()){p.H.g.visible=false;if(p.vehicle)p.vehicle.o.visible=false;p.label.hidden=true;}
    if(error.status===401||attempt>=3){this.leave(false);this.status('Connection lost. Your single-player game is still available. Join the room again to reconnect.');return;}
    document.getElementById('online-open').textContent='Reconnecting…';document.getElementById('chat-status').textContent='Connection interrupted. Your draft is kept.';
    this.status(`Connection interrupted. Reconnecting (${attempt+1}/3)…`);this.retry=setTimeout(()=>this.stream(generation,attempt+1),1000*2**attempt);
  }

  receive(event,data) {
    if(event==='history'){for(const m of data)this.addMessage(m);return;}
    if(event==='chat'){this.addMessage(data);return;}
    if(event!=='players'||!this.session)return;
    this.serverTod=data.tod;this.serverTime=performance.now();const ids=new Set();
    for(const player of data.players){if(player.id===this.session.id)continue;ids.add(player.id);let peer=this.peers.get(player.id);
      if(!peer){const H=mkHuman({skin:'#c68a62',hair:'#241c17',shirt:'#f2c14e',pants:'#2b3a55',shoe:'#eee',height:HUMAN.playerHeight}),label=document.createElement('span');label.className='online-nameplate';label.hidden=true;H.g.visible=false;label.textContent=player.name;document.getElementById('online-labels').append(label);peer={H,label,state:null,vehicle:null,phase:0,position:new THREE.Vector3(),angle:0};this.peers.set(player.id,peer);}
      if(player.state){if(!peer.state){peer.position.set(player.state.x,player.state.y,player.state.z);peer.angle=player.state.a;}peer.state=player.state;peer.received=performance.now();}
      peer.name=player.name;
    }
    for(const [id,peer]of this.peers)if(!ids.has(id)){this.removePeer(peer);this.peers.delete(id);}
    const roster=document.getElementById('online-roster');roster.replaceChildren();for(const p of data.players){const li=document.createElement('li');li.textContent=p.name+(p.id===this.session.id?' (you)':'')+(p.state?.paused?' · menu open':'');roster.append(li);}
    document.getElementById('online-count').textContent=`(${data.players.length}/${this.session.limit})`;document.getElementById('online-open').textContent=`Online · ${data.players.length}`;
  }
  chatEnabled(enabled) {for(const id of ['chat-input','chat-send'])document.getElementById(id).disabled=!enabled;}
  addMessage(message) {
    if(this.seen.has(message.id))return;this.seen.add(message.id);if(this.seen.size>200)this.seen.delete(this.seen.values().next().value);
    const list=document.getElementById('chat-messages'),nearBottom=list.scrollHeight-list.scrollTop-list.clientHeight<45,li=document.createElement('li'),name=document.createElement('strong');name.textContent=message.system?'':message.name+': ';li.append(name,document.createTextNode(message.text));if(message.system)li.className='chat-system';list.append(li);while(list.children.length>60)list.firstChild.remove();if(nearBottom)list.scrollTop=list.scrollHeight;
    if(document.getElementById('world-chat').hidden&&!message.system)document.getElementById('chat-toggle').textContent='Chat · new message';
  }
  toggleChat(show=document.getElementById('world-chat').hidden) {
    if(!this.session)return;const panel=document.getElementById('world-chat');panel.hidden=!show;document.getElementById('chat-toggle').setAttribute('aria-expanded',String(show));document.getElementById('chat-toggle').textContent='Chat · T';resetInput();
    if(show){const list=document.getElementById('chat-messages');list.scrollTop=list.scrollHeight;document.getElementById('chat-input').focus();}else document.getElementById('chat-toggle').focus();
  }
  async chat() {
    const input=document.getElementById('chat-input'),button=document.getElementById('chat-send'),status=document.getElementById('chat-status'),text=input.value.trim();if(!this.online||this.sending||!text)return;
    this.sending=true;button.disabled=true;status.textContent='Sending…';const generation=this.generation;
    try{const result=await this.request('/api/chat',{text});if(generation!==this.generation)return;this.addMessage(result.message);if(input.value.trim()===text)input.value='';status.textContent='';}
    catch(error){if(generation===this.generation)status.textContent=error.message||'Message was not sent. Try again.';}
    finally{this.sending=false;button.disabled=!this.online;}
  }
  async sendState() {
    if(!this.session||this.pendingState)return;const session=this.session;this.pendingState=true;
    const paint=car?.o.children.find(o=>o.isMesh&&o.material.isMeshPhysicalMaterial&&![GLASS,civicGlass,fdGlass,lampCoverMaterial].includes(o.material))?.material;
    const data={x:car?car.x:P.x,z:car?car.z:P.z,y:car?car.o.position.y:P.o.position.y,a:car?car.a:P.a,vx:car?car.vx:P.vx*60,vz:car?car.vz:P.vz*60,vehicle:car?.n||null,steer:car?.st||0,roll:car?.o.rotation.x||0,pitch:car?.o.rotation.z||0,paint:paint?'#'+paint.color.clone().convertLinearToSRGB().getHexString():'#a3a7aa',signal:car?.ind||0,paused:help.open||document.hidden};
    try{await this.request('/api/state',data,session);}catch(error){if(error.status===401&&this.session===session){this.leave(false);this.status('Session expired. Join the room again.');}else if(this.session===session&&this.online&&(!error.status||error.status>=500))this.reconnect(this.generation,0,error);}finally{this.pendingState=false;}
  }
  remoteCar(model) {
    const index=this.carPool.findIndex(v=>v.n===model);if(index>=0)return this.carPool.splice(index,1)[0];
    const v=mkCar(model);cars.splice(cars.indexOf(v),1);this.game.poseBuffer=null;
    const source=v.o.children.find(o=>o.isMesh&&o.material.isMeshPhysicalMaterial&&![GLASS,civicGlass,fdGlass,lampCoverMaterial].includes(o.material))?.material;
    if(source){v.remotePaint=source.clone();v.o.traverse(o=>{if(o.material===source)o.material=v.remotePaint;});}return v;
  }
  retireCar(v) {S.remove(v.o);v.o.visible=false;this.carPool.push(v);if(this.carPool.length>16){const old=this.carPool.shift();old.remotePaint?.dispose();old.tm.dispose();old.rm.dispose();old.o.traverse(o=>{if(o.isInstancedMesh){if(o.dispose)o.dispose();else o.dispatchEvent({type:'dispose'});}});}}
  removePeer(p) {S.remove(p.H.g);p.label.remove();if(p.vehicle)this.retireCar(p.vehicle);}
  frame(now) {
    const dt=Math.min(.1,Math.max(0,(now-this.lastFrame)/1000));this.lastFrame=now;if(!this.online)return;
    if(Number.isFinite(this.serverTod))tod=(this.serverTod+(now-this.serverTime)/360000)%1;
    for(const p of this.peers.values()){const state=p.state;if(!state)continue;const lead=state.paused?0:Math.min(.18,(now-p.received)/1000),target=new THREE.Vector3(state.x+state.vx*lead,state.y,state.z+state.vz*lead);
      if(p.position.distanceToSquared(target)>225)p.position.copy(target);else p.position.lerp(target,1-Math.exp(-dt*12));p.angle+=Math.atan2(Math.sin(state.a-p.angle),Math.cos(state.a-p.angle))*(1-Math.exp(-dt*12));
      const visible=Math.hypot(p.position.x-P.x,p.position.z-P.z)<130;p.H.g.visible=visible&&!state.vehicle;
      if(state.vehicle&&p.vehicle?.n!==state.vehicle){if(p.vehicle)this.retireCar(p.vehicle);p.vehicle=this.remoteCar(state.vehicle);S.add(p.vehicle.o);}
      if(p.vehicle){const v=p.vehicle;v.o.visible=visible&&!!state.vehicle;if(state.vehicle){v.o.position.copy(p.position);v.o.rotation.set(state.roll,-p.angle,state.pitch);v.remotePaint?.color.copy(lin(state.paint));for(const w of v.wheels){w.steer.rotation.y=w.front?-state.steer:0;w.spin.rotation.z-=Math.hypot(state.vx,state.vz)*dt/(v.t.r||.32);}for(const light of v.il)light.visible=state.signal!==0&&(state.signal===2||light.side_===state.signal)&&Math.floor(now/450)%2===0;}}
      p.H.g.position.copy(p.position);p.H.g.rotation.set(0,-p.angle,0);p.phase+=Math.hypot(state.vx,state.vz)*dt*2.6;if(p.H.g.visible)anim(p.H,p.phase,state.paused?0:.5,Math.hypot(state.vx,state.vz)>4,0);
    }
  }
  render() {for(const p of this.peers.values()){const s=p.state;if(!s||!this.online){p.label.hidden=true;continue;}const point=p.position.clone();point.y+=s.vehicle?2.15:2.05;point.project(cam);p.label.hidden=point.z<-1||point.z>1||Math.abs(point.x)>1||Math.abs(point.y)>1||Math.hypot(p.position.x-P.x,p.position.z-P.z)>100;if(!p.label.hidden)p.label.style.transform=`translate(${(point.x*.5+.5)*innerWidth}px,${(-point.y*.5+.5)*innerHeight}px) translate(-50%,-100%)`;}}
  drawMini(ctx,scale) {if(!this.online)return;ctx.fillStyle='#76e4e1';for(const p of this.peers.values())if(p.state){ctx.beginPath();ctx.arc(p.position.x*scale,p.position.z*scale,2.2,0,Math.PI*2);ctx.fill();}}
  leave(announce=true) {
    const session=this.session;this.session=null;this.online=false;this.joining=false;this.generation++;clearTimeout(this.retry);this.streamAbort?.abort();
    for(const p of this.peers.values())this.removePeer(p);this.peers.clear();for(const v of this.carPool){v.remotePaint?.dispose();v.tm.dispose();v.rm.dispose();v.o.traverse(o=>{if(o.isInstancedMesh){if(o.dispose)o.dispose();else o.dispatchEvent({type:'dispose'});}});}this.carPool=[];
    for(const id of ['online-session','chat-toggle','world-chat'])document.getElementById(id).hidden=true;document.getElementById('online-join').hidden=false;document.getElementById('online-connect').disabled=false;document.getElementById('online-open').textContent='Online';document.getElementById('chat-toggle').setAttribute('aria-expanded','false');this.chatEnabled(false);
    if(session)fetch('/api/leave',{method:'POST',headers:{Authorization:'Bearer '+session.token},keepalive:true}).catch(()=>{});if(announce)this.status('You left the room. Single-player continues.');resetInput();
  }
}
