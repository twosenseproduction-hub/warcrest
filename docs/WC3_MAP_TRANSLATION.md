# WC2/WC3 → Warcrest Map Translation (the rulebook)

This is the **trained rulebook** for recreating Warcraft maps as 2D top-down
pixel maps that *feel like the original*. It is the durable memory of the
process: every time we recreate a map and you correct it, the correction lands
here as a rule. After a handful of maps this file is good enough that new maps
come out right on the first pass.

Read this together with `docs/MAP_MAKING.md` (the pipeline + the `.map` format).

---

## 1. The recreation loop

```
reference image ─▶ capture sheet (below) ─▶ author .map (or generator)
       ▲                                              │
       └──── compare render vs original ◀── compile + validate + render
                    every miss → a new RULE here
```

## 2. Concept translation (WC → Warcrest)

| Warcraft thing | Warcrest equivalent | Glyph / mechanism |
|---|---|---|
| Gold mine | Ironstone field (gold node) | `$` |
| Start location | Player / enemy main | `P` / `E` |
| Tree wall / forest | Forest (blocks build, units squeeze) | `T` |
| Water / sea | Impassable water | `~` |
| High ground / cliff | Highland (auto cliff edges) | `^` |
| Dirt road / beach / flat path | Grass (walkable land bridge) | `.` |
| Creep camp | Neutral unit group | `o` (marker; spawn logic TBD) |
| Goblin shop / merc camp / tavern | Neutral building (item shop / mercenary camp) | `o` for now → real building type once wired |

### Projection convention (3D-iso → flat 2D)
Warcraft is a tilted 3D view; we are flat top-down. Rules:
- **Ignore the camera tilt.** Read the board as if straight overhead: estimate
  each feature's position as a fraction of the board width/height, not its
  on-screen pixels.
- **Cliffs/elevation** become `^` highland plateaus; the cliff art is auto-drawn
  at plateau edges, so author the *plateau footprint*, not the cliff faces.
- **Tree borders** (WC maps fringe landmasses with trees) → a `T` fringe one
  tile thick around grass that touches water.

### Symmetry
- 2-player mirror maps → `mirror: horizontal`, author the **left half**.
- Single center features (a lone neutral building on the axis) can't mirror
  cleanly — they become a tight **pair** flanking the seam. Acceptable; note it.

## 3. Sizing
- Skirmish standard is `48×30` @ 64px. Larger feel → bump (even width for
  mirror). `finishMap` syncs `RTS.Config.world` to whatever the map declares.

---

## 4. Per-map capture sheets

### Tideland Crossing  (ref: classic WC2 2-player island map)
- **Players:** 2, horizontally symmetric. Red = top-left, Blue = top-right.
- **Board:** wide rectangle, full water border, grass landmasses split by water
  channels and joined by dirt (→ grass) land bridges.
- **Gold mines:** 3 per side (6 total): a main by each start (top corner), a
  mid-edge mine, and a lower mine.
- **Neutral buildings:** 2 on the center seam — **top = merchant / item shop**,
  **bottom = mercenary camp** (markers `o`; real buildings pending art+wiring).
- **Forest:** sparse trees are wanted (not dense walls); keep a light fringe +
  scattered. Add natural grass tufts, flowers, and rocks for ground detail.
- **Auxiliary mines are creep-guarded** (WC3-style): the non-main mines have a
  neutral hostile camp you must clear before expanding.
- **Feel:** macro/naval — water forces fights over land bridges + contested center.

### Rules learned (apply to every future map)
- **Lone center features:** author the **full board** (`mirror: none`, reflect
  in the generator) so a single on-axis building isn't doubled by the mirror.
- **Building roles by position:** merchant/shop reads as a top-center neutral;
  mercenary camp as bottom-center. Keep them single and centered.
- **Water wants shallows:** coasts should read as shallow (lighter) water, not a
  hard deep-blue edge — render a shallow band where water meets land.
- **Ground detail:** sparse trees + scattered grass/flowers/rocks beats dense
  forest walls for this art style.
