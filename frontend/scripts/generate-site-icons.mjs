/**
 * Generates the icons of the public site.
 *
 * The site has its own mark —the sun of "El Índice"—, so it does not
 * share the favicon of the application panel.
 *
 * Usage:
 *   npm run icons
 *
 * The output goes to `public/favicon-lumen.svg` and to the PNG sizes
 * the manifest declares.
 */

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const here = dirname(fileURLToPath(import.meta.url));
const publicDir = resolve(here, "..", "public");

const INK = "#0A0D13";
const PAPER = "#FCFCFD";

/** The sun of the logo: a square of ink with a ring of rays. */
function svg(size) {
  const c = size / 2;
  const rays = [0, 45, 90, 135, 180, 225, 270, 315]
    .map((angle) => {
      const rad = (angle * Math.PI) / 180;
      const inner = c + size * 0.22;
      const outer = c + size * 0.42;
      return `<line x1="${(c + inner * Math.cos(rad)).toFixed(2)}" y1="${(c + inner * Math.sin(rad)).toFixed(2)}" x2="${(c + outer * Math.cos(rad)).toFixed(2)}" y2="${(c + outer * Math.sin(rad)).toFixed(2)}" stroke="${PAPER}" stroke-width="${(size * 0.045).toFixed(2)}" />`;
    })
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="${INK}" />
  <circle cx="${c}" cy="${c}" r="${(size * 0.14).toFixed(2)}" fill="${PAPER}" />
  ${rays}
</svg>
`;
}

async function main() {
  await mkdir(publicDir, { recursive: true });

  const source = svg(512);
  await writeFile(resolve(publicDir, "favicon-lumen.svg"), source, "utf8");

  for (const size of [32, 180, 192, 512]) {
    await sharp(Buffer.from(svg(size)))
      .png()
      .toFile(resolve(publicDir, `favicon-lumen-${size}.png`));
  }

  console.log("wrote public/favicon-lumen.svg and the PNG sizes of the manifest");
}

await main();
