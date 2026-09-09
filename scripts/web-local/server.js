// Minimal zero-dependency static server for the local Mutual build.
// Node ships everything this needs, so there is nothing to install.
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const PORT = Number(process.argv[2]) || 8321;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.ttf': 'font/ttf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

http
  .createServer((req, res) => {
    const urlPath = decodeURIComponent(req.url.split('?')[0]);
    let file = path.join(ROOT, urlPath);
    // Anything that is not a real file falls back to index.html, so the app's
    // own routes work and a stray URL never shows a 404.
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      file = path.join(ROOT, 'index.html');
    }
    // Never serve outside this folder, whatever the URL claims.
    if (!path.resolve(file).startsWith(path.resolve(ROOT))) {
      res.writeHead(403).end('Forbidden');
      return;
    }
    res.writeHead(200, {
      'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    fs.createReadStream(file).pipe(res);
  })
  .listen(PORT, '127.0.0.1', () => {
    console.log(`\n  Mutual is running at  http://localhost:${PORT}\n`);
    console.log('  Leave this window open while you use the app.');
    console.log('  Close it (or press Ctrl+C) to stop.\n');
  });
