# Reference card template

**Fill this before writing any Blender geometry.** Save as JSON
(`examples/<name>_card.json`). Every field below maps to a builder knob.

## Required fields

```json
{
  "name": "antler_elf",
  "style": "chibi_stylized",
  "pose": "tpose",
  "face_axis": "-Y",
  "up_axis": "Z",
  "palette": {
    "skin": "#a370cc",
    "skin_shadow": "#66428f",
    "hair": "#f0eef5",
    "antler": "#94663c",
    "armor": "#3f9e51",
    "armor_dark": "#246633",
    "gold": "#ebbd3d",
    "leather": "#663d21",
    "cloth": "#733d94",
    "eye": "#7ffa51",
    "gem": "#9947cc",
    "ink": "#12080f"
  },
  "emissive": {
    "eye": { "color": "#59ff38", "strength": 2.0 },
    "gem": { "color": "#bf4cff", "strength": 1.1 }
  },
  "proportions": {
    "total_height": 2.3,
    "head_height_frac": 0.45,
    "head_radius": 0.38,
    "shoulder_width": 0.64,
    "hip_width": 0.36,
    "limb_thickness": 0.09,
    "leg_height_frac": 0.23,
    "torso_height_frac": 0.27
  },
  "landmarks": [
    "pointed_ears",
    "white_braid_bun",
    "brown_deer_antlers",
    "gold_circlet_with_gem",
    "green_leaf_breastplates",
    "gold_trim",
    "purple_under_kilt",
    "leaf_kilt_plates",
    "leather_sash",
    "green_pauldrons",
    "armored_boots"
  ],
  "part_inventory": [
    "legs_skin", "boots", "hips_cloth", "kilt_leaves", "belt_gem",
    "torso_armor", "breast_leaves", "collar_gem", "sash", "neck",
    "pauldrons", "arms_tpose", "bracers", "hands",
    "head", "eyes", "brows", "mouth", "ears",
    "hair_back", "hair_bun_braids", "side_locks", "circlet", "antlers"
  ],
  "notes": "T-pose for later donor bind. Match leaf-armor Rimwalker hero reference."
}
```

## How to extract from a reference image

1. **Read the image** with the Read tool (vision). Do not rely on memory of a prior turn alone.
2. **Palette** — sample dominant region colors; prefer saturated mid-values (engine toon/lighting will lift them). Record hex, not adjectives (“purple”).
3. **Proportions** — estimate `head_height_frac` = head / total height from the front view. Chibi heroes often land 0.40–0.48.
4. **Landmarks** — list every silhouette-breaking feature a black cutout must show. If it is not on this list, the critique loop will not protect it.
5. **Part inventory (parts-first — preferred)** — list every discrete piece visible
   in the reference (limbs, pauldrons, cape, boots, hair, antlers, gems, weapon…).
   Prefer a structured `parts[]` array (see `parts-first.md`) over a flat string
   list. Build order: high-silhouette parts first; feet-up still helps z=0 grounding.
6. **Pose** — `tpose` (arms ±X) for rigging; `apose` or `action` only if the reference demands it and you are not binding yet.

## Optional fields

```json
{
  "donor_rig": "elf_warrior",
  "target_height_game": 62,
  "weapon": "none",
  "reference_images": ["path/or/url"],
  "forbid": ["realistic_fingers", "high_poly_sculpt", "mixamo_auto_rig"],
  "parts": [
    {
      "id": "pauldron_L",
      "category": "armor",
      "mirror": "pauldron_R",
      "palette_keys": ["armor", "gold"],
      "attach": { "parent": "shoulder_L", "socket": "pauldron" },
      "silhouette": "rounded leaf cup, gold rim",
      "priority": 1,
      "status": "pending"
    }
  ]
}
```

See `parts-first.md` for the full craft → assemble loop.

## Hard gate

If `palette`, `proportions.head_height_frac`, `landmarks`, or `part_inventory` is
missing → **stop** and complete the card. Do not “wing” a mesh.
