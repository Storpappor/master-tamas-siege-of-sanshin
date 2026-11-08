# Dojo background (`dojo.png`)

Reviewed and approved as the candidate for the background integration on 6 November 2026.
Not yet loaded by the game: the renderer still paints the procedural room until the
background loader is integrated (coordination with the other developer first).

| Item | Value |
|---|---|
| File | `assets/backgrounds/dojo.png` |
| Dimensions | 1840 x 360 px, RGBA, every pixel opaque |
| Colours | 41 (the environment palette; none of the Tamas sheet's 30 colours) |
| SHA-256 | fa4048275f2f1064ab995de41fc67d46cc71e18010faae3d26e00d1b6a3f7b52 (lighting pass revision 3 of 8 November 2026, drawn mat material and indigo plaster to the approved direction `docs/art/lighting/ref-dojo-approved-direction.webp`; the approved full dojo it was made from is 8db7254d…, kept in `docs/art/lighting/source/`, see `docs/art/lighting/README.md`) |
| Placement | world art column 2000 (world x 1000), row 0, drawn 1:1, never scaled |
| Wall/floor boundary | art row 244 in every column; walkable band rows 244-341; front strip 342-359 |
| Approved D1 checkpoint | columns 100-739, pixel-identical to `dojo-checkpoint.png` (SHA-256 dcbb8274...) |

Composition: entrance section at columns 0-99 (inside of the street door at columns 6-54,
rows 168-243), D1 at 100-739, middle dojo at 740-1199 (tube, three kick shields, second
pillar at 880-916, dark mirror panel at 980-1140, tube), boss screen at 1200-1839 (club
photographs, tube, third pillar at 1460-1496, main tube and light pool at 1520-1586,
calligraphy scroll at 1640-1700, dim tube, corner shading in the last 40 columns).
No heavy bags, no training dummy, no lettering outside the D1 logo and banner, one cyan accent.

Accepted deviations from the production plan: the first middle tube sits at columns 767-833
(plan: 760-826) so its housing does not start on the D1 join; the two new pillars are one red
step darker in rows 198-243 for belt separation (the D1 pillar is unchanged); the ceiling at
the joins shows D1's own bracket details.

Built from the approved D1 pixels with a script (no external art pipeline): D1 verbatim, its
ceiling, wall, floor, tube fixture, light pool and pillar continued or copied, and the new
props drawn in the same palette.
