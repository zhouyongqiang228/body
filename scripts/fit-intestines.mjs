// Apply once after rebuilding the atlas. All bowel pieces share one transform.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { gzipSync } from 'node:zlib';

const base = new URL('../public/models/', import.meta.url);
const atlasFile = new URL('atlas.json', base);
const atlas = JSON.parse(fs.readFileSync(atlasFile));
if (atlas.intestinalFit) {
  assert.equal(atlas.intestinalFit.version, 1, 'Unknown intestinal fit version');
  console.log('Intestinal fit already applied; leaving geometry unchanged.');
  process.exit(0);
}

// Includes the unnamed bowel muscle layer and taeniae, plus attached mesenteries.
// Use stable source IDs so translated labels cannot change the fitted selection.
const ids = new Set([
  ...Array.from({ length: 64 }, (_, i) => `FJ${2565 + i}`),
  'FJ3396', 'FJ3397', 'FJ3398',
]);
const parts = atlas.parts.filter(p => ids.has(p.id));
assert.equal(parts.length, ids.size, 'Missing intestinal mesh');
const scale = 0.84;
const translation = [0, 0, -0.012];
const low = [Infinity, Infinity, Infinity], high = [-Infinity, -Infinity, -Infinity];
const buffers = new Map();
for (const p of parts) {
  if (!buffers.has(p.chunk)) {
    const chunk = atlas.chunks[p.chunk];
    const buffer = fs.readFileSync(new URL(chunk.url.split('/').pop(), base));
    assert.equal(buffer.length, chunk.bytes);
    buffers.set(p.chunk, buffer);
  }
  const buffer = buffers.get(p.chunk);
  const positions = new Float32Array(buffer.buffer, buffer.byteOffset + p.positions, p.vertexCount * 3);
  for (let i = 0; i < positions.length; i++) {
    low[i % 3] = Math.min(low[i % 3], positions[i]);
    high[i % 3] = Math.max(high[i % 3], positions[i]);
  }
}
const pivot = low.map((v, axis) => (v + high[axis]) / 2);
for (const p of parts) {
  const buffer = buffers.get(p.chunk);
  const positions = new Float32Array(buffer.buffer, buffer.byteOffset + p.positions, p.vertexCount * 3);
  p.bounds = [[Infinity, Infinity, Infinity], [-Infinity, -Infinity, -Infinity]];
  for (let i = 0; i < positions.length; i++) {
    const axis = i % 3;
    positions[i] = pivot[axis] + (positions[i] - pivot[axis]) * scale + translation[axis];
    p.bounds[0][axis] = Math.min(p.bounds[0][axis], positions[i]);
    p.bounds[1][axis] = Math.max(p.bounds[1][axis], positions[i]);
  }
  // Uniform positive scaling leaves normal directions and triangle winding intact.
}
for (const [index, buffer] of buffers) {
  const chunk = atlas.chunks[index];
  fs.writeFileSync(new URL(chunk.url.split('/').pop(), base), buffer);
  if (chunk.gzip) {
    const compressed = gzipSync(buffer, { level: 9 });
    fs.writeFileSync(new URL(chunk.gzip.split('/').pop(), base), compressed);
    chunk.gzipBytes = compressed.length;
  }
}
atlas.intestinalFit = { version: 1, scale, pivot, translation, parts: [...ids] };
fs.writeFileSync(atlasFile, JSON.stringify(atlas, null, 2) + '\n');
console.log(`Fitted ${parts.length} bowel meshes to ${scale * 100}% with a shared abdominal pivot.`);
