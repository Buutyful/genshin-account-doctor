import { useId, useState } from 'react';
import { byId, portrait } from './account';
import type { Account } from './account';
import type { Configuration } from './planner/configurations';
import { Icon } from './Icons';

export function TeamViewer({ configuration: c, account }: { configuration: Configuration; account: Account }) {
  const [selected, setSelected] = useState<string>();
  const panelId = useId();
  const details = selected ? account.details?.[selected] : undefined;
  const role = selected ? c.seed?.roles[c.seed.members.indexOf(selected)] ?? c.roles.find(r => r.character === selected)?.role : undefined;
  return <div className="team-viewer">
    <div className="viewer-members" aria-label="Team members">
      {c.members.map(id => {
        const character = byId[id], level = account.details?.[id]?.level, constellation = account.constellations?.[id];
        const readiness = account.readiness[id] ?? 'unknown';
        return <button type="button" className="viewer-member" data-element={character.element} key={id} aria-label={`Inspect ${character.name} build`} aria-expanded={selected === id} aria-controls={panelId} onClick={() => setSelected(selected === id ? undefined : id)}>
          <span className="viewer-portrait"><span className="viewer-element">{character.element}</span><img src={portrait(id)} alt="" loading="lazy"/><span className="viewer-constellation">{constellation === undefined ? 'C?' : `C${constellation}`}</span>{id === c.driver && <span className="viewer-driver">On-field</span>}</span>
          <span className="viewer-name">{character.name}<Icon name="chevron" size={12}/></span>
          <span className="viewer-build"><span>{level ? `Lv. ${level}` : 'Level unknown'}</span><span title="Self-reported readiness" className={`viewer-readiness ${readiness}`}>{readiness === 'ready' ? 'Ready' : readiness === 'building' ? 'Building' : 'Unchecked'}</span></span>
        </button>;
      })}
    </div>
    <div id={panelId} className="viewer-inspector" role="region" aria-label="Character build details" hidden={!selected}>
      {selected && <><header><strong>{byId[selected].name} <span>Recorded build</span></strong><button type="button" aria-label="Close build inspection" onClick={() => setSelected(undefined)}><Icon name="close" size={16}/></button></header>
        {role && <p>{role}</p>}
        <dl>{[['Weapon', details?.weapon?.key ?? 'Unknown'], ['Weapon level', details?.weapon?.level ?? 'Unknown'], ['Talents · NA / E / Q', `${details?.talents?.auto ?? '?'} / ${details?.talents?.skill ?? '?'} / ${details?.talents?.burst ?? '?'}`], ['Energy recharge', details?.energyRecharge === undefined ? 'Unknown' : `${details.energyRecharge}%`], ['Elemental mastery', details?.elementalMastery ?? 'Unknown']].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
      </>}
    </div>
    <div className="rotation-preview viewer-rotation"><div className="viewer-rotation-label"><Icon name="arrow" size={14}/><strong>Rotation</strong><span>Proposed</span></div><ol aria-label="Proposed rotation order">{c.rotation.steps.map((step, i) => <li key={`${step.character}:${i}`}><button type="button" onClick={() => setSelected(step.character)} aria-label={`Inspect ${byId[step.character].name} rotation step ${i + 1}`} title={step.action}><span className="rotation-index">{i + 1}</span><img src={portrait(step.character)} alt=""/><span>{byId[step.character].name}</span></button>{i < c.rotation.steps.length - 1 && <span className="rotation-arrow" aria-hidden="true">→</span>}</li>)}</ol></div>
    {selected && <p className="viewer-action">{c.rotation.steps.filter(s => s.character === selected).map(s => s.action).join(' ')}</p>}
  </div>;
}
