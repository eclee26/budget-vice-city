import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';

export const WORLD_ID='coast-2026-v1';
const root=new URL('./',import.meta.url);
const files=new Set(['index.html','driving.css','multiplayer.css','multiplayer.js','gameplay.js','open-world.js','vehicle-dynamics.js','structures.js','traffic-signals.js','world-detail.js','world-streaming.js']);
const models=new Set(['Sports','Sedan','Van','Bike','Kaze R','Honda Civic FD 2009','Honda Civic FB 2013','Honda Civic SiR 1997']);
const clean=(value,max)=>typeof value==='string'?value.replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g,'').trim().slice(0,max):'';
const finite=(v,min,max)=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max;
const json=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));};

export function createGameServer({roomLimit=16,sessionLimit=128,sessionTTL=30000}={}) {
  const sessions=new Map(),rooms=new Map(),joins=new Map(),epoch=Date.now();
  const send=(stream,event,data)=>{if(stream.destroyed||stream.writableLength>262144){stream.destroy();return;}stream.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);};
  const publicPlayer=p=>({id:p.id,name:p.name,state:p.state});
  const broadcast=(room,event,data)=>{for(const p of room.players.values())if(p.stream)send(p.stream,event,data);};
  const message=(room,name,text,system=false)=>{const m={id:++room.seq,name,text,system,time:Date.now()};room.messages.push(m);if(room.messages.length>40)room.messages.shift();broadcast(room,'chat',m);return m;};
  const leave=p=>{if(!sessions.delete(p.token))return;p.room.players.delete(p.id);p.stream?.end();p.room.touched=Date.now();message(p.room,'City',`${p.name} left.`,true);};
  const body=async req=>{let text='';for await(const chunk of req){text+=chunk;if(Buffer.byteLength(text)>4096)throw Object.assign(new Error('Request is too large.'),{status:413});}try{return JSON.parse(text);}catch{throw Object.assign(new Error('Send a valid JSON request.'),{status:400});}};
  const server=http.createServer(async(req,res)=>{
    res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');
    try {
      const url=new URL(req.url,'http://localhost'),path=url.pathname;
      if(path==='/healthz'){json(res,200,{ok:true,world:WORLD_ID});return;}
      if(path.startsWith('/api/')) {
        if(req.headers.origin){let origin;try{origin=new URL(req.headers.origin).host;}catch{}if(origin!==req.headers.host){json(res,403,{error:'Join from this game’s own address.'});return;}}
        if(path==='/api/join'&&req.method==='POST') {
          const data=await body(req),name=clean(data.name,20),code=clean(data.room,20).toUpperCase();
          if(!name||!/^[-A-Z0-9_]{3,20}$/.test(code)||data.world!==WORLD_ID){json(res,400,{error:'Enter a name and a room code of 3–20 letters, numbers, underscores or hyphens. Reload if your game is outdated.'});return;}
          const ip=process.env.TRUST_PROXY==='1'?String(req.headers['x-forwarded-for']||req.socket.remoteAddress).split(',').at(-1).trim():req.socket.remoteAddress;
          const rate=joins.get(ip)||{time:Date.now(),count:0};if(Date.now()-rate.time>60000){rate.time=Date.now();rate.count=0;}joins.set(ip,rate);
          if(++rate.count>20){json(res,429,{error:'Too many joins. Wait a minute and try again.'});return;}
          if(sessions.size>=sessionLimit){json(res,503,{error:'The server is full. Try again later.'});return;}
          let room=rooms.get(code);if(!room){if(rooms.size>=64){json(res,503,{error:'No new rooms are available. Try again later.'});return;}room={code,players:new Map(),messages:[],seq:0,touched:Date.now()};rooms.set(code,room);}
          if(room.players.size>=roomLimit){json(res,409,{error:`This room is full (${roomLimit} players). Choose another room.`});return;}
          const token=randomBytes(32).toString('hex'),id=randomBytes(8).toString('hex');
          const display=[...room.players.values()].some(p=>p.name.toLowerCase()===name.toLowerCase())?name.slice(0,15)+'-'+id.slice(0,4):name;
          const p={id,token,name:display,room,seen:Date.now(),lastState:0,chatTokens:3,chatTime:Date.now(),state:null,stream:null};sessions.set(token,p);room.players.set(id,p);room.touched=Date.now();
          message(room,'City',`${display} joined.`,true);json(res,201,{id,token,name:display,room:code,limit:roomLimit,world:WORLD_ID});return;
        }
        const p=sessions.get(String(req.headers.authorization||'').replace(/^Bearer /,''));
        if(!p){json(res,401,{error:'Your multiplayer session ended. Join the room again.'});return;}
        p.seen=Date.now();
        if(path==='/api/events'&&req.method==='GET') {
          p.stream?.end();p.stream=res;res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache, no-transform','X-Accel-Buffering':'no','Connection':'keep-alive'});res.flushHeaders();
          send(res,'history',p.room.messages);send(res,'players',{players:[...p.room.players.values()].map(publicPlayer),tod:((Date.now()-epoch)/360000+.66)%1});
          res.on('close',()=>{if(p.stream===res)p.stream=null;});return;
        }
        if(req.method!=='POST'){json(res,405,{error:'Method not allowed.'});return;}
        if(path==='/api/leave'){leave(p);json(res,200,{ok:true});return;}
        const data=await body(req);
        if(path==='/api/state') {
          if(Date.now()-p.lastState<40){json(res,429,{error:'Updates are arriving too quickly.'});return;}
          if(!finite(data.x,0,480)||!finite(data.z,0,480)||!finite(data.y,-1,25)||!finite(data.a,-1e6,1e6)||!finite(data.vx,-100,100)||!finite(data.vz,-100,100)||!(data.vehicle===null||models.has(data.vehicle))){json(res,400,{error:'Invalid player position.'});return;}
          p.lastState=Date.now();p.state={x:data.x,z:data.z,y:data.y,a:Math.atan2(Math.sin(data.a),Math.cos(data.a)),vx:data.vx,vz:data.vz,vehicle:data.vehicle,steer:finite(data.steer,-1,1)?data.steer:0,roll:finite(data.roll,-.5,.5)?data.roll:0,pitch:finite(data.pitch,-.5,.5)?data.pitch:0,paint:/^#[a-f0-9]{6}$/i.test(data.paint)?data.paint:'#a3a7aa',signal:[-1,1,2].includes(data.signal)?data.signal:0,paused:data.paused===true};json(res,200,{ok:true});return;
        }
        if(path==='/api/chat') {
          const text=clean(data.text,240);if(!text){json(res,400,{error:'Write a message first.'});return;}
          const now=Date.now();p.chatTokens=Math.min(3,p.chatTokens+(now-p.chatTime)/1500);p.chatTime=now;
          if(p.chatTokens<1){json(res,429,{error:'Chat is moving too quickly. Wait a moment and send again.'});return;}
          p.chatTokens--;json(res,200,{message:message(p.room,p.name,text)});return;
        }
        json(res,404,{error:'Unknown game endpoint.'});return;
      }
      if(!['GET','HEAD'].includes(req.method)){json(res,405,{error:'Method not allowed.'});return;}
      const file=path==='/'?'index.html':path.slice(1);if(!files.has(file)){res.writeHead(404);res.end('Not found');return;}
      const content=await readFile(new URL(file,root)),type=file.endsWith('.html')?'text/html':file.endsWith('.css')?'text/css':'text/javascript';
      res.writeHead(200,{'Content-Type':type+'; charset=utf-8','Cache-Control':'no-cache'});res.end(req.method==='HEAD'?undefined:content);
    }catch(error){if(!res.headersSent)json(res,error.status||500,{error:error.status?error.message:'The server could not complete the request. Try again.'});else res.destroy();}
  });
  const timer=setInterval(()=>{
    const now=Date.now();for(const p of sessions.values())if(now-p.seen>sessionTTL)leave(p);
    for(const [code,room]of rooms){if(!room.players.size&&now-room.touched>600000){rooms.delete(code);continue;}if(room.players.size)broadcast(room,'players',{players:[...room.players.values()].map(publicPlayer),tod:((now-epoch)/360000+.66)%1});}
    for(const [ip,rate]of joins)if(now-rate.time>60000)joins.delete(ip);
  },100);timer.unref();
  server.on('close',()=>{clearInterval(timer);for(const p of sessions.values())p.stream?.end();});
  server.shutdown=()=>{for(const p of [...sessions.values()])leave(p);server.close();};
  return server;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const server=createGameServer();server.listen(Number(process.env.PORT)||8000,'0.0.0.0',()=>console.log(`Budget Vice City: http://localhost:${server.address().port}`));
  for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>{server.shutdown();setTimeout(()=>process.exit(0),2000).unref();});
}
