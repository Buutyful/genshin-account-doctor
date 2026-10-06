import { useEffect, useState } from 'react';
import { byId } from './account';
import type { Account } from './account';
import type { Candidate } from './planner/types';
import { calculateRotation, damageSource, parseSheet } from './planner/damage';
import type { DamageRow, Reaction, RotationSheet } from './planner/damage';
import type { Encounter } from './planner/encounters';

export const sheetKey = (id: string) => `account-doctor-rotation-v1:${id}`;
export function readSheet(id: string): RotationSheet | undefined {
  try { const raw = localStorage.getItem(sheetKey(id)); return raw ? parseSheet(JSON.parse(raw)) : undefined; } catch { return undefined; }
}
export function RotationCalculator({ team, account, encounter }: { team: Candidate; account: Account; encounter?: Encounter }) {
  const [sheet, setSheet] = useState<RotationSheet>(() => readSheet(team.id) ?? { version: 1, seconds: 20, enemyLevel: 100, rows: [], noDamage: [] });
  const [storageError, setStorageError] = useState('');
  const [selected, setSelected] = useState(team.members[0]);
  const result = calculateRotation(sheet, team.members);
  useEffect(() => { try { localStorage.setItem(sheetKey(team.id), JSON.stringify(sheet)); setStorageError(''); } catch { setStorageError('Could not save this sheet. Download it to keep your work.'); } }, [sheet, team.id]);
  function edit(id: string, patch: Partial<DamageRow>) { setSheet(s => ({ ...s, rows: s.rows.map(r => r.id === id ? { ...r, ...patch } : r) })); }
  function add() {
    const details = account.details?.[selected];
    setSheet(s => ({ ...s, noDamage: s.noDamage.filter(id => id !== selected), rows: [...s.rows, { id: crypto.randomUUID(), character: selected, label: `${byId[selected].name} action`, reaction: 'none', hits: 1, level: details?.level, em: details?.elementalMastery, bonus: 0, critRate: 0, critDamage: 0, resistance: 10, shred: 0, defenseReduction: 0, defenseIgnore: 0, reactionBonus: 0, amplification: 1.5 }] }));
  }
  function field(row: DamageRow, key: keyof DamageRow, label: string, min: number, max: number) {
    return <label className="field-label" key={key}>{label}<input aria-label={`${row.label} ${label}`} type="number" step="any" min={min} max={max} value={typeof row[key] === 'number' ? row[key] : ''} placeholder="Unknown" onChange={e => edit(row.id, { [key]: e.target.value === '' ? undefined : e.target.valueAsNumber })}/></label>;
  }
  function exportSheet() {
    const url = URL.createObjectURL(new Blob([JSON.stringify({ team: team.members, assumptions: 'Manual rotation; no automatic buff, aura, energy or artifact evaluation.', formulaSource: damageSource, sheet, result }, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = 'account-doctor-rotation.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <details className="rotation-calculator"><summary>Rotation damage calculator</summary>
    <p>Calculate a rotation from explicit actions. Base damage is the talent multiplier × its scaling stat, plus flat damage, before bonus, crit, defense and resistance. Include buffs in each action’s inputs. Split reacting and non-reacting hits into separate rows.</p>
    <p className="quiet-note">Defaults: 20 seconds, level-100 target, 10% resistance and zero bonuses. Edit these assumptions. Energy, cooldowns, aura, hit timing, shields and enemy downtime are not simulated. GOOD inventory does not provide derived combat stats.</p>
    {encounter && <label className="field-label">Use challenge target<select aria-label="Use challenge target" value="" onChange={e => {
      const stage = encounter.stages[Number(e.target.value)];
      if (!stage) return;
      const hp = stage.enemies.every(enemy => enemy.hp !== undefined) ? stage.enemies.reduce((sum, enemy) => sum + enemy.hp!, 0) : undefined;
      setSheet(s => ({ ...s, enemyLevel: stage.level, target: { name: `${encounter.name} · ${stage.name}`, hp } }));
    }}><option value="" disabled>Load an assigned chamber / boss</option>{encounter.stages.map((stage, i) => <option value={i} key={i}>{encounter.name} · {stage.name}</option>)}</select></label>}
    {sheet.target && <div className="calculation-result"><strong>{sheet.target.name}</strong><p>{sheet.target.hp ? `${Math.round(sheet.target.hp).toLocaleString()} total enemy HP` : 'Enemy HP unknown'} · saved target assumptions. Enemy resistance still needs checking.</p><label className="field-label">Damage time budget (seconds)<input aria-label="Damage time budget" type="number" min="0.1" max="3600" step="any" value={sheet.target.budgetSeconds ?? ''} onChange={e => setSheet(s => ({ ...s, target: { ...s.target!, budgetSeconds: e.target.valueAsNumber > 0 && Number.isFinite(e.target.valueAsNumber) ? e.target.valueAsNumber : undefined } }))}/></label>{sheet.target.hp && sheet.target.budgetSeconds && <p>{Math.round(sheet.target.hp / sheet.target.budgetSeconds).toLocaleString()} damage/sec required for this HP budget. Excludes shields, wave transitions and invulnerability; this is not a clear prediction.</p>}<button className="text-button" onClick={() => setSheet(s => ({ ...s, target: undefined }))}>Clear saved target</button></div>}
    <div className="calculation-fields"><label className="field-label">Rotation seconds<input aria-label="Rotation seconds" type="number" min="0.1" max="600" step="any" value={sheet.seconds ?? ''} onChange={e => setSheet(s => ({ ...s, seconds: e.target.value === '' ? undefined : e.target.valueAsNumber }))}/></label><label className="field-label">Target level<input aria-label="Target level" type="number" min="1" max="200" value={sheet.enemyLevel ?? ''} onChange={e => setSheet(s => ({ ...s, enemyLevel: e.target.value === '' ? undefined : e.target.valueAsNumber }))}/></label></div>
    <div className="calculator-actions"><select aria-label="Damage character" value={selected} onChange={e => setSelected(e.target.value)}>{team.members.map(id => <option key={id} value={id}>{byId[id].name}</option>)}</select><button className="button secondary small" onClick={add} disabled={sheet.rows.length >= 100}>Add damage action</button></div>
    {sheet.rows.map((row, index) => <fieldset className="damage-row" key={row.id}><legend>{byId[row.character]?.name} · action {index + 1}</legend><label className="field-label">Action name<input value={row.label} maxLength={100} onChange={e => edit(row.id, { label: e.target.value })}/></label><label className="field-label">Reaction<select aria-label={`Action ${index + 1} reaction`} value={row.reaction} onChange={e => edit(row.id, { reaction: e.target.value as Reaction })}>{['none', 'vaporize', 'melt', 'hyperbloom', 'burgeon', 'bloom', 'swirl'].map(r => <option key={r} value={r}>{r === 'none' ? 'Direct damage' : r}</option>)}</select></label>
      <div className="calculation-fields">{field(row, 'hits', 'Hit count', 0, 10000)}{field(row, 'level', 'Character level', 1, 100)}{field(row, 'resistance', 'Target resistance %', -100, 1000)}{field(row, 'shred', 'Resistance shred %', 0, 200)}
        {['none', 'vaporize', 'melt'].includes(row.reaction) && <>{field(row, 'baseDamage', 'Base damage per hit', 0, 1e8)}{field(row, 'bonus', 'Damage bonus %', -100, 2000)}{field(row, 'critRate', 'Crit rate %', 0, 100)}{field(row, 'critDamage', 'Crit damage %', 0, 1000)}{field(row, 'defenseReduction', 'Defense reduction %', 0, 100)}{field(row, 'defenseIgnore', 'Defense ignore %', 0, 100)}</>}
        {row.reaction !== 'none' && <>{field(row, 'em', 'Elemental Mastery', 0, 5000)}{field(row, 'reactionBonus', 'Reaction bonus %', 0, 1000)}</>}
        {['vaporize', 'melt'].includes(row.reaction) && <label className="field-label">Reaction direction<select value={row.amplification} onChange={e => edit(row.id, { amplification: Number(e.target.value) })}><option value="1.5">1.5× · Pyro Vaporize / Cryo Melt</option><option value="2">2× · Hydro Vaporize / Pyro Melt</option></select></label>}
      </div>{['hyperbloom', 'burgeon', 'bloom', 'swirl'].includes(row.reaction) && <p className="quiet-note">Level 90 only. No crit, damage bonus or defense multiplier. Count actual hits on one target; reaction rate limits are your responsibility.</p>}
      <div className="calculator-actions"><strong>{result.rows[index].damage === undefined ? 'Inputs incomplete' : `${Math.round(result.rows[index].damage!).toLocaleString()} damage`}</strong><button className="text-button" onClick={() => setSheet(s => ({ ...s, rows: s.rows.filter(r => r.id !== row.id) }))}>Remove action {index + 1}</button></div></fieldset>)}
    <div className="no-damage-options">{team.members.filter(id => !sheet.rows.some(r => r.character === id)).map(id => <label key={id}><input type="checkbox" checked={sheet.noDamage.includes(id)} onChange={e => setSheet(s => ({ ...s, noDamage: e.target.checked ? [...s.noDamage, id] : s.noDamage.filter(x => x !== id) }))}/>Treat {byId[id].name} as dealing no damage in this sheet</label>)}</div>
    <div className="calculation-result" aria-live="polite">{result.dps === undefined ? <><strong>Team DPS needs complete inputs</strong><ul>{result.missing.slice(0, 8).map((m, i) => <li key={i}>{m}</li>)}</ul></> : <><strong>{Math.round(result.dps).toLocaleString()} estimated DPS</strong><p>{Math.round(result.damage!).toLocaleString()} expected damage / {sheet.seconds}s · manual rotation estimate, not validated account performance</p></>}</div>
    {storageError && <p role="alert">{storageError}</p>}<div className="calculator-actions"><button className="button secondary small" onClick={exportSheet}>Download calculation</button><a href={damageSource} target="_blank" rel="noreferrer">Formula reference ↗</a></div>
  </details>;
}
