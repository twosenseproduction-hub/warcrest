# Making Maps for Warcrest

This is the workflow and the design knowledge for building great maps — both
fair 1v1 skirmish maps and the hand-authored maps a story campaign needs.

There are two halves here:
1. **The pipeline** — the tools that turn a readable text file into a playable map.
2. **Training your eye** — RTS map-design fundamentals, and what to watch for in
   the videos you're studying.

---

## 1. The pipeline

A map lives as a small **`.map` text file** you can read and edit. Three tools
take it from there:

```
 your-map.map ──ascii-map.mjs──▶ assets/maps/your-map.tmj ──▶ game
                                        │
                          render-map.py │ validate-map.mjs
                                        ▼
                                  your-map.png  +  PASS/FAIL report
```

| Step | Command |
|------|---------|
| **Compile** ASCII → game map | `node tools/mapgen/ascii-map.mjs tools/mapgen/sources/twin-fords.map` |
| **Validate** (connectivity, fairness, legality) | `node tools/mapgen/validate-map.mjs assets/maps/twin-fords.tmj` |
| **Render** to a PNG you can look at | `python3 tools/mapgen/render-map.py assets/maps/twin-fords.tmj` |

> The renderer needs Pillow once: `pip install pillow`.

The loop is: **edit → compile → render → look → validate → repeat.** You never
hand-edit the giant `.tmj` — you edit the `.map`.

### The `.map` format

Header lines, then a `map:` line, then the grid. One character per tile, every
row the same width.

```
name: Twin Fords
tile: 64
mirror: horizontal      # none | horizontal
gold_amount: 2800
map:
~~..TTTT............TTTT
~...T...............T...
....P...........$.......
...
```

| Glyph | Meaning |
|-------|---------|
| `~` | water (impassable) |
| `.` | grass (flat, walkable, buildable) |
| `^` | highland / high ground (cliffs auto-drawn at the edges) |
| `T` | forest — grass with a tree (blocks building, units squeeze through) |
| `P` | player start (place on grass) |
| `E` | enemy start (place on grass) |
| `$` | gold node (amount = `gold_amount`) |
| `o` | neutral / creep-camp marker (for future campaign use) |

**`mirror: horizontal`** — author only the **left half**. The compiler reflects
the terrain and forests, mirrors every `$`, and turns each `P` into a matching
`E` on the right. This guarantees a perfectly fair 1v1 with half the typing.
For story missions that are *meant* to be lopsided, use `mirror: none` and draw
the whole board.

### Wiring a new map into the game

Maps are loaded in `src/scenes/PreloadScene.js`:

```js
this.load.tilemapTiledJSON('twin_fords', 'assets/maps/twin-fords.tmj');
```

`GameScene` parses it via `RTS.parseMapTMJ`, which reads:
- `ground` tile layer (non-zero = flat land), `elevated` (non-zero = high ground)
- `forest` object layer (one object per tree)
- `spawns` object layer (`spawn_player` / `spawn_enemy` / `gold_node` + `amount`)

The board is `cols × rows` tiles at `tile`px each. The shipped maps are **48×30**
(3072×1920px); match that for a drop-in skirmish map unless you're also adjusting
`RTS.Config.world`.

### What the validator checks

`FAIL` means the map is broken; `WARN` means it probably plays badly but loads.

- exactly one player + one enemy spawn — **FAIL**
- every spawn / gold sits on land — **FAIL**
- enemy base reachable on foot from the player base — **FAIL**
- every gold node reachable from the player base — **WARN**
- each base has a clear 4×3 land footprint (the Town Hall is 256×192 = 4×3 tiles) — **WARN**
- rush distance + per-side gold balance — **info / WARN**

Run it before you ship. It exits non-zero on FAIL so it can gate a build later.

---

## 2. Training your eye — RTS map design

Tools make a map *valid*. These principles make it *good*. This is the lens to
watch your videos through.

### The five things every competitive map balances

1. **Rush distance.** How long until armies meet. Too short → coin-flip
   all-ins, no time to tech (exactly the "things happen too fast" problem).
   Too long → passive macro games. The validator prints this in tiles; aim for
   a deliberate number, not an accident. (Twin Fords ≈ 39 tiles = slow/macro.)

2. **Expansions.** Where the *second* and *third* base go. A main gold at the
   start, a "natural" expansion that's easy to defend, and contested expansions
   out in the open. The fight is usually *over the expansions*, not the mains.

3. **Choke points.** Narrow passages (between water, cliffs, or forest) where a
   small force can hold a large one. Chokes near your natural make defending
   cheap; open centers make attacking cheap. Every chokepoint is a decision
   about whether the map favors defense or aggression.

4. **High ground.** Elevated tiles that overlook a key path or expansion. In
   WC3/SC, high ground = vision + a fighting advantage. Put gold or a ramp on
   high ground and you've created a reason to fight for a *specific* spot.

5. **Fairness & symmetry.** For 1v1, both players must get the *same* options.
   `mirror: horizontal` gives you this for free. (Rotational symmetry is even
   fairer but harder to author in ASCII — start with mirror.)

### Reading a map like a designer (use this on your videos)

When you watch a map-design or melee-map video, pause and ask:

- Where are the **mains**, and what protects them (cliff, choke, forest wall)?
- Where's the **natural**, and how exposed is it?
- What's the **shortest path** between bases — and what sits on it (a choke? high
  ground? a contested gold)?
- Where does the designer *want* the fights to happen? What did they place there
  to bait it (gold, a watch tower, a creep camp)?
- What's **symmetric**, and what's deliberately *not*?

Write those answers down for one map you admire, then rebuild your version of it
in a `.map` file and render it. Copying a good map by hand teaches more than
reading ten articles.

### Campaign / story maps are a different craft

Skirmish maps are about *fairness*. Story maps are about *pacing a single
experience*:

- **Asymmetry on purpose** — the player is usually outnumbered or boxed in.
  Use `mirror: none`.
- **Guided space** — chokes and terrain funnel the player toward objectives, not
  away from them. The map is a level, not an arena.
- **Set pieces** — a defensible hill for a "hold the line" mission; a long
  corridor for an escort; islands for a naval beat.
- **Reveal & surprise** — terrain hides the enemy base / reinforcements until
  the story wants them seen.

> **Note:** the current `.tmj` format only encodes terrain + spawns + gold. Full
> campaign missions also need a *scenario layer* — objectives, scripted waves,
> pre-placed enemy bases, triggers, victory/defeat conditions. That's the planned
> next step after this map pipeline, and it will share these same tools.

### Study these

Drop the videos you're using here, with one line on what each is good for, so
this becomes our shared reference:

- _(add link)_ — …
- _(add link)_ — …

### A quick design checklist

Before a map is "done":

- [ ] Compiles clean (no ragged-row warning)
- [ ] Validator says **PASS**
- [ ] Rendered it and looked — symmetry/shape is what I intended
- [ ] Main gold by each start; at least one expansion per side
- [ ] A reason to fight in the middle (contested gold / high ground)
- [ ] At least one meaningful choke
- [ ] Rush distance is a number I chose on purpose
- [ ] Bases have room to build (4×3 footprint + space for production)
