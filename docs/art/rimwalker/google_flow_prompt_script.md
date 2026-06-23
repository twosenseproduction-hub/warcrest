# Google Flow — Exact Prompt Script (every step)

**One fully built prompt per step.** Copy **Positive** and **Negative** from the same step — nothing else to assemble.

Post-process: [`animation_workflow_flowsheet.md`](./animation_workflow_flowsheet.md) · cheat sheet: [`google_flow_cheat_sheet.md`](./google_flow_cheat_sheet.md)

---

## How to use this doc

1. Open the step you are on.
2. Set **Flow** settings as listed (Image vs Video, aspect ratio, multiplier).
3. Upload **Reference** image if the step says so.
4. Copy **Positive** → paste into Flow positive field.
5. Copy **Negative** → paste into Flow negative field.
6. After all 4 directions: sprite-tool **Direction anchors** → Key → Unit · 192 or Hero · 256 → Pixelize → export.
7. After videos: ffmpeg square-pad to 1024² → sprite-tool **Animation frames** → Key → Pixelize → export.

**Do not skip south.** Every W/E/N and video step uses approved south as Image 1.

---

# LINE UNITS (192px export · Unit · 192 in sprite-tool)

Order per unit: **1.1 South → 1.2 West → 1.3 East → 1.4 North → 1.5 Walk (opt) → 1.6 Attack (opt)**

---

## 1. Root Tender

**Identity lock:** shovel **right hand** · root basket **on back** · branch antlers

### Step 1.1 — South anchor

| | |
|---|---|
| **Flow** | Image · **1:1** · **x3** (pick best of 3) |
| **Reference** | None |

**Positive:**
```
Rimwalker root tender, elder gatherer worker, dark weathered skin, grey spiky messy hair, small brown branch antlers on head, bark-textured wooden arms, green leaf scale tunic, brown leather collar with small amber gems, green leaf skirt, brown trousers, sturdy brown boots, wooden shovel in right hand blade down at side, tall woven root basket on back filled with gnarled roots and amber gems. Warcrest RTS pixel art, Valdris/Aelindra faction idiom: heavy chibi proportions, high top-down 3/4 camera (~45–60°), crown or antlers top readable, feet near frame bottom. Selective thick outline #110509 on outer silhouette only. Stipple/dither shading, no smooth gradients. Palette: warm bark browns, deep forest greens, pale cloth highlights, amber #a36940 on gems only — no blue, no gold. Chibi line unit, slightly less head mass than hero Aelindra. Character centered, fills 85–90% frame height. Flat solid magenta background #FF00FF, no shadow on backdrop. south facing. static idle anchor pose, neutral stance, both feet on baseline, no spell effects, no motion blur. Keep shovel in right hand always.
```

**Negative:**
```
photorealistic, 3D render, CGI, smooth gradients, airbrush, anime cel shading, blue sky, ocean blue, gold trim, yellow metal, bright white highlights, extra limbs, wrong prop hand, swapped hands, motion blur, depth of field, drop shadow on background, floor shadow on magenta, white background, green screen fringe, gradient background, text, watermark, logo, tiny character, cropped head, cropped feet, low angle, side-scroller camera, isometric without top-down read, particles from hands, spell effects from hands, glow aura, flame from hands, roots from hands, fire from hands, dynamic attack effects, projectile, magic beam from staff
```

### Step 1.2 — West

| | |
|---|---|
| **Flow** | Image · **1:1** · **x1** |
| **Reference** | Approved **south** PNG as Image 1 |

**Positive:**
```
Same character as Image 1 — Root Tender gatherer. Preserve identical outfit, palette, proportions, shovel in right hand, basket on back. Warcrest high top-down 3/4 pixel art, Valdris/Aelindra idiom, outline #110509, stipple dither, magenta #FF00FF background, 85–90% frame height. west facing, full side profile facing left. Neutral idle stance, feet on same baseline. Woven root basket on back is prominent read. Shovel in right hand (far hand) — mostly hidden behind body, only handle edge visible. Do not move shovel to left hand. No action pose.
```

**Negative:**
```
photorealistic, 3D render, CGI, smooth gradients, airbrush, anime cel shading, blue sky, ocean blue, gold trim, yellow metal, bright white highlights, extra limbs, wrong prop hand, swapped hands, motion blur, depth of field, drop shadow on background, floor shadow on magenta, white background, green screen fringe, gradient background, text, watermark, logo, tiny character, cropped head, cropped feet, low angle, side-scroller camera, isometric without top-down read, particles from hands, spell effects from hands, glow aura, flame from hands, roots from hands, fire from hands, dynamic attack effects, projectile, magic beam from staff
```

### Step 1.3 — East

| | |
|---|---|
| **Flow** | Image · **1:1** · **x1** |
| **Reference** | Approved **south** PNG as Image 1 |

**Positive:**
```
Same character as Image 1 — Root Tender gatherer. Preserve identical outfit, palette, proportions. Warcrest high top-down 3/4 pixel art, Valdris/Aelindra idiom, outline #110509, stipple dither, magenta #FF00FF background, 85–90% frame height. east facing, full side profile facing right. Neutral idle stance, feet on baseline. Wooden shovel in right hand (near hand) clearly visible — handle and blade at side in idle hold. Basket on back partially visible. Do not move shovel to left hand. No action pose.
```

**Negative:**
```
photorealistic, 3D render, CGI, smooth gradients, airbrush, anime cel shading, blue sky, ocean blue, gold trim, yellow metal, bright white highlights, extra limbs, wrong prop hand, swapped hands, motion blur, depth of field, drop shadow on background, floor shadow on magenta, white background, green screen fringe, gradient background, text, watermark, logo, tiny character, cropped head, cropped feet, low angle, side-scroller camera, isometric without top-down read, particles from hands, spell effects from hands, glow aura, flame from hands, roots from hands, fire from hands, dynamic attack effects, projectile, magic beam from staff
```

### Step 1.4 — North

| | |
|---|---|
| **Flow** | Image · **1:1** · **x1** |
| **Reference** | Approved **south** PNG as Image 1 |

**Positive:**
```
Same character as Image 1 — Root Tender gatherer. Preserve identical outfit, palette, basket, antlers from behind. Warcrest high top-down 3/4 pixel art, Valdris/Aelindra idiom, outline #110509, stipple dither, magenta #FF00FF background, 85–90% frame height. north facing, full back view. Neutral idle stance. Tall woven root basket on back is dominant silhouette — roots and amber gems visible. Shovel in right hand mostly hidden — thin shaft hint only. No face visible. No action pose.
```

**Negative:**
```
photorealistic, 3D render, CGI, smooth gradients, airbrush, anime cel shading, blue sky, ocean blue, gold trim, yellow metal, bright white highlights, extra limbs, wrong prop hand, swapped hands, motion blur, depth of field, drop shadow on background, floor shadow on magenta, white background, green screen fringe, gradient background, text, watermark, logo, tiny character, cropped head, cropped feet, low angle, side-scroller camera, isometric without top-down read, particles from hands, spell effects from hands, glow aura, flame from hands, roots from hands, fire from hands, dynamic attack effects, projectile, magic beam from staff
```

### Step 1.5 — Walk video (optional)

| | |
|---|---|
| **Flow** | Video · **4:3** (or 16:9) · **x1** |
| **Reference** | Approved **south** PNG as Image 1 |

**Positive:**
```
Same Root Tender as Image 1. south facing, low grounded walk cycle, 6–8 frames, shovel in right hand, basket on back stable, magenta #FF00FF background, high top-down 3/4 pixel art, Valdris/Aelindra palette, no spell effects, feet stay on baseline, subtle body bob only. Scale-to-fit inside a centered 1:1 square matching the south idle image — identical character scale as Image 1, same foot baseline, same headroom. Full body head to feet fits inside the square with margin; do not zoom in, do not scale up to fill the wide canvas, do not crop head or feet. Flat magenta #FF00FF letterbox bars on left and right of the 1:1 safe zone. No zoom change, no reframing between frames, no camera move.
```

**Negative:**
```
photorealistic, 3D render, CGI, smooth gradients, airbrush, anime cel shading, blue sky, ocean blue, gold trim, yellow metal, bright white highlights, extra limbs, wrong prop hand, swapped hands, motion blur, depth of field, drop shadow on background, floor shadow on magenta, white background, green screen fringe, gradient background, text, watermark, logo, tiny character, cropped head, cropped feet, low angle, side-scroller camera, isometric without top-down read, particles from hands, spell effects from hands, glow aura, flame from hands, zoom change, zoom to fill, scale up to fill, crop to fill, enlarged character, tight crop, character fills entire video width, camera pan, reframing between frames, crop change, running blur, spell VFX
```

### Step 1.6 — Attack video (optional)

| | |
|---|---|
| **Flow** | Video · **4:3** (or 16:9) · **x1** |
| **Reference** | Approved **south** PNG as Image 1 |

**Positive:**
```
Same Root Tender as Image 1. south facing, gatherer shovel strike animation, 4–6 frames, right hand shovel swing downward, basket stays on back, magenta #FF00FF, high top-down pixel art, no magic effects, grounded worker attack. Scale-to-fit inside a centered 1:1 square matching the south idle image — identical character scale as Image 1, same foot baseline, same headroom. Full body head to feet fits inside the square with margin; do not zoom in, do not scale up to fill the wide canvas, do not crop head or feet. Flat magenta #FF00FF letterbox bars on left and right of the 1:1 safe zone. No zoom change, no reframing between frames, no camera move.
```

**Negative:**
```
photorealistic, 3D render, CGI, smooth gradients, airbrush, anime cel shading, blue sky, ocean blue, gold trim, yellow metal, bright white highlights, extra limbs, wrong prop hand, swapped hands, motion blur, depth of field, drop shadow on background, floor shadow on magenta, white background, green screen fringe, gradient background, text, watermark, logo, tiny character, cropped head, cropped feet, low angle, side-scroller camera, isometric without top-down read, particles from hands, spell effects from hands, glow aura, flame from hands, zoom change, zoom to fill, scale up to fill, crop to fill, enlarged character, tight crop, character fills entire video width, camera pan, reframing between frames, crop change, lightning, magic beam
```

---

## 2. Bramble Archer

**Identity lock:** bow **right hand** · quiver **left shoulder** · hooded face · amber forehead gem

### Step 2.1 — South anchor

| | |
|---|---|
| **Flow** | Image · **1:1** · **x3** |
| **Reference** | None |

**Positive:**
```
Rimwalker bramble archer, hooded ranger, face in deep shadow under green leaf-textured hood, amber teardrop gem on forehead, dark skin glimpses, green leaf pauldrons, bronze vine breastplate, white-grey diagonal sash, bronze bracers, green leaf skirt over white under-tunic, brown boots, wooden bow in right hand at rest with grey bowstring, leather quiver with green-fletched arrows on left shoulder. Warcrest RTS pixel art, Valdris/Aelindra idiom: heavy chibi, high top-down 3/4 camera, selective outline #110509, stipple dither, palette warm browns and forest greens, amber accent on gem only — no blue, no gold. Chibi line unit. Character fills 85–90% frame height. Flat magenta #FF00FF background. south facing. static idle anchor, bow in right hand, quiver on left shoulder. No drawn bow, no arrow fired.
```

**Negative:**
```
photorealistic, 3D render, CGI, smooth gradients, airbrush, anime cel shading, blue sky, ocean blue, gold trim, yellow metal, bright white highlights, extra limbs, wrong prop hand, swapped hands, motion blur, depth of field, drop shadow on background, floor shadow on magenta, white background, green screen fringe, gradient background, text, watermark, logo, tiny character, cropped head, cropped feet, low angle, side-scroller camera, isometric without top-down read, particles from hands, spell effects from hands, glow aura, flame from hands, roots from hands, fire from hands, dynamic attack effects, projectile, magic beam from staff, arrow in flight, glowing bowstring
```

### Step 2.2 — West

| | |
|---|---|
| **Flow** | Image · **1:1** · **x1** |
| **Reference** | Approved **south** PNG as Image 1 |

**Positive:**
```
Same Bramble Archer as Image 1. Preserve hood, gem, bow right, quiver left. Warcrest top-down 3/4 pixel art, magenta #FF00FF, 85–90% height. west facing, full side profile left. Neutral idle. Leather quiver with green arrows prominent over shoulder. Bow in right hand (far hand) mostly hidden behind body. Do not swap bow to left hand.
```

**Negative:**
```
photorealistic, 3D render, CGI, smooth gradients, airbrush, anime cel shading, blue sky, ocean blue, gold trim, yellow metal, bright white highlights, extra limbs, wrong prop hand, swapped hands, motion blur, depth of field, drop shadow on background, floor shadow on magenta, white background, green screen fringe, gradient background, text, watermark, logo, tiny character, cropped head, cropped feet, low angle, side-scroller camera, isometric without top-down read, particles from hands, spell effects from hands, glow aura, flame from hands, roots from hands, fire from hands, dynamic attack effects, projectile, magic beam from staff
```

### Step 2.3 — East

| | |
|---|---|
| **Flow** | Image · **1:1** · **x1** |
| **Reference** | Approved **south** PNG as Image 1 |

**Positive:**
```
Same Bramble Archer as Image 1. Preserve hood, gem, palette. Warcrest top-down 3/4 pixel art, magenta #FF00FF, 85–90% height. east facing, full side profile right. Neutral idle. Wooden bow in right hand (near hand) clearly visible vertically at side. Quiver on back mostly hidden. Do not swap bow to left hand.
```

**Negative:**
```
photorealistic, 3D render, CGI, smooth gradients, airbrush, anime cel shading, blue sky, ocean blue, gold trim, yellow metal, bright white highlights, extra limbs, wrong prop hand, swapped hands, motion blur, depth of field, drop shadow on background, floor shadow on magenta, white background, green screen fringe, gradient background, text, watermark, logo, tiny character, cropped head, cropped feet, low angle, side-scroller camera, isometric without top-down read, particles from hands, spell effects from hands, glow aura, flame from hands, roots from hands, fire from hands, dynamic attack effects, projectile, magic beam from staff
```

### Step 2.4 — North

| | |
|---|---|
| **Flow** | Image · **1:1** · **x1** |
| **Reference** | Approved **south** PNG as Image 1 |

**Positive:**
```
Same Bramble Archer as Image 1. Preserve hood back, leaf pauldrons, quiver. Warcrest top-down 3/4 pixel art, magenta #FF00FF, 85–90% height. north facing, full back view. Neutral idle. Quiver with green fletching prominent on back. Bow in right hand — minimal hint only. No face visible.
```

**Negative:**
```
photorealistic, 3D render, CGI, smooth gradients, airbrush, anime cel shading, blue sky, ocean blue, gold trim, yellow metal, bright white highlights, extra limbs, wrong prop hand, swapped hands, motion blur, depth of field, drop shadow on background, floor shadow on magenta, white background, green screen fringe, gradient background, text, watermark, logo, tiny character, cropped head, cropped feet, low angle, side-scroller camera, isometric without top-down read, particles from hands, spell effects from hands, glow aura, flame from hands, roots from hands, fire from hands, dynamic attack effects, projectile, magic beam from staff
```

### Step 2.5 — Walk video (optional)

| | |
|---|---|
| **Flow** | Video · **4:3** (or 16:9) · **x1** |
| **Reference** | Approved **south** PNG as Image 1 |

**Positive:**
```
Same Bramble Archer as Image 1. south facing, hooded walk cycle 6–8 frames, bow in right hand, quiver stable on left shoulder, magenta background, top-down pixel art, no firing arrows. Scale-to-fit inside a centered 1:1 square matching the south idle image — identical character scale as Image 1, same foot baseline, same headroom. Full body head to feet fits inside the square with margin; do not zoom in, do not scale up to fill the wide canvas, do not crop head or feet. Flat magenta #FF00FF letterbox bars on left and right of the 1:1 safe zone. No zoom change, no reframing between frames, no camera move.
```

**Negative:**
```
photorealistic, 3D render, CGI, smooth gradients, airbrush, anime cel shading, blue sky, ocean blue, gold trim, yellow metal, bright white highlights, extra limbs, wrong prop hand, swapped hands, motion blur, depth of field, drop shadow on background, floor shadow on magenta, white background, green screen fringe, gradient background, text, watermark, logo, tiny character, cropped head, cropped feet, low angle, side-scroller camera, isometric without top-down read, particles from hands, spell effects from hands, glow aura, flame from hands, zoom change, zoom to fill, scale up to fill, crop to fill, enlarged character, tight crop, character fills entire video width, camera pan, reframing between frames, crop change, arrow in flight, glowing bowstring
```

### Step 2.6 — Attack video (optional)

| | |
|---|---|
| **Flow** | Video · **4:3** (or 16:9) · **x1** |
| **Reference** | Approved **south** PNG as Image 1 |

**Positive:**
```
Same Bramble Archer as Image 1. south facing, bow draw and release animation 4–6 frames, right hand bow, quiver on left shoulder, green arrow loose or drawn, magenta background, pixel art, no glowing magic. Scale-to-fit inside a centered 1:1 square matching the south idle image — identical character scale as Image 1, same foot baseline, same headroom. Full body head to feet fits inside the square with margin; do not zoom in, do not scale up to fill the wide canvas, do not crop head or feet. Flat magenta #FF00FF letterbox bars on left and right of the 1:1 safe zone. No zoom change, no reframing between frames, no camera move.
```

**Negative:**
```
photorealistic, 3D render, CGI, smooth gradients, airbrush, anime cel shading, blue sky, ocean blue, gold trim, yellow metal, bright white highlights, extra limbs, wrong prop hand, swapped hands, motion blur, depth of field, drop shadow on background, floor shadow on magenta, white background, green screen fringe, gradient background, text, watermark, logo, tiny character, cropped head, cropped feet, low angle, side-scroller camera, isometric without top-down read, particles from hands, spell effects from hands, glow aura, flame from hands, zoom change, zoom to fill, scale up to fill, crop to fill, enlarged character, tight crop, character fills entire video width, camera pan, reframing between frames, crop change, magic arrow trail, lightning
```

---

## 3. Sapling Mystic

**Identity lock:** staff **right hand** · antler crown · simpler cloak than Aelindra

### Step 3.1 — South anchor

| | |
|---|---|
| **Flow** | Image · **1:1** · **x3** |
| **Reference** | None |

**Positive:**
```
Rimwalker sapling mystic support caster, dark brown skin, large brown eyes, pointed elf ears, black braided hair, wooden antler crown with branch silhouette, green leaf mantle over shoulders, dark forest green tunic, cream V-neck collar, brown belt with two small tan leather pouches, green leaf skirt over cream trousers, brown boots, gnarled wooden staff in right hand with forked top, amber gem in crook, single small green leaf on staff. Warcrest RTS pixel art, Valdris/Aelindra idiom: heavy chibi, high top-down 3/4 camera, selective outline #110509, stipple dither, palette warm browns deep greens amber accent only — no blue, no gold. Chibi line unit, simpler cloak than hero Aelindra, smaller staff read. Character fills 85–90% frame height. Flat magenta #FF00FF. south facing. static idle anchor, staff in right hand, no spell effects, no glow, no particles.
```

**Negative:**
```
photorealistic, 3D render, CGI, smooth gradients, airbrush, anime cel shading, blue sky, ocean blue, gold trim, yellow metal, bright white highlights, extra limbs, wrong prop hand, swapped hands, motion blur, depth of field, drop shadow on background, floor shadow on magenta, white background, green screen fringe, gradient background, text, watermark, logo, tiny character, cropped head, cropped feet, low angle, side-scroller camera, isometric without top-down read, particles from hands, spell effects from hands, glow aura, flame from hands, roots from hands, fire from hands, dynamic attack effects, projectile, magic beam from staff
```

### Step 3.2 — West

| | |
|---|---|
| **Flow** | Image · **1:1** · **x1** |
| **Reference** | Approved **south** PNG as Image 1 |

**Positive:**
```
Same Sapling Mystic as Image 1. Preserve antlers, leaf mantle, staff in right hand, palette, proportions. Warcrest top-down 3/4 pixel art, magenta #FF00FF, 85–90% height. west facing, full side profile left. Neutral idle. Staff in right hand (far hand) mostly hidden — upper crook and amber gem may peek. Leaf mantle drapes on back shoulder. Do not relocate staff to left hand. No casting pose.
```

**Negative:**
```
photorealistic, 3D render, CGI, smooth gradients, airbrush, anime cel shading, blue sky, ocean blue, gold trim, yellow metal, bright white highlights, extra limbs, wrong prop hand, swapped hands, motion blur, depth of field, drop shadow on background, floor shadow on magenta, white background, green screen fringe, gradient background, text, watermark, logo, tiny character, cropped head, cropped feet, low angle, side-scroller camera, isometric without top-down read, particles from hands, spell effects from hands, glow aura, flame from hands, roots from hands, fire from hands, dynamic attack effects, projectile, magic beam from staff
```

### Step 3.3 — East

| | |
|---|---|
| **Flow** | Image · **1:1** · **x1** |
| **Reference** | Approved **south** PNG as Image 1 |

**Positive:**
```
Same Sapling Mystic as Image 1. Preserve identity, staff in right hand. Warcrest top-down 3/4 pixel art, magenta #FF00FF, 85–90% height. east facing, full side profile right. Neutral idle. Gnarled staff in right hand (near hand) clearly visible along body — shaft, crook, amber gem, leaf tip. Do not relocate staff to left hand. No casting pose.
```

**Negative:**
```
photorealistic, 3D render, CGI, smooth gradients, airbrush, anime cel shading, blue sky, ocean blue, gold trim, yellow metal, bright white highlights, extra limbs, wrong prop hand, swapped hands, motion blur, depth of field, drop shadow on background, floor shadow on magenta, white background, green screen fringe, gradient background, text, watermark, logo, tiny character, cropped head, cropped feet, low angle, side-scroller camera, isometric without top-down read, particles from hands, spell effects from hands, glow aura, flame from hands, roots from hands, fire from hands, dynamic attack effects, projectile, magic beam from staff
```

### Step 3.4 — North

| | |
|---|---|
| **Flow** | Image · **1:1** · **x1** |
| **Reference** | Approved **south** PNG as Image 1 |

**Positive:**
```
Same Sapling Mystic as Image 1. Preserve antlers from behind, leaf mantle, braided hair. Warcrest top-down 3/4 pixel art, magenta #FF00FF, 85–90% height. north facing, full back view. Neutral idle. Leaf mantle dominant on back. Staff in right hand — thin wooden shaft hint only at side. No full staff, no face. No casting.
```

**Negative:**
```
photorealistic, 3D render, CGI, smooth gradients, airbrush, anime cel shading, blue sky, ocean blue, gold trim, yellow metal, bright white highlights, extra limbs, wrong prop hand, swapped hands, motion blur, depth of field, drop shadow on background, floor shadow on magenta, white background, green screen fringe, gradient background, text, watermark, logo, tiny character, cropped head, cropped feet, low angle, side-scroller camera, isometric without top-down read, particles from hands, spell effects from hands, glow aura, flame from hands, roots from hands, fire from hands, dynamic attack effects, projectile, magic beam from staff
```

### Step 3.5 — Walk video (optional)

| | |
|---|---|
| **Flow** | Video · **4:3** (or 16:9) · **x1** |
| **Reference** | Approved **south** PNG as Image 1 |

**Positive:**
```
Same Sapling Mystic as Image 1. south facing, gentle walk cycle 6–8 frames, staff in right hand, antler crown stable, magenta background, top-down pixel art, no spell effects. Scale-to-fit inside a centered 1:1 square matching the south idle image — identical character scale as Image 1, same foot baseline, same headroom. Full body head to feet fits inside the square with margin; do not zoom in, do not scale up to fill the wide canvas, do not crop head or feet. Flat magenta #FF00FF letterbox bars on left and right of the 1:1 safe zone. No zoom change, no reframing between frames, no camera move.
```

**Negative:**
```
photorealistic, 3D render, CGI, smooth gradients, airbrush, anime cel shading, blue sky, ocean blue, gold trim, yellow metal, bright white highlights, extra limbs, wrong prop hand, swapped hands, motion blur, depth of field, drop shadow on background, floor shadow on magenta, white background, green screen fringe, gradient background, text, watermark, logo, tiny character, cropped head, cropped feet, low angle, side-scroller camera, isometric without top-down read, particles from hands, spell effects from hands, glow aura, flame from hands, zoom change, zoom to fill, scale up to fill, crop to fill, enlarged character, tight crop, character fills entire video width, camera pan, reframing between frames, crop change, roots from hands
```

### Step 3.6 — Attack / cast video (optional)

| | |
|---|---|
| **Flow** | Video · **4:3** (or 16:9) · **x1** |
| **Reference** | Approved **south** PNG as Image 1 |

**Positive:**
```
Same Sapling Mystic as Image 1. south facing, support caster staff cast animation 6 frames, right hand staff taps ground, body motion only — no root or leaf VFX at feet, no particles from hands. Magenta background, pixel art, communion with earth not fire magic. Scale-to-fit inside a centered 1:1 square matching the south idle image — identical character scale as Image 1, same foot baseline, same headroom. Full body head to feet fits inside the square with margin; do not zoom in, do not scale up to fill the wide canvas, do not crop head or feet. Flat magenta #FF00FF letterbox bars on left and right of the 1:1 safe zone. No zoom change, no reframing between frames, no camera move.
```

**Negative:**
```
photorealistic, 3D render, CGI, smooth gradients, airbrush, anime cel shading, blue sky, ocean blue, gold trim, yellow metal, bright white highlights, extra limbs, wrong prop hand, swapped hands, motion blur, depth of field, drop shadow on background, floor shadow on magenta, white background, green screen fringe, gradient background, text, watermark, logo, tiny character, cropped head, cropped feet, low angle, side-scroller camera, isometric without top-down read, particles from hands, spell effects from hands, glow aura, flame from hands, zoom change, zoom to fill, scale up to fill, crop to fill, enlarged character, tight crop, character fills entire video width, camera pan, reframing between frames, crop change, fire magic, beams from staff tip
```

---

## 4. Thornguard

**Identity lock:** mace **right hand** · shield **left hand** · bark armor · teal cape

### Step 4.1 — South anchor

| | |
|---|---|
| **Flow** | Image · **1:1** · **x3** |
| **Reference** | None |

**Positive:**
```
Rimwalker thornguard tank warrior, broad male dark skin, black beard, short black dreads, wooden helm circlet with amber gem and green leaves, thick green scarf, heavy bark plate pauldrons and breastplate, brown belt, green leaf skirt over grey loincloth, long dark teal-green tattered cape, bark greaves, brown boots, spiked wooden mace in right hand, large round wooden shield with vine weave and green leaf emblem with amber gem center in left hand. Warcrest RTS pixel art, Valdris/Aelindra idiom: chunky heavy chibi, high top-down 3/4 camera, outline #110509, stipple dither, palette bark browns forest greens amber on gems — no blue, no gold. Chibi line unit, widest silhouette. Character fills 85–90% frame height. Flat magenta #FF00FF. south facing. static idle anchor, mace right shield left. No action pose.
```

**Negative:**
```
photorealistic, 3D render, CGI, smooth gradients, airbrush, anime cel shading, blue sky, ocean blue, gold trim, yellow metal, bright white highlights, extra limbs, wrong prop hand, swapped hands, motion blur, depth of field, drop shadow on background, floor shadow on magenta, white background, green screen fringe, gradient background, text, watermark, logo, tiny character, cropped head, cropped feet, low angle, side-scroller camera, isometric without top-down read, particles from hands, spell effects from hands, glow aura, flame from hands, roots from hands, fire from hands, dynamic attack effects, projectile, magic beam from staff
```

### Step 4.2 — West

| | |
|---|---|
| **Flow** | Image · **1:1** · **x1** |
| **Reference** | Approved **south** PNG as Image 1 |

**Positive:**
```
Same Thornguard as Image 1. Preserve mace right, shield left, bark armor, cape. Warcrest top-down 3/4 pixel art, magenta #FF00FF, 85–90% height. west facing, full side profile left. Neutral idle. Round leaf shield in left hand (near hand) prominent — vine pattern, amber gem. Mace in right hand (far hand) mostly hidden. Do not swap weapons.
```

**Negative:**
```
photorealistic, 3D render, CGI, smooth gradients, airbrush, anime cel shading, blue sky, ocean blue, gold trim, yellow metal, bright white highlights, extra limbs, wrong prop hand, swapped hands, motion blur, depth of field, drop shadow on background, floor shadow on magenta, white background, green screen fringe, gradient background, text, watermark, logo, tiny character, cropped head, cropped feet, low angle, side-scroller camera, isometric without top-down read, particles from hands, spell effects from hands, glow aura, flame from hands, roots from hands, fire from hands, dynamic attack effects, projectile, magic beam from staff
```

### Step 4.3 — East

| | |
|---|---|
| **Flow** | Image · **1:1** · **x1** |
| **Reference** | Approved **south** PNG as Image 1 |

**Positive:**
```
Same Thornguard as Image 1. Preserve armor, cape, weapon hands. Warcrest top-down 3/4 pixel art, magenta #FF00FF, 85–90% height. east facing, full side profile right. Neutral idle. Spiked wooden mace in right hand (near hand) prominent. Shield in left hand (far hand) mostly hidden behind body. Do not swap weapons.
```

**Negative:**
```
photorealistic, 3D render, CGI, smooth gradients, airbrush, anime cel shading, blue sky, ocean blue, gold trim, yellow metal, bright white highlights, extra limbs, wrong prop hand, swapped hands, motion blur, depth of field, drop shadow on background, floor shadow on magenta, white background, green screen fringe, gradient background, text, watermark, logo, tiny character, cropped head, cropped feet, low angle, side-scroller camera, isometric without top-down read, particles from hands, spell effects from hands, glow aura, flame from hands, roots from hands, fire from hands, dynamic attack effects, projectile, magic beam from staff
```

### Step 4.4 — North

| | |
|---|---|
| **Flow** | Image · **1:1** · **x1** |
| **Reference** | Approved **south** PNG as Image 1 |

**Positive:**
```
Same Thornguard as Image 1. Preserve cape, pauldrons, helm from behind. Warcrest top-down 3/4 pixel art, magenta #FF00FF, 85–90% height. north facing, full back view. Neutral idle. Long teal cape dominant. Mace and shield mostly hidden — thin rim hints only. No face visible.
```

**Negative:**
```
photorealistic, 3D render, CGI, smooth gradients, airbrush, anime cel shading, blue sky, ocean blue, gold trim, yellow metal, bright white highlights, extra limbs, wrong prop hand, swapped hands, motion blur, depth of field, drop shadow on background, floor shadow on magenta, white background, green screen fringe, gradient background, text, watermark, logo, tiny character, cropped head, cropped feet, low angle, side-scroller camera, isometric without top-down read, particles from hands, spell effects from hands, glow aura, flame from hands, roots from hands, fire from hands, dynamic attack effects, projectile, magic beam from staff
```

### Step 4.5 — Walk video (optional)

| | |
|---|---|
| **Flow** | Video · **4:3** (or 16:9) · **x1** |
| **Reference** | Approved **south** PNG as Image 1 |

**Positive:**
```
Same Thornguard as Image 1. south facing, heavy tank walk 6–8 frames, mace right shield left, cape sways slightly, magenta background, pixel art, grounded stomp gait. Scale-to-fit inside a centered 1:1 square matching the south idle image — identical character scale as Image 1, same foot baseline, same headroom. Full body head to feet fits inside the square with margin; do not zoom in, do not scale up to fill the wide canvas, do not crop head or feet. Flat magenta #FF00FF letterbox bars on left and right of the 1:1 safe zone. No zoom change, no reframing between frames, no camera move.
```

**Negative:**
```
photorealistic, 3D render, CGI, smooth gradients, airbrush, anime cel shading, blue sky, ocean blue, gold trim, yellow metal, bright white highlights, extra limbs, wrong prop hand, swapped hands, motion blur, depth of field, drop shadow on background, floor shadow on magenta, white background, green screen fringe, gradient background, text, watermark, logo, tiny character, cropped head, cropped feet, low angle, side-scroller camera, isometric without top-down read, particles from hands, spell effects from hands, glow aura, flame from hands, zoom change, zoom to fill, scale up to fill, crop to fill, enlarged character, tight crop, character fills entire video width, camera pan, reframing between frames, crop change, lightning
```

### Step 4.6 — Attack video (optional)

| | |
|---|---|
| **Flow** | Video · **4:3** (or 16:9) · **x1** |
| **Reference** | Approved **south** PNG as Image 1 |

**Positive:**
```
Same Thornguard as Image 1. south facing, mace overhead strike animation 4–6 frames, right hand mace, left hand shield braced, magenta background, pixel art, no lightning effects. Scale-to-fit inside a centered 1:1 square matching the south idle image — identical character scale as Image 1, same foot baseline, same headroom. Full body head to feet fits inside the square with margin; do not zoom in, do not scale up to fill the wide canvas, do not crop head or feet. Flat magenta #FF00FF letterbox bars on left and right of the 1:1 safe zone. No zoom change, no reframing between frames, no camera move.
```

**Negative:**
```
photorealistic, 3D render, CGI, smooth gradients, airbrush, anime cel shading, blue sky, ocean blue, gold trim, yellow metal, bright white highlights, extra limbs, wrong prop hand, swapped hands, motion blur, depth of field, drop shadow on background, floor shadow on magenta, white background, green screen fringe, gradient background, text, watermark, logo, tiny character, cropped head, cropped feet, low angle, side-scroller camera, isometric without top-down read, particles from hands, spell effects from hands, glow aura, flame from hands, zoom change, zoom to fill, scale up to fill, crop to fill, enlarged character, tight crop, character fills entire video width, camera pan, reframing between frames, crop change, lightning, magic effects
```

---

# AELINDRA ASHVEIL (256px export · Hero · 256 in sprite-tool)

**Core rule:** Power from **ground at destination** — not from her hands.

Order: **5.1–5.4 idle 4-dir → 6.1 idle loop → 6.2–6.5 run → 7.1–7.6 combat clips**

---

## 5. Aelindra — idle anchors

### Step 5.1 — South idle

| | |
|---|---|
| **Flow** | Image · **1:1** · **x3** |
| **Reference** | None |

**Positive:**
```
Aelindra Ashveil, oldest Rimwalker Tendkeeper, Sylhen, dark brown skin, black braided hair, pointed ears, wooden antler crown, layered green leaf cloak and mantle, dark green tunic, cream undergarment, brown belt, green leaf skirt, brown boots, gnarled wooden staff with amber gem and green leaf tip held in right hand. Warcrest RTS pixel art, Valdris hero idiom: heavy chibi heroic proportions, high top-down 3/4 camera (~45–60°), selective thick outline #110509, stipple dither shading, no smooth gradients. Palette: warm bark browns, deep forest greens, pale cloth highlights, amber #a36940 on gems and power moments only — no blue, no gold. Hero scale, full Tendkeeper presence, 256px export target. Character fills 85–90% frame height. Flat magenta #FF00FF background. south facing. static idle anchor, staff planted or held vertical, breathing pose, no spell effects, no glow, no particles from hands.
```

**Negative:**
```
photorealistic, 3D render, CGI, smooth gradients, airbrush, anime cel shading, blue sky, ocean blue, gold trim, yellow metal, bright white highlights, extra limbs, wrong prop hand, swapped hands, motion blur, depth of field, drop shadow on background, floor shadow on magenta, white background, green screen fringe, gradient background, text, watermark, logo, tiny character, cropped head, cropped feet, low angle, side-scroller camera, isometric without top-down read, particles from hands, spell effects from hands, glow aura, flame from hands, roots from hands, fire from hands, dynamic attack effects, projectile, magic beam from staff
```

### Step 5.2 — West idle

| | |
|---|---|
| **Flow** | Image · **1:1** · **x1** |
| **Reference** | Approved **south** PNG as Image 1 |

**Positive:**
```
Same Aelindra Ashveil as Image 1. Preserve antler crown, leaf cloak, staff in right hand, hero palette and proportions. Valdris hero pixel style, magenta #FF00FF, 85–90% height. west facing, full side profile left. Neutral idle. Staff in right hand (far hand) partially hidden. Leaf mantle on back shoulder. Do not swap staff hand.
```

**Negative:**
```
photorealistic, 3D render, CGI, smooth gradients, airbrush, anime cel shading, blue sky, ocean blue, gold trim, yellow metal, bright white highlights, extra limbs, wrong prop hand, swapped hands, motion blur, depth of field, drop shadow on background, floor shadow on magenta, white background, green screen fringe, gradient background, text, watermark, logo, tiny character, cropped head, cropped feet, low angle, side-scroller camera, isometric without top-down read, particles from hands, spell effects from hands, glow aura, flame from hands, roots from hands, fire from hands, dynamic attack effects, projectile, magic beam from staff
```

### Step 5.3 — East idle

| | |
|---|---|
| **Flow** | Image · **1:1** · **x1** |
| **Reference** | Approved **south** PNG as Image 1 |

**Positive:**
```
Same Aelindra Ashveil as Image 1. Preserve identity and staff in right hand. Valdris hero pixel style, magenta #FF00FF, 85–90% height. east facing, full side profile right. Neutral idle. Staff in right hand (near hand) clearly visible with amber gem and leaf tip. Do not swap staff hand.
```

**Negative:**
```
photorealistic, 3D render, CGI, smooth gradients, airbrush, anime cel shading, blue sky, ocean blue, gold trim, yellow metal, bright white highlights, extra limbs, wrong prop hand, swapped hands, motion blur, depth of field, drop shadow on background, floor shadow on magenta, white background, green screen fringe, gradient background, text, watermark, logo, tiny character, cropped head, cropped feet, low angle, side-scroller camera, isometric without top-down read, particles from hands, spell effects from hands, glow aura, flame from hands, roots from hands, fire from hands, dynamic attack effects, projectile, magic beam from staff
```

### Step 5.4 — North idle

| | |
|---|---|
| **Flow** | Image · **1:1** · **x1** |
| **Reference** | Approved **south** PNG as Image 1 |

**Positive:**
```
Same Aelindra Ashveil as Image 1. Preserve antlers, leaf cloak from behind, braided hair. Valdris hero pixel style, magenta #FF00FF, 85–90% height. north facing, full back view. Neutral idle. Leaf mantle dominant. Staff in right hand — minimal shaft hint only. No face.
```

**Negative:**
```
photorealistic, 3D render, CGI, smooth gradients, airbrush, anime cel shading, blue sky, ocean blue, gold trim, yellow metal, bright white highlights, extra limbs, wrong prop hand, swapped hands, motion blur, depth of field, drop shadow on background, floor shadow on magenta, white background, green screen fringe, gradient background, text, watermark, logo, tiny character, cropped head, cropped feet, low angle, side-scroller camera, isometric without top-down read, particles from hands, spell effects from hands, glow aura, flame from hands, roots from hands, fire from hands, dynamic attack effects, projectile, magic beam from staff
```

---

## 6. Aelindra — locomotion clips

### Step 6.1 — Idle breathing loop (8 frames)

| | |
|---|---|
| **Flow** | Video · **4:3** (or 16:9) · **x1** |
| **Reference** | Approved **south** PNG as Image 1 |
| **Export** | `Aelindra_Idle.png` · 8 frames |

**Positive:**
```
Same Aelindra as Image 1. south facing, subtle idle breathing animation 8 frames, staff planted, leaf cloak gentle sway, antler crown stable, magenta #FF00FF, Valdris hero pixel art, no spell effects, minimal motion, loopable. Scale-to-fit inside a centered 1:1 square matching the south idle image — identical character scale as Image 1, same foot baseline, same headroom. Full body head to feet fits inside the square with margin; do not zoom in, do not scale up to fill the wide canvas, do not crop head or feet. Flat magenta #FF00FF letterbox bars on left and right of the 1:1 safe zone. No zoom change, no reframing between frames, no camera move.
```

**Negative:**
```
photorealistic, 3D render, CGI, smooth gradients, airbrush, anime cel shading, blue sky, ocean blue, gold trim, yellow metal, bright white highlights, extra limbs, wrong prop hand, swapped hands, motion blur, depth of field, drop shadow on background, floor shadow on magenta, white background, green screen fringe, gradient background, text, watermark, logo, tiny character, cropped head, cropped feet, low angle, side-scroller camera, isometric without top-down read, particles from hands, spell effects from hands, glow aura, flame from hands, VFX spawning from hands, roots erupting from staff tip, fire from hands, beams from staff tip, baked VFX, root wall, segmented roots, soil seam, environmental effects in frame, zoom change, zoom to fill, scale up to fill, crop to fill, enlarged character, tight crop, character fills entire video width, camera pan, reframing between frames, crop change
```

### Step 6.2 — Run south (8 frames)

| | |
|---|---|
| **Flow** | Video · **4:3** (or 16:9) · **x1** |
| **Reference** | Approved **south** PNG as Image 1 |
| **Export** | `Aelindra_Run_South.png` · 8 frames |

**Positive:**
```
Same Aelindra as Image 1. south facing, grounded run cycle 8 frames, longer stride and faster leg turnover than walk, staff in right hand, leaf cloak follows body motion, magenta background, Valdris hero pixel art, feet on baseline, purposeful run not sprint blur. Scale-to-fit inside a centered 1:1 square matching the south idle image — identical character scale as Image 1, same foot baseline, same headroom. Full body head to feet fits inside the square with margin; do not zoom in, do not scale up to fill the wide canvas, do not crop head or feet. Flat magenta #FF00FF letterbox bars on left and right of the 1:1 safe zone. No zoom change, no reframing between frames, no camera move.
```

**Negative:**
```
photorealistic, 3D render, CGI, smooth gradients, airbrush, anime cel shading, blue sky, ocean blue, gold trim, yellow metal, bright white highlights, extra limbs, wrong prop hand, swapped hands, motion blur, depth of field, drop shadow on background, floor shadow on magenta, white background, green screen fringe, gradient background, text, watermark, logo, tiny character, cropped head, cropped feet, low angle, side-scroller camera, isometric without top-down read, particles from hands, spell effects from hands, glow aura, flame from hands, VFX spawning from hands, roots erupting from staff tip, fire from hands, beams from staff tip, baked VFX, root wall, segmented roots, soil seam, environmental effects in frame, zoom change, zoom to fill, scale up to fill, crop to fill, enlarged character, tight crop, character fills entire video width, camera pan, reframing between frames, crop change, running blur
```

### Step 6.3 — Run west (8 frames, optional 4-dir)

| | |
|---|---|
| **Flow** | Video · **4:3** (or 16:9) · **x1** |
| **Reference** | Approved **south** PNG as Image 1 |
| **Export** | `Aelindra_Run_West.png` · 8 frames |

**Positive:**
```
Same Aelindra as Image 1. west facing, grounded run cycle 8 frames, longer stride and faster leg turnover than walk, staff in right hand, leaf cloak follows body, magenta background, Valdris hero pixel art, feet on baseline. Scale-to-fit inside a centered 1:1 square matching the south idle image — identical character scale as Image 1, same foot baseline, same headroom. Full body head to feet fits inside the square with margin; do not zoom in, do not scale up to fill the wide canvas, do not crop head or feet. Flat magenta #FF00FF letterbox bars on left and right of the 1:1 safe zone. No zoom change, no reframing between frames, no camera move.
```

**Negative:**
```
photorealistic, 3D render, CGI, smooth gradients, airbrush, anime cel shading, blue sky, ocean blue, gold trim, yellow metal, bright white highlights, extra limbs, wrong prop hand, swapped hands, motion blur, depth of field, drop shadow on background, floor shadow on magenta, white background, green screen fringe, gradient background, text, watermark, logo, tiny character, cropped head, cropped feet, low angle, side-scroller camera, isometric without top-down read, particles from hands, spell effects from hands, glow aura, flame from hands, VFX spawning from hands, roots erupting from staff tip, fire from hands, beams from staff tip, baked VFX, root wall, segmented roots, soil seam, environmental effects in frame, zoom change, zoom to fill, scale up to fill, crop to fill, enlarged character, tight crop, character fills entire video width, camera pan, reframing between frames, crop change, running blur
```

### Step 6.4 — Run east (8 frames, optional 4-dir)

| | |
|---|---|
| **Flow** | Video · **4:3** (or 16:9) · **x1** |
| **Reference** | Approved **south** PNG as Image 1 |
| **Export** | `Aelindra_Run_East.png` · 8 frames |

**Positive:**
```
Same Aelindra as Image 1. east facing, grounded run cycle 8 frames, longer stride and faster leg turnover than walk, staff in right hand, leaf cloak follows body, magenta background, Valdris hero pixel art, feet on baseline. Scale-to-fit inside a centered 1:1 square matching the south idle image — identical character scale as Image 1, same foot baseline, same headroom. Full body head to feet fits inside the square with margin; do not zoom in, do not scale up to fill the wide canvas, do not crop head or feet. Flat magenta #FF00FF letterbox bars on left and right of the 1:1 safe zone. No zoom change, no reframing between frames, no camera move.
```

**Negative:**
```
photorealistic, 3D render, CGI, smooth gradients, airbrush, anime cel shading, blue sky, ocean blue, gold trim, yellow metal, bright white highlights, extra limbs, wrong prop hand, swapped hands, motion blur, depth of field, drop shadow on background, floor shadow on magenta, white background, green screen fringe, gradient background, text, watermark, logo, tiny character, cropped head, cropped feet, low angle, side-scroller camera, isometric without top-down read, particles from hands, spell effects from hands, glow aura, flame from hands, VFX spawning from hands, roots erupting from staff tip, fire from hands, beams from staff tip, baked VFX, root wall, segmented roots, soil seam, environmental effects in frame, zoom change, zoom to fill, scale up to fill, crop to fill, enlarged character, tight crop, character fills entire video width, camera pan, reframing between frames, crop change, running blur
```

### Step 6.5 — Run north (8 frames, optional 4-dir)

| | |
|---|---|
| **Flow** | Video · **4:3** (or 16:9) · **x1** |
| **Reference** | Approved **south** PNG as Image 1 |
| **Export** | `Aelindra_Run_North.png` · 8 frames |

**Positive:**
```
Same Aelindra as Image 1. north facing, grounded run cycle 8 frames, longer stride and faster leg turnover than walk, staff in right hand, leaf cloak follows body, magenta background, Valdris hero pixel art, feet on baseline. Scale-to-fit inside a centered 1:1 square matching the south idle image — identical character scale as Image 1, same foot baseline, same headroom. Full body head to feet fits inside the square with margin; do not zoom in, do not scale up to fill the wide canvas, do not crop head or feet. Flat magenta #FF00FF letterbox bars on left and right of the 1:1 safe zone. No zoom change, no reframing between frames, no camera move.
```

**Negative:**
```
photorealistic, 3D render, CGI, smooth gradients, airbrush, anime cel shading, blue sky, ocean blue, gold trim, yellow metal, bright white highlights, extra limbs, wrong prop hand, swapped hands, motion blur, depth of field, drop shadow on background, floor shadow on magenta, white background, green screen fringe, gradient background, text, watermark, logo, tiny character, cropped head, cropped feet, low angle, side-scroller camera, isometric without top-down read, particles from hands, spell effects from hands, glow aura, flame from hands, VFX spawning from hands, roots erupting from staff tip, fire from hands, beams from staff tip, baked VFX, root wall, segmented roots, soil seam, environmental effects in frame, zoom change, zoom to fill, scale up to fill, crop to fill, enlarged character, tight crop, character fills entire video width, camera pan, reframing between frames, crop change, running blur
```

---

## 7. Aelindra — combat clips

**Body-only rule (Steps 7.1–7.4):** Generate **character silhouette and motion only** — no baked spell VFX in the body strip. Root cracks, walls, ripples, ash columns, and particles are **separate VFX steps** (7.1a+) and composited in-engine at `impactFrame`. Magenta background stays clean except the character.

**Overhead / raised-staff casts (Ashfall):** South idle fills **85–90%** of the frame — a true vertical staff raise will clip the 1:1 safe zone. Use the strategies in [Cast-safe framing](#cast-safe-framing-overhead-staff-raises) below; for Step 7.4 prefer `cast_ashfall.png` as Image 1, not south idle alone.

### Cast-safe framing (overhead staff raises)

When a cast needs the staff **higher** than idle, pick **one** approach (do not mix zoom + reframe):

| Approach | When to use | What to do |
|----------|-------------|------------|
| **A. Cast pose ref as Image 1** | Best for Ashfall | Upload `_refs/cast_ashfall.png` as Image 1. Peak pose already fits the square. Animate *from* planted idle *to* that contained peak — staff stays diagonal across body, tip **below** antler crown top line. |
| **B. Foreshortened “vertical”** | Flow ignores ref | Top-down 3/4: staff raised **toward camera** (chest-high, angled inward). Reads as “raised” without extending above the silhouette column. |
| **C. Cast-safe scale anchor** | Ref unavailable | One-time Image step at **~75% frame height**, feet on lower third, **15% empty magenta above antler crown** at peak. Use that PNG as Image 1 for the cast video only — do not match south idle pixel scale on this clip. |
| **D. Hand-pixel peak first** | Video keeps clipping | Draw frame 9 (peak) + frame 0 in Aseprite with margin, tween in between. sprite-tool locks all frames to **frame 0 bbox**. |

**Hard rules for overhead casts:**
- Staff tip and antler crown must never touch the top edge of the 1:1 safe zone.
- **No camera move** — if the staff needs more room, **lower character scale** or **change staff angle**, not zoom.
- Tremble/release motion is **body + staff wobble**, not raising the tip higher each frame.
- Verify: overlay peak frame on south idle — feet baseline aligned; only acceptable difference is smaller scale (approach C) or diagonal staff (A/B).

**Step 7.4 negative must include:** `staff tip above frame, staff extending past top edge, vertical staff taller than antlers, cropped staff tip, cropped antlers`

### Step 7.1 — Root Lash / basic attack (4 frames)

| | |
|---|---|
| **Flow** | Video · **4:3** (or 16:9) · **x1** |
| **Reference** | **south** PNG as Image 1 · optional `attack_root_lash.png` |
| **Export** | `Aelindra_Attack.png` · 4 frames · impactFrame **2** |

**Positive:**
```
Same Aelindra Ashveil as Image 1. south facing, Root Lash staff attack animation 4 frames. Right hand drives staff base downward to tap ground on impact frame — power comes from ground not hands. No roots erupting from staff tip. Body motion only: wind-up, strike tap, recovery, return idle. No baked spell VFX — clean magenta ground only; root crack VFX added in separate strip later. Valdris hero pixel art, magenta #FF00FF, same scale as Image 1. No glow aura, no particles from hands. Scale-to-fit inside a centered 1:1 square matching the south idle image — identical character scale as Image 1, same foot baseline, same headroom. Full body head to feet fits inside the square with margin; do not zoom in, do not scale up to fill the wide canvas, do not crop head or feet. Flat magenta #FF00FF letterbox bars on left and right of the 1:1 safe zone. No zoom change, no reframing between frames, no camera move.
```

**Negative:**
```
photorealistic, 3D render, CGI, smooth gradients, airbrush, anime cel shading, blue sky, ocean blue, gold trim, yellow metal, bright white highlights, extra limbs, wrong prop hand, swapped hands, motion blur, depth of field, drop shadow on background, floor shadow on magenta, white background, green screen fringe, gradient background, text, watermark, logo, tiny character, cropped head, cropped feet, low angle, side-scroller camera, isometric without top-down read, particles from hands, spell effects from hands, glow aura, flame from hands, VFX spawning from hands, roots erupting from staff tip, fire from hands, beams from staff tip, roots from hands, baked VFX, ground crack, root tendrils, soil eruption, spell particles at feet, environmental effects in frame, zoom change, zoom to fill, scale up to fill, crop to fill, enlarged character, tight crop, character fills entire video width, camera pan, reframing between frames, crop change
```

### Step 7.1a — Root Lash VFX (6 frames)

| | |
|---|---|
| **Flow** | Video · **4:3** · **x1** |
| **Reference** | Optional `assets/heroes/rimwalker/aelindra/_refs/attack_root_lash.png` for palette · south idle for scale context only |
| **Export** | `RootLash_VFX.png` · **6 frames** · anchor **target feet** · spawns on body `impactFrame` **2** |

**Positive:**
```
Root Lash VFX only, no character body, no face, no staff, no hands, no arms, no legs. Warcrest RTS pixel art, Valdris/Aelindra faction idiom: high top-down 3/4 camera (~45–60°), ground plane at bottom third of frame. 6-frame attack effect under half a second: frame 1 tiny soil pucker and hairline ground crack at bottom center; frame 2 crack splits outward along ground plane; frame 3 thin segmented bark-brown root tendrils lash upward at shallow angle and strike with amber tip flicker on impact only; frame 4 peak strike with small leaf chip snap; frame 5 roots snap back and retract into soil; frame 6 faint ground scar then empty. Thin fast whip roots, not a tree trunk, not a vertical column, not a wall. Segmented knuckle joints, stipple/dither shading on round forms, selective thick outline #110509 on outer silhouette only. Palette locked: bark browns #2a1412 #59382d #764126, leaf greens #0b130c #366431 #46534a, amber accent #a36940 on power moments only — no blue, no gold, no sky fill. Flat solid magenta background #FF00FF, no shadow on backdrop, no floor plane, no vignette. Scale-to-fit inside centered 1:1 square — effect anchored bottom center, same world scale as Aelindra south idle foot baseline. Magenta letterbox on sides. No zoom change, no reframing between frames, no camera move.
```

**Negative:**
```
character body, face, staff, hands, arms, legs, hair, cloak silhouette, photorealistic, 3D render, CGI, smooth gradients, airbrush, anime cel shading, blue sky, ocean blue, cyan, gold trim, yellow metal, bright white highlights, motion blur, depth of field, drop shadow on background, floor shadow on magenta, white background, green screen fringe, gradient background, text, watermark, logo, particles from hands, spell effects from hands, glow aura, flame from hands, fire from staff tip, beam from hands, projectile from hands, roots erupting from staff tip, roots from hands, magic laser, horizontal beam weapon, thick tree trunk, ent wall, vertical root column, slow 2 second grow, photoreal lighting, lens flare, bloom, zoom change, zoom to fill, scale up to fill, crop to fill, enlarged effect, tiny unreadable effect, camera pan, reframing between frames, crop change
```

### Step 7.2 — Thornwall cast (6 frames)

| | |
|---|---|
| **Flow** | Video · **4:3** (or 16:9) · **x1** |
| **Reference** | **south** PNG as Image 1 · optional `cast_thornwall.png` |
| **Export** | `Aelindra_Thornwall.png` · 6 frames · impactFrame **3** |

**Positive:**
```
Same Aelindra as Image 1. south facing, Thornwall defensive cast animation 6 frames. Staff pressed firmly into ground, defensive wall cast posture, grounded and still — not flailing. Body motion only: press, hold, release — no root wall, no soil seam, no segmented roots visible in frame. Power travels into soil along a line in front of her, not from hands. Valdris hero pixel art, magenta #FF00FF. No fire, no beams from staff tip, no baked spell VFX. Scale-to-fit inside a centered 1:1 square matching the south idle image — identical character scale as Image 1, same foot baseline, same headroom. Full body head to feet fits inside the square with margin; do not zoom in, do not scale up to fill the wide canvas, do not crop head or feet. Flat magenta #FF00FF letterbox bars on left and right of the 1:1 safe zone. No zoom change, no reframing between frames, no camera move.
```

**Negative:**
```
photorealistic, 3D render, CGI, smooth gradients, airbrush, anime cel shading, blue sky, ocean blue, gold trim, yellow metal, bright white highlights, extra limbs, wrong prop hand, swapped hands, motion blur, depth of field, drop shadow on background, floor shadow on magenta, white background, green screen fringe, gradient background, text, watermark, logo, tiny character, cropped head, cropped feet, low angle, side-scroller camera, isometric without top-down read, particles from hands, spell effects from hands, glow aura, flame from hands, VFX spawning from hands, roots erupting from staff tip, fire from hands, beams from staff tip, baked VFX, root wall, segmented roots, soil seam, environmental effects in frame, zoom change, zoom to fill, scale up to fill, crop to fill, enlarged character, tight crop, character fills entire video width, camera pan, reframing between frames, crop change
```

### Step 7.2a — Thornwall VFX (8 frames) · *generate after body strip approved*

| | |
|---|---|
| **Flow** | Video · **4:3** · **x1** |
| **Reference** | Optional `cast_thornwall.png` for palette |
| **Export** | `Thornwall_VFX.png` · **8 frames** · anchor **wall line** · spawns on body `impactFrame` **3** |

**Positive:**
```
Thornwall VFX only, no character body, no face, no staff, no hands. Warcrest pixel art, Valdris idiom: soil seam opens along ground line at bottom third, segmented bark-brown root wall erupts upward in knuckle joints, holds briefly, settles. Stipple dither, outline #110509, palette bark browns and leaf greens, amber accent #a36940 on power moments only. Flat magenta #FF00FF background. Scale-to-fit inside centered 1:1 square — wall anchored along ground line, same world scale as Aelindra south idle. Magenta letterbox on sides. No zoom change, no reframing between frames, no camera move.
```

**Negative:**
```
character body, face, staff, hands, arms, legs, hair, cloak silhouette, photorealistic, 3D render, CGI, smooth gradients, particles from hands, fire from staff tip, beam from hands, horizontal laser, zoom change, zoom to fill, crop to fill, camera pan, reframing between frames
```

### Step 7.3 — Verdant Pulse cast (5 frames)

| | |
|---|---|
| **Flow** | Video · **4:3** (or 16:9) · **x1** |
| **Reference** | **south** PNG as Image 1 · optional `cast_verdant.png` |
| **Export** | `Aelindra_Verdant.png` · 5 frames · impactFrame **2** |

**Positive:**
```
Same Aelindra as Image 1. south facing, Verdant Pulse cast animation 5 frames. Posture collapse and communion with earth — knees bend slightly, staff lowers, communion not aggression. Body motion only — no ground ripple, no green wash, no expanding ring at feet. Valdris hero pixel art, magenta #FF00FF. No healing light from hands, no baked spell VFX. Scale-to-fit inside a centered 1:1 square matching the south idle image — identical character scale as Image 1, same foot baseline, same headroom. Full body head to feet fits inside the square with margin; do not zoom in, do not scale up to fill the wide canvas, do not crop head or feet. Flat magenta #FF00FF letterbox bars on left and right of the 1:1 safe zone. No zoom change, no reframing between frames, no camera move.
```

**Negative:**
```
photorealistic, 3D render, CGI, smooth gradients, airbrush, anime cel shading, blue sky, ocean blue, gold trim, yellow metal, bright white highlights, extra limbs, wrong prop hand, swapped hands, motion blur, depth of field, drop shadow on background, floor shadow on magenta, white background, green screen fringe, gradient background, text, watermark, logo, tiny character, cropped head, cropped feet, low angle, side-scroller camera, isometric without top-down read, particles from hands, spell effects from hands, glow aura, flame from hands, VFX spawning from hands, roots erupting from staff tip, fire from hands, beams from staff tip, healing light from hands, baked VFX, ground ripple, green wash, expanding ring, environmental effects in frame, zoom change, zoom to fill, scale up to fill, crop to fill, enlarged character, tight crop, character fills entire video width, camera pan, reframing between frames, crop change
```

### Step 7.3a — Verdant Pulse VFX (7 frames) · *generate after body strip approved*

| | |
|---|---|
| **Flow** | Video · **4:3** · **x1** |
| **Reference** | Optional `cast_verdant.png` for palette |
| **Export** | `Verdant_VFX.png` · **7 frames** · anchor **her feet** · spawns on body `impactFrame` **2** |

**Positive:**
```
Verdant Pulse VFX only, no character body, no face, no staff, no hands. Low ground ripple expanding outward from bottom center, subtle green wash on ground plane, sparse leaf motes — quiet communion not explosion. Warcrest pixel art, Valdris palette, stipple dither, outline #110509. Flat magenta #FF00FF background. Scale-to-fit inside centered 1:1 square — origin at bottom center foot line. Magenta letterbox on sides. No zoom change, no reframing between frames, no camera move.
```

**Negative:**
```
character body, face, staff, hands, arms, legs, hair, cloak silhouette, photorealistic, 3D render, CGI, smooth gradients, healing light from hands, particles from hands, fire, beam, zoom change, zoom to fill, crop to fill, camera pan, reframing between frames
```

### Step 7.4 — The Ashfall ultimate (10 frames)

| | |
|---|---|
| **Flow** | Video · **4:3** (or 16:9) · **x1** |
| **Reference** | **`cast_ashfall.png` as Image 1** (cast-safe peak pose) · south idle for identity check only |
| **Export** | `Aelindra_Ashfall.png` · 10 frames · impactFrame **9** |

**Positive:**
```
Same Aelindra as Image 1. south facing, The Ashfall ultimate cast animation 10 frames. Slow sequence: staff rises from planted/low angle to chest-high diagonal across body — staff tip stays INSIDE the 1:1 safe zone, never above antler crown top line, never extending past frame top. NOT a straight vertical staff above the head. Body trembles with memory of catastrophe, release on final frame drops staff forward. Body motion only — no ash, no silence effect, no ground darkening, no column erupting from earth. Weight and grief in motion, not heroic pose, no fire from hands. Valdris hero pixel art, magenta #FF00FF. Ashfall VFX composited later at cast point in separate strip. Scale-to-fit inside a centered 1:1 square — match Image 1 cast-safe scale and foot baseline; visible magenta margin above antlers and staff tip at peak frame. Full body head to feet inside square; do not zoom in, do not scale up to fill the wide canvas, do not crop head, feet, staff tip, or antlers. Flat magenta #FF00FF letterbox bars on left and right of the 1:1 safe zone. No zoom change, no reframing between frames, no camera move.
```

**Negative:**
```
photorealistic, 3D render, CGI, smooth gradients, airbrush, anime cel shading, blue sky, ocean blue, gold trim, yellow metal, bright white highlights, extra limbs, wrong prop hand, swapped hands, motion blur, depth of field, drop shadow on background, floor shadow on magenta, white background, green screen fringe, gradient background, text, watermark, logo, tiny character, cropped head, cropped feet, cropped staff tip, cropped antlers, staff tip above frame, staff extending past top edge, vertical staff taller than antlers, low angle, side-scroller camera, isometric without top-down read, particles from hands, spell effects from hands, glow aura, flame from hands, VFX spawning from hands, roots erupting from staff tip, fire from hands, beams from staff tip, heroic pose, baked VFX, ash column, ash cloud, ground darkening, silence effect, soil eruption, environmental effects in frame, zoom change, zoom to fill, scale up to fill, crop to fill, enlarged character, tight crop, character fills entire video width, camera pan, reframing between frames, crop change
```

### Step 7.4a — The Ashfall VFX (12 frames) · *generate after body strip approved*

| | |
|---|---|
| **Flow** | Video · **4:3** · **x1** |
| **Reference** | Optional `cast_ashfall.png` for palette |
| **Export** | `Ashfall_VFX.png` · **12 frames** · anchor **radius center** · spawns on body `impactFrame` **9** |

**Positive:**
```
The Ashfall VFX only, no character body, no face, no staff, no hands. Catastrophic ash and silence at cast point on ground — ground darkens, trembles, brief stillness, ash column erupts from earth not sky, then settles. Warcrest pixel art, Valdris palette, weight and grief not heroic explosion, stipple dither, outline #110509. Flat magenta #FF00FF background. Scale-to-fit inside centered 1:1 square — column origin bottom center at cast point. Magenta letterbox on sides. No zoom change, no reframing between frames, no camera move.
```

**Negative:**
```
character body, face, staff, hands, arms, legs, hair, cloak silhouette, photorealistic, 3D render, CGI, smooth gradients, fire from sky, meteor, heroic pose, particles from hands, beam from hands, zoom change, zoom to fill, crop to fill, camera pan, reframing between frames
```

### Step 7.5 — Hit reaction (2 frames)

| | |
|---|---|
| **Flow** | Video · **4:3** (or 16:9) · **x1** |
| **Reference** | Approved **south** PNG as Image 1 |
| **Export** | `Aelindra_Hit.png` · 2 frames |

**Positive:**
```
Same Aelindra as Image 1. south facing, hit flinch animation 2 frames, tiny shudder only, feet planted, no knockback, staff still in right hand, magenta background, pixel art. Scale-to-fit inside a centered 1:1 square matching the south idle image — identical character scale as Image 1, same foot baseline, same headroom. Full body head to feet fits inside the square with margin; do not zoom in, do not scale up to fill the wide canvas, do not crop head or feet. Flat magenta #FF00FF letterbox bars on left and right of the 1:1 safe zone. No zoom change, no reframing between frames, no camera move.
```

**Negative:**
```
photorealistic, 3D render, CGI, smooth gradients, airbrush, anime cel shading, blue sky, ocean blue, gold trim, yellow metal, bright white highlights, extra limbs, wrong prop hand, swapped hands, motion blur, depth of field, drop shadow on background, floor shadow on magenta, white background, green screen fringe, gradient background, text, watermark, logo, tiny character, cropped head, cropped feet, low angle, side-scroller camera, isometric without top-down read, particles from hands, spell effects from hands, glow aura, flame from hands, VFX spawning from hands, roots erupting from staff tip, fire from hands, beams from staff tip, knockback, zoom change, zoom to fill, scale up to fill, crop to fill, enlarged character, tight crop, character fills entire video width, camera pan, reframing between frames, crop change
```

### Step 7.6 — Death (6 frames)

| | |
|---|---|
| **Flow** | Video · **4:3** (or 16:9) · **x1** |
| **Reference** | Approved **south** PNG as Image 1 |
| **Export** | `Aelindra_Death.png` · 6 frames |

**Positive:**
```
Same Aelindra as Image 1. south facing, death animation 6 frames, sinks and settles into earth, staff lowers, leaf cloak drapes, hold last frame, magenta background, pixel art, no explosion. Scale-to-fit inside a centered 1:1 square matching the south idle image — identical character scale as Image 1, same foot baseline, same headroom. Full body head to feet fits inside the square with margin; do not zoom in, do not scale up to fill the wide canvas, do not crop head or feet. Flat magenta #FF00FF letterbox bars on left and right of the 1:1 safe zone. No zoom change, no reframing between frames, no camera move.
```

**Negative:**
```
photorealistic, 3D render, CGI, smooth gradients, airbrush, anime cel shading, blue sky, ocean blue, gold trim, yellow metal, bright white highlights, extra limbs, wrong prop hand, swapped hands, motion blur, depth of field, drop shadow on background, floor shadow on magenta, white background, green screen fringe, gradient background, text, watermark, logo, tiny character, cropped head, cropped feet, low angle, side-scroller camera, isometric without top-down read, particles from hands, spell effects from hands, glow aura, flame from hands, VFX spawning from hands, roots erupting from staff tip, fire from hands, beams from staff tip, explosion, zoom change, zoom to fill, scale up to fill, crop to fill, enlarged character, tight crop, character fills entire video width, camera pan, reframing between frames, crop change
```

---

## Production order checklist

### All 4 line units (repeat per unit)

- [ ] Step X.1 South → approve → save ref
- [ ] Step X.2 West (ref: south)
- [ ] Step X.3 East (ref: south)
- [ ] Step X.4 North (ref: south)
- [ ] sprite-tool Direction tab → Key → Unit · 192 → Pixelize → export
- [ ] Optional Step X.5 walk · Step X.6 attack → ffmpeg pad → Animation tab

### Aelindra

- [ ] 5.1–5.4 idle 4-dir
- [ ] 6.1 idle loop · 6.2–6.5 run (4-dir)
- [ ] 7.1 Root Lash **body** → 7.1a Root Lash VFX → 7.2 Thornwall **body** → 7.2a Thornwall VFX → 7.3 Verdant **body** → 7.3a Verdant VFX → 7.4 Ashfall **body** → 7.4a Ashfall VFX → 7.5 Hit → 7.6 Death
- [ ] sprite-tool Hero · 256 → export strips to `assets/heroes/rimwalker/aelindra/`

---

## Consistency traps

| Trap | Fix |
|------|-----|
| Character tiny in frame | Re-run same step — prompts already include 85–90% height |
| Staff/bow/mace swapped hands | Re-run step verbatim — negative includes `swapped hands` |
| Video wider than image anchors | Step uses **scale-to-fit** framing line · ffmpeg pad to 1024² · compare frame 1 to south still |
| Video character zoomed to fill wide frame | Re-run video step — do not use "fills frame" language; negative includes `zoom to fill, crop to fill` |
| Aelindra roots from staff tip | Use Aelindra video steps — negative includes `roots erupting from staff tip` |
| North looks smaller than south | sprite-tool scale-matches to south bbox after export |
| Staff raise clips out of 1:1 frame (Ashfall) | Use `cast_ashfall.png` as Image 1 · chest-high diagonal staff, not vertical above head · see [Cast-safe framing](#cast-safe-framing-overhead-staff-raises) · or cast-safe anchor at ~75% height |

---

*Script version 2 — every step is self-contained. Matches `google_flow_cheat_sheet.md` and `aelindra_animation_manifest.md`.*
