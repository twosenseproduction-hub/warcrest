# Style guide — the Bitgem / stylized low-poly look

The aesthetic is driven by **shading, palette, and silhouette**, not polygon count.
Bitgem's own characters sit around 1,800–2,300 triangles; their product notes even
say to self-illuminate/flat-shade to reproduce the preview. We get the look in
Three.js through materials + normals + post, not by buying meshes.

## Targets
- **Triangle budget:** ~1,800–2,300 per character. Keep sphere segments 16×10, cyl 8–12.
- **Proportions:** chibi — oversized head (1.1–1.6× a realistic ratio), tapered limbs,
  small hands/feet. Exaggeration reads at small in-game sizes.
- **Silhouette first:** must be readable as a black shape from the side. Pointed ears,
  raised weapon, a flared skirt/cape — distinct extremities.

## Palette (small, saturated, strong value separation)
- Block color by **region** — a different material per skin / cloth A / cloth B / metal /
  emissive. No UV unwrapping needed.
- Example (Sylvan elf): violet skin `#8a5cd0`, navy cloth `#26314f`, gold accent
  `#f2c14e`, green leaf/crystal `#4fae6b`, emissive blade `#40ffa0`, gold hair `#f2c14e`.
- Tint the key light warm and the rim cool to separate the figure from the background.

## Do / don't
- DO smooth-shade low poly (averaged normals); DO band the shading with a toon ramp;
  DO outline with an inverted hull; DO confine bloom to true emissives.
- DON'T rely on triangle density; DON'T use a single noisy texture; DON'T let ambient/
  fill wash the palette to pastel; DON'T bloom a light background.

## Acceptance criteria for the critique loop
Score each, map to one parameter:
silhouette · proportions · palette match · shading banding · rim strength · bloom on
emissive · outline thickness · pose dynamism. Stop when the side silhouette is clearly
readable and palette + glow match the reference.
