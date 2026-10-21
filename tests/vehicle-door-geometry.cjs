const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const c=vm.createContext({Map,Math});vm.runInContext(fs.readFileSync(path.join(__dirname,'../vehicle-doors.js'),'utf8'),c);
const vertex=(x,y)=>[x,y,0,0,0,1,x/4,y/4];
const area=poly=>Math.abs(poly.reduce((a,v,i)=>{const b=poly[(i+1)%poly.length];return a+v[0]*b[1]-b[0]*v[1];},0))/2;
test('partition conserves triangle area and interpolates original UV coordinates',()=>{
 const triangle=[vertex(-2,-1),vertex(3,0),vertex(0,4)],box=[-.5,1.25,.2,2.1,-.1,.1];
 const split=c.doorPartitionPolygon(triangle,box),pieces=[split.inside,...split.outside];
 assert.ok(split.inside.length>=3);assert.ok(Math.abs(pieces.reduce((a,p)=>a+area(p),0)-area(triangle))<1e-10);
 for(const poly of pieces)for(const v of poly){assert.ok(Math.abs(v[6]-v[0]/4)<1e-10);assert.ok(Math.abs(v[7]-v[1]/4)<1e-10);}
 for(const v of split.inside)assert.ok(v[0]>=box[0]-1e-8&&v[0]<=box[1]+1e-8&&v[1]>=box[2]-1e-8&&v[1]<=box[3]+1e-8);
});
test('whole faces outside or inside a doorway retain their area',()=>{
 const triangle=[vertex(0,0),vertex(1,0),vertex(0,1)];
 for(const box of [[-1,2,-1,2,-1,1],[2,3,2,3,-1,1]]){
  const split=c.doorPartitionPolygon(triangle,box);assert.ok(Math.abs(area(split.inside)+split.outside.reduce((a,p)=>a+area(p),0)-.5)<1e-10);
 }
});
test('door liners reverse winding and face normals while preserving UVs',()=>{
 const triangle=[vertex(0,0),vertex(1,0),vertex(0,1)],front=[],back=[];
 c.doorWritePolygon(front,triangle);c.doorWritePolygon(back,triangle,true,1);
 assert.equal(front.length,24);assert.equal(back.length,24);assert.equal(front[5],1);assert.equal(back[5],-1);assert.equal(back[2],-.032);
 assert.equal(back[14],front[22]);assert.equal(back[15],front[23]);
});
test('only explicit skin, door glass and hardware roles move with doors',()=>{
 for(const key of ['fd:side:-1','sedanflank1','ek:shoulder-1'])assert.equal(c.doorSourceRole(key),1);
 for(const key of ['fd:curved-window:1:0','ek:door-glass:-1:0','sedansideglass11'])assert.equal(c.doorSourceRole(key),2);
 for(const key of ['fd:mirror1','sedanhandle','fd:window-seal:1'])assert.equal(c.doorSourceRole(key),3);
 for(const key of ['fd:roof','ek:windscreen','fd:pillar-a','fd:head-cover1'])assert.equal(c.doorSourceRole(key),0);
});
