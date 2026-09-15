import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { BufferGeometry, Float32BufferAttribute, Uint32BufferAttribute } from 'three';

const root = new URL('../', import.meta.url), path = s => new URL(s, root);
const atlas = JSON.parse(fs.readFileSync(path('public/models/atlas.json')));
const rows = JSON.parse(fs.readFileSync(path('work/vascular/registered.json')));
const source = fs.readFileSync(path('work/vascular/registered.bin'));
atlas.parts = atlas.parts.filter(p => !p.id.startsWith('ZA_V_')).map(p => p.vascularOriginal ?? p);
atlas.concepts = atlas.concepts.filter(c => !/^(ZA_V_|ZAV_)/.test(c.id));
const firstOldChunk = atlas.chunks.findIndex(c => c.url.includes('/vascular-'));
if (firstOldChunk >= 0 && atlas.chunks.slice(firstOldChunk).some(c => !c.url.includes('/vascular-')))
  throw new Error('Vascular chunks must be last. Rebuild overlays in documented order.');
atlas.chunks = atlas.chunks.filter(c => !c.url.includes('/vascular-'));
const chunk = atlas.chunks.length, descriptions = {}, families = new Map();
const segments = []; let offset = 0;
const append = array => {
  const pad = (4 - offset % 4) % 4;
  if (pad) { segments.push(Buffer.alloc(pad)); offset += pad; }
  const start = offset, bytes = Buffer.from(array.buffer, array.byteOffset, array.byteLength);
  segments.push(bytes); offset += bytes.length; return start;
};
for (const row of rows) {
  const pos = new Float32Array(source.buffer, source.byteOffset + row.positions, row.vertexCount * 3);
  const indices = new Uint32Array(source.buffer, source.byteOffset + row.indices, row.indexCount);
  const g = new BufferGeometry().setAttribute('position', new Float32BufferAttribute(pos, 3))
    .setIndex(new Uint32BufferAttribute(indices, 1));
  g.computeVertexNormals(); g.computeBoundingBox();
  const normals = Int16Array.from(g.attributes.normal.array, n => Math.round(Math.max(-1, Math.min(1, n)) * 32767));
  const original = atlas.parts.find(p => p.id === row.id);
  if (!!original !== row.replacement) throw new Error('Replacement identity mismatch: ' + row.id);
  const p = { id: row.id, name: row.name, conceptId: original?.conceptId ?? row.id, system: row.system,
    chunk, positions: append(pos), normals: append(normals), indices: append(indices),
    vertexCount: row.vertexCount, indexCount: row.indexCount,
    bounds: [g.boundingBox.min.toArray(), g.boundingBox.max.toArray()],
    source: { dataset: 'Z-Anatomy', license: 'CC-BY-SA-4.0', file: row.sourceFile, mesh: row.sourceName,
      id: row.sourceId, sha256: row.sourceSha256, phase: 2 },
    registration: row.registration, ...(original ? { vascularOriginal: original } : {}) };
  if (original) atlas.parts[atlas.parts.indexOf(original)] = p;
  else {
    atlas.parts.push(p);
    atlas.concepts.push({ id: p.conceptId, name: p.name, elements: [p.id] });
  }
  const note = row.replacement
    ? '模型已用来源血管片段补齐主干缺段，保留原有部分与既有分支的连接。接合处采用表面重叠配准，不代表连续、密闭的血管腔。'
    : '此结构来自补充解剖模型，已配准到当前人体；形态与连接尚未经专业解剖审校。';
  descriptions[p.conceptId] = { name: p.name, description: `${p.name}。${row.description} ${note}` };
  const family = families.get(row.stem) ?? { name: row.name.replace(/^[左右]/, ''), ids: [], description: row.description };
  family.ids.push(p.id); families.set(row.stem, family);
}
function group(id, name, ids, description) {
  atlas.concepts.push({ id, name, elements: [...new Set(ids)] });
  descriptions[id] = { name, description: name + '。' + description };
}
for (const [stem, family] of families) if (family.ids.length > 1 && !atlas.concepts.some(c => c.name === family.name))
  group('ZAV_' + stem, family.name, family.ids, family.description + ' 此组为已收录模型，不表示全部细小分支均已建模。');
const arteries = atlas.parts.filter(p => p.system === 'arterial' && (rows.some(r => r.id === p.id) || p.bounds[0][1] > 1.51)).map(p => p.id);
const veins = rows.filter(p => p.system === 'venous' && !/azygos/i.test(p.stem)).map(p => p.id);
const sinuses = rows.filter(p => /sinus/.test(p.stem)).map(p => p.id);
group('ZAV_head_neck_arteries', '头颈主要动脉', arteries, '包括已收录的颈总、颈内、颈外、椎动脉及颅内与头面部分支。主干缺段已补充；尚未覆盖全部细小分支。');
group('ZAV_head_neck_veins', '头颈主要静脉', veins, '展示已收录的头颈静脉和静脉窦。直窦、大脑大静脉及完整深部脑静脉回流尚缺可靠模型；下矢状窦的后续回流未连接。');
group('ZAV_dural_sinuses', '颅内静脉窦（已收录）', sinuses, '包括上、下矢状窦、横窦、乙状窦、海绵窦、岩上窦、岩下窦及海绵间窦。直窦和独立窦汇网格尚未补齐，本组不代表完整的颅内静脉系统。');
group('ZAV_azygos', '胸部奇静脉系统（已收录）', [...rows.filter(p => /azygos/i.test(p.stem)).map(p => p.id), 'FJ1981'], '包括奇静脉、半奇静脉及原有副半奇静脉。奇静脉至上腔静脉的回流已呈现，下端与腰升静脉的连续连接尚未补齐。');
const bytes = Buffer.concat(segments), compressed = gzipSync(bytes, { level: 9 });
const filename = 'vascular-0.bin';
atlas.chunks.push({ url: '/models/' + filename, bytes: bytes.length, gzip: '/models/' + filename + '.gz', gzipBytes: compressed.length });
atlas.triangles = atlas.parts.reduce((n, p) => n + p.indexCount / 3, 0);
atlas.version = 'BodyParts3D 4.0 + Z-Anatomy supplements 1 + vascular 1';
atlas.vascular = { version: 1, commit: '6c7f9016bd5899ac8edafd31b9900c151df42ed6', license: 'CC-BY-SA-4.0',
  addedMeshes: rows.filter(p => !p.replacement).length, extendedMeshes: rows.filter(p => p.replacement).length,
  importedIds: rows.map(p => p.id), sourceSha256: rows[0].sourceSha256,
  geometrySha256: { [filename]: createHash('sha256').update(bytes).digest('hex') },
  limitations: ['非全身全部血管图谱；未覆盖全部细小分支和个体变异。',
    '直窦补充源存在约42毫米连接偏差，未采用；大脑大静脉与独立窦汇无可用源网格。',
    '深部脑静脉回流及下矢状窦后续通路未补齐。',
    '奇静脉、半奇静脉下端与腰升静脉之间仍有源模型缺段。左右耳后静脉因源模型约28毫米的连接缺口未导入。',
    '源片段与原主干采用重叠配准，连接处不是已验证的密闭血管腔；不适用于血流模拟。',
    '乙状窦出口按颈内静脉上端对齐；配准、接合区域与全部软组织关系尚未经专业解剖审校。'] };
// Write complete buffers before the manifest; rebuilds do not append duplicates.
fs.writeFileSync(path('public/models/' + filename), bytes);
fs.writeFileSync(path('public/models/' + filename + '.gz'), compressed);
fs.writeFileSync(path('app/data/vascular-descriptions.json'), JSON.stringify(descriptions, null, 2) + '\n');
fs.writeFileSync(path('public/models/atlas.json'), JSON.stringify(atlas, null, 2) + '\n');
console.log(JSON.stringify({ added: atlas.vascular.addedMeshes, extended: atlas.vascular.extendedMeshes,
  parts: atlas.parts.length, triangles: atlas.triangles, compressedBytes: compressed.length }, null, 2));
