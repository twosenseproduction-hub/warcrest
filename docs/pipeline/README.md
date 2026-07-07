# Warcrest Character Pipeline — Production Blueprint

**A deterministic AI-assisted pipeline for consistent, game-ready 3D characters and reusable animations.**

Status: Design specification (v1). Headless Blender is the technical governor.
Philosophy modeled after high-throughput 3D pipelines (Meshy-style generate → rig → export)
and Mixamo-style guided auto-rigging and motion reuse — but re-engineered around
*determinism and stylistic consistency* rather than one-off creativity.

> **We are building our own product in this category — not a wrapper around Meshy/Tripo/Mixamo.**
> Those are benchmarks for UX and scope, and at most temporary MVP accelerants behind an
> adapter seam. The deterministic governor, DNA, rigging, retargeting, and consistency engine
> are proprietary IP we own from day one. See **[`OWNERSHIP.md`](./OWNERSHIP.md)** for the
> core-vs-rent-vs-benchmark map and the progressive rent→own replacement roadmap.

---

## 0. First principles

1. **Every AI output is a candidate, never a final asset.** Nothing enters the game
   library until it passes style, topology, rig, deformation, and export validation.
2. **Blender is the governor, not a participant.** Generation tools (our own models, or —
   temporarily — Meshy/Tripo behind an adapter) are treated as *untrusted, swappable upstream
   sources*. Blender in `--background` mode normalizes, validates, rigs, tests, and exports.
   If Blender rejects it, it does not ship. Because the governor is source-agnostic, we can
   swap a rented generator for our own model with zero downstream change (see
   [`OWNERSHIP.md`](./OWNERSHIP.md) §2).
3. **Consistency beats novelty.** We constrain the generative space aggressively:
   template meshes, canonical skeletons, locked palettes, fixed export presets.
4. **Determinism where possible, templating where not, humans only where necessary.**
   Every stage declares what is automated, what is templated, and what needs review.
5. **No magic, no perfection claims.** We *measure* style and *enforce* thresholds.
   We minimize drift; we do not claim to eliminate it.

The pipeline is a **funnel of increasing determinism**: a noisy generative front end
feeds a strict, scriptable, repeatable back end. The further right in the pipeline,
the more deterministic and the less creative.

```
 GENERATE (noisy)         GOVERN (deterministic)                    SHIP
 ┌───────────────┐   ┌──────────────────────────────────────┐   ┌────────┐
 │ Ref-guided /  │   │  Headless Blender: normalize →        │   │ Unity  │
 │ template gen  │──▶│  validate → retopo → landmark rig →   │──▶│ Unreal │
 │ (Meshy, T2-3D)│   │  weight → anim test → export → QA JSON │   │ Blender│
 └───────────────┘   └──────────────────────────────────────┘   │ Godot  │
        ▲                          │  reject                     └────────┘
        │                          ▼
   Character DNA ◀──────── QA report / drift metrics ──────▶ Style Bible
```

---

## Table of contents

1. [Pipeline architecture](#1-pipeline-architecture)
2. [Character DNA specification](#2-character-dna-specification)
3. [Style-consistency framework](#3-style-consistency-framework)
4. [Headless Blender automation design](#4-headless-blender-automation-design)
5. [Rigging system specification](#5-rigging-system-specification)
6. [Prompt-to-motion architecture](#6-prompt-to-motion-architecture)
7. [Retargeting framework](#7-retargeting-framework)
8. [Validation & QA scoring system](#8-validation--qa-scoring-system)
9. [Studio-learning / reference-learning system](#9-studio-learning--reference-learning-system)
10. [Repeatability strategy](#10-repeatability-strategy)
11. [Roadmap: MVP / Phase 2 / Phase 3](#11-roadmap)
12. [Companion files in this directory](#12-companion-files)

---

## 1. Pipeline architecture

### 1.1 Stage graph

The pipeline is a directed, resumable graph of **stages**. Each stage is a headless
Blender invocation (or a pre-Blender generation call) with a strict contract:
**inputs → outputs → validation → failure cases → fallback.** Every stage writes a
machine-readable receipt (`stage.json`) so the whole run is auditable and re-runnable
from any point.

| # | Stage | Runner | Automated / Templated / Human |
|---|-------|--------|-------------------------------|
| S0 | **Intent & brief** — resolve DNA class, seed, style pack | Orchestrator | Templated |
| S1 | **Generate / ingest mesh** — Meshy / T2-3D / artist upload | Vendor + fetch | Automated (gen) / Human (upload) |
| S2 | **Import & file validation** — format, scale sanity, manifold check | Blender | Automated |
| S3 | **Transform reset & origin alignment** | Blender | Automated |
| S4 | **Pose normalization** — force T-pose or A-pose | Blender | Automated + Human fallback |
| S5 | **Symmetry analysis** | Blender | Automated |
| S6 | **Cleanup & mesh repair** — degenerate faces, non-manifold, doubles | Blender | Automated |
| S7 | **Retopology / topology correction** | Blender (+external) | Automated / Human fallback |
| S8 | **Landmark-assisted auto-rig** — chin, shoulders, elbows, wrists, hips, knees, ankles | Blender | Templated + Human fallback |
| S9 | **Weighting** — auto weights → corrective passes | Blender | Automated + Human fallback |
| S10 | **Bone-name & hierarchy enforcement** | Blender | Automated |
| S11 | **Animation test suite** — canonical clips, deform QA | Blender | Automated |
| S12 | **Style-consistency scoring** vs Style Bible | Blender + analyzer | Automated |
| S13 | **Export packaging** — per-engine presets | Blender | Automated |
| S14 | **Thumbnails & QA snapshots** | Blender (EEVEE) | Automated |
| S15 | **QA report + gate decision** (approve / reject / needs-review) | Orchestrator | Automated + Human checkpoint |

Motion is a parallel track that joins at retargeting:

| # | Stage | Runner | Class |
|---|-------|--------|-------|
| M0 | **Prompt parse** — intent, style tags, energy, loop/one-shot, mask | Orchestrator | Templated |
| M1 | **Motion source** — library retrieval OR text-to-motion gen | Retrieval/gen | Automated |
| M2 | **Canonical-skeleton conform** — bind motion to canonical rig | Blender | Automated |
| M3 | **Cleanup** — foot-slide fix, contact preservation, loop stitch | Blender | Automated |
| M4 | **Retarget** to target approved rig(s) | Blender | Automated |
| M5 | **Motion QA** — slide, penetration, jitter, loop error | Blender | Automated |
| M6 | **Export clips / animation library entry** | Blender | Automated |

### 1.2 Orchestration model

- **One run = one candidate.** A run has a `run_id`, a frozen `dna_id`, a frozen
  `style_pack_id`, and a `seed`. All three are recorded in every receipt.
- **Content-addressed cache.** Each stage's output is keyed by
  `hash(stage_code + input_hash + config_hash + seed)`. Re-running with identical
  inputs returns the cached artifact — this is what makes the *governance* layer
  bit-for-bit deterministic even though the *generation* layer is not.
- **Resumable.** Any stage can be re-run in isolation given the previous stage's
  artifact. Failed runs park in a `needs-review/` bucket with their QA report.
- **Runner is just the CLI.** Every stage is:
  `blender -b --factory-startup --python stages/sNN_*.py -- --in ... --out ... --config ... --seed ...`
  No GUI, no add-on state, `--factory-startup` guarantees a clean environment each time.

### 1.3 Data flow / directory layout

```
library/
  dna/                     # Character DNA specs (versioned JSON)
  style_packs/             # Style bibles + reference metrics (versioned)
  templates/               # Approved template meshes per DNA class
  skeletons/               # Canonical skeleton .blend + JSON (per hand preset)
  motion_library/          # Curated, retarget-ready clips on canonical skeleton
  export_presets/          # Fixed per-engine export configs

runs/
  <run_id>/
    00_brief.json
    01_source.glb
    02_imported.blend
    ...                    # one artifact + one <stage>.json per stage
    qa_report.json         # aggregated machine-readable QA
    thumbnails/
    decision.json          # approve | reject | needs_review + reasons

approved/
  <dna_id>/<unit>/<version>/   # only assets that passed the gate land here
```

---

## 2. Character DNA specification

**Character DNA** is the contract that every asset in a family must satisfy. It is a
versioned JSON document (`library/dna/<dna_id>.json`). The machine-readable JSON Schema
lives at [`character-dna.schema.json`](./character-dna.schema.json); the summary below
explains each field and why it exists. DNA is inherited: a *faction* DNA sets broad
rules, a *unit family* DNA narrows them, a *unit* DNA pins the specifics. Children may
only **tighten** parent ranges, never widen them.

| DNA field | What it locks | Example (Warcrest "Raider Infantry") |
|-----------|---------------|--------------------------------------|
| `silhouette_class` | Readable shape category enforced at range | `bulky_bruiser` (broad shoulders, narrow legs) |
| `body_proportions` | Head-height ratio, limb ratios, shoulder/hip width ratios (min/max) | 5.5–6.0 heads tall; shoulder = 2.6–2.9 head-widths |
| `scale_m` | World scale in **meters**, feet-on-floor | height 1.9–2.1 m, origin at 0,0,0 between feet |
| `poly_budget` | Tri count range per LOD | LOD0 8k–14k, LOD1 4k–7k, LOD2 1.5k–3k tris |
| `topology_rules` | Quad-dominant %, edge-loop requirements at deform joints, pole limits | ≥90% quads, ≥3 loops at elbow/knee/shoulder, no >5-poles on deform bands |
| `material_slots` | Named slot list + max count | `body`, `armor`, `cloth`, `metal_trim` (max 4) |
| `uv_rules` | UDIM/atlas policy, min texel density, no overlaps (except mirrored), seam placement zones | single atlas, ≥512 px/m, seams hidden inner-arm/inner-leg |
| `texture_res_policy` | Resolution per map per LOD; channel packing | 2048 albedo/normal LOD0; ORM packed (Occlusion-Rough-Metal) |
| `color_palette` | Allowed hue/sat/val boundaries per slot (ΔE tolerance to swatches) | armor hue 200–230°, sat 0.2–0.5; skin from approved ramp only |
| `accessory_points` | Named empty sockets + transforms for attachments | `socket_hand_R`, `socket_hand_L`, `socket_back`, `socket_head` |
| `skeleton_hierarchy` | Canonical bone tree ID this DNA binds to | `canon_biped_v2` |
| `joint_naming` | Naming convention + side suffixes | `<Region>_<Joint>_<Index>.<L\|R>`, e.g. `Arm_Elbow.L` |
| `finger_schema` | Hand preset: 2 / 3 / 5 finger, thumb policy, bones per finger | `preset_3finger` (thumb + 2, 3 bones each) |
| `export_schema` | Which engines, up-axis, unit, LOD count, naming | Unity+Unreal+Godot+Blender; see export presets |

**Why DNA works:** it converts "make it look consistent" into *measurable numeric
ranges and enumerations*. Every validation check in §8 is literally a comparison
against a DNA field. Drift becomes a number, not an opinion.

See a filled example at [`examples/dna.raider_infantry.json`](./examples/dna.raider_infantry.json).

---

## 3. Style-consistency framework

Goal: keep a *growing* library visually coherent across a faction/race/unit family
without hand-inspecting every asset.

### 3.1 Three layers of enforcement

1. **Style Pack (the bible).** A versioned bundle per faction:
   `library/style_packs/<pack_id>/` containing:
   - `metrics.json` — measured reference ranges (proportions, silhouette, palette, detail density — see §9),
   - `swatches/` — approved color ramps (albedo, metal, cloth),
   - `template_meshes` list — the approved base meshes generation must vary *around*,
   - `material_recipes.json` — node-group presets per material slot,
   - `dos_and_donts.md` — human-authored art direction notes (the only prose part).

2. **Generation constraints (front-of-funnel).** Generation is never free-form:
   - reference-guided prompts include the style pack's canonical reference images,
   - template-constrained variation morphs an approved template within DNA ranges,
   - fixed negative prompts ban known failure modes ("blob", "melted", "extra limbs").

3. **Post-generation scoring (back-of-funnel, authoritative).** Blender + an analyzer
   measure the candidate and score it against `metrics.json`. This is the real gate —
   generation constraints reduce rejects, but scoring decides.

### 3.2 Style score

A weighted, thresholded score in `[0,1]` per candidate (weights configurable per pack):

| Dimension | Measured how | Default weight |
|-----------|--------------|----------------|
| Proportion fit | Bone-length ratios vs DNA ranges | 0.25 |
| Silhouette fit | Multi-view silhouette IoU / shape descriptors vs template band | 0.20 |
| Palette fit | Per-slot ΔE to approved swatches, % pixels in-gamut | 0.20 |
| Surface detail density | Normal-map frequency / curvature histogram vs reference band | 0.15 |
| Material treatment | Roughness/metal distribution vs recipe | 0.10 |
| Silhouette-class match | Classifier / descriptor into declared class | 0.10 |

Locked thresholds live in [`qa-thresholds.json`](./qa-thresholds.json). Below hard-fail
→ reject. Between hard-fail and pass → `needs_review`. Above pass → eligible for approval.

### 3.3 Drift control across a growing library

- Every approved asset's metrics are appended to `style_packs/<pack>/observed.jsonl`.
- A nightly job recomputes the **observed distribution** and flags **drift**: if the
  running mean of any metric moves beyond N σ from the bible's target, raise a
  "style drift" alert for art-direction review. The bible is the anchor; the library
  is monitored against it, never the reverse (prevents slow creep).

---

## 4. Headless Blender automation design

Blender runs **only** in background mode, one stage per process, factory settings, no
persistent add-on state. This is the deterministic core.

### 4.1 Invocation contract

```bash
blender -b --factory-startup \
  --python-exit-code 1 \
  --python stages/s06_cleanup.py -- \
  --in  runs/$RUN/05_symmetry.blend \
  --out runs/$RUN/06_clean.blend \
  --config library/dna/$DNA.json \
  --seed  $SEED \
  --report runs/$RUN/06_cleanup.json
```

Rules that make this repeatable:
- `--factory-startup` + explicit operator params (never rely on UI defaults),
- pin the Blender version (single container image, see §10),
- every stage script emits a JSON receipt and sets a nonzero exit code on hard-fail
  (`--python-exit-code 1` makes a Python exception fail the process),
- no `bpy.ops` where a `bmesh`/data-API path exists (ops depend on context/selection
  and are the #1 source of nondeterminism); when ops are unavoidable, drive them with
  an explicit `context.temp_override(...)`.

### 4.2 Stage-by-stage spec

Each stage below lists **inputs → outputs → validation → failure → fallback.**
Reference implementations are in [`blender/`](./blender/).

**S2 Import & file validation** — *in:* source mesh (glb/fbx/obj). *out:* `.blend`,
receipt. *validate:* single mesh root, tri count sane, no NaN verts, bounds not
degenerate, texture set present. *fail:* multi-part junk, empty mesh, corrupt file.
*fallback:* attempt per-format cleanup import; else reject with reason `bad_source`.

**S3 Transform reset & world-origin alignment** — apply all transforms
(`object.transform_apply` loc/rot/scale), recompute origin to floor-center
(min-Z plane, X/Y centroid), snap to world origin. *validate:* scale == (1,1,1),
origin within 1 mm of target. *fail:* non-uniform post-apply scale. *fallback:* none —
deterministic.

**S4 Pose normalization (T/A-pose)** — detect current pose from limb axis PCA; if not
within tolerance of canonical T/A-pose, deform toward it via a fitted proxy skeleton
(coarse landmark solve) then bake. *validate:* arm/leg axis angles within ±3° of target.
*fail:* pose too ambiguous (e.g. crouched/action-posed source). *fallback:* route to
**human pose-fix** checkpoint (rare; T-pose generation is a front-end prompt constraint).

**S5 Symmetry analysis** — mirror across X, measure Hausdorff/vertex-distance between
halves. *out:* `symmetry_score`, asymmetry heatmap. *validate:* score ≥ threshold.
*fail:* low symmetry. *fallback:* if intentional asymmetry flagged in DNA, skip; else
attempt symmetrize (`bmesh` mirror-merge) then re-measure; else `needs_review`.

**S6 Cleanup & mesh repair** — remove doubles (merge-by-distance at DNA epsilon),
delete loose/degenerate/zero-area faces, fix non-manifold, recalc normals outside,
fill holes below area threshold. *validate:* 0 non-manifold edges, 0 degenerate faces,
consistent normals. *fail:* holes above threshold, self-intersection. *fallback:*
voxel-remesh repair pass → route to S7.

**S7 Retopology / topology correction** — if quad% or edge-loop rules fail: run a
retopo path (Blender `remesh` quad mode, or external instant-meshes/ZRemesher called via
CLI, then re-import), then bake normals/AO from the original high-res as a detail-preserving
map. *validate:* DNA `topology_rules` (quad %, loops at joints, pole limits, tri budget).
*fail:* retopo destroys silhouette (silhouette IoU drop > tolerance). *fallback:*
`needs_review` with before/after snapshots. **This is the stage most likely to need a
human**; MVP prefers *template-constrained* meshes that already satisfy topology.

**S8 Landmark-assisted auto-rig** — the Mixamo-style guided step, made repeatable:
- Landmarks: **chin, shoulder.L/R, elbow.L/R, wrist.L/R, groin/hips, knee.L/R, ankle.L/R**.
- Landmark source, in priority order: (a) template inheritance — if built from an approved
  template, landmarks are already parameterized on it (fully deterministic); (b) automatic
  landmark detection from mesh geometry (curvature/extremity heuristics + proportion prior
  from DNA); (c) human placement in our own web tool
  [`tools/rig-landmark-calibrator.html`](../../tools/rig-landmark-calibrator.html), which
  writes the `landmarks.json` this stage consumes.
- Skeleton is **generated from the canonical skeleton by fitting**, not created fresh:
  we load `skeletons/<canon_id>.blend`, snap its joints to the landmarks, scale-fit
  segment lengths, and select the hand sub-rig by `finger_schema`. This guarantees the
  hierarchy/naming are always canonical.
- *validate:* every required joint placed, bone roll deterministic, symmetry of L/R
  landmarks. *fail:* missing/implausible landmark. *fallback:* human landmark placement.

**S9 Weighting** — automatic weights (heat/bone-glow), then **corrective passes**:
clamp to max N influences per vertex (DNA), normalize, mirror weights L↔R from the
cleaner side, smooth across joint bands, apply per-joint corrective bone hints for
shoulders/hips. *validate:* max-influence respected, weights normalized, no unweighted
verts, deform test (S11) passes. *fail:* candy-wrapper / collapse at a joint. *fallback:*
apply canonical corrective weight templates for that DNA class; else `needs_review`.

**S10 Bone-name & hierarchy enforcement** — rename/reorder to canonical
`joint_naming`, enforce parent chain, set side suffixes, verify against the canonical
skeleton's expected tree. *validate:* exact match to canonical hierarchy + naming regex.
*fail:* any mismatch → hard reject (this must be perfect for retargeting/export).

**S11 Animation test suite** — apply a fixed set of canonical stress clips from the
motion library (T-pose→A-pose, arm raise, deep squat, wrist twist, full-range walk).
Measure deformation quality: volume loss, self-intersection, jitter, joint collapse.
*out:* per-clip deform scores. *validate:* all within thresholds. *fail:* collapse.
*fallback:* back to S9 corrective pass once; else `needs_review`.

**S12 Style scoring** — compute the §3.2 style score. Deterministic given inputs.

**S13 Export packaging** — for each target engine, export with a **fixed preset**
(up-axis, unit scale, LOD set, smoothing, tangent space, animation flags). Presets in
[`export-presets.json`](./export-presets.json). *validate:* re-import round-trip check
(vertex count, bone count, scale preserved). *fail:* round-trip mismatch. *fallback:*
none — preset bug, halt and alert.

**S14 Thumbnails & QA snapshots** — EEVEE render at fixed camera rig (front/side/3-4,
turntable frames, wireframe, weight-map overlay, asymmetry heatmap). Deterministic
lighting rig. *out:* PNGs for the QA report and human review.

**S15 QA report + gate** — aggregate all receipts into `qa_report.json`, apply gate
logic (§8), write `decision.json`.

### 4.3 Determinism practices inside Blender

- Prefer `bmesh`/data API over `bpy.ops`; when ops are required use `temp_override`.
- Set and record RNG seeds for any stochastic operator; avoid stochastic ops where possible.
- Sort every collection before iterating (Blender iteration order is not guaranteed stable).
- Fixed float epsilons come from DNA/thresholds, never hardcoded ad hoc.
- Single pinned Blender build in the container image → same operators, same results.

---

## 5. Rigging system specification

### 5.1 Canonical skeletons

Rigs are **never** authored per-asset. There is a small set of canonical skeletons in
`library/skeletons/`, each a `.blend` + JSON descriptor. A DNA references exactly one.

- `canon_biped_v2` — base humanoid: spine (hips→spine01→spine02→chest→neck→head),
  clavicles, arms (shoulder→elbow→wrist), legs (hip→knee→ankle→ball→toe), plus the
  landmark joints the user requires (chin as a head child for facial anchor).
- Hand sub-rigs are swappable modules parented at `wrist.L/R`:
  - `hand_2finger` — thumb + 1 opposed digit (2 bones each) → creatures/claws.
  - `hand_3finger` — thumb + 2 digits (3 bones each) → stylized units.
  - `hand_5finger` — full human hand (thumb 3, fingers 3 bones).
- Every skeleton stores **fixed bone rolls** and **rest transforms** so fitting is the
  only per-asset variable. Naming follows DNA `joint_naming` exactly.

### 5.2 Joint & naming convention

`<Region>_<Joint>[_<Index>].<Side>` — e.g. `Spine_02`, `Arm_Elbow.L`, `Hand_Index_01.R`.
Root is `Root` (motion) → `Hips` (pelvis). Side suffix `.L`/`.R` only where symmetric.
The regex and full expected tree per skeleton live in the skeleton JSON and are enforced
at S10. **This is the linchpin of retargeting**: identical names + hierarchy across every
asset in a DNA family means motion retargets by name-mapping, deterministically.

### 5.3 Landmark → skeleton fitting (the guided auto-rig)

Required landmarks (user spec): **chin, shoulder.L/R, elbow.L/R, wrist.L/R, hips/groin,
knee.L/R, ankle.L/R.** Fitting algorithm (deterministic given landmarks):

1. Load canonical skeleton at rest.
2. Set `Hips` from groin/hips landmark; set chain endpoints from limb landmarks.
3. Solve segment lengths by landmark distances; scale bones, preserve canonical rolls.
4. Mirror L/R from the side with the higher-confidence landmarks for perfect symmetry.
5. Attach the hand sub-rig selected by `finger_schema`.
6. Emit `rig_fit.json` (per-joint residual to landmark) for QA.

Automated when landmarks come from a template or reliable detection; **human checkpoint**
only when detection confidence is low (writes `landmarks.json`, re-runs fitting).

### 5.4 Accessory sockets

DNA `accessory_points` become empties parented to bones with fixed local transforms
(`socket_hand_R` → `Hand_Wrist.R`, `socket_back` → `Spine_Chest`, etc.), exported as
attachment nodes so engines can mount weapons/gear consistently.

Full rig spec: [`examples/skeleton.canon_biped_v2.json`](./examples/skeleton.canon_biped_v2.json).

---

## 6. Prompt-to-motion architecture

Motion mirrors the mesh funnel: constrained sourcing → canonical conform → cleanup →
retarget → QA. **All motion lives on the canonical skeleton first**, then retargets out.

### 6.1 Motion intent parsing

A prompt is parsed into a structured `motion_intent.json` (templated grammar, not
free-form):

```jsonc
{
  "action": "attack",            // controlled vocab: idle|walk|run|attack|hit|die|cast|...
  "style_tags": ["heavy", "raider"],
  "emotion": "aggressive",       // controlled vocab
  "energy": 0.8,                 // 0..1 → amplitude/speed scaling
  "root_motion": false,          // false = in-place (RTS default)
  "loop": true,                  // loop vs one-shot
  "upper_body_mask": null,       // e.g. "spine02+" to layer an upper-body action
  "contacts": ["foot.L", "foot.R"],
  "seed": 12345
}
```

- **Style tags** map to a curated sub-set of the motion library and to blend parameters.
- **Emotion/energy** are *bounded* modifiers (amplitude, tempo, posture bias), not
  free generation — keeps results in-family.
- **In-place vs root motion:** RTS locomotion is engine-driven, so default `in_place`;
  root motion optional for cinematics. Controlled by a fixed root-extraction/bake step.
- **Loop vs one-shot:** loops get a stitch+phase-match pass; one-shots get hold frames.
- **Upper-body mask:** a bone-mask layer lets an upper-body action (e.g. throw) play over
  a lower-body locomotion clip.

### 6.2 Motion sourcing (staged by maturity — see roadmap)

1. **Retrieval (MVP):** nearest clip(s) in the curated library by intent vector.
   Fully deterministic, highest quality, in-style by construction.
2. **Retrieval + blend (Phase 2):** blend/parametrize retrieved clips (speed, energy,
   directional blend spaces) within locked bounds.
3. **Text-to-motion generation (Phase 3):** generative model proposes motion; it is
   then *conformed and validated identically to a retrieved clip* — generation never
   bypasses the governor.

### 6.3 Motion processing (Blender)

- **Canonical conform (M2):** bind incoming motion to `canon_biped_v2`.
- **Contact preservation & foot-slide cleanup (M3):** detect planted frames from
  velocity/height thresholds, pin contact bones, IK-correct drift, re-bake. Reduces
  foot-slide below a locked threshold (§8).
- **Loop stitching:** match first/last pose + velocity, blend seam, verify loop error.
- **Motion blending:** linear/spline blend between clips with masking for layered actions.

### 6.4 Output

Clips are stored canonical in `motion_library/` (reusable across every compatible rig)
and exported per-engine via §7 + export presets.

---

## 7. Retargeting framework

Because every approved rig shares the canonical hierarchy and naming (§5.2),
retargeting is **name-mapped and deterministic**, not a fuzzy solve.

### 7.1 Rig compatibility classes

A motion clip declares the **canonical skeleton + hand preset** it was authored on.
A target rig is *compatible* if it shares the canonical spine/limb tree; hand presets
may differ (finger channels are remapped or dropped deterministically):
`5→3→2` finger down-mapping uses a fixed correspondence table (thumb→thumb, primary
fingers by index, extra fingers dropped/averaged per table).

### 7.2 Retarget procedure (M4)

1. Load target approved rig + source clip (both canonical).
2. Build bone map from canonical names (identity for same preset; table for cross-preset).
3. Copy rotations bone-for-bone; scale root translation by hip-height ratio (root motion)
   or zero it (in-place).
4. Apply per-target **retarget corrections** if registered (rare offsets for stylized proportions).
5. Re-run contact/foot-slide cleanup on the target proportions.
6. Bake, validate (M5), export.

### 7.3 Validation

Foot-slide, ground penetration, self-intersection, jitter, loop error — all measured on
the *target* rig against locked thresholds. A retarget that fails is rejected, never
shipped "good enough."

---

## 8. Validation & QA scoring system

Every threshold is **locked** in [`qa-thresholds.json`](./qa-thresholds.json) and
versioned. Changing a threshold is a reviewed commit — this is how we prevent silent
standards creep.

### 8.1 Check categories & example gates

| Category | Representative checks | Hard-fail example |
|----------|----------------------|-------------------|
| **File/geometry** | manifold, degenerate faces, normals, scale, origin | any non-manifold edge |
| **Topology** | quad %, joint edge-loops, pole limit, tri budget/LOD | quad% < 85 |
| **Style** | proportion/silhouette/palette/detail scores (§3.2) | style_score < 0.75 |
| **Rig** | canonical hierarchy+naming, symmetry, landmark residual | any name mismatch |
| **Deformation** | volume loss, collapse, self-intersect on test clips | joint collapse > tol |
| **Motion** | foot-slide, penetration, jitter, loop error | foot-slide > 2 cm/frame |
| **Export** | round-trip vert/bone/scale parity per engine | round-trip mismatch |

### 8.2 Scoring & gate logic

- Each category yields a `[0,1]` score + boolean hard-fail flags.
- **Any hard-fail → REJECT** (with the specific failing check + snapshot).
- **All categories ≥ pass threshold, no hard-fail → APPROVE-eligible.**
- **In the gray band → NEEDS_REVIEW**, routed to a human with the exact metrics and
  before/after snapshots that put it there.
- Weighted composite score is recorded for trend/drift analytics, but **gating is
  rule-based, not just the composite** (a great style score cannot rescue a broken rig).

### 8.3 Automated rejection criteria (examples)

- Tri count outside DNA budget for its LOD.
- Non-canonical bone name or broken hierarchy.
- Palette ΔE beyond tolerance on > X% of a slot's texels.
- Foot-slide/penetration over threshold after cleanup.
- Export round-trip alters vertex/bone count or scale.

### 8.4 The QA report

`qa_report.json` (schema in [`qa-report.schema.json`](./qa-report.schema.json)) contains:
run/dna/style/seed IDs, per-stage receipts, every check with value + threshold + pass/fail,
composite scores, thumbnail paths, and the final `decision`. Human-readable render is
generated for review; the JSON is the source of truth.

### 8.5 Human review checkpoints (only where necessary)

1. **Pose ambiguity** (S4) — rare, action-posed source.
2. **Retopo silhouette loss** (S7) — the most common human touchpoint.
3. **Weighting collapse** (S9/S11) after auto-correction fails.
4. **Landmark low-confidence** (S8).
5. **NEEDS_REVIEW gray-band** at the final gate (S15).
Everything else is automated.

---

## 9. Studio-learning / reference-learning system

**No imitation-magic claims.** We *measure* reference sets and turn measurements into a
constraint system (the Style Pack of §3). Lawful: use only references you have rights to
(your own art, licensed packs, commissioned refs). We learn *measurable style parameters*,
not copyrighted specifics.

### 9.1 What we extract from a reference set

| Characteristic | Measurement | Feeds |
|----------------|-------------|-------|
| Proportion ranges | Head-height, limb, shoulder/hip ratios (from rigged or landmarked refs) | DNA `body_proportions`, style score |
| Silhouette tendencies | Multi-view silhouette descriptors / shape moments, distribution band | `silhouette_class`, silhouette check |
| Shape language | Curvature histograms (angular vs rounded), primitive decomposition stats | detail/silhouette scoring |
| Surface detail density | Normal/curvature frequency spectrum, feature count per area | detail-density check |
| Palette logic | Clustered dominant colors, hue/sat/val ranges per region | `color_palette` swatches |
| Material treatment | Roughness/metalness distributions, edge-wear patterns | material recipes |
| Clothing/armor layering | Layer-count and coverage patterns per body region | template/recipe priors |
| Face feature ratios | Eye/nose/mouth spacing ratios (where faces matter) | facial proportion constraints |
| Rig complexity class | Bone count, finger count, extra-joint patterns | picks canonical skeleton + hand preset |

### 9.2 From observations to a Style Bible

1. **Ingest** the licensed reference set; auto-measure each characteristic → distributions.
2. **Fit ranges**: target = central tendency, allowed band = trimmed percentile (e.g.
   10th–90th) → written as DNA ranges + style-score target bands.
3. **Extract swatches & recipes**: cluster palettes, capture material node presets.
4. **Select template meshes & skeleton/hand preset** that sit at the distribution center.
5. **Human art-direction pass**: a lead confirms/edits the bible (`dos_and_donts.md`) —
   the one irreducibly human step; measurement proposes, art direction disposes.
6. **Version & freeze** the Style Pack. All generation constraints and QA thresholds
   derive from it.

### 9.3 Closing the loop

Approved assets feed `observed.jsonl`; drift monitoring (§3.3) compares the growing
library against the frozen bible and flags creep for review. The bible is never
auto-updated from generated output (that would launder drift into the standard).

---

## 10. Repeatability strategy

The whole point. How we get as close to deterministic studio output as possible.

| Lever | Mechanism |
|-------|-----------|
| **Seed control** | Every run pins a `seed`; every stochastic step consumes/records it. Same seed + same inputs + same config → same candidate. Recorded in every receipt. |
| **Approved template meshes** | Generation varies *around* approved templates within DNA ranges rather than free-synthesizing — collapses the variance that causes blobs. |
| **Canonical skeletons** | Rigs are fitted from a fixed skeleton set, never authored fresh; hierarchy/naming/rolls are constant. |
| **Fixed export presets** | Per-engine presets are version-controlled JSON; export is parameter-free at call site. |
| **Deterministic naming** | Bones, materials, UVs, sockets, files, LODs all follow enforced conventions (regex-validated at S10/S13). |
| **Locked validation thresholds** | All gates in `qa-thresholds.json`; changes are reviewed commits. |
| **Automated rejection** | Objective, rule-based rejects (no vibes) — §8.3. |
| **Pinned toolchain** | Single container image with a pinned Blender build + pinned external tools; the runner is the only entry point. Same bits everywhere (dev, CI, batch). |
| **Content-addressed cache** | Governance stages are pure functions of (input, config, seed) → reproducible artifacts, resumable runs, auditable diffs. |
| **Human checkpoints minimized & logged** | Human input is captured as data (`landmarks.json`, review decisions) so a re-run replays the human choice deterministically. |

**Determinism boundary (be honest):** the *generation* front end (S1/M1 with 3rd-party
models) is not bit-deterministic even with a seed — vendors change models, sampling is
stochastic. We therefore make everything *downstream* of generation deterministic and
gate hard. Repeatability is achieved by (a) constraining generation heavily and
(b) making the governor reproducible. We minimize drift; we do not claim zero drift.

---

## 11. Roadmap

### MVP — "Deterministic governor + template-constrained assets"
Prove consistency with the least generative risk.
- **Generation:** reference-guided + **template-constrained variation** only (vary an
  approved template within DNA ranges) — this is *our* IP. No free text-to-3D in the critical
  path. A rented generator (Meshy/Tripo) may sit behind the `MeshSource` adapter for net-new
  bases only, isolated and measured, per [`OWNERSHIP.md`](./OWNERSHIP.md).
- **Blender governor:** S2–S6, S8 (landmark from template + human fallback), S9–S11,
  S13–S15. S7 retopo mostly avoided because templates are already clean.
- **Rig:** `canon_biped_v2` + one hand preset to start; landmark placement web tool.
- **Motion:** **library retrieval only** (M0–M6 with M1 = retrieval). Hand-curated clips.
- **Style:** one Style Pack (one faction), full style scoring + gate.
- **Exports:** two engines first (e.g. Unity + Godot), presets round-trip-verified.
- **Deliverable:** a run produces an approved, rigged, animated, multi-engine asset from
  a template + prompt, fully via CLI, with a QA report. Consistency measurable via drift dashboard.

### Phase 2 — "Guided generation + parametric motion"
- **Generation:** reference-guided **text-to-3D** entering the funnel, still gated by the
  full governor; retopo path (S7) hardened for messier inputs.
- **Rig:** all three hand presets (2/3/5), auto-landmark detection to cut human touches.
- **Motion:** **retrieval + blending** — blend spaces (locomotion), energy/emotion
  parametrization, upper-body masks, one-shot↔loop tooling.
- **Retargeting:** cross-preset finger down-mapping, per-target corrections.
- **Scale:** multiple Style Packs / factions; automated drift alerts; batch runs in CI.
- **Style learning:** semi-automated Style Pack authoring from reference sets (§9).

### Phase 3 — "Generative synthesis under governance"
- **Generation:** freer **text-to-3D** and **text-to-motion** as first-class sources —
  but *identically gated*; nothing bypasses Blender validation.
- **Motion:** generative motion conformed + validated like retrieved clips; larger
  learned motion library.
- **Automation:** near-zero routine human review (checkpoints reserved for genuine
  ambiguity); self-service unit creation for designers via the intent grammar.
- **Advanced:** LOD auto-generation, facial/secondary rigs, cloth/armor sim presets,
  cross-faction style transfer *within* measured constraints.

Throughout all phases the invariant holds: **candidate → govern → validate → gate →
approve.** Capability grows at the front; the deterministic governor and its gates only
get stricter and better instrumented.

---

## 12. Companion files

| File | Purpose |
|------|---------|
| [`OWNERSHIP.md`](./OWNERSHIP.md) | Core-vs-rent-vs-benchmark IP map + rent→own replacement roadmap |
| [`../../tools/rig-landmark-calibrator.html`](../../tools/rig-landmark-calibrator.html) | Working guided landmark tool (2-view ortho) → exports `landmarks.json` |
| [`../../tools/rig-landmark-calibrator-3d.html`](../../tools/rig-landmark-calibrator-3d.html) | 3D version — click landmarks on the actual GLB in a three.js viewport → `landmarks.json` |
| [`character-dna.schema.json`](./character-dna.schema.json) | JSON Schema for Character DNA |
| [`qa-thresholds.json`](./qa-thresholds.json) | Locked validation thresholds |
| [`qa-report.schema.json`](./qa-report.schema.json) | Schema for the machine-readable QA report |
| [`export-presets.json`](./export-presets.json) | Fixed per-engine export presets |
| [`examples/dna.raider_infantry.json`](./examples/dna.raider_infantry.json) | Filled DNA example |
| [`examples/skeleton.canon_biped_v2.json`](./examples/skeleton.canon_biped_v2.json) | Canonical skeleton descriptor |
| [`blender/README.md`](./blender/README.md) | How the headless stage scripts work |
| [`blender/run_pipeline.sh`](./blender/run_pipeline.sh) | Reference orchestration entry point |
| [`blender/s06_cleanup.py`](./blender/s06_cleanup.py) | Reference cleanup/repair stage |
| [`blender/s08_landmark_rig.py`](./blender/s08_landmark_rig.py) | Reference landmark→canonical-skeleton fitting stage |
| [`blender/s13_export.py`](./blender/s13_export.py) | Reference multi-engine export stage |
