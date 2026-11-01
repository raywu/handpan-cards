import numpy as np, json
from PIL import Image
import os
REPO = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", ".."))
a=np.asarray(Image.open(os.path.join(REPO, 'docs/brand/reference/brand-board.webp')).convert('RGB')).astype(float)
bg=np.array([23,21,17.])
# pan + orbit exclusion: pixels near orbit ellipse or inside pan silhouette are skipped
OC=(674.2,252.7);OA,OB=134.0,33.8;OT=np.radians(-16.4)
def orbit_r(x,y):
    dx,dy=x-OC[0],y-OC[1]; u=dx*np.cos(OT)+dy*np.sin(OT); q=-dx*np.sin(OT)+dy*np.cos(OT)
    return np.hypot(u/OA,q/OB)
def in_pan(x,y): return 562<x<776 and 205<y<294
rings={"inner":(674.1,255.8,90.6,82.6),"middle":(675.5,253.8,108.5,100.3),"outer":(676.5,252.0,126.5,118.0)}
tilt=np.radians(-9.8)  # y-down: major axis rising to the right
out={}
for name,(cx,cy,ra,rb) in rings.items():
    prof=[]
    for deg in range(0,360,5):
        t=np.radians(deg); best=None
        for s in np.arange(0.97,1.035,0.005):
            ex,ey=ra*s*np.cos(t),-rb*s*np.sin(t)
            x=cx+ex*np.cos(tilt)-ey*np.sin(tilt); y=cy+ex*np.sin(tilt)+ey*np.cos(tilt)
            if in_pan(x,y) or abs(orbit_r(x,y)-1)<0.12: continue
            p=a[int(round(y)),int(round(x))]-bg
            if best is None or p.sum()>best.sum(): best=p
        prof.append(None if best is None else [int(v) for v in best])
    out[name]=prof
    line=[]
    for i,p in enumerate(prof):
        if p is None: line.append('  --  ')
        else:
            s=sum(p); hue='T' if p[2]>p[0]+12 else ('G' if p[0]>p[2]+12 else '.')
            line.append(f"{s:4d}{hue}")
    print(name); 
    for k in range(0,72,18): print('  ',' '.join(f"{(k+j)*5:3d}" for j in range(18))); print('  ',' '.join(f"{v:>3}"[:3] if v.strip()!='--' else ' --' for v in [x[:4].strip() for x in line[k:k+18]])); print('  ',' '.join(f"  {x[-1]}" for x in line[k:k+18]))
json.dump(out,open('ring_profiles.json','w'))
