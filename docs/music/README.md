# Music

The game plays one music track, "Triumph in the Ring" (Suno). `src/music.js` plays it on its
own Web Audio graph; `MUSIC` at the top of that file is the one place to change the file, the
volume, the loop points and the fade.

| File | What it is |
|---|---|
| `assets/audio/triumph-in-the-ring-92.mp3` | **the playback asset**: the source slowed to 92 % of its tempo (about 121.4 BPM), pitch preserved, 192 kbit/s, 2:10 |
| `assets/audio/triumph-in-the-ring.mp3` | the original source at its own tempo (131.98 BPM), kept unedited |

The slower version was rendered from the source with a WSOLA time stretch (`audiotsm`) and
encoded with LAME (`lameenc`), both run from a throwaway Python environment; nothing in the
repo depends on them.

## Loop

The playback asset is played unedited. The loop points sit inside the decoded buffer:

| | Time | Why |
|---|---|---|
| `loopStart` | 1.28667 s | the downbeat where the band enters; the quiet 1.3 s intro plays once per run |
| `loopEnd` | 125.84646 s | the downbeat where the ending starts to thin out, 63 bars (252 beats) later |

How they were found: the source's loop points (1.17877 s and 115.742 s, on its beat grid) were
located in the decoded 92 % file by waveform cross-correlation, because the time stretch is
not perfectly uniform (the two points landed 8 ms and 40 ms later than a plain division by
0.92). Both were then moved by under 3 ms to the sample pair with the smallest waveform jump
across the seam.

The MP3 carries no gapless (LAME) header, so decoders differ on the lead-in: CoreAudio
(Safari, macOS) and Chromium's decoder are 529 samples (11 ms) apart. The seam was chosen so
that it stays continuous under both alignments (jump about 0.03 full scale either way, against
0.07 to 0.18 on the raw grid). The ring-out and silence after `loopEnd` are never heard.

`loop-seam-preview.mp3` is cut from the playback asset: the last four bars before `loopEnd`
followed by the first four bars from `loopStart`, twice, so the seam can be judged on its own.

## Tempo previews

`tempo-preview-100.mp3` and `tempo-preview-92.mp3` are the same 16 bars (30.27 s to 59.37 s of
the source) at the source tempo and at 92 % of it, pitch preserved. The 92 % tempo was chosen.

To go back to the source tempo: point `MUSIC.src` at `triumph-in-the-ring.mp3` and set
`loopStart: 1.17877, loopEnd: 115.742` (those points were found on the source file the same way).

## Tracks and the mixer (phase two)

`MUSIC.tracks` names three tracks: `stage` (above), `menu` and `boss`. The `MusicMixer` keeps one
of them current; handing over fades the old track on its own gain and remembers its position,
so the menu theme continues between the intro cards, the title and the result screens, and the
stage track comes back where it was if play goes on after the boss. A track with `src: null` is
pending: it is never requested (no failed network request) and asking for it leaves the current
track alone (the stage track carries on through the boss, result screens stay quiet).

| Track | Asset | Gain | Loop | Body level |
|---|---|---|---|---|
| `stage` | `assets/audio/triumph-in-the-ring-92.mp3` (121.4 BPM, 2:10) | 0.15 | 1.28667 s to 125.84646 s | −21.7 dBFS |
| `menu` | `assets/audio/menu-theme.mp3` (133 BPM, 2:00, supplied tempo) | 0.10 | 1.98873 s to 116.48144 s | −18.5 dBFS |
| `boss` | `assets/audio/boss-theme.mp3` (131 BPM, 2:12, supplied tempo) | 0.12 | 7.70581 s to 129.62725 s | −19.4 dBFS |

Gains: the menu and boss files are 3.2 dB and 2.3 dB louder than the stage file (body RMS,
first and last 8 s excluded), so their gains bring them to the stage track's perceived level;
the boss sits about 0.4 dB above it and gets its intensity from the arrangement, leaving the
impacts on top. The effects keep their own master gain (0.24) and heavy cues duck the music.

Menu and boss loop points were derived on each decoded file separately, with the beat grid
fitted locally at the start and at the end of the file (the global tempo drifts over two
minutes): `loopStart` sits where the attack of the entry downbeat begins, after the opening
that plays once (the menu's two-beat pickup, the boss's 7.7 s build); `loopEnd` sits where the
attack of the final hit begins, so the ending's hit, ring-out and silence are never looped
and the entry's hit stands in for it. Each point was then moved by under 1.5 ms to the sample
pair with the smallest waveform jump across the seam (menu 0.004, boss 0.010 full scale,
against 0.21 and 0.39 at the attack starts). Both files carry a gapless header, and Chromium
and CoreAudio decode them to the same alignment. `loop-seam-menu.mp3` and `loop-seam-boss.mp3`
play the last four bars before `loopEnd` followed by the first four from `loopStart`, twice.

## Sound cues and the audio director

`src/sound.js` is the `audio` object the game receives. The game's event names (`start`, `hit`,
`hitHeavy`, `pause`, ...) stand for more than one moment each, and `game.js` is guarded, so the
sound layer only queues them. `src/audioDirector.js` runs once per frame after the simulation
steps and resolves each raw event with the game's state into one cue:

| Raw event | Resolved by | Cue |
|---|---|---|
| `start` | a run just began / a door just opened / otherwise | `gameStart` / `doorEnter` / `waveClear` |
| `pause` | suppressed for automatic pauses (blur, hidden tab) | `pauseCue` or silence |
| `punch` | the player's attack is a grab | `grabReach` / `whooshLight` |
| `kick`, `kiai` | | `whooshHeavy`, `kiaiStrike` |
| `hit` | the last strike was a kick | `kickHit` / `punchHit` |
| `hitHeavy` | a thrown fighter just landed | `throwLand` / `kiaiHit` |
| `enemyDown` | a thrown fighter just landed | `throwLand` / `enemyKo` |
| `bossAppear` | | `bossEnter`; the boss track waits for Kage's dialogue |
| `hurt`, `block`, `jump`, `land`, `shuriken`, `kiaiStart`, `victory`, `gameOver` | | one cue each |

### When the boss theme starts

The encounter begins, musically, when Master Kage's introductory dialogue opens: the game
state becomes `dialogue` while `game.boss` is alive. Entering the dojo, the dojo's own zone
card and Kage's spawn (which happen with the stage track running) do not switch tracks, and the
dialogue closing or any later exchange does not restart the boss theme: it starts once per run.
In the game, the spawn and the dialogue land in the same simulation step, so a trigger that
only looked at the boss on frames without a state change missed the hand-over entirely.

### Missing hooks

The game raises no event for these moments; the director reads them from state changes:

- the grip taking hold (`player.attack.name` becomes `throw`) → `grabHold`
- the throw's release (`player.attack.released`) → `throwToss`
- the victim landing (an enemy's `thrown` flag dropping) → decides `throwLand`
- an enemy starting a strike (`enemy.attack` appearing; shuriken excluded) → `enemyWhoosh`
- resume after a pause (state `paused` → `playing`) → `resumeCue`

Two game events cannot be told apart from state and are left as they are: `block` does not say
whether Tamas or the enemy blocked, and a knockout by a normal strike and by a kiai strike both
arrive as `enemyDown`. Adding explicit events would mean editing the guarded `game.js`.

Each cue has a minimum repeat gap and the impact and whoosh groups are limited to three and two
simultaneous voices; repeated cues vary pitch by up to 4.5 % and level by up to 12 %. Heavy cues
(throw landing, kiai hit, knockout, player damage, boss entrance, game start) duck the music to
half for 0.35 s.
