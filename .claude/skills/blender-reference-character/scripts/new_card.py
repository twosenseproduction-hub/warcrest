#!/usr/bin/env python3
"""Scaffold an empty reference card JSON.

  python3 .claude/skills/blender-reference-character/scripts/new_card.py \\
    --name my_hero --out examples/my_hero_card.json
"""
import argparse, json, os

TEMPLATE = {
    "name": "my_hero",
    "style": "chibi_stylized",
    "pose": "tpose",
    "face_axis": "-Y",
    "up_axis": "Z",
    "palette": {
        "skin": "#a370cc",
        "skin_shadow": "#66428f",
        "hair": "#f0eef5",
        "antler": "#94663c",
        "armor": "#3f9e51",
        "armor_dark": "#246633",
        "gold": "#ebbd3d",
        "leather": "#663d21",
        "cloth": "#733d94",
        "eye": "#7ffa51",
        "gem": "#9947cc",
        "ink": "#12080f"
    },
    "emissive": {
        "eye": {"color": "#59ff38", "strength": 2.0},
        "gem": {"color": "#bf4cff", "strength": 1.1}
    },
    "proportions": {
        "total_height": 2.3,
        "head_height_frac": 0.45,
        "head_radius": 0.38,
        "shoulder_width": 0.64,
        "hip_width": 0.36,
        "limb_thickness": 0.09,
        "leg_height_frac": 0.23,
        "torso_height_frac": 0.27
    },
    "landmarks": [
        "pointed_ears",
        "REPLACE_WITH_REFERENCE_LANDMARKS"
    ],
    "part_inventory": [
        "legs_skin", "boots", "hips_cloth", "torso_armor", "arms_tpose",
        "hands", "head", "eyes", "ears"
    ],
    "notes": "Fill landmarks + palette from the reference BEFORE building."
}

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--name', required=True)
    ap.add_argument('--out', required=True)
    args = ap.parse_args()
    card = dict(TEMPLATE)
    card['name'] = args.name
    os.makedirs(os.path.dirname(os.path.abspath(args.out)) or '.', exist_ok=True)
    with open(args.out, 'w') as f:
        json.dump(card, f, indent=2)
        f.write('\n')
    print('Wrote', args.out)
    print('Next: edit palette/landmarks from the reference, then build_from_card.py')

if __name__ == '__main__':
    main()
