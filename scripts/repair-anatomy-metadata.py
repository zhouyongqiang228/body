"""Apply explicit, repeatable catalogue corrections without changing geometry or IDs."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
def read(path): return json.loads((ROOT / path).read_text())
def write(path, value): (ROOT / path).write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')

atlas = read('public/models/atlas.json')
descriptions = read('app/data/structure-descriptions.json')
parts = {p['id']: p for p in atlas['parts']}
concepts = {c['id']: c for c in atlas['concepts']}
report_path = ROOT / 'docs/metadata-corrections.json'
report = read('docs/metadata-corrections.json') if report_path.exists() else {'parts': {}, 'concepts': {}}
override_path = ROOT / 'app/data/corrected-descriptions.json'
overrides = read('app/data/corrected-descriptions.json') if override_path.exists() else {}

def part(pid, **changes):
    p = parts[pid]
    if any(p[k] != v for k, v in changes.items()):
        report['parts'].setdefault(pid, {'before': {k: p[k] for k in ['name', 'system']}})
        p.update(changes)
        report['parts'][pid]['after'] = {k: p[k] for k in ['name', 'system']}

def concept(cid, name, detail=None):
    c = concepts[cid]
    if c['name'] != name:
        report['concepts'].setdefault(cid, {'before': c['name']})
        c['name'] = name
        report['concepts'][cid]['after'] = name
    old = descriptions[cid]
    detail = detail or old['description'].split('。', 1)[1]
    overrides[cid] = {'name': name, 'description': name + '。' + detail}

# These are skeletal muscles, not bones or fascia. IDs are retained.
for stem in ['FJ1409', 'FJ1410', 'FJ1411', 'FJ1438', 'FJ1439', 'FJ1440', 'FJ1504', 'FJ1532']:
    for suffix in ['', 'M']: part(stem + suffix, system='muscular')
for pid in ['FJ2740','FJ2742','FJ2743','FJ2745','FJ2746','FJ2747',
            'FJ2752','FJ2754','FJ2755','FJ2757','FJ2758','FJ2759']:
    part(pid, system='muscular')
for stem in ['FJ1471', 'FJ1423']:
    for suffix in ['', 'M']: part(stem + suffix, system='connective')
for p in atlas['parts']:
    if '乳头肌' in p['name']: part(p['id'], system='cardiac')
    if p['name'] in ['左泪骨','右泪骨']: part(p['id'], system='skeletal')
    if p['name'] == '脉络膜丛大脑半球': part(p['id'], system='nervous')

families = [
    ('FMA22539','FMA22552','FMA22553','腓骨长肌','位于小腿外侧浅层，肌腱经外踝后方及足底走向第1跖骨基底和内侧楔骨。它使足外翻、辅助跖屈，并支持足弓，由腓浅神经支配。'),
    ('FMA22540','FMA22554','FMA22555','腓骨短肌','位于小腿外侧、腓骨长肌深面，肌腱经外踝后方止于第5跖骨基底。它使足外翻、辅助跖屈，并参与踝部动态稳定，由腓浅神经支配。'),
    ('FMA22538','FMA22550','FMA22551','第三腓骨肌','位于小腿前群远端，肌腱经过踝前方止于第5跖骨基底背面。它辅助足背屈和外翻，由腓深神经支配；该肌存在缺如等个体差异。'),
    ('FMA22532','FMA22544','FMA22545','胫骨前肌','位于小腿前侧，起于胫骨外侧面和骨间膜，止于内侧楔骨及第1跖骨基底。它使足背屈和内翻，步行摆动期抬起前足，由腓深神经支配。'),
    ('FMA51099','FMA65018','FMA65019','胫骨后肌','位于小腿后侧深层，肌腱经内踝后方止于舟骨及多块跗跖骨。它使足内翻、辅助跖屈，是维持足内侧纵弓的重要动态支持，由胫神经支配。'),
    ('FMA39988','FMA40120','FMA40121','腕屈肌支持带','横跨腕掌侧，附着于两侧腕骨隆起，构成腕管顶部。腕管内通过正中神经及屈肌腱；支持带限制肌腱弓弦样隆起，并稳定肌腱走行。'),
]
for both, right, left, name, detail in families:
    for cid, side in [(both,''),(right,'右'),(left,'左')]:
        concept(cid, side + name, detail)
        if side:
            for pid in concepts[cid]['elements']: part(pid, name=side + name)

for cid, name in [('FMA74877','乳头体'),('FMA62033','松果体'),('FMA72829','左壳核'),('FMA72828','右壳核')]:
    concept(cid, name)
    for pid in concepts[cid]['elements']: part(pid, name=name)
for pid, name in {
    'FJ1734':'前连合','FJ1742':'胼胝体','FJ1760':'左下丘脑','FJ1808':'右下丘脑',
    'FJ1764':'终板左部','FJ1812':'终板右部','FJ1774':'左大脑脚','FJ1821':'右大脑脚',
    'FJ1780':'灰结节左部','FJ1828':'灰结节右部','FJ1781':'左小脑半球','FJ1830':'右小脑半球',
    'FJ1825':'右终纹','FJ1843':'小脑幕','FJ2561':'脾','FJ2739':'左舌骨舌肌','FJ2751':'右舌骨舌肌',
}.items(): part(pid, name=name)
concept('FMA62394', '大脑脚', '位于中脑腹侧，包含连接大脑皮质与脑干、脊髓等的下行纤维通路。左右大脑脚之间为脚间窝，邻近动眼神经出脑区域；此条目集合已收录的左右网格。')
# Refresh descriptions whose former text embedded the generic mesh labels.
for cid in ['FMA62008','FMA62327','FMA67944','FMA61974']:
    detail = descriptions[cid]['description'].split('。',1)[1]
    if detail.startswith('本条目包含'): detail = detail.split('。',1)[1]
    concept(cid, concepts[cid]['name'], detail)
descriptions.update(overrides)
write('public/models/atlas.json', atlas)
write('app/data/structure-descriptions.json', descriptions)
write('app/data/corrected-descriptions.json', overrides)
write('docs/metadata-corrections.json', report)
print(f"Corrected {len(report['parts'])} mesh records and {len(report['concepts'])} concept names; original IDs and geometry retained.")
