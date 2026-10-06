# Recorded-clear finder — implementation and evidence

## Delivered behavior

Account Doctor now has a first-class **Clear finder**, also available in Team planner's **Recorded clears** tab. Opening Team planner with a Stygian account selects this workflow. The same saved account, GOOD inventory and character editor supply the matching inputs.

The finder starts with complete compositions that appear in real submitted runs. Each result retains the original boss, source version, difficulty, four members, listed constellations, weapons/refinements, available character levels, source cost, recorded seconds, execution tags and original video link. Results compare the account's inputs directly with those fields. They do not substitute independent pair affinities or a heuristic combat score for a recorded team.

It jointly assigns the three bosses, maximizing filled bosses before the selected objective: closest investment, fastest recorded runs or lowest source cost. It produces up to three composition-distinct account allocations, each preserving the best attainable boss coverage. If only one complete allocation exists, partial allocations are not presented as its alternatives. Locked teams, exclusions and skipped compositions are respected throughout reassignment. Traveler elements share one account identity. Conflicting locks produce an actionable message; a missing boss remains visibly unassigned, with a guide-planning handoff.

Equipped weapons are the default. Optional swaps use only recorded owned copies, with bipartite matching across every member of the entire allocation. A GOOD row and its mirrored equipped details count as one copy. Edits supersede stale scan locations. Refinement matching handles the case where one member can use either R1 or R5 but another needs R5. An individual team passing its weapon check cannot consume the same copy as another team in an investment-matched plan.

Unknown constellations, unrecorded weapons/refinements, unmatched listed levels, reduced-cost records and unverified special buff context cannot pass the investment filter. Passing it means recorded investment meets or exceeds the listed thresholds; it does not establish artifact, talent, rotation or clear-time equivalence. Demanding execution, tools and buff tags remain visible and can be excluded. One-character-away records are inspectable examples, without treating them as a C0 pull recommendation.

Settings, exclusions, locks and skips persist locally. Changing source version or difficulty explicitly resets context-specific locks/skips. Export contains the raw selected records, account comparisons, physical weapon assignments, source metadata and exact hashes of the supporting snapshots.

## Publication

The 5 October capture indexes **914 complete four-member source-listed clears**. The six source boards contain 939 listings; 25 solo, duo or three-character runs were excluded rather than filled with invented teammates.

| Boss | Dire | Fearless |
| --- | ---: | ---: |
| Battle-Hardened Domovoy Sculptor: Gale Hewing | 184 | 113 |
| Secret Source Automaton: Overseer Device - Obliterator Panoply | 151 | 104 |
| Guardian Blade of Drifting Snow: Endless Reverberation | 215 | 147 |
| Complete compositions | 550 | 364 |

The publication identifies source version **7.1**, with no regional current-cycle certification. Its boss names disagree with the separate reviewed challenge feed; those contexts are not merged. The snapshot is due for refresh on 12 October UTC and remains inspectable afterwards with a dated notice. A refresh replaces the index, so removed records are not accumulated indefinitely.

The capture script uses ordinary public page navigation and pagination in Chromium. It reads the page's embedded initial JSON and the responses the public UI itself receives. It does not directly query the source backend or use credentials. A 100-page-per-board limit, pacing, schema checks, exact hashes and per-board counts protect atomic publication. Failed or incomplete captures leave the shipped snapshot intact.

The field audit verifies all 914 records against **101 exact-byte source snapshots** and checks every excluded record and all six coverage counts. Two source video links had a missing scheme or HTTP scheme; normalized HTTPS links preserve the original values and source hashes. Raw source bytes stay in the ignored `.research-cache/clear-archive` directory. The shipped index and [audit manifest](verification/recorded-clear-index-2026-10-06.json) retain exact provenance; videos, competitor artwork and guide prose are not copied.

Run `npm run clears:refresh` to navigate the latest source version, or pass `-- --version=7.1` for a specific available source version. Use `node scripts/refresh-clear-archive.mjs --publish-cached` to regenerate the publication from the verified local snapshots. `npm run clears:verify` requires those raw snapshots and writes the field-audit report. Normal builds and tests do not require a source connection or the ignored cache.

## Evidence boundaries and practical limits

“Source-listed” reports the archive's moderation status. **Independently verified videos: zero.** The separate reviewed-clear importer retains its stricter proof/build gates. Source-listed records do not become complete independently reviewed measurements, co-usage telemetry, synthetic results or training/evaluation data.

Recorded times belong to different players and builds. They can order the corresponding observed runs, but do not predict this account's time, success rate or DPS. Source-approved reduced cost can differ from actual showcased investment. Unknown source or account fields stay unknown.

Search retains up to 96 candidates per boss and at most three investment variants of each composition, with a 180,000-node limit. A bounded-search result is explicitly labelled in source details and export; no global-optimum claim is made. The demo roster has six Dire matches covering one boss, with honest empty coverage for the other two. Accounts with compatible real-run compositions can receive three disjoint investment-matched teams. Guide planning remains available for gaps beyond the archive.

## Verification

Domain coverage includes the real publication and audited hash, malformed data, reduced metadata, unknown investments, GOOD aliases, scan mirrors, manual equipment edits, refinement assignment, finite weapon copies, Traveler conflicts, locks/exclusions, coverage-before-speed, original boss/difficulty preservation, distinct alternatives and deterministic large-roster search.

Browser coverage exercises offline snapshot loading, real three-run investment matching, source-preserving exports, locks and full-plan alternatives, exclusions and conflicts, character editing, persisted settings, planner navigation, mobile expanded alternatives/near misses/hashes, original proof links and snapshot expiry in Chromium, Firefox and WebKit.

Verification on 6 October 2026:

- `npm run build`: passed TypeScript, production bundling and the 133-file standalone-build check. The clear index loads with the lazy finder module, approximately 100 KB gzipped. Vite reports its usual large-chunk warning, including the existing main bundle.
- `npm test`: **105 tests passed** across seven suites, including 12 new recorded-clear domain tests.
- `npm run test:app`: **123 checks passed** across Chromium, Firefox and WebKit. Subsequent focused reruns verify the final composition-skip, alternative-coverage and shared-identity updates.
- `npm run clears:verify`: **914 records** matched **101 exact-hash snapshots**, with every one of the 25 excluded incomplete compositions accounted for.
- [Production-client evidence](verification/recorded-clear-client-2026-10-06.json): three real source-listed runs matched against an explicitly constructed account, with no page errors and no mobile overflow at 390 px. Desktop and mobile screenshots are saved in `output/clear-finder-three-bosses-*.png`.
