# Master Tamás: Siege of Sanshin

An original, NES-inspired side-scrolling karate game. Defend the dojo against the
Shadow League and face Master Kage at the end of the hall.

**Play it in your browser:** https://storpappor.github.io/master-tamas-siege-of-sanshin/

## Controls

| Action | Keyboard | Phone |
|---|---|---|
| Move | ← → or A D | ◀ ▶ buttons |
| Crouch | ↓ or S | ▼ button |
| Jump | Space (or ↑ / W) | Jump |
| Punch / Kick / Block | J / K / L | Punch / Kick / Block |
| Kiai (double damage, breaks guards) | I | Kiai |
| Pause | P or Esc | Pause button |

Tips: duck under high kicks, jump over low sweeps, hold block to absorb a strike,
and land hits without getting hit to build a combo multiplier.

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
  entities.js      Player (input-driven) and Enemy AI (striker / kicker / boss)
  combat.js        attack timings, hit boxes, block rules (pure functions)
  level.js         spawn schedule for the training hall
  heroSprite.js    hero sprite sheet: frame detection, scaling, drawing
  sprites.js       procedurally drawn enemies + 3x5 bitmap font
  renderer.js      dojo background, camera, pixel-perfect canvas scaling
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
- Enemies are drawn procedurally; to give them sprite sheets, follow the pattern in `heroSprite.js`.
