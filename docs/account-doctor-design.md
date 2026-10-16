# Genshin Account Doctor — restart decision

28 September 2026. This document supersedes the old product direction. Account Doctor has its own standalone repository. The earlier Team Atlas code and experiments remain in the separate Genshin Team Optimizer repository.

## Product decision

Start with the question “What should I do with this account?” The output is a small number of compatible teams, reasons they work, assumptions, and an ordered list of useful next steps. Artifact optimization remains a handoff to Genshin Optimizer. A usable composition is not proof of an Abyss clear.

The first release is a local, static application. It has manual roster selection, JSON import/export, readiness tracking, team recommendations, a relationship explorer, and a multi-team planner. A clearly marked demo makes the product immediately explorable. We preserve existing Team Atlas data without overwriting its storage.

## What the previous attempt taught us

The Mavuika regression was an input-model failure: wrong role, build, attacks and aura setup, followed by search prioritization that could exclude known compositions. A successful simulator run did not certify an accurate model. See [the preserved regression](research/legacy-lessons.md). Increasing brute-force volume would reproduce these errors at greater cost. The engine itself is still useful for controlled experiments.

## Representation: a graph plus team recipes

Use a **weighted adjacency list**, backed by ordinary normalized tables when we need a server. Around a hundred characters does not justify a graph database. Character IDs are stable strings at the boundary; compact integer indexes and bitsets represent owned characters and overlapping teams in the planner. Traveler elements share one account identity.

The conceptual nodes are `(character, role)` and edges carry context: archetype, encounter, constellation, source, reviewed patch, evidence type and conditions. A character-only projection powers the visual explorer. Edges are directional for retrieval: a popular support's affinity for a carry need not equal the carry's dependence on that support.

Keep three signals separate:

1. **Observed co-usage**, with population, ownership denominator, game version, mode and sampling bias. We do not have this dataset yet.
2. **Theorycraft evidence**, including explicit compatible slots, mechanics and caveats. Repeated pages from one publisher are not independent consensus.
3. **Simulation evidence**, tied to a complete rotation, equipment, encounter and engine revision. Synthetic results are not observed player performance.

This prototype uses the second signal. Ingest original unexpanded guide slots, not the 1,200+ expanded compositions: otherwise a guide listing many substitutes artificially inflates pair counts. Each slot pair distributes one unit over its alternatives; a source URL contributes at most one unit to a character pair. Distinct source URLs and contexts remain attached. The initial retrieval priority combines normalized association and support shrinkage; it is a heuristic, not a probability, usage rate or DPS score. An absent edge means unknown, not bad. Explicit anti-synergy needs its own reviewed evidence.

An edge cannot express “these three supports compete for one slot” or “this composition needs a particular reaction trigger.” Preserve **four-slot recipes (hyperedges)** with role assignments and constraints. The first implementation retrieves complete guide recipes, orders legal alternatives with the graph, and expands them with a width-24 beam. This guarantees that unrelated highly connected characters do not become a made-up team. Reviewed recipes have explanatory roles and caveats. Extracted recipes remain visibly unreviewed until conditions are checked.

Later, allow graph-neighbor substitution only through reviewed role contracts: reaction application, on-field time, energy, sustain, equipment ownership, constellation gates and enemy requirements. Reserve an exploration budget for low-evidence candidates so popularity does not permanently hide discoveries.

## Search and account allocation

Pipeline: owned roster → retrieve recipes → satisfy slots → rank team candidates → allocate disjoint teams → explain missing information and next actions.

Candidate priority is deliberately transparent: reviewed recipes first, then user-reported readiness, then graph evidence. It is not a combat-strength ranking. Unknown readiness stays unknown. The app never calls the simulation engine.

For one team, rank candidates. For two Abyss teams or three Stygian teams, use maximum-weight set packing with shared-character constraints. The prototype runs branch-and-bound on a deterministic pool capped at 128 candidates; maximize number of complete teams first, then total heuristic priority. BigInt bitsets make overlap checks cheap. This is exact within that pool, not a global optimum. A production solver can use binary variables `x[t,encounter]`, at-most-one allocation per account identity, and mode-specific restrictions in CP-SAT. Solve enemy assignment jointly; do not independently choose the best team for each side and then discover both need Bennett.

Favor a Pareto shortlist over a fabricated universal account score: estimated performance, setup cost, execution difficulty, survivability and evidence coverage are separate. Future encounter packs must include source URL, effective start/end dates, patch, enemy resistances, shields, waves and mechanics. An expired or missing pack disables current-cycle claims. The prototype's mode controls only team count and no-overlap preparation; it has no live encounter feed.

## Offline simulation and synthetic data

Keep gcsim and the old experiments in a separate research repository and publication pipeline. They must not be downloaded, built or run by the user-facing app.

1. Select representative reviewed archetypes and role-valid substitutes from the graph.
2. Curate rotations and loadouts. Validate action counts, reaction ownership, buff uptime and repeated-rotation energy against independent mechanics evidence.
3. Stratify experiments across investment, weapon accessibility, ER thresholds, enemy count and resistance. Prefer active learning: spend simulation budget on uncertainty that could change a decision, plus an explicit exploration reserve.
4. Store complete provenance: engine commit, config hash, recipe revision, equipment, seed split, encounter, diagnostics, means and intervals. Failed mechanics coverage is an exclusion with a reason, not a zero score.
5. Start with published lookup tables and interpolation only inside validated coverage. Train a small tabular surrogate only once held-out evidence justifies it; keep out-of-distribution rejection and uncertainty. A GNN is unnecessary at this scale and does not repair biased labels.
6. Split evaluation by composition/archetype and patch, not random seeds from the same simulation. Use independent finalist seeds and in-game checks. Measure top-k recall, regret, failed-rotation rate, unsupported-roster rate and calibration. Report worst-case accounts as well as averages.

## Data lifecycle and sources

Raw snapshots → source registry → parsed claims → reviewed recipes → graph build → offline experiments → versioned publication. Store raw hashes and parser/reviewer versions. Do not silently upgrade an extracted caption into reviewed advice. Support multiple publishers through adapters and deduplicate syndicated material; obtain permission for sources that restrict reuse. The first graph is explicitly KQM-only, not “many sources” or community usage statistics.

Sources checked for the initial curated recipes:

- [KQM Mavuika](https://keqingmains.com/q/mavuika-quickguide/) — carry/support distinction and team alternatives; guide says version 5.7.
- [KQM Iansan](https://keqingmains.com/q/iansan-quickguide/) — movement-dependent support and Mavuika examples; guide says Luna II.
- [KQM Neuvillette](https://keqingmains.com/q/neuvillette-quickguide/).
- [KQM Nahida](https://keqingmains.com/q/nahida-quickguide/).
- [KQM Raiden](https://keqingmains.com/q/raiden-quickguide/).
- [gcsim configuration documentation](https://docs.gcsim.app/guides/understanding_config_files/) and [CLI](https://docs.gcsim.app/reference/cli/).

The inherited roster and remaining extracted guide snapshots are dated 23 September 2026. Inheriting those files is not a new verification of every character, patch claim or guide. Their provenance and gaps remain visible.

## Stages and acceptance gates

**Now:** working UI, sourced graph, recipe retrieval, disjoint account allocation, local persistence, import/export and explicit evidence labels. No simulated numbers or invented live meta.

**Next:** review top recipes, add a second independent source adapter, make role/context edges first-class, evaluate against a held-out roster suite, add dated encounter packs with stale-data handling, and support GOOD/Enka account ingestion with explicit coverage.

**Then:** offline experiments and publication, calibrated estimates only in covered regions, and an artifact/build handoff. Current artifact inventory, weapon ownership, talent levels and actual clear capability remain unknown in the first prototype.

UI direction: flat parchment clinic stationery, charcoal navigation with star details, saturated crimson actions, aged gold and fate pink accents, game portraits and an original adult anime doctor mascot. The palette takes inspiration from The Witcher 3, with no CSS gradients. Diagnosis language should be helpful and actionable without presenting an invented numerical “account health” score.

Teams is the min-maxing workspace. Use direct labels, compact controls, flat team results and full-fill selection states. Avoid slogans, decorative selection edges, nested cards and always-open reasoning. Show the allocation, rotation order, known upgrades and concrete pull impact first; keep requirements, tradeoffs and evidence available on demand. The Guide recipes & custom teams content remains a separate workflow.


## 29 September implementation update

The next account workflow is implemented in [account imports and ranking](account-imports-and-ranking.md). It adds explicit unknown build details, previewed GOOD imports, focus-constrained recipe retrieval and conditional role-rating priors. The allocator now uses a 256-candidate pool with driver diversity. These supersede the initial 128-candidate and readiness-only descriptions above. Recipe association remains a retrieval signal, not a damage proxy. The source-backed rating snapshot and the validated synthetic benchmark channel remain separate; the latter has no published rows yet.

## 30 September UI update

The clinic uses a compact sidebar inspired by Paimon.moe, with grouped navigation, short labels, a desktop collapse control and a mobile tab bar. The checkup guides users through adding characters, finding teams and reviewing builds. Starting a personal roster clears demo search filters. The planner shows the account plan before optional character searches. Ranking controls, source links and detailed evidence remain available in expandable sections; actionable recipe cautions and the general-preparation label stay visible. The recommendation pipeline and data provenance are unchanged.


## 30 September planner integration

[Team planner integration](team-planner-integration.md) adds product-authored mechanical contracts, custom compositions, session team locks, deterministic manual rotation sheets and a live-version Abyss/Stygian adapter. Joint encounter assignment preserves shared identities and user matchup preferences. Current-cycle claims require a valid fresh pack; the provider returned HTTP 403 during live verification. Full equipment-derived simulation, validated reference benchmarks and Theater allocation remain unimplemented. This supersedes the earlier statement that mode selection only controls team count.

## 1 October account-aware builder

The [account-aware implementation report](account-aware-builder-implementation.md) supersedes the recipe-only generation and current client workflow described above. The main planner now searches owned role configurations through conditional interaction rules, retains complete guide/custom seeds, assesses build/rotation assumptions, and reassigns the account after scoped feedback. Configuration identity includes roles, builds, rotation and mechanics revision, separately from composition identity. The initial mechanics set has 19 profiles across 15 characters; unknown roles and application/energy coverage remain explicit. Search is exact inside disclosed diversified pools and checked against an independent small-pool baseline.

Reviewed encounter publications require exact bundled hashes and effective validity. Real 1 October browser access passed, but generic provider dates and the incomplete Abyss lineup cannot establish a current pack. A fresh Stygian review agrees on boss names and period labels but reveals a regional-countdown discrepancy. Stygian.moe normalization, proof/correction deduplication, contextual retrieval and grouped temporal manifests are connected. Individual attributed references can now qualify for discovery/contextual comparison independently of bulk dataset or training/evaluation use; no real pilot is bundled yet. This corrects the original overly broad source gate while preserving observed, guide and synthetic evidence as separate channels. The build, 58 domain tests and 69 browser checks passed; real live verification and the manual observed-clear pilot review remain explicit unmet acceptance gates.

## 2 October client repair

The planner opens with a usable general account plan. Reviewed complete examples, readiness and coherent roles determine selection; supported-check counts describe coverage only. Character focus and team alternatives are visible controls. Replacement controls identify uncovered substitutes before applying a request, and newer shaping requests supersede earlier ones without losing rejection history or Undo.

Challenge preparation accepts player targets and preferences, with regional persistence and workspace restore. Stygian's real provider lineup is an attributed reference with no live-date certification. Reviewed-current assignment stays separately gated. The [client repair report](team-builder-client-repair-2026-10-02.md) records the connected behavior, 63 domain tests, 81 browser checks, real browser access and the remaining coverage limits.

## 3 October account decisions

The [decision workflow report](account-decisions-2026-10-03.md) supersedes the previous general-only opening and missing pull UI. Fresh endgame sessions use exact-hash reviewed regional publications inside their certified window. Optional encounter modifiers contribute bounded preference weights alongside conditional ratings, complete guide evidence and recorded builds; they cannot independently force the allocator to abandon a much stronger supported team. Explicit player matchup preferences still take precedence. Unsupported effects remain unknown, and element presence alone cannot establish a reaction affected by competing elements.

Primary planning assigns all account teams together. Alternatives reject complete composition allocations and search with investment/sustain objectives while preserving locks, exclusions, gear and shared Traveler identities. Unreviewed mixed core ownership stays exploratory. Known upgrades are projected onto a cloned account and followed by full regeneration; unknown EM, artifacts, gear and readiness are never fabricated.

The primary Who to pull workflow compares every unowned wish character at C0 against the full baseline and build-first plan. It ranks marginal account improvements, matches teams by encounter/driver/member overlap, and reports support destinations, replacements, partner requirements, build tasks and encounter changes. A guide's unestablished constellation assumption cannot establish C0 pull priority. Banner availability uses a separate official-source/region/date gate.

Current challenge publications are checked through 10 October; the source's disputed November reset is not guessed. Published hashes, date bases and rating review remain inspectable. The 24-profile/20-character mechanics set, guide coverage, observed-clear listings and empty synthetic-performance channel remain distinct. The production build, 90 domain tests and 96 browser checks pass; no DPS, success probability or clear-time prediction is asserted.


## 4 October structure and pull cache

Team results use a main column with a selected-plan heading, three labelled complete-plan choices and one horizontal lineup per assigned opponent. Game mode, challenge/server controls and preferences live in a settings rail, collapsed above results on smaller screens. Details expose build requirements, rotations and full opponent names. Guide recipes and custom teams retain their content and controls.

Pull priorities has its own entry in Account navigation. Completed C0 studies are stored in IndexedDB with their original full-account evaluations and BigInt identities. A deterministic SHA-256 key covers the account, actual builds/equipment, planning inputs, generated configurations, baseline allocation and all recommendation publications, including the unowned characters' conditional ratings and recipe/kit evidence. Source freshness and evaluation revisions invalidate previous results; banner availability is still evaluated separately. There is no periodic cache timeout or automatic recalculation for an unchanged study. Four recent studies are retained to bound storage. An interrupted, incomplete, damaged or older-format study is never presented as completed cached advice. Storage failure leaves live comparisons usable.

## 6 October recorded-clear retrieval

The [recorded-clear implementation report](recorded-clear-finder-2026-10-06.md) adds 914 attributed, complete public Stygian.moe listings with exact snapshot provenance. Clear finder and the Recorded clears planner tab match whole observed compositions against the saved roster and listed investment, then assign all source-version bosses together. Team locks, exclusions, composition-distinct alternatives, finite physical weapon copies and shared Traveler identity apply to the full plan. Recorded times and source cost remain properties of submitted runs.

Public source moderation is a separate evidence level from independent proof/build review. Missing investment, reduced-cost metadata, unverified buff contexts and sparse archive coverage remain explicit. No simulator, synthetic score, learned model, success probability or predicted account clear time is introduced. Source archive labels cannot override regional challenge verification. Bounded search, snapshot freshness, normalization/exclusion audit and original source attribution are inspectable in the product and exports.

## 7 October Parchment Clinic UI

The user selected candidate A from the [three UI concepts](ui-candidates/2026-10-07/README.md). The implementation uses warm ivory surfaces, charcoal navigation, crimson actions and selections, aged gold team numbers, and serif page and team headings. The Team planner has four large element-tinted portraits per team, with recorded build inspection and the proposed rotation available in the same row. Recorded clears also use larger portraits while keeping listed investment, recorded run statistics and original proof links attached.

The Team planner reproduces the selected image's compact plan selector, closed details, lock/swap controls, mode header and narrow settings/next-steps rail. The selected concept PNG supplies exact artwork through CSS regions with [recorded provenance](parchment-clinic-art-provenance.md); other characters and pages retain attributed originals. Phone layouts keep four portraits per team and collapsed settings. Demo labeling appears on every page.

Recommendation generation, account identities, imports, evidence classification, source freshness and allocation constraints are unchanged. Account plans, Recorded clears and Guide recipes remain separate functional workflows. The illustrated reference lineups are not forced into account recommendations. See the [implementation and validation record](parchment-clinic-ui-2026-10-07.md).
