# Lessons from the previous Team Atlas attempt

The original experiment is preserved in the separate Genshin Team Optimizer repository. Account Doctor has no build or runtime dependency on that checkout.

The previous Mavuika regression showed that generic simulation inputs could use the wrong artifact profile, energy allocation, actions and aura sequence. The simulator successfully executed those inputs while producing a misleading comparison. A candidate budget could also omit a known complete composition.

Consequences for this project:

1. Preserve complete, source-backed team recipes alongside pairwise relationships.
2. Keep carry and support roles distinct. A successful simulation is not a gameplay validation certificate.
3. Treat inferred graph weights as retrieval priorities, not damage or observed popularity.
4. Allocate supports across the whole account, rather than selecting each team independently.
5. Validate rotations, reaction ownership, energy and encounter assumptions in a separate offline research pipeline before publishing numbers.

The original report is `docs/research/simulation-corrections.md` in Genshin Team Optimizer. Its engine, generated configurations and regression artifacts remain there; they are deliberately not copied into this product repository.
