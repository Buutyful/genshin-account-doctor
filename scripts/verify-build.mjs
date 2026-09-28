import { readdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
const root = resolve(import.meta.dirname, '../dist');
async function files(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  return (await Promise.all(entries.map(e => e.isDirectory() ? files(join(dir, e.name)) : join(dir, e.name)))).flat();
}
const paths = await files(root);
const forbidden = paths.filter(p => /\.wasm$|[\\/]simulation[\\/]|wasm_exec|[\\/]worker\.js$/.test(p));
if (forbidden.length) throw new Error(`Simulation artifacts entered the app build: ${forbidden.join(', ')}`);
for (const path of paths.filter(p => p.endsWith('.js'))) {
  const body = await readFile(path, 'utf8');
  if (/gcsim\.wasm|new Worker\(|WebAssembly\.(instantiate|compile)/.test(body)) throw new Error(`Simulation loader in app bundle: ${path}`);
}
console.log(`Verified ${paths.length} production files: no simulation engine, workers or engine loader.`);
