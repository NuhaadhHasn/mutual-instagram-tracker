/* eslint-disable */
// Mutual — generate Google Play store images (feature graphic + 512 icon) using sharp.
// Store-only assets: written to docs/store/ (NOT assets/) so they never ship in the app bundle.
// Run: npm run gen-store-assets

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.resolve(__dirname, '..');
const STORE = path.join(ROOT, 'docs', 'store');
const FEATURE_SVG = path.join(STORE, 'feature-graphic.svg');
const ICON_SVG = path.join(ROOT, 'assets', 'icon.svg');

async function main() {
  fs.mkdirSync(STORE, { recursive: true });

  // 1) feature-graphic.png — 1024x500. Supersample (density 144 -> 2048x1000) then downscale for crisp text.
  const featureSvg = fs.readFileSync(FEATURE_SVG);
  await sharp(featureSvg, { density: 144 })
    .resize(1024, 500)
    .png()
    .toFile(path.join(STORE, 'feature-graphic.png'));

  // 2) play-icon-512.png — 512x512 Play Store icon, from the same source as the app icon.
  const iconSvg = fs.readFileSync(ICON_SVG);
  await sharp(iconSvg, { density: 192 })
    .resize(512, 512)
    .png()
    .toFile(path.join(STORE, 'play-icon-512.png'));

  console.log('Generated:');
  console.log('  docs/store/feature-graphic.png  (1024x500)');
  console.log('  docs/store/play-icon-512.png    (512x512)');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
