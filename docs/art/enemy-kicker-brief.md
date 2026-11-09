# Kicker native sprite sheet (`assets/sprites/kicker.json`) — artwork brief

Code-derived brief, 8 November 2026, written against `main` at
**`a91364a57094782506e5e33fd625968ca70bb2e1`** (the merge of pull request #10, which contains the
merged Striker sheet of pull request #11 and the enemy-sheet loader of pull request #7). Every
number below is measured on that code, on the shipped atlases `assets/sprites/tamas.png` and
`assets/sprites/striker.png`, or in the real game with the labelled diagnostic sheet of section 4.
Nothing in this brief asks for a gameplay change, and none is made: `npm run guard` passes.

**Scope, in the founder's words:** preserve the approved **K1** identity; measure the Kicker's own
geometry and recommend its size relative to the approved 90 px H1 Tamas and the shipped 86 px
Striker, keeping visible dimensions apart from collision; derive the cell and anchor from all of the
Kicker's poses rather than copying the Striker's; document both attacks, the movement in both
directions, and the shared victim behaviour exactly as the code has it; give the delivery contract
and the review plan. The finished Kicker artwork comes from the art chat, built on the approved K1
design the art chat holds (a slimmer fighter with a brown ponytail, a dark gi with sleeves, a blue
belt, cream shin wraps, bare feet and the gold chest emblem). **K1 controls the appearance and the
palette**; this brief gives K1 its sizes, positions and timings, not its look, and does not carry
the Striker's proportions or colour count over to it.

**Status at a glance**

| Piece | State |
|---|---|
| Loader, resolver, routing, fallback, mirroring (`ENEMY_SHEETS`, `enemyState`, `Renderer.drawOne`) | on `main`, unchanged; `kicker.json` is already the path it looks for |
| Kicker geometry measured, size and cell derived from every pose | done, sections 1-3 |
| Pipeline verified in the real game with a labelled PLACEHOLDER sheet in the recommended 128 × 112 cell, both facings, both attacks, the whole throw | done, `preview/kicker-diagnostic-both-facings.png` (section 4) |
| Attacks, movement, victim behaviour | documented from the simulation, sections 5-7; frame counts measured at 60 Hz |
| Kicker sheet (K1 at the sizes of section 2, in the cell of section 3) | **to be delivered** by the art chat (section 8): a first package of 18 cell slots with the partial map, then the three victim slots 24, 28 and 32 after the arm-treatment review (section 7); 21 slots in all |
| Thrower and boss sheets | later, same mechanism |

---

## 1. What the game draws today: the procedural Kicker

`ENEMY_TYPES.kicker` (`src/entities.js`): 50 hp, walks at 40 units/s, attacks from **27 units**,
**keeps 12 units away** and **steps back for 0.5 s after every kick** (`retreatTime`), pauses
0.7-1.2 s between attacks, chooses the **high kick 60 %** and the **low sweep 40 %** of the time
(`attackWeights`), never blocks. Score 200. It cannot crouch or jump of its own accord: the sweep's
crouch is part of the attack, and the only way it leaves the floor is Tamas's throw.

`FIGHTER_PALETTES.kicker` (`src/sprites.js`), the procedural look, listed so the art chat can see
what the game's own figure carries (K1 replaces it; K1's own costume and palette apply):

| Item | Procedural value |
|---|---|
| Build | tall and lean: skeleton scaled ×0.95 wide, ×1.14 tall; torso 11 wide (Tamas's fallback figure: 12); arms 3 thick, legs 5 (Tamas: 4 and 5); head 8 (Tamas: 9) |
| Costume | black gi `#25252b` (shade `#121216`, folds `#4a4a55`, trim `#74747f`) **with sleeves**, blue belt `#2f5fc4`, black trousers, **cream shin wraps** `#e6e4dc`, bare feet |
| Head | `ponytail`: brown hair `#3a2416` pulled back into a tail tied with a blue band, a focused narrow stare, eye `#1a1210` |
| Skin | `#e0a878`, shade `#b4774f`; bare hands |
| Outline | `#120c0a`, one unit all round (the hit flash replaces every colour with white) |

### 1.1 Measured geometry of the procedural Kicker

Skeleton joints from `POSES.idle` scaled by the palette (units, relative to the feet, facing
right; 1 unit = 2 art px), and the procedural Tamas fallback figure for the ratio:

| Landmark | Kicker (units) | Kicker (art px) | Tamas fallback (units) | Kicker : Tamas |
|---|---|---|---|---|
| Head centre | 41 up | 82 | 36 up | 1.14 |
| Head box (skin) | 8 × 8, rows 37-45 up; hair to 46, outline to 47 | 16 × 16 | 9 × 9, to 41 | a smaller head, 5 units higher |
| Ponytail | 8 units behind the head's rear edge (to x −12, −13 with the outline), swinging 1 unit up and down | 16 behind | — | the widest point behind |
| Shoulders | 34 up, ±2 from the centre | 68 up, ±4 | 30 up, ±3 | 1.13 height, narrower |
| Torso width | 12 at the shoulders, 8 at the waist | 24 / 16 | 13 / 9 | 0.92 / 0.89 |
| Hips, belt | 21 up, belt 9 wide | 42 up, 18 wide | 18 up, 10 wide | 1.17, 0.9 |
| Arms | 3 thick, sleeved; idle lead hand at +8, 35 up | 6 thick | 4 thick | 0.75 |
| Legs | 5 thick (shin 4, wrapped); feet 7 × 3 at ±5 | 10 thick; feet 14 × 6 at ±10 | 5 thick; feet 7 × 3 at ±5 | same legs on a taller skeleton |

Whole figure, rasterised at one pixel per unit with its outline, feet on the anchor row
(`preview/kicker-procedural-poses.png` shows every pose below at 4× with the collision box and the
two hitboxes drawn in):

| Pose | Width × height (units) | x extent | y extent (0 = floor) | Art px |
|---|---|---|---|---|
| idle | 24 × 50 | −13 .. +10 | −47 .. +2 | 48 × 100, crown 94 px above the anchor row |
| walk1, walk3 | 27 × 50, 25 × 50 | −13 .. +13, −13 .. +11 | −47 .. +2 | 54 × 100 |
| walk2, walk4 | 24 × 51 | −13 .. +10 | **−48** .. +2 | 48 × 102: the head bobs 1 unit up |
| enemyHighKick wind-up (`kickWind`) | 25 × 50 | −14 .. +10 | −47 .. +2 | 50 × 100, knee chambered at +5, 13 up |
| enemyHighKick hit (`highKick`) | **40 × 49** | −17 .. **+22** | −46 .. +2 | 80 × 98, foot at +17, **40 up** |
| enemyLowSweep wind-up (`crouch`) | 25 × 39 | −13 .. +11 | −36 .. +2 | 50 × 78 |
| enemyLowSweep hit (`crouchPunch`, see the note) | 29 × 39 | −12 .. +16 | −36 .. +2 | 58 × 78 |
| hurt | 28 × 50 | −16 .. +11 | −47 .. +2 | 56 × 100 |
| held | 23 × 49 | −11 .. +11 | −46 .. +2 | 46 × 98, lead heel lifted 1 unit |
| thrownDown1 (rising) | 37 × 39 | −20 .. +16 | −43 .. −5 | 74 × 78 |
| thrownDown2 (falling) | **48 × 29** | **−27** .. +20 | −33 .. −5 | **96 × 58** |
| fallen (lying, also dead) | **44 × 17** | **−26** .. +17 | −16 .. 0 | **88 × 34** |
| getUp | 27 × 37 | −13 .. +13 | −34 .. +2 | 54 × 74 |

The procedural Tamas is 26 × 47 units (52 × 94 px) and the procedural Striker 29 × 45 units in the
same measurement; the approved native H1 Tamas is 63 × 90 px (cell 56 of `tamas.png`: x 18-80,
rows 6-95) and the shipped native Striker idle is 67 × 86 px (cell 0 of `striker.png`, rows 10-95).

**Note on the sweep's procedural pose.** `poseFor` recognises a kick by the word "kick" in the
attack name; `enemyLowSweep` has none, so the procedural art draws the sweep's active and recovery
frames with the **crouching punch** pose (`crouchPunch`), a low straight punch whose fist sits at
+14, 23 up, well above the sweep's hitbox (section 5). It is a cosmetic quirk of the fallback
drawing, it changes nothing in play, and no code change is made for it here: the native sheet
replaces that pose with a real sweep, drawn to the hitbox. For the art chat the reference pose is
therefore the measured `crouchKick` figure (39 × 39 units, −14 .. +24, foot at +19, 14 up), not
the procedural frame the game shows today.

---

## 2. Recommended artwork dimensions

**Collision is not an art dimension.** `HURTBOX.standing` is 12 × 40 units = 24 × 80 art px for
every fighter, fixed and independent of the artwork (`src/combat.js`); the Kicker never uses the
crouching box, so even its sweep is hit on the standing box. Tamas's H1 figure is 90 px tall over
that same box; the Kicker's visible size follows from its own geometry (section 1.1) compared with
Tamas's, by the derivation the Striker brief used.

| Item | Recommendation | Derivation |
|---|---|---|
| **Standing height** | **96 px**, soles on the anchor row (94-98 acceptable) | the procedural Kicker stands 100 px to the procedural Tamas's 94 (1.064); the native H1 Tamas is 90 px, so the native Kicker is 1.064 × 90 = 95.7 px. The crown-to-crown ratio (47 : 44 units) gives the same 96; the skeleton alone (×1.14) would give 102, but the Kicker's head is a unit smaller than Tamas's, which the whole-figure ratio already accounts for. The Striker brief's "about 96 px" is **confirmed, not carried over**: it was rechecked on all three measures |
| Scale factor | **1.92 px per procedural unit** (96 / 50) for every length below | |
| **Standing width** | about **46 px** idle, fist to ponytail tip; 52 px in the widest walk cell | 24 and 27 units × 1.92; slimmer than Tamas's 63 and the Striker's 67 |
| Head | a smaller head than Tamas's (procedurally 8 units to his 9: about **15 px** to his 17), **its centre 79 px up**, 10 px above Tamas's and 13 above the Striker's (66) | 41 units up × 1.92 |
| Ponytail | reaches **23-25 px behind the anchor**, swinging 2 px up and down with the walk; the widest point behind the figure in every standing cell | 12-13 units |
| Shoulders | **65 px up**, 23 px across; narrow | 34 units up, torso 12 wide |
| Waist and belt | **40 px up**, waist 15 px, belt 17 px wide | 21 units, 8 and 9 wide |
| Arms | **6 px thick**, sleeved | 3 units |
| Legs | **10 px thick**, shin 8 px with the cream wraps, feet about 13 × 6 px, stance 20 px wide (feet at ±10) | 5 units; feet 7 × 3 at ±5 |
| K1 | K1's costume, head, emblem and rendering decide the look; K1 is drawn at the sizes above: 96 px standing in the cell of section 3, taller and narrower than H1 and the Striker by the ratios in section 1.1, with the long legs that reach the hitboxes of section 5 | |
| Outline, alpha | outline included in the art as on H1 and the Striker; binary alpha; drawn facing right | |

Scale check for the trio: feet aligned, the Kicker's crown stands **6 px above Tamas's** (96 to
90) and **10 px above the Striker's** (86), with its head centre above Tamas's eye line; in the hold
(section 6) it stands chest to chest with Tamas, its collar at the height of his hands. Advice, not
a rule: keep the torso over the collision column (x −12..+12 px around the anchor) so that strikes
are seen to land on the body; feet, hands and the ponytail may go well beyond it.

---

## 3. Cell, anchor, canvas: derived from all of the Kicker's poses

At the recommended scale (1.92 px per unit) the poses span, relative to the anchor:

| Pose | Span at 96 px scale | Height above the anchor row |
|---|---|---|
| idle | −25 .. +19 px | 96 |
| walk (cells 2 and 4 bob) | −25 .. +25 px | **98** |
| high kick, hit cell (section 5 puts the foot in the box) | −33 .. **+54** px | 96, foot 72-84 up |
| sweep, wind-up (crouched) | −25 .. +21 px | 75 |
| sweep, hit cell (foot in the box) | −27 .. **+52** px | 75 |
| hurt | −31 .. +21 px | 96 |
| held | −21 .. +21 px | 94 |
| thrownDown1 (rising) | −38 .. +31 px | 83, lowest point 10 px up |
| thrownDown2 (falling) | **−52** .. +38 px (90 px long) | 63, lowest point 10 px up |
| fallen | **−50** .. +33 px (84 px long) | 33 |
| getUp | −25 .. +25 px | 71 |
| knockdown topple (no procedural pose; the Striker's native cells measure 88 × 58 and 109 × 45 px) | about −55 .. +53 px | about 58 |

Two things rule out the Striker's cell: the **96 px figure plus the 2 px walk bob needs 98 rows
above the anchor**, so a 96 px tall cell with the anchor on row 95 has no headroom at all (the crown
would sit on row 0 and the bob would be cut), and the falling and lying poses need the wide cell
unbent (90 and 84 px long, 50-52 px of it behind the anchor), as the Striker's did. A 96 px wide
cell is ruled out for the same reason (usable −48 .. +47). The recommendation:

| Item | Value |
|---|---|
| **Cell** | **128 × 112 px**, 4 columns per row, PNG width **512** |
| **Anchor** | **(64, 111)**: the anchor row is the floor, planted feet sit on row 111; usable x −64 .. +63, 111 rows above the floor |
| Margins | at least **9 px** on every side of every pose above: the kicking foot (+54) leaves 9 px ahead, the walk bob (98) leaves 13 rows above (crown on row 14; idle crown on row 16), the falling pose (−52) leaves 12 px behind, the lying pose (−50) 14 px |
| Standing cells | the figure centred on column 64, soles on row 111, crown on row 16; room for the ponytail behind and the kicking leg ahead |
| Lying cells | anchor under the hips, **head toward −x (away from Tamas), feet toward +x**, the figure at most 120 px long, never touching the cell edge |
| Verified | the diagnostic sheet of section 4 uses exactly this cell and anchor; the loader cuts cells at the map's own size (`SpriteSheet.cellRect`, asserted in `test/enemySprite.test.js`) and the game drew the 96 px standing block, the 90 px falling block and the 84 px lying block correctly in both facings |

A 128 × 128 cell with the anchor at (64, 127) is acceptable too (16 rows more headroom, a
512 × 1408 sheet); the map carries the choice and nothing in the code changes. 128 × 112 is the
recommendation because it is the smallest cell that holds every pose with margin.

---

## 4. Pipeline check in the real game (done)

`preview/render-kicker-diagnostic.mjs` writes `preview/kicker-diagnostic-sheet.png` and `.json`: a
clearly labelled **PLACEHOLDER** sheet in the 128 × 112 cell with the map of section 8, flat
coloured blocks of the measured sizes (96 px standing, 98 for the bobbing walk cells, the crouched
75 px sweep cells, the raised rising and falling blocks, the 84 px lying block with a dark head end),
an eye on the left and an arm or a leg on the right so mirroring is visible, and **the attack's
hitbox drawn as a red outline on the two hit cells** so its place against Tamas can be read in the
game. It is not artwork and lives only under `docs/art/preview/`.

`preview/enemy-states-harness.html` is a review harness for any enemy sheet: served with the dev
server, it runs the real `Game` and `Renderer` through scripted fights and captures labelled
panels. `?kind=kicker&sheet=kicker-diagnostic-sheet.json` loads the preview sheet directly; without
`sheet` it loads the production path `assets/sprites/kicker.json`, which is how a delivered package
is reviewed (section 8). Each caption gives the frame, Tamas's state and cell, and the Kicker's
state, phase or cell and offset.

`preview/kicker-diagnostic-both-facings.png` is that capture: 72 panels, every state in both
facings (the Kicker to Tamas's right, facing left and mirrored; then to his left, facing right as
drawn): idle; the four walk cells walking in; the high kick's wind-up, hit and recovery against a
**crouching** Tamas (the red box sits above his head, cell 24) and the same kick landing on a
standing Tamas; the four walk cells of the retreat; the sweep's wind-up, hit and recovery against a
**jumping** Tamas (the red box passes under him, cell 37) and the sweep landing; both hurt cells;
the five knockdown beats; the nine beats of the ground throw with the held block drawn over
Tamas's GRAB cell 60; and the lethal throw. Separately, with the two diagnostic files copied to
`assets/sprites/kicker.png` and `kicker.json` for a minute, the game page itself reported
`karateEnemySheets.kicker.ready === true` with cell 128 × 112, anchor (64, 111) and 11 states, so
the production loading path of `src/main.js` picks the Kicker sheet up unchanged. The files were
removed afterwards and are not committed there.

---

## 5. The two attacks, from the simulation

Both are entries of `ATTACKS` in `src/combat.js`, named verbatim in `ENEMY_TYPES.kicker.attacks`,
and `enemyState` reports each as `{ state: <name>, phase }`; `SpriteSheet.frameFor` maps a 3-cell
state as startup → cell 0, active → cell 1, recovery → last cell. Frame counts are measured on
`Enemy.update` at 60 Hz (the attack timer is compared before it is advanced, so the measured phases
differ from the nominal seconds by at most one frame):

| State key | Nominal (s) | Measured frames | Damage, knockback | Hitbox (units, ahead × up) | Hitbox (art px) | Rule |
|---|---|---|---|---|---|---|
| **`enemyHighKick`** | 0.52 / 0.14 / 0.55, total 1.21 | **31 / 8 / 33 = 72** (1.20 s) | 14, 65 | x 6-27, y 30-42 up | **12-54 px ahead, 60-84 px up** (rows 27-51 of the cell) | `HIGH_ATTACKS`: passes over a crouching Tamas (his crouching box is 28 units = 56 px tall; the box clears it by 4 px) |
| **`enemyLowSweep`** | 0.46 / 0.14 / 0.50, total 1.10 | **27 / 8 / 30 = 65** (1.08 s) | 10, 55 | x 4-26, y 2-12 up | **8-52 px ahead, 4-24 px up** (rows 87-107 of the cell) | `LOW_ATTACKS`: skims the floor; jump it (Tamas's jump reaches 37.5 units = 75 px, air time 0.73 s), crouching does not help |

Cell selection, both attacks: wind-up on cell 0 of the state, hit on cell 1, recovery on the last
cell. **There is no separate crouch state for the sweep**: `enemyState` reports
`{ state: 'enemyLowSweep', phase: 'startup' }` for the crouched preparation (asserted in
`test/enemySprite.test.js`), so the crouch is the sweep's own first cell, and the procedural
`crouch` pose is only what the fallback draws for that phase. `block`, `crouch`, `jump` and
`victory` do not exist for the Kicker and must not be mapped.

**Where the hits land.** The Kicker attacks when Tamas is within 27 units and, after a back-off,
at least 12 away, so the contact distance is **24-54 px between the two anchors**; Tamas's
collision column is ±12 px around his anchor. Both boxes reach his column at every distance in that
range, so the strike is seen to land somewhere between his near and his far shoulder.

- High kick, hit cell: the striking **foot occupies x +38 .. +54 px, 72-84 px up** (the top of the
  box; Tamas's H1 face is at 82-88 px, his shoulders at about 60-65), the shin running up from the
  hip through the box. Nothing of the leg below 60 px should look as though it would hit: a
  crouching Tamas's head is at 56 px. The wind-up chambers the knee high (procedurally +5, 25 px
  up); the recovery brings the leg down without leaving the cell.
- Sweep, hit cell: crouched to about 75 px (crown on row 37), the sweeping **foot and shin along
  x +30 .. +52 px, 4-24 px up**, the supporting leg under the hips; the wind-up is the crouch
  with the leg drawn back, the recovery the crouch again. The procedural `crouchPunch` frame the
  game shows today is not the reference (section 1.1).

---

## 6. Movement: walking in, backing off, retreating

`Enemy.update` sets `state = 'walk'` and advances `walkCycle` by **8 per second** in every moving
branch, and `enemyState` returns `{ state: 'walk', loop: walkCycle }`; `frameFor` picks
`walk[floor(loop) mod 4]`. So the four walk cells play **forward at 125 ms per cell, 0.5 s per
cycle, whichever way the Kicker moves**; the facing always points at Tamas. There is no reversed
loop for enemies (the reversed walk mentioned in the grab/throw brief is a hero idea, not made).
The moving branches, measured in one cycle from a kick at 20 units:

| Movement | When | Speed | What the cells show |
|---|---|---|---|
| Walking in | out of range (more than 27 units) or not lined up in depth, outside the cooldown | 40 units/s forward (5 units = 10 px per cell) | the loop forward, moving toward Tamas |
| **Retreat** | the 0.5 s after every kick (`retreatTime`), before the cooldown starts counting | **32 units/s backward** (0.8 × speed): 31 frames, about 16 units | **the loop forward while moving away**, exactly one cycle (cells 0-1-2-3, 7-8 frames each) |
| Back-off | during the cooldown while Tamas is nearer than 12 units (`keepAway`) | 24 units/s backward (0.6 × speed) | the loop forward while moving away, until 12 units apart (15 frames from 6 units) |
| Lining up | during the cooldown or the approach while more than 5 units off in depth (`LINE_UP_Z`) | 28 units/s in depth | the loop forward with little or no movement along the level |
| Entering | walking onto the screen from the edge | 40 units/s | the loop forward |

Measured cycle (rng fixed on the high kick, Tamas idle at 20 units): kick frames 1-72, one idle
frame, retreat 74-104 (cells 0, 1, 2, 3 in turn, 20.5 → 36.5 units away), idle for the 0.75 s
cooldown (105-149), walk in 150-164 (cells 0, 1, 2, 36 → 26.5 units), kick again from 165. The
retreat is the one place a side-scroller shows a figure walking away from the viewer's target, so
the review plan (section 8) looks at the walk cells in both directions and both facings.

Idle, hurt and knockdown follow the shared enemy rules: `idle` between actions and during the
cooldown; `hurt` 2 cells over `PHYSICS.hurtTime` 0.35 s (impact 0-0.175 s, stagger 0.175-0.35 s,
progress `1 − hurtTimer / 0.35`); a death shows the `hurt` impact cell for 0.25 s (15 frames), then
`knockdown` progress 0 → 1 over 0.3 s (topple cell 0.25-0.35 s, floor cell 0.35-0.45 s, lying cell
from 0.45 s), the figure fading from 0.5 s to 0.9 s after the death and removed at 0.9 s.

---

## 7. The victim of the throw: carried over exactly as the code has it

The throw is simulated and timed the same for every type; the frames below were measured on a
Kicker standing 12 units in front of Tamas (`test/enemySprite.test.js` pins the same frames on a
Striker). Gameplay, timing, grip distance, trajectory and the draw order are preserved; this brief
asks for nothing new from the renderer.

| Frames | Time | Tamas cell | Victim state (`enemyState`) | Victim position | Notes |
|---|---|---|---|---|---|
| 1-4 | 0.017-0.067 s | `grab` **56** reach | idle (or whatever it was doing) | wherever it stood | |
| **5-17** | 0.083-0.283 s | `throw` **60** GRAB, the hold | **`held`**, progress 0 → 1 in steps of 1/12 over the 0.2 s hold (13 frames) | **+12 units = 24 px**, same depth, turned to face Tamas, **drawn over Tamas** | cannot move or act, no timers run |
| 18-23 | 0.300-0.383 s | `throw` **61** THROW DOWN | **`thrownDown1`** (rising, `vy < 0`), progress 0 → 0.83 | +12 → +17 units, rising to **3.3 units = 6.7 px** on frames 23-24 (the analytic apex is 2.8 plus the 1-unit head start) | 20 damage (40 in Kiai) and `THROW!` at the release, frame 18 |
| 24-30 | 0.400-0.500 s | `throw` 61 | **`thrownDown2`** (falling), progress 0 → 1 | +18 → +24 units, down to 0.07 units | the hit flash at the release is the standard white flash |
| **31** | 0.517 s | `throw` **62** GROUND IMPACT begins on the touchdown frame (`throwPhase`) | **`fallen`**, progress 0 | lands at **+25 units = 50 px** (Kiai +30 = 60 px), lying feet toward Tamas | `slam`: shake, dust, impact sound |
| 31-69 | 0.517-1.150 s | 62 to frame 47, then idle 0 | `fallen`, progress 0 → 0.97 over the 0.65 s of plain floor time | +25 | 0.9 s floor time from the touchdown (`GRAB.downTime`) |
| 70-84 | 1.167-1.400 s | idle | **`getUp`**, progress 0 → 0.93, the last 0.25 s (`GET_UP_TIME`, 15 frames) | +25 | kneeling up |
| 85 | 1.417 s | | idle: back in the fight in one frame | | |

Lethal throw (measured with 15 hp): dead from the release on frame 18, `thrownDown1` and
`thrownDown2` on the same frames as above, then **`knockdown` at progress 1 (the last `knockdown`
cell) from the touchdown frame 31**, not `fallen`; `deadTimer` counts from the touchdown, so the
figure fades between 0.5 s and 0.9 s after landing (frames 61-85) and is removed at 0.9 s. The map
may give `fallen` and the lying `knockdown` cell the same index. On a miss the grab shows cells
56 → 57 → 58 and nothing happens to the Kicker; if Tamas is hit during the hold the Kicker is let
go where it stands, `hurt` for 0.35 s, not thrown.

**Draw order.** At equal depth the held fighter is drawn after Tamas (the sort tie-break in
`Renderer.render`), so the `held` cell covers whatever of his GRAB cell it overlaps; after the
release the usual order (enemies, then Tamas) returns. The game draws a 14-unit floor shadow under
the victim throughout (30 units once dead, after 0.25 s).

**Where the grip lands on the Kicker.** Tamas's GRAB cell 60 has his hands at **+20 .. +34 px
ahead of his anchor, 51-69 px up**; the held Kicker's anchor is at +24 px. In the Kicker's own
right-facing `held` cell (its front, toward Tamas, is +x; anchor x 64) that region is **x 54-68,
rows 42-60** (−10 .. +4 from the anchor, 51-69 px up): the chest and lapels, just below the
shoulders (65 px up). The Kicker's torso is only about 23 px wide there (x 52-75 of the cell), so
unlike the broad Striker it does not cover Tamas's hands: his fingers show at both edges of the
torso, as they do on the procedural Kicker today (the grab/throw brief's integration review noted
that the kicker and thrower "show the near hand at the collar"). The `held` pose should make the
grip read through the Kicker's own body: collar pulled toward Tamas, shoulders hunched forward,
pulled up onto the toes (the procedural pose lifts the lead heel 1 unit), head turned to him, the
ponytail swung forward. Whatever the cell leaves transparent inside x 54-68, rows 42-60 shows his
hand instead.

**Throw-down and landing.** The Kicker turns over backwards: hips rise, the long legs come up on
the Tamas side (+x in its cell), head drops away from Tamas (−x). `thrownDown1` is the first half,
`thrownDown2` nearly horizontal on its back with the legs up, both drawn with the anchor under the
hips 10 px above the cell's floor row; the simulation moves the anchor from +24 to +48 px meanwhile
and lifts it at most 6.7 px, so the rotation is in the art, not in the renderer. `fallen` lies on
its back, **head away from Tamas, feet toward him**, hips at the anchor, which lands at +50 px:
with Tamas's GROUND IMPACT hands at +20 .. +30 px, the Kicker's feet (toward Tamas, 19-29 px from
its hips) come to about +21 .. +31 px of his anchor, at his lead foot. `getUp` kneels up facing
Tamas, one hand on the floor, and in one frame becomes `idle`.

**Alignment decisions from the founder, and what is PENDING.** The merged native S1 Striker
artwork (`assets/sprites/striker.png`, pull request #11) is the **approved baseline** for how a
victim's `held`, `thrownDown1` and `thrownDown2` cells sit against Tamas's cells 60-62: the grip
partly obscured by the held victim is an accepted minor limitation, and the foreground-hand pass
of the Striker brief's section 8 **remains deferred**; this brief needs no renderer feature for it.
The Striker's cells 20, 24 and 28 carry a **"controlled arm"** treatment (the victim's near arm
directed toward Tamas's grips during the hold and the throw-down, the complete hand clearing him
before touchdown): the **approved v1c revision, `striker.png` `118459f1…`** (founder's decision of
9 November 2026, paired with Tamas `a427c431…`; see the Striker brief's status table). It is the
reference for the equivalent Kicker treatment, which is not yet briefed in detail here. The detailed
arm treatment of the Kicker's `held`, `thrownDown1` and `thrownDown2` cells (24, 28 and 32 in the
map of section 8) is therefore marked **PENDING that separate paired review**. Everything else
about those three cells (size, anchor, orientation, the grip region, the head and feet directions)
is fixed above and in section 3. **Those three native Kicker cells are produced after that
treatment is settled; the other eighteen cell slots proceed independently now**, as the first
artwork package of section 8 (its partial map omits the three pending states, so the game draws
them from the documented per-state procedural fallback; `fallen` [36] and `getUp` [40] are part of
that first package).

---

## 8. Delivery contract: the isolated PNG/JSON package

Every key is one state of the JSON map, derived from `enemyState` and the Kicker's gameplay. The
counts are the minimum; a state may have more cells where "progress" is noted, and `frameFor`
spreads them evenly. One state starts a new row.

| Row | State key | Cells | Shown when | Frame selection and timing (60 simulation frames per second) |
|---|---|---|---|---|
| 0 | `idle` | 1 | between actions, the cooldown, after a hit wears off | held |
| 1 | `walk` | 4 | walking in, lining up, backing off, retreating, entering | loop on `walkCycle`, +8 per second: **125 ms per cell**, always forward (section 6) |
| 2 | `enemyHighKick` | 3 | the high kick: wind-up → cell 0, hit → cell 1, recovery → cell 2 | **31 / 8 / 33 frames**; foot in the box 12-54 px ahead, 60-84 px up |
| 3 | `enemyLowSweep` | 3 | the sweep: crouched wind-up → cell 0, sweep → cell 1, recovery → cell 2 | **27 / 8 / 30 frames**; foot in the box 8-52 px ahead, 4-24 px up |
| 4 | `hurt` | 2 | a hit that does not kill; the first 0.25 s of a death (cell 0); let go from a broken hold | progress over 0.35 s: impact 0-0.175 s, stagger 0.175-0.35 s |
| 5 | `knockdown` | 3 | beaten, after the 0.25 s on the `hurt` impact cell | progress over 0.3 s: topple, floor, lying from 0.45 s; fades 0.5-0.9 s. Killed by the throw: the last cell from the touchdown |
| 6 | `held` | 1 (progress available: 2 = caught, pulled in) | frames 5-17 of the throw | progress 0 → 1 over the hold. **Arm treatment PENDING** (section 7) |
| 7 | `thrownDown1` | 1 (progress available) | rising, frames 18-23 | progress 0 at the release, 1 at the apex. **Arm treatment PENDING** |
| 8 | `thrownDown2` | 1 (progress available) | falling, frames 24-30 | progress 0 at the apex, 1 at the touchdown. **Arm treatment PENDING** |
| 9 | `fallen` | 1 (progress available) | lying after the throw, frames 31-69 | progress 0 at the touchdown, 1 when the get-up starts |
| 10 | `getUp` | 1 (progress available) | the last 0.25 s of the floor time, frames 70-84 | progress 0 → 1 |

**Cell count: 21 populated cell slots in 11 rows** (1 + 4 + 3 + 3 + 2 + 3 + 1 + 1 + 1 + 1 + 1),
each slot its own drawing; no drawing is reused across slots, so 21 slots means 21 cells to draw.
Without the three pending victim slots 24, 28 and 32 that is **18 slots** for the first package.
(An earlier report of this brief said 19 and 16; those were miscounts, corrected here.) Mirroring: every cell faces right; the renderer flips the whole
cell about the anchor x (`ctx.scale(-1, 1)`) for a left-facing Kicker, which is every Kicker
standing to Tamas's right and every held or thrown victim of a right-facing Tamas, so never bake a
left-facing cell. A state missing from the map is drawn procedurally for that frame only, so a
partial package can be staged and looked at in the game.

Isolated package, loaded on its own through `SpriteSheet.load`, staged by copying both files into
`assets/sprites/` (also the production location; there is no atlas to append to):

- `kicker.png`: **512 × 1232 px RGBA**, 4 columns × 11 rows of **128 × 112** cells, the states on
  the rows above, **binary alpha** (no semi-transparent pixels: the hit flash uses `source-in` and
  the Kiai outline works on the alpha), every cell facing right, the standing figure 96 px tall with
  its soles on row 111 of its cell and centred on column 64.
  **Populated cells (21):** 0 · 4, 5, 6, 7 · 8, 9, 10 · 12, 13, 14 · 16, 17 · 20, 21, 22 · 24 ·
  28 · 32 · 36 · 40. **Empty, fully transparent (23 of the 44 slots):** 1-3, 11, 15, 18-19, 23,
  25-27, 29-31, 33-35, 37-39, 41-43.
- `kicker.json`, exactly this map (`"image"` may be left out; without it the PNG is taken from the
  JSON's own name):

  ```json
  {
    "image": "kicker.png",
    "cell": { "w": 128, "h": 112 },
    "anchor": { "x": 64, "y": 111 },
    "columns": 4,
    "states": {
      "idle": [0],
      "walk": [4, 5, 6, 7],
      "enemyHighKick": [8, 9, 10],
      "enemyLowSweep": [12, 13, 14],
      "hurt": [16, 17],
      "knockdown": [20, 21, 22],
      "held": [24],
      "thrownDown1": [28],
      "thrownDown2": [32],
      "fallen": [36],
      "getUp": [40]
    }
  }
  ```

  This exact layout is the complete map `test/enemySprite.test.js` resolves against and the one
  the diagnostic sheet uses. Extra cells for a "progress" state go on that state's row (for
  example `"held": [24, 25]`).

- **Partial-delivery map for the first artwork package (18 cells).** The three pending victim
  states are left out of `states` and their slots 24, 28 and 32 stay fully transparent on the same
  512 × 1232 sheet; the game then draws `held`, `thrownDown1` and `thrownDown2` from the
  procedural fallback for those frames and everything else, `fallen` [36] and `getUp` [40]
  included, from the sheet (`test/enemySprite.test.js` pins this fallback for the partial map):

  ```json
  {
    "image": "kicker.png",
    "cell": { "w": 128, "h": 112 },
    "anchor": { "x": 64, "y": 111 },
    "columns": 4,
    "states": {
      "idle": [0],
      "walk": [4, 5, 6, 7],
      "enemyHighKick": [8, 9, 10],
      "enemyLowSweep": [12, 13, 14],
      "hurt": [16, 17],
      "knockdown": [20, 21, 22],
      "fallen": [36],
      "getUp": [40]
    }
  }
  ```

  **Populated cells (18):** 0 · 4, 5, 6, 7 · 8, 9, 10 · 12, 13, 14 · 16, 17 · 20, 21, 22 · 36 ·
  40. **Empty (26):** the 23 above plus 24, 28 and 32. When the arm treatment is settled, the
  second package adds the three drawings in slots 24, 28 and 32 and the three state entries, which
  turns the partial map into the complete one above; nothing else in the PNG or the map changes.

Per-state fallback and staging check, no code needed: with the two files in `assets/sprites/`,
`npm start`, and in the console
`document.getElementById('karate-game').karateEnemySheets.kicker.ready` is `true`; every Kicker
on screen is drawn from the sheet, any unmapped state from the procedural art. Remove the files and
the procedural Kicker is back.

### Review plan

What the art chat delivers for the Kicker, in one folder:

1. `kicker.png` and `kicker.json`: the first package with the **partial map (18 cells)**; the
   second adds cells 24, 28 and 32 with the complete map after the review of section 7.
2. A real-game capture of **both facings**: stage the package, run the dev server, open
   `docs/art/preview/enemy-states-harness.html?kind=kicker` and save `window.__png` (a base64 data
   URL) as `kicker-native-v1-ingame-states.png`; the harness captures exactly the 72 panels of
   `preview/kicker-diagnostic-both-facings.png`, with the real cells in place of the blocks:
   - **scale**: idle beside Tamas, and the hold (cell 60 with `held` at +24 px, drawn over Tamas)
     where the three heights meet; add one strip at 3× with feet aligned: H1 Tamas cell 56 (90 px),
     the native Striker cell 0 (86 px) and the Kicker's cell 0 (96 px);
   - **the high kick against a crouching Tamas** (frame 35: the foot above his head, cell 24) and
     landing on a standing Tamas (frame 34, cell 20);
   - **the sweep against a jumping Tamas** (frame 31: the foot under him, cell 37) and landing on a
     standing Tamas (frame 30);
   - **walking in** (four cells) and **the retreat** (four cells, moving away), both facings;
   - the two hurt cells, the three knockdown cells and the fade;
   - **the complete ground throw**: reach, hold, hold end, rising, falling, impact, lying, get-up,
     up again (frames 3, 11, 17, 21, 27, 31, 50, 75, 86 against Tamas's cells 56, 60, 61, 62 and 0)
     and the lethal throw (release, landing on the last `knockdown` cell, fade).
3. One line per cell listing anything that departs from this brief (height, a cell wider than its
   usable range, a lying figure longer than 120 px, a foot outside its hitbox), so the review can
   accept or send back by item.

Acceptance is on the real game: both facings, the scale beside H1 and the Striker, both attacks
against the crouch and the jump, the walk in both directions, and the whole throw sequence. The
founder approves.
