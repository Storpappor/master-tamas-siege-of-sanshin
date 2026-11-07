# Master Tamás: Siege of Sanshin

An original, NES-inspired side-scrolling karate game. Fight your way along the street on
Södermalm, drive the Shadow League out of the Sanshin Kan dojo and face Master Kage at the end.

**Play it in your browser:** https://storpappor.github.io/master-tamas-siege-of-sanshin/

## Controls

| Action | Keyboard | Phone |
|---|---|---|
| Move (also into and out of the floor) | ← → ↑ ↓ or W A S D | ◀ ▶ ▲ ▼ buttons |
| Duck | C | Duck |
| Jump | Space | Jump |
| Punch / Kick / Block | J / K / L | Punch / Kick / Block |
| Grab and throw (goes through a guard) | J + K together | Punch + Kick together |
| Sprint | Double-tap a direction | Double-tap a direction |
| Block without the block key | Hold the direction away from an incoming strike or star | Same, with the arrows |
| Kiai (double damage, breaks guards) | I | Kiai |
| Pause | P or Esc | Pause button |

Tips: duck under high kicks, jump over low sweeps, hold block (or hold away from the strike) to absorb it,
throw an enemy who keeps blocking,
block, duck or sidestep throwing stars, step up or down to line up a strike or slip out of one, and land hits without getting
hit to build a combo multiplier. Each fight holds the screen until it is won; then follow
the GO arrow. At the end of the street, walk up to the door to enter the dojo.

## For developers

Plain HTML5 Canvas and ES modules. No framework, no dependencies, no build step.
Node 20 or newer is only needed for the helper scripts.

```bash
npm start        # local server at http://localhost:8080/
npm run lint     # syntax check + broken import/reference check
npm test         # unit tests + a headless full playthrough (node:test)
npm run build    # validates and copies the deployable files into dist/
```

Opening `index.html` directly from disk does not work in most browsers because the
game uses JavaScript modules; it needs to be served over http. GitHub Pages serves
the `main` branch as-is, so pushing to `main` publishes the game.

### Layout

```
index.html         page shell: HUD, overlays, touch buttons (all logic in src/)
karate-game.css    styles, prefixed "kg-" so the game can be embedded in any page
assets/            tamas-hero-spritesheet.png (4x2 frames, transparent)
src/
  main.js          boot: DOM wiring, input, audio, sprite loading, game loop
  game.js          state machine, spawning, hit resolution, scoring, dialogue
  entities.js      Player (input-driven) and Enemy AI (striker / kicker / thrower / boss)
  combat.js        attack timings, hit boxes, block rules (pure functions)
  level.js         zones and position-triggered waves (Spawner)
  heroSprite.js    hero sprite sheet: frame detection, scaling, drawing
  sprites.js       procedurally drawn enemies + 3x5 bitmap font
  renderer.js      zone backgrounds, depth sorting, GO prompt, pixel-perfect scaling
  audio.js         synthesized sound effects (Web Audio)
  input.js         keyboard + multi-touch buttons
  ui.js            HUD, overlays and the NES-style story cards
  constants.js     tuning numbers and colour palette
test/              node:test suites; game logic is DOM-free so it runs headless
scripts/           zero-dependency dev server, lint and build helpers
```

### Design notes

- The simulation runs at a fixed 60 Hz step; rendering runs per animation frame.
- Game logic never touches the DOM, which is what makes the headless playthrough test possible.
- One fixed hitbox per fighter, independent of the artwork frame being shown.
- Fighters have x (along the level), z (depth on the floor) and y (height). `y` is not a screen position: draw with `screenY(y, z)`. Attacks connect only within `DEPTH_REACH` in z.
- The camera only moves forward. Reaching a wave locks it until the wave is beaten, and everyone stays on screen so a fight can always be finished.
- Zones are separate scenes in one world strip. A zone's `exit` door opens when its waves are won; walking up to it fades to the next zone.
- Enemies are drawn procedurally; to give them sprite sheets, follow the pattern in `heroSprite.js`.
