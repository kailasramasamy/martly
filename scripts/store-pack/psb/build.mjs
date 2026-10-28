// PSB Grains 1kg pillow pack front, redrawn from photos of their jowar pack (photo-front.jpg, photo-bottom.jpg for the
// address). Front only: their packs print one side. Clear film shows through everywhere outside the orange bands.
// usage: node build.mjs <out_dir>  →  front-artwork.png (uploaded), zones.json, front-guide.png (zones), front-sample.png (sample text)
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
const require = createRequire(new URL("../../../apps/api/package.json", import.meta.url));
const sharp = require("sharp");

const here = new URL(".", import.meta.url).pathname;
const out = process.argv[2];
if (!out) throw new Error("usage: node build.mjs <out_dir>");
// Artwork pixels for the pillow-1kg-full template: the whole bag face
const W = 1252, H = 1528;
const ORANGE = "#f0652a", WHITE = "#ffffff";
const SANS = "font-family:Arial, Helvetica, sans-serif";

const uri = async (file) => "data:image/png;base64," + (await sharp(`${here}${file}`).png().toBuffer()).toString("base64");
const text = (x, y, s, size, fill, weight = 400, anchor = "start", extra = "") =>
  `<text x="${x}" y="${y}" style="${SANS};font-size:${size}px;font-weight:${weight}" fill="${fill}" text-anchor="${anchor}" ${extra}>${s}</text>`;

// Zone of the one printed field: net weight in the white circle (the MRP is never printed)
const ZONES = [
  { side: "front", field: "netWeight", x: 1018, cy: 1438, maxW: 104, size: 38, color: ORANGE, font: "en-bold", align: "middle" },
];

async function topBand() {
  let s = `<path d="M116,62 Q116,40 140,40 H1081 Q1105,40 1105,62 V690 C820,620 560,532 380,528 C280,525 200,560 116,600 Z" fill="${ORANGE}"/>`;
  // The pack logo, lifted from a close-up of their print (white on transparent)
  return s + `<image href="${await uri("pack-logo.png")}" x="250" y="100" width="677" height="413"/>`;
}

async function bottomBand() {
  let s = `<path d="M116,1053 C280,1100 460,1170 620,1240 C730,1290 800,1340 880,1336 C980,1326 1060,1210 1105,1090 V1474 Q1105,1497 1081,1497 H140 Q116,1497 116,1474 Z" fill="${ORANGE}"/>`;
  s += text(168, 1236, "Packed by:", 36, WHITE, 400, "start", 'font-style="italic"');
  s += `<image href="${await uri("rice-mark.png")}" x="166" y="1262" width="56" height="60"/>`;
  s += text(226, 1322, "PSB", 60, WHITE, 700, "start", 'textLength="132" lengthAdjust="spacingAndGlyphs"');
  s += text(370, 1322, "GRAINS", 60, WHITE, 700, "start", 'textLength="232" lengthAdjust="spacingAndGlyphs"');
  [
    "No. 17/40 - 42 Broker Office",
    "Krishnagiri Main Road",
    "Dharmapuri - 636 701 TAMIL NADU, INDIA",
  ].forEach((line, i) => { s += text(170, 1366 + i * 38, line, 32, WHITE, 400); });
  s += text(1088, 1366, "Net Weight :", 30, WHITE, 400, "end");
  return s + `<circle cx="1018" cy="1438" r="60" fill="${WHITE}"/>`;
}

const guide = () => ZONES.map((z) =>
  `<rect x="${z.x - z.maxW / 2}" y="${z.cy - 30}" width="${z.maxW}" height="60" fill="none" stroke="#db2777" stroke-width="4" stroke-dasharray="12 6"/>`).join("");
const sample = () => text(1018, 1452, "1 Kg", 38, ORANGE, 700, "middle");

async function render(name, inner) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${inner}</svg>`;
  await sharp(Buffer.from(svg), { density: 72 }).png().toFile(`${out}/${name}.png`);
}

mkdirSync(out, { recursive: true });
const art = (await topBand()) + (await bottomBand());
await render("front-artwork", art);
await render("front-guide", art + guide());
await render("front-sample", art + sample());
writeFileSync(`${out}/zones.json`, JSON.stringify(ZONES, null, 2));
console.log(`Wrote ${out}/front-artwork.png, front-guide.png, front-sample.png`);
