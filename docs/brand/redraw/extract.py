"""Extract stroke centre-lines of the pan from the board raster (board pixels)."""
import numpy as np, json
from PIL import Image
import os
REPO = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", ".."))
L=np.asarray(Image.open(os.path.join(REPO, 'docs/brand/reference/brand-board.webp')).convert('L')).astype(float)
OC=(674.2,252.7);OA,OB=134.0,33.8;OT=np.radians(-16.4)
def orbit_y(x, front=True):
    # solve the orbit ellipse for y at column x
    ys=np.linspace(150,350,4001)
    dx,dy=x-OC[0],ys-OC[1]; u=dx*np.cos(OT)+dy*np.sin(OT); q=-dx*np.sin(OT)+dy*np.cos(OT)
    f=np.hypot(u/OA,q/OB)-1; s=np.where(np.diff(np.sign(f)))[0]
    if len(s)==0: return None
    return ys[s].max() if front else ys[s].min()
def runs(x,y0,y1,t=140):
    col=L[y0:y1,x]; r=[];s=None
    for i,v in enumerate(col):
        if v>t and s is None: s=i
        if v<=t and s is not None: r.append(y0+(s+i-1)/2); s=None
    return r
def track(xs,y0,y1,start,exclude_orbit=('front',),gate=3.0):
    pts=[];prev=start
    for x in xs:
        cand=runs(x,y0,y1)
        oys=[orbit_y(x,f=='front') for f in exclude_orbit]
        if any(o is not None and abs(o-prev)<3.5 for o in oys): continue  # orbit too close: ambiguous column
        cand=[c for c in cand if all(o is None or abs(c-o)>2.2 for o in oys)]
        if not cand: continue
        c=min(cand,key=lambda c:abs(c-prev))
        if abs(c-prev)<=gate: pts.append((x,c)); prev=c
    return pts
xs_l=list(range(568,646)); xs_r=list(range(770,694,-1))
dome=track(xs_l,204,262,253,('back',))+[(x,y) for x,y in track(xs_r,198,262,256,('back',))][::-1]
# dome top: ding's top edge, columns 646..694
top=[(x,min(runs(x,204,214))) for x in range(646,695) if runs(x,204,214)]
rim=track(range(570,768),255,282,263)
shell=track(range(600,665),268,296,275.5)+track(range(762,679,-1),258,296,264.5)[::-1]
json.dump({"dome":dome,"dome_top":top,"rim_front":rim,"bottom_shell":shell},open('centrelines.json','w'))
for k,v in (("dome",dome),("rim_front",rim),("bottom_shell",shell),("top",top)):
    print(k,len(v),v[:3],'...',v[-3:])
