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

/**
 * Fix the generated page shell for real mobile browsers.
 *
 * Expo emits `html, body { height: 100% }` plus `body { overflow: hidden }`. On a
 * phone that is wrong in a way you only see on a device: percentage heights resolve
 * against the LARGE viewport — the page is sized as though the URL bar were hidden.
 * While the URL bar is actually showing, the document is taller than the visible
 * area, and because body scrolling is disabled there is no way to reach the part
 * that overflows. The bottom tab bar ends up under the browser chrome, and the
 * content above it looks like it is overlapping the bar.
 *
 * `100dvh` is the dynamic viewport height: it tracks the visible area as the URL
 * bar shows and hides, which is exactly what a full-height app shell wants. The
 * `100%` declaration stays first as the fallback for browsers without dvh.
 *
 * `viewport-fit=cover` lets react-native-safe-area-context read the real
 * env(safe-area-inset-*) values, so the tab bar clears an iPhone home indicator or
 * an Android gesture bar instead of sitting under it.
 *
 * Patched here rather than in a template because this app does not use
 * expo-router, so there is no `+html.tsx` to override — the shell is generated.
 */
function patchShellForMobile(dir) {
  const file = path.join(ROOT, dir, 'index.html');
  let html = fs.readFileSync(file, 'utf8');
  const before = html;

  html = html.replace(
    /(html,\s*body\s*\{\s*height:\s*100%;)/,
    '$1\n        height: 100dvh;',
  );
  html = html.replace(
    /(#root\s*\{[^}]*?height:\s*100%;)/,
    '$1\n        height: 100dvh;',
  );
  if (!/viewport-fit=cover/.test(html)) {
    html = html.replace(
      /(<meta name="viewport" content="[^"]*)"/,
      '$1, viewport-fit=cover"',
    );
  }

  if (html === before) {
    // Expo changed its template — fail loudly rather than silently shipping the bug again.
    throw new Error(
      '[build-web] could not patch the page shell for mobile viewports; the ' +
        'generated index.html no longer matches the expected pattern.',
    );
  }
  fs.writeFileSync(file, html);
  console.log('[build-web] page shell patched for mobile (100dvh + viewport-fit=cover)');
}

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
  patchShellForMobile(outDir);
} finally {
  if (hosted) {
    fs.writeFileSync(APP_JSON, original);
    console.log('[build-web] app.json restored');
  }
}

console.log(`[build-web] done → ${outDir}`);
