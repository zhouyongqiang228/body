import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
const root=new URL('../',import.meta.url), path=s=>new URL(s,root), read=s=>JSON.parse(fs.readFileSync(path(s)));
const atlas=read('public/models/atlas.json'), coverage=read('docs/completion-coverage.json');
const parts=new Map(atlas.parts.map(p=>[p.id,p])), concepts=new Map(atlas.concepts.map(c=>[c.id,c]));
assert.equal(atlas.parts.filter(p=>p.id.startsWith('ZA_C_')).length,coverage.added);
assert.equal(atlas.parts.length,2404+coverage.added,'Earlier patches retained');
for(const row of coverage.parts){
  const p=parts.get(row.id);assert.ok(p,row.name);
  assert.equal(p.name,row.name);assert.deepEqual(p.source,row.source);
  assert.ok(concepts.get(p.conceptId)?.elements.includes(p.id));
  const b=fs.readFileSync(path('public'+atlas.chunks[p.chunk].url));
  const positions=new Float32Array(b.buffer,b.byteOffset+p.positions,p.vertexCount*3);
  const bounds=[[Infinity,Infinity,Infinity],[-Infinity,-Infinity,-Infinity]];
  for(let i=0;i<positions.length;i++){
    const v=positions[i];assert.ok(Number.isFinite(v));
    bounds[0][i%3]=Math.min(bounds[0][i%3],v);bounds[1][i%3]=Math.max(bounds[1][i%3],v);
  }
  assert.deepEqual(bounds,p.bounds,`Exact bounds: ${p.name}`);
  assert.equal(p.registration.flippedTriangles,0);
  assert.ok(p.registration.maximumDisplacementMm<100);
  assert.ok(p.registration.minimumAreaRatio>=.2&&p.registration.maximumAreaRatio<=4);
  if(p.registration.region==='body')assert.ok(p.registration.minimumSampledJacobianDeterminant>.2);
  if(p.name.startsWith('左')&&!p.registration.sourceCrossesMidline)assert.ok((bounds[0][0]+bounds[1][0])/2>-.005,`Laterality: ${p.name}`);
  if(p.name.startsWith('右')&&!p.registration.sourceCrossesMidline)assert.ok((bounds[0][0]+bounds[1][0])/2<.005,`Laterality: ${p.name}`);
}
for(const [filename,hash] of Object.entries(coverage.geometrySha256)){
  const b=fs.readFileSync(path('public/models/'+filename));
  assert.equal(createHash('sha256').update(b).digest('hex'),hash);
  assert.deepEqual(gunzipSync(fs.readFileSync(path('public/models/'+filename+'.gz'))),b);
}
for(const name of ['腹直肌','背阔肌','腰方肌','皱眉肌','趾短伸肌','足底腱膜','胸腰筋膜前层','胸腰筋膜中层','胸腰筋膜后层','膝关节囊','肩关节囊'])
  for(const side of ['左','右'])assert.ok(atlas.parts.some(p=>p.name===side+name),side+name);
for(const name of ['坐骨神经','正中神经','桡神经','尺神经','股神经','胫神经','腓总神经','面神经','迷走神经','臂丛根','腋中央淋巴结群','上甲状旁腺','下甲状旁腺'])
  for(const side of ['左','右'])assert.ok(atlas.parts.some(p=>p.name===side+name),side+name);
for(const name of ['马尾','脊髓白质','脊髓前角','脊髓后角','甲状腺'])assert.ok(atlas.parts.some(p=>p.name===name),name);
assert.ok(atlas.parts.filter(p=>p.system==='nervous').every(p=>concepts.get('FMA7157').elements.includes(p.id)),'Whole nervous system search includes new meshes');
for(const stem of ['FJ1409','FJ1410','FJ1411','FJ1438','FJ1439','FJ1440','FJ1504','FJ1532'])
  for(const suffix of ['','M'])assert.equal(parts.get(stem+suffix).system,'muscular');
for(const pid of ['FJ1471','FJ1471M','FJ1423','FJ1423M'])assert.equal(parts.get(pid).system,'connective');
assert.equal(parts.get('FJ2561').name,'脾');
assert.equal(parts.get('FJ1795').name,'松果体');
assert.equal(parts.get('FJ1781').name,'左小脑半球');
assert.equal(parts.get('FJ1830').name,'右小脑半球');
console.log(`Verified ${coverage.added} completion meshes, source identities, laterality, geometry bounds, registration QA, gzip and catalogue corrections.`);
