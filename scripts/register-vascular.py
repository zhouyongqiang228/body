"""Register source vessel segments and retain existing geometry at established junctions.

Source tubes fill documented gaps; no procedural vessel paths are invented.
The overlay uses overlapping surfaces, not a reconstructed watertight lumen.
"""
import json
from collections import Counter, defaultdict
from pathlib import Path
import numpy as np
from scipy.spatial import cKDTree

ROOT = Path(__file__).resolve().parents[1]
WORK = ROOT / 'work/vascular'
atlas = json.loads((ROOT/'public/models/atlas.json').read_text())
source = json.loads((WORK/'source.json').read_text())
blob = (WORK/'source.bin').read_bytes()
chunks = [(ROOT/('public'+c['url'])).read_bytes() for c in atlas['chunks']]
originals = {p['id']: p.get('vascularOriginal', p) for p in atlas['parts']}
meshes = {p['name']: p for p in source['parts'] if p['vertexCount']}
head = json.loads((ROOT/'docs/supplemental-registration.json').read_text())['regions']['head']
linear, translation = np.array(head['linear']), np.array(head['translation'])

def geometry(p, data):
    return (np.frombuffer(data, '<f4', p['vertexCount']*3, p['positions']).reshape(-1,3).astype(float),
            np.frombuffer(data, '<u4', p['indexCount'], p['indices']).reshape(-1,3).copy())

def old_geometry(id):
    p = originals[id]
    return geometry(p, chunks[p['chunk']])

def register(v):
    # One continuous field preserves the source bifurcations and nearby branches.
    w = np.clip((v[:,1]-1.44)/.09, 0, 1)
    w = (w*w*(3-2*w))[:,None]
    return v*(1-w) + (v@linear+translation)*w

def section(v, f, value, axis=1):
    points = []
    for a,b in [(0,1),(1,2),(2,0)]:
        va,vb = v[f[:,a]],v[f[:,b]]
        mask = (va[:,axis]-value)*(vb[:,axis]-value)<0
        va,vb=va[mask],vb[mask]
        t=(value-va[:,axis])/(vb[:,axis]-va[:,axis])
        points.extend(va+(vb-va)*t[:,None])
    if len(points)<4: raise ValueError(f'Insufficient section at {value}')
    points=np.array(points)
    return (points.min(0)+points.max(0))/2, points

def boundary_rings(v,f):
    edges=Counter(tuple(sorted(e)) for tri in f for e in [(tri[0],tri[1]),(tri[1],tri[2]),(tri[2],tri[0])])
    adj=defaultdict(set)
    for (a,b),n in edges.items():
        if n==1: adj[a].add(b);adj[b].add(a)
    seen=set();result=[]
    for i in adj:
        if i in seen:continue
        stack=[i];ids=set()
        while stack:
            j=stack.pop()
            if j in ids:continue
            ids.add(j);stack.extend(adj[j]-ids)
        seen.update(ids)
        if len(ids)>=8:result.append(np.array(sorted(ids)))
    return sorted(result,key=lambda r:v[r,1].mean())

def move_end(v,ring,destination,radius=.03):
    center=v[ring].mean(0);delta=destination-center
    if np.linalg.norm(delta)>.02:raise ValueError(f'Endpoint displacement exceeds 20 mm: {delta}')
    distance=np.linalg.norm(v-center,axis=1)
    inner=distance[ring].max()+1e-7
    w=np.clip((radius-distance)/(radius-inner),0,1);w=w*w*(3-2*w)
    return v+w[:,None]*delta, {'sourceCenter':center.tolist(),'targetCenter':destination.tolist(),'displacementMm':float(np.linalg.norm(delta)*1000)}

def clip(v,f,level,keep_above):
    positions=[];faces=[];cache={}
    def vertex(p):
        key=tuple(np.round(p,9))
        if key not in cache:cache[key]=len(positions);positions.append(p)
        return cache[key]
    for tri in f:
        polygon=[];points=v[tri]
        for a,b in zip(points,np.roll(points,-1,axis=0)):
            inside=a[1]>=level if keep_above else a[1]<=level
            next_inside=b[1]>=level if keep_above else b[1]<=level
            if inside:polygon.append(a)
            if inside!=next_inside:polygon.append(a+(b-a)*((level-a[1])/(b[1]-a[1])))
        for j in range(1,len(polygon)-1):
            face=[vertex(polygon[k]) for k in [0,j,j+1]]
            if len(set(face))==3:faces.append(face)
    return np.array(positions),np.array(faces,dtype=np.uint32)

entries=[]
triangle_qa=[]
def check_deformation(name,before,after,faces):
    a=np.cross(before[faces[:,1]]-before[faces[:,0]],before[faces[:,2]]-before[faces[:,0]])
    b=np.cross(after[faces[:,1]]-after[faces[:,0]],after[faces[:,2]]-after[faces[:,0]])
    area=np.linalg.norm(a,axis=1);valid=area>1e-12
    ratio=np.linalg.norm(b[valid],axis=1)/area[valid]
    flipped=int((np.sum(a[valid]*b[valid],axis=1)<=0).sum())
    if flipped or ratio.min()<.05 or ratio.max()>20:raise ValueError(f'Unsafe source deformation: {name}: flipped={flipped}, area={ratio.min()}..{ratio.max()}')
    triangle_qa.append({'name':name,'checked':int(valid.sum()),'sourceDegenerates':int((~valid).sum()),'flipped':flipped,'minimumAreaRatio':float(ratio.min()),'maximumAreaRatio':float(ratio.max())})
for line in (ROOT/'scripts/vascular-parts.tsv').read_text().splitlines():
    if not line or line.startswith('#'):continue
    stem,name,system,left,right,description=line.split('\t')
    names=[(stem,'',left)] if stem in meshes else [(stem+'l','左',left),(stem+'r','右',right)]
    for source_name,side,replacement in names:
        p=meshes[source_name];v,f=geometry(p,blob);aligned=register(v);rings=boundary_rings(aligned,f)
        entry={'id':replacement or f'ZA_V_{p["id"]}','name':side+name,'stem':stem,'side':side,'system':system,
               'description':description,'sourceName':source_name,'sourceId':p['id'],'replacement':bool(replacement),
               'registration':{'method':'Shared head/neck field with source-section grafts and bounded endpoint alignment','headAnchors':head['anchors'],'adjustments':[]}}
        if replacement:
            old,oldf=old_geometry(replacement)
            above=stem in ['Left_common_carotid_artery','Right_common_carotid_artery','Internal_jugular_vein']
            seam=(old[:,1].max()-.003) if above else (old[:,1].min()+.003)
            target_center,target_points=section(old,oldf,seam)
            center,points=section(aligned,f,seam)
            delta=target_center-center;delta[1]=0
            if np.linalg.norm(delta)>.02:raise ValueError('Excessive graft alignment: '+entry['name'])
            # Match cross-section dimensions at the overlap and taper over 20 mm.
            scale=np.ptp(target_points[:,[0,2]],axis=0)/np.ptp(points[:,[0,2]],axis=0)
            if np.any((scale<.35)|(scale>3)):raise ValueError('Incompatible graft diameter: '+entry['name'])
            w=np.clip(1-np.abs(aligned[:,1]-seam)/.02,0,1);w=w*w*(3-2*w)
            correction=np.zeros_like(aligned)
            correction[:,[0,2]]=(aligned[:,[0,2]]-center[[0,2]])*(scale-1)+delta[[0,2]]
            aligned+=w[:,None]*correction
            entry['registration']['adjustments'].append({'kind':'source graft at existing cross-section','seamY':float(seam),'overlapMm':6,'centerShiftMm':float(np.linalg.norm(delta)*1000),'diameterScaleXZ':scale.tolist()})
            if stem=='Vertebral_artery':
                parent='FJ3479' if side=='左' else 'FJ3579';pv,pf=old_geometry(parent)
                center=aligned[rings[0]].mean(0);destination,_=section(pv,pf,float(center[0]),axis=0)
                aligned,record=move_end(aligned,rings[0],destination)
                entry['registration']['adjustments'].append({'kind':'source inlet registered inside parent subclavian artery','parent':parent,**record})
            check_deformation(entry['name'],v,aligned,f)
            graft,graftf=clip(aligned,f,seam-.003 if above else seam+.003,above)
            # The original buffers are retained verbatim at all established outlets.
            entry['registration']['retainedVertices']=len(old)
            entry['registration']['retainedIndices']=int(oldf.size)
            entry['registration']['graftVertices']=len(graft)
            entry['registration']['graftNearestVertexMm']=float(cKDTree(old).query(graft)[0].min()*1000)
            aligned=np.concatenate([old,graft]);f=np.concatenate([oldf,graftf+len(old)])
        elif stem=='External_jugular_vein':
            parent='FJ3486' if side=='左' else 'FJ3587';pv,pf=old_geometry(parent)
            center=aligned[rings[0]].mean(0);destination,_=section(pv,pf,float(center[0]),axis=0)
            aligned,record=move_end(aligned,rings[0],destination)
            entry['registration']['adjustments'].append({'kind':'source inlet registered inside parent subclavian vein','parent':parent,**record})
        if not replacement:check_deformation(entry['name'],v,aligned,f)
        entry['vertices']=aligned;entry['faces']=f;entries.append(entry)

# These named ends are the same anatomical junction. Adapt the existing sigmoid
# source tube over 30 mm to meet the jugular outlet; do not invent a new vessel.
for entry in entries:
    if entry['stem']!='Sigmoid_sinus':continue
    jugular=next(p for p in entries if p['stem']=='Internal_jugular_vein' and p['side']==entry['side'])
    v,f=entry['vertices'],entry['faces'];rings=boundary_rings(v,f)
    jv,jf=jugular['vertices'],jugular['faces'];jr=boundary_rings(jv,jf)
    # Original mesh seams also appear as boundaries; the superior source ring is highest.
    destination=jv[jr[-1]].mean(0)
    before=v.copy()
    v,record=move_end(v,rings[0],destination)
    check_deformation(entry['name']+'出口接合',before,v,f)
    entry['vertices']=v
    entry['registration']['adjustments'].append({'kind':'sigmoid outlet aligned to superior jugular source ring',**record})

buffers=[];offset=0;published=[]
for entry in entries:
    v=entry.pop('vertices').astype('<f4');f=entry.pop('faces').astype('<u4')
    if not np.isfinite(v).all() or f.max()>=len(v):raise ValueError('Invalid geometry')
    entry.update(vertexCount=len(v),indexCount=int(f.size),positions=offset,indices=offset+v.nbytes,
                 sourceFile=source['file'],sourceSha256=source['sha256'])
    buffers.extend([v.tobytes(),f.tobytes()]);offset+=v.nbytes+f.nbytes;published.append(entry)
(WORK/'registered.bin').write_bytes(b''.join(buffers))
(WORK/'registered.json').write_text(json.dumps(published,ensure_ascii=False,indent=2)+'\n')
(ROOT/'docs/vascular-registration.json').write_text(json.dumps({'headField':head,'parts':[{'id':p['id'],'name':p['name'],**p['registration']} for p in published],'triangleQa':triangle_qa},ensure_ascii=False,indent=2)+'\n')
print(f'Registered {len(published)} vessels; {sum(p["replacement"] for p in published)} preserve and extend existing meshes.')
for p in published:
    if p['replacement']:print(p['name'],'graft distance mm',round(p['registration']['graftNearestVertexMm'],3))
