import sharp from "sharp";
import { formatCm, type ItemSize } from "@martly/shared/item-size";
import type { ItemShape } from "@martly/shared/constants";
import { textPaths, textWidth } from "./glyphs.js";

const SIZE = 1000;
const TEXT_SIZE = 33;
const OFFSET = 36;
const PILL_TEXT_SIZE = 34;
const PILL_HEIGHT = 64;
const PILL_PADDING = 26;
const PILL_MARGIN = 28;
const TICK = 14;
const LEGEND_TEXT_SIZE = 26;
const LEGEND_HEIGHT = 48;
const LEGEND_PADDING = 18;
const LEGEND_MARGIN = 24;
const TEXT_MARGIN = 12;
const INK = "#0f172a";
const LINE = "#0f766e";
// How far from pure white a pixel must be to count as the item rather than its faint shadow
const ITEM_DISTANCE = 40;
// Blurring and re-thresholding the mask drops thin parts such as a bucket's wire handle
const BODY_BLUR = 26;
// With more of the frame's edge than this not white, the background wasn't removed and the edges can't be found
const MOST_EDGE_INK = 0.05;
// Hull steps shorter than this are rounding at a corner, not a side of the box
const SHORTEST_SIDE_PX = 30;
// A side rising faster than this is an upright edge of the box rather than one along the table
const UPRIGHT_SLOPE = 1.2;
// Hull steps within this many degrees of each other belong to one straight side
const STRAIGHT_TURN = 12;
// A top edge at least this far off the bottom edge's direction runs back from the camera, so it shows the width
const LEAST_RECEDING_TURN = 20;
// A rounded corner is rebuilt by extending its two sides until they meet, unless that lands further off than this
const FURTHEST_CORNER_PX = 70;
// A side showing less than this share of its true proportion is too turned away to draw a line along
const LEAST_SIDE_SHOWN = 0.5;

interface Point { x: number; y: number }
interface Margins { top: number; right: number; bottom: number; left: number }
type Mask = Uint8Array;

// Room around the item for the lines and their values
const MARGINS: Record<ItemShape, Margins> = {
  ROUND: { top: 50, right: 280, bottom: 160, left: 70 },
  BOX: { top: 120, right: 280, bottom: 130, left: 130 },
  FLAT: { top: 190, right: 240, bottom: 190, left: 190 },
};

function itemMask(rgb: Buffer): Mask {
  const mask = new Uint8Array(SIZE * SIZE);
  for (let i = 0; i < mask.length; i++) {
    const darkest = Math.min(rgb[i * 3], rgb[i * 3 + 1], rgb[i * 3 + 2]);
    mask[i] = 255 - darkest > ITEM_DISTANCE ? 255 : 0;
  }
  return mask;
}

function boundsOf(mask: Mask) {
  let [left, top, right, bottom] = [SIZE, SIZE, -1, -1];
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      if (!mask[y * SIZE + x]) continue;
      left = Math.min(left, x); right = Math.max(right, x);
      top = Math.min(top, y); bottom = Math.max(bottom, y);
    }
  }
  return right < 0 ? null : { left, top, right, bottom };
}

function edgeInkShare(mask: Mask) {
  let ink = 0;
  for (let i = 0; i < SIZE; i++) {
    for (const at of [i, (SIZE - 1) * SIZE + i, i * SIZE, i * SIZE + SIZE - 1]) if (mask[at]) ink++;
  }
  return ink / (4 * SIZE);
}

const squareRgb = (image: Buffer) =>
  sharp(image).rotate().flatten({ background: "#ffffff" })
    .resize(SIZE, SIZE, { fit: "contain", background: "#ffffff" }).removeAlpha().raw().toBuffer();

/** Moves the item into the room its margins leave; null if the photo's background wasn't removed */
async function placeItem(photo: Buffer, margins: Margins) {
  const rgb = await squareRgb(photo);
  const mask = itemMask(rgb);
  const bounds = boundsOf(mask);
  if (!bounds || edgeInkShare(mask) > MOST_EDGE_INK) return null;
  const crop = { left: bounds.left, top: bounds.top, width: bounds.right - bounds.left + 1, height: bounds.bottom - bounds.top + 1 };
  const room = { width: SIZE - margins.left - margins.right, height: SIZE - margins.top - margins.bottom };
  const item = await sharp(rgb, { raw: { width: SIZE, height: SIZE, channels: 3 } }).extract(crop)
    .resize({ ...room, fit: "inside" }).png().toBuffer({ resolveWithObject: true });
  const left = margins.left + Math.round((room.width - item.info.width) / 2);
  const top = margins.top + Math.round((room.height - item.info.height) / 2);
  // The photo's own white, so its edge doesn't show against the canvas
  const background = { r: rgb[0], g: rgb[1], b: rgb[2] };
  return sharp({ create: { width: SIZE, height: SIZE, channels: 3, background } })
    .composite([{ input: item.data, left, top }]).png().toBuffer();
}

async function bodyOf(mask: Mask): Promise<Mask> {
  const { data } = await sharp(Buffer.from(mask), { raw: { width: SIZE, height: SIZE, channels: 1 } })
    .blur(BODY_BLUR).extractChannel(0).raw().toBuffer({ resolveWithObject: true });
  return Uint8Array.from(data, (value) => (value >= 128 ? 255 : 0));
}

/** The outer points of the mask, as a convex loop */
function hullOf(mask: Mask): Point[] {
  const points: Point[] = [];
  for (let y = 0; y < SIZE; y++) {
    let [first, last] = [-1, -1];
    for (let x = 0; x < SIZE; x++) {
      if (!mask[y * SIZE + x]) continue;
      if (first < 0) first = x;
      last = x;
    }
    if (first >= 0) points.push({ x: first, y }, { x: last, y });
  }
  const sorted = points.sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (o: Point, a: Point, b: Point) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const chain = (list: Point[]) => {
    const out: Point[] = [];
    for (const p of list) {
      while (out.length >= 2 && cross(out[out.length - 2], out[out.length - 1], p) <= 0) out.pop();
      out.push(p);
    }
    return out.slice(0, -1);
  };
  return [...chain(sorted), ...chain([...sorted].reverse())];
}

const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const centreOf = (points: Point[]) => ({
  x: points.reduce((sum, p) => sum + p.x, 0) / points.length,
  y: points.reduce((sum, p) => sum + p.y, 0) / points.length,
});

/** A line parallel to a→b, set off on the side away from `away`, with end ticks and its value beyond it */
function dimension(a: Point, b: Point, away: Point, text: string) {
  const length = distance(a, b) || 1;
  const along = { x: (b.x - a.x) / length, y: (b.y - a.y) / length };
  let normal = { x: -along.y, y: along.x };
  const middle = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  if ((middle.x - away.x) * normal.x + (middle.y - away.y) * normal.y < 0) normal = { x: -normal.x, y: -normal.y };
  const shift = (p: Point, by: number) => ({ x: p.x + normal.x * by, y: p.y + normal.y * by });
  const [from, to] = [shift(a, OFFSET), shift(b, OFFSET)];
  const ticks = [from, to].map((p) => `M${shift(p, -TICK).x} ${shift(p, -TICK).y}L${shift(p, TICK).x} ${shift(p, TICK).y}`).join("");
  const width = textWidth(text, TEXT_SIZE);
  const reach = OFFSET + TICK + 8 + Math.abs(normal.x) * width / 2 + Math.abs(normal.y) * TEXT_SIZE / 2;
  const placed = shift(middle, reach);
  // A short line near the frame's edge still keeps its value on the image
  const centre = { x: Math.min(Math.max(placed.x, width / 2 + TEXT_MARGIN), SIZE - width / 2 - TEXT_MARGIN), y: Math.max(placed.y, TEXT_SIZE + TEXT_MARGIN) };
  return `<path d="M${from.x} ${from.y}L${to.x} ${to.y}${ticks}" stroke="${LINE}" stroke-width="4" fill="none" stroke-linecap="round"/>`
    + textPaths(text, centre.x - width / 2, centre.y + TEXT_SIZE / 2, TEXT_SIZE, INK);
}

const cm = (letter: string, mm?: number | null) => `${letter} ${formatCm(mm ?? 0)}`;

/** The diameter spans the body alone, and the height line stands clear of any side handle */
function roundLines(mask: Mask, body: Mask, size: ItemSize) {
  const [bounds, whole] = [boundsOf(body), boundsOf(mask)];
  if (!bounds || !whole) return null;
  const { left, right, top, bottom } = bounds;
  const centre = { x: (left + right) / 2, y: (top + bottom) / 2 };
  return dimension({ x: left, y: bottom }, { x: right, y: bottom }, centre, cm("Ø", size.topDiameterMm))
    + dimension({ x: whole.right, y: top }, { x: whole.right, y: bottom }, centre, cm("H", size.heightMm));
}

interface Side { a: Point; b: Point; length: number; normal: Point }

const sideOf = (a: Point, b: Point, centre: Point): Side => {
  const length = distance(a, b) || 1;
  const normal = { x: -(b.y - a.y) / length, y: (b.x - a.x) / length };
  const outward = ((a.x + b.x) / 2 - centre.x) * normal.x + ((a.y + b.y) / 2 - centre.y) * normal.y >= 0;
  return { a, b, length, normal: outward ? normal : { x: -normal.x, y: -normal.y } };
};

/** Degrees between two directions, whichever way along them they run */
function turnBetween(a: Point, b: Point, c: Point, d: Point) {
  const turn = Math.abs(Math.atan2(b.y - a.y, b.x - a.x) - Math.atan2(d.y - c.y, d.x - c.x)) * 180 / Math.PI % 180;
  return Math.min(turn, 180 - turn);
}

/** Where a side's line meets another's, unless they're nearly parallel or it lands too far from `end` */
function cornerWith(side: Side, other: Side, end: Point) {
  const [p, r, q, s] = [side.a, { x: side.b.x - side.a.x, y: side.b.y - side.a.y }, other.a, { x: other.b.x - other.a.x, y: other.b.y - other.a.y }];
  const across = r.x * s.y - r.y * s.x;
  if (Math.abs(across) < 1e-6) return end;
  const t = ((q.x - p.x) * s.y - (q.y - p.y) * s.x) / across;
  const meet = { x: p.x + r.x * t, y: p.y + r.y * t };
  return distance(meet, end) > FURTHEST_CORNER_PX ? end : meet;
}

/** The box's straight sides round the hull. The hull starts at its leftmost point, which is on a corner, not mid-side */
function sidesOf(hull: Point[], centre: Point) {
  const chains: [Point, Point][] = [];
  let start = 0;
  for (let i = 1; i <= hull.length; i++) {
    const [last, next] = [hull[i - 1], hull[i % hull.length]];
    if (i - 1 > start && turnBetween(hull[start], last, last, next) > STRAIGHT_TURN) {
      chains.push([hull[start], last]);
      start = i - 1;
    }
  }
  chains.push([hull[start], hull[0]]);
  const kept = chains.map(([a, b]) => sideOf(a, b, centre)).filter((side) => side.length >= SHORTEST_SIDE_PX);
  return kept.map((side, i) => {
    const [before, after] = [kept[(i - 1 + kept.length) % kept.length], kept[(i + 1) % kept.length]];
    return sideOf(cornerWith(side, before, side.a), cornerWith(side, after, side.b), centre);
  });
}

const isUpright = (side: Side) => Math.abs(side.b.y - side.a.y) > Math.abs(side.b.x - side.a.x) * UPRIGHT_SLOPE;
const longestFirst = (sides: Side[]) => [...sides].sort((a, b) => b.length - a.length);
const lowerSides = (sides: Side[]) => longestFirst(sides.filter((side) => !isUpright(side) && side.normal.y > 0));

/** The height goes on an upright side, on the right if there is one */
function heightSide(sides: Side[]) {
  const upright = longestFirst(sides.filter(isUpright));
  return upright.find((side) => side.normal.x > 0) ?? upright[0];
}

function boxLines(body: Mask, size: ItemSize) {
  const hull = hullOf(body);
  if (hull.length < 3) return null;
  const centre = centreOf(hull);
  const sides = sidesOf(hull, centre);
  const [base, second] = lowerSides(sides);
  const upright = heightSide(sides);
  if (!base || !upright) return null;
  const line = (side: Side, text: string) => dimension(side.a, side.b, centre, text);
  const [length, width] = [size.lengthMm ?? 1, size.widthMm ?? 1];
  const height = line(upright, cm("H", size.heightMm));
  // Both bottom edges show: the longer one on screen is the length
  if (second && second.length / base.length >= LEAST_SIDE_SHOWN * Math.min(length, width) / Math.max(length, width)) {
    return line(base, cm("L", size.lengthMm)) + line(second, cm("W", size.widthMm)) + height;
  }
  // A front shot: the facing side is taken as the length, and the width runs back along the top
  const [receding] = longestFirst(sides.filter((side) =>
    !isUpright(side) && side.normal.y < 0 && turnBetween(side.a, side.b, base.a, base.b) >= LEAST_RECEDING_TURN));
  if (receding) return line(base, cm("L", size.lengthMm)) + line(receding, cm("W", size.widthMm)) + height;
  // Level with the top, so the width can't be drawn at all
  const unseen = cm("W", size.widthMm);
  const noteX = (base.a.x + base.b.x) / 2 - textWidth(unseen, TEXT_SIZE) / 2;
  const note = textPaths(unseen, noteX, Math.max(base.a.y, base.b.y) + OFFSET + TICK + 2.6 * TEXT_SIZE, TEXT_SIZE, INK);
  return line(base, cm("L", size.lengthMm)) + height + note;
}

/** The tightest rectangle around the hull at any angle, as its 4 corners */
function tightestRectangle(hull: Point[]) {
  let best: { area: number; corners: Point[] } | null = null;
  for (let i = 0; i < hull.length; i++) {
    const [a, b] = [hull[i], hull[(i + 1) % hull.length]];
    const length = distance(a, b) || 1;
    const u = { x: (b.x - a.x) / length, y: (b.y - a.y) / length };
    const along = hull.map((p) => p.x * u.x + p.y * u.y);
    const across = hull.map((p) => -p.x * u.y + p.y * u.x);
    const [a0, a1, c0, c1] = [Math.min(...along), Math.max(...along), Math.min(...across), Math.max(...across)];
    const area = (a1 - a0) * (c1 - c0);
    const at = (s: number, t: number) => ({ x: s * u.x - t * u.y, y: s * u.y + t * u.x });
    if (!best || area < best.area) best = { area, corners: [at(a0, c0), at(a1, c0), at(a1, c1), at(a0, c1)] };
  }
  return best?.corners ?? null;
}

function flatLines(mask: Mask, size: ItemSize) {
  const corners = tightestRectangle(hullOf(mask));
  if (!corners) return null;
  const centre = centreOf(corners);
  const sides = corners.map((a, i) => ({ a, b: corners[(i + 1) % 4] }));
  const lower = (s: { a: Point; b: Point }) => s.a.y + s.b.y;
  const rightward = (s: { a: Point; b: Point }) => s.a.x + s.b.x;
  const long = distance(sides[0].a, sides[0].b) >= distance(sides[1].a, sides[1].b) ? [sides[0], sides[2]] : [sides[1], sides[3]];
  const short = long[0] === sides[0] ? [sides[1], sides[3]] : [sides[0], sides[2]];
  const lengthSide = lower(long[0]) >= lower(long[1]) ? long[0] : long[1];
  const widthSide = rightward(short[0]) >= rightward(short[1]) ? short[0] : short[1];
  return dimension(lengthSide.a, lengthSide.b, centre, cm("L", size.lengthMm))
    + dimension(widthSide.a, widthSide.b, centre, cm("W", size.widthMm));
}

/** The volume on a solid pill at the bottom right, clear of the lines; the text is centred on the pill */
function capacityPill(text: string) {
  const width = textWidth(text, PILL_TEXT_SIZE) + 2 * PILL_PADDING;
  const [x, y] = [SIZE - width - PILL_MARGIN, SIZE - PILL_HEIGHT - PILL_MARGIN];
  return `<rect x="${x}" y="${y}" width="${width}" height="${PILL_HEIGHT}" rx="${PILL_HEIGHT / 2}" fill="${LINE}"/>`
    + textPaths(text, x + PILL_PADDING, y + PILL_HEIGHT / 2 + PILL_TEXT_SIZE / 2, PILL_TEXT_SIZE, "#ffffff");
}

/** Which view a photo is, as a small tag at the top left */
function legendTag(text: string) {
  const width = textWidth(text, LEGEND_TEXT_SIZE) + 2 * LEGEND_PADDING;
  return `<rect x="${LEGEND_MARGIN}" y="${LEGEND_MARGIN}" width="${width}" height="${LEGEND_HEIGHT}" rx="${LEGEND_HEIGHT / 2}" fill="#f1f5f9"/>`
    + textPaths(text, LEGEND_MARGIN + LEGEND_PADDING, LEGEND_MARGIN + LEGEND_HEIGHT / 2 + LEGEND_TEXT_SIZE / 2, LEGEND_TEXT_SIZE, INK);
}

/** A copy of a cleaned photo with its view marked on it, for the product gallery */
export async function photoWithLegend(photo: Buffer, legend: string) {
  const square = await sharp(photo).rotate().flatten({ background: "#ffffff" })
    .resize(SIZE, SIZE, { fit: "contain", background: "#ffffff" }).png().toBuffer();
  const overlay = `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}">${legendTag(legend)}</svg>`;
  return sharp(square).composite([{ input: Buffer.from(overlay) }]).webp({ quality: 88 }).toBuffer();
}

/** How much of its shorter side a box shows in this photo, from 0 (a front shot) to 1 */
async function boxSideShown(photo: Buffer) {
  const placed = await placeItem(photo, MARGINS.BOX);
  if (!placed) return -1;
  const hull = hullOf(await bodyOf(itemMask(await squareRgb(placed))));
  if (hull.length < 3) return -1;
  const [base, second] = lowerSides(sidesOf(hull, centreOf(hull)));
  return base && second ? second.length / base.length : 0;
}

/**
 * The item's cleaned photo with its measured sizes marked on it, as a square image for the product gallery.
 * Give `capacity`, such as "~ 350 ml", to show the volume too.
 * Null if the photo still has its background, because the item's edges can't be found without AI.
 */
async function renderSizedPhoto(photo: Buffer, size: ItemSize, capacity?: string | null, legend?: string) {
  const placed = await placeItem(photo, MARGINS[size.shape]);
  if (!placed) return null;
  const mask = itemMask(await squareRgb(placed));
  const lines = size.shape === "ROUND" ? roundLines(mask, await bodyOf(mask), size)
    : size.shape === "BOX" ? boxLines(await bodyOf(mask), size)
    : flatLines(mask, size);
  if (!lines) return null;
  const overlay = `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}">${lines}${legend ? legendTag(legend) : ""}${capacity ? capacityPill(capacity) : ""}${textPaths("approx.", 30, SIZE - 34, 24, "#64748b")}</svg>`;
  return sharp(placed).composite([{ input: Buffer.from(overlay) }]).webp({ quality: 88 }).toBuffer();
}

/**
 * Marks the sizes on the best of the item's cleaned photos, given Top first: the first top view for a flat item,
 * and for a standing one the Angled view if there is one, otherwise the Front or Side view, preferring whichever
 * shows more of a box's sides.
 */
export async function bestSizedPhoto(all: { photo: Buffer; legend?: string }[], size: ItemSize, capacity?: string | null) {
  const photos = all.map((view) => view.photo);
  const legendOf = (photo: Buffer) => all.find((view) => view.photo === photo)?.legend;
  const views = size.shape === "FLAT" || photos.length < 2 ? photos : photos.slice(1);
  const shown = size.shape === "BOX" ? await Promise.all(views.map(boxSideShown)) : views.map(() => 0);
  const ranked = views.map((photo, i) => ({ photo, shown: shown[i] })).sort((a, b) => b.shown - a.shown).map((view) => view.photo);
  const angled = photos.length === 4 ? photos[2] : null;
  for (const photo of angled ? [angled, ...ranked] : ranked) {
    const marked = await renderSizedPhoto(photo, size, capacity, legendOf(photo));
    if (marked) return marked;
  }
  return null;
}
