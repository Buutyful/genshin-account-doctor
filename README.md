# Genshin Account Doctor

An independent Genshin account clinic: find compatible teams, understand their roles, and allocate your characters across a complete account plan.

[Open the app](https://buutyful.github.io/genshin-account-doctor/) · [GitHub repository](https://github.com/Buutyful/genshin-account-doctor)

This is a **standalone repository**, with its own dependencies, source, data, artwork and tests. It does not import files from Genshin Team Optimizer. No simulation engine is built, shipped or run in this app. The previous project remains a separate research reference.

## Run

Use Node 22 or newer.

```sh
npm ci
npm run dev
```

```sh
npm run knowledge:build
npm run build
npm test
npm run test:app
```

`build` verifies that `dist/` contains no simulation binaries, workers or loader. Browser checks run under `/doctor/` in Chromium, Firefox and WebKit, including subpath hosting and mobile layouts. The resulting `dist/` directory can be hosted as static files.

## GitHub Pages

[The Pages workflow](.github/workflows/pages.yml) automatically publishes pushes to the default branch, `codex/account-doctor`. It installs the locked dependencies, runs domain and browser tests, builds the standalone app with the repository's Pages base path, and deploys `dist/` through GitHub Actions. It can also be run manually from the Actions tab. Pages uses **GitHub Actions** as its deployment source.

Local builds keep relative asset paths. Set `VITE_BASE_PATH=/genshin-account-doctor/` to reproduce the hosted build. Account and inventory data remain in the visitor's browser; the repository contains application data and test fixtures.

## Working prototype

- A responsive account checkup with an explicitly labeled demo and original adult anime doctor artwork.
- Character selection, element/search filters, self-reported readiness and local persistence. Build details include unknown/C0–C6, level, ascension, base talents, equipped weapon/refinement, ER and EM.
- Account Doctor / Team Atlas roster JSON import/export and team-prescription export. Legacy constellations migrate; equipment targets are never treated as owned weapons. GOOD v1–v3 scanner imports include a preview, merge/replace choice, character aliases and retained equipment snapshots. Links to Inventory Kamera and GOODScanner are in My characters.
- A synergy atlas containing 1,937 evidence edges from 1,094 original, unexpanded KQM recipes. Source links and contexts are preserved. Missing evidence means unknown.
- Character-specific team search constrains the selected character before width-24 beam expansion inside guide recipes. Five curated recipe families have reviewed role explanations; other examples are visibly marked as requiring condition review.
- Saved custom compositions, product-authored Hyperbloom role contracts, mechanical synergy checks and per-mode team locks.
- Rotation sheets calculate explicit direct, amplifying and level-90 transformative damage, with persistent inputs and JSON export.
- A live-version challenge adapter for all Floor 12 chambers and Stygian difficulty 6, with server selection, cache expiry, retry, source hashes and joint encounter assignment.
- **Clear finder:** 914 attributed Stygian.moe source-listed clears across the three version 7.1 bosses, in Dire and Fearless. Roster/investment matching, original proof links, source cost and recorded time, finite weapon-copy allocation, exclusions, team locks, distinct full-plan alternatives and one-character-away examples. Available from Account navigation and the Recorded clears planner tab; Stygian accounts open this tab by default. See [implementation and evidence](docs/recorded-clear-finder-2026-10-06.md).
- One-team, two-team Abyss and three-team Stygian preparation. Branch-and-bound assigns disjoint teams from up to 256 candidates, with space reserved for different drivers, maximizing complete-team count before heuristic priority. Traveler elements share an account identity.
- Team explanations include conditional role-rating contributions, constellation/partner assumptions, caveats and original guides. Guide review/readiness is a separate ranking option. Artifact optimization remains a handoff to Genshin Optimizer.

Team Planner opens the account-aware builder, with a recommended full allocation and two composition-distinct alternatives when coverage permits. The dedicated **Pulls** navigation page automatically compares unowned characters at C0, reassigns the entire account, and shows team unlocks, support moves, required partners/builds and a build-first comparison. Completed comparisons are persisted on this device and reused until the account, planning inputs or recommendation evidence changes. The checkup links directly to this workflow. Guide recipes, custom teams and manual rotation calculations remain in the reference tab. The mechanics pilot covers 24 role profiles across 20 characters; it does not predict account DPS or guaranteed clears.

The 3 October source review supplies six exact-hash regional Abyss/Stygian publications, usable until **10 October 2026 UTC**. That deadline expires the review, not the game season. Fresh endgame planning starts against these verified lineups, including all Abyss chambers, and remains usable during provider failure. Expired/missing publications fall back to explicitly general planning; player-entered targets remain available. The rating snapshot was rechecked against Prydwen's 1 October update. Source assumptions and execution requirements stay attached to full teams, and mixed unreviewed core-ownership proposals do not enter primary plans. Banner availability is checked separately and remains unverified without dated official notices. Individually reviewed Stygian.moe references can be imported; public clear listings do not establish predicted performance. See the [3 October decision workflow and verification](docs/account-decisions-2026-10-03.md), [guide planner integration](docs/team-planner-integration.md) and [account imports and ranking](docs/account-imports-and-ranking.md).

## Project structure

- `src/`: clinic UI, graph queries, recipe matching and team allocation.
- `src/data/`: self-contained roster and generated knowledge snapshots.
- `data/`: guide facts, portrait provenance and the inherited roster policy.
- `public/`: doctor illustration, character portraits and favicon.
- `scripts/`: reproducible knowledge generation, build verification and test server.
- `tests/`: domain tests and browser flows.
- `docs/`: design decisions, research lessons and artwork provenance.

Read the [design and algorithm decisions](docs/account-doctor-design.md), [lessons from the previous attempt](docs/research/legacy-lessons.md), and [doctor artwork and exact generation prompt](docs/doctor-art-provenance.md).

## Data provenance

The initial guide facts, roster and character portraits were copied from the previous prototype, preserving their recorded snapshot dates and hashes. These are independent local copies, not runtime dependencies. The inherited roster does not establish a newly verified current meta. The graph is initially KQM-only; it is not community usage telemetry or independent multi-source consensus.

The character artwork provenance is recorded in `data/portrait-provenance.json`. No application license has been assigned. This is an unofficial fan project, not affiliated with HoYoverse.

Future simulation belongs in a separate offline research/publication pipeline. Only validated, versioned results with exact assumptions should enter this app as published data.

## Verified standalone baseline

On 28 September 2026, a fresh dependency installation, knowledge rebuild, production build, 10 domain tests and 18 browser checks passed from this repository. The browser checks cover Chromium, Firefox and WebKit. The original project's entry point and build were restored independently.

## Account workflow validation

On 29 September 2026, the production build, 18 domain tests and 27 browser checks passed (including targeted reruns after correcting test selectors). Browser coverage includes Chromium, Firefox and WebKit, GOOD preview/cancel/import, equipment persistence, character build editing, focused team search and mobile layouts. No simulation engine is shipped.

On 30 September 2026, the planner integration passed the production build, 31 domain tests and 42 browser checks across Chromium, Firefox and WebKit. Coverage now includes custom teams, rotation calculations, team locks, live-feed schema fixtures, encounter assignment, cache expiry, failure recovery, export and mobile layout. Live-provider verification remains blocked by HTTP 403; fixture passes do not establish live availability.

After the client repair, the account-aware builder passes the production build, 63 domain tests and 81 browser checks. Real unmocked source requests also succeed in Chromium, Firefox and WebKit, with useful general and reference-target plans. This supersedes the earlier HTTP 403 observation: the outstanding live blocker is date/lineup verification. Source hashes, the corrected individual-reference eligibility and acceptance gaps are recorded in the [implementation report](docs/account-aware-builder-implementation.md).

On 3 October, the account-decision update passes the production build, **90 domain tests and 96 browser checks** across Chromium, Firefox and WebKit. This supersedes the earlier current-lineup blocker for the exact, time-limited publications reviewed on that date. Coverage includes automatic roster-based pull advice, C0 isolation, modern-team ranking regressions, known-build projections, full allocations, three regional Abyss flows, Stygian assignment, source expiry and desktop/mobile layouts. `scripts/verify-account-decisions-client.mjs` also exercises the production client with real source requests and no frozen clock.


The 4 October UI update separates plan results from a collapsible settings rail, labels alternatives as complete account plans, and identifies the opponent next to each team. Pull priorities is a primary navigation page. Its cache includes roster/build/equipment inputs, mode and matchup settings, custom/observed seeds, full recipe and conditional-rating publications, source freshness and an evaluation revision. Partial comparisons are never restored as completed recommendations. See [UI structure and persistent pull advice](docs/teams-ui-and-pull-cache-2026-10-04.md).

On 6 October, Clear finder adds 914 real source-listed Stygian records, audited against 101 exact-hash snapshots. The production build, 105 domain tests and 123 browser checks pass. Source-listed moderation, incomplete investment and source freshness stay explicit. `npm run clears:refresh` replaces the dated public index; `npm run clears:verify` checks the locally cached source bytes. See [recorded-clear behavior, provenance and validation](docs/recorded-clear-finder-2026-10-06.md).
