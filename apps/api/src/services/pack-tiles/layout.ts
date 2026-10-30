// A tile's art is drawn at 3× the app's 78 × 84 art box (inside its 4 px padding), with a transparent background
const SCALE = 3;
export const ART = { width: 78 * SCALE, height: 84 * SCALE };
const { width: W, height: H } = ART;
// The front pack is drawn at 76% of the back one, which tops out a little under the box so the pair has air above it
const FRONT = 0.76;
const SLIM_FRONT = 0.92;
const MAX_H = 0.92 * H;
// Packs wider than this (width ÷ height) lie flat
const FLAT = 1.2;

export interface Box { left: number; top: number; width: number; height: number }

const box = (left: number, top: number, width: number, height: number): Box =>
  ({ left: Math.round(left), top: Math.round(top), width: Math.round(width), height: Math.round(height) });

/** Packs lie flat (both wider than tall) or stand up; a tile never mixes the two */
export const isFlat = (aspect: number) => aspect > FLAT;

// An upright pack behind a flat one stands tall at the left; the flat one lies across its lower right, at most half the box high
function uprightBehindFlat(back: number, front: number) {
  const shown = 0.55; // share of the upright pack's width left uncovered
  let hb = MAX_H;
  let hf = Math.min((0.8 * W) / front, 0.5 * H);
  const scale = Math.min(1, W / (back * hb * shown + front * hf));
  hb *= scale;
  hf *= scale;
  const left = (W - (back * hb * shown + front * hf)) / 2;
  return { back: box(left, H - hb, back * hb, hb), front: box(left + back * hb * shown, H - hf, front * hf, hf) };
}

/**
 * Where the back and front packs sit, from their width ÷ height. Two slim bottles stand side by side at the same
 * height; otherwise the back pack is drawn big and the front one smaller, overlapping its lower right, both on the
 * floor. Flat packs are stacked instead: the back one raised so the front one covers its lower part.
 */
export function packLayout(back: number, front: number): { back: Box; front: Box } {
  if (!isFlat(back) && isFlat(front)) return uprightBehindFlat(back, front);
  if ((back + front) * H < 0.72 * W) {
    const h = MAX_H;
    const gap = (W - (back + front) * h) / 3;
    return { back: box(gap, H - h, back * h, h), front: box(2 * gap + back * h, H - h, front * h, h) };
  }
  const flat = isFlat(back) && isFlat(front);
  const overlap = flat ? 0.75 : 0.3;
  const lift = flat ? 0.8 : 0;
  // A slim pack in front of a wide one keeps nearly full height, so it stays visible
  const frontShare = front < 0.5 * back ? SLIM_FRONT : FRONT;
  // Flat packs scale by width, so the front one is FRONT × as wide as the back one
  const frontHeight = (hb: number) => (flat ? (FRONT * back * hb) / front : frontShare * hb);
  let hb = MAX_H;
  for (let i = 0; i < 2; i++) {
    const hf = frontHeight(hb);
    const totalWidth = back * hb + front * hf * (1 - overlap);
    const totalHeight = flat ? hb + hf * lift : hb;
    hb *= Math.min(1, W / totalWidth, MAX_H / totalHeight);
  }
  const wb = back * hb;
  const hf = frontHeight(hb);
  const wf = front * hf;
  const left = (W - (wb + wf * (1 - overlap))) / 2;
  const top = flat ? H - hb - hf * lift : H - hb;
  return { back: box(left, top, wb, hb), front: box(left + wb - wf * overlap, H - hf, wf, hf) };
}
