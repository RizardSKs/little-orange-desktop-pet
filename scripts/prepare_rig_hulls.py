from pathlib import Path
import json
import numpy as np
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
def hull(points):
    points=sorted(set(points))
    def cross(o,a,b): return (a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0])
    def half(items):
        out=[]
        for p in items:
            while len(out)>1 and cross(out[-2],out[-1],p)<=0: out.pop()
            out.append(p)
        return out
    return half(points)[:-1]+half(reversed(points))[:-1]
data={}
for folder in ['pet','props/rig','outfits']:
    for path in (ROOT/'assets'/folder).rglob('*.png'):
        image=Image.open(path).convert('RGBA').resize((512,512),Image.Resampling.LANCZOS)
        alpha=np.asarray(image)[:,:,3]; points=[]
        for y in range(512):
            xs=np.flatnonzero(alpha[y]>=16)
            if len(xs): points.extend([(int(xs[0]),y),(int(xs[-1])+1,y),(int(xs[0]),y+1),(int(xs[-1])+1,y+1)])
        data[path.relative_to(ROOT).as_posix()]=hull(points)
output=ROOT/'tmp/rig-evidence/alpha-hulls.json';output.parent.mkdir(parents=True,exist_ok=True)
output.write_text(json.dumps(data))
print('Alpha hulls:',len(data))
