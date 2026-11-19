/**
 * Generates the favicon from the application's brand mark.
 *
 * The mark is the same one the app shell renders: a graduation cap on
 * a primary-colored rounded square. Drawing it here, instead of
 * keeping a binary in the repository, means the favicon follows the
 * theme's colors when they change.
 *
 * Usage:
 *   npm run favicon
 *
 * The output goes to `public/favicon.ico` (with every size packed in)
 * and `public/favicon.png`.
 */

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const here = dirname(fileURLToPath(import.meta.url));
const publicDir = resolve(here, "..", "public");

// The lucide `graduation-cap` icon, at the size the app uses.
const ICON_PATHS = [
  "M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z",
  "M22 10v6",
  "M6 12.5V16a6 3 0 0 0 12 0v-3.5",
];

// The light theme's `--primary` and `--primary-foreground`, converted
// from oklch to sRGB. Keep them in sync with `src/styles.css`.
const PRIMARY = "#3b5bd4";
const PRIMARY_FOREGROUND = "#fafcff";

/** The favicon as an SVG: the icon on a rounded square. */
function svg(size) {
  // The icon is drawn in a 24x24 box and scaled into the square, the
  // same way the app shell does it.
  const inset = size * 0.22;
  const scale = (size - inset * 2) / 24;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${size * 0.21}" fill="${PRIMARY}" />
  <g transform="translate(${inset} ${inset}) scale(${scale})"
     fill="none" stroke="${PRIMARY_FOREGROUND}" stroke-width="1.9"
     stroke-linecap="round" stroke-linejoin="round">
    ${ICON_PATHS.map((d) => `<path d="${d}" />`).join("\n    ")}
  </g>
</svg>`;
}

/** Pack several PNGs into an ICO file. */
function buildIco(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(images.length, 4);

  const entries = [];
  let offset = 6 + images.length * 16;

  for (const { size, data } of images) {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size === 256 ? 0 : size, 0); // width (0 means 256)
    entry.writeUInt8(size === 256 ? 0 : size, 1); // height
    entry.writeUInt8(0, 2); // palette size
    entry.writeUInt8(0, 3); // reserved
    entry.writeUInt16LE(1, 4); // color planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(data.length, 8);
    entry.writeUInt32LE(offset, 12);
    entries.push(entry);
    offset += data.length;
  }

  return Buffer.concat([header, ...entries, ...images.map((i) => i.data)]);
}

async function main() {
  await mkdir(publicDir, { recursive: true });

  const sizes = [16, 32, 48, 64, 128, 256];
  const images = [];

  for (const size of sizes) {
    const data = await sharp(Buffer.from(svg(size)))
      .resize(size, size)
      .png()
      .toBuffer();
    images.push({ size, data });
  }

  // The PNG, for the manifests and the browsers that prefer one.
  const png = images.find((i) => i.size === 256);
  await writeFile(resolve(publicDir, "favicon.png"), png.data);

  // The ICO, with every size packed in.
  await writeFile(resolve(publicDir, "favicon.ico"), buildIco(images));

  console.log(`favicon written: ${sizes.join(", ")}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
