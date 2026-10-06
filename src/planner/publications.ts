import registry from '../data/encounter-publications.json';
import { encounterStatus, validateEncounterPack } from './encounters';
import type { EncounterPack, EndgameMode, Region } from './encounters';

export interface PublicationReview { id: string; path: string; sha256: string; mode: EndgameMode; region: Region; }
export const publicationReviews = registry.reviews as PublicationReview[];
export async function sha256(bytes: ArrayBuffer) { return [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(b => b.toString(16).padStart(2, '0')).join(''); }
/** Only an exact locally reviewed byte hash can establish a publication. An imported "verified" flag cannot. */
export async function readPublication(bytes: ArrayBuffer, reviews = publicationReviews): Promise<EncounterPack> {
  if (bytes.byteLength > 5_000_000) throw new Error('Publication exceeds 5 MB.');
  const digest = await sha256(bytes), review = reviews.find(r => r.sha256 === digest);
  if (!review) throw new Error('This publication has no matching reviewed hash in the source registry.');
  const pack = validateEncounterPack(JSON.parse(new TextDecoder().decode(bytes)));
  if (!pack.publication || pack.publication.id !== review.id || pack.mode !== review.mode || pack.region !== review.region) throw new Error('Publication identity differs from the reviewed record.');
  return pack;
}
export async function fetchPublication(mode: EndgameMode, region: Region, signal?: AbortSignal, fetcher = fetch, now = Date.now()) {
  const packs: EncounterPack[] = [];
  for (const review of publicationReviews.filter(r => r.mode === mode && r.region === region)) {
    if (!/^challenges\/[a-zA-Z0-9._-]+\.json$/.test(review.path)) throw new Error('Invalid publication path.');
    const response = await fetcher(`${import.meta.env.BASE_URL}${review.path}`, { signal, credentials: 'omit' });
    if (response.ok) {
      const pack = await readPublication(await response.arrayBuffer());
      if (encounterStatus(pack, now) === 'current') packs.push(pack);
    }
  }
  if (packs.length > 1) throw new Error('Conflicting reviewed current publications.');
  return packs[0];
}
