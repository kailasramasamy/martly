/**
 * Shows what onboarding will upload for a store logo: background removed when opaque (Photoroom), trimmed to the mark,
 * with the brand colours it reads. Writes the result on a light and a dark plate to look at before going ahead.
 *
 * Usage: cd apps/api && npx tsx scripts/logo-preview.ts <logo file> <out dir>
 */

import dotenv from "dotenv";
dotenv.config({ override: true });

import { mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import sharp from "sharp";
import { cleanLogo } from "../src/services/brand-logo.js";

const [logoPath, outDir] = process.argv.slice(2);
if (!logoPath || !outDir) throw new Error("Usage: npx tsx scripts/logo-preview.ts <logo file> <out dir>");

const logo = await cleanLogo(readFileSync(logoPath.replace(/^~/, process.env.HOME!)), true);
const { width, height } = await sharp(logo.image).metadata();
mkdirSync(outDir, { recursive: true });
for (const [name, plate] of [["light", "#ffffff"], ["dark", "#1e293b"]] as const) {
  writeFileSync(join(outDir, `logo-${name}.png`), await sharp(logo.image).flatten({ background: plate }).png().toBuffer());
}
console.log(`background ${logo.background}, ${width}×${height}, colour ${logo.themeColor}, accent ${logo.themeColorSecondary}`);
console.log(`Look at ${join(outDir, "logo-light.png")} and ${join(outDir, "logo-dark.png")}`);
