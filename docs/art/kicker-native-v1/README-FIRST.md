# Kicker native sheet, first package (kicker-native-v1)

**Status: UNAPPROVED native artwork candidate for visual review** (candidate hashes below). Nothing
here is approved; the founder judges the result against K1 and beside H1 and S1 on the real game.
Reproducibility and the geometry checks are not visual approval. Built on 8-9 November 2026 (revision b: cell 36 redrawn as its own fallen pose) against the revision-2 brief
`docs/art/enemy-kicker-brief.md` (commit `d1c1bf6` on `art-brief-kicker`, based on `main` at
`a91364a`) and the K1 design concept (`Kicker-K1-design-concept.png`, SHA-256
`323adb54…73713`), which controls the appearance. H1 and the approved S1 Striker were used as
comparison references only (`kicker-K1-H1-S1-references.zip`, all five checksums verified).

## What is in the package

| File | What it is |
|---|---|
| `kicker.png` | **512 × 1232 RGBA**, 4 × 11 cells of **128 × 112**, anchor **(64, 111)**, binary alpha, 21 opaque colours, 18 populated cells, **18 distinct drawings**, facing right. SHA-256 `b2c0e4ef1ea5cba937f269bfe6d2061c9d5bde13c4228babf433440056fcfb32` |
| `kicker.json` | the brief's **partial-delivery map** verbatim: idle, walk, enemyHighKick, enemyLowSweep, hurt, knockdown, fallen, getUp; `held`, `thrownDown1`, `thrownDown2` omitted. SHA-256 `9b86e9f99bf34d1d807e34dca98bfd4c8189fac68aab18bdb786b2b84de7e4e4` |
| `SHA256SUMS.txt` | checksums of every file in the package |
| `CELL-NOTES.md` | per-cell bounds and declared departures from the brief |
| `export-report.json` | the builder's report: per-cell bounds, copy relations, SHA-256 of the PNG and the JSON |
| `kicker-contact-sheet-4x.png` | **artwork preview**: every cell at 4× with its bounds, the floor row and the two hitboxes outlined |
| `kicker-comparison-3x.png` | **artwork preview**: H1 Tamas (90 px), S1 Striker (86 px) and the Kicker (96 px) feet-aligned at 3×, plus the high kick beside Tamas's crouch cell and the sweep beside his jump cell at 20 units |
| `kicker-native-v1-ingame-states.png` | **real-game capture**: 72 labelled panels from `docs/art/preview/enemy-states-harness.html` with the package staged at `assets/sprites/`, both facings, every state, Tamas's actual cells named |
| `build-kicker.mjs`, `paint.mjs`, `figure.mjs`, `poses.mjs` | the deterministic painter (zero dependencies; run from `docs/art/kicker-native-v1/` inside the repository). Re-running it reproduces `kicker.png` byte for byte |
| `verify-kicker.mjs` | the file checks (90 assertions against the brief's contract) |
| `render-comparison.mjs` | renders the comparison preview |

## Three kinds of evidence, kept apart

1. **File checks** (`node verify-kicker.mjs`, 92/92): dimensions, cell and anchor, the exact
   partial map, binary alpha, colour count, every populated slot drawn and every other slot
   transparent (24, 28 and 32 included), no pixel on a cell edge, idle 96 px with soles on row 111,
   the walk cells at most 98 px on row 111, the kicking foot inside the high-kick hitbox and clear
   of a crouching head, the sweeping foot inside the sweep hitbox, **18 distinct drawings in 18
   slots** (cells 22 and 36 are different poses), both lying figures head toward −x and under 120 px, every mapped state and both attacks' phases
   resolving through `SpriteSheet.frameFor`.
2. **Artwork previews** (`kicker-contact-sheet-4x.png`, `kicker-comparison-3x.png`): composites
   made from the PNG files, not from the game.
3. **Real-game verification** (`kicker-native-v1-ingame-states.png`): the package was copied to
   `assets/sprites/kicker.png` and `kicker.json` for the capture only, the dev server started, and
   the game page itself reported `karateEnemySheets.kicker.ready === true` with cell 128 × 112,
   anchor (64, 111) and the eight states; the harness then ran the real `Game` and `Renderer`
   through scripted fights. Seen in the capture: both facings mirrored by the renderer; the high
   kick's foot above a crouching Tamas (his cell 24) and landing on a standing one; the sweep
   under a jumping Tamas (cell 37) and landing on a standing one; the four walk cells walking in
   and retreating; both hurt cells; the five knockdown beats; the throw sequence with `held`,
   `thrownDown1` and `thrownDown2` drawn by the **procedural fallback** (captions say
   "procedural") and `fallen` and `getUp` from the sheet; the lethal throw lying on the last
   `knockdown` cell. The staged files were removed afterwards; nothing is committed under
   `assets/`. No gameplay file changed (`npm run guard`).

## Pending, as instructed

Cells 24, 28 and 32 (`held`, `thrownDown1`, `thrownDown2`) are **transparent and unmapped**. The
detailed controlled-arm treatment of those three poses awaits the Tamás–Striker paired visual
decision; the unapproved Striker R1 treatment is not adopted here. The second package adds the
three drawings and the three state entries and changes nothing else.

## Staging check (for whoever stages it)

Copy `kicker.png` and `kicker.json` to `assets/sprites/`, `npm start`, open
`docs/art/preview/enemy-states-harness.html?kind=kicker` for the 72-panel capture, or play to the
second wave; in the console `document.getElementById('karate-game').karateEnemySheets.kicker.ready`
is `true`. Remove the two files to get the procedural Kicker back.
