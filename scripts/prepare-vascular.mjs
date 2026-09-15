// Extract the pinned source in world coordinates; labels/children are not merged.
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { Texture, TextureLoader } from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const root = new URL('../', import.meta.url), path = s => new URL(s, root);
const bytes = fs.readFileSync(path('work/z-anatomy/CardioVascular41.fbx'));
const blobId = createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
if (blobId !== 'aa5bbcb63ae6e9ace8051111b3a85ea87f00c4f3') throw new Error('Unexpected cardiovascular source identity');
TextureLoader.prototype.load = function () { return new Texture(); };
globalThis.window = { URL: globalThis.URL, innerWidth: 1, innerHeight: 1 };
const scene = new FBXLoader().parse(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
scene.updateMatrixWorld(true);
const parts = [], segments = []; let offset = 0;
scene.traverse(o => {
  if (!o.isMesh) return;
  let g = o.geometry.clone().applyMatrix4(o.matrixWorld).scale(.01, .01, .01);
  for (const key of Object.keys(g.attributes)) if (key !== 'position') g.deleteAttribute(key);
  g = mergeVertices(g, 1e-7); g.computeBoundingBox();
  const positions = Float32Array.from(g.attributes.position.array), indices = Uint32Array.from(g.index.array);
  parts.push({ name: o.name, id: o.ID, vertexCount: positions.length / 3, indexCount: indices.length,
    positions: offset, indices: offset + positions.byteLength,
    bounds: [g.boundingBox.min.toArray(), g.boundingBox.max.toArray()] });
  segments.push(Buffer.from(positions.buffer), Buffer.from(indices.buffer));
  offset += positions.byteLength + indices.byteLength;
});
fs.mkdirSync(path('work/vascular'), { recursive: true });
fs.writeFileSync(path('work/vascular/source.bin'), Buffer.concat(segments));
fs.writeFileSync(path('work/vascular/source.json'), JSON.stringify({
  file: 'CardioVascular41.fbx', sha256: createHash('sha256').update(bytes).digest('hex'), parts,
}, null, 2) + '\n');
console.log(`Extracted ${parts.length} meshes (${offset} bytes) from verified cardiovascular source.`);
