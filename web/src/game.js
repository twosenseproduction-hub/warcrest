
// ---------- palette (sampled to match Thronefall reference) ----------
const C = {
  // Verath is the ashen basin left by the Ashfall — the old "snow" terrain reskinned to warm ash-grey.
  grass:      0x8a847a, grass2: 0x736c60, grass3: 0xd7cfc2,   // ashen ground (dominant), scorched earth, pale ash drift
  snowLo:     0x605a52, snowTan: 0x8a8270,                     // dark cinder-stone / dry ash (lichen tan)
  beach:      0x998f83,                                        // ash-wet stone shore
  path:       0xb0a89c,                                        // trodden ash road
  cliffLit:   0xd6cec1, cliffShade: 0x24506a, cliffMid: 0x79736a,   // ash lip / cold deep water / grey rock
  water:      0x2f93d6, shallow: 0x66c0ee,                     // sea / shoreline shallows
  treeY:      [0xd9d43a, 0xccc636, 0xe2dc4c, 0xc2be34],
  wood:       0xd98a3a, woodDark: 0xb56b28, cream: 0xece0c0, roof: 0xc25a34,
  stone:      0xe7ddc4, stoneShade: 0xcdbf9c,
  rock:       0x8f9aa0,
  teamBlue:   0x3f74c4, teamBlueD: 0x2b57a0, hero: 0x9a5bd6, skin: 0xe0b088, cleric: 0xe9e2c2,
  enemyRed:   0xc23b3b,
  outline:    0x2a2018,
};

// ---------- value noise (deterministic) ----------
function frac(v){return v-Math.floor(v);}
function hash2(x,y){return frac(Math.sin(x*127.1+y*311.7)*43758.5453);}
function vnoise(x,y){
  const xi=Math.floor(x),yi=Math.floor(y),xf=x-xi,yf=y-yi;
  const u=xf*xf*(3-2*xf),v=yf*yf*(3-2*yf);
  const a=hash2(xi,yi),b=hash2(xi+1,yi),c=hash2(xi,yi+1),d=hash2(xi+1,yi+1);
  return a+(b-a)*u+(c-a)*v+(a-b-c+d)*u*v;
}
function fbm(x,y){return 0.6*vnoise(x,y)+0.3*vnoise(x*2.1,y*2.1)+0.1*vnoise(x*4.3,y*4.3);}
// seeded rng for scatter
let _s=12345; function rnd(){_s=(_s*1664525+1013904223)&0x7fffffff;return _s/0x7fffffff;}
function rr(a,b){return a+(b-a)*rnd();}

// ---------- scene ----------
let scene,cam,rnd3d,sunLight=null;
let waterMat=null, motes=null, waterT=0;   // animated sea + drifting ash motes (atmosphere)
function updateAtmos(dt){
  if(waterMat){ waterT+=dt; waterMat.uniforms.uTime.value=waterT; }
  if(motes){ const a=motes.geometry.attributes.position, cx=(typeof camAim!=='undefined'?camAim.x:0), cz=(typeof camAim!=='undefined'?camAim.z:0);
    for(let i=0;i<a.count;i++){ let x=a.getX(i)+dt*2.4, y=a.getY(i)-dt*1.5, z=a.getZ(i)+dt*0.7;
      if(y<1.5) y=60;
      if(x-cx>210)x-=420; else if(x-cx<-210)x+=420;
      if(z-cz>210)z-=420; else if(z-cz<-210)z+=420;
      a.setXYZ(i,x,y,z); }
    a.needsUpdate=true; } }
// Terraformed single landmass (snow): one big rounded-square landform with interior seas
// CARVED out of it. Screen mapping: -x is right, -z is up, so world (+,+) reads bottom-left and
// (-,-) reads top-right — the two bases sit on the main diagonal, land bridged between them.
const WORLD=180;                    // half-extent of the square landmass
const SEA_Y=-16, COAST_Y=-1.0;      // sea level / coastline lip
// interior seas gouged out of the land — placed off the BL↔TR diagonal so the diagonal stays a
// continuous land isthmus (units path straight, so the bases must connect over land).
// map layout is data-driven per level (see LEVELS / applyLevel). These `let`s hold the ACTIVE map;
// the skirmish default below is also LEVELS.skirmish. Changing them + re-running build() swaps maps.
let SEAS=[
  {cx:80, cz:-82, r:60},   // large sea in the upper flank
  {cx:-80,cz:82,  r:60},   // large sea in the lower flank
  {cx:22, cz:-30, r:24},   // small central inlet biting toward the middle
  {cx:-22,cz:30,  r:24},
];
const sun=new THREE.Vector3(-0.55,0.75,0.38).normalize();

// land field: >0 = land (value ~ height above sea), <=0 = water. One big landmass minus the seas.
let MAPSHAPE='island', ROAD_W=32, ARENA_R=72;   // per-level terrain silhouette (set by applyLevel)
// 'arena' shape: a round island centered at origin — a defensible ground for hold-the-line missions.
function arenaField(x,z){ let m=1 - Math.hypot(x,z)/ARENA_R; m+=0.12*(fbm(x*0.03+4,z*0.03+8)-0.5)*2; return m; }
// 'road' shape: land is a winding corridor hugging the level's PATH (+ round pads at the bases),
// water everywhere else — a survey road over a frozen sea. Reads nothing like the skirmish square.
function roadField(x,z){ let m=1 - pathDist(x,z)/ROAD_W;
  for(const f of FLATS){ const dd=Math.hypot(x-f.x,z-f.z); m=Math.max(m, 1 - dd/(f.r*0.95)); }   // widen into base plateaus
  m += 0.13*(fbm(x*0.03+2,z*0.03+5)-0.5)*2;                                                       // ragged banks
  return m; }
function landField(x,z){
  if(MAPSHAPE==='road') return roadField(x,z);
  if(MAPSHAPE==='arena') return arenaField(x,z);
  const sq=Math.max(Math.abs(x),Math.abs(z))/WORLD;                 // 0 centre → 1 at square rim
  let m=(1-sq) + 0.11*(fbm(x*0.012+3,z*0.012+7)-0.5)*2;             // rounded square, wavy coast
  for(const s of SEAS){ const d=Math.hypot(x-s.cx,z-s.cz);
    const er=s.r*(1+0.16*(fbm(x*0.05+s.cx,z*0.05+s.cz)-0.5)*2);     // ragged shoreline on each sea
    if(d<er) m=Math.min(m, (d/er)-0.9); }                           // inside a sea → drive negative
  return m;
}
function onIsland(x,z){ return landField(x,z)>0.02; }
const smooth=t=>{ t=Math.max(0,Math.min(1,t)); return t*t*(3-2*t); };
// level building plateaus under each base so structures + plots sit flat (playable footing)
let FLATS=[{x:105,z:108,r:50,y:0.4},{x:-105,z:-108,r:50,y:0.4}];   // base plateaus sized for the full tier-3 expansion footprint
function landH(x,z){
  let h=2.0*(fbm(x*0.02+5,z*0.02+9)-0.5) + 1.0*(fbm(x*0.06,z*0.06)-0.5);   // rolling snow
  for(const f of FLATS){ const t=smooth(Math.hypot(x-f.x,z-f.z)/f.r); h=f.y*(1-t)+h*t; }   // flatten base plateaus
  const lf=landField(x,z);                                                 // ease the coast down into an icy beach shelf
  if(lf<0.16){ const t=smooth(lf/0.16); h=(SEA_Y+2.2)*(1-t)+h*t; }
  return h;
}

// paths (packed snow) as polylines — the diagonal road linking the two bases
let PATHS=[
  [[105,108],[60,60],[6,6],[-52,-52],[-105,-108]],   // BL base → across the isthmus → TR base
];
function pathDist(x,z){
  let best=1e9;
  for(const p of PATHS){ for(let i=0;i<p.length-1;i++){
    const [ax,az]=p[i],[bx,bz]=p[i+1]; const dx=bx-ax,dz=bz-az;
    const t=Math.max(0,Math.min(1,((x-ax)*dx+(z-az)*dz)/(dx*dx+dz*dz+1e-6)));
    const px=ax+dx*t,pz=az+dz*t; const d=Math.hypot(x-px,z-pz); if(d<best)best=d;
  }}
  return best;
}
function topY(x,z){ return landH(x,z) - (pathDist(x,z)<7?0.5:0); }

// ---------- procedural terrain detail: a tileable ash/rock grain albedo + normal map ----------
// Generated once at load (nothing ships). The per-vertex palette (ash flats / grey rock / snow) stays
// as the colour; this layers surface grain + relief so the sun catches cracks and pebbles — the big
// "textured, painted" jump toward a Reforged look while keeping the ashen Verath palette.
let _terraTex=null;
function makeTerrainTex(){ if(_terraTex) return _terraTex;
  const S=512, per=8;
  const hash=(x,y)=>{ const n=Math.sin(x*127.1+y*311.7)*43758.5453; return n-Math.floor(n); };
  const sm=t=>t*t*(3-2*t), lerp=(a,b,t)=>a+(b-a)*t;
  function vnoise(x,y,p){ const xi=Math.floor(x),yi=Math.floor(y),xf=x-xi,yf=y-yi,u=sm(xf),v=sm(yf);
    const R=(ix,iy)=>hash(((ix%p)+p)%p,((iy%p)+p)%p);
    return lerp(lerp(R(xi,yi),R(xi+1,yi),u), lerp(R(xi,yi+1),R(xi+1,yi+1),u), v); }
  function fbm(x,y){ let a=0,amp=0.5,f=1; for(let o=0;o<4;o++){ a+=amp*vnoise(x*f,y*f,per*f); amp*=0.5; f*=2; } return a; }
  const hgt=new Float32Array(S*S);
  for(let y=0;y<S;y++)for(let x=0;x<S;x++){ const u=x/S*per, v=y/S*per;
    let h=fbm(u,v)*0.85; let c=Math.abs(fbm(u*1.8+5,v*1.8+9)-0.5); c=1-Math.min(1,c*3.4);   // ridged → carved grooves/cracks
    hgt[y*S+x]=h - c*0.28; }
  const mk=()=>{ const c=document.createElement('canvas'); c.width=c.height=S; return c; };
  const ac=mk(),nc=mk(), actx=ac.getContext('2d'), nctx=nc.getContext('2d');
  const aim=actx.createImageData(S,S), nim=nctx.createImageData(S,S);
  const H=(x,y)=>hgt[(((y%S)+S)%S)*S+(((x%S)+S)%S)], STR=2.6;
  for(let y=0;y<S;y++)for(let x=0;x<S;x++){ const i=(y*S+x)*4, h=hgt[y*S+x];
    let g=0.56+h*0.30; const sp=hash(x*3.1,y*2.7); if(sp>0.87)g*=1.10; else if(sp<0.07)g*=0.78;   // darker mid-ash so lit ground doesn't clip to white
    g=Math.max(0.28,Math.min(1,g));
    aim.data[i]=255*Math.min(1,g*1.03); aim.data[i+1]=255*g; aim.data[i+2]=255*g*0.94; aim.data[i+3]=255;   // faint warm-grey tint
    let nx=-(H(x+1,y)-H(x-1,y))*STR, ny=-(H(x,y+1)-H(x,y-1))*STR, nz=1; const inv=1/Math.hypot(nx,ny,nz);
    nim.data[i]=255*(nx*inv*0.5+0.5); nim.data[i+1]=255*(ny*inv*0.5+0.5); nim.data[i+2]=255*(nz*inv*0.5+0.5); nim.data[i+3]=255; }
  actx.putImageData(aim,0,0); nctx.putImageData(nim,0,0);
  const alb=new THREE.CanvasTexture(ac), nrm=new THREE.CanvasTexture(nc);
  for(const t of [alb,nrm]){ t.wrapS=t.wrapT=THREE.RepeatWrapping; t.anisotropy=4; }
  if('colorSpace'in alb) alb.colorSpace=THREE.SRGBColorSpace;
  _terraTex={albedo:alb, normal:nrm}; return _terraTex; }
// ---------- terrain builder: grid over the land field, coastal cliffs where land meets sea ----------
function buildTerrain(){
  const pos=[],col=[],uv=[]; const TILE=9;   // world units per texture repeat
  const nrm=new THREE.Vector3(),ab=new THREE.Vector3(),ac=new THREE.Vector3();
  const tmp=new THREE.Color();
  const bottomY=-40, edgeTopY=COAST_Y;
  function pushTri(va,vb,vc,region){
    ab.set(vb[0]-va[0],vb[1]-va[1],vb[2]-va[2]); ac.set(vc[0]-va[0],vc[1]-va[1],vc[2]-va[2]);
    nrm.crossVectors(ab,ac).normalize();
    if(region==='grass'){ if(nrm.y<0) nrm.negate(); } else { if(nrm.y>0.4){/*keep*/} }
    let hex, mul=1;
    if(region==='water'){
      hex=0x4f8fac;                                                        // cold steel-blue shallow shore shelf (ashen sea, not tropical cyan)
    } else if(region==='grass'){
      const mx=(va[0]+vb[0]+vc[0])/3, mz=(va[2]+vb[2]+vc[2])/3, avgY=(va[1]+vb[1]+vc[1])/3;
      if(pathDist(mx,mz)<6.5) hex=C.path;                                  // packed gravel road
      else if(landField(mx,mz)<0.13) hex=C.beach;                          // frost-wet stone shore
      else if(avgY<-6) hex=C.snowLo;                                       // low, shaded weathered stone near the water
      else { const n=fbm(mx*0.045,mz*0.045), n2=fbm(mx*0.09+11,mz*0.09+4); // frozen tundra: mostly stone, patches of dead grass, the odd snow drift
        hex = (n>0.72&&n2>0.6)?C.grass3 : n2>0.58?C.grass2 : n2<0.32?C.snowTan : n<0.34?C.snowLo : C.grass; }
    } else { // coastal edge: rocky cliff face above the waterline, cold-blue sea below it
      const avgY=(va[1]+vb[1]+vc[1])/3, mx=(va[0]+vb[0]+vc[0])/3, mz=(va[2]+vb[2]+vc[2])/3;
      const dep=Math.min(1,Math.max(0,(edgeTopY-avgY)/(edgeTopY-bottomY)));
      const lit=nrm.dot(sun);
      if(dep<0.42){                                                        // above water: grey rock, mottled, darker in shade
        hex = dep<0.15 ? C.cliffMid : (lit>0.0 ? C.cliffMid : 0x554d44);
        const rn=fbm(mx*0.11+7,mz*0.11+3); mul=0.78+rn*0.40;              // rock mottling
      } else {                                                             // below water = the sea: cold blue (lit shimmer vs deep)
        hex = lit>0.10 ? 0x2f6a90 : 0x1c4258;
      }
    }
    tmp.setHex(hex); if(mul!==1) tmp.multiplyScalar(mul);
    for(const P of [va,vb,vc]){ pos.push(P[0],P[1],P[2]); col.push(tmp.r,tmp.g,tmp.b);
      if(region==='cliff') uv.push((P[0]+P[2])/TILE, P[1]/TILE);   // cliffs: run horizontally, striate vertically
      else uv.push(P[0]/TILE, P[2]/TILE); }                        // flats + water shelf: top-down world UV
  }
  const STEP=5, M=WORLD+20, N=Math.ceil(2*M/STEP);
  const cellLand=(i,j)=>onIsland(-M+(i+0.5)*STEP, -M+(j+0.5)*STEP);
  const H=(x,z)=>Math.max(topY(x,z), SEA_Y+0.5);   // let the coast dip to the beach shelf, but never below sea
  const wall=(ax,az,tyA,bx,bz,tyB)=>{ const a=[ax,tyA,az],b=[bx,tyB,bz],c=[bx,bottomY,bz],d=[ax,bottomY,az];
    pushTri(a,b,c,'cliff'); pushTri(a,c,d,'cliff'); };
  const WSHELF=-14.6;   // shallow shore shelf just below the beach lip
  for(let i=0;i<N;i++) for(let j=0;j<N;j++){
    const x0=-M+i*STEP, z0=-M+j*STEP, x1=x0+STEP, z1=z0+STEP;
    if(!cellLand(i,j)){
      // shallow-water shelf: a flat shoal hugging the coast so the sea reads at every shoreline
      if(cellLand(i-1,j)||cellLand(i+1,j)||cellLand(i,j-1)||cellLand(i,j+1)||cellLand(i-1,j-1)||cellLand(i+1,j+1)||cellLand(i-1,j+1)||cellLand(i+1,j-1)){
        const a=[x0,WSHELF,z0],b=[x1,WSHELF,z0],c=[x1,WSHELF,z1],d=[x0,WSHELF,z1];
        pushTri(a,b,c,'water'); pushTri(a,c,d,'water');
      }
      continue;
    }
    const a=[x0,H(x0,z0),z0],b=[x1,H(x1,z0),z0],c=[x1,H(x1,z1),z1],d=[x0,H(x0,z1),z1];
    pushTri(a,b,c,'grass'); pushTri(a,c,d,'grass');
    if(!cellLand(i-1,j)) wall(x0,z0,H(x0,z0), x0,z1,H(x0,z1));   // west coast
    if(!cellLand(i+1,j)) wall(x1,z1,H(x1,z1), x1,z0,H(x1,z0));   // east coast
    if(!cellLand(i,j-1)) wall(x1,z0,H(x1,z0), x0,z0,H(x0,z0));   // north coast
    if(!cellLand(i,j+1)) wall(x0,z1,H(x0,z1), x1,z1,H(x1,z1));   // south coast
  }
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
  g.setAttribute('color',new THREE.Float32BufferAttribute(col,3));
  g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  g.computeVertexNormals();   // non-indexed → per-face normals (keeps the low-poly facet base); the normalMap adds surface relief on top
  const tx=makeTerrainTex();
  const m=new THREE.MeshStandardMaterial({vertexColors:true, map:tx.albedo, normalMap:tx.normal, roughness:0.97, metalness:0.0, side:THREE.DoubleSide});
  m.normalScale.set(1.4,1.4);
  const mesh=new THREE.Mesh(g,m); mesh.receiveShadow=true; mesh.castShadow=false;
  return mesh;
}

// ---------- helpers ----------
function lam(hex,flat){return new THREE.MeshLambertMaterial({color:hex,flatShading:!!flat});}
// tinted ground material with the shared terrain normal-map — gives pads/paving surface relief so they read as ground, not flat discs
function groundStd(hex,ns){ const m=new THREE.MeshStandardMaterial({color:hex, normalMap:makeTerrainTex().normal, roughness:0.93, metalness:0}); m.normalScale.set(ns||0.5,ns||0.5); return m; }
function outlineOf(mesh,scale){
  const o=new THREE.Mesh(mesh.geometry,new THREE.MeshBasicMaterial({color:C.outline,side:THREE.BackSide}));
  o.scale.multiplyScalar(scale||1.06); return o;
}
function box(w,h,d,hex,flat){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),lam(hex,flat));m.castShadow=true;m.receiveShadow=true;return m;}
function outlined(group){ // wrap: add black inverted hull for each child mesh
  const adds=[];
  group.traverse(o=>{ if(o.isMesh){ const h=new THREE.Mesh(o.geometry,new THREE.MeshBasicMaterial({color:C.outline,side:THREE.BackSide}));
    h.position.copy(o.position); h.rotation.copy(o.rotation); h.scale.copy(o.scale).multiplyScalar(1.05); adds.push([o.parent||group,h]); } });
  for(const [p,h] of adds) p.add(h);
  return group;
}

// ---------- nature pack (Quaternius CC0): real low-poly trees / rocks / bushes ----------
const NAT={tree:[], rock:[], bush:[]};
// Quaternius meshes are flat per-material colours on MeshPhong (with emissive → blows white
// under lights). Re-wrap as flat MeshLambert(diffuse) so they shade cleanly in our scene.
function natLambert(o){ o.traverse(n=>{ if(n.isMesh){ const ms=Array.isArray(n.material)?n.material:[n.material];
  const conv=m=>new THREE.MeshLambertMaterial({color:(m&&m.color)?m.color.getHex():0x88aa66});
  n.material=Array.isArray(n.material)?ms.map(conv):conv(ms[0]); n.castShadow=false; n.receiveShadow=false; } }); }   // scenery skips the shadow pass (perf) — ~1000 fewer casters
// centre on X/Z, drop base to y=0, record native height → clone + scale to a target height later
function natEntry(o){ natLambert(o); const bb=new THREE.Box3().setFromObject(o); const sz=bb.getSize(new THREE.Vector3());
  o.position.x-=(bb.min.x+sz.x/2); o.position.z-=(bb.min.z+sz.z/2); o.position.y-=bb.min.y; o.frustumCulled=false;
  const w=new THREE.Group(); w.add(o); return {scene:w, h:Math.max(0.001,sz.y)}; }
function loadNature(){ return new Promise(res=>{
  const fx=new THREE.FBXLoader();
  const sets={ tree:['PineTree_Snow_1','PineTree_Snow_2','PineTree_Snow_3','PineTree_Snow_4','PineTree_Snow_5','CommonTree_Snow_1','CommonTree_Snow_2','CommonTree_Snow_3','BirchTree_Snow_2','BirchTree_Snow_4'],
               rock:['Rock_Snow_1','Rock_Snow_2','Rock_Snow_3'], bush:['Bush_Snow_2'] };
  const jobs=[]; for(const c in sets) sets[c].forEach(nm=>jobs.push([c,nm]));
  let n=0; const done=()=>{ if(++n>=jobs.length) res(); };
  jobs.forEach(([c,nm])=>fx.load('/assets/nature/'+nm+'.fbx', o=>{ NAT[c].push(natEntry(o)); done(); }, undefined, ()=>done())); }); }
function natClone(cat, minH, maxH){ const list=NAT[cat]; if(!list.length) return null;
  const e=list[Math.floor(rnd()*list.length)]; const g=e.scene.clone(true); g.scale.setScalar((minH+rnd()*(maxH-minH))/e.h); g.rotation.y=rnd()*6.28; return g; }
// real low-poly tree (Quaternius), falling back to the procedural blob if the pack didn't load
function makeTree(){
  const t=natClone('tree',8,12); if(t) return t;
  const g=new THREE.Group();
  const blobs=4+Math.floor(rnd()*4);
  const base=2.2+rnd()*1.4;
  for(let i=0;i<blobs;i++){
    const r=base*(0.6+rnd()*0.6);
    const s=new THREE.Mesh(new THREE.IcosahedronGeometry(r,0), lam(C.treeY[Math.floor(rnd()*C.treeY.length)],true));
    s.position.set(rr(-base,base), 3.2+rr(-0.6,1.6)+i*0.3, rr(-base,base));
    s.castShadow=true; g.add(s);
  }
  const trunk=new THREE.Mesh(new THREE.CylinderGeometry(0.5,0.7,3,6),lam(C.woodDark));
  trunk.position.y=1.5; trunk.castShadow=true; g.add(trunk);
  return g;
}
function forestClump(cx,cz,n,spread){
  const grp=new THREE.Group();
  for(let i=0;i<n;i++){ const t=makeTree(); const a=rnd()*6.28, d=rnd()*spread;
    const x=cx+Math.cos(a)*d, z=cz+Math.sin(a)*d; if(!onIsland(x,z))continue;
    t.position.set(x, topY(x,z), z); grp.add(t);
  } return grp;
}

// ---------- buildings ----------
function dirtPad(x,z,r){
  const m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,0.4,14),lam(C.path));
  m.position.set(x,topY(x,z)+0.05,z); m.receiveShadow=true; return m;
}
// per-race plot themes — pads read as that faction's terrain: elf leaves, orc rock, human brick, undead bone
const PLOT_THEME={ elf:{ground:0x5f7a4c, ring:0x86ecc4, plus:0xdaffe8, decor:'leaf'},
                   orc:{ground:0x6f6153, ring:0xff8a5a, plus:0xffceb0, decor:'rock'},
                   human:{ground:0x8f887a, ring:0xffd98a, plus:0xfff0cf, decor:'brick'},
                   undead:{ground:0x9a9a86, ring:0xbf8fff, plus:0xe6d8ff, decor:'bone'} };
// scatter a ring of race-flavoured props around the pad rim so it reads as an organic terrain patch, not a disc
function padDecor(g,r,type,n){ n=n||9;
  for(let i=0;i<n;i++){ const a=i/n*6.28+rr(-0.18,0.18), rad=r*rr(0.8,1.02), px=Math.cos(a)*rad, pz=Math.sin(a)*rad; let m;
    if(type==='rock'){ m=new THREE.Mesh(new THREE.IcosahedronGeometry(rr(0.5,1.0),0),lam(0x7d756c)); m.rotation.set(rr(0,6.28),rr(0,6.28),rr(0,6.28)); m.scale.y=rr(0.6,1); m.position.set(px,0.28,pz); m.castShadow=true; }
    else if(type==='leaf'){ m=new THREE.Group(); const c=(rr(0,1)<0.5)?0x74b04a:0x93d35c; for(let k=0;k<2;k++){ const l=new THREE.Mesh(new THREE.ConeGeometry(0.3,rr(0.7,1.1),4),lam(c)); l.position.set(rr(-0.3,0.3),0.45,rr(-0.3,0.3)); l.rotation.set(rr(-0.5,0.5),rr(0,6.28),rr(-0.5,0.5)); m.add(l); } m.position.set(px,0.05,pz); }
    else if(type==='brick'){ m=new THREE.Mesh(new THREE.BoxGeometry(rr(0.7,1.1),0.5,rr(0.5,0.8)),lam(0xb06a44)); m.rotation.y=rr(0,6.28); m.position.set(px,0.28,pz); m.castShadow=true; }
    else if(type==='bone'){ m=new THREE.Group(); const b=new THREE.Mesh(new THREE.CylinderGeometry(0.1,0.1,rr(0.7,1.1),6),lam(0xe6e2d0)); b.rotation.set(0,rr(0,6.28),1.35+rr(-0.3,0.3)); m.add(b); if(rr(0,1)<0.35){ const sk=new THREE.Mesh(new THREE.SphereGeometry(0.27,8,6),lam(0xece7d5)); sk.position.set(rr(-0.2,0.2),0.22,rr(-0.2,0.2)); m.add(sk); } m.position.set(px,0.18,pz); m.castShadow=true; }
    if(m)g.add(m); } }
// organic base pad: a low domed ground disc tinted to the race + a rim of themed decor
function hexPad(x,z,r,th){ th=th||PLOT_THEME.elf; const g=new THREE.Group();
  const disc=new THREE.Mesh(new THREE.CylinderGeometry(r,r+0.35,0.5,20),groundStd(th.ground,0.5)); disc.position.y=0.05; disc.receiveShadow=true; g.add(disc);
  const dome=new THREE.Mesh(new THREE.CylinderGeometry(r*0.62,r*0.9,0.42,18),lam(th.ground)); dome.position.y=0.34; dome.receiveShadow=true; g.add(dome);
  padDecor(g,r,th.decor,10); g.position.set(x,topY(x,z)+0.02,z); return g; }
function turretPad(x,z,r,th){ th=th||PLOT_THEME.elf; const g=new THREE.Group();
  const disc=new THREE.Mesh(new THREE.CylinderGeometry(r+0.4,r+0.7,0.5,18),groundStd(th.ground,0.5)); disc.position.y=0.05; disc.receiveShadow=true; g.add(disc);
  padDecor(g,r+0.3,th.decor,7);                       // fortified spot: a couple of raised themed blocks as a footing
  for(const [dx,dz] of [[r,r],[-r,r],[r,-r],[-r,-r]]){ const p=new THREE.Mesh(new THREE.BoxGeometry(0.9,1.4,0.9),lam(th.ground)); p.position.set(dx,0.7,dz); p.castShadow=true; g.add(p); }
  g.position.set(x,topY(x,z)+0.02,z); return g; }
function courtyard(x,z,r){ const g=new THREE.Group();
  const disc=new THREE.Mesh(new THREE.CylinderGeometry(r,r,0.4,40),groundStd(0x6b6358,0.6)); disc.position.y=0.03; disc.receiveShadow=true; g.add(disc);   // darker ash paving so the lit courtyard doesn't blow out
  const rim=new THREE.Mesh(new THREE.TorusGeometry(r-0.5,0.45,8,44),lam(C.cliffMid)); rim.rotation.x=Math.PI/2; rim.position.y=0.28; g.add(rim);
  g.position.set(x,topY(x,z)+0.02,z); return g; }
function makeHouse(){
  const b=bldClone('house',9); if(b) return b;   // Bitgem elf house
  const g=new THREE.Group();
  const w=6.5,d=5,wall=4;
  g.add(box(w,wall,d,C.cream)).children[g.children.length-1].position.y=wall/2;
  const roof=new THREE.Mesh(new THREE.ConeGeometry(w*0.78,3.4,4),lam(C.roof,true));
  roof.rotation.y=Math.PI/4; roof.position.y=wall+1.5; roof.castShadow=true; g.add(roof);
  g.traverse(o=>{if(o.isMesh)o.castShadow=o.receiveShadow=true;});
  return outlined(g);
}
// ---------- Bitgem elf buildings (palette atlas, night-elf tree architecture) ----------
const BLD={};
// two Bitgem palette-atlas building sets sharing one pipeline: elf (player) + orc (enemy)
const BLD_GROUPS=[
  { tex:'/assets/models/elf_building_tex.png', files:{
      keep:'elf_throne_Lv3', house:'elf_house_Lv2', tower:'elf_tower_Lv2', mill:'elf_woodcutter_Lv2',   // legacy aliases (far-lobe scenery)
      mill1:'elf_woodcutter_Lv2', mill2:'elf_woodcutter_Lv2', mill3:'elf_woodcutter_Lv2',              // Lumber Mill (one model, scaled per tier)
      throne1:'elf_throne_Lv1', throne2:'elf_throne_Lv2', throne3:'elf_throne_Lv3',
      house1:'elf_house_Lv1',   house2:'elf_house_Lv2',   house3:'elf_house_Lv3',
      tower1:'elf_tower_Lv1',   tower2:'elf_tower_Lv2',   tower3:'elf_tower_Lv3',
      mine1:'elf_mine_Lv1',     mine2:'elf_mine_Lv2',     mine3:'elf_mine_Lv3',
      barrack1:'elf_barrack_Lv1', barrack2:'elf_barrack_Lv2', barrack3:'elf_barrack_Lv3' } },
  { tex:'/assets/models/human_building_tex.png', files:{   // Iron Crown (human) — campaign player set
      human_keep:'human_throne_Lv3', human_house:'human_house_Lv2', human_tower:'human_tower_Lv2', human_mill:'human_wood_cutter_Lv2',
      human_throne1:'human_throne_Lv1', human_throne2:'human_throne_Lv2', human_throne3:'human_throne_Lv3',
      human_house1:'human_house_Lv1',   human_house2:'human_house_Lv2',   human_house3:'human_house_Lv3',
      human_tower1:'human_tower_Lv1',   human_tower2:'human_tower_Lv2',   human_tower3:'human_tower_Lv3',
      human_mine1:'human_mine_Lv1',     human_mine2:'human_mine_Lv2',     human_mine3:'human_mine_Lv3',
      human_mill1:'human_wood_cutter_Lv1', human_mill2:'human_wood_cutter_Lv2', human_mill3:'human_wood_cutter_Lv3',
      human_barrack1:'human_barrack_Lv1', human_barrack2:'human_barrack_Lv2', human_barrack3:'human_barrack_Lv3' } },
  { tex:'/assets/models/orc_building_tex.png', files:{
      orc_throne1:'orc_throne_Lv1', orc_throne2:'orc_throne_Lv2', orc_throne3:'orc_throne_Lv3',
      orc_house1:'orc_house_Lv1',   orc_house2:'orc_house_Lv2',   orc_house3:'orc_house_Lv3',
      orc_tower1:'orc_tower_Lv1',   orc_tower2:'orc_tower_Lv2',   orc_tower3:'orc_tower_Lv3',
      orc_mine1:'orc_mine_Lv1',     orc_mine2:'orc_mine_Lv2',     orc_mine3:'orc_mine_Lv3',
      orc_mill1:'orc_mill_Lv1',     orc_mill2:'orc_mill_Lv2',     orc_mill3:'orc_mill_Lv3',
      orc_barrack1:'orc_barrack_Lv1', orc_barrack2:'orc_barrack_Lv2', orc_barrack3:'orc_barrack_Lv3' } },
];
function loadBuildings(){ return new Promise(res=>{
  const fx=new THREE.FBXLoader(), tl=new THREE.TextureLoader();
  const total=BLD_GROUPS.reduce((a,g)=>a+Object.keys(g.files).length,0); let n=0; const done=()=>{ if(++n>=total)res(); };
  for(const grp of BLD_GROUPS){ tl.load(grp.tex, tex=>{
    tex.flipY=true; tex.magFilter=THREE.NearestFilter; tex.minFilter=THREE.NearestFilter; tex.generateMipmaps=false; if('colorSpace'in tex)tex.colorSpace=THREE.SRGBColorSpace;
    Object.keys(grp.files).forEach(k=>fx.load('/assets/buildings/'+grp.files[k]+'.fbx', o=>{
      o=bakeStatic(o);   // buildings export as SkinnedMesh; bake to static so bldClone's plain clone doesn't render them at the map origin
      o.traverse(nd=>{ if(nd.isMesh){ nd.material=new THREE.MeshBasicMaterial({map:tex,side:THREE.DoubleSide}); nd.castShadow=true; nd.frustumCulled=false; } });
      const bb=new THREE.Box3().setFromObject(o); const sz=bb.getSize(new THREE.Vector3());
      o.position.x-=(bb.min.x+sz.x/2); o.position.z-=(bb.min.z+sz.z/2); o.position.y-=bb.min.y;   // centre X/Z, base to y=0
      const w=new THREE.Group(); w.add(o); BLD[k]={scene:w,h:Math.max(0.001,sz.y)}; done(); }, undefined, ()=>done()));
  }, undefined, ()=>{ for(let i=0;i<Object.keys(grp.files).length;i++)done(); }); }
}); }
function bldClone(k,H){ const e=BLD[k]; if(!e)return null; const g=e.scene.clone(true); g.scale.setScalar(H/e.h); return g; }

// ================= BASE: Thronefall-style fixed build plots + passive economy =================
let gold=180, wood=0, incomeRate=1, woodRate=0, plots=[], coreB=null, buildMenuEl=null, bmBack=null, buildBtnEl=null, goldNumEl=null, menuPlot=null, menuAnchor=null, enemyBase={x:-105,z:-108};
// category → model prefix + per-level stats (index 0 = Lv1). cost[0]=build, cost[1]=→Lv2, cost[2]=→Lv3.
const CAT={
  economy:{ label:'House',      model:'house',   H:[5.5,6.5,7.5], cost:[40,65,100],  pop:[8,13,18] },      // population/supply cap
  mine:   { label:'Gold Mine',  model:'mine',    H:[6,7.5,9],     cost:[60,110,170], income:[4,8,13] },    // gold generation
  lumber: { label:'Lumber Mill',model:'mill',    H:[5.5,6.5,7.5], cost:[50,95,150],  woodInc:[3,6,10] },   // wood generation
  army:   { label:'Barracks',   model:'barrack', H:[6.5,7.5,8.5], cost:[90,150,220], every:[7,5.5,4], cap:[2,3,4] },
  defense:{ label:'Tower',      model:'tower',   H:[8,9.5,11],    cost:[60,100,160], dmg:[18,32,52], range:[22,26,30], rof:[1.15,0.95,0.8] },
};
// WC3-style supply: the Throne seeds a base cap, each House raises it; units cost supply and gate training
const BASE_SUPPLY=12, UNIT_SUP={warrior:3,archer:2,cleric:3,assassin:2,grunt:2,shaman:3,drake:6};
let supplyCap=BASE_SUPPLY, supplyUsed=0;
// ===== Central combat balance table — every spawn path (player train, enemy AI, waves,
// starting warband) reads its base stats from here, so tuning one number tunes the whole
// game and player/enemy archetypes stay mirrored. dps = dmg/atk.
//   warrior/archer are shared archetypes across factions (symmetric matchups);
//   cleric is player-only support, grunt is enemy chaff, shaman is enemy caster.
const UBAL={
  warrior:{hp:130, dmg:14, range:3.5, atk:1.0},   // frontline: tanky, ~14 dps
  archer: {hp:64,  dmg:12, range:9,   atk:1.2},   // ranged glass cannon, ~10 dps
  cleric: {hp:62,  dmg:7,  range:7,   atk:1.3},   // support/heal, light dmg
  assassin:{hp:80, dmg:19, range:3.3, atk:0.72},  // fast melee flanker: high burst, fragile
  grunt:  {hp:92,  dmg:11, range:3.4, atk:1.0},   // enemy cheap chaff, ~11 dps
  shaman: {hp:60,  dmg:13, range:10,  atk:1.7},   // enemy caster, long-range magic
  drake:  {hp:520, dmg:34, range:5,   atk:1.1},   // elite winged bruiser — expensive, tanky, hits hard
};
const HERO_STAT={hp:320, dmg:22, range:3.6, atk:0.55, spd:19};   // heroes feel powerful but killable
const BOSS_STAT={hp:900, dmg:30, range:4.6, atk:1.2,  spd:11};   // chieftain: army-buster, abilities carry threat
const ALLY_SPD=15, ENEMY_SPD=12;
// per-Barracks train catalogue (min barracks level = tech gate; foundation for the tech tree)
const TRAIN=[
  {kind:'warrior', rig:'warrior',  icon:'warrior', label:'Warrior',   gold:65, sup:3, dur:7,  minLvl:1},
  {kind:'archer',  rig:'archer',   icon:'archer',  label:'Archer',    gold:55, sup:2, dur:6,  minLvl:1},
  {kind:'cleric',  rig:'priestess',icon:'cleric',  label:'Priestess', gold:95, sup:3, dur:10, minLvl:2},
  {kind:'assassin',rig:'assassin', icon:'sword',   label:'Assassin',  gold:80, sup:2, dur:8,  minLvl:2},
  // Drake shelved for now — earmarked as the RIMWALKER flying unit (to be renamed). See docs/CAMPAIGN.md roster gaps.
];
const CORE_H=[9,10.5,12], CORE_HP=[1600,2400,3400], CORE_UP=[0,300,480];
const UP_WOOD=[0,15,30], CORE_WOOD=[0,40,70];   // wood required to upgrade a plot / expand the throne
function recomputeIncome(){ incomeRate=1; woodRate=0; for(const p of plots){ if(p.cat==='mine') incomeRate+=CAT.mine.income[p.level-1]; else if(p.cat==='lumber') woodRate+=CAT.lumber.woodInc[p.level-1]; } }
function recomputeSupply(){ supplyCap=BASE_SUPPLY; for(const p of plots) if(p.cat==='economy') supplyCap+=CAT.economy.pop[p.level-1];
  supplyUsed=0; for(const e of allies) if(e.alive) supplyUsed+=(UNIT_SUP[e.kind]||2);
  for(const p of plots) if(p.cat==='army'&&p.queue) for(const q of p.queue) supplyUsed+=(UNIT_SUP[q.kind]||2); }   // queued units reserve supply
function placeCore(x,z){ scene.add(courtyard(x,z,13));
  coreB={x,z,px:x,pz:z,alive:true,level:1,hp:CORE_HP[0],max:CORE_HP[0],big:8,hitT:0,g:null,bar:makeBar(0x6fd0ff)};
  const g=bldClone(BLDPFX+'throne1',CORE_H[0])||makeKeep(); g.position.set(x,topY(x,z),z); scene.add(g); coreB.g=g; }
// marker state: built → hidden; unlocked empty → bright (cyan gen / orange turret) + plus; locked → dim grey, no plus
function styleRing(p){ if(!p.ring)return; if(p.cat){ p.ring.visible=false; if(p.plus)p.plus.visible=false; return; }
  p.ring.visible=true; if(p.plus)p.plus.visible=!p.locked;
  p.ring.material.color.setHex(p.locked?0x5a6a74 : (p.slot==='turret'?0xffb45c:((p.theme||PLOT_THEME.elf).ring)));
  p.ring.material.opacity=p.locked?0.26:0.55; }
function playerTheme(){ return BLDPFX==='human_'?PLOT_THEME.human : BLDPFX==='orc_'?PLOT_THEME.orc : PLOT_THEME.elf; }
function makePlot(x,z,tier,slot){ slot=slot||'gen'; const th=playerTheme(); scene.add(slot==='turret'?turretPad(x,z,3.4,th):hexPad(x,z,5.3,th));
  const ri=slot==='turret'?1.9:2.4, ro=slot==='turret'?2.5:3.1;
  const ring=new THREE.Mesh(new THREE.RingGeometry(ri,ro,26),new THREE.MeshBasicMaterial({color:th.ring,transparent:true,opacity:0.55,side:THREE.DoubleSide,depthWrite:false}));
  ring.rotation.x=-Math.PI/2; ring.position.set(x,topY(x,z)+0.4,z); scene.add(ring);
  const plus=new THREE.Group(), pm=new THREE.MeshBasicMaterial({color:th.plus});
  plus.add(new THREE.Mesh(new THREE.BoxGeometry(2.0,0.35,0.55),pm), new THREE.Mesh(new THREE.BoxGeometry(0.55,0.35,2.0),pm));
  plus.position.set(x,topY(x,z)+0.9,z); scene.add(plus);
  const p={x,z,ring,plus,theme:th,cat:null,level:0,g:null,cd:0,spawnCd:3,mine:[],queue:[],tier:tier||1,slot:slot,locked:(tier||1)>1}; plots.push(p); styleRing(p); return p; }
// reveal plots whose tier the throne has now reached (base expands as the throne is upgraded)
function revealPlots(){ for(const p of plots){ if(p.locked && p.tier<=coreB.level){ p.locked=false; styleRing(p); } } }
function buildOnPlot(p){ const c=CAT[p.cat]; sfx('build'); if(p.g) scene.remove(p.g);
  const g=bldClone(BLDPFX+c.model+p.level, c.H[p.level-1]); if(g){ g.position.set(p.x,topY(p.x,p.z),p.z); g.rotation.y=rr(0,6.28); scene.add(g); p.g=g; }
  p.ring.visible=false; p.plus.visible=false;
  if(p.cat==='defense'){ p.dmg=c.dmg[p.level-1]; p.range=c.range[p.level-1]; p.rof=c.rof[p.level-1]; }
  if(p.cat==='army'){ p.every=c.every[p.level-1]; p.cap=c.cap[p.level-1]; if(!p.queue)p.queue=[]; if(!p.pbar)p.pbar=makeBar(0xffd24a); }
  recomputeIncome(); recomputeSupply(); }
function startBuild(p,cat){ if(p.cat||p.locked)return; if(p.slot==='turret'&&cat!=='defense')return;   // turret spots build towers only
  const c=CAT[cat]; if(gold<c.cost[0])return; gold-=c.cost[0]; p.cat=cat; p.level=1; buildOnPlot(p); closeBuildMenu(); }
// queue a unit at a Barracks (WC3-style): pay gold now, reserve supply, build over time, then it musters
function queueUnit(p,def){ if(!p||p.cat!=='army')return; if(gold<def.gold)return; if(supplyUsed+def.sup>supplyCap)return;   // no gold / no pop room
  gold-=def.gold; sfx('build'); if(!p.queue)p.queue=[]; p.queue.push({kind:def.kind, rig:def.rig, t:def.dur, dur:def.dur, sup:def.sup}); recomputeSupply(); openPlotMenu(p); }
function spawnTrained(p,q){ const b=UBAL[q.kind]||UBAL.warrior;
  const col = q.kind==='cleric'?C.cleric : q.kind==='archer'?C.teamBlue : q.kind==='drake'?0x9b6bd6 : C.teamBlueD;
  const e=mkFighter(col,1.0,'ally',{hp:b.hp,dmg:b.dmg,range:b.range,atkEvery:b.atk,spd:ALLY_SPD});
  e.idx=allies.length; e.kind=q.kind; e.healCd=0; e.smiteCd=0; riggize(e, URIG[q.kind]||q.rig||q.kind); setP(e,p.x+rr(-2,2),p.z+rr(3,5)); allies.push(e); }
function upgradePlot(p){ if(!p.cat||p.level>=3)return; const cost=CAT[p.cat].cost[p.level], wcost=UP_WOOD[p.level];   // upgrades cost gold + wood
  if(gold<cost||wood<wcost)return; gold-=cost; wood-=wcost; p.level++; buildOnPlot(p); closeBuildMenu(); }
function upgradeCore(){ if(!coreB||coreB.level>=3)return; const cost=CORE_UP[coreB.level], wcost=CORE_WOOD[coreB.level];
  if(gold<cost||wood<wcost)return; gold-=cost; wood-=wcost; coreB.level++;
  const add=CORE_HP[coreB.level-1]-coreB.max; coreB.max=CORE_HP[coreB.level-1]; coreB.hp+=add;
  scene.remove(coreB.g); const g=bldClone(BLDPFX+'throne'+coreB.level,CORE_H[coreB.level-1])||makeKeep(); g.position.set(coreB.x,topY(coreB.x,coreB.z),coreB.z); scene.add(g); coreB.g=g; revealPlots(); closeBuildMenu(); }
function towerTick(p,dt){ p.cd-=dt; if(p.cd>0)return; let best=null,bd=p.range*p.range;
  // only target foes the player can actually SEE — no firing blind into the fog of war
  for(const en of enemies){ if(!en.alive)continue; if(!isVisible(en.px,en.pz))continue; const dd=(en.px-p.x)**2+(en.pz-p.z)**2; if(dd<bd){bd=dd;best=en;} }
  if(best){ shootFx(p.x,p.z,best.px,best.pz,'arrow'); damage(best,p.dmg,false); p.cd=p.rof; } }
function barracksTick(p,dt){
  if(p.queue&&p.queue.length){ const q=p.queue[0]; q.t-=dt; if(q.t<=0){ spawnTrained(p,q); p.queue.shift(); recomputeSupply(); } }
  if(p.pbar){ if(p.queue&&p.queue.length){ const q=p.queue[0], f=Math.max(0,Math.min(1,(q.dur-q.t)/q.dur));   // training progress bar over the barracks
      p.pbar.__fl.scale.x=f; p.pbar.__fl.position.x=-(1-f)*p.pbar.__w/2;
      p.pbar.position.set(p.x,topY(p.x,p.z)+CAT.army.H[p.level-1]+1.8,p.z); p.pbar.quaternion.copy(cam.quaternion); p.pbar.visible=true; }
    else p.pbar.visible=false; } }
function baseTick(dt){ gold+=incomeRate*dt; wood+=woodRate*dt; recomputeSupply();
  for(const p of plots){ if(p.cat==='defense') towerTick(p,dt); else if(p.cat==='army') barracksTick(p,dt); }
  if(coreB&&coreB.bar){ const f=Math.max(0,coreB.hp/coreB.max); coreB.bar.__fl.scale.x=f; coreB.bar.__fl.position.x=-(1-f)*coreB.bar.__w/2;
    coreB.bar.position.set(coreB.x,topY(coreB.x,coreB.z)+CORE_H[coreB.level-1]+2,coreB.z); coreB.bar.quaternion.copy(cam.quaternion); }
  if(goldNumEl) goldNumEl.textContent=Math.floor(gold);
  if(woodEl){ const v=woodEl.querySelector('.v'); if(v)v.textContent=Math.floor(wood); }
  if(supEl){ const v=supEl.querySelector('.v'); if(v)v.textContent=Math.round(supplyUsed)+'/'+supplyCap; supEl.style.color = supplyUsed>=supplyCap?'#ff8a7a':'var(--ink)'; } }

// ================= ENEMY AI: a mirror economy that builds its orc base and attacks =================
// The orc stronghold runs the same Thronefall loop as the player, driven by a simple planner:
// earns gold → fills its plots with orc buildings → trains a horde → upgrades. Its core + buildings
// are attackable (pushed into eStructs / targeted via foes()), so razing the throne wins the game.
let eGold=130, eWood=0, eIncome=1, eWoodRate=0, ePlots=[], enemyCore=null, eStructs=[], aiCd=3, eSupplyCap=BASE_SUPPLY, eSupplyUsed=0;
const BLD_HP=[220,340,480];   // per-level HP of an enemy plot building
function updateStructBar(s,topH){ if(!s.bar)return; if(s.__vis===false){ s.bar.visible=false; return; } const f=Math.max(0,s.hp/s.max); s.bar.__fl.scale.x=f; s.bar.__fl.position.x=-(1-f)*s.bar.__w/2;
  s.bar.visible=true; s.bar.position.set(s.x,topY(s.x,s.z)+topH+2,s.z); s.bar.quaternion.copy(cam.quaternion); }
function placeEnemyCore(x,z){ scene.add(courtyard(x,z,13));
  enemyCore={x,z,px:x,pz:z,alive:true,level:1,hp:CORE_HP[0],max:CORE_HP[0],big:8,hitT:0,g:null,bar:makeBar(0xff6b5a),kind:'core'};
  const g=bldClone('orc_throne1',CORE_H[0])||makeKeep(); g.position.set(x,topY(x,z),z); g.rotation.y=2.4; scene.add(g); enemyCore.g=g;
  eStructs.push(enemyCore); }
function makeEnemyPlot(x,z,tier,slot){ slot=slot||'gen'; scene.add(slot==='turret'?turretPad(x,z,3.4,PLOT_THEME.orc):hexPad(x,z,5.3,PLOT_THEME.orc));
  const p={x,z,cat:null,level:0,g:null,cd:0,spawnCd:3,mine:[],struct:null,tier:tier||1,slot:slot,locked:(tier||1)>1}; ePlots.push(p); return p; }
function eRecomputeIncome(){ eIncome=1; eWoodRate=0; for(const p of ePlots){ if(p.cat==='mine') eIncome+=CAT.mine.income[p.level-1]; else if(p.cat==='lumber') eWoodRate+=CAT.lumber.woodInc[p.level-1]; } }
function eRecomputeSupply(){ eSupplyCap=BASE_SUPPLY; for(const p of ePlots) if(p.cat==='economy') eSupplyCap+=CAT.economy.pop[p.level-1];
  eSupplyUsed=0; for(const e of enemies) if(e.alive) eSupplyUsed+=(UNIT_SUP[e.kind]||2); }
function eBuildOnPlot(p){ const c=CAT[p.cat]; if(p.g)scene.remove(p.g); if(p.struct){p.struct.alive=false; scene.remove(p.struct.bar);}
  const g=bldClone('orc_'+c.model+p.level, c.H[p.level-1]); if(g){ g.position.set(p.x,topY(p.x,p.z),p.z); g.rotation.y=rr(0,6.28); scene.add(g); p.g=g; }
  const hp=BLD_HP[p.level-1]; p.struct={x:p.x,z:p.z,px:p.x,pz:p.z,alive:true,hp,max:hp,big:3.5,hitT:0,g,bar:makeBar(0xff6b5a),kind:'bld',plot:p}; eStructs.push(p.struct);
  if(p.cat==='defense'){ p.dmg=c.dmg[p.level-1]; p.range=c.range[p.level-1]; p.rof=c.rof[p.level-1]; }
  if(p.cat==='army'){ p.every=c.every[p.level-1]; p.cap=c.cap[p.level-1]; }
  eRecomputeIncome(); }
function eUpgradeCore(){ if(enemyCore.level>=3)return; enemyCore.level++;
  const add=CORE_HP[enemyCore.level-1]-enemyCore.max; enemyCore.max=CORE_HP[enemyCore.level-1]; enemyCore.hp+=add;
  scene.remove(enemyCore.g); const g=bldClone('orc_throne'+enemyCore.level,CORE_H[enemyCore.level-1])||makeKeep(); g.position.set(enemyCore.x,topY(enemyCore.x,enemyCore.z),enemyCore.z); g.rotation.y=2.4; scene.add(g); enemyCore.g=g;
  for(const p of ePlots){ if(p.locked && p.tier<=enemyCore.level) p.locked=false; } }
// shared orc factory — both the AI barracks and the wave spawner build enemies here so
// their stats come straight from UBAL (mirrored with the player archetypes).
function mkOrc(rig){ const map={orcgrunt:'grunt', orcarcher:'archer', orcwarrior:'warrior', orcshaman:'shaman'};
  const kind=map[rig]||'grunt', b=UBAL[kind]||UBAL.grunt;
  const scl = rig==='orcwarrior'?1.1 : rig==='orcgrunt'?1.05 : 1.0;
  const e=mkFighter(C.enemyRed,scl,'enemy',{hp:b.hp,dmg:b.dmg,range:b.range,atkEvery:b.atk,spd:ENEMY_SPD}); riggize(e,rig);
  e.kind=kind; if(kind==='archer'){e.ranged=true;} if(kind==='shaman'){e.ranged=true;e.magic=true;} if(rig==='orcwarrior')e.rad=1.8;
  return e; }
// ================= NEUTRAL CREEPS (ash-basin bestiary) + creep camps =================
// Creeps live in the `enemies` array (so allies/towers/hero treat them as foes and the reaper
// handles them), but run their own dormant-until-provoked, camp-leashed AI (WC3 behaviour):
// they idle at their den until a player unit strays near or hits them, chase within a leash of
// home, then disengage + regen if pulled too far. Clearing a camp pays a gold bounty.
const CREEP={
  cinderhound: {hp:130, dmg:16, range:3.2, atk:1.0, spd:14, rad:1.5,          name:'Cinder Hound'},
  direboar:    {hp:230, dmg:26, range:3.4, atk:1.3, spd:12, rad:1.9, big:2.0, name:'Direboar'},
  emberspitter:{hp:95,  dmg:15, range:11,  atk:1.6, spd:9,  rad:1.5, ranged:true, magic:true, name:'Ember Spitter'},
  ashtreant:   {hp:440, dmg:30, range:3.8, atk:1.6, spd:8,  rad:2.6, big:3.0, name:'Ash Treant'},
  moltenwisp:  {hp:90,  dmg:18, range:10,  atk:1.5, spd:13, rad:1.4, ranged:true, magic:true, name:'Molten Wisp'},
  wyveling:    {hp:210, dmg:22, range:5,   atk:1.1, spd:16, rad:1.8,           name:'Wyveling'},
  revenant:    {hp:680, dmg:40, range:4.4, atk:1.4, spd:9,  rad:2.8, big:3.2, name:'Stone Revenant'},
  // The Deepvein dead — the risen ("ash-touched") that crawl up the ironstone veins near the Reach.
  // The true campaign antagonist, seeded here as neutral creeps guarding the flanks of the Floor.
  uworker:  {hp:75,  dmg:10, range:3.0, atk:1.2, spd:11, rad:1.3,           name:'Risen Thrall'},
  uwarrior: {hp:170, dmg:20, range:3.4, atk:1.1, spd:11, rad:1.6,           name:'Risen Warrior'},
  uassassin:{hp:115, dmg:23, range:3.2, atk:0.8, spd:16, rad:1.4,           name:'Grave Stalker'},
  uarcher:  {hp:90,  dmg:16, range:10,  atk:1.4, spd:12, rad:1.4, ranged:true,             name:'Risen Bowman'},
  umage:    {hp:105, dmg:21, range:11,  atk:1.7, spd:10, rad:1.5, ranged:true, magic:true, name:'Bonecaster'},
  uking:    {hp:560, dmg:38, range:3.8, atk:1.3, spd:9,  rad:2.4, big:2.6,  name:'Barrow King'},
};
function mkCreep(kind,camp,home){ const b=CREEP[kind]||CREEP.cinderhound;
  const e=mkFighter(0x8a7d5a,1.0,'enemy',{hp:b.hp,dmg:b.dmg,range:b.range,atkEvery:b.atk,spd:b.spd});
  e.kind=kind; e.creep=true; e.camp=camp; e.home={x:home.x,z:home.z}; e.aggro=false; e.returning=false;
  e.aggroR=camp?camp.aggroR:15; e.leashR=camp?camp.leashR:26; e.rad=b.rad||1.5; if(b.big)e.big=b.big;
  if(b.ranged)e.ranged=true; if(b.magic)e.magic=true; e.max=b.hp;
  riggize(e,kind); if(CREEP_VFX[kind]) e.vfx=makeCreepVfx(e,kind); return e; }
function campAggro(camp){ if(!camp)return; camp.aggro=true; for(const c of camp.members) if(c.alive) c.aggro=true; }
// ---- creep particle VFX (ported from the weapon tuner): smoke, glowing eyes, green flame,
// floating crystals, molten-wisp base glow + ash trail — each follows its moving creep, hidden in fog ----
function cvRadial(stops){ const c=document.createElement('canvas'); c.width=c.height=64; const g=c.getContext('2d');
  const rg=g.createRadialGradient(32,32,0,32,32,32); stops.forEach(s=>rg.addColorStop(s[0],s[1])); g.fillStyle=rg; g.fillRect(0,0,64,64);
  const t=new THREE.CanvasTexture(c); t.needsUpdate=true; return t; }
let CV_SMOKE=null,CV_GLOW=null,CV_FLAME=null;
function cvTex(){ if(CV_GLOW)return; CV_SMOKE=cvRadial([[0,'rgba(210,210,214,0.85)'],[0.45,'rgba(150,150,158,0.5)'],[1,'rgba(120,120,128,0)']]);
  CV_GLOW=cvRadial([[0,'rgba(255,255,255,1)'],[0.28,'rgba(255,255,255,0.85)'],[1,'rgba(255,255,255,0)']]);
  const c=document.createElement('canvas'); c.width=c.height=64; const g=c.getContext('2d');
  g.beginPath(); g.moveTo(32,63); g.bezierCurveTo(9,50,7,24,32,2); g.bezierCurveTo(57,24,55,50,32,63); g.closePath();
  const lg=g.createLinearGradient(0,64,0,0); lg.addColorStop(0,'rgba(255,255,255,0.95)'); lg.addColorStop(0.3,'rgba(255,255,255,0.9)'); lg.addColorStop(0.7,'rgba(255,255,255,0.45)'); lg.addColorStop(1,'rgba(255,255,255,0)');
  g.fillStyle=lg; g.fill(); CV_FLAME=new THREE.CanvasTexture(c); CV_FLAME.needsUpdate=true; }
const CREEP_VFX={
  ashtreant:  {eyes:{color:0xffb544,size:0.05,sep:0.085,up:0.11,fwd:0.13}, smoke:{color:0xc0bfb8,count:9,life:2.4,rise:0.55,anchors:[[0.4,0.55,0.05],[-0.4,0.55,0.05],[0,0.68,-0.3]]}},
  emberspitter:{eyes:{color:0xff8a24,size:0.06,sep:0.1,up:0.06,fwd:0.16}, smoke:{color:0xb9b6ae,count:6,life:2.0,rise:0.6,anchors:[[0.28,0.55,0],[-0.28,0.55,0]]}},
  cinderhound:{eyes:{color:0x9dff4a,size:0.05,sep:0.11,up:0.06,fwd:0.5}},
  wyveling:   {eyes:{color:0xff5a1e,size:0.05,sep:0.1,up:0.1,fwd:0.36}},
  moltenwisp: {baseglow:{color:0x9dff4a,size:0.4}, ash:{count:14,color:0x8f8f92,ember:0x9dff4a,life:1.7,fall:0.55,spread:0.16}},
  revenant:   {eyes:{color:0x9dff4a,size:0.045,sep:0.09,up:0.13,fwd:0.13}, flame:{color:0x62ff20,core:0xe8ff96,count:12,life:0.5,rise:0.5}, smoke:{color:0x8f8f96,count:6,life:2.0,rise:0.7,anchors:[[0,1.08,0],[0.14,1.03,-0.05],[-0.14,1.03,-0.05]]}, crystals:{color:0x9dff4a,count:2}},
  // Deepvein dead — cold necrotic eye-lights; casters/king wreathed in soul-fire
  uworker:  {eyes:{color:0x8dffb0,size:0.04, sep:0.07,up:0.10,fwd:0.13}},
  uwarrior: {eyes:{color:0x8dffb0,size:0.045,sep:0.08,up:0.10,fwd:0.13}},
  uassassin:{eyes:{color:0x8dffb0,size:0.045,sep:0.08,up:0.10,fwd:0.14}},
  uarcher:  {eyes:{color:0x8dffb0,size:0.045,sep:0.08,up:0.10,fwd:0.14}},
  umage:    {eyes:{color:0x9dff6a,size:0.05, sep:0.08,up:0.10,fwd:0.13}, flame:{color:0x62ff20,core:0xe8ff96,count:10,life:0.5,rise:0.5}},
  uking:    {eyes:{color:0x9dff6a,size:0.05, sep:0.09,up:0.11,fwd:0.13}, flame:{color:0x62ff20,core:0xe8ff96,count:12,life:0.55,rise:0.5}, smoke:{color:0x8f8f96,count:5,life:2.2,rise:0.6,anchors:[[0.28,0.6,0],[-0.28,0.6,0]]}},
};
function makeCreepVfx(e,key){ const cfg=CREEP_VFX[key]; if(!cfg)return null; cvTex();
  const H=CHAR_H[key]||4, hw=H*0.3, dz=H*0.28, parts=[];
  let headBone=null; e.g.traverse(o=>{ if(o.isBone && /head/i.test(o.name) && !headBone) headBone=o; });
  function spr(tex,color,blend){ const m=new THREE.SpriteMaterial({map:tex,color:color,transparent:true,depthWrite:false,opacity:0,blending:blend}); const s=new THREE.Sprite(m); s.frustumCulled=false; scene.add(s); parts.push(s); return s; }
  const smokeP=[],flameP=[],eyes=[],crystals=[],ashP=[]; let baseGlow=null;
  if(cfg.smoke) for(let i=0;i<cfg.smoke.count;i++){ smokeP.push({s:spr(CV_SMOKE,cfg.smoke.color,THREE.NormalBlending),life:1e9,max:1,x:0,y:0,z:0,vx:0,vy:0,vz:0,sz:1}); }
  if(cfg.flame) for(let i=0;i<cfg.flame.count;i++){ flameP.push({s:spr(CV_FLAME,i%3===0?(cfg.flame.core||cfg.flame.color):cfg.flame.color,THREE.AdditiveBlending),life:Math.random(),max:1,x:0,y:0,z:0,sz:1}); }
  if(cfg.eyes){ const s0=cfg.eyes.size*H; for(const sgn of [-1,1]){ const s=spr(CV_GLOW,cfg.eyes.color,THREE.AdditiveBlending); s.scale.setScalar(s0); eyes.push({s,sgn}); } }
  if(cfg.crystals){ const geo=new THREE.OctahedronGeometry(1); for(const sgn of [-1,1]){ const m=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({color:cfg.crystals.color})); const r=H*0.07; m.scale.set(r*0.68,r,r*0.68); m.frustumCulled=false; scene.add(m); parts.push(m); const halo=spr(CV_GLOW,cfg.crystals.color,THREE.AdditiveBlending); halo.scale.setScalar(r*2.0); crystals.push({m,halo,sgn}); } }
  if(cfg.baseglow){ baseGlow=spr(CV_GLOW,cfg.baseglow.color,THREE.AdditiveBlending); baseGlow.scale.setScalar((cfg.baseglow.size||0.4)*H); }
  if(cfg.ash) for(let i=0;i<cfg.ash.count;i++){ const em=(i%3===0); ashP.push({s:spr(em?CV_GLOW:CV_SMOKE,em?(cfg.ash.ember||0x9dff4a):(cfg.ash.color||0x9a9a9a),em?THREE.AdditiveBlending:THREE.NormalBlending),em,life:1e9,max:1,x:0,y:0,z:0,vx:0,vy:0,vz:0,sz:1}); }
  const _hp=new THREE.Vector3();
  function base(){ return {x:e.px, y:topY(e.px,e.pz), z:e.pz}; }
  function headPos(){ if(headBone){ headBone.getWorldPosition(_hp); return _hp; } const b=base(); _hp.set(b.x,b.y+H*0.8,b.z); return _hp; }
  function reseed(p,c,b){ p.life=0; p.max=c.life*(0.7+Math.random()*0.6); const a=c.anchors?c.anchors[(Math.random()*c.anchors.length)|0]:[0,0,0];
    p.x=b.x+a[0]*hw+(Math.random()-0.5)*0.2*hw; p.y=b.y+a[1]*H; p.z=b.z+a[2]*dz+(Math.random()-0.5)*0.2*dz;
    p.vx=(Math.random()-0.5)*0.1*hw; p.vy=c.rise*H*(0.7+Math.random()*0.6); p.vz=(Math.random()-0.5)*0.1*hw; p.sz=H*0.16*(0.7+Math.random()*0.6); }
  function reseedAsh(p,b){ const c=cfg.ash; p.life=0; p.max=c.life*(0.6+Math.random()*0.8);
    p.x=b.x+(Math.random()-0.5)*c.spread*hw*2; p.y=b.y+H*0.12; p.z=b.z+(Math.random()-0.5)*c.spread*dz*2;
    const ang=Math.random()*6.28, rd=Math.random()*0.05*hw; p.vx=Math.cos(ang)*rd; p.vz=Math.sin(ang)*rd; p.vy=-(c.fall||0.5)*H*(0.6+Math.random()*0.7); p.sz=(p.em?H*0.028:H*0.13)*(0.7+Math.random()*0.6); }
  function update(dt,t){ const vis=e.alive && e.__vis!==false; for(const p of parts) p.visible=vis; if(!vis)return; const b=base();
    for(const p of smokeP){ p.life+=dt; if(p.life>=p.max)reseed(p,cfg.smoke,b); p.x+=p.vx*dt;p.y+=p.vy*dt;p.z+=p.vz*dt;p.vy*=(1-0.35*dt);
      const f=p.life/p.max; p.s.position.set(p.x,p.y,p.z); p.s.material.opacity=Math.sin(Math.min(1,f)*Math.PI)*0.55; const s=p.sz*(0.55+f*1.2); p.s.scale.set(s,s,s); }
    if(cfg.flame){ const hp=headPos(), fh=hp.y+H*0.07; for(const p of flameP){ p.life+=dt; if(p.life>=p.max){ p.life=0; p.max=cfg.flame.life*(0.6+Math.random()*0.8);
        p.x=hp.x+(Math.random()-0.5)*hw*0.5; p.y=fh; p.z=hp.z+(Math.random()-0.5)*dz*0.3; p.sz=H*0.13*(0.7+Math.random()*0.6); }
      const f=p.life/p.max; p.s.position.set(p.x+Math.sin(t*9+p.max*10)*hw*0.06*(1-f), p.y+f*cfg.flame.rise*H, p.z); p.s.material.opacity=(1-f*f)*0.9; const s=p.sz*(1-f*0.55); p.s.scale.set(s,s,s); } }
    if(eyes.length){ const hp=headPos(), o=cfg.eyes, sep=(o.sep||0.1)*H, up=(o.up||0.12)*H, fwd=(o.fwd||0.15)*H, fx=Math.sin(e.face||0), fz=Math.cos(e.face||0), rx=Math.cos(e.face||0), rz=-Math.sin(e.face||0);
      for(const ey of eyes){ ey.s.position.set(hp.x+fx*fwd+rx*ey.sgn*sep, hp.y+up, hp.z+fz*fwd+rz*ey.sgn*sep); ey.s.material.opacity=0.75+0.25*Math.sin(t*5); } }
    for(const c of crystals){ const y=b.y+H*0.6+Math.sin(t*1.6+(c.sgn>0?0:Math.PI))*H*0.05, x=b.x+c.sgn*hw*2.2, z=b.z; c.m.position.set(x,y,z); c.halo.position.set(x,y,z); c.m.rotation.y=t*0.9; c.m.rotation.x=t*0.5; c.halo.material.opacity=0.5+0.2*Math.sin(t*3); }
    if(baseGlow){ baseGlow.position.set(b.x,b.y+H*0.15,b.z); baseGlow.material.opacity=0.6+0.28*Math.sin(t*4.5); }
    for(const p of ashP){ p.life+=dt; if(p.life>=p.max)reseedAsh(p,b); p.vy-=(p.em?0.25:0.55)*H*dt; p.x+=p.vx*dt;p.y+=p.vy*dt;p.z+=p.vz*dt; const f=p.life/p.max; p.s.position.set(p.x,p.y,p.z);
      if(p.em){ p.s.material.opacity=(1-f)*0.9; const s=p.sz*(1-f*0.4); p.s.scale.set(s,s,s); } else { p.s.material.opacity=Math.sin(Math.min(1,f)*Math.PI)*0.4; const s=p.sz*(0.6+f*1.15); p.s.scale.set(s,s,s); } } }
  function dispose(){ for(const p of parts){ scene.remove(p); if(p.material){ if(p.material.map&&p.material.map!==CV_GLOW&&p.material.map!==CV_SMOKE&&p.material.map!==CV_FLAME)p.material.map.dispose(); p.material.dispose(); } if(p.geometry)p.geometry.dispose(); } }
  return {update,dispose}; }
function creepTick(e,dt){ const h=e.home;
  if(!e.aggro){ const {t,d}=nearest(e.px,e.pz,[hero,...allies].filter(u=>u&&u.alive)); if(t && d<e.aggroR) campAggro(e.camp); }
  if(e.aggro){
    if(e.target && !e.target.alive) e.target=null;
    if(!e.returning && Math.hypot(e.px-h.x,e.pz-h.z)>e.leashR){ e.target=null; e.returning=true; }   // pulled past the leash
    if(e.returning){ const d=Math.hypot(h.x-e.px,h.z-e.pz);
      if(d>2.2){ e.state='move'; moveTo(e,h.x,h.z,dt); e.hp=Math.min(e.max,e.hp+e.max*0.25*dt); }     // regen while walking home
      else { e.returning=false; e.aggro=false; e.hp=e.max; e.state='idle'; } }
    else { if(!e.target){ const c=nearest(e.px,e.pz,[hero,...allies].filter(u=>u&&u.alive)); if(c.t && Math.hypot(c.t.px-h.x,c.t.pz-h.z)<e.leashR) e.target=c.t; }
      if(e.target){ const t=e.target, reach=e.range+(t.big||0), d=Math.hypot(t.px-e.px,t.pz-e.pz);
        if(d>reach){ e.state='move'; moveTo(e,t.px,t.pz,dt); } else { e.state='attack'; faceTo(e,t.px-e.px,t.pz-e.pz);
          if(e.ranged && e.cd<=0) shootFx(e.px,e.pz,t.px,t.pz, e.kind==='emberspitter'?'fire':(e.magic?'magic':'arrow')); attack(e,t); } }
      else e.state='idle'; }
  } else e.state='idle';
  if((e.kind==='emberspitter'||e.kind==='moltenwisp'||e.kind==='cinderhound') && isVisible(e.px,e.pz) && Math.random()<dt*1.4)
    puff(e.px+rr(-0.6,0.6),topY(e.px,e.pz)+rr(0.8,2.4),e.pz+rr(-0.6,0.6), e.kind==='moltenwisp'?0x9dff4a:0xff7a2a, rr(0.18,0.38),0.5);
  if(e.rigged){ e.mixer.update(dt); setAnim(e, e.state==='attack'?'attack':(e.state==='move'?'run':'idle')); }
  if(e.vfx){ e.__vt=(e.__vt||0)+dt; e.vfx.update(dt, e.__vt); } }
// ---- creep camps (mission a1m1): dens along the ash road between the two strongholds ----
let creepCamps=[];
function findLand(x,z){ if(onIsland(x,z))return {x,z}; for(let r=3;r<=34;r+=3){ for(let a=0;a<6.28;a+=0.5){ const nx=x+Math.cos(a)*r, nz=z+Math.sin(a)*r; if(onIsland(nx,nz))return {x:nx,z:nz}; } } return {x,z}; }
function spawnCreepCamps(){ creepCamps=[];
  LVCREEPS.forEach((d,ci)=>{ const c=findLand(d.at[0],d.at[1]);
    const camp={x:c.x,z:c.z,name:d.name,bounty:d.bounty||80,members:[],discovered:false,cleared:false,aggro:false,aggroR:15,leashR:27,first:ci===0};
    d.roster.forEach((k,i)=>{ const ang=i/Math.max(1,d.roster.length)*6.28, rad=(i===0?0:5.0);
      const home=findLand(c.x+Math.cos(ang)*rad, c.z+Math.sin(ang)*rad); const e=mkCreep(k,camp,home);
      setP(e,home.x,home.z); e.__vis=false; enemies.push(e); camp.members.push(e); });
    creepCamps.push(camp); }); }
let _toastEl=null,_toastTo=null;
function campToast(msg){ if(!_toastEl){ _toastEl=document.createElement('div'); _toastEl.id='campToast';
    _toastEl.style.cssText='position:fixed;left:50%;top:78px;transform:translateX(-50%);z-index:60;background:rgba(12,16,22,0.85);color:#e7edf3;border:1px solid #c79a42;border-radius:8px;padding:8px 16px;font:700 14px system-ui;letter-spacing:.4px;pointer-events:none;transition:opacity .4s;box-shadow:0 4px 18px rgba(0,0,0,.5)';
    document.body.appendChild(_toastEl); }
  _toastEl.textContent=msg; _toastEl.style.opacity='1'; clearTimeout(_toastTo); _toastTo=setTimeout(()=>{ if(_toastEl)_toastEl.style.opacity='0'; },2800); }
function updateCamps(dt){ for(const camp of creepCamps){
  if(!camp.discovered && (isVisible(camp.x,camp.z)||camp.aggro)){ camp.discovered=true; pingRing(camp.x,camp.z,0x9dff4a); campToast('◈ '+camp.name+' — creep camp discovered');
    if(camp.first && typeof TUT!=='undefined' && !TUT) playDialog([{who:'Crown Scout',icon:'select',text:'My lord — the ash is not empty. Beasts den along the road: hounds and boars, and worse things of stone and green fire. Clear their camps and the ironstone road is ours — and they hoard plunder.'}]); }
  if(!camp.cleared && camp.members.length && camp.members.every(m=>!m.alive)){ camp.cleared=true; gold+=camp.bounty; campToast('✓ '+camp.name+' cleared — +'+camp.bounty+' gold'); } } }
// ================= RITUAL / CHANNEL-DEFENSE MISSION (hold while the mystics seal the Unveiled) =================
function setupRitual(){ ritualT=0; ritualDone=false; ritualCasters=[]; _ritWaves=RITUAL.waves.map(w=>({at:w.at,s:w.s,fired:false}));
  const sx=coreB?coreB.x:0, sz=coreB?coreB.z:0;
  for(let i=0;i<(RITUAL.casters||2);i++){ const b=UBAL.cleric, a=i/Math.max(1,RITUAL.casters)*6.28;
    const p=findLand(sx+Math.cos(a)*4.5, sz+Math.sin(a)*4.5);
    const e=mkFighter(C.cleric,1.0,'ally',{hp:Math.round(b.hp*1.6),dmg:b.dmg,range:b.range,atkEvery:b.atk,spd:ALLY_SPD});
    e.kind='cleric'; e.idx=allies.length; e.healCd=0; e.smiteCd=0; e.__caster=true; e.order={x:p.x,z:p.z};
    riggize(e, URIG.cleric||'priestess'); setP(e,p.x,p.z); allies.push(e); ritualCasters.push(e); }
  const ring=new THREE.Mesh(new THREE.RingGeometry(6,7.4,44), new THREE.MeshBasicMaterial({color:0x9dff4a,transparent:true,opacity:0.7,side:THREE.DoubleSide,depthWrite:false}));
  ring.rotation.x=-Math.PI/2; ring.position.set(sx,topY(sx,sz)+0.3,sz); scene.add(ring); _ritRing=ring; }
function spawnRitualWave(spawns){ const R=RITUAL.spawnR||70, sx=coreB?coreB.x:0, sz=coreB?coreB.z:0;
  for(const [kind,n] of spawns){ for(let i=0;i<n;i++){ const a=rnd()*6.28, p=findLand(sx+Math.cos(a)*R, sz+Math.sin(a)*R);
    const e=mkCreep(kind,null,{x:p.x,z:p.z}); e.creep=false;   // aggressive Unveiled wave: default enemy AI marches on the altar/mystics
    setP(e,p.x,p.z); enemies.push(e); } }
  if(isVisible(sx,sz)){ addShake(0.5); sfx('roar'); } }
function ritualTick(dt){ if(!RITUAL||ritualDone)return; ritualT+=dt;
  for(const w of _ritWaves){ if(!w.fired && ritualT>=w.at){ w.fired=true; spawnRitualWave(w.s); } }
  const f=Math.min(1,ritualT/RITUAL.duration), rem=Math.max(0,Math.ceil(RITUAL.duration-ritualT));
  if(waveEl) waveEl.textContent='◈ Sealing the Rite — '+Math.floor(f*100)+'%   ·   '+rem+'s';
  if(_ritRing){ const s=1+Math.sin(ritualT*2)*0.05; _ritRing.scale.set(s,1,s); _ritRing.material.opacity=0.45+0.3*Math.abs(Math.sin(ritualT*2.5)); }
  if((RITUAL.casters||0)>0 && ritualCasters.filter(c=>c.alive).length===0){ ritualDone=true; endGame(false); return; }   // mystics slain
  if(ritualT>=RITUAL.duration){ ritualDone=true; endGame(true); } }   // seal complete
function eTowerTick(p,dt){ p.cd-=dt; if(p.cd>0)return; let best=null,bd=p.range*p.range;
  for(const t of [hero,...allies]){ if(!t||!t.alive)continue; const dd=(t.px-p.x)**2+(t.pz-p.z)**2; if(dd<bd){bd=dd;best=t;} }
  if(best){ shootFx(p.x,p.z,best.px,best.pz,'arrow'); damage(best,p.dmg,false); p.cd=p.rof; } }
function eBarracksTick(p,dt){ p.mine=p.mine.filter(u=>u.alive); if(eSupplyUsed>=eSupplyCap)return; if(p.mine.length>=p.cap)return; p.spawnCd-=dt; if(p.spawnCd>0)return; p.spawnCd=p.every;
  const rig=['orcgrunt','orcarcher','orcwarrior'][p.mine.length % (p.level>=2?3:2)];
  const e=mkOrc(rig); setP(e,p.x+rr(-3,3),p.z+rr(3,5)); enemies.push(e); p.mine.push(e); }
function enemyAI(dt){ aiCd-=dt; if(aiCd>0)return; aiCd=4;
  const empty=ePlots.find(p=>!p.cat && !p.locked);
  const nEco=ePlots.filter(p=>p.cat==='economy').length, nMine=ePlots.filter(p=>p.cat==='mine').length, nLum=ePlots.filter(p=>p.cat==='lumber').length, nArmy=ePlots.filter(p=>p.cat==='army').length, nDef=ePlots.filter(p=>p.cat==='defense').length;
  if(empty){ let cat; if(empty.slot==='turret') cat='defense';   // turret spots are defense-only
    else if(nMine<1)cat='mine'; else if(nLum<1)cat='lumber'; else if(nArmy<1)cat='army'; else if(nEco<1)cat='economy'; else if(nMine<2)cat='mine'; else if(nLum<2)cat='lumber'; else if(nArmy<2)cat='army'; else if(nDef<1)cat='defense'; else cat=['army','defense','mine','lumber','economy'][Math.floor(rnd()*5)];
    const cost=CAT[cat].cost[0]; if(eGold>=cost){ eGold-=cost; empty.cat=cat; empty.level=1; eBuildOnPlot(empty); return; } return; }
  // all reachable plots are full → expand the base (upgrade the throne) before polishing plot levels
  if(enemyCore.level<3){ const cost=CORE_UP[enemyCore.level], wc=CORE_WOOD[enemyCore.level]; if(eGold>=cost&&eWood>=wc){ eGold-=cost; eWood-=wc; eUpgradeCore(); } return; }   // save gold + wood
  const upg=ePlots.filter(p=>p.cat&&p.level<3); if(upg.length){ const p=upg[Math.floor(rnd()*upg.length)], cost=CAT[p.cat].cost[p.level], wc=UP_WOOD[p.level]; if(eGold>=cost&&eWood>=wc){ eGold-=cost; eWood-=wc; p.level++; eBuildOnPlot(p); } } }
function eBaseTick(dt){ if(!enemyCore)return;
  if(RAIDERS.type!=='base'){ updateStructBar(enemyCore, CORE_H[enemyCore.level-1]); return; }   // camp: lone throne, no economy/AI
  eGold+=eIncome*dt; eWood+=eWoodRate*dt; eRecomputeSupply();
  for(const p of ePlots){ if(p.cat==='defense') eTowerTick(p,dt); else if(p.cat==='army') eBarracksTick(p,dt); }
  enemyAI(dt);
  updateStructBar(enemyCore, CORE_H[enemyCore.level-1]);
  for(const s of eStructs){ if(s.kind==='bld'&&s.alive) updateStructBar(s,4); } }
function foes(){ const a=[]; for(const e of enemies) if(e.alive)a.push(e); for(const s of eStructs) if(s.alive)a.push(s); return a; }
// ================= FOG OF WAR (Siege-Up style) =================
// Grid over the world: unexplored = opaque cloud, explored-but-dark = dimmed, visible = clear.
// Friendly units & buildings project sight; enemy UNITS only render when currently seen,
// enemy STRUCTURES stay as last-seen ghosts once explored (WC3 behaviour).
const FOG_N=128, FOG_HALF=155, FOG_CELL=2*FOG_HALF/FOG_N;
let fogExplored=new Uint8Array(FOG_N*FOG_N), fogVis=new Uint8Array(FOG_N*FOG_N);
let fogCv=null,fogCtx=null,fogTex=null,fogMesh=null,fogMiniCv=null,fogMiniCtx=null,fogRawCv=null,fogRawCtx=null;
function fogIdx(x,z){ const i=Math.floor((x+FOG_HALF)/FOG_CELL), j=Math.floor((z+FOG_HALF)/FOG_CELL);
  if(i<0||j<0||i>=FOG_N||j>=FOG_N)return -1; return j*FOG_N+i; }
function isVisible(x,z){ const k=fogIdx(x,z); return k<0?false:fogVis[k]===1; }
function isExplored(x,z){ const k=fogIdx(x,z); return k<0?false:fogExplored[k]===1; }
function initFog(){
  fogCv=document.createElement('canvas'); fogCv.width=FOG_N; fogCv.height=FOG_N; fogCtx=fogCv.getContext('2d');
  fogRawCv=document.createElement('canvas'); fogRawCv.width=FOG_N; fogRawCv.height=FOG_N; fogRawCtx=fogRawCv.getContext('2d');  // hard-edged source, feathered into fogCv
  fogMiniCv=document.createElement('canvas'); fogMiniCv.width=FOG_N; fogMiniCv.height=FOG_N; fogMiniCtx=fogMiniCv.getContext('2d');
  fogTex=new THREE.CanvasTexture(fogCv); fogTex.magFilter=THREE.LinearFilter; fogTex.minFilter=THREE.LinearFilter;
  // terrain-conforming cloud blanket: a finely displaced grid that hugs the ground profile (~4u above it)
  const geo=new THREE.PlaneGeometry(2*FOG_HALF,2*FOG_HALF,128,128); geo.rotateX(-Math.PI/2);   // same UV↔world mapping as the old flat plane
  const pos=geo.attributes.position;
  for(let i=0;i<pos.count;i++){ const x=pos.getX(i), z=pos.getZ(i); pos.setY(i, Math.max(topY(x,z),-1)+4); }
  pos.needsUpdate=true;
  const m=new THREE.Mesh(geo, new THREE.MeshBasicMaterial({map:fogTex,transparent:true,depthWrite:false}));
  m.renderOrder=50; scene.add(m); fogMesh=m; updateFog(); }
function fogStamp(buf,x,z,r){ const ci=(x+FOG_HALF)/FOG_CELL, cj=(z+FOG_HALF)/FOG_CELL, cr=r/FOG_CELL, cr2=cr*cr;
  const i0=Math.max(0,Math.floor(ci-cr)), i1=Math.min(FOG_N-1,Math.ceil(ci+cr));
  const j0=Math.max(0,Math.floor(cj-cr)), j1=Math.min(FOG_N-1,Math.ceil(cj+cr));
  for(let j=j0;j<=j1;j++) for(let i=i0;i<=i1;i++){ const dx=i+0.5-ci, dz=j+0.5-cj; if(dx*dx+dz*dz<=cr2) buf[j*FOG_N+i]=1; } }
function updateFog(){
  fogVis.fill(0);
  const src=[];
  if(hero&&hero.alive) src.push([hero.px,hero.pz,30]);
  for(const e of allies) if(e.alive) src.push([e.px,e.pz,22]);
  if(coreB) src.push([coreB.x,coreB.z,30]);
  for(const p of plots) if(p.cat) src.push([p.x,p.z,p.cat==='defense'?((p.range||30)+4):24]);   // a tower sees just past its own reach, so it never targets blind
  for(const [x,z,r] of src){ fogStamp(fogVis,x,z,r); fogStamp(fogExplored,x,z,r); }
  if(RITUAL||MAPSHAPE==='arena'){ fogVis.fill(1); fogExplored.fill(1); }   // fixed last-stand arena → fully revealed battlefield (no exploration fog)
  // paint both fog textures from the grids
  const im=fogCtx.createImageData(FOG_N,FOG_N), d=im.data;
  const mi=fogMiniCtx.createImageData(FOG_N,FOG_N), md=mi.data;
  for(let k=0;k<FOG_N*FOG_N;k++){ const o=k*4;
    if(fogVis[k]){ d[o+3]=0; md[o+3]=0; }
    else if(fogExplored[k]){ d[o]=8;d[o+1]=12;d[o+2]=18;d[o+3]=165;  md[o]=0;md[o+1]=0;md[o+2]=0;md[o+3]=120; }   // seen before: dark dim
    else { d[o]=3;d[o+1]=5;d[o+2]=9;d[o+3]=255;  md[o]=3;md[o+1]=5;md[o+2]=9;md[o+3]=245; } }                       // unexplored: black (hidden)
  // Hard-edged grid → fogRawCv, then feather into fogCv so the reveal edge is a soft alpha
  // ramp. A soft ramp magnifies cleanly across the mesh; a 1-texel-hard edge combs into
  // horizontal streaks when linearly interpolated over triangles bigger than a texel.
  fogRawCtx.putImageData(im,0,0);
  fogCtx.clearRect(0,0,FOG_N,FOG_N);
  fogCtx.filter='blur(1.6px)'; fogCtx.drawImage(fogRawCv,0,0); fogCtx.filter='none';
  fogMiniCtx.putImageData(mi,0,0); if(fogTex)fogTex.needsUpdate=true;
  // enemy presence honours the fog: units render only in live sight, structures once explored
  for(const e of enemies){ const v=e.alive&&isVisible(e.px,e.pz); e.__vis=v; if(e.g)e.g.visible=v; if(!v&&e.bar)e.bar.visible=false; }
  for(const s of eStructs){ const v=s.alive&&isExplored(s.px,s.pz); s.__vis=v&&isVisible(s.px,s.pz); if(s.g)s.g.visible=v; if(!s.__vis&&s.bar)s.bar.visible=false; }
  for(const p of ePlots){ if(p.g) p.g.visible=isExplored(p.x,p.z); } }
// build-menu DOM (styled panel built in setupHUD; these open/populate it)
// ---------- inline-SVG icon set (crisp, theme-aware; currentColor so button colour tints them) ----------
const ICON={
  house:'<path d="M3 11l9-7 9 7"/><path d="M6 9.5V20h12V9.5"/><path d="M10 20v-5h4v5"/>',
  mine:'<path d="M6 3h12l3 6-9 12L3 9z"/><path d="M3 9h18"/><path d="M9 3l3 6 3-6"/>',
  lumber:'<circle cx="7.5" cy="9" r="3"/><circle cx="16.5" cy="9" r="3"/><circle cx="12" cy="15.5" r="3"/>',
  barracks:'<path d="M6 3v18"/><path d="M6 4h12l-3 3.5L18 11H6"/>',
  tower:'<path d="M7 21V8l5-4 5 4v13"/><path d="M7 8h10"/><path d="M10 21v-4h4v4"/><path d="M8 5h1.5M11.2 3h1.6M14.5 5H16"/>',
  warrior:'<path d="M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6z"/>',
  archer:'<path d="M5 4a13 13 0 0 1 0 16"/><path d="M5 4v16"/><path d="M5 12h13"/><path d="M15 9l4 3-4 3"/>',
  cleric:'<path d="M12 22V9"/><circle cx="12" cy="6" r="3"/><path d="M9 22h6"/>',
  sword:'<path d="M15 4h5v5l-9 9-3 1 1-3z"/><path d="M6.5 17.5L3 21"/><path d="M13 6l5 5"/>',
  fist:'<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.5 5.5l2 2M16.5 16.5l2 2M18.5 5.5l-2 2M5.5 18.5l2-2"/>',
  bolt:'<path d="M13 2L4 14h6l-1 8 9-12h-6z" fill="currentColor" stroke="none"/>',
  smite:'<circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5.2 5.2l2.1 2.1M16.7 16.7l2.1 2.1M18.8 5.2l-2.1 2.1M5.2 18.8l2.1-2.1"/>',
  swords:'<path d="M5 5l9 9M14.5 14.5L17 17"/><path d="M19 5l-9 9M9.5 14.5L7 17"/><path d="M16 5h3v3M8 5H5v3"/>',
  recall:'<path d="M9 14l-4-4 4-4"/><path d="M5 10h9a5 5 0 0 1 0 10h-4"/>',
  upgrade:'<path d="M12 20V6"/><path d="M6 12l6-6 6 6"/>',
  sell:'<ellipse cx="12" cy="6" rx="7" ry="2.6"/><path d="M5 6v11c0 1.5 3.1 2.6 7 2.6s7-1.1 7-2.6V6"/><path d="M5 11.5c0 1.5 3.1 2.6 7 2.6s7-1.1 7-2.6"/>',
  star:'<path d="M12 2.5l2.8 6 6.6.6-5 4.4 1.5 6.4L12 16.9 6.1 20.3l1.5-6.4-5-4.4 6.6-.6z" fill="currentColor" stroke="none"/>',
  wood:'<rect x="3" y="9" width="18" height="6" rx="3"/><circle cx="6.5" cy="12" r="1.6"/>',
  tent:'<path d="M12 4L3 20h18z"/><path d="M12 4v16"/><path d="M9.5 20l2.5-4.5 2.5 4.5"/>',
  select:'<rect x="3.5" y="3.5" width="11" height="11" rx="1.5" stroke-dasharray="3.4 2.4"/><path d="M13 13l7 7"/><path d="M13 13l1.2 4.6 1.7-1.7 1.7-1.7z" fill="currentColor" stroke="none"/>',
  stop:'<rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" stroke="none"/>',
  close:'<path d="M6 6l12 12M18 6L6 18"/>',
  blink:'<path d="M3 12h7"/><path d="M7 8l4 4-4 4"/><circle cx="17" cy="12" r="3.2" stroke-dasharray="2.4 2.2"/>',
  fan:'<path d="M12 12V3.5"/><path d="M12 12l7.4-4.3"/><path d="M12 12l7.4 4.3"/><path d="M12 12l-7.4 4.3"/><path d="M12 12l-7.4-4.3"/><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none"/>',
  shadow:'<path d="M12 3l3.2 9.2L12 15.4 8.8 12.2z"/><path d="M12 15.4V19"/><circle cx="12" cy="20.6" r="1.2" fill="currentColor" stroke="none"/>',
  holy:'<circle cx="12" cy="12" r="3.4"/><path d="M12 2v3.2M12 18.8V22M2 12h3.2M18.8 12H22M4.9 4.9l2.3 2.3M16.8 16.8l2.3 2.3M19.1 4.9l-2.3 2.3M4.9 19.1l2.3-2.3"/>',
  hammer:'<path d="M5 20l7-7"/><path d="M12.5 5.5l6 6"/><path d="M10 4.5l7 7 2.2-2.2a2.2 2.2 0 0 0 0-3.1l-3.9-3.9a2.2 2.2 0 0 0-3.1 0z"/>',
  shield:'<path d="M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6z"/><path d="M9.2 12l2 2 3.6-4"/>',
  hold:'<rect x="6.5" y="5.5" width="3.6" height="13" rx="1.2"/><rect x="13.9" y="5.5" width="3.6" height="13" rx="1.2"/>',
  amove:'<circle cx="12" cy="12" r="7"/><path d="M12 2.5v3.2M12 18.3v3.2M2.5 12h3.2M18.3 12h3.2"/><circle cx="12" cy="12" r="1.7" fill="currentColor" stroke="none"/>',
  drake:'<path d="M12 4c1.6 1.4 1.6 3.6 0 5-1.6-1.4-1.6-3.6 0-5z"/><path d="M12 9c-2.5 0-4.5 1.5-4.5 4 0 2 1.2 4 4.5 6 3.3-2 4.5-4 4.5-6 0-2.5-2-4-4.5-4z"/><path d="M7.5 11L3 8l1.5 5 3 1M16.5 11L21 8l-1.5 5-3 1"/>',
  heart:'<path d="M12 20s-7-4.5-9.2-9C1.3 8 2.8 4.5 6 4.5c2 0 3.2 1.2 4 2.4.8-1.2 2-2.4 4-2.4 3.2 0 4.7 3.5 3.2 6.5C19 15.5 12 20 12 20z" fill="currentColor" stroke="none"/>',
  roster:'<path d="M8 6h13M8 12h13M8 18h13"/><path d="M3.5 6h.01M3.5 12h.01M3.5 18h.01"/>',
};
function ic(n){ const p=ICON[n]; return p?('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'+p+'</svg>'):''; }
const catIcon={economy:'house',mine:'mine',lumber:'lumber',army:'barracks',defense:'tower'}, catName={economy:'House',mine:'Gold Mine',lumber:'Lumber Mill',army:'Barracks',defense:'Tower'};
function catEffect(cat,lv){ const c=CAT[cat], i=lv-1;
  if(cat==='mine') return '+'+c.income[i]+' gold / sec';
  if(cat==='lumber') return '+'+c.woodInc[i]+' wood / sec';
  if(cat==='economy') return '+'+c.pop[i]+' population';
  if(cat==='army') return 'Train troops here';
  return c.dmg[i]+' dmg · '+Math.round(c.range[i])+' range'; }
function sellValue(p){ let spent=0; for(let i=0;i<p.level;i++) spent+=CAT[p.cat].cost[i]; return Math.floor(spent*0.6); }
// radial menu: options fan out around a screen point (cx,cy). items:{icon,label,cost,ok,fn,cls}
function radialOpen(cx,cy,title,items){ if(!buildMenuEl)return;
  cx=Math.max(120,Math.min(innerWidth-120,cx)); cy=Math.max(150,Math.min(innerHeight-150,cy));
  buildMenuEl.className='radial'; buildMenuEl.innerHTML=''; buildMenuEl.style.left=cx+'px'; buildMenuEl.style.top=cy+'px';
  const hub=document.createElement('div'); hub.className='rHub'; hub.textContent=title; buildMenuEl.appendChild(hub);
  const n=items.length, R=94, step=Math.PI/3.2, span=(n-1)*step, start=-Math.PI/2-span/2;
  items.forEach((it,i)=>{ const ang=n===1?-Math.PI/2:start+step*i, bx=Math.cos(ang)*R, by=Math.sin(ang)*R;
    const b=document.createElement('div'); b.className='rBtn'+(it.cls?(' '+it.cls):'')+(it.ok===false?' no':(it.cost&&it.cls!=='sell'?' buy':''));
    b.style.left=bx+'px'; b.style.top=by+'px';
    b.innerHTML='<div class="ri">'+it.icon+'</div>'+(it.cost!=null?('<div class="rc">'+it.cost+'</div>'):'');
    b.addEventListener('pointerdown',ev=>{ ev.stopPropagation(); if(it.ok!==false&&it.fn)it.fn(); }); buildMenuEl.appendChild(b);
    const lb=document.createElement('div'); lb.className='rLb'; lb.style.left=bx+'px'; lb.style.top=(by+36)+'px'; lb.textContent=it.label; buildMenuEl.appendChild(lb); });
  bmBack.style.display='block'; buildMenuEl.style.display='block'; }
function openPlotMenu(p){ if(!buildMenuEl||p.locked)return; menuPlot=p; menuAnchor={x:p.x,z:p.z}; const g=Math.floor(gold), w=Math.floor(wood); const [cx,cy]=screenOf(p.x,p.z); let items;
  // upgrade cost label + affordability (gold + wood)
  const upItem=()=>{ const gc=CAT[p.cat].cost[p.level], wc=UP_WOOD[p.level];
    return {icon:ic('upgrade'), label:'Upgrade', cost:gc+'g · '+wc+'w', ok:g>=gc&&w>=wc, fn:()=>upgradePlot(p)}; };
  const sellItem=()=>({icon:ic('sell'), label:'Sell', cost:'+'+sellValue(p)+'g', cls:'sell', ok:true, fn:()=>sellPlot(p)});
  if(!p.cat){ let opts = p.slot==='turret' ? ['defense'] : ['economy','mine','lumber','army','defense'];   // turret spots are defense-only
    if(ALLOWED_BUILD) opts=opts.filter(k=>ALLOWED_BUILD.includes(k));   // early levels unlock only some buildings
    items=opts.map(k=>{ const cost=CAT[k].cost[0]; return {icon:ic(catIcon[k]), label:catName[k], cost:cost+'g', ok:g>=cost, fn:()=>startBuild(p,k)}; });
    radialOpen(cx,cy,(p.slot==='turret'?'Turret spot · ':'Build · ')+g+'g · '+Math.round(supplyUsed)+'/'+supplyCap+' pop',items); }
  else if(p.cat==='army'){ items=TRAIN.filter(t=>t.minLvl<=p.level).map(t=>({icon:ic(t.icon), label:t.label, cost:t.gold+'g',
        ok: g>=t.gold && supplyUsed+t.sup<=supplyCap, fn:()=>queueUnit(p,t)}));   // train (gold + supply gated)
    if(p.level<3) items.push(upItem());
    items.push(sellItem());
    const q=(p.queue&&p.queue.length)?(' · '+p.queue.length+' queued'):'';
    radialOpen(cx,cy,'Barracks L'+p.level+q+' · '+Math.round(supplyUsed)+'/'+supplyCap+' pop',items); }
  else { items=[]; if(p.level<3) items.push(upItem()); else items.push({icon:ic('star'), label:'Max', ok:false});
    items.push(sellItem());
    radialOpen(cx,cy,catName[p.cat]+' L'+p.level,items); } }
function openCoreMenu(){ if(!buildMenuEl||!coreB)return; menuPlot=null; menuAnchor={x:coreB.x,z:coreB.z}; const g=Math.floor(gold), w=Math.floor(wood); const [cx,cy]=screenOf(coreB.x,coreB.z);
  const items=[]; if(coreB.level<3){ const gc=CORE_UP[coreB.level], wc=CORE_WOOD[coreB.level]; items.push({icon:ic('upgrade'), label:'Expand base', cost:gc+'g · '+wc+'w', ok:g>=gc&&w>=wc, fn:()=>upgradeCore()}); }
  else items.push({icon:ic('star'), label:'Max', ok:false});
  radialOpen(cx,cy,'Throne L'+coreB.level+' · '+Math.ceil(coreB.hp)+'hp',items); }
function sellPlot(p){ if(!p.cat)return; gold+=sellValue(p); if(p.g)scene.remove(p.g); p.g=null;
  p.cat=null; p.level=0; p.dmg=p.range=p.rof=p.every=p.cap=undefined; p.mine=[]; p.queue=[]; if(p.pbar)p.pbar.visible=false;
  styleRing(p); recomputeIncome(); recomputeSupply(); closeBuildMenu(); }
function closeBuildMenu(){ if(buildMenuEl) buildMenuEl.style.display='none'; if(bmBack)bmBack.style.display='none'; menuPlot=null; menuAnchor=null; setBuildBtn(false); }
// ---- one-tap build entry: a hammer button that expands the nearest buildable plot's radial (and collapses it) ----
function setBuildBtn(on){ if(buildBtnEl) buildBtnEl.classList.toggle('on',!!on); }
function nearestBuildPlot(){ let best=null,bd=1e9; const ax=hero?hero.px:camAim.x, az=hero?hero.pz:camAim.z;
  for(const p of plots){ if(p.cat||p.locked)continue; const d=Math.hypot(p.x-ax,p.z-az); if(d<bd){bd=d;best=p;} }
  return best; }
function toggleBuildMenu(){ if(!buildMenuEl)return;
  if(buildMenuEl.style.display==='block'){ closeBuildMenu(); return; }   // collapse if already open
  const p=nearestBuildPlot();
  if(p) openPlotMenu(p); else if(coreB) openCoreMenu();                  // expand: empty plot → build; else the throne (expand base)
  setBuildBtn(true); }
// keep the open radial glued to its plot as the camera pans/follows the hero
function repositionRadial(){ if(!buildMenuEl||!menuAnchor||buildMenuEl.style.display!=='block')return;
  let [cx,cy]=screenOf(menuAnchor.x,menuAnchor.z);
  cx=Math.max(120,Math.min(innerWidth-120,cx)); cy=Math.max(150,Math.min(innerHeight-150,cy));
  buildMenuEl.style.left=cx+'px'; buildMenuEl.style.top=cy+'px'; }
function makeKeep(){
  const b=bldClone('keep',14); if(b) return b;   // Bitgem elf throne — the heart of the settlement
  const g=new THREE.Group();
  const base=box(13,7,13,C.stone); base.position.y=3.5; g.add(base);
  // crenellations around base top
  const s=6.5, y=7.4;
  for(let i=-2;i<=2;i++){ for(const [px,pz] of [[i*2.8,s],[i*2.8,-s],[s,i*2.8],[-s,i*2.8]]){
    const c=box(1.6,1.8,1.6,C.stoneShade); c.position.set(px,y,pz); g.add(c);
  }}
  const tower=box(6,10,6,C.stone); tower.position.y=11; g.add(tower);
  for(let i=-1;i<=1;i++){ for(const [px,pz] of [[i*2.2,3],[i*2.2,-3],[3,i*2.2],[-3,i*2.2]]){
    const c=box(1.3,1.6,1.3,C.stoneShade); c.position.set(px,16.3,pz); g.add(c);
  }}
  // banner
  const pole=new THREE.Mesh(new THREE.CylinderGeometry(0.2,0.2,6,5),lam(C.woodDark)); pole.position.set(0,19,0); g.add(pole);
  const flag=box(3,1.8,0.2,C.teamBlue); flag.position.set(1.6,20.5,0); g.add(flag);
  g.traverse(o=>{if(o.isMesh)o.castShadow=o.receiveShadow=true;});
  return outlined(g);
}
function makeWatchtower(){
  const b=bldClone('tower',15); if(b) return b;   // Bitgem elf tower
  const g=new THREE.Group();
  for(const [sx,sz] of [[1,1],[1,-1],[-1,1],[-1,-1]]){
    const leg=new THREE.Mesh(new THREE.CylinderGeometry(0.4,0.4,9,5),lam(C.woodDark));
    leg.position.set(sx*2,4.5,sz*2); leg.rotation.set(sz*0.08,0,-sx*0.08); g.add(leg);
  }
  const plat=box(6,1,6,C.wood); plat.position.y=9.2; g.add(plat);
  const rail=box(6.2,1.6,6.2,C.woodDark); rail.position.y=10.3; g.add(rail);
  const inner=box(4.6,1.7,4.6,C.wood); inner.position.y=10.35; g.add(inner);
  const roof=new THREE.Mesh(new THREE.ConeGeometry(4.6,3,4),lam(C.roof,true)); roof.rotation.y=Math.PI/4; roof.position.y=12.6; g.add(roof);
  g.traverse(o=>{if(o.isMesh)o.castShadow=o.receiveShadow=true;});
  return outlined(g);
}
function makeWindmill(){
  const b=bldClone('mill',12); if(b) return b;   // Bitgem elf woodcutter
  const g=new THREE.Group();
  const tower=new THREE.Mesh(new THREE.CylinderGeometry(2.4,3.2,8,8),lam(C.cream)); tower.position.y=4; g.add(tower);
  const cap=new THREE.Mesh(new THREE.ConeGeometry(2.8,2.4,8),lam(C.roof,true)); cap.position.y=9; g.add(cap);
  const hub=new THREE.Group(); hub.position.set(0,7.5,2.6);
  for(let i=0;i<4;i++){ const sail=box(1.4,7,0.3,C.wood); sail.position.y=0; sail.rotation.z=i*Math.PI/2;
    const holder=new THREE.Group(); holder.rotation.z=i*Math.PI/2; const s=box(1.3,6.5,0.25,C.cream); s.position.y=3.5; holder.add(s); hub.add(holder);
  }
  g.add(hub);
  g.traverse(o=>{if(o.isMesh)o.castShadow=o.receiveShadow=true;});
  return outlined(g);
}
function makeWall(len){
  const g=new THREE.Group();
  for(let i=0;i<len;i++){ const p=box(1.5,3.2,1.8,i%2?C.woodDark:C.wood); p.position.set(i*1.6-len*0.8,1.6,0); g.add(p);}
  g.traverse(o=>{if(o.isMesh)o.castShadow=o.receiveShadow=true;});
  return outlined(g);
}
function makeRock(){
  const r=natClone('rock',2,4.5); if(r) return r;
  const m=new THREE.Mesh(new THREE.IcosahedronGeometry(1.6+rnd()*1.4,0),lam(C.rock,true)); m.castShadow=true; m.receiveShadow=true;
  m.rotation.set(rnd(),rnd(),rnd()); return outlined(new THREE.Group().add(m));
}

// ---------- units ----------
function makeUnit(bodyHex,scale){
  const g=new THREE.Group(); scale=scale||1;
  const body=new THREE.Mesh(new THREE.CapsuleGeometry(0.5,1.0,3,6),lam(bodyHex)); body.position.y=1.0; g.add(body);
  const head=new THREE.Mesh(new THREE.SphereGeometry(0.42,8,8),lam(C.skin)); head.position.y=2.0; g.add(head);
  const spear=new THREE.Mesh(new THREE.CylinderGeometry(0.07,0.07,3,5),lam(C.woodDark)); spear.position.set(0.5,1.4,0); spear.rotation.z=0.15; g.add(spear);
  g.traverse(o=>{if(o.isMesh)o.castShadow=true;});
  g.scale.setScalar(scale);
  return outlined(g);
}
// Ironroot: a cluster of dark iron root-spikes clawing out of the ash, veined with molten ore-glow.
// The signature of the Verath Floor — "ironstone beyond counting." Decorative map dressing.
function makeIronroot(scale){ scale=scale||1; const solid=new THREE.Group();
  const base=new THREE.Mesh(new THREE.IcosahedronGeometry(1.05,0), lam(0x2f353b,true)); base.scale.set(1.3,0.55,1.3); base.position.y=0.25; base.castShadow=true; base.receiveShadow=true; solid.add(base);
  const n=3+Math.floor(rnd()*3);
  for(let i=0;i<n;i++){ const a=rnd()*6.28, r=0.2+rnd()*0.8, h=1.5+rnd()*1.9;
    const spike=new THREE.Mesh(new THREE.ConeGeometry(0.2+rnd()*0.14, h, 5), lam(0x434b53,true));
    spike.position.set(Math.cos(a)*r, h*0.4, Math.sin(a)*r);
    spike.rotation.set((rnd()*0.5-0.25)+Math.sin(a)*0.28, rnd()*6.28, (rnd()*0.5-0.25)-Math.cos(a)*0.28);   // lean outward
    spike.castShadow=true; solid.add(spike); }
  const g=new THREE.Group(); g.add(outlined(solid));
  for(let i=0;i<4;i++){ const a=rnd()*6.28,r=rnd()*0.95; const e=new THREE.Mesh(new THREE.SphereGeometry(0.15+rnd()*0.13,8,6),
      new THREE.MeshBasicMaterial({color:0xff7a2a,transparent:true,opacity:0.85,blending:THREE.AdditiveBlending,depthWrite:false}));
    e.position.set(Math.cos(a)*r, 0.22+rnd()*0.55, Math.sin(a)*r); g.add(e); }
  g.scale.setScalar(scale); return g; }
function place(obj,x,z,ry){ obj.position.set(x,topY(x,z),z); if(ry!=null)obj.rotation.y=ry; scene.add(obj); return obj; }

// ---------- assemble ----------
// ===== DATA-DRIVEN LEVELS =====
// build() spins up a fresh scene each call, so switching maps = set the active map vars (SEAS/PATHS/
// FLATS/PBASE/EBASE/PLOTDEF + RAIDERS/LVCREEPS/LVSTART) then re-run build()+spawnGame(). The skirmish
// map is the default; tutorial levels supply their own compact layouts + a gated coach script.
const PLOTDEF_DEFAULT=[
  {r:19,a:90,t:1,s:'gen'},{r:19,a:210,t:1,s:'gen'},{r:19,a:330,t:1,s:'gen'},
  {r:21,a:30,t:2,s:'gen'},{r:21,a:150,t:2,s:'gen'},{r:21,a:270,t:2,s:'gen'},
  {r:31,a:0,t:2,s:'turret'},{r:31,a:90,t:2,s:'turret'},{r:31,a:180,t:2,s:'turret'},{r:31,a:270,t:2,s:'turret'},
  {r:37,a:30,t:3,s:'gen'},{r:37,a:150,t:3,s:'gen'},{r:37,a:270,t:3,s:'gen'},
  {r:37,a:90,t:3,s:'turret'},{r:37,a:210,t:3,s:'turret'},{r:37,a:330,t:3,s:'turret'},
];
let PBASE={x:105,z:108}, PLOTDEF=PLOTDEF_DEFAULT, RAIDERS={type:'base'}, LVSTART=['warrior','archer'], LVCREEPS=[], LVID='skirmish', LVGOLD=180, ALLOWED_BUILD=null, LVIRONROOTS=0, LVVEIN=null, _vein=null, _veinFound=false;
let BLDPFX='', URIG={warrior:'warrior',archer:'archer',cleric:'priestess'};   // player faction: building-key prefix + archetype->rig model
let RITUAL=null, ritualT=0, ritualDone=false, ritualCasters=[], _ritWaves=[], _ritRing=null;   // channel-defense mission state
const LEVELS={
  skirmish:{ seas:[{cx:80,cz:-82,r:60},{cx:-80,cz:82,r:60},{cx:22,cz:-30,r:24},{cx:-22,cz:30,r:24}],
    paths:[[[105,108],[60,60],[6,6],[-52,-52],[-105,-108]]], flats:[{x:105,z:108,r:50,y:0.4},{x:-105,z:-108,r:50,y:0.4}],
    pbase:{x:105,z:108}, ebase:{x:-105,z:-108}, plots:PLOTDEF_DEFAULT, raiders:{type:'base'}, start:['warrior','archer'], gold:180,
    // The Deepvein dead crawl up the ironstone veins along the Reach — risen camps on the flanks of
    // the SE→NW lane, away from both keeps. Clear them for bounty; leave them and they hold the sides.
    creeps:[{name:'Cairn of the Risen', bounty:90,  at:[58,20],  roster:['uwarrior','uwarrior','uarcher']},
            {name:'Ashen Barrow',       bounty:120, at:[-58,-20],roster:['uwarrior','uassassin','umage']},
            {name:'The Barrow King',    bounty:230, at:[18,62],  roster:['uking','uwarrior','uworker']}] },
  // ---- Tutorial 1: The Survey Road — a winding land corridor over the frozen sea ----
  a1m1:{ shape:'road', roadW:28, seas:[],
    paths:[[[108,96],[70,48],[24,10],[-30,-34],[-78,-84],[-112,-112]],
           [[24,10],[48,-6],[66,-22]]],   // + a side inlet branching off the mid-arena to the ironroot vein
    flats:[{x:108,z:96,r:26,y:0.4},{x:-112,z:-112,r:24,y:0.4},{x:24,z:10,r:20,y:0.4},{x:66,z:-22,r:16,y:0.4}],   // outpost · raider · mid arena · inlet pocket
    pbase:{x:108,z:96}, ebase:{x:-112,z:-112},
    plots:[{r:15,a:60,t:1,s:'gen'},{r:15,a:300,t:1,s:'gen'},{r:20,a:223,t:1,s:'turret'}],   // turret faces the raider camp (SW)
    raiders:{type:'camp', hp:900, guards:['orcgrunt','orcgrunt','orcarcher']},
    build:['army','defense'],   // early level: only Barracks + Tower
    ironroots:16, vein:[66,-22],   // a great ironroot vein down a side inlet — scouted mid-mission
    pbld:'human_', units:{warrior:'hfootman',archer:'harcher',cleric:'hmage'},   // Iron Crown faction
    start:['warrior','warrior','archer'], gold:260,
    creeps:[{name:'Road Hounds', bounty:60, at:[72,50], roster:['cinderhound','cinderhound']},
            {name:'Ash Pack', bounty:110, at:[28,14], roster:['cinderhound','cinderhound','emberspitter']}] },
  // ---- Tutorial 2: Beachhead — a wider ford-road with two creep camps ----
  a1m2:{ shape:'road', roadW:34, seas:[],
    paths:[[[104,-96],[54,-46],[0,6],[-52,58],[-100,100]]],
    flats:[{x:104,z:-96,r:30,y:0.4},{x:-100,z:100,r:26,y:0.4},{x:0,z:6,r:22,y:0.4}],
    pbase:{x:104,z:-96}, ebase:{x:-100,z:100},
    plots:[{r:16,a:300,t:1,s:'gen'},{r:16,a:340,t:1,s:'gen'},{r:16,a:20,t:1,s:'gen'},{r:23,a:120,t:2,s:'turret'},{r:23,a:156,t:2,s:'turret'}],   // turrets face the raider camp (NW)
    raiders:{type:'camp', hp:1500, guards:['orcgrunt','orcgrunt','orcwarrior','orcarcher']},
    build:['economy','army','defense'],   // adds the House (supply) this level
    ironroots:14,
    pbld:'human_', units:{warrior:'hfootman',archer:'harcher',cleric:'hmage'},   // Iron Crown faction
    start:['warrior','archer'], gold:220,
    creeps:[{name:'Cinder Pack', bounty:70, at:[54,-46], roster:['cinderhound','cinderhound']},
            {name:'Boar Wallow', bounty:120, at:[0,6], roster:['direboar','cinderhound']}] },
  // ---- Act II: The Sealing Rite — defend the channel while the Unveiled (undead) assail it ----
  a2m1:{ shape:'arena', arenaR:74, seas:[], paths:[[[0,0],[0,-2]]], flats:[{x:0,z:0,r:64,y:0.4}],
    pbase:{x:0,z:0}, ebase:{x:0,z:70},
    plots:[{r:20,a:0,t:1,s:'turret'},{r:20,a:72,t:1,s:'turret'},{r:20,a:144,t:1,s:'turret'},{r:20,a:216,t:1,s:'turret'},{r:20,a:288,t:1,s:'turret'}],
    raiders:{type:'none'}, build:['defense'],   // no raider base; hold the altar, raise towers to defend
    pbld:'human_', units:{warrior:'hfootman',archer:'harcher',cleric:'hmage'},
    start:['warrior','warrior','archer'], gold:340,
    ritual:{ duration:150, casters:2, spawnR:70,
      // the Unveiled rise in escalating waves as the seal weakens, culminating in the Barrow King
      waves:[ {at:6,  s:[['uworker',3],['uwarrior',1]]},
              {at:28, s:[['uwarrior',3],['uarcher',1]]},
              {at:52, s:[['uwarrior',2],['umage',2]]},
              {at:78, s:[['uassassin',2],['uwarrior',3]]},
              {at:104,s:[['uking',1],['uwarrior',2],['umage',2]]},
              {at:130,s:[['uwarrior',4],['uarcher',2],['uassassin',2]] } ] } },
};
function applyLevel(id){ const L=LEVELS[id]||LEVELS.skirmish; LVID=id in LEVELS?id:'skirmish';
  MAPSHAPE=L.shape||'island'; ROAD_W=L.roadW||32; ARENA_R=L.arenaR||72; RITUAL=L.ritual||null;
  SEAS=(L.seas||[]).map(s=>({...s})); PATHS=L.paths.map(p=>p.map(pt=>pt.slice())); FLATS=L.flats.map(f=>({...f}));
  PBASE={...L.pbase}; enemyBase={...L.ebase}; PLOTDEF=L.plots; RAIDERS=L.raiders; LVSTART=L.start.slice(); LVCREEPS=(L.creeps||[]).map(c=>({...c})); LVGOLD=L.gold||180; ALLOWED_BUILD=L.build||null; LVIRONROOTS=L.ironroots||0; LVVEIN=L.vein?{x:L.vein[0],z:L.vein[1]}:null;
  BLDPFX=L.pbld||''; URIG=L.units||{warrior:'warrior',archer:'archer',cleric:'priestess'}; }
function resetWorld(){ allies=[]; enemies=[]; eStructs=[]; ePlots=[]; plots=[]; creepCamps=[]; fires=[];
  coreB=null; enemyCore=null; gold=LVGOLD; wood=0; incomeRate=1; woodRate=0; eGold=130; eWood=0; eIncome=1; eWoodRate=0;
  spawnLeft=0; spawnN=0; killed=0; gameOver=0; if(typeof selected!=='undefined')selected.clear(); camAim.init=false; hero=null;
  if(typeof orderMarkers!=='undefined')orderMarkers.length=0; if(typeof holyGrounds!=='undefined')holyGrounds.length=0;
  ritualT=0; ritualDone=false; ritualCasters=[]; _ritWaves=[]; _ritRing=null; if(typeof disposeHeroAura==='function')disposeHeroAura(); }
function build(){
  scene=new THREE.Scene();
  if(renderPass) renderPass.scene=scene;   // build() makes a fresh scene each mission — repoint the composer's render pass at it (else it keeps drawing the stale boot scene: black, fog-smothered)
  scene.background=new THREE.Color(0x3f9fd6);
  scene.fog=new THREE.Fog(0x3f9fd6, 520, 1050);   // pushed out for the bigger map

  // lights — WC3-Reforged style: warm key sun, cool sky fill, cool back-rim for separation
  scene.add(new THREE.HemisphereLight(0xcfe8ff,0x3e5c46,0.62));   // brighter sky fill + lifted ground bounce (was 0.42 — cleaner daylit look, less dim-CRT)
  const dir=new THREE.DirectionalLight(0xffe6bc,1.28);            // stronger, warmer key sun
  dir.position.copy(sun.clone().multiplyScalar(120)); dir.castShadow=true;
  dir.shadow.mapSize.set(2048,2048);   // higher-res + softer shadows read more cinematic
  const sc=dir.shadow.camera; sc.left=-105;sc.right=105;sc.top=105;sc.bottom=-105;sc.near=20;sc.far=360;
  dir.shadow.bias=-0.0004; dir.shadow.normalBias=1.4; dir.shadow.radius=4.5;
  scene.add(dir); scene.add(dir.target); sunLight=dir;   // shadow frustum tracks the camera focus (keeps shadows sharp on a big map)
  const rim=new THREE.DirectionalLight(0x7c93cf,0.4);            // cool back-fill so silhouettes pop against the ground
  rim.position.set(-sun.x*120, 70, -sun.z*120); scene.add(rim);

  // water — animated shader sea (cold ashen palette): undulating surface, scrolling ripple normals,
  // sun glint + fresnel edge brightening, semi-transparent. The archipelago sits in it.
  waterMat=new THREE.ShaderMaterial({
    transparent:true, fog:true, depthWrite:false,
    uniforms:Object.assign({
      uTime:{value:0}, uSun:{value:sun.clone()},
      uDeep:{value:new THREE.Color(0x28536e)}, uShallow:{value:new THREE.Color(0x4f95bd)}
    }, THREE.UniformsLib.fog),
    vertexShader:[
      '#include <fog_pars_vertex>',
      'uniform float uTime; varying vec3 vW;',
      'void main(){ vec3 p=position;',
      '  float w=sin(p.x*0.045+uTime*0.9)*0.55 + sin(p.y*0.05-uTime*0.7)*0.55; p.z+=w;',
      '  vec4 wp=modelMatrix*vec4(p,1.0); vW=wp.xyz;',
      '  vec4 mvPosition=modelViewMatrix*vec4(p,1.0); gl_Position=projectionMatrix*mvPosition;',
      '  #include <fog_vertex>',
      '}'
    ].join('\n'),
    fragmentShader:[
      '#include <fog_pars_fragment>',
      'uniform float uTime; uniform vec3 uSun,uDeep,uShallow; varying vec3 vW;',
      'void main(){',
      '  vec2 q=vW.xz*0.09; float t=uTime;',
      '  vec3 n=normalize(vec3(sin(q.x*3.0+t*1.2)*0.28 + sin((q.x+q.y)*1.7+t*1.5)*0.18, 1.0, sin(q.y*2.3-t*0.9)*0.28));',
      '  vec3 V=normalize(cameraPosition-vW); vec3 L=normalize(uSun); vec3 H=normalize(L+V);',
      '  float spec=pow(max(dot(n,H),0.0),64.0);',
      '  float fres=pow(1.0-max(dot(V,vec3(0.0,1.0,0.0)),0.0),3.0);',
      '  vec3 col=mix(uDeep,uShallow,clamp(fres*1.3+0.22,0.0,1.0));',
      '  col+=vec3(0.05,0.09,0.13);',                          // cool sky-fill so it never reads black from above',
      '  col+=vec3(1.0,0.97,0.88)*spec*0.9;',                  // warm sun sparkle
      '  gl_FragColor=vec4(col,0.92);',
      '  #include <fog_fragment>',
      '}'
    ].join('\n')
  });
  const water=new THREE.Mesh(new THREE.CircleGeometry(620,72), waterMat);
  water.rotation.x=-Math.PI/2; water.position.set(0,-15,0); water.renderOrder=-1; scene.add(water);
  // drifting ash motes — cheap atmosphere that suits the ashen basin
  { const N=240, mp=new Float32Array(N*3);
    for(let i=0;i<N;i++){ mp[i*3]=rr(-210,210); mp[i*3+1]=rr(2,62); mp[i*3+2]=rr(-210,210); }
    const mg=new THREE.BufferGeometry(); mg.setAttribute('position',new THREE.BufferAttribute(mp,3));
    motes=new THREE.Points(mg,new THREE.PointsMaterial({color:0xcfc6b6,size:0.7,transparent:true,opacity:0.32,depthWrite:false,fog:true,sizeAttenuation:true}));
    motes.frustumCulled=false; scene.add(motes); }

  scene.add(buildTerrain());

  // forests: snow trees lining the coast just inland of the beach shelf, plus forested hills on the
  // flanks. Everything stays clear of the central battle lane (pathDist>14) so the corridor between
  // the two bases reads open and fightable.
  for(let x=-WORLD;x<=WORLD;x+=8) for(let z=-WORLD;z<=WORLD;z+=8){
    const jx=x+rr(-3,3), jz=z+rr(-3,3); const f=landField(jx,jz);
    if(f>0.13 && f<0.30 && pathDist(jx,jz)>14 && rnd()<0.42) scene.add(forestClump(jx,jz,2,7)); }  // coastal tree line
  for(const [hx,hz] of [[-60,12],[60,-12],[22,62],[-22,-62],[78,-38],[-78,38],[128,64],[-128,-64]]){
    if(!onIsland(hx,hz)) continue;
    for(let k=0;k<16;k++){ const a=rnd()*6.28,d=rr(0,22); const x=hx+Math.cos(a)*d,z=hz+Math.sin(a)*d;
      if(onIsland(x,z)&&pathDist(x,z)>12) scene.add(forestClump(x,z,3,12)); } }   // flank forested hill
  // neutral midpoint — a ring of standing snow-stones framing the contested centre; the lane stays open
  for(let i=0;i<7;i++){ const a=i/7*6.28, x=Math.cos(a)*20, z=Math.sin(a)*20;
    if(onIsland(x,z)&&pathDist(x,z)>7) place(makeRock(),x,z); }

  // Base-expansion layout (per the concept sheet): plots gated by Throne tier + dedicated turret spots.
  // Tier 1 opens an inner triangle of general plots; upgrading the Throne reveals the hexagon + turret ring,
  // then an outer ring. slot 'gen' = build anything, 'turret' = tower-only.
  const BASE_PLOTS=PLOTDEF;
  // PLAYER base (per active level)
  const KX=PBASE.x,KZ=PBASE.z; placeCore(KX,KZ); camAim.x=KX; camAim.z=KZ; camAim.init=true;   // open the RTS camera on the player base
  for(const s of BASE_PLOTS){ const a=s.a*Math.PI/180, x=KX+Math.cos(a)*s.r, z=KZ+Math.sin(a)*s.r; if(onIsland(x,z)) makePlot(x,z,s.t,s.s); }
  // RAIDER stronghold — full mirrored AI base (skirmish) OR a small static camp (tutorials)
  if(RAIDERS.type==='base'){ placeEnemyCore(enemyBase.x,enemyBase.z);
    for(const s of BASE_PLOTS){ const a=(s.a+180)*Math.PI/180, x=enemyBase.x+Math.cos(a)*s.r, z=enemyBase.z+Math.sin(a)*s.r; if(onIsland(x,z)) makeEnemyPlot(x,z,s.t,s.s); } }
  else if(RAIDERS.type==='camp'){ placeEnemyCore(enemyBase.x,enemyBase.z); enemyCore.max=enemyCore.hp=(RAIDERS.hp||900); }   // camp: a lone weak throne, no economy
  // type==='none' (ritual/defense): no enemy structure at all

  // rocks scattered across the land
  for(let i=0;i<50;i++){ const x=rr(-WORLD,WORLD), z=rr(-WORLD,WORLD);
    if(onIsland(x,z)&&pathDist(x,z)>6&&Math.hypot(x-KX,z-KZ)>16&&Math.hypot(x-enemyBase.x,z-enemyBase.z)>16) place(makeRock(),x,z); }
  // Ironroots dressing the road (glowing ore formations) — per-level count
  if(LVIRONROOTS){ let placed=0,tries=0;
    while(placed<LVIRONROOTS && tries<800){ tries++; const x=rr(-WORLD,WORLD), z=rr(-WORLD,WORLD);
      if(!onIsland(x,z))continue; const pd=pathDist(x,z); if(pd<3.5||pd>ROAD_W*0.82)continue;
      if(Math.hypot(x-KX,z-KZ)<20||Math.hypot(x-enemyBase.x,z-enemyBase.z)<18)continue;
      place(makeIronroot(0.8+rnd()*0.7), x, z, rr(0,6.28)); placed++; } }
  // the great ironroot vein at the inlet — the discovery landmark
  _vein=null; _veinFound=false;
  if(LVVEIN){ const c=findLand(LVVEIN.x,LVVEIN.z); _vein={x:c.x,z:c.z};
    place(makeIronroot(2.4), c.x, c.z, rr(0,6.28));
    for(let i=0;i<3;i++){ const a=rnd()*6.28,r=rr(2,5); place(makeIronroot(1.0+rnd()*0.6), c.x+Math.cos(a)*r, c.z+Math.sin(a)*r, rr(0,6.28)); } }   // a cluster around it

  // live fighters (hero + squad + enemies) are spawned by the gameplay module
}

// ================= GAMEPLAY: control-direction test =================
// Pilot the hero (joystick / WASD); the squad auto-follows & auto-fights;
// tap the ground to rally them; STOMP button = warstomp. Survive the wave.
let hero=null, allies=[], enemies=[];
let rallyPoint=null, rallyMarker=null, gameOver=0, spawnLeft=0, spawnTimer=1.5, killed=0;   // warband now produced by the enemy AI, not a fixed pool
let heroFwd={x:0,z:1};
// loose-leash follow: units idle in your vicinity, only surge to re-form once
// you've walked past FOLLOW_OUT, and settle again within FOLLOW_IN of their slot.
let FOLLOW_OUT=24, FOLLOW_IN=6, ENGAGE=18, BREAK=36;   // looser leash: roam further before the squad re-forms, and give more slack before they drop a fight
window.__follow=(o,i,e,b)=>{ if(o)FOLLOW_OUT=o; if(i)FOLLOW_IN=i; if(e)ENGAGE=e; if(b)BREAK=b; return {FOLLOW_OUT,FOLLOW_IN,ENGAGE,BREAK}; };
// command layer: lasso-select a sub-group, draw/tap to send them (attack-move)
let selected=new Set(), lcv, lctx, cmd={active:false,id:null,pts:[],moved:false};
let spellArmed=false, autoBolt=false, orderMarkers=[], boltEl, autoEl, smiteArmed=false, smiteEl;
let hitEl=null, heroCanHit=false, heroHitTarget=null;   // Wild-Rift attack button: active only when a foe is in the hero's reach
let abilHandEl=null, cmdStripEl=null;                   // thumb-cluster no-command zones (taps here never issue a ground order)
let keys={}, joy={active:false,nx:0,ny:0,id:null,sx:0,sy:0};
let heroHpEl, waveEl, resultEl, abilEl, joyBase, joyKnob, supEl, woodEl, viewPop=null;
const raycaster=new THREE.Raycaster(), groundPlane=new THREE.Plane(new THREE.Vector3(0,1,0),0);
const camF={pitch:52,az:34,dist:66,lookY:4,pos:new THREE.Vector3(),init:false};   // closer default view
const VIEW_AZS=[34,124,214,304];   // four 90-degree-apart perspectives; the picked one persists as default
try{ const sv=parseFloat(localStorage.getItem('wc_view_az')); if(!isNaN(sv)) camF.az=sv; }catch(_){}
// zoom — wheel + two-finger pinch, clamped
const ZMIN=34, ZMAX=170;   // allow pulling back to survey the larger map
addEventListener('wheel', e=>{ camF.dist=Math.max(ZMIN,Math.min(ZMAX, camF.dist + e.deltaY*0.05)); }, {passive:true});
let camLocked=false, camEl, viewEl=null, chargeEl=null, recallEl=null, PAN_SPD=70; const camAim={x:0,z:0,init:false};   // RTS: free camera by default (Cam button re-locks to the hero)
let _tutBtn=null;   // last radial/HUD button the player pressed (drives the button-by-button tutorial gates)
// multi-touch camera gestures (pointer-based): 1 finger drag = pan world, 2 fingers = pinch-zoom + rotate
const ptrs=new Map(); let gesture=null;   // gesture: {mode:'pan'|'pinch', ...}
function clampAim(){ const dx=camAim.x-60, r=Math.hypot(dx,camAim.z); if(r>230){ camAim.x=60+dx*230/r; camAim.z*=230/r; } }
function panWorld(ddx,ddy){ const B=groundBasis(); const s=camF.dist*0.0016;   // screen px → world, scaled by zoom
  camAim.x += (-ddx*B.r.x - ddy*B.f.x)*s; camAim.z += (-ddx*B.r.z - ddy*B.f.z)*s; clampAim(); }

function makeBar(fillHex){
  const g=new THREE.Group(), w=3.4,h=0.5;
  g.add(new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({color:0x14110c})));
  const fl=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({color:fillHex}));
  fl.position.z=0.02; g.add(fl); g.__fl=fl; g.__w=w; g.visible=false; scene.add(g); return g;
}
function mkFighter(hex,scale,team,st){
  const g=makeUnit(hex,scale); scene.add(g);
  const e=Object.assign({g,team,alive:true,cd:0,px:0,pz:0,hitT:0,rageT:0,stunT:0,face:0,phase:Math.random()*6.28,movedThis:false,following:false,target:null,forcedTarget:null,order:null,
    rad:team==='hero'?2.3:1.5, bar:makeBar(team==='enemy'?0xd23b3b:0x4ad0e0)},st);
  if(team==='ally'||team==='hero'){ e.ring=new THREE.Mesh(new THREE.RingGeometry(1.7,2.15,20),new THREE.MeshBasicMaterial({color:0x59e06c,transparent:true,opacity:0.95,side:THREE.DoubleSide})); e.ring.rotation.x=-Math.PI/2; e.ring.visible=false; scene.add(e.ring); }   // Siege-Up green selection ring
  e.max=st.hp; return e;
}
function setP(e,x,z){ e.px=x; e.pz=z; e.g.position.set(x,topY(x,z),z); }
function faceTo(e,dx,dz){ if(dx||dz) e.face=Math.atan2(dx,dz); }
// ---------- rigged units: Bitgem elf GLBs with native-skeleton (Mixamo-authored) clips ----------
// Each GLB packs the mesh once + all its clips; the clips are authored on the Bitgem
// skeleton so they play with no retarget. Textures are embedded (palette atlas, UVs
// pre-flipped) — we just force NearestFilter so swatches sample solid, not the black gaps.
const RIGS={}, PROPS={}, TEXS={}; const CHAR_H={thoryn:4.8, queen:4.4, paladin:4.4, aelindra:4.4, archer:3.6, priestess:3.8, warrior:3.9, assassin:3.7, chief:4.9, orcarcher:3.7, orcgrunt:3.7, orcwarrior:4.1, orcshaman:3.7, drake:5.4, neaarcher:3.9,
  cinderhound:3.0, direboar:3.4, emberspitter:3.0, ashtreant:6.5, moltenwisp:3.8, wyveling:4.2, revenant:5.6,
  hfootman:4.0, harcher:3.9, hknight:4.2, hmage:3.9,
  uking:4.3, uwarrior:3.9, uassassin:3.7, uarcher:3.9, umage:3.9, uworker:3.6};   // undead roster + neutral creeps (ash-basin bestiary)
const CREEP_KEYS=['cinderhound','direboar','emberspitter','ashtreant','moltenwisp','wyveling','revenant'];   // Tripo/PBR rigs — flatten to the unlit look like thoryn
// NB: the Deepvein dead (uworker/uwarrior/uassassin/uarcher/umage/uking) are creeps too — CREEP stats,
// CREEP_VFX, camp AI — but deliberately NOT in CREEP_KEYS: they're Bitgem humanoids with a non-metallic
// atlas like the elf/orc units, so they keep their lit materials (flattening would render them flat).
// hand weapons: each char has a list of props → { prop FBX, hand bone, local transform }
const WEAPONS={
  queen:    [{file:'glaive_elf_queen', bone:'hand_r', pos:[-6.2,-1.25,-0.1], rot:[Math.PI/2,-1.326,0], scl:1}],
  paladin:  [{file:'hammer_human_paladin', bone:'hand_r', pos:[-8.4,-2.6,0], rot:[Math.PI/2,1.379,0.035], scl:1}],
  archer:   [{file:'bow_elf_archer',   bone:'hand_l', pos:[10,-3.55,0], rot:[-2.845,Math.PI/2,-1.518], scl:0.86}],
  priestess:[{file:'magic_ball',       bone:'hand_r', pos:[-10,-10,6.9], rot:[0,0,0], scl:0.52}],
  warrior:  [{file:'sword_elf_warrior', bone:'hand_r', pos:[-10,-2.55,0.3], rot:[Math.PI/2,2.705,Math.PI], scl:0.66},
             {file:'shield_elf_warrior',bone:'hand_l', pos:[7.95,-3.7,0.45], rot:[1.292,3.019,0], scl:0.8}],
  assassin: [{file:'dagger_elf_assassin', bone:'hand_r', pos:[-10,-2.55,0.3], rot:[Math.PI/2,2.705,Math.PI], scl:0.5}],
  // orc horde (chief/orcarcher/orcgrunt/orcwarrior/orcshaman) now ship their weapons baked into the
  // mesh (great-sword, sword+shield, throwing spear, war-axe) — no separate hand props to attach.
  hfootman: [{file:'sword_human_footman', bone:'hand_r', pos:[-10,-2.55,0.3], rot:[Math.PI/2,2.705,Math.PI], scl:0.66},
             {file:'shield_human_footman',bone:'hand_l', pos:[7.95,-3.7,0.45], rot:[1.292,3.019,0], scl:0.8}],
  harcher:  [{file:'bow_human_archer', bone:'hand_l', pos:[10,-3.55,0], rot:[-2.845,Math.PI/2,-1.518], scl:0.86}],
  hknight:  [{file:'sword_human_knight', bone:'hand_r', pos:[-10,-2.55,0.3], rot:[Math.PI/2,2.705,Math.PI], scl:0.66}],
  hmage:    [{file:'staff_human_mage', bone:'hand_r', pos:[0,0,0], rot:[0,0,0], scl:1}],
};
const RIG_YAW={neaarcher:Math.PI};   // Blender-built rig faces -Z; spin 180° so it faces +Z like the others
const RIG_SPECS=[['thoryn','thoryn'],['queen','elf_queen'],['paladin','human_paladin'],['aelindra','aelindra'],['archer','elf_archer'],['priestess','elf_priestess'],['warrior','elf_warrior'],['assassin','elf_assassin'],['neaarcher','nightelf_archer'],['chief','orc_chieftain'],['orcarcher','orc_archer'],['orcgrunt','orc_grunt'],['orcwarrior','orc_warrior'],['orcshaman','orc_shaman'],
  ['cinderhound','cinder_hound'],['direboar','direboar'],['emberspitter','ember_spitter'],['ashtreant','ash_treant'],['moltenwisp','molten_wisp'],['wyveling','wyveling'],['revenant','stone_revenant'],   // neutral creeps
  ['hfootman','human_footman'],['harcher','human_archer'],['hknight','human_knight'],['hmage','human_mage'],   // Iron Crown units
  ['uking','undead_king'],['uwarrior','undead_warrior'],['uassassin','undead_assassin'],['uarcher','undead_archer'],['umage','undead_mage'],['uworker','undead_worker']];   // Undead roster (borrowed elf clips on the shared Bitgem rig)
// Several FBX (the elf/orc bows AND every elf building) export as SkinnedMesh with a rigid little
// armature. Cloned with a plain .clone(true) — not SkeletonUtils.clone — the skeleton binding
// breaks: the renderer skins the mesh in the skeleton's own space, so it renders at ~world origin
// (the map centre) or as a giant, no matter where the parent group is placed. These are all static
// props/structures that never need their bones, so bake every SkinnedMesh down to a plain bind-pose
// Mesh at its correct world-relative transform and drop the armature entirely. Non-skinned inputs
// pass through untouched.
function bakeStatic(o){ o.updateMatrixWorld(true); const parts=[]; let hadSkin=false;
  o.traverse(n=>{ if(!n.isMesh)return; if(n.isSkinnedMesh)hadSkin=true;
    const m=new THREE.Mesh(n.geometry, n.material); m.applyMatrix4(n.matrixWorld); m.name=n.name; m.castShadow=n.castShadow; m.receiveShadow=n.receiveShadow; parts.push(m); });
  if(!hadSkin) return o;                        // nothing skinned — leave the original hierarchy alone
  const w=new THREE.Group(); parts.forEach(m=>w.add(m)); return w; }
const bakeProp=bakeStatic;   // back-compat alias for the weapon-prop loader
function loadRig(){ return new Promise(res=>{
  const gl=new THREE.GLTFLoader(), fx=new THREE.FBXLoader(), tl=new THREE.TextureLoader();
  const MDLV='?v=8';   // asset cache-buster — bump on any model/texture change so /assets max-age=86400 doesn't pin a stale rig (index.html revalidates, so a new ?v reaches clients at once)
  const propFiles=[...new Set(Object.values(WEAPONS).flat().map(w=>w.file))];
  let n=0, need=RIG_SPECS.length*2 + propFiles.length; const done=()=>{ if(++n>=need) res(); };   // body GLB + atlas per char, + each prop once
  RIG_SPECS.forEach(([k,f])=>{
    gl.load('/assets/models/'+f+'_anim.glb'+MDLV, g=>{
      if(k==='thoryn'||k==='drake'||k==='aelindra'||CREEP_KEYS.includes(k)) g.scene.traverse(o=>{ if(!o.isMesh||!o.material)return;   // Tripo/PBR (metallic) renders black in our unlit look — flatten to Basic like every other unit
        const flat=m=>{ const t=m&&m.map; if(!t)return m; if('colorSpace'in t)t.colorSpace=THREE.SRGBColorSpace; return new THREE.MeshBasicMaterial({map:t,side:THREE.DoubleSide}); };
        o.material = Array.isArray(o.material) ? o.material.map(flat) : flat(o.material); });
      RIGS[k]={scene:g.scene,anims:g.animations}; done(); }, undefined, ()=>done());
    tl.load('/assets/models/'+f+'_tex.png'+MDLV, t=>{ t.flipY=true; t.magFilter=THREE.NearestFilter; t.minFilter=THREE.NearestFilter; t.generateMipmaps=false; if('colorSpace'in t)t.colorSpace=THREE.SRGBColorSpace; TEXS[k]=t; done(); }, undefined, ()=>done());
  });
  propFiles.forEach(f=>fx.load('/assets/models/'+f+'.fbx'+MDLV, o=>{ PROPS[f]=bakeProp(o); done(); }, undefined, ()=>done()));
}); }
// clone a rig (independent per unit), crisp texture, scale to target height, plant feet, wire clips
function makeChar(key,opts){ opts=opts||{}; const src=RIGS[key]; if(!src)return null;
  const inner=THREE.SkeletonUtils.clone(src.scene), outer=new THREE.Group();
  // models natively face +Z; face() sets outer.rotation.y=atan2(dx,dz) so +Z aligns with travel — no extra spin (was Math.PI → moonwalk)
  inner.rotation.y=RIG_YAW[key]||0;   // per-rig facing correction (e.g. Blender-built rigs that export facing -Z)
  inner.traverse(nd=>{ if(nd.isMesh){ nd.frustumCulled=false; nd.castShadow=true; const mm=nd.material;
    if(mm&&mm.map){ mm.map.magFilter=THREE.NearestFilter; mm.map.minFilter=THREE.NearestFilter; mm.map.generateMipmaps=false; mm.map.needsUpdate=true; } } });
  outer.add(inner); outer.updateMatrixWorld(true);
  const mixer=new THREE.AnimationMixer(inner); const act={};
  // strip .position tracks → play in place. The clips carry huge baked root motion
  // (run ≈ 250u forward), which otherwise slides the body ahead of its game position,
  // arcs it wide on turns, and snaps it back each loop. The game drives translation.
  src.anims.forEach(a=>{ const clip=new THREE.AnimationClip(a.name,a.duration, a.tracks.filter(t=>!t.name.endsWith('.position'))); act[a.name]=mixer.clipAction(clip); });
  // map creep/KayKit clip names (Idle/Walk/Smash/Bite/Gore/Spit/Fly/Cast/…) onto idle/run/attack/block.
  // Non-destructive: only fills a standard slot if the rig didn't already ship it (elf/orc keep their own).
  const _alias={ idle:[/^idle$/i,/^idle_a/i,/unarmed_idle/i,/idle/i],
    run:[/^running_a/i,/running/i,/^run$/i,/\brun/i,/^walking_a/i,/^walk$/i,/walking/i,/walk/i,/fly/i,/glide/i,/float/i,/hover/i],
    attack:[/1h_melee_attack_chop/i,/melee_attack/i,/^attack$/i,/smash/i,/slam/i,/throw/i,/swipe/i,/bite/i,/spit/i,/gore/i,/cast/i,/attack/i],
    block:[/^blocking$/i,/^block$/i,/block/i] };
  for(const std in _alias){ if(act[std])continue; let hit=null; for(const re of _alias[std]){ hit=Object.keys(act).find(n=>re.test(n)); if(hit)break; } if(hit)act[std]=act[hit]; }
  // creatures shipped with a single clip (e.g. the drake's 'Flap') — alias it to the standard
  // idle/run/attack/block names (as independent actions) so the anim state machine can drive it.
  if(!act.idle && src.anims.length){ const base=src.anims[0];
    ['idle','run','attack','block'].forEach(n=>{ if(!act[n]){ const clip=new THREE.AnimationClip(n, base.duration, base.tracks.filter(t=>!t.name.endsWith('.position'))); act[n]=mixer.clipAction(clip); } }); }
  if(act.run) act.run.setEffectiveTimeScale(0.8);   // legs cycle a touch slower to match the calmer move speed
  if(act.attack) act.attack.setEffectiveTimeScale(1.4);   // snappier draw-and-release so it reads as a shot
  if(act.idle) act.idle.play();
  mixer.update(0.3); outer.updateMatrixWorld(true);          // pose to idle BEFORE measuring
  // Size + plant from the POSED mesh via SkinnedMesh.computeBoundingBox(): it skins the vertices on the
  // CPU with the same bone matrices the GPU uses, so the measurement always matches what's drawn. This
  // is device-independent. (Box3.setFromObject reads the raw, UN-skinned geometry bounds instead — and
  // for the 3D-gen hero rigs, whose tiny geometry is scaled up by the skeleton, that mismatch computed a
  // huge scale and rendered the hero gigantic on some browsers.) Union every mesh in inner-local space.
  const _im=new THREE.Matrix4(), _gb=new THREE.Box3(), box=new THREE.Box3(); box.makeEmpty();
  inner.updateMatrixWorld(true);
  inner.traverse(o=>{ if(!o.isMesh||!o.geometry)return; let src;
    if(o.isSkinnedMesh && o.computeBoundingBox){ if(o.skeleton&&o.skeleton.update)o.skeleton.update(); o.computeBoundingBox(); src=o.boundingBox; }
    else { if(!o.geometry.boundingBox)o.geometry.computeBoundingBox(); src=o.geometry.boundingBox; }
    if(!src||src.isEmpty())return;
    _im.copy(inner.matrixWorld).invert().multiply(o.matrixWorld); _gb.copy(src).applyMatrix4(_im); box.union(_gb); });
  const hh=Math.max(0.001, box.getSize(new THREE.Vector3()).y);
  outer.scale.setScalar(CHAR_H[key]/hh);
  inner.position.y=-box.min.y;                               // plant feet at the group origin
  const c2=box.getCenter(new THREE.Vector3()); inner.position.x-=c2.x; inner.position.z-=c2.z;   // centre X/Z
  outer.updateMatrixWorld(true);
  // hand weapons — parent each prop to its hand bone (rides the animation), painted with the char atlas.
  // Some orc rigs ship 5-6 DUPLICATE skeletons (a Character-Studio biped overlaid with a second rig):
  // the clip drives the base-named bone, but the visible arm mesh is skinned to a *different* duplicate
  // (Character1_RightHand_2, hand_r_2, …). Binding the weapon by name lands on the clip's bone, which
  // drifts from the bone that actually moves the rendered hand — so the weapon floats and no offset fixes
  // it. Ground truth is the mesh: bind to the hand bone belonging to the skeleton of the largest skinned
  // mesh (the body), so the weapon rides the exact deform bone the visible hand follows.
  let bodySkel=null,_bv=-1; inner.traverse(o=>{ if(o.isSkinnedMesh&&o.skeleton){ const n=o.geometry.attributes.position.count; if(n>_bv){_bv=n;bodySkel=o.skeleton;} } });
  const pickFrom=(bones,name)=> bones.find(bn=>bn.name===name) || bones.find(bn=>bn.name.indexOf(name)===0) || null;
  const findBone=name=>{ if(bodySkel){ const b=pickFrom(bodySkel.bones,name); if(b)return b; }
    const cands=[]; inner.traverse(o=>{ if(o.isBone&&(o.name===name||o.name.indexOf(name)===0)) cands.push(o); });
    return pickFrom(cands,name); };
  if(!opts.noWeapons) (WEAPONS[key]||[]).forEach(w=>{ if(!PROPS[w.file])return; const bone=findBone(w.bone);
    if(bone){ const prop=PROPS[w.file].clone(true), tx=TEXS[key];
      prop.traverse(o=>{ if(o.isMesh){ o.material=new THREE.MeshBasicMaterial({map:tx,side:THREE.DoubleSide}); o.frustumCulled=false; } });
      prop.position.fromArray(w.pos); prop.rotation.set(w.rot[0],w.rot[1],w.rot[2]); prop.scale.setScalar(w.scl); bone.add(prop); } });
  const out={g:outer,mixer,act};
  if(key==='thoryn'){ out.armL=findBone('upperarm_l'); out.armR=findBone('upperarm_r'); }   // long arms need a post-anim relax
  return out; }
// ---- unit portraits: bake a head-and-shoulders headshot of every rig once at load, keyed by rig ----
// Rendered from the real in-game model (idle pose, facing +Z toward the lens) so the hub shows each
// unit's actual face. Cheap: one offscreen render per rig at startup; stored as data-URLs.
let PORTRAITS={};
function bakePortraits(){
  let R; try{ R=new THREE.WebGLRenderer({antialias:true, alpha:true, preserveDrawingBuffer:true}); }catch(_){ return; }
  R.setSize(192,192); R.setPixelRatio(1); R.setClearColor(0x000000,0); if('outputColorSpace'in R)R.outputColorSpace=THREE.SRGBColorSpace;
  const sc=new THREE.Scene();
  sc.add(new THREE.HemisphereLight(0xffffff,0x556070,1.15));
  const key=new THREE.DirectionalLight(0xfff2dc,1.5); key.position.set(0.6,1.1,1.4); sc.add(key);
  const cam=new THREE.PerspectiveCamera(30,1,0.05,200);
  for(const rk of Object.keys(RIGS)){
    let ch; try{ ch=makeChar(rk,{noWeapons:true}); }catch(_){ ch=null; } if(!ch)continue;   // bare pose — no weapon in front of the face
    const g=ch.g; sc.add(g); g.updateMatrixWorld(true);
    // frame off the target height (feet planted at y=0), NOT the bounding box — a raised weapon/arm
    // inflates the bbox and throws the aim above the head into a top-down scalp shot.
    const H=CHAR_H[rk]||4, focusY=H*0.80, dist=H*0.82;   // level bust: head/helm + shoulders + chest armor (robust across poses/weapons)
    cam.position.set(0, focusY, dist); cam.lookAt(0, focusY, 0);   // camera on +Z — rigs face +Z
    try{ R.render(sc,cam); PORTRAITS[rk]=R.domElement.toDataURL('image/png'); }catch(_){}
    sc.remove(g);   // geometry/materials are shared with RIGS — never dispose them here
  }
  R.dispose();
}
// Thoryn's arms are ~2.5x the queen's: her clip angles read as 'airplane arms' on his longer
// limbs, so after the mixer poses him each frame we relax the upper arms toward the body.
let ARM_TUNE={x:0,y:1,z:0,ang:0};   // his own unarmed clip set fits his proportions; tuner kept for fine-tuning (window.__armTune)
window.__armTune=(x,y,z,a)=>{ ARM_TUNE={x,y,z,ang:a}; };
const _qArm=new THREE.Quaternion(), _vArm=new THREE.Vector3();
function armRelax(e){ if(!e||!e.armL||!e.armR)return;
  _vArm.set(ARM_TUNE.x,ARM_TUNE.y,ARM_TUNE.z).normalize();
  e.armL.quaternion.multiply(_qArm.setFromAxisAngle(_vArm, ARM_TUNE.ang));
  e.armR.quaternion.multiply(_qArm.setFromAxisAngle(_vArm,-ARM_TUNE.ang)); }
// generic crossfade anim setter (hero + rigged allies)
function setAnim(e,want){ if(!e.act||e.animState===want)return; const a=e.act[want]; if(!a)return;
  const cur=e.act[e.animState]; if(cur)cur.fadeOut(0.16); a.reset().fadeIn(0.16).play(); e.animState=want; }
// swap an entity's placeholder body for a rigged character
function riggize(e,key){ const c=makeChar(key); if(!c)return; scene.remove(e.g); e.g=c.g; e.mixer=c.mixer; e.act=c.act; e.armL=c.armL; e.armR=c.armR; e.rigged=true; e.rigKey=key; e.animState='idle'; scene.add(e.g); }

function spawnGame(){
  hero=mkFighter(C.hero,1.9,'hero',{hp:HERO_STAT.hp,dmg:HERO_STAT.dmg,range:HERO_STAT.range,atkEvery:HERO_STAT.atk,spd:HERO_STAT.spd,aCd:0,spellCd:0,blinkCd:0});
  const rk=(HERO_KIT[heroKind]&&RIGS[HERO_KIT[heroKind].rig])?HERO_KIT[heroKind].rig:(RIGS.queen?'queen':'thoryn');
  riggize(hero, rk);   // the chosen hero (Elf Queen default, or Paladin)
  hero.kit=heroKind; const _k=HERO_KIT[heroKind]||HERO_KIT.queen; hero.aMax=_k.a.cd; hero.spellMax=_k.spell.cd; hero.blinkMax=_k.blink.cd;
  refreshHeroAura();   // Warden moonlight aura (queen only)
  // muster just outside the base, facing into the map (toward the raider camp)
  const outAng=Math.atan2(enemyBase.x-PBASE.x, enemyBase.z-PBASE.z);
  setP(hero, PBASE.x+Math.sin(outAng)*14, PBASE.z+Math.cos(outAng)*14);
  // starting warband (per level)
  const COL={warrior:C.teamBlueD, archer:C.teamBlue, cleric:C.cleric};
  LVSTART.forEach((u,i)=>{ const kind=(u==='priestess')?'cleric':u, b=UBAL[kind]||UBAL.warrior;
    const e=mkFighter(COL[kind]||C.teamBlueD,1.0,'ally',{hp:b.hp,dmg:b.dmg,range:b.range,atkEvery:b.atk,spd:ALLY_SPD});
    e.idx=i; e.kind=kind; e.healCd=0; e.smiteCd=0; riggize(e, URIG[kind]||u);
    setP(e, hero.px+((i%3)-1)*3.2, hero.pz-2-Math.floor(i/3)*3); allies.push(e); });
  if(RAIDERS.type==='base'){
    const boss=mkFighter(C.enemyRed,1.6,'enemy',{hp:BOSS_STAT.hp,dmg:BOSS_STAT.dmg,range:BOSS_STAT.range,atkEvery:BOSS_STAT.atk,spd:BOSS_STAT.spd});
    boss.rad=2.8; boss.max=BOSS_STAT.hp; boss.isBoss=true; boss.hurlCd=4; boss.slamCd=7; boss.roarCd=10; riggize(boss,'chief'); setP(boss,enemyBase.x+8,enemyBase.z+8); enemies.push(boss);
    for(const rig of ['orcgrunt','orcarcher']){ const e=mkOrc(rig); setP(e,enemyBase.x+rr(2,10),enemyBase.z+rr(2,10)); enemies.push(e); }
  } else if(RAIDERS.type==='camp'){   // tutorial raider camp: static guards defending a lone throne (razing it wins)
    (RAIDERS.guards||['orcgrunt','orcgrunt']).forEach((rig,i)=>{ const e=mkOrc(rig); const a=i/Math.max(1,(RAIDERS.guards||[]).length)*6.28;
      const gx=enemyBase.x+Math.cos(a)*9, gz=enemyBase.z+Math.sin(a)*9; const h=findLand(gx,gz); setP(e,h.x,h.z); e.__campGuard=true; e.__home={x:h.x,z:h.z}; enemies.push(e); }); }
  if(RITUAL) setupRitual();
  recomputeSupply(); recomputeIncome();   // seed cap/income from the starting warband + empty economy
  rallyMarker=new THREE.Mesh(new THREE.RingGeometry(1.6,2.3,22),new THREE.MeshBasicMaterial({color:0xffe089,transparent:true,opacity:0.9,side:THREE.DoubleSide}));
  rallyMarker.rotation.x=-Math.PI/2; rallyMarker.visible=false; scene.add(rallyMarker);
  // brazier torches flanking each throne — showcases the 3D fire
  for(const c of [coreB, enemyCore]){ if(!c)continue; for(const dx of [-7,7]){ const fx=c.x+dx, fz=c.z+6; makeFire(fx, topY(fx,fz)+0.3, fz, 1.15); } }
  if(LVCREEPS.length) spawnCreepCamps();   // neutral creep camps along this level's road
}
let spawnN=0;
function spawnEnemy(){ const x=enemyBase.x+rr(-14,14), z=enemyBase.z+rr(-14,14);   // muster from the enemy stronghold (top-right)
  if(!onIsland(x,z))return;
  const rig=['orcarcher','orcgrunt','orcwarrior','orcshaman'][spawnN++ %4];   // rotate the horde: archer, grunt, warrior, shaman
  const e=mkOrc(rig); setP(e,x,z); enemies.push(e); }
function nearest(x,z,list){ let b=null,bd=1e9; for(const t of list){ if(!t.alive)continue; const d=(t.px-x)**2+(t.pz-z)**2; if(d<bd){bd=d;b=t;} } return {t:b,d:Math.sqrt(bd)}; }
function moveTo(e,tx,tz,dt){ let dx=tx-e.px,dz=tz-e.pz; const d=Math.hypot(dx,dz)||1; dx/=d;dz/=d;
  const sp=e.spd*(e.rageT>0?1.45:1);   // War Roar speeds the horde
  const nx=e.px+dx*sp*dt, nz=e.pz+dz*sp*dt; if(onIsland(nx,nz)){setP(e,nx,nz);faceTo(e,dx,dz);e.movedThis=true;} return d; }
// walk bob + smooth turn (units feel alive, not sliding statues)
function loco(dt){ const all=[hero,...allies,...enemies];
  for(const e of all){ if(!e||!e.alive)continue;
    let d=e.face-e.g.rotation.y; while(d>Math.PI)d-=6.283; while(d<-Math.PI)d+=6.283; e.g.rotation.y+=d*Math.min(1,dt*10);
    if(e.rigged){ e.g.position.set(e.px, topY(e.px,e.pz), e.pz); }   // mixer drives the body; no capsule bob
    else { e.phase += (e.movedThis?11:2.5)*dt;
      const bob = e.movedThis? Math.abs(Math.sin(e.phase))*0.45 : 0.05+Math.sin(e.phase)*0.05;
      e.g.position.set(e.px, topY(e.px,e.pz)+bob, e.pz); }
    if(e.__sq){ e.__sq=Math.max(0,e.__sq-dt*5.5); if(e.__bs===undefined)e.__bs=e.g.scale.x||1;   // squash-punch on hit, eases back to rest
      const s=e.__sq, b=e.__bs; e.g.scale.set(b*(1+0.18*s), b*(1-0.24*s), b*(1+0.18*s)); }
    e.movedThis=false;
  } }
// anti-stack separation (units spread out instead of piling up)
function separate(){ const all=[hero,...allies,...enemies].filter(e=>e&&e.alive);
  for(let i=0;i<all.length;i++)for(let j=i+1;j<all.length;j++){ const a=all[i],b=all[j];
    let dx=b.px-a.px,dz=b.pz-a.pz; const d=Math.hypot(dx,dz), min=a.rad+b.rad;
    if(d>=min||d<0.0001)continue;
    if(a.target===b||b.target===a)continue;   // never shove a fighter and its own target apart
    // anchored (attacking) units and the hero hold ground; only movers get nudged apart
    const wa=(a.team==='hero'||a.state==='attack')?0:1, wb=(b.team==='hero'||b.state==='attack')?0:1;
    if(!wa&&!wb)continue; const ov=(min-d)*0.5; dx/=d;dz/=d; const tot=wa+wb;   // ease apart (half the overlap/frame) so packed units glide, not pop back
    if(wa){ const ax=a.px-dx*ov*(wa/tot), az=a.pz-dz*ov*(wa/tot); if(onIsland(ax,az)){a.px=ax;a.pz=az;} }
    if(wb){ const bx=b.px+dx*ov*(wb/tot), bz=b.pz+dz*ov*(wb/tot); if(onIsland(bx,bz)){b.px=bx;b.pz=bz;} }
  } }
function attack(a,d){ if(a.cd>0)return; damage(d,a.dmg*(a.rageT>0?1.35:1),false); a.cd=a.atkEvery*(a.rageT>0?0.6:1); faceTo(a,d.px-a.px,d.pz-a.pz);
  if(!a.ranged){ sfx('melee'); const sc=(d.team==='enemy')?0xffcaa0:0xcfe8ff; puff(d.px+rr(-0.5,0.5),topY(d.px,d.pz)+(d.big?2.2:2.0),d.pz+rr(-0.5,0.5),sc,0.6,0.6); }   // melee impact spark
  if(a===hero) addShake(0.4); }
function groundBasis(){ const f=new THREE.Vector3(); cam.getWorldDirection(f); f.y=0; f.normalize();
  const r=new THREE.Vector3().crossVectors(f,new THREE.Vector3(0,1,0)).normalize(); return {f,r}; }
// pick one of the hero's attack swings at random (Queen has several slash clips; others just have 'attack')
function pickAtkClip(e){ if(!e||!e.act)return 'attack'; const a=['attack','attack2','attack3','attack4'].filter(n=>e.act[n]); return a.length?a[(Math.random()*a.length)|0]:'attack'; }
// the Hit button: strike the nearest foe, but only if one is actually in reach (button is dimmed otherwise)
function heroHit(){ if(!hero||!hero.alive||gameOver)return; const {t,d}=nearest(hero.px,hero.pz,foes());
  if(t&&d<=hero.range+(t.big||0)+1){ if(hero.rigged){ hero.__atkClip=pickAtkClip(hero); hero.__atkT=0.55; } attack(hero,t); } }
function warstomp(){ if(!hero||hero.aCd>0||gameOver)return; hero.aCd=5;
  for(const e of enemies){ if(!e.alive)continue; const d=Math.hypot(e.px-hero.px,e.pz-hero.pz);
    if(d<11){ damage(e,50,true); const nx=e.px+(e.px-hero.px)/(d||1)*5, nz=e.pz+(e.pz-hero.pz)/(d||1)*5; if(onIsland(nx,nz))setP(e,nx,nz);} }
  const r=new THREE.Mesh(new THREE.RingGeometry(1,2,26),new THREE.MeshBasicMaterial({color:0xffd060,transparent:true,side:THREE.DoubleSide}));
  r.rotation.x=-Math.PI/2; r.position.set(hero.px,topY(hero.px,hero.pz)+0.5,hero.pz); scene.add(r);
  let t=0;(function an(){t+=0.05;r.scale.setScalar(1+t*11);r.material.opacity=Math.max(0,0.9-t);if(t<0.9)requestAnimationFrame(an);else scene.remove(r);})();
  shockwave(hero.px,hero.pz,0xffd060,14); for(let i=0;i<10;i++){ const a=rr(0,6.28); puff(hero.px+Math.cos(a)*rr(1,4),topY(hero.px,hero.pz)+rr(0,1.2),hero.pz+Math.sin(a)*rr(1,4),0xe8c07a,rr(0.5,1.0),0.5); } addShake(1.9);   // stomp kicks up dust + shakes hard
}
// ----- command helpers -----
function screenOf(px,pz){ const v=new THREE.Vector3(px,topY(px,pz)+2,pz).project(cam);
  return [(v.x*0.5+0.5)*innerWidth, (-v.y*0.5+0.5)*innerHeight]; }
function pointInPoly(x,y,pts){ let inside=false;
  for(let i=0,j=pts.length-1;i<pts.length;j=i++){ const xi=pts[i][0],yi=pts[i][1],xj=pts[j][0],yj=pts[j][1];
    if(((yi>y)!==(yj>y)) && (x<(xj-xi)*(y-yi)/(yj-yi)+xi)) inside=!inside; } return inside; }
function lassoSelect(pts){ selected.clear();
  if(pts.length<3){ return; }
  for(const e of allies){ if(!e.alive)continue; const [sx,sy]=screenOf(e.px,e.pz); if(pointInPoly(sx,sy,pts)) selected.add(e); } }
function selectGroup(which){ selected.clear();
  const set = which==='L'?allies.filter(e=>e.idx<4) : which==='R'?allies.filter(e=>e.idx>=4) : allies.slice();
  set.forEach(e=>{ if(e.alive) selected.add(e); }); }
// ---- Thronefall-minimal command: the whole army moves as one; no sub-group micro ----
function commandTo(gx,gz){ const list=allies.filter(e=>e.alive); if(!list.length) return false;
  list.forEach((e,k)=>{ const col=((k%4)-1.5)*2.8, row=Math.floor(k/4)*2.8; e.order={x:gx+col,z:gz+row}; e.forcedTarget=null; e.target=null; e.following=false; });
  rallyMarker.material.color.setHex(0x9fe0ff); rallyMarker.position.set(gx,topY(gx,gz)+0.3,gz); rallyMarker.visible=true; clearTimeout(rallyMarker.__to); rallyMarker.__to=setTimeout(()=>rallyMarker.visible=false,2500); pingRing(gx,gz,0x9fe0ff); return true; }
function chargeAll(){ let tx=enemyBase.x, tz=enemyBase.z; const en=nearestEnemyTo(hero.px,hero.pz,1e6);
  if(en){ tx=en.px; tz=en.pz; } else if(enemyCore&&enemyCore.alive){ tx=enemyCore.x; tz=enemyCore.z; }
  commandTo(tx,tz); rallyMarker.material.color.setHex(0xff6a5a); }
function recall(){ allies.forEach(e=>{ if(e.alive){ e.order=null; e.forcedTarget=null; e.following=true; } }); }
function nearestEnemyTo(x,z,maxd){ let b=null,bd=maxd*maxd;   // fog-gated: hidden foes can't be tap-targeted
  for(const e of enemies){ if(!e.alive||e.__vis===false)continue; const dd=(e.px-x)**2+(e.pz-z)**2; if(dd<bd){bd=dd;b=e;} } return b; }
function readyClerics(){ return allies.filter(e=>e.alive&&e.kind==='cleric'&&e.smiteCd<=0).length; }
function smiteAt(en){ // smart cast: exactly one ready cleric (nearest) fires
  let best=null,bd=1e9; for(const e of allies){ if(!e.alive||e.kind!=='cleric'||e.smiteCd>0)continue; const d=(e.px-en.px)**2+(e.pz-en.pz)**2; if(d<bd){bd=d;best=e;} }
  if(!best)return false; best.smiteCd=4; damage(en,45,true); smiteFx(en); addShake(0.8); return true; }
function healFx(t){ const r=new THREE.Mesh(new THREE.RingGeometry(0.4,1.1,16),new THREE.MeshBasicMaterial({color:0x8ef0a0,transparent:true,side:THREE.DoubleSide}));
  r.rotation.x=-Math.PI/2; scene.add(r); let a=0;(function an(){a+=0.06; r.position.set(t.px,topY(t.px,t.pz)+0.4+a*4.5,t.pz); r.material.opacity=Math.max(0,0.9-a); if(a<0.9)requestAnimationFrame(an); else scene.remove(r);})(); }
function smiteFx(en){ const r=new THREE.Mesh(new THREE.RingGeometry(0.5,1.4,20),new THREE.MeshBasicMaterial({color:0xfff2c0,transparent:true,side:THREE.DoubleSide}));
  r.rotation.x=-Math.PI/2; r.position.set(en.px,topY(en.px,en.pz)+0.5,en.pz); scene.add(r); let a=0;(function an(){a+=0.07;r.scale.setScalar(1+a*8);r.material.opacity=Math.max(0,0.95-a*1.2);if(a<0.9)requestAnimationFrame(an);else scene.remove(r);})(); }
// ---------- Warden kit (Elf Queen hero): Blink · Fan of Knives · Shadow Strike ----------
function blinkPop(x,z){ const g=new THREE.Mesh(new THREE.SphereGeometry(1.6,12,10), new THREE.MeshBasicMaterial({color:0x7a4fd0,transparent:true,opacity:0.75,blending:THREE.AdditiveBlending,depthWrite:false}));
  g.position.set(x,topY(x,z)+2,z); scene.add(g); let a=0;(function an(){a+=0.09; g.scale.setScalar(1+a*3.2); g.material.opacity=Math.max(0,0.75-a*0.95); if(a<0.9)requestAnimationFrame(an); else scene.remove(g);})();
  pingRing(x,z,0x9b6be6); for(let i=0;i<6;i++){ const a2=rnd()*6.28; puff(x+Math.cos(a2)*rr(0.4,1.6),topY(x,z)+rr(0.5,2.5),z+Math.sin(a2)*rr(0.4,1.6),0x8a5fd0,0.7,0.55); } }
function blink(){ if(!hero||!hero.alive||hero.blinkCd>0||gameOver)return; hero.blinkCd=7;
  const a=hero.face; let bx=hero.px, bz=hero.pz;                              // teleport forward, clamped to stay on the island
  for(let s=17;s>=3;s-=1.5){ const nx=hero.px+Math.sin(a)*s, nz=hero.pz+Math.cos(a)*s; if(onIsland(nx,nz)){ bx=nx; bz=nz; break; } }
  blinkImplode(hero.px,hero.pz); setP(hero,bx,bz); blinkExplode(bx,bz); addShake(0.4); sfx('blink'); }
function fanOfKnives(){ if(!hero||!hero.alive||hero.aCd>0||gameOver)return; hero.aCd=6;                 // instant AoE glaive nova
  if(hero.rigged){ hero.__atkClip=pickAtkClip(hero); hero.__atkT=0.5; }
  const R=15; for(const e of enemies){ if(!e.alive)continue; if(Math.hypot(e.px-hero.px,e.pz-hero.pz)<R) damage(e,44,true); }
  const N=18; for(let i=0;i<N;i++){ const a=i/N*6.28; bladeSpin(hero.px,hero.pz, hero.px+Math.sin(a)*R, hero.pz+Math.cos(a)*R, 0xbfe9ff, 0.34); }
  runeRingFlash(hero.px,hero.pz,0x9fe8ff,R); shockwave(hero.px,hero.pz,0xcdeeff,15);
  puff(hero.px,topY(hero.px,hero.pz)+2.2,hero.pz,0xdffbff,1.5,0.85); addShake(1.5); sfx('nova'); }
function shadowStrike(en){ if(!hero||!hero.alive||hero.spellCd>0||!en||!en.alive)return false;
  if(Math.hypot(en.px-hero.px,en.pz-hero.pz)>ABIL_RANGE)return false;   // must be within cast range of the hero
  hero.spellCd=8; spellArmed=false;   // poisoned glaive: burst + DoT
  if(hero.rigged){ hero.__atkClip=pickAtkClip(hero); hero.__atkT=0.45; }
  faceTo(hero, en.px-hero.px, en.pz-hero.pz); shootFx(hero.px,hero.pz,en.px,en.pz,'shadow');
  damage(en,48,true); en.poison={t:4, dps:11}; en.__pt=0.5; addShake(0.5); return true; }
// ---------- Paladin kit (Human hero): Consecration · Hammer of Justice · Divine Shield ----------
let HAMMER_PROTO=null;
function hammerProto(){ if(HAMMER_PROTO)return HAMMER_PROTO; const g=new THREE.Group();
  const shaft=new THREE.Mesh(new THREE.CylinderGeometry(0.12,0.12,2.0,7),new THREE.MeshLambertMaterial({color:0x6b4a2a,flatShading:true}));
  const head=new THREE.Mesh(new THREE.BoxGeometry(1.0,0.7,0.7),new THREE.MeshLambertMaterial({color:0x9aa2ac,flatShading:true})); head.position.y=1.0;
  const trim=new THREE.Mesh(new THREE.BoxGeometry(1.06,0.22,0.76),new THREE.MeshBasicMaterial({color:0xffcf6a})); trim.position.y=1.0;
  g.add(shaft,head,trim); HAMMER_PROTO=g; return g; }
function hammerShot(sx,sz,tx,tz,onImpact){ const m=hammerProto().clone(true); scene.add(m);
  const y0=topY(sx,sz)+2.8,y1=topY(tx,tz)+2.0,dist=Math.hypot(tx-sx,tz-sz),dur=Math.max(0.2,Math.min(0.5,dist/40)); let t=0,tick=0, sp=rr(7,10);
  (function an(){ t+=0.033;tick++; const k=Math.min(1,t/dur); const x=sx+(tx-sx)*k,z=sz+(tz-sz)*k,y=y0+(y1-y0)*k+Math.sin(k*Math.PI)*2.0;
    m.position.set(x,y,z); m.rotation.set(0,0,t*sp);
    if(tick%2===0) puff(x,y,z,0xffe08a,0.3,0.4);
    if(k<1)requestAnimationFrame(an); else { scene.remove(m); impactFx(tx,y1,tz,0xfff0c0); for(let i=0;i<4;i++){const a=rnd()*6.28; puff(tx+Math.cos(a)*rr(0.3,1.4),y1+rr(0,1.2),tz+Math.sin(a)*rr(0.3,1.4),0xffe08a,0.6,0.55);} if(onImpact)onImpact(); } })(); }
function stunFx(e){ const r=new THREE.Mesh(new THREE.RingGeometry(0.5,0.9,18),new THREE.MeshBasicMaterial({color:0xffe08a,transparent:true,opacity:0.9,side:THREE.DoubleSide,depthWrite:false}));
  r.rotation.x=-Math.PI/2; scene.add(r); let a=0;(function an(){a+=0.05; if(!e.alive){scene.remove(r);return;} r.position.set(e.px,topY(e.px,e.pz)+(e.big?e.big*0.9+2:3.2),e.pz); r.rotation.z+=0.3; r.material.opacity=Math.max(0,0.9*Math.min(1,(e.stunT||0)/0.5)); if((e.stunT||0)>0)requestAnimationFrame(an); else scene.remove(r);})(); }
function hammerOfJustice(en){ if(!hero||!hero.alive||hero.spellCd>0||!en||!en.alive)return false;
  if(Math.hypot(en.px-hero.px,en.pz-hero.pz)>ABIL_RANGE)return false;
  hero.spellCd=hero.spellMax||8; spellArmed=false;
  if(hero.rigged){ hero.__atkClip='attack'; hero.__atkT=0.5; } faceTo(hero,en.px-hero.px,en.pz-hero.pz);
  hammerShot(hero.px,hero.pz,en.px,en.pz, ()=>{ if(en.alive){ damage(en,50,true); en.stunT=1.6; stunFx(en); sfx('stun'); } }); sfx('hammer'); addShake(0.5); return true; }
function consecration(){ if(!hero||!hero.alive||hero.aCd>0||gameOver)return; hero.aCd=hero.aMax||7;
  if(hero.rigged){ hero.__atkClip='attack'; hero.__atkT=0.55; }
  const R=13; for(const e of enemies){ if(!e.alive)continue; if(Math.hypot(e.px-hero.px,e.pz-hero.pz)<R) damage(e,30,true); }   // holy nova
  const ring=new THREE.Mesh(new THREE.RingGeometry(R-2.6,R,44),new THREE.MeshBasicMaterial({color:0xffdf8a,transparent:true,opacity:0.55,side:THREE.DoubleSide,depthWrite:false,blending:THREE.AdditiveBlending}));
  ring.rotation.x=-Math.PI/2; ring.position.set(hero.px,topY(hero.px,hero.pz)+0.2,hero.pz); scene.add(ring);
  holyGrounds.push({x:hero.px,z:hero.pz,r:R,t:3.5,next:0.5,ring});   // blessed ground: lingering DoT
  shockwave(hero.px,hero.pz,0xffe6a0,14); sfx('nova'); for(let i=0;i<10;i++){ const a=rnd()*6.28; puff(hero.px+Math.cos(a)*rr(1,R),topY(hero.px,hero.pz)+rr(0.2,1.5),hero.pz+Math.sin(a)*rr(1,R),0xffe08a,rr(0.5,0.9),0.5); }
  addShake(1.3); }
function divineShield(){ if(!hero||!hero.alive||hero.blinkCd>0||gameOver)return; hero.blinkCd=hero.blinkMax||12;
  hero.__invuln=3; hero.__healT=3;   // 3s invulnerable + regenerate while still able to fight
  if(hero.rigged){ hero.__atkClip='cast'; hero.__atkT=0.6; } pingRing(hero.px,hero.pz,0xffe6a0);
  const dome=new THREE.Mesh(new THREE.SphereGeometry(3.2,18,14),new THREE.MeshBasicMaterial({color:0xffe08a,transparent:true,opacity:0.32,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide}));
  scene.add(dome); sfx('shield'); (function an(){ const iv=hero.__invuln||0; dome.position.set(hero.px,topY(hero.px,hero.pz)+2.2,hero.pz);
    dome.material.opacity=0.12+0.22*Math.max(0,iv/3)+0.06*Math.sin(iv*10); if(iv>0&&hero.alive)requestAnimationFrame(an); else scene.remove(dome); })(); }
function tickHolyGrounds(dt){ for(let i=holyGrounds.length-1;i>=0;i--){ const g=holyGrounds[i]; g.t-=dt; g.next-=dt;
    if(g.next<=0){ g.next=0.5; for(const e of enemies){ if(e.alive&&Math.hypot(e.px-g.x,e.pz-g.z)<g.r) damage(e,7,false); } }
    if(g.ring){ g.ring.material.opacity=0.14+0.24*Math.max(0,g.t/3.5)+0.08*Math.sin(g.t*8); g.ring.rotation.z+=dt*0.7; }
    if(g.t<=0){ if(g.ring)scene.remove(g.ring); holyGrounds.splice(i,1); } } }
// ---------- Warden passive: Moonlight aura (code-driven, follows the hero) ----------
// rune ring + counter-spun inner ring + soft ground glow + pulsing dome + rising moon motes.
let heroAura=null;
// per-hero passive aura palette. Each hero that carries one gets a distinct glow so it reads
// as *their* magic: the Queen's silver-blue Moonlight, Thoryn's cold teal Runeblade, Aelindra's
// green Moonlit-grove. Heroes without an entry (e.g. Paladin) simply carry no aura.
const HERO_AURA={
  queen:    {glow:0x4fd8ff, outer:0x6fe0ff, inner:0x9a6bff, dome:0x5fe0ff, mote:0x9ff2ff},   // Moonlight
  thoryn:   {glow:0x2ff0d8, outer:0x35e8d0, inner:0x2f9cff, dome:0x30f0d8, mote:0x9ffff0},   // Runeblade (teal)
  aelindra: {glow:0x8fe86a, outer:0x9ff07a, inner:0xd8ffb0, dome:0x8fe86a, mote:0xe6ffc0},   // Moonlit grove (nature)
};
function auraRing(inner,outer,col,op){ const m=new THREE.Mesh(new THREE.RingGeometry(inner,outer,48),
  new THREE.MeshBasicMaterial({color:col,transparent:true,opacity:op,side:THREE.DoubleSide,depthWrite:false,blending:THREE.AdditiveBlending})); m.rotation.x=-Math.PI/2; return m; }
function makeHeroAura(){ disposeHeroAura(); const cfg=HERO_AURA[heroKind]||HERO_AURA.queen; cvTex(); const grp=new THREE.Group(); scene.add(grp);
  const glow=new THREE.Mesh(new THREE.CircleGeometry(3.0,48), new THREE.MeshBasicMaterial({color:cfg.glow,transparent:true,opacity:0.12,side:THREE.DoubleSide,depthWrite:false,blending:THREE.AdditiveBlending})); glow.rotation.x=-Math.PI/2; grp.add(glow);
  const outer=auraRing(2.55,2.95,cfg.outer,0.55), inner=auraRing(1.7,1.9,cfg.inner,0.5); grp.add(outer,inner);
  const dome=new THREE.Mesh(new THREE.SphereGeometry(2.4,20,12), new THREE.MeshBasicMaterial({color:cfg.dome,transparent:true,opacity:0.06,side:THREE.DoubleSide,depthWrite:false,blending:THREE.AdditiveBlending})); dome.position.y=2.0; grp.add(dome);
  const motes=[]; for(let i=0;i<9;i++){ const s=new THREE.Sprite(new THREE.SpriteMaterial({map:CV_GLOW,color:cfg.mote,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,opacity:0})); s.frustumCulled=false; grp.add(s); motes.push({s,a:i/9*6.28,rad:1.4+(i%3)*0.5,ph:i/9}); }
  heroAura={grp,outer,inner,glow,dome,motes,t:0,kind:heroKind}; return heroAura; }
function disposeHeroAura(){ if(!heroAura)return; scene.remove(heroAura.grp);
  heroAura.grp.traverse(o=>{ if(o.material&&o.material.dispose)o.material.dispose(); if(o.geometry&&o.geometry.dispose)o.geometry.dispose(); }); heroAura=null; }
function refreshHeroAura(){ if(HERO_AURA[heroKind] && hero && hero.alive){ if(!heroAura||heroAura.kind!==heroKind)makeHeroAura(); } else disposeHeroAura(); }
function updateHeroAura(dt){ if(!heroAura)return; const a=heroAura;
  if(!hero||!hero.alive){ a.grp.visible=false; return; } a.grp.visible=true; a.t+=dt;
  a.grp.position.set(hero.px, topY(hero.px,hero.pz)+0.06, hero.pz);
  a.outer.rotation.z+=dt*0.5; a.inner.rotation.z-=dt*0.8;
  const ds=1+0.05*Math.sin(a.t*2.0); a.dome.scale.set(ds,ds*0.92,ds); a.dome.material.opacity=0.05+0.03*Math.sin(a.t*2.4);
  a.glow.material.opacity=0.10+0.04*Math.sin(a.t*1.7);
  for(const m of a.motes){ const t=(a.t*0.25+m.ph)%1, s=Math.max(0.01,1-t);
    m.s.position.set(Math.cos(m.a+t*0.8)*m.rad, 0.1+t*3.4, Math.sin(m.a+t*0.8)*m.rad);
    m.s.scale.setScalar(0.5*s+0.15); m.s.material.opacity=0.9*Math.sin(Math.min(1,t)*Math.PI); } }
// expanding ground rune-ring flash (Fan of Knives cast)
function runeRingFlash(x,z,col,maxR){ const r=new THREE.Mesh(new THREE.RingGeometry(2.4,3.0,48),
  new THREE.MeshBasicMaterial({color:col,transparent:true,opacity:0.9,side:THREE.DoubleSide,depthWrite:false,blending:THREE.AdditiveBlending}));
  r.rotation.x=-Math.PI/2; r.position.set(x,topY(x,z)+0.12,z); r.scale.set(0.1,0.1,1); scene.add(r);
  const target=maxR/3.0; let t=0;(function an(){ t+=0.06; const s=0.1+(target-0.1)*Math.min(1,t/0.6); r.scale.set(s,s,1); r.material.opacity=Math.max(0,0.9-t*1.0); if(t<0.9)requestAnimationFrame(an); else scene.remove(r); })(); }
// Blink: violet shards implode at the origin, explode at the destination
function blinkImplode(x,z){ const y=topY(x,z)+2.0, geo=new THREE.OctahedronGeometry(0.5,0);
  for(let i=0;i<10;i++){ const a=i/10*6.28, m=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({color:0x9a5cff,transparent:true,opacity:0.9,blending:THREE.AdditiveBlending,depthWrite:false})); scene.add(m); let t=0;
    (function an(){ t+=0.10; const k=Math.min(1,t), r=2.8*(1-k)+0.2; m.position.set(x+Math.cos(a)*r,y+(1-k)*1.4,z+Math.sin(a)*r); m.scale.setScalar(Math.max(0.01,k*0.9)); m.material.opacity=0.9*k; if(t<1)requestAnimationFrame(an); else scene.remove(m); })(); }
  const f=new THREE.Mesh(new THREE.SphereGeometry(1.8,14,10),new THREE.MeshBasicMaterial({color:0xb98cff,transparent:true,opacity:0.6,blending:THREE.AdditiveBlending,depthWrite:false})); f.position.set(x,y,z); scene.add(f); let t=0;(function an(){t+=0.1;f.scale.setScalar(Math.max(0.01,1-t));f.material.opacity=Math.max(0,0.6*(1-t));if(t<1)requestAnimationFrame(an);else scene.remove(f);})(); pingRing(x,z,0x9a5cff); }
function blinkExplode(x,z){ const y=topY(x,z)+2.0, geo=new THREE.OctahedronGeometry(0.5,0);
  for(let i=0;i<12;i++){ const a=i/12*6.28, m=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({color:0xb07cff,transparent:true,opacity:0.95,blending:THREE.AdditiveBlending,depthWrite:false})); scene.add(m); let t=0;
    (function an(){ t+=0.07; const k=Math.min(1,t), r=0.3+k*3.4; m.position.set(x+Math.cos(a)*r,y+k*1.6,z+Math.sin(a)*r); m.scale.setScalar(Math.max(0.01,(1-k)*0.9)); m.material.opacity=Math.max(0,0.95-k); if(t<1)requestAnimationFrame(an); else scene.remove(m); })(); }
  const f=new THREE.Mesh(new THREE.SphereGeometry(1.4,14,10),new THREE.MeshBasicMaterial({color:0xd8b8ff,transparent:true,opacity:0.9,blending:THREE.AdditiveBlending,depthWrite:false})); f.position.set(x,y,z); scene.add(f); let t=0;(function an(){t+=0.09;f.scale.setScalar(1+t*3.2);f.material.opacity=Math.max(0,0.9-t*1.2);if(t<0.9)requestAnimationFrame(an);else scene.remove(f);})();
  shockwave(x,z,0x9a5cff,7); }
// apply the active hero's kit to the three ability buttons (icon/label) + per-slot cooldown maxes
function applyHeroKit(){ const k=HERO_KIT[heroKind]||HERO_KIT.queen; if(hero)hero.kit=heroKind;
  if(hero){ hero.aMax=k.a.cd; hero.spellMax=k.spell.cd; hero.blinkMax=k.blink.cd; }
  const setBtn=(el,slot,cls)=>{ if(!el)return; const i=el.querySelector('.ic'), c=el.querySelector('.cap'); if(i)i.innerHTML=ic(slot.icon); if(c)c.textContent=slot.cap; };
  setBtn(abilEl,k.a); setBtn(boltEl,k.spell); setBtn(smiteEl,k.blink); KIND_NAME.hero=k.name; }
function pickHero(kind){ if(!HERO_KIT[kind])kind='queen'; heroKind=kind; try{localStorage.setItem('wc_hero',kind);}catch(_){}
  if(hero){ const rk=RIGS[HERO_KIT[kind].rig]?HERO_KIT[kind].rig:'queen'; riggize(hero,rk); hero.hp=hero.max; hero.__atkT=0; hero.__invuln=0; hero.animState='idle';
    if(camLocked){ camAim.x=hero.px; camAim.z=hero.pz; } }
  applyHeroKit(); refreshHeroAura(); if(heroSelEl)heroSelEl.style.display='none'; started=true; refreshRadial();
  initAudio(); resumeAudio(); startMusic(); sfx('build'); }
// ===== Campaign / Skirmish (see docs/CAMPAIGN.md, docs/LORE.md) =====
// Skirmish = the current free-play; Campaign = linear missions on hand-authored maps.
// First scaffold: Act I Mission 1 runs on the live Sapphire-Shores map (Paladin ~ Valdris
// of the Iron Crown vs the Raider Horde). Later missions are shown but locked.
let gameMode='skirmish', activeMission=null;
const CAMP_KEY='verath_campaign';
function campCleared(){ try{ return new Set(JSON.parse(localStorage.getItem(CAMP_KEY))||[]); }catch(_){ return new Set(); } }
function campMarkClear(id){ const s=campCleared(); s.add(id); try{ localStorage.setItem(CAMP_KEY,JSON.stringify([...s])); }catch(_){ } }
const CAMPAIGN=[
  {id:'a1m1', act:'Act I — Inevitable', title:'The Survey Road', hero:'paladin', map:'The Ash Road', playable:true,
   intro:'Marshal Valdris leads the vanguard up the old survey road onto the Verath Floor. A small warband — but the Crown is watching. Learn to lead them: march, fight, and fortify.',
   lines:[
     {who:'Marshal Valdris', icon:'shield', text:'The road onto the Floor. Ironstone underfoot and beasts in the ash. We move light and we move now.'},
     {who:'Crown Scout',     icon:'select', text:'A raider outpost sits at the end of the road, my lord. Clear the beasts, raise a foothold, and it is ours.'},
   ],
   objective:'Follow the coach: move, fight, build — then raze the raider outpost.',
   outro:'The road is open and the outpost burns. The vanguard has its foothold on the Verath Floor.'},
  {id:'a1m2', act:'Act I — Inevitable', title:'Beachhead', hero:'paladin', map:'Twin Fords', playable:true,
   intro:'With a foothold won, the vanguard pushes to the fords. Now Valdris must run a proper camp — feed his supply, train troops, and break a dug-in raider warband.',
   lines:[
     {who:'Marshal Valdris', icon:'shield', text:'A wider crossing, a stronger foe. This time we build before we bleed — supply, then swords.'},
     {who:'Crown Scout',     icon:'select', text:'Beasts range the fords between us and the raiders. Mind your economy, my lord, and the Floor is yours.'},
   ],
   objective:'Build an economy, train a warband, and raze the raider camp at the fords.',
   outro:'The fords are held. Beyond them the ash deepens — and something older stirs.'},
  {id:'a1m3', act:'Act I — Inevitable',            title:'Ring the Ironstone',   hero:'paladin', map:'Sapphire Shores', playable:false},
  {id:'a2m1', act:'Act II — Cornered', title:'The Sealing Rite', hero:'paladin', map:'The Deepvein Verge', playable:true,
   intro:'The ironstone runs deeper than any survey knew — down to the Deepvein, where the Unveiled stir. The Crown’s mystics can seal them again, but the rite demands long minutes of unbroken channeling. Valdris must hold the ground while they chant.',
   lines:[
     {who:'Crown Mystic',    icon:'cleric', text:'The old seal is failing, Marshal. Hold the ring while we close it — a few minutes of channel, unbroken. If the Unveiled break our chant, they pour out for good.'},
     {who:'Marshal Valdris', icon:'shield', text:'Then nothing reaches the altar. Raise towers, form the line — hold until the seal takes. Begin the rite.'},
   ],
   objective:'Defend the altar until the Sealing Rite completes — keep the mystics alive.',
   outro:'The seal holds; the Unveiled are driven back into the deep. But something answered the rite from below — and it remembers the name Valdris.'},
  {id:'a3m1', act:'Act III — The Silent Council',  title:'Parley at the High Rim',hero:'queen',  map:'Rimwall Pass',    playable:false},
  {id:'a4m1', act:'Act IV — The Deepvein',         title:'The Ashfall Remembered',hero:'queen',  map:'The Deepvein',    playable:false},
];
function startMission(m){ if(!m||!m.playable)return; activeMission=m; gameMode='campaign';
  if(modeSelEl)modeSelEl.style.display='none'; if(missionSelEl)missionSelEl.style.display='none'; if(missionCardEl)missionCardEl.style.display='none';
  if(resultEl)resultEl.style.display='none';
  // rebuild the world for this mission's map (build() spins up a fresh scene)
  applyLevel(m.id); resetWorld(); heroKind=m.hero; build(); spawnGame(); initFog(); if(typeof bakeMiniLand==='function')bakeMiniLand();
  pickHero(m.hero);   // sets kit + started=true + audio; re-riggizes the freshly-spawned hero
  camLocked=true; applyCamMode(); if(hero){ camAim.x=hero.px; camAim.z=hero.pz; camAim.init=true; selectOne(hero); }   // campaign opens in Hero view with the hero selected
  const tip=document.getElementById('tip'); if(tip)tip.classList.add('hide');
  const showObj=()=>{ if(objBannerEl) objBannerEl.textContent='◈ '+m.objective; _objShown=true; applyHudVis(); startTutorial(m); };
  if(m.lines&&m.lines.length) playDialog(m.lines, showObj); else showObj(); }
// ---- hard-gated tutorial coach: sequential steps, each waits for its gate; highlights the control ----
let TUT=null, _tutStart=null, _camTouched=false, _coachAck=false, _hudHidden=false, _objShown=false;
function applyHudVis(){ const tog=document.getElementById('infoTog');
  const coachActive = !!(TUT && TUT.i<TUT.steps.length);
  const active = _objShown || coachActive;
  if(tog){ tog.style.display = active?'block':'none'; tog.textContent = _hudHidden?'▸ Info':'▾ Info'; }
  if(objBannerEl) objBannerEl.style.display = (_hudHidden||!_objShown)?'none':'block';
  const c=document.getElementById('coach'); if(c) c.style.display = (_hudHidden||!coachActive)?'none':'block'; }
function coachEl(){ let el=document.getElementById('coach'); if(!el){
    const st=document.createElement('style'); st.textContent='.tutHi{outline:3px solid #ffd24a!important;border-radius:14px;animation:tutpulse 1.1s ease-in-out infinite} @keyframes tutpulse{0%,100%{box-shadow:0 0 0 0 rgba(255,210,74,.55)}50%{box-shadow:0 0 0 12px rgba(255,210,74,0)}}'; document.head.appendChild(st);
    el=document.createElement('div'); el.id='coach';
    el.style.cssText='position:fixed;left:calc(12px + var(--sl));top:calc(246px + var(--st));z-index:58;width:min(46vw,232px);background:rgba(12,16,22,0.92);color:#e7edf3;border:1px solid #c79a42;border-radius:10px;padding:9px 12px;font:600 12.5px/1.4 system-ui;text-align:left;box-shadow:0 6px 22px rgba(0,0,0,.55);transition:opacity .3s;display:none;pointer-events:none';
    el.addEventListener('pointerdown',ev=>{ ev.stopPropagation(); _coachAck=true; }); document.body.appendChild(el); }
  return el; }
function tutReturnToBase(){ if(!coreB||typeof moveOrder!=='function')return; const list=[hero,...allies].filter(u=>u&&u.alive);
  for(const u of list){ u.forcedTarget=null; u.target=null; } moveOrder(list, coreB.x, coreB.z-8); }
function tutHighlight(hi){ document.querySelectorAll('.tutHi').forEach(e=>e.classList.remove('tutHi'));
  const map={ joystick:joyBase, hit:hitEl, cam:camEl, view:viewEl, mini:document.getElementById('mini'),
    bless:abilEl, hammer:boltEl, shield:smiteEl, select:boxBtn, charge:chargeEl, recall:recallEl };
  const el=map[hi]||null; if(el)el.classList.add('tutHi'); }
const TUT_SCRIPTS={
  a1m1:[
    {text:'Valdris is selected and the camera follows him (Hero view). Drag the left stick to march him up the road.', hi:'joystick', gate:()=>hero&&_tutStart&&Math.hypot(hero.px-_tutStart.x,hero.pz-_tutStart.z)>12},
    {text:'Tap <b>“Cam”</b> (top-right) to switch between Hero view (follows Valdris) and Free view (drag to look around).', hi:'cam', gate:()=>_camTouched},
    {text:'Tap <b>“View”</b> to rotate the battlefield to a new angle.', hi:'view', gate:()=>_tutBtn==='view'},
    {text:'Top-left is your <b>minimap</b> — dark areas are unexplored fog. In Free view you can tap it to jump the camera. Tap to continue.', hi:'mini', info:true},
    {text:'<b>“HIT”</b> is Valdris’s basic attack — it lights up when an enemy is in reach. Tap to continue.', hi:'hit', info:true},
    {text:'<b>“Bless”</b> — Consecration: hallow the ground to heal your troops. Tap it to cast.', hi:'bless', gate:()=>_tutBtn==='stomp'},
    {text:'<b>“Hammer”</b> — Hammer of Justice: arm it, then tap a foe to stun. Tap it now.', hi:'hammer', gate:()=>_tutBtn==='bolt'},
    {text:'<b>“Shield”</b> — Divine Shield makes Valdris briefly invulnerable. Tap it.', hi:'shield', gate:()=>_tutBtn==='smite'},
    {text:'<b>“Select”</b> — tap it, then drag a box over your troops to command them as a squad. Tap Select now.', hi:'select', gate:()=>_tutBtn==='select'},
    {text:'<b>“Charge”</b> — order your whole army to advance and attack. Tap it.', hi:'charge', gate:()=>_tutBtn==='charge'},
    {text:'<b>“Recall”</b> — call your army back to Valdris. Tap it.', hi:'recall', gate:()=>_tutBtn==='recall'},
    {text:'You have the controls, Marshal. Now — ash-beasts prowl the road ahead! March in and use <b>HIT</b> to destroy them.', hi:'hit', gate:()=>!creepCamps.length||creepCamps.every(c=>c.cleared)},
    {text:'A molten glow bleeds from an inlet just south of the road. Scout it — see what the ash is hiding.', hi:'mini', onEnter:()=>{ if(_vein)pingRing(_vein.x,_vein.z,0xff8a2a); }, gate:()=>hero&&_vein&&Math.hypot(hero.px-_vein.x,hero.pz-_vein.z)<15},
    {text:'<b>Crown Scout:</b> Ironroot, my lord — ore-veins that drink the ash-fire and grow like roots through the Floor. This is the ironstone the surveys promised. <i>Tap to continue.</i>', info:true, onEnter:()=>{ _veinFound=true; }},
    {text:'<b>Marshal Valdris:</b> Then the dead road led true. This is why the Crown crossed a continent — and why the Horde will die before they yield it. Mark the vein; we hold this ground. <i>Tap to continue.</i>', info:true},
    {text:'Road’s clear and the vein is ours. Fall back to the outpost — your men are marching back with you.', onEnter:()=>tutReturnToBase(), gate:()=>hero&&coreB&&Math.hypot(hero.px-coreB.x,hero.pz-coreB.z)<18},
    {text:'At the outpost, tap a glowing plot and build a <b>Barracks</b> to raise troops.', gate:()=>plots.some(p=>p.cat==='army')},
    {text:'Now raise an <b>Arrow Tower</b> on the turret plot — it faces the raiders and guards the road.', gate:()=>plots.some(p=>p.cat==='defense')},
    {text:'Forward, Marshal — march on the raider outpost and raze its throne!', hi:null, gate:()=>false},
  ],
  a1m2:[
    {text:'March out with your warband — drag the left stick to move.', hi:'joystick', gate:()=>hero&&_tutStart&&Math.hypot(hero.px-_tutStart.x,hero.pz-_tutStart.z)>12},
    {text:'Beasts range the fords. Clear the creep camps blocking the crossing.', hi:'hit', gate:()=>!creepCamps.length||creepCamps.every(c=>c.cleared)},
    {text:'Fall back to your camp — your men return with you.', onEnter:()=>tutReturnToBase(), gate:()=>hero&&coreB&&Math.hypot(hero.px-coreB.x,hero.pz-coreB.z)<18},
    {text:'Build a <b>House</b> (economy plot) to raise your supply cap.', gate:()=>plots.some(p=>p.cat==='economy')},
    {text:'Raise a <b>Barracks</b>, then train troops from it.', gate:()=>plots.some(p=>p.cat==='army')},
    {text:'Guard the fords with a <b>Tower</b>, then break the raider camp!', gate:()=>plots.some(p=>p.cat==='defense')},
    {text:'Assault the raider camp and raze its throne!', hi:null, gate:()=>false},
  ],
};
function startTutorial(m){ const steps=TUT_SCRIPTS[m.id]; if(!steps){ TUT=null; coachEl().style.display='none'; return; }
  steps.forEach(s=>{ s.__done=false; }); _coachAck=false; _hudHidden=false;
  TUT={steps,i:0}; _tutStart=hero?{x:hero.px,z:hero.pz}:null; _camTouched=false; showCoach(); }
function showCoach(){ const el=coachEl(); if(!TUT||TUT.i>=TUT.steps.length){ el.style.display='none'; el.style.pointerEvents='none'; tutHighlight(null); return; }
  const s=TUT.steps[TUT.i]; if(s.onEnter && !s.__done){ s.__done=true; try{ s.onEnter(); }catch(_){} }
  el.innerHTML='◈ '+s.text + (s.info?'<div style="margin-top:6px;color:#ffd88a;font-size:12px">tap to continue ›</div>':'');
  el.style.display=_hudHidden?'none':'block'; el.style.opacity='1'; el.style.pointerEvents=s.info?'auto':'none'; tutHighlight(s.hi);
  applyHudVis(); }
function tutTick(){ if(!TUT)return; const s=TUT.steps[TUT.i]; if(!s)return;
  const done = s.info ? _coachAck : (s.gate&&s.gate());
  if(done){ _coachAck=false; _tutBtn=null; TUT.i++;
    if(TUT.i<TUT.steps.length){ if(typeof sfx==='function')sfx('build'); showCoach(); } else { coachEl().style.display='none'; coachEl().style.pointerEvents='none'; tutHighlight(null); TUT=null; applyHudVis(); } } }
// ---- WC3-style conversation banner: a queue of {who,icon,text}; tap advances; onDone fires after the last line ----
let dialogActive=false, _dq=[], _dqDone=null;
function playDialog(lines, onDone){ if(!dialogEl||!lines||!lines.length){ if(onDone)onDone(); return; }
  _dq=lines.slice(); _dqDone=onDone||null; dialogActive=true; dialogEl.style.display='flex'; showDialogLine(); }
function showDialogLine(){ const l=_dq[0]; if(!l){ endDialog(); return; }
  dialogEl.querySelector('.por').innerHTML=ic(l.icon||'shield');
  dialogEl.querySelector('.who').textContent=l.who||'';
  dialogEl.querySelector('.txt').textContent=l.text||''; }
function advanceDialog(){ if(!dialogActive)return; _dq.shift(); if(_dq.length) showDialogLine(); else endDialog(); }
function endDialog(){ dialogActive=false; if(dialogEl)dialogEl.style.display='none'; const cb=_dqDone; _dqDone=null; if(cb)cb(); }
function buildMissionList(){ const list=missionSelEl.querySelector('.mlist'); list.innerHTML=''; const cleared=campCleared(); let curAct=null;
  CAMPAIGN.forEach(m=>{ if(m.act!==curAct){ curAct=m.act; const a=document.createElement('div'); a.className='act'; a.textContent=m.act; list.appendChild(a); }
    const done=cleared.has(m.id); const c=document.createElement('div'); c.className='mCard'+(m.playable?'':' lock')+(done?' done':'');
    c.innerHTML='<div><div class="mn">'+m.title+'</div><div class="md">'+m.map+(m.playable?'':' · locked')+'</div></div>'+(done?'<div class="mstar">✓</div>':'');
    if(m.playable) c.addEventListener('pointerdown',ev=>{ ev.stopPropagation(); showMissionCard(m); });
    list.appendChild(c); }); }
function showMissionCard(m){ missionSelEl.style.display='none';
  missionCardEl.innerHTML='<div class="mc-act">'+m.act+'</div><div class="mc-title">'+m.title+'</div><div class="mc-body">'+m.intro+'</div>'
    +'<div class="mc-obj">Objective: '+m.objective+'</div><button class="mc-go">Begin — '+m.map+'</button>';
  missionCardEl.querySelector('.mc-go').addEventListener('pointerdown',ev=>{ ev.stopPropagation(); startMission(m); });
  missionCardEl.style.display='flex'; }
function focusFire(en){ allies.forEach(e=>{ if(e.alive){ e.forcedTarget=en; e.target=en; e.order=null; e.following=false; } });
  rallyMarker.material.color.setHex(0xff6a5a); rallyMarker.position.set(en.px,topY(en.px,en.pz)+0.3,en.pz); rallyMarker.visible=true; clearTimeout(rallyMarker.__to); rallyMarker.__to=setTimeout(()=>rallyMarker.visible=false,900); }
// ---------- RTS selection + context orders (Siege-Up style) ----------
let boxMode=false, boxBtn=null, selPanelEl=null, respawnEl=null, heroSelEl=null; const HERO_RESPAWN=8;
let modeSelEl=null, missionSelEl=null, missionCardEl=null, objBannerEl=null, dialogEl=null;   // campaign/skirmish UI
const ABIL_RANGE=26;   // hard cap on targeted-ability reach — inside hero sight (30) so nothing casts/lands from the fog
let heroKind='queen', started=false, holyGrounds=[]; try{ heroKind=localStorage.getItem('wc_hero')||'queen'; }catch(_){}
// per-hero ability kits — icon/label/cooldown per slot (a=AoE, spell=armed-target, blink=utility). Handlers dispatch on hero.kit.
const HERO_KIT={
  queen:  {name:'Elf Queen', rig:'queen', a:{icon:'fan',cap:'Fan',cd:6}, spell:{icon:'shadow',cap:'Strike',cd:8}, blink:{icon:'blink',cap:'Blink',cd:7}},
  paladin:{name:'Paladin', rig:'paladin', a:{icon:'holy',cap:'Bless',cd:7}, spell:{icon:'hammer',cap:'Hammer',cd:8}, blink:{icon:'shield',cap:'Shield',cd:12}},
  aelindra:{name:'Aelindra', rig:'aelindra', a:{icon:'fan',cap:'Volley',cd:7}, spell:{icon:'archer',cap:'Moonfire',cd:7}, blink:{icon:'blink',cap:'Windstep',cd:6}},
  thoryn: {name:'Thoryn Greywarden', rig:'thoryn', a:{icon:'swords',cap:'Blade Dance',cd:6}, spell:{icon:'shadow',cap:'Root Lash',cd:8}, blink:{icon:'blink',cap:'Windstep',cd:7}},   // warden swordmaster — reuses the Warden handlers (nova / poison-strike / blink)
};
// each hero fields its own faction's army + buildings in skirmish (pbld='' elf, 'human_' Iron Crown, 'orc_' horde)
const HERO_FACTION={
  queen:    {pbld:'',       units:{warrior:'warrior',  archer:'archer', cleric:'priestess'}},   // Rimwalkers (Night Elf) — Bitgem elf archer
  aelindra: {pbld:'',       units:{warrior:'warrior',  archer:'archer', cleric:'priestess'}},   // Rimwalkers (Night Elf)
  paladin:  {pbld:'human_', units:{warrior:'hfootman', archer:'harcher', cleric:'hmage'}},        // Iron Crown (Human)
  thoryn:   {pbld:'',       units:{warrior:'warrior',  archer:'archer', cleric:'priestess'}},   // Rimwalkers (Night Elf) — Greywarden
};
function applyHeroFaction(k){ const f=HERO_FACTION[k]; if(!f)return; BLDPFX=f.pbld; URIG={...f.units}; }
function nearestAllyTo(x,z,maxd){ let b=null,bd=maxd*maxd;
  for(const e of [hero,...allies]){ if(!e||!e.alive)continue; const dd=(e.px-x)**2+(e.pz-z)**2; if(dd<bd){bd=dd;b=e;} } return b; }
function clearSel(){ selected.clear(); updateSelPanel(); refreshRadial(); }
function selectOne(u){ selected.clear(); if(u&&u.alive)selected.add(u); updateSelPanel(); refreshRadial(); }
function selectMany(list){ selected.clear(); for(const u of list) if(u&&u.alive)selected.add(u); updateSelPanel(); refreshRadial(); }
// ---- selection-driven radial: hero abilities when hero/none selected, squad commands when a unit group is selected ----
let radialMode='hero', amArmed=false;
function stopSel(){ for(const e of selected){ if(e===hero)continue; e.order=null; e.target=null; e.forcedTarget=null; e.following=false; } }
function holdSel(){ for(const e of selected){ if(e===hero)continue; e.order={x:e.px,z:e.pz}; e.target=null; e.forcedTarget=null; e.following=false; } }
function refreshRadial(){ if(!abilEl)return;
  radialMode = (selected.size>0 && !selected.has(hero)) ? 'squad' : 'hero';
  const setB=(el,icn,cap)=>{ if(!el)return; const i=el.querySelector('.ic'), c=el.querySelector('.cap'); if(i)i.innerHTML=ic(icn); if(c)c.textContent=cap; };
  if(radialMode==='squad'){
    if(hitEl)hitEl.style.display='none';                                  // basic attack is hero-only
    setB(abilEl,'stop','Stop'); setB(boltEl,'hold','Hold'); setB(smiteEl,'amove','Atk-Move');
    abilEl.classList.remove('cooling'); boltEl.classList.remove('cooling','armed'); smiteEl.classList.remove('cooling'); spellArmed=false;
  } else {
    if(hitEl)hitEl.style.display=''; amArmed=false; applyHeroKit();        // restore the hero kit icons/labels
  }
  updateSpellUI(); }
// context orders operate on the current selection only
function moveOrder(list,gx,gz){ let k=0; for(const e of list){ if(!e.alive)continue;
    const col=((k%4)-1.5)*2.8, row=Math.floor(k/4)*2.8; k++;
    if(e===hero){ e.order={x:gx,z:gz}; } else { e.order={x:gx+col,z:gz+row}; e.forcedTarget=null; e.target=null; e.following=false; } }
  rallyMarker.material.color.setHex(0x8df09b); rallyMarker.position.set(gx,topY(gx,gz)+0.3,gz); rallyMarker.visible=true; clearTimeout(rallyMarker.__to); rallyMarker.__to=setTimeout(()=>rallyMarker.visible=false,1800); pingRing(gx,gz,0x8df09b); }
function attackOrder(list,en){ for(const e of list){ if(!e.alive)continue;
    if(e===hero){ e.order={x:en.px,z:en.pz}; } else { e.forcedTarget=en; e.target=en; e.order=null; e.following=false; } }
  rallyMarker.material.color.setHex(0xff6a5a); rallyMarker.position.set(en.px,topY(en.px,en.pz)+0.3,en.pz); rallyMarker.visible=true; clearTimeout(rallyMarker.__to); rallyMarker.__to=setTimeout(()=>rallyMarker.visible=false,900); }
const KIND_NAME={hero:'Elf Queen', warrior:'Warrior', archer:'Archer', cleric:'Priestess', drake:'Drake'};
const KIND_ICON={hero:'sword', warrior:'warrior', archer:'archer', cleric:'cleric', assassin:'sword', drake:'drake'};
// prefer the unit's baked face portrait; fall back to the line icon if a portrait wasn't rendered
function unitFace(u,fallbackKind){ const rk=u&&u.rigKey, src=rk&&PORTRAITS[rk];
  return src ? '<img class="spFace" src="'+src+'" alt="">' : ic(KIND_ICON[fallbackKind]||'warrior'); }
let hubGroup=[];   // remembered multi-type squad so the "All" button can restore the full selection after a chip sub-select
function updateSelPanel(){ if(!selPanelEl)return;
  // the hub frame + build button stay docked once a mission is live; hidden only on menus/pre-game
  if(buildBtnEl) buildBtnEl.style.display = started?'flex':'none';
  if(!started){ selPanelEl.style.display='none'; return; }
  selPanelEl.style.display='flex';
  const icEl=selPanelEl.querySelector('.spIc'), nmEl=selPanelEl.querySelector('.spNm'),
        barF=selPanelEl.querySelector('.spBarF'), barT=selPanelEl.querySelector('.spBarT'), stEl=selPanelEl.querySelector('.spSt'),
        grid=selPanelEl.querySelector('.spGrid'), acts=selPanelEl.querySelector('.spActs'), allBtn=selPanelEl.querySelector('.spAll');
  const sel=[...selected].filter(u=>u.alive);
  if(!sel.length){                                                         // idle state: frame present, empty crest
    selPanelEl.classList.add('empty');
    icEl.innerHTML=ic('shield'); nmEl.textContent='No selection'; barF.style.width='0%'; barT.textContent='';
    stEl.textContent='Tap or drag to select'; grid.style.display='none'; acts.style.display='none'; grid.__sig=null; return;
  }
  selPanelEl.classList.remove('empty');
  // group the selection by unit type (the hero is its own group)
  const groups={}, order=[]; for(const u of sel){ const k=(u===hero)?'hero':u.kind; if(!groups[k]){groups[k]=[];order.push(k);} groups[k].push(u); }
  if(order.length>1) hubGroup=sel.slice();   // remember genuine mixed squads for "All"
  // primary = the hero if selected, else the lead type's first unit — its portrait fills the window
  const primary = (selected.has(hero)&&hero&&hero.alive) ? hero : sel[0];
  const pk=(primary===hero)?'hero':primary.kind, sameType=(order.length===1);
  icEl.innerHTML=unitFace(primary,pk);
  nmEl.textContent = (sameType&&sel.length>1) ? (sel.length+'× '+(KIND_NAME[pk]||pk)) : (KIND_NAME[pk]||pk);
  let hp,max;   // homogeneous group → combined bar; mixed → the focused unit's own bar
  if(sameType){ hp=sel.reduce((a,e)=>a+Math.max(0,e.hp),0); max=sel.reduce((a,e)=>a+e.max,0); }
  else { hp=Math.max(0,primary.hp); max=primary.max; }
  barF.style.width=(max?Math.max(0,Math.min(1,hp/max))*100:0)+'%'; barT.textContent=Math.ceil(hp)+' / '+max;
  stEl.textContent = (primary.dmg!=null) ? (primary.dmg+' dmg · '+(+(primary.range||0).toFixed(1))+' rng · '+Math.round(primary.spd||0)+' spd') : '';
  // squad grid: one tappable cell per type (WC3-style), sub-selects that type
  grid.style.display='flex';
  const sig=order.map(k=>k+groups[k].length).join(',')+'|'+pk;
  if(grid.__sig!==sig){ grid.__sig=sig; grid.innerHTML='';
    for(const k of order){ const list=groups[k].slice(); const c=document.createElement('div'); c.className='spCell'+(k===pk?' on':'');
      c.innerHTML=unitFace(list[0],k)+(list.length>1?'<span class="n">'+list.length+'</span>':'');
      c.title=KIND_NAME[k]||k; c.addEventListener('pointerdown',ev=>{ ev.stopPropagation(); selectMany(list); });
      grid.appendChild(c); } }
  // actions: "All" restores the remembered squad when the current selection is a strict subset of it
  const restore=hubGroup.filter(u=>u&&u.alive);
  const showAll = restore.length>sel.length && sel.every(u=>restore.includes(u));
  acts.style.display='flex'; allBtn.style.display=showAll?'flex':'none';
  allBtn.onpointerdown=ev=>{ ev.stopPropagation(); if(restore.length) selectMany(restore); };
}
function selectInRect(x0,y0,x1,y1){ const lo=[Math.min(x0,x1),Math.min(y0,y1)], hi=[Math.max(x0,x1),Math.max(y0,y1)]; const got=[];
  for(const e of [hero,...allies]){ if(!e||!e.alive)continue; const [sx,sy]=screenOf(e.px,e.pz);
    if(sx>=lo[0]&&sx<=hi[0]&&sy>=lo[1]&&sy<=hi[1]) got.push(e); }
  selectMany(got); return got.length; }
function setBoxMode(on){ boxMode=on; if(boxBtn){ boxBtn.style.borderColor=on?'#7ef08a':''; boxBtn.style.boxShadow=on?'0 0 0 2px rgba(120,230,140,0.55),0 0 16px rgba(120,230,140,0.5)':''; } }
// ---- refined projectiles ----
// stylised arrow, built once & cloned: wood shaft + steel head + cream fletching + glowing tip. Long axis = +Y.
let ARROW_PROTO=null;
function arrowProto(){ if(ARROW_PROTO)return ARROW_PROTO; const g=new THREE.Group();
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.08,0.08,2.8,7), new THREE.MeshBasicMaterial({color:0x6b4a2a})));
  const head=new THREE.Mesh(new THREE.ConeGeometry(0.2,0.7,7), new THREE.MeshBasicMaterial({color:0xe4ebf2})); head.position.y=1.72; g.add(head);
  for(const s of [0,1,2]){ const fl=new THREE.Mesh(new THREE.PlaneGeometry(0.5,0.5), new THREE.MeshBasicMaterial({color:0xfff2c8,side:THREE.DoubleSide,transparent:true,opacity:0.95})); fl.position.y=-1.2; fl.rotation.y=s*Math.PI/3; g.add(fl); }
  const tip=new THREE.Mesh(new THREE.SphereGeometry(0.3,10,8), new THREE.MeshBasicMaterial({color:0xfff6d0,transparent:true,opacity:0.55,blending:THREE.AdditiveBlending,depthWrite:false})); tip.position.y=1.9; g.add(tip);
  ARROW_PROTO=g; return g; }
// short-lived additive puff for motion trails / impact sparks
function puff(x,y,z,col,r,op){ const m=new THREE.Mesh(new THREE.SphereGeometry(r,8,6), new THREE.MeshBasicMaterial({color:col,transparent:true,opacity:op,blending:THREE.AdditiveBlending,depthWrite:false}));
  m.position.set(x,y,z); scene.add(m); let a=0;(function an(){ a+=0.09; m.scale.setScalar(Math.max(0.01,1-a*0.7)); m.material.opacity=Math.max(0,op-a*op*1.3); if(a<1)requestAnimationFrame(an); else scene.remove(m); })(); }
// ---------- procedural audio: Web-Audio SFX + ambient music bed (no asset files) ----------
let actx=null, masterGain=null, sfxGain=null, musGain=null, audioOn=true, musicTimer=null; const _sfxLast={};
function initAudio(){ if(actx)return; try{ audioOn=(localStorage.getItem('wc_audio')!=='0'); }catch(_){}
  try{ actx=new (window.AudioContext||window.webkitAudioContext)();
  masterGain=actx.createGain(); masterGain.gain.value=audioOn?0.9:0; masterGain.connect(actx.destination);
  sfxGain=actx.createGain(); sfxGain.gain.value=0.9; sfxGain.connect(masterGain);
  musGain=actx.createGain(); musGain.gain.value=0.16; musGain.connect(masterGain); }catch(e){ actx=null; } }
function resumeAudio(){ if(actx&&actx.state==='suspended')actx.resume(); }   // mobile needs a gesture to start audio
function tone(freq,dur,type,gain,slideTo,dest){ if(!actx)return; const t=actx.currentTime; const o=actx.createOscillator(), g=actx.createGain();
  o.type=type||'sine'; o.frequency.setValueAtTime(freq,t); if(slideTo)o.frequency.exponentialRampToValueAtTime(Math.max(1,slideTo),t+dur);
  g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime(gain||0.3,t+0.008); g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
  o.connect(g); g.connect(dest||sfxGain); o.start(t); o.stop(t+dur+0.03); }
function noise(dur,gain,f0,f1,dest){ if(!actx)return; const t=actx.currentTime, n=Math.floor(actx.sampleRate*dur);
  const buf=actx.createBuffer(1,n,actx.sampleRate), d=buf.getChannelData(0); for(let i=0;i<n;i++)d[i]=Math.random()*2-1;
  const src=actx.createBufferSource(); src.buffer=buf; const bp=actx.createBiquadFilter(); bp.type='bandpass'; bp.frequency.setValueAtTime(f0||800,t);
  if(f1)bp.frequency.exponentialRampToValueAtTime(Math.max(40,f1),t+dur); const g=actx.createGain();
  g.gain.setValueAtTime(gain||0.3,t); g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
  src.connect(bp); bp.connect(g); g.connect(dest||sfxGain); src.start(t); src.stop(t+dur+0.03); }
function sfx(name){ if(!actx||!audioOn)return; const now=performance.now(); if(_sfxLast[name]&&now-_sfxLast[name]<45)return; _sfxLast[name]=now;
  switch(name){
    case 'melee': noise(0.09,0.22,1200,300); tone(180,0.08,'square',0.1,90); break;
    case 'arrow': tone(900,0.12,'triangle',0.1,300); noise(0.05,0.08,2000,600); break;
    case 'magic': tone(520,0.22,'sine',0.14,1040); tone(780,0.18,'sine',0.06,1560); break;
    case 'arcane': tone(660,0.22,'sine',0.13,1320); tone(990,0.16,'triangle',0.06); break;
    case 'fire': noise(0.3,0.18,600,120); tone(120,0.28,'sawtooth',0.09,50); break;
    case 'hit': noise(0.07,0.16,900,300); break;
    case 'death': noise(0.24,0.22,500,80); tone(150,0.2,'square',0.09,60); break;
    case 'nova': tone(300,0.4,'sine',0.2,900); noise(0.35,0.15,400,1600); break;
    case 'blink': tone(1200,0.16,'sine',0.13,400); tone(600,0.12,'sine',0.07,1800); break;
    case 'hammer': noise(0.12,0.2,500,140); tone(220,0.16,'square',0.13,110); break;
    case 'shield': tone(440,0.5,'sine',0.15,660); tone(660,0.5,'sine',0.07,880); break;
    case 'stun': tone(300,0.2,'square',0.1,1200); break;
    case 'boom': noise(0.5,0.32,300,50); tone(90,0.5,'sine',0.22,40); break;
    case 'roar': tone(140,0.5,'sawtooth',0.2,70); noise(0.4,0.1,300,120); break;
    case 'ui': tone(880,0.05,'square',0.07,1200); break;
    case 'build': tone(520,0.09,'triangle',0.1,780); tone(780,0.09,'triangle',0.06); break;
    case 'win': [523,659,784,1047].forEach((f,i)=>setTimeout(()=>tone(f,0.4,'triangle',0.18),i*140)); break;
    case 'lose': [392,330,262,196].forEach((f,i)=>setTimeout(()=>tone(f,0.5,'sawtooth',0.16),i*180)); break;
  } }
const MUS_CHORDS=[[196,247,294],[220,262,330],[175,220,262],[147,196,247]]; let _musI=0;
function musicBar(){ if(!actx){ musicTimer=setTimeout(musicBar,3200); return; }
  if(audioOn){ const ch=MUS_CHORDS[_musI%MUS_CHORDS.length]; _musI++;
    ch.forEach(f=>{ const t=actx.currentTime,o=actx.createOscillator(),g=actx.createGain(); o.type='sine'; o.frequency.value=f;
      g.gain.setValueAtTime(0.0001,t); g.gain.linearRampToValueAtTime(0.05,t+0.6); g.gain.linearRampToValueAtTime(0.0001,t+3.0); o.connect(g); g.connect(musGain); o.start(t); o.stop(t+3.15); });
    ch.concat([ch[0]*2]).forEach((f,i)=> setTimeout(()=>{ if(audioOn)tone(f,0.5,'triangle',0.045,null,musGain); }, i*400)); }
  musicTimer=setTimeout(musicBar,3200); }
function startMusic(){ if(musicTimer)return; musicBar(); }
function setAudio(on){ audioOn=on; if(masterGain)masterGain.gain.value=on?0.9:0; try{localStorage.setItem('wc_audio',on?'1':'0');}catch(_){} }
// ---------- juice: screen shake, floating damage numbers, squash/impact, shockwaves ----------
let shakeAmt=0, dmgLayer=null, dmgCount=0; const _pv=new THREE.Vector3();
function addShake(a){ shakeAmt=Math.min(1.6, Math.max(shakeAmt, a*0.45)); }   // global shake damped ~55% + lower cap
function toScreen(x,y,z){ _pv.set(x,y,z).project(cam); return {x:(_pv.x*0.5+0.5)*innerWidth, y:(-_pv.y*0.5+0.5)*innerHeight, vis:_pv.z>-1&&_pv.z<1}; }
function popDmg(wx,wy,wz,txt,cls){ if(!dmgLayer||dmgCount>44)return; const s=toScreen(wx,wy,wz);
  if(!s.vis||s.x<-30||s.x>innerWidth+30||s.y<-30||s.y>innerHeight+30)return;
  const d=document.createElement('div'); d.className='dmgN'+(cls?' '+cls:''); d.textContent=txt;
  d.style.left=(s.x+rr(-9,9))+'px'; d.style.top=s.y+'px'; dmgLayer.appendChild(d); dmgCount++;
  requestAnimationFrame(()=>{ d.style.transform='translate(-50%,-50%) translateY(-48px)'; d.style.opacity='0'; });
  setTimeout(()=>{ d.remove(); dmgCount--; }, 700); }
function squash(e){ if(e)e.__sq=1; }                       // impulse; loco eases it back (see loco)
function pingRing(x,z,col){ const r=new THREE.Mesh(new THREE.RingGeometry(0.5,1.3,26),new THREE.MeshBasicMaterial({color:col||0x9fe0ff,transparent:true,opacity:0.9,side:THREE.DoubleSide,depthWrite:false}));
  r.rotation.x=-Math.PI/2; r.position.set(x,topY(x,z)+0.35,z); scene.add(r); let a=0;(function an(){a+=0.08; r.scale.setScalar(1+a*7); r.material.opacity=Math.max(0,0.9-a*1.15); if(a<0.85)requestAnimationFrame(an); else scene.remove(r);})(); }
function shockwave(x,z,col,mx){ const r=new THREE.Mesh(new THREE.RingGeometry(0.6,2.1,36),new THREE.MeshBasicMaterial({color:col||0xffd08a,transparent:true,opacity:0.95,side:THREE.DoubleSide,depthWrite:false}));
  r.rotation.x=-Math.PI/2; r.position.set(x,topY(x,z)+0.4,z); scene.add(r); let a=0;(function an(){a+=0.05; r.scale.setScalar(1+a*(mx||16)); r.material.opacity=Math.max(0,0.95-a*1.05); if(a<0.9)requestAnimationFrame(an); else scene.remove(r);})(); }
// single choke-point for all combat damage — every hit flashes, punches (squash), and floats a number
function damage(d,amt,heavy){ if(!d)return; if(d===hero && (hero.__invuln||0)>0){ pingRing(hero.px,hero.pz,0xffe6a0); return; }   // Divine Shield blocks all damage
  d.hp-=amt; d.hitT=Math.max(d.hitT||0, heavy?0.3:0.14); squash(d);
  if(d.creep && d.camp) campAggro(d.camp);   // striking any camp member wakes the whole den
  const enemy=(d.team==='enemy'||d.kind==='core'||d.kind==='bld');
  if(enemy && !isVisible(d.px,d.pz))return;                 // don't leak hidden foes through the fog
  const y=topY(d.px,d.pz)+(d.big?d.big*0.7+2:3.4); popDmg(d.px,y,d.pz, Math.round(amt), heavy?'big':''); }
function deathFx(e){ const x=e.px,z=e.pz,y=topY(x,z)+1.4;
  const col=(e.team==='enemy')?0xff7a4a : (e.kind==='bld'||e.kind==='core')?0xc7ccd2 : 0x7ad0ff;
  const n=(e.kind==='core')?18:(e.kind==='bld'?11:7);
  for(let i=0;i<n;i++){ const a=rnd()*6.28,d=rr(0.3,e.big?e.big:2); puff(x+Math.cos(a)*d, y+rr(0,e.big?3:1.7), z+Math.sin(a)*d, col, rr(0.45,e.big?1.5:0.9), 0.55); }
  pingRing(x,z,col); if(e.kind==='core')shockwave(x,z,0xffb060,20); addShake(e.kind==='core'?2.8:(e.kind==='bld'?1.3:0.5)); sfx((e.kind==='core'||e.kind==='bld')?'boom':'death'); }
// ---------- shader 3D fire (scrolling-noise + gradient mask + HDR colour ramp + vertex wobble) ----------
let NOISE_TEX=null, fires=[];
function noiseTex(){ if(NOISE_TEX)return NOISE_TEX; const N=128, G=8; const c=document.createElement('canvas'); c.width=c.height=N; const g=c.getContext('2d');
  const gv=[]; for(let j=0;j<G;j++){ gv[j]=[]; for(let i=0;i<G;i++) gv[j][i]=rnd(); }
  const sm=t=>t*t*(3-2*t);
  const val=(u,v,f)=>{ const x=u*G*f, y=v*G*f;   // wrapping value noise → tiles seamlessly for scrolling
    const X0=((Math.floor(x)%G)+G)%G, Y0=((Math.floor(y)%G)+G)%G, X1=(X0+1)%G, Y1=(Y0+1)%G, fx=sm(x-Math.floor(x)), fy=sm(y-Math.floor(y));
    return (gv[Y0][X0]*(1-fx)+gv[Y0][X1]*fx)*(1-fy)+(gv[Y1][X0]*(1-fx)+gv[Y1][X1]*fx)*fy; };
  const im=g.createImageData(N,N), d=im.data;
  for(let j=0;j<N;j++)for(let i=0;i<N;i++){ const u=i/N,v=j/N; let n=val(u,v,1)*0.6+val(u,v,2)*0.3+val(u,v,4)*0.1;
    const o=(j*N+i)*4, q=Math.max(0,Math.min(255,n*255))|0; d[o]=d[o+1]=d[o+2]=q; d[o+3]=255; }
  g.putImageData(im,0,0); const t=new THREE.CanvasTexture(c); t.wrapS=t.wrapT=THREE.RepeatWrapping; NOISE_TEX=t; return t; }
const FIRE_VERT=`uniform float uTime; uniform sampler2D uNoise; uniform float uDisp; uniform float uSeed; varying vec2 vUv;
  void main(){ vUv=uv; float n=texture2D(uNoise, uv*vec2(1.0,0.7)+vec2(uSeed,-uTime*0.6)).r;
    vec3 p=position + normal*(n-0.5)*uDisp*(1.0-uv.y);   // wobble sideways, more at the base
    gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0); }`;
const FIRE_FRAG=`uniform float uTime; uniform sampler2D uNoise; uniform vec2 uScale; uniform float uSpeed; uniform float uPower; uniform float uSeed; varying vec2 vUv;
  vec3 ramp(float t){ vec3 hot=vec3(1.7,1.55,1.05), yel=vec3(1.5,0.95,0.25), org=vec3(1.25,0.4,0.07), red=vec3(0.45,0.06,0.02);
    vec3 c=mix(hot,yel,smoothstep(0.0,0.32,t)); c=mix(c,org,smoothstep(0.3,0.62,t)); return mix(c,red,smoothstep(0.6,1.0,t)); }
  void main(){ vec2 uv=vUv;
    float n1=texture2D(uNoise, uv*uScale+vec2(uSeed,-uTime*uSpeed)).r;
    float n2=texture2D(uNoise, uv*uScale*2.1+vec2(uSeed*1.7+0.03,-uTime*uSpeed*1.8)).r;
    float n=n1*0.65+n2*0.35;
    float mask=n*(1.0-uv.y)*1.9*uPower;             // hot/dense at base, thin at tip
    mask-=smoothstep(0.45,1.0,uv.y)*0.7;            // fade out toward the top
    mask=clamp(mask,0.0,1.0);
    if(mask<0.03) discard;                          // wispy edges
    gl_FragColor=vec4(ramp(1.0-mask), mask);        // hottest where densest
  }`;
function makeFire(x,y,z,scale){ scale=scale||1; const grp=new THREE.Group(); grp.position.set(x,y,z);
  const mat=new THREE.ShaderMaterial({ uniforms:{ uTime:{value:rnd()*20}, uNoise:{value:noiseTex()}, uScale:{value:new THREE.Vector2(1.0,1.3)},
      uSpeed:{value:0.55}, uDisp:{value:0.5*scale}, uPower:{value:1.0}, uSeed:{value:rnd()} },
    vertexShader:FIRE_VERT, fragmentShader:FIRE_FRAG, transparent:true, depthWrite:false, side:THREE.DoubleSide });
  const cone=new THREE.Mesh(new THREE.ConeGeometry(0.85*scale, 2.8*scale, 14, 12, true), mat);
  cone.position.y=1.4*scale; cone.renderOrder=50; grp.add(cone);
  const disc=new THREE.Mesh(new THREE.CircleGeometry(1.7*scale,18), new THREE.MeshBasicMaterial({color:0xff7a2a,transparent:true,opacity:0.42,blending:THREE.AdditiveBlending,depthWrite:false}));
  disc.rotation.x=-Math.PI/2; disc.position.y=0.14; disc.renderOrder=47; grp.add(disc);
  const light=new THREE.PointLight(0xff8a3a, 1.3*scale, 16*scale, 2); light.position.y=2*scale; grp.add(light);   // warms the (lit) terrain
  scene.add(grp); const f={grp,mat,disc,light,scale,phase:rnd()*6.28}; fires.push(f); return f; }
function updateFires(dt){ if(!fires.length)return;
  for(const f of fires){ f.phase+=dt; f.mat.uniforms.uTime.value+=dt;
    f.light.intensity=(1.1+Math.sin(f.phase*7)*0.35+Math.sin(f.phase*17)*0.12)*f.scale;      // flicker the warm light
    f.disc.material.opacity=0.34+Math.sin(f.phase*6)*0.1; } }
// thin steel glaive blade, built once & cloned (long axis = +Y); colour comes from the trail, not the blade
let BLADE_PROTO=null;
function bladeProto(){ if(BLADE_PROTO)return BLADE_PROTO; const g=new THREE.Group();
  const blade=new THREE.Mesh(new THREE.OctahedronGeometry(1.0,0), new THREE.MeshBasicMaterial({color:0xe6eef6})); blade.scale.set(0.22,1.0,0.5);
  const edge=new THREE.Mesh(new THREE.OctahedronGeometry(1.05,0), new THREE.MeshBasicMaterial({color:0xbfe0ff,transparent:true,opacity:0.5,blending:THREE.AdditiveBlending,depthWrite:false})); edge.scale.set(0.3,1.15,0.62);
  g.add(blade,edge); g.scale.setScalar(1.1); BLADE_PROTO=g; return g; }
// bright impact flash + spark burst + small ground ring, tinted to the projectile's element
function impactFx(x,y,z,col){ sfx('hit'); const f=new THREE.Mesh(new THREE.SphereGeometry(1.1,12,10), new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:0.9,blending:THREE.AdditiveBlending,depthWrite:false}));
  f.position.set(x,y,z); scene.add(f); let a=0;(function an(){a+=0.14; f.scale.setScalar(1+a*2.2); f.material.opacity=Math.max(0,0.9-a*1.4); if(a<0.7)requestAnimationFrame(an); else scene.remove(f);})();
  for(let i=0;i<5;i++) puff(x+rr(-0.8,0.8),y+rr(-0.6,0.9),z+rr(-0.8,0.8),col,rr(0.4,0.8),0.6); }
function arrowShot(sx,sz,tx,tz){ const m=arrowProto().clone(true); scene.add(m);
  const y0=topY(sx,sz)+2.6,y1=topY(tx,tz)+2.0,dist=Math.hypot(tx-sx,tz-sz),dur=Math.max(0.16,Math.min(0.5,dist/44)); let t=0,tick=0;
  (function an(){ t+=0.033;tick++; const k=Math.min(1,t/dur); const x=sx+(tx-sx)*k,z=sz+(tz-sz)*k,y=y0+(y1-y0)*k+Math.sin(k*Math.PI)*2.6;
    m.position.set(x,y,z); m.lookAt(tx,y1,tz); m.rotateX(Math.PI/2);
    if(tick%2===0) puff(x,y,z,0xffe6a8,0.22,0.4);
    if(k<1)requestAnimationFrame(an); else { scene.remove(m); for(let i=0;i<4;i++) puff(tx+rr(-0.8,0.8),y1+rr(-0.4,1.2),tz+rr(-0.8,0.8),0xffe6a8,0.5,0.55); pingRing(tx,tz,0xffe6a8); } })(); }
// spinning glaive to a specific target — used by Shadow Strike (poison=green trail + lingering cloud)
function bladeShot(sx,sz,tx,tz,col,poison){ const m=bladeProto().clone(true); scene.add(m);
  const y0=topY(sx,sz)+2.6,y1=topY(tx,tz)+2.2,dist=Math.hypot(tx-sx,tz-sz),dur=Math.max(0.14,Math.min(0.42,dist/48)); let t=0,tick=0;
  (function an(){ t+=0.033;tick++; const k=Math.min(1,t/dur); const x=sx+(tx-sx)*k,z=sz+(tz-sz)*k,y=y0+(y1-y0)*k+Math.sin(k*Math.PI)*1.8;
    m.position.set(x,y,z); m.lookAt(tx,y1,tz); m.rotateX(Math.PI/2); m.rotateY(t*40);
    puff(x,y,z,col,0.35,0.45);
    if(k<1)requestAnimationFrame(an); else { scene.remove(m); impactFx(tx,y1,tz,col); if(poison) for(let i=0;i<5;i++) puff(tx+rr(-1,1),y1+rr(0,1.5),tz+rr(-1,1),col,0.6,0.5); } })(); }
// glaive flung outward to a point then gone — Fan of Knives radial blades
function bladeSpin(sx,sz,tx,tz,col,dur){ const m=bladeProto().clone(true); scene.add(m); const y=topY(sx,sz)+2.4; let t=0,tick=0;
  (function an(){ t+=0.033;tick++; const k=Math.min(1,t/dur); const x=sx+(tx-sx)*k,z=sz+(tz-sz)*k,yy=y+Math.sin(k*Math.PI)*1.2;
    m.position.set(x,yy,z); m.lookAt(tx,yy,tz); m.rotateX(Math.PI/2); m.rotateY(t*46);
    if(tick%2===0) puff(x,yy,z,col,0.3,0.4);
    if(k<1)requestAnimationFrame(an); else scene.remove(m); })(); }
function fireBurst(x,y,z){ for(let i=0;i<11;i++){ const a=rnd()*6.28,d=rr(0.2,2.3); puff(x+Math.cos(a)*d, y+rr(0,1.9), z+Math.sin(a)*d, (i%3)?0xff7a20:0xffd050, rr(0.5,1.15), 0.65); }
  for(let i=0;i<4;i++){ const a=rnd()*6.28; puff(x+Math.cos(a)*rr(0.4,2), y+rr(0.9,2.6), z+Math.sin(a)*rr(0.4,2), 0x3c322a, rr(0.7,1.2), 0.4); }   // smoke
  shockwave(x,z,0xff7030,9); }
function shootFx(sx,sz,tx,tz,kind){
  if(kind!=='heal') sfx(kind==='shadow'?'magic':kind);
  if(kind==='arrow') return arrowShot(sx,sz,tx,tz);
  if(kind==='shadow') return bladeShot(sx,sz,tx,tz,0x8ef07a,true);      // Shadow Strike poisoned glaive
  if(kind==='fire'){                                                    // Orc Shaman fireball: hot core + orange flame + red glow, fire/smoke trail, fiery burst
    const m=new THREE.Group();
    const core=new THREE.Mesh(new THREE.SphereGeometry(0.5,12,10), new THREE.MeshBasicMaterial({color:0xfff2c0,transparent:true,opacity:1,blending:THREE.AdditiveBlending,depthWrite:false}));
    const flame=new THREE.Mesh(new THREE.SphereGeometry(0.92,12,10), new THREE.MeshBasicMaterial({color:0xff7a20,transparent:true,opacity:0.82,blending:THREE.AdditiveBlending,depthWrite:false}));
    const glow=new THREE.Mesh(new THREE.SphereGeometry(1.7,12,10), new THREE.MeshBasicMaterial({color:0xff3010,transparent:true,opacity:0.3,blending:THREE.AdditiveBlending,depthWrite:false}));
    m.add(glow,flame,core); scene.add(m);
    const y0=topY(sx,sz)+2.6,y1=topY(tx,tz)+2.0,dist=Math.hypot(tx-sx,tz-sz),dur=Math.max(0.22,Math.min(0.72,dist/32)); let t=0,tick=0;
    (function an(){ t+=0.033;tick++; const k=Math.min(1,t/dur); const x=sx+(tx-sx)*k,z=sz+(tz-sz)*k, y=y0+(y1-y0)*k+Math.sin(k*Math.PI)*2.2;
      m.position.set(x,y,z); const p=1+Math.sin(t*26)*0.18; core.scale.setScalar(p); flame.scale.setScalar(p);
      puff(x,y,z, (tick%3===0)?0x4a2a18:((tick%2)?0xff7a20:0xffc040), (tick%3===0)?0.55:0.5, (tick%3===0)?0.4:0.6);
      if(k<1)requestAnimationFrame(an); else { scene.remove(m); fireBurst(tx,y1,tz); addShake(isVisible(tx,tz)?0.5:0); } })();
    return; }
  // energy orb (caster magic / heal / arcane): white-hot core, coloured body, soft halo, swirling glow trail
  const heal=kind==='heal'; const col = heal?0x8dffab : kind==='arcane'?0xc258ff : 0x7fd0ff;
  const m=new THREE.Group();
  const core=new THREE.Mesh(new THREE.SphereGeometry(0.5,14,10), new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:1,blending:THREE.AdditiveBlending,depthWrite:false}));
  const mid =new THREE.Mesh(new THREE.SphereGeometry(0.85,14,10), new THREE.MeshBasicMaterial({color:col,transparent:true,opacity:0.8,blending:THREE.AdditiveBlending,depthWrite:false}));
  const halo=new THREE.Mesh(new THREE.SphereGeometry(1.5,14,10), new THREE.MeshBasicMaterial({color:col,transparent:true,opacity:0.28,blending:THREE.AdditiveBlending,depthWrite:false}));
  m.add(core,mid,halo); scene.add(m);
  const y0=topY(sx,sz)+2.6,y1=topY(tx,tz)+2.0,dist=Math.hypot(tx-sx,tz-sz),dur=Math.max(0.18,Math.min(0.6,dist/38)); let t=0,tick=0;
  const perpx=-(tz-sz)/(dist||1), perpz=(tx-sx)/(dist||1);              // swirl axis
  (function an(){ t+=0.033;tick++; const k=Math.min(1,t/dur); const sw=Math.sin(t*26)*0.7*(1-k*0.4);
    const x=sx+(tx-sx)*k+perpx*sw, z=sz+(tz-sz)*k+perpz*sw, y=y0+(y1-y0)*k+Math.sin(k*Math.PI)*1.6;
    m.position.set(x,y,z); const p=1+Math.sin(t*30)*0.16; core.scale.setScalar(p); mid.scale.setScalar(p);
    if(tick%2===0) puff(x,y,z,col,0.5,0.5);
    if(k<1)requestAnimationFrame(an); else { scene.remove(m); impactFx(tx,y1,tz,col); } })(); }
function castBolt(gx,gz){ if(!hero||hero.spellCd>0)return false; hero.spellCd=6; spellArmed=false;
  for(const e of enemies){ if(!e.alive)continue; if(Math.hypot(e.px-gx,e.pz-gz)<7){ damage(e,60,true); } }
  const r=new THREE.Mesh(new THREE.RingGeometry(0.6,1.6,26),new THREE.MeshBasicMaterial({color:0x74c0ff,transparent:true,side:THREE.DoubleSide}));
  r.rotation.x=-Math.PI/2; r.position.set(gx,topY(gx,gz)+0.5,gz); scene.add(r);
  let t=0;(function an(){t+=0.05;r.scale.setScalar(1+t*14);r.material.opacity=Math.max(0,0.95-t*1.1);if(t<0.9)requestAnimationFrame(an);else scene.remove(r);})();
  shockwave(gx,gz,0x74c0ff,13); addShake(1.4); return true; }
// ---------- rock / earth VFX (Orc Leader boulders + seismic) ----------
let ROCK_PROTO=null;
function rockProto(){ if(ROCK_PROTO)return ROCK_PROTO; ROCK_PROTO=new THREE.Mesh(new THREE.IcosahedronGeometry(1,0), new THREE.MeshLambertMaterial({color:0x8a827a,flatShading:true})); ROCK_PROTO.scale.set(1,0.82,1.12); return ROCK_PROTO; }   // lit → reads as a 3D rock
function debris(x,y,z){ const m=rockProto().clone(); m.material=rockProto().material; m.scale.setScalar(rr(0.22,0.5)); m.position.set(x,y,z); scene.add(m);
  const a=rnd()*6.28, sp=rr(6,13); let vx=Math.cos(a)*sp, vz=Math.sin(a)*sp, vy=rr(6,11), py=y, t=0, rx=rr(-9,9), ry=rr(-9,9);
  (function an(){ t+=0.033; vy-=34*0.033; py+=vy*0.033; const nx=m.position.x+vx*0.033, nz=m.position.z+vz*0.033;
    if(py<=topY(nx,nz)||t>2){ scene.remove(m); return; } m.position.set(nx,py,nz); m.rotation.x+=rx*0.033; m.rotation.y+=ry*0.033; requestAnimationFrame(an); })(); }
function rockBurst(x,z){ const y=topY(x,z);
  const r=new THREE.Mesh(new THREE.RingGeometry(0.8,1.8,26), new THREE.MeshBasicMaterial({color:0x6e5a42,transparent:true,opacity:0.8,side:THREE.DoubleSide,depthWrite:false}));
  r.rotation.x=-Math.PI/2; r.position.set(x,y+0.15,z); scene.add(r); let a=0;(function an(){a+=0.06; r.scale.setScalar(1+a*9); r.material.opacity=Math.max(0,0.8-a); if(a<0.85)requestAnimationFrame(an); else scene.remove(r);})();
  for(let i=0;i<8;i++){ const ang=rnd()*6.28,d=rr(0.3,2.3); puff(x+Math.cos(ang)*d, y+rr(0.2,1.7), z+Math.sin(ang)*d, 0xb0a48c, rr(0.5,1.0), 0.5); }
  for(let i=0;i<5;i++) debris(x,y+0.5,z); sfx('boom'); }
function rockShot(sx,sz,tx,tz,onImpact){ const m=rockProto().clone(); m.material=rockProto().material; m.scale.setScalar(rr(1.1,1.5)); scene.add(m);
  const y0=topY(sx,sz)+3.0,y1=topY(tx,tz)+1.0,dist=Math.hypot(tx-sx,tz-sz),dur=Math.max(0.5,Math.min(1.15,dist/24)); let t=0,tick=0, rx=rr(-6,6),ry=rr(-6,6),rz=rr(-6,6);
  (function an(){ t+=0.033;tick++; const k=Math.min(1,t/dur); const x=sx+(tx-sx)*k,z=sz+(tz-sz)*k, y=y0+(y1-y0)*k+Math.sin(k*Math.PI)*11;   // high lob
    m.position.set(x,y,z); m.rotation.x+=rx*0.033; m.rotation.y+=ry*0.033; m.rotation.z+=rz*0.033;
    if(tick%2===0) puff(x,y,z,0xb0a48c,0.45,0.4);
    if(k<1)requestAnimationFrame(an); else { scene.remove(m); if(onImpact)onImpact(); rockBurst(tx,tz); } })(); }
function ragePulse(x,z){ const r=new THREE.Mesh(new THREE.RingGeometry(0.8,2.0,28), new THREE.MeshBasicMaterial({color:0xff4020,transparent:true,opacity:0.85,side:THREE.DoubleSide,depthWrite:false}));
  r.rotation.x=-Math.PI/2; r.position.set(x,topY(x,z)+0.5,z); scene.add(r); let a=0;(function an(){a+=0.05; r.scale.setScalar(1+a*10); r.material.opacity=Math.max(0,0.85-a); if(a<0.9)requestAnimationFrame(an); else scene.remove(r);})();
  for(let i=0;i<8;i++){ const a2=rnd()*6.28; puff(x+Math.cos(a2)*rr(0.5,2.5), topY(x,z)+rr(0.5,3), z+Math.sin(a2)*rr(0.5,2.5), 0xff5030, rr(0.6,1.1), 0.5); } }
// ---------- Orc Leader (chieftain) ability kit: Boulder Hurl · Seismic Slam · War Roar ----------
function pFoes(){ const a=[]; if(hero&&hero.alive)a.push(hero); for(const e of allies)if(e.alive)a.push(e); if(coreB&&coreB.alive)a.push(coreB); return a; }
function seismicSlam(b){ if(b.rigged){ b.__atkClip='attack'; b.__atkT=0.55; }
  const R=13; for(const t of pFoes()){ const dd=Math.hypot(t.px-b.px,t.pz-b.pz); if(dd<R){ damage(t, t.kind==='core'?26:38, true);
    if(t!==coreB){ const nx=t.px+(t.px-b.px)/(dd||1)*6, nz=t.pz+(t.pz-b.pz)/(dd||1)*6; if(onIsland(nx,nz))setP(t,nx,nz); } } }
  rockBurst(b.px,b.pz); shockwave(b.px,b.pz,0xb59060,16); for(let i=0;i<6;i++){ const a=rnd()*6.28; puff(b.px+Math.cos(a)*rr(1,4),topY(b.px,b.pz)+rr(0.2,1.6),b.pz+Math.sin(a)*rr(1,4),0xbfb49a,rr(0.7,1.3),0.5); }
  if(isVisible(b.px,b.pz))addShake(2.2); }
function boulderHurl(b,t){ if(b.rigged){ b.__atkClip='attack'; b.__atkT=0.55; } const tx=t.px,tz=t.pz; faceTo(b,tx-b.px,tz-b.pz);
  rockShot(b.px,b.pz,tx,tz, ()=>{ for(const q of pFoes()){ if(Math.hypot(q.px-tx,q.pz-tz)<6) damage(q, q.kind==='core'?24:32, true); }
    shockwave(tx,tz,0xb59060,12); if(isVisible(tx,tz))addShake(1.2); }); }
function warRoar(b){ b.rageT=6; for(const e of enemies){ if(e.alive&&Math.hypot(e.px-b.px,e.pz-b.pz)<22) e.rageT=6; }   // rally the horde
  ragePulse(b.px,b.pz); if(isVisible(b.px,b.pz)){ addShake(0.8); sfx('roar'); } }
function bossTick(b,dt){ if(!b.alive||gameOver)return; b.hurlCd-=dt; b.slamCd-=dt; b.roarCd-=dt;
  const t=b.target||nearest(b.px,b.pz,pFoes()).t; if(!t){ if(b.roarCd<=0){ b.roarCd=13; warRoar(b); } return; }
  const d=Math.hypot(t.px-b.px,t.pz-b.pz);
  if(b.slamCd<=0 && d<14){ b.slamCd=9; seismicSlam(b); return; }
  if(b.hurlCd<=0 && d>9 && d<ABIL_RANGE){ b.hurlCd=7; boulderHurl(b,t); return; }   // only lob at foes it can actually see
  if(b.roarCd<=0){ b.roarCd=13; warRoar(b); } }
function updateOrderMarkers(){
  const ord=allies.filter(a=>a.alive&&a.order&&!a.forcedTarget), clusters=[];
  for(const a of ord){ let c=clusters.find(c=>Math.hypot(c.x-a.order.x,c.z-a.order.z)<8); if(!c){c={x:a.order.x,z:a.order.z};clusters.push(c);} }
  while(orderMarkers.length<clusters.length){ const m=new THREE.Mesh(new THREE.RingGeometry(2.3,2.9,24),new THREE.MeshBasicMaterial({color:0x9fe0ff,transparent:true,opacity:0.55,side:THREE.DoubleSide})); m.rotation.x=-Math.PI/2; scene.add(m); orderMarkers.push(m); }
  orderMarkers.forEach((m,i)=>{ if(i<clusters.length){ m.visible=true; m.position.set(clusters[i].x,topY(clusters[i].x,clusters[i].z)+0.2,clusters[i].z); } else m.visible=false; }); }
function updateSpellUI(){
  const ring=(el,cd,max)=>{ if(!el)return; const c=el.querySelector('.cd'); el.classList.toggle('cooling',cd>0);
    if(c){ const f=Math.max(0,Math.min(1,cd/max)); c.style.background='conic-gradient(rgba(8,12,18,0.66) '+(f*360).toFixed(0)+'deg, rgba(0,0,0,0) 0deg)'; } };
  if(radialMode==='squad'){                                        // squad-command buttons: no cooldowns; Atk-Move shows armed
    [abilEl,boltEl,smiteEl].forEach(el=>{ if(el)el.classList.remove('cooling'); });
    if(boltEl)boltEl.classList.remove('armed'); if(smiteEl)smiteEl.classList.toggle('armed',amArmed); if(autoEl)autoEl.classList.toggle('on',autoBolt);
    return; }
  if(hitEl){ hitEl.classList.toggle('off',!heroCanHit); hitEl.classList.toggle('ready',heroCanHit); }   // attack button lights up only in reach
  if(abilEl){ ring(abilEl, hero?hero.aCd:0, hero&&hero.aMax||6); }                    // AoE slot
  if(boltEl){ boltEl.classList.toggle('armed',spellArmed); ring(boltEl, hero?hero.spellCd:0, hero&&hero.spellMax||8); }   // armed-target slot
  if(autoEl){ autoEl.classList.toggle('on',autoBolt); }
  if(smiteEl){ ring(smiteEl, hero?hero.blinkCd:0, hero&&hero.blinkMax||7); } }         // utility slot
function drawLasso(){ if(!lctx)return; lctx.clearRect(0,0,lcv.width,lcv.height); const p=cmd.pts; if(p.length<2)return;
  lctx.beginPath(); lctx.moveTo(p[0][0],p[0][1]); for(let i=1;i<p.length;i++)lctx.lineTo(p[i][0],p[i][1]);
  lctx.strokeStyle='rgba(127,240,255,0.95)'; lctx.lineWidth=3; lctx.stroke();
  lctx.fillStyle='rgba(127,240,255,0.12)'; lctx.fill(); }

function endGame(win){ gameOver=win?1:2; sfx(win?'win':'lose'); resultEl.style.display='flex';
  if(objBannerEl)objBannerEl.style.display='none';
  _objShown=false; if(TUT){ TUT=null; const ce=document.getElementById('coach'); if(ce)ce.style.display='none'; tutHighlight(null); } applyHudVis();
  const h=resultEl.querySelector('h1'); h.textContent=win?'Victory!':'Defeated'; h.style.color=win?'#8be04a':'#e05a5a';
  const sub=resultEl.querySelector('.sub');
  if(gameMode==='campaign' && activeMission){ if(win)campMarkClear(activeMission.id);
    if(sub)sub.textContent = win ? activeMission.outro : 'The line broke. Try again.'; }
  else if(sub){ sub.textContent='tap to play again'; } }
function updBars(){ const all=[hero,...allies,...enemies];
  for(const e of all){ if(!e||!e.alive)continue; const f=Math.max(0,e.hp/e.max);
    e.bar.visible=(e.team!=='hero') && (e.team!=='enemy'||e.__vis!==false); e.bar.__fl.scale.x=f; e.bar.__fl.position.x=-(1-f)*e.bar.__w/2;
    e.bar.position.set(e.px, topY(e.px,e.pz)+(e.team==='hero'?4.6:4.4), e.pz); e.bar.quaternion.copy(cam.quaternion);
    if(e.ring){ e.ring.visible=selected.has(e); if(e.ring.visible) e.ring.position.set(e.px, topY(e.px,e.pz)+0.18, e.pz); }
    e.hitT-=0.016; const em=e.hitT>0?0x992a1a:(e.rageT>0?0x4a1206:0x000000); e.g.traverse(o=>{ if(o.isMesh&&o.material&&o.material.emissive) o.material.emissive.setHex(em); });
  } }
function updateGame(dt){
  if(!hero) return;
  if(started && !gameOver && !dialogActive){   // freeze the sim during a conversation cutscene
    // warband advances in bands of 3 — a mass, not a trickle; cap concurrent so it stays performant
    if(spawnLeft>0 && enemies.length<15){ spawnTimer-=dt; if(spawnTimer<=0){ for(let k=0;k<3&&spawnLeft>0;k++){ spawnEnemy(); spawnLeft--; } spawnTimer=2.4; } }
    // hero movement
    let ix=0,iy=0;
    if(joy.active){ ix=joy.nx; iy=joy.ny; }
    else { if(keys['w']||keys['arrowup'])iy-=1; if(keys['s']||keys['arrowdown'])iy+=1; if(keys['a']||keys['arrowleft'])ix-=1; if(keys['d']||keys['arrowright'])ix+=1; }
    const B=groundBasis(); let mvx=B.f.x*(-iy)+B.r.x*ix, mvz=B.f.z*(-iy)+B.r.z*ix; const ml=Math.hypot(mvx,mvz);
    let heroMoved=false;
    if(hero.alive && camLocked && ml>0.01){ // left stick drives the hero (follow mode); stick input cancels any tap order
      hero.order=null; mvx/=ml;mvz/=ml; const nx=hero.px+mvx*hero.spd*dt, nz=hero.pz+mvz*hero.spd*dt; if(onIsland(nx,nz))setP(hero,nx,nz);
      faceTo(hero,mvx,mvz); hero.movedThis=true; heroMoved=true; heroFwd.x+=(mvx-heroFwd.x)*Math.min(1,dt*6); heroFwd.z+=(mvz-heroFwd.z)*Math.min(1,dt*6); }
    else if(hero.alive && hero.order){ // RTS: tap-ordered hero walks to the point like any selected unit
      const d=Math.hypot(hero.order.x-hero.px,hero.order.z-hero.pz);
      if(d<1.6){ hero.order=null; }
      else { const dx=(hero.order.x-hero.px)/d, dz=(hero.order.z-hero.pz)/d;
        const nx=hero.px+dx*hero.spd*dt, nz=hero.pz+dz*hero.spd*dt; if(onIsland(nx,nz))setP(hero,nx,nz); else hero.order=null;
        faceTo(hero,dx,dz); hero.movedThis=true; heroMoved=true;
        heroFwd.x+=(dx-heroFwd.x)*Math.min(1,dt*6); heroFwd.z+=(dz-heroFwd.z)*Math.min(1,dt*6); } }
    if(!camLocked && ml>0.001){ _camTouched=true; // camera stick: PROPORTIONAL pan (deflection^2 curve — fine control near centre,
      // fast at full tilt), not the hero's normalized fixed-speed movement — a camera, not a character
      const m=Math.min(1,ml), nx=mvx/ml, nz=mvz/ml, sp=110*Math.max(0.6,camF.dist/66)*m*m;
      camAim.x+=nx*sp*dt; camAim.z+=nz*sp*dt; clampAim(); }
    if(hero.alive){ hero.cd-=dt; hero.aCd-=dt; hero.spellCd-=dt; hero.blinkCd-=dt;
      if(hero.__invuln>0)hero.__invuln-=dt;                                            // Divine Shield
      if(hero.__healT>0){ hero.__healT-=dt; hero.hp=Math.min(hero.max,hero.hp+42*dt); } }
    tickHolyGrounds(dt);                                                                // Consecration blessed ground
    const FO=foes();   // enemy units + attackable enemy structures (core/buildings) — the player's valid targets
    if(hero.alive && autoBolt && hero.spellCd<=0 && enemies.length){ const t=nearestEnemyTo(hero.px,hero.pz,26); if(t) shadowStrike(t); }   // AUTO = auto Shadow Strike nearest visible foe
    for(const e of enemies){ if(!e.alive||!e.poison)continue; e.poison.t-=dt; e.__pt-=dt;   // Shadow Strike poison DoT — lingering green wisp
      if(e.__pt<=0){ e.__pt=0.32; damage(e, e.poison.dps*0.32, false);
        if(isVisible(e.px,e.pz)){ const y=topY(e.px,e.pz)+2.2, ph=(e.__pw=(e.__pw||0)+0.8);   // orbiting wisp + rising drip
          puff(e.px+Math.cos(ph)*0.9, y+Math.sin(ph*1.7)*0.5, e.pz+Math.sin(ph)*0.9, 0x8ef07a,0.42,0.6);
          puff(e.px+rr(-0.4,0.4), y+0.6+rr(0,0.8), e.pz+rr(-0.4,0.4), 0x5ad06a,0.28,0.4); } }
      if(e.poison.t<=0)e.poison=null; }
    if(hero.alive){ const {t,d}=nearest(hero.px,hero.pz,FO); heroHitTarget=(t&&d<=hero.range+(t.big||0)+1)?t:null; heroCanHit=!!heroHitTarget;
      if(heroHitTarget){ if(hero.rigged&&hero.cd<=0){ hero.__atkClip=pickAtkClip(hero); hero.__atkT=0.55; } attack(hero,heroHitTarget); } }
    else { heroHitTarget=null; heroCanHit=false; }
    if(hero.alive && hero.rigged){ hero.mixer.update(dt); armRelax(hero); hero.__atkT=Math.max(0,(hero.__atkT||0)-dt);
      setAnim(hero, hero.__atkT>0?(hero.__atkClip||'attack'):(heroMoved?'run':'idle')); }
    const hl=Math.hypot(heroFwd.x,heroFwd.z)||1, ffx=heroFwd.x/hl, ffz=heroFwd.z/hl, rgx=ffz, rgz=-ffx;
    for(const e of allies){ if(!e.alive)continue; e.cd-=dt;
      if(e.__caster){ e.state='idle'; faceTo(e,(coreB?coreB.x:0)-e.px,(coreB?coreB.z:0)-e.pz); if(e.rigged){ e.mixer.update(dt); setAnim(e,'attack'); } continue; }   // channel in place
      const heroDist=Math.hypot(hero.px-e.px,hero.pz-e.pz);
      if(e.forcedTarget && !e.forcedTarget.alive) e.forcedTarget=null;
      if(e.target && !e.target.alive) e.target=null;
      if(e.forcedTarget){ e.target=e.forcedTarget; }                                     // manual focus-fire overrides leash & orders
      else {
        if(e.target && !e.order && heroDist>BREAK) e.target=null;                        // drop a fight only if unordered & hero left
        if(!e.target){ const {t}=nearest(e.px,e.pz,FO);
          if(t){ if(e.order){ if(Math.hypot(t.px-e.px,t.pz-e.pz)<12) e.target=t; }       // ordered: attack-move — engage foes en route
                 else if(Math.hypot(t.px-hero.px,t.pz-hero.pz)<ENGAGE) e.target=t; } } } // following: engage foes near the hero
      if(e.target){ const t=e.target, d=Math.hypot(t.px-e.px,t.pz-e.pz);                 // committed: fight until it dies
             if(d>e.range+(t.big||0)){ e.state='move'; moveTo(e,t.px,t.pz,dt); } else { e.state='attack'; faceTo(e,t.px-e.px,t.pz-e.pz);
               if(e.cd<=0 && e.kind!=='warrior' && e.kind!=='assassin') shootFx(e.px,e.pz,t.px,t.pz, e.kind==='cleric'?'arcane':'arrow'); attack(e,t); } }
      else if(e.order){ // hold the commanded position
             if(Math.hypot(e.order.x-e.px,e.order.z-e.pz)>1.4){ e.state='move'; moveTo(e,e.order.x,e.order.z,dt); } else e.state='idle'; }
      else { // loose leash: idle in the hero's vicinity, only re-form once he's walked past FOLLOW_OUT
             const col=((e.idx%4)-1.5)*2.8, back=4.5+Math.floor(e.idx/4)*3.0, tx=hero.px-ffx*back+rgx*col, tz=hero.pz-ffz*back+rgz*col;
             if(!e.following && heroDist>FOLLOW_OUT) e.following=true;
             if(e.following){ e.state='move'; moveTo(e,tx,tz,dt); if(Math.hypot(tx-e.px,tz-e.pz)<FOLLOW_IN) e.following=false; }   // face travel dir (moveTo), not the hero's
             else { e.state='idle'; if(Math.hypot(hero.px-e.px,hero.pz-e.pz)>3) faceTo(e,hero.px-e.px,hero.pz-e.pz); } }   // idle guards glance toward the hero, not all locked parallel
      if(e.rigged){ e.mixer.update(dt); setAnim(e, e.state==='attack'?'attack':(e.state==='move'?'run':'idle')); } }
    for(const e of enemies){ if(!e.alive)continue; e.cd-=dt; if(e.rageT>0)e.rageT-=dt;
      if(e.stunT>0){ e.stunT-=dt; e.state='idle'; if(e.rigged){ e.mixer.update(dt); setAnim(e,'idle'); } continue; }   // Hammer of Justice stun: frozen
      if(e.creep){ creepTick(e,dt); continue; }   // neutral creeps run their own dormant/leashed AI
      if(e.__campGuard){ const h=e.__home; if(e.target&&!e.target.alive)e.target=null;   // raider-camp defender: leashed to the camp
        if(Math.hypot(e.px-h.x,e.pz-h.z)>30){ e.target=null; if(Math.hypot(e.px-h.x,e.pz-h.z)>4){e.state='move';moveTo(e,h.x,h.z,dt);}else e.state='idle'; }
        else { if(!e.target){ const {t}=nearest(e.px,e.pz,[hero,...allies].filter(u=>u&&u.alive)); if(t&&Math.hypot(t.px-h.x,t.pz-h.z)<28)e.target=t; }
          if(e.target){ const t=e.target, reach=e.range+(t.big||0), d=Math.hypot(t.px-e.px,t.pz-e.pz);
            if(d>reach){e.state='move';moveTo(e,t.px,t.pz,dt);}else{e.state='attack';faceTo(e,t.px-e.px,t.pz-e.pz); if(e.ranged&&e.cd<=0)shootFx(e.px,e.pz,t.px,t.pz,e.kind==='shaman'?'fire':(e.magic?'magic':'arrow')); attack(e,t);} }
          else { const d=Math.hypot(e.px-h.x,e.pz-h.z); if(d>3){e.state='move';moveTo(e,h.x,h.z,dt);}else e.state='idle'; } }
        if(e.rigged){ e.mixer.update(dt); setAnim(e,e.state==='attack'?'attack':(e.state==='move'?'run':'idle')); } continue; }
      if(e.target && !e.target.alive) e.target=null;
      if(!e.target){ const {t}=nearest(e.px,e.pz,[hero,...allies,coreB].filter(Boolean)); e.target=t; }   // fight units, or march on the throne
      if(e.isBoss) bossTick(e,dt);
      if(e.target){ const t=e.target, reach=e.range+(t.big||0), d=Math.hypot(t.px-e.px,t.pz-e.pz);
             if(d>reach){ e.state='move'; moveTo(e,t.px,t.pz,dt); } else { e.state='attack'; faceTo(e,t.px-e.px,t.pz-e.pz);
               if(e.ranged && e.cd<=0) shootFx(e.px,e.pz,t.px,t.pz, e.kind==='shaman'?'fire':(e.magic?'magic':'arrow')); attack(e,t); } }
      else { e.state='move'; moveTo(e,-2,0,dt); }
      if(e.rigged){ e.mixer.update(dt); setAnim(e, e.state==='attack'?'attack':(e.state==='move'?'run':'idle')); } }
    // caster pass: auto-Heal with de-dup — no two clerics heal the same target, no overkill
    { const claims=new Set();
      for(const e of allies){ if(!e.alive||e.kind!=='cleric'||e.__caster)continue; e.smiteCd-=dt; e.healCd-=dt;   // channeling mystics don't heal (they must be defended)
        if(e.healCd>0)continue; let best=null,bestDef=1;
        for(const t of [hero,...allies]){ if(!t.alive||!t.max||claims.has(t))continue; if(t.hp/t.max>=0.9)continue;
          if(Math.hypot(t.px-e.px,t.pz-e.pz)>18)continue; const def=t.max-t.hp; if(def>bestDef){bestDef=def;best=t;} }
        if(best){ best.hp=Math.min(best.max,best.hp+24); claims.add(best); e.healCd=2.8; healFx(best); popDmg(best.px,topY(best.px,best.pz)+3.4,best.pz,'+24','heal'); } } }
    separate(); loco(dt); baseTick(dt); eBaseTick(dt); if(creepCamps.length) updateCamps(dt); if(RITUAL) ritualTick(dt); tutTick();
    const reap=l=>{ for(const e of l){ if(e.alive&&e.hp<=0){ e.alive=false; deathFx(e); if(e.vfx)e.vfx.dispose(); scene.remove(e.g); scene.remove(e.bar); if(e.ring){scene.remove(e.ring); selected.delete(e);} if(e.team==='enemy')killed++; } } return l.filter(e=>e.alive); };
    allies=reap(allies); enemies=reap(enemies);
    for(const s of eStructs){ if(s.alive&&s.hp<=0){ s.alive=false; deathFx(s); scene.remove(s.g); scene.remove(s.bar);
        if(s.kind==='bld'&&s.plot){ const p=s.plot; p.cat=null; p.level=0; p.g=null; p.struct=null; eRecomputeIncome(); } } }
    eStructs=eStructs.filter(s=>s.alive);
    // hero is respawnable — falling starts a timer, not a defeat; only the thrones decide the match
    if(hero.alive && hero.hp<=0){ hero.alive=false; hero.respawnT=HERO_RESPAWN; deathFx(hero); hero.g.visible=false;
      selected.delete(hero); hero.order=null; hero.forcedTarget=null; hero.__atkT=0; updateSelPanel(); refreshRadial();
      if(respawnEl) respawnEl.style.display='flex'; }
    else if(!hero.alive){ hero.respawnT-=dt;
      if(respawnEl){ const rt=respawnEl.querySelector('.rsT'); if(rt)rt.textContent='Respawning in '+Math.max(1,Math.ceil(hero.respawnT))+'s'; }
      if(hero.respawnT<=0){ hero.alive=true; hero.hp=hero.max; hero.cd=hero.aCd=hero.spellCd=hero.blinkCd=0; hero.order=null; hero.__atkT=0;
        const rx=coreB?coreB.x:105, rz=(coreB?coreB.z:108)+4; setP(hero,rx,rz); hero.g.visible=true; hero.animState='idle'; blinkPop(rx,rz);
        if(camLocked){ camAim.x=rx; camAim.z=rz; } if(respawnEl) respawnEl.style.display='none'; } }
    if(coreB&&coreB.hp<=0) endGame(false); else if(enemyCore&&enemyCore.hp<=0) endGame(true);
    if(heroHpEl) heroHpEl.style.width=(Math.max(0,hero.hp)/hero.max*100)+'%';
    if(waveEl&&enemyCore) waveEl.textContent = enemyCore.hp>0 ? ('⚔ Orc throne  '+Math.ceil(Math.max(0,enemyCore.hp))+'/'+enemyCore.max) : 'The orc throne has fallen!';
    updateOrderMarkers(); updateSpellUI();   // Stomp cooldown + Hit-in-range state handled in updateSpellUI
  }
  updBars();
}
function followCam(dt){
  if(camLocked && hero){ if(!camAim.init){camAim.x=hero.px;camAim.z=hero.pz;camAim.init=true;} else { const k=Math.min(1,(dt||0.016)*4); camAim.x+=(hero.px-camAim.x)*k; camAim.z+=(hero.pz-camAim.z)*k; } }
  const p=camF.pitch*Math.PI/180,a=camF.az*Math.PI/180, hy=camF.dist*Math.sin(p),hz=camF.dist*Math.cos(p);
  const want=new THREE.Vector3(camAim.x+Math.sin(a)*hz,hy,camAim.z+Math.cos(a)*hz);
  if(!camF.init){ camF.pos.copy(want); camF.init=true; } else camF.pos.lerp(want, camLocked?0.12:0.38);   // free cam tracks tightly — no character-like momentum
  cam.position.copy(camF.pos); cam.lookAt(camAim.x,camF.lookY,camAim.z);
  if(shakeAmt>0.02){ cam.position.x+=(Math.random()*2-1)*shakeAmt; cam.position.y+=(Math.random()*2-1)*shakeAmt*0.7; cam.position.z+=(Math.random()*2-1)*shakeAmt; shakeAmt*=0.85; } else shakeAmt=0;   // impact screen-shake, decays fast
  // keep the shadow frustum centred on what the camera is looking at, so shadows stay sharp across the big map
  if(sunLight){ sunLight.target.position.set(camAim.x,0,camAim.z); sunLight.target.updateMatrixWorld();
    sunLight.position.set(camAim.x+sun.x*130, sun.y*130, camAim.z+sun.z*130); } }
function toggleCam(){ camLocked=!camLocked; _camTouched=true; applyCamMode(); if(camLocked&&hero){ camAim.x=hero.px; camAim.z=hero.pz; } }
function toggleViewPop(){ if(!viewPop)return;
  if(viewPop.style.display==='flex'){ viewPop.style.display='none'; return; }
  viewPop.innerHTML=''; const arrows=['\u2196','\u2197','\u2198','\u2199'];
  VIEW_AZS.forEach((az,i)=>{ const d=((camF.az-az)%360+360)%360, cur=(d<45||d>315);
    const c=document.createElement('div'); c.className='vOpt'+(cur?' on':'');
    c.innerHTML='<span class="vArr">'+arrows[i]+'</span>View '+(i+1)+(cur?' \u2713':'');
    c.addEventListener('pointerdown',ev=>{ ev.stopPropagation(); camF.az=az;
      try{ localStorage.setItem('wc_view_az',String(az)); }catch(_){}
      viewPop.style.display='none'; });
    viewPop.appendChild(c); });
  const h=document.createElement('div'); h.className='vHint'; h.textContent='saved as default'; viewPop.appendChild(h);
  viewPop.style.display='flex'; }
function applyCamMode(){ if(camEl){ camEl.textContent=camLocked?'◎ Hero':'⛶ Free'; camEl.style.background=camLocked?'#b5702a':'#2b3a58cc'; } }
  // the stick always shows: it pans the camera in Free mode and drives the hero in Follow mode
function setupHUD(){
  addEventListener('keydown',e=>{ keys[e.key.toLowerCase()]=true; if(e.key.toLowerCase()==='c') toggleCam(); });
  addEventListener('keyup',e=>keys[e.key.toLowerCase()]=false);
  camEl=document.createElement('div'); camEl.className='hud hchip'; camEl.textContent='🔒 Cam';
  camEl.style.cssText+=';right:calc(14px + var(--sr));top:calc(14px + var(--st))';
  camEl.addEventListener('pointerdown',ev=>{ev.stopPropagation(); toggleCam();}); document.body.appendChild(camEl);
  // perspective picker: 4 views 90 degrees apart; the choice applies immediately and becomes the default
  viewEl=document.createElement('div'); viewEl.className='hud hchip'; viewEl.textContent='⤺ View';
  viewEl.style.cssText+=';right:calc(14px + var(--sr));top:calc(62px + var(--st));padding:8px 12px;min-height:0;font:700 12px system-ui';
  viewEl.addEventListener('pointerdown',ev=>{ ev.stopPropagation(); _tutBtn='view'; toggleViewPop(); }); document.body.appendChild(viewEl);
  // audio mute toggle
  const audEl=document.createElement('div'); audEl.className='hud hchip'; audEl.textContent='🔊';
  audEl.style.cssText+=';right:calc(14px + var(--sr));top:calc(104px + var(--st));padding:8px 12px;min-height:0;font:700 15px system-ui';
  audEl.addEventListener('pointerdown',ev=>{ ev.stopPropagation(); initAudio(); resumeAudio(); setAudio(!audioOn); audEl.textContent=audioOn?'🔊':'🔇'; }); document.body.appendChild(audEl);
  viewPop=document.createElement('div'); viewPop.id='viewPop';
  viewPop.addEventListener('pointerdown',ev=>ev.stopPropagation()); document.body.appendChild(viewPop);
  // hero HP bar + objective, stacked top-centre in one framed cluster
  const hp=document.createElement('div'); hp.className='hud';
  hp.style.cssText+=';left:50%;top:calc(52px + var(--st));transform:translateX(-50%);width:min(240px,56vw);height:13px;background:rgba(10,14,20,0.5);border:1px solid var(--brd);border-radius:7px;overflow:hidden;box-shadow:none;backdrop-filter:blur(6px)';
  heroHpEl=document.createElement('div'); heroHpEl.style.cssText='height:100%;width:100%;background:linear-gradient(#a6ec5e,#5cb43a)'; hp.appendChild(heroHpEl); document.body.appendChild(hp);
  waveEl=document.createElement('div'); waveEl.className='hud';
  waveEl.style.cssText+=';left:50%;top:calc(72px + var(--st));transform:translateX(-50%);font:800 12px system-ui;color:#ffd9d2;text-shadow:0 1px 3px #000;white-space:nowrap'; document.body.appendChild(waveEl);
  joyBase=document.createElement('div'); joyBase.id='joy';
  const jring=document.createElement('div'); jring.className='ring'; joyBase.appendChild(jring);
  joyKnob=document.createElement('div'); joyKnob.id='joyK'; joyBase.appendChild(joyKnob); document.body.appendChild(joyBase);
  // radial command hand (bottom-right): Hit is the primary anchor under the thumb; everything else fans
  // up-left as two concentric arcs — inner ring = hero abilities, outer ring = army orders. The two rings
  // share the same three spoke angles (14°/51°/88° off horizontal) so buttons line up radially: symmetric,
  // and all anchored to one corner so it holds up in portrait and landscape alike.
  const hand=document.createElement('div'); hand.className='abilHand';
  const mkAbil=(cls,icon,cap,size,right,bottom,fn)=>{ const b=document.createElement('div'); b.className='abil '+cls+(size>=72?' big':'');
    b.style.cssText='width:'+size+'px;height:'+size+'px;right:'+right+'px;bottom:'+bottom+'px';
    b.innerHTML='<div class="cd"></div><div class="ic">'+icon+'</div><div class="cap">'+cap+'</div>';
    b.addEventListener('pointerdown',ev=>{ ev.stopPropagation(); _tutBtn=cls; sfx('ui'); fn(); }); hand.appendChild(b); return b; };
  hitEl  =mkAbil('hit',ic('sword'),'Hit',76,12,12,()=>{ heroHit(); });                                            // basic attack — lights up only in range
  // inner ring — Warden abilities (spokes low→high: 14°, 51°, 88°)
  abilEl =mkAbil('stomp',ic('fan'),'Fan',56,121,47,()=>{ if(radialMode==='squad'){ stopSel(); return; } if(hero.kit==='paladin')consecration(); else fanOfKnives(); });   // AoE slot / squad Stop
  boltEl =mkAbil('bolt',ic('shadow'),'Strike',56,86,101,()=>{ if(radialMode==='squad'){ holdSel(); return; } if(hero.spellCd<=0){ spellArmed=!spellArmed; } updateSpellUI(); });   // armed target / squad Hold
  smiteEl=mkAbil('smite',ic('blink'),'Blink',56,26,124,()=>{ if(radialMode==='squad'){ amArmed=!amArmed; updateSpellUI(); return; } if(hero.kit==='paladin')divineShield(); else blink(); });   // utility / squad Attack-Move
  // outer ring — army orders (same three spokes, one radius further out)
  boxBtn =mkAbil('select',ic('select'),'Select',50,185,65,()=>setBoxMode(!boxMode));   // arm marquee: next drag selects troops
  chargeEl=mkAbil('charge',ic('swords'),'Charge',50,129,153,()=>chargeAll());
  recallEl=mkAbil('recall',ic('recall'),'Recall',50,31,190,()=>recall());
  autoEl=document.createElement('div'); autoEl.className='pill'; autoEl.textContent='AUTO';   // rides on the Bolt button
  autoEl.addEventListener('pointerdown',ev=>{ ev.stopPropagation(); autoBolt=!autoBolt; updateSpellUI(); }); boltEl.appendChild(autoEl);
  document.body.appendChild(hand); abilHandEl=hand;
  dmgLayer=document.createElement('div'); dmgLayer.id='dmgLayer'; document.body.appendChild(dmgLayer);   // floating combat numbers
  respawnEl=document.createElement('div'); respawnEl.id='respawnBanner';
  respawnEl.style.cssText='position:fixed;left:50%;top:36%;transform:translateX(-50%);z-index:8;display:none;flex-direction:column;align-items:center;gap:5px;pointer-events:none;text-align:center';
  respawnEl.innerHTML='<div style="font:800 19px system-ui;color:#ff8a6a;text-shadow:0 2px 6px rgba(0,0,0,0.75)">Your hero has fallen</div><div class="rsT" style="font:800 15px system-ui;color:#e6eef6;text-shadow:0 2px 6px rgba(0,0,0,0.75)">Respawning in 8s</div>';
  document.body.appendChild(respawnEl);
  // hero-select start screen
  heroSelEl=document.createElement('div'); heroSelEl.id='heroSel';
  heroSelEl.innerHTML='<h2>Choose your Hero</h2><div class="cards"></div>';
  const cards=heroSelEl.querySelector('.cards');
  const HEROES=[['queen','sword','Elf Queen','Rimwalkers · Night Elf — Blink · Fan of Knives · Shadow Strike. Fields an elven host.'],
                ['paladin','shield','Paladin','Iron Crown · Human — Consecration · Hammer of Justice · Divine Shield. Fields footmen, crossbows & mages.'],
                ['aelindra','archer','Aelindra Ashveil','Rimwalkers · Night Elf — Windstep · Volley · Moonfire. A fast, evasive archer; fields an elven host.'],
                ['thoryn','swords','Thoryn Greywarden','Rimwalkers · Night Elf — Windstep · Blade Dance · Root Lash. A runeblade warden with a glowing greatblade; fields an elven host.']];
  for(const [k,icn,nm,blurb] of HEROES){ const c=document.createElement('div'); c.className='hc';
    c.innerHTML='<div class="ic">'+ic(icn)+'</div><div class="nm">'+nm+'</div><div class="kit">'+blurb+'</div>';
    c.addEventListener('pointerdown',ev=>{ ev.stopPropagation(); gameMode='skirmish'; activeMission=null; heroKind=k;
      // always rebuild the skirmish so the army + buildings match the chosen hero's faction
      applyLevel('skirmish'); applyHeroFaction(k); resetWorld(); build(); spawnGame(); initFog(); if(typeof bakeMiniLand==='function')bakeMiniLand();
      pickHero(k); }); cards.appendChild(c); }
  document.body.appendChild(heroSelEl);   // hidden until the player picks Skirmish (mode-select gates it)
  refreshRadial();   // initialise the radial in hero mode

  // objective banner (campaign)
  objBannerEl=document.createElement('div'); objBannerEl.id='objBanner'; document.body.appendChild(objBannerEl);
  const infoTog=document.createElement('div'); infoTog.id='infoTog'; infoTog.textContent='▾ Info';   // collapse/expand the objective + coach stack
  infoTog.addEventListener('pointerdown',ev=>{ ev.stopPropagation(); _hudHidden=!_hudHidden; applyHudVis(); }); document.body.appendChild(infoTog);
  // conversation banner (campaign cutscenes / tutorial) — tap anywhere advances
  dialogEl=document.createElement('div'); dialogEl.id='dialog';
  dialogEl.innerHTML='<div class="box"><div class="por"></div><div class="body"><div class="who"></div><div class="txt"></div><div class="adv">tap to continue &rsaquo;</div></div></div>';
  dialogEl.addEventListener('pointerdown',ev=>{ ev.stopPropagation(); advanceDialog(); });
  document.body.appendChild(dialogEl);

  // ---- mode-select: Campaign vs Skirmish (shown first) ----
  modeSelEl=document.createElement('div'); modeSelEl.id='modeSel';
  modeSelEl.innerHTML='<h2>VERATH</h2><div class="cards">'
    +'<div class="modeCard" data-m="campaign"><div class="ic">'+ic('shield')+'</div><div class="nm">Campaign</div><div class="kit">The Verath Wars — hand-authored missions with story. Iron Crown vs the Raider Horde.</div></div>'
    +'<div class="modeCard" data-m="skirmish"><div class="ic">'+ic('swords')+'</div><div class="nm">Skirmish</div><div class="kit">Free play — pick a hero and raze the enemy throne. One AI opponent.</div></div>'
    +'</div>';
  modeSelEl.querySelector('[data-m="campaign"]').addEventListener('pointerdown',ev=>{ ev.stopPropagation(); modeSelEl.style.display='none'; buildMissionList(); missionSelEl.style.display='flex'; });
  modeSelEl.querySelector('[data-m="skirmish"]').addEventListener('pointerdown',ev=>{ ev.stopPropagation(); modeSelEl.style.display='none'; heroSelEl.style.display='flex'; });
  document.body.appendChild(modeSelEl); modeSelEl.style.display='flex';

  // ---- campaign mission select ----
  missionSelEl=document.createElement('div'); missionSelEl.id='missionSel';
  missionSelEl.innerHTML='<h2>Campaign</h2><div class="mlist"></div><button class="mback">&larr; Back</button>';
  missionSelEl.querySelector('.mback').addEventListener('pointerdown',ev=>{ ev.stopPropagation(); missionSelEl.style.display='none'; modeSelEl.style.display='flex'; });
  document.body.appendChild(missionSelEl);

  // ---- mission intro card ----
  missionCardEl=document.createElement('div'); missionCardEl.id='missionCard';
  document.body.appendChild(missionCardEl);

  resultEl=document.createElement('div'); resultEl.style.cssText='position:fixed;inset:0;display:none;flex-direction:column;align-items:center;justify-content:center;background:#0008;color:#fff;font:600 18px system-ui;gap:12px;z-index:9;padding:0 22px;text-align:center';
  resultEl.innerHTML='<h1 style="font-size:48px;margin:0"></h1><div class="sub" style="max-width:520px;line-height:1.6">tap to play again</div>'; resultEl.addEventListener('pointerdown',()=>location.reload()); document.body.appendChild(resultEl);
  // Siege-Up top-centre resource bar: gold | wood | population (replaces the bottom-left chips)
  const og=document.getElementById('gold'); if(og)og.style.display='none';
  const rb=document.createElement('div'); rb.id='resbar';
  rb.innerHTML='<div class="rs g"><span class="c" style="width:14px;height:14px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#ffe27a,#f4c53b 60%,#c9962a);box-shadow:inset 0 0 0 2px #b98a1e"></span><span id="rgold">180</span></div>'+
    '<div class="rs w">'+ic('wood')+'<span class="v">0</span></div>'+
    '<div class="rs p">'+ic('tent')+'<span class="v">0/12</span></div>';
  document.body.appendChild(rb);
  goldNumEl=document.getElementById('rgold');
  woodEl=rb.querySelector('.rs.w'); supEl=rb.querySelector('.rs.p');
  // build panel + backdrop (centred modal so it never sits under the thumb clusters)
  bmBack=document.createElement('div'); bmBack.id='bmBack'; bmBack.addEventListener('pointerdown',ev=>{ ev.stopPropagation(); closeBuildMenu(); }); document.body.appendChild(bmBack);
  buildMenuEl=document.createElement('div'); buildMenuEl.className='bmPanel';
  buildMenuEl.addEventListener('pointerdown',ev=>ev.stopPropagation()); document.body.appendChild(buildMenuEl);
  // discoverable build entry: a hammer toggle that expands/collapses the build radial
  buildBtnEl=document.createElement('button'); buildBtnEl.id='buildBtn'; buildBtnEl.setAttribute('aria-label','Build');
  buildBtnEl.innerHTML=ic('hammer'); buildBtnEl.addEventListener('pointerdown',ev=>{ ev.stopPropagation(); toggleBuildMenu(); });
  document.body.appendChild(buildBtnEl);
  // lasso overlay
  lcv=document.createElement('canvas'); lcv.style.cssText='position:fixed;inset:0;pointer-events:none;z-index:4'; lcv.width=innerWidth; lcv.height=innerHeight; document.body.appendChild(lcv); lctx=lcv.getContext('2d');
  addEventListener('resize',()=>{ lcv.width=innerWidth; lcv.height=innerHeight; });
  // (army orders now live in the outer ring of the radial hand above — no separate strip)
  // selection panel (Siege-Up style): portrait, name, hp bar, stats, dismiss
  selPanelEl=document.createElement('div'); selPanelEl.id='selP';
  selPanelEl.innerHTML='<div class="spPortrait"><div class="spIc"></div></div>'+
    '<div class="spInfo"><div class="spNm"></div>'+
      '<div class="spHpRow"><span class="spHeart">'+ic('heart')+'</span><div class="spBar"><div class="spBarF"></div><span class="spBarT"></span></div></div>'+
      '<div class="spSt"></div></div>'+
    '<div class="spGrid"></div>'+
    '<div class="spActs"><div class="spAll" title="Select all">'+ic('roster')+'</div><div class="spX">'+ic('close')+'</div></div>';
  selPanelEl.addEventListener('pointerdown',ev=>ev.stopPropagation());
  selPanelEl.querySelector('.spX').addEventListener('pointerdown',ev=>{ ev.stopPropagation(); clearSel(); });
  document.body.appendChild(selPanelEl);
  // the opening tip fades on its own (and on tap) so the HUD gets out of the way, Thronefall-style
  const tipEl=document.getElementById('tip');
  if(tipEl){ tipEl.addEventListener('pointerdown',ev=>{ ev.stopPropagation(); tipEl.classList.add('hide'); });
    setTimeout(()=>tipEl.classList.add('hide'),9000); }
  buildMini(); applyCamMode();   // start in free RTS camera (joystick hidden until you lock to the hero)
  addEventListener('pointerdown',onDown); addEventListener('pointermove',onMove); addEventListener('pointerup',onUp); addEventListener('pointercancel',onUp);
}
// ---------- minimap ----------
let mcv=null, mctx=null, miniLand=null, miniAcc=0; const MHALF=155, MSZ=132;
function w2m(x,z){ return [ (x+MHALF)/(2*MHALF)*MSZ, (z+MHALF)/(2*MHALF)*MSZ ]; }   // world → minimap px (north-up)
function buildMini(){
  const wrap=document.createElement('div'); wrap.id='mini';
  mcv=document.createElement('canvas'); const dpr=Math.min(devicePixelRatio||1,2);
  mcv.width=MSZ*dpr; mcv.height=MSZ*dpr; wrap.appendChild(mcv); document.body.appendChild(wrap);
  mctx=mcv.getContext('2d'); mctx.scale(dpr,dpr);
  // tap the map to pan the free camera there (ignored while the camera is locked to the hero)
  wrap.addEventListener('pointerdown',ev=>{ ev.stopPropagation(); if(camLocked)return;
    const r=wrap.getBoundingClientRect(); const mx=(ev.clientX-r.left)/r.width*MSZ, my=(ev.clientY-r.top)/r.height*MSZ;
    camAim.x=mx/MSZ*2*MHALF-MHALF; camAim.z=my/MSZ*2*MHALF-MHALF; camAim.init=true; });
  bakeMiniLand();
}
// bake the land silhouette from the ACTIVE map (re-run whenever the map changes)
function bakeMiniLand(){ if(!miniLand){ miniLand=document.createElement('canvas'); miniLand.width=MSZ; miniLand.height=MSZ; }
  const g=miniLand.getContext('2d'); g.clearRect(0,0,MSZ,MSZ); g.fillStyle='#1a3346'; g.fillRect(0,0,MSZ,MSZ);
  const step=2.0; g.fillStyle='#8c9089';
  for(let x=-MHALF;x<=MHALF;x+=step) for(let z=-MHALF;z<=MHALF;z+=step){ if(onIsland(x,z)){ const [px,py]=w2m(x,z); g.fillRect(px,py,2,2); } } }
function drawMini(){ if(!mctx)return; mctx.clearRect(0,0,MSZ,MSZ); mctx.drawImage(miniLand,0,0);
  const dot=(x,z,c,r)=>{ const [px,py]=w2m(x,z); mctx.fillStyle=c; mctx.beginPath(); mctx.arc(px,py,r,0,6.283); mctx.fill(); };
  for(const p of plots){ if(p.cat) dot(p.x,p.z,'#f2c94c',1.6); }
  if(coreB) dot(coreB.x,coreB.z,'#7fd8ff',3);
  if(enemyCore&&isExplored(enemyCore.x,enemyCore.z)) dot(enemyCore.x,enemyCore.z,'#ff5a4a',3);
  for(const e of eStructs){ if(e.alive&&isExplored(e.px,e.pz)) dot(e.px,e.pz,'#c8603a',1.6); }
  for(const e of allies){ if(e.alive) dot(e.px,e.pz,'#5bd0ff',1.7); }
  for(const e of enemies){ if(e.alive&&e.__vis) dot(e.px,e.pz,'#ff7a5a',1.7); }
  if(hero&&hero.alive){ const [px,py]=w2m(hero.px,hero.pz); mctx.fillStyle='#ffffff'; mctx.strokeStyle='#123'; mctx.lineWidth=1;
    mctx.beginPath(); mctx.arc(px,py,2.6,0,6.283); mctx.fill(); mctx.stroke(); }
  if(fogMiniCv) mctx.drawImage(fogMiniCv,0,0,MSZ,MSZ);
  if(_vein && !_veinFound){ const [px,py]=w2m(_vein.x,_vein.z); mctx.fillStyle='#ff9a3a'; mctx.strokeStyle='#3a1e08'; mctx.lineWidth=1;   // ironroot quest marker (shows through fog)
    mctx.save(); mctx.translate(px,py); mctx.rotate(Math.PI/4); mctx.fillRect(-3,-3,6,6); mctx.strokeRect(-3,-3,6,6); mctx.restore(); } }
function onDown(e){ if(gameOver)return;
  initAudio(); resumeAudio();   // first touch unlocks the audio context (mobile requirement)
  ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY});
  const r=joyBase.getBoundingClientRect(), jcx=r.left+r.width/2, jcy=r.top+r.height/2;
  if(Math.hypot(e.clientX-jcx,e.clientY-jcy) <= r.width/2+30){   // the stick: hero in Follow mode, camera pan in Free mode
    joy.active=true; joy.id=e.pointerId; joy.cx=jcx; joy.cy=jcy; joy.R=r.width/2-14; joy.nx=0;joy.ny=0;
    joyKnob.style.left='50%'; joyKnob.style.top='50%'; return; }
  const inZone=el=>{ if(!el)return false; const b=el.getBoundingClientRect(); return e.clientX>=b.left&&e.clientX<=b.right&&e.clientY>=b.top&&e.clientY<=b.bottom; };
  if(inZone(abilHandEl)||inZone(cmdStripEl)) return;
  if(e.target && rnd3d && e.target!==rnd3d.domElement) return;   // tap landed on a HUD element, not the world
  if(ptrs.size>=2){ cmd.active=false; const v=[...ptrs.values()], a=v[0], b=v[1];   // second finger → pinch-zoom + rotate
    gesture={mode:'pinch', d0:Math.max(1,Math.hypot(a.x-b.x,a.y-b.y)), ang0:Math.atan2(b.y-a.y,b.x-a.x), dist0:camF.dist, az0:camF.az}; return; }
  cmd.active=true; cmd.id=e.pointerId; cmd.moved=false; cmd.box=boxMode; cmd.sx=e.clientX; cmd.sy=e.clientY; cmd.lx=e.clientX; cmd.ly=e.clientY;   // one finger → tap-command, drag-pan, or box-select
}
function onMove(e){
  if(ptrs.has(e.pointerId)) ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(joy.active&&e.pointerId===joy.id){ const dx=e.clientX-joy.cx,dy=e.clientY-joy.cy, d=Math.hypot(dx,dy),R=joy.R, cl=Math.min(d,R),ang=Math.atan2(dy,dx),kx=Math.cos(ang)*cl,ky=Math.sin(ang)*cl;
    joy.nx=kx/R; joy.ny=ky/R; joyKnob.style.left=(50+(kx/R)*38)+'%'; joyKnob.style.top=(50+(ky/R)*38)+'%'; return; }
  if(gesture&&gesture.mode==='pinch'&&ptrs.size>=2){ const v=[...ptrs.values()], a=v[0], b=v[1];
    const d=Math.max(1,Math.hypot(a.x-b.x,a.y-b.y)), ang=Math.atan2(b.y-a.y,b.x-a.x);
    camF.dist=Math.max(ZMIN,Math.min(ZMAX, gesture.dist0*gesture.d0/d)); camF.az=gesture.az0+(ang-gesture.ang0)*180/Math.PI; return; }
  if(cmd.active&&e.pointerId===cmd.id){ const ddx=e.clientX-cmd.lx, ddy=e.clientY-cmd.ly; cmd.lx=e.clientX; cmd.ly=e.clientY;
    if(Math.hypot(e.clientX-cmd.sx,e.clientY-cmd.sy)>10) cmd.moved=true;
    if(cmd.moved){ if(cmd.box){ if(lctx){ lctx.clearRect(0,0,lcv.width,lcv.height);   // box-select mode: draw the marquee
          lctx.strokeStyle='rgba(126,240,138,0.95)'; lctx.lineWidth=2; lctx.setLineDash([7,5]);
          lctx.strokeRect(Math.min(cmd.sx,e.clientX),Math.min(cmd.sy,e.clientY),Math.abs(e.clientX-cmd.sx),Math.abs(e.clientY-cmd.sy));
          lctx.fillStyle='rgba(126,240,138,0.10)';
          lctx.fillRect(Math.min(cmd.sx,e.clientX),Math.min(cmd.sy,e.clientY),Math.abs(e.clientX-cmd.sx),Math.abs(e.clientY-cmd.sy)); } }
      else panWorld(ddx,ddy); } } }
function onUp(e){
  ptrs.delete(e.pointerId); if(ptrs.size<2) gesture=null;
  if(joy.active&&e.pointerId===joy.id){ joy.active=false; joy.nx=0;joy.ny=0; joyKnob.style.left='50%'; joyKnob.style.top='50%'; return; }
  if(cmd.active&&e.pointerId===cmd.id){ cmd.active=false;
    if(cmd.box){ setBoxMode(false); if(lctx)lctx.clearRect(0,0,lcv.width,lcv.height);   // finish the marquee: select everything inside
      if(cmd.moved){ selectInRect(cmd.sx,cmd.sy,e.clientX,e.clientY); return; } }
    else if(cmd.moved) return;   // a drag was a camera pan, not a command
    const nd=new THREE.Vector2((e.clientX/innerWidth)*2-1,-(e.clientY/innerHeight)*2+1); raycaster.setFromCamera(nd,cam); const hit=new THREE.Vector3();
    if(raycaster.ray.intersectPlane(groundPlane,hit)&&onIsland(hit.x,hit.z)){
      const pp=plots.find(p=>Math.hypot(hit.x-p.x,hit.z-p.z)<5.5);
      if(pp){ openPlotMenu(pp); }                                                                   // tapped a build plot → radial build / upgrade / train
      else if(coreB&&Math.hypot(hit.x-coreB.x,hit.z-coreB.z)<7){ openCoreMenu(); }                  // tapped the throne → expand
      else { closeBuildMenu();
        if(amArmed && radialMode==='squad' && selected.size){ const en=nearestEnemyTo(hit.x,hit.z,6);   // Attack-Move: march on the point, engaging foes en route
          if(en) attackOrder([...selected],en); else { moveOrder([...selected],hit.x,hit.z); rallyMarker.material.color.setHex(0xff6a5a); }
          amArmed=false; updateSpellUI(); }
        else if(spellArmed){ const en=nearestEnemyTo(hit.x,hit.z,7); if(en){ if(hero.kit==='paladin')hammerOfJustice(en); else shadowStrike(en); } else spellArmed=false; updateSpellUI(); }   // armed target-cast
        else { // context tap (Siege-Up): friendly → select · enemy → attack order · ground → move order
          const en=nearestEnemyTo(hit.x,hit.z,5), al=nearestAllyTo(hit.x,hit.z,4);
          const alD=al?Math.hypot(al.px-hit.x,al.pz-hit.z):1e9, enD=en?Math.hypot(en.px-hit.x,en.pz-hit.z):1e9;
          if(al && alD<=enD){ selectOne(al); }
          else if(selected.size){ if(en) attackOrder([...selected],en); else moveOrder([...selected],hit.x,hit.z); }
          else if(en){ /* nothing selected: tapping a foe does nothing — select troops first */ }
          else clearSel(); } }
    }
    if(lctx)lctx.clearRect(0,0,lcv.width,lcv.height); } }

// ---------- camera / render ----------
function setCam(pitchDeg,dist,fov,az,lookY){
  const p=pitchDeg*Math.PI/180, a=(az||34)*Math.PI/180;
  const hy=dist*Math.sin(p), hz=dist*Math.cos(p);
  cam.fov=fov||30; cam.updateProjectionMatrix();
  cam.position.set(Math.sin(a)*hz, hy, Math.cos(a)*hz);
  cam.lookAt(0,lookY||-2,0);
}
window.__cam=setCam;

// ---------- chromatic-offset "screenprint" post pass ----------
let composer,bloomPass,postMat,renderPass;
function pr(){return Math.min(devicePixelRatio,2);}
function initPost(){
  composer=new THREE.EffectComposer(rnd3d);
  composer.setSize(innerWidth,innerHeight); composer.setPixelRatio(pr());
  renderPass=new THREE.RenderPass(scene,cam); composer.addPass(renderPass);
  // selective bloom: high threshold so only fires / magic / sun-glints glow (Reforged-style)
  bloomPass=new THREE.UnrealBloomPass(new THREE.Vector2(innerWidth,innerHeight), 0.42, 0.5, 0.92);
  composer.addPass(bloomPass);
  // final grade pass — clean, punchy toon look. No chromatic aberration, no warm/cool split-tone
  // and no vignette (those three read as an old-CRT/VHS grade); just a small exposure lift and a
  // gentle saturation pop so the Bitgem hand-painted palette stays crisp and bright.
  const grade=new THREE.ShaderPass({
    uniforms:{ tDiffuse:{value:null}, uAmt:{value:2.2}, uRes:{value:new THREE.Vector2(innerWidth,innerHeight)} },
    vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader:[
      'uniform sampler2D tDiffuse;uniform float uAmt;uniform vec2 uRes;varying vec2 vUv;',
      'const float EXPOSURE=1.05, CONTRAST=1.02, SAT=1.14;',
      'void main(){',
      '  vec3 col=texture2D(tDiffuse,vUv).rgb;',
      '  col*=EXPOSURE;',
      '  float l=dot(col,vec3(0.299,0.587,0.114));',
      '  col=mix(vec3(l),col,SAT);',                 // gentle saturation pop, neutral tint
      '  col=(col-0.5)*CONTRAST+0.5;',
      '  gl_FragColor=vec4(clamp(col,0.0,1.0),1.0);',
      '}'].join('\n')
  });
  grade.renderToScreen=true; composer.addPass(grade); postMat=grade.material;
}

async function boot(){
  rnd3d=new THREE.WebGLRenderer({antialias:true});
  rnd3d.setSize(innerWidth,innerHeight); rnd3d.setPixelRatio(pr());
  rnd3d.setClearColor(0x3f9fd6, 1);   // EffectComposer clears to this — paints the open sea/sky (scene.background isn't drawn through the composer)
  rnd3d.shadowMap.enabled=true; rnd3d.shadowMap.type=THREE.PCFSoftShadowMap;
  if('outputColorSpace' in rnd3d) rnd3d.outputColorSpace=THREE.SRGBColorSpace;
  document.body.appendChild(rnd3d.domElement);
  cam=new THREE.PerspectiveCamera(30,innerWidth/innerHeight,1,600);
  await Promise.all([loadNature(), loadBuildings()]); applyHeroFaction(heroKind); build(); initPost(); await loadRig(); bakePortraits(); spawnGame(); initFog(); setupHUD(); followCam();
  addEventListener('resize',()=>{
    rnd3d.setSize(innerWidth,innerHeight); cam.aspect=innerWidth/innerHeight; cam.updateProjectionMatrix();
    composer.setSize(innerWidth,innerHeight); bloomPass.setSize(innerWidth,innerHeight); postMat.uniforms.uRes.value.set(innerWidth,innerHeight);
  });
  let last=performance.now();
  (function loop(){ requestAnimationFrame(loop);
    const now=performance.now(); let dt=(now-last)/1000; last=now; if(dt>0.05)dt=0.05;
    updateGame(dt); followCam(dt); repositionRadial(); updateFires(dt); updateHeroAura(dt); updateAtmos(dt);
    if(++miniAcc%4===0){ drawMini(); updateSelPanel(); }   // ~15fps minimap + selection-card refresh
    if(miniAcc%6===0) updateFog();   // ~10fps fog recompute
    composer.render();
  })();
  window.__ready=true;
}
// dev/debug bridge — the game body is module-scoped under Vite, so expose the internals
// headless verification + the weapon tuner poke. Harmless in prod; gate behind a flag later.
window.__dbg={
  get hero(){return hero}, get camAim(){return camAim}, get camF(){return camF}, get scene(){return scene},
  get enemies(){return enemies}, get allies(){return allies}, get waterMat(){return waterMat}, get motes(){return motes},
  get modeSelEl(){return modeSelEl}, get missionSelEl(){return missionSelEl}, get missionCardEl(){return missionCardEl}, get heroSelEl(){return heroSelEl},
  followCam:(...a)=>followCam(...a), riggize:(...a)=>riggize(...a), makeChar:(...a)=>makeChar(...a), setAnim:(...a)=>setAnim(...a),
  mkFighter:(...a)=>mkFighter(...a), pickHero:(...a)=>pickHero(...a), updateFog:(...a)=>updateFog(...a),
  mission:(id)=>{ const m=CAMPAIGN.find(x=>x.id===id); if(m)startMission(m); return !!m; },
  selectOne:(u)=>selectOne(u), selectMany:(l)=>selectMany(l), clearSel:()=>clearSel(), updateSelPanel:()=>updateSelPanel(),
  topY:(x,z)=>topY(x,z), landField:(x,z)=>landField(x,z), shape:()=>MAPSHAPE, arenaR:()=>ARENA_R,
  start(){ started=true; }
};
boot();
