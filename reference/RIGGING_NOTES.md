# Rigging notes — techniques distilled from reference videos

Source tutorials the team pulled in (all Blender-focused; we adapt the *principles*
to our in-browser `bone-rig.html` tool, which is not Blender).

## The one rule every tutorial repeats
**Place bones near the CENTER of the mesh volume, not on the surface.**
Even influence → smooth deformation → little/no weight painting. This is the single
biggest quality lever for low-poly characters.
→ Implemented: tap-to-place sinks the joint to the ray entry/exit midpoint
  ("Center joints in mesh volume" toggle); the example skeleton snaps its spine to
  the true vertex centroid at each height.

## Automatic weights = our envelope auto-skin
"Parent with Automatic Weights" (Blender) is the same family as our distance-based
envelope skinning. For low-poly it "works out of the box" *if* placement is good;
weight painting only fixes the last 10%.
→ Our automated stand-in for weight-painting: adjacency-limited smooth skin (a vertex
  can only be influenced by its nearest bone + that bone's parent/children — no
  cross-body bleed, which was causing the "snake constriction" pinch).

## Rigid / "cut at joints"
Binding each vertex 100% to one bone = solid parts that swing without bending.
This is the 3D equivalent of the 2D sprite workflow (each limb on its own layer).
→ Implemented: "Rigid — cut at joints" toggle.

## Clothing / separate meshes (rig-with-clothes video)
- Deforming clothing (shirt/tabard): parent with **Empty Groups**, then **transfer
  weights from the body** (Data Transfer → Vertex Groups). Clothing inherits the
  body's skin → no clipping.  [NOT yet in our tool — add when a multi-part model needs it]
- Rigid props (hair/eyes/helmet/pauldrons): **Parent to Bone** (no weights).
  → We already do this for weapons (attachWeapon/attachments). Generalize to any prop.
- "Heat" error on auto-weights = loose/duplicate verts → Merge by Distance / Weld.
  (Our distance skinning doesn't have this failure mode, so no weld step needed.)

## Hands — closeable grip
The example skeleton includes a `*_Fingers` "mitt" bone (past the wrist) and a
`*_Thumb` bone per hand. Curl the Fingers bone about its **X axis** (~1.5 rad) to
close the hand into a grip — useful for wrapping the hand around a weapon haft.
Low-poly hands are mittens, so this is a whole-hand curl, not per-finger articulation.

## Bone placement details (Rigify video)
- Character faces +Y, apply all transforms (scale 1 / rot 0 / loc 0). Our GLBs bake
  world transforms in the tool before skinning.
- Slight pre-bend at knees/elbows so the joint knows which way to fold.
  → Implemented: example-skeleton knees nudged slightly forward.
- Symmetry: build one side with `.L` names, mirror to `.R`.  [NOT yet — good QoL add]
- IK/FK control bones (leg_ik, hand_ik, pole targets): a Blender *authoring* convenience.
  Our runtime uses simple FK pose overlays, so we don't need IK in-engine — but a
  mirror + control-bone layer would speed up posing in the tool.

## "Mold / blueprint" QA (our own idea)
Keep the original mesh frozen in rest shape as a translucent ghost behind the skinned
mesh. Any pose that clips a limb through the body shows as the skinned mesh poking
past the ghost silhouette.
→ Implemented: "Ghost the original as a mold" toggle.

## Wings / tails / capes / banners — FUTURE (dragon-wing video)
Membrane modeling + cloth sim is Blender-only and out of scope for now. The reusable
trick: **one control bone + Copy-Rotation constraints down a chain** makes the whole
chain curl together from a single control. Applies to wings, tails, capes, tabards,
banners, bowstrings — cheap secondary motion without keying every bone.

## Reality check on our current assets
The Tripo bodies (e.g. rim_archer) are a SINGLE fused, watertight mesh — one primitive,
one material, no separable limbs. So the clean "cut into parts" approach can't come for
free from mesh structure; the geometry would have to be split. For a single blob, the
best results come from: centered bones + adjacency smooth skin + posing arms with
clearance (A-pose, not flush) — verified against the ghost mold.
