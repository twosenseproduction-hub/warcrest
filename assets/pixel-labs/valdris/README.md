# Valdris Pixel Labs batch

This folder contains the Pixel Labs batch request and submission metadata for
Valdris the Ironwarden's core four-direction animation set.

## Batch file

- `valdris_4_direction_batch.json`
- `pixellab_submission.json`

The completed batch generated 12 transparent PNG sprite strips:

| Direction | Idle | Walk | Attack |
| --- | --- | --- | --- |
| Down | `Valdris_Down_Idle.png` | `Valdris_Down_Walk.png` | `Valdris_Down_Attack.png` |
| Right | `Valdris_Right_Idle.png` | `Valdris_Right_Walk.png` | `Valdris_Right_Attack.png` |
| Up | `Valdris_Up_Idle.png` | `Valdris_Up_Walk.png` | `Valdris_Up_Attack.png` |
| Left | `Valdris_Left_Idle.png` | `Valdris_Left_Walk.png` | `Valdris_Left_Attack.png` |

## Generated export

- PixelLab character ID: `c2dea73b-4644-45c1-bedf-5195a1f75f56`
- Frame size: `256x256`
- Layout: one horizontal strip per animation/direction
- Idle: 9 frames (`2304x256`)
- Walk: 9 frames (`2304x256`)
- Attack: 7 frames (`1792x256`)
- Background: transparent
- Output directory: `assets/heroes/valdris/`

PixelLab v3 returned one extra closure/recovery frame beyond the requested
8/8/6 counts, so the stitched strips preserve the complete generated output.

The manifest intentionally tells PixelLab to reuse the already-created Valdris
character as a locked reference. The prompts should not be used to redesign him.

## Validation

Validate the manifest and generated PNG strip dimensions:

```bash
python3 scripts/validate_pixel_labs_batch.py assets/pixel-labs/valdris/valdris_4_direction_batch.json --check-files
```

