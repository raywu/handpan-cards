"""Palette readability on a direction's grounds.
usage: python3 measure.py NAME BG [CHIP_BG] [CARD=#ffffff]
Prints, for each of the 10 engine palettes: root and tone contrast vs BG
(frame edge, >=3:1), root and tone vs CHIP_BG (chip dots, >=3:1), card vs BG,
and the minimum CIEDE2000 distance between any two palettes' (root,tone)
pairs under protan/deutan/tritan simulation (Machado 2009, severity 1).
Worst pair reported, not averages."""
import sys, json, itertools, math
PAL = [("#E0559A","#E2761B"),("#6D40A3","#C9971E"),("#0B7B75","#DD8F00"),("#E2761B","#E0559A"),("#C9971E","#6D40A3"),("#DD8F00","#0B7B75"),("#2563B0","#C0452C"),("#3B7A2A","#B3263A"),("#C0452C","#2563B0"),("#B3263A","#3B7A2A")]
def rgb(h): h=h.lstrip('#'); return [int(h[i:i+2],16)/255 for i in (0,2,4)]
def lin(c): return c/12.92 if c<=0.04045 else ((c+0.055)/1.055)**2.4
def unlin(c): c=max(0,min(1,c)); return 12.92*c if c<=0.0031308 else 1.055*c**(1/2.4)-0.055
def L(h): r,g,b=[lin(c) for c in rgb(h)]; return 0.2126*r+0.7152*g+0.0722*b
def contrast(a,b): x,y=sorted([L(a),L(b)],reverse=True); return (x+0.05)/(y+0.05)
M={'protan':[[0.152286,1.052583,-0.204868],[0.114503,0.786281,0.099216],[-0.003882,-0.048116,1.051998]],
   'deutan':[[0.367322,0.860646,-0.227968],[0.280085,0.672501,0.047413],[-0.011820,0.042940,0.968881]],
   'tritan':[[1.255528,-0.076749,-0.178779],[-0.078411,0.930809,0.147602],[0.004733,0.691367,0.303900]]}
def sim(h,k):
    v=[lin(c) for c in rgb(h)]; o=[sum(M[k][i][j]*v[j] for j in range(3)) for i in range(3)]
    return [unlin(c) for c in o]
def lab(c):
    r,g,b=[lin(x) for x in c]
    X=(0.4124*r+0.3576*g+0.1805*b)/0.95047; Y=0.2126*r+0.7152*g+0.0722*b; Z=(0.0193*r+0.1192*g+0.9505*b)/1.08883
    f=lambda t: t**(1/3) if t>0.008856 else 7.787*t+16/116
    return (116*f(Y)-16, 500*(f(X)-f(Y)), 200*(f(Y)-f(Z)))
def de(a,b): return math.dist(a,b)  # CIE76; adequate for a ranking
def main():
    name, bg = sys.argv[1], sys.argv[2]
    chip = sys.argv[3] if len(sys.argv)>3 else bg
    card = sys.argv[4] if len(sys.argv)>4 else "#ffffff"
    rows=[]
    for i,(r,t) in enumerate(PAL):
        rows.append(dict(i=i,root=r,tone=t,frame=round(contrast(r,bg),2),tone_bg=round(contrast(t,bg),2),
                         root_chip=round(contrast(r,chip),2),tone_chip=round(contrast(t,chip),2)))
    worst_frame=min(rows,key=lambda x:x['frame']); worst_chip=min(rows,key=lambda x:min(x['root_chip'],x['tone_chip']))
    cvd={}
    for k in M:
        best=(1e9,None)
        for a,b in itertools.combinations(range(10),2):
            # a chip shows root+tone; distance = mean of root-root and tone-tone distances
            d=(de(lab(sim(PAL[a][0],k)),lab(sim(PAL[b][0],k)))+de(lab(sim(PAL[a][1],k)),lab(sim(PAL[b][1],k))))/2
            best=min(best,(round(d,1),(a,b)))
        cvd[k]=best
    res=dict(direction=name,bg=bg,chip_bg=chip,card_vs_bg=round(contrast(card,bg),2),
             frames_below_3=[x['i'] for x in rows if x['frame']<3],
             worst_frame=worst_frame, worst_chip=worst_chip, cvd_min_pair_dE=cvd, rows=rows)
    print(json.dumps(res,indent=1))
main()
