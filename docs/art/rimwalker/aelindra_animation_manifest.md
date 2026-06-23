# Aelindra Ashveil — Battlefield Animation Manifest (v2, engine-accurate)
**Warcrest · matches src/sprites.js conventions · Rimwalker faction hero**

> v2 supersedes v1. Corrected to your ACTUAL engine after reading the repo:
> heroes are **256px frame strips** (not 64px), defined in `src/sprites.js`
> `HERO_DEF`, NOT Aseprite JSON. Aelindra is a detailed hero like Valdris.
>
> Repo copy: `docs/art/rimwalker/aelindra_animation_manifest.md`

---

## Engine facts (from src/sprites.js)

- Sprites are **horizontal frame strips** (PNG). Frame is square: frameW = frameH.
- Each clip declares: `file`, `count` (frames), and `fps` + `impactFrame`/`releaseFrame` (for attacks) or `speed` (for loops).
- **Heroes use `frameH: 256`** (Valdris). Line units 192, big creatures 256-384 with `scale`.
- Heroes live under `assets/heroes/<faction>/<hero>/`.
- Aelindra's faction = **rimwalker** (heroes.js: "rimwalker faction (not yet playable)"; her doc says "Rimwalkers · Tendkeeper").
- ART STYLE TARGET = **Valdris's idiom**: high-detail "heavy chibi" pixel art, ~1:2 head-body, chunky heroic proportions, thick dark selective outline, stipple-dithered shading, gritty texture, top-down 3/4 from a high 45-60deg angle. NOT plain Tiny Swords, NOT 64px simplified.

---

## Asset paths (create this folder)

```
assets/heroes/rimwalker/aelindra/
  Aelindra_Idle.png       256px tall strip  (8 frames -> 2048x256, matches Valdris)
  Aelindra_Run.png        256px tall strip  (8 frames -> 2048x256)
  Aelindra_Attack.png     256px tall strip  (4 frames -> 1024x256)  Root Lash, impactFrame 2
  Aelindra_Portrait.png   256x256 single
  -- abilities (add as built) --
  Aelindra_Thornwall.png  256px strip (6 frames) cast pose
  Aelindra_Verdant.png    256px strip (5 frames) cast pose
  Aelindra_Ashfall.png    256px strip (10 frames) ult cast pose
  Aelindra_Hit.png        256px strip (2 frames)
  Aelindra_Death.png      256px strip (6 frames)
```

Frame counts mirror Valdris where possible (Idle 8 / Run 8 / Attack 4) so the
HERO_DEF block is a near-copy.

---

## CORE RULE — body vs VFX are SEPARATE (unchanged from v1)

Aelindra's power comes from the ground at the destination, never her hands. So:
- **Body strip** = her on-sprite animation (taps staff, raises staff, collapses).
- **VFX** = separate sprite spawned at TARGET/feet/radius on the clip's impact frame.

This matches the engine's existing `impactFrame`/`releaseFrame` hook — the same
field Spear Goblin (`impactFrame:3`) and Warrior (`impactFrame:2`) already use to
time their effects.

---

## BODY CLIPS

| Clip key | file | count | fps/speed | impact | Description |
|---|---|---|---|---|---|
| idle | Aelindra_Idle.png | 8 | speed 4 | — | breathing, staff planted |
| walk | Aelindra_Run_*.png (4-dir) or `Aelindra_Run.png` | 8 | speed 16 | — | grounded run, longer stride |
| guard | Aelindra_Idle.png | 8 | speed 2.5 | — | reuse idle slower (matches Valdris) |
| attack | Aelindra_Attack.png | 4 | fps 12 | impactFrame 2 | **Staff Root Lash** — staff-base taps ground; on frame 2 spawn `root_lash` VFX at TARGET |
| cast_thornwall | Aelindra_Thornwall.png | 6 | fps 10 | impactFrame 3 | staff press into ground; spawn `thornwall` VFX on wall line |
| cast_verdant | Aelindra_Verdant.png | 5 | fps 8 | impactFrame 2 | posture collapse / communion; spawn `verdant_pulse` at HER feet |
| cast_ashfall | Aelindra_Ashfall.png | 10 | fps 8 | impactFrame 9 | ULT raise staff vertical->tremble->release; spawn `ashfall` at cast point |
| hit | Aelindra_Hit.png | 2 | fps 12 | — | flinch, NO knockback (passive immune) |
| death | Aelindra_Death.png | 6 | fps 8 | — | sinks/settles, hold last |

Start with idle + walk + attack (matches Valdris's current set) to get her in-game,
then add ability clips.

---

## VFX (separate strips, spawned at world position)

| VFX strip | frames | anchor | Description |
|---|---|---|---|
| RootLash_VFX.png | 6 | target feet | thin root cracks up at target, strikes, retracts <0.5s. amber tip flicker |
| Thornwall_VFX.png | 8 | wall line | soil seam -> roots erupt segmented -> settle. hold during 8s active |
| Verdant_VFX.png | 7 | her feet | low ground ripple expanding; green wash friendlies / amber tighten enemies |
| Ashfall_VFX.png | 12 | radius center | ground darkens->tremble->silence->ash column erupts. the big one |

VFX can reuse the engine's existing particle/effect path (see src/particles.js) OR
be frame strips like Hex Shaman's `Explosion Spell.png` (count:10) already in the
enemy pack — that's the precedent for effect strips.

---

## PALETTE (locked, from Aelindra's art)

```
#100018 outline   #407030 leaf mid   #204030 leaf shadow   #506050 leaf light/ash
#704030 bark mid  #805030 bark light #604030 bark shadow
#B0B0A0 pale white #A0A090 pale shadow #E0A020 EMBER AMBER (accent only) #7A4A32 skin
```
No blue, no gold, no sky-origin light. Amber only on power moments.

---

## PRODUCTION ORDER

1. Generate Aelindra key poses in Valdris idiom (small credit spend, one-time).
2. Hand-pixel the frames in Aseprite at 256px, export HORIZONTAL STRIPS (not JSON).
3. Drop strips in assets/heroes/rimwalker/aelindra/.
4. Paste the HERO_DEF.aelindra block (see aelindra_sprites_def.js) into src/sprites.js.
5. Register her in src/heroes.js under the rimwalker faction (stats/passive/abilities
   from her ability doc).
6. VFX strips last.

_v2 — engine-accurate. Valdris is the template; copy his pattern._
