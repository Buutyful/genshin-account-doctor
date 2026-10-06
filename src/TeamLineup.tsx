import { byId, portrait } from './account';

/** The same four slots are used in plan previews and pull comparisons. */
export function TeamLineup({ members, added = [], compact = false }: { members: string[]; added?: string[]; compact?: boolean }) {
  return <span className={`visual-lineup${compact ? ' compact' : ''}`}>
    {members.map(id => <span data-element={byId[id].element} className={`lineup-slot${added.includes(id) ? ' added' : ''}`} key={id} title={`${byId[id].name} · ${byId[id].element}${added.includes(id) ? ' · Added' : ''}`}>
      <img src={portrait(id)} alt={compact ? byId[id].name : ''} loading="lazy"/>
      {!compact && <span className="lineup-name">{byId[id].name}</span>}
      {added.includes(id) && <span className="lineup-added" aria-label="Added">+</span>}
    </span>)}
  </span>;
}
