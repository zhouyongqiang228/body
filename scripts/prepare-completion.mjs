// Extract a curated allowlist only; labels, NC ear/kidney assets and existing meshes are excluded.
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { Texture, TextureLoader } from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
const root = new URL('../', import.meta.url), path = s => new URL(s, root);
fs.mkdirSync(path('work/completion'), { recursive: true });
TextureLoader.prototype.load = function () { return new Texture(); };
globalThis.window = { URL: globalThis.URL, innerWidth: 1, innerHeight: 1 };
const blobs = {
  MuscularSystem100: '2477e1b6caf97d7174762b5eec6cf1c80db64eed',
  Joints100: '9db06d20217f4f42999dcfdf31b1f6af78dc7794',
  NervousSystem100: '4ec6e3cb2a1ba821aca02c1d523ac614fdf41a02',
  LymphoidOrgans100: 'fa39c3f65ecbf7d97c3f56ba47b4382e957ef85e',
  VisceralSystem100: '355770ae46123044c85deca03de3fb880b8f7301',
};
const atlas = JSON.parse(fs.readFileSync(path('public/models/atlas.json')));
const existing = atlas.parts.filter(p => !p.id.startsWith('ZA_C_'));
const rows = fs.readFileSync(path('scripts/completion-parts.tsv'), 'utf8').split('\n')
  .filter(l => l && !l.startsWith('#')).map(l => l.split('\t'));
const parts = [], buffers = []; let offset = 0;
for (const file of new Set(rows.map(r => r[0]))) {
  const bytes = fs.readFileSync(path(`work/z-anatomy/${file}.fbx`));
  const gitBlob = createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
  if (gitBlob !== blobs[file]) throw new Error(`Source identity mismatch: ${file}`);
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  const scene = new FBXLoader().parse(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length), '');
  scene.updateMatrixWorld(true);
  const meshes = new Map(); scene.traverse(o => { if (o.isMesh) meshes.set(o.name, o); });
  for (const [, stem, familyName, system, region, description] of rows.filter(r => r[0] === file)) {
    if (!description || !region) throw new Error(`Incomplete curation: ${stem}`);
    const names = meshes.has(stem) ? [[stem, '']] : [[stem + 'l', '左'], [stem + 'r', '右']];
    for (const [meshName, side] of names) {
      const o = meshes.get(meshName); if (!o) throw new Error(`Missing source mesh: ${meshName}`);
      const name = side + familyName;
      if (existing.some(p => p.name === name || (p.source?.file === file + '.fbx' && p.source?.id === o.ID)))
        throw new Error(`Already modelled: ${name}`);
      let g = o.geometry.clone().applyMatrix4(o.matrixWorld).scale(.01, .01, .01);
      for (const key of Object.keys(g.attributes)) if (key !== 'position') g.deleteAttribute(key);
      g = mergeVertices(g, 1e-7);
      const positions = g.attributes.position.array, indices = Uint32Array.from(g.index.array);
      if (indices.length <= 60 || meshName.endsWith('j')) throw new Error(`Empty or annotation source: ${meshName}`);
      const id = `ZA_C_${file}_${o.ID}`;
      parts.push({ id, name, familyName, side, stem, family: file + '_' + stem, system, region, description,
        vertexCount: positions.length / 3, indexCount: indices.length, positions: offset, indices: offset + positions.byteLength,
        source: { dataset: 'Z-Anatomy', license: 'CC-BY-SA-4.0', file: file + '.fbx', mesh: meshName, id: o.ID,
          sha256, gitBlob, commit: '6c7f9016bd5899ac8edafd31b9900c151df42ed6', phase: 3 } });
      buffers.push(Buffer.from(positions.buffer, positions.byteOffset, positions.byteLength), Buffer.from(indices.buffer));
      offset += positions.byteLength + indices.byteLength;
    }
  }
}
fs.writeFileSync(path('work/completion/source.bin'), Buffer.concat(buffers));
fs.writeFileSync(path('work/completion/source.json'), JSON.stringify(parts, null, 2) + '\n');
console.log(`Prepared ${parts.length} completion meshes with verified source identities.`);
