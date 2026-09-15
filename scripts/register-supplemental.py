"""Fit labelled bone regions, then share a bounded affine map within each region.

Requires numpy/scipy. Run after prepare-supplemental.mjs. Reports sampled
nearest-vertex residuals; these measure geometric fit, not anatomical accuracy.
"""
import json
from pathlib import Path
import numpy as np
from scipy.spatial import cKDTree

ROOT = Path(__file__).resolve().parents[1]
WORK = ROOT / 'work/z-anatomy'
rng = np.random.default_rng(20260915)

def sample(points, count):
    points = np.unique(np.asarray(points).reshape(-1, 3), axis=0)
    return points[rng.choice(len(points), min(count, len(points)), replace=False)]

def fit(x, y, reference_scale):
    # Similarity fit (rotation, positive uniform scale, translation); no reflection.
    mx, my = x.mean(0), y.mean(0)
    a, b = x - mx, y - my
    u, s, vt = np.linalg.svd(a.T @ b)
    sign = np.eye(3); sign[2, 2] = np.linalg.det(u @ vt)
    rotation = u @ sign @ vt
    scale = np.clip(np.sum(s * np.diag(sign)) / np.sum(a*a), reference_scale*.98, reference_scale*1.02)
    linear = scale * rotation
    return linear, my - mx @ linear

models, excluded = [], []
pairs = json.loads((WORK / 'bone-correspondences.json').read_text())
# Joint attachment regions must not inherit a fit dominated by the long shaft.
# Register both ends as labelled regions, in addition to whole-bone candidates.
regions = []
for pair in pairs:
    if pair['sourceName'][:-1] not in ['Femur','Tibia','Fibula','Humerus','Radius','Ulna']: continue
    for end in ['proximal','distal']:
        region = {**pair, 'sourceName':pair['sourceName']+':'+end}
        for key in ['source','target']:
            p = np.asarray(pair[key]).reshape(-1,3)
            fraction = (p[:,1]-p[:,1].min()) / np.ptp(p[:,1])
            region[key] = p[fraction>.75 if end=='proximal' else fraction<.25].reshape(-1).tolist()
        regions.append(region)
for pair in pairs + regions:
    src = sample(pair['source'], 4500)
    dst = sample(pair['target'], 30000)
    tree = cKDTree(dst)
    # Alternate deterministic points for fitting vs independent evaluation.
    train, heldout = src[::2], src[1::2]
    scale = np.linalg.norm(np.ptp(dst, axis=0)) / np.linalg.norm(np.ptp(src, axis=0))
    linear = np.eye(3) * scale
    translation = (dst.min(0)+dst.max(0))/2 - (src.min(0)+src.max(0))/2 @ linear
    previous = np.inf
    for _ in range(100):
        dist, closest = tree.query(train @ linear + translation)
        # Discard outliers from differing bone segmentation boundaries.
        keep = dist <= np.quantile(dist, .9)
        linear, translation = fit(train[keep], dst[closest[keep]], scale)
        error = np.mean(dist[keep]**2)
        if abs(previous-error) < 1e-12: break
        previous = error
    fitted_scale = np.cbrt(np.linalg.det(linear))
    distances = tree.query(heldout @ linear + translation)[0]
    angle = np.degrees(np.arccos(np.clip((np.trace(linear/fitted_scale)-1)/2,-1,1)))
    if not .80 < fitted_scale < 1.20 or np.quantile(distances,.95) > .008 or angle > 25:
        excluded.append({'name':pair['sourceName'],'p95Mm':float(np.quantile(distances,.95)*1000),'scale':float(fitted_scale),'rotationDegrees':float(angle)})
        continue
    models.append({'name':pair['sourceName'], 'target':pair['baseName'],
        'linear':linear, 'translation':translation, 'tree':cKDTree(src),
        'scale':fitted_scale, 'rmsMm':np.sqrt(np.mean(distances**2))*1000,
        'p95Mm':np.quantile(distances,.95)*1000})

parts = json.loads((WORK / 'supplement-source.json').read_text())
blob = bytearray((WORK / 'supplement-source.bin').read_bytes())
region_models = {}
def region_for(part, points):
    stem=part['stem']; side='l' if part['side']=='左' else 'r'
    if 'abdom' in stem or stem in ['Inguinal_ligament','Linea_alba']: return 'abdomen'
    if stem in ['Anterior_longitudinal_ligament','Posterior_longitudinal_ligament','Ligamenta_flava','Supraspinous_ligament','Interspinous_ligaments','Nuchal_ligament']: return 'spine'
    y=points[:,1].mean()
    if y>1.45: return 'head'
    if y<.25: return 'ankle_'+side
    if y<.6: return 'knee_'+side
    if y<.95: return ('wrist_' if abs(points[:,0].mean())>.18 else 'hip_')+side
    if y<1.2: return 'elbow_'+side
    return 'shoulder_'+side

def region_transform(region):
    if region in region_models: return region_models[region]
    side=region[-1]
    if region=='head':
        selected=[m for m in models if any(s in m['name'] for s in ['Temporal','Parietal','Zygomatic','Maxilla','Mandible','Frontal','Occipital','Sphenoid'])]
    elif region=='abdomen':
        selected=[m for m in models if m['name'].startswith(('Hip_bone','Vertebra_L','Vertebra_T10','Vertebra_T11','Vertebra_T12','Eighth_rib','Ninth_rib','Tenth_rib','Eleventh_rib','Twelfth_rib'))]
    elif region=='spine':
        selected=[m for m in models if m['name'].startswith('Vertebra') or m['name'] in ['Sacrum','Occipital_bone']]
    else:
        stems={
          'ankle':['Tibia@:distal','Fibula@:distal','Talus@','Calcaneus@'],
          'knee':['Femur@:distal','Tibia@:proximal','Fibula@:proximal','Patella@'],
          'wrist':['Radius@:distal','Ulna@:distal','Scaphoid_bone@','Lunate_bone@','Triquetrum_bone@','Pisiform_bone@','Capitate_bone@','Hamate_bone@'],
          'hip':['Hip_bone@','Femur@:proximal'],
          'elbow':['Humerus@:distal','Radius@:proximal','Ulna@:proximal'],
          'shoulder':['Scapula@','Clavicle@','Humerus@:proximal'],
        }[region.rsplit('_',1)[0]]
        names=[s.replace('@',side) for s in stems]
        if region.startswith('hip_'): names.append('Sacrum')
        selected=[m for m in models if m['name'] in names]
    if len(selected)<2: raise ValueError(f'Insufficient regional anchors: {region}')
    x=np.concatenate([m['tree'].data[np.linspace(0,len(m['tree'].data)-1,240,dtype=int)] for m in selected])
    y=np.concatenate([m['tree'].data[np.linspace(0,len(m['tree'].data)-1,240,dtype=int)] @ m['linear'] + m['translation'] for m in selected])
    mx,my=x.mean(0),y.mean(0)
    linear=np.linalg.lstsq(x-mx,y-my,rcond=None)[0]
    u,s,vt=np.linalg.svd(linear)
    # Keep regional shape changes conservative; a common affine map preserves
    # nested abdominal layers and cannot fold individual meshes.
    linear=u @ np.diag(np.clip(s,.85,1.15)) @ vt
    if np.linalg.det(linear)<=0: raise ValueError('Reflected region '+region)
    translation=my-mx@linear
    record={'linear':linear,'translation':translation,'anchors':[m['name'] for m in selected],
      'fitRmsMm':float(np.sqrt(np.mean(np.sum((x@linear+translation-y)**2,axis=1)))*1000)}
    region_models[region]=record
    return record

triangle_qa={'checked':0,'sourceSlivers':0,'minimumAreaRatio':float('inf'),'maximumAreaRatio':0.0}
for part in parts:
    points = np.frombuffer(blob, dtype='<f4', count=part['vertexCount']*3, offset=part['positions']).reshape(-1,3).copy().astype(float)
    region=region_for(part,points); transform=region_transform(region)
    aligned=points@transform['linear']+transform['translation']
    # Validate the actual float32 output precision, not only the ideal matrix.
    aligned=aligned.astype('<f4').astype(float)
    indices=np.frombuffer(blob,dtype='<u4',count=part['indexCount'],offset=part['indices']).reshape(-1,3)
    before=np.cross(points[indices[:,1]]-points[indices[:,0]],points[indices[:,2]]-points[indices[:,0]])
    after=np.cross(aligned[indices[:,1]]-aligned[indices[:,0]],aligned[indices[:,2]]-aligned[indices[:,0]])
    area_before=np.linalg.norm(before,axis=1); area_after=np.linalg.norm(after,axis=1)
    valid=area_before>1e-10; ratio=area_after[valid]/area_before[valid]
    if np.any(np.sum(before[valid]*after[valid],axis=1)<=0) or ratio.min()<.5 or ratio.max()>1.5:
        raise ValueError('Triangle orientation/area regression: '+part['name'])
    triangle_qa['checked']+=int(valid.sum());triangle_qa['sourceSlivers']+=int((~valid).sum())
    triangle_qa['minimumAreaRatio']=min(triangle_qa['minimumAreaRatio'],float(ratio.min()))
    triangle_qa['maximumAreaRatio']=max(triangle_qa['maximumAreaRatio'],float(ratio.max()))
    if not np.isfinite(aligned).all(): raise ValueError(part['name'])
    displacement = np.linalg.norm(aligned-points, axis=1)
    if displacement.max() > .10: raise ValueError(f"Excessive deformation: {part['name']}")
    output = np.frombuffer(blob, dtype='<f4', count=part['vertexCount']*3, offset=part['positions']).reshape(-1,3)
    output[:] = aligned
    part['registration'] = {'region':region,'maximumDisplacementMm':float(displacement.max()*1000),
        'meanDisplacementMm':float(displacement.mean()*1000)}

(WORK / 'supplement-registered.bin').write_bytes(blob)
(WORK / 'supplement-registered.json').write_text(json.dumps(parts,ensure_ascii=False,indent=2)+'\n')
report = {'method':'Labelled bone/endpoint trimmed similarity ICP, followed by a shared bounded affine transform per anatomical region. Source units converted to metres. No per-vertex nonrigid warp.',
    'seed':20260915,
    'limitation':'Residuals are held-out sampled nearest-vertex distances, not point-to-surface distances or clinical validation. Soft tissue attachments require visual review.',
    'boneCount':len(models), 'meshCount':len(parts), 'excludedBones':excluded,
    'triangleQa':triangle_qa,
    'regions':{region:{k:v.tolist() if isinstance(v,np.ndarray) else v for k,v in value.items()} for region,value in region_models.items()},
    'bones':[{k:(v.tolist() if isinstance(v,np.ndarray) else float(v) if isinstance(v,np.floating) else v)
              for k,v in m.items() if k!='tree'} for m in models]}
(ROOT / 'docs/supplemental-registration.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'bones':len(models),'meshes':len(parts),'medianBoneP95Mm':float(np.median([m['p95Mm'] for m in models])),
                 'worstBones':sorted([(m['name'],round(m['p95Mm'],2)) for m in models],key=lambda x:-x[1])[:8]},indent=2))
