/**
 * Generates the share image of the public site.
 *
 * The image is drawn here, instead of being kept as a binary in the
 * repository, so it follows the design tokens: the paper, the ink and
 * the accent of "El Índice".
 *
 * Usage:
 *   npm run og
 *
 * The output goes to `public/og-lumen.png` (1200x630, the size the
 * social networks expect) and `public/og-lumen.svg` (the vector
 * version, for the pages that can use it).
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const here = dirname(fileURLToPath(import.meta.url));
const publicDir = resolve(here, "..", "public");
// The canonical mark, copied here by `tools/build_brand.py`.
const brandPath = resolve(publicDir, "brand", "logo-lumen.svg");

// The tokens of the design. Keep them in sync with
// `src/features/site/site.css`.
const PAPER = "#FCFCFD";
const INK = "#0A0D13";
const INK_2 = "#565E6E";
const INK_3 = "#8B93A3";
const LINE = "#DFE3EA";
const ACCENT = "#1A4CF0";

const WIDTH = 1200;
const HEIGHT = 630;

// The badge of the mark, inside its own canvas of 1024.
const BRAND_CANVAS = 1024;
const BRAND_BOX = 174;
const BRAND_SIZE = 676;

/** The mark of the brand, taken from the canonical SVG. */
async function logo(x, y, size) {
  const source = await readFile(brandPath, "utf8");
  // The contents of the SVG, without the wrapper and without the title.
  const inner = source
    .replace(/^[\s\S]*?<svg[^>]*>/, "")
    .replace(/<\/svg>\s*$/, "")
    .replace(/<title[\s\S]*?<\/title>/, "")
    .replace(/<desc[\s\S]*?<\/desc>/, "");
  const scale = size / BRAND_SIZE;
  const offset = BRAND_BOX * scale;
  return `<g transform="translate(${x - offset} ${y - offset}) scale(${scale})">\n${inner}\n</g>`;
}

/** The image, as an SVG. */
async function svg() {
  const margin = 72;
  const font = "'Space Grotesk', system-ui, sans-serif";
  const mono = "'IBM Plex Mono', ui-monospace, monospace";

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
  <rect width="${WIDTH}" height="${HEIGHT}" fill="${PAPER}" />
  <g opacity="0.5">
    ${Array.from({ length: Math.ceil(HEIGHT / 40) }, (_, i) => `<line x1="0" y1="${i * 40}" x2="${WIDTH}" y2="${i * 40}" stroke="${INK}" stroke-opacity="0.03" />`).join("")}
    ${Array.from({ length: Math.ceil(WIDTH / 80) }, (_, i) => `<line x1="${i * 80}" y1="0" x2="${i * 80}" y2="${HEIGHT}" stroke="${INK}" stroke-opacity="0.022" />`).join("")}
  </g>

  ${await logo(margin, margin, 56)}
  <text x="${margin + 78}" y="${margin + 38}" font-family="${font}" font-size="30" font-weight="700" fill="${INK}">Lumen</text>
  <text x="${margin + 78}" y="${margin + 66}" font-family="${mono}" font-size="17" letter-spacing="3" fill="${INK_3}">BOGOTÁ, COLOMBIA</text>

  <text x="${margin}" y="300" font-family="${mono}" font-size="18" letter-spacing="4" fill="${INK_3}">IDX-001 / CATÁLOGO EDITORIAL</text>
  <line x1="${margin}" y1="330" x2="${WIDTH - margin}" y2="330" stroke="${LINE}" stroke-width="1" />

  <text x="${margin}" y="420" font-family="${font}" font-size="72" font-weight="700" fill="${INK}">El material de la editorial,</text>
  <text x="${margin}" y="500" font-family="${font}" font-size="72" font-weight="700" fill="${ACCENT}">indexado por colegio.</text>

  <text x="${margin}" y="570" font-family="${font}" font-size="24" fill="${INK_2}">Un solo catálogo. El acceso se configura colegio por colegio.</text>
</svg>
`;
}

async function main() {
  await mkdir(publicDir, { recursive: true });

  const source = await svg();
  await writeFile(resolve(publicDir, "og-lumen.svg"), source, "utf8");

  await sharp(Buffer.from(source)).png().toFile(resolve(publicDir, "og-lumen.png"));

  console.log("wrote public/og-lumen.svg and public/og-lumen.png");
}

await main();
