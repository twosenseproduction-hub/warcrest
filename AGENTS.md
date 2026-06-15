# AGENTS.md

## Cursor Cloud specific instructions

Warcrest is a **static, client-side browser RTS game** — plain HTML/CSS/JS with classic
`<script>` tags. There is **no bundler, no build step, no backend, no database, and no
runtime dependencies**. Everything attaches to the global `window.RTS` namespace, and
script load order in `index.html` matters.

### Running the game (the only runtime "service")
- Serve the repo root statically and open it in a browser:
  `python3 -m http.server 8080` → http://localhost:8080 (see `README.md`).
- The static server does **not** hot-reload — after editing any `src/*.js`, `styles/*`,
  or `index.html`, **hard-refresh the browser** to pick up changes.
- Flow to reach gameplay: main menu → `Skirmish` → pick a faction (`Iron Crown` /
  `Raider Horde`) → the match starts on the "Sapphire Shores" map.

### Lint / test / build
- There is **no lint config, no automated test suite, and no build system** in this repo.
  "Build" for production is only `docker build` (copies static files into nginx); not
  needed for local dev.
- The closest thing to tests are deterministic **audit scripts** (use these to sanity-check
  map/asset changes):
  - `node scripts/audit_topology.js` and `node scripts/audit_symmetry.js` — Node, built-in
    modules only (no npm install needed).
  - `python3 scripts/audit_sprites.py` — needs Python `Pillow` + `numpy` (installed by the
    Cursor update script).

### Optional dev tooling
- The map generator (`tools/mapgen/`, `scripts/import-mapgen.py`) and `audit_sprites.py`
  require `Pillow` + `numpy`. These are **not** needed to run/play the game, only to
  regenerate map data / audit sprites. Keep generation deterministic (see
  `tools/mapgen/.cursorrules`).

### Deploy (not needed for local dev/testing)
- Deploys to its own Fly.io app `exofront-game` via the guarded `./scripts/deploy.sh`
  (requires `flyctl` + `FLY_API_TOKEN`). Do not run bare `fly deploy`.
