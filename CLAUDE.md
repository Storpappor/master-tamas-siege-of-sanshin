# Master Tamás: Siege of Sanshin

Original NES-inspired karate side-scroller: plain HTML5 Canvas and ES modules. See
`README.md` for controls, the file layout and design notes.

## Commands

Node 20+ is only needed for the helper scripts. There are no dependencies to install.

```bash
npm start         # dev server at http://localhost:8080/ (PORT overrides)
npm run lint      # syntax check + broken import/reference check
npm test          # node:test suites, including a headless full playthrough
npm run build     # lint, then copy the deployable files into dist/
npm run check     # lint + test + build
```

Run a single suite with `node --test test/combat.test.js`.

## Rules

- **Pushing to `main` publishes the game**: GitHub Pages serves that branch as-is. Work
  on a branch and run `npm run check` before anything reaches `main`.
- **No dependencies, no bundler, no build step.** The site must keep working when served
  straight from the repo. `dist/` is generated and ignored.
- **Game logic stays DOM-free.** `game.js`, `entities.js`, `combat.js` and `level.js` must
  run in Node, because the tests depend on it. Browser code belongs in `main.js`, `ui.js`,
  `input.js`, `renderer.js`, `audio.js` and `HeroSprite`. Reach the page from the game only
  through the injected `ui`, `audio` and `input` objects.
- **Randomness goes through the injected `rng`**, not `Math.random`, so that tests stay
  deterministic. Cosmetic browser code (screen shake, audio noise) is the exception.
- **CSS classes keep the `kg-` prefix** so the game can be embedded in another page.
- **Hitboxes are fixed per fighter** and independent of the artwork frame shown.

## Where to change things

| To change | Edit |
|---|---|
| Speed, physics, Kiai, combo, score, palette | `src/constants.js` |
| Attack timing, damage, reach, high/low rules | `ATTACKS`, `HIGH_ATTACKS`, `LOW_ATTACKS` in `src/combat.js` |
| Enemy stats and behaviour | `ENEMY_TYPES` and `Enemy.update` in `src/entities.js` |
| Zones and waves | `LEVEL_1` in `src/level.js` (zone art in `src/renderer.js`) |
| Floor depth and hit reach in depth | `DEPTH`, `DEPTH_REACH` in `src/constants.js` |
| Story and dialogue text | `INTRO_SCREENS` in `src/main.js`, `KAGE_DIALOGUE` in `src/game.js` |

Keep these in sync when they change:

- The HUD's initial enemy count is hard-coded in `index.html` (22 = 21 regulars + boss).
- The playthrough test in `test/game.test.js` asserts a clear time of 55-100 s, so balance
  or level changes can fail it. Treat that as a design signal, not just a broken test.
- `SCORE.timeBonusLimit` assumes the same target length.

## Gotchas

- A fighter's `y` is height, not a screen position. Draw with `screenY(y, z)`, and sort by `z`.
- `src/main.js` runs `boot` on import and needs a browser, so tests cannot import it.
- `index.html` must be served over http; ES modules fail from `file://`.
- The start buttons stay disabled until the hero sprite sheet has loaded.
- The canvas bitmap font (`GLYPHS` in `src/sprites.js`) has A-Z, `Ö`, 0-9 and `+-!:.` only;
  other characters such as `Á` draw as blanks. Story cards and the HUD are HTML, so they
  are not affected.
- The street and dojo backgrounds are modelled on the real Sanshin Kan on Södermalm, so
  check art changes against the club's look (red and sage mats, red padded pillars).
- Sheet frame order is fixed: idle, step, punch, kick / block, hit, knockdown, victory.
  There is no jump or crouch art: jump borrows victory and crouch borrows hit.
- The tests prove the level can be cleared by one bot on one seed. They say little about
  how the game feels, so check gameplay changes in a browser too.
