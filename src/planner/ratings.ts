import { byId } from '../account';
import type { Account } from '../account';
import { metaIsFresh, metaPack } from './planner';
import type { MetaPack } from './types';
import conditionsReview from '../data/rating-conditions.json';

/** A small conditional prior. Missing ratings are neutral, never a failed mechanic. */
export function conditionalRatings(members: string[], driver: string, account: Account, meta: MetaPack = metaPack, now?: string) {
  const fresh = metaIsFresh(meta, now);
  const contributions = members.map(id => {
    const entries = meta.entries.filter(e => e.id === id && (id === driver ? e.role === 'carry' : e.role !== 'carry')).sort((a, b) => a.tier - b.tier);
    const entry = entries.find(e => (e.constellation === 0 || (account.constellations?.[id] ?? -1) >= e.constellation) && e.partners.every(p => members.includes(p)));
    const unmet = entries[0];
    const conditions = !entry && unmet ? [
      ...(unmet.constellation > (account.constellations?.[id] ?? -1) && unmet.constellation > 0 ? [`${byId[id].name}: rating requires C${unmet.constellation}; account C${account.constellations?.[id] ?? '?'}`] : []),
      ...unmet.partners.filter(p => !members.includes(p)).map(p => `${byId[id].name}: rating requires ${byId[p].name} in this team`),
    ] : [];
    const expert = meta.id === metaPack.id && conditionsReview.patch === meta.patch && conditionsReview.expertRoles.some(e => e.id === id && e.role === entry?.role);
    const tier = entry ? entry.tier : null;
    return { character: id, role: id === driver ? 'carry' : 'support', tier: fresh ? tier : null,
      points: fresh && tier !== null ? (2 - tier) * (id === driver ? 10 : 2) : 0,
      conditions: [...conditions, ...(expert ? [`${byId[id].name}: this rating requires practiced reaction and combo execution; inspect the rotation before choosing it`] : [])] };
  });
  return { fresh, source: meta.source, snapshot: meta.id, checkedAt: meta.checkedAt, expiresAt: meta.expiresAt,
    points: contributions.reduce((n, c) => n + c.points, 0), contributions };
}
