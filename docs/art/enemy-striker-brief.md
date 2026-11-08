# Striker native sprite sheet (`assets/sprites/striker.json`) — artwork brief

Code-derived brief, 8 November 2026, written against `main` at `197e8be` (the merge of pull
request #6; the close ground throw, the sprint routing and Tamas's native cells 48-53, 56-58 and
60-62 are all in) plus the renderer change on branch `enemy-sheets-striker`, which this brief
describes in section 2. Every number below is measured on that code or on the shipped atlas
`assets/sprites/tamas.png`; nothing in it asks for a gameplay change, and none is made.

**Decision this brief serves:** all opponent artwork is replaced by native sprite sheets, one per
enemy type, starting with the Striker. The procedural fighters (`drawFighter` in `src/sprites.js`)
remain the fallback and are not tuned any further: in particular the hold occlusion noted in the
grab/throw brief (the victim, drawn over Tamas, hides his near forearm on the bulky procedural
striker and boss) is a temporary limitation to be judged on the finished Striker, not fixed
against the procedural figures (section 8).

**Status at a glance**

| Piece | State |
|---|---|
| Renderer: optional JSON-mapped sheet per enemy type, procedural fallback per state | implemented on `enemy-sheets-striker` (`src/enemySprite.js`, `src/renderer.js`, `src/main.js`), unit-tested, gameplay guard passing |
| Hold, throw-down, landing, floor time, get-up (simulation) | unchanged from `main`; victim offsets and frame numbers below are the merged ones |
| Striker sheet | **to be delivered** by the art chat (section 7) |
| Kicker, thrower, boss sheets | later, same format; what differs for them is in section 9 |

---

## 1. What the game draws today: the procedural Striker

`ENEMY_TYPES.striker` (`src/entities.js`): 30 hp, walks at 48 units/s straight at Tamas, attacks
with `enemyPunch` from 20 units, pauses 0.5-1.0 s between punches, never blocks, never retreats
and never keeps a distance, so it is the one type that only ever walks forward. Score 100. It
cannot crouch or jump; the only way it leaves the floor is Tamas's throw.

`FIGHTER_PALETTES.striker` (`src/sprites.js`), the look to keep:

| Item | Procedural value |
|---|---|
| Build | short and broad: skeleton scaled ×1.15 wide, ×0.92 tall; torso 18 wide (Tamas's fallback figure: 12); arms 6 thick, legs 7 (Tamas: 4 and 5); head 9 |
| Costume | black gi `#25252b` (shade `#121216`, folds `#4a4a55`, trim `#74747f`) with the **sleeves torn off** (bare arms), orange belt `#e07b2c`, black trousers, bare feet |
| Head | `brawler`: black spiky hair `#17110e`, a **long red headband** `#d8402f` with two tails that flutter, an angry narrow stare, eye `#1a1210` |
| Skin | `#e0a878`, shade `#b4774f`; **taped fists** `#ece6d6` |
| Outline | `#120c0a`, one unit all round (the hit flash replaces every colour with white) |

Measured size of the procedural figure, rasterised at one pixel per game unit with its outline,
feet at the anchor, facing right (×2 for art pixels; "ahead" is toward the opponent):

| Pose | Width × height (units) | x extent | y extent (0 = floor) | In art px |
|---|---|---|---|---|
| idle, walk | 29 × 45 | −14 .. +14 | −41 .. +3 | 58 × 90, crown 82 px above the anchor row |
| enemyPunch wind-up | 30 × 45 | −15 .. +14 | | 60 × 90 |
| enemyPunch hit | 37 × 45 | −13 .. +23 | | 74 × 90, fist 46 px ahead |
| hurt | 32 × 45 | −17 .. +14 | | 64 × 90 |
| held | 28 × 44 | −12 .. +15 | −40 .. +3 | 56 × 88 |
| thrownDown1 (rising) | 44 × 34 | −22 .. +21 | −36 .. −3 | 88 × 68 |
| thrownDown2 (falling) | 57 × 27 | −31 .. +25 | −28 .. −2 | 114 × 54 |
| fallen (lying, also dead) | 53 × 17 | −30 .. +22 | −14 .. +2 | 106 × 34 |
| getUp | 34 × 35 | −17 .. +16 | −31 .. +3 | 68 × 70 |

For comparison the procedural Tamas (the fallback figure, not the sheet) is 26 × 47 units in the
same measurement; the native H1 Tamas on the atlas is 63 × 90 px (cell 0 of the approved H1 PNG;
the shipped idle cell is still the 80 px figure).

---

## 2. How a Striker sheet gets selected (renderer, done)

Selection is browser-side only; `game.js`, `entities.js`, `combat.js`, `constants.js` and
`level.js` are untouched (`npm run guard` passes). Three pieces, all on `enemy-sheets-striker`:

1. `ENEMY_SHEETS` in `src/enemySprite.js` names one map per type:
   `assets/sprites/striker.json`, `kicker.json`, `thrower.json`, `boss.json`, each with its PNG next
   to it, loaded by the same `SpriteSheet` class as `tamas.json`. `src/main.js` loads the four
   maps optionally at boot: a type whose files are missing (every type today) keeps its procedural
   art, with no error shown to the player; a sheet that arrives later simply takes over.
2. `enemyState(f)` in `src/enemySprite.js` is the enemy counterpart of `heroState`: it reads the
   fighter and returns the sheet state key plus the attack `phase`, the walk `loop` or a
   `progress` 0..1, in the order `poseFor` uses, so the sheet and the procedural art never
   disagree about which pose a frame is in. The keys are listed in section 5.
3. `Renderer.drawOne` (`src/renderer.js`) routes an enemy to its sheet when one has loaded and
   `resolveFrame` finds a cell for the state; otherwise it falls through to `drawFighter` exactly as
   before. A sheet may therefore cover only some states while the rest stay procedural. Cells are
   drawn 1:1 in art pixels with the anchor on the feet position, **mirrored with
   `ctx.scale(-1, 1)` for a left-facing fighter**: one right-facing set serves both facings, so
   never bake a left-facing cell. The hit flash (`source-in`, white) and the Kiai outline work on
   the cell's alpha, so the background must be fully transparent and there must be no
   semi-transparent pixels.

Verified: with no enemy sheet present, 30 captured frames (idle, hold, release, fall, impact,
get-up, walk, punch wind-up/hit/recovery, hurt, death; both facings) are pixel-identical between
`main` and the branch; with a placeholder sheet staged, every one of those states draws from the
sheet in both facings, the held victim over Tamas as merged. `test/enemySprite.test.js` pins the
resolver against the real simulation (hold frames 5-17, rising from 18, lying from 31, get-up in
the last 0.25 s) and the fallback (no sheet, a sheet still loading, an unmapped state).

---

## 3. Scale, cell and anchor

| Item | Value |
|---|---|
| Hurtbox | `HURTBOX.standing` = 12 × 40 units = **24 × 80 art px**, centred on the anchor, the same for every fighter and independent of the artwork (`src/combat.js`); the Striker never crouches |
| Tamas's reference | the approved H1 figure is **90 px tall for that 80 px hurtbox** (45 units for 40): 2.25 px per hurtbox unit, rows 6-95 |
| **Striker target height** | **86 px, rows 10-95** (84-88 acceptable). Derivation: the procedural skeleton is scaled ×0.92 but the head is not, so the drawn Striker stands 45 units to the procedural Tamas's 47; 45/47 of the 90 px H1 is 86 px. It is the shortest fighter after the thrower, and visibly shorter than Tamas by a head's worth of hair |
| **Striker width** | about **70 px** fist to fist in the idle stance (procedural 29 units to Tamas's 26, applied to the 63 px H1); the torso alone roughly 1.5 × Tamas's (18 to 12) |
| Cell | 96 × 96 px, 4 columns per row, PNG width 384 |
| Anchor | **(48, 95)**: the anchor row is the floor; planted feet sit on row 95. Standing cells keep the hurtbox column (x 36-60) covered by the body; fists, feet and the headband tails may extend beyond it |
| Lateral room | x 8-94 is precedented on Tamas's atlas (knockdown reaches x 8, kick reaches x 94); do not touch the cell edge |
| Lying cells | the whole figure must fit the cell: **at most 86 px long**, so the lying Striker bends at the knees (Tamas's lying cell 42 is 83 px long for a 90 px figure). Anchor under the hips, head toward −x (away from Tamas, section 4), feet toward +x |
| Palette | the Striker's own colours (section 1); match the rendering style of the H1 Tamas (outline included in the art, binary alpha). New colours may be added, the sheet is its own file |
| Facing | drawn facing right, always |

Scale check for the pair: in the hold the Striker's crown at 86 px stands 4 px below Tamas's at
90, chest to chest, which is the relationship the procedural pair has today.

---

## 4. Contact placement for the grip (measured, game units ×2 = art px)

The grip is fixed by the simulation and by Tamas's finished cells; the Striker's cells are drawn
around them.

| Item | Value | Source |
|---|---|---|
| Grip position | victim **+12 units = 24 px** ahead of Tamas's anchor, **same depth**, turned to **face Tamas**, every held frame | `GRAB.holdDistance`, `Game.placeHeld` |
| Draw order | the held victim is drawn **over** Tamas (sort tie-break in `Renderer.render`); after the release the usual order returns (enemies, then Tamas) | `src/renderer.js` |
| Hold length | 13 frames (frames 5-17, 0.217 s) | measured |
| Landing | **+25 units = 50 px** (Kiai: +30 = 60 px), same depth, lying feet toward Tamas | measured |
| Floor time | 0.9 s from the touchdown, the last 0.25 s kneeling up | `GRAB.downTime`, `GET_UP_TIME` |
| Shadow | the game draws a 14-unit floor shadow under the victim throughout (30 units once dead for 0.25 s) | `Renderer.render` |

Tamas's cells on the production atlas, with his forward hands measured as the skin-coloured
pixels ahead of his body (x relative to his anchor, height above the anchor row):

| Frames | Tamas cell | Hands | Victim state (`enemyState`) | Victim centre |
|---|---|---|---|---|
| 1-4 | `grab` **56** reach | +23..+39 px, 54-67 px up | idle (or whatever it was doing) | wherever it stood |
| 5-17 | `throw` **60** GRAB, the hold | **+20..+34 px, 51-69 px up** | `held`, progress 0 → 1 over the hold | **+24 px**, drawn over Tamas |
| 18-30 | `throw` **61** THROW DOWN | +20..+36 px, 33-48 px up | `thrownDown1` while rising (18-23), `thrownDown2` while falling (24-30) | +24 → +48 px, at most 5.6 px off the floor (apex 2.8 units on frame 24) |
| 31-47 | `throw` **62** GROUND IMPACT | +20..+30 px, 33-48 px up | `fallen` from the touchdown frame 31 | **+50 px** |
| 48-69 | idle 0 | | `fallen` | +50 px |
| 70-85 | idle | | `getUp` | +50 px |
| 86 | | | idle: back in the fight | |

(On a miss the grab shows cells 56 → 57 → 58 and nothing happens to the Striker.)

**Where the grip lands on the Striker.** During the hold Tamas's hands occupy x +20..+34 px ahead
of his anchor at 51-69 px above the floor; the Striker's anchor is at +24 px. In the Striker's own
right-facing `held` cell (its front, toward Tamas, is +x), that region is **x 38-52, rows 26-44**:
the chest and collar, 4 px to Tamas's side of the anchor and up to 10 px past it. The grip is
therefore entirely inside the Striker's torso column, and since the Striker is drawn over Tamas,
whatever opaque pixels the `held` cell has there cover his fingers. The `held` pose should make
the grip read through the Striker's own body: collar pulled toward Tamas, shoulders hunched
forward, pulled up onto the toes (the procedural pose lifts the lead heel 1 unit), arms up and
loose at Tamas's grip, head turned to him. Whatever the `held` cell leaves transparent inside
x 38-52, rows 26-44 shows his hand instead: the wrists are at the x 52 end (nearest his body), the
fingers at the x 38 end, deep in the chest.

**Throw-down and landing.** The Striker turns over backwards: hips rise, legs come up on the
Tamas side (+x in its cell), head drops away from Tamas (−x). `thrownDown1` is the first half,
`thrownDown2` nearly horizontal on its back with the legs up, both drawn with the anchor under the
hips; the simulation moves the anchor from +24 to +48 px meanwhile and lifts it at most 5.6 px,
so the rotation is in the art, not in the renderer. `fallen` lies on its back, **head away from
Tamas, feet toward him**, hips at the anchor, which lands at +50 px: with Tamas's GROUND IMPACT
hands at +20..+30 px, the Striker's feet (toward Tamas, 25-40 px from its hips in a bent lying
pose) come to about +10..+25 px of Tamas's anchor, at his lead foot. `getUp` kneels up facing Tamas, one hand on the
floor, and in one frame becomes `idle`.

A lethal throw differs only after the touchdown: the Striker is dead from the release, rises and
falls on the same two cells, and from frame 31 shows the **last `knockdown` cell** (not `fallen`),
fading out between 0.5 s and 0.9 s after landing. The map may give `fallen` and the lying
`knockdown` cell the same index.

---

## 5. States, cells and timing

Every key is one state of the JSON map; the counts are the minimum (a state may have more cells
where "progress" is noted, and `SpriteSheet.frameFor` spreads them evenly). One state starts a new
row, as on Tamas's atlas.

| Row | State key | Cells | Shown when | Cell timing (60 simulation frames per second) |
|---|---|---|---|---|
| 0 | `idle` | 1 | standing between actions, the cooldown, after a hit wears off | held |
| 1 | `walk` | 4 | walking at Tamas (and walking onto the screen) | loop on `walkCycle`, +8 per second: **125 ms per cell**, 0.5 s per cycle; the Striker never walks backward |
| 2 | `enemyPunch` | 3 | the attack, by phase | **wind-up 0.40 s (24 fr) · hit 0.12 s (7 fr) · recovery 0.45 s (27 fr)**; hitbox 6-21 units ahead, 25-34 up = **12-42 px ahead, 50-68 px above the anchor row (rows 27-45)**: the fist in the hit cell sits in that box |
| 3 | `hurt` | 2 | a hit that does not kill; also the first 0.25 s of a death; the victim let go when Tamas's hold is broken | impact **0-0.175 s**, stagger **0.175-0.35 s** (`PHYSICS.hurtTime`) |
| 4 | `knockdown` | 3 | beaten: after the 0.25 s on the `hurt` impact cell | topple 0.25-0.35 s, floor 0.35-0.45 s, lying from 0.45 s; fades 0.5-0.9 s, gone at 0.9 s. A fighter killed by the throw lies on the last cell from the touchdown |
| 5 | `held` | 1 (progress available: 2 = caught, pulled in) | frames 5-17 of the throw | progress runs 0 → 1 over the 0.2 s hold |
| 6 | `thrownDown1` | 1 (progress available) | rising, frames 18-23 | progress 0 at the release, 1 at the apex |
| 7 | `thrownDown2` | 1 (progress available) | falling, frames 24-30 | progress 0 at the apex, 1 at the touchdown |
| 8 | `fallen` | 1 (progress available) | lying after the throw, frames 31-69 | progress 0 at the touchdown, 1 when the get-up starts |
| 9 | `getUp` | 1 (progress available) | the last 0.25 s of the floor time, frames 70-85 | progress 0 → 1 |

Minimum 18 cells in 10 rows: **384 × 960 px**. `block`, `crouch`, `jump` and `victory` do not
exist for the Striker and must not be mapped. A state missing from the map is drawn procedurally
for that frame only, so a partial package can be staged and looked at in the game.

---

## 6. Delivery package: files and JSON map

Isolated package, loaded on its own through `SpriteSheet.load`, staged by copying both files into
`assets/sprites/` (that is also the production location: there is no atlas to append to, each
enemy type has its own sheet):

- `striker.png`: 384 × 960 px RGBA, 4 columns × 10 rows of 96 × 96, the states on the rows of
  section 5, unused cells fully transparent, binary alpha, drawn facing right.
- `striker.json`:

  ```json
  {
    "cell": { "w": 96, "h": 96 },
    "anchor": { "x": 48, "y": 95 },
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

  (`"image": "striker.png"` may be added; without it the PNG is taken from the JSON's own name.)
  This exact layout is the map `test/enemySprite.test.js` resolves against.

Staging check, no code needed: with the two files in `assets/sprites/`, `npm start`, play to the
first wave; every Striker on screen is drawn from the sheet, and `document.getElementById('karate-game').karateEnemySheets.striker.ready`
is `true` in the console. Remove the files and the procedural Striker is back.

---

## 7. Review package

What the art chat delivers for the Striker, in one folder:

1. `striker.png` and `striker.json` as in section 6.
2. A preview PNG at 3× (or the real-game capture, see below) showing the Striker **against
   Tamas's existing cells 56-62**, with the measured offsets of section 4, both facings:
   - cell 56 with the Striker idle at +24 px (the reach),
   - cell 60 with `held` at +24 px, **drawn over Tamas** (the hold, both facings),
   - cell 61 with `thrownDown1` at +30 px, 5 px up (frame 21), and with `thrownDown2` at +44 px,
     4 px up (frame 27),
   - cell 62 with `fallen` at +50 px, and idle cell 0 with `getUp` at +50 px,
   - the Striker alone: idle, the four walk cells, the three punch cells, the two hurt cells, the
     three knockdown cells, so the loop and the phases can be read as a strip.
   Mirroring is a plain horizontal flip of the whole pair, exactly what the renderer does.
   The simplest way to make this preview is the game itself: stage the package (section 6),
   start a fight against a Striker, and capture the art buffer frame by frame as
   `docs/art/preview/integrated-throw-striker.png` was made; a renderer-side capture script is
   not part of this brief.
3. One line per cell listing anything that departs from this brief (height, a cell wider than
   x 8-94, a colour outside the Striker's set), so the review can accept or send back by item.

Acceptance is on the real game: the pair during the hold at both facings, the throw-down, the
landing, then the Striker's own loop and punch against Tamas's P2 and K2.1. The founder approves.

---

## 8. Open question for the founder: is the grip clear, or is a foreground-hand pass needed?

To be settled **once the finished Striker is staged**, not on the procedural figures.

The facts the decision rests on (section 4): Tamas's GRAB cell 60 puts his hands at +20..+34 px,
51-69 px up; the held Striker stands at +24 px, is drawn over him, and its torso covers x 38-52,
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

How it carries to the other types: the grip region in the victim's own cell (x 38-52, rows 26-44)
is the same for everyone; what differs is how much body each type has there. The procedural
`held` poses measure −12..+15 units wide for the Striker, −12..+17 for the boss (hakama, torso
19), −11..+11 for the kicker and −7..+10 for the thrower. The Striker is the broadest of the
regular types and close to the boss; if its finished cell makes the grip clear, the narrower kicker
and thrower will too, and only the boss needs to be looked at again. If the Striker needs the
pass, the pass covers all four at once.

---

## 9. What carries over to the kicker, thrower and boss

Same cell, anchor, format, loader and resolver; a brief per type will restate the measurements,
but the differences are known now:

| Type | Attack state keys (verbatim `ENEMY_TYPES[kind].attacks`) | Extra states | Notes |
|---|---|---|---|
| kicker | `enemyHighKick` (0.52 / 0.14 / 0.55 s, hitbox 6-27 ahead, 30-42 up), `enemyLowSweep` (0.46 / 0.14 / 0.50 s, hitbox 4-26 ahead, 2-12 up) | none | the low sweep's wind-up is a crouch in the procedural art; the kicker keeps 12 units away and steps back for 0.5 s after a kick, which plays the `walk` cells forward while moving backward, as today |
| thrower | `enemyThrow` (0.50 / 0.08 / 0.40 s, no hitbox; the star leaves on the first active frame) | none | the procedural art shows the shuriken in the raised hand during the wind-up; on a sheet the star **must be part of the wind-up cell**, the renderer no longer adds it; keeps 60 units away |
| boss | `bossPunch` (0.30 / 0.12 / 0.34 s), `bossKick` (0.44 / 0.14 / 0.48 s, 6-29 ahead, 30-42 up) | `block` (1 cell, held up to 0.5 s) | 180 hp, the only one that guards; keeps 8 units away and steps back 0.25 s after a strike |

All four share `idle`, `walk` (loop +8 per second), `hurt`, `knockdown` and the five throw-victim
states, with the timings of section 5; the heights follow the same derivation as section 3
(procedural idle heights: kicker 50 units, thrower 41, boss 57, against Tamas's 47).
