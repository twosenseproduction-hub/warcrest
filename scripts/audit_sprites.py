#!/usr/bin/env python3
"""Throwaway audit: PNG dimensions on disk vs frameW/frameCount in source."""
from __future__ import annotations

import re
import struct
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets" / "tiny-swords"
SRC = ROOT / "src"


def png_size(path: Path) -> tuple[int, int] | None:
    if not path.is_file():
        return None
    with path.open("rb") as f:
        sig = f.read(8)
        if sig != b"\x89PNG\r\n\x1a\n":
            return None
        length, chunk = struct.unpack(">I4s", f.read(8))
        if chunk != b"IHDR":
            return None
        w, h = struct.unpack(">II", f.read(8))
        return w, h


def rel_asset(path: Path) -> str:
    return str(path.relative_to(ASSETS)).replace("\\", "/")


# Canonical Tiny Swords layouts (PNG on disk is truth for dimensions;
# these are the correct slice grids verified against the pack).
EXPECTED = {
    "Terrain/Resources/Wood/Trees/Tree1.png": (192, 8),
    "Terrain/Resources/Wood/Trees/Tree2.png": (192, 8),
    "Terrain/Resources/Wood/Trees/Tree3.png": (192, 8),
    "Terrain/Resources/Wood/Trees/Tree4.png": (192, 8),
    "Terrain/Decorations/Bushes/Bushe1.png": (128, 8),
    "Terrain/Decorations/Bushes/Bushe2.png": (128, 8),
    "Terrain/Decorations/Bushes/Bushe3.png": (128, 8),
    "Terrain/Decorations/Bushes/Bushe4.png": (128, 8),
    "Terrain/Decorations/Rocks in the Water/Water Rocks_01.png": (128, 8),
    "Terrain/Decorations/Rocks in the Water/Water Rocks_02.png": (128, 8),
    "Terrain/Decorations/Rocks in the Water/Water Rocks_03.png": (128, 8),
    "Terrain/Resources/Gold/Gold Resource/Gold_Resource_Highlight.png": (128, 6),
    "Terrain/Tileset/Water Foam.png": (192, 16),
}


def check(label: str, path: Path, frame_w: int, frame_count: int, frame_h: int | None = None):
    size = png_size(path)
    rows = []
    if size is None:
        rows.append((label, rel_asset(path), "MISSING", frame_w, frame_count, frame_h, "file not found"))
        return rows
    sw, sh = size
    fh = frame_h if frame_h is not None else sh
    expected_w = frame_w * frame_count
    ok_w = sw % frame_count == 0 if frame_count else True
    ok_product = expected_w == sw
    ok_h = fh == sh
    issues = []
    if not ok_product:
        issues.append(f"frameW*count={expected_w} != sheetW={sw}")
    if frame_count and sw % frame_count != 0:
        issues.append(f"sheetW {sw} not divisible by count {frame_count}")
    if frame_w and sw % frame_w != 0:
        issues.append(f"sheetW {sw} not divisible by frameW {frame_w}")
    implied = sw // frame_count if frame_count else 0
    if frame_count and implied != frame_w:
        issues.append(f"implied frameW={implied} != declared {frame_w}")
    if not ok_h:
        issues.append(f"frameH {fh} != sheetH {sh}")
    asset_key = rel_asset(path)
    if asset_key in EXPECTED:
        exp_w, exp_n = EXPECTED[asset_key]
        if frame_w != exp_w or frame_count != exp_n:
            issues.append(f"expected {exp_n}x{exp_w} per Tiny Swords pack, not {frame_count}x{frame_w}")
    status = "OK" if not issues else "MISMATCH"
    rows.append((label, rel_asset(path), f"{sw}x{sh}", frame_w, frame_count, fh, status + (": " + "; ".join(issues) if issues else "")))
    return rows


def main() -> int:
    rows: list[tuple] = []

    # --- assets.js decor (current code values) ---
    decor_trees = [
        "Terrain/Resources/Wood/Trees/Tree1.png",
        "Terrain/Resources/Wood/Trees/Tree2.png",
        "Terrain/Resources/Wood/Trees/Tree3.png",
        "Terrain/Resources/Wood/Trees/Tree4.png",
    ]
    assets_js = (SRC / "assets.js").read_text()
    tree_fw = int(re.search(r"d\.kind === 'tree'[\s\S]*?frameW = (\d+)", assets_js).group(1))
    tree_fc = int(re.search(r"d\.kind === 'tree'[\s\S]*?frameCount = (\d+)", assets_js).group(1))
    for p in decor_trees:
        rows += check("assets.js tree", ASSETS / p, tree_fw, tree_fc, None)

    bushes = [f"Terrain/Decorations/Bushes/Bushe{i}.png" for i in range(1, 5)]
    for p in bushes:
        rows += check("assets.js bush", ASSETS / p, 128, 8, None)

    gold_hi = ASSETS / "Terrain/Resources/Gold/Gold Resource/Gold_Resource_Highlight.png"
    rows += check("assets.js gold spark", gold_hi, 128, 6, None)  # fw = width/6

    rock_match = re.search(
        r"d\.kind === 'rock'[\s\S]*?frameW = (\d+)[\s\S]*?frameCount = (\d+)",
        assets_js,
    )
    if rock_match:
        rock_fw, rock_fc = int(rock_match.group(1)), int(rock_match.group(2))
        rock_fh_match = re.search(
            r"d\.kind === 'rock'[\s\S]*?frameH = (\d+)",
            assets_js,
        )
        rock_fh = int(rock_fh_match.group(1)) if rock_fh_match else None
    else:
        rock_fw, rock_fc, rock_fh = 0, 1, None
    for i in range(1, 4):
        p = ASSETS / f"Terrain/Decorations/Rocks in the Water/Water Rocks_{i:02d}.png"
        rows += check("assets.js rock", p, rock_fw, rock_fc, rock_fh)

    foam = ASSETS / "Terrain/Tileset/Water Foam.png"
    rows += check("terrain.js foam", foam, 192, 16, 192)

    # --- sprites.js ROLE_DEF clips ---
    role_clips = {
        "worker/Pawn_Idle Pickaxe.png": (8, 192),
        "worker/Pawn_Run Pickaxe.png": (6, 192),
        "worker/Pawn_Run Gold.png": (6, 192),
        "worker/Pawn_Interact Pickaxe.png": (6, 192),
        "worker/Pawn_Idle Hammer.png": (8, 192),
        "worker/Pawn_Run Hammer.png": (6, 192),
        "worker/Pawn_Interact Hammer.png": (3, 192),
        "light/Archer_Idle.png": (6, 192),
        "light/Archer_Run.png": (4, 192),
        "light/Archer_Shoot.png": (8, 192),
        "scout/Lancer_Idle.png": (12, 320),
        "scout/Lancer_Run.png": (6, 320),
        "scout/Lancer_Right_Attack.png": (3, 320),
        "heavy/Warrior_Idle.png": (8, 192),
        "heavy/Warrior_Run.png": (6, 192),
        "heavy/Warrior_Attack1.png": (4, 192),
        "siege/Archer_Idle.png": (6, 192),
        "support/Idle.png": (6, 192),
        "support/Run.png": (4, 192),
        "support/Heal.png": (11, 192),
    }
    for role_file, (count, fh) in role_clips.items():
        role, fname = role_file.split("/", 1)
        for color in ("Blue Units", "Red Units"):
            unit_dir = {"worker": "Pawn", "light": "Archer", "scout": "Lancer", "heavy": "Warrior", "siege": "Archer", "support": "Monk"}[role]
            path = ASSETS / "Units" / color / unit_dir / fname
            if path.is_file():
                fw = fh  # sprites.js assumes square frames: frameW = round(width/count)
                size = png_size(path)
                if size:
                    sw, sh = size
                    actual_fw = round(sw / count)
                    rows += check(f"sprites.js {role}/{fname}", path, actual_fw, count, fh)
                break

    # --- ui.js tray portraits ---
    ui_defs = {
        "Pawn_Idle Pickaxe.png": (8, 192, 192),
        "Archer_Idle.png": (6, 192, 192),
        "Lancer_Idle.png": (12, 320, 320),
        "Warrior_Idle.png": (8, 192, 192),
        "Idle.png": (6, 192, 192),
    }
    unit_map = {
        "Pawn_Idle Pickaxe.png": "Pawn",
        "Archer_Idle.png": "Archer",
        "Lancer_Idle.png": "Lancer",
        "Warrior_Idle.png": "Warrior",
        "Idle.png": "Monk",
    }
    for fname, (count, fw, fh) in ui_defs.items():
        path = ASSETS / "Units" / "Blue Units" / unit_map[fname] / fname
        rows += check(f"ui.js {fname}", path, fw, count, fh)

    print("SPRITE SHEET AUDIT")
    print("=" * 100)
    hdr = f"{'source':<28} {'asset':<52} {'png':<12} {'fW':>4} {'#':>3} {'fH':>4}  result"
    print(hdr)
    print("-" * 100)
    mismatches = 0
    for r in rows:
        label, asset, png, fw, cnt, fh, result = r
        if result != "OK":
            mismatches += 1
        print(f"{label:<28} {asset:<52} {png:<12} {fw:>4} {cnt:>3} {fh:>4}  {result}")

    print("-" * 100)
    print(f"Total rows: {len(rows)}  Mismatches: {mismatches}")

    if "--crop" in sys.argv:
        save_crops()

    return 1 if mismatches else 0


def save_crops() -> None:
    """Save frame-0 crops using the same rects as runtime slicing."""
    try:
        from PIL import Image
    except ImportError:
        print("SKIP crop: Pillow not installed")
        return

    out = ROOT / "scripts" / "audit_crops"
    out.mkdir(parents=True, exist_ok=True)

    crops = [
        ("tree", ASSETS / "Terrain/Resources/Wood/Trees/Tree1.png", 0, 192, 256),
        ("rock", ASSETS / "Terrain/Decorations/Rocks in the Water/Water Rocks_01.png", 0, 128, 64),
        ("bush", ASSETS / "Terrain/Decorations/Bushes/Bushe1.png", 0, 128, 128),
    ]
    for name, path, frame, fw, fh in crops:
        if not path.is_file():
            print(f"SKIP crop {name}: missing {path.name}")
            continue
        img = Image.open(path)
        x0 = frame * fw
        box = (x0, 0, x0 + fw, fh)
        crop = img.crop(box)
        dest = out / f"{name}_frame{frame}_{fw}x{fh}.png"
        crop.save(dest)
        print(f"CROP {dest.relative_to(ROOT)}  ({crop.size[0]}x{crop.size[1]})")


if __name__ == "__main__":
    sys.exit(main())
