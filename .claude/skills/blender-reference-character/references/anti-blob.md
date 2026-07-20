# Anti-blob / silhouette-match (REQUIRED for reference copies)

The #1 failure mode of LLM Blender builders is the **toy blob**: UV-spheres for
heads, cylinders for limbs, cubes for cape — silhouette vaguely right, form
language wrong. This doc teaches how to **copy the reference’s shapes**, not
approximate them with primitives.

## What “blob” means (ban these as final forms)

| Blob habit | Why it fails | Prefer instead |
|---|---|---|
| Head = UV sphere | Kills jaw, cheek, helmet planes | Lathed profile / sculpted icosphere with face planes |
| Cape = flat cube | Reads as a backplate | Multi-panel flared sheets + thickness + fold edges |
| Hair = random cones on a ball | No clump architecture | Designed spike groups matching ref clumps + parting |
| Armor = sphere “pads” | Loses plate language | Beveled plates, inset panels, rim loops, gem housings |
| Limb = constant-radius cylinder | No taper / muscle / armor break | Profile limb (radii along length) or capsule + plate overlays |

**Rule:** if a part’s outline could be any character’s, it is a blob. Stop and rebuild
that part from a **silhouette trace**.

## Teachable loop (add after parts inventory)

### 1. Crop the reference per part
From the full T-pose (or front/side), mentally or file-crop:
`head`, `hair`, `pauldron`, `torso`, `bracer`, `belt+skirt`, `greave`, `cape`, `weapon`.

Each part build must answer: **“Does this match THIS crop’s outline?”**

### 2. Silhouette card (required fields per priority-1 part)

```json
{
  "id": "pauldron_L",
  "silhouette_trace": {
    "front": "wide cup, flat top ridge, gold rim ellipse, gem on peak",
    "side": "overhangs upper arm ~30%, thickness ~0.6 of width",
    "forbidden_blobs": ["uv_sphere_alone"],
    "form_recipe": ["beveled_plate", "inset_panel", "torus_rim", "gem_housing"]
  }
}
```

`form_recipe` is the **allowed primitive vocabulary** for that part. If you reach
for something not on the list, you are blobbing.

### 3. Measure before modeling
For each priority-1 part, estimate from the reference (fractions of head height `H`):

- width / height / depth ratios  
- attach point relative to sockets  
- overhang past the body  

Write numbers on the card (`width_frac_head`, etc.). Guessing without ratios → blob.

### 4. Build with profiles, not primitives-as-final
Preferred cookbook (see also Blender Secrets double-subdiv for hard-surface):

- **Lathe / profile limb** — list of `[radius, z]` rings (torso, legs, arms, boots)  
- **Beveled plate** — cube → bevel → inset → extrude rim (armor, bracers)  
- **Edge-loop sharpening** — Ctrl+R loops close to corners (plate edges, greaves)  
- **Double-subdiv cage** (Simple + Catmull-Clark) for organic hard-surface blockouts  
- **Panel cuts** — bevel edge loop + Alt+S for armor detail  

Spheres/cylinders are **scaffolds only**; apply bevels/insets/profiles before approval.

### 5. Part critique gate (stronger than palette match)

A part is **not approved** until:

1. Front outline matches the crop (landmarks present)  
2. Side thickness matches (not a pancake or balloon)  
3. No single-primitive silhouette  
4. Shared palette materials only  
5. Form recipe followed  

Score `form_language` 0–2 in critique. If `form_language=0`, fix that part before
assembly polish.

### 6. Full-body silhouette check
After assemble, compare **black-silhouette** mental test to the reference:
cape flare, hair spikes, pauldron width, greave bulk, ear length. If the black
shape wouldn’t be recognized as the same character, continue parts-first fixes.

## Reference overlay (when possible)

In Blender, put the reference as a background image / image plane on front (−Y)
and side (+X) cameras. Scale so feet→head matches `total_height`. Model against
the overlay. Headless agents should still **simulate** this by writing measured
ratios and checking renders against the ref with the Read tool.

## One-knob refine examples (anti-blob)

| Miss | Knob |
|---|---|
| Head is a ball | Replace with lathed jaw profile + cheek planes |
| Cape is a slab | Split into yoke / mid / hem panels + side wings + thickness |
| Hair is nubs | Design 5–9 clumps with explicit directions from ref |
| Pauldron is a melon | Beveled plate + rim torus + inset gem housing |
| Greave is a tube | Boot last + knee cup + shin plate + toe cap as separate plates |

## What does NOT teach better copies

- “Make it higher quality” with no silhouette notes  
- Adding subdivision to a sphere (smoother blob)  
- Recoloring a blob  
- Assembling before priority-1 parts pass `form_language≥1`  

## Tie-in

- Parts-first (`parts-first.md`) = *what* to build  
- Anti-blob (this file) = *how* each part must look like the reference  
- Meshy/Tripo analogue = stage order; still remesh/rebuild for form language
