import { byId } from '../account';
import type { TeamContract } from './types';

export const mechanicsSource = 'https://library.keqingmains.com/combat-mechanics/elemental-effects';
export interface MechanicNote { kind: 'synergy' | 'check' | 'restriction'; text: string; source: string; }
const healers = ['bennett', 'barbara', 'kokomi', 'jean', 'xianyun', 'baizhu', 'yaoyao', 'kuki', 'charlotte', 'diona', 'sayu', 'qiqi', 'xilonen', 'sigewinne', 'escoffier'];
const groupers = ['kazuha', 'venti', 'sucrose'];
export function capabilities(members: string[]) {
  return [...new Set(members.flatMap(id => [byId[id]?.element, ...(healers.includes(id) ? ['healing'] : []), ...(groupers.includes(id) ? ['grouping'] : []), ...(byId[id]?.weapon === 'Bow' ? ['bow'] : []), ...(['zhongli', 'layla', 'diona', 'kirara', 'thoma'].includes(id) ? ['shield'] : [])]).filter(Boolean))];
}
export function analyzeSynergy(members: string[]): MechanicNote[] {
  const notes: MechanicNote[] = [];
  const elements = members.map(id => byId[id]?.element), has = (e: string) => elements.includes(e);
  const add = (kind: MechanicNote['kind'], text: string, source = mechanicsSource) => notes.push({ kind, text, source });
  if (has('Hydro') && has('Dendro') && has('Electro')) add('synergy', 'Hydro + Dendro can create cores for Hyperbloom. Confirm which Electro attack actually hits the cores; element presence alone does not establish a trigger.');
  if (members.some(id => ['kuki', 'raiden'].includes(id)) && has('Hydro') && has('Dendro')) add('synergy', 'Kuki’s ring or Raiden’s coordinated Skill can trigger Hyperbloom. Reaction damage uses the trigger’s level and EM. Raiden’s Skill needs damage to proc; shields can interrupt this setup.');
  if (has('Pyro') && has('Hydro')) add('check', 'Vaporize needs sustained aura and a known trigger. Enter only the hits that actually react; internal cooldown prevents assuming every hit Vaporizes.');
  if (has('Pyro') && has('Cryo')) add('check', 'Melt direction and aura uptime matter. Cryo-triggered Melt is 1.5× base; Pyro-triggered Melt is 2× before EM.');
  if (has('Hydro') && has('Cryo')) add('check', 'Freeze provides control against freezable enemies. Bosses may be immune to Freeze; do not assume frozen-target bonuses.');
  if (has('Anemo') && ['Hydro', 'Pyro', 'Cryo', 'Electro'].some(has)) add('check', 'Anemo can Swirl an applied aura. Viridescent Venerer shred requires the equipped set and an on-field Swirl of the intended element. It cannot shred Dendro or Geo.');
  if (members.includes('furina')) add('check', 'Furina’s Fanfare requires HP changes. Confirm healing throughput and buff ramp; a healer’s presence does not imply maximum stacks.', 'https://keqingmains.com/q/furina-quickguide/');
  if (members.includes('nilou') && !(has('Hydro') && has('Dendro') && elements.every(e => e === 'Hydro' || e === 'Dendro'))) add('restriction', 'Nilou’s Bountiful Core passive is inactive: the team must contain both Hydro and Dendro and no other elements.', 'https://keqingmains.com/q/nilou-quickguide/');
  if (members.includes('chevreuse') && !(has('Pyro') && has('Electro') && elements.every(e => e === 'Pyro' || e === 'Electro'))) add('restriction', 'Chevreuse’s resistance-reduction passive requires only Pyro/Electro characters with both elements present.', 'https://keqingmains.com/q/chevreuse-quickguide/');
  if (!members.some(id => healers.includes(id))) add('check', 'No healer in the covered kit list. Check shields, self-healing and encounter damage; unlisted kits remain unknown.');
  if (members.includes('xiangling') && members.includes('bennett')) add('synergy', 'Bennett can battery Xiangling and buff a snapshotted Pyronado. Catch particles on Xiangling and check that Burst is available each rotation.', 'https://keqingmains.com/xiangling/');
  for (const element of new Set(elements)) if (elements.filter(e => e === element).length >= 2) add('synergy', `${element} resonance is available. Conditional resonance bonuses still need their trigger and uptime; they are not automatically added to the calculator.`);
  add('check', 'Energy, on-field time, reaction ownership and buff uptime need a rotation check. These kit checks do not certify a clear.');
  return notes;
}

/** Product-authored role contracts: complete slots and a known core trigger, not graph cliques. */
export const mechanicalContracts: TeamContract[] = ['kuki', 'raiden'].map(trigger => ({
  id: `mechanical-hyperbloom-${trigger}`, origin: 'mechanical', name: `${byId[trigger].name} Hyperbloom core`, anchor: 'nahida',
  slots: [['nahida', 'travelerdendro', 'collei'], ['xingqiu', 'yelan', 'kokomi', 'barbara'], [trigger], trigger === 'kuki' ? ['zhongli', 'sucrose', 'yelan', 'xingqiu', 'kokomi', 'barbara'] : ['kokomi', 'barbara', 'baizhu', 'yaoyao']],
  roles: ['Dendro application / flexible driver', 'Hydro application', 'Off-field core trigger (EM)', 'Sustain / utility'],
  source: 'https://library.keqingmains.com/combat-mechanics/elemental-effects/transformative-reactions', checkedAt: '2026-09-30',
  why: 'Assembled from a Dendro applicator, Hydro applicator, a known off-field core trigger and a constrained utility slot. This is a product-authored role contract, not a copied team example.',
  caution: 'Experimental composition: confirm application rate, normal attacks for coordinated Hydro, energy and healing. Raiden is an off-field EM trigger here, not a Burst carry. No full-rotation benchmark is implied.',
}));
