import { useEffect, useRef, useState } from 'react';
import { accountIdentity, byId, parseDetails, portrait } from './account';
import type { Account, CharacterDetails } from './account';
import { equipmentLocation } from './import-good';

export function CharacterEditor({ id, account, onSave, onClose, onTeams }: { id: string; account: Account; onSave: (details: CharacterDetails, constellation?: number) => void; onClose: () => void; onTeams: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [draft, setDraft] = useState<CharacterDetails>(() => structuredClone(account.details?.[id] ?? {}));
  const [constellation, setConstellation] = useState<number | undefined>(account.constellations?.[id]);
  const [error, setError] = useState('');
  useEffect(() => { dialog.current?.showModal(); }, []);
  const value = (text: string) => text === '' ? undefined : Number(text);
  const artifacts = (account.inventory?.artifacts ?? []).filter(a => accountIdentity(equipmentLocation(String(a.location)) ?? '') === accountIdentity(id));
  return <dialog ref={dialog} className="prescription-dialog character-dialog" aria-labelledby="character-title" onCancel={onClose} onClose={onClose} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
    <button className="dialog-close" aria-label="Close character details" onClick={onClose}>×</button>
    <div className="character-editor-heading"><img className="avatar" src={portrait(id)} alt=""/><div><span className="eyebrow">CHARACTER DETAILS</span><h2 id="character-title">{byId[id].name}</h2></div></div>
    <p className="quiet-note">Leave unknowns blank. Use talent levels before constellation bonuses.</p>
    <form onSubmit={e => { e.preventDefault(); try { onSave(parseDetails(draft), constellation); } catch (e) { setError(e instanceof Error ? e.message : 'Check the build details.'); } }}>
      <div className="build-fields">
        <label>Constellation<select aria-label="Constellation" value={constellation ?? ''} onChange={e => setConstellation(value(e.target.value))}><option value="">Unknown</option>{Array.from({ length: id === 'aloy' ? 1 : 7 }, (_, i) => <option value={i} key={i}>C{i}</option>)}</select></label>
        <label>Character level<input aria-label="Character level" type="number" min="1" max="100" placeholder="Unknown" value={draft.level ?? ''} onChange={e => setDraft({ ...draft, level: value(e.target.value) })}/></label>
        <label>Ascension<select aria-label="Ascension" value={draft.ascension ?? ''} onChange={e => setDraft({ ...draft, ascension: value(e.target.value) })}><option value="">Unknown</option>{Array.from({ length: 7 }, (_, i) => <option value={i} key={i}>{i}</option>)}</select></label>
      </div>
      <h3>Base talents</h3><div className="build-fields">{([['auto', 'Normal attack'], ['skill', 'Elemental skill'], ['burst', 'Elemental burst']] as const).map(([key, name]) => <label key={key}>{name}<input aria-label={name} type="number" min="1" max="10" placeholder="Unknown" value={draft.talents?.[key] ?? ''} onChange={e => setDraft({ ...draft, talents: { ...draft.talents, [key]: value(e.target.value) } })}/></label>)}</div>
      <h3>Equipped weapon</h3><label className="build-weapon">Weapon name / GOOD key<input aria-label="Weapon name" maxLength={120} placeholder="Unknown" value={draft.weapon?.key ?? ''} onChange={e => setDraft({ ...draft, weapon: { ...draft.weapon, key: e.target.value } })}/></label>
      <div className="build-fields"><label>Weapon level<input aria-label="Weapon level" type="number" min="1" max="90" placeholder="Unknown" value={draft.weapon?.level ?? ''} onChange={e => setDraft({ ...draft, weapon: { ...draft.weapon, level: value(e.target.value) } })}/></label><label>Weapon ascension<select aria-label="Weapon ascension" value={draft.weapon?.ascension ?? ''} onChange={e => setDraft({ ...draft, weapon: { ...draft.weapon, ascension: value(e.target.value) } })}><option value="">Unknown</option>{Array.from({ length: 7 }, (_, i) => <option value={i} key={i}>{i}</option>)}</select></label><label>Refinement<select aria-label="Refinement" value={draft.weapon?.refinement ?? ''} onChange={e => setDraft({ ...draft, weapon: { ...draft.weapon, refinement: value(e.target.value) } })}><option value="">Unknown</option>{[1, 2, 3, 4, 5].map(i => <option value={i} key={i}>R{i}</option>)}</select></label></div>
      <h3>Build checks</h3><div className="build-fields"><label>Energy Recharge (%)<input aria-label="Energy Recharge" type="number" step="0.1" min="100" max="1000" placeholder="Unknown" value={draft.energyRecharge ?? ''} onChange={e => setDraft({ ...draft, energyRecharge: value(e.target.value) })}/></label><label>Elemental Mastery<input aria-label="Elemental Mastery" type="number" step="0.1" min="0" max="5000" placeholder="Unknown" value={draft.elementalMastery ?? ''} onChange={e => setDraft({ ...draft, elementalMastery: value(e.target.value) })}/></label></div>
      <details className="evidence-details"><summary>How build details help</summary><p>Constellations affect role ratings. Other details help you check investment; they don’t produce a DPS estimate.</p></details>
      {!!artifacts.length && <details className="inventory-detail"><summary>{artifacts.length} equipped artifacts in your last scan</summary>{artifacts.map((a, i) => <p key={i}>{String(a.slotKey)} · {String(a.setKey)} · +{String(a.level)} · {String(a.mainStatKey)}</p>)}<p>Scan snapshot retained for export and artifact optimization.</p></details>}
      {error && <p role="alert">{error}</p>}
      <div className="button-row editor-actions"><button type="button" className="button secondary" onClick={onTeams}>Find teams</button><button type="submit" className="button primary">Save details</button></div>
    </form>
  </dialog>;
}
