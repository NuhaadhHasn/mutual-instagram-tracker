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

// Mirrors the FULL "Ink" layout in MutualSummaryWidget.tsx (dark variant).
// Keep the two in sync when the design changes.
const SHELL  = '#151315';
const VALUE  = '#F4F1F6';
const LABEL  = '#CAC5CC';
const DIM    = '#988D9C';
const ACCENT = '#FF7BA8';
const FONT = 'Segoe UI, Roboto, Arial, Helvetica, sans-serif';

// Left-aligned support cell: value above, sentence-case label below.
function cell(x, value, label) {
  return `
    <text x="${x}" y="182" font-family="${FONT}" font-size="26" font-weight="600"
          fill="${VALUE}" letter-spacing="-0.3">${value}</text>
    <text x="${x}" y="202" font-family="${FONT}" font-size="15" font-weight="500"
          letter-spacing="0.5" fill="${LABEL}">${label}</text>`;
}

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect x="0" y="0" width="${W}" height="${H}" rx="26" ry="26" fill="${SHELL}"/>

  <!-- tier 1: hero (brand accent is spent ONLY here) + meta block -->
  <text x="24" y="96" font-family="${FONT}" font-size="52" font-weight="700"
        fill="${ACCENT}" letter-spacing="-1.2">980</text>
  <text x="26" y="120" font-family="${FONT}" font-size="17" font-weight="500"
        letter-spacing="0.3" fill="${LABEL}">Not following back</text>

  <text x="${W - 24}" y="42" font-family="${FONT}" font-size="17" font-weight="600"
        letter-spacing="0.4" fill="${VALUE}" text-anchor="end">Mutual</text>
  <text x="${W - 24}" y="64" font-family="${FONT}" font-size="15" font-weight="400"
        fill="${DIM}" text-anchor="end">Account 1</text>
  <text x="${W - 24}" y="84" font-family="${FONT}" font-size="15" font-weight="400"
        fill="${DIM}" text-anchor="end">7 Sep</text>

  <!-- tier 2: three exact columns -->
  ${cell(24, '949', 'Followers')}
  ${cell(140, '790', 'Mutual')}
  ${cell(250, '159', 'Fans')}
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
