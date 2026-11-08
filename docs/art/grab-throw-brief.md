# Tamas grab and throw (states `grab`, `throw`) — artwork brief, revision 3

Code-derived brief, 8 November 2026. The ground throw described in section 3 is **implemented
and tested** in the worktree `karate-game-controls/` on branch `art-briefs-sprint-throw` (based
on `main` at `fe81749`), as uncommitted changes to `combat.js`, `constants.js`, `entities.js`,
`game.js`, `sprites.js`, `heroSprite.js`, `renderer.js`, the tests and the geometry pin. Nothing is
merged. Section 1 records the baseline it replaces, for the record.

**Target reference:** "TAMAS — GROUND THROW CONCEPT", panels GRAB / THROW DOWN / GROUND IMPACT
(approved; received as `02-ground-throw-APPROVED-CONCEPT.png`, 2172 × 724 px, a visual concept, not a
native sheet or a timing specification). The earlier forward-throw concept is withdrawn.

**Status at a glance**

| Piece | State |
|---|---|
| Hold, downward throw, nearby landing, impact beat, interruption (simulation) | implemented, 62 tests pass, checked in the browser |
| Victim poses: held, turning over (two poses), lying, getting up (procedural, all enemy types) | implemented (`POSES` in `src/sprites.js`) |
| Tamas's poses for the three phases, procedural fallback | implemented (`grab`, `throw`, `throwDone`) |
| Tamas's production cells `grab` (3) and `throw` (3) | **awaiting native artwork**; the live game shows the legacy sheet's punch and victory cells meanwhile |
| Native H1 (90 px) proportions on new cells | awaiting native artwork; the shipped sheet is still the 80 px figure |

The victim is a separate fighter with its own (procedural) art path; nothing of the victim is
drawn on Tamas's cells.

---

## 1. Baseline before this change (`main` at `fe81749`)

Kept short; the full measurements are in revision 2 of this brief.

- `grab`: startup 0.08 s (4 fr), active 0.08 s (5 fr), recovery 0.28 s (17 fr); hitbox x 2-18,
  y −34 to −4 ahead of the feet; unblockable. `throw`: startup 0, active 0.16 s, recovery
  0.30 s; no hitbox.
- On contact (first active frame, 83 ms after the press) the victim was snapped to +10 and
  launched **in the same frame**: forward 150, upward 150 units/s, apex 20 units, landing 90
  units ahead after 0.53 s, then 0.9 s on the floor. Damage, score, text and shake all at contact.
- Victim art: the standing `hurt` pose translated along the arc, never rotated; `fallen` on the
  floor; instant idle after. No hold, no rotation, no get-up.
- Reachable Tamas cells: grab 3, throw 2 (zero start-up), and a successful grab showed only
  grab cell 0 before jumping to the throw.
- The grab's start conditions (punch+kick together, or the other button during a strike's
  start-up; grounded; not crouching or blocking) are unchanged by this revision.

---

## 2. Approved target: the ground throw

1. **Grip (GRAB).** Tamas takes a readable close grip and draws the opponent in. The opponent is
   visibly held against him for a moment: upright, pulled off balance toward Tamas.
2. **Throw down (THROW DOWN).** Tamas turns the opponent downward in front of him. The opponent
   rotates from upright to horizontal while Tamas stays balanced, feet planted, weight low.
3. **Ground impact (GROUND IMPACT).** The opponent lands on back or side on the floor directly in
   front of Tamas, within reach, on the same depth, head clear of the impact. Tamas remains
   standing over them in a settled stance, then returns to idle.

The simulated position must do what the picture shows: hitboxes are position-based, strikes skip
held, flying and lying fighters, and a drawn position that differs from the real one would be
felt in play. The implementation below keeps them identical.

---

## 3. Implementation (done) and measurements

### 3.1 Phases and timing

`ATTACKS` in `src/combat.js`, 60 simulation frames per second:

| State key | startup | active | recovery | total | Role |
|---|---|---|---|---|---|
| `grab` | 0.08 s (4 fr) | 0.08 s (5 fr) | 0.28 s (17 fr) | 0.44 s | reach; unchanged |
| `throw` | **0.20 s (12 fr)** | **0.20 s (12 fr)** | 0.30 s (18 fr) | 0.70 s | startup = the hold, active = the throw-down, recovery = standing over the victim |

Measured on a striker standing 12 units in front (the test duel and the browser run agree):

| Time from press | Frame | Tamas | Victim |
|---|---|---|---|
| 0 – 0.067 s | 1-4 | `grab` startup (cell 0) | standing |
| 0.083 s | 5 | contact: switches to `throw` startup the same step | gripped: moved to +12, same depth, turned to face Tamas, `held` |
| 0.083 – 0.283 s | 5-17 | `throw` startup, **the hold (13 frames, 0.22 s)** | held: cannot move or act, no timers run, drawn **over** Tamas |
| 0.300 s | 18 | `throw` active begins: **release** | thrown: 20 damage (40 in Kiai), `THROW!`, score and combo credited |
| 0.300 – 0.483 s | 18-29 | `throw` active, the throw-down | turning over: rises 2.8 units at most, comes down |
| 0.517 s | 31 | `throw` recovery, first frame (**GROUND IMPACT**) | lands at **+25**, `slam`: shake 0.2, 8 dust particles, impact sound |
| 0.517 – 0.783 s | 31-47 | `throw` recovery | lying (`fallen`) |
| 0.783 s | 47 | idle | lying |
| 1.167 – 1.417 s | 70-85 | idle | kneeling up (`getUp`, the last 0.25 s of the floor time) |
| 1.417 s | 85 | | back in the fight in one frame; the 0.9 s floor time is unchanged |

The victim reaches the floor one frame after the active phase ends, so the GROUND IMPACT cell
begins on the same frame the victim lands. The hold is one frame longer than the nominal 0.20 s
because the contact frame itself counts.

Trajectory (the existing `takeThrow` physics with small values; `GRAB` in `src/constants.js`):

```
launch:   vx = GRAB.throwSpeed = 60 units/s forward,  vy = GRAB.launchVy = -56 units/s (up), raised 1 unit
air time: 2 * abs(vy) / gravity = 2 * 56 / 560 = 0.20 s   (+1 frame for the 1-unit head start)
apex:     vy^2 / (2 * gravity) = 2.8 units
distance: vx * air time = 60 * 0.217 = 13 units
landing:  holdDistance + distance = 12 + 13 = 25 units in front of Tamas (Kiai: vx * 1.4, lands at +30)
```

Constraints that fixed the values: the air time equals the active phase so the impact lands on the
GROUND IMPACT cell; the landing spot is beyond the 11-unit player-enemy separation distance (the
floor code would otherwise push them apart) and inside arm's reach (the kick box reaches 26).

### 3.2 Grip and landing offsets (game units, Tamas facing right; ×2 for art px)

| Item | Value | Where |
|---|---|---|
| Contact window | victim centre between −4 and +24 units ahead, within 7 units of depth | grab box vs standing hurtbox |
| Grip position | **+12**, same depth: the two standing hurtboxes (±6) touch chest to chest | `GRAB.holdDistance`, `Game.placeHeld` every held frame |
| Victim facing during hold and flight | toward Tamas | `placeHeld`, `takeThrow` |
| Landing | +25 (Kiai +30), same depth; lies **feet toward Tamas, head away** (`fallen` puts the head 14 units behind the facing) | measured |
| Draw order | depth first; at equal depth the **held** fighter is drawn over Tamas (one-line sort tie-break in `Renderer.render`), everyone else keeps array order (enemies, then Tamas) | `src/renderer.js` |
| Shadow | the 14-unit floor shadow stays under the victim throughout | unchanged |

Implication for Tamas's cells: during the hold the victim's centre is 24 px ahead of the anchor
and the victim is drawn in front, so the GRAB cell's hands should read at the victim's collar
height (chest, around 50-60 px above the anchor row) and reach roughly 16-30 px ahead. During
THROW DOWN the victim's centre moves from 24 px to 50 px ahead while turning over; the
GROUND IMPACT cell has the victim lying with its centre 50 px ahead and its body spanning
roughly 20-80 px ahead of the anchor.

### 3.3 Interruptions and edge cases (tested)

- **Tamas hit during the hold:** his attack is cleared (BH2 hurt, 0.35 s). The victim is let go
  where it stands: not thrown, no damage, no combo, `hurt` for 0.35 s and then back in the fight.
- **Tamas hit during the throw-down or recovery:** he staggers; the victim finishes its fall and
  floor time as normal.
- A held fighter cannot be struck, grabbed again, pushed apart by the separation code, or
  counted as a threat for hold-back blocking; it cannot act or attack.
- A grab still misses a victim that is dead, airborne, held, lying down or more than 7 units
  away in depth, and still goes through Master Kage's guard. A miss is cells 0 → 1 → 2 as before.
- A lethal throw: the victim dies at the release, turns over as a dead fighter, lands (`down`),
  lies, fades from 0.5 s to 0.9 s after landing.
- Kiai: damage ×2, forward speed ×1.4 (landing +30), timing unchanged.

### 3.4 What changed, and why (gameplay files)

| Change | Why |
|---|---|
| `throw.startup` 0 → 0.20 s, `active` 0.16 → 0.20 s | the start-up is the only place a hold fits the existing phase-to-cell mapping; the active phase is the fall |
| `GRAB.holdDistance` 10 → 12, `launchVy` −150 → −56, `throwSpeed` 150 → 60 | chest-to-chest grip; a 0.2 s drop that lands at +25 instead of +90 |
| new `Fighter.held`, `hold()`, `release()`; `Game.updateThrow`, `placeHeld`, `onPlayerGrabs` | the hold and its release on interruption |
| damage, score, combo and `THROW!` moved from the contact frame to the release | the victim must be alive and standing during the hold |
| shake, burst and impact sound moved to the landing (`slam` event) | the impact is the readable beat |
| geometry pin refreshed | the constants above are part of it; the replay checksum did not change (the test bot never throws) |

Damage (20), the 0.9 s floor time, the grab's timing and reach, the controls and the unblockable
rule are preserved.

### 3.5 Victim poses (presentation, `POSES` in `src/sprites.js`)

All four enemy types are drawn procedurally; there are no enemy images. The new poses follow
each type's palette and proportions automatically (Kage's hakama is skipped in the lying pose).

| Phase | Picked by | Pose |
|---|---|---|
| Hold | `held` | `held`: upright, pulled onto the toes toward Tamas, arms up at his grip |
| Throw-down, first half | `thrown` and rising (`vy < 0`) | `thrownDown1`: tilting backwards, hips rising, legs coming up |
| Throw-down, second half | `thrown` and falling | `thrownDown2`: nearly horizontal on its back, legs up, arms out |
| Impact and lying | `down` | `fallen` (unchanged) |
| Getting up | `down` and floor time below 0.25 s (`GET_UP_TIME`, drawing only) | `getUp`: kneeling, one hand on the floor |

The rotation is drawn (two poses), not a canvas rotation, so it needs nothing from the renderer.
If hand-drawn enemy sheets come later, these five states are the ones a throw needs.

### 3.6 Final phase-to-cell mapping for Tamas

`heroState` already returns the attack phase, and `SpriteSheet.frameFor` maps a 3-cell state as
startup → cell 0, active → cell 1, recovery → last cell. With the 0.20 s start-up that gives:

| State | Cell 0 | Cell 1 | Cell 2 |
|---|---|---|---|
| `grab` (3 cells) | reach begins — 0.07 s, the only grab cell seen on a hit | reach extended — 0.08 s on a miss (or on a late contact inside the window) | miss recovery — 0.28 s |
| `throw` (3 cells) | **GRAB**: close grip, drawing the victim in — the hold, 0.22 s | **THROW DOWN**: turning the victim over, feet planted — 0.20 s | **GROUND IMPACT**: standing over the victim, settled — 0.30 s, from the frame the victim lands |

Successful grab as seen by the player: grab 0 → throw 0 → throw 1 → throw 2 → idle. Feet stay on
the anchor row in every cell; the balance reads through torso, hips and arms. The victim is never
on Tamas's cells.

Until the native cells exist, the production sheet has no `grab`/`throw` states and the game falls
back to the legacy sheet (punch cell during the grab, raised-arm cell during the whole throw,
idle during recovery). The procedural poses `grab`, `throw` and `throwDone` cover the no-sheet
fallback and the preview below.

### 3.7 Preview

`preview/ground-throw.png` is rendered straight from the simulation by
`preview/render-ground-throw.mjs` (`node docs/art/preview/render-ground-throw.mjs`, no browser
needed) with the procedural fighters, one panel per beat: grab reach, hold start, hold end,
throw-down rising, throw-down falling, ground impact, lying, get-up. Each caption carries the
time, Tamas's pose, the victim's pose and the victim's offset. It shows the motion and the
timing, not the production art.

---

## Unchanged: hold-back block and backward walking

- **Hold-back block routes to BH2 already.** `Player.update` sets `blocking` from the block key
  or from holding away from an incoming strike or star; both set `state = 'block'` → cell 16.
- **Backward walking** keeps the facing and plays W1 cells 4-7 forward while moving backward. No
  artwork needed: `frameFor` accepts negative loop values, so `heroState` can reverse W1 when
  `Math.sign(f.vx) === -f.facing` (presentation; one line plus a test). Not made yet.

## Drawing rules

96 × 96 cells, anchor (48, 95), the sheet's 30 colours, alpha 0 background, no semi-transparent
pixels (the hit flash uses `source-in`), drawn facing right. New cells follow the **approved
native H1 proportions: 90 px tall, rows 6-95** (measured on the native H1 PNG `01-tamas-idle-h1-NATIVE.png` received 8 November 2026: figure x 18-80, y 6-95, 63 × 90 px, binary alpha, the same 30 colours as the shipped sheet; the shipped production sheet still has the
80 px figure at x 18-77, rows 16-95, which is what the game draws today). The body may lean
or bend, never be resized. Reach cells may extend to x 94 (precedented by kick cell 13). H1, W1,
P2, K2.1, BH2, CL2, J2, KD1 and V1 stay pixel-identical: new states are appended as new rows only.

## Delivery package

Isolated review package, loaded on its own through `SpriteSheet.load`:

- `tamas-grab-throw.png`: 384 × 192 px RGBA, 4 columns × 2 rows of 96 × 96. Row 0 = grab cells
  0, 1, 2 (cell 3 transparent); row 1 = throw cells 4, 5, 6 (cell 7 transparent).
- `tamas-grab-throw.json`:

  ```json
  {
    "cell": { "w": 96, "h": 96 },
    "anchor": { "x": 48, "y": 95 },
    "columns": 4,
    "image": "tamas-grab-throw.png",
    "states": { "grab": [0, 1, 2], "throw": [4, 5, 6] }
  }
  ```

Integration (developer): append one row per state to `assets/sprites/tamas.png` after the sprint
rows (grab row 14 → cells 56-58, throw row 15 → cells 60-62; 384 × 1536 px), or rows 12-13 if this
sheet lands first; add the arrays to `assets/sprites/tamas.json`; assert them in
`test/spriteSheet.test.js` with `frameFor('throw', { phase })` → startup 60, active 61, recovery 62.
No further code is needed: the routing for both states is already in place.
