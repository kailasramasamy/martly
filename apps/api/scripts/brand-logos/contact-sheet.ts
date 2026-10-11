import sharp from "sharp";
import { join } from "node:path";
import { FetchEntry, LOGO_DIR, OUT } from "./common.js";

const COLS = 8;
const PER_SHEET = 40;
const CELL_W = 190;
const CELL_H = 215;
const LOGO = 170;

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function label(name: string, domain: string): Buffer {
  const short = name.length > 24 ? `${name.slice(0, 23)}...` : name;
  return Buffer.from(
    `<svg width="${CELL_W}" height="${CELL_H}" xmlns="http://www.w3.org/2000/svg">
      <rect x="2" y="2" width="${CELL_W - 4}" height="${CELL_H - 4}" fill="none" stroke="#cbd5e1"/>
      <text x="${CELL_W / 2}" y="${LOGO + 20}" font-size="13" font-family="Arial" font-weight="bold" text-anchor="middle" fill="#0f172a">${esc(short)}</text>
      <text x="${CELL_W / 2}" y="${LOGO + 36}" font-size="11" font-family="Arial" text-anchor="middle" fill="#64748b">${esc(domain)}</text>
    </svg>`,
  );
}

async function cell(e: FetchEntry, left: number, top: number) {
  const logo = await sharp(join(LOGO_DIR, e.file!)).resize(LOGO, LOGO).png().toBuffer();
  return [
    { input: logo, left: left + (CELL_W - LOGO) / 2, top: top + 4 },
    { input: label(e.name, e.domain), left, top },
  ];
}

/** Writes out/sheet-<n>.png files; returns their paths. */
export async function buildSheets(entries: FetchEntry[]): Promise<string[]> {
  const withLogo = entries.filter((e) => e.file);
  const paths: string[] = [];
  for (let s = 0; s * PER_SHEET < withLogo.length; s++) {
    const chunk = withLogo.slice(s * PER_SHEET, (s + 1) * PER_SHEET);
    const rows = Math.ceil(chunk.length / COLS);
    const layers = await Promise.all(
      chunk.map((e, i) => cell(e, (i % COLS) * CELL_W, Math.floor(i / COLS) * CELL_H)),
    );
    const path = join(OUT, `sheet-${s + 1}.png`);
    await sharp({
      create: { width: COLS * CELL_W, height: rows * CELL_H, channels: 3, background: "#ffffff" },
    })
      .composite(layers.flat())
      .png()
      .toFile(path);
    paths.push(path);
  }
  return paths;
}
