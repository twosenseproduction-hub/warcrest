# Parts-first construction (preferred)

Build characters the way a kit is built: **scan → inventory parts → craft each
part to quality → assemble on a shared skeleton/socket layout**.

This beats “one blob from the whole silhouette.” It matches how stylized game
rosters are authored (Bitgem / Thronefall floating mitts, separate pauldrons,
prop weapons) and how Tripo’s **segmentation** product feature thinks about
editable parts — except we author the parts on purpose.

## Why this works

| Whole-character blob | Parts-first |
|---|---|
| Budget/attention diluted across everything | Each part gets a focused pass |
| Hard to tell what failed in critique | Critique one part at a time |
| Pauldrons/cape/boots get smeared into torso | Accessories stay crisp |
| Reuse is zero | Boots/pauldrons/weapons become kit pieces |
| Rigging fights fused topology | Parts parent to bones cleanly |

## Mandatory order

### 1. Scan the reference (vision)
Read the image. List **every discrete visual object**, not just body regions:

```
body:        head, neck, torso, upper_arm_L/R, forearm_L/R, hand_L/R,
             thigh_L/R, shin_L/R, foot_L/R
armor:       pauldron_L/R, breastplate, bracer_L/R, greave_L/R, belt
cloth:       cape, skirt/kilt, sash, hood
hair:        bun, side_locks, bangs
headgear:    circlet, antlers, helm, ears (if exaggerated props)
accessories: gem_chest, gem_belt, weapon, quiver, pouches
```

If it reads as a separate material *or* a separate silhouette bump, it is a part.

### 2. Write `parts[]` on the card (hard gate)
Do not model until each part has:

```json
{
  "parts": [
    {
      "id": "pauldron_L",
      "category": "armor",
      "mirror": "pauldron_R",
      "palette_keys": ["armor", "gold"],
      "attach": { "parent": "shoulder_L", "socket": "pauldron" },
      "silhouette": "rounded leaf cup over shoulder, gold rim",
      "priority": 1
    }
  ]
}
```

`priority`: craft high-silhouette parts first (head, hair volume, pauldrons, weapon,
boots) before micro detail (gems, stitching).

### 3. Shared assembly contract (before crafting)
Lock once for the whole kit:

- Pose: T-pose, face −Y, feet z=0  
- Units / total height from card proportions  
- Joint sockets: `hip`, `shoulder`, `elbow`, `wrist`, `knee`, `ankle`, `neck`, `head`  
- Mirror rule: `_L` / `_R` share one builder with `side=±1`  
- Shared materials table from card palette (do not invent per-part hexes)

### 4. Craft one part at a time
For each part:

1. Build **only that part** (or L/R pair) in isolation or muted ghost body  
2. Render a tight crop / turntable of the part  
3. Critique vs the reference crop for **that** landmark  
4. One-knob refine until it matches  
5. Mark `status: approved` on the card  

Do **not** start the next priority band until the current band’s silhouette parts
are approved (e.g. finish head+hair+antlers before belt gems).

### 5. Assemble
Parent/join parts to sockets. Re-render **full-body** front + ¾ + side.
Critique **assembly only**: gaps, scale mismatches, z-fighting, missing parts,
proportion drift. Fix with socket offsets / part scale — not by remaking everything.

### 6. Optional fuse
For export you may `join` into one mesh, or keep separate objects for rigging
(recommended for donors: skin body + rigid armor parented to bones).

## Critique scopes

| Scope | When | Score |
|---|---|---|
| **Part** | After each part build | Shape · palette · landmark match for that part only |
| **Assembly** | After combine | Socket fit · relative scale · full silhouette · no missing inventory ids |
| **Hero** | Final | Full `critique-checklist.md` |

## Part categories (Warcrest defaults)

- `body` — skinned, follows donor bones  
- `armor` — often rigid, parent to bone (pauldron → shoulder)  
- `cloth` — skirt/cape; may be skinned lightly or rigid flaps  
- `hair` — usually rigid or head-parented  
- `accessory` — gems, belts, weapons (weapon → `hand_R`)  
- `face` — eyes/brows/mouth as head children  

## Anti-patterns

- One script that emits the whole hero with no per-part approval  
- “Pauldrons” as a bump on the torso mesh with no separate id  
- Different gold hex on boots vs circlet (break shared palette)  
- Assembling before high-priority parts are approved  
- Scaling the whole character to hide one oversized part  

## Tie-in to Meshy / Tripo

Their strength is whole-mesh hallucination; their weakness is muddy accessories.
Parts-first is how we **beat** them on stylized kit readability while still using
their stage order (white parts → assemble → materials → remesh/rig).
