"""Reuse anatomical regional fits; long structures share a smooth bone-anchored displacement field."""
import json
from pathlib import Path
import numpy as np
from scipy.interpolate import RBFInterpolator

ROOT = Path(__file__).resolve().parents[1]
WORK = ROOT / 'work/completion'
report = json.loads((ROOT / 'docs/supplemental-registration.json').read_text())
pairs = {p['sourceName']: p for p in json.loads((ROOT / 'work/z-anatomy/bone-correspondences.json').read_text())}

# All long structures use the SAME continuous field. Independent per-nerve fits
# would split nerve roots, trunks and branches at their shared endpoints.
source_anchors, target_anchors = [], []
torso_source, torso_target = [], []
for bone in report['bones']:
    name, *end = bone['name'].split(':')
    points = np.asarray(pairs[name]['source']).reshape(-1, 3)
    if end:
        fraction = (points[:, 1] - points[:, 1].min()) / np.ptp(points[:, 1])
        points = points[fraction > .75 if end[0] == 'proximal' else fraction < .25]
    # Centroid plus six surface extrema encode position, orientation and scale.
    ids = [np.argmin(points[:, k]) for k in range(3)] + [np.argmax(points[:, k]) for k in range(3)]
    x = np.vstack([points.mean(0), points[ids]])
    y = x @ np.asarray(bone['linear']) + np.asarray(bone['translation'])
    source_anchors.extend(x); target_anchors.extend(y)
    if name.startswith(('Vertebra_T','Vertebra_L','Hip_bone','Scapula','Humerus')) and (not name.startswith('Humerus') or end == ['proximal']):
        torso_source.extend(x); torso_target.extend(y)
source_anchors, target_anchors = np.asarray(source_anchors), np.asarray(target_anchors)
source_anchors, unique = np.unique(source_anchors, axis=0, return_index=True)
target_anchors = target_anchors[unique]
field = RBFInterpolator(source_anchors, target_anchors-source_anchors,
                        kernel='thin_plate_spline', smoothing=1e-3)
def body(points):
    return np.concatenate([p + field(p) for p in np.array_split(points, max(1, (len(points)+2999)//3000))])

tx, ty = np.asarray(torso_source), np.asarray(torso_target)
linear = np.linalg.lstsq(tx-tx.mean(0), ty-ty.mean(0), rcond=None)[0]
u, singular, vt = np.linalg.svd(linear)
linear = u @ np.diag(np.clip(singular,.85,1.15)) @ vt
if np.linalg.det(linear)<=0: raise ValueError('Reflected torso transform')
report['regions']['torso'] = {'linear':linear.tolist(),'translation':(ty.mean(0)-tx.mean(0)@linear).tolist()}

parts = json.loads((WORK / 'source.json').read_text())
blob = bytearray((WORK / 'source.bin').read_bytes())
records = []
for part in parts:
    points = np.frombuffer(blob, '<f4', part['vertexCount']*3, part['positions']).reshape(-1,3).copy().astype(float)
    region = part['region']
    if region in ['ankle','wrist','knee','hip','elbow','shoulder']: region += '_l' if part['side']=='左' else '_r'
    if region == 'body': aligned = body(points)
    else:
        transform = report['regions'][region]
        aligned = points @ np.asarray(transform['linear']) + np.asarray(transform['translation'])
    aligned = aligned.astype('<f4').astype(float)
    indices = np.frombuffer(blob, '<u4', part['indexCount'], part['indices']).reshape(-1,3)
    before = np.cross(points[indices[:,1]]-points[indices[:,0]], points[indices[:,2]]-points[indices[:,0]])
    after = np.cross(aligned[indices[:,1]]-aligned[indices[:,0]], aligned[indices[:,2]]-aligned[indices[:,0]])
    areas = np.linalg.norm(before,axis=1)
    valid = areas > 1e-10
    ratios = np.linalg.norm(after[valid],axis=1)/areas[valid]
    displacement = np.linalg.norm(aligned-points, axis=1)
    flipped = int(np.sum(np.sum(before[valid]*after[valid], axis=1)<=0))
    if not np.isfinite(aligned).all() or flipped or ratios.min()<.2 or ratios.max()>4 or displacement.max()>.1:
        raise ValueError(f"Rejected {part['name']}: flips={flipped}, area={ratios.min():.3f}..{ratios.max():.3f}, displacement={displacement.max():.3f}")
    # Check local orientation of the shared displacement field, including volumes.
    minimum_determinant = None
    if region == 'body':
        samples = points[np.linspace(0, len(points)-1, min(500,len(points)), dtype=int)]
        base = body(samples); epsilon = 1e-4
        jacobian = np.stack([(body(samples+np.eye(3)[k]*epsilon)-base)/epsilon for k in range(3)],axis=2)
        minimum_determinant = float(np.linalg.det(jacobian).min())
        if minimum_determinant <= .2: raise ValueError(f"Folded registration: {part['name']}")
    qa = {'id':part['id'], 'name':part['name'], 'region':region,
          'sourceCrossesMidline':bool(points[:,0].min()<-.0005 and points[:,0].max()>.0005),
          'maximumDisplacementMm':float(displacement.max()*1000),
          'minimumAreaRatio':float(ratios.min()), 'maximumAreaRatio':float(ratios.max()),
          'flippedTriangles':flipped, 'sourceSlivers':int((~valid).sum()),
          'minimumSampledJacobianDeterminant':minimum_determinant}
    part['registration'] = qa
    records.append(qa)
    np.frombuffer(blob,'<f4',part['vertexCount']*3,part['positions']).reshape(-1,3)[:] = aligned
    print(part['name'], region, f"max shift {displacement.max()*1000:.1f} mm", flush=True)

fit_error = np.linalg.norm(body(source_anchors)-target_anchors,axis=1)*1000
result = {'method':'Existing shared bounded regional affine maps; long structures use one smooth thin-plate-spline displacement field from retained bone-fit landmarks.',
          'limitation':'Bone-fit landmarks are not independently measured nerve/muscle attachment points. No claim of clinical accuracy or complete neural/vascular connectivity.',
          'field':{'anchors':len(source_anchors),'smoothing':1e-3,'anchorResidualP95Mm':float(np.quantile(fit_error,.95))},
          'torso':report['regions']['torso'],
          'parts':records}
(WORK / 'registered.bin').write_bytes(blob)
(WORK / 'registered.json').write_text(json.dumps(parts,ensure_ascii=False,indent=2)+'\n')
(ROOT / 'docs/completion-registration.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
