import { useEffect, useMemo, useRef, useState } from 'react';
import { byId, portrait, characters } from './account';
import { graph, reviewed } from './knowledge';
import { TeamLineup } from './TeamLineup';
import { comparePlans } from './planner/account-plans';
import type { Account } from './account';
import { bannerAvailability, evaluatePull, preparePullStudy, pullCandidates, rankPulls } from './planner/pulls';
import type { PullEvaluation } from './planner/pulls';
import type { Configuration, GenerationOptions } from './planner/configurations';
import type { PlanningContext } from './planner/account-plans';
import type { BuilderPlan } from './planner/feedback';
import { profiles } from './planner/configurations';
import { metaIsFresh, metaPack, teamContracts } from './planner/planner';
import mechanicsProvenance from './data/mechanics-provenance.json';
import ratingConditions from './data/rating-conditions.json';
import { pullCacheKey, readPullCache, writePullCache } from './planner/pull-cache';

function TeamLines({ plan, compare }: { plan: BuilderPlan; compare?: BuilderPlan }) {
  const changes = compare ? comparePlans(compare.assignments, plan.assignments).changes : [];
  return <ol className="plan-team-lines">{plan.assignments.map((r, i) => <li key={r.config.id}><span className="comparison-team-label">{r.encounter?.name ?? `Team ${i + 1}`}{compare && changes[i]?.before && !changes[i].added.length && <small>Unchanged</small>}</span><TeamLineup members={r.config.members} added={changes[i]?.added}/></li>)}{!plan.assignments.length && <li>No covered complete team</li>}</ol>;
}

export function PullPlanner({ account, input, options, configurations, baseline }: { account: Account; input: PlanningContext; options: GenerationOptions; configurations: Configuration[]; baseline: BuilderPlan }) {
  const study = useMemo(() => preparePullStudy(account, input, options, { configurations, plan: baseline }), [account, input, options, configurations, baseline]);
  const candidates = useMemo(() => pullCandidates(account), [account]);
  const cacheKey = useMemo(() => pullCacheKey(account, { input, options, configurations, baseline }, { graph: graph.digest, reviewed, teamContracts, ratings: metaPack, ratingsFresh: metaIsFresh(options.meta ?? metaPack, options.now), ratingConditions, profiles, mechanics: mechanicsProvenance, characters }), [study]);
  const [selected, setSelected] = useState('');
  const [results, setResults] = useState<PullEvaluation[]>([]);
  const [running, setRunning] = useState(false);
  const [notice, setNotice] = useState('');
  const [source, setSource] = useState<'calculated' | 'cache'>('calculated');
  const run = useRef(0);
  const manuallySelected = useRef(false);
  useEffect(() => {
    const token = ++run.current;
    setResults([]); setSelected(''); setSource('calculated'); setNotice(''); manuallySelected.current = false;
    if (account.owned.length >= 3) {
      setRunning(true);
      void (async () => {
        let cached;
        try { cached = await readPullCache(await cacheKey, candidates.map(c => c.id), account); } catch { /* Recalculate if browser storage is unavailable. */ }
        if (run.current !== token) return;
        if (cached) { setResults(cached.results); setSelected(rankPulls(cached.results)[0]?.character ?? ''); setSource('cache'); setRunning(false); }
        else void compare(candidates.map(c => c.id), true);
      })();
    } else setRunning(false);
    return () => { run.current++; };
  }, [study]);
  const sorted = rankPulls(results);
  const result = results.find(r => r.character === selected);
  const unlockedTeam = result?.selected?.config ?? result?.unlocked[0];
  const freedSupports = result?.delta.released.filter(r => r.to) ?? [];
  const startingBuild = result?.investment.filter(t => t.character === result.character && ['level', 'weapon', 'em', 'talent'].includes(t.field)).slice(0, 3).map(t => t.field === 'level' ? `Level ${t.target}` : t.field === 'weapon' ? t.target ? `Weapon ${t.target}` : 'Weapon needed' : t.field === 'talent' ? `${t.talent === 'auto' ? 'Normal attack' : t.talent} ${t.target}` : 'EM gear').join(' · ');
  async function compare(ids: string[], reset = false) {
    const token = ++run.current;
    setRunning(true); setNotice(''); setSource('calculated');
    const next = reset ? [] : results.filter(r => !ids.includes(r.character));
    try {
      for (const id of ids) {
        await new Promise(resolve => setTimeout(resolve, 0));
        if (run.current !== token) return;
        next.push(evaluatePull(study, id));
        setResults([...next]);
      }
    } catch (error) { if (run.current === token) setNotice(error instanceof Error ? error.message : 'Comparison could not finish.'); }
    finally {
      if (run.current === token) {
        if (next.length === candidates.length) {
          let saved = false;
          try { saved = await writePullCache(await cacheKey, candidates.map(c => c.id), next, account); } catch { /* Results remain usable without persistent storage. */ }
          if (run.current !== token) return;
          if (!saved) setNotice('Pull comparisons could not be saved on this device.');
        }
        setRunning(false); if (!manuallySelected.current) setSelected(rankPulls(next)[0]?.character ?? '');
      }
    }
  }
  function exportComparison() {
    const report = { version: 1, generatedAt: new Date().toISOString(), account: study.account, mode: account.mode, preferences: input.preferences, baseline: study.baseline, buildFirst: { plan: study.improved, actions: study.upgrades }, pulls: results.map(({ account: hypothetical, ...evaluation }) => ({ ...evaluation, account: { ...hypothetical, inventory: undefined } })), equipmentBasis: 'The original inventory is recorded once. Hypothetical pulls receive no equipped gear.', banner: bannerAvailability(selected, input.context.region), disclaimer: 'Account-fit heuristics. No predicted DPS, clear time or success rate.' };
    const url = URL.createObjectURL(new Blob([JSON.stringify(report, (_key, v) => typeof v === 'bigint' ? v.toString() : v, 2)], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = 'account-doctor-pull-comparison.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <section className="pull-planner" aria-label="Pull or build comparison">
    <header className="pull-plan-heading"><div><h2>Compare C0 pulls</h2><p>{account.mode === 'general' ? 'One team' : account.mode === 'abyss' ? 'Spiral Abyss · 2 teams' : 'Stygian Onslaught · 3 teams'} · {input.pack ? 'current challenge' : input.targets ? 'custom targets' : 'general matchups'}</p></div></header>
    {(running || results.length > 0) && <p role="status" className="quiet-note" data-comparison-source={source} data-comparison-state={running ? 'running' : results.length === candidates.length ? 'complete' : 'partial'}>{running ? `Comparing C0 pulls… ${results.length} / ${candidates.length}` : `${results.length} C0 pulls compared`}</p>}
    {running && <progress className="pull-progress" aria-label="Pull comparison progress" value={results.length} max={candidates.length}/>}
    <p className="ranking-basis">Ranked by account fit · DPS not measured</p>
    {notice && <p role="status">{notice}</p>}
    {!running && results.length === candidates.length && results.length > 0 && sorted[0].verdict !== 'Pull priority' && <p className="pull-account-verdict"><strong>{study.upgrades.length ? 'Build first' : 'Save'}</strong> · {study.upgrades.length ? `${study.upgrades.length} recorded build upgrades` : 'No account upgrade established'}</p>}
    {results.length > 1 && <section className="pull-priorities"><h3>{running || results.length < candidates.length ? 'Compared so far' : 'Pull shortlist'}</h3><div className="pull-shortlist" aria-label="Pull shortlist">{sorted.slice(0, 3).map((r, i) => {
      const freed = r.delta.released.find(s => s.to);
      const impact = r.teamsAdded > 0 ? `+${r.teamsAdded} team${r.teamsAdded > 1 ? 's' : ''}` : freed ? `Frees ${byId[freed.character].name}` : r.verdict === 'Build first' ? 'Owned upgrades first' : r.selected ? `${byId[r.selected.config.driver].name} team` : '';
      return <button key={r.character} aria-pressed={selected === r.character} onClick={() => { manuallySelected.current = true; setSelected(r.character); }}><span className="pull-rank">{String(i + 1).padStart(2, '0')}</span><img src={portrait(r.character)} alt=""/><span><strong>{byId[r.character].name}</strong><small>{r.verdict}</small>{impact && <span>{impact}</span>}</span></button>;
    })}</div></section>}
    <div className="pull-controls"><label className="field-label">Compare character<select aria-label="Potential pull" value={selected} onChange={e => { const id = e.target.value; manuallySelected.current = true; setSelected(id); if (id && !results.some(r => r.character === id)) void compare([id]); }}><option value="">Choose a character</option>{candidates.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>{running ? <button className="text-button" onClick={() => { run.current++; setRunning(false); if (!manuallySelected.current) setSelected(sorted[0]?.character ?? ''); }}>Stop comparison</button> : results.length < candidates.length && <button className="text-button" onClick={() => void compare(candidates.filter(c => !results.some(r => r.character === c.id)).map(c => c.id))}>Compare remaining pulls</button>}{results.length > 3 && <details><summary>All compared characters ({results.length})</summary><ul>{sorted.map(r => <li key={r.character}><button className="text-button" onClick={() => { manuallySelected.current = true; setSelected(r.character); }}>{byId[r.character].name} · {r.verdict}</button></li>)}</ul></details>}</div>
    {account.owned.length < 3 && <p className="pull-intro">Add at least three owned characters to compare pulls.</p>}
    {result && <article className="pull-result" aria-label={`${byId[result.character].name} pull comparison`}>
      <header><img src={portrait(result.character)} alt=""/><div><span className={`pull-verdict ${result.verdict === 'Pull priority' ? 'priority' : ''}`}>{result.verdict}</span><h3>{byId[result.character].name} <small>C0</small></h3></div></header>
      <dl className="pull-summary">
        <div><dt>{result.selected ? 'Team unlocked' : 'Team option'}</dt><dd>{unlockedTeam ? <TeamLineup members={unlockedTeam.members} added={[result.character]}/> : 'No complete team with your partners'}</dd></div>
        <div><dt>Support moves</dt><dd>{freedSupports.length ? freedSupports.map(r => <span className="support-move" key={r.character}><img src={portrait(r.character)} alt=""/>{byId[r.character].name} → Team {r.team} ({byId[r.to!].name})</span>) : 'None'}</dd></div>
        <div><dt>Build needed</dt><dd>{startingBuild || 'Check build requirements'}</dd></div>
      </dl>
      {result.teamsAdded > 0 && <p className="pull-team-gain">+{result.teamsAdded} account team{result.teamsAdded > 1 ? 's' : ''}</p>}
      <div className="plan-comparison"><section><h4>Current teams <span>{study.baseline.assignments.length} {study.baseline.assignments.length === 1 ? 'team' : 'teams'}</span></h4><TeamLines plan={study.baseline}/></section><section><h4>With {byId[result.character].name} <span>{result.after.assignments.length} {result.after.assignments.length === 1 ? 'team' : 'teams'}</span></h4><TeamLines plan={result.after} compare={study.baseline}/></section><section><h4>Build first <span>{study.upgrades.length} recorded upgrades</span></h4><TeamLines plan={study.improved} compare={study.baseline}/>{study.upgrades.length ? <><ul className="build-task-list">{study.upgrades.slice(0, 3).map((t, i) => <li key={i}><strong>{byId[t.character].name}:</strong> {t.text}</li>)}</ul>{study.upgrades.length > 3 && <details><summary>{study.upgrades.length - 3} more upgrades</summary><ul className="build-task-list">{study.upgrades.slice(3).map((t, i) => <li key={i}><strong>{byId[t.character].name}:</strong> {t.text}</li>)}</ul></details>}</> : <p className="quiet-note">No recorded build shortfalls.</p>}</section></div>
      {!result.unlocked.length && result.partnerTeams.length > 0 && <p><strong>Still missing:</strong> {result.partnerTeams.map(t => `${t.name}: ${t.missing.map(id => byId[id].name).join(', ')}`).join('; ')}.</p>}
      <details><summary>Builds required</summary>
        <p><strong>Partners:</strong> {result.requiredPartners.map(id => byId[id].name).join(', ') || 'No complete partner set'}</p>
        {result.requiredConditions.length > 0 && <p><strong>Required conditions:</strong> {result.requiredConditions.join(' ')}</p>}
        {result.ratingPartners.length > 0 && <p><strong>Rating partners:</strong> {result.ratingPartners.map(id => `${byId[id].name}${account.owned.includes(id) ? ' (owned)' : ' (missing)'}`).join(', ')}.</p>}
        <ul className="build-task-list">{result.investment.map((t, i) => <li key={`${t.character}:${i}`}><strong>{byId[t.character].name}:</strong> {t.text}{t.source && <> <a href={t.source} target="_blank" rel="noreferrer">Guide ↗</a></>}</li>)}</ul><p className="quiet-note">Level 80, weapon 80 and talent 6 are minimum planning targets. Reaction triggers target 90. Gear and final stats require checking.</p></details>
      <details><summary>Rotations &amp; matchup changes</summary>{result.after.assignments.map((r, i) => <div key={r.config.id}><h4>Team {i + 1} · {r.config.seed?.name ?? byId[r.config.driver].name}</h4><p>{r.config.rotation.steps.map(s => `${byId[s.character].name}: ${s.action}`).join(' → ')}</p><p>{r.config.seed?.caution}</p>{r.config.sources.slice(0, 2).map(url => <a key={url} href={url} target="_blank" rel="noreferrer">Team source ↗ </a>)}</div>)}<p>{result.matchupGains.length ? result.matchupGains.map(m => `${m.encounter}: ${m.text}`).join(' · ') : input.targets || input.pack ? 'No additional matched encounter requirement.' : 'Choose challenge targets to compare matchup coverage.'}</p><p>Rotations are proposed outlines. Timings and clear performance are unverified.</p></details>
      <details><summary>Team changes &amp; evidence</summary><p>{result.reason}</p>{result.delta.changes.map((c, i) => <p key={i}>Team {i + 1}: {c.before ? c.removed.length ? `${c.removed.map(id => byId[id].name).join(', ')} → ${c.added.map(id => byId[id].name).join(', ')}` : 'Members retained' : 'New team'}.</p>)}{result.delta.dropped.map(r => <p key={r.config.id}>Retired team: {r.config.members.map(id => byId[id].name).join(' / ')}.</p>)}<p>{result.unlockedCount} new covered compositions.</p><p>Guide examples, conditional ratings and covered mechanics support these choices. Observed clears and synthetic measurements remain separate; this is not a damage ranking.</p><p>{result.coverage.unknown.length} owned characters have no covered mechanics profile. {result.after.omitted} configurations omitted by the bounded search. Unknown teams may still work.</p></details>
      <p className="banner-status"><strong>{bannerAvailability(result.character, input.context.region).status}</strong> · <a href="https://genshin.hoyoverse.com/en/news" target="_blank" rel="noreferrer">Official wish notices ↗</a></p>
      <button className="text-button" onClick={exportComparison}>Export pull comparison</button>
    </article>}
  </section>;
}
