# Ownership Map — Build the Product, Not a Wrapper

**Goal:** build our own product in the category of **Meshy, Tripo, and Mixamo** — usable
internal IP we own and control — *not* a thin wrapper around their APIs. Those services are
**benchmarks** for UX, pipeline design, and feature scope, and at most **temporary
accelerants** for an MVP. Every external dependency must be behind a seam we can cut.

This document is the strategic companion to [`README.md`](./README.md). The README describes
*what the pipeline does*; this describes *what we own, what we rent, and how the rented parts
get replaced by our own IP over time.*

> Design principle: **default to owning.** We never say "just use Meshy" or "just use Tripo."
> Where we lean on a third party to ship faster, it is named, isolated, and scheduled for
> replacement. The deterministic governor (headless Blender + our DNA/QA/consistency system)
> is ours from day one and is the moat.

---

## 1. Three-bucket classification

Every capability in the pipeline is tagged as one of:

- 🟩 **CORE (own now / own soon)** — proprietary IP, the product's value. Never outsourced.
- 🟨 **RENT (temporary external dependency)** — a third-party API used behind an adapter to
  accelerate MVP. Isolated, measured, and scheduled for replacement.
- 🟦 **BENCH (benchmark-inspired feature)** — a UX/scope target we copy *as a spec*, then
  implement ourselves.

### 1.1 Capability ledger

| Capability | Bucket | Own it because… | If rented, the seam |
|-----------|--------|-----------------|---------------------|
| **Character DNA spec + enforcement** | 🟩 CORE | This *is* the consistency product; nobody else has our DNA. | — |
| **Headless Blender governor** (normalize, validate, repair, QA, export) | 🟩 CORE | Deterministic, scriptable, free, fully in our control. | — |
| **Canonical skeletons + landmark→rig fitting** | 🟩 CORE | Our rig logic is the retarget backbone; Mixamo-style, but ours. | — |
| **Rig landmark calibrator tool** | 🟩 CORE | Human-checkpoint UX we own (see `tools/rig-landmark-calibrator.html`). | — |
| **Retargeting (name-mapped canonical)** | 🟩 CORE | Deterministic because *we* defined the naming; no vendor needed. | — |
| **Consistency / style-scoring engine** | 🟩 CORE | The differentiator. Measurable style enforcement is our IP. | — |
| **QA scoring + gate + drift monitoring** | 🟩 CORE | Governs everything; must be ours. | — |
| **Motion library (curated, canonical)** | 🟩 CORE | Grows into our proprietary dataset & motion model training set. | — |
| **Export presets (Unity/Unreal/Godot/Blender)** | 🟩 CORE | Just Blender config we author. | — |
| **Base mesh generation (text/image→3D)** | 🟨→🟩 RENT→CORE | Meshy/Tripo accelerate MVP; replace with our fine-tuned generator. | `MeshSource` adapter (§2) |
| **Auto-topology / retopo assist** | 🟨→🟩 RENT→CORE | External instant-meshes/ZRemesher CLI at first; own remesher later. | `RetopoProvider` adapter |
| **Text→motion synthesis** | 🟨→🟩 RENT→CORE | Retrieval first (ours), rent generative motion only in Phase 3, then own. | `MotionSource` adapter |
| **Guided auto-rig UX** (marker placement) | 🟦 BENCH → 🟩 CORE | Mixamo's UX is the *spec*; our calibrator is the implementation. | — |
| **Browser generate→rig→animate→export flow** | 🟦 BENCH → 🟩 CORE | Meshy's product flow is the scope target; we build our own web UI. | — |
| **Motion reuse / retarget-to-any-rig** | 🟦 BENCH → 🟩 CORE | Mixamo's promise; delivered by our canonical-skeleton system. | — |

**Read:** everything that makes output *consistent, rig-ready, and reusable* is CORE and
ours today. Only raw *generation* (mesh, and later motion) is rented — and only behind an
adapter, only until our own models are good enough.

---

## 2. The adapter seam (how "rented" stays cuttable)

Rented capabilities are **never called directly** from the pipeline. Each sits behind a
narrow, provider-agnostic interface. Swapping Meshy→Tripo→our-own-model is a config change,
not a rewrite. The governor downstream doesn't know or care which provider produced the mesh —
it validates the candidate identically either way.

```
                        ┌───────────────── our code (CORE) ─────────────────┐
 prompt / brief ──▶ MeshSource.generate(brief, seed) ─▶ candidate.glb ─▶ Blender governor
                        │  interface (OUR contract)                          │
                        └── impl: MeshyProvider | TripoProvider | OwnModelProvider (pluggable)
```

`MeshSource` interface (illustrative — the contract is ours, implementations are swappable):

```python
class MeshSource(Protocol):
    id: str                      # "meshy" | "tripo" | "warcrest_gen_v1"
    def generate(self, brief: Brief, seed: int) -> CandidateMesh: ...
    def capabilities(self) -> Caps: ...     # supports_image_ref, max_poly, textured, ...
```

Rules that keep the seam clean:
1. **Our data model on both sides.** Providers translate to/from *our* `Brief` and
   `CandidateMesh` — vendor payloads never leak past the adapter.
2. **Provider is recorded, not trusted.** Every run's QA report stores `mesh_source.id` +
   version, so we can measure per-provider approval/reject rates and prove when our own model
   matches or beats the rented one.
3. **The governor is the equalizer.** Because normalize/validate/rig/QA are identical
   regardless of source, a worse provider just means more rejects — never inconsistent
   shipped assets. This lets us A/B providers (including our own) safely.
4. **Kill switch by config.** `providers.yaml` picks the active `MeshSource`/`MotionSource`
   per DNA family. Cutting a vendor = point it at `OwnModelProvider`.

The same seam pattern applies to `RetopoProvider` and `MotionSource`.

---

## 3. Progressive replacement roadmap (rent → own)

We ship value immediately with rented generation, then replace each rented piece with our own
IP as our data and models mature. The **CORE governor never changes** — it only gets better
gates. This is how a startup gets a usable product now *and* a defensible one later.

| Stage | Mesh generation | Topology | Motion | Consistency engine |
|-------|-----------------|----------|--------|--------------------|
| **MVP** | 🟩 Template-constrained variation (ours) + 🟨 optional Meshy/Tripo for net-new bases, behind `MeshSource` | 🟩 clean templates avoid retopo; 🟨 external remesher fallback | 🟩 retrieval from our curated library | 🟩 full DNA + style scoring + gate (ours) |
| **Phase 2** | 🟨 rented gen still allowed, but 🟩 our fine-tuned generator (trained on approved+templates) enters A/B | 🟩 our remesher trained on approved topology | 🟩 retrieval + our parametric blending | 🟩 + drift monitoring, multi-pack, learned metrics |
| **Phase 3** | 🟩 our generator is default; rented providers demoted to fallback/benchmark | 🟩 ours only | 🟩 our text→motion model, gated like any source; rented motion only as benchmark | 🟩 our consistency engine as a standalone product surface |

**Data flywheel (why replacement is realistic):** every approved asset + its DNA + QA metrics
+ landmarks + retarget mappings become labeled training data we own. The governor is a
*continuous labeling machine*. Rented providers bootstrap the flywheel; our own models take
over as the dataset compounds. The consistency engine and the proprietary dataset are the
long-term moat — not the raw generator, which everyone will eventually commoditize.

---

## 4. What we build ourselves, starting now

The first pieces of usable internal IP — buildable without any third-party model:

1. **Rig landmark calibrator** (`tools/rig-landmark-calibrator.html`) — shipped in this PR.
   Guided marker placement (chin, shoulders, elbows, wrists, hips, knees, ankles) that
   exports the `landmarks.json` the headless rigger consumes. Mixamo's guided-rig UX as the
   benchmark; the implementation, data format, and symmetry/QA logic are ours. Built the same
   self-contained, zero-build way as the map export tool.
2. **DNA + thresholds + schemas** (this PR) — the enforceable contract layer.
3. **Headless Blender governor** (reference stages in this PR) — normalize/validate/rig/export.
4. **Provider adapters** (`MeshSource`/`MotionSource`/`RetopoProvider`) — the seams that keep
   any rented piece temporary.

Meshy/Tripo/Mixamo remain on the wall as benchmarks. We measure ourselves against their UX
and feature scope — and we own the pipeline that makes the output consistent, which is the
part they don't sell and the part our game actually needs.
