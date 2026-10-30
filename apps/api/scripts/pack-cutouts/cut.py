"""
Cut a product photo down to its pack on a transparent background, for category pack tiles.

Usage: ~/.venvs/rembg-312/bin/python scripts/pack-cutouts/cut.py <photo> <out.png> [--hull] [--backdrop] [--key] [--xmax 0.68]

rembg (isnet-general-use) finds the pack, then the mask is repaired:
- On a white studio background rembg drops white print where it touches the background (pouch tops, cup lids, white
  cartons) and leaves light areas half transparent. Anything not reachable from the edge through white is put back,
  and the inside is made fully opaque.
- --hull fills bites left in boxes, pouches and cups with the convex hull (never for bottle pairs or odd shapes).
- --backdrop: a coloured glow behind the pack; only near-white print is put back.
- --key: a flat coloured backdrop (Amul butter on green) is keyed out by colour instead of rembg.
- --xmax: drop everything right of this share of the width (a bowl beside the pack).
Always check the result over a contrasting colour before uploading it.
"""
import argparse, os, subprocess, sys, tempfile
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage
from scipy.spatial import ConvexHull

SIZE = 480


def convex_hull(mask):
    ys, xs = np.where(mask)
    pts = np.c_[xs, ys]
    img = Image.new('1', (mask.shape[1], mask.shape[0]), 0)
    ImageDraw.Draw(img).polygon([tuple(map(int, p)) for p in pts[ConvexHull(pts).vertices]], fill=1)
    return np.array(img) | mask


def reachable(mask):
    """Pixels of mask connected to the image edge"""
    lab, _ = ndimage.label(mask)
    edge = np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))
    return np.isin(lab, edge[edge > 0])


def rembg_alpha(photo):
    with tempfile.NamedTemporaryFile(suffix='.png') as out:
        subprocess.run([os.path.join(os.path.dirname(sys.executable), 'rembg'), 'i', '-m', 'isnet-general-use', photo, out.name], check=True, capture_output=True)
        return np.array(Image.open(out.name).convert('RGBA'))[:, :, 3]


def pack_mask(rgb, args, photo):
    if args.key:
        bg = np.median(np.concatenate([rgb[0], rgb[-1], rgb[:, 0], rgb[:, -1]]), axis=0)
        return ~reachable(np.abs(rgb - bg).sum(axis=2) < 60), None
    alpha = rembg_alpha(photo)
    white = (rgb > 246).all(axis=2)
    if np.concatenate([white[0], white[-1], white[:, 0], white[:, -1]]).mean() <= 0.9:
        return alpha > 128, alpha
    inside = ~reachable(white)
    if args.backdrop:
        grey = (rgb.max(axis=2) - rgb.min(axis=2) < 24) & (rgb.min(axis=2) > 200)
        inside &= (alpha > 24) | grey
    return (alpha > 24) | inside, alpha


def main():
    p = argparse.ArgumentParser()
    p.add_argument('photo'); p.add_argument('out')
    p.add_argument('--hull', action='store_true'); p.add_argument('--backdrop', action='store_true')
    p.add_argument('--key', action='store_true'); p.add_argument('--xmax', type=float)
    args = p.parse_args()
    rgb = np.array(Image.open(args.photo).convert('RGB')).astype(int)
    fg, alpha = pack_mask(rgb, args, args.photo)
    if args.xmax:
        fg[:, int(args.xmax * fg.shape[1]):] = False
    lab, n = ndimage.label(fg)
    main_part = lab == (np.argmax(ndimage.sum(fg, lab, range(1, n + 1))) + 1)
    mask = ndimage.binary_opening(ndimage.binary_fill_holes(main_part), iterations=1)
    if args.hull:
        mask = convex_hull(mask)
    edge_alpha = np.maximum(alpha, 160) if alpha is not None else 255
    a = np.where(ndimage.binary_erosion(mask, iterations=2), 255, np.where(mask, edge_alpha, 0)).astype(np.uint8)
    ys, xs = np.where(mask)
    img = Image.fromarray(np.dstack([rgb.astype(np.uint8), a]), 'RGBA').crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))
    img.thumbnail((SIZE, SIZE), Image.LANCZOS)
    img.save(args.out, optimize=True)
    print(args.out, img.size)


if __name__ == '__main__':
    main()
