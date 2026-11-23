"""
Finds the printed price on the full-size original photos with macOS Vision and saves upright close-ups to run/mrp-crops,
so read-mrp.ts can read stamps too small to read in a whole photo, and the approval page can show them. Only for products
with no price yet or two readings that disagree.

  ~/.venvs/rembg-312/bin/python scripts/shelf-photos/crop-mrp.py --run ~/Downloads/psb-products-2026-11-02/run --photos ~/Downloads/psb-products-2026-11-02/105APPLE
"""
import argparse
import json
import re
import subprocess
import tempfile
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from PIL import Image, ImageOps

PRICE = re.compile(r"m\.?\s?r\.?\s?p|max\.?\s*retail|retail price|₹|\brs\.?\s?\d|incl\.? of all", re.I)
WORKERS = 6
MAX_CROPS = 4
OCR_EDGE = 2600
SIDE_PAD = 1.6


def price_rows(photo, ocr, work):
    png = work / f"{photo.stem}.png"
    subprocess.run(["sips", "-s", "format", "png", str(photo), "--out", str(png)], capture_output=True, check=True)
    # The OCR tool's positions are only right on a square image
    page = ImageOps.exif_transpose(Image.open(png)).convert("RGB")
    page.thumbnail((OCR_EDGE, OCR_EDGE))
    side = max(page.size)
    square = Image.new("RGB", (side, side), "white")
    square.paste(page)
    square.save(png)
    out = subprocess.run([str(ocr), str(png)], capture_output=True, text=True, check=True).stdout
    return png, [row for row in map(json.loads, out.splitlines()) if PRICE.search(row["text"])]


def separate(rows):
    """One crop per place on the pack: the same text is found again at other rotations"""
    kept = []
    for row in sorted(rows, key=lambda r: -r["conf"]):
        cx, cy = row["x"] + row["w"] / 2, row["y"] + row["h"] / 2
        if all(abs(cx - k["x"] - k["w"] / 2) > 200 or abs(cy - k["y"] - k["h"] / 2) > 200 for k in kept):
            kept.append(row)
    return kept[:MAX_CROPS]


def crop(image, row):
    long_side = max(row["w"], row["h"])
    x0, x1 = row["x"] - long_side * SIDE_PAD, row["x"] + row["w"] + long_side * SIDE_PAD
    y0, y1 = row["y"] - long_side * SIDE_PAD, row["y"] + row["h"] + long_side * SIDE_PAD
    box = tuple(int(v) for v in (max(x0, 0), max(y0, 0), min(x1, image.width), min(y1, image.height)))
    if box[2] <= box[0] or box[3] <= box[1]:
        return None
    return image.crop(box).rotate(-row["deg"], expand=True).convert("RGB")


def crops_for(photo, ocr, work):
    png, rows = price_rows(photo, ocr, work)
    if not rows:
        return []
    image = Image.open(png)
    return [c for c in (crop(image, row) for row in separate(rows)) if c]


def needs_crops(product):
    label = product["label"]
    return not label.get("printedMrp") or (label.get("mrpCheck") or {}).get("conflict")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--run", required=True, type=Path)
    parser.add_argument("--photos", required=True, type=Path)
    args = parser.parse_args()
    out = args.run / "mrp-crops"
    out.mkdir(exist_ok=True)
    products = [json.loads(p.read_text()) for p in sorted((args.run / "products").glob("*.json"))]
    with tempfile.TemporaryDirectory() as tmp:
        work = Path(tmp)
        ocr = work / "ocr"
        subprocess.run(["swiftc", "-O", str(Path(__file__).parent / "ocr.swift"), "-o", str(ocr)], check=True)
        with ThreadPoolExecutor(WORKERS) as pool:
            for product in filter(needs_crops, products):
                found = [c for cs in pool.map(lambda f: crops_for(args.photos / f, ocr, work), product["photos"]) for c in cs]
                for i, image in enumerate(found[:MAX_CROPS]):
                    image.thumbnail((1200, 1200))
                    image.save(out / f"{product['id']}-{i}.jpg", quality=90)
                print(product["id"], len(found))


if __name__ == "__main__":
    main()
