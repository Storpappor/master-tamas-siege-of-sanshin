# Music

The game's one music track is `assets/audio/triumph-in-the-ring.mp3` (Suno, 48 kHz stereo,
2:00). `src/music.js` plays it on its own Web Audio graph; `MUSIC` at the top of that file is
the one place to change the file, the volume, the loop points and the fade.

## Loop

The file is played unedited. The loop points sit inside the decoded buffer:

| | Time | Why |
|---|---|---|
| `loopStart` | 1.17877 s | the downbeat where the band enters; the quiet 1.2 s intro plays once per run |
| `loopEnd` | 115.742 s | the downbeat where the ending starts to thin out, 63 bars (252 beats) later |

Tempo measured at 131.98 BPM (beat 0.4546 s, bar 1.818 s). Both points were shifted by
under a millisecond from the beat grid to the sample pair with the smallest waveform jump
(0.005 full scale against 0.18 on the grid), so the seam does not click. The last 4.1 s of
the file (a ring-out, then silence) are never heard in the loop.

`loop-seam-preview.mp3` plays the last four bars before `loopEnd` followed by the first four
bars from `loopStart`, twice, so the seam can be judged on its own.

## Tempo previews

`tempo-preview-100.mp3` and `tempo-preview-92.mp3` are the same 16 bars (30.27 s to 59.37 s
of the source) at the source tempo and at 92 % of it, pitch preserved (WSOLA time stretch,
192 kbit/s MP3). The game ships the source tempo for now.

To switch to the slower version: render the full track at 92 % the same way, save it as
`assets/audio/triumph-in-the-ring-92.mp3`, point `MUSIC.src` at it and divide both loop
points by 0.92 (about 1.2813 s and 125.806 s), then re-check the seam.
