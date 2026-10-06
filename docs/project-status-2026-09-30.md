# Project status — 30 September 2026

Account Doctor is a working local account and team-planning prototype. Its strongest implemented capabilities are roster ingestion, sourced composition discovery, and allocating characters across teams. Its central product gap is diagnosis: it does not yet determine which specific upgrades would improve an account most, at what cost, or whether those changes would enable a clear.

This assessment covers the current working tree, including uncommitted and untracked implementation. It is based on the repository documentation, source, data snapshots and fresh local checks. External guide claims and live-provider availability were not reverified during this review.

## What works

- **Standalone application:** React/TypeScript with a static production build, responsive clinic UI, demo onboarding, character portraits and attributed original doctor artwork. No simulation engine, runtime worker or research checkout ships in the app.
- **Account workflow:** manual roster selection, filters, readiness, build editing, local persistence, native roster import/export and previewed GOOD v1–v3 imports with merge/replace. Weapon and artifact observations are retained; unknown values remain unknown.
- **Composition discovery:** complete four-slot guide recipes, character-constrained search, one-missing-character suggestions, source links and role explanations. The atlas contains 1,094 unexpanded recipes and 1,937 relationship edges, from 113 source URLs in its KQM-only graph snapshot. The roster contains 127 entries, including Traveler variants.
- **Account allocation:** one-team preparation, two Abyss teams and three Stygian teams, with shared account identities and disjoint allocation. Custom compositions, experimental Hyperbloom contracts and session-local team locks are implemented. Generic allocation is exact within a selected pool of up to 256 candidates; encounter assignment searches up to 96 candidates per encounter. Recipe expansion uses a width-24 beam.
- **Transparent priority:** conditional ordinal role ratings and a separate guide-review/readiness objective. Tier assumptions and missing build information are exposed. Published reference-DPS ranking is gated behind qualified benchmark data.
- **Manual calculations:** persistent action-based rotation sheets, selected damage/reaction formulas, input completeness checks and calculation export. These produce user-authored estimates, not automatically derived account DPS.
- **Challenge integration:** live-manifest selection, server dates, provenance hashes, cache expiry, retries and joint encounter assignment are implemented and fixture-tested. Failure falls back to general preparation.

## Main shortcomings

| Priority | Gap | Practical consequence |
| --- | --- | --- |
| Highest | **The account diagnosis is shallow.** The next-step prompt selects an unchecked/not-ready character. There are no role-specific upgrade targets, resource costs or comparisons of upgrade benefit. | The product can organize an account, but cannot yet give a substantiated ordered investment plan. |
| Highest | **Build observations do not become a full combat model.** Levels, talents, weapons, ER and EM mostly support recordkeeping, missing-information warnings and limited calculator prefills. Readiness is self-reported. Artifact sets, passives and total combat stats are not derived. | Importing a scan does not establish build quality, sustainable rotations or actual team strength. Constellations affect some rating eligibility, but that is narrower than a build evaluation. |
| High | **Semantic recipe review is limited.** Five KQM recipe families and four additional guide contracts have explicit role annotations; two mechanical Hyperbloom contracts are experimental. Most extracted examples still require condition review. Some constellation requirements remain prose cautions. | Preserved slots and identity constraints do not certify energy, aura, field time, equipment or constellation compatibility. Missing evidence must continue to mean unknown. |
| High | **Ranking quality has not been measured.** Default weights use ordinal editorial character ratings, with small readiness/review contributions. No held-out roster evaluation, expert agreement study or in-game validation suite is present. | Passing software tests does not prove that the recommended plan is the best practical use of an account. Candidate pruning also prevents a global optimality claim. |
| High | **No qualified damage benchmarks exist.** The published benchmark pack has zero rows. The manual calculator omits automatic energy, cooldown, aura, ICD, buff uptime and artifact evaluation; transformative calculations only cover level 90 and a subset of reactions. | Damage ranking, validated account DPS and clear predictions remain unavailable. Offline research and publication are still required before stronger claims. |
| High | **Live-provider compatibility remains unverified.** The last documented real-provider attempt returned HTTP 403. This review's browser tests use fixtures; a successful real browser response, including CORS, is still needed. | Current-cycle functionality is conditional on a valid fresh pack. Resistance, shield gauges, wave timing and Stygian HP remain outside the adapter's coverage; matchup strategy is user-entered. |
| Medium | **Coverage and evidence are uneven.** The relationship graph is KQM-only; additional guide contracts and role ratings do not establish independent consensus for its edges. There is no observed-usage dataset, Enka ingestion or Imaginarium Theater allocation. | Broad recipe counts can overstate the depth of reviewed advice. Snapshot dates and evidence types need to remain prominent, with a repeatable refresh/review process. |
| Medium | **Full backup/restore is incomplete.** Roster exports can round-trip, but prescription and calculation exports have no corresponding import flow. Custom teams and sheets persist separately in browser storage; locks are session-local. | Exporting a prescription preserves a report, but does not provide a complete workspace restore or device migration. |
| Medium | **Release and maintenance work remains.** No deployment, application license or CI workflow is configured. Git history contains the initial baseline while substantial later work remains uncommitted. The main app component is large and densely written; production JavaScript is one 1.37 MB chunk, approximately 174 KB gzip. | The prototype has a passing local baseline, but repeatable release checks, maintainability and measured loading performance still need work. The chunk warning alone does not establish poor runtime performance. |

## Verification performed for this assessment

- `npm run build`: passed TypeScript checking, production bundling and the simulation-artifact exclusion check. The verifier checked 126 production files. Vite reported a large-chunk advisory.
- `npm test`: all 31 domain tests passed across three test files.
- `npm run test:app`: all 42 browser checks passed in 49.3 seconds. These are 14 flows exercised across Chromium, Firefox and WebKit, including mobile layouts, imports, custom teams, calculations, locking, fixture-based encounters and failure recovery.

These results establish a working implementation baseline. They do not establish source freshness, real-provider availability, recommendation accuracy or gameplay outcomes. No application behavior was changed during this assessment.

## Recommended next work

1. **Deliver one complete diagnostic path.** Pick a small set of reviewed archetypes and translate known account details into explicit role-specific checks and ordered actions, with source-backed conditions and unknowns. Keep investment benefit claims gated until validated.
2. **Evaluate recommendation quality.** Build an independent roster suite covering limited accounts, support conflicts, unknown builds, constellation gates and less-covered characters. Have recommendations reviewed against guide evidence and practical play constraints; measure coverage and ordering errors separately from UI correctness.
3. **Expand structured recipe conditions.** Move important constellation, equipment, application, sustain and energy assumptions out of prose-only cautions where evidence supports enforceable rules. Preserve an unknown state for incomplete coverage.
4. **Resolve the live-data dependency.** Verify a real response in the target browser/hosting environment, or provide reviewed dated encounter packs with the same provenance and expiry gates.
5. **Complete workspace backup and release basics.** Add versioned restore for accounts, custom teams, sheets and preferences; establish a committed baseline and CI. Measure load performance before deciding how to split the bundle.
6. **Publish validated offline benchmarks separately.** Start with a narrow reviewed reference profile and complete provenance. Keep reference performance separate from imported account performance and observed usage.

## Supporting repository material

The README and design document describe the product boundary. Account imports/ranking and planner integration documents describe the latest behavior and its limits. The implementation evidence is in `src/App.tsx`, `src/account.ts`, `src/CharacterEditor.tsx`, `src/RotationCalculator.tsx`, `src/knowledge.ts` and `src/planner/`. The benchmark and contract snapshots are in `src/data/`. Regression coverage is in `tests/`.
