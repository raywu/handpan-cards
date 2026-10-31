import numpy as np
from PIL import Image
import os
REPO = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", ".."))
B=os.path.join(REPO, 'docs/brand/reference/brand-board.webp')
a=np.asarray(Image.open(B).convert('RGB')).astype(float)
yy,xx=np.mgrid[0:a.shape[0],0:a.shape[1]]
R,G,Bl=a[...,0],a[...,1],a[...,2]
teal=(Bl-R>25)&(G-R>25)&(G>70)&(np.hypot(xx-560,yy-301)>16)
warm=(R-Bl>18)&(R>60)&(R<235)&(xx>700)&(xx<830)&(yy>262)&(yy<345)
def near(m,c,r,t=1.6):
    d=np.abs(np.hypot(xx-c[0],yy-c[1])-r); s=m&(d<t); return np.column_stack([xx[s],yy[s]]).astype(float)
def fit(P):
    x,y=P[:,0],P[:,1]; D=np.column_stack([x*x,x*y,y*y,x,y,np.ones_like(x)])
    _,_,V=np.linalg.svd(D); A,Bc,C,Dd,E,F=V[-1]
    M=np.array([[A,Bc/2],[Bc/2,C]]); c=np.linalg.solve(2*M,[-Dd,-E])
    k=-(F+Dd*c[0]/2+E*c[1]/2); w,v=np.linalg.eigh(M/k)
    ax=1/np.sqrt(w); ang=np.degrees(np.arctan2(v[1,0],v[0,0]))
    return c,ax,ang
for name,t,w in (("inner",(669.5,256.3,82.6),(677.0,245.5,90.1)),("middle",(668.8,256.1,100.3),(677.6,245.1,107.5))):
    P=np.vstack([near(teal,t[:2],t[2]),near(warm,w[:2],w[2])])
    c,ax,ang=fit(P); print(name,len(P),'centre',c.round(1),'semi-axes',ax.round(1),'axis angle',round(ang,1))
    Pt=near(teal,t[:2],t[2]); Pw=near(warm,w[:2],w[2])
    print('  teal arc angles(y-up)',np.degrees(np.arctan2(-(Pt[:,1]-c[1]),Pt[:,0]-c[0])).round().astype(int).min(),'..', 'warm arc angles', np.percentile(np.degrees(np.arctan2(-(Pw[:,1]-c[1]),Pw[:,0]-c[0])),[5,95]).round())
