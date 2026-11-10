# Mobile controls, phase 1: what was built and how it was checked

> **Revision 1b (follow-up after the first physical-phone test)** is described in section 7 at the
> end: the accidental page zoom (gesture guard, zoom recovery, diagnostics) and the pad's "drag
> farther to run" replacing the double-tap sprint on touch. Sections 1 to 6 describe the first
> build, fdf10cc, as tested on the phone.

Branch `mobile-controls-phase1` off `main` at `bce64bf`, 9 November 2026. This is the first
implementation pass of the proposal in `docs/mobile-controls-and-power-attacks-proposal.md`:
the four-button mobile layout and the input fixes. **No combat value, enemy behaviour or
desktop key changed.** The only gameplay-guarded file touched is `src/input.js`
(`npm run guard` reports exactly that one file, as expected for a controls change). No power
attacks, no aerial hit boxes, no artwork.

## 1. What changed

| Area | Change | Files |
|---|---|---|
| Movement | The four arrow buttons are replaced by **one pad**. The thumb's position on the pad is the direction (eight directions, dead zone in the centre), so it can slide between directions without lifting. Double-tap a direction to sprint and hold away from a strike to block work as before, because a lift and a re-press are still a release and a press. | `src/input.js` (`attachPad`, `padDirections`, `PAD`), `index.html`, `karate-game.css` |
| Held actions | Every action is held by its **sources** (each touch pointer by id, the keyboard as one source). It is released only when the last source lets go. Lifting one finger no longer cancels another finger, or a key, on the same action, and a stray release for a pointer that never pressed is ignored. | `src/input.js` (`press`, `release`, `sources`) |
| Action buttons | **JUMP / PUNCH / KICK / THROW** in a diamond for the right thumb. THROW is new on the panel: the input layer turns it into punch and kick on the same step, which is the grab chord the game already reads, so the game code is untouched and J+K still throws on the keyboard. | `index.html`, `karate-game.css`, `src/input.js` (`snapshot`) |
| Ajsich meter | The touch panel's Ajsich button **is the meter**: its fill shows the charge, it glows when ready, pulses while active and dims while charging. Fixed position above the diamond. Tapping it when not ready does nothing, as before. | `index.html`, `karate-game.css`, `src/ui.js` (`setHud`) |
| DUCK and BLOCK | Removed from the default layout. Kept as **alternatives under evaluation**: `?controls=duck`, `?controls=block` or `?controls=duck,block` shows them under the pad. | `index.html`, `src/ui.js` (`showTouchAlternatives`), `src/main.js` |
| Landscape | On a phone held sideways (landscape, at most 520 px tall, touch controls on) the picture fills the screen height and the controls float over its bottom corners at about 68 % opacity, inside the safe area. The title card shows the one-line touch hint instead of the keyboard list. In portrait the panel sits below the picture as before. | `karate-game.css`, `src/main.js` (`resize` now also respects the stage height), `src/ui.js` (`kg-page--touch` on the body) |
| Gestures | While a round is being played the whole game area has `touch-action: none` (`kg-root--playing`), so a thumb that strays off a button cannot start a page scroll or zoom that would cancel the other thumb's pointer. | `karate-game.css`, `src/main.js` |
| Diagnostics | `?touchlog=1` shows the last input-layer events (press/release, action, source id, how many sources hold it), the raw pointer events the browser delivered, and the viewport size, for phones without a console. | `src/main.js` |
| Tests | `test/input.test.js`: 14 headless tests of the input layer with fake elements. | `test/input.test.js` |
| Text | README controls table and the title card's touch hint. | `README.md`, `index.html` |

Not changed: `src/entities.js`, `src/combat.js`, `src/game.js`, `src/constants.js`,
`src/level.js`, the keyboard map, any attack number, the replay baseline.

## 2. Verification

### 2.1 Headless (automated, not a device test)

`npm test`: 145 tests pass (131 before, 14 new). `npm run lint` and `npm run build` pass.
The new tests drive the real `Input` class with fake elements and the browser event names it
listens to. They prove what the code does with the events it is given, **not** how a phone
browser delivers them:

- a snapshot has exactly the game's input set (no `throw` key leaks through) and edges fire once;
- two thumbs on two different buttons do not disturb each other;
- a direction held on the pad survives twenty taps of PUNCH by the other thumb;
- two fingers on one button: lifting one keeps it held, lifting both releases it;
- a stray release for an unknown pointer is ignored;
- the pad's dead zone, four directions, diagonals and a thumb outside the pad;
- sliding across the pad changes direction without lifting; the centre releases everything;
- a pointer that did not start on the pad is ignored by the pad;
- a double-tap on the pad is seen as press, release, press of the same direction;
- `pointercancel` releases only that pointer's actions;
- THROW becomes punch and kick on the same step;
- the meter is a plain edge action;
- keyboard and touch holding the same action: releasing one keeps the other;
- key repeat fires no second edge; `reset` clears every source.

### 2.2 Emulated phone in the desktop app's browser (single pointer, not a device test)

Checked in the Claude desktop app's built-in browser with a 740 x 360 viewport (touch
emulation, `pointer: coarse` true) and a 390 x 760 viewport. One mouse pointer only; the
browser cannot produce two simultaneous touches, so the two-thumb cases above are headless
only. What was seen:

- landscape: picture 480 x 270 centred in a 740 x 306 stage, pad bottom-left, meter and
  diamond bottom-right, nothing below the fold, HUD readable (`docs/mobile/phase1-landscape-740x360-emulated.jpg`);
- portrait: HUD, picture and panel fit in 760 px with no page scroll (`docs/mobile/phase1-portrait-390x760-emulated.jpg`);
- `?controls=duck,block` shows the two alternatives under the pad (`docs/mobile/phase1-landscape-alternatives-duck-block-emulated.jpg`);
- a real mouse drag across the pad produced press right / release right in the input log;
- a pointer held at the pad's left edge for 0.5 s moved Tamas 36 units left and turned him; sliding it to the right edge without lifting released left and pressed right; moving to the top-right corner held right and up together and Tamas moved up the floor; lifting released everything and the pad lost its highlight;
- JUMP then PUNCH 120 ms later: Tamas was airborne (y 123 of 150) with the `punch` attack running;
- THROW: the `grab` attack started on the ground;
- a real click on the meter while ready started Kiai (meter turned to AJSICH!, HUD text AJSICH!);
- console: no errors other than the expected 404s for the optional kicker, thrower and boss sheets, which `main` has too.

### 2.3 Real devices

**None.** No physical phone was available to this session. The following remain unverified
until the founder or the UX session tests on hardware, with `?touchlog=1` on if anything
misbehaves:

- two thumbs at once on iOS Safari and Android Chrome (the headless tests cover the logic, not
  the browsers' pointer delivery);
- whether any browser still sends `pointercancel` for a held thumb while the other thumb taps;
- the double-tap sprint timing with a real thumb on the pad;
- the safe-area insets on a notched phone, and whether 68 % opacity is enough or too much over
  the fight in the bottom-right corner;
- audio unlock on the first tap (unchanged code, but the panel is new).

Headless pointer tests and emulated-browser checks are **not** device validation.

## 3. Encounter check: can the four buttons defend without DUCK?

Scripted encounters against the real `Game` at the fixed step, both facings, chosen inputs
per frame. Enemies are placed at fixed distances; "hold away" means the hold-back guard.
`SAFE` = Tamas took no damage. Full script output is summarised; the script is a scratch file,
not in the repository.

| Encounter | Four buttons (hold away / jump / step in depth) | Result | DUCK alternative |
|---|---|---|---|
| Kicker ahead, high kick | hold away | SAFE, blocked (39 guard frames) | not needed |
| Kicker ahead, low sweep | hold away | SAFE, blocked | not needed |
| Kicker ahead, low sweep | jump at the wind-up | SAFE, cleared | not needed |
| Thrower ahead, star | hold away once it flies | SAFE, blocked | not needed |
| Kicker **behind**, nobody in front, high kick | tap toward it (Tamas turns), then hold away | SAFE, blocked during the kick | not needed |
| Striker near in front (not attacking) + kicker **behind**, high kick | tap toward the kicker: Tamas does **not** turn (an enemy near in front keeps his facing, `src/entities.js:313`); holding away from the kicker walks forward out of its 27-unit reach during the 0.52 s wind-up | SAFE by walking away, no block | SAFE by ducking |
| Same, step up in depth at the wind-up | depth gap 24 units | SAFE | |
| **Striker near in front + thrower behind, star** | tap toward then hold away: Tamas cannot turn, and a star (140 units/s) cannot be outwalked | **HIT, 8 damage** | **SAFE** (the crouch hurt box does not depend on facing) |
| Same, step up in depth as the star flies | | SAFE | |
| Two strikers, one each side, both punching | hold away from the front one | front punch blocked, **back punch lands, 10 damage** | no help (punches hit crouching fighters too) |
| Same, step down in depth | | SAFE | |

**Finding.** The one concrete encounter where the four buttons offer no *stationary* defence is
a **star from behind while an enemy stands near in front**: the hold-back guard cannot be
raised because Tamas will not turn his back on the near enemy, and the star cannot be
outwalked. Ducking would save him; so does a depth step (up or down on the pad), which is also
the only answer, with or without DUCK, to punches coming from both sides at once. Whether a
depth step is an acceptable answer for a thumb player in that moment is the question the
device tests should settle before DUCK is added to the default. The high kick from behind in
the same situation is escaped by walking forward.

## 4. Aerial attacks in this pass: input only

Tapping JUMP and then PUNCH or KICK in the air registers and starts the grounded `punch` or
`kick` while airborne (checked above). That is **all** this pass does for aerial attacks; the
proposal's findings still hold and should not be mistaken for a finished aerial system:

- the grounded hit boxes rise with the feet, so an aerial strike connects with a standing
  enemy only in the first 0.10 to 0.15 s after take-off and the last 0.08 to 0.13 s before
  landing; a strike at the top of the jump passes over heads;
- there is no landing rule: an attack still running on landing continues on the ground with
  Tamas standing still through its recovery;
- a second attack can be started in the same jump;
- there is no aerial artwork: the grounded punch and kick cells are drawn at jump height;
- no powered aerial attack, no run-up, no landing recovery exist yet (phase 3 of the plan).

## 5. Opening the preview on a phone

The branch is not deployed; the live game on `main` is unchanged. To play it on a phone on
the same Wi-Fi as the Mac that holds the checkout, serve the worktree and open the Mac's
address:

```bash
cd karate-game-mobile-phase1 && PORT=8102 npm start
```

Then open `http://<the Mac's LAN address>:8102/` on the phone (add `?touchlog=1` for the
input log, `?controls=duck,block` for the alternatives). The Mac's firewall must allow
incoming connections for Node. A second option without Wi-Fi sharing is to push the branch to
a temporary GitHub Pages branch, which this session did not do because Pages serves `main`.

## 6. Direction for the later power prototype (unchanged by this pass)

Recorded in the proposal, section 6.5: no multiplicative Kiai and power stacking (the higher
modifier applies); entering guard clears the run-up; pure depth movement never charges and a
diagonal counts its forward component; a short tunable landing recovery after any attempted
powered aerial attack. None of it is implemented here.

## 7. Revision 1b: accidental zoom, and drag farther to run

Founder's phone findings on fdf10cc: (1) an accidental gesture sometimes zooms the whole page in,
the normal view cannot reliably be restored and the controls move off-screen; (2) the double-tap
sprint is difficult to use. Screenshots were taken in an app's embedded browser and show page
zoom (the whole page, pad included, enlarged).

### 7.1 Zoom: what the fdf10cc build actually did with gestures

Checked against the shipped CSS and code, not by re-adding the same declarations:

| Gesture path | fdf10cc | Why it could zoom |
|---|---|---|
| Double-tap on the HUD strip (health, score, Ajsich text, Pause, Sound) or the page frame | no `touch-action` rule at all on `.kg-hud`, `.kg-btn`, `.kg-wrap`, `body` | WebKit and Chrome zoom on a double-tap unless `touch-action: manipulation` or `none` applies on the touched element's chain; the HUD is a natural resting place for a thumb in portrait |
| Pinch with one finger on a `none` element and the other elsewhere | per-element `touch-action: none` on stage, panel, buttons, playing root | a pinch is a page gesture: WebKit treats it as allowed unless *every* finger started on a blocked element; the HUD and frame are not blocked |
| WebKit's own `gesturestart` / `gesturechange` | not handled | iOS fires these for pinch and rotate; preventing them is the reliable way to refuse a pinch on iOS, independent of `touch-action` |
| `touchmove` with two fingers | prevented only on the panel and the stage, only while `game.state === 'playing'` (`src/main.js` old lines 151-154) | on the title card, the pause card, the story cards and the HUD nothing prevented it |
| Rotation | nothing | iOS may keep a zoom factor across a rotation, and the layout switches between the in-flow panel and the landscape overlay |
| **Getting back out** | the playing surface is `none` | once zoomed, the pinch-out needed to recover was blocked by the same rule; the player was stuck at the zoomed scale, with the controls partly off-screen |

Page zoom versus a layout fault: the screenshots show the HUD, picture and pad all scaled
together, which is browser zoom (`visualViewport.scale > 1`), not the canvas sizing (the
canvas is sized from the stage's CSS box and never from the visual viewport). The diagnostic now
prints `visualViewport.scale`, the visual and layout viewport sizes and offsets, the
orientation, the last touch target and finger count, and counters of refused gestures, so the
two can be told apart on the phone without a console.

### 7.2 Zoom: what revision 1b does (`src/gestures.js`, `karate-game.css`, `src/main.js`)

1. **Whole game: `touch-action: manipulation` on `.kg-root`.** Double-tap zoom is refused on
   every element inside the game, the HUD included, through the ancestor chain; one-finger
   panning stays allowed so a menu taller than the screen can still scroll. While a round is
   being played the root is `none`, as before (`kg-root--playing`).
2. **Gesture guard (`installGestureGuard`)**: on the document, in the capture phase, non-passive:
   - `gesturestart` / `gesturechange` / `gestureend` whose target is inside the game: prevented
     (WebKit pinch and rotate);
   - `touchmove` with two or more fingers where any finger is inside the game: prevented, in
     menus too (a pinch is never a game input);
   - `touchmove` with one finger while playing: prevented (the thumb is a control, not a scroll);
     with a menu open it is left alone.
   The old per-element `touchmove` listeners are removed; independent pointers are untouched
   (the guard never calls `preventDefault` on pointer events).
3. **Recovery**: if `visualViewport.scale` is above 1.01 for 250 ms while playing, or at any
   scale after a rotation, the viewport meta is rewritten once with `maximum-scale=1,
   user-scalable=no`, which makes the browser snap back to scale 1, and restored on the next
   frame so a reader who zooms a menu on purpose keeps that freedom. The meta itself is not
   changed in `index.html`; the canvas is never shrunk to compensate.
4. **Rotation** forgets every held thumb (`input.reset()`), then runs the zoom check.
5. **Diagnostic** (`?touchlog=1`): adds the line described in 7.1.

What the guard cannot do: an embedded browser that applies its own zoom gesture before the page
sees any event. The counters in the diagnostic show whether the page saw the gesture at all.

### 7.3 Drag farther to run (`src/input.js`, `src/entities.js`, CSS, help text)

The pad reads the thumb's distance from the centre as a fraction of the pad's usable radius
(`PAD` in `src/input.js`):

| Zone | Distance | Effect |
|---|---|---|
| Centre | below 0.28 | stop (unchanged dead zone) |
| Walk | 0.28 up to the run line | walk; directions by axis as before (0.38), diagonals allowed |
| **Run** | **0.80 and beyond** to enter, **below 0.60** to leave (experiment, provisional) | the pad holds a new `sprint` input; the thumb may leave the pad |
| Pull inward | back inside 0.60 | walking again, direction kept, no release and re-press of the direction |
| Release, cancel, lost capture | | everything released |

The run zone is drawn as a dotted ring at 80 % of the radius; ring, nub and arrows turn gold
while running, the nub follows the thumb, and the existing sprint dust burst plays once when
the run starts. Both thresholds are inside the pad (the pad edge is 1.0).

**Player side (guarded change, intentional):** `Player.trackTaps` (`src/entities.js`) gains a
narrow rule: while `input.sprint` is held together with at least one direction, `sprinting` is
true, `sprintDir` follows the held direction (so the direction may change mid-run), and the
sprint start cue fires once; when `input.sprint` is released the run ends. Same speed
(x1.75), facing and hold-back guard rules as before; the keyboard double-tap sprint is untouched
and still ends when its direction key is released. Scripted inputs without a `sprint` field
behave exactly as before, which the replay baseline test confirms. The pad never simulates
direction releases and re-taps.

**State clearing:** `Input.reset()` (called on pause, resume, window blur, round start and now
rotation) clears the `sprint` source and makes the pad forget its thumbs, so a slide after a
reset does nothing until a fresh press. `pointercancel` and `lostpointercapture` release that
pointer's directions and run only.

**Guard:** `npm run guard` reports `src/input.js` (touch input, expected for the controls work)
and `src/entities.js` (the held sprint rule above). No other gameplay file changed; attack
numbers, enemy behaviour, Kiai and the keyboard map are as on `main`.

### 7.4 Checks (revision 1b)

Automated (not a device test): lint OK, build OK, **151 tests pass** (145 before; 6 new or
extended: run-zone hysteresis values, walk/run/pull-back/release with no simulated re-taps,
diagonal run and thumb outside the pad, run back to centre, cancel and lost capture release the
run, reset forgets the thumb, no keyboard key maps to the pad sprint; player: the held sprint
input runs at sprint speed, changes direction without a second start cue, ends on release, does
nothing without a direction; the hold-back guard still blocks with the thumb in the run zone).
The replay baseline and the playthrough pass unchanged.

Emulated phone (desktop app's browser, 740 x 360, single synthetic pointer, not a device test):
in menus the root computes `touch-action: manipulation`, the stage `none`; while playing the root
computes `none`. On the pad: a press at 0.6 of the radius walks (72 units/s), a move to 0.9 runs
(126 units/s, ring and nub gold), a move back to 0.7 keeps running, a move to 0.5 walks again
with the direction kept, a move to 1.3 (outside the pad) runs, release stops. A press on the far
left runs left and turns Tamas. The diagnostic line shows `scale=1.00`, matching viewport
sizes and zero refused gestures in emulation. Pausing while running leaves `sprinting` true on
the frozen player until the first resumed step, which ends it (the input was reset), as
intended. Screenshot: `docs/mobile/phase1b-landscape-run-zone-emulated.jpg`.

**Not verified here, for the phone retest:** whether any pinch or double-tap still zooms on the
real device and in the embedded browser (watch `scale=` and the `gestures blocked` counters in
`?touchlog=1`); whether the snap-back fires if a zoom slips through; the feel of the 0.80 / 0.60
lines under a real thumb; the run on diagonals; rotation mid-run. The desktop app's browser
cannot pinch.

### 7.5 Revision 1c: touch edges no longer reach the double-tap detector; bounded snap-back

Founder's headless reproduction on 675e90d: touch down at 50 % of the pad radius (walk), release
for one simulation frame, touch down again at the same spot inside the 0.25 s tap window:
`input.sprint` stays false, yet `player.sprinting` turns true and the pad's run indicator stays
off. Cause: the pad's press and release of a direction look exactly like key taps to
`Player.trackTaps`, which only ever knew the keyboard.

Fix: the snapshot now carries `padMove`, true while any direction is held by a touch pointer
(`Input.padMove`, `src/input.js`). `Player.trackTaps` treats direction edges as taps only when
`padMove` is false; pad edges clear the tap timer instead of arming it, so a pad touch followed
by a key tap inside the window is not a double-tap either. On touch the run comes from the held
`sprint` input alone; the keyboard double-tap is unchanged. The radial thresholds stay at the
provisional 0.80 / 0.60. Regression tests: `test/entities.test.js` ("touching the pad twice in
the walk zone never starts a sprint"), `test/input.test.js` (`padMove` is false for keys, true
for the pad, and a second quick walk-zone touch is still a walk request). Scripted inputs without
the field behave as before; the replay baseline passes.

Zoom snap-back bound (`ZOOM_RESET` in `src/gestures.js`): at most 3 resets per 10 s; further
triggers are counted as `suppressed=` in the diagnostic instead of rewriting the meta again, so a
browser that keeps its zoom despite the meta, or that fires viewport resizes continuously,
cannot be reset in a loop. `test/gestures.test.js` drives the guard with fake document and window
objects: pinch moves refused in menus and in play, one-finger moves refused only in play,
WebKit gesture events refused, one snap-back while playing with the original meta restored, none
in a menu except after a rotation, the bound under twelve resizes at scale 2, and no reset at
scale 1. **The zoom diagnosis and the snap-back remain awaiting physical-device verification**;
these tests prove the logic, not the browser.

Skin and names: PR #22 (navy/cyan touch-control skin, colours only; the ability named "Kiai" in
the interface) is merged into the branch as its own commit, after checking that it changes only
colour declarations in the touch section of `karate-game.css`, the hint, comment, meter label
and aria text in `index.html`, and the three meter strings in `src/ui.js`. Geometry, class names,
hit areas and input code are unchanged; the floating "AJSICH!" and Tamas's shout are unchanged.

### 7.6 Revision 1d: a thumb can never be pinned by a stale pad pointer

Founder's phone finding on the combined candidate (a7f64de, controls 9f37f68, landscape, real
iPhone): after running into the left edge of the picture, dragging the stick right did not
reverse Tamas; the pad showed the nub on the right and still amber while he stayed at the edge
facing left.

**What the code allowed.** Reversing without lifting is correct in every headless and emulated
run (the UX session reproduced the exact sequence in Chromium with the same result: reversal,
boundary and release all fine). The only state that produces "stick right, player pinned" is a
direction still held by a pad pointer whose end was never delivered: then `left` stays held by
the dead pointer id, the new touch presses `right`, and the two cancel to no movement with the
run flag still set and the facing unchanged. The pad recorded one entry per pointer id and
released only on that id's `pointerup`, `pointercancel` or `lostpointercapture`; if a browser
drops that event, or reports the lift under another id, the hold survives for the rest of the
round. Nothing in the game's facing or edge rules contributes: at the edge `x` is clamped, and a
held `right` moves the player right at once (`test/padGame.test.js`).

**Smallest supported correction (`src/input.js`):**
1. One thumb per pad: a new `pointerdown` on the pad forgets every earlier pad pointer and
   releases everything it held, so a stale direction can never pin the player.
2. A pad pointer that ends lets go of **everything** it holds (`releaseSource`), not only what the
   pad recorded for it.
3. A moving touch contact the pad never saw start (a lost `pointerdown`) is adopted as a fresh
   press; a thumb forgotten by a reset (pause, blur, rotation) stays dormant until it lifts or
   presses again, as before.
4. Watchdog on the document: when `touchend` / `touchcancel` reports no remaining finger on the
   screen, everything held by touch is released (keys stay). Touch events are independent of
   pointer capture and of which element a finger started on, so this catches any lost pointer
   event for any button or the pad.
5. `?touchlog=1` now shows the pad's live pointer ids, the sources holding each direction and the
   sprint, and the player's x, facing and run flag, so a stale id is visible on the device.

**Verification (headless, not a device test):** `test/padGame.test.js` drives the real `Game`
through the real `Input` with a fake pad: run left to the edge, reverse right without lifting
(turns and leaves the edge at sprint speed), neutral stops, release stops; the same to the right
edge (found by running until the player stops gaining ground, since the camera follows); a lost
`pointerup` at the edge followed by a new touch takes over at once; pause and resume mid-run
leave nothing held and a fresh press runs again. `test/input.test.js` adds the supersede, the
release-everything, the adoption and the watchdog cases. 167 tests pass; lint, build and the
guard (still `src/input.js` and `src/entities.js`) unchanged in kind. Emulated browser: the same
sequence on the local build, plus a synthetic `touchend` with no touches clearing a deliberately
stale hold.

**Still unknown:** which event the iPhone actually lost. The diagnostic line is the instrument
for that; the correction above holds whichever it was.
