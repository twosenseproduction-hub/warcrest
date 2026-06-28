# Unit models (.glb)

The 3D renderer (`src/render3d.js`) can render units from real modeled glTF
assets instead of procedural primitives. This is how we reach the smooth,
sculpted, hand-modeled look (vs. the boxy primitive bodies).

## How it works

Register a `.glb` per unit key, then load it:

```js
RTS.Render3D.registerUnitModel('rimwalker:warrior', {
  url: 'assets/models/elf_warrior.glb',
  height: 48,                 // world-pixel height to fit to (hero 60 / worker 34 / other 48)
  yaw: 0,                     // radians, if the model's forward axis isn't +Z
  anims: { idle: 'Idle', walk: 'Walking', attack: 'Attack', death: 'Death' }
});
RTS.Render3D.loadUnitModels();   // returns a Promise; units spawned after it resolves use the model
```

Keys are matched most-specific first: `race:role` → `race:*` → `*`.
Races: `crown` (aurex/human), `horde` (cinder/orc), `elf` (rimwalker/night elf).
Roles: `worker`, `warrior`, `lancer`, `archer`, `caster`, `hero`.

Anything not registered (or that fails to load) falls back to the procedural
body, so the game is unchanged until real assets are dropped in.

## Live preview

Open the game with `?models=demo` in the URL to render every unit from
`RobotExpressive.glb` (a rigged sample model) — proves the pipeline in-engine.

## Requirements

- `vendor/GLTFLoader.js` and `vendor/SkeletonUtils.js` (already vendored, UMD,
  attach to the global `THREE` from `vendor/three.min.js`, Three.js r144).
- Skinned/rigged `.glb` with named animation clips (uncompressed, or add a
  DRACO/KTX2 decoder if your assets use compression).

`RobotExpressive.glb` is a CC0 Three.js sample model kept here as the pipeline
test/demo asset; it is not used by the game unless `?models=demo` is set.
