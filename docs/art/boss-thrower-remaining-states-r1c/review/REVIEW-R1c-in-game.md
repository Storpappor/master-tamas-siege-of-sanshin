# Master Kage and Thrower, remaining-state batch R1 with the founder's correction pass (R1c): consolidated in-game review

10 November 2026. Supersedes the 9 November review of R1; the unaffected material is reused as is (files without a `-CORRECTED` / `-REPLACEMENT` suffix are the 9 November captures of cells that did not change). **Unapproved**: final release approval remains at the agreed visual checkpoint; nothing is committed, no staging PR; Kicker is separate.

## 1. What changed, and only that

Starting sheets: R1 candidate `boss.png` **61c24712ec36736a4a34e6bbd61ff61205a1eca2c35cefbd2a1c7fa57c5aa23f** and `thrower.png` **55254d10babce2cbbcfa1c9e0a0b86f60ca986653ce881d093b6d46a89aa3f9d** (kept in `candidate-r1-original/`).

| Edit | Region moved | Pixels in the cell changed | Result |
|---|---|---|---|
| Kage cell 36 (`thrownDown2`): **down 1 px** | the controlled hand with its dark edge and the whole visible forearm: the 8-connected skin component (`#fba662`, `#e78b53`, `#d57239`) plus the hand edge (`#12041d`) inside x 53-72, rows 104-116, from the palm seed (66,108), plus the two hakama edge pixels (62,106) and (63,106) left of the hand edge; 79 region pixels, cols 53-70, rows 106-115. The cut is where the forearm meets the gold belt at x 53. | 52 | `boss.png` **a4678d6bdb9c08c6ddc9ab6dabd0ad66a67dfadf44c6775ac74402ebe200cedf** |
| Thrower cell 28 (`thrownDown2`): **−1 px in x** (unmirrored source cell), y unchanged | the controlled hand (`#fcb36c`, `#e68648`) with its dark edge and the adjoining cuff line (`#230e25`, `#060010`) inside x 59-74, rows 74-81, from the palm seed (68,78); 65 region pixels, cols 59-74, rows 74-81. | 36 | `thrower.png` **950b2222eefc5984b4ed4671b71d521ff1f3c3930c732527e868ca7463b48f64** |

Rule applied by both edits: every region pixel moves by (dx, dy); a vacated pixel takes the colour the original cell had at (x − dx, y − dy), which is what lay behind the moved edge (hakama or sleeve colour, or transparency), so the wrist stays joined and no new colour is introduced. Nothing was deleted and no audit definition was narrowed: the hand definitions were moved with the hands (Kage box and seed +1 in y, Thrower −1 in x) and the hand components still count **44 and 41 pixels**, the same totals as before (`logs/offline-check-CORRECTED.txt`).

Checks on the corrected sheets (`logs/offline-check-CORRECTED.txt`): cell-by-cell comparison with the R1 candidate reports **only cell 36 (52 px) and only cell 28 (36 px)** differing; all 12 baseline cells still pixel-identical to `ad630e55…` / star-patched `6b483a2e…`; binary alpha, 32-colour palettes, lying widths and standing heights unchanged. Maps (`boss.json` e3302ac4…, `thrower.json` 1fda5387…), anchors, Tamas `a427c431…`, timing and gameplay files untouched. Before/after at 1x and 8x with the changed pixels marked: `correction/corr-kage-cell36-before-after.png`, `correction/corr-thrower-cell28-before-after.png`.

Reproducibility (`correction/pipeline/`): `apply-cell-edits.mjs <in.png> <edit.json> <out.png>` applies the recorded edit to the R1 candidate (input hash guarded, cell hash before and after recorded) and reproduces the corrected files byte for byte; the same edits are supported by `assemble-enemy.mjs` as `cfg.edits`, applied after the recorded star patches, so a rebuild from studies carries the correction. `kage-cell36-edit.json` and `thrower-cell28-edit.json` are the records; `*-edit-region-pixels.json` list every moved pixel.

## 2. Served bytes and loaded pixels

Isolated copy of `main` **5ca9ff95** as before (only the four staged sprite files and the harness page differ from the archive). Served with `cache: no-store`: boss.png a4678d6b…, thrower.png 950b2222…. Decoded RGBA held by the production loader: boss **50bcfb5a9f7438062f9a9d016331e26d39b0efcb872004f1fa34ccf5f0d4f4ab**, thrower **ec07a2156d7c740073c971351bdc60edb1c154a4743e26ee55f031fcba5bc269**, identical to the Node decode of the corrected files. All states mapped; no fallback frame in any capture.

## 3. Controlled-hand audit at k30 against fixed Tamas cell 61, flash off, both facings

Correction of the 9 November finding: the hidden pixels were under the **outline of Tamas's dangling fingertips** in cell 61 (rows 74-75 of his cell, 21-22 px above the floor), not under his front foot. Mapping each hidden victim pixel back into Tamas's cell: Kage (68,106), (69,106), (70,106) → Tamas (91,74), (90,74), (89,74); Thrower (71,75) → Tamas (88,75); all `#1a1522` outline pixels of the fingertips (Tamas's foot occupies rows 80-95 of his cell and never overlapped the hand).

| | Hand pixels | Rows (px above floor) | Mapping check | Visible, R1 | Visible, **R1c** |
|---|---|---|---|---|---|
| Kage cell 36, faces L and faces R | 44 → 44 | 106-111 (16-21) → 107-112 (15-20) | 44/44 | 41/44 | **44/44** |
| Thrower cell 28, faces L and faces R | 41 → 41 | 75-80 (15-20) → 75-80 (15-20) | 41/41 | 40/41 | **41/41** |

Method unchanged: the complete declared palm/fingers component of the loaded sheet (8-connected skin pixels from the seed inside the declared box), mapped to the screen for the victim's actual position (+24.00 units, 0.07 up) and facing at k30, checked in a victim-only render (every pixel found in its sheet colour), then compared with the render that includes Tamas in the game's draw order. Kage's hand now sits at 15-20 px above the floor, inside the 15-21 band; the Thrower's stays at 15-20. Images: `hand-audit/*-CORRECTED.png`.

## 4. Throw transitions after the correction (both facings)

Per-frame logs of all scenarios re-run on the corrected sheets are identical to the R1 logs in cell, state, position and alpha for every frame (`logs/*-harness-log-CORRECTED.json`): held k5-17, thrownDown1 k18-23, thrownDown2 k24-30, landing k31 on `fallen` (or the last knockdown cell when lethal), getUp k70-84, idle k85. The k27 (falling, 2.4 up) and k31 (landing) panels are in `stills/*/…throw…-CORRECTED.png`; the moved hand reads as the same hand one pixel lower (Kage) or one pixel nearer the body (Thrower); nothing else in the pose moved. Short normal-speed throw clips with effects, one per character and facing, start on the grab and end after the get-up: `clips/clip-throw-*-CORRECTED.webm` (1.8 s each; traces in the clip logs show 12 → 24 → 25 units and 1.0 → 3.3 → 0 up, both facings).

## 5. Thrower hurt cells 12 and 13: accepted pose-specific exception

Cells 12 (75 px) and 13 (81 px) against the 78 px idle are kept as drawn and recorded as an **accepted pose-specific exception to the ±2 px standing-height tolerance**, by the founder's decision. Corrected description: **impact (cell 12) leans back with the chest and chin up; stagger (cell 13) folds forward.** No head-lowering edit was requested or made; the 9 November suggestion to lower cell 13 is withdrawn.

## 6. Replacement Thrower-left full clip, and what the first one showed

The 9 November `clip-thrower-left.webm` (kept as `clips/SUPERSEDED-clip-thrower-left-camera-clamped.webm`) shows the Thrower partly outside the frame and 11.6 units of separation during flight and landing. Cause, from the game code, not the level boundary: the camera only scrolls forward (`updateCamera`), and enemies are confined to the visible area (`confineEnemy`, 8 units inside the view). In that recording Tamas chased the backing-off Thrower leftward until the Thrower was pinned at the view's left margin, so the throw had no room: the victim was clamped at camX + 8 instead of landing 25 units ahead. In real play the camera is locked at the wave position for the whole fight, so the replacement clip locks the camera the same way and starts Tamas at the right of the view, Thrower 150 units to his left.

`clips/clip-thrower-left-REPLACEMENT.webm` (8.6 s; log `logs/clip-thrower-left-REPLACEMENT.json`): star blocked at 1.95 s, Tamas walks in, punch 4.28 s, grab 5.33 s, up again 6.75 s, kick 6.98 s, faded 8.03 s, the same event times as the right-facing clip. Trace at the throw: Tamas at x 140.4, victim 12.0 → 24.0 → 25.0 units ahead, 1.0 up at release, 0.07 up at the last airborne frame, landing at x 115.4 with the camera at 0: the normal trajectory, both fighters fully in frame throughout. The right-facing Thrower clip and both Kage clips were not affected (their traces show 12 → 24 → 25 as well) and are reused.

## 7. Everything else

Reused unchanged from the 9 November review: walk, hurt, knockout and lethal-throw stills for both characters and facings, the Kage k30 and throw material other than the moved pixels, the hurt-transition zooms, the height comparison, and the three unaffected full clips. Preserved: maps, anchors, cell sizes, timings, collision, gameplay files, Tamas a427c431, the approved idles and the held-star patch. Nothing committed; no PR; approval pending at the visual checkpoint.
