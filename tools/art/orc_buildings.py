#!/usr/bin/env python3
"""Build the full hand-crafted orc building set (Approach B) — bone walls +
red roofs + orc accents (skull/horns/totem/banner/tusks/smoke)."""
import sys, math, os
import os as _os
sys.path.insert(0, _os.path.dirname(_os.path.abspath(__file__)))
import puny_faction_art as pfa
from PIL import Image, ImageDraw

def P(d, x, y, c): d.point((int(x), int(y)), fill=c)
bone=(232,226,200); bhi=(248,244,224); bdk=(120,110,86); blk=(18,15,13)
wood=(86,56,30); woodd=(54,34,16); woodh=(124,84,44)
red=(168,38,30); redd=(104,20,16); redh=(206,70,52); feather=(212,170,60)
smoke=(150,150,150)

def base(etype, span, w, h):
    im = pfa.make_building('orc', '', span) if False else None
    # fetch by label lookup
    for lbl, et, sp in pfa.BUILDINGS:
        if et == etype: im = pfa.make_building('orc', lbl, sp); break
    return im.resize((w, h), Image.NEAREST)

def horn(d, x0, y0, x1, y1, side, w0=2):           # short, mostly-upward horn
    n=18
    for i in range(n+1):
        t=i/n; x=x0+(x1-x0)*t+(3*side)*math.sin(math.pi*t); y=y0+(y1-y0)*t
        w=max(0,w0-int((w0+0.3)*t))
        for ox in range(-w,w+1):
            for oy in range(-w,w+1):
                if ox*ox+oy*oy<=w*w: P(d,x+ox,y+oy,bone)
        P(d,x-1,y,bhi)

def skull(d, cx, cy, big=False):
    sk=[(-2,0),(-1,0),(0,0),(1,0),(-2,1),(-1,1),(0,1),(1,1),(-2,2),(0,2),(-1,3),(0,3)]
    if big: sk=[(-3,0),(-2,0),(-1,0),(0,0),(1,0),(2,0),(-3,1),(-2,1),(-1,1),(0,1),(1,1),(2,1),(-3,2),(-1,2),(0,2),(2,2),(-2,3),(-1,3),(0,3),(1,3)]
    for (dx,dy) in sk: P(d,cx+dx,cy+dy,bone)
    eyes=[(-2,1),(0,1)] if not big else [(-3,1),(2,1)]
    for (dx,dy) in eyes: P(d,cx+dx,cy+dy,blk)

def banner(d, bx, top, ln=12):
    for y in range(top, top+ln):
        for x in range(bx, bx+3): P(d,x,y,red if x>bx else redd)
        P(d,bx+1,y,redh if y%3 else red)
    P(d,bx+1,top+ln,redd)

def totem(d, tx, top, bot):
    for y in range(top+5, bot): P(d,tx,y,woodd); P(d,tx+1,y,wood); P(d,tx-1,y,woodh)
    skull(d, tx, top, False)
    horn(d,tx-2,top+1,tx-4,top-3,-1,1); horn(d,tx+2,top+1,tx+4,top-3,1,1)
    for i in range(3): P(d,tx,top-2-i, feather if i<2 else red)

def thatch(d, cx, ridge, halfbase, depth):         # red peaked roof
    rth=(202,58,38); rthd=(150,42,28); rthh=(234,112,70); rthtop=(120,34,22)
    for j in range(depth):
        y=ridge+j; half=int(j*(halfbase/depth))+2
        for x in range(cx-half,cx+half+1):
            c=rthh if x<cx-half+3 else (rthd if x>cx+half-3 else rth)
            if j%3==0 and c==rth: c=rthtop
            P(d,x,y,c)
    for x in range(cx-2,cx+3): P(d,x,ridge-1,woodd)

def frame(cv,d,x0,x1,top,bot):                     # wood corner logs + lashing
    for px in (x0,x1):
        for y in range(top,bot): P(d,px,y,woodd); P(d,px+1,y,wood); P(d,px-1,y,woodh)
    ly=top+(bot-top)//2
    for x in range(x0,x1+2): P(d,x,ly,wood if x%2 else woodd); P(d,x,ly-1,woodh)

g=(120,150,70)
def cell(CW,CH):
    return Image.new('RGBA',(CW,CH),(0,0,0,0))

_ROOT=_os.path.dirname(_os.path.dirname(_os.path.dirname(_os.path.abspath(__file__))))
out_assets=_os.path.join(_ROOT,'assets/buildings')
built={}

# ---- Great Hall (core) ----
def great_hall():
    CW,CH=68,68; cv=cell(CW,CH); d=ImageDraw.Draw(cv); cx=CW//2
    cv.alpha_composite(base('core',None,42,42),(cx-21,CH-44))
    ky=CH-44
    frame(cv,d,cx-22,cx+21,ky+14,CH-2)
    thatch(d,cx,ky-10,24,26)
    horn(d,cx-17,ky-2,cx-21,ky-12,-1,2); horn(d,cx+17,ky-2,cx+21,ky-12,1,2)
    skull(d,cx,ky-6,True)
    return cv

# ---- Barracks (foundry): wide weapon-lodge ----
def barracks():
    CW,CH=64,56; cv=cell(CW,CH); d=ImageDraw.Draw(cv); cx=CW//2
    cv.alpha_composite(base('foundry',None,44,40),(cx-22,CH-42))
    ky=CH-42
    thatch(d,cx,ky-6,26,18)
    skull(d,cx,ky-2,False)
    # bone spikes along the eaves
    for sx in (cx-20,cx-12,cx+12,cx+20):
        for i in range(4): P(d,sx,ky-1-i, bone if i<3 else bdk)
    return cv

# ---- War Forge (forge): hut + smoking chimney + ember glow ----
def war_forge():
    CW,CH=54,62; cv=cell(CW,CH); d=ImageDraw.Draw(cv); cx=CW//2
    cv.alpha_composite(base('forge',None,30,46),(cx-15,CH-48))
    ky=CH-48
    thatch(d,cx,ky-4,17,16)
    # chimney + smoke
    for y in range(ky-12,ky+2):
        for x in range(cx+8,cx+12): P(d,x,y,(70,64,58) if x<cx+11 else (44,40,36))
    for i,(sx,sy) in enumerate([(cx+10,ky-14),(cx+9,ky-18),(cx+11,ky-21),(cx+10,ky-24)]):
        r=1+i//2
        for ox in range(-r,r+1):
            for oy in range(-r,r+1):
                if ox*ox+oy*oy<=r*r: P(d,sx+ox,sy+oy,(160-i*8,160-i*8,160-i*8))
    skull(d,cx,ky,False)
    return cv

# ---- Burrow (conduit/pen): small low domed hut ----
def burrow():
    CW,CH=46,42; cv=cell(CW,CH); d=ImageDraw.Draw(cv); cx=CW//2
    cv.alpha_composite(base('conduit',None,28,28),(cx-14,CH-30))
    ky=CH-30
    thatch(d,cx,ky-6,15,14)
    horn(d,cx-11,ky-3,cx-14,ky-9,-1,1); horn(d,cx+11,ky-3,cx+14,ky-9,1,1)
    skull(d,cx,ky-3,False)
    return cv

# ---- Bone Spire (turret): tall pole watch-spire + skull + red awning ----
def spire():
    CW,CH=40,68; cv=cell(CW,CH); d=ImageDraw.Draw(cv); cx=CW//2
    cv.alpha_composite(base('turret',None,18,46),(cx-9,CH-48))
    thatch(d,cx,6,12,12)             # red awning top
    skull(d,cx,16,False)
    horn(d,cx-6,8,cx-9,2,-1,1); horn(d,cx+6,8,cx+9,2,1,1)
    # bone ribs up the pole
    for y in range(34,CH-6,5):
        P(d,cx-7,y,bone); P(d,cx+7,y,bone)
    return cv

# ---- Outpost: small tusked tent ----
def outpost():
    CW,CH=46,50; cv=cell(CW,CH); d=ImageDraw.Draw(cv); cx=CW//2
    cv.alpha_composite(base('outpost',None,26,38),(cx-13,CH-40))
    ky=CH-40
    thatch(d,cx,ky-4,14,14)
    # big mammoth tusks framing the entrance
    horn(d,cx-9,CH-6,cx-15,CH-18,-1,2); horn(d,cx+9,CH-6,cx+15,CH-18,1,2)
    skull(d,cx,ky-1,False)
    return cv

builders={'core':great_hall,'foundry':barracks,'forge':war_forge,'conduit':burrow,'turret':spire,'outpost':outpost}
for et,fn in builders.items():
    im=fn(); built[et]=im; im.save(os.path.join(out_assets,f'cinder_{et}.png'))
print('built+saved', list(built.keys()))

# preview sheet on grass
SP=_os.path.join(_ROOT,'docs/art')
Z=8; pad=14; names=[('core','Great Hall'),('foundry','Barracks'),('forge','War Forge'),('conduit','Burrow'),('turret','Bone Spire'),('outpost','Outpost')]
maxh=max(built[e].height for e,_ in names)
cw=max(built[e].width for e,_ in names)*Z+pad
out=Image.new('RGB',(cw*len(names), maxh*Z+30),(20,24,30)); dd=ImageDraw.Draw(out)
gt=pfa.tile(1,1).resize((16*Z,16*Z),Image.NEAREST).convert('RGB')
for i,(et,nm) in enumerate(names):
    x0=i*cw
    for yy in range(24,out.height,16*Z):
        for xx in range(x0,x0+cw,16*Z): out.paste(gt,(xx,yy))
    im=built[et]; big=im.resize((im.width*Z,im.height*Z),Image.NEAREST)
    out.paste(big,(x0+(cw-big.width)//2, 24+(maxh*Z-big.height)),big)
    dd.text((x0+6,6),nm,fill=(255,235,210))
out.save(_os.path.join(SP,'orc_set.png')); print('saved preview', out.size)
