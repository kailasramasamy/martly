import { loadFont as loadCatamaran } from "@remotion/google-fonts/Catamaran";
import { loadFont as loadManrope } from "@remotion/google-fonts/Manrope";

const manrope = loadManrope("normal", { weights: ["500", "600", "700", "800"], subsets: ["latin"] }).fontFamily;
const catamaran = loadCatamaran("normal", { weights: ["500", "600", "700", "800"], subsets: ["tamil", "latin"] }).fontFamily;

// Catamaran covers Tamil glyphs that Manrope lacks
export const fontFamily = `${manrope}, ${catamaran}`;
export const tamilFamily = `${catamaran}, ${manrope}`;

export const colors = {
  primary: "#0f766e",
  primaryDark: "#0b4f4a",
  primaryDeep: "#062f2c",
  primaryLight: "#14b8a6",
  accent: "#fbbf24",
  accentText: "#451a03",
  success: "#22c55e",
  background: "#f8fafc",
  surface: "#ffffff",
  text: "#0f172a",
  textSecondary: "#64748b",
  border: "#e2e8f0",
} as const;

export const FPS = 30;
export const WIDTH = 1080;
export const HEIGHT = 1920;
export const TRANSITION_FRAMES = 15;
