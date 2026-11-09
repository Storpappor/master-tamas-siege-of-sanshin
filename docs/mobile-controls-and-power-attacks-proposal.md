# Mobile controls and momentum power attacks: proposal

Written 9 November 2026 against `main` at `5ca9ff95` (the shipped Striker v1c release).
This is a design and prototype plan, not an implementation. Nothing in the game changes with
this document, and no gameplay file is touched (`npm run guard` stays green).

**First written version.** There is no earlier mobile-controls document in `docs/` on any
branch, and the repository history (`git log --all -- docs`) has none either. The mobile layout
that exists today was built directly into `index.html` with the first controls work (pull
request #3). So this document starts from the code, not from an earlier proposal.

Every number in a section called *experiment* is a starting point for testing. None of them
is approved; they are there so the prototype has something concrete to measure against.

**Revision, 9 November 2026 (founder's clarifications after the first version):** the default
mobile layout is the four buttons PUNCH, KICK, JUMP and THROW plus the tappable Ajsich meter,
and nothing else. The earlier claim that DUCK is *required* on mobile is withdrawn: every enemy
attack has a defence with those four buttons plus the hold-back guard (section 5.1). DUCK and
a fallback BLOCK are alternatives to evaluate in encounters, not approved additions. The power
prototype directions in section 6.5 (no Kiai and power stacking, guard clears the run-up,
depth movement never charges, landing recovery after an attempted powered aerial attack) come
from the founder and are binding for the prototype; they still approve no final numbers or
artwork. Phase 1 is being built on its own branch (`mobile-controls-phase1`); this pull request
stays documentation only.

---

## 1. Summary

- **Layout.** The right thumb gets exactly four action buttons in a diamond: JUMP at the top,
  PUNCH and KICK side by side, THROW at the bottom. The Ajsich (Kiai) meter becomes a tappable
  bar in a fixed place above the diamond. The DUCK and BLOCK buttons leave the default layout;
  holding away from a strike keeps blocking exactly as it does today, and that guard covers every
  attack that ducking covers. DUCK (under the movement pad, where ducking and walking already
  exclude each other) and a small BLOCK are alternatives to evaluate if an encounter shows a
  concrete problem. In landscape the controls sit over the bottom corners of the picture, because
  today they are placed below a 16:9 stage and fall off the bottom of a phone held sideways.
- **Multitouch.** The touch code is sound for two thumbs on two different buttons; I confirmed
  that headlessly against the real `Input` class. What it cannot do is survive a thumb sliding
  from one direction button to another (the first button keeps the pointer), and it drops a held
  direction the moment any second finger that happens to touch the same button lifts. The fix is
  one movement pad that tracks finger position, plus holding each action by pointer id rather
  than by a single true/false. Because the fault has not been reproduced on a desktop browser,
  the first prototype step is a touch diagnostic on the phones that showed it.
- **Jump and crouch.** The kicker's high kick and the thrower's stars are answered by ducking
  or blocking (a jump never clears them: the jump tops out at 37.5 units and the kick's box
  starts at 42). The low sweep is answered by jumping or blocking (airborne for 0.73 s, clear of
  the sweep for 0.60 s of that). Punches hit standing and crouching players alike and are
  answered by blocking or a depth step. So every threat has a defence in the four-button layout
  with the hold-back guard; what ducking adds is a defence that also works against attacks from
  behind, plus the two low attacks. Whether that is worth a button is for the encounter tests.
- **Aerial attacks.** Tap JUMP, then PUNCH or KICK in the air already works today, with the
  grounded attack numbers and the grounded punch/kick artwork. The hit boxes sit so high that an
  attack at the top of the jump passes over a standing enemy's head; only the first 0.10 to
  0.15 s after take-off and the last 0.08 to 0.13 s before landing connect. There is no aerial
  artwork, no landing rule and nothing stops a second attack in the same jump.
- **Power attacks.** A sprint that has actually covered a run-up distance (experiment: 40 units,
  one Tamas height, 0.32 s of sprinting) arms a power attack. PUNCH then gives an advancing
  running punch, KICK a running kick, and jumping out of a qualified run-up carries the charge to
  the first aerial attack. Any power attack consumes the charge, hit, miss or blocked; stopping,
  reversing, getting hit or landing clears it. Power attacks stay blockable, so the throw remains
  the answer to a guard.
- **Prototype order.** (1) four-button mobile controls and sequential jump attacks,
  (2) grounded running punch and kick, (3) powered aerial attacks. Input, combat and artwork
  changes are listed separately in section 9.

---

## 2. What the game does today (facts from the code)

### 2.1 Input model

`src/input.js` turns keyboard and touch into one action set. Two kinds of action exist
(`src/input.js:2-3`):

| Kind | Actions | Behaviour |
|---|---|---|
| held | `left right up down duck block` | true while the key or button is down |
| pressed (edge) | `jump punch kick kiai` | fires once per press (`EDGE_ACTIONS`, line 20) |

The game reads one `snapshot()` per fixed 60 Hz step (`src/input.js:94-98`, called from
`Game.step` in `src/game.js:147`). A press that starts and ends between two steps still
registers, because the edge is stored until the next snapshot. The main loop runs up to six
steps per animation frame to catch up (`src/main.js:180-184`).

Keyboard map (`src/input.js:3-14`) as actually coded: arrows or WASD move, C duck, Space jump,
J punch, K kick, **L block, I Ajsich (kiai)**. The in-game help (`index.html:67-75`) and the
README agree with the code. The brief for this document said "L (Kiai)"; that is not what the
game does, L is block. Pause is P or Escape.

Grab and throw have no key of their own: punch and kick on the same step, or the second one
pressed during the first one's wind-up, become a grab (`src/entities.js:281-290, 330`).

### 2.2 Touch controls

`index.html:122-137` has ten buttons, each with a `data-btn` attribute:

- a movement pad of four buttons `up left down right`;
- an action grid of six: `kiai` (full width, 44 px tall), `jump`, `duck`, `block`, `punch`,
  `kick` (64 x 64 px; 48 x 48 px under 480 px wide, `karate-game.css:221-251`).

`Input.attachTouch` (`src/input.js:61-82`) is wired from `src/main.js:101-112`. For every
button it listens to `pointerdown` (press, capture the pointer) and to `pointerup`,
`pointercancel` and `lostpointercapture` (release). The whole panel and every button have
`touch-action: none` (`karate-game.css:203, 232`), the page prevents `touchmove` on the panel
and the stage while playing (`src/main.js:146-149`), and text selection is off for the whole game
(`karate-game.css:28-30`). The panel appears on coarse pointers or on the first touch
(`src/main.js:143-144`).

The panel is a flex row **below** the stage (`karate-game.css:195-204`), and the stage is
always 16:9 of the available width (`karate-game.css:75-83`). On a phone in landscape the
picture alone is taller than the screen, so the buttons are off-screen until the page is
scrolled. In portrait everything fits, which is probably how the game is played on phones today.

### 2.3 The Ajsich (Kiai) meter

The HUD shows a 90 px bar with the text Charging / Ready / AJSICH! (`index.html:28-34`,
`src/ui.js:158-175`), and the touch panel has a separate Ajsich button that gets the classes
`is-ready` / `is-cooling` from the same HUD update (`src/ui.js:170-173`). Pressing it when not
ready does nothing (`Player.activateKiai`, `src/entities.js:221-227`). Kiai lasts 4 s, then
needs 14 s (`KIAI` in `src/constants.js:61-66`), doubles damage, multiplies knockback by 1.4 and
breaks guards (`src/game.js:355-376`).

### 2.4 Movement, sprint, jump, crouch, guard

All from `Player.update` (`src/entities.js:264-335`):

| Item | Value | Where |
|---|---|---|
| Walk | 72 units/s along the level, 50 in depth | `PHYSICS`, `src/constants.js:24-25` |
| Sprint | second tap of the same direction inside 0.25 s; x1.75 (126 along, 87.5 in depth); ends when that direction is released | `trackTaps`, `src/entities.js:240-262`; `SPRINT`, `src/constants.js:35-38` |
| Jump | take-off velocity 205 up, gravity 560: apex 37.5 units, 0.73 s (44 steps) in the air; full air control; walking covers 53 units per jump, sprinting 92 | `src/entities.js:321-326`, `src/constants.js:23, 26` |
| Crouch | `duck` held while grounded and not blocking; stops all movement; low punch and kick from it | `src/entities.js:296, 303-308` |
| Guard | `block` held, **or** holding the direction away from an enemy that is striking within 40 units in front, or away from a star in flight; stops movement | `src/entities.js:292-302`, `Game.guardContext` `src/game.js:191-206`, `AUTO_BLOCK` `src/constants.js:52-54` |
| Grab | punch+kick together (grounded only); hold 0.2 s at +12 units, throw-down 0.2 s, 20 damage, victim lands at about +25 and lies 0.9 s | `ATTACKS.grab/throw` `src/combat.js:14-17`, `GRAB` `src/constants.js:42-48`, `Game.updateThrow` `src/game.js:398-420` |

1 game unit is 2 art pixels; Tamas stands 40 units tall (`HURTBOX.standing`,
`src/combat.js:36`).

### 2.5 Attack table (player)

From `ATTACKS` in `src/combat.js:9-17`. Boxes are relative to the feet, x forward, y upward
negative.

| Attack | Startup | Active | Recovery | Total | Damage | Knockback | Box (x, y, w, h) |
|---|---|---|---|---|---|---|---|
| punch | 0.07 | 0.10 | 0.16 | 0.33 | 10 | 35 | 6, -34, 15, 9 |
| kick | 0.14 | 0.12 | 0.26 | 0.52 | 16 | 70 | 6, -28, 20, 11 |
| crouchPunch | 0.07 | 0.10 | 0.16 | 0.33 | 8 | 30 | 6, -24, 14, 8 |
| crouchKick | 0.12 | 0.12 | 0.24 | 0.48 | 12 | 60 | 6, -16, 20, 8 |
| grab | 0.08 | 0.08 | 0.28 | 0.44 | 0 | 0 | 2, -34, 16, 30 (passes guards) |
| throw | 0.20 (hold) | 0.20 (throw-down) | 0.30 | 0.70 | 20 (`GRAB.damage`) | throw | no box |

Blocking: any non-grab attack from the front is blocked when the defender is blocking
(`resolveHit`, `src/combat.js:80-81`). Kiai hits break the guard instead
(`onPlayerHits`, `src/game.js:358-364`). Enemy hp: striker 30, kicker 50, thrower 30, Master
Kage 180 (`ENEMY_TYPES`, `src/entities.js:343-350`).

---

## 3. Revised mobile layout

### 3.1 Phone in landscape

```
 ┌──────────────────────────────────────────────────────────────────────────┐
 │ TAMAS ████████░░ 100   SCORE 1250   ENEMIES 17        [AJSICH ███████░░] │  <- HUD strip, meter is the tappable bar
 │                                                                          │
 │                         (game picture, 16:9, fills the width)            │
 │                                                                          │
 │                                                                          │
 │            ▲                                              ( JUMP )       │
 │        ◀   ●   ▶        movement pad (one element,                       │
 │            ▼            thumb position = direction)  ( PUNCH ) ( KICK )  │
 │                                                                          │
 │                                                           ( THROW )      │
 │                                                                          │
 └──────────────────────────────────────────────────────────────────────────┘
      left thumb: move, sprint (double-tap),              right thumb: four taps,
      hold away = block                                   one short roll up for jump
```

Alternatives to evaluate, not in the default: a held DUCK button under the pad (same thumb as
movement, since crouching stops movement), and a small held BLOCK beside it. Either joins the
layout only if an encounter shows a concrete problem the four buttons cannot solve.

Both clusters are drawn **over** the picture (semi-transparent, about 60 to 70 % opaque),
anchored to the bottom corners, inside the safe area (`viewport-fit=cover` is already set in
`index.html:5`). The picture is not shrunk. Where the controls overlap play, the fighters are
mostly higher up on screen (the floor is the lower third), so the pad and the diamond cover
floor and HUD-free space; this needs checking in the real game on at least one small phone.

### 3.2 Phone in portrait

Same clusters, placed in the panel below the picture as today. Nothing changes except the
button set and the meter.

### 3.3 Button roles

| Button | Thumb | Kind | What it does | Why here |
|---|---|---|---|---|
| Movement pad | left | held (four directions, diagonals allowed) | walk, step in depth, double-tap to sprint, hold away to block | one element so a thumb can slide between directions without lifting (see section 4) |
| DUCK (alternative only) | left | held | crouch; PUNCH / KICK while held give the low attacks | if ever added: crouching stops movement in the code (`src/entities.js:304-305`), so the left thumb never needs both at once |
| JUMP | right, top of the diamond | tap | jump; a second tap in the air does nothing | closest to the strike buttons so "jump, then strike" is one roll of the thumb |
| PUNCH | right, left of centre | tap | punch, low punch when ducking, running punch when charged, aerial punch in the air | the thumb's resting position |
| KICK | right, right of centre | tap | kick, low kick, running kick, aerial kick | resting position |
| THROW | right, bottom | tap | grab, becoming a throw on contact | dedicated button so no two-button chord is needed; bottom because it is the most deliberate choice |
| AJSICH meter | right, fixed above the diamond (or at the right end of the HUD strip in landscape) | tap when full | start Kiai | always in the same place; the fill shows the charge; it glows when ready and is dimmed while charging |

What goes away on mobile: the DUCK and BLOCK buttons. Holding away from a strike or a star
blocks it today (`Game.guardContext`), and that stays. What a BLOCK button gives that holding
away does not is a *pre-emptive* guard with no enemy attacking yet, and a guard while facing an
enemy who is not within 40 units. What DUCK gives is a defence against high attacks and stars
coming from behind (the crouch hurt box does not depend on facing, a block does), and the two
low attacks. The four-button layout is tested first; DUCK and BLOCK are evaluated as
alternatives against real encounters (several enemies, both facings), and an encounter that
shows a concrete problem is written up before the default grows.

Desktop keys do not change. The THROW button is translated in the input layer into punch and
kick on the same step, which is exactly the grab chord the game already reads
(`src/entities.js:330`), so no gameplay file changes for it. J+K together keep working on the
keyboard, and THROW behaves like the chord in every state (a punch in the air, a low punch while
crouching).

### 3.4 Sizes (experiment)

- Diamond buttons 56 px, 10 px apart, so a thumb covers JUMP to PUNCH in one roll (about 66 px
  centre to centre). Under 480 px wide today the buttons are 48 px; keep at least 48.
- Movement pad 120 px across, a dead zone of 14 px in the centre, eight directions.
- DUCK 96 x 44 px, 12 px under the pad.
- Meter 120 x 36 px, text inside (Charging / Ready / AJSICH!), minimum tap target 44 px with
  padding.

---

## 4. Multitouch findings

### 4.1 What the code does with two simultaneous touches

`Input.attachTouch` (`src/input.js:61-82`) registers, **per button**, a `pointerdown` handler
that prevents default, marks the button active, calls `setPointerCapture(e.pointerId)` and
`press(action)`; and one shared release handler for `pointerup`, `pointercancel` and
`lostpointercapture` that calls `release(action)`.

`press` and `release` (`src/input.js:84-91`) set one boolean per action: `held[action] = true`
on press and `held[action] = false` on release, with no memory of which pointer did it.

I drove the real `Input` class headlessly with two fake buttons and the browser event names it
listens to:

| Case | Result |
|---|---|
| Pointer 1 down on LEFT, pointer 2 down on PUNCH | `left` stays held, `punch` edge fires: **correct** |
| Pointer 2 up on PUNCH (plus the `lostpointercapture` that follows) | `left` still held: **correct** |
| PUNCH down and up between two game steps | the edge still fires: **correct** |
| Pointer 1 and pointer 4 both on LEFT, pointer 1 lifts | `left` is released although a finger is still on it: **wrong** |
| `pointercancel` on LEFT | `left` released, as designed; the question is what cancels it |

So the per-pointer logic is fine for the basic case, and the fault reported on phones is not in
the press/release bookkeeping for two different buttons. It has to come from the browser's
pointer handling, from the layout, or from the double-finger case above. Candidates, most to
least likely from the code:

1. **Sliding between direction buttons does nothing** (`src/input.js:68`). The first button
   captures the pointer, so a thumb that slides from ◀ to ▶ or from ▶ to ▲ never produces a
   `pointerdown` on the new button. The hero keeps walking the first way until the thumb lifts.
   To a player this feels like movement "not responding" while the other thumb is busy.
2. **Pointer cancellation by the browser.** A `pointercancel` is treated as a release
   (`src/input.js:78`). Browsers send it when they take the touch for a gesture: scrolling or
   zooming. The buttons and the panel have `touch-action: none`, but the HUD, the page padding
   (`.kg-wrap`, 16 px) and the gaps are not all covered, and in landscape the whole panel is
   below the fold, so a thumb that strays onto the page edge can start a scroll and cancel the
   other finger too. This is the case that needs the on-device log.
3. **Two fingers on one button** (the "wrong" row above): a thumb resting on ◀ and a second
   brush of the same button, then either lifting, drops the direction. Rare but real.
4. **`lostpointercapture` wired to release** (`src/input.js:79`). It always follows a release,
   so it is harmless today, but it also fires if the element is hidden or re-rendered while a
   finger is down (`ui.setTouchVisible`, `src/ui.js:191-193`), which happens on the very first
   touch when the panel was hidden (`src/main.js:144`). That first press can be lost.

What is **not** the cause: the keyboard chord for grab (touch never needs it once THROW exists),
the fixed-step loop (edges are kept until the next step), and `window` `blur` resetting all
input (`src/input.js:57`), which only fires when the page loses focus.

### 4.2 Fix direction (input changes, browser side only)

1. **Hold by pointer id.** `held[action]` becomes a set of pointer ids; the action is held while
   the set is non-empty. Fixes case 3 and makes a stray double release harmless.
2. **One movement pad element** instead of four buttons. On `pointerdown` the pad captures the
   pointer and on every `pointermove` computes the direction from the thumb's position relative
   to the pad centre (eight directions, dead zone). The direction can change without lifting.
   Double-tap detection for the sprint stays in `Player.trackTaps` and keeps working, because
   lifting and re-pressing still produce a release and a press of the same direction. Fixes
   case 1.
3. **Panel-level listeners.** Listen for pointer events once on the whole control panel and hit
   test buttons by their rectangles, instead of one set of listeners per button. Then a thumb
   that slides from PUNCH onto KICK releases one and presses the other, and no pointer is
   stranded between elements. (Optional refinement; the pad alone is the big win.)
4. **Diagnostic overlay** (prototype only, behind `?touchlog=1`): a corner panel listing the last
   twenty pointer events with id, type, target and the current held set, plus the frame's
   snapshot. Run it on the phones where the problem was seen before changing anything, so the
   fix is aimed at the actual event sequence. This is step 1a of the prototype plan.
5. **Cover the whole game area** with `touch-action: none` while playing (the `.kg-root`
   element, not just the panel and stage), and keep the panel visible from the start on coarse
   pointers so no first press is lost to a layout change.

None of this touches `Player.update` or any guarded file except `src/input.js`, which is in the
guard list (`scripts/guard.mjs:9`). A controls branch therefore cannot pass `npm run guard`;
that is expected and is why the guard exists. The founder decides when a controls change is
allowed to differ from `main`.

---

## 5. Jump, crouch and aerial findings

### 5.1 Which enemy attack is answered by which movement

Geometry from `ATTACKS`, `HIGH_ATTACKS`, `LOW_ATTACKS` and `HURTBOX` (`src/combat.js:19-38`),
checked by running `resolveHit` with a simulated jump at the real step size. The standing hurt
box is 40 units tall and rises with the feet; crouching makes it 28.

| Enemy attack | Box (height above feet) | Standing | Ducking | Jumping | Blocking / hold away | Depth step |
|---|---|---|---|---|---|---|
| Striker punch, boss punch | 25 to 34 | hit | **hit** (overlaps the top of the crouch box) | clear only above 34 units: 0.25 to 0.48 s after take-off, 0.22 s in all | yes | yes (more than 7 units) |
| Kicker high kick, boss kick | 30 to 42 | hit | **clear** | never (apex 37.5 < 42) | yes | yes |
| Kicker low sweep | 2 to 12 | hit | hit | **clear** while feet are 12 units up: from 0.06 s to 0.67 s after take-off, 0.60 s in all | yes | yes |
| Thrower's star | 30 to 36 (head height) | hit | **clear** | clear only 0.29 to 0.44 s after take-off (0.15 s) | yes (from the moment it flies) | yes |

Timing that matters for the thumbs: the high kick winds up for 0.52 s and the sweep for 0.46 s
before they can hit (`src/combat.js:20-21`); the kicker shows different wind-ups
(`ENEMY_TYPES.kicker`, `src/entities.js:345`). A jump lasts 0.73 s, so jumping at the first
sign of a sweep clears it with room to spare, and ducking at the first sign of a high kick is
comfortable. Punches cannot be ducked and are practically not jumped: block, step in depth, or
beat them to it.

### 5.2 Consequences for a four-button layout

- Every threat from the front has a defence with the four buttons: the hold-back guard covers
  the high kick, the stars, the sweep and the punches; JUMP covers the sweep as well. DUCK is
  therefore not required; it is an alternative that adds a facing-independent defence (a crouch
  dodges a high kick or a star from behind, a block does not, since `resolveHit` blocks only
  attackers in front, `src/combat.js:80-81`) and the two low attacks.
- Where this matters: with an enemy near in front, pressing away from it does not turn Tamas
  (`src/entities.js:313`, "stepping away keeps the eyes on them"), so an attack from behind
  cannot be blocked in that moment. A depth step (▲ or ▼ for more than 7 units) still escapes
  it, and the kick's 0.52 s wind-up leaves time. Phase 1 tests this encounter headlessly and on
  the phone before any button is added.
- If DUCK is ever added, it is a held action that stops movement, so it belongs under the left
  thumb; JUMP is a tap and belongs in the right diamond.
- Nothing in the code lets Tamas jump out of a crouch or duck in the air; both would be new
  behaviour and neither is proposed.
- Jump has no cancel: once airborne, the only choices are attack or drift. Air control is full
  (`src/entities.js:315-316` run whether grounded or not), so a jump over a sweep can be steered
  back onto the kicker.

### 5.3 Aerial attacks today

- **Sequential input works.** JUMP is an edge; PUNCH or KICK pressed on a later step while
  airborne reaches `src/entities.js:331-332` and starts the grounded `punch` or `kick` with its
  grounded numbers. No simultaneous press is needed. The grab is excluded in the air (line 330
  requires `grounded`).
- **Momentum is kept.** `startAttack` zeroes velocity only on the ground
  (`src/entities.js:51-58`), and the attack branch does the same (line 287), so a jump kick
  carries forward (covered by the test `a jump kick keeps its momentum`).
- **The hit windows are narrow.** With the grounded boxes moving up with the feet, a punch
  connects with a standing enemy only while the feet are at most 15 units up, a kick at most 23.
  In a full jump that is 0.02 to 0.10 s (punch) or 0.02 to 0.15 s (kick) after take-off and
  0.63 to 0.72 s or 0.58 to 0.72 s before landing. A strike started at the apex misses a
  standing enemy entirely. The practical aerial attack is a late kick on the way down.
- **Landing during an attack.** The attack simply continues on the ground; velocity drops to 0
  (line 287) and Tamas stands in recovery. There is no landing lag and no landing cancel.
- **Two attacks in one jump are possible.** A punch (0.33 s) finishes well inside the 0.73 s
  flight, so a second punch can start before landing. Checked by simulation.
- **Artwork.** `heroState` (`src/heroSprite.js:105-115`) chooses the attack's grounded state
  (`punch`, `kick`) before it looks at `grounded` (line 117), so an aerial attack shows the
  grounded punch or kick cells floating at jump height. The procedural poses (`poseFor`,
  `src/sprites.js:113-135`) and the legacy 4 x 2 sheet do the same. The Tamas sheet
  (`assets/sprites/tamas.json`) has `jump` with two cells (rising, falling) and no aerial attack
  state.
- **Sprint carries into the air.** `sprinting` only ends when the direction is released
  (`src/entities.js:262`), so a sprint jump flies at 126 units/s while the direction is held and
  covers 92 units. Releasing the direction in the air drops the speed to 0 at once.

Missing for the founder's aerial design, in one list: aerial attack entries with their own
boxes (angled downward so the apex is usable), a "first aerial attack" rule, a landing rule
(clear the charge, optional landing recovery), aerial artwork and distinct aerial sounds.

---

## 6. Momentum power attacks: design

### 6.1 Principles mapped to rules

| Founder's principle | Rule in the prototype | Where it would live |
|---|---|---|
| Qualification uses actual forward travel, not the sprint flag or a tiny tap | The player keeps a `runDistance`. Each step while grounded, `sprinting`, with the sprint direction along the level (`left` or `right`, not `up`/`down`) and equal to the facing, add the distance moved along x. The attack is powered when `runDistance >= POWER.runUp`. | `Player.update`, new field; `POWER` in `src/constants.js` |
| Stopping, reversing or being interrupted resets the run-up | `runDistance` goes to 0 when: `sprinting` turns false, the movement direction is 0 or opposite to the facing, the fighter enters a guard (hold-back or block key) or crouches, or `takeHit` lands. Only travel along the level in the facing direction counts; a diagonal sprint adds its forward component and depth movement adds nothing. | `Player.update`, `Fighter.takeHit` |
| One power attack consumes the run-up, including a miss or a blocked attack | Power is decided when the attack **starts**, not when it hits: `startAttack` sets `attack.powered = true` and `runDistance = 0`. A whiff or a BLOCK still spends it. | `Player.startAttack` |
| An aerial power opportunity applies to the first aerial attack and expires on landing | Jumping with `runDistance >= POWER.runUp` sets `airPower = true` and clears `runDistance`. The first attack started in the air takes `airPower` (and clears it); a second attack in the same jump is a plain aerial attack. Landing sets `airPower = false` whatever happened, and if a powered aerial attack was attempted in that jump (hit, miss or blocked) the landing carries the short recovery of 6.5 point 4. | `Player.update` (jump branch), `Fighter.integrate` (landing) |
| Power attacks remain blockable, preserving the throw's role against guarding | Powered attacks are ordinary strikes in `resolveHit`: `grab` stays false, so a guard stops them and gives knockback x0.3 as today. Kiai still breaks guards. The throw is still the only non-Kiai answer to Master Kage's guard. Under Kiai the higher of the two damage modifiers applies, never both (6.5). | no change in `resolveHit`; `onPlayerHits` picks the modifier |
| Modest additional damage and knockback, clear impact feedback, balanced by recovery | New table rows for the grounded running attacks with a longer recovery; a multiplier block for aerial power; a heavier hit cue, a bigger burst, a stronger shake and a floating word on a powered hit. | `ATTACKS`, `POWER`, `Game.onPlayerHits`, `src/audioDirector.js` |
| No extra button or meter | The only inputs are the existing double-tap sprint, PUNCH, KICK and JUMP. The run-up is shown on Tamas (the sprint animation plus a small dust trail once charged), not on a meter. | renderer and effects only |
| Shared mechanics, desktop mappings unchanged | Everything above reads the normalised action set, so keyboard and touch get the same behaviour. | nothing to do |

### 6.2 The four power attacks

| Attack | Trigger | Motion | Compared with the normal version |
|---|---|---|---|
| Running punch (`runPunch`) | charged, grounded, PUNCH | keeps moving forward during wind-up and hit (the "advancing" punch), then stops for a longer recovery | more damage, more knockback, a little more reach, longer recovery |
| Running kick (`runKick`) | charged, grounded, KICK | same advance, bigger step | the heaviest grounded hit; longest recovery |
| Powered aerial punch | `airPower`, airborne, PUNCH | the jump's own momentum | aerial punch numbers with the power multipliers; a short landing recovery if it was used |
| Powered aerial kick | `airPower`, airborne, KICK | same | same, with the kick's box angled down so the apex can connect |

The grounded running attacks get their own rows in `ATTACKS`, because they need their own
boxes, timings and an advance speed, which is how the table already treats every other attack.
The aerial attacks get two new rows (`jumpPunch`, `jumpKick`) with boxes angled downward,
because the current grounded boxes make most of the jump useless (section 5.3); their powered
form is the same row with multipliers from `POWER.air`, since the jump gives the motion for free.

### 6.3 Feel and feedback (no new UI)

- Charged run-up: the sprint cells already play; add a short dust trail behind the feet once
  `runDistance` passes the threshold (same burst as the sprint start, repeated), so the player
  can see the charge without a meter. Experiment: trail or no trail.
- Powered hit: `hitHeavy` cue (exists, used for Kiai and slams), shake 0.18 instead of 0.12,
  ten particles instead of six, and a floating word. Candidate words in Tamas's register, to be
  chosen by the founder: "RUSH!", "GÅ!", "FRAMÅT!". (The canvas font has A-Z, ÅÄÖ and digits,
  `CLAUDE.md`.)
- Powered aerial hit: same cue, plus the landing dust that already plays.
- Blocked powered hit: the normal BLOCK word; the attacker also takes a longer recovery, so a
  guarding enemy punishes a careless rush. That is the balance against the throw being ignored.

### 6.4 Questions raised in the first version, now answered

These were open questions in the first version; the founder's directions in 6.5 settle them.

1. **Kiai stacking.** Kiai doubles damage; a power attack adds its own factor. Stacked, a
   running kick under Kiai with the experimental numbers would do 48 damage, almost a kicker's
   health. Decision: no stacking, see 6.5.
2. **Does the hold-back guard eat the run-up?** Yes, see 6.5.
3. **Depth sprints.** Never charge; the forward component of a diagonal counts, see 6.5.
4. **Landing recovery after a powered aerial attack:** yes, short and tunable, after every
   attempt, see 6.5.

### 6.5 Founder's directions for the power prototype (binding for the prototype, no values approved)

**Kiai today.** `Player.activateKiai` (`src/entities.js:221-227`) starts a 4 s window when the
meter is ready, then a 14 s cooldown (`KIAI`, `src/constants.js:61-66`). While it lasts,
`Game.onPlayerHits` (`src/game.js:355-376`) multiplies the damage of every player strike by 2
and the knockback by 1.4, turns a blocked strike into a guard break (`BREAK!`), plays the heavy
hit cue and a bigger burst; `Game.onPlayerThrows` (`src/game.js:411-420`) doubles the throw's
20 damage and multiplies the throw speed by 1.4. Kiai is a per-hit modifier applied at hit
time; it does not change the attack table.

1. **No multiplicative stacking of Kiai and power.** Both modify the same attack's damage, so
   the prototype applies the **higher** of the two modifiers, not their product: under Kiai a
   powered running kick does the Kiai damage (2 x 16 = 32), not 2 x 1.5 x 16 = 48. Knockback
   the same way (higher of 1.4 and the power factor). Guard breaking stays a Kiai effect only;
   a powered strike without Kiai is blocked like any strike.
2. **Entering guard clears the run-up.** The moment `blocking` becomes true, whether from the
   hold-back guard or the block key, `runDistance` goes to 0.
3. **Pure depth movement does not charge.** The run-up counts the actual travel along the level
   (the attack axis) in the facing direction. A diagonal sprint contributes its forward
   component (the x distance moved), nothing for the depth part.
4. **Landing recovery after an attempted powered aerial attack.** A short, tunable recovery on
   landing (`POWER.air.landingRecovery`, experiment 0.15 s) applies whenever a powered aerial
   attack was *started* in that jump: hit, miss or blocked. Ordinary jumps, and jumps with an
   unpowered aerial attack, land as they do today.

---

## 7. Experimental tuning values

**All experiments, none approved.** Chosen so each is a visible but modest step from the
existing row.

| Value | Experiment | Reasoning from the code |
|---|---|---|
| `POWER.runUp` (run-up distance) | 40 units | one Tamas height; 0.32 s of sprinting; more than a double-tap can produce by itself (one step of sprint is 2.1 units) |
| `POWER.advanceSpeed` (grounded running attacks, during startup and active) | 72 units/s (walk speed) | carries the punch 12 units and the kick 19 units forward, inside the hold distance of a grab (12) and the enemy's `range` (striker 20, kicker 27) |
| `runPunch` | startup 0.07, active 0.10, recovery 0.24, damage 15, knockback 55, box 6, -34, 20, 9 | punch +50 % damage, +57 % knockback, +5 reach, +0.08 s recovery |
| `runKick` | startup 0.14, active 0.12, recovery 0.38, damage 24, knockback 105, box 6, -28, 26, 11 | kick +50 % damage, +50 % knockback, +6 reach, +0.12 s recovery |
| `jumpPunch` (new baseline aerial) | startup 0.07, active 0.12, recovery 0.14, damage 10, knockback 40, box 4, -22, 16, 14 | the box reaches 17 units lower than the grounded punch, so it connects with a standing enemy for all but 0.23 s around the apex (today: 0.08 s after take-off and 0.08 s before landing); longer active, shorter recovery so it is usable before landing. Checked by simulation. |
| `jumpKick` (new baseline aerial) | startup 0.12, active 0.14, recovery 0.20, damage 16, knockback 75, box 4, -18, 20, 16 | the leg angled down reaches to 2 units above the feet, so it connects through the whole jump (today: 0.13 s after take-off and 0.13 s before landing). If that proves too easy, raise the box's bottom. Checked by simulation. |
| `POWER.air.damage`, `POWER.air.knockback` | x1.4, x1.5 | a shade below the grounded power factor since the jump already gives reach and safety |
| `POWER.air.landingRecovery` | 0.15 s | the committed-attack cost after any attempted powered aerial attack (hit, miss or blocked); ordinary jumps unaffected |
| Feedback | shake 0.18, burst 10, `hitHeavy` | the Kiai hit values, already known to read as "heavy" |

For comparison, the hits needed to beat each enemy with these numbers (no Kiai): striker 30 hp
falls to two running punches or one running kick plus any punch; kicker 50 hp to two running
kicks plus a punch; Master Kage 180 hp still needs eight running kicks. The playthrough test
asserts a clear time of 55 to 100 s (`test/game.test.js`, see `CLAUDE.md`); the bot does not
sprint, so it is unaffected until the bot is taught to, which the plan below includes.

---

## 8. Prototype plan

Each phase is a separate branch off `main` with a draft pull request, nothing merged until the
founder has played it. Phases 2 and 3 change guarded files, so `npm run guard` will fail on
those branches by design; `npm run lint`, `npm test` and `npm run build` must pass.

### Phase 1: four-button mobile controls and sequential jump attacks (input only)

1a. **Touch diagnostic** (`?touchlog=1`): the overlay from section 4.2, no behaviour change.
    Run on the phones that showed the fault; record the event sequence; decide between
    hypotheses 1 to 4 before fixing.
1b. **New panel**: the movement pad element, the four-button diamond, the tappable Ajsich meter,
    landscape overlay placement, portrait panel placement; DUCK and BLOCK buttons removed from
    the default (kept available as alternatives behind a switch for the encounter tests).
    `Input` holds actions by their active sources (pointer ids, the keyboard), and THROW is
    translated into the punch+kick chord inside `Input.snapshot`, so `src/entities.js`,
    `src/game.js` and the test snapshots do not change. Combat values and desktop mappings are
    untouched. The only guarded file that changes is `src/input.js`.
1c. **Verification**: on two phones (one iOS, one Android) in landscape and portrait: walk while
    tapping PUNCH twenty times without a dropped step; slide the thumb around the pad through all
    eight directions without lifting; double-tap to sprint from the pad; tap JUMP then KICK and
    land a late jump kick on a striker; throw a blocking Master Kage with THROW; start Kiai from
    the meter only when it is full; defend with the hold-back guard against the kicker and the
    thrower with enemies on both sides. Desktop: every key in the help list still works, J+K
    still throws. Tests: the `Input` class gets its first unit test (fake elements, two
    pointers, the double-finger case, slide across the pad). Headless pointer tests and
    real-device results are reported separately; a headless pass is not device validation.
1d. **Aerial attacks in phase 1** are only the input: JUMP then PUNCH or KICK registers and
    starts the grounded attack in the air, as today. The limitations in section 5.3 (narrow hit
    windows, no landing rule, two attacks per jump, grounded artwork) remain and are documented
    with the prototype so that a registered input is not mistaken for a finished aerial system.

Done when the founder can play through the street on a phone with one thumb per cluster and
reports no stuck or missed inputs, and the DUCK and BLOCK alternatives have an encounter-based
verdict.

### Phase 2: grounded running punch and kick (combat)

2a. `runDistance`, `POWER`, `runPunch`, `runKick`, powered start-attack, advance speed, reset
    rules, feedback (shake, burst, word, `hitHeavy` through `audioDirector`).
2b. Tests: the run-up charges only with forward travel of the threshold (a double-tap and one
    step does not charge); reversing, stopping, blocking, being hit and depth sprints clear it;
    a powered attack spends the charge on a whiff and on a BLOCK; a guard stops a running kick;
    the throw still passes a guard. The replay baseline (`test/replay.test.js`) will change the
    moment movement differs; refresh it on purpose with `UPDATE_BASELINE=1` only after the
    behaviour is accepted, and say so in the pull request.
2c. Play: the first street wave with and without power attacks; the kicker (does a running kick
    into a sweep wind-up feel fair?); Master Kage's guard (is the throw still the right answer?).

### Phase 3: powered aerial attacks (combat)

3a. `jumpPunch`, `jumpKick`, `airPower`, first-aerial-attack rule, landing clear, landing
    recovery, `heroState` routing to `jumpPunch` / `jumpKick` with `fallback: 'punch'` /
    `'kick'` (the fallback mechanism exists, `resolveFrame`, `src/heroSprite.js:128-132`).
3b. Tests: the charge carries into the jump and only into the first attack; it expires on
    landing; an aerial attack at the apex reaches a standing enemy with the new boxes; a late
    aerial kick still works as before.
3c. Play on phone: JUMP then PUNCH, JUMP then KICK, sprint-jump-kick over a sweep onto the kicker.

### Artwork, in parallel from phase 2

Briefs for the art chat in the style of `docs/art/sprint-brief.md`, one per state, each with
the cell count and the timing from the accepted table rows. Placeholder art until then: the
existing punch and kick cells via the fallback, which is what the game shows today.

---

## 9. Change lists (kept separate)

### 9.1 Input changes (browser side: `index.html`, `karate-game.css`, `src/input.js`, `src/main.js`, `src/ui.js`)

- Replace the four movement buttons with one pad element that tracks pointer position.
- Remove the DUCK and BLOCK buttons from the default (alternatives behind a switch); four-button
  diamond JUMP / PUNCH / KICK / THROW; make the Ajsich meter the tappable element in a fixed
  position.
- Hold actions by their active sources (pointer ids, keyboard); translate THROW into the
  punch+kick chord in the input layer; keep the keyboard map as is.
- Panel overlays the stage in landscape; `touch-action: none` on the whole game root while
  playing; panel visible from the start on coarse pointers.
- Touch diagnostic overlay behind a query parameter (prototype only).
- Help text and README: THROW button, Ajsich meter; the keyboard list is unchanged (and already
  says L block, I Ajsich).
- No gameplay file changes: `src/entities.js`, `src/game.js` and the test snapshots stay as they
  are. `src/input.js` is the only guarded file touched.

### 9.2 Combat changes (guarded files: `src/constants.js`, `src/combat.js`, `src/entities.js`, `src/game.js`; plus `src/heroSprite.js`, `src/sprites.js`, `src/audioDirector.js`, tests)

- `POWER` block in `src/constants.js` (run-up distance, advance speed, air multipliers,
  landing recovery).
- `ATTACKS` rows `runPunch`, `runKick`, `jumpPunch`, `jumpKick`.
- `Player`: `runDistance`, `airPower`, `attack.powered`, charge and reset rules, advance during
  running attacks, aerial attack selection, landing recovery.
- `Game.onPlayerHits`: powered feedback (shake, burst, word, cue); `audioDirector`: the cue
  choice.
- `heroState` and `poseFor`: route running and aerial attacks to their own states with
  fallbacks; procedural poses for the enemies are unaffected.
- Tests as listed in phases 2 and 3; replay baseline refreshed on acceptance; playthrough bot
  optionally taught to sprint so the clear-time window is re-checked with power attacks.

### 9.3 Additional artwork (Tamas sheet, `assets/sprites/tamas.json`; appended with `scripts/append-sheet.mjs`)

States that exist today: idle, walk (4), punch (3), kick (3), block, hurt (2), crouch,
crouchPunch (2), crouchKick (2), jump (2), knockdown (3), victory, sprint (6), grab (3),
throw (3). The renderer shows wind-up / hit / recover for a 3-cell attack state.

| New state | Cells | Shows | Until it exists |
|---|---|---|---|
| `runPunch` | 3 | a lunging straight punch with the rear leg still driving | `punch` cells via fallback |
| `runKick` | 3 | a running front or flying-step kick, body leaning in | `kick` cells via fallback |
| `jumpPunch` | 2 or 3 | tucked legs, punch angled down | `punch` cells (float at jump height, as today) |
| `jumpKick` | 2 or 3 | tucked rear leg, kicking leg angled down | `kick` cells |
| powered variants | none proposed | the power reads through effects (trail, burst, word), not separate cells | n/a |
| charge trail | effect only | dust behind the feet once charged | the sprint-start burst |

No new enemy artwork: a heavier knockback uses the existing `hurt` and `knockdown` cells of the
Striker sheet and the procedural poses of the others. The victim of a throw is unchanged.

---

## 10. What was checked and how

- Code read on `main` at `5ca9ff95`: `index.html`, `karate-game.css`, `src/input.js`,
  `src/main.js`, `src/ui.js`, `src/entities.js`, `src/combat.js`, `src/constants.js`,
  `src/game.js`, `src/sprites.js`, `src/heroSprite.js`, `assets/sprites/tamas.json`, the tests.
- Headless simulations with the real classes at the fixed step: jump apex and air time, the
  frames in which the grounded punch and kick boxes overlap a standing enemy during a jump, the
  frames in which a jump clears each enemy attack, a second attack inside one jump, an attack
  running at landing, sprint speed in the air, and the two-pointer behaviour of `Input`.
- Not checked: anything on a real phone. The multitouch cause is narrowed to the candidates in
  section 4.1, not proven; phase 1a exists to prove it.
