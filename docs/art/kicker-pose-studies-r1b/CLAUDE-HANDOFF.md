# Claude handoff — Kicker pose studies r1b

This r1b revision replaces r1 for the cell 9 foot correction. All other 43 native cells and the map are unchanged. Read `CELL-09-CHANGE-REPORT.json` for the actual edit extent.

The generated replacement changes 681 native pixels within cell 9; 627 of those are outside the foot review box. Review the whole replacement cell for these accompanying drawing differences. The source ground line is 1186 before and 1187 after. Native bounds change from 86 × 89 to 87 × 90, with rows 22–111. All other atlas cells are unchanged.

The art delivery is now available: 17 candidate pose studies based on the approved idle r2. All new poses remain **UNAPPROVED**.

1. Read `README-FIRST.md` and `CELL-NOTES.md`, including the declared departures.
2. Verify `SHA256SUMS.txt`. Approved idle remains `9ea1446a850e6c7222b2326a5c4ff9ea4937030b0d689f8e703938f05edb0ee0`.
3. Assemble `studies.json` using the supplied original `sample-studies.mjs` at the approved fixed scale and palette. The normalized source inputs have proven native-output equivalence to their unchanged raw inputs.
4. Compare decoded cells with the included preview/proof. The local preview PNG is `14adc7d39b79d6169b23500a8c0155ad9c4dd168f4f8b70bbd3dd0003e091555`; its JSON is `9b86e9f99bf34d1d807e34dca98bfd4c8189fac68aab18bdb786b2b84de7e4e4`. Account for PNG encoder differences by comparing decoded pixels, not by accepting an unexplained artwork difference.
5. Use the existing isolated review workflow to inspect this candidate through the real loader with current hero artwork, both facings. Capture walk/retreat and transitions as well as all attack, hurt, knockdown, fallen and get-up poses. Label the exact served atlas hash and present cells.
6. Report the visual effect of the declared deviations rather than silently calling them a complete brief pass.

The package contains 18 distinct populated cells including the unchanged idle. Cells24/28/32 are not included in this delivery; the existing partial map omits those states. Future arm-dependent artwork remains a separate deliverable under the current project decisions.

This handoff does not approve the complete artwork or authorise a commit, push, merge or deployment. The old rejected painter candidate must remain clearly distinguished from this set.

