/** Deterministic sheet math, not a combat simulator. Percentages at this boundary are 0–100. */
export const damageSource = 'https://library.keqingmains.com/combat-mechanics/damage/damage-formula';
export type Reaction = 'none' | 'vaporize' | 'melt' | 'hyperbloom' | 'burgeon' | 'bloom' | 'swirl';
export interface DamageRow {
  id: string; character: string; label: string; reaction: Reaction;
  hits?: number; level?: number; baseDamage?: number; bonus?: number; critRate?: number; critDamage?: number;
  em?: number; reactionBonus?: number; resistance?: number; shred?: number; defenseReduction?: number; defenseIgnore?: number;
  amplification?: number;
}
export interface RotationSheet { version: 1; seconds?: number; enemyLevel?: number; rows: DamageRow[]; noDamage: string[]; target?: { name: string; hp?: number; budgetSeconds?: number }; }
export interface RowResult { damage?: number; missing: string[]; }
export function resistanceMultiplier(resistance: number) {
  return resistance < 0 ? 1 - resistance / 2 : resistance < .75 ? 1 - resistance : 1 / (4 * resistance + 1);
}
const transformative: Partial<Record<Reaction, number>> = { hyperbloom: 3, burgeon: 3, bloom: 2, swirl: .6 };
// Only this documented level is covered; do not interpolate a reaction level curve.
const level90Reaction = 1446.853458;
export function calculateHit(row: DamageRow, enemyLevel?: number): RowResult {
  const missing: string[] = [];
  function value(key: keyof DamageRow, min: number, max: number) {
    const v = row[key];
    if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max) { missing.push(String(key)); return 0; }
    return v;
  }
  const hits = value('hits', 0, 10000), level = value('level', 1, 100);
  const res = (value('resistance', -100, 1000) - value('shred', 0, 200)) / 100;
  let damage: number;
  if (transformative[row.reaction]) {
    if (level !== 90) missing.push('transformative reactions currently require level 90');
    const em = value('em', 0, 5000), bonus = value('reactionBonus', 0, 1000) / 100;
    damage = level90Reaction * transformative[row.reaction]! * (1 + 16 * em / (em + 2000) + bonus);
  } else {
    if (enemyLevel === undefined || !Number.isFinite(enemyLevel) || enemyLevel < 1 || enemyLevel > 200) missing.push('enemy level');
    const base = value('baseDamage', 0, 1e8), bonus = value('bonus', -100, 2000) / 100;
    const crit = 1 + value('critRate', 0, 100) / 100 * value('critDamage', 0, 1000) / 100;
    const defense = (level + 100) / ((level + 100) + ((enemyLevel ?? 100) + 100) * (1 - value('defenseReduction', 0, 100) / 100) * (1 - value('defenseIgnore', 0, 100) / 100));
    let amp = 1;
    if (row.reaction === 'vaporize' || row.reaction === 'melt') {
      const em = value('em', 0, 5000);
      if (row.amplification !== 1.5 && row.amplification !== 2) missing.push('reaction direction');
      amp = (row.amplification ?? 1.5) * (1 + 2.78 * em / (em + 1400) + value('reactionBonus', 0, 1000) / 100);
    } else if (row.reaction !== 'none') missing.push('unsupported reaction');
    damage = base * (1 + bonus) * crit * defense * amp;
  }
  return missing.length ? { missing } : { damage: damage * resistanceMultiplier(res) * hits, missing };
}
export function calculateRotation(sheet: RotationSheet, members: string[]) {
  const rows = sheet.rows.map(row => ({ ...calculateHit(row, sheet.enemyLevel), id: row.id, character: row.character }));
  const missing = rows.flatMap((r, i) => r.missing.map(m => `${sheet.rows[i].label || 'Action'}: ${m}`));
  if (!Number.isFinite(sheet.seconds) || !sheet.seconds || sheet.seconds <= 0 || sheet.seconds > 600) missing.push('Rotation duration must be between 0 and 600 seconds.');
  for (const id of members) if (!sheet.rows.some(r => r.character === id) && !sheet.noDamage.includes(id)) missing.push(`${id}: add damage actions or explicitly mark no damage.`);
  if (sheet.rows.some(r => !members.includes(r.character)) || sheet.noDamage.some(id => !members.includes(id))) missing.push('The sheet contains a character outside this team.');
  if (sheet.rows.some(r => sheet.noDamage.includes(r.character))) missing.push('A character cannot have damage actions and be marked no damage.');
  if (!sheet.rows.length) missing.push('Add at least one damage action.');
  const damage = rows.reduce((sum, r) => sum + (r.damage ?? 0), 0);
  return { rows, missing, damage: missing.length ? undefined : damage, dps: missing.length ? undefined : damage / sheet.seconds! };
}
export function parseSheet(raw: unknown): RotationSheet {
  if (!raw || typeof raw !== 'object') throw new Error('Invalid rotation sheet.');
  const s = raw as RotationSheet;
  if (s.version !== 1 || !Array.isArray(s.rows) || s.rows.length > 100 || !Array.isArray(s.noDamage) || s.noDamage.some(id => typeof id !== 'string')) throw new Error('Invalid rotation sheet.');
  if (s.target !== undefined && (!s.target || typeof s.target.name !== 'string' || s.target.name.length > 200 || (s.target.hp !== undefined && (!Number.isFinite(s.target.hp) || s.target.hp <= 0)) || (s.target.budgetSeconds !== undefined && (!Number.isFinite(s.target.budgetSeconds) || s.target.budgetSeconds <= 0)))) throw new Error('Invalid calculation target.');
  for (const row of s.rows) if (!row || typeof row !== 'object' || typeof row.id !== 'string' || typeof row.character !== 'string' || typeof row.label !== 'string' || !['none', 'vaporize', 'melt', 'hyperbloom', 'burgeon', 'bloom', 'swirl'].includes(row.reaction)) throw new Error('Invalid damage action.');
  return s;
}
