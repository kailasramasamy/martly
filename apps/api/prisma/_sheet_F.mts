// Contact sheet of a research JSON: one tile per product image and per size image, labelled
import sharp from "/Users/vaidehi/Projects/martly/node_modules/sharp/lib/index.js"; import { readFileSync } from "node:fs";
const [src, out] = process.argv.slice(2);
const r = JSON.parse(readFileSync(src, "utf8"));
const items: { label: string; url: string }[] = [];
for (const p of r.products) {
  p.images.forEach((u: string, i: number) => items.push({ label: `${p.title.slice(0, 20)} #${i}`, url: u }));
  for (const v of p.variants) if (v.image) items.push({ label: `${p.title.slice(0, 16)} ${v.title}*`, url: v.image });
}
if (r.logo_url) items.push({ label: "LOGO", url: r.logo_url });
const T = 220, cols = 7, rows = Math.ceil(items.length / cols);
const tiles = (await Promise.all(items.map(async (it, i) => {
  try {
    const res = await fetch(encodeURI(decodeURI(it.url)), { headers: { "User-Agent": "Mozilla/5.0" } });
    const buf = Buffer.from(await res.arrayBuffer());
    return { input: await sharp(buf).flatten({ background: "#fff" }).resize(T - 10, T - 34, { fit: "contain", background: "#fff" }).toBuffer(), left: (i % cols) * T + 5, top: Math.floor(i / cols) * T + 30 };
  } catch { console.log("FAIL", it.label, it.url); return null; }
}))).filter(Boolean) as sharp.OverlayOptions[];
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
const labels = Buffer.from(`<svg width="${cols * T}" height="${rows * T}">${items.map((it, i) => `<text x="${(i % cols) * T + 5}" y="${Math.floor(i / cols) * T + 20}" font-size="14" font-family="Arial">${esc(it.label)}</text>`).join("")}</svg>`);
await sharp({ create: { width: cols * T, height: rows * T, channels: 3, background: "#e5e5e5" } }).composite([...tiles, { input: labels, left: 0, top: 0 }]).png().toFile(out);
console.log(items.length, "tiles");
