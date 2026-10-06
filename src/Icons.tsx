export type IconName = 'spark' | 'heart' | 'grid' | 'users' | 'graph' | 'book' | 'arrow' | 'chevron' | 'upload' | 'download' | 'search' | 'check' | 'close' | 'shield' | 'leaf' | 'target' | 'flask' | 'plus' | 'clock' | 'external' | 'menu' | 'sliders' | 'info' | 'edit' | 'lock';
const paths: Record<IconName, string> = {
  info: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18ZM12 11v6m0-10v1',
  edit: 'm16 3 5 5L9 20l-6 1 1-6L16 3Zm-2 2 5 5',
  lock: 'M6 10h12v11H6V10Zm2 0V7a4 4 0 0 1 8 0v3m-4 5v2',
  menu: 'M4 6h16M4 12h16M4 18h16',
  sliders: 'M4 7h8m4 0h4M4 17h3m4 0h9M12 4v6M7 14v6',
  spark: 'm12 2 2.8 7.2L22 12l-7.2 2.8L12 22l-2.8-7.2L2 12l7.2-2.8L12 2Z',
  heart: 'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z',
  grid: 'M3 3h7v7H3V3Zm11 0h7v7h-7V3ZM3 14h7v7H3v-7Zm11 0h7v7h-7v-7Z',
  users: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m20 0v-2a4 4 0 0 0-3-3.9M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm8 .1a4 4 0 0 1 0 7.8',
  graph: 'M12 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6ZM5 16a3 3 0 1 0 0 6 3 3 0 0 0 0-6Zm14 0a3 3 0 1 0 0 6 3 3 0 0 0 0-6ZM10 7l-4 9m8-9 4 9M8 19h8',
  book: 'M12 5v16m0-16C8 2 4 3 2 4v16c4-2 7-1 10 1 3-2 6-3 10-1V4c-2-1-6-2-10 1Z',
  arrow: 'M4 12h16m-6-6 6 6-6 6', chevron: 'm9 5 7 7-7 7',
  upload: 'M12 16V3m-5 5 5-5 5 5M3 15v6h18v-6', download: 'M12 3v13m-5-5 5 5 5-5M3 16v5h18v-5',
  search: 'M10.5 3a7.5 7.5 0 1 0 0 15 7.5 7.5 0 0 0 0-15ZM16 16l5 5', check: 'm5 12 4 4L19 6', close: 'm6 6 12 12M6 18 18 6',
  shield: 'M12 2 3 6v6c0 5 9 10 9 10s9-5 9-10V6l-9-4Zm-4 10 3 3 5-6',
  leaf: 'M20 3C3 1 1 9 5 16s16 5 15-13ZM4 21 15 10', target: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 5a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z',
  flask: 'M9 3h6m-5 0v7L4 20h16l-6-10V3M7 15h10', plus: 'M12 5v14M5 12h14', clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 4v5l3 2', external: 'M14 3h7v7m0-7L10 14M10 3H3v18h18v-7',
};
export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]}/></svg>;
}
