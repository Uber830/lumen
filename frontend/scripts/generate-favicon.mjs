/**
 * Generates the favicon of the application from the brand mark.
 *
 * The mark is the one of `assets/brand/logo-lumen.svg`: a badge with the
 * tape "L" cut out of it. Drawing it here, instead of keeping a binary in
 * the repository, means the icon always follows the brand: rebuild the
 * SVG with `python3 tools/build_brand.py` and run this again.
 *
 * Usage:
 *   npm run favicon
 *
 * The output goes to `public/favicon.ico` (with every size packed in)
 * and to `public/favicon.png`.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const here = dirname(fileURLToPath(import.meta.url));
const publicDir = resolve(here, "..", "public");
// The canonical mark, copied here by `tools/build_brand.py`.
const brandPath = resolve(publicDir, "brand", "logo-lumen.svg");

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

  const svg = await readFile(brandPath, "utf8");
  const sizes = [16, 32, 48, 64, 128, 256];
  const images = [];

  for (const size of sizes) {
    const data = await sharp(Buffer.from(svg)).resize(size, size).png().toBuffer();
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
