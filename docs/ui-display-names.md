# Player-facing copy: display names and the language rule

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

## Language rule (decided 10 November 2026)

- **Menus, controls and system UI are English**: PLAY, PAUSE, RESUME, SCORE, ENEMIES, KIAI, HOW TO PLAY,
  JUMP, PUNCH, KICK, THROW, the HUD, the help, the result statistics, hints and key prompts.
- **Story, stage narration and character dialogue are Swedish**: the intro cards (`INTRO_SCREENS` in
  `src/main.js`), the zone cards and the boss exchange (`ZONE_CARDS`, `KAGE_DIALOGUE` in `src/game.js`),
  the stage announcements (`RÅTTFÄLLAN NÄRMAR SIG`, `SLÅSS!`), Tamas's lines, and the result headings and
  quotes (`Tamas är nere`, `Knuten håller`).
- The game title `Master Tamas: Siege of Sanshin` stays English.

The narrative lines that live in the gameplay files stay as written there (those files are identical
to `main`); `NARRATIVE` in `src/names.js` translates them when they are shown: the banner
`MASTER KAGE APPROACHES` and the line `MASTER KAGE: POWER CREATES RESPECT.`. New narrative copy should
be written in Swedish directly where it lives.
