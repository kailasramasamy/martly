// Numbers and labels drawn as strokes, like an engineering drawing, so the sketch never depends on fonts on the server.
// Each glyph is SVG path data in a box 6 wide and 10 tall, with the baseline at y = 10.
const GLYPHS: Record<string, { d: string; width: number }> = {
  "0": { d: "M1 0H5L6 1V9L5 10H1L0 9V1Z", width: 6 },
  "1": { d: "M1 2L3 0V10M1 10H5", width: 6 },
  "2": { d: "M0 1L1 0H5L6 1V4L0 10H6", width: 6 },
  "3": { d: "M0 1L1 0H5L6 1V4L5 5H2M5 5L6 6V9L5 10H1L0 9", width: 6 },
  "4": { d: "M5 10V0L0 7H6", width: 6 },
  "5": { d: "M6 0H0V4H5L6 5V9L5 10H1L0 9", width: 6 },
  "6": { d: "M6 1L5 0H1L0 1V9L1 10H5L6 9V5L5 4H0", width: 6 },
  "7": { d: "M0 0H6L2 10", width: 6 },
  "8": { d: "M1 0H5L6 1V4L5 5H1L0 4V1ZM1 5H5L6 6V9L5 10H1L0 9V6Z", width: 6 },
  "9": { d: "M0 9L1 10H5L6 9V1L5 0H1L0 1V5L1 6H6", width: 6 },
  ".": { d: "M1 9.5H1.2", width: 2.2 },
  c: { d: "M5 5L4 4H1L0 5V9L1 10H4L5 9", width: 5 },
  m: { d: "M0 10V4M0 5L1 4H2L3 5V10M3 5L4 4H5L6 5V10", width: 6 },
  "×": { d: "M0 4L4 9M4 4L0 9", width: 4 },
  l: { d: "M1 0V10", width: 2 },
  "~": { d: "M0 7L1.5 5.5H2.5L4 7H5L6 5.5", width: 6 },
  a: { d: "M1 4H4L5 5V10M5 7H1L0 8V9L1 10H4L5 9", width: 5 },
  o: { d: "M1 4H4L5 5V9L4 10H1L0 9V5Z", width: 5 },
  p: { d: "M0 13V4M0 5L1 4H4L5 5V9L4 10H1L0 9", width: 5 },
  r: { d: "M0 10V4M0 6L2 4H4", width: 4 },
  x: { d: "M0 4L5 10M5 4L0 10", width: 5 },
  n: { d: "M0 10V4M0 5L1 4H4L5 5V10", width: 5 },
  t: { d: "M1 1V9L2 10H4M0 4H3", width: 4 },
  g: { d: "M5 4V12L4 13H1M5 5L4 4H1L0 5V9L1 10H4L5 9", width: 5 },
  e: { d: "M0 7H5V5L4 4H1L0 5V9L1 10H4L5 9", width: 5 },
  d: { d: "M5 0V10M5 5L4 4H1L0 5V9L1 10H4L5 9", width: 5 },
  i: { d: "M1 4V10M1 1.5H1.2", width: 2 },
  F: { d: "M0 10V0H5M0 5H4", width: 5 },
  A: { d: "M0 10L3 0L6 10M1 7H5", width: 6 },
  S: { d: "M5 1L4 0H1L0 1V4L1 5H4L5 6V9L4 10H1L0 9", width: 5 },
  T: { d: "M0 0H6M3 0V10", width: 6 },
  H: { d: "M0 0V10M6 0V10M0 5H6", width: 6 },
  L: { d: "M0 0V10H5", width: 5 },
  W: { d: "M0 0L2 10L4 3L6 10L8 0", width: 8 },
  Ø: { d: "M1 1H5L6 2V8L5 9H1L0 8V2ZM0 10L6 0", width: 6 },
  " ": { d: "", width: 3 },
};
const GAP = 1.6;

export function textWidth(text: string, size: number) {
  const scale = size / 10;
  return [...text].reduce((sum, ch) => sum + ((GLYPHS[ch]?.width ?? 0) + GAP) * scale, -GAP * scale);
}

/** Stroke-drawn text with its bottom-left corner at x, y; only the characters in GLYPHS are drawn */
export function textPaths(text: string, x: number, y: number, size: number, color: string) {
  const scale = size / 10;
  let cursor = x;
  const parts: string[] = [];
  for (const ch of text) {
    const glyph = GLYPHS[ch];
    if (!glyph) continue;
    if (glyph.d) {
      parts.push(`<path transform="translate(${cursor.toFixed(1)} ${(y - size).toFixed(1)}) scale(${scale})" d="${glyph.d}" fill="none" stroke="${color}" stroke-width="${(1 / scale) * (size / 12)}" stroke-linecap="round" stroke-linejoin="round"/>`);
    }
    cursor += (glyph.width + GAP) * scale;
  }
  return parts.join("");
}
