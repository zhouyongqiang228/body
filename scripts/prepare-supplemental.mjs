// Extract only named anatomical meshes; do not include FBX child annotations.
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { Texture, TextureLoader, BufferGeometry, Float32BufferAttribute } from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const root = new URL('../', import.meta.url);
const path = s => new URL(s, root);
const work = 'work/z-anatomy/';
TextureLoader.prototype.load = function () { return new Texture(); };
globalThis.window = { URL: globalThis.URL, innerWidth: 1, innerHeight: 1 };
const hashes = { MuscularSystem100: '4c19df534d5d84aabbce08604306aa0485b43e8a2483c72a95b569e1dfea2279', Joints100: 'f4ba7a910cdaef99e31530f368628780d9f06b5d77853f8b721f47f67137e823', SkeletalSystem100: '294a649765cd060a62a4095da52b9c8ef2d97769aa447e196448aa5f7d596dea' };
function load(name) {
  const bytes = fs.readFileSync(path(`${work}${name}.fbx`));
  if (createHash('sha256').update(bytes).digest('hex') !== hashes[name]) throw new Error(`Invalid source: ${name}`);
  const scene = new FBXLoader().parse(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  scene.updateMatrixWorld(true);
  const meshes = new Map();
  scene.traverse(o => { if (o.isMesh) meshes.set(o.name, o); });
  return meshes;
}
function geometry(o) {
  let g = o.geometry.clone().applyMatrix4(o.matrixWorld).scale(.01, .01, .01);
  for (const key of Object.keys(g.attributes)) if (key !== 'position') g.deleteAttribute(key);
  // Weld duplicate triangle corners only, at sub-micrometre precision.
  g = mergeVertices(g, 1e-7);
  return g;
}
const atlas = JSON.parse(fs.readFileSync(path('public/models/atlas.json')));
const baseParts = atlas.parts.filter(p => !p.id.startsWith('ZA_')).map(p => p.originalPart ?? p);
const chunks = atlas.chunks.map(c => fs.readFileSync(path(`public/models/${c.url.split('/').pop()}`)));
const bones = load('SkeletalSystem100');
const pairs = [];
const normalized = new Map(baseParts.map(p => [p.name.replaceAll('侧第', '第'), p]));
function pair(sourceName, baseName) {
  const source = bones.get(sourceName), target = normalized.get(baseName);
  if (!source || !target) throw new Error(`Missing bone correspondence: ${sourceName} / ${baseName}`);
  const g = geometry(source), b = chunks[target.chunk];
  const dest = new Float32Array(b.buffer, b.byteOffset + target.positions, target.vertexCount * 3);
  pairs.push({ sourceName, baseName, source: Array.from(g.attributes.position.array), target: Array.from(dest) });
}
const paired = {
  Femur:'股骨', Tibia:'胫骨', Fibula:'腓骨', Patella:'髌骨', Radius:'桡骨', Ulna:'尺骨', Humerus:'肱骨',
  Hip_bone:'髋骨', Scapula:'肩胛骨', Clavicle:'锁骨', Scaphoid_bone:'手舟骨', Lunate_bone:'月骨',
  Triquetrum_bone:'三角骨', Pisiform_bone:'豌豆骨', Capitate_bone:'头状骨', Hamate_bone:'钩骨',
  Calcaneus:'跟骨', Talus:'距骨', Temporal_bone:'颞骨', Zygomatic_bone:'颧骨', Maxilla:'上颌骨', Parietal_bone:'顶骨',
};
for (const [stem, name] of Object.entries(paired)) for (const [suffix, side] of [['l','左'],['r','右']]) pair(stem+suffix, side+name);
for (const [stem,name] of Object.entries({ Mandible:'下颌骨',Frontal_bone:'额骨',Occipital_bone:'枕骨',Sphenoid_bone:'蝶骨',Sacrum:'骶骨' })) pair(stem,name);
for (const [region,cn,start,end] of [['C','颈',3,7],['T','胸',1,12],['L','腰',1,5]]) for(let i=start;i<=end;i++) pair(`Vertebra_${region}${i}`,`第${i}${cn}椎`);
const ordinals=['First','Second','Third','Fourth','Fifth','Sixth','Seventh','Eighth','Ninth','Tenth','Eleventh','Twelfth'];
for (let i=0;i<12;i++) for (const [suffix,side] of [['l','左'],['r','右']]) pair(`${ordinals[i]}_rib${suffix}`,`${side}第${i+1}肋`);
fs.writeFileSync(path(work+'bone-correspondences.json'), JSON.stringify(pairs));

const parts = [], buffers = []; let byteOffset = 0;
function addPart(g, record) {
  const positions = g.attributes.position.array, indices = Uint32Array.from(g.index.array);
  parts.push({...record, vertexCount:positions.length/3, indexCount:indices.length,
    positions:byteOffset, indices:byteOffset+positions.byteLength});
  buffers.push(Buffer.from(positions.buffer,positions.byteOffset,positions.byteLength),Buffer.from(indices.buffer,indices.byteOffset,indices.byteLength));
  byteOffset += positions.byteLength+indices.byteLength;
}
for (const [file, table, prefix] of [['MuscularSystem100','muscles','M'],['Joints100','joints','J']]) {
  const meshes = load(file);
  const lines = fs.readFileSync(path(`scripts/supplemental-${table}.tsv`),'utf8').split('\n').filter(l=>l && !l.startsWith('#'));
  for (const line of lines) {
    const [phase,stem,name,description] = line.split('\t');
    const names = meshes.has(stem) ? [[stem,'']] : [[stem+'l','左'],[stem+'r','右']];
    for(const [sourceName,side] of names) {
      const o = meshes.get(sourceName); if(!o) throw new Error(`Missing source mesh: ${sourceName}`);
      const g = geometry(o);
      const id = `ZA_${prefix}_${o.ID}`;
      const system = prefix==='J' || /韧带|支持带|腱鞘|白线/.test(name) ? 'connective' : 'muscular';
      addPart(g, { id, name:side+name, side, stem, family:prefix+'_'+stem, description, phase:+phase, system,
        sourceName, sourceFile:file+'.fbx', sourceId:o.ID, sourceSha256:hashes[file],
      });
    }
  }
  if (prefix==='M') for (const [suffix,side] of [['l','左'],['r','右']]) {
    const o = meshes.get('Rectus_femoris_muscle'+suffix);
    const origin = geometry(bones.get('Patellar_ligamento'+suffix)); origin.computeBoundingBox();
    const ceiling = origin.boundingBox.max.y;
    const source = o.geometry.clone().applyMatrix4(o.matrixWorld).scale(.01,.01,.01);
    const attr = source.attributes.position, vertices=[];
    const material = o.material.findIndex(m=>m.name==='Tendon');
    const point = i => { const v=source.index ? source.index.getX(i) : i; return [attr.getX(v),attr.getY(v),attr.getZ(v)]; };
    for(const group of source.groups.filter(g=>g.materialIndex===material)) for(let i=group.start;i<group.start+group.count;i+=3) {
      const polygon=[point(i),point(i+1),point(i+2)], clipped=[];
      for(let j=0;j<3;j++) {
        const a=polygon[j], b=polygon[(j+1)%3], inside=a[1]<=ceiling, nextInside=b[1]<=ceiling;
        if(inside) clipped.push(a);
        if(inside!==nextInside) {const t=(ceiling-a[1])/(b[1]-a[1]);clipped.push(a.map((v,k)=>v+t*(b[k]-v)));}
      }
      for(let j=1;j<clipped.length-1;j++) vertices.push(...clipped[0],...clipped[j],...clipped[j+1]);
    }
    if(vertices.length<90) throw new Error('Patellar tendon extraction failed');
    const g=mergeVertices(new BufferGeometry().setAttribute('position',new Float32BufferAttribute(vertices,3)),1e-7);
    addPart(g,{id:`ZA_M_${o.ID}_patellar`,name:side+'髌韧带',side,stem:'Patellar_ligament',family:'M_Patellar_ligament',phase:1,system:'connective',
      description:'连接髌骨下缘与胫骨粗隆，是膝前方伸膝装置的组成部分，将股四头肌的牵拉力经髌骨传向胫骨。本显示模型由源股直肌网格的远端肌腱区分离，近端分界参考源模型的髌韧带起点标记，分离边界仍需解剖审校。',
      sourceName:o.name,sourceFile:file+'.fbx',sourceId:o.ID,sourceSha256:hashes[file],
      derivation:{method:'Tendon material faces distal to source patellar-ligament origin marker; triangles clipped at marker maximum Y.',marker:'Patellar_ligamento'+suffix,ceilingMeters:ceiling}});
  }
}
fs.writeFileSync(path(work+'supplement-source.bin'),Buffer.concat(buffers));
fs.writeFileSync(path(work+'supplement-source.json'),JSON.stringify(parts,null,2)+'\n');
console.log(`Prepared ${pairs.length} bone correspondences and ${parts.length} anatomical meshes.`);
