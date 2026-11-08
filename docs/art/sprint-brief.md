# Tamas sprint sheet (state `sprint`) — artwork brief

Code-derived brief, written 7 November 2026 against `main` at `fe81749` (the merge of
pull request #4). That commit already contains the controls change (pull request #3,
`e2eaf3c`: sprint, grab/throw, hold-back block) and the art branch
`visual-upgrade-sanshin` (`4e42b23`). No checkout has uncommitted changes. The branch
`controls-sprint-grab-block` is fully merged and has no successor; `feature/belt-scroll`
holds nothing beyond `main`.

The pose studies in `concepts/` (the four-pose study and the later six-pose study
`tamas-sprint-six-pose-study.webp`, an enlarged visual reference, received again on 8 November as
`03-sprint-six-poses-VISUAL-REFERENCE.png`, 1774 × 887 px) are concepts, not a validated
384 × 192 production sheet and not a finished loop. This brief fixes the count from the code:
six cells at 12 cells per second, contact, push-off, flight, then the opposite stride.

**Status (8 November 2026, integration):** the native package `tamas-native-controls-review-v1`
(`sprint/tamas-sprint.png` + `.json`, 384 × 192, six cells, binary alpha, exactly the production
sheet's 30 colours) is appended to the production atlas as cells 48-53 (rows 12-13) with
`scripts/append-sheet.mjs`, existing cells byte-identical. The two renderer changes below are
made (`SPRINT_CELL_RATE` and `resolveFrame` in `src/heroSprite.js`) and tested. Measured in the
browser: five simulation frames per cell, 48 → 53 → 48 every 30 frames, idle → sprint from cell
48, punch mid-sprint and back, release → idle. Real-game sheet: `preview/integrated-sprint.png`.
As received, the contact and push-off cells are 85-86 px tall (rows 10/11-95, the lean), the
flight cells 79 px ending on row 87; nothing is resized. **Known temporary art issue:** idle,
walk and the attacks are still the 80 px production figure, so Tamas grows by 10 px when the sprint
starts and shrinks back when it stops (see `preview/integrated-sprint.png`). Decided on the
integration review: keep the native cells at the approved 90 px H1 scale and the frozen cells as
they are; consistent proportions across old and new states come in a separate, coordinated artwork
update. Final visual approval by the art chat is pending.

## What the game does today

| Item | Value | Source |
|---|---|---|
| Walk speed | 72 units/s along the level, 50 units/s in depth | `PHYSICS` in `src/constants.js` |
| Sprint speed | ×1.75: 126 units/s along, 87.5 units/s in depth | `SPRINT.speedMultiplier` |
| Start | second tap of the same direction within 0.25 s | `SPRINT.tapWindow`, `Player.trackTaps` |
| End | the moment that direction key is released | `Player.trackTaps` |
| Walk-cycle counter | +9 per second walking, +15.75 per second sprinting | `Player.update` (`walkCycle += dt * 9 * pace`) |
| Art shown while sprinting | W1 walk cells 4-7, `loop = walkCycle`, so each cell holds 63 ms (walking: 111 ms) | `heroState` in `src/heroSprite.js` |
| Effects | one dust burst at the feet when the sprint starts; no sound | `Game.consumeEvent('sprint')` |
| Scale | 1 game unit = 2 art px; the hero is 40 units = 80 px tall | `ART_SCALE`, idle cell 0 |

So the sprint is currently W1 played 1.75× faster, as the J2 brief says. W1 stays the
ordinary walk and is not touched.

## How a separate sprint sheet gets selected

Selection is browser-side only. Nothing in `game.js`, `entities.js`, `combat.js`,
`constants.js` or `level.js` changes, so the gameplay guard and the replay checksum are
unaffected. The fighter already exposes everything the renderer needs: `sprinting`
(boolean), `state === 'walk'`, `grounded`, `walkCycle`, `vx`, `facing`.

Two small changes, made on 8 November with the native sheet:

1. `heroState` (`src/heroSprite.js`): the walk branch returns
   `{ state: 'sprint', loop: f.walkCycle * SPRINT_CELL_RATE, fallback: 'walk' }` when
   `f.sprinting`, otherwise `{ state: 'walk', loop: f.walkCycle }`. `SPRINT_CELL_RATE` is the
   sampling factor fixed below (`RATE` in earlier drafts).
2. `Renderer.drawOne` (`src/renderer.js`) calls `resolveFrame(sheet, hs)` (`src/heroSprite.js`):
   if `frameFor(hs.state)` returns `null` and `hs.fallback` is set, it tries
   `frameFor(hs.fallback, hs)` before falling back to the legacy sheet. A sheet without a
   `sprint` state therefore shows W1 while sprinting (at the scaled 12 cells/s cadence), and
   only a sheet without `walk` drops to the legacy 4×2 art.

Both are covered by `test/spriteSheet.test.js`: a sprinting player resolves to `sprint` with
`fallback: 'walk'`, one second of sprinting advances twelve cells, and `resolveFrame` picks the
sprint cells, the walk cells or `null` depending on the map.

`heroFrameIndex` (legacy sheet) keeps using the idle/step pair; no change.

## Frame count and sampling

`SpriteSheet.frameFor` with a `loop` value shows cell `floor(loop) mod N`, so the cell
rate is set entirely by the loop counter, not by the number of cells. The counter runs at
15.75 per second while sprinting. The renderer may scale it (`RATE` above), so the cadence
is a drawing decision, not a gameplay one.

Specification:

| Item | Value |
|---|---|
| State key | `sprint` |
| Cells | 6, one full run cycle (two strides) |
| Cell rate | 12 cells/s (`RATE = 12 / 15.75 ≈ 0.762`), each cell 83 ms = 5 simulation frames |
| Cycle | 0.5 s per cycle, 4 foot strikes per second |
| Ground covered | 63 units = 126 px per cycle, 31.5 units = 63 px per stride (≈ 0.8 body heights) |
| Start cell | always cell 0: `walkCycle` resets to 0 whenever the hero stands still, and the two taps always pass through a standing frame |

Why 6 and not the 4 poses of the study: at 4 cells the run would either churn at 254 ms per
cycle (the current W1 behaviour) or, slowed to 500 ms, hold each pose for 125 ms and
stutter. Six cells give the two contact poses and two flight poses of the study plus one
push-off per stride.

Frame order (sheet faces right; the renderer mirrors for left-facing, so the left stride is
drawn, not mirrored):

| Cell | Pose | Notes |
|---|---|---|
| 0 | Contact, right foot planted | Full weight on the lead leg, torso leaning forward (study pose 1). Clean standing silhouette: this is the cell the sprint starts on. |
| 1 | Push-off | Rear leg driving, heel lifting; arms pumping. |
| 2 | Flight | Both feet off the floor, knees high (study pose 2). Feet drawn 6-10 px above the anchor row. |
| 3 | Contact, left foot planted | Mirror of the stride, not of the pixels (study pose 3). |
| 4 | Push-off | |
| 5 | Flight | (study pose 4) |

## Transitions the sheet must read well against

All of these are already in the code; none needs new art beyond the six cells.

| From → to | What happens | Cells shown |
|---|---|---|
| Idle → sprint | Second tap inside 0.25 s. The first tap shows W1 for the few frames it is held. | idle 0 → W1 (brief) → idle → sprint from cell 0 |
| Walk → sprint | Release and re-press within 0.25 s; the gap passes through idle so the cycle restarts. | W1 → idle → sprint cell 0 |
| Sprint → stop | Key released: sprint flag and movement end the same frame. | sprint → idle 0 |
| Sprint → walk | Not possible directly; a new single press walks. | sprint → idle → W1 |
| Sprint + depth | Holding up/down while sprinting moves diagonally; still `sprint`. Double-tapping up or down sprints in depth only, drawn with the same side-view cells. | sprint |
| Sprint → jump | Space keeps the 126 units/s forward speed in the air (J2 cells 36-37). The counter is frozen while airborne, so landing resumes the sprint on the cell it left. | sprint → J2 → sprint |
| Sprint → attack | Punch, kick or grab stops the hero (speed 0 while grounded) for the attack's duration; the sprint flag survives and the run resumes immediately after. Hitboxes are fixed and unaffected. | sprint → P2 / K2.1 / grab → sprint |
| Sprint → block | Holding the opposite direction near a striking enemy blocks (BH2 cell 16) and stops movement; the run resumes when the threat passes. | sprint → BH2 → sprint |
| Sprint → hurt | A hit shows BH2 hurt 20-21 for 0.35 s; the sprint resumes if the key is still held. | sprint → BH2 → sprint |
| Backward sprint | Close to an enemy, double-tapping away sprints backward without turning (see the block note in the grab/throw brief). The cells play in reverse if the renderer change there is made. | sprint reversed |

## Drawing rules

Unchanged from the approved sheet, verified on `assets/sprites/tamas.png`:

| Item | Value |
|---|---|
| Cell | 96 × 96 px, 4 columns per row |
| Anchor | (48, 95): the anchor row is the floor; planted feet sit on row 95 |
| Figure, production baseline | the shipped idle cell 0 occupies x 18-77, y 16-95 (60 × 80 px, measured on `assets/sprites/tamas.png`). This is what the game draws today. |
| Figure, new artwork target | the approved native H1 reference is 90 px tall, rows 6-95 (measured on the native H1 PNG `01-tamas-idle-h1-NATIVE.png` received 8 November 2026: figure x 18-80, y 6-95, 63 × 90 px, binary alpha, the same 30 colours as the shipped sheet; it is 3 px wider than the shipped figure). New sprint and throw cells follow these larger H1 proportions in the same 96 × 96 cell with the same anchor (48, 95). Running poses may bend, lean or lift the body naturally but never resize it. Head, glasses, gi and belt follow the locked H1 head mask and palette. |
| Palette | the sheet's 30 colours, no additions; background alpha 0, no semi-transparent pixels (the hit flash uses `source-in`, so any alpha > 0 flashes white) |
| Lateral room | x 8-94 is precedented (knockdown reaches x 8, kick reaches x 94); a sprint cell may use the full width but must not touch the cell edge |
| Lean | the forward lean may bring the head to x 60-70; keep the head the H1 head, only tilted by whole pixels, not redrawn. With the 90 px figure the crown sits at row 6 when upright, so a lean is the only way to gain headroom: never crop the head |
| Flight cells | feet 6-10 px above row 95 so the floor shadow (drawn by the game at the anchor row) still reads under the hero; the lifted body must still fit under row 6 |
| Facing | drawn facing right; never bake a left-facing cell |

## Delivery package

Isolated review package (loaded on its own through `SpriteSheet.load`):

- `tamas-sprint.png`: 384 × 192 px RGBA, 4 columns × 2 rows of 96 × 96. Cells 0-5 hold
  the run cycle in the order above; cells 6 and 7 fully transparent.
- `tamas-sprint.json`:

  ```json
  {
    "cell": { "w": 96, "h": 96 },
    "anchor": { "x": 48, "y": 95 },
    "columns": 4,
    "image": "tamas-sprint.png",
    "states": { "sprint": [0, 1, 2, 3, 4, 5] }
  }
  ```

Integration into the production sheet (done 8 November, together with the grab/throw sheet):

- `node scripts/append-sheet.mjs sprint/tamas-sprint.json grab-throw/tamas-grab-throw.json`
  appended rows 12-13 (sprint) and 14-15 (grab, throw) to `assets/sprites/tamas.png`, now
  384 × 1536 px. Cells 0-47 are byte-identical to the previous atlas (checked by the script and
  again independently); the package rows are copied unchanged.
- `assets/sprites/tamas.json` gained `"sprint": [48, 49, 50, 51, 52, 53]` (plus `grab` and
  `throw`); the package JSON files were re-indexed, not copied.
- `test/spriteSheet.test.js` asserts the new state arrays and the six-cell loop.

The rule "one state starts a new row" held: the cell indices in the JSON follow the row.
