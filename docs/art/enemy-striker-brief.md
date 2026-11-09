# Striker native sprite sheet (`assets/sprites/striker.json`) — artwork brief

Code-derived brief, 8 November 2026, written against `main` at `197e8be` (which contains the merge
`d693cde`: the close ground throw, the sprint routing and Tamas's native cells 48-53, 56-58 and
60-62) plus the renderer change on branch `enemy-sheets-striker` (pull request #7), described in
section 2. Every number below is measured on that code or on the shipped atlas
`assets/sprites/tamas.png`; nothing in this brief asks for a gameplay change, and none is made.

**Scope, in the founder's words:** reusable enemy sprite-sheet support with the Striker as the
first application, the procedural renderer kept as the fallback; gameplay, hurtboxes, collision,
timing, grip distance, trajectory and the agreed draw order preserved; Tamas's artwork and routing
intact; visible artwork proportions kept separate from collision dimensions; the cell list and JSON
map derived from the actual rendering and gameplay states; the pipeline verified with labelled
diagnostic artwork. The finished Striker artwork comes from the art chat, built on the established
**S1** Striker design the art chat holds (not in the repository; this brief gives S1 its sizes and
positions, not its look). The foreground-hand decision stays deferred until the replacement
Striker is staged against Tamas (section 8); the temporary hold occlusion stays documented.

**Status at a glance**

| Piece | State |
|---|---|
| Renderer: optional JSON-mapped sheet per enemy type, procedural fallback per state, mirroring | implemented on `enemy-sheets-striker`, unit-tested, gameplay guard passing |
| Pipeline verified with a labelled diagnostic sheet (loading, routing, fallback, mirrored placement, the recommended 128 × 96 cell) | done, `preview/striker-diagnostic-both-facings.png` |
| Hold, throw-down, landing, floor time, get-up (simulation) | unchanged from `main`; the offsets and frame numbers below are the merged ones |
| Striker sheet (S1 at the sizes of section 3) | delivered and merged (pull request #11); production `striker.png` 4551f4f2… was the S1 baseline until the revision below |
| Controlled-arm revision of cells 20, 24, 28 (held, thrownDown1, thrownDown2) | **approved 9 November 2026 (founder): v1c, `striker.png` SHA-256 `118459f1730f5a5b0f738033bb4f80d18bd08795fd3b6137ef230d159e2f6582`** = the art chat's v1 (`ad306ff8…`, cells 20 and 24 as delivered) with cell 28's controlled hand and distal forearm lowered three rows so the complete hand clears Tamas by k30 (real game, both facings: k24 0/36, k27 22/36, k30 36/36). Paired with Tamas `a427c431…` (cells 61/62 as reviewed), unchanged. R1 `975d990a…`, R2 `7dd791be…` and v1.1 `b9e8b8d3…` are historical alternatives, not for integration. The hold's partly obscured grip stays an accepted limitation; the foreground-hand pass stays deferred. |
| Kicker, thrower, boss sheets | later, same mechanism; what differs for them is in section 9 |

---

## 1. What the game draws today: the procedural Striker

`ENEMY_TYPES.striker` (`src/entities.js`): 30 hp, walks at 48 units/s straight at Tamas, attacks
with `enemyPunch` from 20 units, pauses 0.5-1.0 s between punches, never blocks, never retreats
and never keeps a distance, so it is the one type that only ever walks forward. Score 100. It
cannot crouch or jump; the only way it leaves the floor is Tamas's throw.

`FIGHTER_PALETTES.striker` (`src/sprites.js`), the procedural look (S1 replaces it; listed so the
art chat can see what the game's own figure carries):

| Item | Procedural value |
|---|---|
| Build | short and broad: skeleton scaled ×1.15 wide, ×0.92 tall; torso 18 wide (Tamas's fallback figure: 12); arms 6 thick, legs 7 (Tamas: 4 and 5); head 9 |
| Costume | black gi `#25252b` (shade `#121216`, folds `#4a4a55`, trim `#74747f`) with the **sleeves torn off** (bare arms), orange belt `#e07b2c`, black trousers, bare feet |
| Head | `brawler`: black spiky hair `#17110e`, a **long red headband** `#d8402f` with two tails that flutter, an angry narrow stare, eye `#1a1210` |
| Skin | `#e0a878`, shade `#b4774f`; **taped fists** `#ece6d6` |
| Outline | `#120c0a`, one unit all round (the hit flash replaces every colour with white) |

### 1.1 Measured geometry of the procedural Striker

Skeleton joints from `POSES.idle` scaled by the palette (units, relative to the feet, facing
right; 1 unit = 2 art px), and the procedural Tamas fallback figure for the ratio:

| Landmark | Striker (units) | Striker (art px) | Tamas fallback (units) | Striker : Tamas |
|---|---|---|---|---|
| Head centre | 33 up | 66 | 36 up | 0.92 |
| Head box (skin) | 9 × 9, rows 29-37 up; hair to 38, spikes to 40 | 18 × 18 | 9 × 9, to 41 | same head, 3 units lower |
| Shoulders | 28 up, ±6 from the centre | 56 up, ±12 | 30 up, ±3 | 0.93 height, 2× offset |
| Torso width | 19 at the shoulders, 15 at the waist | 38 / 30 | 13 / 9 | 1.46 / 1.67 |
| Hips, belt | 17 up, belt 16 wide | 34 up, 32 wide | 18 up, 10 wide | 0.94, 1.6 |
| Arms | 6 thick; idle lead hand at +9, 29 up | 12 thick | 4 thick | 1.5 |
| Legs | 7 thick (shin 6); feet 9 × 3 at ±6 | 14 thick; feet 18 × 6 at ±12 | 5 thick; feet 7 × 3 at ±5 | 1.4 |

Whole figure, rasterised at one pixel per unit with its outline, feet on the anchor row:

| Pose | Width × height (units) | x extent | y extent (0 = floor) | Art px |
|---|---|---|---|---|
| idle, walk | 29 × 45 | −14 .. +14 | −41 .. +3 | 58 × 90, crown 82 px above the anchor row |
| enemyPunch wind-up | 30 × 45 | −15 .. +14 | | 60 × 90 |
| enemyPunch hit | 37 × 45 | −13 .. +23 | | 74 × 90, fist 46 px ahead |
| hurt | 32 × 45 | −17 .. +14 | | 64 × 90 |
| held | 28 × 44 | −12 .. +15 | −40 .. +3 | 56 × 88 |
| thrownDown1 (rising) | 44 × 34 | −22 .. +21 | −36 .. −3 | 88 × 68 |
| thrownDown2 (falling) | 57 × 27 | −31 .. +25 | −28 .. −2 | **114 × 54** |
| fallen (lying, also dead) | 53 × 17 | −30 .. +22 | −14 .. +2 | **106 × 34** |
| getUp | 34 × 35 | −17 .. +16 | −31 .. +3 | 68 × 70 |

The procedural Tamas is 26 × 47 units (52 × 94 px) in the same measurement; the approved native
H1 Tamas is 63 × 90 px (cell 0 of the H1 PNG: x 18-80, rows 6-95).

---

## 2. How a Striker sheet gets selected (renderer, done)

Selection is browser-side only; `game.js`, `entities.js`, `combat.js`, `constants.js` and
`level.js` are untouched (`npm run guard` passes). Three pieces, all on `enemy-sheets-striker`:

1. `ENEMY_SHEETS` in `src/enemySprite.js` names one map per type:
   `assets/sprites/striker.json`, `kicker.json`, `thrower.json`, `boss.json`, each with its PNG next
   to it, loaded by the same `SpriteSheet` class as `tamas.json`; **cell size and anchor are read
   from each map**, so a type may use its own cell. `src/main.js` loads the four maps optionally
   at boot: a type whose files are missing (every type today) keeps its procedural art, with no
   error shown to the player; a sheet that arrives later simply takes over.
2. `enemyState(f)` in `src/enemySprite.js` is the enemy counterpart of `heroState`: it reads the
   fighter and returns the sheet state key plus the attack `phase`, the walk `loop` or a
   `progress` 0..1, in the order `poseFor` uses, so the sheet and the procedural art never
   disagree about which pose a frame is in. The keys are listed in section 5.
3. `Renderer.drawOne` (`src/renderer.js`) routes an enemy to its sheet when one has loaded and
   `resolveFrame` finds a cell for the state; otherwise it falls through to `drawFighter` exactly as
   before, which draws the existing procedural pose for that frame, `held`, `thrownDown1`,
   `thrownDown2`, `fallen` and `getUp` included. A sheet may therefore cover only some states.
   Cells are drawn 1:1 in art pixels with the map's anchor on the feet position, **mirrored with
   `ctx.scale(-1, 1)` for a left-facing fighter**: one right-facing set serves both facings, so
   never bake a left-facing cell. The hit flash (`source-in`, white) and the Kiai outline work on
   the cell's alpha, so the background must be fully transparent with no semi-transparent pixels.
   Tamas's own routing (`heroState`, `heroFrameIndex`, the legacy sheet) is unchanged.

Verified in the browser (`npm start`), both facings:

- With no enemy sheet present, 30 captured art-buffer frames (idle, hold, release, fall, impact,
  get-up, walk, punch wind-up/hit/recovery, hurt, death; facing right and left) are
  pixel-identical between `main` and the branch.
- With the labelled diagnostic sheet of `preview/render-striker-diagnostic.mjs` staged (128 × 96
  cells, anchor (64, 95), flat blocks marked PLACEHOLDER), every state draws from the sheet in both
  facings, the held victim over Tamas, the lying 100 px block with its head end away from Tamas:
  `preview/striker-diagnostic-both-facings.png`. The diagnostic files live only under
  `docs/art/preview/`; staging means copying them to `assets/sprites/striker.png` and
  `striker.json` and removing them afterwards.
- `test/enemySprite.test.js` pins the resolver against the real simulation (hold frames 5-17,
  rising from 18, lying from 31, get-up in the last 0.25 s), the attack names and phases of all four
  types, and the fallback through `Renderer.drawOne` (no sheet, a sheet still loading, an unmapped
  state, each of the five victim states unmapped, a type without a sheet), with the map of
  section 6.

---

## 3. Recommended artwork dimensions

**Collision is not an art dimension.** `HURTBOX.standing` is 12 × 40 units = 24 × 80 art px for
every fighter, fixed and independent of the artwork (`src/combat.js`); hits land on that box
whatever the cell shows. Tamas's H1 figure is 90 px tall over that same box; the Striker's visible
size follows from the Striker's own geometry (section 1.1), compared with Tamas's.

| Item | Recommendation | Derivation |
|---|---|---|
| **Standing height** | **86 px, crown on row 10, feet on row 95** (84-88 acceptable) | the procedural Striker stands 90 px to the procedural Tamas's 94 (0.957); the native H1 Tamas is 90 px, so the native Striker is 0.957 × 90 = 86 px. Equivalently: skeleton 0.92 × Tamas's with an unscaled head |
| **Standing width** | about **70 px** fist to fist in the idle stance | procedural 58 px to Tamas's 52 (1.12) applied to the 63 px H1 |
| Head | the same size as Tamas's head, **its centre 4 px lower** (66 px up against Tamas's 70) | head box 9 units for both, centre 33 against 36 units up, ×0.957 |
| Shoulders | **56 px up**, 38 px across; the broadest point of the figure sits here | 28 units up, torso 19 wide, ×0.957 |
| Waist and belt | **34 px up**, waist 30 px, belt 32 px wide | 17 units, 15 and 16 wide |
| Arms | **12 px thick**, bare (sleeves torn off) | 6 units; 1.5 × Tamas's procedural arm |
| Legs | **14 px thick**, feet about 18 × 6 px, stance 24 px wide (feet at ±12) | 7 units; feet 9 × 3 at ±6 |
| S1 | S1's costume, head and rendering decide the look; S1 is drawn at the sizes above: 86 px standing in the cell of section 4, shoulders and fists as measured, the silhouette broader and lower than H1 by the ratios in section 1.1 | |
| Outline, alpha | outline included in the art as on H1; binary alpha; drawn facing right | |

Scale check for the pair: in the hold the Striker's crown at 86 px stands 4 px below Tamas's at
90, chest to chest, the relationship the procedural pair has today. Advice, not a rule: keep the
torso over the collision column (x −12..+12 px around the anchor) so that strikes are seen to land
on the body; fists, feet and the headband tails may go well beyond it.

---

## 4. Cell, anchor, canvas: the horizontal poses do not fit a 96 px cell

At the recommended scale (0.957 of the procedural art px) the horizontal poses span:

| Pose | Span at 86 px scale | In a 96 × 96 cell, anchor (48, 95): usable −48 .. +47 |
|---|---|---|
| fallen | −57 .. +42 px (100 px) | head end overflows by 9 px |
| thrownDown2 | −59 .. +48 px (108 px) | overflows by 11 px behind and 1 px ahead |
| thrownDown1 | −42 .. +40 px (83 px) | fits |
| enemyPunch hit | −25 .. +44 px (70 px) | fits |

Tamas's atlas solves this by bending (his lying cell 42 is 83 px long for a 90 px figure). For the
Striker the recommendation is a wider cell instead, so that S1 can lie at its true length with the
anchor under the hips and the feet and head where the simulation puts the victim:

| Item | Value |
|---|---|
| **Cell** | **128 × 96 px**, 4 columns per row, PNG width **512** |
| **Anchor** | **(64, 95)**: the anchor row is the floor, planted feet sit on row 95; usable −64 .. +63 px, at least 5 px of margin around every pose above |
| Standing cells | the figure centred on x 64, crown on row 10; room for the headband tails behind and the fist ahead |
| Lying cells | anchor under the hips, **head toward −x (away from Tamas), feet toward +x**, the figure at most 120 px long, never touching the cell edge |
| Verified | the diagnostic sheet uses exactly this cell and anchor; the loader cuts cells at the map's own size (`cellRect`, asserted in the tests) and the game drew its 100 px lying block correctly in both facings |

If the art chat prefers Tamas's convention (96 × 96, anchor (48, 95), lying poses bent to at most
86 px), the loader accepts that too; the JSON map carries the choice and nothing in the code
changes. The 128 px cell is the recommendation because the measured poses need it unbent.

---

## 5. Contact placement for the grip (measured, game units ×2 = art px)

The grip is fixed by the simulation and by Tamas's finished cells; the Striker's cells are drawn
around them.

| Item | Value | Source |
|---|---|---|
| Grip position | victim **+12 units = 24 px** ahead of Tamas's anchor, **same depth**, turned to **face Tamas**, every held frame | `GRAB.holdDistance`, `Game.placeHeld` |
| Draw order | the held victim is drawn **over** Tamas (sort tie-break in `Renderer.render`); after the release the usual order returns (enemies, then Tamas) | `src/renderer.js` |
| Hold length | 13 frames (frames 5-17, 0.217 s) | measured |
| Trajectory | release at +24 px with 60 units/s forward and the 56 units/s hop; apex 2.8 units = 5.6 px on frame 24; touchdown frame 31 | `GRAB`, measured |
| Landing | **+25 units = 50 px** (Kiai: +30 = 60 px), same depth, lying feet toward Tamas | measured |
| Floor time | 0.9 s from the touchdown, the last 0.25 s kneeling up | `GRAB.downTime`, `GET_UP_TIME` |
| Shadow | the game draws a 14-unit floor shadow under the victim throughout (30 units once dead for 0.25 s) | `Renderer.render` |

Tamas's cells on the production atlas, with his forward hands measured as the skin-coloured
pixels ahead of his body (x relative to his anchor, height above the anchor row):

| Frames | Tamas cell | Hands | Victim state (`enemyState`) | Victim anchor |
|---|---|---|---|---|
| 1-4 | `grab` **56** reach | +23..+39 px, 54-67 px up | idle (or whatever it was doing) | wherever it stood |
| 5-17 | `throw` **60** GRAB, the hold | **+20..+34 px, 51-69 px up** | `held`, progress 0 → 1 over the hold | **+24 px**, drawn over Tamas |
| 18-30 | `throw` **61** THROW DOWN | +20..+36 px, 33-48 px up | `thrownDown1` while rising (18-23), `thrownDown2` while falling (24-30) | +24 → +48 px, at most 5.6 px off the floor |
| 31-47 | `throw` **62** GROUND IMPACT | +20..+30 px, 33-48 px up | `fallen` from the touchdown frame 31 | **+50 px** |
| 48-69 | idle 0 | | `fallen` | +50 px |
| 70-85 | idle | | `getUp` | +50 px |
| 86 | | | idle: back in the fight | |

(On a miss the grab shows cells 56 → 57 → 58 and nothing happens to the Striker.)

**Where the grip lands on the Striker.** During the hold Tamas's hands occupy x +20..+34 px ahead
of his anchor at 51-69 px above the floor; the Striker's anchor is at +24 px. In the Striker's own
right-facing `held` cell (its front, toward Tamas, is +x; anchor x 64), that region is
**x 54-68, rows 26-44**: the chest and collar, 4 px to Tamas's side of the anchor and up to 10 px
past it, with the wrists at the x 68 end (nearest his body) and the fingers at the x 54 end, deep
in the chest. The grip is entirely inside the Striker's torso column, and since the Striker is
drawn over Tamas, whatever opaque pixels the `held` cell has there cover his fingers. The `held`
pose should make the grip read through the Striker's own body: collar pulled toward Tamas,
shoulders hunched forward, pulled up onto the toes (the procedural pose lifts the lead heel 1
unit), arms up and loose at Tamas's grip, head turned to him. Whatever the cell leaves
transparent inside x 54-68, rows 26-44 shows his hand instead.

**Throw-down and landing.** The Striker turns over backwards: hips rise, legs come up on the
Tamas side (+x in its cell), head drops away from Tamas (−x). `thrownDown1` is the first half,
`thrownDown2` nearly horizontal on its back with the legs up, both drawn with the anchor under the
hips; the simulation moves the anchor from +24 to +48 px meanwhile and lifts it at most 5.6 px,
so the rotation is in the art, not in the renderer. `fallen` lies on its back, **head away from
Tamas, feet toward him**, hips at the anchor, which lands at +50 px: with Tamas's GROUND IMPACT
hands at +20..+30 px, the Striker's feet (toward Tamas, 25-42 px from its hips) come to about
+8..+25 px of Tamas's anchor, at his lead foot. `getUp` kneels up facing Tamas, one hand on the
floor, and in one frame becomes `idle`.

A lethal throw differs only after the touchdown: the Striker is dead from the release, rises and
falls on the same two cells, and from frame 31 shows the **last `knockdown` cell** (not `fallen`),
fading out between 0.5 s and 0.9 s after landing. The map may give `fallen` and the lying
`knockdown` cell the same index.

---

## 6. States, cells, frame selection and timing

Every key is one state of the JSON map, derived from `enemyState` and the Striker's gameplay. The
counts are the minimum; a state may have more cells where "progress" is noted, and
`SpriteSheet.frameFor` spreads them evenly. One state starts a new row, as on Tamas's atlas.

| Row | State key | Cells | Shown when | Frame selection and timing (60 simulation frames per second) |
|---|---|---|---|---|
| 0 | `idle` | 1 | standing between actions, the cooldown, after a hit wears off | held |
| 1 | `walk` | 4 | walking at Tamas (and walking onto the screen) | loop on `walkCycle`, +8 per second: **125 ms per cell**, 0.5 s per cycle; the Striker never walks backward |
| 2 | `enemyPunch` | 3 | the attack, by phase: startup → cell 0, active → cell 1, recovery → cell 2 | **wind-up 0.40 s (24 fr) · hit 0.12 s (7 fr) · recovery 0.45 s (27 fr)**; hitbox 6-21 units ahead, 25-34 up = **12-42 px ahead, 50-68 px above the anchor row (rows 27-45)**: the fist in the hit cell sits in that box |
| 3 | `hurt` | 2 | a hit that does not kill; the first 0.25 s of a death (cell 0); the victim let go when Tamas's hold is broken | progress over `PHYSICS.hurtTime`: impact **0-0.175 s**, stagger **0.175-0.35 s** |
| 4 | `knockdown` | 3 | beaten, after the 0.25 s on the `hurt` impact cell | progress over 0.3 s: topple 0.25-0.35 s, floor 0.35-0.45 s, lying from 0.45 s; fades 0.5-0.9 s, gone at 0.9 s. Killed by the throw: the last cell from the touchdown |
| 5 | `held` | 1 (progress available: 2 = caught, pulled in) | frames 5-17 of the throw | progress 0 → 1 over the 0.2 s hold |
| 6 | `thrownDown1` | 1 (progress available) | rising, frames 18-23 | progress 0 at the release, 1 at the apex |
| 7 | `thrownDown2` | 1 (progress available) | falling, frames 24-30 | progress 0 at the apex, 1 at the touchdown |
| 8 | `fallen` | 1 (progress available) | lying after the throw, frames 31-69 | progress 0 at the touchdown, 1 when the get-up starts |
| 9 | `getUp` | 1 (progress available) | the last 0.25 s of the floor time, frames 70-85 | progress 0 → 1 |

Minimum 18 cells in 10 rows. Mirroring: every cell faces right; the renderer flips the whole cell
about the anchor x for a left-facing Striker, which is every Striker standing to Tamas's right and
every held or thrown victim of a right-facing Tamas. `block`, `crouch`, `jump` and `victory` do not
exist for the Striker and must not be mapped. A state missing from the map is drawn procedurally
for that frame only, so a partial package can be staged and looked at in the game.

---

## 7. Delivery contract: the isolated PNG/JSON package

Isolated package, loaded on its own through `SpriteSheet.load`, staged by copying both files into
`assets/sprites/` (also the production location: each enemy type has its own sheet, there is no
atlas to append to):

- `striker.png`: **512 × 960 px RGBA**, 4 columns × 10 rows of **128 × 96** cells, the states on
  the rows of section 6, unused cells fully transparent, binary alpha, every cell facing right,
  the standing figure 86 px tall with its feet on row 95 of its cell and centred on column 64.
- `striker.json`, exactly this map (add `"image": "striker.png"` or leave it out; without it the
  PNG is taken from the JSON's own name):

  ```json
  {
    "cell": { "w": 128, "h": 96 },
    "anchor": { "x": 64, "y": 95 },
    "columns": 4,
    "states": {
      "idle": [0],
      "walk": [4, 5, 6, 7],
      "enemyPunch": [8, 9, 10],
      "hurt": [12, 13],
      "knockdown": [16, 17, 18],
      "held": [20],
      "thrownDown1": [24],
      "thrownDown2": [28],
      "fallen": [32],
      "getUp": [36]
    }
  }
  ```

  This exact layout is the map `test/enemySprite.test.js` resolves against and the one the
  diagnostic sheet uses. Extra cells for a "progress" state go on that state's row (for example
  `"held": [20, 21]`).

Staging check, no code needed: with the two files in `assets/sprites/`, `npm start`, play to the
first wave; every Striker on screen is drawn from the sheet, and in the console
`document.getElementById('karate-game').karateEnemySheets.striker.ready` is `true`. Remove the
files and the procedural Striker is back.

### Review package

What the art chat delivers for the Striker, in one folder:

1. `striker.png` and `striker.json` as above.
2. A preview PNG at 3× (or a real-game capture) showing the Striker **against Tamas's existing
   cells 56-62**, with the offsets of section 5, both facings:
   - cell 56 with the Striker idle at +24 px (the reach),
   - cell 60 with `held` at +24 px, **drawn over Tamas** (the hold, both facings),
   - cell 61 with `thrownDown1` at +30 px, 5 px up (frame 21), and with `thrownDown2` at +44 px,
     4 px up (frame 27),
   - cell 62 with `fallen` at +50 px, and idle cell 0 with `getUp` at +50 px,
   - the Striker alone: idle, the four walk cells, the three punch cells, the two hurt cells, the
     three knockdown cells, so the loop and the phases can be read as a strip.
   Mirroring is a plain horizontal flip of the whole pair about Tamas's anchor, which is what the
   renderer does. The simplest way to make this preview is the game itself: stage the package,
   start a fight against a Striker, and capture the art buffer frame by frame as
   `preview/integrated-throw-striker.png` was made.
3. One line per cell listing anything that departs from this brief (height, a cell wider than its
   usable range, a lying figure longer than 120 px), so the review can accept or send back by item.

Acceptance is on the real game: the pair during the hold at both facings, the throw-down, the
landing, then the Striker's own loop and punch against Tamas's P2 and K2.1. The founder approves.

---

## 8. Deferred: is the grip clear, or is a foreground-hand pass needed?

To be settled **once the replacement Striker is staged against Tamas**, not on the procedural
figures. The temporary hold occlusion stands documented here and in the grab/throw brief.

The facts the decision rests on (section 5): Tamas's GRAB cell 60 puts his hands at +20..+34 px,
51-69 px up; the held Striker stands at +24 px, is drawn over him, and its torso covers x 54-68,
rows 26-44 of its own cell, which is exactly where those hands are. Today the grip reads through
proximity and Tamas's visible upper arms, with the fingers hidden by the bulky procedural body.

Two possible outcomes:

- **The artwork makes the grip clear.** The `held` cell shows the collar grabbed and the body
  pulled in, and the review of the staged pair at both facings finds nothing missing. Then no
  renderer work follows, and the same rule (the victim's `held` cell carries the grip) goes into
  the kicker, thrower and boss briefs.
- **A small reusable foreground-hand pass is still needed.** If the hidden fingers are missed even
  with the finished cell, the fix is presentation only: one or two extra cells of Tamas's hands
  alone (for example a `throwHands` state on Tamas's atlas, same cell and anchor), drawn **after**
  the held victim during the hold frames 5-17 and nothing else. It is reusable because the grip
  geometry is the same for every type: `holdDistance` is +24 px for all, and Tamas's cells are
  shared, so one pass serves all four opponents. It would need a small renderer addition (draw the
  overlay cell after the held fighter) and no gameplay change. Not to be started before the
  decision.

How it carries to the other types: the grip region in the victim's own cell (the 14 px just in
front of and behind the victim's anchor at rows 26-44) is the same for everyone; what differs is
how much body each type has there. The procedural `held` poses measure −12..+15 units wide for the
Striker, −12..+17 for the boss (hakama, torso 19), −11..+11 for the kicker and −7..+10 for the
thrower. The Striker is the broadest of the regular types and close to the boss; if its finished
cell makes the grip clear, the narrower kicker and thrower will too, and only the boss needs to be
looked at again. If the Striker needs the pass, the pass covers all four at once.

---

## 9. What carries over to the kicker, thrower and boss

Same loader, resolver, JSON format and verification; each type picks its own cell and anchor in
its map. A brief per type will restate the measurements; the differences are known now:

| Type | Attack state keys (verbatim `ENEMY_TYPES[kind].attacks`) | Extra states | Notes |
|---|---|---|---|
| kicker | `enemyHighKick` (0.52 / 0.14 / 0.55 s, hitbox 6-27 ahead, 30-42 up), `enemyLowSweep` (0.46 / 0.14 / 0.50 s, hitbox 4-26 ahead, 2-12 up) | none | the low sweep's wind-up is a crouch in the procedural art; the kicker keeps 12 units away and steps back for 0.5 s after a kick, which plays the `walk` cells forward while moving backward, as today |
| thrower | `enemyThrow` (0.50 / 0.08 / 0.40 s, no hitbox; the star leaves on the first active frame) | none | the procedural art shows the shuriken in the raised hand during the wind-up; on a sheet the star **must be part of the wind-up cell**, the renderer no longer adds it; keeps 60 units away |
| boss | `bossPunch` (0.30 / 0.12 / 0.34 s), `bossKick` (0.44 / 0.14 / 0.48 s, 6-29 ahead, 30-42 up) | `block` (1 cell, held up to 0.5 s) | 180 hp, the only one that guards; keeps 8 units away and steps back 0.25 s after a strike |

All four share `idle`, `walk` (loop +8 per second), `hurt`, `knockdown` and the five throw-victim
states, with the timings of section 6. Heights follow the derivation of section 3 from each
type's own geometry (procedural idle heights at one pixel per unit: kicker 50, thrower 41, boss
57, Striker 45, Tamas 47; so about 96, 78, 109 and 86 px against the 90 px H1), and the cell-fit
check of section 4 is repeated per type: the boss's lying pose measures 112 × 44 px procedurally
and will need the wide cell as well.
