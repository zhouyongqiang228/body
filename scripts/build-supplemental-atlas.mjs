// Publish the registered overlay while retaining the original geometry records.
import fs from 'node:fs';
import { gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { BufferGeometry, Float32BufferAttribute, Uint32BufferAttribute } from 'three';
const root = new URL('../',import.meta.url), path = s=>new URL(s,root);
const atlasPath=path('public/models/atlas.json'), descriptionPath=path('app/data/structure-descriptions.json');
const atlas=JSON.parse(fs.readFileSync(atlasPath)), descriptions=JSON.parse(fs.readFileSync(descriptionPath));
const source=JSON.parse(fs.readFileSync(path('work/z-anatomy/supplement-registered.json')));
const blob=fs.readFileSync(path('work/z-anatomy/supplement-registered.bin'));
atlas.parts=atlas.parts.filter(p=>!p.id.startsWith('ZA_')).map(p=>p.originalPart??p);
atlas.concepts=atlas.concepts.filter(c=>!c.id.startsWith('ZA'));
atlas.chunks=atlas.chunks.filter(c=>!c.url.includes('/supplement-'));
for(const key of Object.keys(descriptions)) if(key.startsWith('ZA')) delete descriptions[key];
const files=[],families=new Map(), originals=new Map(atlas.parts.map(p=>[p.name,p])), importedIds=new Map();
let buffer=[],offset=0,chunkIndex=atlas.chunks.length,total=0,added=0,replaced=0;
function append(array){while(offset%4){buffer.push(Buffer.from([0]));offset++;}const start=offset;const b=Buffer.from(array.buffer,array.byteOffset,array.byteLength);buffer.push(b);offset+=b.length;return start;}
function flush(){if(!buffer.length)return;const b=Buffer.concat(buffer),name=`supplement-${files.length}.bin`,gzip=gzipSync(b,{level:9});files.push({name,b,gzip});atlas.chunks.push({url:'/models/'+name,bytes:b.length,gzip:'/models/'+name+'.gz',gzipBytes:gzip.length});buffer=[];offset=0;chunkIndex++;}
for(const entry of source){
  if(offset>5_000_000)flush();
  const positions=new Float32Array(blob.buffer,blob.byteOffset+entry.positions,entry.vertexCount*3);
  const indices=new Uint32Array(blob.buffer,blob.byteOffset+entry.indices,entry.indexCount);
  const g=new BufferGeometry().setAttribute('position',new Float32BufferAttribute(positions,3)).setIndex(new Uint32BufferAttribute(indices,1));
  g.computeVertexNormals();g.computeBoundingBox();
  const normals=Int16Array.from(g.attributes.normal.array,v=>Math.round(Math.max(-1,Math.min(1,v))*32767));
  const original=['External_abdominal_oblique_muscle','Linea_alba'].includes(entry.stem)?originals.get(entry.name):undefined;
  const id=original?.id??entry.id,conceptId=original?.conceptId??entry.id;
  importedIds.set(entry.id,id);
  const part={id,name:entry.name,conceptId,system:entry.system,chunk:chunkIndex,
    positions:append(positions),normals:append(normals),indices:append(indices),vertexCount:entry.vertexCount,indexCount:entry.indexCount,
    bounds:[g.boundingBox.min.toArray(),g.boundingBox.max.toArray()],
    source:{dataset:'Z-Anatomy',license:'CC-BY-SA-4.0',file:entry.sourceFile,mesh:entry.sourceName,id:entry.sourceId,sha256:entry.sourceSha256,phase:entry.phase,...(entry.derivation?{derivation:entry.derivation}:{})},
    registration:entry.registration,...(original?{originalPart:original}:{})};
  if(original){atlas.parts[atlas.parts.findIndex(p=>p.id===id)]=part;replaced++;}else{atlas.parts.push(part);added++;}
  const concept={id:conceptId,name:entry.name,elements:[id]};
  const ci=atlas.concepts.findIndex(c=>c.id===conceptId);
  if(ci>=0)atlas.concepts[ci]=concept;else atlas.concepts.push(concept);
  descriptions[conceptId]={name:entry.name,description:entry.name+'。'+entry.description};
  const family=families.get(entry.family)??{name:entry.name.replace(/^[左右]/,''),elements:[],description:entry.description};
  family.elements.push(id);families.set(entry.family,family);
  total+=indices.length/3;
}
function group(id,name,elements,description){if(!elements.length)throw new Error(`Empty group: ${id}`);atlas.concepts.push({id,name,elements});descriptions[id]={name,description:name+'。'+description};}
for(const [key,family] of families)group('ZAC_'+key,family.name,family.elements,family.description);
const tfccStems=['Articular_disc_of_distal_radio-ulnar_joint','Palmar_radio-ulnar_ligament','Dorsal_radio-ulnar_ligament','Ulnolunate_ligament','Ulnotriquetral_ligament'];
for(const side of ['','左','右']) {
  const elements=source.filter(p=>tfccStems.includes(p.stem)&&(!side||p.side===side)).map(p=>p.id);
  group('ZAC_TFCC_'+(side==='左'?'L':side==='右'?'R':'both'),side+'TFCC 已收录组成',elements,
    '三角纤维软骨复合体位于尺侧腕部，参与稳定远侧桡尺关节和传递腕部负荷。此组收录三角纤维软骨盘、掌背侧桡尺韧带、尺月韧带和尺三角韧带；半月板同源体及尺侧腕伸肌腱鞘底尚未独立建模，因此本组不代表完整TFCC。');
}
for(const [key,name,stems] of [
  ['masseter','咬肌',['Superficial_part_of_masseter','Deep_part_of_masseter']],
  ['pterygoid','翼外肌',['Superior_head_of_lateral_pterygoid_muscle','Inferior_head_of_lateral_pterygoid_muscle']],
  ['mcl','膝内侧副韧带',['Superficial_part_of_tibial_collateral_ligament','Deep_part_of_tibial_collateral_ligament']],
])for(const side of ['','左','右']){
  const members=source.filter(p=>stems.includes(p.stem)&&(!side||p.side===side));
  group(`ZAC_${key}_${side||'both'}`,side+name,members.map(p=>p.id),'此条目集合了'+members.map(p=>p.name).join('、')+'。'+members[0].description);
}
flush();
atlas.triangles=atlas.parts.reduce((n,p)=>n+p.indexCount/3,0);
atlas.version='BodyParts3D 4.0 + Z-Anatomy supplement 1';
atlas.supplement={version:1,commit:'6c7f9016bd5899ac8edafd31b9900c151df42ed6',license:'CC-BY-SA-4.0',
  addedMeshes:added,replacedMeshes:replaced,triangles:total,
  status:'Educational geometry registered to the base skeleton; not professionally anatomy-reviewed.',
  pending:['腹直肌鞘未作为独立网格分离','TFCC半月板同源体缺少独立源网格','TFCC尺侧腕伸肌腱鞘底未独立分离'],
  sourceFiles:Object.fromEntries(source.map(p=>[p.sourceFile,p.sourceSha256]))};
// Write complete assets before publishing the manifest that references them.
for(const file of files){fs.writeFileSync(path('public/models/'+file.name),file.b);fs.writeFileSync(path('public/models/'+file.name+'.gz'),file.gzip);}
fs.writeFileSync(descriptionPath,JSON.stringify(descriptions,null,2)+'\n');
const supplementalDescriptionIds=new Set(atlas.concepts.filter(c=>c.id.startsWith('ZA')).map(c=>c.id));
for(const p of atlas.parts.filter(p=>p.originalPart))supplementalDescriptionIds.add(p.conceptId);
fs.writeFileSync(path('app/data/supplemental-descriptions.json'),JSON.stringify(Object.fromEntries([...supplementalDescriptionIds].map(id=>[id,descriptions[id]])),null,2)+'\n');
fs.writeFileSync(atlasPath,JSON.stringify(atlas,null,2)+'\n');
const coverage={version:1,added,replaced,sourceMeshes:source.length,pending:atlas.supplement.pending,
  parts:source.map(p=>({id:importedIds.get(p.id),name:p.name,phase:p.phase,sourceFile:p.sourceFile,sourceMesh:p.sourceName,derivation:p.derivation??null})),
  geometrySha256:Object.fromEntries(files.map(f=>[f.name,createHash('sha256').update(f.b).digest('hex')]))};
fs.writeFileSync(path('docs/supplemental-coverage.json'),JSON.stringify(coverage,null,2)+'\n');
console.log(JSON.stringify({added,replaced,parts:atlas.parts.length,concepts:atlas.concepts.length,triangles:total,compressedBytes:files.reduce((n,f)=>n+f.gzip.length,0)},null,2));
