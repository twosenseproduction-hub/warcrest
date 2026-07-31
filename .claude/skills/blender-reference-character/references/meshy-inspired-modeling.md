# Meshy-inspired modeling (owned Blender techniques)

Translate Meshy’s dense white-model look into **headless bpy** recipes. Goal:
sharp plate edges, fold ridges, and hair volumes that survive clay lighting —
without calling Meshy.

## Principle

**Cage → support loops → bevel → subdiv → panel cut.**  
Primitives are only the cage. If the final silhouette is still a sphere, you
stopped too early.

## Double-subdiv cage (hard + soft)

From Blender Secrets “double subdivision” idea:

1. Build an **all-quad** low cage (cube / cylinder with loop cuts)  
2. Optional **Simple** subdiv level 1 to densify evenly  
3. **Catmull-Clark** subdiv level 1–2 for smooth volumes  
4. Keep **support loops** near corners so armor edges stay sharp under CC  

```python
def apply_subdiv(ob, levels=2, simple_first=False):
    activate(ob)
    if simple_first:
        m = ob.modifiers.new('Simple', 'SUBSURF')
        m.subdivision_type = 'SIMPLE'
        m.levels = 1
        bpy.ops.object.modifier_apply(modifier='Simple')
    m = ob.modifiers.new('CC', 'SUBSURF')
    m.subdivision_type = 'CATMULL_CLARK'
    m.levels = levels
    bpy.ops.object.modifier_apply(modifier='CC')
```

## Armor plate (Meshy “hard edge” language)

```python
def armor_plate(loc, scale, mat, name, inset=0.85, bevel_w=0.02):
    ob = add_cube(loc, scale)
    # support: inset face (edit mode) or second thinner plate
    bevel(ob, width=bevel_w, segments=3)
    apply_subdiv(ob, levels=1)          # keep somewhat hard
    # optional rim: slightly larger thin plate behind
    return finish(ob, mat, name)
```

Cut **panel lines** where light-scan edges fire: loop cut + inset + slight
push along normal (Alt+S analogue: scale faces along normals in bmesh).

## Organic limb / torso

- Cage from **cube** with 3–5 loop cuts along length, taper by scaling rings  
- Or cylinder with `shade_smooth` + subdiv ≥2 + end caps  
- Never leave a 12-vert cylinder as the hero limb  

## Cape / cloth (Meshy thickness + folds)

1. `grid` or subdivided plane (u≥16, v≥20)  
2. Extrude thickness (solidify modifier apply)  
3. Shape fold ridges by moving vertex rows on +Y/−Y  
4. Hem as a separate thickened strip (second material OK after white pass)  

Flat single cube = automatic fail.

## Hair

- ≥12 directional clumps; each clump = tapered capsule/curve extruded  
- Optional **card** planes with opacity later — for white model, use thin meshes  
- Follow light-scan highlight streaks for gold/secondary masses  

## Head

- Start **cube** → loop cuts for brow / jaw / cheek  
- Subdiv 2  
- Pull jaw forward (−Y), flatten cheeks  
- Eye sockets = inset extrude back, not glowing orbs glued on a ball  

## White model gate

While `construction_phase == "white_model"`:

- One clay/grey material OR flat region greys  
- No bloom emissives  
- Critique only silhouette / proportions / edges  

Color is stage 4, after clay ships.

## Remesh for game (after shape)

```python
# Voxel remesh for uniform triangles, then decimate
m = ob.modifiers.new('Voxel', 'REMESH')
m.mode = 'VOXEL'
m.voxel_size = 0.03
bpy.ops.object.modifier_apply(modifier='Voxel')
# then Decimate ratio toward troop/hero budget
```

Prefer keeping hard-surface cages for armor and only remeshing organic soft body
if animation demands it.

## Density checklist before calling it “Meshy-like”

- [ ] Clay render shows plate seams / fold ridges without textures  
- [ ] No part is a lone UV sphere  
- [ ] Cape has thickness + ≥2 fold lines  
- [ ] Hair breaks silhouette with many spikes, not a helmet blob  
- [ ] Light-scan edge brightlines have corresponding mesh cuts  
- [ ] Step PNG saved and Read in chat  

## Tie-in

Use with `sharp-detail-path.md` (pipeline) + `lidar-light-scan.md` (where to cut)
+ `anti-blob.md` (bans) + `show-progress.md` (PNG every densify).
