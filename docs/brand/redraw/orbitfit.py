import numpy as np
P=np.array([(547.4,295),(546.8,286),(550.5,277.5),(556.8,269.4),(564,262.5),(559.9,301.3),(569,301.5),(608,300.5),(625,296.3),(675,287.5),
(731.7,271.7),(753.3,260),(766.7,251.7),(780,241.7),(791.7,231.7),(797.5,221.7),(798.3,213.3),(793.3,205.8),(783.3,201.7),
(773.3,200.8),(756.7,201.7),(740,204),(723.3,207.5),(711.7,211.7)])
x,y=P[:,0],P[:,1]; D=np.column_stack([x*x,x*y,y*y,x,y,np.ones_like(x)])
_,_,V=np.linalg.svd(D); A,Bc,C,Dd,E,F=V[-1]
M=np.array([[A,Bc/2],[Bc/2,C]]); c=np.linalg.solve(2*M,[-Dd,-E])
k=-(F+Dd*c[0]/2+E*c[1]/2); w,v=np.linalg.eigh(M/k); ax=1/np.sqrt(w)
i=np.argmax(ax); ang=np.degrees(np.arctan2(v[1,i],v[0,i]))
print('centre',c.round(1),'semi-major',ax[i].round(1),'semi-minor',ax[1-i].round(1),'major-axis angle (y-down deg)',round(ang,1))
# residuals
th=np.radians(ang); 
def res(p):
    d=p-c; u=d[:,0]*np.cos(th)+d[:,1]*np.sin(th); q=-d[:,0]*np.sin(th)+d[:,1]*np.cos(th)
    return np.sqrt((u/ax[i])**2+(q/ax[1-i])**2)
r=res(P); print('normalised radius per point (1=on ellipse)',np.round(r,3))
