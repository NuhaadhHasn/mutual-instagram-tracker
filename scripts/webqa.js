/**
 * Real-browser QA for Mutual's web build, driving the user's installed Chrome
 * over the DevTools Protocol.
 *   npm run qa:web -- <baseUrl> <zipPathToARealInstagramExport>
 *
 * e.g. npm run qa:web -- https://nuhaadhhasn.github.io/mutual-instagram-tracker/try/ "C:/path/export.zip"
 *      npm run qa:web -- http://localhost:8090 "C:/path/export.zip"
 *
 * Exits non-zero if any check fails, so it is CI-shaped. It runs headless
 * Chrome in a THROWAWAY profile and deletes it afterwards — the imported data
 * never touches your real browser profile.
 *
 * Uses TRUSTED input (Input.dispatchMouseEvent) rather than synthetic JS clicks,
 * because a file input only opens its chooser under real user activation — so
 * this exercises the genuine picker path, intercepted via
 * Page.setInterceptFileChooserDialog + DOM.setFileInputFiles.
 */
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const BASE = process.argv[2];
const ZIP = process.argv[3];
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9444;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
function check(name, pass, detail) {
  results.push({ name, pass, detail });
  console.log((pass ? '  PASS  ' : '  FAIL  ') + name + (detail ? '  — ' + detail : ''));
}

let ws, msgId = 0;
const pending = new Map();
const events = [];
function send(method, params) {
  const msg = { id: ++msgId, method, params: params || {} };
  return new Promise((res, rej) => {
    pending.set(msg.id, { res, rej });
    ws.send(JSON.stringify(msg));
  });
}
async function evaluate(expression, awaitPromise) {
  const r = await send('Runtime.evaluate', {
    expression, awaitPromise: !!awaitPromise, returnByValue: true,
  });
  if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 400));
  return r.result && r.result.value;
}
async function trustedClickAt(x, y) {
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
  await sleep(50);
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
}
async function centreOf(selectorOrText) {
  return evaluate(`(() => {
    const q = ${JSON.stringify(selectorOrText)};
    let el = document.querySelector(q);
    if (!el) {
      const all = [...document.querySelectorAll('div,span,a')];
      el = all.filter(e => e.textContent.trim() === q && e.children.length === 0).pop()
        || all.filter(e => e.textContent.trim() === q).pop();
    }
    if (!el) return null;
    el.scrollIntoView({ block: 'center' });
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
  })()`);
}
async function clickThing(q, label) {
  const box = await centreOf(q);
  if (!box) throw new Error('not found: ' + (label || q));
  await sleep(300);
  const box2 = await centreOf(q);
  await trustedClickAt(box2.x, box2.y);
}
const idb = `(async () => {
  const db = await new Promise(r => { const q = indexedDB.open('mutual'); q.onsuccess = () => r(q.result); });
  if (![...db.objectStoreNames].includes('kv')) return { keys: [], vals: {} };
  const tx = db.transaction('kv','readonly').objectStore('kv');
  const keys = await new Promise(r => { const q = tx.getAllKeys(); q.onsuccess = () => r(q.result); });
  const vals = await new Promise(r => { const q = db.transaction('kv','readonly').objectStore('kv').getAll(); q.onsuccess = () => r(q.result); });
  const out = {};
  keys.forEach((k,i) => { out[k] = typeof vals[i] === 'string' ? vals[i].slice(0,120) : ('[' + (vals[i] && vals[i].constructor && vals[i].constructor.name) + ']'); });
  return { keys, sample: out };
})()`;

(async () => {
  const profile = path.join(os.tmpdir(), 'mutual-webqa-profile');
  fs.rmSync(profile, { recursive: true, force: true });
  const chrome = spawn(CHROME, [
    '--headless=new', '--remote-debugging-port=' + PORT, '--user-data-dir=' + profile,
    '--window-size=1280,860', '--hide-scrollbars', '--no-first-run',
    '--no-default-browser-check', '--disable-gpu', 'about:blank',
  ], { stdio: 'ignore' });

  let target = null;
  for (let i = 0; i < 60; i++) {
    try {
      const list = await fetch('http://127.0.0.1:' + PORT + '/json/list').then((r) => r.json());
      target = list.find((t) => t.type === 'page');
      if (target) break;
    } catch (e) {}
    await sleep(500);
  }
  if (!target) throw new Error('no debug target');

  ws = new WebSocket(target.webSocketDebuggerUrl);
  ws.addEventListener('message', (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) {
      const p = pending.get(m.id); pending.delete(m.id);
      if (m.error) p.rej(new Error(JSON.stringify(m.error))); else p.res(m.result);
    } else if (m.method) {
      events.push(m);
    }
  });
  await new Promise((r) => ws.addEventListener('open', r));

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Network.enable');
  await send('Log.enable');
  await send('DOM.enable');
  await send('Page.setInterceptFileChooserDialog', { enabled: true });

  console.log('\n=== Mutual web QA against ' + BASE + ' ===\n');

  // ---------- 1. load ----------
  await send('Page.navigate', { url: BASE });
  await sleep(9000);
  const title = await evaluate('document.title');
  check('Page loads', !!title, 'title=' + title);

  const errs = events.filter((e) => e.method === 'Log.entryAdded' && e.params.entry.level === 'error')
    .map((e) => e.params.entry.text);
  check('No console errors on load', errs.length === 0, errs.slice(0, 2).join(' | ') || 'none');

  const failed = events.filter((e) => e.method === 'Network.loadingFailed')
    .map((e) => e.params.errorText);
  check('No failed network requests', failed.length === 0, failed.slice(0, 3).join(' | ') || 'none');

  // ---------- 2. onboarding ----------
  const onboarding = await evaluate(`document.body.innerText.includes('Welcome to Mutual')`);
  check('Onboarding shows on first run', onboarding === true);
  if (onboarding) {
    await clickThing('Skip', 'Skip');
    await sleep(3000);
  }
  const onDash = await evaluate('document.title');
  check('Reaches the app after onboarding', onDash === 'Dashboard', 'title=' + onDash);

  // ---------- 3. import through the REAL file chooser ----------
  const netBefore = events.filter((e) => e.method === 'Network.requestWillBeSent').length;
  await clickThing('Go to Import', 'Go to Import').catch(async () => {
    await clickThing('a[href$="/Tabs/Import"]', 'Import tab');
  });
  await sleep(2500);

  const chooserBefore = events.filter((e) => e.method === 'Page.fileChooserOpened').length;
  await clickThing('Import Instagram Data', 'Import button');
  await sleep(1500);
  const chooser = events.filter((e) => e.method === 'Page.fileChooserOpened');
  check('Real file chooser opens from a trusted click', chooser.length > chooserBefore,
    chooser.length + ' chooser event(s)');

  if (chooser.length > chooserBefore) {
    const node = chooser[chooser.length - 1].params.backendNodeId;
    await send('DOM.setFileInputFiles', { files: [ZIP], backendNodeId: node });
    await sleep(12000);
  }

  const stats = await evaluate(`(() => {
    const t = document.body.innerText;
    const g = (label) => { const m = t.match(new RegExp('([0-9,]+)\\\\s*\\\\n' + label)); return m ? m[1] : null; };
    return { followers: g('Followers'), following: g('Following'), unfollowers: g('Unfollowers'),
             mutual: g('Mutual'), fans: g('Fans'), text: t.slice(0, 60) };
  })()`);
  check('Import parses the real ZIP', stats.followers === '949' && stats.following === '1,770',
    JSON.stringify(stats));
  check('Derived counts are self-consistent',
    stats.unfollowers === '980' && stats.mutual === '790' && stats.fans === '159',
    'unf=' + stats.unfollowers + ' mut=' + stats.mutual + ' fans=' + stats.fans);

  // ---------- 4. the privacy claim: nothing is uploaded ----------
  const reqs = events.filter((e) => e.method === 'Network.requestWillBeSent').map((e) => e.params.request);
  const uploads = reqs.filter((r) => r.method !== 'GET' || (r.postData && r.postData.length));
  const offOrigin = reqs.filter((r) => !r.url.startsWith(BASE.split('/try/')[0]) && !r.url.startsWith('data:') && !r.url.startsWith('blob:'));
  check('No upload of any kind (no POST/PUT, no request body)', uploads.length === 0,
    uploads.map((u) => u.method + ' ' + u.url).slice(0, 3).join(' | ') || 'none');
  check('No off-origin requests at all', offOrigin.length === 0,
    offOrigin.map((r) => r.url).slice(0, 3).join(' | ') || 'none');

  // ---------- 5. persistence ----------
  const before = await evaluate(idb, true);
  await send('Page.reload');
  await sleep(9000);
  const persisted = await evaluate(`document.body.innerText.includes('949')`);
  check('Data survives a reload (IndexedDB)', persisted === true);
  check('Storage is IndexedDB, not localStorage',
    before.keys.length > 0 && (await evaluate('Object.keys(localStorage).length')) === 0,
    before.keys.length + ' idb keys, ' + (await evaluate('Object.keys(localStorage).length')) + ' localStorage keys');

  // ---------- 6. responsive layout ----------
  const layoutAt = async (w) => {
    await send('Emulation.setDeviceMetricsOverride', { width: w, height: 860, deviceScaleFactor: 1, mobile: w < 768 });
    await send('Page.reload');
    await sleep(8000);
    return evaluate(`(() => { const a = document.querySelector('a[href$="/Tabs/Settings"]');
      if (!a) return 'no nav'; const r = a.getBoundingClientRect();
      return r.x < 300 && r.y < window.innerHeight * 0.7 ? 'sidebar' : 'bottom-tabs'; })()`);
  };
  check('Desktop (1280px) shows the sidebar', (await layoutAt(1280)) === 'sidebar');
  check('Narrow (420px) falls back to bottom tabs', (await layoutAt(420)) === 'bottom-tabs');
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 860, deviceScaleFactor: 1, mobile: false });
  await send('Page.reload');
  await sleep(8000);

  // ---------- 7. capability gating ----------
  await clickThing('a[href$="/Tabs/Settings"]', 'Settings tab');
  await sleep(3000);
  const gating = await evaluate(`(() => {
    const t = document.body.innerText;
    return {
      encrypt: t.includes('Encrypt data at rest'),
      appLock: t.includes('Require unlock to open'),
      screenshots: t.includes('Block screenshots'),
      wipe: t.includes('Erase data after failed unlocks'),
      widget: t.includes('Home-screen widget'),
      reminders: t.includes('Import reminders'),
      keychainWord: /keychain|keystore|hardware/i.test(t),
    };
  })()`);
  check('Encryption toggle IS offered on web', gating.encrypt === true);
  check('The five impossible toggles are absent',
    !gating.appLock && !gating.screenshots && !gating.wipe && !gating.widget && !gating.reminders,
    JSON.stringify(gating));
  check('No keychain/keystore/hardware wording on web', gating.keychainWord === false);

  // ---------- 8. encryption round trip ----------
  await clickThing('Encrypt data at rest', 'encrypt row').catch(() => {});
  const swBox = await evaluate(`(() => {
    const l = [...document.querySelectorAll('div,span')].filter(e => e.textContent === 'Encrypt data at rest').pop();
    let row = l, sw = null;
    for (let i = 0; i < 6 && row; i++) { sw = row.querySelector('input[type="checkbox"]'); if (sw) break; row = row.parentElement; }
    if (!sw) return null;
    sw.scrollIntoView({ block: 'center' });
    const r = sw.getBoundingClientRect();
    return { x: Math.round(r.x + r.width/2), y: Math.round(r.y + r.height/2) };
  })()`);
  if (swBox) {
    await sleep(500);
    await trustedClickAt(swBox.x, swBox.y);
    await sleep(1500);
    await clickThing('Encrypt', 'confirm Encrypt');
    await sleep(9000);
  }
  const enc = await evaluate(idb, true);
  const fd = enc.sample['@instagram_tracker:follower_data'] || '';
  check('Encryption produces a GCM envelope', fd.includes('AES-256-GCM'), fd.slice(0, 70));
  check('No plaintext username left in storage', !fd.includes('username'), fd.slice(0, 70));
  check('Master key is stored as a CryptoKey',
    (enc.sample['@instagram_tracker:at_rest_master_key_v1'] || '').includes('CryptoKey'),
    enc.sample['@instagram_tracker:at_rest_master_key_v1']);

  await send('Page.reload');
  await sleep(10000);
  const afterEnc = await evaluate(`document.body.innerText.includes('949')`);
  check('Encrypted data decrypts after a cold reload', afterEnc === true);

  console.log('\n=== ' + results.filter((r) => r.pass).length + '/' + results.length + ' passed ===');
  const fails = results.filter((r) => !r.pass);
  if (fails.length) { console.log('\nFAILURES:'); fails.forEach((f) => console.log('  - ' + f.name + ': ' + f.detail)); }

  ws.close(); chrome.kill();
  fs.rmSync(profile, { recursive: true, force: true });
  process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error('HARNESS ERROR', e); process.exit(2); });
