import { byId } from '../account';
import type { Account, CharacterDetails } from '../account';
import type { Configuration } from './configurations';

export interface BuildTask {
  character: string; field: 'level' | 'weapon' | 'talent' | 'em' | 'er' | 'artifacts' | 'review';
  text: string; status: 'upgrade' | 'check'; target?: number; talent?: keyof NonNullable<CharacterDetails['talents']>; source?: string;
}

/** Planning floors, not optimal stats or combat readiness. Unknown gear stays unknown. */
export function buildTasks(account: Account, config: Pick<Configuration, 'members' | 'driver' | 'roles' | 'sources'> & { seed?: Configuration['seed'] }): BuildTask[] {
  return config.members.flatMap(character => {
    const d = account.details?.[character], role = config.roles.find(p => p.character === character);
    const trigger = role?.effects.includes('core-trigger'), target = config.seed?.buildTargets?.[character]?.level ?? (trigger ? 90 : 80);
    const source = role?.source ?? config.sources[0];
    const tasks: BuildTask[] = [];
    const add = (field: BuildTask['field'], text: string, known = false, extra: Partial<BuildTask> = {}) => tasks.push({ character, field, text, status: known ? 'upgrade' : 'check', source, ...extra });
    if (d?.level === undefined || d.level < target) add('level', `${d?.level === undefined ? `Build to level ${target}` : `${d.level} → ${target}`}${trigger ? ' for the reaction trigger' : target === 90 ? ' for HP scaling' : ' · planning floor'}`, d?.level !== undefined, { target });
    if (!d?.weapon?.key) add('weapon', 'Choose and record a suitable weapon; no signature assumed');
    else if (d.weapon.level === undefined || d.weapon.level < 80) add('weapon', `${d.weapon.key}: level ${d.weapon.level ?? '?'} → 80 planning floor`, d.weapon.level !== undefined, { target: 80 });
    if (trigger) add('em', `EM-focused weapon and main stats; recorded EM ${d?.elementalMastery ?? '?'}. Check the resulting total`);
    const talent: BuildTask['talent'] = config.seed?.buildTargets?.[character]?.talent ?? (trigger ? role?.effects.includes('healing') ? 'skill' : undefined : !role ? undefined : character === config.driver ? role.effects.includes('charged-driver') ? 'auto' : role.effects.includes('burst-driver') ? 'burst' : 'skill' : role.burstCost ? 'burst' : 'skill');
    if (talent && (d?.talents?.[talent] === undefined || d.talents[talent]! < 6)) add('talent', `${talent} talent ${d?.talents?.[talent] ?? '?'} → 6 planning floor; use the guide for final targets`, d?.talents?.[talent] !== undefined, { target: 6, talent });
    if (role?.burstCost) add('er', `Check ${d?.energyRecharge === undefined ? 'unknown ER' : `${d.energyRecharge}% ER`} over repeated rotations; particle catches determine the target`);
    if (role?.effects.includes('swirl') && !config.seed?.buildNotes?.[character]) add('artifacts', 'Use 4pc Viridescent Venerer and Swirl the intended element');
    if (role?.effects.includes('dendro')) add('artifacts', 'Assign a Deepwood Memories holder when the team relies on Dendro damage');
    if (!role) add('review', `Check ${byId[character].name}’s role, artifact set and rotation in the full guide`);
    if (config.seed?.buildNotes?.[character]) add('review', config.seed.buildNotes[character]);
    return tasks;
  });
}

export function uniqueBuildTasks(tasks: BuildTask[]) {
  return [...new Map(tasks.map(t => [`${t.character}:${t.field}:${t.talent ?? ''}:${t.target ?? ''}`, t])).values()];
}

export function projectBuilds(account: Account, tasks: BuildTask[]): Account {
  const next = structuredClone(account);
  next.details ??= {};
  for (const t of tasks.filter(t => t.status === 'upgrade' && account.owned.includes(t.character))) {
    const d = next.details[t.character] ??= {};
    if (t.field === 'level') d.level = Math.max(d.level ?? 0, t.target!);
    if (t.field === 'weapon' && d.weapon?.key) d.weapon.level = Math.max(d.weapon.level ?? 0, t.target!);
    if (t.field === 'talent') { d.talents ??= {}; d.talents[t.talent!] = Math.max(d.talents[t.talent!] ?? 0, t.target!); }
  }
  return next;
}
