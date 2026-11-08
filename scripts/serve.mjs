// Minimal static file server for local testing. No dependencies.
// Serves the project root so the game is reachable at http://localhost:8080/
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PORT = Number(process.env.PORT || 8080);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.mp3': 'audio/mpeg',
};

createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    let pathname = decodeURIComponent(url.pathname);
    // Resolve inside ROOT only (prevents ../ escapes).
    let filePath = normalize(join(ROOT, pathname));
    if (!filePath.startsWith(ROOT)) {
      res.writeHead(403); res.end('Forbidden'); return;
    }
    let info = await stat(filePath).catch(() => null);
    if (info && info.isDirectory()) {
      if (!pathname.endsWith('/')) {
        res.writeHead(302, { Location: pathname + '/' }); res.end(); return;
      }
      filePath = join(filePath, 'index.html');
      info = await stat(filePath).catch(() => null);
    }
    if (!info) { res.writeHead(404); res.end('Not found'); return; }
    const body = await readFile(filePath);
    res.writeHead(200, {
      'Content-Type': TYPES[extname(filePath)] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    res.end(body);
  } catch (err) {
    res.writeHead(500); res.end('Server error');
  }
}).listen(PORT, () => {
  console.log(`Serving ${ROOT}`);
  console.log(`Game: http://localhost:${PORT}/`);
  console.log(`MMA:  http://localhost:${PORT}/mma-game/`);
});
