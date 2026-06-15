#!/usr/bin/env python3
"""Validate Pixel Labs animation batch manifests and exported PNG strips."""
from __future__ import annotations

import argparse
import json
import struct
import sys
from pathlib import Path
from typing import Any


REQUIRED_DIRECTIONS = {"down", "right", "up", "left"}
REQUIRED_ANIMATIONS = {"idle", "walk", "attack"}


def png_size(path: Path) -> tuple[int, int] | None:
    if not path.is_file():
        return None
    with path.open("rb") as f:
        sig = f.read(8)
        if sig != b"\x89PNG\r\n\x1a\n":
            return None
        _length, chunk = struct.unpack(">I4s", f.read(8))
        if chunk != b"IHDR":
            return None
        width, height = struct.unpack(">II", f.read(8))
        return width, height


def require(condition: bool, message: str, errors: list[str]) -> None:
    if not condition:
        errors.append(message)


def validate_manifest(data: dict[str, Any], manifest_path: Path, check_files: bool) -> list[str]:
    errors: list[str] = []

    output = data.get("output", {})
    frame_w = output.get("frameWidth")
    frame_h = output.get("frameHeight")
    jobs = data.get("jobs")

    require(data.get("tool") == "pixel-labs", "tool must be 'pixel-labs'", errors)
    require(isinstance(frame_w, int) and frame_w > 0, "output.frameWidth must be a positive integer", errors)
    require(isinstance(frame_h, int) and frame_h > 0, "output.frameHeight must be a positive integer", errors)
    require(isinstance(jobs, list), "jobs must be a list", errors)
    if not isinstance(jobs, list):
        return errors

    expected_pairs = {(direction, animation) for direction in REQUIRED_DIRECTIONS for animation in REQUIRED_ANIMATIONS}
    seen_pairs: set[tuple[str, str]] = set()
    seen_ids: set[str] = set()

    for index, job in enumerate(jobs):
        label = f"jobs[{index}]"
        if not isinstance(job, dict):
            errors.append(f"{label} must be an object")
            continue

        job_id = job.get("id")
        direction = job.get("direction")
        animation = job.get("animation")
        frames = job.get("frames")
        output_file = job.get("outputFile")
        prompt = job.get("prompt")

        require(isinstance(job_id, str) and job_id, f"{label}.id must be a non-empty string", errors)
        if isinstance(job_id, str):
            require(job_id not in seen_ids, f"duplicate job id: {job_id}", errors)
            seen_ids.add(job_id)

        require(direction in REQUIRED_DIRECTIONS, f"{label}.direction must be one of {sorted(REQUIRED_DIRECTIONS)}", errors)
        require(animation in REQUIRED_ANIMATIONS, f"{label}.animation must be one of {sorted(REQUIRED_ANIMATIONS)}", errors)
        if direction in REQUIRED_DIRECTIONS and animation in REQUIRED_ANIMATIONS:
            pair = (direction, animation)
            require(pair not in seen_pairs, f"duplicate direction/animation pair: {direction}/{animation}", errors)
            seen_pairs.add(pair)

        require(isinstance(frames, int) and frames > 0, f"{label}.frames must be a positive integer", errors)
        require(isinstance(output_file, str) and output_file.endswith(".png"), f"{label}.outputFile must be a PNG path", errors)
        require(isinstance(prompt, str) and len(prompt.strip()) >= 40, f"{label}.prompt must be descriptive", errors)

        if check_files and isinstance(output_file, str) and isinstance(frames, int) and isinstance(frame_w, int) and isinstance(frame_h, int):
            sprite_path = (manifest_path.parent / ".." / ".." / ".." / output_file).resolve()
            size = png_size(sprite_path)
            require(size is not None, f"{output_file} is missing or is not a PNG", errors)
            if size is not None:
                expected_size = (frame_w * frames, frame_h)
                require(size == expected_size, f"{output_file} is {size[0]}x{size[1]}, expected {expected_size[0]}x{expected_size[1]}", errors)

    missing_pairs = expected_pairs - seen_pairs
    extra_pairs = seen_pairs - expected_pairs
    require(not missing_pairs, f"missing direction/animation pairs: {sorted(missing_pairs)}", errors)
    require(not extra_pairs, f"unexpected direction/animation pairs: {sorted(extra_pairs)}", errors)
    require(len(jobs) == len(expected_pairs), f"expected {len(expected_pairs)} jobs, found {len(jobs)}", errors)

    return errors


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("manifest", type=Path, help="Path to a Pixel Labs batch JSON manifest")
    parser.add_argument("--check-files", action="store_true", help="Also validate exported PNG dimensions")
    args = parser.parse_args()

    try:
        data = json.loads(args.manifest.read_text())
    except OSError as exc:
        print(f"ERROR: cannot read manifest: {exc}", file=sys.stderr)
        return 2
    except json.JSONDecodeError as exc:
        print(f"ERROR: invalid JSON: {exc}", file=sys.stderr)
        return 2

    if not isinstance(data, dict):
        print("ERROR: manifest root must be an object", file=sys.stderr)
        return 2

    errors = validate_manifest(data, args.manifest.resolve(), args.check_files)
    if errors:
        print("Pixel Labs batch validation failed:")
        for error in errors:
            print(f"- {error}")
        return 1

    mode = "manifest and PNG exports" if args.check_files else "manifest"
    print(f"Pixel Labs batch {mode} OK: {args.manifest}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

