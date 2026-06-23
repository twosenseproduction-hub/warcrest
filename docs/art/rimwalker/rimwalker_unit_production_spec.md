# Rimwalker line units — production spec (match Aelindra idiom)

**Warcrest · 192px unit strips · same faction palette & Valdris pixel language as Aelindra**

Line units are **simpler than the hero** but must read as the same game: locked Warcrest palette, thick selective outline, stipple dither, top-down 3/4.

---

## Engine targets

| Unit ref | Role | Engine slot | Frame size |
|----------|------|-------------|------------|
| `root_tender` | Worker / gatherer | `pawn` | **192×192** |
| `bramble_archer` | Ranged | `archer` | **192×192** |
| `sapling_mystic` | Support / caster | `monk` | **192×192** |
| `thornguard` | Melee / tank | `warrior` | **192×192** |

Refs live in `assets/heroes/rimwalker/_refs/units/`. Shipped strips (future):

```
assets/units/rimwalker/
  RootTender_Idle.png    8 frames → 1536×192
  BrambleArcher_Idle.png 6 frames → 1152×192
  …
```

Frame counts can mirror Aurex Tiny Swords defaults in `src/ui.js` until Rimwalker-specific defs exist.

**Hero (Aelindra) = 256px.** Units = **192px** — ~25% less canvas; slightly less detail, same palette and outline rules.

---

## Locked palette (Aelindra ship — extracted from art)

Used in `sprite-tool.html` as **Palette Source → Aelindra**.  
Canonical list: `docs/art/rimwalker/aelindra_palette.json`

```
#110509 outline/shadow   #0a1013 cool shadow    #0b130c deep green shadow
#2a1412 bark shadow      #3c1f17 bark dark      #481e16 bark mid-dark
#59382d bark warm        #764126 skin/bark       #46534a leaf ash
#366431 leaf mid         #7f6657 skin mid       #a36940 amber accent
#95a17e pale cloth       #a9ac9e pale highlight
```

The older 11-color design-doc palette in `aseprite_production_spec.md` is superseded for pixelize passes — use this extracted set to match shipped Aelindra.

---

## Style rules (Aelindra parity)

1. **Camera** — high top-down 3/4; see crown/hood top, feet tucked under body
2. **Outline** — `#100018`, 1px selective (not blanket black on interior folds)
3. **Shading** — stipple/dither on round forms (skin, wood, leaves); not smooth gradients
4. **Proportions** — heavy chibi but **slightly less head mass** than Aelindra (line unit, not hero)
5. **Silhouette** — one readable prop per unit (shovel, bow, staff, mace+shield)

---

## Per-unit identity (from concept refs)

### Root Tender (`pawn`)
- Elder gatherer, dark skin, grey spiky hair, small branch antlers
- Leaf tunic, bark-textured arms, brown boots
- **Shovel** in right hand; **woven basket** of roots on back with amber gems
- Prompt anchor: *"Rimwalker root tender, gatherer worker, shovel and root basket, same palette as Aelindra faction"*

### Bramble Archer (`archer`)
- Hooded archer, face in shadow, amber forehead gem
- Green leaf pauldrons, wood breastplate, grey sash
- **Wooden bow** right hand, **quiver** left shoulder
- Prompt anchor: *"Rimwalker bramble archer, green hood, leaf armor, wooden bow, high top-down pixel"*

### Sapling Mystic (`monk`)
- Dark skin, black braided hair, pointed ears, **antler crown**
- Green leaf mantle, dark green tunic, belt pouches
- **Gnarled staff** with amber gem + green leaf tip
- Closest to Aelindra — simplify: no hero-scale cloak volume, smaller staff read
- Prompt anchor: *"Rimwalker sapling mystic support caster, antler crown, leaf cloak, wooden staff, chibi pixel"*

### Thornguard (`warrior`)
- Broad male, dark skin, beard, dreads, wooden helm with amber gem
- Full **bark plate armor**, green leaf skirt, teal cape
- **Spiked wooden mace** + round **leaf shield** with amber center
- Prompt anchor: *"Rimwalker thornguard tank, wooden bark armor, leaf shield, wooden mace, chunky chibi pixel"*

---

## Recommended pipeline (what worked for Aelindra)

### Path A — Pixel Lab (fastest directions + walk)
1. Key concept ref to transparent PNG (sprite-tool or flood fill)
2. Register character in [Pixel Lab](https://www.pixellab.ai/character) with:
   - View: **high top-down**
   - Frame: **192×192** (units) vs 256 for heroes
   - Reference: keyed south pose
3. Generate walk 4-dir strips; download per `aelindra/PIXELLAB.md` pattern
4. Touch up worst frames in Aseprite with locked palette

### Path B — Aseprite (ship quality)
1. New file **192×192**, transparent
2. Reference layer: scale `_refs/units/<unit>.png` to fit ~75% frame height
3. Pixel on top using **only** locked palette + Valdris dither
4. Duplicate → nudge for idle/run frames
5. Export horizontal strip, trim OFF, JSON OFF

### Path C — sprite-tool (palette pass on refs)
1. Import south pose (or 4-dir strip)
2. Click **Unit preset** (Warcrest palette, tuned grid)
3. Key → Pixelize → Export at **192px**
4. Import PNG into Aseprite as cleaned underpainting; hand-fix outlines/dither

---

## sprite-tool quick settings

| Target | Palette | Grid | Export scale |
|--------|---------|------|----------------|
| Line unit | Warcrest | 48–64 | **192px** |
| Hero (Aelindra) | Warcrest | **128** (was 64) | **256px** |

Higher grid = sharper before nearest upscale. If output still looks soft: **Hero · 256** preset → Edge Sensitivity **75+** → grid **128** → style **Crisp** → Preserve Lighting **on** → Pixelize → export.

**Soft / washed-out fix in sprite-tool:** Animation tab → import strip → **Apply Key** → **Hero · 256** (auto grid 128, edge 78) → **Pixelize** → export. Do not use Painterly or Hi-Fi for body clips.

---

## Checklist per unit

- [ ] 192×192 frames, transparent BG
- [ ] Locked palette only
- [ ] Reads next to Aelindra at battlefield zoom
- [ ] Idle strip exported horizontal, trim OFF
- [ ] Named `<Unit>_Idle.png` under `assets/units/rimwalker/` (when wired in engine)
