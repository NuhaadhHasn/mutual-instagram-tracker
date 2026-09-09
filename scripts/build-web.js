#!/usr/bin/env node
/**
 * Build the web bundle.
 *
 *   node scripts/build-web.js            → dist/      (served from a root URL)
 *   node scripts/build-web.js --hosted   → docs/try/   (served from a subpath)
 *
 * Why this exists: `expo export` bakes absolute asset paths (/_expo/..., /assets/...)
 * into both index.html AND the JS bundle, so a build made for a root URL 404s when
 * served from https://<user>.github.io/<repo>/try/. The fix is Expo's
 * `experiments.baseUrl`, which has no CLI flag — it has to be in the app config.
 *
 * Rather than commit a baseUrl that would then break the local build, this patches
 * app.json for the duration of the export and restores it in a finally block, so a
 * failed or interrupted build never leaves the config dirty.
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const APP_JSON = path.join(ROOT, 'app.json');

const hosted = process.argv.includes('--hosted');
// Must match where GitHub Pages serves the demo from: <repo>/try.
const BASE_URL = '/mutual-instagram-tracker/try';
const outDir = hosted ? 'docs/try' : 'dist';

const original = fs.readFileSync(APP_JSON, 'utf8');

try {
  if (hosted) {
    const cfg = JSON.parse(original);
    cfg.expo.experiments = { ...(cfg.expo.experiments || {}), baseUrl: BASE_URL };
    // Two-space indent + trailing newline keeps the diff clean if this ever
    // does get written out by accident.
    fs.writeFileSync(APP_JSON, JSON.stringify(cfg, null, 2) + '\n');
    console.log(`[build-web] baseUrl set to ${BASE_URL}`);
  }

  console.log(`[build-web] exporting to ${outDir} ...`);
  // execSync (not execFileSync) so Windows resolves npx.cmd through the shell.
  execSync(`npx expo export -p web --output-dir ${outDir} --clear`, {
    cwd: ROOT,
    stdio: 'inherit',
  });
} finally {
  if (hosted) {
    fs.writeFileSync(APP_JSON, original);
    console.log('[build-web] app.json restored');
  }
}

console.log(`[build-web] done → ${outDir}`);
