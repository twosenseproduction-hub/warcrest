# Headless Blender stage scripts (reference)

These are **reference implementations** for the deterministic governor described in
[`../README.md`](../README.md) §4. They are illustrative and dependency-light — enough to
build the real pipeline against, not a finished product. Each stage is a standalone script
invoked in Blender background mode.

## Invocation contract

```bash
blender -b --factory-startup --python-exit-code 1 \
  --python s06_cleanup.py -- \
  --in   runs/$RUN/05_symmetry.blend \
  --out  runs/$RUN/06_clean.blend \
  --config library/dna/raider_infantry.json \
  --thresholds ../qa-thresholds.json \
  --seed 12345 \
  --report runs/$RUN/06_cleanup.json
```

- `--factory-startup` → no user prefs/add-ons; identical environment every run.
- `--python-exit-code 1` → any uncaught Python exception fails the process (nonzero exit),
  so the orchestrator can detect hard-fails from the shell.
- `--` separates Blender args from script args (parsed by each script).
- Every script writes a JSON receipt to `--report` and sets `status` = `ok` /
  `fallback_used` / `hard_fail`.

## Determinism rules these scripts follow

1. Prefer `bmesh` / data API over `bpy.ops`. When an op is unavoidable, drive it with an
   explicit `context.temp_override(...)` and never depend on selection/active state.
2. Sort every collection before iterating (Blender iteration order is not guaranteed stable).
3. Seed any RNG from `--seed`; avoid stochastic operators where a deterministic path exists.
4. Read all epsilons/thresholds from `--config` / `--thresholds`; never hardcode ad hoc.
5. Pin the Blender build in the container image; the runner is the only entry point.

## Files

| Script | Stage | Does |
|--------|-------|------|
| `run_pipeline.sh`     | orchestrator | Runs the stage chain, stops on hard-fail, aggregates receipts |
| `s06_cleanup.py`      | S6  | Merge doubles, remove degenerate/loose, fix normals, validate manifold |
| `s08_landmark_rig.py` | S8  | Fit the canonical skeleton to landmarks + attach hand sub-rig |
| `s13_export.py`       | S13 | Multi-engine export from a fixed preset + round-trip verify |

The remaining stages (S2–S5, S7, S9–S12, S14–S15) follow the same pattern; these three are
provided as the representative hardest cases (repair, guided rigging, deterministic export).
