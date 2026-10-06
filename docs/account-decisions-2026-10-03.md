# Account plans, pull advice and current challenges — 3 October 2026

The planner now presents a recommended full account allocation and up to two different complete alternatives. **Who to pull** is a primary tab and has a direct checkup entry. Opening it automatically compares the roster with every unowned wish character at C0. Results explain the resulting team, displaced teammates, actual support destinations, required partners and builds, alongside the strongest covered owned plan after recorded upgrades.

The UI uses a flat reading surface. Portraits, choices and explanations have no nested card frames. Challenge setup is collapsed on the pull page; long rotations, source coverage, equipment checks and backup controls remain expandable. Desktop and 390px mobile flows are verified.

## Selection behavior

- Whole-account allocation preserves complete guide constraints, shared Traveler identities, user exclusions/locks and equipped item identities.
- Current conditional carry/support ratings apply only with their constellation and partner conditions. Expert-execution requirements remain attached. Expired ratings contribute nothing.
- Reviewed team examples, role interactions, readiness and recorded build gaps contribute to ordering. A covered-check count is never a strength score.
- Source-reviewed matchup utilities/modifiers contribute bounded weights. Explicit player strategy preferences take precedence. Optional chamber buffs do not automatically outrank the full team's supported strength.
- Unseeded mixed Pyro/Anemo core ownership and charged-beam core proposals remain exploratory. Hyperbloom remains available when it is the account's supported option; contemporary Mavuika, Nefer and Zibai examples outrank it in equal-readiness regression accounts.
- Alternatives differ in complete compositions, rather than rotation IDs alone. Constrained accounts show fewer alternatives when no meaningful complete allocation is available.

## Pull and build comparisons

Every hypothetical pull starts at C0 with unknown build/readiness and no equipped gear. Stale details or equipment from a previously deselected character are neutralized. The original roster remains unchanged. Unchanged inventory rows are shared immutably during comparisons rather than copied for every character; exports include the base inventory once.

Each candidate regenerates compositions and jointly allocates all Abyss/Stygian teams. Baseline teams are reserved inside the bounded search so a newly expanded pool does not accidentally discard the owned comparison. Team changes are paired by encounter and overlapping members before reporting which support was freed and where it moved.

The build-first plan applies only recorded level, weapon-level and talent shortfalls, then regenerates the account. Unknown artifacts, EM, ER budgets, weapons and readiness remain unknown. Generic level/weapon/talent floors are labeled as planning floors. Reviewed exceptions include Mavuika's Burst priority and Neuvillette's level/Normal Attack requirements. Guide-specific artifact, combo, energy and support-set notes remain attached to their team.

Verdicts are **Pull priority**, **Build first** or **Save**, based on marginal account coverage/priority, team count, support allocation and the projected owned plan. A source example that assumes an unestablished constellation cannot establish a C0 priority. These are account-fit heuristics, not simulated damage comparisons.

Banner availability has a separate gate: dated, recently checked official HoYoverse/HoYoLAB notices, matching region and effective dates. No qualified banner notices were available in this review, so the UI explicitly says **Banner unverified** and links to official wish notices. Account priority does not imply a live banner.

## Reviewed current publications

Six region/mode packs are bundled under `public/challenges/`. Their exact byte hashes are registered in `src/data/encounter-publications.json`. Imported verification flags cannot authorize a different file. The client checks the local publication immediately while remote provider requests run independently.

Abyss retains both halves across all three Floor 12 chambers. Provider cycle 123 and the dated [Timesaver guide](https://timesaver.gg/blog/genshin-spiral-abyss-floor-12-guide), corroborated by the [Icy Veins chamber guide](https://www.icy-veins.com/genshin-impact/spiral-abyss-floor-12-guide), establish the reviewed lineup and disorder interpretations. Icy Veins' blocked direct HTTP response is excluded from raw source provenance.

Stygian preserves all three difficulty-6 opponents and their reviewed Cryo/Stellar utility interpretations from [Stygian.moe](https://www.stygian.moe/) and provider snapshots. The level display uses the source's visible level 110, rather than the provider's internal index. The November period label conflicts with regional countdowns, so the publication certifies only the shorter **3–10 October review window**. October 10 is a review expiry, not a claimed season reset.

Missing/expired publications yield general advice and retain player target entry. They never yield a current-cycle export. Source hashes, all stages, publication date basis and review validity remain inspectable.

Reproduction scripts are `capture-decision-sources.mjs`, `publish-reviewed-challenges.mjs`, `refresh-conditional-ratings.mjs` and `update-reviewed-team-context.mjs`. Captured bytes and the rendered-source review must be checked again before refreshing dates. The challenge and rating review records are in `docs/verification/`.

## Recommendation quality and evidence limits

The [Prydwen Overall list](https://www.prydwen.gg/genshin-impact/tier-list) was checked against its 1 October update; the review revalidated 142 inherited entries and corrected two. Rating review expires October 15. Complete KQM examples and conditional rotations/build guidance were independently inspected for [Mavuika](https://keqingmains.com/q/mavuika-quickguide/), [Neuvillette](https://keqingmains.com/q/neuvillette-quickguide/), [Nahida](https://keqingmains.com/q/nahida-quickguide/) and [Raiden](https://keqingmains.com/q/raiden-quickguide/). A guide's own version label remains its source version; checking it now does not turn it into a newly authored patch guide.

The [public Stygian clear listing](https://www.stygian.moe/clears) was inspected for composition context. It includes a Sandrone/Odette/Alyosha/Sucrose composition and a Mavuika/Citlali/Cryo Traveler/Sucrose composition with materially different constellations. These contextual examples support checking reaction cores and investment assumptions, not substituting pairwise teammates or claiming a C0 result. Their original proof/build completeness was not certified in this review. They are not bundled as qualified clear measurements or training labels. The listing comparison therefore establishes a coverage boundary, not clear-performance validation.

The held-out account regressions cover empty/sparse accounts, older reaction teams, contested supports, charged carries, unknown kits, shared Traveler identities, contemporary carry teams and stale C6/equipment. They verify whole-team membership, role/rating gates, source expiry, support movement, original-account isolation and missing-partner/build behavior. Real published clear performance, repeated energy/application rates, artifact-derived totals and calibrated DPS/regret remain unmeasured. No performance claim is made from fixture passes or success-only listings.

Validation: `npm run build`, **90 domain tests**, and **96 Playwright checks** across Chromium, Firefox and WebKit. Browser flows cover current publications during provider failure, all three Abyss regions, Stygian, source expiry, alternatives, automatic pull recommendations, C0 exports, build-first decisions and mobile overflow. `verify-account-decisions-client.mjs` separately records real production-source requests, current assignment, automatic pull shortlists and screenshots without route mocks or a frozen clock. No simulation binary or worker is shipped.

The [real-client verification record](verification/account-decisions-live-2026-10-03.json) records HTTP 200 delivery from the live 7.1 manifest/indexes and both reviewed publications in all three engines. Each browser exported two current Abyss teams with all chambers and three current Stygian teams, completed automatic pull comparisons, fit the mobile viewport, and recorded no page errors or simulation requests. The final pull/alternative changes were rechecked in all engines; an owned, covered alternative does not display unrelated missing-partner recipes.

## Teams UI cleanup

The Teams page uses direct labels, compact mode/challenge controls and full-fill selection states. The sidebar accent edge, tab underlines, repeated onboarding steps, clinic slogans and visible ranking explanations were removed. The recommended allocation and two alternatives lead into flat team rows with portraits, readiness, character order and known build upgrades. Build/rotation requirements, matchup checks and original sources remain available through disclosures. Plan tradeoffs and research controls sit under Data & sources.

Who to pull shows each C0 candidate's team, support released to another team and initial build requirements. Account comparisons display unchanged allocations once, with “Same teams” for identical outcomes. The account-wide Build first/Save decision is shown only after every candidate has been compared. Banner verification remains separate. Guide recipes & custom teams retains its content and controls.

Desktop and 390px mobile layouts were visually reviewed. Browser regression coverage checks the absence of selection edges and slogans, optional build/source details, preferences, imports/restores, current challenge assignment, C0 pull outcomes and guide/custom-team flows. A WebKit hover loop after changing a team was reproduced and fixed by keeping Teams controls stationary on hover.

Final validation: production build and all 90 domain tests passed; all 96 browser checks passed across Chromium, Firefox and WebKit. The [UI live-client record](verification/account-decisions-ui-live-2026-10-03.json) separately confirms current Abyss/Stygian assignment, automatic pull comparisons and mobile layout in all three engines without mocked network requests.
