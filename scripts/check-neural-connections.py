import json
from pathlib import Path
import numpy as np
from scipy.spatial import cKDTree
root=Path(__file__).resolve().parents[1];w=root/'work/completion'
source=json.loads((w/'source.json').read_text());registered=json.loads((w/'registered.json').read_text())
blobs={'source':(w/'source.bin').read_bytes(),'registered':(w/'registered.bin').read_bytes()}
parts={(p['stem'],p['side']):p for p in source}
links=[('Sciatic_nerve','Tibial_nerve'),('Sciatic_nerve','Common_fibular_nerve'),('Common_fibular_nerve','Superficial_fibular_nerve'),('Common_fibular_nerve','Deep_fibular_nerve'),('Tibial_nerve','Medial_plantar_nerve'),('Tibial_nerve','Lateral_plantar_nerve'),('Femoral_nerve','Saphenous_nerve'),('Roots_of_brachial_plexus','Superior_trunk_of_brachial_plexus'),('Roots_of_brachial_plexus','Middle_trunk_of_brachial_plexus'),('Roots_of_brachial_plexus','Inferior_trunk_of_brachial_plexus'),('Posterior_cord_of_brachial_plexus','Radial_nerve'),('Posterior_cord_of_brachial_plexus','Axillary_nerve')]
rows=[]
for side in ['左','右']:
 for a,b in links:
  p,q=parts[a,side],parts[b,side];row={'from':p['name'],'to':q['name']}
  for label,blob in blobs.items():
   x=np.frombuffer(blob,'<f4',p['vertexCount']*3,p['positions']).reshape(-1,3);y=np.frombuffer(blob,'<f4',q['vertexCount']*3,q['positions']).reshape(-1,3)
   row[label+'DistanceMm']=float(cKDTree(x).query(y)[0].min()*1000)
  row['gapOver5Mm']=row['registeredDistanceMm']>5
  if row['sourceDistanceMm']<=5 and row['registeredDistanceMm']>5:
   raise ValueError('Registration opened a major nerve connection: '+str(row))
  if row['registeredDistanceMm']-row['sourceDistanceMm']>2:
   raise ValueError('Nerve gap increased by over 2 mm: '+str(row))
  rows.append(row)
report={'method':'Minimum sampled vertex distance for selected major nerve branches. Proximity does not prove continuous or anatomically correct fibres. No gap-filling geometry is fabricated.','connections':rows}
(root/'docs/completion-connections.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print('Checked',len(rows),'connections; gaps >5mm:',[r for r in rows if r['gapOver5Mm']])
