#!/usr/bin/env python3
"""Batch sprite pipeline: key → pixelize OR key → sharpen → export."""

from __future__ import annotations

import argparse
import math
from array import array
from pathlib import Path

from PIL import Image, ImageEnhance, ImageFilter

AELINDRA_PALETTE = [
    (0x11, 0x05, 0x09),
    (0x0A, 0x10, 0x13),
    (0x0B, 0x13, 0x0C),
    (0x2A, 0x14, 0x12),
    (0x3C, 0x1F, 0x17),
    (0x48, 0x1E, 0x16),
    (0x59, 0x38, 0x2D),
    (0x76, 0x41, 0x26),
    (0x46, 0x53, 0x4A),
    (0x36, 0x64, 0x31),
    (0x7F, 0x66, 0x57),
    (0xA3, 0x69, 0x40),
    (0x95, 0xA1, 0x7E),
    (0xA9, 0xAC, 0x9E),
]
OUTLINE = AELINDRA_PALETTE[0]
PALETTE_LAB = []


def srgb_to_linear(c: float) -> float:
    c /= 255.0
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def linear_to_srgb(c: float) -> int:
    c = max(0.0, min(1.0, c))
    v = 12.92 * c if c <= 0.0031308 else 1.055 * (c ** (1 / 2.4)) - 0.055
    return int(round(v * 255))


def rgb_to_lab(r: int, g: int, b: int) -> tuple[float, float, float]:
    lr, lg, lb = srgb_to_linear(r), srgb_to_linear(g), srgb_to_linear(b)
    x = (0.4124564 * lr + 0.3575761 * lg + 0.1804375 * lb) / 0.95047
    y = (0.2126729 * lr + 0.7151522 * lg + 0.0721750 * lb) / 1.0
    z = (0.0193339 * lr + 0.1191920 * lg + 0.9503041 * lb) / 1.08883

    def f(t: float) -> float:
        return math.cbrt(t) if t > 0.008856 else 7.787 * t + 16 / 116

    x, y, z = f(x), f(y), f(z)
    return 116 * y - 16, 500 * (x - y), 200 * (y - z)


def lab_to_rgb(l: float, a: float, b: float) -> tuple[int, int, int]:
    y = (l + 16) / 116
    x = a / 500 + y
    z = y - b / 200

    def finv(t: float) -> float:
        t3 = t * t * t
        return t3 if t3 > 0.008856 else (t - 16 / 116) / 7.787

    x, y, z = finv(x) * 0.95047, finv(y) * 1.0, finv(z) * 1.08883
    lr = 3.2404542 * x - 1.5371385 * y - 0.4985314 * z
    lg = -0.9692660 * x + 1.8760108 * y + 0.0415560 * z
    lb = 0.0556434 * x - 0.2040259 * y + 1.0572252 * z
    return linear_to_srgb(lr), linear_to_srgb(lg), linear_to_srgb(lb)


def lab_dist(a: tuple[float, float, float], b: tuple[float, float, float]) -> float:
    return math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2)


def init_palette_lab() -> None:
    global PALETTE_LAB
    PALETTE_LAB = [rgb_to_lab(*c) for c in AELINDRA_PALETTE]


def nearest_palette(r: int, g: int, b: int) -> tuple[int, int, int]:
    lab = rgb_to_lab(r, g, b)
    best_i, best_d = 0, float("inf")
    for i, plab in enumerate(PALETTE_LAB):
        d = lab_dist(lab, plab)
        if d < best_d:
            best_d, best_i = d, i
    return AELINDRA_PALETTE[best_i]


def normalize_to_square(img: Image.Image, side: int = 1024) -> Image.Image:
    """Fit to square canvas using tight vertical fill (matches hand-made south framing)."""
    img = img.convert("RGBA")
    if img.width == side and img.height == side:
        return img
    scale = side / img.height
    nw, nh = round(img.width * scale), side
    resized = img.resize((nw, nh), Image.Resampling.LANCZOS)
    out = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    if nw > side:
        left = (nw - side) // 2
        resized = resized.crop((left, 0, left + side, side))
        out.paste(resized, (0, 0))
    else:
        out.paste(resized, ((side - nw) // 2, 0))
    return out


def alpha_bbox(img: Image.Image) -> tuple[int, int, int, int] | None:
    rgba = img.convert("RGBA")
    w, h = rgba.size
    px = rgba.load()
    xs: list[int] = []
    ys: list[int] = []
    for y in range(h):
        for x in range(w):
            if px[x, y][3] > 128:
                xs.append(x)
                ys.append(y)
    if not xs:
        return None
    return min(xs), min(ys), max(xs), max(ys)


def fit_to_reference_bbox(
    img: Image.Image,
    ref: tuple[int, int, int, int],
    canvas: int = 1024,
) -> Image.Image:
    """Scale each direction so character height matches south, feet aligned."""
    bbox = alpha_bbox(img)
    if not bbox:
        return img
    min_x, min_y, max_x, max_y = bbox
    rmin_x, rmin_y, rmax_x, rmax_y = ref
    ref_h = rmax_y - rmin_y + 1
    ref_cx = (rmin_x + rmax_x) / 2
    ref_foot = rmax_y

    cropped = img.crop((min_x, min_y, max_x + 1, max_y + 1))
    cw, ch = cropped.size
    scale = ref_h / ch
    nw, nh = max(1, round(cw * scale)), max(1, round(ch * scale))
    scaled = cropped.resize((nw, nh), Image.Resampling.LANCZOS)

    out = Image.new("RGBA", (canvas, canvas), (0, 0, 0, 0))
    x = round(ref_cx - nw / 2)
    y = round(ref_foot - nh + 1)
    x = max(0, min(canvas - nw, x))
    y = max(0, min(canvas - nh, y))
    out.paste(scaled, (x, y))
    return out


def flood_key(img: Image.Image, tolerance: int = 30, feather: int = 1) -> Image.Image:
    rgba = img.convert("RGBA")
    w, h = rgba.size
    px = rgba.load()
    corners = [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)]
    bg_lab = tuple(
        sum(rgb_to_lab(*px[x, y][:3])[i] for x, y in corners) / 4 for i in range(3)
    )
    tol_lab = tolerance * 1.2
    visited = bytearray(w * h)
    alpha = [1.0] * (w * h)
    queue: list[int] = []

    def push_seed(x: int, y: int) -> None:
        idx = y * w + x
        if visited[idx]:
            return
        r, g, b, a = px[x, y]
        if a == 0:
            return
        if lab_dist(rgb_to_lab(r, g, b), bg_lab) <= tol_lab:
            visited[idx] = 1
            queue.append(idx)

    for x in range(w):
        push_seed(x, 0)
        push_seed(x, h - 1)
    for y in range(1, h - 1):
        push_seed(0, y)
        push_seed(w - 1, y)

    while queue:
        idx = queue.pop()
        alpha[idx] = 0.0
        x, y = idx % w, idx // w
        for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if nx < 0 or nx >= w or ny < 0 or ny >= h:
                continue
            ni = ny * w + nx
            if visited[ni]:
                continue
            visited[ni] = 1
            r, g, b, a = px[nx, ny]
            if a == 0:
                continue
            dist = lab_dist(rgb_to_lab(r, g, b), bg_lab)
            if dist <= tol_lab:
                queue.append(ni)
            elif feather > 0 and dist <= tol_lab + feather * 12:
                alpha[ni] = min(alpha[ni], (dist - tol_lab) / (feather * 12))

    out = Image.new("RGBA", (w, h))
    opx = out.load()
    for y in range(h):
        for x in range(w):
            idx = y * w + x
            r, g, b, a = px[x, y]
            na = int(round(alpha[idx] * a))
            opx[x, y] = (r, g, b, na)
    return out


def sobel_edges(lum: list[float], w: int, h: int) -> list[float]:
    out = [0.0] * (w * h)
    for y in range(1, h - 1):
        for x in range(1, w - 1):
            tl, tc, tr = lum[(y - 1) * w + x - 1], lum[(y - 1) * w + x], lum[(y - 1) * w + x + 1]
            ml, mr = lum[y * w + x - 1], lum[y * w + x + 1]
            bl, bc, br = lum[(y + 1) * w + x - 1], lum[(y + 1) * w + x], lum[(y + 1) * w + x + 1]
            gx = -tl - 2 * ml - bl + tr + 2 * mr + br
            gy = -tl - 2 * tc - tr + bl + 2 * bc + br
            out[y * w + x] = math.sqrt(gx * gx + gy * gy)
    mx = max(out) if out else 1.0
    if mx > 0:
        out = [v / mx for v in out]
    return out


def edge_aware_downscale(rgba: Image.Image, tw: int, th: int, edge_sens: float = 0.5) -> list[float]:
    w, h = rgba.size
    src = list(rgba.getdata())
    lum = [0.2126 * p[0] + 0.7151 * p[1] + 0.0722 * p[2] for p in src]
    edge_map = sobel_edges(lum, w, h)
    out = [0.0] * (tw * th * 4)
    bw, bh = w / tw, h / th
    for ty in range(th):
        for tx in range(tw):
            r = g = b = wt = 0.0
            a_sum = 0.0
            x0, x1 = int(tx * bw), min(int(math.ceil((tx + 1) * bw)), w)
            y0, y1 = int(ty * bh), min(int(math.ceil((ty + 1) * bh)), h)
            count = max(1, (x1 - x0) * (y1 - y0))
            for sy in range(y0, y1):
                for sx in range(x0, x1):
                    si = sy * w + sx
                    pr, pg, pb, pa = src[si]
                    sa = pa / 255.0
                    if sa < 0.01:
                        continue
                    ew = 1 + edge_map[si] * edge_sens * 4
                    w2 = sa * ew
                    r += pr * w2
                    g += pg * w2
                    b += pb * w2
                    a_sum += pa
                    wt += w2
            oi = (ty * tw + tx) * 4
            if wt > 0:
                out[oi], out[oi + 1], out[oi + 2] = r / wt, g / wt, b / wt
            out[oi + 3] = a_sum / count
    return out


def clamp(v: float) -> int:
    return max(0, min(255, int(round(v))))


def map_to_palette(pixels: list[float], w: int, h: int) -> bytearray:
    out = bytearray(w * h * 4)
    for i in range(0, len(pixels), 4):
        if pixels[i + 3] < 128:
            continue
        c = nearest_palette(clamp(pixels[i]), clamp(pixels[i + 1]), clamp(pixels[i + 2]))
        out[i], out[i + 1], out[i + 2], out[i + 3] = c[0], c[1], c[2], clamp(pixels[i + 3])
    return out


def apply_light_preservation(
    mapped: bytearray, original: list[float], w: int, h: int, blend: float = 0.52
) -> None:
    for i in range(0, w * h * 4, 4):
        if mapped[i + 3] < 128:
            continue
        orig_lum = 0.2126 * clamp(original[i]) + 0.7151 * clamp(original[i + 1]) + 0.0722 * clamp(original[i + 2])
        map_lum = 0.2126 * mapped[i] + 0.7151 * mapped[i + 1] + 0.0722 * mapped[i + 2]
        if map_lum < 1:
            continue
        adj = 1 + (orig_lum / map_lum - 1) * blend
        mapped[i] = clamp(mapped[i] * adj)
        mapped[i + 1] = clamp(mapped[i + 1] * adj)
        mapped[i + 2] = clamp(mapped[i + 2] * adj)


def apply_antibanding(mapped: bytearray, w: int, h: int) -> None:
    for y in range(1, h - 1):
        for x in range(1, w - 1):
            i = (y * w + x) * 4
            if mapped[i + 3] < 128:
                continue
            c = (mapped[i], mapped[i + 1], mapped[i + 2])
            same = 0
            for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1)):
                ni = ((y + dy) * w + (x + dx)) * 4
                if (mapped[ni], mapped[ni + 1], mapped[ni + 2]) == c:
                    same += 1
            if same >= 3:
                n = ((x * 7 + y * 13) % 5) - 2
                mapped[i] = clamp(mapped[i] + n)
                mapped[i + 1] = clamp(mapped[i + 1] + n)
                mapped[i + 2] = clamp(mapped[i + 2] + n)


def add_outline(data: bytearray, w: int, h: int) -> None:
    def has_alpha(x: int, y: int) -> bool:
        return 0 <= x < w and 0 <= y < h and data[(y * w + x) * 4 + 3] > 128

    marks = []
    for y in range(h):
        for x in range(w):
            i = (y * w + x) * 4
            if data[i + 3] > 128:
                continue
            if has_alpha(x - 1, y) or has_alpha(x + 1, y) or has_alpha(x, y - 1) or has_alpha(x, y + 1):
                marks.append(i)
    for i in marks:
        data[i], data[i + 1], data[i + 2], data[i + 3] = OUTLINE[0], OUTLINE[1], OUTLINE[2], 255


def pixelize(img: Image.Image, grid: int = 48, edge_sens: float = 0.5, light_blend: float = 0.52) -> Image.Image:
    small = edge_aware_downscale(img, grid, grid, edge_sens)
    mapped = map_to_palette(small, grid, grid)
    apply_light_preservation(mapped, small, grid, grid, light_blend)
    apply_antibanding(mapped, grid, grid)
    add_outline(mapped, grid, grid)
    return Image.frombytes("RGBA", (grid, grid), bytes(mapped))


def upscale_nearest(img: Image.Image, size: int) -> Image.Image:
    return img.resize((size, size), Image.Resampling.NEAREST)


def sharpen_rgba(
    img: Image.Image,
    radius: float = 1.5,
    percent: int = 165,
    threshold: int = 2,
    contrast: float = 1.06,
    saturation: float = 1.08,
) -> Image.Image:
    """Unsharp mask + mild contrast/saturation on keyed RGBA — no pixel-art downscale."""
    rgba = img.convert("RGBA")
    r, g, b, a = rgba.split()
    rgb = Image.merge("RGB", (r, g, b))
    rgb = rgb.filter(ImageFilter.UnsharpMask(radius=radius, percent=percent, threshold=threshold))
    if contrast != 1.0:
        rgb = ImageEnhance.Contrast(rgb).enhance(contrast)
    if saturation != 1.0:
        rgb = ImageEnhance.Color(rgb).enhance(saturation)
    r, g, b = rgb.split()
    return Image.merge("RGBA", (r, g, b, a))


def resize_for_export(img: Image.Image, export_size: int) -> Image.Image:
    """Downscale with Lanczos; integer upscale with nearest."""
    w, h = img.size
    if w == export_size and h == export_size:
        return img
    if w > export_size or h > export_size:
        return img.resize((export_size, export_size), Image.Resampling.LANCZOS)
    if export_size % w == 0 and export_size % h == 0:
        return img.resize((export_size, export_size), Image.Resampling.NEAREST)
    return img.resize((export_size, export_size), Image.Resampling.LANCZOS)


def process_sharp_frame(
    keyed: Image.Image,
    export_size: int,
    radius: float = 1.5,
    percent: int = 165,
    contrast: float = 1.06,
    saturation: float = 1.08,
) -> Image.Image:
    sharp = sharpen_rgba(keyed, radius=radius, percent=percent, contrast=contrast, saturation=saturation)
    return resize_for_export(sharp, export_size)


def process_file(
    src: Path,
    out_dir: Path,
    grid: int,
    export_size: int,
    ref_bbox: tuple[int, int, int, int] | None,
    edge_sens: float = 0.5,
    light_blend: float = 0.52,
    in_place: Path | None = None,
    sharp_key: bool = False,
) -> Path:
    raw = Image.open(src)
    norm = normalize_to_square(raw)
    keyed = flood_key(norm)
    if ref_bbox:
        keyed = fit_to_reference_bbox(keyed, ref_bbox)
    if sharp_key:
        final = process_sharp_frame(keyed, export_size)
    else:
        pix = pixelize(keyed, grid, edge_sens, light_blend)
        final = upscale_nearest(pix, export_size)
    if in_place:
        out_path = in_place
        out_path.parent.mkdir(parents=True, exist_ok=True)
    else:
        out_dir.mkdir(parents=True, exist_ok=True)
        name = src.stem.lower().replace(" ", "_") + ".png"
        out_path = out_dir / name
    final.save(out_path)
    return out_path


def process_strip_crisp(
    strip_path: Path,
    export_size: int = 256,
    in_place: bool = True,
) -> Path:
    """Crisp passthrough: key chroma + nearest upscale only."""
    img = Image.open(strip_path).convert("RGBA")
    w, h = img.size
    if h <= 0 or w % h != 0:
        raise ValueError(f"Not a square-frame strip: {strip_path} ({w}×{h})")
    count = w // h
    frames = [img.crop((i * h, 0, (i + 1) * h, h)) for i in range(count)]

    def _key(im: Image.Image) -> Image.Image:
        im = im.convert("RGBA")
        px = im.load()
        ww, hh = im.size
        for y in range(hh):
            for x in range(ww):
                r, g, b, a = px[x, y]
                if not a:
                    continue
                if r < 24 and g < 24 and b < 24:
                    px[x, y] = (0, 0, 0, 0)
                elif r > 200 and g < 48 and b > 200:
                    px[x, y] = (0, 0, 0, 0)
        return im

    def _crisp_fit(im: Image.Image, ref_bbox: tuple[int, int, int, int] | None) -> Image.Image:
        im = _key(im)
        if im.width == export_size and im.height == export_size and not ref_bbox:
            return im
        bbox = alpha_bbox(im)
        if not bbox:
            return Image.new("RGBA", (export_size, export_size), (0, 0, 0, 0))
        min_x, min_y, max_x, max_y = bbox
        cropped = im.crop((min_x, min_y, max_x + 1, max_y + 1))
        cw, ch = cropped.size
        if ref_bbox:
            rmin_x, rmin_y, rmax_x, rmax_y = ref_bbox
            ref_h = rmax_y - rmin_y + 1
            ref_cx = (rmin_x + rmax_x) / 2
            ref_foot = rmax_y
            scale = ref_h / ch
        else:
            target = int(export_size * 0.76)
            scale = min(target / cw, target / ch)
            ref_cx = export_size / 2
            ref_foot = int(export_size * 0.94)
        nw = max(1, round(cw * scale))
        nh = max(1, round(ch * scale))
        if im.width == export_size // 2 and im.height == export_size // 2:
            scaled = cropped.resize((export_size, export_size), Image.Resampling.NEAREST)
            return scaled
        scaled = cropped.resize((nw, nh), Image.Resampling.NEAREST)
        out = Image.new("RGBA", (export_size, export_size), (0, 0, 0, 0))
        x = round(ref_cx - nw / 2)
        y = round(ref_foot - nh + 1)
        x = max(0, min(export_size - nw, x))
        y = max(0, min(export_size - nh, y))
        out.paste(scaled, (x, y), scaled)
        return out

    ref_bbox = alpha_bbox(_key(frames[0]))
    out_frames = [_crisp_fit(fr, ref_bbox) for fr in frames]
    strip = Image.new("RGBA", (export_size * len(out_frames), export_size), (0, 0, 0, 0))
    for i, fr in enumerate(out_frames):
        strip.paste(fr, (i * export_size, 0), fr)
    out_path = strip_path if in_place else strip_path.with_name(strip_path.stem + "_crisp.png")
    strip.save(out_path)
    return out_path


def process_strip(
    strip_path: Path,
    grid: int,
    export_size: int,
    edge_sens: float,
    light_blend: float,
    in_place: bool = True,
    sharp_key: bool = False,
) -> Path:
    """Re-process a horizontal square-frame strip (hero idle/run/attack)."""
    img = Image.open(strip_path).convert("RGBA")
    w, h = img.size
    if h <= 0 or w % h != 0:
        raise ValueError(f"Not a square-frame strip: {strip_path} ({w}×{h})")
    count = w // h
    frames: list[Image.Image] = []
    for i in range(count):
        frames.append(img.crop((i * h, 0, (i + 1) * h, h)))
    ref_bbox = alpha_bbox(flood_key(normalize_to_square(frames[0])))
    out_frames: list[Image.Image] = []
    for fr in frames:
        norm = normalize_to_square(fr)
        keyed = flood_key(norm)
        if ref_bbox:
            keyed = fit_to_reference_bbox(keyed, ref_bbox)
        if sharp_key:
            out_frames.append(process_sharp_frame(keyed, export_size))
        else:
            pix = pixelize(keyed, grid, edge_sens, light_blend)
            out_frames.append(upscale_nearest(pix, export_size))
    strip = Image.new("RGBA", (export_size * len(out_frames), export_size), (0, 0, 0, 0))
    for i, fr in enumerate(out_frames):
        strip.paste(fr, (i * export_size, 0), fr)
    out_path = strip_path if in_place else strip_path.with_name(strip_path.stem + "_sharp.png")
    strip.save(out_path)
    return out_path


def process_image(
    src_path: Path,
    out_path: Path,
    grid: int,
    edge_sens: float,
    light_blend: float,
    sharp_key: bool = False,
    crisp: bool = False,
) -> Path:
    """Pixelate a single arbitrary-size image (building, prop, icon, etc.)."""
    img = Image.open(src_path).convert("RGBA")
    keyed = flood_key(img)
    if crisp:
        result = keyed
    elif sharp_key:
        result = process_sharp_frame(keyed, max(img.width, img.height))
    else:
        pix = pixelize(keyed, grid, edge_sens, light_blend)
        result = upscale_nearest(pix, max(img.width, img.height))
        # Resize back to original dimensions (pixelize → upscale may change size slightly)
        if result.size != img.size:
            result = result.resize(img.size, Image.Resampling.NEAREST)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    result.save(out_path)
    return out_path


def main() -> None:
    parser = argparse.ArgumentParser(description="Run sprite-tool unit preset in batch")
    parser.add_argument(
        "--input-dir",
        type=Path,
        default=Path("assets/heroes/rimwalker/_refs/units/Sapling Mystic"),
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path("assets/units/rimwalker/sapling_mystic"),
    )
    parser.add_argument("--grid", type=int, default=48)
    parser.add_argument("--export", type=int, default=192)
    parser.add_argument(
        "--hero-sharp",
        action="store_true",
        help="Hero preset: grid 128, export 256, edge 0.78, stronger light preservation",
    )
    parser.add_argument(
        "--crisp",
        action="store_true",
        help="Crisp passthrough: key + nearest upscale only, skip pixelize blur cycle",
    )
    parser.add_argument(
        "--sharp-key",
        action="store_true",
        help="Key + unsharp sharpen only — no pixel-art grid downscale or palette",
    )
    parser.add_argument(
        "--strip",
        type=Path,
        help="Re-pixelize one horizontal animation strip in place",
    )
    parser.add_argument(
        "--strip-dir",
        type=Path,
        help="Re-pixelize all PNG strips in a directory (Aelindra_Walk_*.png etc.)",
    )
    parser.add_argument(
        "--image",
        type=Path,
        help="Pixelate a single image (any size/aspect — buildings, props, etc.)",
    )
    parser.add_argument(
        "--image-dir",
        type=Path,
        help="Pixelate every PNG in a folder (buildings folder, etc.)",
    )
    parser.add_argument(
        "--out",
        type=Path,
        default=None,
        help="Output path for --image (defaults to overwriting source)",
    )
    args = parser.parse_args()

    edge_sens = 0.5
    light_blend = 0.52
    grid = args.grid
    export_size = args.export
    if args.hero_sharp:
        grid = 128
        export_size = 256
        edge_sens = 0.78
        light_blend = 0.52
    if args.sharp_key:
        export_size = max(export_size, 256)

    init_palette_lab()
    repo = Path(__file__).resolve().parents[1]

    if args.strip or args.strip_dir:
        targets: list[Path] = []
        if args.strip:
            p = args.strip if args.strip.is_absolute() else repo / args.strip
            targets.append(p)
        if args.strip_dir:
            d = args.strip_dir if args.strip_dir.is_absolute() else repo / args.strip_dir
            targets.extend(sorted(d.glob("*.png")))
        for p in targets:
            if not p.is_file():
                print(f"  skip (missing): {p}")
                continue
            try:
                if args.crisp:
                    out = process_strip_crisp(p, export_size, in_place=True)
                    im = Image.open(out)
                    print(f"  crisp strip: {out.relative_to(repo)} ({im.size[0]}×{im.size[1]})")
                else:
                    out = process_strip(
                        p, grid, export_size, edge_sens, light_blend,
                        in_place=True, sharp_key=args.sharp_key,
                    )
                    im = Image.open(out)
                    mode = "sharp-key strip" if args.sharp_key else f"sharp strip (grid {grid})"
                    print(f"  {mode}: {out.relative_to(repo)} ({im.size[0]}×{im.size[1]})")
            except ValueError as e:
                print(f"  skip {p.name}: {e}")
        return

    if args.image or args.image_dir:
        img_targets: list[Path] = []
        if args.image:
            p = args.image if args.image.is_absolute() else repo / args.image
            img_targets.append(p)
        if args.image_dir:
            d = args.image_dir if args.image_dir.is_absolute() else repo / args.image_dir
            img_targets.extend(sorted(d.glob("*.png")))
        for p in img_targets:
            if not p.is_file():
                print(f"  skip (missing): {p}")
                continue
            out_p = p
            if args.out and args.image and not args.image_dir:
                out_p = args.out if args.out.is_absolute() else repo / args.out
            out = process_image(
                p, out_p, grid, edge_sens, light_blend,
                sharp_key=args.sharp_key, crisp=args.crisp,
            )
            im = Image.open(out)
            try:
                label = out.relative_to(repo)
            except ValueError:
                label = out
            mode = "crisp" if args.crisp else ("sharp-key" if args.sharp_key else f"pixelize grid={grid}")
            print(f"  {mode}: {label} ({im.size[0]}×{im.size[1]})")
        return

    input_dir = args.input_dir if args.input_dir.is_absolute() else repo / args.input_dir
    output_dir = args.output_dir if args.output_dir.is_absolute() else repo / args.output_dir

    files = sorted(
        p for p in input_dir.glob("*.png")
        if "facing" in p.name.lower() or p.name.lower().startswith("sapling")
    )
    if not files:
        raise SystemExit(f"No PNGs found in {input_dir}")

    print(f"Processing {len(files)} files from {input_dir}")

    ref_bbox: tuple[int, int, int, int] | None = None
    south_file = next((p for p in files if "south" in p.name.lower()), None)
    if south_file:
        south_raw = normalize_to_square(Image.open(south_file))
        south_keyed = flood_key(south_raw)
        ref_bbox = alpha_bbox(south_keyed)
        if ref_bbox:
            bw = ref_bbox[2] - ref_bbox[0] + 1
            bh = ref_bbox[3] - ref_bbox[1] + 1
            print(f"  South reference bbox: {bw}×{bh} — scaling other dirs to match")

    results = []
    for src in files:
        out = process_file(
            src, output_dir, grid, export_size, ref_bbox,
            edge_sens, light_blend, sharp_key=args.sharp_key,
        )
        im = Image.open(out)
        bb = alpha_bbox(im)
        bb_s = f" bbox {bb[2]-bb[0]+1}×{bb[3]-bb[1]+1}" if bb else ""
        print(f"  {src.name} -> {out.relative_to(repo)} ({im.size[0]}×{im.size[1]}{bb_s})")
        results.append(out)

    # horizontal strip S N E W if all four present
    order = ["south", "north", "east", "west"]
    by_dir = {}
    for p in results:
        low = p.stem.lower()
        for d in order:
            if d in low:
                by_dir[d] = p
                break
    if len(by_dir) == 4:
        frames = [Image.open(by_dir[d]) for d in order]
        w, h = frames[0].size
        strip = Image.new("RGBA", (w * 4, h))
        for i, fr in enumerate(frames):
            strip.paste(fr, (i * w, 0))
        strip_path = output_dir / "sapling_mystic_idle_strip.png"
        strip.save(strip_path)
        print(f"Strip -> {strip_path.relative_to(repo)} ({strip.size[0]}×{strip.size[1]})")


if __name__ == "__main__":
    main()
