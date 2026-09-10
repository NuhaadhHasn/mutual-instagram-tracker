/**
 * Real-Chrome test of the passphrase-wrapped at-rest key.
 *   node --experimental-websocket passqa.js <baseUrl>
 *
 * Seeds data, turns encryption on in PASSPHRASE mode through the real UI, then
 * proves the properties that matter: the profile holds no usable key, a wrong
 * passphrase is rejected, the right one unlocks, and the data survives.
 */
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const BASE = process.argv[2];
// Chrome is located per-platform, with an override for anything unusual:
//   MUTUAL_CHROME=/path/to/chrome npm run qa:web -- ...
// Hardcoding the Windows path made this script silently unusable for anyone
// else, which matters because it ships in a public repository.
function findChrome() {
  if (process.env.MUTUAL_CHROME) return process.env.MUTUAL_CHROME;
  const candidates = {
    win32: [
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    ],
    darwin: [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
    ],
    linux: ['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'],
  }[process.platform] || [];
  const hit = candidates.find((c) => fs.existsSync(c));
  if (!hit) {
    console.error('Could not find Chrome. Set MUTUAL_CHROME to its full path.');
    process.exit(2);
  }
  return hit;
}
const CHROME = findChrome();
const PORT = 9455;
const PASS = 'correct horse battery staple';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const check = (n, ok, d) => { results.push({ n, ok, d }); console.log((ok ? '  PASS  ' : '  FAIL  ') + n + (d ? '  — ' + d : '')); };

let ws, msgId = 0;
const pending = new Map();
function send(method, params) {
  const msg = { id: ++msgId, method, params: params || {} };
  return new Promise((res, rej) => { pending.set(msg.id, { res, rej }); ws.send(JSON.stringify(msg)); });
}
async function evaluate(expression, awaitPromise) {
  const r = await send('Runtime.evaluate', { expression, awaitPromise: !!awaitPromise, returnByValue: true });
  if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 400));
  return r.result && r.result.value;
}
async function clickText(t) {
  const box = await evaluate(`(() => {
    const q = ${JSON.stringify(t)};
    let el = null;
    try { el = document.querySelector(q); } catch (e) { /* q is text, not a selector */ }
    if (!el) { const all=[...document.querySelectorAll('div,span,a')];
      el = all.filter(e => e.textContent.trim() === q && e.children.length === 0).pop()
        || all.filter(e => e.textContent.trim() === q).pop(); }
    if (!el) return null;
    el.scrollIntoView({ block: 'center' });
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.x + r.width/2), y: Math.round(r.y + r.height/2) };
  })()`);
  if (!box) throw new Error('not found: ' + t);
  await sleep(250);
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: box.x, y: box.y, button: 'left', clickCount: 1 });
  await sleep(50);
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: box.x, y: box.y, button: 'left', clickCount: 1 });
}
async function typeText(s) {
  // Input.insertText behaves like an IME commit, which React's controlled
  // inputs observe. Per-character key events do not update React state.
  await send('Input.insertText', { text: s });
  await sleep(150);
}
async function dumpDialog(tag) {
  const t = await evaluate('document.body.innerText.slice(-700)');
  console.log('   [' + tag + '] ' + String(t).split('\n').filter(Boolean).slice(-6).join(' | '));
}
async function focusFirstInput(kind) {
  return evaluate(`(() => {
    const i = [...document.querySelectorAll('input')].filter(e => e.type === ${JSON.stringify(kind)}).pop();
    if (!i) return false; i.focus(); return true;
  })()`);
}
const idbDump = `(async () => {
  const db = await new Promise(r => { const q = indexedDB.open('mutual'); q.onsuccess = () => r(q.result); });
  if (![...db.objectStoreNames].includes('kv')) return {};
  const tx = db.transaction('kv','readonly').objectStore('kv');
  const keys = await new Promise(r => { const q = tx.getAllKeys(); q.onsuccess = () => r(q.result); });
  const vals = await new Promise(r => { const q = db.transaction('kv','readonly').objectStore('kv').getAll(); q.onsuccess = () => r(q.result); });
  const out = {};
  keys.forEach((k,i) => {
    const v = vals[i];
    out[k] = typeof v === 'string' ? v.slice(0,90)
      : (v && v.constructor ? '[' + v.constructor.name + (v.v ? ' ' + v.v : '') + ']' : String(v));
    if (v && typeof v === 'object' && v.v) out[k] = 'OBJ ' + JSON.stringify(v).slice(0,120);
  });
  return out;
})()`;

(async () => {
  const profile = path.join(os.tmpdir(), 'mutual-passqa-profile');
  fs.rmSync(profile, { recursive: true, force: true });
  const chrome = spawn(CHROME, ['--headless=new', '--remote-debugging-port=' + PORT,
    '--user-data-dir=' + profile, '--window-size=1280,900', '--hide-scrollbars',
    '--no-first-run', '--no-default-browser-check', '--disable-gpu', 'about:blank'], { stdio: 'ignore' });

  let target = null;
  for (let i = 0; i < 60; i++) {
    try { const l = await fetch('http://127.0.0.1:' + PORT + '/json/list').then(r => r.json());
      target = l.find(t => t.type === 'page'); if (target) break; } catch (e) {}
    await sleep(500);
  }
  ws = new WebSocket(target.webSocketDebuggerUrl);
  ws.addEventListener('message', (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id);
      m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result); }
  });
  await new Promise((r) => ws.addEventListener('open', r));
  await send('Page.enable'); await send('Runtime.enable');

  console.log('\n=== passphrase-mode QA against ' + BASE + ' ===\n');
  await send('Page.navigate', { url: BASE });
  await sleep(8000);

  // seed data directly so the test is about the key, not the import
  await evaluate(`(async () => {
    const put=(db,k,v)=>new Promise((res,rej)=>{const tx=db.transaction('kv','readwrite');tx.objectStore('kv').put(v,k);tx.oncomplete=res;tx.onerror=()=>rej(tx.error);});
    const db=await new Promise((res,rej)=>{const q=indexedDB.open('mutual',1);q.onupgradeneeded=()=>{q.result.createObjectStore('kv');};q.onsuccess=()=>res(q.result);q.onerror=()=>rej(q.error);});
    const now=Date.now();
    const mk=i=>({username:'seeded_user_'+i,profileUrl:'x',timestamp:1});
    const mutual=Array.from({length:30},(_,i)=>mk(i)), fans=Array.from({length:5},(_,i)=>mk(900+i)), unf=Array.from({length:12},(_,i)=>mk(700+i));
    await put(db,'@instagram_tracker:onboarding_done','true');
    await put(db,'@instagram_tracker:accounts',JSON.stringify([{id:'default',name:'Account 1',createdAt:now}]));
    await put(db,'@instagram_tracker:follower_data',JSON.stringify({followers:mutual.concat(fans),following:mutual.concat(unf),unfollowers:unf,fans,stats:{followersCount:35,followingCount:42,unfollowersCount:12,mutualFollows:30,fansCount:5,followBackRatio:71.4},lastUpdated:now}));
    return 'seeded';
  })()`, true);
  await send('Page.reload'); await sleep(8000);
  check('Seeded data renders', await evaluate(`document.body.innerText.includes('35')`));

  // Settings -> encrypt -> passphrase mode
  await clickText('a[href$="/Tabs/Settings"]'); await sleep(3000);
  const swBox = await evaluate(`(() => {
    const l=[...document.querySelectorAll('div,span')].filter(e=>e.textContent==='Encrypt data at rest').pop();
    let row=l, sw=null; for(let i=0;i<6&&row;i++){sw=row.querySelector('input[type="checkbox"]');if(sw)break;row=row.parentElement;}
    if(!sw) return null; sw.scrollIntoView({block:'center'});
    const r=sw.getBoundingClientRect(); return {x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)};
  })()`);
  await sleep(400);
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: swBox.x, y: swBox.y, button: 'left', clickCount: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: swBox.x, y: swBox.y, button: 'left', clickCount: 1 });
  await sleep(1500);

  const sheet = await evaluate(`document.body.innerText.includes('With a passphrase (strongest)')`);
  check('Web offers the passphrase / no-passphrase choice', sheet === true);

  await clickText('With a passphrase (strongest)'); await sleep(1800);
  await dumpDialog('prompt 1');
  const hasInput = await evaluate('!!document.querySelector(\'input[type="password"]\')');
  check('Passphrase prompt appears', hasInput === true);
  await focusFirstInput('password'); await typeText(PASS);
  const typed = await evaluate('(document.querySelector(\'input[type="password"]\')||{}).value ? document.querySelector(\'input[type="password"]\').value.length : 0');
  console.log('   typed chars in field: ' + typed);
  await clickText('Next'); await sleep(1800);
  await dumpDialog('prompt 2');
  await focusFirstInput('password'); await typeText(PASS);
  const typed2 = await evaluate('(document.querySelector(\'input[type="password"]\')||{}).value ? document.querySelector(\'input[type="password"]\').value.length : 0');
  console.log('   confirm field chars: ' + typed2);
  await clickText('Encrypt');
  await sleep(3000);
  await dumpDialog('after Encrypt');
  await sleep(40000); // PBKDF2 600k + encrypting every slice, headless is slow
  await dumpDialog('settled');

  const dump = await evaluate(idbDump, true);
  const fd = dump['@instagram_tracker:follower_data'] || '';
  const keyRec = dump['@instagram_tracker:at_rest_master_key_v1'] || '';
  check('Data is encrypted (GCM envelope)', fd.includes('AES-256-GCM'), fd.slice(0, 60));
  check('No plaintext username in storage', !fd.includes('seeded_user'), fd.slice(0, 60));
  check('Stored key is a WRAPPED record, not a usable CryptoKey',
    keyRec.includes('mtl-wrapped-key'), keyRec.slice(0, 110));
  check('Wrapped record names PBKDF2 with a high iteration count',
    /PBKDF2-SHA256/.test(keyRec) && /600000/.test(keyRec), keyRec.slice(0, 130));

  // THE point of the mode: a copy of the profile has nothing usable in it.
  const offline = await evaluate(`(async () => {
    const db = await new Promise(r => { const q = indexedDB.open('mutual'); q.onsuccess = () => r(q.result); });
    const rec = await new Promise(r => { const q = db.transaction('kv','readonly').objectStore('kv').get('@instagram_tracker:at_rest_master_key_v1'); q.onsuccess = () => r(q.result); });
    return { isCryptoKey: rec instanceof CryptoKey, keys: rec && typeof rec === 'object' ? Object.keys(rec) : null };
  })()`, true);
  check('Profile contains NO directly-usable key object',
    offline.isCryptoKey === false, JSON.stringify(offline));

  // reload -> must demand the passphrase
  await send('Page.reload'); await sleep(9000);
  const gated = await evaluate(`document.body.innerText.includes('Unlock Mutual')`);
  check('Reload demands the passphrase before showing anything', gated === true);
  check('No data visible while locked', (await evaluate(`document.body.innerText.includes('35')`)) === false);

  // wrong passphrase
  await focusFirstInput('password'); await typeText('definitely the wrong one');
  await clickText('Unlock'); await sleep(9000);
  const stillLocked = await evaluate(`document.body.innerText.includes('did not unlock')`);
  check('Wrong passphrase is rejected', stillLocked === true);

  // right passphrase
  await focusFirstInput('password'); await typeText(PASS);
  await clickText('Unlock'); await sleep(12000);
  const unlocked = await evaluate(`document.body.innerText.includes('35')`);
  check('Correct passphrase unlocks and data decrypts', unlocked === true);

  console.log('\n=== ' + results.filter(r => r.ok).length + '/' + results.length + ' passed ===');
  const fails = results.filter(r => !r.ok);
  if (fails.length) { console.log('\nFAILURES:'); fails.forEach(f => console.log('  - ' + f.n + ': ' + f.d)); }
  ws.close(); chrome.kill();
  await sleep(1500);
  try { fs.rmSync(path.join(os.tmpdir(), 'mutual-passqa-profile'), { recursive: true, force: true }); } catch (e) {}
  process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error('HARNESS ERROR', e); process.exit(2); });
