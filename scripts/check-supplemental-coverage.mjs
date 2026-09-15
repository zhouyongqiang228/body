import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
const root=new URL('../',import.meta.url),read=s=>JSON.parse(fs.readFileSync(new URL(s,root)));
const atlas=read('public/models/atlas.json'), expected=read('docs/supplemental-coverage.json');
const parts=new Map(atlas.parts.map(p=>[p.id,p]));
assert.equal(atlas.supplement.addedMeshes,expected.added);
assert.equal(atlas.supplement.replacedMeshes,expected.replaced);
for(const row of expected.parts){
  const p=parts.get(row.id);assert.ok(p,`Missing mesh: ${row.name}`);
  assert.equal(p.name,row.name);assert.equal(p.source.mesh,row.sourceMesh);assert.equal(p.source.file,row.sourceFile);
  assert.ok(atlas.concepts.some(c=>c.id===p.conceptId&&c.elements.includes(p.id)),row.name);
  const b=fs.readFileSync(new URL('public/models/'+atlas.chunks[p.chunk].url.split('/').pop(),root));
  const pos=new Float32Array(b.buffer,b.byteOffset+p.positions,p.vertexCount*3),normal=new Int16Array(b.buffer,b.byteOffset+p.normals,p.vertexCount*3);
  for(let i=0;i<pos.length;i++){
    assert.ok(Number.isFinite(pos[i]));assert.ok(pos[i]>=p.bounds[0][i%3]-1e-6&&pos[i]<=p.bounds[1][i%3]+1e-6,`Bounds: ${row.name}`);
    assert.ok(normal[i]>=-32767&&normal[i]<=32767);
  }
  assert.ok(p.indexCount>=3&&p.vertexCount>=3);
}
for(const [filename,hash] of Object.entries(expected.geometrySha256)){
  const bytes=fs.readFileSync(new URL('public/models/'+filename,root));
  assert.equal(createHash('sha256').update(bytes).digest('hex'),hash);
  assert.deepEqual(gunzipSync(fs.readFileSync(new URL('public/models/'+filename+'.gz',root))),bytes);
}
for(const side of ['左','右'])for(const name of ['颞肌','腹外斜肌','腹内斜肌','腹横肌','内侧半月板','外侧半月板','前交叉韧带','后交叉韧带','髌韧带','三角纤维软骨盘','掌侧桡尺韧带','背侧桡尺韧带','尺月韧带','尺三角韧带'])
  assert.ok(atlas.parts.some(p=>p.name===side+name&&p.source?.dataset==='Z-Anatomy'),side+name);
for(const side of ['L','R'])assert.equal(atlas.concepts.find(c=>c.id==='ZAC_TFCC_'+side).elements.length,5);
console.log(`Verified ${expected.sourceMeshes} imported/replaced source meshes, laterality, concepts, bounds, checksums and gzip payloads.`);
console.log('Not independently modelled: '+expected.pending.join('；'));
if(process.argv.includes('--require-complete')&&expected.pending.length)process.exitCode=1;
