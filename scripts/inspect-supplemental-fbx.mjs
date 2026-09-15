/** Inspect actual source meshes without changing the published atlas.
 * Usage: node scripts/inspect-supplemental-fbx.mjs source.fbx [inventory.json]
 */
import fs from "node:fs";
import { createHash } from "node:crypto";
import { Box3, Texture, TextureLoader } from "three";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";

const [filename, output] = process.argv.slice(2);
if (!filename) throw new Error("Pass a source FBX filename.");
// The atlas uses system colors; texture images are unnecessary for geometry inspection.
TextureLoader.prototype.load = function () { return new Texture(); };
globalThis.window = { URL: globalThis.URL, innerWidth: 1, innerHeight: 1 };
const bytes = fs.readFileSync(filename);
const root = new FBXLoader().parse(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), "");
root.updateMatrixWorld(true);
const meshes = [];
root.traverse((object) => {
  if (!object.isMesh) return;
  // FBX meshes may have label/attachment meshes as children. Only this mesh's
  // transformed vertices belong to its bounds; setFromObject includes children.
  const vertices = object.geometry.attributes.position.clone().applyMatrix4(object.matrixWorld);
  const bounds = new Box3().setFromBufferAttribute(vertices);
  meshes.push({
    name: object.name,
    originalName: object.userData.originalName ?? object.name,
    sourceId: object.ID ?? null,
    vertices: object.geometry.attributes.position.count,
    triangles: (object.geometry.index?.count ?? object.geometry.attributes.position.count) / 3,
    bounds: [bounds.min.toArray(), bounds.max.toArray()],
    matrixWorld: object.matrixWorld.toArray(),
  });
});
const inventory = { file: filename, sha256: createHash("sha256").update(bytes).digest("hex"), meshes };
if (output) fs.writeFileSync(output, JSON.stringify(inventory, null, 2) + "\n");
console.log(JSON.stringify({ file: filename, sha256: inventory.sha256, meshCount: meshes.length,
  targetCandidates: meshes.filter(m => /temporalis|masseter|oblique|transversus.*abdom|menisc|cruciat|triangular|radioulnar|ulnocarp|ulnolun|ulnotriq/i.test(m.name)).map(m => m.name) }, null, 2));
