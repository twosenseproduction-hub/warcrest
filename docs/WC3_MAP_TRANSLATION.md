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
- **Neutral buildings:** 3 down the center spine (top, middle, bottom) — map to
  neutral markers `o` for now (future: item shop / mercenary camp).
- **Forest:** heavy tree fringe around every landmass; a dense forested island
  in the upper-center.
- **Feel:** macro/naval-flavored — water everywhere forces fights over the land
  bridges and the contested center.

> Rules learned while building this map will be appended here.
