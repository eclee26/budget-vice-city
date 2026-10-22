const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const c=vm.createContext({performance,console});
vm.runInContext(fs.readFileSync(path.join(__dirname,'../.test-tools/cdn-cache/three.min.js'),'utf8'),c);
vm.runInContext(fs.readFileSync(path.join(__dirname,'../world-streaming.js'),'utf8').split('/* Reserve small garden hills')[0]+';globalThis.boundsFor=worldInstanceBounds;',c);
const T=c.THREE;
function frustum(camera){camera.updateMatrixWorld(true);return new T.Frustum().setFromProjectionMatrix(new T.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));}
test('aggregate bounds contain every rotated, scaled and translated instance with wind padding',()=>{
 const geometry=new T.BoxGeometry(3,9,2),matrices=[];for(let i=0;i<30;i++)matrices.push(new T.Matrix4().compose(new T.Vector3(i*7-80,i%4,-i*3),new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),i*.31),new T.Vector3(1+i%3,.5+i%2,1.7)));
 const bounds=c.boundsFor(geometry,matrices),point=new T.Vector3(),position=geometry.attributes.position;
 for(const matrix of matrices)for(let i=0;i<position.count;i++){point.fromBufferAttribute(position,i).applyMatrix4(matrix);assert.ok(bounds.containsPoint(point));for(const x of[-1,1])assert.ok(bounds.containsPoint(point.clone().add(new T.Vector3(x*1.9,0,0))));}
});
test('instance bounds cull distant batches and follow the parent world transform',()=>{
 const geometry=new T.BoxGeometry(2,2,2),matrices=[new T.Matrix4().makeTranslation(-1000,0,-20)],mesh=new T.InstancedMesh(geometry,new T.MeshBasicMaterial(),1);mesh.userData.instanceBounds=c.boundsFor(geometry,matrices);mesh.setMatrixAt(0,matrices[0]);mesh.updateMatrixWorld(true);
 const camera=new T.PerspectiveCamera(60,1,.1,100),view=frustum(camera);assert.equal(view.intersectsObject(mesh),false);
 mesh.position.x=1000;mesh.updateMatrixWorld(true);assert.equal(view.intersectsObject(mesh),true);assert.equal(mesh.geometry,geometry);
});
test('an off-camera batch can independently remain inside the light shadow frustum',()=>{
 const geometry=new T.BoxGeometry(3,3,3),matrix=new T.Matrix4().makeTranslation(-80,0,0),mesh=new T.InstancedMesh(geometry,new T.MeshBasicMaterial(),1);mesh.userData.instanceBounds=c.boundsFor(geometry,[matrix]);mesh.updateMatrixWorld(true);
 const camera=new T.PerspectiveCamera(45,1,.1,120),light=new T.OrthographicCamera(-12,12,12,-12,.1,200);light.position.set(-80,30,0);light.lookAt(-80,0,0);
 assert.equal(frustum(camera).intersectsObject(mesh),false);assert.equal(frustum(light).intersectsObject(mesh),true);assert.equal(mesh.visible,true);
});
test('ordinary mesh culling keeps the original Three behavior',()=>{
 const camera=new T.PerspectiveCamera(60,1,.1,100),mesh=new T.Mesh(new T.BoxGeometry(),new T.MeshBasicMaterial());mesh.position.z=-10;mesh.updateMatrixWorld(true);assert.equal(frustum(camera).intersectsObject(mesh),true);mesh.position.z=10;mesh.updateMatrixWorld(true);assert.equal(frustum(camera).intersectsObject(mesh),false);
});
