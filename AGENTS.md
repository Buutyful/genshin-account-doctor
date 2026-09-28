# Working on Genshin Account Doctor

This is the standalone Account Doctor product repository. Read `README.md` and `docs/account-doctor-design.md` before changing the recommendation pipeline.

- Keep simulation binaries, runtime workers and research checkouts outside this app. Published offline results need exact provenance.
- Keep observed usage, guide evidence and synthetic measurements separate. Unknown evidence is not incompatibility.
- Preserve complete recipe constraints and shared account identities when assigning teams.
- Do not label recommendations as current-cycle or damage-ranked without verified supporting data.
- Keep asset and guide attribution with the corresponding data.
- Run `npm run build`, `npm test`, and relevant browser flows for behavior changes.
