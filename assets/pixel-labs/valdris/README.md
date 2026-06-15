# Valdris Pixel Labs batch

This folder contains the Pixel Labs batch request for Valdris the Ironwarden's
core four-direction animation set.

## Batch file

- `valdris_4_direction_batch.json`

The batch requests 12 transparent PNG sprite strips:

| Direction | Idle | Walk | Attack |
| --- | --- | --- | --- |
| Down | `Valdris_Down_Idle.png` | `Valdris_Down_Walk.png` | `Valdris_Down_Attack.png` |
| Right | `Valdris_Right_Idle.png` | `Valdris_Right_Walk.png` | `Valdris_Right_Attack.png` |
| Up | `Valdris_Up_Idle.png` | `Valdris_Up_Walk.png` | `Valdris_Up_Attack.png` |
| Left | `Valdris_Left_Idle.png` | `Valdris_Left_Walk.png` | `Valdris_Left_Attack.png` |

## Export expectations

- Frame size: `192x192`
- Layout: one horizontal strip per animation/direction
- Idle: 8 frames (`1536x192`)
- Walk: 8 frames (`1536x192`)
- Attack: 6 frames (`1152x192`), impact on frame 3
- Background: transparent
- Feet anchor: centered around `x=96`, `y=172`

The manifest intentionally tells Pixel Labs to reuse the already-created
Valdris character as a locked reference. The prompts should not be used to
redesign him.

## After export

Drop generated PNGs into:

```text
assets/heroes/valdris/
```

Then validate the batch and any present PNG files:

```bash
python3 scripts/validate_pixel_labs_batch.py assets/pixel-labs/valdris/valdris_4_direction_batch.json --check-files
```

