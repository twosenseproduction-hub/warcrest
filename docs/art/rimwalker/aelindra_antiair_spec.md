# Aelindra — Canopy Snare (anti-air basic attack)

**Problem:** Root Lash taps the **ground at the target's feet** — fine for ground units, wrong for flyers.  
**Solution:** Auto-swap to **Canopy Snare** when the target is `airborne`. Power still comes from the **earth below the flyer**, not from Aelindra's hands.

---

## Design

| | Root Lash (ground) | Canopy Snare (air) |
|---|-------------------|-------------------|
| **When** | Default vs ground units & buildings | Auto when `target.airborne === true` |
| **Body motion** | Staff base taps down | Staff points down at soil **beneath** flyer |
| **VFX** | `RootLash_VFX.png` — cracks at target feet | `CanopySnare_VFX.png` — roots erupt **upward** from ground patch under flyer |
| **Clip** | `attack` → `Aelindra_Attack.png` | `attack_air` → `Aelindra_Attack_Air.png` |
| **Frames** | 4 · impactFrame **2** | 4 · impactFrame **2** |
| **Damage** | Same as hero `dmg` (14) | Same |
| **Range** | 160 | 160 |

**Lore line:** *"The roots remember height. They only need soil beneath."*

---

## Engine work (not built yet)

The game has **no `airborne` flag** today. When air units ship:

```js
// unit spec (future sky unit)
airborne: true,
altitude: 48,   // visual draw offset only — combat still uses x/y

// heroes.js — aelindra
attacks: {
  ground: 'attack',      // Root Lash
  air: 'attack_air',     // Canopy Snare
},

// systems.js — before fire()
function pickHeroAttackClip(u, target) {
  if (u.heroId === 'aelindra' && target.airborne) return 'attack_air';
  return 'attack';
}
```

**Targeting rule:** Root Lash cannot acquire `airborne` targets; Canopy Snare cannot prefer ground (only fires when target is airborne). Player right-clicks air unit → Canopy Snare.

---

## Art assets

| File | Frames | Strip | Notes |
|------|--------|-------|-------|
| `Aelindra_Attack_Air.png` | 4 | 1024×256 | Body only — staff aims at ground under target |
| `CanopySnare_VFX.png` | 6 | 1536×256 | Vertical root column + leaf snap at apex |

**Ref pose:** staff extended downward at 45°, eyes on sky target, feet planted.

---

## Google Flow — Canopy Snare body (Step 7.1b)

| | |
|---|---|
| **Flow** | Video · **4:3** · **x1** |
| **Reference** | South idle as Image 1 · optional sky-target pose ref |

**Positive:**
```
Same Aelindra Ashveil as Image 1. south facing, Canopy Snare anti-air attack animation 4 frames. Staff extended downward pointing at ground beneath an airborne enemy — not shooting from staff tip. Body motion: wind-up, staff stab toward soil below sky target, impact, recovery. Power travels from earth upward to reach flyers, not from hands. Valdris hero pixel art, magenta #FF00FF, same scale as Image 1. No fire from staff, no beam from hands. Scale-to-fit inside centered 1:1 square matching south idle — identical scale, same foot baseline. Magenta letterbox on sides. No zoom change, no reframing between frames.
```

**Negative:**
```
photorealistic, 3D render, CGI, smooth gradients, blue, cyan, gold, fire from staff tip, beam from hands, projectile from hands, roots from staff tip, horizontal ground crack only, photoreal lighting, motion blur, zoom to fill, crop to fill, enlarged character, camera pan, reframing, text, watermark
```

---

## Google Flow — Canopy Snare VFX (Step 7.1c)

| | |
|---|---|
| **Flow** | Video · **4:3** · **x1** |
| **Reference** | Ground Root Lash VFX ref for palette |

**Positive:**
```
Canopy Snare VFX only, no character body. Small soil burst at bottom of frame, thick segmented root column grows rapidly upward with amber tip flicker, leaf crown snap at top frame edge, then roots retract. Warcrest pixel art, forest green and amber accent, stipple dither, outline #110509, magenta #FF00FF background. 6 frames, vertical composition, ground origin at bottom center. Scale-to-fit 1:1 square center.
```

**Negative:**
```
character body, staff, face, horizontal-only crack, fire, blue, cyan, gold, smooth gradient, photoreal, beam weapon, sideways projectile, zoom to fill, text, watermark
```

---

## Manifest update (when wired)

Add to `aelindra_animation_manifest.md` BODY CLIPS:

| Clip key | file | count | fps | impact | Description |
|----------|------|-------|-----|--------|-------------|
| attack_air | Aelindra_Attack_Air.png | 4 | 12 | 2 | **Canopy Snare** — staff points at soil under flyer; spawn `CanopySnare_VFX` at ground anchor below target |

Add to VFX table:

| VFX strip | frames | anchor | Description |
|-----------|--------|--------|-------------|
| CanopySnare_VFX.png | 6 | ground point under air target | soil burst → vertical root column → snap → retract |

---

## Production order

1. Ship Root Lash (ground) first — already in progress  
2. Generate Canopy Snare body + VFX when first air unit is designed  
3. Add `airborne` to that unit's spec  
4. Wire `attack_air` clip + targeting swap in `sprites.js` / `systems.js`  

---

*Keeps the Tendkeeper rule: the forest reaches up from below. The sky is not the source.*
