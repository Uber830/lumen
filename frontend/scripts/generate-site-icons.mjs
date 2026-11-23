/**
 * Generates the icons of the public site.
 *
 * The site and the application share the same mark, so these icons are
 * the same ones the panel uses. They live under their own names because
 * the manifest of the site points at them.
 *
 * Usage:
 *   npm run icons
 *
 * The output goes to `public/favicon-lumen.svg` and to the PNG sizes
 * the manifest declares.
 */

import { copyFile, mkdir, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const here = dirname(fileURLToPath(import.meta.url));
const publicDir = resolve(here, "..", "public");
// The canonical mark, copied here by `tools/build_brand.py`.
const brandPath = resolve(publicDir, "brand", "logo-lumen.svg");

async function main() {
  await mkdir(publicDir, { recursive: true });

  const source = await readFile(brandPath, "utf8");
  await copyFile(brandPath, resolve(publicDir, "favicon-lumen.svg"));

  for (const size of [32, 180, 192, 512]) {
    await sharp(Buffer.from(source))
      .resize(size, size)
      .png()
      .toFile(resolve(publicDir, `favicon-lumen-${size}.png`));
  }

  console.log("wrote public/favicon-lumen.svg and the PNG sizes of the manifest");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
