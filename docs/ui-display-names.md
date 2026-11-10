# Display names (player-facing) versus internal identifiers

Decided 10 November 2026 (design document "Master Tamas: samlad UI-design"). The code, the enemy
types, the dialogue constants, the sound cues and the asset files keep their internal names;
`src/names.js` maps them where the player reads them.

| Shown to the player | Internal identifier | Where it is mapped |
|---|---|---|
| Råttfällan (RÅTTFÄLLAN in uppercase) | `ENEMY_TYPES.boss.label` = `'Master Kage'`, `KAGE_DIALOGUE`, banner `'MASTER KAGE APPROACHES'`, `head: 'kage'` in `src/sprites.js`, `bossAppear`/boss track cues | HUD label (`index.html`), help legend, dialogue cards (`ui.js` story renderer), stage banner (`renderer.js`) |
| Kiai (KIAI) | `kiai` action, `KIAI` constants, `kiaiReady`/`kiaiActive`, `kiaiStart`/`kiaiStrike` cues, `data-btn="kiai"` | HUD label and meter, help, touch button, accessibility labels |
| "ajsich" (what Tamas shouts when Kiai activates) | floating text `'AJSICH!'` in `src/game.js` (activation and each powered strike), synthesized shout cue `kiaiStart`/`kiai` | unchanged: it is the character's cry, not an interface label |
| Tamas (no accent) | `TAMAS` in dialogue, `Tamas` HUD name | all player-facing text |

For the enemy-art workstream: the boss sheet, its JSON and the `kage` head palette keep their
names. A boss sprite sheet delivered under the internal name needs no renaming; the name the
player sees comes from this mapping.
