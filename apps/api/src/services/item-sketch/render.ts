import sharp from "sharp";
import { formatCm, type ItemSize } from "@martly/shared/item-size";
import { textPaths, textWidth } from "./glyphs.js";

const SIZE = 1000;
const MARGIN = 120;
const GAP = 90;
const TEXT_SIZE = 34;
const INK = "#0f172a";
const LINE = "#0f766e";
const FILL = "#f1f5f9";

type Outline = [number, number][];
interface Box { x: number; y: number; w: number; h: number }

const label = formatCm;

/** A dimension line with end ticks and its value, below a shape or to its right */
function dimension(box: Box, side: "below" | "right", text: string) {
  const tick = 12;
  if (side === "below") {
    const y = box.y + box.h + 34;
    const tx = box.x + box.w / 2 - textWidth(text, TEXT_SIZE) / 2;
    return `<path d="M${box.x} ${y}H${box.x + box.w}M${box.x} ${y - tick}V${y + tick}M${box.x + box.w} ${y - tick}V${y + tick}" stroke="${LINE}" stroke-width="3" fill="none"/>${textPaths(text, tx, y + 16 + TEXT_SIZE, TEXT_SIZE, INK)}`;
  }
  const x = box.x + box.w + 34;
  const ty = box.y + box.h / 2 + TEXT_SIZE / 2;
  return `<path d="M${x} ${box.y}V${box.y + box.h}M${x - tick} ${box.y}H${x + tick}M${x - tick} ${box.y + box.h}H${x + tick}" stroke="${LINE}" stroke-width="3" fill="none"/>${textPaths(text, x + 22, ty, TEXT_SIZE, INK)}`;
}

const shapeStyle = `fill="${FILL}" stroke="${INK}" stroke-width="5" stroke-linejoin="round"`;

/** The item's real outline, stretched to its true proportions; a plain side view if the size was typed by hand */
function frontView(box: Box, size: ItemSize, outline?: Outline) {
  if (outline && outline.length >= 3) {
    const d = outline.map(([x, y], i) => `${i ? "L" : "M"}${(box.x + x * box.w).toFixed(1)} ${(box.y + y * box.h).toFixed(1)}`).join("");
    return `<path d="${d}Z" ${shapeStyle}/>`;
  }
  const top = size.topDiameterMm ?? size.lengthMm ?? 1;
  const base = size.baseDiameterMm ?? top;
  const inset = ((1 - Math.min(base / top, 1)) * box.w) / 2;
  return `<path d="M${box.x} ${box.y}H${box.x + box.w}L${box.x + box.w - inset} ${box.y + box.h}H${box.x + inset}Z" ${shapeStyle}/>`;
}

function roundSketch(size: ItemSize, outline?: Outline) {
  const diameter = size.topDiameterMm ?? 1;
  const height = size.heightMm ?? 1;
  const usable = SIZE - 2 * MARGIN - GAP;
  const scale = Math.min((SIZE - 2 * MARGIN - 120) / diameter, usable / (height + diameter));
  const w = diameter * scale;
  const x = (SIZE - w) / 2 - 40;
  const front: Box = { x, y: MARGIN - 40, w, h: height * scale };
  const top: Box = { x, y: front.y + front.h + GAP + 40, w, h: w };
  return [
    frontView(front, size, outline),
    dimension(front, "right", label(height)),
    `<circle cx="${x + w / 2}" cy="${top.y + w / 2}" r="${w / 2}" ${shapeStyle}/>`,
    dimension(top, "right", `Ø ${label(diameter)}`),
  ].join("");
}

function boxSketch(size: ItemSize, outline?: Outline) {
  const length = size.lengthMm ?? 1;
  const width = size.widthMm ?? 1;
  const height = size.heightMm ?? 1;
  const usable = SIZE - 2 * MARGIN - GAP;
  const scale = Math.min((SIZE - 2 * MARGIN - 120) / length, usable / (height + width));
  const w = length * scale;
  const x = (SIZE - w) / 2 - 40;
  const front: Box = { x, y: MARGIN - 40, w, h: height * scale };
  const top: Box = { x, y: front.y + front.h + GAP + 40, w, h: width * scale };
  return [
    frontView(front, size, outline),
    dimension(front, "right", label(height)),
    `<rect x="${top.x}" y="${top.y}" width="${top.w}" height="${top.h}" rx="8" ${shapeStyle}/>`,
    dimension(top, "right", label(width)),
    dimension(top, "below", label(length)),
  ].join("");
}

function flatSketch(size: ItemSize) {
  const length = size.lengthMm ?? 1;
  const width = size.widthMm ?? 1;
  const scale = (SIZE - 2 * MARGIN - 120) / Math.max(length, width);
  const box: Box = { x: 0, y: 0, w: length * scale, h: width * scale };
  box.x = (SIZE - box.w) / 2 - 40;
  box.y = (SIZE - box.h) / 2 - 30;
  return [
    `<rect x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}" rx="8" ${shapeStyle}/>`,
    dimension(box, "right", label(width)),
    dimension(box, "below", label(length)),
  ].join("");
}

/** Draws the item with its measured sizes as a square image for the product gallery */
export function renderItemSketch(size: ItemSize, outline?: Outline) {
  const body = size.shape === "ROUND" ? roundSketch(size, outline) : size.shape === "BOX" ? boxSketch(size, outline) : flatSketch(size);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}"><rect width="100%" height="100%" fill="#fff"/>${body}${textPaths("approx.", 30, SIZE - 34, 24, "#64748b")}</svg>`;
  return sharp(Buffer.from(svg)).webp({ quality: 88 }).toBuffer();
}
