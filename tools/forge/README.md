# Unit forge — Warcraft III `.mdx` → game-ready animated `.glb`

Recreate a WC3 unit **1:1** as a rigged, animated glTF that Warcrest's renderer
loads directly. Runs fully headless (no GUI Blender install) using the `bpy`
Python module + a headless Chromium for verification.

The first unit built with it is the **Rim Walker** elf archer
(`assets/models/rim_walker_mdx.glb`), converted from `Rim Walker ElfArcher.mdx`:
original mesh, skeleton, skinning, and the Stand / Walk / Attack / Death
sequences baked as `Idle` / `Walk` / `Attack` / `Death` clips.

## Pipeline

```
 .mdx ──parse──▶ Model ──build in Blender──▶ armature + skinned mesh + actions ──export──▶ .glb
        mdx_parse.py          mdx_to_glb.py                                    (Idle/Walk/Attack/Death)
```

| file | what it does |
|------|--------------|
| `mdx_parse.py` | Pure-Python parser for MDX v800: geosets (mesh + skin), node graph (bones/helpers), pivots, sequences, `GEOA` alpha, and per-node `KGTR/KGRT/KGSC` keyframe tracks. No Blender dependency. |
| `mdx_to_glb.py` | Builds the model in headless Blender (`bpy`): armature from the node hierarchy, one skinned mesh per material with rigid multi-bone weights from the MDX matrix groups, and one baked action per chosen sequence. Exports a single animated `.glb`. |
| `render_glb.py` | Headless Blender (Cycles) turntable render of a `.glb` for critique. |
| `render_gifs.py` | Renders animated GIFs of each clip through Warcrest's **own** three.js + `GLTFLoader` + `AnimationMixer` runtime. |
| `game_load_test.py` | Loads a `.glb` through the game's runtime path and reports that all configured clips resolve by name — an in-engine compatibility check. |

## Setup (once per fresh environment)

```bash
pip install "bpy==4.2.0" playwright pillow
# software GL so Blender can also render headlessly (export doesn't need it):
apt-get install -y libegl1 libgl1-mesa-dri
```

## Convert a model

```bash
python3 tools/forge/mdx_to_glb.py "path/to/Unit.mdx" assets/models/unit.glb
python3 tools/forge/render_gifs.py assets/models/unit.glb          # QA the clips
python3 tools/forge/game_load_test.py assets/models/unit.glb        # in-engine check
```

Then register it in `src/render3d.js`:

```js
registerUnitModel('elf:archer', { url: 'assets/models/rim_walker_mdx.glb?v=1',
  height: 60, yaw: 0, stripRootMotion: true, attackRate: 1.1,
  anims: { idle: 'Idle', walk: 'Walk', attack: 'Attack', death: 'Death' } });
```

Which MDX sequence feeds each game clip is configured by `CLIP_SOURCES` in
`mdx_to_glb.py` (first matching sequence name wins).

## Key correctness notes (learned the hard way)

- **Sequence-local sampling.** WC3 animation is per-sequence: within a clip only
  that clip's keyframes apply. Sampling globally leaks poses across sequences —
  e.g. `Bone_Root` only animates during *Death* (it topples to ~167°) and that
  key persists to the end of the timeline, so Walk/Attack/Stand would inherit the
  fallen root. `sample(track, t, window=(seq.start, seq.end))` fixes this; a bone
  with no in-window key stays at rest.
- **Bind = identity bones.** MDX vertices live in model space; bones are identity
  at rest and carry only animation deltas about their pivot. Rest bone = `T(pivot)`,
  `inverseBind = T(-pivot)`.
- **Axis + export.** Build native Z-up with a *properly parented* armature and set
  animation via local `matrix_basis`, then let Blender's exporter do the single
  uniform Z-up→Y-up flip (`export_yup=True`). Flat/disconnected bones or a
  hand-rolled axis flip desync the mesh from the animation and tip the model over.
- **Hidden geosets.** Gore / shadow / decay geosets are alpha-animated to zero
  during the living stance; they're dropped by sampling each geoset's `GEOA` alpha
  within the idle sequence.

## Limitations

- **Textures.** The uploaded `.mdx` references external `.blp` files that aren't
  included, so the mesh is untextured. UVs are preserved and each material gets a
  sensible placeholder colour (the game re-toon-shades it). Drop the decoded
  textures in and wire them to the materials for full fidelity.
- Attachments (weapon refs, etc.) and particle emitters are not converted; the bow
  and quiver here are part of the mesh geosets, so they come across for free.
