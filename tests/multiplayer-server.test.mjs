import test from 'node:test';
import assert from 'node:assert/strict';
import {createGameServer,WORLD_ID} from '../server.mjs';

test('room membership, authenticated state, global chat, isolation and bounded input',async()=>{
  const server=createGameServer({roomLimit:2});await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`;
  const controllers=[];
  const post=async(path,data,token,extra={})=>{const r=await fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{}),...extra},body:JSON.stringify(data)});return{status:r.status,data:await r.json()};};
  const join=(name,room='TEST')=>post('/api/join',{name,room,world:WORLD_ID});
  const stream=async token=>{const c=new AbortController();controllers.push(c);const r=await fetch(base+'/api/events',{headers:{Authorization:'Bearer '+token},signal:c.signal});assert.equal(r.status,200);const reader=r.body.getReader(),decoder=new TextDecoder();let buffer='';return async event=>{const deadline=Date.now()+3000;while(Date.now()<deadline){let end;while((end=buffer.indexOf('\n\n'))>=0){const block=buffer.slice(0,end);buffer=buffer.slice(end+2);if(block.startsWith('event: '+event+'\n'))return JSON.parse(block.split('\ndata: ')[1]);}const part=await reader.read();assert.equal(part.done,false);buffer+=decoder.decode(part.value);}throw Error('Stream event timed out');};};
  try {
    assert.equal((await fetch(base+'/healthz')).status,200);
    for(const path of ['/.git/config','/.env','/server.mjs','/tests/multiplayer-server.test.mjs'])assert.equal((await fetch(base+path)).status,404);
    assert.equal((await post('/api/join',{name:'x',room:'TEST',world:'old'})).status,400);
    assert.equal((await post('/api/join',{name:'x',room:'TEST',world:WORLD_ID},null,{Origin:'https://other.example'})).status,403);
    const alice=(await join('Alice')).data,bob=(await join('Bob')).data,outsider=(await join('Other','OTHER')).data;
    assert.equal((await join('Third')).status,409);
    const events=await stream(bob.token);await events('history');assert.equal((await events('players')).players.length,2);
    assert.equal((await post('/api/state',{},'invalid')).status,401);
    const state={x:140,z:120,y:0,a:0,vx:1,vz:0,vehicle:null};
    assert.equal((await post('/api/state',{...state,x:null},alice.token)).status,400);
    assert.equal((await post('/api/state',{...state,name:'Impersonated'},alice.token)).status,200);
    const players=await events('players');assert.equal(players.players.find(p=>p.id===alice.id).name,'Alice');
    const chat=await post('/api/chat',{text:'<img src=x onerror=alert(1)> Hello everyone!'},alice.token);assert.equal(chat.status,200);
    const received=await events('chat');assert.equal(received.name,'Alice');assert.equal(received.text,chat.data.message.text);
    const outsideEvents=await stream(outsider.token);assert.ok(!(await outsideEvents('history')).some(m=>m.text.includes('Hello everyone')));
    assert.equal((await post('/api/chat',{text:''},alice.token)).status,400);
    await post('/api/chat',{text:'2'},alice.token);await post('/api/chat',{text:'3'},alice.token);assert.equal((await post('/api/chat',{text:'4'},alice.token)).status,429);
    assert.equal((await post('/api/leave',{},alice.token)).status,200);assert.equal((await post('/api/state',state,alice.token)).status,401);
    const replacement=await join('Replacement');assert.equal(replacement.status,201);
  }finally{for(const c of controllers)c.abort();server.shutdown();server.closeAllConnections();}
});

test('abandoned sessions expire and free room capacity',async()=>{
  const server=createGameServer({roomLimit:1,sessionTTL:150});await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`;
  const join=()=>fetch(base+'/api/join',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'Driver',room:'TTL',world:WORLD_ID})});
  try{assert.equal((await join()).status,201);await new Promise(r=>setTimeout(r,350));assert.equal((await join()).status,201);}finally{server.shutdown();server.closeAllConnections();}
});
