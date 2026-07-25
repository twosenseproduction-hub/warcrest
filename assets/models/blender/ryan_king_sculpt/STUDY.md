# Ryan King Art — Sculpting for Complete Beginners

**Video:** https://www.youtube.com/watch?v=Lxem4yMs5Dg  
**Channel:** Ryan King Art · ~54 min · cute **fish** sculpt exercise

## Snapshot method (what works here)

YouTube blocks cloud IPs from downloading the MP4 (`Sign in to confirm you're not a bot`).  
**Storyboard grids still work** — YouTube’s scrubbing thumbnails via an Invidious API, no cookies.

```bash
./tools/blender-character/yt_snapshot_frames.sh https://youtu.be/Lxem4yMs5Dg
```

That writes (under `/opt/cursor/artifacts/yt_Lxem4yMs5Dg/`):

| Path | Contents |
|------|----------|
| `frames/` | **326** stills ≈ every **10s** (320×180) |
| `chapter_frames/` | One still per official chapter timestamp |
| `chapter_contact_sheet.jpg` | Labeled grid of chapter stills |
| `storyboard/` | Raw grid tiles + JSON |

Repo copies for quick reference:

- `chapter_frames/*.png` — chapter picks
- `chapter_contact_sheet.jpg`
- `chapter_manifest.json`
- `TRANSCRIPT.txt` — full English narration
- `CHAPTERS.md`

For denser than ~10s (e.g. every 5s), export browser cookies and pass them:

```bash
./tools/blender-character/yt_snapshot_frames.sh \
  https://youtu.be/Lxem4yMs5Dg /path/to/youtube_cookies.txt 5
```

## Workflow takeaways (apply to Bizzo / any character)

1. **Start high-poly** — icosphere subdiv 7, or apply Subsurf level 5 on a base mesh before sculpt.
2. Use the **Sculpting workspace**.
3. Core brushes: **Draw, Clay Strips, Crease, Smooth (Shift), Inflate, Scrape, Grab (G), Snake Hook**.
4. **F** = radius, **Shift+F** = strength; prefer pen pressure on strength.
5. **X symmetry**; Symmetrize if you forgot.
6. Add density while sculpting:
   - **Remesh:** `R` set size → `Ctrl+R` apply (even topology)
   - **Dyntopo:** add detail only where you sculpt (Relative detail)
7. **Front Faces Only** on brushes to avoid pulling through thin mesh.
8. Blockout base mesh in Object/Edit (cube extrudes + Mirror + Subsurf), **join + Apply Subsurf**, then **Remesh** so overlapping fins/parts become one manifold shell.
9. Sculpt order: **Grab** proportions → Clay Strips / Ctrl carve sockets → Crease mouth → Dyntopo details → separate eye objects → Paint (color attributes) + Attribute node in material.

## Mapping onto our cat (master workflow)

| Ryan King step | Our Bizzo action |
|----------------|------------------|
| High-poly base | Multires / apply Subsurf before deep sculpt |
| Remesh unify | Ctrl+R remesh after joining clothing/body |
| X symmetry | Keep X on while Grab/Clay Strips |
| Grab first | Multires L0 Grab collar, cheeks, boots |
| Clay Strips + Ctrl | Eye sockets, muzzle volume |
| Crease | Mouth line, collar fold |
| Shift Smooth | Light only — don't melt silhouette |
| Front Faces Only | Enable per brush on thin ears/boots |

## Free project files

- Gumroad: https://ryankingart.gumroad.com/l/fish-sculpt
- Patreon: https://www.patreon.com/posts/113759959
