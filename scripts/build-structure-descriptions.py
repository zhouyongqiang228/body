"""Build a fully materialized, concept-ID keyed description table from curated anatomy notes.
The viewer never falls back to a system paragraph. Shared anatomical families are
expanded with each entry's name, side, members and branch/segment context.
"""
import json, re
from pathlib import Path
from collections import Counter
root = Path(__file__).resolve().parents[1]
atlas = json.loads((root / 'public/models/atlas.json').read_text())
parts = {p['id']: p for p in atlas['parts']}
concepts = {c['id']: dict(c) for c in atlas['concepts']}
for p in parts.values():
    if p['conceptId'] not in concepts:
        concepts[p['conceptId']] = {'id': p['conceptId'], 'name': p['name'], 'elements': [q['id'] for q in parts.values() if q['conceptId'] == p['conceptId']]}
# Normalize legacy literal translations only for matching; keep source names in the table.
aliases = {
'肱二头肌股肌':'股二头肌','肱二头肌臂肌':'肱二头肌','肱三头肌臂肌':'肱三头肌',
'伸肌腕肌桡侧肌短肌':'桡侧腕短伸肌','伸肌腕肌桡侧肌长肌':'桡侧腕长伸肌','伸肌腕肌尺侧肌':'尺侧腕伸肌',
'屈肌腕肌桡侧肌':'桡侧腕屈肌','屈肌腕肌尺侧肌':'尺侧腕屈肌',
'伸肌拇指短肌':'拇短伸肌','伸肌拇指长肌':'拇长伸肌','伸肌拇趾短肌':'拇趾短伸肌','伸肌拇趾长肌':'拇趾长伸肌',
'伸肌指长肌':'趾长伸肌','伸肌示指':'示指伸肌','伸肌小指':'小指伸肌','伸肌指':'指伸肌',
'屈肌拇指短肌':'拇短屈肌','屈肌拇指长肌':'拇长屈肌','屈肌拇趾短肌':'拇趾短屈肌','屈肌拇趾长肌':'拇趾长屈肌',
'屈肌指浅肌':'指浅屈肌','屈肌指深肌':'指深屈肌','屈肌指短肌':'趾短屈肌','屈肌指长肌':'趾长屈肌',
'外展肌拇指短肌':'拇短展肌','外展肌拇指长肌':'拇长展肌','外展肌拇趾':'拇趾展肌','外展肌小指':'小指展肌',
'内收肌拇指':'拇收肌','内收肌拇趾':'拇趾收肌','内收肌长肌':'长收肌','内收肌短肌':'短收肌','内收肌小肌':'小收肌','内收肌小部':'小收肌',
'对掌肌小指':'小指对掌肌','对掌肌拇指':'拇对掌肌','屈肌小指短肌':'小指短屈肌',
'圆肌大':'大圆肌','圆肌小':'小圆肌','方肌股肌':'股方肌','直肌股肌':'股直肌',
'胸大肌大':'胸大肌','胸大肌小':'胸小肌','臀肌大肌':'臀大肌','臀肌中肌':'臀中肌','臀肌小肌':'臀小肌',
'腰大肌大':'腰大肌','长肌颈肌':'颈长肌','长肌头肌':'头长肌','头半棘肌':'头半棘肌',
'斜肌头肌上':'头上斜肌','斜肌头肌下':'头下斜肌','直肌头肌后大':'头后大直肌','直肌头肌后小':'头后小直肌','直肌头肌前':'头前直肌','直肌头肌外侧肌':'头外侧直肌',
'旋前肌圆肌':'旋前圆肌','旋前肌方肌':'旋前方肌','前锯肌后上':'后上锯肌','前锯肌后下':'后下锯肌','前锯肌后':'后锯肌',
'跗骨板':'睑板','尾状核叶肝':'肝尾状叶','上额骨回':'额上回','中额骨回':'额中回','下额骨回':'额下回',
'骨间足':'骨间肌足','掌骨间肌':'掌侧骨间肌','背侧骨间肌':'背侧骨间肌',
'咽上缩肌':'咽缩肌上部','咽中缩肌':'咽缩肌中部','咽下缩肌':'咽缩肌下部',
}
def norm(s):
    s = re.sub(r'[左右](?:侧)?', '', s)
    for a,b in aliases.items(): s = s.replace(a,b)
    s = re.sub(r'^第([0-9一二三四五六七八九十]+)肋$', r'第\1肋骨', s)
    s = s.replace('舌段上动脉','肺动脉舌段上支').replace('舌段下动脉','肺动脉舌段下支').replace('舌段上静脉','肺静脉舌段上支').replace('舌段下静脉','肺静脉舌段下支')
    return s
notes = []
for line in (root/'scripts/structure-notes.txt').read_text().splitlines():
    if not line or line.startswith('#'): continue
    keys, desc = line.split('\t',1)
    for key in keys.split('|'): notes.append((norm(key),desc))
notes.sort(key=lambda t: len(t[0]), reverse=True)
def match(name):
    n=norm(name)
    for key,desc in notes:
        if (len(key)>1 and key in n) or n==key: return key,desc
    return None
# Ensure named vascular structures use vessel facts, never a muscle or organ note.
def direct(c):
    n=norm(c['name']); result=match(c['name'])
    if re.search(r'动脉|静脉',n):
        for key,desc in notes:
            if len(key)>1 and key in n and re.search(r'血|静脉|动脉',key+desc): return key,desc
        return None
    return result
matches={i:direct(c) for i,c in concepts.items()}
parents={e:[] for e in parts}
for i,c in concepts.items():
    if matches[i]:
        for e in c['elements']: parents[e].append(c)
for candidates in parents.values(): candidates.sort(key=lambda c: (len(c['elements']),-len(matches[c['id']][0])))
override_path = root / 'app/data/supplemental-descriptions.json'
overrides = json.loads(override_path.read_text()) if override_path.exists() else {}
for filename in ['corrected-descriptions.json', 'completion-descriptions.json', 'vascular-descriptions.json']:
    path = root / 'app/data' / filename
    if path.exists(): overrides.update(json.loads(path.read_text()))
rows={}; missing=[]
for i,c in concepts.items():
    if i in overrides:
        assert overrides[i]['name'] == c['name'], i
        rows[i] = {**overrides[i], 'kind':'supplemental-curation'}
        continue
    name=c['name']; members=[parts[e] for e in c['elements']]
    match_result=matches[i]; kind='anatomical'; reference=None
    if match_result:
        key,detail=match_result
    else:
        # Unnamed ontology groups are described through their actual members.
        distinct=list(dict.fromkeys(p['name'] for p in members))
        available=[]
        for p in members:
            m=direct({'name':p['name']})
            if m and m[0] not in [v[0] for v in available]: available.append((m[0],m[1],p['name']))
        if available:
            key,detail,reference=available[0]
            kind='collection' if len(distinct)>1 else 'catalog-label'
            if len(available)>1:
                detail='；'.join(f'{v[2]}：{v[1]}' for v in available[:2])
        else:
            candidates=[parent for p in members for parent in parents[p['id']] if parent['id']!=i]
            candidates.sort(key=lambda c:len(c['elements']))
            if candidates:
                parent=candidates[0]; key,detail=matches[parent['id']]; reference=parent['name']; kind='parent-context'
            else:
                missing.append((i,name,[p['name'] for p in members])); continue
    lead=f'{name}。'
    if kind=='collection':
        names='、'.join(distinct[:6]); rest=f'等{len(distinct)}类结构' if len(distinct)>6 else ''
        lead+=f'此目录条目集合了{names}{rest}。其中，'
    elif kind=='catalog-label':
        lead+=f'原始目录使用此名称标记{reference}相关结构。'
    elif kind=='parent-context':
        lead+=f'此名称是原始目录中的局部或集合标记，其模型归属于“{reference}”。以下说明其所处结构的解剖关系：'
    elif len(members)>1 and len(set(p['name'] for p in members))>1 and not any(x in name for x in ['支','段','动脉','静脉']):
        lead+=f'本条目包含'+ '、'.join(list(dict.fromkeys(p['name'] for p in members))[:4]) + ('等结构。' if len(members)>4 else '。')
    # Explicit branch/segment identity is retained for hundreds of small lung/liver branches.
    if kind=='anatomical' and any(t in name for t in ['支','段','头','部']) and norm(name)!=key:
        if '动脉' in name: detail+=f'这里标出的“{name}”是该血管通路中的具体分支或节段，所标方向用于区分邻近血管。'
        elif '静脉' in name: detail+=f'这里的“{name}”标示具体回流属支或节段，孤立显示可观察它与上级静脉的连接走向。'
        elif '支气管' in name or '胆' in name: detail+=f'名称“{name}”保留了该导管的侧别、区域或分支层级，用于定位其通向的组织范围。'
        elif '肌' in name: detail+=f'名称中的头、部或方向进一步定位同一肌肉内的纤维束；该部分与同肌其他肌束共同传递张力。'
    rows[i]={'name':name,'description':lead+detail,'basis':key,'kind':kind}
(root/'app/data/structure-descriptions.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2)+'\n')
print('Entries:',len(rows),'of',len(concepts),'kinds:',Counter(r['kind'] for r in rows.values()))
Path('/tmp/body-uncovered.json').write_text(json.dumps(missing,ensure_ascii=False,indent=2))
print('Uncovered:',len(missing)); print('\n'.join(str(m) for m in missing[:90]))
