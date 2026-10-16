# Selected Parchment Clinic artwork

- Source: user-selected candidate A, generated on 7 October 2026 using the built-in `image_gen` tool.
- Exact prompt: [candidate archive](ui-candidates/2026-10-07/README.md#a--a-parchment-clinic).
- Original: `docs/ui-candidates/2026-10-07/a-parchment-clinic.png`, 1536 × 1024.
- Runtime copy: `public/art/parchment-clinic-reference.png`.
- SHA-256 of both identical PNGs: `41b35b2095ad99528a114442b1f9a40916b3d3c8756bfe2b00cc443ee6fec547`.
- Transformation: no raster edits. CSS background positioning and SVG viewports present reference regions; portraits preserve their aspect ratio when cropped for smaller screens. React renders the functional controls and text.
- Use: eight reference character portraits and decorative glyphs on Team planner, plus the brand and sidebar mascot throughout the app. These are generated depictions of Genshin characters, not newly sourced official portrait files or recommendation evidence. Genshin Impact characters belong to HoYoverse; this is an independent fan project.

Portrait source regions `(x, y, width, height)` are Mavuika `(256,343,231,220)`, Citlali `(496,343,220,220)`, Xilonen `(725,343,212,220)`, Bennett `(946,343,230,220)`, Neuvillette `(256,704,231,220)`, Furina `(496,704,220,220)`, Kazuha `(725,704,212,220)` and Baizhu `(946,704,230,220)`. Glyph regions are recorded in `src/ReferencePortrait.tsx`; sidebar regions and presentation sizes are recorded in `src/planner-clinic.css`.

The existing official portrait provenance in `data/portrait-provenance.json` and original mascot provenance in [doctor-art-provenance.md](doctor-art-provenance.md) remain attached to their assets. Original portraits remain in use on other pages and for characters absent from this reference; the original mascot remains in the checkup hero.
