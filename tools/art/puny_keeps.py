#!/usr/bin/env python3
"""Extravagant faction keeps — grow race-structure into the surrounding space."""
from PIL import Image, ImageDraw
import math

import os; ts = Image.open(os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),'assets/tilesets/puny-world/punyworld-overworld-tileset.png')).convert('RGBA')
T = 16
def tile(c, r): return ts.crop((c*T, r*T, c*T+T, r*T+T))
def block(c0, r0, w, h):
    img = Image.new('RGBA', (w*T, h*T), (0,0,0,0))
    for dy in range(h):
        for dx in range(w):
            img.alpha_composite(tile(c0+dx, r0+dy), (dx*T, dy*T))
    return img
def lerp(a,b,t): return tuple(int(a[i]+(b[i]-a[i])*t) for i in range(3))
def ramp3(lo,mid,hi,t): return lerp(lo,mid,t*2) if t<0.5 else lerp(mid,hi,(t-0.5)*2)
def L_of(r,g,b): return 0.299*r+0.587*g+0.114*b
def sat_of(r,g,b):
    mx,mn=max(r,g,b),min(r,g,b); return 0 if mx==0 else (mx-mn)/mx

WOOD=((58,36,18),(120,80,42),(182,134,82)); GREEN=((26,70,34),(58,120,60),(120,176,98))
BONE=((96,86,66),(186,176,150),(240,236,216)); RED=((70,20,18),(150,40,34),(214,84,60))
BLUEW=((40,52,78),(118,138,176),(214,226,244)); BLUER=((26,52,120),(60,120,200),(150,195,240))

def reskin(img, faction):
    px=img.load(); H=img.height
    for y in range(H):
        for x in range(img.width):
            r,g,b,a=px[x,y]
            if a==0: continue
            s=sat_of(r,g,b); L=L_of(r,g,b); t=max(0.,min(1.,(L-30)/185.))
            stone=s<0.32 and L>16; warm=s>=0.32 and r>=g and r>=b; c=None
            if faction=='human':
                c=ramp3(*BLUEW,t) if stone else (ramp3(*BLUER,t) if warm else None)
            elif faction=='elf':
                if stone: c=ramp3(*WOOD,t)
                elif warm: c=ramp3(*GREEN,t) if y<0.45*H else ramp3(*WOOD,t)
            elif faction=='orc':
                c=ramp3(*BONE,t) if stone else (ramp3(*RED,t) if warm else None)
            if c: px[x,y]=(c[0],c[1],c[2],a)
    return img

def P(d,x,y,c,a=255): d.point((x,y),fill=(c[0],c[1],c[2],a))

CW,CH=112,104                 # canvas; keep (32x64) placed at kx,ky
kx,ky=40,36

def base_keep(faction):
    k=block(12,26,2,4); reskin(k,faction); return k

def elf():
    cv=Image.new('RGBA',(CW,CH),(0,0,0,0))
    canopy=block(0,7,4,2).resize((96,44),Image.NEAREST)     # dense pines behind/above
    cv.alpha_composite(canopy,(8,0))
    for tx in (kx-28,kx+24):                                 # flanking trees hugging the keep
        tr=tile(9,7).resize((30,40),Image.NEAREST); cv.alpha_composite(tr,(tx,46))
    k=base_keep('elf')
    d=ImageDraw.Draw(k); vine=(54,120,60); vhi=(104,176,96)
    for x in (2,3,28,29):
        for y in range(2,12):
            if (x+y)%2==0: P(d,x,y,vine); P(d,x,y+1,vhi)
    cv.alpha_composite(k,(kx,ky))
    for bx in (kx-6,kx+24):                                  # root bushes at base
        cv.alpha_composite(tile(0,26).resize((16,16),Image.NEAREST),(bx,CH-20))
    return cv

def orc():
    cv=Image.new('RGBA',(CW,CH),(0,0,0,0))
    d=ImageDraw.Draw(cv); bone=(232,226,200); bhi=(248,244,224); bdk=(120,110,86); blk=(18,15,13)
    # short, thick curved bone horns hugging the keep sides (base -> up & inward)
    def tusk(x0,y0,x1,y1,bend,side):
        pts=[]
        for i in range(41):
            t=i/40; x=x0+(x1-x0)*t + bend*math.sin(math.pi*t)*side
            y=y0+(y1-y0)*t; pts.append((x,y))
        for i,(x,y) in enumerate(pts):
            w=4-int(3*i/40)                                  # thick base, tapers to a point
            for ox in range(-w,w+1):
                for oy in range(-w,w+1):
                    if ox*ox+oy*oy<=w*w: P(d,int(x+ox),int(y+oy),bdk if ox>=w-1 else bone)
            P(d,int(x-1),int(y),bhi)
    tusk(kx-8,ky+58, kx+2,ky-6, 12,1); tusk(kx+40,ky+58, kx+30,ky-6, 12,-1)
    k=base_keep('orc')
    dk=ImageDraw.Draw(k)
    for sx in range(1,31,3):
        P(dk,sx,3,bdk)
        for i,y in enumerate(range(2,-1,-1)): P(dk,sx,y,bone if i<2 else bdk)
    cx=16; sk=[(cx-2,21),(cx-1,21),(cx,21),(cx+1,21),(cx-2,22),(cx-1,22),(cx,22),(cx+1,22),
               (cx-2,23),(cx,23),(cx-1,24),(cx,24)]
    for (x,y) in sk: P(dk,x,y,bone)
    for (x,y) in [(cx-2,22),(cx,22)]: P(dk,x,y,blk)
    cv.alpha_composite(k,(kx,ky))
    # skull totem on a pole, top centre
    tcx=CW//2
    for y in range(6,18): P(d,tcx,y,bdk)
    for (dx,dy) in [(-2,0),(-1,0),(0,0),(1,0),(-2,1),(-1,1),(0,1),(1,1),(-2,2),(0,2),(-1,3),(0,3)]:
        P(d,tcx+dx-1,2+dy,bone)
    for (dx,dy) in [(-2,1),(0,1)]: P(d,tcx+dx-1,2+dy,blk)
    return cv

def human():
    cv=Image.new('RGBA',(CW,CH),(0,0,0,0))
    d=ImageDraw.Draw(cv)
    # thick stone buttress columns flanking the keep (lit left, shaded right)
    def buttress(x):
        W=10
        for y in range(34,CH-2):
            for w in range(W):
                base=210-abs(w-3) * 10
                if w>=W-2: base-=70          # shaded right face
                if (y//3)%2==0 and 1<=w<=W-2: base-=18   # block courses
                P(d,x+w,y,(int(base*0.80),int(base*0.88),min(255,int(base*1.04))))
        for mx in (0,4,8):               # battlement merlons on top
            for w in range(2):
                for yy in range(28,34): P(d,x+mx+w,yy,(150,165,198))
    buttress(14); buttress(CW-26)
    k=base_keep('human'); dk=ImageDraw.Draw(k)
    pole=(60,52,44); bl=(45,118,210); hi=(110,175,240)
    for bx in (3,27):
        for y in range(0,6): P(dk,bx,y,pole)
        for y,w in [(1,4),(2,3),(3,2)]:
            for x in range(bx+1,bx+1+w): P(dk,x,y,bl)
        P(dk,bx+1,1,hi)
    for (x,y) in [(15,23),(16,23),(15,24),(16,24)]: P(dk,x,y,(235,205,90))
    cv.alpha_composite(k,(kx,ky))
    for (bx,by) in [(6,CH-26),(CW-26,CH-26),(kx+2,CH-16)]:    # boulders at base
        cv.alpha_composite(tile(0,5).resize((20,20),Image.NEAREST),(bx,by))
    return cv

Z=7; g=(96,118,58)
items=[('HUMAN — stone',human()),('ELF — tree',elf()),('ORC — bone',orc())]
cellW=CW*Z+30
out=Image.new('RGB',(cellW*3, CH*Z+44),g); dd=ImageDraw.Draw(out)
for i,(name,im) in enumerate(items):
    big=im.resize((im.width*Z,im.height*Z),Image.NEAREST)
    out.paste(big,(i*cellW+15,36),big); dd.text((i*cellW+16,12),name,fill=(245,245,235))
out.save(os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),'docs/art/faction_keeps.png'))
print('saved',out.size)
