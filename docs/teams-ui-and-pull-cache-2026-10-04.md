# Teams structure and persistent pull advice

4 October 2026.

The Teams page separates the selected account plan from its inputs. Recommended / Alternative 1 / Alternative 2 are labelled as complete allocations. Each team is a horizontal row with its assigned boss or Abyss half, character portraits, readiness and rotation order. Full opponent names, build requirements, rotations, changes and sources remain in disclosures. Mode, target type, server and preferences occupy one settings rail. On narrow screens it collapses before the results with an explicit expand control. Decorative selection edges, boxed team numbers, nested team cards and repeated explanations are absent. Guide recipes & custom teams retains its content and controls.

Pull priorities now has its own primary **Pulls** navigation entry and page. Ranked account options lead to a candidate's team unlock, actual support move, required initial builds, current/after-pull allocations and owned build improvements. Stopped studies are labelled as partial comparisons; the account-wide save/build-first verdict and final shortlist labels require all unowned candidates to have been evaluated. Banner availability remains separate and unverified without an applicable official publication.

## Cache contract

Only completed C0 studies are persisted. IndexedDB preserves the complete evaluations, configuration identities and BigInt masks without localStorage's small JSON quota. SHA-256 keys cover normalized roster/account inputs, recorded builds and equipment, mode/server/challenges, preferences and locks, custom/observed seeds, configurations and baseline plan. Evidence includes the guide graph digest, reviewed recipes, all team contracts, conditional ratings and their conditions/freshness, covered role profiles, mechanics provenance and character catalogue. An explicit evaluation revision invalidates old engine semantics. Changing an unowned character's publication can invalidate advice even when the owned roster's baseline is unchanged.

No clock-based cache timeout restarts unchanged recommendations. Challenge/rating review expiry changes the source inputs and therefore invalidates advice. The four most recent studies are retained to bound storage. Completed rankings reopen after navigation and page reload; malformed, partial, mismatched or older-format entries are rejected. Validation preserves C0 isolation, known account identities, disjoint full-team assignments and safe source links. Browser-storage failure falls back to live calculation and reports when persistent saving fails.

## Verification

Production build and all **93 domain tests** passed. The full browser suite passed **102 checks** across Chromium, Firefox and WebKit. The final decision-flow checks separately exercise persisted cache restoration, identical ranking/export after reload, build edits, new ownership, older cache-version rejection, challenge assignment and mobile settings collapse. Domain regressions cover key changes for ownership, builds, constellations, equipment, preferences, mode, targets, source publications and freshness, as well as incomplete/damaged/non-C0/overlapping cache records.

Desktop and 390px mobile layouts were visually reviewed. A separate 43-character fixture includes the three lineups shown in the user's screenshot; the additional ownership is synthetic, so it is not a reconstruction of the user's full roster. It completes a full comparison and restores the same ranking after reload without page errors. Timing measurements are local UI diagnostics, not combat-performance claims.

The live-client verification script uses real production-source requests, no route mocks and no frozen clock. Its record is [the live UI/cache verification](verification/teams-ui-pull-cache-live-2026-10-04.json). It checks current Abyss/Stygian exports, complete pull advice, restoration after reload, mobile fit, page errors and absence of simulation requests. No ranking algorithm, predicted clear result or combat-performance claim was introduced by this UI/cache change.


An overlapping rebuild briefly removed the served index during an intermediate rerun, producing two local HTTP 404 pages; another Firefox run failed during browser-context teardown. These were isolated test infrastructure failures. The final decision checks run against a stable production build without concurrent browser jobs. The full suite's earlier 102-check pass and the independent live-source record are retained separately.

## Visual comparison update

Teams now previews every complete allocation with four-slot portrait rows. The selected plan uses a solid fill; assigned teams show recorded level/constellation values, readiness, and a numbered portrait rotation. Unknown values remain explicit. Rotation actions, build tasks, matchup checks, and attributed evidence remain expandable.

Pulls uses the same portrait rows for current, hypothetical, and build-first allocations. Added members are marked relative to the existing matched-team comparison; unchanged teams remain visible for comparison. Support moves, C0 assumptions, account-fit ranking basis, and calculation progress are explicit. This is a presentation change; allocation, ranking, cache inputs, and source gates are unchanged.


## Team viewer polish

The team workspace uses graphite text, white team surfaces, a cool neutral background, crimson actions, and element-specific portrait tints. `TeamViewer` presents four fixed character slots with an on-field marker, constellations, recorded level, and self-reported readiness. Clicking a character or rotation step opens an inline, keyboard-accessible inspector for recorded equipment, talents, ER, EM, role, and the proposed rotation action. Missing inputs remain unknown.

Complete-plan previews are compact and retain all assigned members. The same element colors appear in pull comparisons. `team-workspace.css` owns this presentation; the recommendation pipeline and persistence remain unchanged. Browser coverage checks inspection, keyboard activation, unchanged allocation, and four-slot layouts at 390, 1280, and 1920 pixels.
