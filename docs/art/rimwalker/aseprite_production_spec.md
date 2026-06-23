# Aelindra — Aseprite Production Spec (v2, engine-accurate)
**Warcrest · 256px hero · horizontal frame strips (NOT JSON) · matches Valdris**

> v2 supersedes v1. Your engine (`src/sprites.js`) loads horizontal PNG strips with
> a frame count, NOT Aseprite JSON atlases. Export strips, not JSON.
>
> Repo copy: `docs/art/rimwalker/aseprite_production_spec.md`

---

## 0. Tool (free)
Aseprite is open-source — compile free from GitHub, or use **LibreSprite** (free fork)
or **Piskel** (browser). All can export a horizontal sprite strip PNG.

## 1. File settings
- **Canvas: 256 x 256 px** (matches Valdris frameH:256)
- Color mode RGBA, **transparent** background (key magenta only on AI gens)
- Character fills ~70-80% of the 256 frame; feet near bottom, crown near top
- One Aseprite file per clip, OR one file with tags then export per-tag

## 2. Palette (load first, lock)
```
#100018 outline   #407030 leaf mid   #204030 leaf shadow  #506050 leaf light/ash
#704030 bark mid  #805030 bark light #604030 bark shadow
#B0B0A0 pale white #A0A090 pale shadow #E0A020 EMBER AMBER (accent) #7A4A32 skin
```
No blue, no gold. Amber only on crown gem / root tips / ult.

## 3. ART STYLE TARGET — match Valdris, not plain Tiny Swords
Valdris is "heavy chibi" high-detail pixel art: ~1:2 head-body ratio, chunky heroic
proportions, thick dark selective outline, stipple-dithered shading on rounded forms,
small pale specular highlights, gritty battle-worn texture, top-down 3/4 from a high
45-60deg angle (you see tops of shoulders + crown). Aelindra must sit next to Valdris
and look like the same game. Use the AI key-poses as blueprints, pixel to this idiom.

## 4. Clips, frame counts, layout (one strip per clip)
Lay frames LEFT TO RIGHT in a single row. Final strip width = 256 * count.

| Clip | frames | strip size | notes |
|---|---|---|---|
| Idle    | 8 | 2048x256 | breathing bob, staff planted |
| Run     | 8 | 2048x256 | low grounded gait |
| Attack  | 4 | 1024x256 | Root Lash; **staff taps DOWN on frame 3 (impactFrame:2, 0-based)** |
| Thornwall | 6 | 1536x256 | staff press; impact frame 4 (index 3) |
| Verdant | 5 | 1280x256 | posture collapse; impact frame 3 (index 2) |
| Ashfall | 10 | 2560x256 | raise->tremble->release; impact frame 10 (index 9) |
| Hit     | 2 | 512x256 | 1px shudder, NO knockback |
| Death   | 6 | 1536x256 | sinks/settles, hold last |
| Portrait| 1 | 256x256 | static bust (can crop from detailed illustration!) |

> impactFrame in src/sprites.js is 0-based. "taps on frame 3" = impactFrame:2.

## 5. Build from AI key-poses (cheap)
1. Open the AI hero-scale key-pose as a reference layer, scale into 256 canvas.
2. Pixel a clean frame on top using ONLY the locked palette + Valdris dithering style.
3. Duplicate frame, nudge limbs/staff a few px per frame for the in-betweens.
4. Delete reference layers before export.

## 6. EXPORT — horizontal strip (the key difference from v1)
File -> Export Sprite Sheet:
- **Type: Horizontal Strip** (single row)
- **Constant frame size**, Trim OFF (engine assumes fixed 256 frames)
- Output: `Aelindra_<Clip>.png` (e.g. Aelindra_Idle.png)
- JSON: **OFF** (engine doesn't read it; count is in sprites.js)
- Padding/border: 0
Result strips go in `assets/heroes/rimwalker/aelindra/`.

## 7. Portrait shortcut
`Aelindra_Portrait.png` (256x256) can be a cropped/downscaled bust of your EXISTING
detailed illustration — no need to pixel it. Matches how Valdris_Portrait works.

## 8. Checklist
- [ ] 256x256 frames, transparent bg
- [ ] locked palette only, Valdris dithered idiom
- [ ] horizontal strip export, Trim OFF, JSON OFF
- [ ] frame counts match sprites.js def (Idle8/Run8/Attack4...)
- [ ] impact frames drawn on the right index
- [ ] files named Aelindra_<Clip>.png in assets/heroes/rimwalker/aelindra/

---

## 9. Hand-fixups when pixeling the canonical idle (push 7/10 -> 9/10 vs Valdris)
The AI base (canonical idle) is a strong blueprint. When you pixel it in Aseprite, nudge these to match Valdris exactly:
- **Tilt head down a touch:** show more top-of-hair/crown, less chin — match Valdris's higher camera.
- **Chunk up antler + hair lines:** Valdris uses bolder, higher-contrast linework; thin those fine antler strokes into 1-2px chunkier lines.
- **Feet closer together + smaller:** Valdris's feet tuck under the body to sell top-down. Bring Aelindra's feet in from the wide stance.
- Keep her slightly richer detail — she's a HERO, reading a touch richer than line units is fine.
