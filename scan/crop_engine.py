#!/usr/bin/env python3
"""Prep crop+deskew engine — the CV core of the in-app Prep surface.

Turns a raw flatbed scan of a physical print into the photographic-image rectangle
only: scanner-bed margin + the print's own white paper border removed, skew corrected.
Writes the cropped/deskewed lossless TIFF to masters/, which is the boundary the
downstream Run stage already assumes. Driven as a subprocess by lib/prep-engine.ts:
one JSON request on argv[1] (or stdin), one JSON response on stdout.

Why texture, not brightness: a pale sky in the photo is as bright as the white paper
border, so a brightness threshold can't tell them apart. The emulsion is *grainy*
(high local variance); the paper border and bed are smooth (low variance). We mask on
local std-dev, solidify with a morphological close, then take the single largest
connected component as the photo — which drops isolated margin ink (a loose "330"
written below the print) for free, since it's a separate small blob.

Modes (request.mode):
  auto    detect the crop box from texture; render raw + cropped previews.
  recrop  re-render previews from a caller-supplied box (a human hand-fix), OR
          re-detect with a looser/tighter threshold (threshold_mult).
  apply   render the final lossless TIFF to master_path from the (approved) box.

Box coordinates are RAW full-resolution pixels everywhere:
  { cx, cy, w, h, angle }  center, size, rotation in degrees (deskew rotates by -angle).
The frontend editor maps these to/from screen with one uniform scale (raw_w / renderedW).

I/O: cv2 (libtiff) handles 16-bit / grayscale / LZW masters via IMREAD_UNCHANGED;
Pillow is the fallback. tifffile is intentionally avoided (binary-incompatible with
numpy 2.x in this env).
"""
import sys
import json
import time
import math

import numpy as np
import cv2

try:
    from PIL import Image  # fallback loader/saver for exotic TIFFs
    _HAS_PIL = True
except Exception:  # pragma: no cover
    _HAS_PIL = False

# Tunables (all derived from image size where it matters, so they scale across DPI).
DET_MAX_SIDE = 1400        # detection runs on a downscale this big (speed; texture survives)
PREVIEW_MAX_SIDE = 820     # contact-sheet/editor preview JPEGs
VAR_WIN_FRAC = 0.012       # local-variance window ≈ 1.2% of the short side
LARGE_ANGLE_DEG = 3.5      # |skew| beyond this → flag for a human look
EXTREME_AR = 2.45          # rect aspect beyond this → flag (prints are ~1:1..7:5)
MULTI_COMP_FRAC = 0.10     # 2nd component ≥ 10% of the largest → margin ink / split → flag
WEAK_AREA_FRAC = 0.06      # largest blob smaller than this fraction of frame → detection weak
CLIP_TOP_RATIO = 1.25      # top margin this much larger than the others → dropped sky → flag


# ── loading ───────────────────────────────────────────────────────────────────
def load_image(path):
    """Return (img, loader). img is the native array (uint8/uint16, gray or BGR)."""
    img = cv2.imread(path, cv2.IMREAD_UNCHANGED)
    if img is not None:
        return img, "cv2"
    if _HAS_PIL:
        pim = Image.open(path)
        arr = np.array(pim)
        # PIL is RGB(A); downstream save via PIL keeps it RGB, so tag the loader.
        if arr.ndim == 3 and arr.shape[2] == 4:
            arr = arr[:, :, :3]
        return arr, "pil"
    raise RuntimeError(f"could not read image: {path}")


def to_gray8(img):
    """Normalized 8-bit single-channel copy used only for masking (never saved)."""
    a = img
    if a.ndim == 3:
        # color → luminance; channel order doesn't matter for a grayscale texture mask.
        a = a[:, :, :3].mean(axis=2)
    a = a.astype(np.float32)
    lo, hi = float(a.min()), float(a.max())
    if hi - lo < 1e-6:
        return np.zeros(a.shape, np.uint8)
    a = (a - lo) * (255.0 / (hi - lo))
    return a.astype(np.uint8)


def to_display8(img):
    """8-bit BGR (or gray) copy for JPEG previews — preserves color, compresses bit depth."""
    a = img
    if a.dtype == np.uint16:
        a = (a.astype(np.float32) / 257.0).clip(0, 255).astype(np.uint8)
    elif a.dtype != np.uint8:
        af = a.astype(np.float32)
        lo, hi = float(af.min()), float(af.max())
        a = ((af - lo) * (255.0 / (hi - lo))).astype(np.uint8) if hi - lo > 1e-6 else af.astype(np.uint8)
    return a


# ── detection (texture-based) ───────────────────────────────────────────────────
def local_std(gray8, win):
    """Local standard deviation over a win×win window (the texture signal)."""
    g = gray8.astype(np.float32)
    mean = cv2.boxFilter(g, ddepth=cv2.CV_32F, ksize=(win, win), normalize=True)
    mean_sq = cv2.boxFilter(g * g, ddepth=cv2.CV_32F, ksize=(win, win), normalize=True)
    var = np.clip(mean_sq - mean * mean, 0, None)
    return np.sqrt(var)


def detect(gray8_full, threshold_mult):
    """Find the emulsion rectangle. Returns (box_px_full, flags, meta) in FULL-res px."""
    H, W = gray8_full.shape[:2]
    scale = min(1.0, DET_MAX_SIDE / max(H, W))
    if scale < 1.0:
        small = cv2.resize(gray8_full, (max(1, round(W * scale)), max(1, round(H * scale))),
                           interpolation=cv2.INTER_AREA)
    else:
        small = gray8_full
    sh, sw = small.shape[:2]

    win = max(7, int(round(min(sh, sw) * VAR_WIN_FRAC)) | 1)  # odd
    std = local_std(small, win)
    std_norm = cv2.normalize(std, None, 0, 255, cv2.NORM_MINMAX).astype(np.uint8)

    # Otsu picks the texture/smooth split; the multiplier lets a human go looser/tighter.
    otsu_t, _ = cv2.threshold(std_norm, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    thr = max(1.0, min(254.0, otsu_t * float(threshold_mult)))
    mask = (std_norm > thr).astype(np.uint8) * 255

    # Solidify the grainy emulsion into one blob; drop tiny specks.
    k = max(3, int(round(min(sh, sw) * 0.02)) | 1)
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k, k))
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel)
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN,
                            cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (max(3, k // 2) | 1,) * 2))

    n, labels, stats, _ = cv2.connectedComponentsWithStats(mask, connectivity=8)
    flags = []
    if n <= 1:
        # Nothing textured found — fall back to a safe inset and flag it.
        inset = 0.02
        box = {"cx": W / 2, "cy": H / 2, "w": W * (1 - 2 * inset), "h": H * (1 - 2 * inset), "angle": 0.0}
        return box, ["detect_weak"], {"area_frac": 0.0, "n_components": 0}

    areas = stats[1:, cv2.CC_STAT_AREA]
    order = np.argsort(areas)[::-1]
    largest = order[0] + 1
    largest_area = float(areas[order[0]])
    frame_area = float(sh * sw)
    area_frac = largest_area / frame_area
    second_frac = float(areas[order[1]]) / largest_area if len(order) > 1 else 0.0

    # minAreaRect on the largest component's pixels (NOT a global ink mask — that would
    # wrongly re-include margin writing, which lives in its own small component).
    ys, xs = np.where(labels == largest)
    pts = np.column_stack([xs, ys]).astype(np.float32)
    (cx, cy), (rw, rh), angle = cv2.minAreaRect(pts)

    # Normalize to a deskew angle in (-45, 45]. OpenCV ≥4.5 returns angle in [0, 90)
    # (a 4° skew can come back as 86°), so fold from either side and swap w/h to match.
    if angle > 45:
        angle -= 90.0
        rw, rh = rh, rw
    elif angle < -45:
        angle += 90.0
        rw, rh = rh, rw

    inv = 1.0 / scale
    box = {"cx": cx * inv, "cy": cy * inv, "w": rw * inv, "h": rh * inv, "angle": float(angle)}

    # ── flags (be aggressive; a flag costs a glance, a silent mis-crop costs the photo) ──
    pts_box = cv2.boxPoints(((cx, cy), (rw, rh), angle))
    minx, miny = pts_box[:, 0].min(), pts_box[:, 1].min()
    maxx, maxy = pts_box[:, 0].max(), pts_box[:, 1].max()
    m_top, m_bot, m_left, m_right = miny, sh - maxy, minx, sw - maxx
    med_other = sorted([m_bot, m_left, m_right])[1]
    # Known failure: a blown-out sky at the top of the photo reads as smooth "paper" and
    # gets dropped from the textured blob, so the top margin balloons relative to the other
    # three. Brightness alone can't tell dropped-sky from a real top border (both smooth +
    # bright), so the *asymmetry* is the signal — gated by a bright-smooth band right above
    # the blob's top edge to confirm something bright was left behind. Flag aggressively.
    if m_top > CLIP_TOP_RATIO * max(med_other, 1.0) and (m_top / sh) > 0.03:
        bw = maxx - minx
        band_h = int(max(6, min(0.12 * (maxy - miny), miny)))
        by0, by1 = max(0, int(miny - band_h)), max(1, int(miny))
        bx0, bx1 = int(minx + 0.1 * bw), int(maxx - 0.1 * bw)
        band = small[by0:by1, bx0:bx1]
        if band.size and float(band.mean()) > 205 and float(band.std()) < 18:
            flags.append("clip_top")

    ar = max(rw, rh) / max(1.0, min(rw, rh))
    if ar > EXTREME_AR:
        flags.append("extreme_aspect")
    if abs(angle) > LARGE_ANGLE_DEG:
        flags.append("large_angle")
    if second_frac > MULTI_COMP_FRAC:
        flags.append("multi_component")
    if area_frac < WEAK_AREA_FRAC:
        flags.append("detect_weak")

    return box, flags, {"area_frac": round(area_frac, 4), "n_components": int(n - 1)}


# ── crop + deskew ───────────────────────────────────────────────────────────────
def crop_deskew(img, box):
    """Rotate about the box center so the rect is axis-aligned, then crop tight.

    angle≈0 is a pure slice (truly lossless); a real skew uses one warpAffine. The
    deskew resample is the only pixel interpolation — no downscaling, no JPEG here.
    """
    cx, cy, w, h, angle = box["cx"], box["cy"], box["w"], box["h"], box["angle"]
    H, W = img.shape[:2]
    if abs(angle) < 1e-3:
        rot = img
    else:
        M = cv2.getRotationMatrix2D((cx, cy), angle, 1.0)
        rot = cv2.warpAffine(img, M, (W, H), flags=cv2.INTER_LINEAR,
                             borderMode=cv2.BORDER_REPLICATE)
    x0 = int(round(cx - w / 2))
    y0 = int(round(cy - h / 2))
    x1 = int(round(cx + w / 2))
    y1 = int(round(cy + h / 2))
    x0, y0 = max(0, x0), max(0, y0)
    x1, y1 = min(rot.shape[1], x1), min(rot.shape[0], y1)
    if x1 <= x0 or y1 <= y0:
        raise RuntimeError("crop box collapses to empty")
    return rot[y0:y1, x0:x1]


def write_jpeg(path, img8, max_side):
    a = img8
    h, w = a.shape[:2]
    s = min(1.0, max_side / max(h, w))
    if s < 1.0:
        a = cv2.resize(a, (max(1, round(w * s)), max(1, round(h * s))), interpolation=cv2.INTER_AREA)
    cv2.imwrite(path, a, [cv2.IMWRITE_JPEG_QUALITY, 86])


def save_master(path, img, loader):
    """Lossless TIFF write, preserving bit depth and channels (LZW-compressed)."""
    if loader == "pil" and _HAS_PIL:
        Image.fromarray(img).save(path, format="TIFF", compression="tiff_lzw")
    else:
        cv2.imwrite(path, img, [cv2.IMWRITE_TIFF_COMPRESSION, 5])  # 5 = LZW


# ── request handling ────────────────────────────────────────────────────────────
def run(req):
    t0 = time.time()
    mode = req["mode"]
    raw_path = req["raw_path"]
    img, loader = load_image(raw_path)
    H, W = img.shape[:2]

    if mode == "apply":
        out = crop_deskew(img, req["box"])
        save_master(req["master_path"], out, loader)
        return {"ok": True, "ms": int((time.time() - t0) * 1000),
                "out_w": int(out.shape[1]), "out_h": int(out.shape[0])}

    # auto / recrop both end by (re)rendering the two previews.
    if mode == "recrop" and req.get("box") is not None:
        box, flags, meta = req["box"], [], {"area_frac": None, "n_components": None}
    else:
        box, flags, meta = detect(to_gray8(img), float(req.get("threshold_mult", 1.0)))

    disp = to_display8(img)
    write_jpeg(req["raw_preview_path"], disp, req.get("preview_max_side", PREVIEW_MAX_SIDE))
    crop = crop_deskew(disp, box)
    write_jpeg(req["crop_preview_path"], crop, req.get("preview_max_side", PREVIEW_MAX_SIDE))

    return {
        "ok": True,
        "box": {k: (round(v, 3) if isinstance(v, float) else v) for k, v in box.items()},
        "flags": flags,
        "raw_w": int(W),
        "raw_h": int(H),
        "channels": int(img.shape[2]) if img.ndim == 3 else 1,
        "dtype": str(img.dtype),
        "threshold_mult": float(req.get("threshold_mult", 1.0)),
        "ms": int((time.time() - t0) * 1000),
        **meta,
    }


def main():
    raw = sys.argv[1] if len(sys.argv) > 1 else sys.stdin.read()
    try:
        req = json.loads(raw)
        print(json.dumps(run(req)))
    except Exception as e:  # one error contract: ok:false, never a stack trace on stdout
        print(json.dumps({"ok": False, "error": f"{type(e).__name__}: {e}"}))
        sys.exit(0)


if __name__ == "__main__":
    main()
