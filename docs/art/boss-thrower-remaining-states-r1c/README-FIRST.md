# Master Kage and Thrower native sheets: approval and asset record (R1c, 10 November 2026)

**Status: APPROVED by the founder on 10 November 2026 as artwork, at the visual checkpoint, for
these exact files.** This record names them by SHA-256, says how they were produced and reviewed,
and holds the reproducible correction records. It is an artwork approval; the merge and the
deployment of the integration PR wait for separate authorisation. No gameplay change: the
gameplay files are untouched (`npm run guard`), Tamás (`tamas.png` a427c431…), the Striker, the
Kicker, controls and timing are as on `main`.

## The shipped files

| File | SHA-256 | Content |
|---|---|---|
| `assets/sprites/boss.png` | `a4678d6bdb9c08c6ddc9ab6dabd0ad66a67dfadf44c6775ac74402ebe200cedf` | Master Kage, 512 × 1536, 128 × 128 cells, anchor (64, 127), **22 drawings** |
| `assets/sprites/boss.json` | `e3302ac4eed479a70269c3c3e3c371d82ddfcda968dffe7bdbb592f4973bf26e` | the code-derived map: idle 0, walk 4-7, bossPunch 8-10, bossKick 12-14, block 16, hurt 20-21, knockdown 24-26, held 28, thrownDown1 32, thrownDown2 36, fallen 40, getUp 44 |
| `assets/sprites/thrower.png` | `950b2222eefc5984b4ed4671b71d521ff1f3c3930c732527e868ca7463b48f64` | Thrower, 512 × 960, 128 × 96 cells, anchor (64, 95), **18 drawings** |
| `assets/sprites/thrower.json` | `1fda538709bdd59823522c35ea212e5ebff2c28a8aef7c5a632b5db565dafe6e` | idle 0, walk 4-7, enemyThrow 8-10, hurt 12-13, knockdown 16-18, held 20, thrownDown1 24, thrownDown2 28, fallen 32, getUp 36 |

Decoded-pixel hashes (sha256 of the RGBA bytes after decoding, which do not depend on the PNG
encoder): boss `50bcfb5a9f7438062f9a9d016331e26d39b0efcb872004f1fa34ccf5f0d4f4ab`, thrower
`ec07a2156d7c740073c971351bdc60edb1c154a4743e26ee55f031fcba5bc269`.

Every state the enemy state machine produces for these two kinds resolves to a cell, so the
procedural fallback is no longer used for them (`test/enemySprite.test.js` pins the maps, cell
sizes, anchors, binary alpha, the 22 / 18 distinct drawings, the empty slots and the resolution of
every state).

## Provenance

1. **Idles** (approved 9 November): `boss-idle.png` 470bbd8f…, `thrower-idle.png` 9494218f…,
   sampled from the art chat's studies at one fixed scale per character (Kage 0.08776 native px
   per source px, Thrower 0.06516) with the Kicker idle-r2 sampling rules and a 32-colour palette
   each (`baseline/*-idle-report.json`).
2. **Attack baseline** (confirmed 9 November as the working baseline): Kage bossPunch 8-10,
   bossKick 12-14, block 16; Thrower enemyThrow 8-10 with the held shuriken in cell 8 brightened
   by eight recorded palette patches (`thrower-attacks-r1-config.json` → `patches`). Assembled with
   `assemble-enemy.mjs`: `baseline/boss-attack-baseline.png` ad630e55…,
   `baseline/thrower-attack-baseline.png` 6b483a2e…. Cell 0 of each equals the approved idle.
3. **Remaining states R1** (art chat delivery, 9 November): the 14 remaining cells per character
   (walk, hurt, knockdown, held, thrownDown1, thrownDown2, fallen, getUp) assembled by the art
   chat's pipeline on the same scale and palette: `boss.png` 61c24712…, `thrower.png` 55254d10….
   All 12 baseline cells pixel-identical to item 2. The art chat's build ran on Node v24.22.1.
4. **R1c correction** (founder's correction pass, 10 November): two recorded cell edits applied to
   the R1 files, nothing else changed (`check-remaining.mjs` and `sheet-cell-diff.mjs` report only
   cell 36 of boss.png, 52 pixels, and cell 28 of thrower.png, 36 pixels, differing):
   - Kage cell 36 (`thrownDown2`): the controlled hand with its dark edge and the whole visible
     forearm moved **down 1 px** (`correction/kage-cell36-edit.json`).
   - Thrower cell 28 (`thrownDown2`): the controlled hand with its dark edge and the adjoining cuff
     line moved **−1 px in x** in the unmirrored cell (`correction/thrower-cell28-edit.json`).
   Reason: at frame 30 of Tamás's throw the fingertips were under the outline of Tamás's dangling
   fingertips (cell 61); after the edits every pixel of the declared hands is visible in both
   facings (`review/offline-hand-audit.txt`, `review/*-k30-hand-audit-both-facings-6x.png`).

Accepted pose-specific exception: Thrower hurt cells 12 (75 px) and 13 (81 px) against the 78 px
idle, each one pixel beyond the ±2 px standing-height tolerance of the brief, are kept as drawn by
the founder's decision; the impact cell leans back with the chest and chin up, the stagger cell
folds forward (`review/thrower-hurt-height-compare-4x.png`). Kage's attack cells keep their
baseline heights (113-114 px against the 109 px idle), also a recorded baseline decision.

## Reproducing the correction (Node 20+, no dependencies)

```bash
node docs/art/boss-thrower-remaining-states-r1c/apply-cell-edits.mjs <R1 boss.png 61c24712…> docs/art/boss-thrower-remaining-states-r1c/correction/kage-cell36-edit.json out/boss.png
node docs/art/boss-thrower-remaining-states-r1c/apply-cell-edits.mjs <R1 thrower.png 55254d10…> docs/art/boss-thrower-remaining-states-r1c/correction/thrower-cell28-edit.json out/thrower.png
```

Each edit file is guarded: `expectInputSha256` (the R1 file), `expectBefore` / `expectAfter`
(sha256 of the edited cell's decoded RGBA before and after), `expectOutputRgbaSha256` (the whole
decoded sheet) and `expectOutputSha256` (the PNG bytes). The same `edits` list is honoured by
`assemble-enemy.mjs` (`cfg.edits`, applied after `cfg.patches`), so a rebuild from the studies
carries the correction; `cell-edits.mjs` is the shared implementation. The region moved by each
edit is the 8-connected set of pixels of the listed colours inside the box, grown from the seed
(plus any `extra` pixels); a vacated pixel takes what the original cell had behind the moved edge.

**Identical pixels versus identical bytes.** The approved artefacts are the exact PNG files in
`assets/sprites/` (the hashes above). The repository encoder (`scripts/append-sheet.mjs`) on
**Node v26.8.1 (zlib bundled with that Node)** reproduces them byte for byte from the R1 inputs and
the edit files, as verified on 10 November. Another Node or zlib version may compress the same
pixels into different bytes: `apply-cell-edits.mjs` then warns that the PNG hash differs while the
decoded RGBA hash still matches. The decoded-pixel hashes are the identity of the artwork; the PNG
hashes identify the shipped files. Do not re-encode the shipped files.

The R1 inputs and the art chat's studies are not in the repository (they are in the delivery ZIPs
and the session notes); the configs here record the baseline assembly (`*-attacks-r1-config.json`,
with their study paths as received).

## Checks and review

- `full-check.txt`: `node check-remaining.mjs` on the shipped files with their maps (dimensions,
  binary alpha, palette, per-cell bounds, baseline-cell identity, lying widths, the two height
  notes above).
- `review/REVIEW-R1c-in-game.md`: the consolidated in-game review on an isolated copy of `main`
  5ca9ff95 with the production loader and renderer, both facings, after the FIGHT card: walk timing
  (125 ms per cell), hurt, knockout, the complete throw, the lethal throw, the k30 hand audit, and
  the normal-speed clips (the captures themselves are in the review package, not the repository).
  Per-frame logs: `review/*-harness-log.json`.
- `docs/art/preview/remaining-states-harness.html` is the review page used (diagnostic tooling,
  not loaded by the game): `?kind=boss|thrower` captures every phase boundary and runs the hand
  audit; `&clip=1|throw&facing=1|-1` records a clip.
- The integration head was checked again with the same page before the PR was opened; the
  served bytes, the loader's decoded pixels and every boundary frame matched the review.
