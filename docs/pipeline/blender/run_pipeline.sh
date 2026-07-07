#!/usr/bin/env bash
# Reference orchestrator for the deterministic governor (docs/pipeline/README.md §1.2, §4).
# Runs stages in order, stops on the first hard-fail (nonzero exit from --python-exit-code 1),
# and leaves a per-stage JSON receipt. A real build would replace this with a proper task
# runner (content-addressed cache, resume-from-stage, parallel motion track), but the
# contract is identical: one Blender process per stage, factory startup, JSON receipt.
#
# Usage:
#   BLENDER=/opt/blender/blender \
#   ./run_pipeline.sh <run_id> <source_mesh> <dna_json> <seed>
set -euo pipefail

BLENDER="${BLENDER:-blender}"
HERE="$(cd "$(dirname "$0")" && pwd)"
THRESHOLDS="$HERE/../qa-thresholds.json"

RUN_ID="${1:?run_id required}"
SRC="${2:?source mesh required}"
DNA="${3:?dna json required}"
SEED="${4:-12345}"

RUN_DIR="runs/$RUN_ID"
mkdir -p "$RUN_DIR"
cp "$SRC" "$RUN_DIR/01_source.${SRC##*.}"

# stage <script> <in> <out>
stage() {
  local script="$1" in_path="$2" out_path="$3" name
  name="$(basename "$script" .py)"
  echo ">>> $name"
  "$BLENDER" -b --factory-startup --python-exit-code 1 \
    --python "$HERE/$script" -- \
    --in "$in_path" --out "$out_path" \
    --config "$DNA" --thresholds "$THRESHOLDS" \
    --seed "$SEED" --report "$RUN_DIR/${name}.json" \
    || { echo "!!! HARD FAIL at $name — parking run in needs-review/"; \
         mkdir -p "needs-review/$RUN_ID"; cp -r "$RUN_DIR"/* "needs-review/$RUN_ID/"; exit 1; }
}

# NOTE: only the three representative stages ship as reference scripts. The commented
# lines show where the remaining stages slot into the chain (see README §4.2).

# stage s02_import.py        "$RUN_DIR/01_source.${SRC##*.}" "$RUN_DIR/02_imported.blend"
# stage s03_transform.py     "$RUN_DIR/02_imported.blend"    "$RUN_DIR/03_transform.blend"
# stage s04_pose_norm.py     "$RUN_DIR/03_transform.blend"   "$RUN_DIR/04_pose.blend"
# stage s05_symmetry.py      "$RUN_DIR/04_pose.blend"        "$RUN_DIR/05_symmetry.blend"
  stage s06_cleanup.py       "$RUN_DIR/05_symmetry.blend"    "$RUN_DIR/06_clean.blend"
# stage s07_retopo.py        "$RUN_DIR/06_clean.blend"       "$RUN_DIR/07_retopo.blend"
  stage s08_landmark_rig.py  "$RUN_DIR/07_retopo.blend"      "$RUN_DIR/08_rig.blend"
# stage s09_weights.py       "$RUN_DIR/08_rig.blend"         "$RUN_DIR/09_weights.blend"
# stage s10_bone_naming.py   "$RUN_DIR/09_weights.blend"     "$RUN_DIR/10_named.blend"
# stage s11_anim_test.py     "$RUN_DIR/10_named.blend"       "$RUN_DIR/11_animtest.blend"
# stage s12_style_score.py   "$RUN_DIR/11_animtest.blend"    "$RUN_DIR/12_scored.blend"
  stage s13_export.py        "$RUN_DIR/12_scored.blend"      "$RUN_DIR/exports"
# stage s14_thumbnails.py    "$RUN_DIR/12_scored.blend"      "$RUN_DIR/thumbnails"
# stage s15_gate.py          "$RUN_DIR"                       "$RUN_DIR/qa_report.json"

echo ">>> run $RUN_ID complete — see $RUN_DIR/*.json"
