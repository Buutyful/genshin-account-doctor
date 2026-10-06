import { useState } from 'react';
import { accountIdentity, byId, teamMask } from './account';
import type { Account } from './account';
import type { Candidate } from './planner/types';
import { compositionKey } from './planner/planner';
import { analyzeSynergy } from './planner/mechanics';

export function customCandidate(members: string[], account: Account): Candidate {
  if (members.length !== 4 || members.some(id => !Object.hasOwn(byId, id)) || new Set(members.map(accountIdentity)).size !== 4) throw new Error('Choose four different account characters.');
  return { id: compositionKey(members), name: `${byId[members[0]].name} · custom team`, members, roles: ['Selected driver', 'Custom teammate', 'Custom teammate', 'Custom teammate'], anchor: members[0], origin: 'custom', reviewed: false, why: 'Your manually selected composition. Review its mechanical conditions and rotation below.', caution: 'This team has not been validated against a guide or simulation. Kit coverage and entered damage calculations do not establish reaction uptime or energy sustainability.', sources: [], score: 0, missing: members.filter(id => !account.owned.includes(id)), mask: teamMask(members), retrieval: 0, ranking: 'unrated', metaTier: null, assumptions: [], unsupported: members.filter(id => !byId[id].engineId) };
}
export function readCustomTeams(): string[][] {
  try { const v: unknown = JSON.parse(localStorage.getItem('account-doctor-custom-teams-v1') ?? '[]'); return Array.isArray(v) ? v.slice(0, 50).filter((m): m is string[] => Array.isArray(m) && m.length === 4 && m.every(id => typeof id === 'string' && Object.hasOwn(byId, id)) && new Set(m.map(accountIdentity)).size === 4) : []; } catch { return []; }
}
export function CustomTeamBuilder({ account, saved, onSave, onRemove, onOpen }: { account: Account; saved: string[][]; onSave: (members: string[]) => void; onRemove: (id: string) => void; onOpen: (team: Candidate) => void }) {
  const [members, setMembers] = useState(['', '', '', '']);
  const valid = members.every(id => account.owned.includes(id)) && new Set(members.map(accountIdentity)).size === 4;
  const notes = valid ? analyzeSynergy(members) : [];
  return <details className="panel custom-builder"><summary>Build a custom team</summary><p>Choose any four owned characters. The first slot is your intended driver. Save the composition to inspect synergies and calculate a rotation, even if no guide contains it.</p><div className="calculation-fields">{members.map((id, i) => <label className="field-label" key={i}>Slot {i + 1}{i === 0 ? ' · driver' : ''}<select aria-label={`Custom team slot ${i + 1}`} value={id} onChange={e => setMembers(m => m.map((old, j) => i === j ? e.target.value : old))}><option value="">Choose character</option>{account.owned.map(c => <option key={c} value={c} disabled={members.some((other, j) => j !== i && accountIdentity(other) === accountIdentity(c))}>{byId[c].name}</option>)}</select></label>)}</div>{notes.filter(n => n.kind === 'restriction').map((n, i) => <p className="challenge-status" key={i}>{n.text}</p>)}<button className="button primary small" disabled={!valid || saved.length >= 50} onClick={() => onSave([...members])}>Save custom team</button><div className="saved-custom-teams">{saved.map(m => { const t = customCandidate(m, account); return <div key={t.id}><span>{m.map(id => byId[id].name).join(' / ')}{t.missing.length ? ' · characters missing' : ''}</span><button className="text-button" onClick={() => onOpen(t)}>Inspect team</button><button className="text-button" onClick={() => onRemove(t.id)} aria-label={`Remove ${t.name}`}>Remove</button></div>; })}</div></details>;
}
