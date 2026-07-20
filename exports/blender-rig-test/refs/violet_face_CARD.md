# Face reference card — violet cape warrior (user PNG, 2026-07-20)

Source: user-attached full-body T-pose figurine render (light gray studio BG).
Binary not persisted on disk this turn — rebuild from vision landmarks below.
**If re-saving:** `exports/blender-rig-test/refs/violet_cape_warrior_REF.png`

## Face must-match (from attached image)

| Feature | Exact read |
|---|---|
| Head | Large chibi, slightly **squared** cranium, **broad jaw**, defined rounded chin — sculpted plastic, not a ball |
| Skin | Uniform muted lavender-purple, matte resin |
| Eyes | Large **circular** neon lime discs, **no pupils**, set **deep in sockets** |
| Lids/brows | Thick dark upper lids; brows angled **down to nose bridge** (stern) |
| Tattoos | Teal: **two thin curved cheek lines** per side (nose→ear); **small vertical** forehead mark only — not a bead cloud |
| Nose | Small, stylized, slightly upturned |
| Mouth | Small closed dark/near-black lips, grim |
| Ears | Long pointed, horizontal, slight back angle |
| Hair | Chunky wind-swept spikes up + toward character **right**; purple base + **gold** front/top spikes |
| Neck | Thick purple cowl / scarf (include in face crop) |

## Forbidden (previous fails)

- UV-sphere head as final form
- Vertical/almond egg eyes
- Floating bead/cube tattoo kits
- Sparse 5-cone hair
- Features buried inside mesh

## Form recipe (face)

`subdiv_cube_cage` → jaw/cheek/chin pads → socket bowls → circular eye plates →
brow ridges → continuous cheek curve ribbons → cone ears → multi-spike hair clumps
