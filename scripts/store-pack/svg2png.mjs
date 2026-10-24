import { createRequire } from "node:module";
const require = createRequire(new URL("../../apps/api/package.json", import.meta.url));
const sharp = require("sharp");
const [svg, png] = process.argv.slice(2);
await sharp(svg, { density: 72 }).png().toFile(png);
