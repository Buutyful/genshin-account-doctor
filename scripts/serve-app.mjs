import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, sep } from 'node:path';

const root = resolve(import.meta.dirname, '../dist');
const types = { '.wasm':'application/wasm', '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.json':'application/json', '.png':'image/png', '.svg':'image/svg+xml' };
const server = createServer(async (request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
  const relative = pathname.replace(/^\/doctor(?=\/|$)/, '').replace(/^\/+/, '') || 'index.html';
  const file = resolve(root, relative);
  if (file !== root && !file.startsWith(root + sep)) {
    response.writeHead(403).end();
    return;
  }
  try {
    const target = (await stat(file)).isDirectory() ? resolve(file, 'index.html') : file;
    const body = await readFile(target);
    const extension = target.slice(target.lastIndexOf('.'));
    response.writeHead(200, { 'content-type':types[extension] ?? 'application/octet-stream', 'cache-control':'no-store' }).end(body);
  } catch {
    response.writeHead(404).end('Not found');
  }
});
server.listen(4184, '127.0.0.1', () => console.log('App fixture at http://127.0.0.1:4184/doctor/'));
