#!/usr/bin/env bash
# Snapshot a YouTube video for visual reference.
#
# Preferred path (no cookies): YouTube *storyboard* grids via an Invidious
# API — ~1 still every 10s, sliced into individual PNGs + chapter picks.
#
# Fallback (full MP4 + arbitrary interval): needs browser cookies because
# YouTube blocks most cloud IPs ("Sign in to confirm you're not a bot"):
#
#   1. Chrome: "Get cookies.txt LOCALLY" → export youtube.com cookies
#   2. ./tools/blender-character/yt_snapshot_frames.sh URL cookies.txt 5
#
# Usage:
#   ./tools/blender-character/yt_snapshot_frames.sh <youtube-url> [cookies.txt] [interval_seconds]
#
# Outputs under /opt/cursor/artifacts/yt_<VIDEO_ID>/ :
#   frames/frame_XXXX_tMMmSSs.png   — timed stills
#   chapter_frames/                 — one still per official chapter
#   chapter_contact_sheet.jpg
#   storyboard/                     — raw grid tiles + JSON
set -euo pipefail

URL="${1:?usage: $0 <youtube-url> [cookies.txt] [interval_seconds]}"
COOKIES="${2:-}"
INTERVAL="${3:-5}"
ID="$(python3 - <<PY
import re, sys
u = """$URL"""
m = re.search(r'(?:youtu\.be/|v=)([A-Za-z0-9_-]{6,})', u)
print(m.group(1) if m else '')
PY
)"
if [[ -z "$ID" ]]; then
  echo "[yt-snap] ERROR: could not parse video id from $URL" >&2
  exit 1
fi

OUT="/opt/cursor/artifacts/yt_${ID}"
mkdir -p "$OUT/frames" "$OUT/storyboard" "$OUT/chapter_frames" "$OUT/video"

echo "[yt-snap] video=$ID → $OUT"

# --- 1) Storyboards (works without cookies) ---------------------------------
python3 - <<'PY' "$ID" "$OUT"
import json, sys, urllib.request
from pathlib import Path

vid, out_s = sys.argv[1], sys.argv[2]
out = Path(out_s)
sb_dir = out / "storyboard"

# Prefer a few known Invidious hosts; stop at first that returns storyboards.
hosts = [
    "https://inv.nadeko.net",
    "https://yewtu.be",
    "https://invidious.privacyredirect.com",
]
data = None
last_err = None
for host in hosts:
    url = f"{host}/api/v1/storyboards/{vid}"
    try:
        req = urllib.request.Request(
            url, headers={"User-Agent": "Mozilla/5.0", "Accept": "application/json"}
        )
        with urllib.request.urlopen(req, timeout=20) as r:
            data = json.loads(r.read())
        if data.get("storyboards"):
            print(f"[yt-snap] storyboards via {host}")
            break
    except Exception as e:
        last_err = e
        data = None

if not data or not data.get("storyboards"):
    print(f"[yt-snap] storyboard API failed ({last_err}); will try yt-dlp if cookies given")
    open(out / "storyboard" / "FAILED.txt", "w").write(str(last_err))
    raise SystemExit(0)

(sb_dir / "storyboards.json").write_text(json.dumps(data, indent=2))

# Download highest-res level that has a multi-page template
levels = data["storyboards"]
level = max(levels, key=lambda L: L.get("width", 0) * L.get("height", 0))
tmpl = level["templateUrl"]
cell_w, cell_h = level["width"], level["height"]
cols = level.get("storyboardWidth") or 10
rows = level.get("storyboardHeight") or 10
pages = int(level.get("storyboardCount") or 1)
count = int(level.get("count") or 0)
interval_ms = int(level.get("interval") or 10000)
print(
    f"[yt-snap] level {cell_w}x{cell_h} grid {cols}x{rows} "
    f"pages={pages} frames≈{count} every {interval_ms}ms"
)

for m in range(pages + 2):
    u = tmpl.replace("$M", str(m)).replace("$N", str(m))
    dest = sb_dir / f"page_{m:03d}.jpg"
    try:
        req = urllib.request.Request(u, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=20) as r:
            b = r.read()
        if len(b) < 200:
            break
        dest.write_bytes(b)
        print(f"[yt-snap] tile {dest.name} ({len(b)} B)")
    except Exception as e:
        print(f"[yt-snap] stop tiles at {m}: {e}")
        break

# Persist slice params for the slicer below
(sb_dir / "slice_params.json").write_text(
    json.dumps(
        {
            "cell_w": cell_w,
            "cell_h": cell_h,
            "cols": cols,
            "rows": rows,
            "count": count,
            "interval_ms": interval_ms,
        },
        indent=2,
    )
)
PY

# Slice grids → timed frames (+ chapter picks if CHAPTERS.md nearby)
python3 - <<'PY' "$ID" "$OUT"
import json, re, sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

vid, out_s = sys.argv[1], sys.argv[2]
out = Path(out_s)
sb_dir = out / "storyboard"
params_path = sb_dir / "slice_params.json"
if not params_path.exists():
    raise SystemExit(0)

p = json.loads(params_path.read_text())
cell_w, cell_h = p["cell_w"], p["cell_h"]
cols, rows = p["cols"], p["rows"]
count, interval_ms = p["count"], p["interval_ms"]

frames_dir = out / "frames"
for old in frames_dir.glob("frame_*.png"):
    old.unlink()

pages = sorted(sb_dir.glob("page_*.jpg"))
if not pages:
    # legacy names from earlier runs
    pages = sorted(sb_dir.glob("level*_page*.jpg"))
    if pages:
        # prefer highest level number
        best = max(int(re.search(r"level(\d+)", x.name).group(1)) for x in pages)
        pages = sorted(sb_dir.glob(f"level{best}_page*.jpg"))

timestamps = []
idx = 0
for page_path in pages:
    im = Image.open(page_path).convert("RGB")
    pw, ph = im.size
    acols = min(cols, max(1, pw // cell_w))
    arows = min(rows, max(1, ph // cell_h))
    for r in range(arows):
        for c in range(acols):
            if count and idx >= count:
                break
            box = (c * cell_w, r * cell_h, (c + 1) * cell_w, (r + 1) * cell_h)
            cell = im.crop(box)
            if cell.convert("L").getextrema()[1] < 8:
                continue
            t_s = (idx * interval_ms) // 1000
            mm, ss = divmod(t_s, 60)
            name = f"frame_{idx:04d}_t{mm:02d}m{ss:02d}s.png"
            cell.save(frames_dir / name)
            timestamps.append((idx, t_s, name))
            idx += 1
        if count and idx >= count:
            break

print(f"[yt-snap] wrote {len(timestamps)} frames → {frames_dir}")

# Optional chapters from repo STUDY folder or artifacts chapters.md
chapter_sources = [
    Path("/workspace/assets/models/blender/ryan_king_sculpt/CHAPTERS.md"),
    out / "chapters.md",
]
chapters = []
for src in chapter_sources:
    if not src.exists():
        continue
    for line in src.read_text().splitlines():
        m = re.match(r"\|\s*(\d+):(\d+)\s*\|\s*([^|]+)\|", line)
        if m:
            t = int(m.group(1)) * 60 + int(m.group(2))
            chapters.append((t, m.group(3).strip()))
    if chapters:
        break

if chapters and timestamps:
    chap_dir = out / "chapter_frames"
    chap_dir.mkdir(exist_ok=True)
    for old in chap_dir.glob("*.png"):
        old.unlink()

    def nearest(t_s):
        return min(timestamps, key=lambda x: abs(x[1] - t_s))

    manifest = []
    for t_s, title in chapters:
        i, ts, name = nearest(t_s)
        safe = re.sub(r"[^a-z0-9]+", "_", title.lower()).strip("_")
        mm, ss = divmod(t_s, 60)
        out_name = f"{mm:02d}m{ss:02d}s_{safe}.png"
        Image.open(frames_dir / name).save(chap_dir / out_name)
        manifest.append(
            {"time_s": t_s, "chapter": title, "frame": out_name, "storyboard_t": ts}
        )
    (out / "chapter_manifest.json").write_text(json.dumps(manifest, indent=2))

    # contact sheet
    ims = [Image.open(chap_dir / m["frame"]).convert("RGB") for m in manifest]
    w, h = 320, 180
    ims = [im.resize((w, h)) for im in ims]
    cols_s = 4
    rows_s = (len(ims) + cols_s - 1) // cols_s
    sheet = Image.new("RGB", (cols_s * w, rows_s * (h + 28)), (18, 18, 22))
    try:
        font = ImageFont.truetype(
            "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 12
        )
    except Exception:
        font = ImageFont.load_default()
    draw = ImageDraw.Draw(sheet)
    for i, (im, m) in enumerate(zip(ims, manifest)):
        x, y = (i % cols_s) * w, (i // cols_s) * (h + 28)
        sheet.paste(im, (x, y))
        mm, ss = divmod(m["time_s"], 60)
        draw.rectangle([x, y + h, x + w, y + h + 28], fill=(28, 28, 34))
        draw.text(
            (x + 4, y + h + 6),
            f"{mm:02d}:{ss:02d} {m['chapter'][:28]}",
            fill=(230, 230, 235),
            font=font,
        )
    sheet.save(out / "chapter_contact_sheet.jpg", quality=92)
    print(f"[yt-snap] chapter sheet → {out / 'chapter_contact_sheet.jpg'}")

# thumb
import urllib.request

try:
    urllib.request.urlretrieve(
        f"https://i.ytimg.com/vi/{vid}/maxresdefault.jpg", out / "thumb_maxres.jpg"
    )
except Exception:
    pass
PY

FRAME_N="$(ls "$OUT/frames"/frame_*.png 2>/dev/null | wc -l | tr -d ' ')"
if [[ "${FRAME_N}" -gt 0 ]]; then
  echo "[yt-snap] DONE via storyboards: ${FRAME_N} frames (≈every 10s)"
  echo "[yt-snap] denser / arbitrary interval needs cookies + yt-dlp path below"
fi

# --- 2) Optional full download for custom interval ---------------------------
if [[ -n "$COOKIES" && -f "$COOKIES" ]]; then
  echo "[yt-snap] cookies provided → downloading MP4 for ${INTERVAL}s interval"
  NODE_BIN="$(command -v node || true)"
  ARGS=( -f "best[height<=720]/best" -o "$OUT/video/%(id)s.%(ext)s" --cookies "$COOKIES" )
  if [[ -n "$NODE_BIN" ]]; then
    ARGS=( --js-runtimes "node:${NODE_BIN}" "${ARGS[@]}" )
  fi
  yt-dlp "${ARGS[@]}" --write-auto-subs --sub-langs "en.*,en" --convert-subs srt "$URL" || true
  VID="$(ls "$OUT/video"/*.{mp4,webm,mkv} 2>/dev/null | head -1 || true)"
  if [[ -n "$VID" ]]; then
    mkdir -p "$OUT/frames_dense"
    ffmpeg -y -i "$VID" -vf "fps=1/${INTERVAL}" "$OUT/frames_dense/frame_%04d.png"
    echo "[yt-snap] dense frames → $OUT/frames_dense ($(ls "$OUT/frames_dense" | wc -l) files)"
  else
    echo "[yt-snap] WARNING: yt-dlp produced no video; storyboard frames still available" >&2
  fi
elif [[ "${FRAME_N}" -eq 0 ]]; then
  echo "[yt-snap] ERROR: no storyboard frames and no cookies. Export YouTube cookies and retry." >&2
  exit 1
fi
