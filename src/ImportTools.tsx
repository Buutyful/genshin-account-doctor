import { useEffect, useRef, useState } from 'react';
import type { GoodImport } from './import-good';
import { scannerTools } from './import-good';

export function ImportTools({ onImport }: { onImport: () => void }) {
  return <details className="import-tools"><summary>Import from the game <span>Have a scanner file?</span></summary><p>Scan your account, export a GOOD file, then import it here. Your file is read on this device.</p><div className="scanner-links">{scannerTools.map(tool => <a key={tool.name} href={tool.url} target="_blank" rel="noreferrer"><strong>{tool.name} ↗</strong><span>{tool.description}</span></a>)}</div><p>Follow your scanner’s setup guide. Supports GOOD v1–3, including weapons and artifacts.</p><button className="button secondary" onClick={onImport}>Choose GOOD file</button> <a href="https://frzyc.github.io/genshin-optimizer/#/doc" target="_blank" rel="noreferrer">About GOOD files ↗</a></details>;
}

export function ImportPreview({ preview, demo, onApply, onClose }: { preview: GoodImport; demo: boolean; onApply: (replace: boolean) => void; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null), [replace, setReplace] = useState(demo);
  useEffect(() => { dialog.current?.showModal(); }, []);
  return <dialog ref={dialog} className="prescription-dialog import-dialog" aria-labelledby="import-title" onCancel={onClose} onClose={onClose}>
    <button className="dialog-close" aria-label="Cancel import" onClick={onClose}>×</button><span className="eyebrow">REVIEW YOUR SCAN</span><h2 id="import-title">Import GOOD data</h2><p>Source: {preview.source}</p><div className="import-counts"><strong>{preview.characterCount} characters</strong><strong>{preview.weaponCount} weapons</strong><strong>{preview.artifactCount} artifacts</strong></div>
    <label className="field-label">Import mode<select aria-label="Import mode" value={replace ? 'replace' : 'merge'} onChange={e => setReplace(e.target.value === 'replace')} disabled={demo}><option value="merge">Merge into my account</option><option value="replace">Replace my account</option></select></label>
    <p>{demo ? 'The scan will replace the demo account.' : replace ? 'Replaces your roster, details, inventory and readiness with this scan. Export your account first if you want a backup.' : 'Keeps unscanned characters and your readiness. Scanned details update matching characters. Each supplied equipment category replaces its previous snapshot.'}</p>
    <ul className="import-warnings">{preview.warnings.map((warning, i) => <li key={i}>{warning}</li>)}</ul><div className="button-row editor-actions"><button className="button secondary" onClick={onClose}>Cancel</button><button className="button primary" onClick={() => onApply(replace)}>Apply import</button></div>
  </dialog>;
}
