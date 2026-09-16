// An additive overlay: never rebuild or remove the existing vascular/muscle patches.
import fs from 'node:fs';
import { gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { BufferGeometry, Float32BufferAttribute, Uint32BufferAttribute } from 'three';
const root = new URL('../', import.meta.url), path = s => new URL(s, root);
const atlas = JSON.parse(fs.readFileSync(path('public/models/atlas.json')));
const source = JSON.parse(fs.readFileSync(path('work/completion/registered.json')));
const blob = fs.readFileSync(path('work/completion/registered.bin'));
const first = atlas.chunks.findIndex(c => c.url.includes('/completion-'));
if (first >= 0) {
  if (atlas.chunks.slice(first).some(c => !c.url.includes('/completion-'))) throw new Error('Completion chunks must be last.');
  atlas.chunks.length = first;
}
atlas.parts = atlas.parts.filter(p => !p.id.startsWith('ZA_C_'));
atlas.concepts = atlas.concepts.filter(c => !c.id.startsWith('ZAC_completion_') && !c.id.startsWith('ZA_C_'));
const descriptions = JSON.parse(fs.readFileSync(path('app/data/structure-descriptions.json')));
for (const key of Object.keys(descriptions)) if (key.startsWith('ZA_C_') || key.startsWith('ZAC_completion_')) delete descriptions[key];
const rows = {}, families = new Map(), files = []; let buffers = [], offset = 0;
function append(array) {
  while (offset % 4) { buffers.push(Buffer.from([0])); offset++; }
  const at = offset, b = Buffer.from(array.buffer, array.byteOffset, array.byteLength);
  buffers.push(b); offset += b.length; return at;
}
function flush() {
  if (!buffers.length) return;
  const name = `completion-${files.length}.bin`, b = Buffer.concat(buffers), gzip = gzipSync(b, {level:9});
  files.push({ name, b, gzip });
  atlas.chunks.push({url:'/models/'+name,bytes:b.length,gzip:'/models/'+name+'.gz',gzipBytes:gzip.length});
  buffers=[]; offset=0;
}
function concept(id, name, elements, detail) {
  atlas.concepts.push({id,name,elements}); rows[id]={name,description:name+'。'+detail};
}
for (const entry of source) {
  if (offset > 5_000_000) flush();
  const positions = new Float32Array(blob.buffer,blob.byteOffset+entry.positions,entry.vertexCount*3);
  const indices = new Uint32Array(blob.buffer,blob.byteOffset+entry.indices,entry.indexCount);
  const g = new BufferGeometry().setAttribute('position',new Float32BufferAttribute(positions,3)).setIndex(new Uint32BufferAttribute(indices,1));
  g.computeVertexNormals(); g.computeBoundingBox();
  const normals = Int16Array.from(g.attributes.normal.array, n=>Math.round(Math.max(-1,Math.min(1,n))*32767));
  atlas.parts.push({id:entry.id,name:entry.name,conceptId:entry.id,system:entry.system,chunk:atlas.chunks.length,
    positions:append(positions),normals:append(normals),indices:append(indices),vertexCount:entry.vertexCount,indexCount:entry.indexCount,
    bounds:[g.boundingBox.min.toArray(),g.boundingBox.max.toArray()],source:entry.source,registration:entry.registration});
  concept(entry.id,entry.name,[entry.id],entry.description);
  const family = families.get(entry.family) ?? {name:entry.familyName,elements:[],description:entry.description};
  family.elements.push(entry.id); families.set(entry.family,family);
}
for (const [key,family] of families) if (family.elements.length>1)
  concept('ZAC_completion_'+key,family.name,family.elements,family.description);
for (const [key,name,match,detail] of [
  ['thoracolumbar','胸腰筋膜',p=>p.stem.includes('thoracolumbar_fascia'),'此组包含左右胸腰筋膜前、中、后层。它们分隔腰背部肌群、连接椎骨与骨盆，并参与躯干张力传递；当前形态经过跨来源骨骼配准，尚需专业解剖审校。'],
  ['capsules','主要关节囊',p=>p.stem.startsWith('Articular_capsule_'),'此组集合已收录的肩、肘、腕、髋、膝和颞下颌关节囊。关节囊围成关节边界并参与稳定，不代表全部滑膜、滑囊及关节软骨已独立建模。'],
  ['spinal_cord','脊髓（已收录组成）',p=>['White_matter_of_spinal_cord','Anterior_horn_of_spinal_cord','Posterior_horn_of_spinal_cord','Lateral_intermediate_substance'].includes(p.stem),'此组集合脊髓白质、前角、后角及外侧中间质的来源网格。它提供脊髓在椎管内的教学参照，未将全部节段、核团和束路独立分离；灰白质细节与节段形态仍需专业解剖审校。'],
  ['brachial_plexus','臂丛（已收录组成）',p=>p.stem.endsWith('_of_brachial_plexus'),'此组收录左右臂丛根、上中下干、各干前后股和后束。尚无独立内侧束及外侧束网格，不能视为完整臂丛；主要终末神经另有可单独选择的网格。'],
  ['peripheral_nerves','四肢主要神经',p=>['Radial_nerve','Median_nerve','Ulnar_nerve','Musculocutaneous_nerve','Axillary_nerve','Femoral_nerve','Obturator_nerve','Saphenous_nerve','Sciatic_nerve','Tibial_nerve','Common_fibular_nerve','Superficial_fibular_nerve','Deep_fibular_nerve','Sural_nerve','Medial_plantar_nerve','Lateral_plantar_nerve'].includes(p.stem),'此组集合已收录的上、下肢主要神经干及部分分支，便于观察其与骨骼、肌肉的关系。并未收录所有皮支、肌支和末梢神经；源片段之间及与中枢的连接不保证全部连续。'],
  ['lymph_nodes','淋巴结（已收录结群）',p=>p.system==='lymphatic','此组集合头颈、腋窝、胸腹、骨盆、腹股沟及腘窝等区域选定的淋巴结群。一个网格可能包含多个淋巴结，不能用网格数推算人体淋巴结总数；胸导管及连接淋巴管尚未收录。'],
  ['parathyroid','甲状旁腺',p=>p.stem.includes('parathyroid_gland'),'此组收录参考模型中左右上、下甲状旁腺。甲状旁腺通过分泌甲状旁腺激素参与钙磷代谢，数量和位置存在个体差异；当前几何不代表每个人的实际分布。'],
]) {
  const ids=source.filter(match).map(p=>p.id); if(ids.length) concept('ZAC_completion_'+key,name,ids,detail);
}
// Searching a whole system must include the new meshes, as the layer controls do.
for(const [id,system,detail] of [
  ['FMA7157','nervous','脑、脊髓及周围神经共同传导和处理感觉、运动及自主调节信号。此组包含当前神经图层已收录的结构；颈丛、腰骶丛的完整组成、全部末梢和自主神经通路仍未补齐，不代表完整神经系统。'],
  ['FMA9668','endocrine','内分泌器官分泌激素，参与代谢、生长、应激及生殖调节。此组保留原有成员，并纳入已补充的甲状腺和甲状旁腺；当前模型未把全身所有内分泌细胞及微观组织独立建模。'],
]){
  const c=atlas.concepts.find(c=>c.id===id);
  const liveIds=new Set(atlas.parts.map(p=>p.id));
  c.elements=[...new Set([...c.elements.filter(id=>liveIds.has(id)),...atlas.parts.filter(p=>p.system===system).map(p=>p.id)])];
  rows[id]={name:c.name,description:c.name+'。'+detail};
}
flush();
atlas.triangles=atlas.parts.reduce((n,p)=>n+p.indexCount/3,0);
atlas.version='BodyParts3D 4.0 + Z-Anatomy supplements 1 + vascular 1 + completion 1';
atlas.completion={version:1,addedMeshes:source.length,license:'CC-BY-SA-4.0',
  status:'Selected source structures registered to the existing skeleton; not a complete or professionally reviewed human atlas.',
  sourceFiles:Object.fromEntries(source.map(p=>[p.source.file,p.source.sha256])),
  pending:['颈丛与腰骶丛完整组成、臂丛内外侧束、全部末梢和自主神经通路',
    '左右臂丛后束与腋神经之间约7.5毫米的来源缺口，尚未补连',
    '胸导管及连接淋巴管、未选入的淋巴结群','腹直肌鞘和TFCC剩余独立组成',
    '全部关节软骨、滑膜、滑囊与完整脑膜及胸腹膜','内耳及部分细部肌肉','既有血管补丁披露的断段和缺失']};
for(const f of files){fs.writeFileSync(path('public/models/'+f.name),f.b);fs.writeFileSync(path('public/models/'+f.name+'.gz'),f.gzip);}
Object.assign(descriptions,rows);
fs.writeFileSync(path('app/data/completion-descriptions.json'),JSON.stringify(rows,null,2)+'\n');
fs.writeFileSync(path('app/data/structure-descriptions.json'),JSON.stringify(descriptions,null,2)+'\n');
fs.writeFileSync(path('public/models/atlas.json'),JSON.stringify(atlas,null,2)+'\n');
const coverage={added:source.length,parts:source.map(p=>({id:p.id,name:p.name,source:p.source,region:p.registration.region})),
  geometrySha256:Object.fromEntries(files.map(f=>[f.name,createHash('sha256').update(f.b).digest('hex')]))};
fs.writeFileSync(path('docs/completion-coverage.json'),JSON.stringify(coverage,null,2)+'\n');
console.log(JSON.stringify({added:source.length,parts:atlas.parts.length,concepts:atlas.concepts.length,compressedBytes:files.reduce((n,f)=>n+f.gzip.length,0)},null,2));
