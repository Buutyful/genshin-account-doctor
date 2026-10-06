import { object } from '../account';

export const matchupTags = ['Pyro', 'Hydro', 'Electro', 'Cryo', 'Dendro', 'Anemo', 'Geo', 'healing', 'shield', 'grouping', 'bow'];
export interface ChallengeStrategy { manual: boolean; drafts: Record<string, { opponents: string; preferred: string[] }>; }
export function parseChallengeStrategy(raw: unknown): ChallengeStrategy {
  const value = object(raw, 'Challenge strategy');
  if (typeof value.manual !== 'boolean') throw new Error('Invalid challenge strategy.');
  const rows = Object.entries(object(value.drafts, 'Challenge targets'));
  if (rows.length > 100) throw new Error('Too many challenge targets.');
  const drafts: ChallengeStrategy['drafts'] = {};
  for (const [key, rawDraft] of rows) {
    const draft = object(rawDraft, 'Challenge target');
    if (!/^(Europe|America|Asia):(abyss|stygian)-[a-zA-Z0-9_-]+$/.test(key) || key.length > 200 || typeof draft.opponents !== 'string' || draft.opponents.length > 200 || !Array.isArray(draft.preferred) || draft.preferred.length > matchupTags.length || draft.preferred.some(t => typeof t !== 'string' || !matchupTags.includes(t))) throw new Error('Invalid challenge target.');
    drafts[key] = { opponents: draft.opponents, preferred: [...new Set(draft.preferred)] };
  }
  return { manual: value.manual, drafts };
}
