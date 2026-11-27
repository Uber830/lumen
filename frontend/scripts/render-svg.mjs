/**
 * Renders an SVG to a PNG with sharp.
 *
 * It is the fallback renderer of `tools/verify_logo.py`: the frontend
 * already depends on sharp, so no extra tool has to be installed.
 *
 * Usage:
 *   node scripts/render-svg.mjs <input.svg> <output.png> [width] [height]
 */

import { readFile } from "node:fs/promises";

import sharp from "sharp";

const [, , input, output, width, height] = process.argv;

if (!input || !output) {
  console.error("uso: node scripts/render-svg.mjs <input.svg> <output.png> [width] [height]");
  process.exit(1);
}

const source = await readFile(input);
let image = sharp(source);

if (width && height) {
  image = image.resize(Number(width), Number(height));
}

await image.png().toFile(output);
