import { fileURLToPath } from "node:url";
import sharp from "sharp";

const FONT_DIR = fileURLToPath(new URL("../../../assets/fonts/", import.meta.url));

/** Bundled fonts, so renders look the same on any server; family + style must match the file for Pango */
const FONTS = {
  "en": { file: "Poppins-Regular.ttf", desc: "Poppins" },
  "en-semibold": { file: "Poppins-SemiBold.ttf", desc: "Poppins SemiBold" },
  "en-bold": { file: "Poppins-Bold.ttf", desc: "Poppins Bold" },
  "en-italic": { file: "Poppins-MediumItalic.ttf", desc: "Poppins Medium Italic" },
  "ta-bold": { file: "NotoSansTamil-Bold.ttf", desc: "Noto Sans Tamil Bold" },
} as const;

export type PackField = "nameEn" | "nameTa" | "netWeight" | "ingredients" | "nutrition";

/** One piece of product text on a pack design, in artwork pixels */
export interface PackZone {
  side: "front" | "back";
  field: PackField;
  x: number;
  /** Vertical centre of the (first) line */
  cy: number;
  /** Text wider than this is scaled down to fit */
  maxW: number;
  /** When set, text too wide for one line wraps to fill a maxW × maxH box instead of shrinking */
  maxH?: number;
  size: number;
  color: string;
  font: keyof typeof FONTS;
  align: "start" | "middle";
  /** Table zones (nutrition): spacing between rows, the value column and how many rows fit */
  rowHeight?: number;
  valueX?: number;
  rows?: number;
}

export type PackText = Record<Exclude<PackField, "nutrition">, string> & { nutrition: [string, string][] };

const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

async function textImage(value: string, size: number, zone: PackZone, box?: { width: number; height: number }) {
  const font = FONTS[zone.font];
  const { data, info } = await sharp({
    text: {
      text: `<span foreground="${zone.color}">${escape(value)}</span>`,
      font: `${font.desc} ${size}`,
      fontfile: FONT_DIR + font.file,
      rgba: true,
      // A box makes Pango wrap and pick the size that fills it; otherwise the font size is in pixels
      ...(box ? { ...box, align: zone.align === "middle" ? "centre" : "left", wrap: "word" } : { dpi: 72 }),
    },
  }).png().toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

/** Lays one line out at (x, cy), shrinking it to maxW */
async function line(value: string, x: number, cy: number, maxW: number, zone: PackZone): Promise<sharp.OverlayOptions> {
  let img = await textImage(value, zone.size, zone);
  if (img.width > maxW) {
    img = zone.maxH
      ? await textImage(value, zone.size, zone, { width: maxW, height: zone.maxH })
      : await textImage(value, Math.floor((zone.size * maxW) / img.width), zone);
  }
  const left = zone.align === "middle" ? x - img.width / 2 : x;
  return { input: img.data, left: Math.round(left), top: Math.round(cy - img.height / 2) };
}

function zoneLines(zone: PackZone, text: PackText) {
  if (zone.field !== "nutrition") return [line(text[zone.field], zone.x, zone.cy, zone.maxW, zone)];
  const rowHeight = zone.rowHeight ?? zone.size * 1.5;
  const valueX = zone.valueX ?? zone.x + zone.maxW;
  return text.nutrition.slice(0, zone.rows).flatMap(([label, value], i) => [
    line(label, zone.x, zone.cy + i * rowHeight, valueX - zone.x - 10, zone),
    line(value, valueX, zone.cy + i * rowHeight, zone.maxW - (valueX - zone.x), zone),
  ]);
}

/** Draws the product's text into a side's zones on top of the store artwork */
export async function fillZones(art: Buffer, zones: PackZone[], side: PackZone["side"], text: PackText) {
  const layers = await Promise.all(zones.filter((z) => z.side === side).flatMap((z) => zoneLines(z, text)));
  return sharp(art).composite(layers).png().toBuffer();
}
