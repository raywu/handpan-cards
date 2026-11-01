import sys,colorsys
sys.argv=['x','x','#000000']
src=open('measure.py').read().replace('\nmain()\n','\n')
exec(src)
roots=[p[0] for p in PAL]
for r in roots: print(r, round(L(r),3))
res=[]
for v in range(0,256,1):
  for (dr,dg,db) in [(0,0,0),(6,3,-6),(10,5,-10),(4,2,-4)]:
    c='#%02x%02x%02x'%tuple(max(0,min(255,v+d)) for d in (dr,dg,db))
    fr=[contrast(r,c) for r in roots]
    res.append((min(fr),contrast('#ffffff',c),c,sum(f<3 for f in fr)))
best=max(res); print('best single ground (min frame, card, bg, n<3):',best)
for t in sorted(res,reverse=True)[:5]: print([round(x,2) if isinstance(x,float) else x for x in t])
# trade-off table for warm tint
print('\nwarm ground sweep: bg, min frame, worst root, #<3, card-vs-bg')
for v in list(range(0x0f,0x60,8))+list(range(0x60,0x100,16)):
  c='#%02x%02x%02x'%(min(255,v+6),min(255,v+3),max(0,v-6))
  fr=[(contrast(r,c),r) for r in roots]
  print(c, round(min(fr)[0],2), min(fr)[1], sum(f<3 for f,_ in fr), round(contrast('#ffffff',c),2))
# what dark grounds pass for dark-root palettes and light for light roots
dark=[r for r in roots if L(r)<0.15]; light=[r for r in roots if L(r)>=0.15]
print('dark roots',dark,'light roots',light)
