# Warcrest — Design Direction

> **The pitch:** the Blizzard favorites, on mobile. Not a Warcraft port, not a
> Thronefall clone — the Blizzard *fantasy* delivered through a mobile-native
> control chassis borrowed from Thronefall.

## The core insight

Blizzard RTS and Thronefall own different layers, and those layers **stack**
instead of fighting:

- **Blizzard owns the fantasy layer** — heroes with abilities and levels,
  distinct faction identity, the "tech up to unlock the cool unit" power
  spike, army composition and counters, map control (creeps, expansions,
  neutral objectives).
- **Thronefall owns the control layer** — you pilot *one* avatar directly,
  your troops auto-fight, you build on *anchored slots* (choosing *when* and
  *what*, never fiddling with *where*), and play happens in a bounded
  prep → fight → reward rhythm with minimal, silhouette-first UI.

The one thing we throw out is the thing that never worked on a phone:
**APM** — box-select, per-unit micro, camera-drag building placement. Thronefall
already solved every one of those. So the marriage is precise: *keep the
Blizzard dream; replace the Blizzard input model with Thronefall's.*

What makes this a **new** game and not either parent: Thronefall has no heroes,
no faction tech identity, no army comps, no map control. Warcraft has no
bounded session, no APM-free control, no anchored building. Warcrest lives in
the middle that neither occupies.

## The six pillars

### 1. You are the Hero — *(control)*
One avatar under your thumb (twin-stick / tap-to-move), with a Warcraft-style
hero kit: levels, 2–3 abilities, an ultimate. This is the whole answer to
touch controls — one thing to steer — and it *is* the Blizzard hero fantasy,
not a compromise of it. (We already have the Thoryn / demon-hunter model.)

### 2. Your army fights *with* you, not *through* you — *(combat)*
Trained units auto-rally to the hero, auto-engage, and hold formation. You
issue **stance/rally-level orders** (follow / hold / attack-move toward a ping),
never clicks-per-second. Blizzard keeps its army comps and counters; Thronefall
keeps its zero-APM promise. Auto-attack baseline, with the *hero's* active
abilities as the skill-expression ceiling.

### 3. Build by choosing *when* and *what*, on anchored plots — *(economy/base)*
Fixed build anchors (Thronefall) — but each anchor spends a choice from the
**faction tech tree** (Blizzard). You keep the tech-up dopamine and faction
identity; you lose the placement fiddliness and the turtling. Per-mission
anchor layouts let us hand-author interesting risk/vulnerability, exactly as
Thronefall does.

### 4. A rhythm, not a slog — *(session)*
Bounded encounters: **prep phase → assault/defend phase → reward + upgrade.**
Light roguelite meta between missions (perks, unlocks). Designed for repeated
~15–20 min sessions on a phone, not 100-hour marathons. Complexity is *layered*
across missions, never front-loaded.

### 5. A living, Warcraft-flavored map — *(world)*
Creep camps, neutral shrines / mercenaries, contestable expansions, day/night.
Map control matters (Blizzard), but every element reads at a glance
(Thronefall minimalism). Our 3D toon terrain already supports this.

### 6. Minimal, silhouette-first presentation — *(clarity + scope)*
Limited palette, readable silhouettes, minimal UI. We have the toon renderer;
the discipline is to keep enforcing palette + silhouette clarity. And the
Thronefall meta-rule the studio lived by: **"not getting finished is the
biggest threat."** Ship tiny, layer complexity onto a proven core.

## The control question — the third path (chosen to explore)

Pillars 1–2 above describe the *safe* answer to touch: control one hero, let
troops auto-fight, spend no APM. But the higher-reward bet is to **not
surrender APM at all** — to master it on mobile by inventing a control grammar
*native* to touch instead of porting the mouse's.

APM fails on phones because studios replicate mouse+keyboard on a surface that
has none of its strengths (hover, pixel-click, right-click verbs, a keyboard of
hotkeys). But touch has strengths the mouse doesn't: **multi-touch parallelism,
gestures, and direct manipulation.** Build command around *those*:

- **Gesture verbs** — lasso-loop to select; draw a line from a squad to a point
  = attack-move along it; draw an arc = flank; flick a group at a target =
  focus-fire. Drawing a flank is *faster* than mouse waypoints.
- **Persistent squad cards = visible control groups** — the pro's 1-2-3-4
  hotkeys, on-screen and thumb-reachable, showing status so you command a
  squad without camera-visiting it.
- **Hold-radial for verbs** — hold a squad, a command wheel blooms under the
  thumb. Replaces right-click + keyboard.
- **Two-tap ability casting (arm → target)** — the real skill ceiling
  (blink / ensnare / storm). The APM that *matters* in Blizzard games is
  ability micro, not move-clicks.
- **Two-handed multi-touch** — left thumb pans/anchors, right hand commands;
  genuine parallelism a single mouse can't do.
- **Smart-assist** — auto-target, focus-fire, formation-hold spend the player's
  taps on *decisions*, not busywork; raises *effective* APM.
- **(PvE) tactical-focus time-dilation** on cooldown — a burst window so touch's
  lower raw tap-rate still lands a dense command salvo.

**Existence proof:** Bad North — gesture-command squads that auto-fight — is
critically adored precisely because command felt *native* to touch. It used a
fraction of this toolkit. Nobody has stacked the full grammar under
Blizzard-depth faction armies. That gap is the game.

**The synthesis (low-floor / high-ceiling):** this does *not* conflict with the
hero. Fuse them —
- **Floor:** steer your hero one-thumb, army auto-follows and auto-fights; a
  newcomer plays it like Thronefall.
- **Ceiling:** the gesture / control-group / ability grammar sits on top for
  players who want to command the whole army with real APM.

One game, playable by a newcomer and a Grandmaster — the "layer complexity onto
a proven core" lesson applied to *controls themselves*. Highest reward, highest
risk, unproven. De-risk it the only way that works: a **control-feel sandbox**
(two squads, dummy enemies, no economy) with lasso-select + draw-to-attack-move
+ squad cards + one two-tap ability — then play it on a phone for ten minutes.
If it feels fast and good, we've found the game.

## What this means for the current build

Warcrest today is a symmetric skirmish RTS (two AI bases, worker harvest, tech
tree, box-select army micro). That's the genre Thronefall subtracted *from* —
so the pivot is real, but **the assets are all reusable**: rigged units,
weapons, toon renderer, terrain, buildings, per-faction stats survive intact.

**First slice (build the loop before betting the game on it):** a single
hero-led mission that exercises all six pillars end to end —
1. Pilot the faction hero with the joystick (reuse existing hero model + walk/attack anims).
2. Build on 3–4 anchored plots via a minimal radial/card UI (reuse building models).
3. Anchors unlock trainable units that auto-rally to the hero and auto-fight (reuse unit roster + combat).
4. One prep phase → one enemy assault wave → reward screen.
5. One creep camp on the map to contest for an early power spike.

If the loop is fun with one mission, the rest is content authored on top of a
proven core. If it isn't, we've risked one mission's worth of work, not the
game.

## Explicitly cut (and why the cut buys something)

- **Box-select + per-unit micro** → replaced by hero control + auto-fight.
  Buys: playable with two thumbs.
- **Free-placement building** → anchored plots. Buys: authored risk, no
  turtling, cohesive-looking bases, per-mission tech trees.
- **Unbounded macro / worker babysitting** → bounded prep phase + simplified
  economy. Buys: mobile session length, focus on decisions over busywork.
- **Symmetric mirror skirmish as the *core*** → kept only as an optional
  secondary mode, not the spine.
