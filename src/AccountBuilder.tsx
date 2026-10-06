import { useEffect, useMemo, useRef, useState } from 'react';
import { accountIdentity, byId } from './account';
import type { Account, Mode } from './account';
import { assessConfiguration, configurationCandidate, equipmentFor, generateConfigurations, profiles } from './planner/configurations';
import { effectivePreferences, explainPlanChange, feedbackLabel, parsePreferences, planConfigurations, preferenceApplies } from './planner/feedback';
import type { ConfigurationAssignment, FeedbackAction, Preference, Scope } from './planner/feedback';
import type { EncounterPack, Region } from './planner/encounters';
import { encounterStatus } from './planner/encounters';
import { createSplitManifest, matchClear, observedSources, parseObservedPublication, publishedClears, reconcileClears } from './planner/observed';
import type { ObservedPublication } from './planner/observed';
import { parseWorkspace, readSavedSheets, restoreWorkspaceStorage } from './planner/workspace';
import type { BuilderWorkspace } from './planner/workspace';
import { customCandidate } from './CustomTeamBuilder';
import { ChallengePlanner } from './ChallengePlanner';
import { planMetrics, shortlistPlans } from './planner/account-plans';
import { buildTasks } from './planner/builds';
import { PullPlanner } from './PullPlanner';
import { Icon } from './Icons';
import { TeamLineup } from './TeamLineup';
import { TeamViewer } from './TeamViewer';
import type { useChallenges } from './ChallengePlanner';

function readPreferences(): Preference[] {
  try { return parsePreferences([...JSON.parse(localStorage.getItem('account-doctor-builder-preferences-v1') ?? '[]'), ...JSON.parse(sessionStorage.getItem('account-doctor-builder-session-v1') ?? '[]')]); } catch { return []; }
}
function readObserved(): ObservedPublication[] {
  try { const p: unknown = JSON.parse(localStorage.getItem('account-doctor-observed-v1') ?? '[]'); return Array.isArray(p) ? p.slice(0, 10).map(v => parseObservedPublication(v)) : []; } catch { return []; }
}
function readOptions(): BuilderWorkspace['builder'] {
  try { const saved = localStorage.getItem('account-doctor-builder-options-v3'); const v = JSON.parse(saved ?? localStorage.getItem('account-doctor-builder-options-v2') ?? '{}'); return { allowRebuild: v.allowRebuild === true, activity: saved && ['general', 'practice', 'current'].includes(v.activity) ? v.activity : 'current' }; } catch { return { allowRebuild: false, activity: 'current' }; }
}
function download(value: unknown, name: string) {
  const blob = new Blob([JSON.stringify(value, (_key, v) => typeof v === 'bigint' ? v.toString() : v, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function ConfigurationCard({ row, index, account, onFeedback, observed, pack, replaceable }: { row: ConfigurationAssignment; index: number; account: Account; onFeedback: (action: FeedbackAction) => void; observed: ObservedPublication[]; pack?: EncounterPack; replaceable: string[] }) {
  const c = row.config;
  const caution = c.seed?.caution;
  const tasks = buildTasks(account, c);
  const opponents = row.encounter ? [...new Set(row.encounter.stages.flatMap(stage => stage.enemies.map(enemy => enemy.name)))] : [];
  const teamName = c.seed?.reviewed || c.origin === 'custom' ? c.seed?.name ?? `${byId[c.driver].name} team` : `${byId[c.driver].name} team`;
  const [core, setCore] = useState(c.core);
  const [replacement, setReplacement] = useState(replaceable[0] ?? c.members[3]);
  const clearMatches = reconcileClears([...publishedClears, ...observed.flatMap(p => p.records)]).map(({ record }) => ({ record, match: matchClear(record, c, account, pack) })).filter(m => m.match.discovery && m.record.members.every(m => c.members.includes(m.character)));
  return <article className="configuration-card" aria-label={`Configuration ${index + 1}`} data-configuration-id={c.id} data-composition-id={c.compositionId}>
    <header className="configuration-heading"><div className="team-assignment"><span className="team-number">{String(index + 1).padStart(2, '0')}</span><div><span className="eyebrow">{row.encounter?.name ?? `TEAM ${index + 1}`}</span>{row.encounter && <p className="team-opponent" title={opponents.join(' · ')}>{row.encounter.stages.length === 1 ? opponents.map(name => name.split(':')[0]).join(' · ') : `${row.encounter.stages.length} chambers · same team throughout`}</p>}</div></div><h3>{teamName}</h3><span className="tag">{c.seed?.reviewed ? 'Guide team' : c.origin === 'custom' ? 'Custom team' : 'Role-based team'}</span></header>
    <div className="configuration-roster">
    <TeamViewer configuration={c} account={account}/>
    {tasks.some(t => t.status === 'upgrade') && <p className="build-preview"><strong>Build next</strong> {tasks.filter(t => t.status === 'upgrade').slice(0, 2).map(t => `${byId[t.character].name}: ${t.text}`).join('; ')}.</p>}
    {c.rebuilds.length > 0 && <p className="challenge-status">Planned rebuild: {c.rebuilds.map(id => byId[id].name).join(', ')} · level 90 + EM gear.</p>}
    </div>
    <div className="configuration-details">
    <details className="team-build-details"><summary>Build &amp; rotation</summary>
      {c.seed?.rotationOutline && <p>{c.seed.rotationOutline}</p>}
      <p><strong>{c.rotation.seconds}s proposed loop.</strong> {c.rotation.assumption}</p>
      <ol>{c.rotation.steps.map(s => <li key={s.character}><strong>{byId[s.character].name} · {s.seconds}s assumed window:</strong> {s.action}</li>)}</ol>
      {caution && <p><strong>Required setup:</strong> {caution}</p>}
      <h4>Build requirements</h4><ul className="build-task-list">{tasks.map((t, i) => <li key={i}><strong>{byId[t.character].name}:</strong> {t.text}</li>)}</ul>
      <details className="team-evidence"><summary>Sources &amp; checks</summary>
      {c.seed && <p><strong>Original team example:</strong> {c.seed.name}</p>}
      {!c.recipeMembership && c.origin === 'generated' && <p>Composition absent from the guide recipe set; proposed from covered role interactions.</p>}
      {c.seed && <p>{c.seed.why}</p>}
      <p>{c.selection.reasons.join(' ')}</p>
      <p><a href={c.selection.ratings.source} target="_blank" rel="noreferrer">Conditional rating source ↗</a> · checked {c.selection.ratings.checkedAt} · {c.selection.ratings.fresh ? `review expires ${c.selection.ratings.expiresAt}` : 'expired; not used for ordering'}.</p><ul>{c.selection.ratings.contributions.flatMap(r => r.conditions).map(s => <li key={s}>{s}</li>)}</ul>
      <ul className="mechanical-checks">{c.checks.map(ch => <li key={ch.id} data-state={ch.state}><strong>{ch.state}</strong> · {ch.text} {ch.source && <a href={ch.source} target="_blank" rel="noreferrer">Guide ↗</a>}</li>)}</ul>
      <h4>Equipped observations</h4>{c.members.map(id => { const e = equipmentFor(account, id); return <p key={id}><strong>{byId[id].name}:</strong> {e.observed?.weapon?.key ?? 'weapon unknown'}; {e.rows.length} identified equipment rows. {Object.entries(e.artifactSets).map(([set, n]) => `${set} ×${n}`).join(', ') || 'Artifact sets unknown'}. Recorded substat totals only: EM {e.substats.eleMas ?? '?'}, ER {e.substats.enerRech_ ?? '?'}%. These are partial equipment contributions, not total stats or active buffs.</p>; })}
      <p>Current equipped items stay assigned to their owner. Equipment swaps are unavailable until a mode policy and compatible loadout model are verified.</p>
      <details><summary>Configuration identity &amp; source coverage</summary><code className="configuration-id">{c.id}</code><p>Kit review: 30 September 2026. Guide-version coverage may predate the live patch. Complete energy, application and animation validation remains outside this pilot.</p>{c.sources.map(url => <p key={url}><a href={url} target="_blank" rel="noreferrer">{url}</a></p>)}</details>
      <details><summary>Observed clear evidence ({clearMatches.length})</summary>{clearMatches.length ? clearMatches.map(({ record, match }) => <div key={`${record.sourceId}:${record.sourceRecordId}`}><a href={record.sourceUrl} target="_blank" rel="noreferrer">{record.sourceId} · reviewed run</a><p>{record.clearSeconds ?? '?'} seconds · {record.timeConvention} · {match.matchedComparison ? 'Matched recorded conditions; not a predicted clear.' : 'Contextual reference only.'}</p><ul>{[...match.reasons, ...match.differences].map((s, i) => <li key={i}>{s}</li>)}</ul><a href={record.proof.url} target="_blank" rel="noreferrer">Original proof ↗</a></div>) : <p>No qualified observed result supports this proposal. Guide and mechanical checks remain separate from player clears.</p>}</details>
      </details>
    </details>
    {(row.encounter || row.fit.matched.length > 0) && <details className="team-matchup"><summary>Matchup fit</summary>{row.encounter && <><p>{row.encounter.stages.map(s => s.name).join(' → ')} · same team throughout.</p><p>{opponents.join(' · ')}</p></>}{row.fit.matched.length > 0 && <p className="matchup-fit">{[...new Set(row.fit.matched.map(s => s.replace(/^12-\d: /, '')))].join(' · ')}</p>}<ul>{[...row.fit.unresolved, ...row.fit.contradicted].map((s, i) => <li key={i}>{s}</li>)}</ul></details>}
    <details className="configuration-feedback"><summary>Change this team</summary><div className="configuration-actions"><button className="button secondary small" onClick={() => onFeedback({ kind: 'skip', compositionId: c.compositionId })}>Another team</button><button className="text-button" onClick={() => onFeedback({ kind: 'lock', configurationId: c.id })}>Keep this team</button></div><fieldset><legend>Retain a character or core</legend>{c.members.map(id => <label key={id}><input type="checkbox" checked={core.includes(id)} onChange={e => setCore(old => e.target.checked ? [...old, id] : old.filter(x => x !== id))}/>{byId[id].name}</label>)}</fieldset>
      <div className="button-row"><button className="button secondary small" disabled={!core.length} onClick={() => onFeedback({ kind: 'keep', members: core })}>Keep selected core</button><button className="button secondary small" disabled={!core.length || core.length === 4} onClick={() => onFeedback({ kind: 'variant', core, compositionId: c.compositionId, encounterId: row.encounter?.id })}>Same-core variant</button></div>
      <label className="field-label">Replace teammate<select aria-label={`Replace teammate in configuration ${index + 1}`} value={replacement} onChange={e => setReplacement(e.target.value)}>{c.members.map(id => <option key={id} value={id} disabled={!replaceable.includes(id)}>{byId[id].name}{replaceable.includes(id) ? '' : ' · no covered replacement'}</option>)}</select></label>
      <button className="button secondary small" disabled={!replaceable.includes(replacement)} onClick={() => onFeedback({ kind: 'replace', members: c.members.filter(id => id !== replacement), character: replacement, compositionId: c.compositionId, encounterId: row.encounter?.id })}>Replace selected teammate</button>
      {!replaceable.length && <p className="quiet-note">No replacement retains the other three under this plan’s coverage and locks. Unlock this team or select a smaller core for a variant.</p>}
      <div className="button-row"><button className="button secondary small" onClick={() => onFeedback({ kind: 'alternative', core: c.core, playstyle: c.playstyle, compositionId: c.compositionId, encounterId: row.encounter?.id })}>Different playstyle</button><button className="button secondary small" onClick={() => onFeedback({ kind: 'lock', configurationId: c.id })}>Lock configuration</button><button className="text-button" onClick={() => onFeedback({ kind: 'skip-configuration', configurationId: c.id })}>Skip this configuration</button><button className="text-button" onClick={() => onFeedback({ kind: 'skip', compositionId: c.compositionId })}>Skip this composition</button></div>
      <p className="quiet-note">Skipping suppresses this composition at your selected scope. Its characters can still join other teams.</p>
    </details>
    </div>
  </article>;
}

export function AccountBuilder({ account, pack, region, challenges, customTeams, locks, onRestore, onModeChange, decisionView = 'teams' }: { account: Account; pack?: EncounterPack; region: Region; challenges: ReturnType<typeof useChallenges>; customTeams: string[][]; locks: Partial<Record<Mode, string[]>>; onRestore: (workspace: BuilderWorkspace) => void; onModeChange: (mode: Mode) => void; decisionView?: 'teams' | 'pulls' }) {
  const [preferences, setPreferences] = useState(readPreferences);
  const [options, setOptions] = useState(readOptions);
  const [observed, setObserved] = useState(readObserved);
  const [scope, setScope] = useState<Scope>('session');
  const [exclude, setExclude] = useState('');
  const [favorite, setFavorite] = useState('');
  const [browse, setBrowse] = useState(false);
  const [notice, setNotice] = useState('');
  const [previous, setPrevious] = useState<ConfigurationAssignment[]>([]);
  const [restore, setRestore] = useState<BuilderWorkspace>();
  const [observedPreview, setObservedPreview] = useState<ObservedPublication>();
  const [selectedPlan, setSelectedPlan] = useState('recommended');
  const [setupOpen, setSetupOpen] = useState(() => window.matchMedia('(min-width: 1100px)').matches);
  useEffect(() => {
    const media = window.matchMedia('(min-width: 1100px)');
    const update = () => setSetupOpen(media.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  const restoreInput = useRef<HTMLInputElement>(null), observedInput = useRef<HTMLInputElement>(null);
  const context = useMemo(() => ({ mode: account.mode, region, cycleId: options.activity === 'current' ? pack?.cycleId : undefined }), [account.mode, region, pack?.cycleId, options.activity]);
  const active = effectivePreferences(preferences, context);
  const comfort = active.map(p => p.action).filter(a => a.kind === 'comfort').at(-1) ?? { kind: 'comfort' as const, easier: false, sustain: false, maxRebuilds: 0 };
  const generation = useMemo(() => {
    const seeds = customTeams.map(m => customCandidate(m, account)).filter(t => !t.missing.length);
    // Qualified archives nominate whole configurations, never independent pairwise substitutions.
    for (const { record } of reconcileClears([...publishedClears, ...observed.flatMap(p => p.records)])) {
      const members = record.members.map(m => m.character);
      if (!members.every(id => account.owned.includes(id))) continue;
      const config = assessConfiguration(account, members, members[0]);
      if (matchClear(record, config, account, pack).discovery) { const seed = customCandidate(members, account); seed.sources = [record.sourceUrl, record.proof.url]; seed.why = 'Reviewed observed clear seed. Account and encounter differences must still be checked.'; seeds.push(seed); }
    }
    return generateConfigurations(account, { allowRebuild: options.allowRebuild, extraSeeds: seeds });
  }, [account, customTeams, options.allowRebuild, observed, pack]);
  const activity = account.mode === 'general' || account.owned.length < 4 ? 'general' : options.activity;
  const currentAvailable = Boolean(pack && encounterStatus(pack) === 'current');
  const activePack = activity === 'current' && currentAvailable ? pack : undefined;
  const practiceTargets = activity === 'practice' ? challenges.practiceTargets : undefined;
  const planningInput = useMemo(() => ({ context, preferences, pack: activePack, locks: locks[account.mode] ?? [], targets: practiceTargets }), [context, preferences, activePack, locks, account.mode, practiceTargets]);
  const recommendation = useMemo(() => planConfigurations(generation.configurations, context, preferences, activePack, 48, locks[account.mode] ?? [], Date.now(), practiceTargets), [generation, context, preferences, activePack, locks, account.mode, practiceTargets]);
  const planOptions = useMemo(() => recommendation ? shortlistPlans(generation.configurations, account, planningInput, recommendation) : [], [generation, account, planningInput, recommendation]);
  const result = planOptions.find(o => o.id === selectedPlan)?.plan ?? recommendation;
  const pullOptions = useMemo(() => ({ allowRebuild: options.allowRebuild, extraSeeds: generation.configurations.flatMap(c => c.seed && (c.origin === 'custom' || c.origin === 'observed') ? [c.seed] : []) }), [options.allowRebuild, generation]);
  useEffect(() => { setSelectedPlan('recommended'); }, [planOptions]);
  const alternatives = generation.configurations.filter(c => !result?.assignments.some(a => a.config.compositionId === c.compositionId) && !active.some(p => p.action.kind === 'exclude' && c.members.includes(p.action.character))).sort((a, b) => configurationCandidate(b).score - configurationCandidate(a).score).filter((c, i, all) => all.findIndex(n => n.compositionId === c.compositionId) === i).slice(0, 6);
  useEffect(() => { try {
    localStorage.setItem('account-doctor-builder-preferences-v1', JSON.stringify(preferences.filter(p => p.scope !== 'session')));
    sessionStorage.setItem('account-doctor-builder-session-v1', JSON.stringify(preferences.filter(p => p.scope === 'session')));
    localStorage.setItem('account-doctor-builder-options-v1', JSON.stringify(options));
    localStorage.setItem('account-doctor-builder-options-v2', JSON.stringify(options));
    localStorage.setItem('account-doctor-builder-options-v3', JSON.stringify(options));
    localStorage.setItem('account-doctor-observed-v1', JSON.stringify(observed));
  } catch { setNotice('Builder changes could not be saved. Export a workspace backup.'); } }, [preferences, options, observed]);
  function feedback(action: FeedbackAction) {
    if (scope === 'cycle' && !context.cycleId) { setNotice('Cycle scope needs a verified cycle. Choose session or account scope.'); return; }
    setPrevious(result?.assignments ?? []);
    if (active.some(p => JSON.stringify(p.action) === JSON.stringify(action))) { setNotice('This preference is already active.'); return; }
    if (preferences.length >= 200) { setNotice('Preference history is full. Remove a specific request or export and reset it before adding more.'); return; }
    // Retain superseded settings so Undo restores the previous setting.
    setPreferences(old => [...old, { id: crypto.randomUUID(), scope, context, action }]);
    setNotice('Preferences applied. The entire account allocation has been reassessed.');
  }
  function removePreference(id: string) { setPrevious(result?.assignments ?? []); setPreferences(old => old.filter(p => p.id !== id)); }
  function availableReplacements(row: ConfigurationAssignment) {
    if (active.some(p => p.action.kind === 'lock' && p.action.configurationId === row.config.id) || (locks[account.mode] ?? []).includes(row.config.compositionId)) return [];
    const scopedActions = preferences.filter(p => preferenceApplies(p, context)).map(p => p.action);
    return row.config.members.filter(id => generation.configurations.some(c => !c.members.includes(id) && row.config.members.filter(m => m !== id).every(m => c.members.includes(m)) && c.rebuilds.length <= comfort.maxRebuilds && !scopedActions.some(a => a.kind === 'exclude' && c.members.some(m => accountIdentity(m) === accountIdentity(a.character)) || 'compositionId' in a && a.compositionId === c.compositionId || a.kind === 'skip-configuration' && a.configurationId === c.id)));
  }
  function workspace(): BuilderWorkspace { return { format: 'AccountDoctorWorkspace', version: 1, exportedAt: new Date().toISOString(), account, preferences, customTeams, locks, server: region, challengeStrategy: challenges.strategy, sheets: readSavedSheets(localStorage), observed, builder: options }; }
  async function readFile(file: File | undefined, kind: 'workspace' | 'observed') {
    if (!file) return;
    try {
      if (file.size > 10_000_000) throw new Error('Choose a JSON file smaller than 10 MB.');
      const data: unknown = JSON.parse(await file.text());
      if (kind === 'workspace') setRestore(parseWorkspace(data)); else {
        if (observed.length >= 10) throw new Error('Evidence storage is full. Existing correction and retraction history is retained; consolidate the source publication before importing more.');
        setObservedPreview(parseObservedPublication(data));
      }
      setNotice('File validated. Review the import preview before applying it.');
    } catch (e) { setNotice(e instanceof Error ? e.message : 'Could not read this file.'); }
    if (restoreInput.current) restoreInput.current.value = '';
    if (observedInput.current) observedInput.current.value = '';
  }
  function exportBuilderPlan() { if (result?.assignments.length) download({ version: 1, account, activity: activePack ? 'verified-current' : activity === 'practice' ? 'challenge-preparation' : 'general-exploration', pack: activePack, practiceTargets, reference: activity === 'practice' && !challenges.useManual ? challenges.reference : undefined, preferences: active, configurations: result.assignments, search: { ...result, assignments: undefined }, evidence: { observedSources, qualifiedRuns: reconcileClears([...publishedClears, ...observed.flatMap(p => p.records)]).filter(({ record }) => matchClear(record, result.assignments[0].config, account, activePack).discovery).length }, generatedAt: new Date().toISOString() }, 'account-doctor-configurations.json'); }
  const modeLabel = account.mode === 'general' ? 'One team' : account.mode === 'abyss' ? 'Spiral Abyss' : 'Stygian Onslaught';
  const targetLabel = activePack ? 'Current challenge' : activity === 'practice' ? 'Custom targets' : 'General matchups';
  return <section className="panel account-builder" aria-label="Account-aware builder" data-mode={account.mode}>
    <h2 className="sr-only">{decisionView === 'pulls' ? 'Pull priorities' : 'Team plans'}</h2>
    <div className="builder-workspace"><div className="builder-results">
    {notice && <p role="status">{notice}</p>}
    {result && <>
      {decisionView === 'pulls' && recommendation && <PullPlanner account={account} input={planningInput} options={pullOptions} configurations={generation.configurations} baseline={recommendation}/>}
      <div hidden={decisionView !== 'teams'}>
      <header className="builder-result-heading"><div><h2>{selectedPlan === 'recommended' ? 'Recommended plan' : `Alternative ${planOptions.findIndex(o => o.id === selectedPlan)}`}</h2><p>{account.mode === 'general' ? 'One team' : account.mode === 'abyss' ? 'Spiral Abyss' : 'Stygian Onslaught'} · {activePack ? `${activePack.patch} · current challenge` : activity === 'practice' ? 'custom targets' : 'general matchups'}</p></div><div className="plan-header-actions"><button className="text-button" disabled={!result.complete} onClick={() => feedback({ kind: 'plan', configurationIds: result.assignments.map(a => a.config.id) })}>Another plan</button><button className="button secondary small" disabled={!result.assignments.length} onClick={exportBuilderPlan}>Export plan</button></div></header>
      {result.assignments.length > 0 && <section className="plan-selector"><h3>Compare plans</h3><div className="account-plan-options" aria-label="Complete account plans">{planOptions.map((option, i) => {
        const metrics = planMetrics(option.plan, account);
        return <button key={option.id} aria-pressed={option.id === selectedPlan} onClick={() => setSelectedPlan(option.id)}><strong><span className="plan-option-index">{String(i + 1).padStart(2, '0')}</span>{i === 0 ? 'Recommended' : `Alternative ${i}`}{option.id === selectedPlan && <Icon name="check" size={14}/>}</strong>{i > 0 && <span className="plan-objective">{option.label}</span>}<span className="plan-preview" aria-label={`${metrics.teams} teams`}>{option.plan.assignments.map(row => <span className="plan-preview-row" key={row.config.id}><span>{option.plan.assignments.indexOf(row) + 1}</span><TeamLineup members={row.config.members} compact/></span>)}</span><small>{metrics.upgrades > 0 ? `${metrics.upgrades} build upgrades` : metrics.unknownBuilds > 0 ? `${metrics.unknownBuilds} builds unchecked` : 'No recorded build gaps'}</small></button>;
      })}</div></section>}
      <p className="builder-plan-heading"><strong>{result.assignments.length} / {account.mode === 'abyss' ? 2 : account.mode === 'stygian' ? 3 : 1} teams</strong>{account.mode !== 'general' && ' · no shared characters'}{planOptions.length < 3 && result.assignments.length > 0 && ` · ${Math.max(0, planOptions.length - 1)} alternatives`}</p>
      {previous.length > 0 && <p role="status" className="plan-change">{explainPlanChange(previous, result.assignments)}</p>}
      {result.conflicts.length > 0 && <div className="challenge-status" role="status"><strong>Conflicting preferences</strong><ul>{result.conflicts.map(s => <li key={s}>{s}</li>)}</ul><p>Remove a preference or undo the last change.</p></div>}
      <div className="configuration-grid">{result.assignments.map((row, i) => <ConfigurationCard key={row.config.id} row={row} index={i} account={account} onFeedback={feedback} observed={observed} pack={activePack} replaceable={availableReplacements(row)}/>)}</div>
      {!result.assignments.length && <div className="builder-empty"><h3>{account.owned.length < 4 ? 'Add at least four characters' : 'No complete plan'}</h3><p>{account.owned.length < 4 ? 'Select your roster in Characters or import it.' : active.length ? 'Remove a preference or undo the last change.' : 'Try a custom composition in Guide recipes & custom teams.'}</p></div>}
      <button className="text-button" aria-expanded={browse} onClick={() => setBrowse(!browse)}>{browse ? 'Hide team options' : 'Browse team options'}</button>
      {browse && <div className="builder-alternatives">{alternatives.map(c => <article key={c.id}><h3>{c.seed?.name ?? `${byId[c.driver].name} · ${c.playstyle.replaceAll('-', ' ')}`}</h3><TeamLineup members={c.members}/><button className="button secondary small" onClick={() => feedback({ kind: 'keep', members: c.members })}>Use this composition</button></article>)}</div>}
      </div>
    </>}
    </div><details className="builder-settings" open={setupOpen} onToggle={e => setSetupOpen(e.currentTarget.open)}><summary><strong>Plan settings</strong><span>{modeLabel} · {targetLabel}</span><Icon name="chevron" size={16}/></summary><div className="builder-settings-body"><label className="field-label">Game mode<select aria-label="Game mode" value={account.mode} onChange={e => onModeChange(e.target.value as Mode)}><option value="general">One team</option><option value="abyss">Spiral Abyss</option><option value="stygian">Stygian Onslaught</option></select></label><h3>Matchups</h3>
    <div className="builder-activity" role="group" aria-label="Builder activity"><button className={`button ${activity === 'general' ? 'primary' : 'secondary'} small`} aria-pressed={activity === 'general'} onClick={() => setOptions(o => ({ ...o, activity: 'general' }))}>General</button>{account.mode !== 'general' && <><button className={`button ${activity === 'current' ? 'primary' : 'secondary'} small`} aria-pressed={activity === 'current'} onClick={() => setOptions(o => ({ ...o, activity: 'current' }))}>Current challenge</button><button className={`button ${activity === 'practice' ? 'primary' : 'secondary'} small`} aria-pressed={activity === 'practice'} onClick={() => setOptions(o => ({ ...o, activity: 'practice' }))}>Custom targets</button></>}</div>
    {activity === 'practice' && <ChallengePlanner mode={account.mode} challenges={challenges} practice compact/>}
    {activity === 'current' && <ChallengePlanner mode={account.mode} challenges={challenges} compact/>}
    {activity === 'current' && !currentAvailable && <p className="challenge-status">No verified live challenge is available. Using general teams.</p>}
    <details className="builder-preferences"><summary>Preferences, builds &amp; exclusions</summary>
    <div className="builder-focus"><label className="field-label">Build around<select aria-label="Build around a character" value={favorite} onChange={e => setFavorite(e.target.value)}><option value="">Any owned character</option>{account.owned.map(id => <option key={id} value={id}>{byId[id].name}</option>)}</select></label><button className="button secondary small" disabled={!favorite || !account.owned.includes(favorite)} onClick={() => feedback({ kind: 'keep', members: [favorite] })}>Build around them</button></div>
    <div className="calculation-fields">
      <label className="field-label">Save changes for<select aria-label="Feedback scope" value={scope} onChange={e => setScope(e.target.value as Scope)}><option value="session">This session and mode</option><option value="cycle" disabled={!pack}>This verified cycle and server</option><option value="account">This account</option></select></label>
      <label className="field-label">Exclude character<select aria-label="Builder excluded character" value={exclude} onChange={e => setExclude(e.target.value)}><option value="">Choose a character</option>{account.owned.map(id => <option key={id} value={id}>{byId[id].name}</option>)}</select></label><button className="button secondary small" disabled={!exclude} onClick={() => feedback({ kind: 'exclude', character: exclude })}>Apply exclusion</button>
      <label className="checkbox"><input type="checkbox" checked={comfort.easier} onChange={e => feedback({ ...comfort, easier: e.target.checked })}/>Favor easier execution</label>
      <label className="checkbox"><input type="checkbox" checked={comfort.sustain} onChange={e => feedback({ ...comfort, sustain: e.target.checked })}/>Favor greater sustain</label>
      <label className="checkbox"><input type="checkbox" checked={options.allowRebuild} onChange={e => setOptions(o => ({ ...o, allowRebuild: e.target.checked }))}/>Explore planned EM rebuilds</label>
      <label className="field-label">Max rebuilds<select aria-label="Maximum planned rebuilds" value={comfort.maxRebuilds} onChange={e => feedback({ ...comfort, maxRebuilds: Number(e.target.value) })}>{[0, 1, 2, 3].map(n => <option key={n} value={n}>{n === 0 ? '0 · current builds' : n}</option>)}</select></label>
    </div><p className="quiet-note">Unknown builds need checking. Rebuilds require new investment.</p></details>
    <div className={`active-builder-preferences ${active.length ? 'has-constraints' : ''}`}><strong>Active constraints ({active.length})</strong>{active.length > 0 && <ul>{active.map(p => <li key={p.id}><span>{feedbackLabel(p.action)} · {p.scope}</span><button className="text-button" onClick={() => removePreference(p.id)} aria-label={`Remove preference: ${feedbackLabel(p.action)}`}>Remove</button></li>)}</ul>}
      {preferences.length > active.length && <><p>{preferences.length - active.length} inactive preference(s).</p><details><summary>Earlier requests</summary><ul>{preferences.filter(p => !active.some(a => a.id === p.id)).map(p => <li key={p.id}><span>{feedbackLabel(p.action)} · {p.scope}</span><button className="text-button" onClick={() => removePreference(p.id)} aria-label={`Remove earlier preference: ${feedbackLabel(p.action)}`}>Remove</button></li>)}</ul></details></>}
      <div className="button-row"><button className="text-button" disabled={!preferences.length} onClick={() => removePreference(preferences.at(-1)!.id)}>Undo last feedback</button><button className="text-button" disabled={!preferences.length} onClick={() => { setPrevious(result?.assignments ?? []); setPreferences([]); }}>Reset builder preferences</button></div>
    </div>
    </div></details></div>
    <div className="builder-account-tools"><h3>Account data</h3>
    <details className="builder-data"><summary>Data &amp; sources</summary>
    {planOptions.length > 1 && <details><summary>Plan tradeoffs</summary><ul>{planOptions.map(option => <li key={option.id}><strong>{option.label}:</strong> {option.reason}</li>)}</ul></details>}
    {result && <details className="builder-search-details"><summary>Search details</summary><p>{generation.coverage.enumerated} owned combinations enumerated (cap {generation.coverage.cap}{generation.coverage.truncated ? ', reached' : ', not reached'}); {generation.coverage.generated} open configurations and {generation.coverage.seeds} seeds. Joint search: {result.poolSizes.join(' / ')} candidates per team; {result.omitted} configurations omitted; {result.nodes.toLocaleString()} search nodes. Exact inside these pools, not a global optimum. Preference points combine complete guide examples, conditional role ratings, readiness, mechanics and recorded build gaps. Alternatives reassign the whole account with investment or sustain preferences.</p></details>}
    <details><summary>Mechanics coverage for your roster</summary><p>{generation.coverage.characters} characters have pilot roles. Energy repeatability, complete application timing, artifact main stats, full weapon passives, precise animation timing and clear capability remain unresolved.</p><ul>{account.owned.map(id => <li key={id}><strong>{byId[id].name}:</strong> {profiles.filter(p => p.character === id).map(p => p.role).join(' / ') || 'No covered role; guide seeds remain inspectable without mechanical certification.'}</li>)}</ul></details>
    <details><summary>Reviewed player clears &amp; learning boundary</summary><p><a href="https://www.stygian.moe/" target="_blank" rel="noreferrer">Stygian.moe ↗</a> is the first registered source. Public source listings are available in Recorded clears. This separate importer accepts independently reviewed references for discovery and contextual comparison; no independently reviewed videos are bundled here. Model training and evaluation remain unqualified. Success-only archives cannot establish success probabilities.</p><p>{observedSources[0].access.basis}</p><p>{observed.reduce((n, p) => n + p.records.length, 0)} imported records, including quarantined or test records; eligibility is checked separately for discovery, comparison, training and evaluation.</p>
      <div className="button-row"><button className="button secondary small" onClick={() => observedInput.current?.click()}>Import reviewed clear publication</button><button className="button secondary small" onClick={() => download(createSplitManifest([...publishedClears, ...observed.flatMap(p => p.records)], new Date().toISOString()), 'account-doctor-evaluation-manifest.json')}>Export evaluation manifest</button></div>
      <input ref={observedInput} type="file" accept=".json" hidden aria-label="Reviewed clear publication file" onChange={e => void readFile(e.target.files?.[0], 'observed')}/>
      {observedPreview && <div className="builder-import-preview"><h3>Review clear publication</h3><p>{observedPreview.records.length} records from {observedPreview.sourceId}; {observedPreview.records.filter(r => r.fixture).length} test fixtures. Import does not grant source permissions or change review status.</p><button className="button primary small" onClick={() => { setObserved(old => [...old, observedPreview]); setObservedPreview(undefined); setNotice('Publication imported. Unqualified rows remain excluded from recommendations.'); }}>Import evidence records</button><button className="text-button" onClick={() => setObservedPreview(undefined)}>Cancel evidence import</button></div>}
    </details>
    </details>
    <details className="builder-backup"><summary>Backup &amp; restore account workspace</summary><p>Roster, builds, equipment, custom teams, rotation sheets and preferences.</p><div className="button-row"><button className="button secondary small" onClick={() => download(workspace(), 'account-doctor-workspace.json')}>Export workspace backup</button><button className="button secondary small" onClick={() => restoreInput.current?.click()}>Restore workspace backup</button></div><input ref={restoreInput} type="file" accept=".json" hidden aria-label="Workspace backup file" onChange={e => void readFile(e.target.files?.[0], 'workspace')}/>
      {restore && <div className="builder-import-preview"><h3>Review workspace restore</h3><p>{restore.account.owned.length} roster entries, {restore.customTeams.length} custom teams, {restore.preferences.length} preferences, {Object.keys(restore.sheets).length} sheets. Applying replaces the current account and builder settings.</p><button className="button primary small" onClick={() => { try { restoreWorkspaceStorage(restore, localStorage, sessionStorage); setPreferences(restore.preferences); setOptions(restore.builder); setObserved(restore.observed); setPrevious([]); onRestore(restore); setRestore(undefined); setNotice('Workspace restored and configurations rechecked.'); } catch (e) { setNotice(e instanceof Error ? e.message : 'Restore failed.'); } }}>Apply workspace restore</button><button className="text-button" onClick={() => setRestore(undefined)}>Cancel workspace restore</button></div>}
    </details>
    </div>
  </section>;
}
