# Mega-Bundle-v4 — source asset packs

The complete Bitgem proto-series RTS bundle (minus the Unity-only
`RTS_Bundle_v4.unitypackage`, which is 162MB — over GitHub's file limit —
and just repackages these same assets for Unity). Kept in the repo so every
model, texture, and part is always available to build from; the deploy image
excludes this directory (see `.dockerignore`).

Pipeline for using anything here: extract the FBX, bake SkinnedMesh → static
with `bakeStatic()`, apply the pack's palette-atlas texture
(flipY, NearestFilter, no mipmaps), scale by height via `bldClone` — same as
every building/unit already shipped in `assets/buildings` + `assets/models`.

| Pack | Contents |
|---|---|
| `elf_buildings_proto_series.zip` | Elf throne/house/tower/barrack/mine/woodcutter/altar/forge + parts kit, Lv1–3 (throne/house/tower/barrack/mine already extracted → `assets/buildings`) |
| `elf_units_proto_series.zip` | Elf unit bodies + weapons (queen/archer/priestess/warrior shipped → `assets/models/elf_*_anim.glb`) |
| `orc_buildings_proto_series.zip` | Orc equivalents of the elf set (throne/house/tower/barrack/mine/lumberjack extracted) |
| `orc_horde_proto_series.zip` | Orc unit bodies + weapons (chieftain/grunt/warrior/archer/shaman shipped) |
| `human_buildings_proto_series.zip` | **Unused** — full Human building set: house/barrack/mine/factory/oracle/cauldron Lv1–3 + a big parts kit (anvil/axe/barrels/…) |
| `human_alliance_proto_series.zip` | Human unit bodies + weapons (footman/knight/archer/mage/paladin GLBs shipped) |
| `undead_buildings_v1.zip` | **Unused** — full Undead building set: barrack/house/tower/mine/smith/cauldron Lv1–3 |
| `undead_units.zip` | **Unused** — full Undead roster: king/warrior/assassin/archer/mage/worker + weapons (bow/spear/sword/scroll) |
