import fs from 'node:fs';
import assert from 'node:assert/strict';
const filename=process.argv[2]??'atlas.json';
const base=new URL('../public/models/',import.meta.url),atlas=JSON.parse(fs.readFileSync(new URL(filename,base)));
assert.equal(atlas.parts.filter(p=>!p.id.startsWith('ZA_')).length,2234,'Original mesh identities retained');
assert.equal(atlas.concepts.filter(c=>!c.id.startsWith('ZA')).length,3432,'Original ontology retained');
const ids=new Set(atlas.parts.map(p=>p.id));assert.equal(ids.size,atlas.parts.length);
assert.equal(new Set(atlas.concepts.map(c=>c.id)).size,atlas.concepts.length);
if(atlas.supplement){
 assert.equal(atlas.parts.filter(p=>p.id.startsWith('ZA_')).length,atlas.supplement.addedMeshes);
 assert.equal(atlas.parts.filter(p=>p.originalPart).length,atlas.supplement.replacedMeshes);
 for(const p of atlas.parts.filter(p=>p.source?.dataset==='Z-Anatomy')){
  assert.equal(p.source.license,'CC-BY-SA-4.0');assert.match(p.source.sha256,/^[a-f0-9]{64}$/);
  assert.ok(p.source.mesh&&p.source.file&&p.source.id);
 }
}
const files=atlas.chunks.map(c=>{const b=fs.readFileSync(new URL(c.url.split('/').pop(),base));assert.equal(b.length,c.bytes);return b;});
let tris=0;
for(const p of atlas.parts){assert.ok(p.name.trim()&&p.name!=='-'&&!p.name.includes('Bounds('));assert.ok(p.conceptId!=='-');assert.ok(p.system);const b=files[p.chunk];assert.ok(p.indices+p.indexCount*4<=b.length);const pos=new Float32Array(b.buffer,b.byteOffset+p.positions,p.vertexCount*3),indices=new Uint32Array(b.buffer,b.byteOffset+p.indices,p.indexCount);assert.ok(indices.length>=3);for(const i of indices)assert.ok(i<p.vertexCount,`${p.id}: invalid vertex`);for(const value of pos)assert.ok(Number.isFinite(value));tris+=p.indexCount/3;}
for(const c of atlas.concepts){assert.ok(c.elements.length);for(const id of c.elements)assert.ok(ids.has(id),`${c.id}: missing ${id}`);}
assert.equal(tris,atlas.triangles);
console.log(`Verified ${ids.size} individually indexed meshes, ${atlas.concepts.length} complete concept mappings, ${tris.toLocaleString()} triangles, and every binary buffer.`);
