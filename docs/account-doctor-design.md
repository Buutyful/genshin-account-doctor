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

UI direction: ivory clinic stationery, deep teal navigation, mint accents, warm gold detail, game portraits and an original adult anime doctor mascot. Diagnosis language should be helpful and actionable without presenting an invented numerical “account health” score.
