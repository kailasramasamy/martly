/** Stroke icons drawn from Lucide's paths, inlined so the page ships no icon library */
const PATHS = {
  pin: ["M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z", "M12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"],
  store: ["m2 7 4.4-4.4A2 2 0 0 1 7.8 2h8.4a2 2 0 0 1 1.4.6L22 7", "M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8", "M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4", "M2 7h20", "M22 7v3a2 2 0 0 1-2 2 2.7 2.7 0 0 1-1.6-.6.8.8 0 0 0-.8 0A2.7 2.7 0 0 1 16 12a2.7 2.7 0 0 1-1.6-.6.8.8 0 0 0-.8 0A2.7 2.7 0 0 1 12 12a2.7 2.7 0 0 1-1.6-.6.8.8 0 0 0-.8 0A2.7 2.7 0 0 1 8 12a2.7 2.7 0 0 1-1.6-.6.8.8 0 0 0-.8 0A2.7 2.7 0 0 1 4 12a2 2 0 0 1-2-2V7"],
  wallet: ["M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1", "M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"],
  bike: ["M5.5 21a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z", "M18.5 21a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z", "M15 6a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z", "M12 17.5V14l-3-3 4-3 2 3h2"],
  language: ["m5 8 6 6", "m4 14 6-6 2-3", "M2 5h12", "M7 2h1", "m22 22-5-10-5 10", "M14 18h6"],
  basket: ["m15 11-1 9", "m19 11-4-7", "M2 11h20", "m3.5 11 1.6 7.4a2 2 0 0 0 2 1.6h9.8a2 2 0 0 0 2-1.6l1.7-7.4", "M4.5 15.5h15", "m5 11 4-7", "m9 11 1 9"],
  search: ["M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z", "m21 21-4.3-4.3"],
  arrow: ["M5 12h14", "m12 5 7 7-7 7"],
  check: ["M20 6 9 17l-5-5"],
  chevron: ["m6 9 6 6 6-6"],
  plus: ["M5 12h14", "M12 5v14"],
  close: ["M18 6 6 18", "m6 6 12 12"],
  locate: ["M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z", "M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z", "M12 2v2", "M12 20v2", "M2 12h2", "M20 12h2"],
  trending: ["M22 7 13.5 15.5 8.5 10.5 2 17", "M16 7h6v6"],
  grid: ["M10 3H3v7h7Z", "M21 3h-7v7h7Z", "M21 14h-7v7h7Z", "M10 14H3v7h7Z"],
  clock: ["M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z", "M12 6v6l4 2"],
  fill: ["M17 17 7 7", "M7 17V7h10"],
  sliders: ["M21 4h-7", "M10 4H3", "M21 12h-9", "M8 12H3", "M21 20h-5", "M12 20H3", "M14 2v4", "M8 10v4", "M16 18v4"],
  phone: ["M17 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2Z", "M12 18h.01"],
} as const

export type IconName = keyof typeof PATHS

export function Icon({ name, size = 20, className, strokeWidth = 2 }: { name: IconName; size?: number; className?: string; strokeWidth?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      {PATHS[name].map((d) => <path key={d} d={d} />)}
    </svg>
  )
}

/** The amber smile from the Martly logo, drawn under a headline word */
export function Smile({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 240 30" preserveAspectRatio="none" className={className} aria-hidden="true">
      <path d="M6 6q114 34 228 0" fill="none" stroke="#fbbf24" strokeWidth="9" strokeLinecap="round" />
    </svg>
  )
}
