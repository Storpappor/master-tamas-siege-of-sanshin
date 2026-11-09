# Kicker first package: approval record (9 November 2026)

The founder approved the Kicker's first native package as artwork: the idle r2 (approved earlier
the same day) and the 17 r1b pose cells, **18 populated cells in the partial map**, including the
sweep transition and the departures the art chat declared. This record names the exact files the
approval covers. It is an artwork approval and an authorisation to update staging PR #15; it does
not authorise a merge or a deployment, which wait for the integration review.

## Approved files

| File | SHA-256 | Role |
|---|---|---|
| `assets/sprites/kicker.png` | `862bb7630e864dafc5936e38cd0a18161a373d64264f7e61c724b068e087e733` | the reviewed and served sheet: the repository encoder's assembly of `docs/art/kicker-pose-studies-r1b/studies.json` |
| r1b package preview `native-preview/kicker.png` | `14adc7d39b79d6169b23500a8c0155ad9c4dd168f4f8b70bbd3dd0003e091555` | pixel-identical to the above (every decoded RGBA byte equal); a different PNG encoder |
| `assets/sprites/kicker.json` | `9b86e9f99bf34d1d807e34dca98bfd4c8189fac68aab18bdb786b2b84de7e4e4` | the brief's partial-delivery map |
| idle r2 cell (`docs/art/kicker-idle-r2/kicker-idle-r2.png`) | `9ea1446a850e6c7222b2326a5c4ff9ea4937030b0d689f8e703938f05edb0ee0` | approved 9 November as artwork and as the look reference; cell 0 of the sheet is pixel-identical to it |

Approved cells: **0** (idle r2, unchanged), **4-7** (walk), **8-10** (`enemyHighKick`), **12-14**
(`enemyLowSweep`), **16-17** (`hurt`), **20-22** (`knockdown`), **36** (`fallen`), **40** (`getUp`).
Each slot is its own drawing. `e231120c…` was the superseded r1 preview before the cell 9 foot
correction and is not part of the approval.

## Still pending, outside this approval

- **Cells 24, 28 and 32** (`held`, `thrownDown1`, `thrownDown2`) stay transparent and unmapped; the
  game draws those frames with the procedural fallback. They need a separate artwork delivery and
  review.
- The current draw order is retained (the held victim drawn over Tamás) and the foreground-hand
  pass stays deferred, as in the Striker brief.

## How it was reviewed

- File checks: the delivery's 102 checksums; the supplied sampler byte-identical to the
  repository's; `studies.json` and `raw-studies.json` both assemble to the same decoded pixels;
  cell 0 equal to the approved idle; no sampler warnings; `test/enemySprite.test.js` pins the
  staged files (cell, anchor, map, size, binary alpha, 96 px idle, 18 distinct drawings, the three
  empty slots, every state resolving).
- Artwork previews: the art chat's contact sheets under
  `docs/art/kicker-pose-studies-r1b/native-preview/`.
- Real-game review 1 (server hash `862bb763…`, Tamás `194eeb8f…` with the older 80 px idle): the 72
  labelled panels, both facings.
- Real-game review 2 on a clean `main` at `bce64bf` with the H1-family Tamás (`a427c431…`) and the
  Striker on `main` (`118459f1…`): `docs/art/preview/kicker-r1b-still-h1-striker-kicker.png`
  (feet-aligned in-game still) and the normal-speed clips
  `docs/art/preview/kicker-r1b-sweep-facing-left.gif` and `-right.gif`; the walk/retreat,
  high-kick and fallen/get-up clips are in `kicker-r1b-review-2.zip` with the session notes.
- Staged on PR #15 after the rebase onto `main` at `bce64bf`:
  `docs/art/preview/kicker-first-package-ingame-states.png`, 72 labelled panels captured on that
  branch with the H1-family hero, stamped with the served hashes.

The declared departures (walk cells 96/97/96/96 instead of the 2 px bob; sweep preparation 55 px
and recovery 70 px; get-up 62 px; the lying cell 22's 3 px head-side margin) are accepted as
drawn; see `docs/art/kicker-pose-studies-r1b/CELL-NOTES.md`.

## Earlier, rejected candidate

`kicker-native-v1` (`kicker.png` `b2c0e4ef…`, painted by a joint-and-primitive painter) was
rejected visually on 9 November and has been removed from this PR. The painter is retired for
character appearance; the production method is pose studies in the approved idle's style sampled
by `sample-studies.mjs` at the idle's fixed scale and palette.
