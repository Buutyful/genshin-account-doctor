# Genshin Account Doctor

An independent Genshin account clinic: find compatible teams, understand their roles, and allocate your characters across a complete account plan.

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

`build` verifies that `dist/` contains no simulation binaries, workers or loader. Browser checks run under `/doctor/` in Chromium, Firefox and WebKit, including subpath hosting and mobile layouts. The resulting `dist/` directory can be hosted as static files. No deployment is configured.

## Working prototype

- A responsive account checkup with an explicitly labeled demo and original adult anime doctor artwork.
- Character selection, element/search filters, self-reported readiness and local persistence.
- Account Doctor / Team Atlas roster JSON import/export and team-prescription export. Older roster ownership can migrate without modifying its original storage; equipment target settings are not treated as actual inventory.
- A synergy atlas containing 1,937 evidence edges from 1,094 original, unexpanded KQM recipes. Source links and contexts are preserved. Missing evidence means unknown.
- Width-24 beam expansion inside guide recipes. Five curated recipe families have reviewed role explanations; other examples are visibly marked as requiring condition review.
- One-team, two-team Abyss and three-team Stygian preparation. Branch-and-bound assigns disjoint teams from up to 128 candidates, maximizing complete-team count before heuristic priority. Traveler elements share an account identity.
- Team explanations, caveats, original guides and a handoff link to Genshin Optimizer.

Current encounter feeds, observed usage data, equipment/artifact inventory, comprehensive constellation checks and additional source families are not connected yet. Mode selection controls team count and character overlap, not a current boss cycle. Priorities are based on recipe review and reported readiness, not simulated combat strength or predicted clears.

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
