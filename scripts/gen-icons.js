/* eslint-disable */
// Mutual — generate app icon PNGs from assets/icon.svg using sharp.
// Run: npm run gen-icons

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.resolve(__dirname, '..');
const SVG_PATH = path.join(ROOT, 'assets', 'icon.svg');
const ASSETS = path.join(ROOT, 'assets');

const BRAND_PINK = '#E1306C';

async function main() {
  const svgBuffer = fs.readFileSync(SVG_PATH);

  // 1) icon.png  — 1024×1024, full bleed gradient + rings
  await sharp(svgBuffer, { density: 384 })
    .resize(1024, 1024)
    .png()
    .toFile(path.join(ASSETS, 'icon.png'));

  // 2) splash-icon.png — 1024×1024, same as icon (used on solid pink splash bg per app.json)
  await sharp(svgBuffer, { density: 384 })
    .resize(1024, 1024)
    .png()
    .toFile(path.join(ASSETS, 'splash-icon.png'));

  // 3) adaptive-icon.png — Android adaptive icon foreground.
  //    Foreground must live inside the central 66% safe zone (~676×676).
  //    We render the SVG (with its gradient bg) at ~666 and center it on a
  //    1024×1024 solid-pink canvas so the masked tile looks consistent.
  const fgSize = 666;
  const fg = await sharp(svgBuffer, { density: 256 })
    .resize(fgSize, fgSize)
    .png()
    .toBuffer();

  await sharp({
    create: {
      width: 1024,
      height: 1024,
      channels: 4,
      background: BRAND_PINK,
    },
  })
    .composite([{ input: fg, gravity: 'center' }])
    .png()
    .toFile(path.join(ASSETS, 'adaptive-icon.png'));

  // 4) favicon.png — 64×64 (web)
  await sharp(svgBuffer, { density: 128 })
    .resize(64, 64)
    .png()
    .toFile(path.join(ASSETS, 'favicon.png'));

  console.log('Generated:');
  console.log('  assets/icon.png            (1024×1024)');
  console.log('  assets/splash-icon.png     (1024×1024)');
  console.log('  assets/adaptive-icon.png   (1024×1024, safe-zone foreground)');
  console.log('  assets/favicon.png         (64×64)');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
