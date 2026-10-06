import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
const output = 'output/decision-sources';
await mkdir(output, { recursive: true });
const urls = [
  'https://www.stygian.moe/',
  'https://www.icy-veins.com/genshin-impact/spiral-abyss-floor-12-guide',
  'https://static.nanoka.cc/gi/7.1/tower.json',
  'https://static.nanoka.cc/gi/7.1/leyline.json',
  'https://static.nanoka.cc/gi/7.1/en/leyline/5269012.json',
  'https://timesaver.gg/blog/genshin-spiral-abyss-floor-12-guide',
];
const sources = await Promise.all(urls.map(async (url, i) => {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
    const bytes = Buffer.from(await response.arrayBuffer());
    await writeFile(`${output}/${i}.txt`, bytes);
    return { url, status: response.status, sha256: createHash('sha256').update(bytes).digest('hex'), bytes: bytes.length, title: bytes.toString().match(/<title>(.*?)<\/title>/)?.[1] };
  } catch (e) { return { url, error: String(e) }; }
}));
const report = { capturedAt: new Date().toISOString(), purpose: 'Current lineup, conditional mechanic and source-date review; not damage measurements', sources };
await writeFile(`${output}/audit.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
