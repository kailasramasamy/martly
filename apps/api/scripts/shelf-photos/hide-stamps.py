"""
Step 3 of the shelf-photo import, fully local: hides MRP, batch, packing and expiry details on the rendered images.
macOS Vision finds the text (ocr.swift, at all four rotations) and matching blocks are filled with their surrounding colour.
Reads run/rendered, writes run/final and run/hidden.json; rendered images are never changed. Printed price badges in the
artwork are often not found, and busy backgrounds can leave a visible patch, so these still need a look on the approval page.

  ~/.venvs/rembg-312/bin/python scripts/shelf-photos/hide-stamps.py --run ~/Downloads/psb-products-2026-11-02/run [--force]
"""
import argparse
import json
import re
import subprocess
import tempfile
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

MONTH = r"(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*"
CAPTION = re.compile(
    r"^\W*(m\.?\s?r\.?\s?p|max\.?\s*retail|retail price|unit (sale|selling)|selling price|incl\.? of all|\(?per g|\(?rs\.? per|batch|b\.?\s?no"
    r"|lot\s?no|pkd|mfd|mfg|ubd|use by|used by|best before|exp(iry)?\b|(the )?date of (pack|mfg|manuf)|packed on|pack(ing|ed) date|usp\b)",
    re.I,
)
VALUE = re.compile(
    r"(₹|\brs\.?\s?\d|\d{1,2}\s?[/-]\s?\d{1,2}\s?[/-]\s?\d{2,4}|\d{1,2}[/-]\d{4}|\d{1,2}:\d{2}\b|\d+\.\d\d\s*[(c]"
    r"|usp\s*[:.]|\d+\.\d\.\d+/\d+|\d{2,}\.\d+/\d+|\b\d{1,2}\s*" + MONTH + r"\s*\d{2,4}\b|\b" + MONTH + r"\s*\d{4}\b)",
    re.I,
)
KEEP = re.compile(
    r"net\s*(weight|wt|quantity)|contents|consumer|complaint|fssai|\blic\b|phone|call|\btel\b|care|contact|\bcell\b|\+91|@|www\."
    r"|\b\d{3,5}-\d{5,}|\b(mf[gd]|mkt|marketed|manufactured|packed)\b[.\s&a-z]*\bby\b",
    re.I,
)
SIDEWAYS_PRICE = re.compile(r"^\W*[₹7z]?\d{2,4}\.\d{2}\b", re.I)
MAX_LINE = 45
PAD, GAP = 6, 34
SAME_COLOUR = 40
PLAIN_SHARE = 0.5
HALO_SHARE = 0.05
WORKERS = 6


def read_text(ocr, png, cache):
    if cache.exists():
        return json.loads(cache.read_text())
    out = subprocess.run([str(ocr), str(png)], capture_output=True, text=True, check=True).stdout
    rows = [json.loads(line) for line in out.splitlines()]
    cache.write_text(json.dumps(rows, ensure_ascii=False))
    return rows


def is_stamp(row):
    text = row["text"]
    if KEEP.search(text) or len(text) > MAX_LINE:
        return False
    sideways = row["h"] > row["w"] * 1.5
    return bool(CAPTION.search(text) or VALUE.search(text) or (sideways and SIDEWAYS_PRICE.search(text)))


def clear_halo(alpha):
    """A render can leave a faint glow around the pack; only the worst ones are cut back to the solid pack"""
    solid = (alpha >= 250).sum()
    faint = ((alpha >= 8) & (alpha < 250)).sum()
    if faint <= solid * HALO_SHARE:
        return alpha, False
    hard = (alpha >= 200).astype(np.float32)
    return (cv2.GaussianBlur(hard, (0, 0), 0.8) * 255).astype(np.uint8), True


def box(row):
    return [int(row["x"]) - PAD, int(row["y"]) - PAD, int(row["x"] + row["w"]) + PAD, int(row["y"] + row["h"]) + PAD]


def ring(alpha, b, width=8):
    x0, y0, x1, y1 = b
    height, wide = alpha.shape
    mask = np.zeros((height, wide), bool)
    mask[max(y0 - width, 0):min(y1 + width, height), max(x0 - width, 0):min(x1 + width, wide)] = True
    mask[max(y0, 0):y1, max(x0, 0):x1] = False
    return mask & (alpha > 200)


def main_colour(rgb, alpha, b):
    """The ring's most common colour and how much of the ring it covers; a low share means a busy background"""
    pixels = rgb[ring(alpha, b)]
    if not len(pixels):
        return np.array([255.0, 255.0, 255.0]), 0.0
    coarse = (pixels // 24).astype(np.int32)
    keys = coarse[:, 0] * 1024 + coarse[:, 1] * 32 + coarse[:, 2]
    values, counts = np.unique(keys, return_counts=True)
    top = values[counts.argmax()]
    return np.median(pixels[keys == top], axis=0), counts.max() / len(pixels)


def near(a, b):
    return a[0] - GAP <= b[2] and b[0] - GAP <= a[2] and a[1] - GAP <= b[3] and b[1] - GAP <= a[3]


def merge_blocks(items):
    """Joins neighbouring lines on the same background into one block, so a stamp is hidden whole"""
    merged = True
    while merged:
        merged = False
        for i, a in enumerate(items):
            for j in range(i + 1, len(items)):
                b = items[j]
                if near(a["box"], b["box"]) and np.abs(a["colour"] - b["colour"]).max() < SAME_COLOUR:
                    a["box"] = [min(a["box"][0], b["box"][0]), min(a["box"][1], b["box"][1]), max(a["box"][2], b["box"][2]), max(a["box"][3], b["box"][3])]
                    a["share"] = max(a["share"], b["share"])
                    del items[j]
                    merged = True
                    break
            if merged:
                break
    return items


def block_mask(shape, b, keeps):
    mask = np.zeros(shape, np.uint8)
    mask[max(b[1], 0):b[3], max(b[0], 0):b[2]] = 255
    for k in keeps:
        mask[max(k[1], 0):k[3], max(k[0], 0):k[2]] = 0
    return mask


def hide(image_path, out_path, ocr, scratch, cache):
    image = Image.open(image_path).convert("RGBA")
    pixels = np.array(image)
    rgb, alpha = pixels[..., :3].astype(np.float32), pixels[..., 3]
    alpha, halo = clear_halo(alpha)
    flat = Image.new("RGBA", image.size, (255, 255, 255, 255))
    flat.alpha_composite(image)
    png = scratch / f"{image_path.stem}.png"
    flat.convert("RGB").save(png)
    rows = read_text(ocr, png, cache)
    keeps = [box(r) for r in rows if KEEP.search(r["text"])]
    found = [r for r in rows if is_stamp(r)]
    items = []
    for row in found:
        colour, share = main_colour(rgb, alpha, box(row))
        items.append({"box": box(row), "colour": colour, "share": share})
    out, patchy = rgb.copy(), 0
    for item in merge_blocks(items):
        mask = block_mask(alpha.shape, item["box"], keeps)
        if item["share"] >= PLAIN_SHARE:
            soft = cv2.GaussianBlur(mask.astype(np.float32) / 255, (0, 0), 1.5)[..., None]
            out = out * (1 - soft) + item["colour"] * soft
        else:
            patchy += 1
            out = cv2.inpaint(out.clip(0, 255).astype(np.uint8), mask, 7, cv2.INPAINT_TELEA).astype(np.float32)
    Image.fromarray(np.dstack([out.clip(0, 255).astype(np.uint8), alpha])).save(out_path, quality=88, method=4, exact=True)
    return {"hidden": sorted({r["text"][:40] for r in found}), "blocks": len(items), "busyBackground": patchy, "halo": halo}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--run", required=True, type=Path)
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()
    final, ocr_dir = args.run / "final", args.run / "ocr"
    final.mkdir(exist_ok=True)
    ocr_dir.mkdir(exist_ok=True)
    log_path = args.run / "hidden.json"
    log = json.loads(log_path.read_text()) if log_path.exists() else {}
    with tempfile.TemporaryDirectory() as tmp:
        scratch = Path(tmp)
        ocr = scratch / "ocr"
        subprocess.run(["swiftc", "-O", str(Path(__file__).parent / "ocr.swift"), "-o", str(ocr)], check=True)
        todo = [p for p in sorted((args.run / "rendered").glob("*.webp")) if args.force or not (final / p.name).exists()]
        with ThreadPoolExecutor(WORKERS) as pool:
            jobs = {pool.submit(hide, p, final / p.name, ocr, scratch, ocr_dir / f"{p.stem}.json"): p.name for p in todo}
            for job in as_completed(jobs):
                log[jobs[job]] = job.result()
                log_path.write_text(json.dumps(log, ensure_ascii=False, indent=1))
    print(f"{len(log)} images done; {sum(1 for v in log.values() if v['blocks'])} had something hidden; {sum(1 for v in log.values() if v['busyBackground'])} on a busy background; {sum(1 for v in log.values() if v['halo'])} halos cut")


if __name__ == "__main__":
    main()
