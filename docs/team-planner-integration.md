# Team planner, calculations and live challenges

30 September 2026.

Historical guide-planner integration. The connected main builder and current source-verification state are documented in the [1 October account-aware implementation report](account-aware-builder-implementation.md).

## Planning workflow

The planner now combines guide recipes, product-authored mechanical role contracts, and saved custom teams. Custom teams can contain any four owned, distinct account identities and specify their driver in the first slot. A saved custom composition takes precedence over a guide's driver interpretation for the same four members. Missing characters exclude a saved team from the account plan. Traveler elements still share one identity.

Open a prescription to inspect mechanical conditions, calculate a rotation, and lock a team into the current mode's plan. Locks are session-local and mode-specific; conflicting teams are rejected. A team absent from the active ranking pool is not an active lock. Other teams are assigned around active locks. Saved custom compositions and calculation sheets persist locally, separately from the imported account. Prescription exports include the account, custom teams, active locks, relevant sheets, source snapshot and encounter assignment. Calculation downloads include inputs, output and formula attribution.

Mechanical Hyperbloom contracts specify a Dendro applicator, Hydro applicator, Kuki/Raiden as an off-field core trigger, and a restricted utility slot. Raiden variants require a healer in the final slot. These are experimental role contracts, not new reviewed guide examples. Existing reviewed recipes retain their annotations. Kit checks expose Nilou/Chevreuse team restrictions, potential reaction paths, Furina healing assumptions, Bennett/Xiangling particle and snapshot conditions, and resonance availability. Unknown kits and missing evidence are not incompatibilities. No mechanical note silently applies a damage buff.

## Deterministic damage sheet

`src/planner/damage.ts` evaluates explicit action counts. Direct damage includes base damage, damage bonus, average critical multiplier, defense reduction/ignore and piecewise enemy resistance. Vaporize/Melt include direction, trigger EM and reaction bonus. Bloom, Hyperbloom, Burgeon and Swirl use level-90 transformative scaling and bypass defense, ordinary damage bonus and crit. Other transformative levels are rejected rather than interpolated. The source formula is [KQM's damage reference](https://library.keqingmains.com/combat-mechanics/damage/damage-formula); the level-90 coefficient also agrees to published precision with [gcsim's reaction table](https://github.com/genshinsim/gcsim/blob/main/pkg/core/combat/reaction.dm.go).

Each team member must have damage rows or an explicit no-damage declaration. Missing/invalid values, nonpositive rotation duration, foreign members and contradictory declarations withhold team DPS. An empty input is not zero. Levels and EM may be prefilled from account observations; GOOD equipment is not treated as derived combat stats. The initial target level/resistance, rotation duration and zero bonuses are visible editable assumptions.

An assigned encounter can load its chamber/boss level into the sheet. If every enemy has supplied HP, their total can be divided by an explicit user time budget to show required damage per second. This budget excludes shields, invulnerability and wave timing. Saved targets are labeled as assumptions rather than a continuing current-cycle claim.

The resulting DPS is a **manual rotation estimate**. It is not a simulation, an artifact optimizer or validated account DPS. Users must account for energy, cooldowns, aura, reaction ownership, ICD, buff snapshots and uptime. Split reacting/non-reacting actions and attacks with different buff states into separate rows. The sheet does not establish reaction hit-rate limits, AoE coverage, shield-breaking speed or clear time. It does not enter the damage-ranking objective.

The validated offline benchmark channel remains separate. `src/data/benchmarks.json` has no qualified rows. No engine/config/rotation provenance or DPS has been fabricated to enable that objective. A current reference pack needs independent offline publication and validation; engine binaries and research checkouts remain outside this app. The old public gcsim database route is archived/removed in its current source, so it is not used as a new live benchmark API.

## Challenge feed

The adapter uses the [Hakushin Python client's documented schemas](https://github.com/seriaati/hakushin-py/tree/92e46927f7eeebf20dffde91d58c07f16613aa63/hakushin/models/gi) and its [base URL and request construction](https://github.com/seriaati/hakushin-py/blob/92e46927f7eeebf20dffde91d58c07f16613aa63/hakushin/clients/base.py):

1. Fetch `https://static.nanoka.cc/manifest.json`, selecting `gi.live` (never `latest`).
2. Fetch `/gi/{version}/tower.json` or `/gi/{version}/leyline.json`.
3. Require exactly one active entry with explicit `live_begin` and `live_end`. Beta `begin`/`end` fields cannot establish a live cycle.
4. Fetch `/gi/{version}/en/tower/{id}.json` or `/gi/{version}/en/leyline/{id}.json` and hash the exact response bytes with SHA-256.
5. Validate and cache per mode and server. Source URL, exact manifest/index/detail response hashes, version, cycle dates, server, fetch time and difficulty travel with the data.

Abyss retains all three Floor 12 chambers under each of the two halves, including each enemy's supplied HP. Stygian currently selects difficulty 6 and retains the three boss mechanics/recommendations; its schema does not supply HP, so HP stays unknown. Resistance, shield gauges and wave timing are not invented. Imaginarium Theater cast/vigor allocation is not implemented.

Timezone-less timestamps are interpreted as game-server wall time: Asia UTC+8, Europe UTC+1, America UTC−5, without browser daylight-saving shifts. Explicit offsets and Unix timestamps are respected. End dates are exclusive. Cache freshness is limited to 24 hours and re-evaluated every minute. Expired, future and stale packs remain inspectable but cannot drive current-cycle assignment. Refresh errors retain a still-current cached pack. Requests have a 12-second timeout, omit credentials, and are aborted on mode/server changes or navigation. Roster/build data is never sent to the provider.

**Live verification limit:** the provider returned HTTP 403 from this environment on 30 September 2026. No real current lineup was therefore published or claimed. The adapter and browser refresh/cache/retry flows were exercised with deterministic, explicitly test-only schema fixtures. A successful live response is still required to establish end-to-end provider compatibility and availability (including CORS). HTTP errors and unexpected schemas fail closed to general preparation.

## Encounter assignment

When a current pack exists, the solver jointly assigns teams to specific sides/bosses with no overlapping account identities. Each Abyss half's composition remains the same across its three chambers. User matchup preferences (elements, healing, shields, grouping, bow access) are editable after reading the supplied mechanics. They are explicit user strategy, not automatically inferred enemy weaknesses. Unknown kit coverage does not exclude a composition. The comparison is lexicographic: complete team count, then matched-minus-avoided preferences, then the existing selected team objective. It never adds heuristic points to DPS.

Search is exhaustive within a disclosed, deterministic pool of up to 96 teams per encounter, reserving two per driver and preserving locks. This is not a global optimum over every roster combination. Generic preparation retains the 256-candidate allocator. Recipe slot constraints remain intact during retrieval.

## Verification

Domain tests cover formula arithmetic, incomplete inputs, passive restrictions, role-contract discovery, account identity conflicts, locks, date boundaries, live-vs-beta selection, HTTP errors, cache staleness and complete encounters. Browser flows exercise custom-team creation, persisted calculations, locking, encounter fetching, matchup preference assignment, export, failed refresh, expired cache, retry and mobile layout in Chromium, Firefox and WebKit. Existing roster/import/atlas flows remain part of the regression suite. The production build continues to reject simulation binaries and workers.

Final verification on 30 September 2026: `npm run build`, all 31 domain tests (`npm test`), and all 42 browser checks (`npm run test:app`) passed. Mobile calculator output was visually inspected. The build retains its existing large-chunk advisory; no simulation binary or worker is included.
