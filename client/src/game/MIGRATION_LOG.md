<!--
Warcrest -> Phaser Migration Log

Stage 1 audit source files read:
- src/ai.js
- src/art.js
- src/assets.js
- src/audio.js
- src/building-menu.js
- src/commands.js
- src/config.js
- src/entities.js
- src/game.js
- src/hud.js
- src/input.js
- src/map.js
- src/particles.js
- src/pathfind.js
- src/radial-menu.js
- src/render.js
- src/sapphire-mapgen.js
- src/sapphire-terrain-mask.js
- src/size-ref.js
- src/sprites.js
- src/state.js
- src/systems.js
- src/terrain.js
- src/terraform-zones.js
- src/ui.js
- src/unit-ai.js

Core architecture found:
- The preserved game is a single-player browser game on the global window.RTS namespace.
- src/game.js owns scene flow and the requestAnimationFrame loop.
- src/state.js creates one mutable match state object.
- src/systems.js advances movement, combat, harvesting, production, projectiles, effects, AI, supply, and win/loss.
- src/render.js, src/art.js, src/assets.js, src/sprites.js, and src/particles.js draw to a Canvas 2D renderer.
- src/hud.js, src/building-menu.js, src/radial-menu.js, and src/ui.js manage the DOM HUD/menu layer.

Unit types and properties:
- pawn: HP 55, speed 100, damage 5, range 22, RoF 1.0, cost 40, supply 1. Worker; can harvest and build.
- lancer: HP 52, speed 178, damage 9, range 78, RoF 0.55, cost 45, supply 1. Fast skirmisher.
- archer: HP 64, speed 118, damage 10, range 132, RoF 0.62, cost 60, supply 1. Ranged projectile unit.
- monk: HP 80, speed 108, damage 0, range 110, RoF 0.7, cost 90, supply 2. Heals allies for 12.
- warrior: HP 230, speed 62, damage 30, range 46, RoF 0.85, cost 120, supply 3. Heavy frontline.
- Runtime unit fields include id, kind, role, team, faction, x/y, vx/vy, hp/maxHp, speed, dmg, range, rof, target, moveTo, attackMove, harvest, buildTask, and sprite/combat visual state.

Building types:
- core / Citadel Keep: 256x192, HP 1600, cost 0, trains pawn, deposit, main base, win/loss target.
- outpost / Forward Bastion: 128x128, HP 1400, cost 320, build 42, trains pawn, expansion deposit.
- conduit / Sheep Pen: 192x192, HP 420, cost 65, build 10, trains livestock for supply.
- foundry / Barracks: 192x128, HP 760, cost 120, build 18, trains lancer/archer/monk.
- forge / War Forge: 192x192, HP 980, cost 175, build 26, trains warrior.
- turret / Arrow Tower: 64x128, HP 520, cost 100, build 14, defense building, 20 damage, 178 range, 0.7 RoF.

Resource system:
- User-facing resource is Ironstone; legacy state key is halcite.
- Starting resources are 280 for player and enemy.
- Resource nodes are entities with id, kind: resource, x, y, r, amount, and max.
- Mine amounts are config-driven: 12,500 for starting mines and 5,000 for expansions.
- Pawns harvest via node slot assignment, carry up to 6, return to a core/outpost deposit, and bank into team halcite.
- Sheep/pigs from pasture buildings increase supply cap; max supply cap is 80.

Combat/attack logic:
- src/systems.js and src/unit-ai.js implement WC3-style acquisition, chasing, returning to guard origin, healing, ranged projectiles, turret fire, building damage, deaths, corpse fade, and end-game checks.
- src/commands.js issues move, attack, attack-move, harvest, assist-build, stop, build, train, rally, and selection commands.
- Sprite animation timing currently gates projectile release/melee impact when sprites are ready.

AI/opponent logic:
- src/ai.js is a local single-player enemy brain.
- It harvests, builds, rebuilds, produces units, chooses strategy modes, manages defense/assault/harass squads, and launches timed waves.
- First wave is at 70 seconds; wave interval is 52 seconds.

Map/tile data:
- Current visible map is sapphire_shores.
- World defaults are 3072x1920 with 64px terrain tiles.
- Sapphire Shores map generation is 48 columns x 30 rows; tile size 64.
- Terrain height grid uses -1 water, 0 flat land, 1 high land.
- pathGrid stores blocked/walkable cells.
- Player base is around world { x: 544, y: 330 }; enemy base around { x: 2527, y: 330 }.
- Resource node world positions are listed in src/sapphire-mapgen.js.

Input handling:
- src/input.js manually unifies canvas mouse/touch.
- Touch gestures include tap selection/commands, one-finger pan, two-finger pinch zoom, two-finger deselect, long press attack-move/rally/build, double-tap army selection, and double-tap-hold radial menu.
- Phaser migration decision: use Phaser pointer events only and rebuild this as an input controller incrementally.

Multiplayer/WebSocket logic:
- No WebSocket, socket.io, WebRTC, EventSource, or multiplayer sync code was found in src/.
- Stage 7 is skipped until multiplayer code exists.

Migration decisions logged:
1. Preserve /legacy-game and all legacy src files until the user explicitly approves Stage 8 removal.
2. Extract static config into typed TypeScript modules by copying values from src/config.js and src/sapphire-mapgen.js.
3. Map legacy Ironstone/halcite to the requested HUD resource field "gold"; initialize wood to 0 because the legacy game has no wood resource.
4. Keep GameState as the single source of truth for the Phaser scaffold; Phaser reads from it and input writes commands to it.
5. Keep FogOfWar and GameEvents intact; add resources-updated to GameEvents.
6. Use simple Phaser rectangles/circles/text labels for the first migrated renderer. Legacy sprite data exists, but it is distributed across assets.js, sprites.js, art.js, and image folders, so a separate asset-manifest extraction pass is safer than a partial sprite import.
7. Implement movement and selection in GameState/Phaser first; full combat, harvesting, production, AI, pathfinding, sprite timing, and construction remain documented migration targets from the audit and are not deleted from legacy.
8. Do not remove /legacy-game in this stage because /game is not yet gameplay-identical.
9. Visual audit for Phaser asset parity:
   - Units render from Tiny Swords sprite sheets used by src/sprites.js:
     - Aurex: assets/tiny-swords/Units/Blue Units/{Pawn,Lancer,Archer,Monk,Warrior}
     - Cinder: assets/tiny-swords-enemy/Enemies/{Gnome,Goblin Raiders,Spear Goblin,Gnoll,Goblin Raiders/Hex Shaman,Troll}
   - Unit frame sizes/counts, foot ratios, and approximate draw heights are copied from src/sprites.js and src/size-ref.js.
   - Buildings render from the same PNGs selected by src/assets.js:
     - Blue/Red Tiny Swords Castle, House1, Barracks, Archery, Tower
     - Custom Shepherds_Hut, Raider Warren_Maw, Pig_Sty, War_Pit
   - Resource nodes render with the same Gold Stone PNG family and a clustered deposit composition.
   - Phaser is configured with pixelArt/roundPixels to mirror the legacy renderer's imageSmoothingEnabled = false behavior for sprites/buildings.
   - Remaining exact parity risk: legacy terrain uses the Canvas/Tiny Swords terrain renderer and generated terrain masks. Phaser still uses the current isometric scaffold terrain unless a dedicated tile renderer ports src/terrain.js and src/assets.js tile atlas logic.
-->

# Warcrest Phaser Migration Log

This file tracks staged extraction from the preserved legacy Warcrest game into the Phaser scaffold.
