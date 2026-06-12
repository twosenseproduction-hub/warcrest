# Sapphire Shores — map reference

Map layout is driven by **`tools/mapgen/`** (deterministic tile builder).

## Regenerate from mapgen

1. Edit `tools/mapgen/map_config.json` (or terrain_masks.json)
2. Run:

```bash
cd rts-game
python3 scripts/import-mapgen.py tools/mapgen
```

3. Deploy or refresh the game

This runs `map_builder.py`, writes `src/sapphire-mapgen.js`, and copies `sapphire-mapgen-reference.png` here.

## Files

| File | Description |
|------|-------------|
| `sapphire-mapgen-reference.png` | Full mapgen render (3072×1920) |
| `sapphire-shores-full.png` | In-game render export (run export script) |
| `sapphire-shores-schematic.png` | Layout schematic |

## Map size

3072×1920 world units (48×30 tiles @ 64px). Player base top-left, enemy top-right per `start_locations` in map_config.
