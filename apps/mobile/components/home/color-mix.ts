/** Moves a #rrggbb colour towards white (target 255) or black (0) by `amount` (0–1) */
export function mix(hex: string, target: number, amount: number) {
  const channels = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return `#${channels.map((c) => Math.round(c + (target - c) * amount).toString(16).padStart(2, "0")).join("")}`;
}

/** Moves a #rrggbb colour towards another #rrggbb colour by `amount` (0–1), keeping the result in that pair's hues */
export function blend(hex: string, toward: string, amount: number) {
  const parse = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [a, b] = [parse(hex), parse(toward)];
  return `#${a.map((c, i) => Math.round(c + (b[i] - c) * amount).toString(16).padStart(2, "0")).join("")}`;
}
