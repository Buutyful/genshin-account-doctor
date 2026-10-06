export interface MetaEntry { id: string; role: string; tier: number; constellation: number; partners: string[]; }
export interface MetaPack { id: string; patch: string; source: string; updatedAt: string; checkedAt: string; expiresAt: string; entries: MetaEntry[]; }
export interface TeamContract {
  origin?: 'mechanical';
  id: string; name: string; anchor: string; slots: string[][]; roles: string[];
  source: string; checkedAt: string; why: string; caution: string;
  encounterTags?: string[]; minimumConstellations?: Record<string, number>;
  rotationOutline?: string; buildNotes?: Record<string, string>;
  buildTargets?: Record<string, { level?: number; talent?: 'auto' | 'skill' | 'burst' }>;
}
export interface Benchmark {
  id: string; members: string[]; anchor: string; scenario: string; profileId: string;
  status: string; meanDps: number; ci95: number; samples: number;
  configSha256: string; configPath: string; rotationStatus: string; diagnostics: string[];
}
export interface BenchmarkPack {
  version: number; id: string; patch: string; generatedAt: string; profileId: string; profileLabel: string;
  engine: { revision: string; binarySha256: string }; rows: Benchmark[];
}
export interface PlannerOptions {
  strategy?: 'meta' | 'guide' | 'benchmark'; scenario?: 'boss' | 'groups'; now?: string; requiredCharacter?: string;
  meta?: MetaPack; contracts?: TeamContract[]; benchmarks?: BenchmarkPack;
}
export interface Candidate {
  origin?: 'mechanical' | 'guide' | 'custom';
  id: string; name: string; members: string[]; roles: string[]; anchor: string;
  reviewed: boolean; why: string; caution: string; sources: string[];
  score: number; missing: string[]; mask: bigint; retrieval: number;
  ranking: 'meta' | 'guide' | 'unrated' | 'benchmark'; metaTier: number | null;
  assumptions: string[]; unsupported: string[]; benchmark?: Benchmark;
  scoreParts?: { carry: number; teammates: number; readiness: number; review: number };
  encounterTags?: string[]; minimumConstellations?: Record<string, number>;
  rotationOutline?: string; buildNotes?: Record<string, string>;
  buildTargets?: Record<string, { level?: number; talent?: 'auto' | 'skill' | 'burst' }>;
}
