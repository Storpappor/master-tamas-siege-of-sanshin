# Kicker first package: handoff to the art chat (pose studies for the 17 remaining cells)

9 November 2026. The founder approved the revised native idle **kicker-idle-r2** (`kicker-idle-r2.png`,
SHA-256 `9ea1446a850e6c7222b2326a5c4ff9ea4937030b0d689f8e703938f05edb0ee0`) as artwork and as the
visual reference for the remaining first-package poses. That cell was not painted: it was
**sampled from the idle look study** (`kicker-idle-look-study.webp`, SHA-256 `5b64dd6a…e289`) at
one fixed scale with a palette taken from the study. The remaining 17 cells are produced the same
way: **you draw one pose study per cell in the idle study's style and scale; the sampler assembles
the sheet.** The joint-and-primitive painter of kicker-native-v1 is retired for appearance. The
delivery contract is the revision-2 brief (`docs/art/enemy-kicker-brief.md`, sections 5-8),
unchanged: 128 × 112 cells, anchor (64, 111), the 96 px standing figure, the partial map.

## 1. The reference and the identity to keep

Use `Kicker-K1-design-concept.png` for the character and `kicker-idle-look-study.webp` for the
rendering: K1's determined profile, swept hair, the substantial ponytail with the blue tie; a lean
athletic body in a loose dark gi with folds and sleeve/trouser shading; a readable open front
hand and a separate rear fist; the gold chest emblem; the blue belt clearly tied with two tails;
cream shin wraps; bare feet. Every study must read as the same person as the approved idle, from
the same view, at the same size, lit the same way, with the same colours.

## 2. Study format (what the sampler needs)

- One PNG per cell, RGBA, **transparent background**, nothing but the figure (no ground, shadow,
  text or frame), **facing right**. Dark outline all round, as in the idle study.
- **Same scale as the idle study, not fitted to a box:** the standing figure is **1131 source px
  tall** (soles to crown), which samples to 96 px. The sampler uses one fixed scale for every
  study, **11.78 source px per native px**; a figure drawn bigger or smaller changes the Kicker's
  size in the game. Draw every pose with the idle's head, torso, limb and foot sizes.
- Soles of planted feet, and the lowest point of any lying or kneeling figure, on **one ground
  line**; the sampler puts the study's lowest opaque row on the anchor row.
- **Colours only from the idle study's palette** (`studies.json` lists the 28 hex values; 25 are
  used by the idle). Other colours snap to the nearest and can mottle.
- Name files `study-<cell>-<state>.png` (for example `study-09-enemyHighKick-active.png`) and add
  each to `studies.json` with its `cell`, `state` and **`anchorX`**: the source column that sits
  under the anchor, which is the **midpoint of the stance** for standing cells (as the idle's 626),
  **under the hips** for crouched, kneeling and lying cells, and under the planted foot's centre
  when only one foot is on the floor. The sampler reads the ground row from the study itself.
- Canvas: any size, but keep the figure inside **±648 source px of the anchor column** and under
  **1155 source px tall** (the brief's 9 px cell margin; the walk's 2 px bob is the only thing
  allowed above 96 px).

## 3. The 17 studies, with the brief's requirements in source px (÷11.78 = native px)

| Cell | State and phase | What the study shows (brief section 5-8) | Hard requirements in source px |
|---|---|---|---|
| 4, 5, 6, 7 | `walk` ×4 | contact A, passing (body 2 px higher), contact B, passing: the approved guard kept up, the tail swinging | planted sole on the ground line; passing cells at most 1155 tall; the cycle plays forward whichever way he moves |
| 8 | `enemyHighKick` wind-up | knee chambered high, rear arm back for balance, weight on the rear leg | standing height |
| 9 | `enemyHighKick` hit | lead leg extended up and forward, torso back, balance arm | **the striking foot inside x +141..+636 ahead of the anchor, 707..990 above the ground** (the hitbox: 12-54 px ahead, 60-84 px up); no part of the leg lower than 683 above the ground beyond +283 ahead (a crouching Tamás's head is at 56 px = 660) |
| 10 | `enemyHighKick` recovery | leg coming down, body upright again | standing height |
| 12 | `enemyLowSweep` wind-up | the **crouched preparation** (this is the sweep's own first cell; there is no crouch state), about 75 px = 884 tall, a hand on the floor | lowest point on the ground line |
| 13 | `enemyLowSweep` hit | the sweeping shin and foot low and forward, supporting leg deeply bent, torso low | **foot and shin inside x +94..+613 ahead, 47..283 above the ground** (8-52 px ahead, 4-24 px up) |
| 14 | `enemyLowSweep` recovery | crouched again, leg back under the body | as 12 |
| 16 | `hurt` impact | head thrown back, arms flung, torso leaning back | standing height or a little less |
| 17 | `hurt` stagger | hunched forward, hands dropped | |
| 20 | `knockdown` topple | leaning back about 40°, knees bent, arms out (no procedural reference; S1's topple is 88 × 58 px) | lowest point on the ground line |
| 21 | `knockdown` floor impact | back meeting the floor, legs raised, arms up | at most 1414 long, head toward −x |
| 22 | `knockdown` lying | collapsed on the back, **head toward −x, feet toward +x**, arms at the sides | at most 1414 long; its own drawing |
| 36 | `fallen` | the throw victim just landed on his back, **a different drawing from 22**: arms flung, a knee up; head toward −x, soles toward Tamás | at most 1414 long; its hips are the anchor, which the game puts 589 source px (50 native px) ahead of Tamás |
| 40 | `getUp` | kneeling up on the rear knee, lead foot planted, a hand on the floor, about 71 px = 836 tall | lowest point on the ground line |

Every populated slot is its own drawing (revision 2); no study may be reused for two cells.
**Not in this package:** cells 24, 28, 32 (`held`, `thrownDown1`, `thrownDown2`) stay transparent
and unmapped pending the separate paired decision on the victim arm treatment; do not draw them
until that is settled.

## 4. What happens with the studies

`node docs/art/kicker-idle-r2/sample-studies.mjs studies.json` samples every listed study at the
fixed scale with the fixed palette, writes `kicker.png` (512 × 1232) and `kicker.json`, maps a
state only when all its cells have studies, never maps the three pending states, and prints each
cell's bounds plus warnings against the requirements above (height, ground row, cell margin, the
two hitboxes, the lying length). The pipeline is proven: run on the idle study alone it reproduces
the approved `kicker-idle-r2.png` cell pixel for pixel. Studies can be delivered in batches; a
partial sheet stages with the procedural fallback for the rest.

## 5. Evidence rules for the next review

Artwork previews (contact sheet, the strip beside H1 and S1) are labelled as previews. A real-game
capture must name the exact artwork it contains (sheet SHA-256 and the cells present); the
captures in PR #15 show the **previous, rejected candidate** (`b2c0e4ef…`) and must not be read
as this look. PR #15 stays an unapproved draft until the complete package is reviewed on the real
game. The idle approval covers the idle only.
