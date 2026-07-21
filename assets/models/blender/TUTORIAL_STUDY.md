# Tutorial study — start to finish

Primary walkthrough followed end-to-end:

**[How To Make A 3D Character For Your Game (Blender → Unity)](https://www.youtube.com/watch?v=ogz-3r0EHKM)**  
Jelle Vermandere · 13:40 · ~1.4M views

Supporting setup lessons from:

**[Crashsune — Low Poly Character Modeling Part 1](https://www.youtube.com/watch?v=Use9T2IX1XE)** (scene setup, refs, Rigify scale)  
**[Stark Crafts — Lowpoly PS1 Human](https://www.youtube.com/watch?v=g40_nps24tY)** (leg→arm→head poly order, flat texture)  
**[CoderNunk — Complete 3D Game Character Guide](https://codernunk.com/tutorials/complete-3d-character-guide/)** (topology rationale, Rigify)

---

## What “start to finish” means (Jelle’s chapters)

| Step | Chapter | Technique we practiced |
|------|---------|------------------------|
| 1 | Sketch | Front + side **T-pose** references, ~1.8 m tall |
| 2 | Modelling | Cube → **Mirror** → extrude core → **shoulders first, then arms** → pelvis → legs → loop cuts for clothes → mitt hands + thumb |
| 3 | UV unwrap | Mark seams like clothing sew lines → Unwrap → pack islands |
| 4 | Texturing | Multi-material by linked faces **or** palette UVs; matte Principled; join accessories |
| 5 | Rigging | Enable **Rigify** → Human metarig → delete face/extra finger bones → X-mirror align → Ctrl-P **Automatic Weights** |
| 6 | Animating | Pose-mode keyframes: idle breathe, run cycle (mirror paste), jump (optional) |
| 7 | Export | FBX/GLB for engine |

Crashsune Part 1 add-ons to the setup:

- Render: **Eevee**, bloom/AO off for stylized blockout
- Color management: **View Transform = Standard** (not AgX) so game colors match
- Incremental saves (`Ctrl+Alt+S`)
- Use Human metarig as a **scale ruler** when aligning refs

---

## Hard rules learned (vs our earlier Meshy / shell attempts)

1. **One connected mesh with edge loops** deforms; welded armor shells + proximity weights do not.
2. **Shoulder topology before arm extrusion** — don’t extrude arms straight from the torso side.
3. **Seams follow real clothing** — shirt side seam, inseam, underarm.
4. **Fewer bones** — mitt hands, no face bones for game units.
5. **Auto-weights only work** if the mesh is manifold-ish and bones sit inside the volume.
6. **Standard view transform** keeps albedo saturated like a mobile game.

---

## Headless adaptations (what we changed vs clicking the GUI)

Following the tutorial *literally* with mouse selection is unreliable in Blender
batch mode. For the practice character we kept every **chapter**, but adapted:

| Tutorial step | Headless adaptation |
|---------------|---------------------|
| Extrude face-by-face with Mirror | Boolean-UNION of torso/limb primitives → one manifold mesh |
| Mark seams by hand | Height-band + center-line seams, then Unwrap |
| L-select linked materials | Assign by centroid height bands |
| Rigify custom bone shapes | Cleared before GLB export (avoids stray icospheres) |

**Big lesson confirmed:** Automatic Weights succeed on a **connected manifold** mesh and fail on disconnected armor shells — matching what Jelle's "join accessories" tip implies.
