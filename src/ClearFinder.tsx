import { useEffect, useMemo, useState } from 'react';
import { accountIdentity, byId, portrait } from './account';
import type { Account } from './account';
import publication from './data/clear-archive.json';
import { findRecordedPlans, parseClearArchive } from './planner/clear-archive';
import type { ClearFinderOptions, ClearMatch, RecordedPlan, WeaponAllocation } from './planner/clear-archive';
import { Icon } from './Icons';
import { TeamLineup } from './TeamLineup';
import './clear-finder.css';

const archive = parseClearArchive(publication);
const storageKey = 'account-doctor-clear-finder-v1';
const defaultOptions: ClearFinderOptions = { versionId: archive.versions[0].id, difficulty: 'Dire', filter: 'roster', objective: 'closest', exclude: [], locks: {}, skip: [], swaps: false, easyOnly: false };
function readOptions(): ClearFinderOptions {
  try {
    const v = JSON.parse(localStorage.getItem(storageKey) ?? '{}');
    return { ...defaultOptions, versionId: archive.versions.some(row => row.id === v.versionId) ? v.versionId : defaultOptions.versionId,
      difficulty: v.difficulty === 'Fearless' ? 'Fearless' : 'Dire', filter: v.filter === 'investment' ? 'investment' : 'roster', objective: ['closest', 'fastest', 'cost'].includes(v.objective) ? v.objective : 'closest',
      swaps: v.swaps === true, easyOnly: v.easyOnly === true,
      exclude: Array.isArray(v.exclude) ? v.exclude.filter((id: unknown) => typeof id === 'string' && Object.hasOwn(byId, id)).slice(0, 200) : [],
      skip: Array.isArray(v.skip) ? v.skip.filter((id: unknown) => typeof id === 'string' && id.length < 100).slice(0, 1000) : [],
      locks: v.locks && typeof v.locks === 'object' && !Array.isArray(v.locks) ? Object.fromEntries(Object.entries(v.locks).filter(([key, value]) => archive.bosses.some(b => b.id === key) && typeof value === 'string' && value.length < 100)) as Record<string, string> : {} };
  } catch { return { ...defaultOptions }; }
}
const day = (value: string) => new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

function RecordedTeam({ match, account, planWeapons, locked, onLock, onSkip, onEdit, near = false }: {
  match: ClearMatch; account: Account; planWeapons?: WeaponAllocation; locked?: boolean; onLock?: () => void; onSkip?: () => void; onEdit: (id: string) => void; near?: boolean;
}) {
  const r = match.record;
  const weaponGaps = planWeapons?.missing.filter(m => r.members.some(member => member.character === m.character)) ?? [];
  const matched = match.investmentMatch && !weaponGaps.length;
  const gapCount = match.gaps.length + weaponGaps.filter(m => !match.weapons.missing.some(own => own.character === m.character)).length;
  return <article className={`recorded-team${near ? ' near-miss' : ''}`} data-record-id={r.id} data-boss-id={r.bossId} aria-label={`Recorded ${byId[r.members[0].character].name} team`}>
    <div className="recorded-team-heading"><div><span className={`clear-match-label ${matched ? 'matched' : ''}`}><Icon name={matched ? 'check' : 'book'} size={14}/>{near ? `Missing ${match.missing.map(id => byId[id].name).join(', ')}` : matched ? 'Listed investment matched' : `${gapCount} investment checks`}</span><h3>{byId[r.members[0].character].name} team</h3></div><div className="recorded-run-stats"><span><small>Recorded time</small><strong>{r.seconds}s</strong></span><span><small>Source cost</small><strong>{r.cost}</strong></span><a className="button secondary small" href={r.proofUrl} target="_blank" rel="noreferrer">Watch clear <Icon name="external" size={14}/></a></div></div>
    <div className="recorded-members">{r.members.map(m => {
      const owned = account.owned.includes(m.character), build = account.details?.[m.character], c = account.constellations?.[m.character];
      const issues = match.gaps.filter(g => g.character === m.character).map(g => g.text);
      const assigned = (planWeapons ?? match.weapons).assigned.find(w => w.character === m.character);
      return <div key={m.character} className={`recorded-member${owned ? '' : ' unowned'}`} data-character={m.character}>
        <img src={portrait(m.character)} alt="" loading="lazy"/>
        <div><strong><span>C{m.constellation}</span> {byId[m.character].name}</strong><span className="listed-weapon">R{m.refinement} {m.weapon}</span>{m.level !== undefined && <span className="listed-level">Recorded Lv. {m.level}</span>}<span className="your-investment">{owned ? `Yours C${c ?? '?'} · ${build?.weapon?.key ? `${build.weapon.key} R${build.weapon.refinement ?? '?'}` : 'weapon unknown'}` : 'Not in your roster'}</span>{assigned?.swap && <span className="weapon-swap">Equip owned copy{assigned.copy.owner ? ` from ${byId[assigned.copy.owner]?.name ?? assigned.copy.owner}` : ' from inventory'}</span>}</div>
        {owned && <button className="member-edit" aria-label={`Edit ${byId[m.character].name} from recorded team`} title={issues.join(' ') || 'Review account build'} onClick={() => onEdit(m.character)}><Icon name={issues.length ? 'info' : 'edit'} size={16}/></button>}
      </div>;
    })}</div>
    {r.tags.length > 0 && <div className="clear-tags" aria-label="Run tags">{r.tags.map(t => <span key={t} className={match.execution.includes(t) || /theatre|over level|reduced/i.test(t) ? 'caution' : ''}>{t}</span>)}</div>}
    <div className="recorded-team-footer"><details><summary>Compare with my account</summary>
      {match.missing.length > 0 && <p>Missing: {match.missing.map(id => byId[id].name).join(', ')}. This is a recorded example to inspect.</p>}
      {match.gaps.length > 0 ? <ul>{match.gaps.map((gap, i) => <li key={i}>{gap.text}</li>)}</ul> : <p>Your recorded constellations, available weapon copies and any listed levels meet or exceed this listing.</p>}
      {weaponGaps.length > 0 && <p><strong>Across this plan:</strong> {weaponGaps.map(m => `${byId[m.character].name} needs an available R${m.refinement} ${m.weapon} copy`).join('; ')}.</p>}
      <p>Artifact stats, talents, buffs and rotation execution have not been matched. Listed investment and source moderation are the evidence available here.</p>
      {match.execution.length > 0 && <p>Execution tags to review: {match.execution.join(', ')}.</p>}
      <a href={r.sourceUrl} target="_blank" rel="noreferrer">Original Stygian.moe listing <Icon name="external" size={12}/></a>
      <small className="source-record-id">Record {r.id} · captured {day(archive.checkedAt)}</small>
    </details>{onLock && <button className={`text-button${locked ? ' locked' : ''}`} aria-pressed={locked} onClick={onLock}><Icon name={locked ? 'lock' : 'plus'} size={14}/>{locked ? 'Unlock team' : 'Keep this team'}</button>}{onSkip && <button className="text-button" onClick={onSkip}>Another team <Icon name="arrow" size={14}/></button>}</div>
  </article>;
}

function exportPlan(plan: RecordedPlan, options: ClearFinderOptions, account: Account, bounded: boolean) {
  const records = plan.matches.map(m => m.record), ids = new Set(records.map(r => r.snapshotId));
  const output = { format: 'AccountDoctorRecordedPlan', version: 1, exportedAt: new Date().toISOString(), account, options, source: archive.source, sourceCheckedAt: archive.checkedAt, sourceReviewAfter: archive.reviewAfter, archiveVersion: archive.versions.find(v => v.id === options.versionId), difficulty: options.difficulty, complete: records.length === 3, records, comparisons: plan.matches.map(({ mask: _mask, ...m }) => m), weaponAllocation: plan.weapons, snapshots: archive.snapshots.filter(s => ids.has(s.id)), searchBounded: bounded, timeMeaning: 'Observed times of separate source-listed runs; no prediction of this account’s clear time.', evidence: 'Public source listings; independent video/build verification and synthetic performance are separate.' };
  const url = URL.createObjectURL(new Blob([JSON.stringify(output, null, 2)], { type: 'application/json' }));
  const a = document.createElement('a'); a.href = url; a.download = 'account-doctor-recorded-plan.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function ClearFinder({ account, onRoster, onEdit, onGuides }: { account: Account; onRoster: () => void; onEdit: (id: string) => void; onGuides: () => void }) {
  const [options, setOptions] = useState(readOptions), [selected, setSelected] = useState(''), [exclude, setExclude] = useState(''), [notice, setNotice] = useState('');
  const [visible, setVisible] = useState<Record<string, number>>({});
  const result = useMemo(() => findRecordedPlans(archive, account, options), [account, options]);
  const plan = result.plans.find(p => p.key === selected) ?? result.plans[0];
  const version = archive.versions.find(v => v.id === options.versionId)!;
  const expired = Date.now() >= Date.parse(archive.reviewAfter);
  const matchedCount = result.perBoss.reduce((n, b) => n + b.matches.length, 0);
  const coverage = archive.coverage.filter(c => c.versionId === options.versionId && c.difficulty === options.difficulty);
  useEffect(() => { try { localStorage.setItem(storageKey, JSON.stringify(options)); } catch { setNotice('Finder settings could not be saved. Export your plan to keep it.'); } }, [options]);
  function patch(change: Partial<ClearFinderOptions>) { setOptions(o => ({ ...o, ...change })); setSelected(''); setVisible({}); }
  function switchArchive(change: Partial<ClearFinderOptions>) { patch({ ...change, locks: {}, skip: [] }); setNotice('Archive selection changed. Team locks and skipped runs were reset.'); }
  function lock(match: ClearMatch) { const locks = { ...options.locks }; if (locks[match.record.bossId] === match.record.id) delete locks[match.record.bossId]; else locks[match.record.bossId] = match.record.id; patch({ locks }); }
  function resetRequests() { patch({ locks: {}, skip: [], exclude: [] }); setNotice('Team locks, skipped runs and exclusions cleared.'); }
  function skipComposition(match: ClearMatch) {
    if (options.locks[match.record.bossId]) { setNotice('Unlock this team before skipping its composition.'); return; }
    const members = new Set(match.record.members.map(m => m.character));
    const ids = archive.records.filter(r => r.versionId === options.versionId && r.difficulty === options.difficulty && r.bossId === match.record.bossId && r.members.every(m => members.has(m.character))).map(r => r.id);
    patch({ skip: [...new Set([...options.skip, ...ids])] });
    setNotice('Skipped this composition for this boss. The entire recorded plan was reassigned.');
  }
  return <section className="clear-finder" aria-label="Recorded clear finder">
    <header className="clear-finder-intro"><div><span className="eyebrow">STYGIAN ONSLAUGHT · PLAYER RECORDS</span><h2>Find a clear with your characters.</h2><p>{archive.records.length.toLocaleString()} recorded teams from <a href={archive.source.url} target="_blank" rel="noreferrer">Stygian.moe</a>. Match your roster, compare investment and assign all three bosses together.</p></div><button className="button secondary small" onClick={onRoster}><Icon name="users" size={15}/>Edit roster</button></header>
    <div className="clear-finder-controls">
      <label>Archive version<select aria-label="Clear archive version" value={options.versionId} onChange={e => switchArchive({ versionId: e.target.value })}>{archive.versions.map(v => <option value={v.id} key={v.id}>Version {v.label}</option>)}</select></label>
      <fieldset className="clear-difficulty"><legend>Difficulty</legend>{(['Dire', 'Fearless'] as const).map(d => <button className="button small" key={d} aria-pressed={options.difficulty === d} onClick={() => switchArchive({ difficulty: d })}>{d}</button>)}</fieldset>
      <label>Match<select aria-label="Recorded clear match filter" value={options.filter} onChange={e => patch({ filter: e.target.value as ClearFinderOptions['filter'] })}><option value="roster">My characters</option><option value="investment">Listed investment matched</option></select></label>
      <label>Prioritize<select aria-label="Recorded clear priority" value={options.objective} onChange={e => patch({ objective: e.target.value as ClearFinderOptions['objective'] })}><option value="closest">Closest to my investment</option><option value="fastest">Fastest recorded runs</option><option value="cost">Lowest source cost</option></select></label>
    </div>
    <div className="clear-archive-status"><span><Icon name="book" size={14}/>Snapshot {day(archive.checkedAt)} · {version.label} archive · {coverage.reduce((n, c) => n + c.indexedCount, 0)} complete records</span><span>{new Set(account.owned.map(accountIdentity)).size} owned · {matchedCount} matching runs</span></div>
    <p className="clear-time-note">Recorded times belong to the submitted runs. Your builds and execution can change the result. Archive versions describe source listings; regional current-cycle verification is separate.</p>
    {expired && <p className="challenge-status" role="status">This source snapshot is due for refresh. Matches use listings captured on {day(archive.checkedAt)}; the source may have changed.</p>}
    {notice && <p role="status">{notice}</p>}
    <details className="clear-finder-preferences"><summary>Weapons, execution &amp; exclusions</summary><div className="clear-preference-fields"><label><input type="checkbox" checked={options.swaps} onChange={e => patch({ swaps: e.target.checked })}/>Allow recorded owned weapon swaps</label><label><input type="checkbox" checked={options.easyOnly} onChange={e => patch({ easyOnly: e.target.checked })}/>Exclude runs tagged for demanding inputs, tools or special buffs</label></div><p>Equipped weapons are used by default. When swaps are enabled, every recorded inventory copy can be assigned once across the plan.</p><div className="clear-exclusion-control"><label>Exclude a character<select aria-label="Exclude character from recorded clears" value={exclude} onChange={e => setExclude(e.target.value)}><option value="">Choose a character</option>{account.owned.filter(id => !options.exclude.some(x => accountIdentity(x) === accountIdentity(id))).map(id => <option key={id} value={id}>{byId[id].name}</option>)}</select></label><button className="button secondary small" disabled={!exclude} onClick={() => { patch({ exclude: [...options.exclude, exclude] }); setExclude(''); }}>Exclude</button></div>{options.exclude.length > 0 && <div className="clear-exclusion-chips">{options.exclude.map(id => <button key={id} onClick={() => patch({ exclude: options.exclude.filter(x => x !== id) })}>Excluded: {byId[id].name} <Icon name="close" size={12}/></button>)}</div>}</details>
    {(Object.keys(options.locks).length > 0 || options.skip.length > 0 || options.exclude.length > 0) && <div className="clear-active-requests"><span>{Object.keys(options.locks).length} team locks · {options.skip.length} skipped runs · {options.exclude.length} exclusions</span><button className="text-button" onClick={resetRequests}>Reset team requests</button></div>}
    {result.conflicts.length > 0 && <div className="challenge-status" role="alert"><strong>Resolve team requests</strong>{result.conflicts.map(s => <p key={s}>{s}</p>)}<button className="button secondary small" onClick={() => patch({ locks: {} })}>Unlock all teams</button></div>}
    {plan && <><div className="clear-plan-heading"><div><h2>{result.plans.indexOf(plan) ? `Alternative ${result.plans.indexOf(plan)}` : 'Recommended recorded plan'}</h2><p><strong>{plan.matches.length} / 3 bosses</strong> · no shared characters · {plan.investmentMatch ? 'listed investment matched' : 'review investment below'}</p></div><button className="button secondary small" onClick={() => exportPlan(plan, options, account, result.bounded)}><Icon name="download" size={14}/>Export recorded plan</button></div>
      {result.plans.length > 1 && <div className="recorded-plan-options" aria-label="Recorded account plans">{result.plans.map((p, i) => <button key={p.key} aria-pressed={plan.key === p.key} onClick={() => setSelected(p.key)}><strong>{i ? `Alternative ${i}` : 'Recommended'} <span>{p.matches.length}/3 bosses</span></strong><span className="recorded-plan-preview">{p.matches.map(m => <span key={m.record.bossId}><small>{archive.bosses.find(b => b.id === m.record.bossId)?.shortName}</small><TeamLineup members={m.record.members.map(x => x.character)} compact/></span>)}</span><small>{p.gaps} known differences · {p.unknowns} unknown checks</small></button>)}</div>}
      {plan.weapons.missing.length > 0 && <p className="clear-plan-equipment"><Icon name="info" size={15}/>{plan.weapons.missing.length} weapon requirements need a recorded available copy. Review each team’s investment or import a GOOD equipment scan.</p>}
    </>}
    {!plan && !result.conflicts.length && <div className="clear-empty"><Icon name="search" size={25}/><h2>{account.owned.length < 4 ? 'Add your characters to find recorded teams' : 'No recorded plan matches these filters'}</h2><p>{options.filter === 'investment' ? 'Unknown constellations and weapons cannot pass the investment filter. Review your character details, import a GOOD scan or compare roster matches.' : 'This archive has limited coverage for your account. Inspect the one-character-away examples or open guide planning.'}</p><div className="button-row">{options.filter === 'investment' && <button className="button primary small" onClick={() => patch({ filter: 'roster' })}>Show roster matches</button>}<button className="button secondary small" onClick={onRoster}>Review my characters</button><button className="text-button" onClick={onGuides}>Open guide plans <Icon name="arrow" size={14}/></button></div></div>}
    <div className="recorded-bosses">{result.perBoss.map((row, index) => {
      const chosen = plan?.matches.find(m => m.record.bossId === row.boss.id), alternatives = row.matches.filter(m => m.record.id !== chosen?.record.id), count = visible[row.boss.id] ?? 3;
      return <section className="recorded-boss" key={row.boss.id} aria-label={row.boss.name}><header className="recorded-boss-heading"><span className="team-number">{String(index + 1).padStart(2, '0')}</span><div><h2>{row.boss.name}</h2><p>{row.matches.length} matching records{row.near.length > 0 && ` · ${row.near.length} one character away`}</p></div></header>
        {chosen ? <RecordedTeam match={chosen} account={account} planWeapons={plan?.weapons} onEdit={onEdit} locked={options.locks[row.boss.id] === chosen.record.id} onLock={() => lock(chosen)} onSkip={() => skipComposition(chosen)}/>
          : <p className="clear-unassigned">{row.matches.length ? 'These recorded teams share characters or equipment with the selected plan. Keep a different team to reassign the account.' : 'No complete recorded team matches your filters for this boss.'} <button className="text-button" onClick={onGuides}>Explore guide plans</button></p>}
        {alternatives.length > 0 && <details className="recorded-alternatives"><summary>Show alternatives ({alternatives.length})</summary><p>Keeping a team reassigns the entire plan. Existing locks remain in place.</p>{alternatives.slice(0, count).map(m => <RecordedTeam key={m.record.id} match={m} account={account} onEdit={onEdit} locked={options.locks[row.boss.id] === m.record.id} onLock={() => lock(m)}/>)}{count < alternatives.length && <button className="button secondary small" onClick={() => setVisible(v => ({ ...v, [row.boss.id]: count + 6 }))}>Show more recorded teams</button>}</details>}
        {row.near.length > 0 && <details className="recorded-near"><summary>One character away ({row.near.length})</summary><p>These are source-listed examples with one missing character. Their investment can exceed yours; they do not establish a C0 pull priority.</p>{row.near.slice(0, 3).map(m => <RecordedTeam key={m.record.id} match={m} account={account} onEdit={onEdit} near/>)}</details>}
      </section>;
    })}</div>
    <details className="clear-source-details"><summary>Source coverage &amp; search limits</summary><p>Source: <a href={archive.source.url} target="_blank" rel="noreferrer">{archive.source.name}</a> · captured {day(archive.checkedAt)} · refresh review after {day(archive.reviewAfter)}. {archive.rejected.length} listings with fewer than four members were excluded. All displayed records retain their original four-member composition.</p><p>Source moderation is reported as “source-listed”. Independent video and complete build review remain unverified. Missing records mean unknown coverage. Successful-run archives do not establish success rates.</p><p>{result.bounded ? 'Search uses a bounded, composition-diverse candidate pool. The displayed shortlist may not be the global best allocation.' : 'All eligible candidate allocations were searched for this account.'} Plans prioritize boss coverage, then your selected objective. Recorded time and source cost describe submitted runs.</p><div className="clear-coverage-table"><table><thead><tr><th>Boss</th><th>Difficulty</th><th>Complete records</th><th>Source listings</th></tr></thead><tbody>{archive.coverage.map(c => <tr key={`${c.versionId}:${c.bossId}:${c.difficulty}`}><td>{archive.bosses.find(b => b.id === c.bossId)?.shortName}</td><td>{c.difficulty}</td><td>{c.indexedCount}</td><td><a href={c.url} target="_blank" rel="noreferrer">{c.sourceCount}</a></td></tr>)}</tbody></table></div><p><a href={archive.source.guideUrl} target="_blank" rel="noreferrer">Submission and reduced-cost criteria</a> · <a href={archive.source.termsUrl} target="_blank" rel="noreferrer">Source terms</a></p><details><summary>Exact source hashes ({archive.snapshots.length})</summary>{archive.snapshots.map(s => <p key={s.id}><a href={s.url} target="_blank" rel="noreferrer">Public source</a> · {s.kind} · <code>{s.sha256}</code></p>)}</details></details>
    <p className="clear-guide-handoff">Need a team beyond these recorded compositions? <button className="text-button" onClick={onGuides}>Open guide plans <Icon name="arrow" size={14}/></button></p>
  </section>;
}
