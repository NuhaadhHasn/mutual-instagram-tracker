/* eslint-disable */
// Mutual — generate assets/widget-preview.png, the image Android 12+ shows in the
// widget picker (C10). Mirrors what MutualSummaryWidget.tsx actually renders, so
// the picker preview matches reality. Referenced from app.json via the
// react-native-android-widget plugin's `previewImage`.
// Run: npm run gen-widget-preview

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.resolve(__dirname, '..');
const ASSETS = path.join(ROOT, 'assets');

// 3x2 cell widget ≈ 180x110dp; render at ~2x for a crisp picker thumbnail.
const W = 360;
const H = 220;

const GRADIENT_FROM = '#833AB4';
const GRADIENT_TO = '#E1306C';
const FONT = 'Segoe UI, Roboto, Arial, Helvetica, sans-serif';

function stat(x, value, label) {
  return `
    <text x="${x}" y="128" font-family="${FONT}" font-size="40" font-weight="700"
          fill="#FFFFFF" text-anchor="middle">${value}</text>
    <text x="${x}" y="150" font-family="${FONT}" font-size="15" letter-spacing="0.8"
          fill="rgba(255,255,255,0.75)" text-anchor="middle">${label}</text>`;
}

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="${W}" y2="${H}" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="${GRADIENT_FROM}"/>
      <stop offset="1" stop-color="${GRADIENT_TO}"/>
    </linearGradient>
  </defs>

  <rect x="0" y="0" width="${W}" height="${H}" rx="32" ry="32" fill="url(#bg)"/>

  <text x="28" y="48" font-family="${FONT}" font-size="19" font-weight="700"
        letter-spacing="1" fill="#FFFFFF">Mutual</text>
  <text x="${W - 28}" y="48" font-family="${FONT}" font-size="15"
        fill="rgba(255,255,255,0.75)" text-anchor="end">default</text>

  ${stat(72, '1.2K', 'FOLLOWERS')}
  ${stat(180, '184', 'NOT BACK')}
  ${stat(288, '312', 'FANS')}

  <text x="28" y="192" font-family="${FONT}" font-size="15"
        fill="rgba(255,255,255,0.75)">Updated today</text>
</svg>`;

async function main() {
  fs.mkdirSync(ASSETS, { recursive: true });
  await sharp(Buffer.from(svg), { density: 144 })
    .resize(W, H)
    .png()
    .toFile(path.join(ASSETS, 'widget-preview.png'));

  console.log('Generated:');
  console.log(`  assets/widget-preview.png  (${W}x${H})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
