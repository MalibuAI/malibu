#!/usr/bin/env node
/** Extract favicon + nav mark from brandbook export PNG (no hand-drawn SVG). */
import sharp from 'sharp';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const publicDir = resolve(root, 'public');
const docsDir = resolve(root, 'docs');

const faviconSrc = '/Users/augstar/.cursor/projects/Users-augstar-projects-malibu/assets/Screenshot_2026-07-16_at_10.47.44-9058afbb-7b52-42c6-9fb3-eeb01b244c11.png';

/** Center-crop the sun lockup from the brandbook export (521×294). */
async function cropBrandIcon(input, size) {
  const meta = await sharp(input).metadata();
  const side = Math.min(286, meta.width - 8, meta.height - 4);
  const left = Math.floor((meta.width - side) / 2);
  const top = Math.floor((meta.height - side) / 2) - 6;

  return sharp(input)
    .extract({ left: Math.max(0, left), top: Math.max(0, top), width: side, height: side })
    .resize(size, size, { fit: 'fill' })
    .png()
    .toBuffer();
}

async function main() {
  for (const [name, size] of [
    ['favicon.png', 512],
    ['favicon-192.png', 192],
    ['favicon-32.png', 32],
    ['logo-mark.png', 56],
  ]) {
    const buf = await cropBrandIcon(faviconSrc, size);
    await sharp(buf).toFile(resolve(publicDir, name));
    console.log('wrote', name, size);
  }

  const docsBuf = await cropBrandIcon(faviconSrc, 512);
  await sharp(docsBuf).toFile(resolve(docsDir, 'favicon.png'));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
