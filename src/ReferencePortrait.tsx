import type { CSSProperties } from 'react';

// Reuse only empty paper/charcoal regions as surfaces. All copy and controls
// remain native elements; this never paints a screenshot over the application.
export function ReferenceSurface({ sidebar = false }: { sidebar?: boolean }) {
  return <svg className={`reference-surface ${sidebar ? 'sidebar-surface' : 'paper-surface'}`} viewBox={sidebar ? '2 548 204 122' : '1220 786 298 190'} preserveAspectRatio="none" aria-hidden="true"><image href={`${import.meta.env.BASE_URL}art/parchment-clinic-reference.png`} width="1536" height="1024"/></svg>;
}

// Present the selected concept's artwork without raster edits. Other roster
// members retain their attributed portraits; UI labels and controls stay live.
const regions: Record<string, [number, number, number, number]> = {
  mavuika: [256, 343, 231, 220], citlali: [496, 343, 220, 220],
  xilonen: [725, 343, 212, 220], bennett: [946, 343, 230, 220],
  neuvillette: [256, 704, 231, 220], furina: [496, 704, 220, 220],
  kazuha: [725, 704, 212, 220], baizhu: [946, 704, 230, 220],
};
export function referenceRegion([x, y, width, height]: [number, number, number, number]): CSSProperties {
  return {
    backgroundSize: `${1536 / width * 100}% ${1024 / height * 100}%`,
    backgroundPosition: `${x / (1536 - width) * 100}% ${y / (1024 - height) * 100}%`,
  };
}
const glyphs: Record<string, [number, number, number, number]> = {
  checkup: [26, 172, 24, 24], characters: [26, 217, 24, 27], teams: [24, 265, 27, 24],
  clears: [24, 313, 29, 26], pulls: [23, 417, 27, 28], synergy: [23, 464, 27, 29],
  knowledge: [26, 513, 24, 25],
  Pyro: [257, 570, 31, 35], Cryo: [503, 570, 30, 35], Geo: [731, 570, 31, 35],
  Hydro: [259, 935, 33, 35], Anemo: [735, 934, 34, 36], Dendro: [948, 934, 33, 36],
};
export function ReferenceGlyph({ name }: { name: string }) {
  return glyphs[name] ? <span className="reference-glyph" style={referenceRegion(glyphs[name])} aria-hidden="true"/> : null;
}
export function ReferencePortrait({ id }: { id: string }) {
  const region = regions[id];
  if (!region) return null;
  return <svg className="reference-portrait" viewBox={region.join(' ')} preserveAspectRatio="xMidYMid slice" aria-hidden="true"><image href={`${import.meta.env.BASE_URL}art/parchment-clinic-reference.png`} width="1536" height="1024"/></svg>;
}

const marks: Record<string, string> = {
  Pyro: 'M16 2c2 8 9 10 8 18-1 8-15 11-20 3-3-5 0-11 6-15-2 6 1 10 4 9 5-2 4-9 2-15Zm-2 17c-6 5-5 9 0 10 5-1 5-5 0-10Z',
  Hydro: 'M16 2C12 8 5 12 5 20a11 11 0 0 0 22 0c0-8-7-12-11-18ZM10 21a6 6 0 0 0 12 0',
  Cryo: 'M16 1v30M3 8l26 16M3 24 29 8M10 4l6 5 6-5M10 28l6-5 6 5M3 14l7-2-1-7M29 18l-7 2 1 7M3 18l7 2-1 7M29 14l-7-2 1-7',
  Geo: 'm16 2 14 14-14 14L2 16 16 2Zm0 6 8 8-8 8-8-8 8-8Zm0 0v8h8',
  Anemo: 'M16 2v20M16 13 6 5l-3 9 13 8L29 14l-3-9-10 8ZM16 22l-5 7m5-7 5 7',
  Dendro: 'M16 30V15M16 22C4 24 0 12 6 5c8 0 13 7 10 17Zm0 0C28 24 32 12 26 5c-8 0-13 7-10 17ZM16 15c-6-5-6-11 0-14 6 3 6 9 0 14Z',
  Electro: 'm16 1-5 13h10l-5 17M7 5a14 14 0 1 0 18 0',
};
export function ElementMark({ element }: { element: string }) {
  return <span className="element-mark" aria-label={element}>{glyphs[element] ? <ReferenceGlyph name={element}/> : <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={marks[element]}/></svg>}</span>;
}
