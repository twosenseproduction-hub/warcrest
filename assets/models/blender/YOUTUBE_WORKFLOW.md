# Blender character workflow (from YouTube)

Curated from public tutorials, then applied to `purple_plate_elf` (Drive T-pose plate elf).

## Videos (7–10)

| # | Title | Channel / link | What we took |
|---|--------|----------------|--------------|
| 1 | [Blender Low Poly Character Modeling Tutorial – Part 1](https://www.youtube.com/watch?v=Use9T2IX1XE) | Crashsune Academy | Reference plane, box-extrude body, Mirror, keep poly low |
| 2 | [How to 3D Model and Texture Hair (Low Poly)](https://www.youtube.com/watch?v=SFdLEc2G_Jk) | Crashsune Academy | Hair as solid volumes / crest shapes, not strands |
| 3 | [How to Make Low Poly Character in Blender](https://www.youtube.com/watch?v=Tvop5nvrZqQ) | Sculpt Labs | Blockout → refine silhouette before detail |
| 4 | [Create Game Ready Characters](https://www.youtube.com/watch?v=br5g7m-jE_Q) | Blender Secrets | Game path: blockout → clothing/armor shells → lower poly export |
| 5 | [How to Sculpt a Character – Stylized Elf](https://www.youtube.com/watch?v=QRNulNFbiO8) | (stylized elf) | Elf silhouette cues: ears, head/neck read |
| 6 | [Lowpoly PS1 Style Human](https://www.youtube.com/watch?v=g40_nps24tY) | — | Joint loops, head/hands budget, flat readable shapes |
| 7 | [How To Make A 3D Character For Your Game (Blender→Unity)](https://www.youtube.com/watch?v=ogz-3r0EHKM) | — | T-pose + edge loops + Rigify / auto-weights mindset |
| 8 | [Modeling a body WITHOUT SCULPTING](https://www.youtube.com/watch?v=A1HKvwVMfKY) | — | Pure poly model from front/side refs |
| 9 | [Low Poly Character Creation in Blender Pt.1](https://www.youtube.com/watch?v=XGL5dw3sum0) | — | Mannequin proportions, delete half + Mirror |
| 10 | [How To Make And Rig A PS1 Style Character](https://www.youtube.com/watch?v=puwu9hZmQYI) | — | Flat texture, simple materials, game rig |

Supporting (materials): [2D-style / flat shading in Blender](https://www.youtube.com/watch?v=AtetvOEcZt8), [flat shaded renders](https://www.youtube.com/watch?v=4yEIrFWjTIM).

## House pipeline (Warcrest)

1. **Reference** — front T-pose image as canon (`purple_plate_elf_ref.jpg`).
2. **Poly model** — Mirror + primitives/extrusions; armor as separate shells; **empty hands**.
3. **Look** — matte Diffuse, **flat shade**, no PBR metal; silver filigree as albedo/trim meshes.
4. **Rig** — bind to Human Archer FREE `HumanF_Model.fbx` (proportions match pack clips).
5. **Animate** — bake Female pack: idle, bow idle, load/hold/release, walk, run.
6. **Export** — GLB + MP4 previews; do not weld weapons into the body mesh.

## Why not Meshy for this unit

Tutorials and our earlier tests agree: generators invent silhouette/props. Controllable poly modeling + pack anims is the reliable game path.
