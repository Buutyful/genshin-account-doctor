# Astra implementation handoff — account-aware team builder

Work in `C:\Users\mante\OneDrive\Documenti\ChatGPT\Genshin Account Doctor`.

Implement the first complete account-aware, challenge-aware team-builder milestone described below. This is an implementation task: inspect, make changes, validate them and document the result. Start with a short implementation sequence, then execute it. Continue through routine implementation decisions without repeatedly asking for confirmation.

## Read first

Read the repository's AGENTS.md and README.md, then these documents under its docs directory:

- account-doctor-design.md
- team-builder-requirements.md — the detailed product and evidence requirements
- team-planner-integration.md
- account-imports-and-ranking.md
- project-status-2026-09-30.md

Inspect the actual source and git status. The working tree contains substantial existing uncommitted and untracked implementation: preserve it. Work from the current files rather than the initial committed baseline. Reverify date-sensitive external information; recorded network results and source counts are observations from 30 September 2026.

## Product objective

Produce justified team configurations using the player's owned roster, actual builds, verified live challenges and explicit preferences. Generate compositions beyond published recipe membership. Archetypes describe candidate mechanisms; recipes and reviewed player clears provide evidence, seeds and validation cases.

A configuration includes members, assigned roles, selected build/loadout assumptions, a rotation outline, encounter assignment, supporting evidence and unresolved requirements. Support multiple configurations of the same four characters. Reassess the full account allocation when a player asks for a replacement.

Prioritize Abyss and Stygian. Deliver a defensible initial mechanics coverage set and a clear path to expansion; do not claim full-roster coverage prematurely. Reuse the existing imports, identities, allocator, provenance, caching and useful UI. Inspect the planner, encounter adapter, account model and calculator to identify integration points.

## Required implementation

### 1. Establish real current-challenge awareness

Verify the upstream responses, cycle semantics, regional dates and target browser/hosting access. A previous direct check returned HTTP 200 for the Nanoka manifest and version-7.1 indexes, but the existing adapter rejected both indexes: its required live_begin/live_end fields were absent, while begin/end were present. Referenced client models make live dates optional and distinguish beta dates in places. Do not simply treat generic dates as live without supporting verification.

Normalize sourced encounter requirements: cycle/server/difficulty/objectives, stable enemy and variant IDs, stages, supplied HP/levels, shields, resistances, vulnerability windows and modifiers where verified. Record missing coverage, sources, exact hashes and effective dates. Make relevant mechanics executable requirements with reviewed interpretation, rather than relying entirely on player-entered element preferences.

Support a verified dated publication/cache as well as appropriate provider adapters. Expired, future, ambiguous or invalid data must disable current-challenge recommendations; expose general exploration explicitly. Test actual response shapes and the real browser flow. Fixture success alone cannot satisfy live verification.

### 2. Add reviewed clear evidence, starting with Stygian.moe

Inspect https://www.stygian.moe/ and its About, submission guide, policies, terms, clear listings and boss guides. Treat it as the first source candidate in a multi-source observed-results registry. Establish supported access and permitted use before bulk collection or training. No documented bulk export/API or training reuse agreement was established in the planning review. Do not contact publishers or deploy services without separate authorization.

Implement the normalized record/import/publication boundary, source adapter contract, attribution, deduplication and per-use eligibility. Build a small real pilot where supported and permitted access can be established. Otherwise implement the useful ingestion boundary and clearly labeled fixtures, documenting the unresolved source dependency rather than fabricating production records or stopping unrelated work.

Preserve source/proof IDs and URLs, review/edit state, encounter/version/difficulty, full team, actual constellations and weapons/refinements, build completeness, rotation evidence, time conventions, execution tags and snapshot provenance. Keep actual showcased investment separate from reduced-cost metadata. Deduplicate the same original run across publishers. Corrections, broken proof and retractions must update eligibility.

Stygian.moe accepts successful submissions only. Missing teams are unlabeled; source rejection and moderation approval rates are not combat outcomes. Separate discovery eligibility from build-aware comparison, training and evaluation eligibility. Boss clear times, dummy DPS, guide claims and synthetic measurements remain distinct signals. Match archived examples to account and encounter conditions, explaining differences and unknowns. Cross-check its calendar/boss information before using it to enrich the live pack.

### 3. Implement conditional mechanics and account assessment

Introduce typed, sourced capability profiles for multiple character roles/builds and conditional pair/core/whole-team interaction rules. Include application/trigger behavior, relevant attack requirements, energy, field-time demands, buffs, sustain and encounter utility for the initial coverage set.

Represent checks as supported, contradicted by an established condition, or unresolved. Preserve unknowns. Element presence, graph connectivity and guide co-occurrence cannot certify a rotation. Hard exclusions require supported constraints.

Use actual levels, talents, constellations, weapons, artifacts and observed stats where the model supports their effects. Derive supported base/equipment stats separately from conditional buffs. Model current-build versus explicit rebuild/upgrade allowances. Preserve equipment identities and apply verified mode policies to proposed swaps. Do not convert build details or readiness into invented generic damage multipliers.

Choose pilot coverage spanning multiple interaction mechanisms and an alternative field pattern. Provide a coverage report listing supported roles/effects and unresolved mechanics. Unknown characters may remain inspectable without receiving invented mechanical certification.

### 4. Generate and evaluate open configurations

Generate candidates from owned characters and role/build choices, using encounter requirements, player inclusions and interaction cores. Use recipes/qualified clears as seeds, with exploration for less-connected choices. Show at least one justified generated configuration absent from the recipe set; do not only expand a fixed list of named archetypes.

Assess a proposed rotation outline for field time, cooldowns, application/ownership, activation requirements, energy and sustain within documented coverage. Keep unresolved assumptions visible. Assign a configuration ID distinct from composition identity so different roles/builds/rotations can coexist.

Compare encounter suitability, build fit, feasibility, survivability, execution demands, investment and evidence coverage transparently. Keep performance claims gated by qualified evidence. Allocate the entire account jointly, preserving Traveler's shared identity, mode restrictions, team/core locks and relevant equipment assumptions. Assess each Abyss half across all its chambers. Disclose and evaluate search limits.

### 5. Implement player feedback and meaningful alternatives

Provide controls for retaining a character/core, replacing a teammate, excluding a character, favoring easier execution or greater sustain, limiting rebuilds and requesting a different playstyle or complete account plan.

Distinguish a same-core variant from a structurally different alternative. Skipping a team suppresses that proposal at the selected scope; it does not silently blacklist all its members. Persist explicit preferences with session/cycle/account scope, show active constraints and provide undo/reset.

Re-run mechanical checks and account allocation after feedback. Explain changed members, remaining assumptions, encounter coverage and any impact on other teams. Do not repeatedly return a rejected proposal while supported alternatives remain. If constraints are incompatible, explain the conflict and let the player choose a specific relaxation.

### 6. Build the learning/evaluation boundary

Make qualified observed results immediately useful for contextual retrieval and comparison. Implement dataset eligibility, feature/label definitions, grouping and split manifests so a learned ranker can be trained responsibly later.

Training/evaluation splits must prevent duplicate-run leakage and assess held-out compositions/cores, creator/build series and later cycles. Record source snapshots, hashes, coverage and temporal cutoffs. Compare against the mechanical/retrieval baseline. Success-only data cannot support calibrated success probabilities without independent attempt outcomes.

Keep simulation binaries, training jobs, runtime research workers and research checkouts outside this app. Publish only validated compact results/models with exact provenance. Fit a learned model only if access, labels and evaluation support it; an empty or inadequate dataset should leave that feature explicitly unavailable. Completing this milestone does not require inventing a model or automatic account DPS.

## Acceptance checks

- A real verified live pack drives encounter-aware choices; stale or ambiguous data cannot drive current-cycle claims.
- Actual account/build differences change documented eligibility, checks or selection where supported.
- Open generation produces a mechanically justified configuration absent from the recipe set, while retaining known working examples and complete source constraints.
- Whole-team tests catch cases where individually plausible pairs conflict on field time, reaction ownership, energy or a sourced restriction.
- Multi-team plans preserve shared account identities and explicit locks; small-pool allocation/search results are checked against an independent exhaustive baseline.
- Feedback produces useful variants and structurally different alternatives, preserves requested cores/exclusions, supports undo and explains changes to the account plan.
- Observed-result ingestion preserves attribution, actual/reduced investment distinctions, unknown builds, deduplication and correction handling. Fixtures are clearly separated from production evidence.
- Training manifests prevent duplicate/temporal leakage, withhold unsupported labels and report sparse coverage.
- Browser flows cover imports, live refresh/failure/expiry, generated teams, feedback, persistence, export/restore and mobile layouts.

Run npm run build, npm test and npm run test:app. The last recorded baseline was 31 domain tests and 42 browser checks across Chromium, Firefox and WebKit; establish the actual current baseline before changes. Add meaningful tests for the new contracts and behavior. Update documentation to describe the implemented state and residual coverage accurately.

## Execution and completion

Complete a working vertical slice: verified live encounter + real account constraints + justified generated team + rotation outline + explained alternative after rejection + valid remaining account allocation + scoped supporting evidence.

If external access or verification prevents a gate, continue independent implementation and report that gate as unmet. Do not substitute fixtures for live proof or silently lower the evidence standard. Make routine reversible code decisions autonomously; ask only for consequential missing information or separately required authorization.

Keep progress updates concise and concrete. Finish with implemented behavior, checks and counts, real source/live-verification evidence, remaining limitations and exact next blockers. Do not stop at another design document or present incomplete acceptance gates as achieved.
