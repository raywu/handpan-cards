import sys
from PIL import Image, ImageDraw, ImageEnhance
import os
REPO = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", ".."))
B=os.path.join(REPO, 'docs/brand/reference/brand-board.webp')
x0,y0,x1,y1,s=[int(v) for v in sys.argv[1:6]]; out=sys.argv[6]
im=Image.open(B).convert('RGB').crop((x0,y0,x1,y1))
im=ImageEnhance.Brightness(im).enhance(1.6).resize(((x1-x0)*s,(y1-y0)*s),Image.NEAREST)
d=ImageDraw.Draw(im)
step=int(sys.argv[7]) if len(sys.argv)>7 else 10
for x in range((x0//step+1)*step,x1,step):
    d.line([((x-x0)*s,0),((x-x0)*s,im.height)],fill=(255,0,0) if x%50==0 else (90,0,0),width=1)
    if x%50==0: d.text(((x-x0)*s+2,2),str(x),fill=(255,80,80))
for y in range((y0//step+1)*step,y1,step):
    d.line([(0,(y-y0)*s),(im.width,(y-y0)*s)],fill=(255,0,0) if y%50==0 else (90,0,0),width=1)
    if y%50==0: d.text((2,(y-y0)*s+2),str(y),fill=(255,80,80))
im.save(out)
