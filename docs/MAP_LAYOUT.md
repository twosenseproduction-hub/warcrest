# Master Map Layout — Warcrest

Reference render: `docs/refs/master_map_layout.jpeg`

This is the canonical layout every Warcrest map should follow. It is the
Thronefall-descended "defend the center" shape, tuned for our low-poly art
and mobile top-down camera.

## The shape (outside → in)

1. **Water** — a large flat blue plane the island sits in; the world reads as
   one landmass surrounded by sea.
2. **Beach rim** — a thin light-sand band at the waterline where the grass
   meets the sea (cliff/shore transition).
3. **Perimeter forest ring** — a **dense, near-continuous band of yellow
   low-poly trees** hugging the island edge. This is the visual frame: it
   walls in the play space and hides the map boundary. The ring is broken
   only where **roads exit** to the enemy spawn gates.
4. **Open central meadow** — flat green grass, kept clear of trees. This is
   the battlefield where the hero, squad, and waves actually fight.
5. **Settlement cluster (center)** — the buildings sit together in the middle
   on **cream/dirt pads**, not scattered:
   - **Keep** — grey stone, crenellated, flag on top. The heart you defend.
   - **Gate-house** — square building with a steep **orange pyramid roof**.
   - 1–2 more **orange-roof houses** around the keep.
   - **Windmill** — one, offset toward an edge of the cluster.
   - **Crenellated fort / gate tower** with a short **wooden palisade wall**
     extending from it, placed toward a spawn approach.
6. **Cream paths** — light dirt roads radiating from the keep out through the
   forest gaps to the spawn gates; trees never sit on a road.
7. **Props** — grey **rocks** scattered across the meadow (mid-size, a few
   clusters); optional bushes/flowers. Rocks read as neutral cover, not
   obstacles that block the fight.

## Rules for new maps

- One organic island; silhouette varies but always **framed by the forest
  ring**, interior **open**.
- Buildings **clustered central**, on pads, never dotted randomly across the
  field.
- Every road runs keep → forest gap → spawn gate; leave the road corridors
  tree-free (`pathDist > ~10`).
- Spawn gates live at the **outer end of each road**, at the tree line.
- Keep the meadow open enough for a squad to maneuver; density lives in the
  ring, not the middle.

The playable implementation of this layout is `demos/thronefall-level.html`
(`build()` places the settlement, `PATHS` the roads, the perimeter loop the
forest ring). Treat that file's `build()` as the working template.
