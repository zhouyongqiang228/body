import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createExplosionLayout} from '../app/explosion-layout.ts';
import {PointerTap} from '../app/pointer-tap.ts';
import {atlasTools} from '../app/agent-tools.ts';

for (const file of ['atlas.json']) {
  const atlas=JSON.parse(await readFile(new URL(`../public/models/${file}`,import.meta.url)));
  const groups=[atlas.parts,...[...new Set(atlas.parts.map(p=>p.system))].map(system=>atlas.parts.filter(p=>p.system===system))];
  for(const group of groups) for(const aspect of [.46,1,1.7]) {
    const layout=createExplosionLayout(group,aspect),cells=[...layout.cells.values()];
    assert.equal(cells.length,group.length);
    for(let i=0;i<cells.length;i++) {
      const a=cells[i];
      assert.ok(Math.abs(a.x)+a.width/2<=layout.width/2+1e-8);
      assert.ok(Math.abs(a.y)+a.height/2<=layout.height/2+1e-8);
      for(let j=i+1;j<cells.length;j++) {
        const b=cells[j];
        assert.ok(Math.abs(a.x-b.x)>=(a.width+b.width)/2-1e-8 || Math.abs(a.y-b.y)>=(a.height+b.height)/2-1e-8,'Exploded pieces overlap');
      }
    }
  }
  let selected=null;
  const [find,inspect]=atlasTools(atlas,c=>{selected=c;});
  const results=find.execute({query:'femur'});
  assert.ok(results.length>0);
  inspect.execute({id:results[0].id});
  const previous=selected;
  assert.throws(()=>inspect.execute({id:'nonexistent-structure'}));
  assert.equal(selected,previous);
  assert.throws(()=>find.execute({query:' '}));
  console.log(`${file}: packing at desktop/mobile aspect ratios and search/inspection contracts passed.`);
}
const tap=new PointerTap();
tap.down(1,10,10,5);assert.equal(tap.up(1,12,11),true);
tap.down(1,10,10,5);tap.move(1,40,10);assert.equal(tap.up(1,10,10),false);
tap.down(1,10,10,12);tap.down(2,20,20,12);assert.equal(tap.up(2,20,20),false);assert.equal(tap.up(1,10,10),false);
tap.down(1,10,10,5);tap.cancel(1);assert.equal(tap.up(1,10,10),false);
tap.down(1,10,10,5);assert.equal(tap.up(1,10,10),true);
assert.equal(createExplosionLayout([]).cells.size,0);
console.log('Tap, drag, multitouch, cancellation, and empty-view checks passed.');

const catalog = JSON.parse(await readFile(new URL('../public/models/atlas.json', import.meta.url)));
const descriptions = JSON.parse(await readFile(new URL('../app/data/structure-descriptions.json', import.meta.url)));
for (const concept of catalog.concepts) {
  assert.equal(descriptions[concept.id]?.name, concept.name, `Description identity: ${concept.id}`);
  assert.ok(descriptions[concept.id].description.length >= 40, `Detailed text missing: ${concept.id}`);
}
for (const part of catalog.parts) assert.ok(descriptions[part.conceptId], `Mesh description: ${part.id}`);
const {structureTitle} = await import('../app/structure-descriptions.ts');
assert.deepEqual(structureTitle('左股骨'), {name:'股骨', side:'左'});
assert.deepEqual(structureTitle('右侧第1肋'), {name:'第1肋', side:'右'});
assert.deepEqual(structureTitle('左侧脑室'), {name:'侧脑室', side:'左'});
assert.deepEqual(structureTitle('胸腺右叶'), {name:'胸腺叶', side:'右'});
assert.ok(descriptions.FMA24475.description.includes('髋臼'));
assert.ok(descriptions.FMA23131.description.includes('肘关节'));
assert.ok(descriptions.FMA7196.description.includes('白髓'));
console.log(`All ${catalog.concepts.length} concept descriptions and all mesh mappings verified.`);
