import knowledge from './data/knowledge.json';
import type { TeamContract } from './planner/types';
export const graph = knowledge;
export type Edge = (typeof knowledge.edges)[number];
const adjacency = new Map<string, Edge[]>();
for (const edge of graph.edges) for (const id of [edge.a, edge.b]) adjacency.set(id, [...(adjacency.get(id) ?? []), edge]);
const pairs = new Map(graph.edges.map(e => [[e.a, e.b].sort().join('|'), e]));
export function neighbors(id: string) { return [...(adjacency.get(id) ?? [])].sort((a, b) => b.priority - a.priority).map(edge => ({ id: edge.a === id ? edge.b : edge.a, edge })); }
export function relationship(a: string, b: string) { return pairs.get([a, b].sort().join('|')); }
interface ReviewedRecipe extends Partial<Pick<TeamContract, 'encounterTags' | 'minimumConstellations' | 'rotationOutline' | 'buildNotes' | 'buildTargets'>> { name: string; slots: string[][]; roles: string[]; why: string; caution: string; source: string; }
export const reviewed: ReviewedRecipe[] = [
  { name: 'Mavuika Melt', slots: [['mavuika'], ['citlali'], ['xilonen', 'iansan', 'sucrose', 'kazuha'], ['bennett']],
    roles: ['On-field carry', 'Cryo & shield', 'Buff support', 'ATK & healing'],
    why: 'Citlali enables Melt; Bennett and the flex support amplify Mavuika’s damage window.',
    caution: 'Set up Cryo before the Burst and use a compatible charged-attack combo. Iansan’s buff depends on movement. Coordinate support artifact sets.', source: 'https://keqingmains.com/q/mavuika-quickguide/',
    rotationOutline: 'Activate the flex support and Bennett’s buffs, then establish Citlali’s Cryo before Mavuika’s Burst. Jump before the charged-attack chain to align Melt; keep the damage window inside Bennett’s field.',
    buildTargets: { mavuika: { talent: 'burst' } },
    buildNotes: { mavuika: 'Prioritize Burst, then Skill; 4pc Obsidian Codex with EM/ATK, Pyro and CRIT. Fighting Spirit uses Natlan support; ER does not charge her Burst.', xilonen: 'Activate samples with Skill and two normal attacks. Coordinate Scroll, Petra or Instructor with Citlali.', citlali: 'Maintain Cryo and shield; coordinate the support set and any Thrilling Tales handoff.' } },
  { name: 'Neuvillette Hypercarry', slots: [['neuvillette'], ['furina'], ['kazuha'], ['xilonen', 'zhongli']],
    roles: ['On-field carry', 'Damage & buffs', 'Anemo support', 'Sustain support'],
    why: 'This guide example builds around Neuvillette with Furina and resistance-reducing supports.',
    caution: 'At C0, double Hydro sacrifices a passive stack. Xilonen provides healing; Zhongli offers interruption protection. Check Furina’s healing needs.', source: 'https://keqingmains.com/q/neuvillette-quickguide/',
    rotationOutline: 'Neuvillette Burst → support setup → charged attack, Skill, charged attack → refresh support buffs → charged attack and Skill. Check energy for the next loop and split field time to retain buffs.',
    buildTargets: { neuvillette: { level: 90, talent: 'auto' } },
    buildNotes: { neuvillette: 'Prioritize Normal Attack talent and level for HP scaling; 4pc Marechaussee Hunter, HP sands, Hydro/HP goblet and CRIT circlet. Prototype Amber is a craftable option; check ER with the actual weapon and particles.', furina: 'Check repeated Burst availability and healing for Fanfare. Healer presence does not establish maximum stacks.' } },
  { name: 'Nahida Hyperbloom', slots: [['nahida'], ['xingqiu'], ['yelan'], ['kuki']],
    roles: ['Dendro driver', 'Hydro & protection', 'Hydro damage', 'Trigger & healing'],
    why: 'Dendro and Hydro create cores, with Kuki assigned as the Hyperbloom trigger.',
    caution: 'Kuki’s level and Elemental Mastery matter. Maintain Hydro application and enough Energy Recharge to repeat the rotation.', source: 'https://keqingmains.com/q/nahida-quickguide/' },
  { name: 'Alhaitham Quickbloom', slots: [['alhaitham'], ['nahida'], ['xingqiu'], ['kuki']],
    roles: ['On-field carry', 'Dendro support', 'Hydro support', 'Trigger & healing'],
    why: 'Alhaitham drives a Dendro core while Kuki handles Hyperbloom and healing.',
    caution: 'Keep Alhaitham’s field time and mirror management in mind. Build Kuki for her reaction-trigger role.', source: 'https://keqingmains.com/q/nahida-quickguide/' },
  { name: 'Raiden National', slots: [['raiden'], ['xiangling'], ['xingqiu'], ['bennett']],
    roles: ['On-field & energy', 'Pyro damage', 'Hydro application', 'ATK & healing'],
    why: 'A guide-listed reaction team with Raiden’s field window following the off-field setup.',
    caution: 'Energy Recharge and Burst availability still need an equipment check. This team reserves Bennett and Xingqiu from your other teams.', source: 'https://keqingmains.com/q/raiden-quickguide/' },
];
