# Account-aware builder implementation

1 October 2026. This records the implemented client and its verified limits. The complete live-evidence acceptance gate in the Astra brief remains unmet; the independent application work is implemented and connected. The follow-up source qualification below corrects the initial overly broad restriction on individual clear references.

## Client workflow

Team Planner opens **Account-aware builder** by default. It uses the same imported/manual account, character build editor, equipment snapshot, game mode, server, custom compositions and guide locks as the existing application. **Guide recipes & custom teams** is a separate reference tab; focused character searches open that tab. Its prescription export remains separate from the new builder export.

The planner now starts in **Explore general teams**, so a failed challenge feed does not prevent account recommendations. **Build against a challenge** supports player-entered opponents and utility preferences; Stygian also offers the real provider lineup as an attributed reference. Reference selection strips generic date fields and cannot qualify as a live pack. **Verified current challenge** remains an explicit, separate activity and produces no current-cycle teams without a verified pack. The demo label remains visible until a personal roster is imported or created. The [client repair report](team-builder-client-repair-2026-10-02.md) explains the corrected workflow.

Each configuration shows its four members, assigned roles, current or planned build assumptions, proposed rotation, individual check states, equipped observations, source links and encounter coverage. The same composition can have multiple drivers or current/planned configurations. Configuration identity includes account/build/equipment observations, assigned profiles, rotation and mechanics revision; composition identity remains the sorted four-character key.

The controls support retaining selected characters together, a same-core variant, replacing one teammate while keeping the other three, a different core and playstyle, a different complete plan, exact configuration locks, character exclusions, and separate composition/configuration skips. Every action reassesses the whole account allocation. Changes to other teams and unresolved encounter checks are explained. Conflicts remain visible with specific removable preferences; no request is silently relaxed.

Feedback has session/mode/server, cycle/server, or account scope. Cycle scope requires the verified-current activity and a current pack. Session feedback is kept in session storage; cycle/account feedback is kept in local storage. Undo, removal and reset are available. Easier execution and sustain preferences are transparent heuristics; maximum planned rebuilds is enforced across the entire account plan. A newer replacement/variant/alternative request supersedes the earlier shaping request for that target, while preserving rejected compositions and the original history for Undo. Earlier requests can also be removed specifically. These are local preferences, not combat outcomes or global training labels.

**Export builder plan** records configurations, checks, preferences, encounter provenance and search coverage. **Export workspace backup** includes account details and inventory, server, custom teams, locks, preferences, rotation sheets, imported evidence and builder options. Restore validates the whole file and previews it before applying, then regenerates checks. Storage rollback is tested for an interrupted write. Evidence imports cannot grant source permission or establish encounter verification.

## Mechanics and account coverage

The pilot has **19 role profiles across 15 characters**, with KQM guide URLs and exact source snapshots in `src/data/mechanics-provenance.json`. Rule review is dated 30 September; source accessibility was rechecked on 1 October. Guide access and a live manifest version do not establish full current-patch rotation coverage.

| Character | Covered role outline |
| --- | --- |
| Nahida | Dendro normal-attack driver; off-field Dendro |
| Kuki Shinobu | Skill-based EM core trigger and healing |
| Raiden Shogun | Off-field EM core trigger; Burst driver |
| Xingqiu, Yelan | Normal-input coordinated Hydro |
| Barbara | Hydro healing driver; healing support without assumed sustained off-field Hydro |
| Sucrose | Swirl normal-attack driver; Swirl/grouping support |
| Fischl | Off-field Electro, with refresh energy unresolved |
| Beidou | Hit-triggered Electro discharge |
| Neuvillette | Charged-attack Hydro carry |
| Furina | Hydro, HP drain and conditional damage-buff assumptions |
| Bennett | Healing and ATK support |
| Xiangling | Off-field Pyro |
| Kaedehara Kazuha | Swirl/grouping support |
| Zhongli | Shield support |

Checks distinguish **supported**, **contradicted**, and **unresolved** conditions. Hard exclusions cover distinct owned identities, the proposed attack activation, conflicting Raiden/Beidou windows, competing assigned core triggers and impossible schedule arithmetic. Nilou/Chevreuse restricted-passive conditions are checked when present, but do not prohibit uncovered alternative roles. Guide seeds retain their original slots, explanations, cautions and sources; an uncovered character is not certified incompatible.

Current observations affect configuration identity and supported checks: trigger level and recorded EM, Kuki constellation/duration, Neuvillette constellation/reaction-stack caveats, talent-dependent healing unknowns, actual weapon details, equipped artifact sets and partial substat totals. A level-80 Kuki build and a level-90 build produce different check states and build-fit priority. Planned level-90/EM rebuilding is explicit; it leaves the original observation intact and does not invent resulting stats, gear or resource costs.

Equipped GOOD rows retain snapshot-local `weapons:index` / `artifacts:index` identities. They stay with their recorded owner. The allocator preserves shared Traveler identity and prevents equipment duplication. Item reassignment remains unavailable without a verified mode policy and compatible loadout model.

Rotation outlines assume two seconds per support and ten seconds for a driver; these are product scheduling assumptions. Covered cooldowns determine the proposed repeat interval. Explicit supplied particle/flat-energy budgets can be checked against repeat-loop Burst costs by the domain API. The normal builder has no measured particle budget and leaves repeatability unresolved. It does not reuse starting Energy as repeat-loop income.

Application rate/ICD, exact animation timing, enemy movement, complete reaction ownership, buff uptime, healing throughput, full weapon passives, artifact main-stat tables, derived total combat stats and clear capability remain outside this pilot. No generic damage multiplier or automatic account DPS is assigned to build readiness. Survival, ease and investment are separate dimensions with stated assumptions.

## Open generation and search

Owned four-character combinations are explored through covered role choices and interaction predicates: reachable Dendro cores and a Skill trigger, Swirl normal-attack driving with Hydro/Electro, Burst windows with Hydro/Pyro support, and charged carries with covered shield/Swirl support. Guide recipes and custom compositions remain seeds, without defining every eligible composition.

The browser regression imports Nahida / Xingqiu / Kuki / Fischl and obtains a generated configuration absent from the guide recipe set, with sourced core creation, trigger assignment, normal-input activation and visible unresolved application/energy checks. A subsequent character-level edit updates the configuration and assessment. This is a justified conditional proposal, not proof of an in-game clear.

Generation defaults to a cap of 6,000 owned combinations, with a domain maximum of 20,000. The current 15-character pilot is smaller than that cap. The joint allocator diversifies a nominal pool of 48 configurations per side and reserves space for locks and requests; mandatory reserves can increase a pool. Actual pool sizes, omitted configurations and visited nodes are displayed and exported.

Allocation maximizes filled teams, then reviewed encounter fit/user preferences, then reviewed whole-team evidence, declared readiness and role coherence, with penalties for established build gaps, mixed reaction ownership, missing covered healing for Furina, and requested rebuilds. Comfort weights remain explicit heuristics. Mechanics check counts describe coverage and no longer rank teams. These points are selection preferences, not combat strength. Search is exact within the disclosed pools, not globally optimal over all configurations. Independent exhaustive subset enumeration checks small two- and three-team cases. All chambers of an Abyss half stay attached to the same assigned team. Reviewed executable requirements carry stage, kind, interpretation, URL, SHA-256 and review date; unreviewed enemy prose and element presence do not become hard matchup rules. Player element/weapon preferences can use roster identity directly, while mechanical requirements still require covered effects.

## Real sources and live verification

The read-only audit is reproducible with `node scripts/verify-builder-sources.mjs --browser` while the local `/doctor/` test server is running. `--browser-only` reuses the exact direct-response audit and repeats real browser access. No network routes are mocked in that audit.

The checked-in [source audit](verification/account-builder-source-audit-2026-10-01.json) records **31 direct HTTP 200 responses** on 1 October, including Nanoka, Stygian.moe source/policy/clear/guide pages, the referenced Hakushin client model, and 17 KQM guides. Every direct response has an exact byte hash. The Nanoka manifest reports `gi.live = 7.1`; its two indexes and two candidate detail responses have permissive CORS headers.

| Response | Actual finding | Eligibility consequence |
| --- | --- | --- |
| Abyss index | 26 entries; zero with explicit `live_begin/live_end` | Generic dates cannot certify a regional live cycle |
| Stygian index | 12 entries; zero with explicit live dates | Same live-date gate remains blocked |
| Abyss generic-date candidate 123 | Three Floor 12 chambers with objectives/levels/modifiers, but every enemy list is empty | Reject with the specific missing-lineup error |
| Stygian generic-date candidate 5269012 | Difficulty 6 and three variant IDs/mechanics; generic period ends 11 November | Usable as an attributed reference target; generic dates cannot establish live regional validity |

The initial review relied on an older Stygian.moe calendar conflict. A [fresh follow-up](verification/stygian-followup-2026-10-01.json) now confirms that the visible period label agrees with Nanoka (30 September–11 November) and the three boss names agree. However, the site's regional countdown implies an earlier ending: approximately `2026-11-10T02:59Z` for Europe, corresponding to 10 November 03:59 server time, rather than the provider's 11 November 09:59:59. Asia and America show the same roughly 30-hour discrepancy after applying their server offsets. Countdown deadlines are inferred from the actual visible UI with about one-second precision. This is a narrower, current conflict; it still prevents exact regional validity from being certified. Reproduce it with `node scripts/verify-stygian-calendar.mjs`. No reviewed production encounter pack is published.

Chromium, Firefox and WebKit made real manifest/index/detail requests from the static local `/doctor/` origin, all HTTP 200. Each now opens with two general Abyss teams, refuses ambiguous verified-current recommendations, and produces three Stygian teams in general exploration and reference-target preparation. The real reference shows all three provider boss names. All three engines recorded zero page errors. The running Vite development client was also checked separately. This establishes source/browser accessibility and usable preparation behavior. It does **not** establish a live pack or access from an eventual deployed origin; deployment is not configured.

`tests/fixtures/nanoka-response-shapes.json` retains the captured shapes and source hashes with `fixture: true` and an explicit shape-only scope. Domain tests reject both actual indexes and the incomplete Abyss detail, while successfully normalizing the Stygian structure. Other complete encounter fixtures exercise assignment, refresh/failure, expiry, server handling and transition behavior; they do not substitute for live verification.

The dated publication boundary accepts only exact bytes listed by SHA-256, mode/server and publication ID in the bundled review registry. Its review validity, start/end dates, source lineage and coverage are validated separately from fetch time. An imported or cached self-declared publication is not trusted. The publication registry is intentionally empty until a real pack is independently checked.

## Reviewed clears and learning boundary

Stygian.moe is the first source registry entry and normalized-export adapter. Its public [About](https://www.stygian.moe/about), [submission guide](https://www.stygian.moe/guide/submission-guide), [policies](https://www.stygian.moe/policies), [terms](https://www.stygian.moe/terms-of-service), clear listing and selected boss guides were inspected. The terms describe informational/community reference use. The app now allows individually reviewed, attributed references for discovery and contextual comparison, subject to proof and build eligibility. The initial implementation incorrectly used missing bulk/export and training qualification to disable these individual uses as well; that restriction has been corrected. This source-use decision does not establish bulk collection, archive redistribution, training or evaluation rights. Those uses remain unqualified. **Production observed records bundled: zero**; the manual proof/build review needed for a real reference pilot has not been completed. No publisher contact, bulk collection, service deployment or training was performed.

The normalized boundary retains source/proof IDs and URLs, original run identity, review/edit/retraction state and revisions, encounter patch/cycle/variant/difficulty, full team, actual investment, reduced-cost metadata, actual artifact/stat completeness, rotation evidence, time convention, execution tags, snapshot hash and parser revision. Reduced-cost investment never fills unknown actual investment. Imports are previewed and stored without promoting their eligibility.

Reconciliation applies corrections, joins original runs across publishers by canonical proof/segment or original ID, retains attribution copies and quarantines broken/retracted/conflicting evidence. All correction/temporal comparisons use actual timestamp instants, including offset timestamps. Fixtures are always excluded from production eligibility.

Qualified records can nominate whole configurations and provide contextual references through the same account checks. Exact build-aware comparison currently remains unavailable when complete artifact/combat-stat equivalence cannot be established by the account model; differences are reported instead of treating a showcase as a predicted clear. There are no bundled real records yet; a reviewed individual publication imported by the user can now reach this path without granting training/evaluation eligibility.

Evaluation manifests group connected duplicate proofs/runs, compositions, cores, creators and build series before splitting. Any member with later cycle/snapshot/review evidence moves the whole group beyond the temporal cutoff. Snapshots, eligibility, missingness and sparse coverage accompany the manifest. The potential label is observed successful clear seconds under recorded conditions; unsupported success probabilities, failures inferred from missing teams, moderation rates and account DPS are withheld. No learned model is published. Independent outcome labels and held-out comparison against the mechanical/retrieval baseline remain prerequisites for any future model.

## Validation and remaining gates

The starting working-tree baseline passed the build, 31 domain tests and 42 browser checks. Existing uncommitted/untracked work was retained and extended; no reset or commit was performed.

- `npm run build`: passed TypeScript, Vite and production-content verification; 126 files contain no simulation engine, worker or engine loader. Vite retains its bundle-size advisory (about 1.44 MB raw / 195 KB gzip JavaScript).
- `npm test`: **63 passed** across four test files, including account-builder mechanics, independent allocation, reference/live separation, strategy validation and source-use eligibility.
- `npm run test:app`: **81 passed**, 27 flows in each of Chromium, Firefox and WebKit, including the existing import/guide/calculator flows, immediate recommendations, real-shape references, manual challenge setup, persistence/restore, character focus and supported replacements.
- Real source audit: all three browsers, unmocked network requests, explicit live refusal and usable general teams; exact evidence is linked above. Desktop/mobile screenshots were inspected; the mobile builder has no horizontal overflow.

The release prerequisite remains a real independently verified live pack. The next concrete inputs are authoritative regional effective dates, complete stable enemy/variant lineups, and reviewed encounter requirements published with exact hashes and validity. The current feed's generic dates and incomplete Abyss lineup cannot meet that gate.

The observed-clear pilot needs a small set of individually reviewed original runs with proof, encounter mapping, attribution and honest actual-investment/build missingness. That manual review is unfinished application/data work; missing bulk or training permission does not block ordinary public references. A larger republished dataset separately requires supported/permitted export or publication access. The ingestion, correction, retrieval and split boundaries are ready, with training/evaluation still disabled.

Additional internal coverage work remains for complete artifact/base-stat evaluation, measured application/energy/timing, equipment swap policies, broader role/quick-swap coverage, practical held-out account quality checks and Theater rules. These limits are visible in the client. Passing software tests does not establish complete mechanical feasibility or real-world clear performance. A model is optional and appropriately unavailable with the current empty dataset.
