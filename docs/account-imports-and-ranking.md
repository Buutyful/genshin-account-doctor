# Account details, scanner imports and team priority

29 September 2026.

## User workflow

My characters now offers a build-details editor and a Find teams action. The editor records actual constellations, level, ascension, base talents, weapon name/GOOD key, weapon level/ascension/refinement, Energy Recharge and Elemental Mastery. Omitted values stay unknown; C0 is an explicit value. Talent levels exclude constellation bonuses. Imported artifact assignments can be inspected in the editor. These details persist and round-trip through the Account Doctor export.

Team planner has a separate character search. It includes complete owned recipes and recipes missing at most one teammate, and can search an unowned character. It does not change the disjoint account plan. The chosen character is required before beam pruning, so a less-connected alternative cannot disappear merely because it was requested after retrieval. Recipe annotation uses a full slot-to-member bijection, including overlapping substitute slots.

## GOOD import boundary

The app reads JSON/GOOD files locally, up to 10 MB. GOOD versions 1–3 are accepted, with preview, cancellation, source, counts and warnings. Merge preserves unscanned ownership and self-reported readiness, updates supplied character details and replaces each supplied equipment category. Omitted categories remain intact; explicitly empty categories clear the old snapshot. Repeating a scan does not duplicate equipment. Replace clears the previous account; a demo is always replaced.

Character IDs, full names and roster data IDs normalize to local IDs. Unsupported characters are reported and skipped; an ambiguous `Traveler` character key does not invent an element. Explicit `TravelerDendro` and other supported variants map individually; equipment location `Traveler` refers to the shared identity. Traveler variants cannot be allocated to different teams. Multiple equipped weapons for one identity are reported rather than arbitrarily selected. Equipment-only scans do not establish roster ownership.

Equipment rows and extensions are retained as observations for native export. Range/structure validation is not a certification of artifact legality, weapon compatibility or OCR accuracy. GOOD does not provide derived total ER/EM, so those remain unknown until manually entered. Equipment targets in old Team Atlas files never become actual inventory. Base talents outside 1–10 are rejected rather than silently subtracting an assumed constellation bonus.

Scanner links were checked against their own documentation:

- [Inventory Kamera (taiwenlee fork)](https://github.com/taiwenlee/Inventory_Kamera): Windows OCR, English game UI, character/weapon/artifact GOOD export.
- [GOODScanner](https://github.com/Anyrainel/GOODScanner/blob/main/README_EN.md): Windows; its Genshin OCR workflow requires Simplified Chinese and exports GOOD v3. The app links to the project and does not run or install its executables.
- [Genshin Optimizer GOOD schema](https://github.com/frzyc/genshin-optimizer/blob/master/libs/gi/good/src/schemas/good-format.ts) and [character schema](https://github.com/frzyc/genshin-optimizer/blob/master/libs/gi/schema/src/character/schema.ts): format versions and field names. This app implements its own strict boundary; it does not copy GO's defaulting behavior.

## Ranking and its limits

The pre-existing local Prydwen role-rating snapshot was retained and checked against the [publisher's Overall tier list](https://www.prydwen.gg/genshin-impact/tier-list), dated 23 September 2026. It is ordinal editorial guidance, not measured team damage, community usage or a current encounter pack. KQM graph evidence remains a separate source family and signal. Individual recipe links and cautions remain attached to recommendations.

The default objective combines an explicit carry prior `(6 - tier) * 10`, teammate priors `(5 - min(5, tier)) / 5`, 0.25 per ready teammate and 1 for reviewed roles. Unknown carry evidence uses a neutral prior of 40, unknown teammate evidence 0.5. A rating applies only when its constellation threshold and named partners are satisfied. These weights are implementation heuristics, not calibrated probabilities or a claim that one tier interval has a particular DPS value. The prescription shows the contributions and assumption failures. Character-specific execution caveats in the original source still require review.

The alternative guide objective uses 10 for reviewed roles plus 1 per ready member. It is also the fallback after the role snapshot expires. Association orders recipe expansion, not final combat strength. The allocator maximizes the number of complete, disjoint teams before summed priority in a bounded 256-team pool with reserved driver coverage.

Level, talents, weapon, ER and EM are recorded for build checks. They are not mapped to invented generic damage multipliers. Actual damage depends on role, rotation, reaction ownership, energy, equipment and encounter. This follows the legacy optimizer's Mavuika regression: valid engine execution with incorrect inputs produced a misleading number. The old simulation binaries and results remain outside this product.

## Published damage channel

`src/data/benchmarks.json` is intentionally empty. The UI disables its reference-DPS option when no eligible composition exists. The separate objective uses the lower confidence bound within one published build profile and encounter, never adds DPS to tier points, and never assigns unmeasured teams zero damage.

Eligibility requires matching composition/driver/profile/scenario, a matching patch and recent publication, engine revision and binary checksum, configuration checksum/path, at least 32 samples, finite positive mean, nonnegative interval, passed status, validated rotation and no unresolved diagnostics. This is an eligibility filter for reviewed publication data, not automatic verification of the underlying research. A publisher must independently verify exact configs, seeds, encounter, rotations, equipment and source hashes before adding rows. Research candidates can be selected with the existing `researchQueue` helper, reserving one quarter of the budget for other drivers.

No simulation engine, worker or research checkout is shipped or run by Account Doctor. Published numbers, when available, must remain labeled as a synthetic reference profile rather than the imported account's DPS. Current-cycle and predicted-clear claims remain unavailable.
