// Checks named major vessels and actual buffer coordinates, not ontology presence alone.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
const root = new URL('../', import.meta.url), path = s => new URL(s, root);
const read = s => JSON.parse(fs.readFileSync(path(s)));
const atlas = read('public/models/atlas.json'), requirements = read('scripts/vascular-requirements.json');
const parts = new Map(atlas.parts.map(p => [p.id, p]));
const chunks = atlas.chunks.map(c => fs.readFileSync(path('public' + c.url)));
const vertices = ids => ids.flatMap(id => {
  const p = parts.get(id); assert.ok(p, `Missing connection member: ${id}`);
  const b = chunks[p.chunk], points = new Float32Array(b.buffer, b.byteOffset + p.positions, p.vertexCount * 3);
  return Array.from({ length: p.vertexCount }, (_, i) => Array.from(points.subarray(i * 3, i * 3 + 3)));
});
const measure = row => {
  const a = vertices(row.a), b = vertices(row.b); let minimum = Infinity;
  for (const p of a) for (const q of b) {
    const d = (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 + (p[2] - q[2]) ** 2;
    if (d < minimum) minimum = d;
  }
  const nearestVertexMm = Math.sqrt(minimum) * 1000;
  return { ...row, nearestVertexMm, status: nearestVertexMm <= row.maximumMm ? 'within-screening-tolerance' : 'gap' };
};
const connections = requirements.connections.map(measure);
const knownIncompleteConnections = (requirements.knownIncompleteConnections ?? []).map(measure);
const families = requirements.families.map(row => {
  const meshes = atlas.parts.filter(p => [row.name, ...(row.aliases ?? [])].includes(p.name) && ['arterial', 'venous'].includes(p.system));
  return { ...row, status: meshes.length ? 'represented' : 'missing', parts: meshes.map(p => p.id) };
});
if (atlas.vascular) {
  for (const [filename, hash] of Object.entries(atlas.vascular.geometrySha256)) {
    const bytes = fs.readFileSync(path('public/models/' + filename));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), hash);
    assert.deepEqual(gunzipSync(fs.readFileSync(path('public/models/' + filename + '.gz'))), bytes);
  }
  for (const id of atlas.vascular.importedIds) {
    const p = parts.get(id); assert.ok(p, `Missing imported vessel: ${id}`);
    assert.equal(p.source.license, 'CC-BY-SA-4.0');
    assert.equal(p.source.file, 'CardioVascular41.fbx');
    assert.match(p.source.sha256, /^[a-f0-9]{64}$/);
    assert.ok(p.registration, `Unregistered vessel: ${p.name}`);
    assert.ok(atlas.concepts.some(c => c.elements.includes(id)), `Unsearchable vessel: ${p.name}`);
    for (const point of vertices([id])) point.forEach((v, k) => {
      assert.ok(Number.isFinite(v) && v >= p.bounds[0][k] - 1e-6 && v <= p.bounds[1][k] + 1e-6, p.name);
    });
    if (p.vascularOriginal) {
      const original = p.vascularOriginal, old = chunks[original.chunk], current = chunks[p.chunk];
      assert.deepEqual(current.subarray(p.positions, p.positions + original.vertexCount * 12),
        old.subarray(original.positions, original.positions + original.vertexCount * 12), 'Original vessel coordinates changed: ' + p.name);
      assert.deepEqual(current.subarray(p.indices, p.indices + original.indexCount * 4),
        old.subarray(original.indices, original.indices + original.indexCount * 4), 'Original vessel faces changed: ' + p.name);
      assert.ok(p.registration.graftNearestVertexMm < 1, 'Source graft detached from original: ' + p.name);
    }
  }
}
const report = { method: requirements.method, families, connections, knownIncompleteConnections,
  sourceExclusions: requirements.sourceExclusions ?? [],
  missing: families.filter(r => r.status === 'missing').map(r => r.name),
  gaps: connections.filter(r => r.status === 'gap'),
  limitations: atlas.vascular?.limitations ?? ['Vascular supplement has not been applied.'] };
if (process.argv.includes('--write')) fs.writeFileSync(path('docs/vascular-coverage.json'), JSON.stringify(report, null, 2) + '\n');
console.log(`Major vessel names: ${families.length - report.missing.length}/${families.length}; connections screened: ${connections.length}; large gaps: ${report.gaps.length}.`);
console.log('Missing named vessels: ' + (report.missing.join('；') || 'none within the declared checklist'));
for (const row of report.gaps) console.log(`GAP ${row.label}: ${row.nearestVertexMm.toFixed(2)} mm`);
for (const row of knownIncompleteConnections) console.log(`KNOWN INCOMPLETE ${row.label}: ${row.nearestVertexMm.toFixed(2)} mm; ${row.reason}`);
if (report.gaps.length) process.exitCode = 1;
if (process.argv.includes('--require-complete') && (report.missing.length || knownIncompleteConnections.some(r => r.status === 'gap'))) process.exitCode = 1;
