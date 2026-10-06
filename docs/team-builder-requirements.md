# Account-aware team builder requirements

30 September 2026. Proposed next product direction; these requirements are not an implementation claim.

The [1 October implementation report](account-aware-builder-implementation.md) records the connected client, tested coverage and unmet live/source acceptance gates against these requirements.

## Product outcome

Build teams from the player's actual roster, available builds, preferences and verified live encounter requirements. Generate and assess compositions beyond published examples. Give the player useful variants and let their feedback change subsequent proposals.

A recommendation is a team configuration: members, role assignments, loadouts, a workable rotation outline, encounter assignment, assumptions and evidence. The same four characters can have different configurations. Archetypes describe how a configuration works; they do not define a fixed list of permitted compositions. Guide recipes supply examples, search seeds, constraints and regression cases.

Reviewed player clear archives are a first-class observed-results channel. They provide scoped evidence that a configuration worked under recorded conditions, supply candidates and interaction hypotheses, and support training and independent evaluation. Stygian.moe is the first named source candidate; additional publishers should enter through the same source qualification and normalization process. Keep observed results, guide/mechanics claims, synthetic experiments and personal preferences separately identified.

The initial delivery should cover Abyss and Stygian, which already have account-allocation scaffolding. Theater needs a separate mode policy for its eligible cast, participation and resource rules; the common data model should accommodate it without claiming initial coverage.

## Required foundations

| Foundation | Required capability | Current gap |
| --- | --- | --- |
| Verified encounters | Identify the live mode, server, cycle, difficulty and objectives; normalize enemy and stage mechanics into sourced requirements. | An adapter exists, but live selection fails against the indexes fetched during this review. Enemy mechanics are mostly text and player-entered preferences. |
| Account and build state | Distinguish owned, equipped, available-to-reassign, planned and unknown resources. Evaluate the selected character role against actual build details. | GOOD observations and manual details exist; complete derived stats and equipment effects do not. |
| Character capability data | Represent multiple possible roles, application behavior, activation conditions, energy, field time, buffs, sustain and encounter utility. | Capability lists and mechanical contracts cover a small subset. |
| Conditional team interactions | Evaluate pair, three-member and whole-team effects, including enabling conditions and competition for shared resources. | The graph mainly represents recipe co-occurrence; most semantic conditions are not executable. |
| Reviewed clear evidence | Normalize source-approved runs and their conditions; retrieve relevant examples, qualify training labels and preserve proof/corrections. | No observed-clear archive adapter, source registry or qualified training dataset is implemented. |
| Configuration and rotation assessment | Check that role assignments and a proposed action schedule can work together and address the encounter. | The manual damage sheet cannot perform these checks automatically. |
| Composition search and allocation | Search owned role/build choices, preserve exploration and diversity, then solve the full multi-team encounter plan. | Generation is mostly recipe-bound, although allocation already preserves shared character identities. |
| Preference and feedback loop | Support replacement requests, character/core locks, exclusions, comfort preferences and meaningful alternatives. | Custom teams and team locks exist; rejection feedback and constrained variant generation do not. |
| Evaluation and maintenance | Measure recommendation quality, coverage, search omissions, correctness and source drift independently of UI tests. | Current tests establish software behavior, not practical recommendation quality. |

## 1. Live challenges are a release prerequisite

The endgame builder must know what it is building against. A fresh timestamp alone is insufficient: a pack must establish the correct live cycle and preserve relevant mechanics.

Required encounter fields include mode/server/difficulty, effective dates, cycle and patch, objectives and time conditions, stage/wave structure, stable enemy IDs, supplied level and HP, resistances, immunities, shields, vulnerability windows, grouping behavior and cycle modifiers where verified. Each derived requirement needs a source and a reviewed interpretation. Unavailable values remain unknown, with a coverage report describing whether the missing field affects the recommendation.

Separate verified prohibitions from strategy preferences. Resistance is not automatically immunity. A preferred element is not automatically mandatory. Hard exclusion requires an established rule that prevents the proposed configuration from satisfying its intended function; a difficult matchup can instead lower suitability or expose an unresolved requirement.

Use provider adapters, schema/version checks, exact response hashes, server time rules, expiry and a last-known verified pack that remains within its validity policy. A reviewed dated publication can establish the current challenge without requiring every user to contact the upstream provider successfully. A small external ingestion/publication service may be needed for dependable updates and enrichment; the application can still remain static. Provider availability, browser access, publication operations and permitted data reuse need verification before choosing that architecture.

When no verified current pack is available, expose current-challenge planning as unavailable. General roster exploration can remain available as an explicitly selected activity. Do not silently describe a generic plan as a plan for the live challenge.

### Concrete finding from this review

Direct unauthenticated requests on 30 September 2026 returned HTTP 200 for the manifest and both version-7.1 indexes, with `Access-Control-Allow-Origin: *`. The manifest reported `gi.live = 7.1`. This updates the earlier report of HTTP 403; it does not establish complete browser integration or the current in-game lineup.

- The Abyss index contained 26 entries; the Stygian index contained 12.
- The inspected entries supplied `begin`/`end`, with no `live_begin`/`live_end`.
- Running the existing adapter against both modes for Europe returned `No unambiguous live cycle is published for this server.`
- The referenced client models make live date fields optional, and its Stygian model labels the generic dates as beta dates. A live manifest version alone does not resolve this ambiguity. Verify index/detail date semantics and the actual regional cycle before changing the eligibility rule.

Exact index response hashes:

- `https://static.nanoka.cc/gi/7.1/tower.json`: `97aa9f2a60a3abdb5cb143409fb18192dfd32f502581ffe4540823d579817da9`
- `https://static.nanoka.cc/gi/7.1/leyline.json`: `f39a56d5d973444947665da48992d60b66d867581ac3a3c014b1f4cfa7206f0c`

The first data milestone is a real, independently checked current pack through the application in its target hosting environment, plus cycle-transition and failure tests. Fixtures should include reviewed real response shapes rather than only idealized schemas.

Stygian.moe is also a candidate for encounter enrichment: its [homepage](https://www.stygian.moe/) displays a cycle/server selector and boss cards with HP and mechanics summaries. Treat calendar claims, boss mechanics and submitted clear records as separate claims from the same publisher. Cross-check dates and boss/difficulty versions against other evidence before publishing a verified live pack. A site's successful-run archive does not establish an exhaustive current lineup by itself.

## 2. Account circumstances must affect the result

Record actual constellations, ascension, levels, talents, equipped gear, spare inventory, refinements, artifact stats/sets and observation dates. Derive combat stats only for supported effects. Keep conditionally active buffs separate from base stats; their activation belongs to the team and rotation assessment.

Allow the player to choose between teams usable with their current builds and teams within an explicit upgrade/rebuild budget. Record willingness to change equipment, raise a character, farm a set or learn a demanding rotation. Readiness remains an observation, not proof that these requirements are satisfied.

Model role-specific investment. A character's capability and required build can change with role, constellation, weapon, teammates and enemy. Ask for missing account information when it could materially change a decision. Broader unsupported build data must not receive invented estimates.

When suggesting reassigned gear, preserve item identities and disclose the proposed swaps. Shared equipment and any permitted between-stage changes must follow verified mode policies. Account export/restore should include preferences and saved configurations as well as the roster.

## 3. Synergy requires a model beyond pairwise edges

Use structured character capabilities and conditional interaction rules alongside the existing graph. A rule identifies its participants or required capabilities, activation conditions, provided effect, recipient, competing effects, build/rotation dependencies, encounter scope and evidence revision.

Useful interaction levels are:

- **Character and role:** what this build can provide, for how long and at what field/energy cost.
- **Pair:** application plus trigger, buff plus compatible recipient, battery plus energy consumer, or conflicting field requirements.
- **Three-member core:** complementary application and a reachable reaction trigger, with ownership and schedule checks.
- **Whole team:** field-time budget, energy repeatability, sustain, passive restrictions, buff coverage, overlapping sets and encounter requirements.

For example, a proposed Dendro/Hydro/Electro core needs Dendro Core creation and an attack capable of applying Electro to those cores. The fourth character must preserve that mechanism and meet the remaining account/encounter needs. Element presence alone does not establish the reaction. [KQM's reaction reference](https://library.keqingmains.com/combat-mechanics/elemental-effects/transformative-reactions) documents core creation and triggering.

Application timing and energy need their own data. [KQM's ICD reference](https://library.keqingmains.com/combat-mechanics/internal-cooldown) explains why damage hits do not all apply an element. [KQM's energy reference](https://library.keqingmains.com/combat-mechanics/energy) distinguishes particle generation, collection and flat energy effects.

Keep evidence states explicit: supported, contradicted by an established condition, or unresolved. A path A–B–C in the graph is a discovery hint, not proof that A, B and C form a functioning core. Guide co-occurrence, reviewed mechanics, player observations and synthetic measurements stay separate. New generated teams need a trace of the rules that justify them.

Full-team clear observations can nominate pair and core interactions for review, including teams absent from guides. Preserve the complete observed configuration and encounter when deriving these signals. Association within successful teams does not isolate a character's contribution or prove that a new combination of their members will function.

Provide a coverage view for every roster entry: supported role profiles, supported effects, sources, review patch and outstanding unknowns. This exposes the data work needed to expand toward full-roster coverage.

## 4. Generate and assess configurations

Start from encounter requirements, player inclusions and plausible interaction cores. Expand using owned characters and their supported role/build choices. Also allow distributed or quick-swap configurations whose schedule does not depend on one fixed carry. Evaluate partial candidates to prune established conflicts while reserving exploration for less-connected characters and unfamiliar cores.

After assembling four members, propose a rotation outline and check required attack types, application and trigger ownership, field windows, cooldowns, buffs, energy and sustain. If a requirement is only approximately covered, expose the assumptions and range. Distinguish a mechanically supported candidate from a configuration still requiring validation.

Give configurations stable IDs that include role/build/rotation revisions where relevant. Retain a separate composition ID for the four members. The present sorted-member key is insufficient to distinguish different uses of the same composition.

Evaluate separate dimensions: encounter suitability, energy/rotation feasibility, survivability, execution difficulty, current-build fit, upgrade cost, user preference and evidence coverage. Return a small set of useful tradeoffs. Estimated damage only enters comparisons where the underlying model or publication supports the exact assumptions; editorial tiers do not become a damage proxy.

Solve the full account plan jointly. Preserve Traveler's shared identity, locked choices, mode restrictions and proposed equipment assignments. For Abyss, assess each half's fixed composition against all its chambers. Replacing one team must explain any necessary changes to the other allocations.

Use exact comparison for small pools to evaluate search quality. For larger search spaces, disclose caps and measure whether pruning loses workable or preferred teams. Retain guide seeds as regression anchors without making their membership a universal eligibility condition.

## 5. Feedback changes the next search

The builder should offer three clear actions: a variant that retains the selected core, an alternative with a different playstyle, and a revised complete account plan. A replacement must preserve encounter coverage and explicit locks; changing a team may require reallocating scarce supports across the account.

| Player feedback | Expected behavior |
| --- | --- |
| “Keep these two characters; replace this teammate.” | Lock the specified core, generate substitutes and reassess the whole configuration. |
| “I don't enjoy this character.” | Exclude them at the player's selected scope, then reallocate teams and scarce supports. |
| “Too hard to play.” | Favor lower execution demands and explain the resulting tradeoffs. |
| “I want more healing / fewer rebuilds.” | Adjust the stated preference or budget and show what changed. |
| “Show something different.” | Return structurally diverse choices, including different cores or field patterns, where supported. |
| “Just skip this team.” | Suppress that proposal for this search; do not infer a permanent dislike of all its characters. |
| “I tried it and couldn't keep the Bursts ready.” | Record a player-reported outcome tied to build, rotation and encounter; expose an energy check and offer repairs or alternatives. |

Store feedback as explicit session, cycle or persistent preferences, with undo/reset and a visible explanation of active constraints. Separate a rejected configuration from a rejected composition, character or playstyle. When no supported plan satisfies the constraints, explain the conflicting requirements and offer specific relaxations; let the player choose which restriction to change.

Natural-language feedback can translate into the same structured preference model used by buttons and controls. It should produce visible edits to that model. A language model can assist interpretation and explanation; factual rule evaluation and allocation remain reproducible.

Personal feedback can remain local for the initial release. Future opt-in research telemetry must preserve context and distinguish preference, observed failure and verified correction. Likes/dislikes are not combat measurements and should not silently change global mechanical rules or rankings.

## 6. Reviewed player clears, learning and source lifecycle

### Source qualification: Stygian.moe first

As inspected on 30 September 2026, [Stygian.moe's About page](https://www.stygian.moe/about) describes an archive assembled from public videos and community submissions, with manual entry and review. It acknowledges errors and incomplete coverage. Its [clear listings](https://www.stygian.moe/clears) expose time, cost, characters, constellations and weapon refinements. Its [statistics page](https://www.stygian.moe/statistics) reported 8,251 clears; this is a publisher-reported archive count, not a count of unique, training-qualified samples.

The [submission guide](https://www.stygian.moe/guide/submission-guide) requires successful-run video proof, provides review statuses and a trusted-submitter queue, and defines tags for missing builds, execution conditions and tools. It also permits reduced-cost entries whose displayed investment can differ from actual investment. Dummy runs have a distinct protocol. These details require record-level eligibility rather than assuming that every published row has complete builds or identical verification.

The public pages inspected did not establish a documented bulk API/export or an explicit training-data reuse license. Qualification must establish supported access, permitted retention/training/publication, attribution, refresh behavior and correction handling. The [terms](https://www.stygian.moe/terms-of-service) and [policies](https://www.stygian.moe/policies) are source-audit inputs. Prefer a documented export/API or an agreed publisher feed. This planning update does not authorize contacting the publisher or establish an integration agreement.

For every additional source, record its publisher, evidence types, original-proof lineage, review standards, access method, coverage and known biases. Two sites linking the same video are one gameplay observation with multiple archive references, not independent confirmations.

### Normalized clear record

Retain raw permitted snapshots and source hashes outside the shipped application dataset; publish a compact versioned evidence pack with attribution. Each record should distinguish observed fields, publisher interpretations and our derived annotations:

| Record group | Required representation |
| --- | --- |
| Provenance | Publisher/source record ID and revision; archive URL; original proof URL and relevant timestamps; fetched/reviewed dates; snapshot hash; attribution and access policy. |
| Encounter | Mode, patch, cycle where established, server where known, boss ID and boss variant, difficulty, stage/wave, modifiers and starting conditions. Version alone is insufficient when bosses recur. |
| Configuration | Full team, observed roles, constellations, weapon/refinement, levels/talents, available artifact/set/stats evidence, rotation/action annotations and equipment effects. Every field carries completeness/provenance. |
| Investment | Actual showcased values separate from effective/reduced-cost metadata and the publisher's cost convention. Unknown actual values remain unknown. |
| Outcome | Successful clear, reported time and timing convention, separately measured dummy DPS where supplied, attempt count if genuinely available, and source verification status. |
| Execution | Platform/input/ping/frame conditions where supplied; demanding combos, special tactics, tools and other source tags. Preserve original tags and our interpretation separately. |
| Lifecycle | Publication/edit/retraction state, last proof-availability check, deduplication group, parser/reviewer version and eligibility reasons for each intended use. |

Read roles and rotation from supported evidence rather than assigning a universal driver from slot order. Video/build extraction, whether manual or assisted, needs reviewed annotations with timestamps; unreviewed extraction is not a verified combat label. Source rejections for metadata or moderation reasons are not failed combat attempts.

### Evidence eligibility and account transfer

Define eligibility separately for composition discovery, conditional interaction review, build-aware comparison, model training and held-out evaluation. A visible successful clear with incomplete builds can support a scoped existence example while remaining ineligible for precise build/performance transfer. Publicly published status alone does not certify every field. Broken proof, corrections and retractions update eligibility and any affected published packs/models.

When retrieving an example for a player, compare encounter version, difficulty, actual build coverage, constellations, weapon effects, starting conditions and execution demands. Explain matches, differences and unknowns. A weaker or different account is not automatically incompatible, but the example cannot certify its clear time. Boss clear time and dummy DPS are separate targets; HP divided by time is not a universal damage label. Archive cost is not an upgrade-resource budget.

Source-approved observations are a reference for the specific recorded runs. Their transfer to different gear, new teammates or a new cycle is a separate hypothesis requiring mechanical checks and validation. Maintain current and historical packs separately; older runs can inform stable mechanics when reviewed, without becoming current-cycle observations.

### How this trains the team builder

1. **Begin with retrieval and evidence-backed search.** Index qualified configurations by encounter, capabilities and investment. Retrieve relevant successful cores and rotations, then generate account-compatible variants through the mechanical evaluator. This makes the observed-results channel useful before any learned model is qualified.
2. **Construct contextual training features.** Use role/build capabilities, conditional interaction coverage, encounter mechanics and execution conditions alongside team members. Retain record completeness and source lineage; keep guide claims, empirical outcomes, synthetic results and preferences in separate channels and targets.
3. **Learn only targets the records support.** Start with conditional retrieval/ranking or clear-time comparisons within sufficiently comparable encounter/build strata. Do not turn a success-only archive into calibrated success probabilities or population usage rates. Its missing teams are unlabeled; repeated speedruns and optimized submissions require sampling controls.
4. **Measure generalization without leakage.** Deduplicate proof/run identities across publishers. Group repeats and creator/build series before splitting. Test on held-out compositions/cores, creators and later cycles/patches, with frozen source snapshots and temporal cutoffs. Report limited-budget and less-covered cases separately. A second archive of the same run is not a held-out test.
5. **Publish after validation.** Compare the learned approach against retrieval-plus-mechanical-check baselines. Require demonstrated improvement, uncertainty/out-of-coverage handling and preserved hard constraints. Training runs and research tooling stay outside the app; publish compact versioned results/models with dataset hashes, eligibility filters, feature/label revisions, split definitions, code revision and evaluation results.

The [submission criteria](https://www.stygian.moe/guide/submission-guide) accept successful runs only. This establishes a concrete selection limitation: attempt denominators and ordinary failures are absent from those submissions. Independent outcome collection is needed before claiming reliable clear probabilities. Preferences and source moderation approval rates cannot supply those denominators.

Track sparse coverage by boss, role, build/investment, playstyle and patch. Reserve exploration and independent testing for novel configurations, so the engine can expand beyond the archive while clearly reporting which proposals have observed backing.

### Acceptance gate for the first source

Establish a supported, permitted source feed; build a reviewed pilot pack with proof references and recorded completeness; resolve duplicates and actual-versus-reduced investment; map runs to reviewed encounter variants; demonstrate an account-matched example and an explained generated alternative. Publish source attribution and limitations. Only then qualify a separate training subset and evaluate a learned ranker against an independently held-out set. No bulk ingestion, video downloading or training was performed in this planning update.

## 7. Performance evidence and validation

Real team building needs feasibility assessment before it can promise performance. Begin with sourced role, encounter and rotation checks for an explicitly supported coverage set. Full reaction/build coverage is a substantial data and validation effort, not merely a new search algorithm.

Offline simulation and research remain outside this application. Publish only validated versioned results with exact engine/config, role, gear, rotation, encounter, samples and uncertainty provenance. [gcsim's documentation](https://docs.gcsim.app/) describes its combat/energy/reaction outputs and the need to check results. Lookup/interpolation or a learned evaluator can extend coverage only after held-out validation; unsupported compositions must retain uncertainty rather than inherit fabricated damage.

Required evaluation includes known functioning teams, known mechanical conflicts, flexible mixed-role teams, limited rosters, build-dependent choices, constellation boundaries, unfamiliar characters, support conflicts, current-cycle transitions and repeated feedback requests. Compare against independently reviewed decisions and practical play where available. Track feasible-team recall, unsupported-mechanics rate, preference compliance, alternative diversity, search latency and omission rate. Assess ranking regret/calibration only where trustworthy performance labels exist. User satisfaction and clear success are separate outcomes.

## Delivery order and acceptance gates

1. **Verified challenge publication.** Establish real cycle semantics and browser/hosting compatibility; publish normalized reviewed requirements with provenance and expiry. Verify cycle rollover and stale-data behavior.
2. **Reviewed player-result source registry and pilot.** Qualify Stygian.moe access and review semantics, normalize a permitted pilot pack with proof/build coverage, deduplicate it and cross-check encounter enrichment. Evaluate additional publishers through the same process.
3. **Account, capability and interaction schemas.** Add role/build profiles, conditional team rules and explicit coverage/unknown states. Choose an initial coverage set that includes multiple interaction mechanisms and alternative field patterns, with a clear route to full-roster coverage.
4. **Configuration feasibility and open composition search.** Use qualified clears as retrieval seeds and comparison evidence; generate justified candidates absent from recipes and archives, preserve known good examples, demonstrate that different account builds and encounters change results, and allocate teams jointly.
5. **Feedback and alternatives.** Support exclusions, core locks, comfort/budget preferences, structural diversity, undo and persisted scope. Reject a proposed team and obtain an explained replacement without breaking the account plan.
6. **Independent quality validation and performance expansion.** Qualify grouped and temporally held-out observed-result datasets, evaluate learned ranking against the mechanical/retrieval baseline, and establish recommendation quality before broader performance claims. Publish offline measurements separately and maintain ongoing source/kit/encounter review.

The first complete milestone is: verified live challenge + actual roster/build constraints + justified generated team + feasible rotation outline + explained variant after rejection + valid allocation of the remaining account. Exact DPS and full-roster mechanics coverage have their own acceptance gates.

## What we retain from the current implementation

Reuse the account/import boundary, stable roster identities, source attribution, graph retrieval, disjoint allocator, encounter cache/provenance handling and custom-team UI. Extend candidate/configuration identity, introduce structured capability/interaction/encounter rules, and add feedback constraints to search and allocation. Preserve complete guide constraints when a guide example is used.

This document defines the work before implementation. No application behavior or live-data eligibility rule was changed during this planning task.

## Sources inspected

- [Hakushin client and maintenance notice](https://github.com/seriaati/hakushin-py).
- [Abyss models](https://raw.githubusercontent.com/seriaati/hakushin-py/main/hakushin/models/gi/abyss.py), [Stygian models](https://raw.githubusercontent.com/seriaati/hakushin-py/main/hakushin/models/gi/stygian.py), and [request/version handling](https://raw.githubusercontent.com/seriaati/hakushin-py/main/hakushin/clients/base.py). These describe the client assumptions, not independent proof of live regional dates.
- Direct manifest/index responses recorded above; detail lineups and full browser integration were not certified in this task.
- KQM mechanics and gcsim documentation linked beside the requirements they inform.
- Stygian.moe [homepage](https://www.stygian.moe/), [About](https://www.stygian.moe/about), [clear listings](https://www.stygian.moe/clears), [statistics](https://www.stygian.moe/statistics), [submission guide](https://www.stygian.moe/guide/submission-guide), [policies](https://www.stygian.moe/policies) and [terms](https://www.stygian.moe/terms-of-service), inspected on 30 September 2026. Named source candidate; no integration or training qualification is implied.
