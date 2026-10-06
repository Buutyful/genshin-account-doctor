/** Parse JSON data embedded in a public Next page without executing page scripts. */
export function publicPageProps(html, requiredKey) {
  const chunks = [...html.matchAll(/self\.__next_f\.push\((\[[\s\S]*?\])\)<\/script>/g)].flatMap(match => {
    try { const value = JSON.parse(match[1]); return typeof value[1] === 'string' ? [value[1]] : []; } catch { return []; }
  }).join('');
  let found;
  function walk(value) {
    if (!value || typeof value !== 'object') return;
    if (!Array.isArray(value) && Object.hasOwn(value, requiredKey)) found = value;
    for (const child of Object.values(value)) if (child && typeof child === 'object') walk(child);
  }
  for (const line of chunks.split('\n')) {
    try { walk(JSON.parse(line.slice(line.indexOf(':') + 1))); } catch { /* Non-JSON stream metadata. */ }
  }
  if (!found) throw new Error(`Public page schema changed: missing ${requiredKey}.`);
  return found;
}

export const normalizeName = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
const aliases = { 'neuvilette': 'neuvillette', 'childe': 'tartaglia', 'anemomc': 'traveleranemo', 'geomc': 'travelergeo', 'electromc': 'travelerelectro', 'dendromc': 'travelerdendro', 'hydromc': 'travelerhydro', 'pyromc': 'travelerpyro', 'cryomc': 'travelercryo' };

export function publicProofUrl(value) {
  if (typeof value !== 'string') throw new Error('Missing public proof URL.');
  let text = value.trim();
  if (/^(?:www\.)?(?:youtube\.com|youtu\.be|bilibili\.com|x\.com|twitter\.com)\//i.test(text)) text = `https://${text}`;
  const url = new URL(text);
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) throw new Error('Invalid public proof URL.');
  url.protocol = 'https:';
  return url.href;
}

/** Only factual listing fields; moderation is not independent proof/build verification. */
export function normalizeListing(row, characters, snapshotId, sourceUrl) {
  const keys = new Map(characters.flatMap(c => [c.id, c.name, c.dataId].map(key => [normalizeName(key), c.id])));
  if (!row.is_verified || !Array.isArray(row.clear_characters) || row.clear_characters.length !== 4) throw new Error('Unverified listing or incomplete composition.');
  const members = row.clear_characters.slice().sort((a, b) => a.sort_order - b.sort_order).map(m => {
    const name = normalizeName(m.characters?.name ?? '');
    const character = aliases[name] ?? keys.get(name);
    if (!character) throw new Error(`Unknown character: ${m.characters?.name}`);
    if (!Number.isInteger(m.constellation) || m.constellation < 0 || m.constellation > 6 || !m.weapons?.name || !Number.isInteger(m.weapon_refinement) || m.weapon_refinement < 1 || m.weapon_refinement > 5) throw new Error('Invalid listed investment.');
    const level = m.imported_details?.characterLevel;
    return { character, constellation: m.constellation, weapon: m.weapons.name, refinement: m.weapon_refinement, ...(Number.isInteger(level) && level >= 1 && level <= 100 ? { level } : {}) };
  });
  const tags = (row.clear_tag_assignments ?? []).map(t => t.clear_tags?.label).filter(t => typeof t === 'string');
  if (new Set(members.map(m => characters.find(c => c.id === m.character).accountId)).size !== 4) throw new Error('Repeated account identity.');
  if (!Number.isFinite(row.time_seconds) || row.time_seconds <= 0 || row.time_seconds > 86400 || !Number.isFinite(row.cost) || row.cost < 0 || row.cost > 1000 || !['Dire', 'Fearless'].includes(row.difficulty)) throw new Error('Invalid listed time, cost or difficulty.');
  const proofUrl = publicProofUrl(row.link);
  return { id: row.id, bossId: row.boss_id, versionId: row.version_id, difficulty: row.difficulty, seconds: row.time_seconds, cost: row.cost, proofUrl, ...(proofUrl !== row.link ? { originalProofUrl: row.link } : {}), sourceUrl, members, tags, investment: tags.some(t => /reduced cost/i.test(t)) ? 'reduced' : 'listed', verification: 'source-listed', snapshotId };
}
