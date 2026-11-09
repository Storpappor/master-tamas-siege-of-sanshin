# Kicker pose studies r1b — 17 new candidates from approved idle r2

**Status: the 17 new poses are UNAPPROVED artwork candidates.** The approved idle remains the visual reference and is preserved unchanged. This package is an artwork handoff and local sampling preview. It is not a game capture, a repository change, or an approval of the complete Kicker.

## r1b correction

The user identified a right-foot appearance on the raised left leg in high-kick cell9. The source artwork was edited to correct that foot; the fixed-scale sampler and palette are unchanged. Only atlas cell9 differs from r1. All other 43 cells, including the approved idle and the empty slots, are decoded pixel-identical; the map is byte-identical. The full cell9 source/native change bounds are documented in `CELL-09-CHANGE-REPORT.json`; do not describe the entire cell as pixel-preserved outside the foot unless that report supports it. The previous declared departures remain in `CELL-NOTES.md`. This revision remains unapproved.

The generated replacement changes 681 native pixels within cell 9; 627 of those are outside the foot review box. Review the whole replacement cell for these accompanying drawing differences. The source ground line is 1186 before and 1187 after. Native bounds change from 86 × 89 to 87 × 90, with rows 22–111. All other atlas cells are unchanged.

## What was delivered

- 17 separate right-facing pose studies in `studies/`, with transparent backgrounds, binary alpha, and colors restricted to the approved 28-color palette.
- The 17 original image-generator outputs in `raw-studies/`, unchanged, for provenance.
- `studies.json` and `raw-studies.json`, both portable, with explicit source anchors and the exact approved scale `0.08488063660477453`.
- The approved idle study and native cell in `reference/approved-idle/`.
- The original `sample-studies.mjs`, unchanged, plus the input-format normalization utility.
- A sampled 512 × 1232 sheet, the partial JSON map, individual native cells, measurements and 1×/3× artwork previews in both facings under `native-preview/`.
- Generation prompts and corrective prompts under `generation-prompts/`; checksums in `SHA256SUMS.txt`.

The term “r1b” denotes the foot-correction revision of the first pose-study delivery following approved idle r2. It is unrelated to the rejected joint-painter candidate.

## Artwork method

Every new pose was generated with the built-in image-generation tool using the approved idle look study as the identity, costume, shading and body-scale reference. The joint painter was not used. The full prompt set is included. Generation is not claimed to be deterministic.

Raw generation contains intermediate alpha and off-palette RGB. The normalized studies apply only the exact technical rules already used by the supplied sampler: alpha below 128 becomes transparent; other pixels become opaque; RGB snaps to the same nearest palette color using weights 2, 3, 1.5. Canvas sizes, pixel positions, pose geometry and anchors are unchanged. No study was resized, translated, cropped or spatially painted by this normalization.

The normalized and raw-input assemblies are **byte-identical** with the same local PNG encoder, and match in all **2,523,136 decoded RGBA bytes**. This removes low-alpha source haze without changing the sampled artwork. See `NATIVE-EQUIVALENCE-PROOF.json`.

## Approved reference

`reference/approved-idle/kicker-idle-r2.png` retains SHA-256:

`9ea1446a850e6c7222b2326a5c4ff9ea4937030b0d689f8e703938f05edb0ee0`

The sampled atlas's cell 0 matches all 57,344 decoded RGBA bytes of that approved cell, including transparent RGB. The original PNG itself remains byte-identical in the reference folder.

## Scope and map

| State | Cells | New drawings |
|---|---|---:|
| walk | 4, 5, 6, 7 | 4 |
| enemyHighKick | 8, 9, 10 | 3 |
| enemyLowSweep | 12, 13, 14 | 3 |
| hurt | 16, 17 | 2 |
| knockdown | 20, 21, 22 | 3 |
| fallen | 36 | 1 |
| getUp | 40 | 1 |
| **Total** | | **17** |

With approved idle 0, the preview has 18 populated cells, 18 distinct drawings and 26 fully transparent cells. Cells 24, 28 and 32 remain transparent and omitted from the map in this delivery. The complete character remains a separate approval.

## Local file results

- Sheet 512 × 1232; cells 128 × 112; anchor (64, 111); four columns.
- Native alpha is only 0 or 255. All 27 used opaque RGB colors belong to the approved 28-color palette.
- No alpha≥128 source pixels were clipped by the native sampling window.
- High-kick active cell 9: 97 occupied pixels in the tested far part of its existing box; zero pixels in the crouching-head clearance band.
- Sweep active cell 13: 92 occupied pixels in the tested far part of its existing box; forward extent is now within the documented reach.
- Recovery cell 10 is 96 px high after a source-art correction.
- Cell 36 is a distinct drawing from cell 22; no populated cell duplicates another.

**These checks do not certify every artistic target. Read `CELL-NOTES.md` before review.** The walking bob, compressed crouch/get-up poses and cell 22's head-side margin are declared departures.

### Preview identifiers

`native-preview/kicker.png` SHA-256:
`14adc7d39b79d6169b23500a8c0155ad9c4dd168f4f8b70bbd3dd0003e091555`

`native-preview/kicker.json` SHA-256:
`9b86e9f99bf34d1d807e34dca98bfd4c8189fac68aab18bdb786b2b84de7e4e4`

`native-preview/kicker.json` is the existing partial-delivery map. All previews are labelled artwork previews and show this candidate.

## Reassemble in the game repository

The original sampler uses the existing repository's `scripts/append-sheet.mjs` and `src/combat.js`. Place this package under `docs/art/kicker-pose-studies-r1b/` and run from the repository root:

```sh
node docs/art/kicker-pose-studies-r1b/sample-studies.mjs docs/art/kicker-pose-studies-r1b/studies.json --out /tmp/kicker-poses-review
```

Running with `raw-studies.json` instead must produce identical decoded cells. A different PNG encoder may change the encoded PNG hash while preserving RGBA; compare the per-cell decoded hashes in the proof as well.

The supplied sampler itself has SHA-256 `ff979bf59e6b3690a42bf2c2a8acad8da766e433fd7a4156146ab8e3531d460c`, matching the received handoff.

## Next review

Review the declared departures and the artwork, then use the existing real-game harness to judge the walk loop, retreat, attack transitions, hurt, knockdown and get-up in both facings. Any captures must identify the exact new atlas hash and use the current hero reference. No real-game loading or timing test was performed in this art handoff, and no staging, commit, push, merge or deployment was made.

