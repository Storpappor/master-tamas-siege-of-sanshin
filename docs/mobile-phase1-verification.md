# Mobile controls, phase 1: what was built and how it was checked

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
